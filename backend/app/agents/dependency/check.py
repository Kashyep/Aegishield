"""MOD-05 check_dependency (M4-D2). Missing data is never evidence of independence."""
from __future__ import annotations

from .graph import SupplyGraph

SCHEMA_VERSION = "1.0.0"
DEFAULT_POLICY = {"max_depth": 3, "block_requires_all_path_edges_verified": True,
                  "missing_critical_input_outcome": "needs_review",
                  "truncated_traversal_outcome": "needs_review"}


def bom_closure(part_id: str, parts: list[dict]) -> set[str]:
    by_id = {p["part_id"]: p for p in parts}
    out, stack = set(), [part_id]
    while stack:
        p = stack.pop()
        if p in out:
            continue
        out.add(p)
        stack.extend(c["child_part_id"] for c in by_id[p]["bom"])
    return out


def upstream_paths(graph: SupplyGraph, start: str, relevant: set[str], max_depth: int):
    """DFS over incoming edges. Returns ([(node_ids, edges, status)], flags)."""
    paths, flags = [], {"cycle": False, "truncated": False, "gaps": []}

    def dfs(node, depth, pnodes, pedges):
        ins = [e for e in graph.incoming(node) if e["part_id"] in relevant]
        acyclic_ins = []
        for e in ins:
            if e["source"] in pnodes:
                flags["cycle"] = True
            else:
                acyclic_ins.append(e)
        if not acyclic_ins:
            if pedges:
                supplied = pedges[-1]["part_id"]
                if supplied not in graph.nodes[node]["origin_for_part_ids"]:
                    flags["gaps"].append({"kind": "upstream_unknown", "node_id": node, "part_id": supplied})
                paths.append((pnodes, pedges, "complete"))
            return
        if depth == max_depth:
            flags["truncated"] = True
            paths.append((pnodes, pedges, "truncated"))
            return
        for e in acyclic_ins:
            dfs(e["source"], depth + 1, pnodes + [e["source"]], pedges + [e])

    dfs(start, 0, [start], [])
    return paths, flags


def node_label(graph: SupplyGraph, nid: str, disrupted: set[str]) -> str:
    n = graph.nodes[nid]
    tag = " [DISRUPTED]" if nid in disrupted else ""
    return f"({n['label']} | {n['org_name']} | {n['country']} | {nid}){tag}"


def part_short_name(parts_by_id: dict, part_id: str) -> str:
    return parts_by_id[part_id]["name"].split(" (")[0]


def linearize_path(graph: SupplyGraph, parts_by_id: dict, pnodes, pedges, disrupted: set[str]) -> str:
    text = node_label(graph, pnodes[0], disrupted)
    for i, e in enumerate(pedges):
        text += (f" <-SUPPLIES[{part_short_name(parts_by_id, e['part_id'])}; {e['edge_id']}; "
                 f"{e['source_ref']}; {e['confidence']}]- " + node_label(graph, pnodes[i + 1], disrupted))
    return text


