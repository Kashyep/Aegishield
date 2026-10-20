#!/usr/bin/env python3
"""AegisShield contract checker.

Run from the repository root:
    python3 tools/check_contracts.py                 # verify everything (CI and pre-merge)
    python3 tools/check_contracts.py --write-golden  # regenerate fixtures/expected/*.json (owner: Member 3, review: Member 5)

Checks, in order:
  1. Every fixture, golden file and validation-case file validates against contracts/schemas.
  2. Referential integrity across fixtures (ids, source refs, parts, nodes, ports).
  3. Golden outputs in fixtures/expected/ equal what the reference oracle computes (volatile fields ignored).
  4. Hand-calculated demo figures (documented in docs/00-source-of-truth.md) equal the oracle's figures.
  5. Every oracle=true validation case in fixtures/validation/cases.json produces its expected values.
  6. contracts/openapi.yaml is a valid OpenAPI 3.1 document and every inline example validates against its schema.

Exit status 0 only when every check passes. Requires: jsonschema>=4.18, pyyaml, openapi-spec-validator.
"""
from __future__ import annotations

import argparse
import copy
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import aegis_oracle as O  # noqa: E402

FIXTURES = ROOT / "fixtures" / "demo"
EXPECTED = ROOT / "fixtures" / "expected"
SCHEMAS = ROOT / "contracts" / "schemas"
OPENAPI = ROOT / "contracts" / "openapi.yaml"
VOLATILE = {"created_at", "updated_at", "started_at", "finished_at", "completed_at", "decided_at",
            "occurred_at", "duration_ms", "generated_at", "reset_at", "prev_hash", "event_hash"}

# Hand calculations (see docs/00-source-of-truth.md section 8.4). These are typed in independently of the oracle.
HAND = {
    "baseline_loss_inr": 400 * 250 * 6 + 300 * 300 * 4 + 200 * 500 * 2,            # 1,160,000
    "P1": {"recovery_cost_inr": 150 * 0 + 150 * 40 + 400 * (300 + 160) + 200 * (600 + 120),  # 334,000
           "residual_loss_inr": 0,
           "worst_case_exposure_inr": 100 * 250 * 6 + 300 * 300 * 4},              # 510,000
    "P2": {"recovery_cost_inr": 150 * 0 + 150 * 40 + 600 * (600 + 210),              # 492,000
           "residual_loss_inr": 100 * 250 * 2,                                       # 50,000
           "worst_case_exposure_inr": 0},
    "duty_at_risk_P1_inr": (400 * (6300 + 160) * 1500) // 10000,                     # 387,600
}
HAND["P1"]["net_avoided_loss_inr"] = HAND["baseline_loss_inr"] - HAND["P1"]["recovery_cost_inr"] - HAND["P1"]["residual_loss_inr"]
HAND["P2"]["net_avoided_loss_inr"] = HAND["baseline_loss_inr"] - HAND["P2"]["recovery_cost_inr"] - HAND["P2"]["residual_loss_inr"]

FIXTURE_SCHEMA = {
    "scenario": "fixtures.schema.json#/$defs/ScenarioFile",
    "master_data": "fixtures.schema.json#/$defs/MasterDataFile",
    "orders": "fixtures.schema.json#/$defs/OrdersFile",
    "disruptions": "fixtures.schema.json#/$defs/DisruptionsFile",
    "supply_graph": "graph.schema.json#/$defs/SupplyGraph",
    "supplier_quotes": "fixtures.schema.json#/$defs/SupplierQuotesFile",
    "route_options": "fixtures.schema.json#/$defs/RouteOptionsFile",
    "inventory": "fixtures.schema.json#/$defs/InventoryFile",
    "letters_of_credit": "fixtures.schema.json#/$defs/LettersOfCreditFile",
    "trade_rules": "trade-rules.schema.json#/$defs/TradeRulesFile",
    "policies": "fixtures.schema.json#/$defs/PoliciesFile",
    "sources": "fixtures.schema.json#/$defs/SourcesFile",
}
EXPECTED_SCHEMA = {
    "disruption_assessment": "disruption.schema.json#/$defs/DisruptionAssessment",
    "dependency_results": "graph.schema.json#/$defs/DependencyResultsFile",
    "graph_view_SUP-B": "graph.schema.json#/$defs/GraphView",
    "rule_applicability": "trade-rules.schema.json#/$defs/RuleApplicabilityResultsFile",
    "evaluation_EVAL-0001": "plan.schema.json#/$defs/Evaluation",
    "approval_flow": "decision.schema.json#/$defs/ApprovalFlowScript",
}

