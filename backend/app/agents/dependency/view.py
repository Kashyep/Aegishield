"""GraphView builder for the Cytoscape payload (M4-D3)."""
from __future__ import annotations

from .graph import SupplyGraph

STATUS_FROM_OUTCOME = {"blocked": "blocked", "needs_review": "needs_review", "passed": "candidate_passed"}


def build_graph_view(results: list[dict], graph: SupplyGraph, focus_supplier_id: str, evaluation_id: str) -> dict:
    primary = graph.primary_supplier()
    buyer_ids = sorted(n for n, d in graph.nodes.items() if d["role"] == "buyer_plant")
    disrupted = set(results[0]["disrupted_node_ids"]) if results else set()
    outcome_by_supplier = {r["supplier_id"]: r["outcome"] for r in results}

    keep = set(buyer_ids)
    if primary:
        keep.add(primary["supplying_facility_id"])
    for r in results:
        keep.add(r["start_node_id"])
        keep.update(r["upstream_node_ids"])

    nodes = []
    for nid in sorted(keep):
        n = graph.nodes[nid]
        if nid in disrupted:
            st = "disrupted"
        elif n["supplier_id"] in outcome_by_supplier:
            st = STATUS_FROM_OUTCOME[outcome_by_supplier[n["supplier_id"]]]
        elif n["role"] == "buyer_plant":
            st = "buyer"
        elif primary and nid == primary["supplying_facility_id"]:
            st = "affected_primary"
        else:
            st = "normal"
        nodes.append({"id": nid, "label": n["label"], "org_name": n["org_name"], "country": n["country"],
                      "role": n["role"], "status": st, "synthetic": True})

    focus = [r for r in results if r["supplier_id"] == focus_supplier_id]
    paths = [{"path_id": p["path_id"], "kind": p["kind"], "node_ids": p["node_ids"], "edge_ids": p["edge_ids"]}
             for r in focus for p in r["paths"]]
    highlighted = {e for r in focus for p in r["paths"] if p["kind"] == "shared_disrupted_dependency" for e in p["edge_ids"]}

    edges = {}
    for eid, e in graph.edges.items():
        if e["source"] in keep and e["target"] in keep:
            edges[eid] = {"id": eid, "source": e["source"], "target": e["target"], "type": "SUPPLIES",
                          "part_id": e["part_id"], "confidence": e["confidence"], "source_ref": e["source_ref"],
                          "highlighted": eid in highlighted, "candidate": False}
    buyer = buyer_ids[0] if buyer_ids else None
    for r in results:
        cid = f"CAND-{r['supplier_id']}"
        edges[cid] = {"id": cid, "source": r["start_node_id"], "target": buyer, "type": "CANDIDATE_SUPPLY",
                      "part_id": r["part_id"], "confidence": None, "source_ref": None,
                      "highlighted": False, "candidate": True}
    return {"schema_version": "1.0.0", "view_id": f"GV-{evaluation_id}-{focus_supplier_id}",
            "evaluation_id": evaluation_id, "focus_supplier_id": focus_supplier_id,
            "edge_direction": "provider_to_consumer", "nodes": nodes,
            "edges": [edges[k] for k in sorted(edges)], "paths": paths,
            "text_alternative": [p["linearized"] for r in focus for p in r["paths"]]}
