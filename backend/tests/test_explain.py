import httpx

from app.agents.dependency.explain import explain_dependency, validate_explanation
from app.agents.dependency.linearize import linearize
from app.llm.gateway import LLMGateway
from test_dependency import run


def _live(output):
    """Gateway in live mode answering with a fixed model output."""
    import json

    def handler(request):
        return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(output)}}]})
    return LLMGateway(mode="live", base_url="http://model.test/v1", model="test-model",
                      transport=httpx.MockTransport(handler), capture_dir=None)


def test_templates_grounded(fx):
    for s, must in (("SUP-B", "is not independent"), ("SUP-C", "Shared but undisrupted: Shah Alam ceramic substrates")):
        g, r = run(fx, s)
        ctx = linearize(r, g)
        e = explain_dependency(r, ctx, g, fx["master_data"]["parts"])
        assert e["mode"] == "template" and must in e["text"]
        assert not validate_explanation(e, ctx, r)


def test_bad_llm_falls_back(fx):
    g, r = run(fx, "SUP-B")
    ctx = linearize(r, g)
    e = explain_dependency(r, ctx, g, fx["master_data"]["parts"],
                           gateway=_live({"text": "SUP-B is independent.", "cited_ids": ["E-999"]}))
    assert e["mode"] == "template" and not e["validation"]["passed"]
    assert set(e["validation"]["errors"]) == {"UNKNOWN_CITATION", "OUTCOME_CONTRADICTION"}


def test_good_llm_accepted(fx):
    g, r = run(fx, "SUP-B")
    ctx = linearize(r, g)
    out = {"text": "Chao Phraya is not independent: its dies come via Kedah from the disrupted Zenith fab (PATH-SUP-B-1).",
           "cited_ids": ["PATH-SUP-B-1", "E-004", "E-005"]}
    e = explain_dependency(r, ctx, g, fx["master_data"]["parts"], gateway=_live(out))
    assert e["mode"] == "live" and e["text"] == out["text"] and e["validation"]["passed"]


def test_needs_review_sentence(fx):
    g, r = run(fx, "SUP-B", disrupted=[])
    e = explain_dependency(r, linearize(r, g), g, fx["master_data"]["parts"])
    assert "disrupted site could not be identified" in e["text"]
