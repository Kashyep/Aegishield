"""AegisShield reference oracle.

PURPOSE: an executable specification used only by tools/check_contracts.py to prove that
fixtures, golden outputs, validation cases and documented formulas agree.

THIS IS NOT PRODUCTION CODE. Do not import it from backend/ or frontend/.
Production modules must be implemented independently by their owners and are tested
against the golden files in fixtures/expected/, not against this module.

Owner: Member 3 (contract tooling). Reviewer: Member 5.
"""
from __future__ import annotations

import copy
import datetime as dt
import hashlib
import json
from pathlib import Path

OUTCOME_RANK = {"not_applicable": -1, "passed": 0, "needs_review": 1, "blocked": 2}
AUTH_RANK = {"official_gazette": 0, "official_circular": 1, "internal_policy": 2, "secondary": 3}
FIXTURE_FILES = [
    "disruptions", "inventory", "letters_of_credit", "master_data", "orders", "policies",
    "route_options", "scenario", "sources", "supplier_quotes", "supply_graph", "trade_rules",
]


# --------------------------------------------------------------------------- utilities
def load_fixtures(directory: Path) -> dict:
    return {name: json.loads((directory / f"{name}.json").read_text()) for name in FIXTURE_FILES}


def canonical_json(obj) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha256_of(obj) -> str:
    return "sha256:" + hashlib.sha256(canonical_json(obj).encode("utf-8")).hexdigest()


def input_snapshot_id(fx: dict) -> str:
    return sha256_of({name: fx[name] for name in sorted(fx)})


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


def apply_patches(fx: dict, patches: list) -> dict:
    """Selector-based patches used by fixtures/validation/cases.json."""
    fx = copy.deepcopy(fx)
    for p in patches:
        doc = fx[p["file"]]
        target = doc
        for part in p["collection"].split("."):
            target = target[part]
        op = p["op"]
        if op == "append":
            target.append(copy.deepcopy(p["value"]))
        elif op in ("set", "remove"):
            matches = [item for item in target if all(item.get(k) == v for k, v in p["match"].items())]
            if len(matches) != 1:
                raise ValueError(f"patch selector matched {len(matches)} items: {p}")
            if op == "set":
                for path, value in p["set"].items():
                    node = matches[0]
                    keys = path.split(".")
                    for k in keys[:-1]:
                        node = node[k]
                    node[keys[-1]] = copy.deepcopy(value)
            else:
                target.remove(matches[0])
        else:
            raise ValueError(f"unknown patch op {op}")
    return fx


# --------------------------------------------------------------------------- penalties
def penalty(order: dict, qty: int, arrival: str) -> int:
    late = days_late(arrival, order["component_need_by"])
    p = order["penalty"]
    return qty * p["rate_inr_per_unit_per_day"] * min(late, p["cap_days"])


# --------------------------------------------------------------------------- disruption sensing
def resolve_alias(fx: dict, alias: str):
    alias_l = alias.strip().lower()
    hits = [n["node_id"] for n in fx["supply_graph"]["nodes"] if alias_l in [a.lower() for a in n["aliases"]]]
    return hits[0] if len(hits) == 1 else None