failures: list[str] = []


def fail(msg: str):
    failures.append(msg)
    print(f"  FAIL {msg}")


def ok(msg: str):
    print(f"  ok   {msg}")


# --------------------------------------------------------------------------- schema registry
def registry():
    """Schemas reference each other by relative file name, so each resource is registered under its file URI."""
    from referencing import Registry, Resource
    from referencing.jsonschema import DRAFT202012
    resources = []
    for p in sorted(SCHEMAS.glob("*.schema.json")):
        resources.append((p.resolve().as_uri(), Resource.from_contents(json.loads(p.read_text()), default_specification=DRAFT202012)))
    return Registry().with_resources(resources)


def validator_for(ref: str, reg):
    from jsonschema import Draft202012Validator
    file, frag = ref.split("#")
    uri = (SCHEMAS / file).resolve().as_uri()
    return Draft202012Validator({"$ref": f"{uri}#{frag}"}, registry=reg, format_checker=Draft202012Validator.FORMAT_CHECKER)


def validate(instance, ref, reg, label):
    errors = sorted(validator_for(ref, reg).iter_errors(instance), key=lambda e: list(e.absolute_path))
    if errors:
        for e in errors[:5]:
            fail(f"{label}: schema {ref}: {'/'.join(map(str, e.absolute_path))}: {e.message[:200]}")
        return False
    return True


# --------------------------------------------------------------------------- golden builders
def build_goldens(fx: dict) -> dict:
    r = O.evaluate(fx)
    deps = [r["dependency"][k] for k in sorted(r["dependency"])]
    plans = r["plans"]
    by_status = {p["plan_id"]: p for p in plans}
    executable = [p for p in plans if p["outcome"] != "blocked"]
    rank = {"passed": 0, "needs_review": 1}
    recommended = sorted(executable, key=lambda p: (rank[p["outcome"]], -p["financials"]["net_avoided_loss_inr"], p["financials"]["worst_case_exposure_inr"]))
    blocked_best = max((p["financials"]["net_avoided_loss_inr"] for p in plans if p["outcome"] == "blocked"), default=None)
    rec = recommended[0] if recommended else None
    comparison = {
        "baseline_loss_inr": r["assessment"]["baseline_loss_inr"],
        "plans": [{
            "plan_id": p["plan_id"], "label": p["label"], "outcome": p["outcome"], "executable": p["outcome"] != "blocked",
            "recovery_cost_inr": p["financials"]["recovery_cost_inr"], "residual_loss_inr": p["financials"]["residual_loss_inr"],
            "net_avoided_loss_inr": p["financials"]["net_avoided_loss_inr"], "worst_case_exposure_inr": p["financials"]["worst_case_exposure_inr"],
            "check_outcome_counts": p["check_outcome_counts"],
        } for p in plans],
        "recommended_plan_id": rec["plan_id"] if rec else None,
        "recommendation_rule": "Exclude blocked plans; prefer outcome passed over needs_review; then highest net_avoided_loss_inr; then lowest worst_case_exposure_inr.",
        "paper_advantage_of_best_blocked_plan_inr": (blocked_best - rec["financials"]["net_avoided_loss_inr"]) if (rec and blocked_best is not None) else None,
    }
    findings = [r["findings"][k] for k in sorted(r["findings"])]
    evidence = [r["evidence"][k] for k in sorted(r["evidence"])]
    explanations = []
    for p in plans:
        bad = [f for f in p["finding_ids"] if r["findings"][f]["outcome"] in ("blocked", "needs_review")]
        text = (f"{p['plan_id']} outcome {p['outcome']}. " +
                ("; ".join(f"{f} is {r['findings'][f]['outcome']}" for f in bad) + "." if bad else "All checks passed.") +
                f" Net avoided loss INR {p['financials']['net_avoided_loss_inr']}.")
        explanations.append({"explanation_id": f"XPL-{p['plan_id']}", "subject_id": p["plan_id"], "mode": "template",
                             "prompt_id": None, "model": None, "text": text, "cited_ids": bad or [f for f in p["finding_ids"]][:3],
                             "validation": {"passed": True, "errors": []}, "generated_at": "2026-10-26T09:00:04+05:30"})
    steps = []
    names = ["disruption_sensing", "supplier_dependency", "routing", "inventory_rebalancing", "trade_compliance", "plan_assembly", "explanation"]
    owners = ["member_4", "member_4", "member_4", "member_3", "member_3", "member_3", "member_5"]
    for i, (n, o) in enumerate(zip(names, owners), start=1):
        steps.append({"seq": i, "step": n, "owner": o, "status": "succeeded", "attempts": 1, "timeout_ms": 10000 if n in ("disruption_sensing", "explanation") else 5000,
                      "started_at": f"2026-10-26T09:00:0{i - 1}+05:30", "finished_at": f"2026-10-26T09:00:0{i}+05:30",
                      "duration_ms": 120, "mode": "template" if n == "explanation" else ("gold" if n == "disruption_sensing" else "deterministic"), "error": None})
    evaluation = {
        "schema_version": "1.0.0",
        "evaluation_id": "EVAL-0001",
        "disruption_id": r["assessment"]["disruption_id"],
        "status": "completed",
        "data_mode": "synthetic",
        "llm_mode": "off",
        "input_snapshot_id": O.input_snapshot_id(fx),
        "created_at": "2026-10-26T09:00:00+05:30",
        "completed_at": "2026-10-26T09:00:07+05:30",
        "steps": steps,
        "assessment": r["assessment"],
        "dependency_results": deps,
        "rule_results": [r["rule_results"][k] for k in sorted(r["rule_results"])],
        "options": r["options"],
        "findings": findings,
        "evidence": evidence,
        "plans": plans,
        "comparison": comparison,
        "explanations": explanations,
        "error": None,
    }
    return {
        "disruption_assessment": r["assessment"],
        "dependency_results": {"schema_version": "1.0.0", "results": deps,
                               "linearized_contexts": [O.linearized_context(fx, d) for d in deps]},
        "graph_view_SUP-B": O.graph_view(fx, deps, "SUP-B"),
        "rule_applicability": {"schema_version": "1.0.0", "results": [r["rule_results"][k] for k in sorted(r["rule_results"])]},
        "evaluation_EVAL-0001": evaluation,
    }


