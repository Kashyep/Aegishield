"""Deterministic evaluation services for the AegisShield synthetic demo.

Pure functions operate only on validated fixture data; HTTP and persistence stay in the API layer.
"""
from __future__ import annotations
import datetime as dt
import json
from typing import Any
from .fixtures import canonical_json, digest as sha256_of, snapshot_id as input_snapshot_id
from .rules import query_rule_applicability as rule_applicability
from ..agents.dependency.check import check_dependency
from ..agents.dependency.graph import SupplyGraph, build_graph
from ..agents.dependency.linearize import linearize
from ..agents.dependency.view import build_graph_view
from ..agents.routing import eligible_routes
from ..agents.sensing import assess_disruption as _assess_disruption

OUTCOME_RANK = {"not_applicable": -1, "passed": 0, "needs_review": 1, "blocked": 2}

def d(value: str) -> dt.date:
    return dt.date.fromisoformat(value)

def add_days(value: str, days: int) -> str:
    return (d(value) + dt.timedelta(days=days)).isoformat()

def days_late(arrival: str, need_by: str) -> int:
    return max(0, (d(arrival) - d(need_by)).days)

def div_half_up(numerator: int, denominator: int) -> int:
    """Integer division rounded half up (inputs are non-negative)."""
    return (2 * numerator + denominator) // (2 * denominator)

def worst(outcomes) -> str:
    considered = [o for o in outcomes if o != "not_applicable"]
    if not considered:
        return "passed"
    return max(considered, key=lambda o: OUTCOME_RANK[o])

def as_of_date(fx: dict) -> str:
    return fx["scenario"]["as_of"][:10]

def index(items, key):
    return {item[key]: item for item in items}

def penalty(order: dict, qty: int, arrival: str) -> int:
    late = days_late(arrival, order["component_need_by"])
    p = order["penalty"]
    return qty * p["rate_inr_per_unit_per_day"] * min(late, p["cap_days"])

# --- MOD-04/05/06 (Member 4) -------------------------------------------------------------
# Thin adapters keep this module's fixture-dict call signatures; the logic lives in app/agents.
def _graph(fx: dict) -> SupplyGraph:
    return build_graph(fx["supply_graph"], fx["master_data"])


def assess_disruption(fx: dict, disruption_id: str) -> dict:
    event = index(fx["disruptions"]["events"], "disruption_id")[disruption_id]
    return _assess_disruption(event, fx, "gold")


def dependency_check(fx: dict, supplier_id: str, part_id: str, disrupted_ids: list, max_depth=None) -> dict:
    pol = fx["policies"]["dependency_policy"]
    query = {"supplier_id": supplier_id, "part_id": part_id, "disrupted_node_ids": list(disrupted_ids),
             "max_depth": max_depth or pol["max_depth"]}
    return check_dependency(query, _graph(fx), fx["master_data"]["parts"], pol)


def linearized_context(fx: dict, dep: dict) -> dict:
    return linearize(dep, _graph(fx))


def graph_view(fx: dict, deps: list, focus_supplier_id: str, evaluation_id: str = "EVAL-0001") -> dict:
    return build_graph_view(deps, _graph(fx), focus_supplier_id, evaluation_id)


def rule_query_for(fx: dict, quote: dict, route: dict) -> dict:
    suppliers = index(fx["master_data"]["suppliers"], "supplier_id")
    parts = index(fx["master_data"]["parts"], "part_id")
    locs = index(fx["master_data"]["locations"], "location_id")
    return {
        "query_id": f"RQ-{route['route_option_id']}",
        "jurisdiction": fx["scenario"]["import_jurisdiction"],
        "rule_types": ["tariff_mfn", "tariff_preferential", "origin_consignment"],
        "hs_code": parts[quote["part_id"]]["hs_code"],
        "origin_country": suppliers[quote["supplier_id"]]["country"],
        "transit_countries": [locs[p]["country"] for p in route["transshipment_port_ids"]],
        "agreement_id": quote["certificate_of_origin"]["agreement_id"],
        "applicable_on": route["eta_port"],
        "known_as_of": as_of_date(fx),
    }

def evd_lc_field(lc: dict, name: str) -> dict:
    f = lc["structured"][name]
    return {
        "evidence_id": f"EVD-LCF-{lc['lc_id']}-{f['tag']}",
        "kind": "lc_field",
        "source_ids": [f"SRC-{lc['lc_id']}"],
        "title": f"{lc['lc_id']} field {f['tag']}",
        "authority": "contractual",
        "synthetic": True,
        "locator": {"lc_id": lc["lc_id"], "lc_version": lc["version"], "field_tag": f["tag"]},
        "excerpt": next((line for line in lc["raw_text"].split("\n") if line.startswith(f":{f['tag']}:")), None),
    }

def evd_route(route: dict) -> dict:
    return {
        "evidence_id": f"EVD-ROUTE-{route['route_option_id']}",
        "kind": "fixture_record",
        "source_ids": [route["source_ref"]],
        "title": f"Route option {route['route_option_id']}",
        "authority": "secondary",
        "synthetic": True,
        "locator": {"record_id": route["route_option_id"]},
        "excerpt": " -> ".join([route["legs"][0]["from_port_id"]] + [leg["to_port_id"] for leg in route["legs"]]) + f"; ETD {route['etd']}; ETA port {route['eta_port']}",
    }