def check_dependency(q: dict, graph: SupplyGraph, parts: list[dict], policy: dict | None = None) -> dict:
    pol = {**DEFAULT_POLICY, **(policy or {})}
    supplier_id, part_id = q["supplier_id"], q["part_id"]
    max_depth = q.get("max_depth") or pol["max_depth"]
    disrupted = set(q["disrupted_node_ids"])
    parts_by_id = {p["part_id"]: p for p in parts}
    start = graph.suppliers[supplier_id]["supplying_facility_id"]
    relevant = bom_closure(part_id, parts)

    raw_paths, flags = upstream_paths(graph, start, relevant, max_depth)
    gaps = list(flags["gaps"])
    start_parts = {e["part_id"] for e in graph.incoming(start)}
    for child in parts_by_id[part_id]["bom"]:
        if child["critical"] and child["child_part_id"] not in start_parts:
            gaps.append({"kind": "missing_critical_input", "node_id": start, "part_id": child["child_part_id"]})

    paths, disrupted_paths, evidence = [], [], []
    for i, (pnodes, pedges, status) in enumerate(raw_paths, start=1):
        hit = next((k for k, n in enumerate(pnodes) if n in disrupted), None)
        if hit is not None:
            pnodes, pedges = pnodes[:hit + 1], pedges[:hit]
        pid = f"PATH-{supplier_id}-{i}"
        kind = "shared_disrupted_dependency" if hit is not None else ("truncated" if status == "truncated" else "clean")
        rec = {"path_id": pid, "kind": kind, "node_ids": pnodes, "edge_ids": [e["edge_id"] for e in pedges],
               "all_edges_verified": all(e["confidence"] == "verified" for e in pedges),
               "linearized": linearize_path(graph, parts_by_id, pnodes, pedges, disrupted)}
        paths.append(rec)
        if hit is not None:
            disrupted_paths.append(rec)
        lab = lambda n: graph.nodes[n]["label"]
        title = (f"Upstream path from {lab(start)} to disrupted {lab(pnodes[-1])}" if hit is not None
                 else f"Upstream path from {lab(start)} to {lab(pnodes[-1])}")
        evidence.append({"evidence_id": f"EVD-{pid}", "kind": "graph_path",
                         "source_ids": sorted({e["source_ref"] for e in pedges}), "title": title,
                         "authority": "internal", "synthetic": True,
                         "locator": {"path_id": pid, "node_ids": pnodes, "edge_ids": rec["edge_ids"]},
                         "excerpt": rec["linearized"]})

    # outcome rules, first match wins (docs/00 10.1)
    if not disrupted or any(d not in graph.nodes for d in disrupted):
        outcome, reason = "needs_review", "DISRUPTED_NODE_UNKNOWN"
    elif disrupted_paths:
        verified = all(p["all_edges_verified"] for p in disrupted_paths)
        if verified or not pol["block_requires_all_path_edges_verified"]:
            outcome, reason = "blocked", "SHARED_DISRUPTED_DEPENDENCY"
        else:
            outcome, reason = "needs_review", "UNVERIFIED_PATH_TO_DISRUPTED_NODE"
    elif gaps:
        outcome, reason = pol["missing_critical_input_outcome"], "INCOMPLETE_DEPENDENCY_DATA"
    elif flags["truncated"]:
        outcome, reason = pol["truncated_traversal_outcome"], "TRAVERSAL_TRUNCATED"
    else:
        outcome, reason = "passed", "NO_PATH_TO_DISRUPTED_NODE"

    upstream = sorted({n for p in paths for n in p["node_ids"][1:]})
    shared, primary = [], graph.primary_supplier()
    if primary and primary["supplier_id"] != supplier_id:
        p_raw, _ = upstream_paths(graph, primary["supplying_facility_id"], relevant, max_depth)
        p_up = {n for pn, _, _ in p_raw for n in pn[1:]}
        shared = sorted(set(upstream) & p_up)
    notes = [{"code": "SHARED_NON_DISRUPTED_DEPENDENCY", "node_id": n,
              "text": f"{graph.nodes[n]['label']} also supplies the primary supplier; not disrupted, recorded as concentration risk."}
             for n in shared if n not in disrupted]
    if flags["cycle"]:
        notes.append({"code": "CYCLE_DETECTED", "node_id": None, "text": "A cycle was detected and skipped during traversal."})

    return {"schema_version": SCHEMA_VERSION, "supplier_id": supplier_id, "part_id": part_id,
            "start_node_id": start, "max_depth": max_depth, "disrupted_node_ids": sorted(disrupted),
            "outcome": outcome, "reason_code": reason, "paths": paths, "upstream_node_ids": upstream,
            "shared_with_primary_node_ids": shared, "coverage": {"complete": not gaps, "gaps": gaps},
            "truncated": flags["truncated"], "cycle_detected": flags["cycle"], "notes": notes, "evidence": evidence}
