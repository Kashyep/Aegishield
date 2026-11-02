"""API regression coverage for Member 4's non-happy-path approval cases."""
from __future__ import annotations

from copy import deepcopy
import json

import pytest
from fastapi.testclient import TestClient

from backend.app import main
from backend.app.services.fixtures import snapshot_id
from backend.app.services.evaluation import plan_hash_material, sha256_of


@pytest.fixture
def client():
    return TestClient(main.app)


def _evaluate(client, key: str) -> dict:
    response = client.post(
        "/api/v1/evaluations",
        headers={"X-Actor-Id": "USR-PRIYA", "Idempotency-Key": key},
        json={"disruption_id": "DIS-2026-0042"},
    )
    assert response.status_code == 202
    return client.get(response.json()["poll_url"]).json()


def test_apr_06_review_finding_requires_ack_from_permitted_role(client, monkeypatch):
    client.post("/api/v1/demo/reset", headers={"X-Actor-Id": "USR-PRIYA"})
    changed = deepcopy(main.fx)
    quote = next(q for q in changed["supplier_quotes"]["quotes"] if q["quote_id"] == "QT-C-01")
    quote["certificate_of_origin"]["status"] = "pending"
    monkeypatch.setattr(main, "fx", changed)
    monkeypatch.setattr(main, "SNAPSHOT", snapshot_id(changed))

    evaluation = _evaluate(client, "apr06-eval-01")
    plan = next(p for p in evaluation["plans"] if p["plan_id"] == "PLN-0002")
    finding = next(
        f for f in evaluation["findings"]
        if f["check_code"] == "FTA.CERTIFICATE_OF_ORIGIN" and f["outcome"] == "needs_review"
    )
    # VC-APR-06 constructs a one-line review plan. The optimizer excludes this
    # option from P2, so represent that validation fixture explicitly in storage.
    review_plan = client.get(f"/api/v1/plans/{plan['plan_id']}").json()
    review_plan["status"] = "needs_review"
    review_plan["outcome"] = "needs_review"
    review_plan["finding_ids"].append(finding["finding_id"])
    review_plan["plan_hash"] = sha256_of(plan_hash_material(review_plan))
    with main.transaction() as con:
        con.execute(
            "UPDATE plans SET status=?, outcome=?, plan_hash=?, payload_json=? WHERE plan_id=?",
            (review_plan["status"], review_plan["outcome"], review_plan["plan_hash"],
             json.dumps(review_plan), review_plan["plan_id"]),
        )
    plan = review_plan
    path = f"/api/v1/plans/{plan['plan_id']}/decisions"
    headers = {"X-Actor-Id": "USR-PRIYA", "Idempotency-Key": "apr06-no-ack-01"}
    body = {
        "action": "approve", "plan_version": 1, "plan_hash": plan["plan_hash"],
        "justification": None, "acknowledgements": [],
    }

    refused = client.post(path, headers=headers, json=body)
    assert refused.status_code == 422
    assert refused.json()["code"] == "ACKNOWLEDGEMENT_REQUIRED"

    body["acknowledgements"] = [{"finding_id": finding["finding_id"], "actor_id": "USR-PRIYA", "note": "Reviewed"}]
    wrong_role = client.post(path, headers={**headers, "Idempotency-Key": "apr06-wrong-role-01"}, json=body)
    assert wrong_role.status_code == 403
    assert wrong_role.json()["code"] == "ROLE_FORBIDDEN"

    body["acknowledgements"][0]["actor_id"] = "USR-ARJUN"
    accepted = client.post(path, headers={**headers, "Idempotency-Key": "apr06-right-role-01"}, json=body)
    assert accepted.status_code == 201
    assert accepted.json()["resulting_plan_status"] == "approved"


def test_apr_07_new_evaluation_supersedes_old_undecided_plan(client):
    client.post("/api/v1/demo/reset", headers={"X-Actor-Id": "USR-PRIYA"})
    first = _evaluate(client, "apr07-eval-01")
    second = _evaluate(client, "apr07-eval-02")
    old_plan = first["plans"][1]

    current = client.get(f"/api/v1/plans/{old_plan['plan_id']}").json()
    assert current["status"] == "superseded"
    refused = client.post(
        f"/api/v1/plans/{old_plan['plan_id']}/decisions",
        headers={"X-Actor-Id": "USR-PRIYA", "Idempotency-Key": "apr07-stale-plan-01"},
        json={"action": "approve", "plan_version": 1, "plan_hash": old_plan["plan_hash"],
              "justification": None, "acknowledgements": []},
    )
    assert refused.status_code == 409
    assert refused.json()["code"] == "PLAN_SUPERSEDED"
    assert second["evaluation_id"] == "EVAL-0002"


def test_apr_08_viewer_and_wrong_amendment_role_are_refused(client):
    client.post("/api/v1/demo/reset", headers={"X-Actor-Id": "USR-PRIYA"})
    evaluation = _evaluate(client, "apr08-eval-01")
    blocked = evaluation["plans"][0]
    path = f"/api/v1/plans/{blocked['plan_id']}/decisions"
    body = {
        "action": "request_amendment", "plan_version": 1, "plan_hash": blocked["plan_hash"],
        "justification": "Please amend the transhipment terms.", "acknowledgements": [],
        "amendment": {"lc_id": "LC-SYN-0117", "requested_changes": [
            {"field_tag": "43T", "from": "NOT ALLOWED", "to": "ALLOWED"},
        ]},
    }

    viewer = client.post(path, headers={"X-Actor-Id": "USR-VIEW", "Idempotency-Key": "apr08-viewer-01"}, json=body)
    assert viewer.status_code == 403
    assert viewer.json()["code"] == "ROLE_FORBIDDEN"

    planner = client.post(path, headers={"X-Actor-Id": "USR-PRIYA", "Idempotency-Key": "apr08-planner-01"}, json=body)
    assert planner.status_code == 403
    assert planner.json()["code"] == "ROLE_FORBIDDEN"

    officer = client.post(path, headers={"X-Actor-Id": "USR-ARJUN", "Idempotency-Key": "apr08-officer-01"}, json=body)
    assert officer.status_code == 201
    assert officer.json()["resulting_plan_status"] == "blocked"
    assert officer.json()["amendment_request_id"] == "AMD-0001"
