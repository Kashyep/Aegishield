"""MOD-04 Disruption Sensing Agent (M4-D5)."""
from __future__ import annotations

import datetime as dt
from typing import Callable

_FIELDS = ("event_type", "root_cause", "affected_shipment_ids", "affected_po_ids", "delay_days", "new_etd",
           "force_majeure_invoked")


def _add(day: str, n: int) -> str:
    return (dt.date.fromisoformat(day) + dt.timedelta(days=n)).isoformat()


def _late(arrival: str, need_by: str) -> int:
    return max(0, (dt.date.fromisoformat(arrival) - dt.date.fromisoformat(need_by)).days)


def resolve_alias(nodes: list[dict], alias: str) -> str | None:
    """Exact, case-insensitive match; exactly one node must match."""
    a = alias.strip().lower()
    hits = [n["node_id"] for n in nodes if a in (x.lower() for x in n["aliases"])]
    return hits[0] if len(hits) == 1 else None


def severity_for(policy: dict, baseline: int, max_late: int) -> str:
    if baseline >= policy["critical_if_baseline_loss_inr_gte"]:
        return "critical"
    if baseline >= policy["high_if_baseline_loss_inr_gte"] or max_late >= policy["high_if_any_order_days_late_gte"]:
        return "high"
    if baseline >= policy["medium_if_baseline_loss_inr_gte"]:
        return "medium"
    return "low"


def _fmt(day: str) -> str:
    return dt.date.fromisoformat(day).strftime("%d %b %Y")


def assess_disruption(event: dict, ctx: dict, mode: str = "gold",
                      extractor: Callable[[str], dict] | None = None) -> dict:
    """ctx: loaded fixtures {supply_graph, orders, master_data, policies}.

    gold -> event['gold_extraction']; recorded/live -> extractor(raw_text) (supplied by MOD-12).
    If gold exists and the extraction differs -> EXTRACTION_MISMATCH, needs_review.
    """
    gold = event.get("gold_extraction")
    issues: list[str] = []
    if mode == "gold":
        if gold is None:
            raise ValueError("gold mode requires gold_extraction")
        ext = gold
    else:
        try:
            ext = extractor(event["raw_text"]) if extractor else None
        except Exception:
            ext = None
        if ext is None:
            ext, gold = gold, None
            issues.append("EXTRACTION_MISMATCH")  # unusable extraction can never pass
            if ext is None:
                raise ValueError("no extraction available")
        elif gold is not None and any(ext.get(f) != gold.get(f) for f in _FIELDS):
            issues.append("EXTRACTION_MISMATCH")

    orders = {o["order_id"]: o for o in ctx["orders"]["customer_orders"]}
    pos = {p["po_id"]: p for p in ctx["orders"]["purchase_orders"]}
    shipments = {s["shipment_id"]: s for s in ctx["orders"]["shipments"]}
    locations = {l["location_id"]: l for l in ctx["master_data"]["locations"]}

    node_id = resolve_alias(ctx["supply_graph"]["nodes"], ext["root_cause"]["facility_alias"])
    if node_id is None:
        issues.append("ROOT_CAUSE_ALIAS_UNRESOLVED")

    ship_out, orders_out, baseline = [], [], 0
    for sid in ext["affected_shipment_ids"]:
        shp = shipments.get(sid)
        if shp is None:
            issues.append("UNKNOWN_SHIPMENT")
            continue
        delay = ext["delay_days"]
        revised_etd = _add(shp["planned_etd"], delay)
        if revised_etd != ext["new_etd"]:
            issues.append("NEW_ETD_INCONSISTENT_WITH_DELAY")
        revised_plant = _add(shp["planned_eta_plant"], delay)
        ship_out.append({"shipment_id": sid, "po_id": shp["po_id"], "planned_etd": shp["planned_etd"],
                         "revised_etd": revised_etd, "planned_eta_plant": shp["planned_eta_plant"],
                         "revised_eta_plant": revised_plant, "delay_days": delay})
        for peg in pos[shp["po_id"]]["pegging"]:
            o = orders[peg["order_id"]]
            late = _late(revised_plant, o["component_need_by"])
            if late == 0:
                continue
            pen = peg["qty"] * o["penalty"]["rate_inr_per_unit_per_day"] * min(late, o["penalty"]["cap_days"])
            baseline += pen
            orders_out.append({"order_id": o["order_id"], "customer_id": o["customer_id"], "qty_affected": peg["qty"],
                               "order_value_inr": o["order_value_inr"], "need_by": o["component_need_by"],
                               "revised_arrival": revised_plant, "days_late": late, "baseline_penalty_inr": pen})

    issues = list(dict.fromkeys(issues))
    max_late = max((o["days_late"] for o in orders_out), default=0)
    supplier_ids = sorted({pos[s["po_id"]]["supplier_id"] for s in ship_out})
    src = event["source"]
    first = ship_out[0] if ship_out else None
    excerpt = (f"Shipment {first['shipment_id']} will depart "
               f"{locations[shipments[first['shipment_id']]['origin_port_id']]['name']} on {_fmt(first['revised_etd'])} "
               f"instead of {_fmt(first['planned_etd'])}.") if first else ""
    return {
        "schema_version": "1.0.0", "assessment_id": f"DA-{event['disruption_id']}",
        "disruption_id": event["disruption_id"], "outcome": "needs_review" if issues else "passed",
        "issues": issues, "extraction_mode": mode, "event_type": ext["event_type"],
        "severity": severity_for(ctx["policies"]["severity_policy"], baseline, max_late),
        "severity_basis": f"baseline_loss_inr={baseline}; max_days_late={max_late}",
        "disrupted_node_ids": [node_id] if node_id else [], "affected_supplier_ids": supplier_ids,
        "affected_shipments": ship_out, "affected_orders": orders_out, "baseline_loss_inr": baseline,
        "evidence": [{"evidence_id": f"EVD-NOTICE-{event['disruption_id']}", "kind": "source_document",
                      "source_ids": [src["source_id"]], "title": src["title"], "authority": src["authority"],
                      "synthetic": True, "locator": {"record_id": event["disruption_id"]}, "excerpt": excerpt}],
    }