def finding(fid, check, agent, outcome, subject, title, evidence_ids, remedies=None, details=None):
    return {"finding_id": fid, "check_code": check, "agent": agent, "outcome": outcome, "subject": subject,
            "title": title, "evidence_ids": evidence_ids, "remedies": remedies or [], "details": details or {}}

def lc_route_findings(lc: dict, route: dict, locs: dict):
    s = lc["structured"]
    rid = route["route_option_id"]
    subj = {"type": "route_option", "id": rid}
    out, evid = [], {}
    def add_e(e):
        evid[e["evidence_id"]] = e
        return e["evidence_id"]
    re_id = add_e(evd_route(route))

    # extraction consistency
    extracted = lc.get("extracted")
    if extracted is not None:
        mismatch = sorted(k for k, v in extracted.items() if s.get(k, {}).get("value") != v)
        raw = {"evidence_id": f"EVD-LCRAW-{lc['lc_id']}", "kind": "lc_field", "source_ids": [f"SRC-{lc['lc_id']}"],
               "title": f"{lc['lc_id']} raw text", "authority": "contractual", "synthetic": True,
               "locator": {"lc_id": lc["lc_id"], "lc_version": lc["version"], "field_tag": None}, "excerpt": None}
        out.append(finding(f"FND-LC-EXTRACTION-{rid}", "LC.EXTRACTION_CONSISTENCY", "trade_compliance",
                           "needs_review" if mismatch else "passed", subj,
                           "Extracted LC fields disagree with the verified record" if mismatch else "Extracted LC fields match the verified record",
                           [add_e(raw)], details={"mismatched_fields": mismatch}))

    has_ts = len(route["transshipment_port_ids"]) > 0
    t = s["transhipment"]["value"]
    ids = [add_e(evd_lc_field(lc, "transhipment")), re_id]
    note = None
    if not has_ts:
        outcome = "passed"
    elif t in ("allowed", None):
        outcome = "passed"
    elif s["ucp_20c_excluded"]["value"]:
        outcome = "blocked"
        ids.append(add_e(evd_lc_field(lc, "ucp_20c_excluded")))
    elif route["transport_document"] == "bill_of_lading" and route["containerized"] and route["single_bill_of_lading"]:
        outcome = "passed"
        note = "UCP 600 sub-article 20(c)(ii) container exception applies because 20(c) is not excluded."
    else:
        outcome = "blocked"
    out.append(finding(f"FND-LC-TRANSHIPMENT-{rid}", "LC.TRANSHIPMENT", "trade_compliance", outcome, subj,
                       "Route transships while the credit prohibits transhipment and excludes UCP 600 20(c)" if outcome == "blocked" else "Transhipment terms satisfied",
                       ids,
                       remedies=[{"action": "request_lc_amendment", "text": "Ask the issuing bank to amend 43T to ALLOWED and delete the 47A exclusion, or choose a direct route."}] if outcome == "blocked" else [],
                       details={"transshipment_port_ids": route["transshipment_port_ids"], "note": note}))

    lsd = s["latest_shipment_date"]["value"]
    o = "passed" if route["etd"] <= lsd else "blocked"
    out.append(finding(f"FND-LC-LATEST_SHIPMENT-{rid}", "LC.LATEST_SHIPMENT_DATE", "trade_compliance", o, subj,
                       "Shipment date is within 44C" if o == "passed" else "Shipment date is after 44C latest shipment date",
                       [add_e(evd_lc_field(lc, "latest_shipment_date")), re_id],
                       remedies=[] if o == "passed" else [{"action": "request_lc_amendment", "text": "Amend 44C (and 31D if needed)."}],
                       details={"etd": route["etd"], "latest_shipment_date": lsd, "note": "Arrival date is not an LC shipment condition and is not checked here."}))

    pol = s["port_of_loading"]
    ok = (locs[route["origin_port_id"]]["country"] == pol["any_port_in_country"]) if pol.get("any_port_in_country") else (route["origin_port_id"] in pol["port_ids"])
    out.append(finding(f"FND-LC-PORT_OF_LOADING-{rid}", "LC.PORT_OF_LOADING", "trade_compliance", "passed" if ok else "blocked", subj,
                       "Port of loading matches 44E" if ok else "Port of loading does not match 44E",
                       [add_e(evd_lc_field(lc, "port_of_loading")), re_id]))

    okd = route["destination_port_id"] == s["port_of_discharge"]["port_id"]
    out.append(finding(f"FND-LC-PORT_OF_DISCHARGE-{rid}", "LC.PORT_OF_DISCHARGE", "trade_compliance", "passed" if okd else "blocked", subj,
                       "Port of discharge matches 44F" if okd else "Port of discharge does not match 44F",
                       [add_e(evd_lc_field(lc, "port_of_discharge")), re_id]))

    last_presentation = add_days(route["etd"], s["presentation_period_days"]["value"])
    okp = last_presentation <= s["expiry"]["date"]
    out.append(finding(f"FND-LC-PRESENTATION-{rid}", "LC.PRESENTATION_PERIOD", "trade_compliance", "passed" if okp else "blocked", subj,
                       "Presentation deadline falls before expiry" if okp else "Presentation deadline falls after 31D expiry",
                       [add_e(evd_lc_field(lc, "presentation_period_days")), add_e(evd_lc_field(lc, "expiry"))],
                       details={"last_presentation_date": last_presentation, "expiry_date": s["expiry"]["date"]}))
    return out, evid