def assess_disruption(fx: dict, disruption_id: str) -> dict:
    event = index(fx["disruptions"]["events"], "disruption_id")[disruption_id]
    gold = event["gold_extraction"]
    orders = index(fx["orders"]["customer_orders"], "order_id")
    pos = index(fx["orders"]["purchase_orders"], "po_id")
    shipments = index(fx["orders"]["shipments"], "shipment_id")
    node_id = resolve_alias(fx, gold["root_cause"]["facility_alias"])
    issues = []
    if node_id is None:
        issues.append("ROOT_CAUSE_ALIAS_UNRESOLVED")
    affected_shipments, affected_orders = [], []
    baseline = 0
    for sid in gold["affected_shipment_ids"]:
        shp = shipments[sid]
        revised_etd = add_days(shp["planned_etd"], gold["delay_days"])
        if revised_etd != gold["new_etd"]:
            issues.append("NEW_ETD_INCONSISTENT_WITH_DELAY")
        revised_plant = add_days(shp["planned_eta_plant"], gold["delay_days"])
        affected_shipments.append({
            "shipment_id": sid,
            "po_id": shp["po_id"],
            "planned_etd": shp["planned_etd"],
            "revised_etd": revised_etd,
            "planned_eta_plant": shp["planned_eta_plant"],
            "revised_eta_plant": revised_plant,
            "delay_days": gold["delay_days"],
        })
        for peg in pos[shp["po_id"]]["pegging"]:
            order = orders[peg["order_id"]]
            late = days_late(revised_plant, order["component_need_by"])
            if late == 0:
                continue
            pen = penalty(order, peg["qty"], revised_plant)
            baseline += pen
            affected_orders.append({
                "order_id": order["order_id"],
                "customer_id": order["customer_id"],
                "qty_affected": peg["qty"],
                "order_value_inr": order["order_value_inr"],
                "need_by": order["component_need_by"],
                "revised_arrival": revised_plant,
                "days_late": late,
                "baseline_penalty_inr": pen,
            })
    pol = fx["policies"]["severity_policy"]
    max_late = max([o["days_late"] for o in affected_orders], default=0)
    if baseline >= pol["critical_if_baseline_loss_inr_gte"]:
        severity = "critical"
    elif baseline >= pol["high_if_baseline_loss_inr_gte"] or max_late >= pol["high_if_any_order_days_late_gte"]:
        severity = "high"
    elif baseline >= pol["medium_if_baseline_loss_inr_gte"]:
        severity = "medium"
    else:
        severity = "low"
    supplier_ids = sorted({pos[s["po_id"]]["supplier_id"] for s in affected_shipments})
    return {
        "schema_version": "1.0.0",
        "assessment_id": f"DA-{disruption_id}",
        "disruption_id": disruption_id,
        "outcome": "needs_review" if issues else "passed",
        "issues": issues,
        "extraction_mode": "gold",
        "event_type": gold["event_type"],
        "severity": severity,
        "severity_basis": f"baseline_loss_inr={baseline}; max_days_late={max_late}",
        "disrupted_node_ids": [node_id] if node_id else [],
        "affected_supplier_ids": supplier_ids,
        "affected_shipments": affected_shipments,
        "affected_orders": affected_orders,
        "baseline_loss_inr": baseline,
        "evidence": [{
            "evidence_id": f"EVD-NOTICE-{disruption_id}",
            "kind": "source_document",
            "source_ids": [event["source"]["source_id"]],
            "title": event["source"]["title"],
            "authority": event["source"]["authority"],
            "synthetic": True,
            "locator": {"record_id": disruption_id},
            "excerpt": "Shipment SHP-A-0901 will depart Port Klang on 02 Nov 2026 instead of 26 Oct 2026.",
        }],
    }


# --------------------------------------------------------------------------- GraphRAG dependency check
def bom_closure(fx: dict, part_id: str) -> set:
    parts = index(fx["master_data"]["parts"], "part_id")
    out, stack = set(), [part_id]
    while stack:
        p = stack.pop()
        if p in out:
            continue
        out.add(p)
        stack.extend(c["child_part_id"] for c in parts[p]["bom"])
    return out


def _incoming(fx: dict) -> dict:
    inc = {}
    for e in fx["supply_graph"]["edges"]:
        if e["type"] == "SUPPLIES":
            inc.setdefault(e["target"], []).append(e)
    for v in inc.values():
        v.sort(key=lambda e: e["edge_id"])
    return inc


