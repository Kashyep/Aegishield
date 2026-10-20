import json

import pytest

from app.agents.dependency.check import check_dependency
from app.agents.dependency.graph import build_graph
from app.agents.dependency.linearize import linearize
from app.agents.dependency.view import build_graph_view
from app.agents.sensing import assess_disruption
from conftest import ROOT, apply_patches, golden, load_fx

CASES = json.loads((ROOT / "fixtures/validation/cases.json").read_text(encoding="utf-8"))["cases"]


def run(fx, supplier, part="PRT-PM750", max_depth=None, disrupted=None):
    g = build_graph(fx["supply_graph"], fx["master_data"])
    if disrupted is None:
        ev = fx["disruptions"]["events"][0]
        disrupted = assess_disruption(ev, fx)["disrupted_node_ids"]
    pol = fx["policies"]["dependency_policy"]
    q = {"supplier_id": supplier, "part_id": part, "disrupted_node_ids": disrupted,
         "max_depth": max_depth or pol["max_depth"]}
    return g, check_dependency(q, g, fx["master_data"]["parts"], pol)


def test_golden_results_and_contexts(fx):
    gold = golden("dependency_results.json")
    got = {}
    for exp in gold["results"]:
        g, r = run(fx, exp["supplier_id"])
        assert r == exp
        got[exp["supplier_id"]] = linearize(r, g)
    for exp in gold["linearized_contexts"]:
        assert got[exp["subject_id"]] == exp


def test_graph_view_golden(fx):
    g = build_graph(fx["supply_graph"], fx["master_data"])
    results = [run(fx, s)[1] for s in ("SUP-B", "SUP-C")]
    assert build_graph_view(results, g, "SUP-B", "EVAL-0001") == golden("graph_view_SUP-B.json")
    v = build_graph_view(results, g, "SUP-C", "EVAL-0001")
    assert not any(e["highlighted"] for e in v["edges"])
    assert v["paths"] and {n["id"]: n["status"] for n in v["nodes"]}["FAC-C-BDG"] == "candidate_passed"


def test_deterministic(fx):
    assert json.dumps(run(fx, "SUP-B")[1]) == json.dumps(run(fx, "SUP-B")[1])


@pytest.mark.parametrize("case", [c for c in CASES if c["case_id"].startswith("VC-DEP")], ids=lambda c: c["case_id"])
def test_vc_dep(case):
    fx = apply_patches(load_fx(), case["patches"])
    i, exp = case["input"], case["expected"]
    _, r = run(fx, i["supplier_id"], i["part_id"], i.get("max_depth"))
    for k in ("outcome", "reason_code", "cycle_detected", "truncated", "shared_with_primary_node_ids"):
        if k in exp:
            assert r[k] == exp[k], k
    if "note_codes" in exp:
        assert sorted({n["code"] for n in r["notes"]}) == sorted(set(exp["note_codes"]))
    if "disrupted_path_node_ids" in exp:
        p = next(p for p in r["paths"] if p["kind"] == "shared_disrupted_dependency")
        assert p["node_ids"] == exp["disrupted_path_node_ids"]
        assert p["edge_ids"] == exp["disrupted_path_edge_ids"]
    assert all(e["evidence_id"] == f"EVD-{p['path_id']}" for e, p in zip(r["evidence"], r["paths"]))


def test_never_false_pass_on_gap(fx):
    """Missing data must never pass (VC-DEP-03 shape): candidate with no upstream data."""
    case = next(c for c in CASES if c["case_id"] == "VC-DEP-03")
    fx = apply_patches(load_fx(), case["patches"])
    _, r = run(fx, case["input"]["supplier_id"])
    assert r["outcome"] != "passed" and not r["coverage"]["complete"]


def test_vc_sense_01():
    case = next(c for c in CASES if c["case_id"] == "VC-SENSE-01")
    fx = apply_patches(load_fx(), case["patches"])
    a = assess_disruption(fx["disruptions"]["events"][0], fx)
    assert a["outcome"] == "needs_review" and a["issues"] == case["expected"]["assessment_issues"]
    assert a["disrupted_node_ids"] == []
    for s, out in case["expected"]["dependency_outcomes"].items():
        assert run(fx, s)[1]["outcome"] == out
        assert run(fx, s)[1]["reason_code"] == "DISRUPTED_NODE_UNKNOWN"