def fta_findings(fx: dict, quote: dict, route: dict, rq: dict):
    agreements = index(fx["master_data"]["agreements"], "agreement_id")
    locs = index(fx["master_data"]["locations"], "location_id")
    rid = route["route_option_id"]
    subj = {"type": "route_option", "id": rid}
    parties = agreements[quote["certificate_of_origin"]["agreement_id"]]["parties"]
    evid = {}
    for a in rq["applicable"]:
        e = {"evidence_id": f"EVD-RULE-{a['rule_id']}", "kind": "rule_passage", "source_ids": [a["citation"]["source_id"]],
             "title": a["citation"]["title"], "authority": a["authority_level"], "synthetic": a["citation"]["synthetic"],
             "locator": {"rule_id": a["rule_id"], "effective_from": a["effective_from"], "effective_to": a["effective_to"]}, "excerpt": None}
        evid[e["evidence_id"]] = e
    rule_ids = {a["rule_type"]: a for a in rq["applicable"]}
    rule_ev = [f"EVD-RULE-{a['rule_id']}" for a in rq["applicable"]]
    out = []
    if rq["outcome"] != "resolved" or "origin_consignment" not in rule_ids:
        out.append(finding(f"FND-FTA-RULES-{rid}", "FTA.RULE_APPLICABILITY", "trade_compliance", "needs_review", subj,
                           "Applicable trade rules could not be resolved for this import date", rule_ev,
                           details={"missing_rule_types": rq["missing_rule_types"], "conflicts": rq["conflicts"]}))
        return out, evid
    transit = [locs[p]["country"] for p in route["transshipment_port_ids"]]
    non_party = sorted({c for c in transit if c not in parties})
    if not non_party:
        dc = "passed"
        title = "Transit only through agreement parties (or direct): direct consignment satisfied"
    elif route["fta_transit_evidence_available"]:
        dc = "passed"
        title = "Non-party transit with documented direct-consignment evidence"
    else:
        dc = "needs_review"
        title = "Non-party transit: preference depends on evidence that direct-consignment conditions are met"
    out.append(finding(f"FND-FTA-DIRECT_CONSIGNMENT-{rid}", "FTA.DIRECT_CONSIGNMENT", "trade_compliance", dc, subj, title,
                       [f"EVD-RULE-{rule_ids['origin_consignment']['rule_id']}", f"EVD-ROUTE-{rid}"],
                       remedies=[{"action": "provide_evidence", "text": "Obtain a through bill of lading and transit customs documentation, or choose a direct route."}] if dc != "passed" else [],
                       details={"transit_countries": transit, "non_party_transit_countries": non_party}))
    evid[f"EVD-ROUTE-{rid}"] = evd_route(route)
    coo = quote["certificate_of_origin"]["status"]
    co = "passed" if coo == "available" else "needs_review"
    qe = {"evidence_id": f"EVD-QT-{quote['quote_id']}", "kind": "fixture_record", "source_ids": [quote["source_ref"]],
          "title": f"Supplier quote {quote['quote_id']}", "authority": "contractual", "synthetic": True,
          "locator": {"record_id": quote["quote_id"]}, "excerpt": f"certificate_of_origin {quote['certificate_of_origin']['agreement_id']} {coo}"}
    evid[qe["evidence_id"]] = qe
    out.append(finding(f"FND-FTA-CERTIFICATE_OF_ORIGIN-{rid}", "FTA.CERTIFICATE_OF_ORIGIN", "trade_compliance", co, subj,
                       "Certificate of origin available from supplier" if co == "passed" else "Certificate of origin not yet available",
                       [qe["evidence_id"]], details={"status": coo}))
    return out, evid

def duty_at_risk(quote: dict, route: dict, qty: int, rq: dict):
    rates = {a["rule_type"]: a["structured"]["rate_bps"] for a in rq["applicable"] if a["rule_type"] in ("tariff_mfn", "tariff_preferential")}
    if "tariff_mfn" not in rates:
        return None, None
    diff = rates["tariff_mfn"] - rates.get("tariff_preferential", rates["tariff_mfn"])
    value = qty * (quote["unit_price_inr"] + route["freight_inr_per_unit"])
    return div_half_up(value * diff, 10000), rates