def strip_volatile(obj):
    if isinstance(obj, dict):
        return {k: strip_volatile(v) for k, v in obj.items() if k not in VOLATILE}
    if isinstance(obj, list):
        return [strip_volatile(v) for v in obj]
    return obj


def first_diff(a, b, path="$"):
    if type(a) != type(b):
        return f"{path}: type {type(a).__name__} != {type(b).__name__}"
    if isinstance(a, dict):
        for k in sorted(set(a) | set(b)):
            if k not in a or k not in b:
                return f"{path}.{k}: missing on one side"
            d = first_diff(a[k], b[k], f"{path}.{k}")
            if d:
                return d
        return None
    if isinstance(a, list):
        if len(a) != len(b):
            return f"{path}: length {len(a)} != {len(b)}"
        for i, (x, y) in enumerate(zip(a, b)):
            d = first_diff(x, y, f"{path}[{i}]")
            if d:
                return d
        return None
    return None if a == b else f"{path}: {a!r} != {b!r}"


# --------------------------------------------------------------------------- referential integrity
def check_integrity(fx: dict):
    md = fx["master_data"]
    locs = {l["location_id"] for l in md["locations"]}
    parts = {p["part_id"] for p in md["parts"]}
    suppliers = {s["supplier_id"] for s in md["suppliers"]}
    nodes = {n["node_id"] for n in fx["supply_graph"]["nodes"]}
    sources = {s["source_id"] for s in fx["sources"]["sources"]} | {s["source_id"] for s in fx["supply_graph"]["sources"]}
    sources |= {r["source"]["source_id"] for r in fx["trade_rules"]["rules"]}
    probs = []
    for p in md["parts"]:
        probs += [f"part {p['part_id']} bom child {c['child_part_id']}" for c in p["bom"] if c["child_part_id"] not in parts]
    for s in md["suppliers"]:
        if s["supplying_facility_id"] not in nodes:
            probs.append(f"supplier {s['supplier_id']} facility")
        if s["origin_port_id"] not in locs:
            probs.append(f"supplier {s['supplier_id']} port")
    for e in fx["supply_graph"]["edges"]:
        if e["source"] not in nodes or e["target"] not in nodes:
            probs.append(f"edge {e['edge_id']} endpoint")
        if e["part_id"] not in parts:
            probs.append(f"edge {e['edge_id']} part")
        if e["source_ref"] not in sources:
            probs.append(f"edge {e['edge_id']} source_ref")
    for q in fx["supplier_quotes"]["quotes"]:
        if q["supplier_id"] not in suppliers or q["part_id"] not in parts or q["origin_port_id"] not in locs or q["source_ref"] not in sources:
            probs.append(f"quote {q['quote_id']}")
    for r in fx["route_options"]["route_options"]:
        ports = [r["origin_port_id"], r["destination_port_id"], *r["transshipment_port_ids"]] + [x for leg in r["legs"] for x in (leg["from_port_id"], leg["to_port_id"])]
        if any(p not in locs for p in ports) or r["source_ref"] not in sources:
            probs.append(f"route {r['route_option_id']}")
        if O.add_days(r["eta_port"], fx["route_options"]["port_to_plant_days"]) != r["eta_plant"]:
            probs.append(f"route {r['route_option_id']} eta_plant != eta_port + port_to_plant_days")
        if r["legs"][0]["etd"] != r["etd"] or r["legs"][-1]["eta"] != r["eta_port"]:
            probs.append(f"route {r['route_option_id']} legs disagree with etd/eta_port")
        if [leg["to_port_id"] for leg in r["legs"][:-1]] != r["transshipment_port_ids"]:
            probs.append(f"route {r['route_option_id']} transshipment ports disagree with legs")
    for sh in fx["orders"]["shipments"]:
        if O.add_days(sh["planned_eta_port"], fx["route_options"]["port_to_plant_days"]) != sh["planned_eta_plant"]:
            probs.append(f"shipment {sh['shipment_id']} eta_plant")
    for po in fx["orders"]["purchase_orders"]:
        if sum(p["qty"] for p in po["pegging"]) != po["qty"]:
            probs.append(f"po {po['po_id']} pegging total")
    for lc in fx["letters_of_credit"]["letters_of_credit"]:
        if lc["available_balance_source_ref"] not in sources:
            probs.append(f"lc {lc['lc_id']} balance source")
    for ev in fx["disruptions"]["events"]:
        if ev["source"]["source_id"] not in sources:
            probs.append(f"event {ev['disruption_id']} source")
    for p in probs:
        fail(f"integrity: {p}")
    if not probs:
        ok("referential integrity across fixtures")