def upstream_paths(fx: dict, start: str, part_id: str, max_depth: int):
    nodes = index(fx["supply_graph"]["nodes"], "node_id")
    relevant = bom_closure(fx, part_id)
    inc = _incoming(fx)
    paths, flags = [], {"cycle": False, "truncated": False, "gaps": []}

    def dfs(node, depth, pnodes, pedges):
        ins = [e for e in inc.get(node, []) if e["part_id"] in relevant]
        if not ins:
            if pedges:
                supplied_part = pedges[-1]["part_id"]
                if supplied_part not in nodes[node]["origin_for_part_ids"]:
                    flags["gaps"].append({"kind": "upstream_unknown", "node_id": node, "part_id": supplied_part})
                paths.append((pnodes, pedges, "complete"))
            return
        if depth == max_depth:
            flags["truncated"] = True
            paths.append((pnodes, pedges, "truncated"))
            return
        for e in ins:
            if e["source"] in pnodes:
                flags["cycle"] = True
                continue
            dfs(e["source"], depth + 1, pnodes + [e["source"]], pedges + [e])

    dfs(start, 0, [start], [])
    return paths, flags


def linearize_path(fx: dict, pnodes: list, pedges: list, disrupted: set) -> str:
    nodes = index(fx["supply_graph"]["nodes"], "node_id")
    parts = index(fx["master_data"]["parts"], "part_id")

    def label(nid):
        n = nodes[nid]
        tag = " [DISRUPTED]" if nid in disrupted else ""
        return f"({n['label']} | {n['org_name']} | {n['country']} | {nid}){tag}"

    text = label(pnodes[0])
    for i, e in enumerate(pedges):
        text += f" <-SUPPLIES[{parts[e['part_id']]['name'].split(' (')[0]}; {e['edge_id']}; {e['source_ref']}; {e['confidence']}]- " + label(pnodes[i + 1])
    return text


def dependency_check(fx: dict, supplier_id: str, part_id: str, disrupted_ids: list, max_depth=None) -> dict:
    pol = fx["policies"]["dependency_policy"]
    max_depth = max_depth or pol["max_depth"]
    suppliers = index(fx["master_data"]["suppliers"], "supplier_id")
    parts = index(fx["master_data"]["parts"], "part_id")
    nodes = index(fx["supply_graph"]["nodes"], "node_id")
    disrupted = set(disrupted_ids)
    start = suppliers[supplier_id]["supplying_facility_id"]
    paths, flags = upstream_paths(fx, start, part_id, max_depth)
    inc = _incoming(fx)

    gaps = list(flags["gaps"])
    for child in parts[part_id]["bom"]:
        if child["critical"] and not any(e["part_id"] == child["child_part_id"] for e in inc.get(start, [])):
            gaps.append({"kind": "missing_critical_input", "node_id": start, "part_id": child["child_part_id"]})

    evidence, disrupted_paths, all_paths = [], [], []
    for i, (pnodes, pedges, status) in enumerate(paths, start=1):
        hit = next((k for k, n in enumerate(pnodes) if n in disrupted), None)
        if hit is not None:
            pnodes, pedges = pnodes[: hit + 1], pedges[:hit]
        path_id = f"PATH-{supplier_id}-{i}"
        kind = "shared_disrupted_dependency" if hit is not None else ("truncated" if status == "truncated" else "clean")
        rec = {
            "path_id": path_id,
            "kind": kind,
            "node_ids": pnodes,
            "edge_ids": [e["edge_id"] for e in pedges],
            "all_edges_verified": all(e["confidence"] == "verified" for e in pedges),
            "linearized": linearize_path(fx, pnodes, pedges, disrupted),
        }
        all_paths.append(rec)
        if hit is not None:
            disrupted_paths.append(rec)
        evidence.append({
            "evidence_id": f"EVD-{path_id}",
            "kind": "graph_path",
            "source_ids": sorted({e["source_ref"] for e in pedges}),
            "title": (f"Upstream path from {nodes[start]['label']} to disrupted {nodes[pnodes[-1]]['label']}" if hit is not None
                      else f"Upstream path from {nodes[start]['label']} to {nodes[pnodes[-1]]['label']}"),
            "authority": "internal",
            "synthetic": True,
            "locator": {"path_id": path_id, "node_ids": pnodes, "edge_ids": rec["edge_ids"]},
            "excerpt": rec["linearized"],
        })

    if not disrupted:
        outcome, reason = "needs_review", "DISRUPTED_NODE_UNKNOWN"
    elif disrupted_paths:
        verified = all(p["all_edges_verified"] for p in disrupted_paths)
        outcome = "blocked" if (verified and pol["block_requires_all_path_edges_verified"]) else "needs_review"
        reason = "SHARED_DISRUPTED_DEPENDENCY" if outcome == "blocked" else "UNVERIFIED_PATH_TO_DISRUPTED_NODE"
    elif gaps:
        outcome, reason = pol["missing_critical_input_outcome"], "INCOMPLETE_DEPENDENCY_DATA"
    elif flags["truncated"]:
        outcome, reason = pol["truncated_traversal_outcome"], "TRAVERSAL_TRUNCATED"
    else:
        outcome, reason = "passed", "NO_PATH_TO_DISRUPTED_NODE"

    upstream = sorted({n for p in all_paths for n in p["node_ids"][1:]})
    primary = [s for s in fx["master_data"]["suppliers"] if s["relationship"] == "primary"]
    shared_with_primary = []
    if primary and primary[0]["supplier_id"] != supplier_id:
        p_paths, _ = upstream_paths(fx, primary[0]["supplying_facility_id"], part_id, max_depth)
        p_up = {n for pn, _, _ in p_paths for n in pn[1:]}
        shared_with_primary = sorted(set(upstream) & p_up)
    notes = []
    for n in shared_with_primary:
        if n not in disrupted:
            notes.append({"code": "SHARED_NON_DISRUPTED_DEPENDENCY", "node_id": n,
                          "text": f"{nodes[n]['label']} also supplies the primary supplier; not disrupted, recorded as concentration risk."})
    if flags["cycle"]:
        notes.append({"code": "CYCLE_DETECTED", "node_id": None, "text": "A cycle was detected and skipped during traversal."})

    return {
        "schema_version": "1.0.0",
        "supplier_id": supplier_id,
        "part_id": part_id,
        "start_node_id": start,
        "max_depth": max_depth,
        "disrupted_node_ids": sorted(disrupted),
        "outcome": outcome,
        "reason_code": reason,
        "paths": all_paths,
        "upstream_node_ids": upstream,
        "shared_with_primary_node_ids": shared_with_primary,
        "coverage": {"complete": not gaps, "gaps": gaps},
        "truncated": flags["truncated"],
        "cycle_detected": flags["cycle"],
        "notes": notes,
        "evidence": evidence,
    }


