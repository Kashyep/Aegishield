"""Early-warning index computation (MOD-21).

Pure, deterministic heuristic scoring of external signals per facility and port.
Advisory only: never changes evaluations, plans, money, or plan hashes.
"""

import datetime as dt
from typing import Any, Dict, List, Optional, Set, Tuple

AUTHORITY_BY_SOURCE_KIND = {
    "official": "official_circular",
    "operator": "secondary",
    "news": "secondary",
    "social": "secondary",
}


def div_half_up(numerator: int, denominator: int) -> int:
    """Integer division rounded half up (inputs are non-negative)."""
    return (2 * numerator + denominator) // (2 * denominator)


def _downstream(fx: Dict[str, Any], start: str, max_depth: int) -> List[str]:
    out_edges: Dict[str, List[Dict[str, Any]]] = {}
    for e in fx["supply_graph"]["edges"]:
        if e["type"] == "SUPPLIES":
            out_edges.setdefault(e["source"], []).append(e)
    seen, frontier = {start}, [start]
    for _ in range(max_depth):
        nxt = []
        for n in frontier:
            for e in sorted(out_edges.get(n, []), key=lambda x: x["edge_id"]):
                if e["target"] not in seen:
                    seen.add(e["target"])
                    nxt.append(e["target"])
        frontier = nxt
    return sorted(seen - {start})


def _exposure(
    fx: Dict[str, Any], subject_type: str, subject_id: str, max_depth: int
) -> Dict[str, Any]:
    nodes = {item["node_id"]: item for item in fx["supply_graph"]["nodes"]}
    suppliers = {item["supplier_id"]: item for item in fx["master_data"]["suppliers"]}
    pos = fx["orders"]["purchase_orders"]
    shipments = fx["orders"]["shipments"]
    downstream: List[str] = []
    supplier_ids: Set[str] = set()
    shipment_ids: Set[str] = set()
    route_ids: Set[str] = set()

    if subject_type == "node":
        downstream = _downstream(fx, subject_id, max_depth)
        for n in [subject_id] + downstream:
            if n in nodes and nodes[n].get("supplier_id"):
                supplier_ids.add(nodes[n]["supplier_id"])
        po_ids = sorted(p["po_id"] for p in pos if p["supplier_id"] in supplier_ids)
        shipment_ids = {p["shipment_id"] for p in pos if p["po_id"] in po_ids}
    else:
        for sh in shipments:
            if subject_id in [
                sh.get("origin_port_id"),
                sh.get("destination_port_id"),
                *sh.get("transshipment_port_ids", []),
            ]:
                shipment_ids.add(sh["shipment_id"])
        for r in fx["route_options"]["route_options"]:
            if subject_id in [
                r.get("origin_port_id"),
                r.get("destination_port_id"),
                *r.get("transshipment_port_ids", []),
            ]:
                route_ids.add(r["route_option_id"])
        po_ids = sorted({sh["po_id"] for sh in shipments if sh["shipment_id"] in shipment_ids})
        supplier_ids = {p["supplier_id"] for p in pos if p["po_id"] in po_ids}

    order_ids = sorted({peg["order_id"] for p in pos if p["po_id"] in po_ids for peg in p.get("pegging", [])})
    candidates = sorted(
        s
        for s in supplier_ids
        if s in suppliers
        and suppliers[s].get("relationship") in ("approved_alternate", "alternate_candidate")
    )
    return {
        "downstream_node_ids": downstream,
        "po_ids": po_ids,
        "order_ids": order_ids,
        "shipment_ids": sorted(shipment_ids),
        "route_option_ids": sorted(route_ids),
        "affected_candidate_supplier_ids": candidates,
    }


def _ews_summary(
    label: str, score: int, level: str, contributing: List[Dict[str, Any]], exposure: Dict[str, Any]
) -> str:
    head = (
        f"{label}: {level.upper()} (index {score}/100)"
        if level != "none"
        else f"{label}: no alert (index {score}/100)"
    )
    sigs = ", ".join(f"{c['category']} ({c['source_kind']})" for c in contributing)
    text = f"{head} from {len(contributing)} signal(s): {sigs}."
    if exposure["po_ids"] or exposure["order_ids"]:
        text += f" Linked to {len(exposure['po_ids'])} purchase order(s) and {len(exposure['order_ids'])} customer order(s)."
    if exposure["affected_candidate_supplier_ids"]:
        text += f" Also affects candidate supplier(s) {', '.join(exposure['affected_candidate_supplier_ids'])}."
    return text


