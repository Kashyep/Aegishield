from app.agents.dependency.explain import explain_dependency, validate_explanation
from app.agents.dependency.linearize import linearize
from test_dependency import run


def test_templates_grounded(fx):
    for s, must in (("SUP-B", "is not independent"), ("SUP-C", "Shared but undisrupted: Shah Alam ceramic substrates")):
        g, r = run(fx, s)
        ctx = linearize(r, g)
        e = explain_dependency(r, ctx, g, fx["master_data"]["parts"])
        assert e["source"] == "template" and must in e["text"]
        assert not validate_explanation(e, ctx, r)


def test_bad_llm_falls_back(fx):
    g, r = run(fx, "SUP-B")
    ctx = linearize(r, g)
    bad = lambda spec, c: {"text": "SUP-B is independent.", "cited_ids": ["E-999"]}
    assert explain_dependency(r, ctx, g, fx["master_data"]["parts"], llm=bad)["source"] == "template"


def test_needs_review_sentence(fx):
    g, r = run(fx, "SUP-B", disrupted=[])
    e = explain_dependency(r, linearize(r, g), g, fx["master_data"]["parts"])
    assert "disrupted site could not be identified" in e["text"]