def linearized_context(fx: dict, dep: dict) -> dict:
    lines = [f"QUERY supplier={dep['supplier_id']} part={dep['part_id']} max_depth={dep['max_depth']} disrupted={','.join(dep['disrupted_node_ids'])}",
             f"RESULT outcome={dep['outcome']} reason={dep['reason_code']} coverage_complete={str(dep['coverage']['complete']).lower()} truncated={str(dep['truncated']).lower()}"]
    for p in dep["paths"]:
        lines.append(f"PATH {p['path_id']} [{p['kind']}] {p['linearized']}")
    for n in dep["notes"]:
        lines.append(f"NOTE {n['code']} {n['node_id'] or ''}".rstrip())
    triples = []
    edges = index(fx["supply_graph"]["edges"], "edge_id")
    for eid in sorted({e for p in dep["paths"] for e in p["edge_ids"]}):
        e = edges[eid]
        triples.append({"s": e["source"], "p": f"SUPPLIES:{e['part_id']}", "o": e["target"], "edge_id": eid, "confidence": e["confidence"]})
    return {
        "schema_version": "1.0.0",
        "context_id": f"CTX-DEP-{dep['supplier_id']}",
        "format": "aegis-path-v1",
        "subject_id": dep["supplier_id"],
        "lines": lines,
        "triples": triples,
        "allowed_citation_ids": sorted([p["path_id"] for p in dep["paths"]] + [t["edge_id"] for t in triples]),
        "truncated": False,
    }


