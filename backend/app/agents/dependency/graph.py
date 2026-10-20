"""MOD-05 graph ingestion and validation (M4-D1).

Edges are SUPPLIES, provider -> consumer. Validation fails fast with GraphValidationError.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

import networkx as nx

CONFIDENCE = {"verified", "unverified"}


class GraphValidationError(ValueError):
    """Raised when the supply graph violates a load-time rule."""


@dataclass
class SupplyGraph:
    data: dict
    nodes: dict            # node_id -> node dict
    edges: dict            # edge_id -> edge dict
    suppliers: dict        # supplier_id -> supplier dict
    nx: nx.MultiDiGraph = field(repr=False)

    def incoming(self, node_id: str) -> list[dict]:
        """Incoming SUPPLIES edges of a node, sorted by edge_id."""
        return [self.edges[k] for k in sorted(k for _, _, k in self.nx.in_edges(node_id, keys=True))]

    def primary_supplier(self) -> dict | None:
        prim = sorted((s for s in self.suppliers.values() if s.get("relationship") == "primary"),
                      key=lambda s: s["supplier_id"])
        return prim[0] if prim else None


def _dupes(ids: list[str]) -> list[str]:
    seen, out = set(), []
    for i in ids:
        if i in seen:
            out.append(i)
        seen.add(i)
    return out


def build_graph(graph_data: dict, master_data: dict) -> SupplyGraph:
    """Validate and build. `master_data` supplies parts and suppliers."""
    err = []
    nodes_l, edges_l = graph_data.get("nodes", []), graph_data.get("edges", [])
    part_ids = {p["part_id"] for p in master_data.get("parts", [])}
    source_ids = {s["source_id"] for s in graph_data.get("sources", [])}
    suppliers = {s["supplier_id"]: s for s in master_data.get("suppliers", [])}

    for d in _dupes([n["node_id"] for n in nodes_l]):
        err.append(f"duplicate node id {d}")
    for d in _dupes([e["edge_id"] for e in edges_l]):
        err.append(f"duplicate edge id {d}")
    node_ids = {n["node_id"] for n in nodes_l}
    for e in edges_l:
        eid = e["edge_id"]
        for end in ("source", "target"):
            if e[end] not in node_ids:
                err.append(f"edge {eid}: {end} {e[end]} is not a node")
        if e["source"] == e["target"]:
            err.append(f"edge {eid}: self-loop on {e['source']}")
        if e["part_id"] not in part_ids:
            err.append(f"edge {eid}: part_id {e['part_id']} not in master data")
        if e["source_ref"] not in source_ids:
            err.append(f"edge {eid}: source_ref {e['source_ref']} not in supply_graph.sources")
        if e["confidence"] not in CONFIDENCE:
            err.append(f"edge {eid}: confidence {e['confidence']!r} not in {sorted(CONFIDENCE)}")
        if e.get("type") != "SUPPLIES":
            err.append(f"edge {eid}: unsupported type {e.get('type')!r}")
    for s in suppliers.values():
        if s["supplying_facility_id"] not in node_ids:
            err.append(f"supplier {s['supplier_id']}: supplying_facility_id {s['supplying_facility_id']} is not a node")
    if err:
        raise GraphValidationError("; ".join(err))

    g = nx.MultiDiGraph()
    nodes = {n["node_id"]: n for n in sorted(nodes_l, key=lambda n: n["node_id"])}
    edges = {e["edge_id"]: e for e in sorted(edges_l, key=lambda e: e["edge_id"])}
    for nid in nodes:
        g.add_node(nid)
    for eid, e in edges.items():
        g.add_edge(e["source"], e["target"], key=eid, part_id=e["part_id"], confidence=e["confidence"])
    return SupplyGraph(graph_data, nodes, edges, dict(sorted(suppliers.items())), g)


def load_graph(path: str | Path, master_data: dict | str | Path | None = None) -> SupplyGraph:
    """Load supply_graph.json. master_data defaults to the sibling master_data.json."""
    path = Path(path)
    data = json.loads(path.read_text(encoding="utf-8"))
    if master_data is None:
        master_data = path.with_name("master_data.json")
    if not isinstance(master_data, dict):
        master_data = json.loads(Path(master_data).read_text(encoding="utf-8"))
    return build_graph(data, master_data)
