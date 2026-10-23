from pathlib import Path
import json

import httpx
import pytest

from app.agents.sensing import assess_disruption
from app.llm.disruption_extract import extractor_for
from app.llm.explain_plan import explain_plan, plan_context, plan_template
from app.llm.gateway import LLMGateway, request_hash
from app.llm.lc_extract import compare_with_record, extract_lc_fields, validate_extraction
from app.llm.record import write_recorded
from app.llm.registry import list_prompts
from app.llm.validate import validate_output
from conftest import golden, load_fx

from backend.app.services.evaluation import build_evaluation_payload, plan_hash_material, sha256_of

START, END = "2026-10-26T09:00:00+05:30", "2026-10-26T09:00:04+05:30"


def _eval(fx, gateway):
    return build_evaluation_payload(fx, "DIS-2026-0042", "EVAL-0001", ("PLN-0001", "PLN-0002"),
                                    gateway.mode, START, END, gateway=gateway)


def test_registry():
    assert list_prompts() == ["dependency_explain_v1", "disruption_extract_v1", "lc_extract_v1", "plan_explain_v1"]


def test_request_hash_is_canonical():
    assert request_hash("p", "1", {"a": 1, "b": [2]}) == request_hash("p", "1", {"b": [2], "a": 1})
    assert request_hash("p", "1", {"a": 1}) != request_hash("p", "2", {"a": 1})


def test_off_mode_equals_golden_explanations(fx):
    gold = golden("evaluation_EVAL-0001.json")
    ev = _eval(fx, LLMGateway(mode="off"))
    strip = lambda xs: [{k: v for k, v in x.items() if k != "generated_at"} for x in xs]
    assert strip(ev["explanations"]) == strip(gold["explanations"])
    assert ev["steps"][6]["mode"] == "template" and ev["steps"][6]["status"] == "succeeded"


@pytest.mark.parametrize("gw,mode,status", [
    (LLMGateway(mode="off"), "template", "succeeded"),
    (LLMGateway(mode="recorded"), "recorded", "succeeded"),
    (LLMGateway(mode="live", base_url="http://127.0.0.1:9/v1", model="m", timeout_s=1, capture_dir=None),
     "template", "degraded"),
    (LLMGateway(mode="live"), "template", "degraded"),  # not configured
], ids=["off", "recorded", "live-unreachable", "live-unconfigured"])
def test_vc_llm_01_same_outcomes_and_hashes(fx, gw, mode, status):
    """VC-LLM-01 automated: plan outcomes and hashes identical to golden in every mode."""
    gold = {p["plan_id"]: p for p in golden("evaluation_EVAL-0001.json")["plans"]}
    ev = _eval(fx, gw)
    for p in ev["plans"]:
        assert p["outcome"] == gold[p["plan_id"]]["outcome"]
        assert p["plan_hash"] == gold[p["plan_id"]]["plan_hash"] == sha256_of(plan_hash_material(p))
    assert {x["mode"] for x in ev["explanations"]} == {mode}
    assert ev["steps"][6]["mode"] == mode and ev["steps"][6]["status"] == status
    if mode == "recorded":
        assert all(x["validation"]["passed"] and x["model"] for x in ev["explanations"])


def test_live_retry_once_then_template(fx):
    calls = []

    def handler(request):
        calls.append(1)
        return httpx.Response(500)
    gw = LLMGateway(mode="live", base_url="http://m/v1", model="m", transport=httpx.MockTransport(handler), capture_dir=None)
    ev = _eval(fx, gw)
    assert len(calls) == 4  # 2 plans x (1 call + 1 retry)
    assert ev["steps"][6]["attempts"] == 2 and ev["steps"][6]["status"] == "degraded"


def test_live_capture_written(fx, tmp_path):
    out = {"text": "PLN-0002 passed. Net avoided loss INR 618000.", "cited_ids": []}
    gw = LLMGateway(mode="live", base_url="http://m/v1", model="m", capture_dir=tmp_path,
                    transport=httpx.MockTransport(lambda r: httpx.Response(
                        200, json={"choices": [{"message": {"content": json.dumps(out)}}]})))
    _eval(fx, gw)
    assert len(list((tmp_path / "plan_explain_v1").glob("*.json"))) == 2


def test_vc_llm_02_unknown_citation(fx, tmp_path):
    """VC-LLM-02 automated: a recorded response citing EDGE-999 is rejected and replaced by the template."""
    ev = _eval(fx, LLMGateway(mode="off"))
    findings = {f["finding_id"]: f for f in ev["findings"]}
    plan = ev["plans"][1]
    ctx = plan_context(plan, findings)
    payload = {"subject_id": plan["plan_id"], "lines": ctx["lines"], "allowed_citation_ids": ctx["allowed_citation_ids"]}
    write_recorded("plan_explain_v1", payload, {"text": "See the supplier edge.", "cited_ids": ["EDGE-999"]}, directory=tmp_path)
    xpl, info = explain_plan(plan, findings, LLMGateway(mode="recorded", recorded_dir=tmp_path), END)
    assert xpl["validation"] == {"passed": False, "errors": ["UNKNOWN_CITATION"]}
    assert xpl["mode"] == "template" and xpl["text"] == plan_template(plan, findings)["text"]
    assert info["degraded"]


