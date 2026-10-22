import copy
import json

import pytest

from app.rules import RuleStoreError, rank_passages, rule_applicability, validate_rules
from conftest import ROOT, apply_patches, golden, load_fx

CASES = [c for c in json.loads((ROOT / "fixtures/validation/cases.json").read_text(encoding="utf-8"))["cases"]
         if c["case_id"].startswith("VC-RULE")]


def _run(fx, q):
    return rule_applicability(q, validate_rules(fx["trade_rules"]), fx["master_data"]["agreements"])


def test_golden(fx):
    for exp in golden("rule_applicability.json")["results"]:
        assert _run(fx, exp["query"]) == exp


@pytest.mark.parametrize("case", CASES, ids=lambda c: c["case_id"])
def test_vc_rule(case):
    fx = apply_patches(load_fx(), case["patches"])
    r, exp = _run(fx, case["input"]["query"]), case["expected"]
    assert r["outcome"] == exp["outcome"]
    assert [a["rule_id"] for a in r["applicable"]] == exp["applicable_rule_ids"]
    reasons = {e["rule_id"]: e["reason"] for e in r["excluded"]}
    for rid, reason in exp.get("excluded", {}).items():
        assert reasons[rid] == reason, rid
    if "conflict_resolutions" in exp:
        assert [c["resolution"] for c in r["conflicts"]] == exp["conflict_resolutions"]
    if "missing_rule_types" in exp:
        assert r["missing_rule_types"] == exp["missing_rule_types"]
    assert r["retrieval_trace"]["ranker_used_for_selection"] is False


def test_no_superseded_or_draft_leakage(fx):
    for exp in golden("rule_applicability.json")["results"]:
        r = _run(fx, exp["query"])
        leaked = {a["rule_id"] for a in r["applicable"]} & {"TR-0002", "TR-0004"}
        assert not leaked


@pytest.mark.parametrize("mutate,msg", [
    (lambda d: d["rules"].append(copy.deepcopy(d["rules"][0])), "duplicate rule id"),
    (lambda d: d["rules"][2].update(supersedes=["TR-9999"]), "supersedes unknown"),
    (lambda d: d["rules"][1].update(effective_to="2000-01-01"), "effective_to before"),
    (lambda d: d["rules"][0].update(status="maybe"), "status"),
])
def test_store_rejects(mutate, msg):
    doc = load_fx()["trade_rules"]
    mutate(doc)
    with pytest.raises(RuleStoreError, match=msg):
        validate_rules(doc)


def test_ranking_never_changes_selection(fx):
    rules = validate_rules(fx["trade_rules"])
    for exp in golden("rule_applicability.json")["results"]:
        r = _run(fx, exp["query"])
        before = json.dumps(r, sort_keys=True)
        hits = rank_passages(exp["query"], r, rules, k=10)
        assert json.dumps(r, sort_keys=True) == before
        status = {h["rule_id"]: h["status"] for h in hits}
        assert {a["rule_id"] for a in r["applicable"]} == {k for k, v in status.items() if v == "applicable"}
        assert {a["rule_id"] for a in r["applicable"]} <= {h["rule_id"] for h in rank_passages(exp["query"], r, rules)}
        # reversing the corpus order must not change ranking or selection
        assert rank_passages(exp["query"], r, list(reversed(rules)), k=10) == hits


def test_conflict_rules_shown():
    case = next(c for c in CASES if c["case_id"] == "VC-RULE-03")
    fx = apply_patches(load_fx(), case["patches"])
    rules = validate_rules(fx["trade_rules"])
    r = _run(fx, case["input"]["query"])
    shown = {h["rule_id"]: h["status"] for h in rank_passages(case["input"]["query"], r, rules)}
    assert {rid for c in r["conflicts"] for rid in c["rule_ids"]} <= {k for k, v in shown.items() if v == "conflict"}
