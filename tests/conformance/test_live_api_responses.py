import json
from pathlib import Path

import yaml
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012

from backend.app.main import app

ROOT = Path(__file__).resolve().parents[2]
CONTRACTS = ROOT / "contracts"
OPENAPI_PATH = CONTRACTS / "openapi.yaml"
OPENAPI = yaml.safe_load(OPENAPI_PATH.read_text(encoding="utf-8"))


def contract_registry():
    resources = [(OPENAPI_PATH.resolve().as_uri(), Resource.from_contents(OPENAPI, default_specification=DRAFT202012))]
    for path in (CONTRACTS / "schemas").glob("*.schema.json"):
        resources.append(
            (path.resolve().as_uri(), Resource.from_contents(json.loads(path.read_text(encoding="utf-8")), default_specification=DRAFT202012))
        )
    return Registry().with_resources(resources).with_resource("urn:openapi", Resource.from_contents(OPENAPI, default_specification=DRAFT202012))


def operation(operation_id):
    return next(
        item
        for path_item in OPENAPI["paths"].values()
        for item in path_item.values()
        if isinstance(item, dict) and item.get("operationId") == operation_id
    )


def assert_response_schema(operation_id, response):
    op = operation(operation_id)
    response_spec = op["responses"][str(response.status_code)]
    while "$ref" in response_spec and response_spec["$ref"].startswith("#/"):
        pointer = response_spec["$ref"][2:].split("/")
        response_spec = OPENAPI
        for part in pointer:
            response_spec = response_spec[part]
    media_type = "application/problem+json" if response.headers.get("content-type", "").startswith("application/problem+json") else "application/json"
    schema = response_spec["content"][media_type]["schema"]
    if schema.get("$ref", "").startswith("#/"):
        target = OPENAPI
        for part in schema["$ref"][2:].split("/"):
            target = target[part]
        schema = target
    registry = contract_registry()
    schema = {"$id": OPENAPI_PATH.resolve().as_uri(), **schema}
    errors = list(Draft202012Validator(schema, registry=registry, format_checker=Draft202012Validator.FORMAT_CHECKER).iter_errors(response.json()))
    assert not errors, f"{operation_id} {response.status_code}: {errors}"