@pytest.mark.parametrize("text,outcome,errors", [
    ("PLN-0001 is approved.", "blocked", ["OUTCOME_CONTRADICTION"]),
    ("PLN-0001 is not approved.", "blocked", []),
    ("SUP-B is independent of the fab.", "needs_review", ["OUTCOME_CONTRADICTION"]),
    ("PLN-0002 is blocked by FTA.", "passed", ["OUTCOME_CONTRADICTION"]),
    ("Saves INR 9,99,999.", "passed", ["NUMBER_NOT_IN_CONTEXT"]),
    ("Saves INR 8,26,000.", "passed", []),
    ("x" * 601, "passed", ["TOO_LONG"]),
    ("   ", "passed", ["EMPTY"]),
])
def test_validator(text, outcome, errors):
    sid = "PLN-0001" if "PLN-0001" in text else "PLN-0002"
    out = {"text": text, "cited_ids": []}
    assert validate_output(out, allowed_ids=[], context_text="net=826000 PLN-0001 PLN-0002",
                           outcome=outcome, subject_id=sid) == errors


def test_lc_extraction_recorded_matches_record(fx):
    lc = fx["letters_of_credit"]["letters_of_credit"][0]
    assert extract_lc_fields(lc["raw_text"], LLMGateway(mode="off")) is None
    got = extract_lc_fields(lc["raw_text"], LLMGateway(mode="recorded"))
    assert got is not None and not validate_extraction(got) and compare_with_record(got, lc) == []


def test_lc_extraction_mismatch_vc_lc_07(fx):
    """Extraction path of VC-LC-07: a wrong 43T extraction is detected as a mismatch, record unchanged."""
    lc = fx["letters_of_credit"]["letters_of_credit"][0]
    before = json.dumps(lc["structured"], sort_keys=True)
    assert compare_with_record({"transhipment": "allowed"}, lc) == ["transhipment"]
    assert json.dumps(lc["structured"], sort_keys=True) == before
    assert validate_extraction({"transhipment": "maybe", "extra": 1}) == ["unexpected field extra", "transhipment not in ['allowed', 'conditional', 'not_allowed']"]


def test_disruption_extraction_recorded(fx):
    ev = fx["disruptions"]["events"][0]
    a = assess_disruption(ev, fx, "recorded", extractor=extractor_for(LLMGateway(mode="recorded")))
    assert a["outcome"] == "passed" and a["extraction_mode"] == "recorded"
    miss = assess_disruption({**ev, "raw_text": ev["raw_text"] + " "}, fx, "recorded",
                             extractor=extractor_for(LLMGateway(mode="recorded")))
    assert miss["outcome"] == "needs_review" and "EXTRACTION_MISMATCH" in miss["issues"]


def test_regression_7e37ad2_step7_degraded_steperror(monkeypatch, fx):
    """Regression for commit 7e37ad2: with live mode & unreachable URL, step 7 error is StepError object."""
    import jsonschema
    from backend.app.services.evaluation import build_evaluation_payload

    step_error_schema = json.loads(
        (Path(__file__).resolve().parents[2] / "contracts" / "schemas" / "common.schema.json").read_text(encoding="utf-8")
    )["$defs"]["StepError"]

    monkeypatch.setenv("AEGIS_LLM_MODE", "live")
    monkeypatch.setenv("AEGIS_LLM_BASE_URL", "http://127.0.0.1:9/v1")
    monkeypatch.setenv("AEGIS_LLM_MODEL", "test-model")
    monkeypatch.setenv("AEGIS_LLM_TIMEOUT_S", "0.2")

    ev_live = build_evaluation_payload(
        fx, "DIS-2026-0042", "EVAL-0001", ("PLN-0001", "PLN-0002"),
        "live", START, END
    )

    step7 = ev_live["steps"][6]
    assert step7["step"] == "explanation"
    assert step7["status"] == "degraded"
    assert isinstance(step7["error"], dict)
    assert step7["error"]["code"] == "LLM_DEGRADED"
    assert isinstance(step7["error"]["message"], str) and len(step7["error"]["message"]) > 0

    # Valid against StepError schema
    jsonschema.validate(instance=step7["error"], schema=step_error_schema)

    # Business outcomes and hashes equal off-mode run
    ev_off = build_evaluation_payload(
        fx, "DIS-2026-0042", "EVAL-0001", ("PLN-0001", "PLN-0002"),
        "off", START, END
    )
    for p_live, p_off in zip(ev_live["plans"], ev_off["plans"]):
        assert p_live["outcome"] == p_off["outcome"]
        assert p_live["plan_hash"] == p_off["plan_hash"]
        assert p_live["financials"]["recovery_cost_inr"] == p_off["financials"]["recovery_cost_inr"]
        assert p_live["financials"]["net_avoided_loss_inr"] == p_off["financials"]["net_avoided_loss_inr"]