def declared_sources(fx: dict) -> set:
    return ({s["source_id"] for s in fx["sources"]["sources"]} | {s["source_id"] for s in fx["supply_graph"]["sources"]}
            | {r["source"]["source_id"] for r in fx["trade_rules"]["rules"]})


def check_evidence_links(evaluation: dict, fx: dict):
    ev_ids = {e["evidence_id"] for e in evaluation["evidence"]}
    f_ids = {f["finding_id"] for f in evaluation["findings"]}
    srcs = declared_sources(fx)
    bad = [f"{e['evidence_id']} cites undeclared source {s}" for e in evaluation["evidence"] for s in e["source_ids"] if s not in srcs]
    for f in evaluation["findings"]:
        if not f["evidence_ids"]:
            bad.append(f"{f['finding_id']} has no evidence")
        bad += [f"{f['finding_id']} -> missing {e}" for e in f["evidence_ids"] if e not in ev_ids]
    for p in evaluation["plans"]:
        bad += [f"{p['plan_id']} -> missing finding {f}" for f in p["finding_ids"] if f not in f_ids]
    for b in bad:
        fail(f"evidence link: {b}")
    if not bad:
        ok(f"every finding has >=1 resolvable evidence item ({len(f_ids)} findings, {len(ev_ids)} evidence items)")