def graph_view(fx: dict, deps: list, focus_supplier_id: str) -> dict:
    nodes = index(fx["supply_graph"]["nodes"], "node_id")
    suppliers = index(fx["master_data"]["suppliers"], "supplier_id")
    disrupted = set(deps[0]["disrupted_node_ids"]) if deps else set()
    status_by_supplier = {dep["supplier_id"]: dep["outcome"] for dep in deps}
    view_nodes, view_edges, paths = {}, {}, []
    keep = {"FAC-KAV-BLR"}
    for dep in deps:
        keep.add(dep["start_node_id"])
        keep.update(dep["upstream_node_ids"])
    primary = [s for s in fx["master_data"]["suppliers"] if s["relationship"] == "primary"][0]
    keep.add(primary["supplying_facility_id"])
    for nid in sorted(keep):
        n = nodes[nid]
        if nid in disrupted:
            st = "disrupted"
        elif n["supplier_id"] in status_by_supplier:
            st = {"blocked": "blocked", "needs_review": "needs_review", "passed": "candidate_passed"}[status_by_supplier[n["supplier_id"]]]
        elif n["role"] == "buyer_plant":
            st = "buyer"
        elif nid == primary["supplying_facility_id"]:
            st = "affected_primary"
        else:
            st = "normal"
        view_nodes[nid] = {"id": nid, "label": n["label"], "org_name": n["org_name"], "country": n["country"], "role": n["role"], "status": st, "synthetic": True}
    blocking_edges = set()
    focus = [dep for dep in deps if dep["supplier_id"] == focus_supplier_id]
    for dep in focus:
        for p in dep["paths"]:
            paths.append({"path_id": p["path_id"], "kind": p["kind"], "node_ids": p["node_ids"], "edge_ids": p["edge_ids"]})
            if p["kind"] == "shared_disrupted_dependency":
                blocking_edges.update(p["edge_ids"])
    for e in fx["supply_graph"]["edges"]:
        if e["source"] in keep and e["target"] in keep:
            view_edges[e["edge_id"]] = {"id": e["edge_id"], "source": e["source"], "target": e["target"], "type": "SUPPLIES",
                                        "part_id": e["part_id"], "confidence": e["confidence"], "source_ref": e["source_ref"],
                                        "highlighted": e["edge_id"] in blocking_edges, "candidate": False}
    for dep in deps:
        sid = dep["supplier_id"]
        cid = f"CAND-{sid}"
        view_edges[cid] = {"id": cid, "source": suppliers[sid]["supplying_facility_id"], "target": "FAC-KAV-BLR", "type": "CANDIDATE_SUPPLY",
                           "part_id": dep["part_id"], "confidence": None, "source_ref": None, "highlighted": False, "candidate": True}
    return {
        "schema_version": "1.0.0",
        "view_id": f"GV-EVAL-0001-{focus_supplier_id}",
        "evaluation_id": "EVAL-0001",
        "focus_supplier_id": focus_supplier_id,
        "edge_direction": "provider_to_consumer",
        "nodes": [view_nodes[k] for k in sorted(view_nodes)],
        "edges": [view_edges[k] for k in sorted(view_edges)],
        "paths": paths,
        "text_alternative": [p["linearized"] for dep in focus for p in dep["paths"]],
    }


# --------------------------------------------------------------------------- temporal rule applicability
def rule_value(rule: dict):
    s = rule["structured"]
    return s.get("rate_bps") if "rate_bps" in s else canonical_json(s)