def source_options(fx: dict, assessment: dict):
    quotes = fx["supplier_quotes"]["quotes"]
    routes = fx["route_options"]["route_options"]
    lcs = index(fx["letters_of_credit"]["letters_of_credit"], "lc_id")
    locs = index(fx["master_data"]["locations"], "location_id")
    baseline_price = fx["supplier_quotes"]["baseline_unit_price"]["unit_price_inr"]
    disrupted = assessment["disrupted_node_ids"]
    today = as_of_date(fx)
    options, deps, findings, evidence, rule_results = [], {}, {}, {}, {}

    for pos in fx["inventory"]["positions"]:
        atp = max(0, pos["on_hand"] - pos["reserved"] - pos["protected_floor"])
        oid = f"OPT-{pos['inventory_source_id']}"
        f = finding(f"FND-INV-ATP-{pos['inventory_source_id']}", "INV.AVAILABLE_TO_PROMISE", "inventory_rebalancing",
                    "passed" if atp > 0 else "blocked", {"type": "inventory_source", "id": pos["inventory_source_id"]},
                    f"{atp} units available to promise above protected floor", [f"EVD-INV-{pos['inventory_source_id']}"],
                    details={"on_hand": pos["on_hand"], "reserved": pos["reserved"], "protected_floor": pos["protected_floor"], "atp": atp})
        findings[f["finding_id"]] = f
        evidence[f"EVD-INV-{pos['inventory_source_id']}"] = {
            "evidence_id": f"EVD-INV-{pos['inventory_source_id']}", "kind": "fixture_record", "source_ids": ["SRC-INV-SNAPSHOT"],
            "title": f"Inventory position {pos['inventory_source_id']}", "authority": "internal", "synthetic": True,
            "locator": {"record_id": pos["inventory_source_id"]}, "excerpt": f"on_hand {pos['on_hand']}, reserved {pos['reserved']}, protected_floor {pos['protected_floor']}"}
        options.append({"option_id": oid, "kind": "inventory", "inventory_source_id": pos["inventory_source_id"], "quote_id": None,
                        "supplier_id": None, "route_option_id": None, "capacity_group": pos["inventory_source_id"], "capacity_units": atp,
                        "eta_plant": add_days(today, pos["transfer_days"]), "unit_incremental_cost_inr": pos["transfer_cost_inr_per_unit"],
                        "cost_components_per_unit": {"inventory_transfer": pos["transfer_cost_inr_per_unit"]},
                        "finding_ids": [f["finding_id"]], "outcome": f["outcome"]})

    for q in quotes:
        if q["supplier_id"] not in deps:
            deps[q["supplier_id"]] = dependency_check(fx, q["supplier_id"], q["part_id"], disrupted)
            dep = deps[q["supplier_id"]]
            fid = f"FND-DEP-{q['supplier_id']}"
            findings[fid] = finding(fid, "DEP.SHARED_DISRUPTED_DEPENDENCY", "supplier_dependency", dep["outcome"],
                                    {"type": "supplier", "id": q["supplier_id"]},
                                    {"blocked": "Alternate supplier depends on the disrupted node", "needs_review": "Supplier independence cannot be confirmed",
                                     "passed": "No upstream path to the disrupted node within depth"}[dep["outcome"]],
                                    [e["evidence_id"] for e in dep["evidence"]],
                                    remedies=[{"action": "choose_other_supplier", "text": "Do not count this supplier as independent supply for this disruption."}] if dep["outcome"] == "blocked" else [],
                                    details={"reason_code": dep["reason_code"], "shared_with_primary_node_ids": dep["shared_with_primary_node_ids"],
                                             "coverage_complete": dep["coverage"]["complete"]})
            for e in dep["evidence"]:
                evidence[e["evidence_id"]] = e
        eligible = {r["route_option_id"] for r in eligible_routes(q, routes)}  # MOD-06 decides eligibility
        for r in routes:  # fixture order is kept: it is the golden options[] order
            if r["route_option_id"] not in eligible:
                continue
            fids = [f"FND-DEP-{q['supplier_id']}"]
            rq = rule_applicability(fx, rule_query_for(fx, q, r))
            rule_results[r["route_option_id"]] = rq
            ff, fe = fta_findings(fx, q, r, rq)
            for f in ff:
                findings[f["finding_id"]] = f
                fids.append(f["finding_id"])
            evidence.update(fe)
            if q["lc_id"]:
                lf, le = lc_route_findings(lcs[q["lc_id"]], r, locs)
                for f in lf:
                    findings[f["finding_id"]] = f
                    fids.append(f["finding_id"])
                evidence.update(le)
            outcome = worst(findings[f]["outcome"] for f in fids)
            options.append({"option_id": f"OPT-{r['route_option_id']}", "kind": "supplier", "inventory_source_id": None, "quote_id": q["quote_id"],
                            "supplier_id": q["supplier_id"], "route_option_id": r["route_option_id"], "capacity_group": q["quote_id"],
                            "capacity_units": q["capacity_units"], "eta_plant": r["eta_plant"],
                            "unit_incremental_cost_inr": (q["unit_price_inr"] - baseline_price) + r["freight_inr_per_unit"],
                            "cost_components_per_unit": {"supplier_price_premium": q["unit_price_inr"] - baseline_price, "freight": r["freight_inr_per_unit"]},
                            "finding_ids": fids, "outcome": outcome})
    return options, deps, findings, evidence, rule_results