# --------------------------------------------------------------------------- validation cases
def run_case(case: dict, base_fx: dict):
    fx = O.apply_patches(base_fx, case["patches"])
    inp, exp = case["input"], case["expected"]
    kind = inp["kind"]
    got = {}
    if kind == "dependency":
        assess = O.assess_disruption(fx, "DIS-2026-0042")
        dep = O.dependency_check(fx, inp["supplier_id"], inp["part_id"], assess["disrupted_node_ids"], inp.get("max_depth"))
        got["outcome"], got["reason_code"] = dep["outcome"], dep["reason_code"]
        dp = [p for p in dep["paths"] if p["kind"] == "shared_disrupted_dependency"]
        got["disrupted_path_node_ids"] = dp[0]["node_ids"] if dp else []
        got["disrupted_path_edge_ids"] = dp[0]["edge_ids"] if dp else []
        got["shared_with_primary_node_ids"] = dep["shared_with_primary_node_ids"]
        got["note_codes"] = [n["code"] for n in dep["notes"]]
        got["gap_parts"] = sorted({g["part_id"] for g in dep["coverage"]["gaps"]})
        got["cycle_detected"], got["truncated"] = dep["cycle_detected"], dep["truncated"]
    elif kind == "rules":
        rr = O.rule_applicability(fx, inp["query"])
        got["outcome"] = rr["outcome"]
        got["applicable_rule_ids"] = [a["rule_id"] for a in rr["applicable"]]
        got["excluded"] = {x["rule_id"]: x["reason"] for x in rr["excluded"]}
        got["conflict_resolutions"] = [c["resolution"] for c in rr["conflicts"]]
        got["missing_rule_types"] = rr["missing_rule_types"]
    elif kind == "lc":
        lc = {x["lc_id"]: x for x in fx["letters_of_credit"]["letters_of_credit"]}[inp["lc_id"]]
        route = {x["route_option_id"]: x for x in fx["route_options"]["route_options"]}[inp["route_option_id"]]
        fs, _ = O.lc_route_findings(lc, route, {x["location_id"]: x for x in fx["master_data"]["locations"]})
        got["check_outcomes"] = {f["check_code"]: f["outcome"] for f in fs}
    elif kind == "fta":
        q = {x["quote_id"]: x for x in fx["supplier_quotes"]["quotes"]}[inp["quote_id"]]
        route = {x["route_option_id"]: x for x in fx["route_options"]["route_options"]}[inp["route_option_id"]]
        rq = O.rule_applicability(fx, O.rule_query_for(fx, q, route))
        fs, _ = O.fta_findings(fx, q, route, rq)
        got["check_outcomes"] = {f["check_code"]: f["outcome"] for f in fs}
        if "qty" in inp:
            got["duty_at_risk_inr"], _ = O.duty_at_risk(q, route, inp["qty"], rq)
    elif kind == "inventory_allocation":
        assess = O.assess_disruption(fx, "DIS-2026-0042")
        options, *_ = O.source_options(fx, assess)
        fs = O.plan_level_findings(fx, "PLN-TEST", inp["lines"], {o["option_id"]: o for o in options})
        got["check_outcomes"] = {f["check_code"]: f["outcome"] for f in fs}
    elif kind == "inventory_atp":
        assess = O.assess_disruption(fx, "DIS-2026-0042")
        options, *_ = O.source_options(fx, assess)
        got["atp"] = {o["inventory_source_id"]: o["capacity_units"] for o in options if o["kind"] == "inventory"}
    elif kind == "evaluation":
        r = O.evaluate(fx, extra_costs_verified=inp.get("extra_costs_verified"))
        got["assessment_outcome"] = r["assessment"]["outcome"]
        got["assessment_issues"] = r["assessment"]["issues"]
        got["baseline_loss_inr"] = r["assessment"]["baseline_loss_inr"]
        got["dependency_outcomes"] = {k: v["outcome"] for k, v in r["dependency"].items()}
        got["plan_outcomes"] = {p["plan_id"]: p["outcome"] for p in r["plans"]}
        got["plan_financials"] = {p["plan_id"]: p["financials"] for p in r["plans"]}
        got["exposure_amounts"] = {p["plan_id"]: {e["exposure_id"]: e["amount_inr"] for e in p["financials"]["exposures"]} for p in r["plans"]}
        qty = {}
        for p in r["plans"]:
            qty[p["plan_id"]] = {}
            for line in p["lines"]:
                qty[p["plan_id"]][line["option_id"]] = qty[p["plan_id"]].get(line["option_id"], 0) + line["qty"]
        got["plan_option_qty"] = qty
    elif kind in ("approval", "approval_review_plan"):
        r = O.evaluate(fx)
        plans = r["plans"]
        if kind == "approval_review_plan":
            assess = r["assessment"]
            opt = {o["option_id"]: o for o in r["options"]}[inp["review_option_id"]]
            lines = [{"line_id": "L01", "order_id": "SO-1002", "option_id": opt["option_id"], "qty": 300, "need_by": "2026-11-05", "eta_plant": opt["eta_plant"],
                      "days_late": O.days_late(opt["eta_plant"], "2026-11-05")}]
            fids = [f"FND-SENSE-{assess['disruption_id']}"] + opt["finding_ids"]
            outcome = O.worst(r["findings"][f]["outcome"] for f in fids)
            review_plan = {"plan_id": "PLN-REVIEW", "version": 1, "plan_hash": "sha256:review", "finding_ids": fids, "outcome": outcome,
                           "status": {"passed": "pending_approval", "needs_review": "needs_review", "blocked": "blocked"}[outcome], "amendment_request_ids": [], "lines": lines}
            plans = plans + [review_plan]
        model = O.ApprovalModel(fx, plans, r["findings"])
        responses = []
        for s in inp["steps"]:
            if s["op"] == "decide":
                plan = model.plans[s["plan_id"]]
                acks = list(s.get("acknowledgements", []))
                if s.get("acknowledge_all_by"):
                    acks = [{"finding_id": f, "actor_id": s["acknowledge_all_by"]} for f in plan["finding_ids"] if r["findings"][f]["outcome"] == "needs_review"]
                h = "sha256:stale" if s.get("stale_hash") else plan["plan_hash"]
                responses.append(list(model.decide(s["plan_id"], s["action"], plan["version"], h, s["actor_id"], s["key"], acks)))
            elif s["op"] == "execute":
                responses.append(list(model.execute(s["plan_id"], s["key"])))
            elif s["op"] == "supersede":
                model.supersede(s["plan_id"])
                responses.append([None, None])
        got["responses"] = responses
        got["final_status"] = {k: v["status"] for k, v in model.plans.items()}
    else:
        raise ValueError(kind)
    return got


