from test_dependency import run
from test_graph_endpoint import _validator  # noqa: F401
import json
from jsonschema import Draft202012Validator
from referencing import Registry, Resource

from app.agents.dependency.linearize import linearize
from app.agents.sensing import assess_disruption
from conftest import ROOT


def _v(ref):
    reg = Registry()
    for p in (ROOT / "contracts/schemas").glob("*.json"):
        reg = reg.with_resource(p.name, Resource.from_contents(json.loads(p.read_text(encoding="utf-8"))))
    return Draft202012Validator({"$ref": ref}, registry=reg)


def test_outputs_validate(fx):
    for s in ("SUP-B", "SUP-C"):
        g, r = run(fx, s)
        _v("graph.schema.json#/$defs/DependencyResult").validate(r)
        _v("graph.schema.json#/$defs/LinearizedContext").validate(linearize(r, g))
    _v("disruption.schema.json#/$defs/DisruptionAssessment").validate(assess_disruption(fx["disruptions"]["events"][0], fx))