def rule_applicability(fx: dict, query: dict) -> dict:
    rules = sorted(fx["trade_rules"]["rules"], key=lambda r: r["rule_id"])
    agreements = index(fx["master_data"]["agreements"], "agreement_id")
    on, known = query["applicable_on"], query["known_as_of"]
    excluded, candidates = [], []
    for r in rules:
        if r["rule_type"] not in query["rule_types"]:
            continue
        reason = None
        if r["jurisdiction"] != query["jurisdiction"]:
            reason = "jurisdiction_mismatch"
        elif "*" not in r["hs_scope"] and query["hs_code"] not in r["hs_scope"]:
            reason = "hs_scope_mismatch"
        elif r["origin_scope"] == "agreement_parties" and (
                r["agreement_id"] not in agreements or query["origin_country"] not in agreements[r["agreement_id"]]["parties"]):
            reason = "origin_scope_mismatch"
        elif r["published_date"] > known:
            reason = "not_yet_published"
        elif r["status"] in ("draft", "withdrawn"):
            reason = r["status"]
        elif on < r["effective_from"]:
            reason = "not_yet_effective"
        if reason:
            excluded.append({"rule_id": r["rule_id"], "reason": reason})
        else:
            candidates.append(r)
    remaining = []
    for r in candidates:
        if any(r["rule_id"] in s["supersedes"] for s in candidates):
            excluded.append({"rule_id": r["rule_id"], "reason": "superseded"})
        elif r["effective_to"] is not None and on > r["effective_to"]:
            excluded.append({"rule_id": r["rule_id"], "reason": "expired"})
        else:
            remaining.append(r)
    applicable, conflicts, missing = [], [], []
    for rtype in query["rule_types"]:
        group = sorted([r for r in remaining if r["rule_type"] == rtype], key=lambda r: (AUTH_RANK[r["authority"]["level"]], r["rule_id"]))
        if not group:
            missing.append(rtype)
            continue
        best_rank = AUTH_RANK[group[0]["authority"]["level"]]
        top = [r for r in group if AUTH_RANK[r["authority"]["level"]] == best_rank]
        lower = [r for r in group if AUTH_RANK[r["authority"]["level"]] != best_rank]
        if len({rule_value(r) for r in top}) > 1:
            conflicts.append({"rule_type": rtype, "rule_ids": [r["rule_id"] for r in top], "field": "structured",
                              "values": [rule_value(r) for r in top], "resolution": "unresolved"})
            continue
        chosen = sorted(top, key=lambda r: r["published_date"], reverse=True)[0]
        applicable.append({"rule_id": chosen["rule_id"], "rule_type": rtype, "family_id": chosen["family_id"],
                           "effective_from": chosen["effective_from"], "effective_to": chosen["effective_to"],
                           "authority_level": chosen["authority"]["level"], "structured": chosen["structured"],
                           "citation": {"source_id": chosen["source"]["source_id"], "title": chosen["source"]["title"], "synthetic": chosen["source"]["synthetic"]}})
        for r in top:
            if r is not chosen:
                excluded.append({"rule_id": r["rule_id"], "reason": "duplicate_same_authority"})
        for r in lower:
            excluded.append({"rule_id": r["rule_id"], "reason": "lower_authority"})
            if rule_value(r) != rule_value(chosen):
                conflicts.append({"rule_type": rtype, "rule_ids": [chosen["rule_id"], r["rule_id"]], "field": "structured",
                                  "values": [rule_value(chosen), rule_value(r)], "resolution": "authority_precedence"})
    unresolved = [c for c in conflicts if c["resolution"] == "unresolved"]
    return {
        "schema_version": "1.0.0",
        "query": query,
        "outcome": "needs_review" if (unresolved or missing) else "resolved",
        "applicable": applicable,
        "excluded": sorted(excluded, key=lambda x: x["rule_id"]),
        "conflicts": conflicts,
        "missing_rule_types": missing,
        "retrieval_trace": {"selection": "deterministic_metadata_filter", "ranker_used_for_selection": False},
    }


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


# --------------------------------------------------------------------------- compliance checks
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


# --------------------------------------------------------------------------- options, plans, financials
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
        for r in routes:
            if r["origin_port_id"] != q["origin_port_id"] or r["etd"] < q["ready_date"]:
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


def evaluate(fx: dict, disruption_id="DIS-2026-0042", extra_costs_verified=None):
    assessment = assess_disruption(fx, disruption_id)
    options, deps, findings, evidence, rule_results = source_options(fx, assessment)
    sf = sensing_finding(assessment)
    findings[sf["finding_id"]] = sf
    for e in assessment["evidence"]:
        evidence[e["evidence_id"]] = e
    p1, p1f = build_plan(fx, assessment, options, findings, rule_results, "PLN-0001", "P1 Fastest-cheapest (cost and time only)", "cost_time_only")
    p2, p2f = build_plan(fx, assessment, options, findings, rule_results, "PLN-0002", "P2 AegisShield verified", "constraint_verified", extra_costs=extra_costs_verified)
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


