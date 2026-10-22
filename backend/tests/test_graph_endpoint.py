"""M4-D8: GraphView endpoint served by the real app (backend/app/main.py)."""
import json

from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator
from referencing import Registry, Resource

from backend.app.main import app
from backend.app.agents.dependency.graph import build_graph
from backend.app.agents.dependency.view import GraphViewError, graph_view_for_evaluation
from conftest import ROOT, golden

import pytest


def _validator():
    reg = Registry()
    for p in (ROOT / "contracts/schemas").glob("*.json"):
        reg = reg.with_resource(p.name, Resource.from_contents(json.loads(p.read_text(encoding="utf-8"))))
    return Draft202012Validator({"$ref": "graph.schema.json#/$defs/GraphView"}, registry=reg)


def test_view_rules(fx):
    ev = golden("evaluation_EVAL-0001.json")
    g = build_graph(fx["supply_graph"], fx["master_data"])
    assert graph_view_for_evaluation(ev, g, "SUP-B") == golden("graph_view_SUP-B.json")
    for evaluation, sup, status, code in ((None, "SUP-B", 404, "EVALUATION_NOT_FOUND"),
                                          ({**ev, "status": "running"}, "SUP-B", 409, "EVALUATION_NOT_COMPLETE"),
                                          (ev, "SUP-Z", 404, "SUPPLIER_NOT_EVALUATED")):
        with pytest.raises(GraphViewError) as e:
            graph_view_for_evaluation(evaluation, g, sup)
        assert (e.value.status, e.value.code) == (status, code)


def test_endpoint_on_live_app():
    c = TestClient(app)
    c.post("/api/v1/demo/reset", headers={"X-Actor-Id": "USR-PRIYA"})
    c.post("/api/v1/evaluations", headers={"X-Actor-Id": "USR-PRIYA", "Idempotency-Key": "m4-graph-1"},
           json={"disruption_id": "DIS-2026-0042"})
    url = "/api/v1/evaluations/EVAL-0001/graph"
    r = c.get(url, params={"focus_supplier_id": "SUP-B"})
    assert r.status_code == 200 and r.json() == golden("graph_view_SUP-B.json")
    _validator().validate(r.json())
    v = c.get(url, params={"focus_supplier_id": "SUP-C"}).json()
    assert not any(e["highlighted"] for e in v["edges"])
    assert c.get(url, params={"focus_supplier_id": "SUP-Z"}).status_code == 404
    assert c.get("/api/v1/evaluations/EVAL-9999/graph", params={"focus_supplier_id": "SUP-B"}).status_code == 404
    assert c.get(url).json() == golden("graph_view_SUP-B.json")  # M3 keeps SUP-B as default (contract says required)