def greedy_plan(fx: dict, assessment: dict, options: list, strategy: str):
    pol = fx["policies"]["plan_policy"]
    orders = index(fx["orders"]["customer_orders"], "order_id")
    baseline_arrival = assessment["affected_shipments"][0]["revised_eta_plant"]
    allowed = [o for o in options if strategy == "cost_time_only" or o["outcome"] in pol["verified_strategy_allowed_option_outcomes"]]
    remaining_cap = {}
    quotes = index(fx["supplier_quotes"]["quotes"], "quote_id")
    lcs = index(fx["letters_of_credit"]["letters_of_credit"], "lc_id")
    for o in allowed:
        cap = o["capacity_units"]
        if strategy == "constraint_verified" and o["kind"] == "supplier" and quotes[o["quote_id"]]["lc_id"]:
            # The verified strategy never plans a drawing above the available LC balance.
            q = quotes[o["quote_id"]]
            cap = min(cap, lcs[q["lc_id"]]["available_balance_inr"] // q["unit_price_inr"])
        remaining_cap[o["capacity_group"]] = cap
    lines = []
    for ao in sorted(assessment["affected_orders"], key=lambda x: (x["need_by"], x["order_id"])):
        need = ao["qty_affected"]
        while need > 0:
            cands = [o for o in allowed if remaining_cap[o["capacity_group"]] > 0]
            on_time = [o for o in cands if o["eta_plant"] <= ao["need_by"]]
            if on_time:
                pick = min(on_time, key=lambda o: (o["unit_incremental_cost_inr"], o["eta_plant"], o["option_id"]))
            else:
                late = [o for o in cands if (not pol["late_option_must_beat_baseline_arrival"]) or o["eta_plant"] < baseline_arrival]
                if not late:
                    break
                pick = min(late, key=lambda o: (o["eta_plant"], o["unit_incremental_cost_inr"], o["option_id"]))
            take = min(need, remaining_cap[pick["capacity_group"]])
            remaining_cap[pick["capacity_group"]] -= take
            need -= take
            lines.append({"order_id": ao["order_id"], "option_id": pick["option_id"], "qty": take, "eta_plant": pick["eta_plant"],
                          "need_by": ao["need_by"], "days_late": days_late(pick["eta_plant"], ao["need_by"])})
        if need > 0:
            lines.append({"order_id": ao["order_id"], "option_id": "BASELINE-PO", "qty": need, "eta_plant": baseline_arrival,
                          "need_by": ao["need_by"], "days_late": days_late(baseline_arrival, ao["need_by"])})
    for i, line in enumerate(lines, start=1):
        line["line_id"] = f"L{i:02d}"
    return [{k: line[k] for k in ("line_id", "order_id", "option_id", "qty", "need_by", "eta_plant", "days_late")} for line in lines]

def plan_level_findings(fx: dict, plan_id: str, lines: list, options_by_id: dict):
    out = []
    lcs = index(fx["letters_of_credit"]["letters_of_credit"], "lc_id")
    quotes = index(fx["supplier_quotes"]["quotes"], "quote_id")
    by_lc = {}
    for line in lines:
        o = options_by_id.get(line["option_id"])
        if o and o["kind"] == "supplier" and quotes[o["quote_id"]]["lc_id"]:
            q = quotes[o["quote_id"]]
            by_lc.setdefault(q["lc_id"], 0)
            by_lc[q["lc_id"]] += line["qty"] * q["unit_price_inr"]
    for lc_id, drawing in sorted(by_lc.items()):
        lc = lcs[lc_id]
        ok = drawing <= lc["available_balance_inr"]
        out.append(finding(f"FND-LC-AMOUNT-{plan_id}-{lc_id}", "LC.AMOUNT", "trade_compliance", "passed" if ok else "blocked",
                           {"type": "plan", "id": plan_id}, "Drawing fits the available LC balance" if ok else "Drawing exceeds the available LC balance",
                           [f"EVD-LCB-{lc_id}"], details={"drawing_inr": drawing, "available_balance_inr": lc["available_balance_inr"]}))
        partial_ok = lc["structured"]["partial_shipments"]["value"] == "allowed" or drawing == lc["structured"]["amount"]["value"]
        out.append(finding(f"FND-LC-PARTIAL-{plan_id}-{lc_id}", "LC.PARTIAL_SHIPMENTS", "trade_compliance", "passed" if partial_ok else "blocked",
                           {"type": "plan", "id": plan_id}, "Partial drawing permitted by 43P" if partial_ok else "43P prohibits partial shipments",
                           [f"EVD-LCF-{lc_id}-43P"]))
    used = {}
    for line in lines:
        o = options_by_id.get(line["option_id"])
        if o and o["kind"] == "inventory":
            used[o["inventory_source_id"]] = used.get(o["inventory_source_id"], 0) + line["qty"]
    for src, qty in sorted(used.items()):
        atp = options_by_id[f"OPT-{src}"]["capacity_units"]
        ok = qty <= atp
        out.append(finding(f"FND-INV-ALLOCATION-{plan_id}-{src}", "INV.ALLOCATION_FEASIBLE", "inventory_rebalancing", "passed" if ok else "blocked",
                           {"type": "plan", "id": plan_id}, f"Allocates {qty} of {atp} available units" if ok else f"Allocates {qty} but only {atp} available",
                           [f"EVD-INV-{src}"], details={"allocated": qty, "atp": atp}))
    return out

def financials(fx: dict, assessment: dict, lines: list, options_by_id: dict, findings_by_id: dict, rule_results: dict, extra_costs=None):
    orders = index(fx["orders"]["customer_orders"], "order_id")
    quotes = index(fx["supplier_quotes"]["quotes"], "quote_id")
    routes = index(fx["route_options"]["route_options"], "route_option_id")
    baseline_arrival = assessment["affected_shipments"][0]["revised_eta_plant"]
    cost = {"supplier_price_premium": 0, "freight": 0, "inventory_transfer": 0, "lc_amendment_fee": 0, "duty_incremental": 0}
    residual_breakdown = []
    exposures = []
    for line in lines:
        o = options_by_id.get(line["option_id"])
        if o:
            for k, v in o["cost_components_per_unit"].items():
                cost[k] += v * line["qty"]
        if line["days_late"] > 0:
            amt = penalty(orders[line["order_id"]], line["qty"], line["eta_plant"])
            residual_breakdown.append({"line_id": line["line_id"], "order_id": line["order_id"], "qty": line["qty"], "days_late": line["days_late"], "amount_inr": amt})
        if o and o["kind"] == "supplier":
            group = f"supply:{o['quote_id']}"
            fs = [findings_by_id[f] for f in o["finding_ids"]]
            dep = [f for f in fs if f["agent"] == "supplier_dependency" and f["outcome"] in ("blocked", "needs_review")]
            if dep:
                amt = penalty(orders[line["order_id"]], line["qty"], baseline_arrival)
                exposures.append({"exposure_id": f"EXP-DEP-{line['line_id']}", "line_id": line["line_id"], "finding_id": dep[0]["finding_id"],
                                  "kind": "penalty_if_supply_fails", "amount_inr": amt, "mutually_exclusive_group": group,
                                  "basis": f"{line['qty']} units fall back to delayed primary arrival {baseline_arrival}"})
            fta = [f for f in fs if f["check_code"] == "FTA.DIRECT_CONSIGNMENT" and f["outcome"] == "needs_review"]
            if fta:
                amt, rates = duty_at_risk(quotes[o["quote_id"]], routes[o["route_option_id"]], line["qty"], rule_results[o["route_option_id"]])
                exposures.append({"exposure_id": f"EXP-FTA-{line['line_id']}", "line_id": line["line_id"], "finding_id": fta[0]["finding_id"],
                                  "kind": "duty_if_preference_denied", "amount_inr": amt, "mutually_exclusive_group": group,
                                  "basis": f"(unit price + freight) x {line['qty']} x (MFN {rates['tariff_mfn']} bps - preferential {rates.get('tariff_preferential')} bps)"})
            lc = [f for f in fs if f["check_code"].startswith("LC.") and f["outcome"] == "blocked"]
            if lc:
                exposures.append({"exposure_id": f"EXP-LC-{line['line_id']}", "line_id": line["line_id"], "finding_id": lc[0]["finding_id"],
                                  "kind": "documentary_discrepancy", "amount_inr": None, "mutually_exclusive_group": f"lc:{quotes[o['quote_id']]['lc_id']}",
                                  "basis": "Not quantified: shipment cannot proceed as planned without an LC amendment."})
    for k, v in (extra_costs or {}).items():
        cost[k] += v
    baseline = assessment["baseline_loss_inr"]
    recovery = sum(cost.values())
    residual = sum(r["amount_inr"] for r in residual_breakdown)
    # Exposures in the same mutually_exclusive_group describe alternative futures (e.g. "supply fails" vs
    # "supply arrives but preference is denied"). Sum within each (group, kind) scenario, take the worst
    # scenario per group, then add across independent groups. Unquantified exposures (None) are excluded.
    scenario_totals = {}
    for e in exposures:
        if e["amount_inr"] is not None:
            key = (e["mutually_exclusive_group"], e["kind"])
            scenario_totals[key] = scenario_totals.get(key, 0) + e["amount_inr"]
    groups = {}
    for (group, _kind), total in scenario_totals.items():
        groups[group] = max(groups.get(group, 0), total)
    return {
        "currency": "INR",
        "baseline_loss_inr": baseline,
        "recovery_cost_inr": recovery,
        "residual_loss_inr": residual,
        "net_avoided_loss_inr": baseline - recovery - residual,
        "cost_breakdown": [{"category": k, "amount_inr": v} for k, v in cost.items()],
        "residual_breakdown": residual_breakdown,
        "exposures": exposures,
        "worst_case_exposure_inr": sum(groups.values()),
        "formula": "net_avoided_loss = baseline_loss - recovery_cost - residual_loss; exposures are reported separately and never added to recovery_cost",
    }

def build_plan(fx, assessment, options, findings, rule_results, plan_id, label, strategy, evaluation_id="EVAL-0001", extra_costs=None):
    options_by_id = index(options, "option_id")
    lines = greedy_plan(fx, assessment, options, strategy)
    used_fids = [f"FND-SENSE-{assessment['disruption_id']}"]
    for line in lines:
        o = options_by_id.get(line["option_id"])
        if o:
            for f in o["finding_ids"]:
                if f not in used_fids:
                    used_fids.append(f)
    plf = plan_level_findings(fx, plan_id, lines, options_by_id)
    all_findings = {**findings, **{f["finding_id"]: f for f in plf}}
    fin = financials(fx, assessment, lines, options_by_id, all_findings, rule_results, extra_costs)
    fids = used_fids + [f["finding_id"] for f in plf]
    outcome = worst(all_findings[f]["outcome"] for f in fids)
    counts = {k: sum(1 for f in fids if all_findings[f]["outcome"] == k) for k in ("passed", "needs_review", "blocked")}
    status = {"passed": "pending_approval", "needs_review": "needs_review", "blocked": "blocked"}[outcome]
    plan = {
        "schema_version": "1.0.0",
        "plan_id": plan_id,
        "evaluation_id": evaluation_id,
        "version": 1,
        "label": label,
        "strategy": strategy,
        "lines": lines,
        "finding_ids": fids,
        "check_outcome_counts": counts,
        "outcome": outcome,
        "status": status,
        "financials": fin,
        "input_snapshot_id": input_snapshot_id(fx),
        "amendment_request_ids": [],
    }
    plan["plan_hash"] = sha256_of(plan_hash_material(plan))
    return plan, plf

def plan_hash_material(plan: dict) -> dict:
    """Exactly what the plan hash covers. Human-readable strings are deliberately excluded."""
    f = plan["financials"]
    return {
        "plan_id": plan["plan_id"],
        "version": plan["version"],
        "evaluation_id": plan["evaluation_id"],
        "strategy": plan["strategy"],
        "lines": plan["lines"],
        "finding_ids": plan["finding_ids"],
        "outcome": plan["outcome"],
        "financials": {
            "baseline_loss_inr": f["baseline_loss_inr"],
            "recovery_cost_inr": f["recovery_cost_inr"],
            "residual_loss_inr": f["residual_loss_inr"],
            "net_avoided_loss_inr": f["net_avoided_loss_inr"],
            "worst_case_exposure_inr": f["worst_case_exposure_inr"],
            "cost_breakdown": [[c["category"], c["amount_inr"]] for c in f["cost_breakdown"]],
            "exposures": [[e["exposure_id"], e["amount_inr"]] for e in f["exposures"]],
        },
        "input_snapshot_id": plan["input_snapshot_id"],
    }

def sensing_finding(assessment: dict) -> dict:
    ok = assessment["outcome"] == "passed"
    return finding(f"FND-SENSE-{assessment['disruption_id']}", "SENSE.EVENT_RESOLUTION", "disruption_sensing", assessment["outcome"],
                   {"type": "disruption", "id": assessment["disruption_id"]},
                   "Disruption mapped to graph nodes and affected orders" if ok else "Disruption could not be fully mapped; human review required",
                   [e["evidence_id"] for e in assessment["evidence"]], details={"issues": assessment["issues"]})

def evaluate(
    fx: dict,
    disruption_id: str,
    evaluation_id: str,
    plan_ids: tuple[str, str],
    extra_costs_verified: dict[str, int] | None = None,
) -> dict[str, Any]:
    assessment = assess_disruption(fx, disruption_id)
    options, deps, findings, evidence, rule_results = source_options(fx, assessment)
    sf = sensing_finding(assessment)
    findings[sf["finding_id"]] = sf
    for e in assessment["evidence"]:
        evidence[e["evidence_id"]] = e
    p1, p1f = build_plan(fx, assessment, options, findings, rule_results, plan_ids[0], "P1 Fastest-cheapest (cost and time only)", "cost_time_only", evaluation_id=evaluation_id)
    p2, p2f = build_plan(fx, assessment, options, findings, rule_results, plan_ids[1], "P2 AegisShield verified", "constraint_verified", evaluation_id=evaluation_id, extra_costs=extra_costs_verified)
    for f in p1f + p2f:
        findings[f["finding_id"]] = f
    lcs = fx["letters_of_credit"]["letters_of_credit"]
    for lc in lcs:
        evidence[f"EVD-LCB-{lc['lc_id']}"] = {"evidence_id": f"EVD-LCB-{lc['lc_id']}", "kind": "fixture_record", "source_ids": [lc["available_balance_source_ref"]],
                                             "title": f"Available balance of {lc['lc_id']}", "authority": "internal", "synthetic": True,
                                             "locator": {"lc_id": lc["lc_id"]}, "excerpt": f"available_balance_inr {lc['available_balance_inr']}"}
        evidence[f"EVD-LCF-{lc['lc_id']}-43P"] = evd_lc_field(lc, "partial_shipments")
    return {"assessment": assessment, "options": options, "dependency": deps, "findings": findings, "evidence": evidence,
            "rule_results": rule_results, "plans": [p1, p2]}


def build_evaluation_payload(
    fx: dict[str, Any],
    disruption_id: str,
    evaluation_id: str,
    plan_ids: tuple[str, str],
    llm_mode: str,
    started_at: str,
    completed_at: str | None = None,
    max_depth: int | None = None,
) -> dict[str, Any]:
    """Build a contract-shaped evaluation from fixture-derived domain results."""
    snapshot = input_snapshot_id(fx)
    if max_depth is not None:
        fx = json.loads(json.dumps(fx))
        fx["policies"]["dependency_policy"]["max_depth"] = max_depth
    result = evaluate(fx, disruption_id, evaluation_id, plan_ids)
    if max_depth is not None:
        for plan in result["plans"]:
            plan["input_snapshot_id"] = snapshot
            plan["plan_hash"] = sha256_of(plan_hash_material(plan))
    if completed_at is None:
        completed_at = dt.datetime.now(dt.timezone.utc).isoformat()
    started = dt.datetime.fromisoformat(started_at)
    completed = dt.datetime.fromisoformat(completed_at)
    duration_ms = max(0, int((completed - started).total_seconds() * 1000))
    definitions = [
        ("disruption_sensing", "member_4", 10000, "gold"),
        ("supplier_dependency", "member_4", 5000, "deterministic"),
        ("routing", "member_4", 5000, "deterministic"),
        ("inventory_rebalancing", "member_3", 5000, "deterministic"),
        ("trade_compliance", "member_3", 5000, "deterministic"),
        ("plan_assembly", "member_3", 5000, "deterministic"),
        ("explanation", "member_5", 10000, "template"),
    ]
    steps = [
        {
            "seq": seq,
            "step": name,
            "owner": owner,
            "status": "succeeded",
            "attempts": 1,
            "timeout_ms": timeout_ms,
            "started_at": started_at,
            "finished_at": completed_at,
            "duration_ms": duration_ms if seq == 7 else 0,
            "mode": mode,
            "error": None,
        }
        for seq, (name, owner, timeout_ms, mode) in enumerate(definitions, start=1)
    ]
    plans = result["plans"]
    comparison_plans = [
        {
            "plan_id": p["plan_id"],
            "label": p["label"],
            "outcome": p["outcome"],
            "executable": p["outcome"] == "passed",
            "recovery_cost_inr": p["financials"]["recovery_cost_inr"],
            "residual_loss_inr": p["financials"]["residual_loss_inr"],
            "net_avoided_loss_inr": p["financials"]["net_avoided_loss_inr"],
            "worst_case_exposure_inr": p["financials"]["worst_case_exposure_inr"],
            "check_outcome_counts": p["check_outcome_counts"],
        }
        for p in plans
    ]
    selectable = [p for p in plans if p["outcome"] != "blocked"]
    recommended = max(
        selectable,
        key=lambda p: (
            1 if p["outcome"] == "passed" else 0,
            p["financials"]["net_avoided_loss_inr"],
            -p["financials"]["worst_case_exposure_inr"],
        ),
        default=None,
    )
    blocked = [p for p in plans if p["outcome"] == "blocked"]
    best_blocked = max((p["financials"]["net_avoided_loss_inr"] for p in blocked), default=None)
    recommendation_rule = (
        "Exclude blocked plans; prefer outcome passed over needs_review; then highest net_avoided_loss_inr; "
        "then lowest worst_case_exposure_inr."
    )
    comparison = {
        "baseline_loss_inr": result["assessment"]["baseline_loss_inr"],
        "plans": comparison_plans,
        "recommended_plan_id": recommended["plan_id"] if recommended else None,
        "recommendation_rule": recommendation_rule,
        "paper_advantage_of_best_blocked_plan_inr": (
            best_blocked - recommended["financials"]["net_avoided_loss_inr"]
            if best_blocked is not None and recommended else None
        ),
    }
    findings = result["findings"]
    explanations = []
    for plan in plans:
        cited = [findings[fid] for fid in plan["finding_ids"]]
        material = [f for f in cited if f["outcome"] in ("blocked", "needs_review")]
        if material:
            summary = "; ".join(f"{f['finding_id']} is {f['outcome']}" for f in material)
            cited_ids = [f["finding_id"] for f in material]
        else:
            summary = "All checks passed"
            cited_ids = plan["finding_ids"][:3]
        explanations.append({
            "explanation_id": f"XPL-{plan['plan_id']}",
            "subject_id": plan["plan_id"],
            "mode": "template",
            "prompt_id": None,
            "model": None,
            "text": (
                f"{plan['plan_id']} outcome {plan['outcome']}. {summary}. "
                f"Net avoided loss INR {plan['financials']['net_avoided_loss_inr']}."
            ),
            "cited_ids": cited_ids,
            "validation": {"passed": True, "errors": []},
            "generated_at": completed_at,
        })
    return {
        "schema_version": "1.0.0",
        "evaluation_id": evaluation_id,
        "disruption_id": disruption_id,
        "status": "completed",
        "data_mode": "synthetic",
        "llm_mode": llm_mode,
        "input_snapshot_id": snapshot,
        "created_at": started_at,
        "completed_at": completed_at,
        "steps": steps,
        "assessment": result["assessment"],
        "dependency_results": [result["dependency"][sid] for sid in sorted(result["dependency"])],
        "rule_results": [result["rule_results"][rid] for rid in sorted(result["rule_results"])],
        "options": result["options"],
        "findings": [findings[fid] for fid in sorted(findings)],
        "evidence": [result["evidence"][eid] for eid in sorted(result["evidence"])],
        "plans": plans,
        "comparison": comparison,
        "explanations": explanations,
        "error": None,
    }
