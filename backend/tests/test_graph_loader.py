import copy

import pytest

from app.agents.dependency.graph import GraphValidationError, build_graph, load_graph
from conftest import DEMO, load_fx


def test_loads_demo():
    g = load_graph(DEMO / "supply_graph.json")
    assert len(g.nodes) == 10 and len(g.edges) == 9
    assert [e["edge_id"] for e in g.incoming("FAC-B-CHB")] == ["E-004", "E-006"]
    assert list(g.nx.nodes) == sorted(g.nx.nodes)


def _mutate(fn):
    fx = load_fx()
    fn(fx)
    return build_graph(fx["supply_graph"], fx["master_data"])


@pytest.mark.parametrize("fn,msg", [
    (lambda f: f["supply_graph"]["nodes"].append(copy.deepcopy(f["supply_graph"]["nodes"][0])), "duplicate node id"),
    (lambda f: f["supply_graph"]["edges"].append(copy.deepcopy(f["supply_graph"]["edges"][0])), "duplicate edge id"),
    (lambda f: f["supply_graph"]["edges"][0].update(source="FAC-NOPE"), "is not a node"),
    (lambda f: f["supply_graph"]["edges"][0].update(part_id="PRT-NOPE"), "not in master data"),
    (lambda f: f["supply_graph"]["edges"][0].update(source_ref="SRC-NOPE"), "not in supply_graph.sources"),
    (lambda f: f["supply_graph"]["edges"][0].update(source="FAC-KAV-BLR", target="FAC-KAV-BLR"), "self-loop"),
    (lambda f: f["supply_graph"]["edges"][0].update(confidence="maybe"), "confidence"),
    (lambda f: f["master_data"]["suppliers"][0].update(supplying_facility_id="FAC-NOPE"), "supplying_facility_id"),
])
def test_rejects(fn, msg):
    with pytest.raises(GraphValidationError, match=msg):
        _mutate(fn)
