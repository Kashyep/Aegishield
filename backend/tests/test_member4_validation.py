"""Production-service checks for Member 4's deterministic compliance and money cases."""
from __future__ import annotations

import json

import pytest

from app.services.evaluation import (
    evaluate,
    fta_findings,
    lc_route_findings,
    rule_query_for,
    duty_at_risk,
)
from app.services.rules import query_rule_applicability
from conftest import ROOT, apply_patches, load_fx


CASES = json.loads((ROOT / "fixtures/validation/cases.json").read_text(encoding="utf-8"))["cases"]
M4_CASES = {case["case_id"]: case for case in CASES if case.get("owner") == "member_4"}


def _patched(case_id: str) -> tuple[dict, dict]:
    case = M4_CASES[case_id]
    return apply_patches(load_fx(), case["patches"]), case


def _index(items: list[dict], key: str) -> dict[str, dict]:
    return {item[key]: item for item in items}


@pytest.mark.parametrize("case_id", ["VC-LC-01", "VC-LC-02", "VC-LC-03", "VC-LC-04", "VC-LC-06", "VC-LC-07"])
def test_lc_validation_cases(case_id: str) -> None:
    fx, case = _patched(case_id)
    lc = _index(fx["letters_of_credit"]["letters_of_credit"], "lc_id")[case["input"]["lc_id"]]
    route = _index(fx["route_options"]["route_options"], "route_option_id")[case["input"]["route_option_id"]]
    locations = _index(fx["master_data"]["locations"], "location_id")

    findings, _evidence = lc_route_findings(lc, route, locations)
    actual = {finding["check_code"]: finding["outcome"] for finding in findings}
    for check_code, expected in case["expected"]["check_outcomes"].items():
        assert actual[check_code] == expected, case_id


@pytest.mark.parametrize("case_id", [f"VC-FTA-{n:02d}" for n in range(1, 4)])
def test_fta_validation_cases(case_id: str) -> None:
    fx, case = _patched(case_id)
    quote = _index(fx["supplier_quotes"]["quotes"], "quote_id")[case["input"]["quote_id"]]
    route = _index(fx["route_options"]["route_options"], "route_option_id")[case["input"]["route_option_id"]]
    rules = query_rule_applicability(fx, rule_query_for(fx, quote, route))

    findings, _evidence = fta_findings(fx, quote, route, rules)
    actual = {finding["check_code"]: finding["outcome"] for finding in findings}
    for check_code, expected in case["expected"]["check_outcomes"].items():
        assert actual[check_code] == expected, case_id

    if "duty_at_risk_inr" in case["expected"]:
        amount, _rates = duty_at_risk(quote, route, case["input"]["qty"], rules)
        assert amount == case["expected"]["duty_at_risk_inr"]


@pytest.mark.parametrize("case_id", [f"VC-FIN-{n:02d}" for n in range(1, 4)] + ["VC-LC-05"])
def test_financial_validation_cases(case_id: str) -> None:
    fx, case = _patched(case_id)
    result = evaluate(fx, "DIS-2026-0042", "EVAL-0001", ("PLN-0001", "PLN-0002"))
    expected = case["expected"]
    plans = {plan["plan_id"]: plan for plan in result["plans"]}

    if "baseline_loss_inr" in expected:
        assert plans["PLN-0001"]["financials"]["baseline_loss_inr"] == expected["baseline_loss_inr"]

    for plan_id, values in expected.get("plan_financials", {}).items():
        plan = plans[plan_id]
        assert plan["outcome"] == expected.get("plan_outcomes", {}).get(plan_id, plan["outcome"])
        for field, amount in values.items():
            assert plan["financials"][field] == amount, (case_id, plan_id, field)

    for plan_id, values in expected.get("exposure_amounts", {}).items():
        actual = {item["exposure_id"]: item["amount_inr"] for item in plans[plan_id]["financials"]["exposures"]}
        assert {key: actual[key] for key in values} == values

    for plan_id, quantities in expected.get("plan_option_qty", {}).items():
        actual: dict[str, int] = {}
        for line in plans[plan_id]["lines"]:
            actual[line["option_id"]] = actual.get(line["option_id"], 0) + line["qty"]
        assert {key: actual.get(key, 0) for key in quantities} == quantities