# --------------------------------------------------------------------------- approval state machine (reference model)
class ApprovalModel:
    """Reference model of decision and execution rules. Returns (http_status, error_code_or_None)."""

    def __init__(self, fx: dict, plans: list, findings: dict):
        self.policy = fx["policies"]["approval_policy"]
        self.actors = index(fx["policies"]["demo_actors"], "actor_id")
        self.plans = {p["plan_id"]: copy.deepcopy(p) for p in plans}
        self.findings = findings
        self.decisions, self.executions = {}, {}
        self.keys = {}

    def decide(self, plan_id, action, version, plan_hash, actor_id, key, acknowledgements=()):
        # Order mirrors openapi.yaml decidePlan: actor -> idempotency -> plan exists -> superseded -> stale -> decided -> action rules
        actor = self.actors.get(actor_id)
        if actor is None or actor["role"] == "viewer":
            return 403, "ROLE_FORBIDDEN"
        if key in self.keys:
            prev = self.keys[key]
            same = prev.get("request") == (plan_id, action, version, plan_hash, actor_id)
            return (200, None) if same else (409, "IDEMPOTENCY_KEY_REUSED")
        plan = self.plans.get(plan_id)
        if plan is None:
            return 404, "NOT_FOUND"
        if plan["status"] == "superseded":
            return 409, "PLAN_SUPERSEDED"
        if version != plan["version"] or plan_hash != plan["plan_hash"]:
            return 409, "PLAN_VERSION_STALE"
        if plan["status"] in ("approved", "rejected", "executing", "completed", "failed"):
            return 409, "DECISION_EXISTS"
        if action == "approve":
            if actor["role"] not in self.policy["approver_roles"]:
                return 403, "ROLE_FORBIDDEN"
            if plan["status"] == "blocked":
                return 422, "PLAN_BLOCKED"
            review = [f for f in plan["finding_ids"] if self.findings[f]["outcome"] == "needs_review"]
            acked = {a["finding_id"]: a for a in acknowledgements}
            for fid in review:
                if fid not in acked:
                    return 422, "ACKNOWLEDGEMENT_REQUIRED"
                ack_role = self.actors[acked[fid]["actor_id"]]["role"]
                if ack_role not in self.policy["acknowledgement_roles"][self.findings[fid]["agent"]]:
                    return 403, "ROLE_FORBIDDEN"
            plan["status"] = "approved"
        elif action == "reject":
            if actor["role"] not in self.policy["reject_roles"]:
                return 403, "ROLE_FORBIDDEN"
            plan["status"] = "rejected"
        elif action == "request_amendment":
            if actor["role"] not in self.policy["amendment_request_roles"]:
                return 403, "ROLE_FORBIDDEN"
            if not any(self.findings[f]["check_code"].startswith("LC.") and self.findings[f]["outcome"] == "blocked" for f in plan["finding_ids"]):
                return 422, "NO_AMENDABLE_FINDING"
            plan["amendment_request_ids"].append(f"AMD-{len(plan['amendment_request_ids']) + 1:04d}")
        did = f"DEC-{len(self.decisions) + 1:04d}"
        self.decisions[did] = {"plan_id": plan_id, "action": action}
        self.keys[key] = {"request": (plan_id, action, version, plan_hash, actor_id), "decision_id": did}
        return 201, None

    def execute(self, plan_id, key):
        if key in self.keys:
            return (202, None) if self.keys[key].get("execution_for") == plan_id else (409, "IDEMPOTENCY_KEY_REUSED")
        plan = self.plans.get(plan_id)
        if plan is None:
            return 404, "NOT_FOUND"
        if plan["status"] in ("executing", "completed", "failed"):
            return 409, "ALREADY_EXECUTED"
        if plan["status"] != "approved":
            return 409, "NOT_APPROVED"
        plan["status"] = "completed"
        self.keys[key] = {"execution_for": plan_id}
        return 202, None

    def supersede(self, plan_id):
        if self.plans[plan_id]["status"] in ("blocked", "needs_review", "pending_approval"):
            self.plans[plan_id]["status"] = "superseded"
