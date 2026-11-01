"""Tests for MOD-21 early warning endpoint and logic (DA-16, DA-17).

Validates:
- GET /api/v1/early-warnings against pre-notice and scenario-time goldens.
- Schema conformance against signals.schema.json#/$defs/EarlyWarningResult.
- Bad as_of handling (400 Problem response).
- Validation cases VC-EWS-01 through VC-EWS-06 from cases.json.
"""

import json
from pathlib import Path
from typing import Any, Dict

import pytest
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012

from backend.app.agents.early_warning import compute_early_warnings
from backend.app.main import app
from backend.app.services.fixtures import load_fixtures, load_signals, snapshot_id
from conftest import ROOT, apply_patches, golden, load_fx

CASES = [
    c
    for c in json.loads((ROOT / "fixtures/validation/cases.json").read_text(encoding="utf-8"))["cases"]
    if c["case_id"].startswith("VC-EWS")
]


def _schema_validator():
    reg = Registry()
    for p in (ROOT / "contracts/schemas").glob("*.json"):
        reg = reg.with_resource(p.name, Resource.from_contents(json.loads(p.read_text(encoding="utf-8"))))
    return Draft202012Validator({"$ref": "signals.schema.json#/$defs/EarlyWarningResult"}, registry=reg)


def _ews_view(result: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "warnings": {
            w["subject"]["id"]: {
                "score": w["score"],
                "raw_points": w["raw_points"],
                "level": w["level"],
                "contributing_signal_ids": [c["signal_id"] for c in w["contributing"]],
                "order_ids": w["exposure"]["order_ids"],
                "affected_candidate_supplier_ids": w["exposure"]["affected_candidate_supplier_ids"],
            }
            for w in result["warnings"]
        },
        "excluded": {x["signal_id"]: x["reason"] for x in result["excluded_signals"]},
    }


def test_early_warnings_goldens_match_exactly(monkeypatch):
    """Endpoint response for both as_of values equals the two goldens exactly."""
    monkeypatch.setattr("backend.app.main.LLM_MODE", "off")
    client = TestClient(app)

    # 1. Pre-notice golden
    pre_notice_golden = golden("early_warnings_pre_notice.json")
    resp_pre = client.get("/api/v1/early-warnings", params={"as_of": "2026-10-23T21:00:00+05:30"})
    assert resp_pre.status_code == 200, resp_pre.text
    assert resp_pre.json() == pre_notice_golden

    # 2. Scenario-time golden via explicit as_of
    scenario_golden = golden("early_warnings_scenario_time.json")
    resp_scen = client.get("/api/v1/early-warnings", params={"as_of": "2026-10-26T09:00:00+05:30"})
    assert resp_scen.status_code == 200, resp_scen.text
    assert resp_scen.json() == scenario_golden

    # 3. Default as_of (omitted) defaults to scenario clock
    resp_default = client.get("/api/v1/early-warnings")
    assert resp_default.status_code == 200, resp_default.text
    assert resp_default.json() == scenario_golden


def test_early_warnings_schema_conformance(monkeypatch):
    """Response validates against signals.schema.json#/$defs/EarlyWarningResult."""
    monkeypatch.setattr("backend.app.main.LLM_MODE", "off")
    client = TestClient(app)
    validator = _schema_validator()

    resp = client.get("/api/v1/early-warnings")
    assert resp.status_code == 200
    errors = list(validator.iter_errors(resp.json()))
    assert not errors, f"Schema validation errors: {errors}"

    resp_pre = client.get("/api/v1/early-warnings", params={"as_of": "2026-10-23T21:00:00+05:30"})
    assert resp_pre.status_code == 200
    errors_pre = list(validator.iter_errors(resp_pre.json()))
    assert not errors_pre, f"Schema validation errors (pre-notice): {errors_pre}"


def test_bad_as_of_returns_400_problem(monkeypatch):
    """Bad as_of returns 400 Problem response with VALIDATION_ERROR."""
    monkeypatch.setattr("backend.app.main.LLM_MODE", "off")
    client = TestClient(app)

    # Completely invalid date string
    r1 = client.get("/api/v1/early-warnings", params={"as_of": "invalid-timestamp"})
    assert r1.status_code == 400
    assert r1.headers["content-type"].startswith("application/problem+json")
    body1 = r1.json()
    assert body1["code"] == "VALIDATION_ERROR"
    assert body1["status"] == 400
    assert body1["instance"] == "/api/v1/early-warnings"

    # Missing timezone offset
    r2 = client.get("/api/v1/early-warnings", params={"as_of": "2026-10-23T21:00:00"})
    assert r2.status_code == 400
    assert r2.headers["content-type"].startswith("application/problem+json")
    body2 = r2.json()
    assert body2["code"] == "VALIDATION_ERROR"


@pytest.mark.parametrize("case", CASES, ids=lambda c: c["case_id"])
def test_vc_ews_cases(case):
    """Automate VC-EWS-01..06 cases from fixtures/validation/cases.json."""
    base_fx = load_fx()
    base_signals = load_signals(ROOT / "fixtures")
    combined = {**base_fx, "external_signals": base_signals}

    patched = apply_patches(combined, case["patches"])
    signals = patched.pop("external_signals")
    fx = patched

    inp = case["input"]
    exp = case["expected"]
    as_of = inp["as_of"]

    res = compute_early_warnings(fx, signals, as_of)
    view = _ews_view(res)

    if "warnings" in exp:
        for subj_id, expected_w in exp["warnings"].items():
            assert subj_id in view["warnings"], f"Missing warning for subject {subj_id} in {case['case_id']}"
            actual_w = view["warnings"][subj_id]
            for key, val in expected_w.items():
                assert actual_w.get(key) == val, f"{case['case_id']} mismatch for {subj_id}.{key}: {actual_w.get(key)} != {val}"

    if "excluded" in exp:
        for sig_id, reason in exp["excluded"].items():
            assert view["excluded"].get(sig_id) == reason, f"{case['case_id']} excluded mismatch for {sig_id}: {view['excluded'].get(sig_id)} != {reason}"

    if inp.get("kind") == "early_warning_isolation":
        golden_eval = golden("evaluation_EVAL-0001.json")
        golden_snapshot = golden_eval["input_snapshot_id"]
        assert snapshot_id(fx) == golden_snapshot, "VC-EWS-06 input_snapshot_id must equal golden"
        if exp.get("plan_hashes_equal_golden"):
            from backend.app.services.evaluation import build_evaluation_payload
            eval_payload = build_evaluation_payload(
                fx,
                "DIS-2026-0042",
                "EVAL-0001",
                ("PLN-0001", "PLN-0002"),
                "off",
                "2026-10-26T09:00:00+05:30",
                "2026-10-26T09:00:04+05:30",
            )
            actual_hashes = [p["plan_hash"] for p in eval_payload["plans"]]
            golden_hashes = [p["plan_hash"] for p in golden_eval["plans"]]
            assert actual_hashes == golden_hashes, "VC-EWS-06 plan hashes must equal golden"


def test_frontend_stubs_equal_goldens():
    """Stub-mode UI data must not drift from the EWS goldens."""
    for name in ("early_warnings_pre_notice.json", "early_warnings_scenario_time.json"):
        stub = json.loads((ROOT / "frontend" / "public" / "stubs" / name).read_text(encoding="utf-8"))
        assert stub == json.loads((ROOT / "fixtures" / "expected" / name).read_text(encoding="utf-8")), name
