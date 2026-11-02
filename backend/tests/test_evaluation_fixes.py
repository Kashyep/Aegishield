"""Tests for Phase B evaluation fixes (Item B3 / F-28, F-29).

Covers:
- B3 (F-28): worst([]) raises ValueError and never returns 'passed'.
- B3 (F-28): Missing MFN rate produces explicit unquantified exposure without TypeError.
- B3 (F-29): FTA RULE_APPLICABILITY finding carries >= 1 evidence id (common.schema.json minItems: 1).
"""
import copy
import json
from pathlib import Path
import pytest
from jsonschema import Draft202012Validator
from referencing import Registry, Resource

from conftest import ROOT, load_fx
from backend.app.services.evaluation import (
    assess_disruption,
    duty_at_risk,
    financials,
    fta_findings,
    worst,
)


def test_worst_empty_or_non_applicable_raises_value_error():
    """B3 (F-28): worst([]) and worst with only non-applicable outcomes must raise ValueError and never return 'passed'."""
    with pytest.raises(ValueError, match="empty sequence or contains no applicable outcomes"):
        worst([])

    with pytest.raises(ValueError, match="empty sequence or contains no applicable outcomes"):
        worst(["not_applicable"])

    with pytest.raises(ValueError, match="empty sequence or contains no applicable outcomes"):
        worst(["not_applicable", "not_applicable"])

    assert worst(["passed"]) == "passed"
    assert worst(["passed", "needs_review"]) == "needs_review"
    assert worst(["passed", "blocked"]) == "blocked"
    assert worst(["needs_review", "blocked"]) == "blocked"
    assert worst(["not_applicable", "passed"]) == "passed"
    assert worst(["blocked", "not_applicable", "needs_review"]) == "blocked"


def test_missing_mfn_rate_produces_unquantified_exposure_without_type_error():
    """B3 (F-28): Missing MFN rate produces explicit unquantified exposure without TypeError."""
    fx = load_fx()
    quote = fx["supplier_quotes"]["quotes"][0]
    route = fx["route_options"]["route_options"][0]

    rq_no_mfn = {
        "applicable": [
            {
                "rule_type": "tariff_preferential",
                "structured": {"rate_bps": 200},
            }
        ]
    }
    amt, rates = duty_at_risk(quote, route, 100, rq_no_mfn)
    assert amt is None
    assert rates is None

    rq_empty = {"applicable": []}
    amt, rates = duty_at_risk(quote, route, 100, rq_empty)
    assert amt is None
    assert rates is None

    assessment = assess_disruption(fx, "DIS-2026-0042")
    opt_id = f"OPT-{route['route_option_id']}"
    line = {
        "line_id": "LIN-0001",
        "option_id": opt_id,
        "order_id": "ORD-0001",
        "qty": 100,
        "days_late": 0,
    }
    options_by_id = {
        opt_id: {
            "option_id": opt_id,
            "kind": "supplier",
            "quote_id": quote["quote_id"],
            "route_option_id": route["route_option_id"],
            "finding_ids": [f"FND-FTA-DIRECT_CONSIGNMENT-{route['route_option_id']}"],
            "cost_components_per_unit": {},
        }
    }
    findings = {
        f"FND-FTA-DIRECT_CONSIGNMENT-{route['route_option_id']}": {
            "finding_id": f"FND-FTA-DIRECT_CONSIGNMENT-{route['route_option_id']}",
            "check_code": "FTA.DIRECT_CONSIGNMENT",
            "outcome": "needs_review",
            "agent": "trade_compliance",
        }
    }
    rule_results = {route["route_option_id"]: rq_no_mfn}

    fin = financials(
        fx=fx,
        assessment=assessment,
        lines=[line],
        options_by_id=options_by_id,
        findings_by_id=findings,
        rule_results=rule_results,
    )

    exposures = fin["exposures"]
    fta_exposures = [e for e in exposures if e["exposure_id"] == "EXP-FTA-LIN-0001"]
    assert len(fta_exposures) == 1
    exp = fta_exposures[0]
    assert exp["amount_inr"] is None
    assert exp["basis"] == "Not quantified: MFN tariff rate unavailable"


def test_fta_rule_applicability_finding_carries_at_least_one_evidence_id():
    """B3 (F-29): FTA RULE_APPLICABILITY finding carries >= 1 evidence id, satisfying common.schema.json minItems: 1."""
    fx = load_fx()
    quote = fx["supplier_quotes"]["quotes"][0]
    route = fx["route_options"]["route_options"][0]

    rq_unresolved_no_applicable = {
        "outcome": "unresolved",
        "applicable": [],
        "missing_rule_types": ["origin_consignment", "tariff_mfn"],
        "conflicts": [],
    }

    out, evid = fta_findings(fx, quote, route, rq_unresolved_no_applicable)
    assert len(out) == 1
    f = out[0]
    assert f["check_code"] == "FTA.RULE_APPLICABILITY"
    assert len(f["evidence_ids"]) >= 1
    assert f["evidence_ids"] == [f"EVD-ROUTE-{route['route_option_id']}"]
    assert f["evidence_ids"][0] in evid

    reg = Registry()
    for p in (ROOT / "contracts/schemas").glob("*.json"):
        reg = reg.with_resource(p.name, Resource.from_contents(json.loads(p.read_text(encoding="utf-8"))))
    validator = Draft202012Validator({"$ref": "common.schema.json#/$defs/Finding"}, registry=reg)
    validator.validate(f)