def subset_match(expected, got, path=""):
    """Every expected key must match; dict expectations match as subsets."""
    problems = []
    for k, v in expected.items():
        if k.startswith("not_expected"):
            continue
        if k not in got:
            problems.append(f"{path}{k}: not produced")
            continue
        if isinstance(v, dict) and isinstance(got[k], dict):
            problems += subset_match(v, got[k], f"{path}{k}.")
        elif got[k] != v:
            problems.append(f"{path}{k}: expected {v!r}, got {got[k]!r}")
    return problems


# --------------------------------------------------------------------------- OpenAPI
def check_openapi(reg):
    import yaml
    from openapi_spec_validator import validate as oas_validate
    from openapi_spec_validator.readers import read_from_filename
    spec_dict, base_uri = read_from_filename(str(OPENAPI))
    try:
        oas_validate(spec_dict, base_uri=base_uri)
        ok("openapi.yaml is a valid OpenAPI 3.1 document (external $refs resolved)")
    except Exception as e:  # noqa: BLE001
        fail(f"openapi.yaml invalid: {str(e)[:400]}")
        return
    spec = yaml.safe_load(OPENAPI.read_text())
    count = 0

    def resolve_schema(schema):
        if "$ref" in schema and schema["$ref"].startswith("./schemas/"):
            return schema["$ref"][len("./schemas/"):]
        if "$ref" in schema and schema["$ref"].startswith("#/components/schemas/"):
            name = schema["$ref"].split("/")[-1]
            return resolve_schema(spec["components"]["schemas"][name])
        return None

    for path, item in spec["paths"].items():
        for method, op in item.items():
            if method not in ("get", "post", "put", "patch", "delete"):
                continue
            bodies = []
            if "requestBody" in op:
                bodies.append(("request", op["requestBody"]["content"].get("application/json", {})))
            for code, resp in op.get("responses", {}).items():
                if "$ref" in resp:
                    resp = spec["components"]["responses"][resp["$ref"].split("/")[-1]]
                for ctype, media in resp.get("content", {}).items():
                    bodies.append((f"{code} {ctype}", media))
            for label, media in bodies:
                ref = resolve_schema(media.get("schema", {}))
                for ex_name, ex in (media.get("examples") or {}).items():
                    value = ex.get("value")
                    if "externalValue" in ex:
                        value = json.loads((OPENAPI.parent / ex["externalValue"]).read_text())
                    if ref and value is not None:
                        count += 1
                        validate(value, ref, reg, f"openapi {method.upper()} {path} {label} example {ex_name}")
    ok(f"openapi examples validated against their schemas ({count} examples)")