def test_success_and_problem_responses_match_openapi():
    with TestClient(app) as client:
        h = {"X-Actor-Id": "USR-PRIYA"}
        k = {**h, "Idempotency-Key": "conformance-eval-01"}
        reset = client.post("/api/v1/demo/reset", headers=h)
        assert_response_schema("resetDemo", reset)
        missing_actor = client.post("/api/v1/demo/reset")
        assert missing_actor.status_code == 403
        assert_response_schema("resetDemo", missing_actor)
        assert_response_schema("getHealth", client.get("/api/v1/health"))
        assert_response_schema("getScenario", client.get("/api/v1/scenario"))
        assert_response_schema("listDisruptions", client.get("/api/v1/disruptions"))
        assert_response_schema("getDisruption", client.get("/api/v1/disruptions/DIS-2026-0042"))
        assert_response_schema("getDisruption", client.get("/api/v1/disruptions/unknown"))

        accepted = client.post("/api/v1/evaluations", headers=k, json={"disruption_id": "DIS-2026-0042"})
        assert_response_schema("createEvaluation", accepted)
        assert_response_schema("getEvaluation", client.get(accepted.json()["poll_url"]))
        assert_response_schema("getEvaluation", client.get("/api/v1/evaluations/EVAL-9999"))
        assert_response_schema("getEvaluationGraph", client.get("/api/v1/evaluations/EVAL-0001/graph"))
        assert_response_schema("getEvaluationGraph", client.get("/api/v1/evaluations/EVAL-9999/graph"))
        assert_response_schema("getPlan", client.get("/api/v1/plans/PLN-0001"))
        assert_response_schema("getPlan", client.get("/api/v1/plans/PLN-9999"))

        p1 = client.get("/api/v1/plans/PLN-0001").json()
        blocked = client.post(
            "/api/v1/plans/PLN-0001/decisions",
            headers={**h, "Idempotency-Key": "conformance-blocked"},
            json={"action": "approve", "plan_version": 1, "plan_hash": p1["plan_hash"], "justification": None, "acknowledgements": []},
        )
        assert_response_schema("decidePlan", blocked)
        p2 = client.get("/api/v1/plans/PLN-0002").json()
        decision = client.post(
            "/api/v1/plans/PLN-0002/decisions",
            headers={**h, "Idempotency-Key": "conformance-approve-01"},
            json={"action": "approve", "plan_version": 1, "plan_hash": p2["plan_hash"], "justification": None, "acknowledgements": []},
        )
        assert_response_schema("decidePlan", decision)
        assert_response_schema(
            "executePlan",
            client.post("/api/v1/plans/PLN-0001/executions", headers={**h, "Idempotency-Key": "conformance-exec-no"}, json={"decision_id": "DEC-0001"}),
        )
        execution = client.post(
            "/api/v1/plans/PLN-0002/executions",
            headers={**h, "Idempotency-Key": "conformance-exec-01"},
            json={"decision_id": decision.json()["decision_id"]},
        )
        assert_response_schema("executePlan", execution)
        assert_response_schema("getExecution", client.get(f"/api/v1/executions/{execution.json()['execution_id']}"))
        assert_response_schema("getExecution", client.get("/api/v1/executions/EXE-9999"))

        amendment = client.post(
            "/api/v1/plans/PLN-0001/decisions",
            headers={"X-Actor-Id": "USR-ARJUN", "Idempotency-Key": "conformance-amend-01"},
            json={
                "action": "request_amendment", "plan_version": 1, "plan_hash": p1["plan_hash"],
                "justification": "Remove the synthetic LC transit restriction.", "acknowledgements": [],
                "amendment": {"lc_id": "LC-SYN-0117", "requested_changes": [
                    {"field_tag": "43T", "from": "NOT ALLOWED", "to": "ALLOWED"},
                    {"field_tag": "47A", "from": "UCP 600 SUB-ARTICLE 20(C) IS EXCLUDED.", "to": "(deleted)"},
                ]},
            },
        )
        assert_response_schema("decidePlan", amendment)
        amd_id = amendment.json()["amendment_request_id"]
        assert_response_schema("getAmendmentRequest", client.get(f"/api/v1/amendment-requests/{amd_id}"))
        assert_response_schema("getAmendmentRequest", client.get("/api/v1/amendment-requests/AMD-9999"))
        assert_response_schema(
            "simulateAmendmentAcceptance",
            client.post(f"/api/v1/demo/amendment-requests/{amd_id}/simulate-acceptance", headers={"X-Actor-Id": "USR-ARJUN", "Idempotency-Key": "conformance-accept-01"}),
        )
        assert_response_schema(
            "simulateAmendmentAcceptance",
            client.post("/api/v1/demo/amendment-requests/AMD-9999/simulate-acceptance", headers={"X-Actor-Id": "USR-ARJUN", "Idempotency-Key": "conformance-accept-404"}),
        )

        rule = client.post("/api/v1/rules/applicability", json={
            "query_id": "RQ-CONFORMANCE", "jurisdiction": "IN", "rule_types": ["tariff_mfn"],
            "hs_code": "HS-SYN-8504.90", "origin_country": "VN", "transit_countries": [],
            "agreement_id": "AIFTA", "applicable_on": "2026-10-31", "known_as_of": "2026-10-26",
        })
        assert_response_schema("queryRuleApplicability", rule)
        assert_response_schema("listAuditEvents", client.get("/api/v1/audit-events?limit=200"))
        assert_response_schema("verifyAuditChain", client.get("/api/v1/audit-events/verify"))

        invalid_body = client.post("/api/v1/evaluations", headers={**h, "Idempotency-Key": "conformance-invalid"}, json={})
        assert invalid_body.status_code == 422
        assert_response_schema("createEvaluation", invalid_body)
