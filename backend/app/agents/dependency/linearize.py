"""aegis-path-v1 linearisation (M4-D3). The only graph material the LLM sees."""
from __future__ import annotations

from .graph import SupplyGraph


def linearize(result: dict, graph: SupplyGraph) -> dict:
    r = result
    lines = [
        f"QUERY supplier={r['supplier_id']} part={r['part_id']} max_depth={r['max_depth']} "
        f"disrupted={','.join(r['disrupted_node_ids'])}",
        f"RESULT outcome={r['outcome']} reason={r['reason_code']} "
        f"coverage_complete={str(r['coverage']['complete']).lower()} truncated={str(r['truncated']).lower()}",
    ]
    lines += [f"PATH {p['path_id']} [{p['kind']}] {p['linearized']}" for p in r["paths"]]
    lines += [f"NOTE {n['code']} {n['node_id'] or ''}".rstrip() for n in r["notes"]]
    triples = []
    for eid in sorted({e for p in r["paths"] for e in p["edge_ids"]}):
        e = graph.edges[eid]
        triples.append({"s": e["source"], "p": f"SUPPLIES:{e['part_id']}", "o": e["target"],
                        "edge_id": eid, "confidence": e["confidence"]})
    return {"schema_version": "1.0.0", "context_id": f"CTX-DEP-{r['supplier_id']}", "format": "aegis-path-v1",
            "subject_id": r["supplier_id"], "lines": lines, "triples": triples,
            "allowed_citation_ids": sorted([p["path_id"] for p in r["paths"]] + [t["edge_id"] for t in triples]),
            "truncated": False}