# --------------------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write-golden", action="store_true")
    args = ap.parse_args()
    fx = O.load_fixtures(FIXTURES)

    print("1. Hand-calculated figures vs oracle")
    goldens = build_goldens(fx)
    ev = goldens["evaluation_EVAL-0001"]
    plans = {p["plan_id"]: p for p in ev["plans"]}
    checks = [("baseline_loss_inr", ev["assessment"]["baseline_loss_inr"], HAND["baseline_loss_inr"])]
    for pid, key in (("PLN-0001", "P1"), ("PLN-0002", "P2")):
        for k in ("recovery_cost_inr", "residual_loss_inr", "net_avoided_loss_inr", "worst_case_exposure_inr"):
            checks.append((f"{key}.{k}", plans[pid]["financials"][k], HAND[key][k]))
    duty = sum(e["amount_inr"] for e in plans["PLN-0001"]["financials"]["exposures"] if e["kind"] == "duty_if_preference_denied")
    checks.append(("duty_at_risk_P1_inr", duty, HAND["duty_at_risk_P1_inr"]))
    for name, got, want in checks:
        (ok if got == want else fail)(f"{name}: oracle {got} vs hand {want}")

    if args.write_golden:
        for name, data in goldens.items():
            (EXPECTED / f"{name}.json").write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
        print(f"wrote {len(goldens)} golden files to {EXPECTED}")

    print("2. Referential integrity")
    check_integrity(fx)
    check_evidence_links(ev, fx)

    print("3. Golden files equal oracle output (volatile fields ignored)")
    for name, data in goldens.items():
        path = EXPECTED / f"{name}.json"
        if not path.exists():
            fail(f"missing golden {path.name}")
            continue
        diff = first_diff(strip_volatile(json.loads(path.read_text())), strip_volatile(json.loads(json.dumps(data))))
        (fail if diff else ok)(f"{path.name}" + (f": {diff}" if diff else " matches"))

    print("4. Schema validation")
    reg = registry()
    for name, ref in FIXTURE_SCHEMA.items():
        if validate(fx[name], ref, reg, f"fixture {name}"):
            ok(f"fixtures/demo/{name}.json")
    for name, ref in EXPECTED_SCHEMA.items():
        path = EXPECTED / f"{name}.json"
        if path.exists() and validate(json.loads(path.read_text()), ref, reg, f"golden {name}"):
            ok(f"fixtures/expected/{name}.json")
    cases_doc = json.loads((ROOT / "fixtures" / "validation" / "cases.json").read_text())
    if validate(cases_doc, "fixtures.schema.json#/$defs/ValidationCasesFile", reg, "validation cases"):
        ok("fixtures/validation/cases.json")

    print("5. Validation cases")
    passed = 0
    for case in cases_doc["cases"]:
        if not case["oracle"]:
            continue
        try:
            got = run_case(case, fx)
            probs = subset_match(case["expected"], got)
        except Exception as e:  # noqa: BLE001
            probs = [f"exception {type(e).__name__}: {e}"]
        if probs:
            fail(f"{case['case_id']}: " + "; ".join(probs))
        else:
            passed += 1
    total = sum(1 for c in cases_doc["cases"] if c["oracle"])
    (ok if passed == total else fail)(f"{passed}/{total} oracle validation cases pass ({len(cases_doc['cases']) - total} manual cases not executable here)")

    print("6. OpenAPI")
    if OPENAPI.exists():
        check_openapi(reg)
    else:
        fail("contracts/openapi.yaml missing")

    print()
    if failures:
        print(f"RESULT: FAILED ({len(failures)} problems)")
        sys.exit(1)
    print("RESULT: PASSED")


if __name__ == "__main__":
    main()
