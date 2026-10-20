from app.agents.routing import eligible_routes
from app.agents.sensing import assess_disruption
from conftest import golden


def test_assessment_golden(fx):
    assert assess_disruption(fx["disruptions"]["events"][0], fx, "gold") == golden("disruption_assessment.json")


def test_mismatch_and_consistency(fx):
    ev = fx["disruptions"]["events"][0]
    bad = dict(ev["gold_extraction"], delay_days=5)
    a = assess_disruption(ev, fx, "recorded", extractor=lambda t: bad)
    assert a["outcome"] == "needs_review"
    assert "EXTRACTION_MISMATCH" in a["issues"] and "NEW_ETD_INCONSISTENT_WITH_DELAY" in a["issues"]
    ok = assess_disruption(ev, fx, "recorded", extractor=lambda t: ev["gold_extraction"])
    assert ok["outcome"] == "passed" and ok["extraction_mode"] == "recorded"
    unk = dict(ev["gold_extraction"], affected_shipment_ids=["SHP-NOPE"])
    assert "UNKNOWN_SHIPMENT" in assess_disruption(ev, fx, "recorded", extractor=lambda t: unk)["issues"]


def test_routes(fx):
    routes = fx["route_options"]["route_options"]
    q = {q["quote_id"]: q for q in fx["supplier_quotes"]["quotes"]}
    assert [r["route_option_id"] for r in eligible_routes(q["QT-B-01"], routes)] == ["RT-B-CMB", "RT-B-DIR"]
    assert [r["route_option_id"] for r in eligible_routes(q["QT-C-01"], routes)] == ["RT-C-DIR", "RT-C-SIN"]