def compute_early_warnings(
    fx: Dict[str, Any], signals_doc: Dict[str, Any], as_of: Any
) -> Dict[str, Any]:
    """Compute early-warning index per facility and port from external signals.

    Pure, deterministic heuristic. Returns the full EarlyWarningResult structure.
    """
    if isinstance(as_of, dt.datetime):
        as_of_dt = as_of
        as_of_str = as_of.isoformat()
    elif isinstance(as_of, str):
        as_of_str = as_of
        as_of_dt = dt.datetime.fromisoformat(as_of)
    else:
        raise TypeError(f"as_of must be datetime or str, got {type(as_of)}")

    pol = signals_doc["scoring_policy"]
    window = dt.timedelta(hours=pol["window_hours"])
    areas = {item["area_id"]: item for item in signals_doc["areas"]}
    nodes = {item["node_id"]: item for item in fx["supply_graph"]["nodes"]}
    locs = {item["location_id"]: item for item in fx["master_data"]["locations"]}

    included = []
    excluded = []
    for s in sorted(signals_doc["signals"], key=lambda x: x["signal_id"]):
        observed = dt.datetime.fromisoformat(s["observed_at"])
        if observed > as_of_dt:
            excluded.append({"signal_id": s["signal_id"], "reason": "not_yet_observed"})
        elif as_of_dt - observed > window:
            excluded.append({"signal_id": s["signal_id"], "reason": "outside_window"})
        elif any(a not in areas for a in s["area_ids"]):
            excluded.append({"signal_id": s["signal_id"], "reason": "unmapped_area"})
        else:
            included.append(s)

    subjects: Dict[Tuple[str, str], Dict[str, Any]] = {}
    for s in included:
        for a in s["area_ids"]:
            for n in areas[a]["node_ids"]:
                entry = subjects.setdefault(("node", n), {"signals": {}, "areas": set()})
                entry["signals"][s["signal_id"]] = s
                entry["areas"].add(a)
            for loc in areas[a]["location_ids"]:
                entry = subjects.setdefault(("location", loc), {"signals": {}, "areas": set()})
                entry["signals"][s["signal_id"]] = s
                entry["areas"].add(a)

    levels = sorted(pol["levels"], key=lambda x: x["min_score"])
    warnings = []
    evidence: Dict[str, Dict[str, Any]] = {}

    for (stype, sid), entry in subjects.items():
        contributing = []
        raw = 0
        for s in sorted(entry["signals"].values(), key=lambda x: x["signal_id"]):
            pts = pol["severity_points"][s["severity"]]
            pct = pol["source_confidence_pct"][s["source"]["kind"]]
            c = div_half_up(pts * pct, 100)
            raw += c
            contributing.append({
                "signal_id": s["signal_id"],
                "category": s["category"],
                "source_kind": s["source"]["kind"],
                "severity": s["severity"],
                "observed_at": s["observed_at"],
                "severity_points": pts,
                "confidence_pct": pct,
                "contribution": c,
            })
            evidence[f"EVD-{s['signal_id']}"] = {
                "evidence_id": f"EVD-{s['signal_id']}",
                "kind": "source_document",
                "source_ids": [s["source"]["source_id"]],
                "title": s["title"],
                "authority": AUTHORITY_BY_SOURCE_KIND[s["source"]["kind"]],
                "synthetic": s["source"]["synthetic"],
                "locator": {"signal_id": s["signal_id"], "observed_at": s["observed_at"]},
                "excerpt": s["text"][:400],
            }

        if raw == 0:
            continue

        score = min(pol["max_score"], raw)
        level = "none"
        for lv in levels:
            if score >= lv["min_score"]:
                level = lv["level"]

        exposure = _exposure(fx, stype, sid, pol["max_downstream_depth"])
        label = nodes[sid]["label"] if stype == "node" else locs[sid]["name"]
        warnings.append({
            "warning_id": f"EWS-{sid}",
            "subject": {"type": stype, "id": sid},
            "label": label,
            "area_ids": sorted(entry["areas"]),
            "raw_points": raw,
            "score": score,
            "level": level,
            "contributing": contributing,
            "exposure": exposure,
            "evidence_ids": [f"EVD-{c['signal_id']}" for c in contributing],
            "summary": _ews_summary(label, score, level, contributing, exposure),
        })

    warnings.sort(key=lambda w: (-w["score"], w["subject"]["type"], w["subject"]["id"]))
    return {
        "schema_version": "1.1.0",
        "query": {"as_of": as_of_str, "window_hours": pol["window_hours"]},
        "score_kind": pol["score_kind"],
        "score_note": pol["score_note"],
        "warnings": warnings,
        "excluded_signals": excluded,
        "evidence": [evidence[k] for k in sorted(evidence)],
    }
