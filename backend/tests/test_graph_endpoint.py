import json

from fastapi import FastAPI
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator
from referencing import Registry, Resource

from app.api.evaluations import graph_router
from app.agents.dependency.graph import build_graph
from conftest import ROOT, golden


def _validator():
    reg = Registry()
    for p in (ROOT / "contracts/schemas").glob("*.json"):
        reg = reg.with_resource(p.name, Resource.from_contents(json.loads(p.read_text(encoding="utf-8"))))
    schema = {"$ref": "graph.schema.json#/$defs/GraphView"}
    return Draft202012Validator(schema, registry=reg)


def test_endpoint(fx):
    ev = golden("evaluation_EVAL-0001.json")
    g = build_graph(fx["supply_graph"], fx["master_data"])
    evals = {"EVAL-0001": ev, "EVAL-0002": {**ev, "evaluation_id": "EVAL-0002", "status": "running"}}
    app = FastAPI()
    app.include_router(graph_router(evals.get, lambda: g))
    c = TestClient(app)
    r = c.get("/api/v1/evaluations/EVAL-0001/graph", params={"focus_supplier_id": "SUP-B"})
    assert r.status_code == 200 and r.json() == golden("graph_view_SUP-B.json")
    _validator().validate(r.json())
    assert c.get("/api/v1/evaluations/EVAL-9999/graph", params={"focus_supplier_id": "SUP-B"}).status_code == 404
    r = c.get("/api/v1/evaluations/EVAL-0002/graph", params={"focus_supplier_id": "SUP-B"})
    assert r.status_code == 409 and r.json()["code"] == "EVALUATION_NOT_COMPLETE"
    assert c.get("/api/v1/evaluations/EVAL-0001/graph", params={"focus_supplier_id": "SUP-Z"}).status_code == 404
