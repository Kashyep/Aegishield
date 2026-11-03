"""Explicit, recorded override of a blocked plan (optional override_blocked flag).

Without the flag the existing rules hold: a blocked plan is refused with 422 PLAN_BLOCKED.
PLN-0001 also carries a needs_review trade_compliance finding, which only a trade_compliance_officer may
acknowledge, so the override is made by USR-ARJUN (approver and acknowledger in one).
"""
import pytest
from fastapi.testclient import TestClient

from backend.app import config
from backend.app.main import app

PRIYA = {"X-Actor-Id": "USR-PRIYA"}
ARJUN = {"X-Actor-Id": "USR-ARJUN"}
VIEWER = {"X-Actor-Id": "USR-VIEW"}
LONG_ENOUGH = "Shipper accepts the transhipment risk under the bank's waiver."  # >= 20 non-space chars


@pytest.fixture(autouse=True)
def setup_test_env(tmp_path, monkeypatch):
    monkeypatch.setenv("AEGIS_LLM_MODE", "off")
    monkeypatch.setattr("backend.app.db.sqlite.DB_PATH", tmp_path / "test_override_approval.sqlite3")
    monkeypatch.setattr(config, "RESET_TOKEN", None)
    yield


@pytest.fixture
def client():
    with TestClient(app) as c:
        c.post("/api/v1/demo/reset", headers=PRIYA)
        r = c.post(
            "/api/v1/evaluations",
            headers={**PRIYA, "Idempotency-Key": "eval-override-0001"},
            json={"disruption_id": "DIS-2026-0042"},
        )
        assert r.status_code == 202
        assert c.get("/api/v1/plans/PLN-0001").json()["status"] == "blocked"
        yield c


def _p1(client):
    return client.get("/api/v1/plans/PLN-0001").json()


def _acks(client, plan):
    evaluation = client.get(f"/api/v1/evaluations/{plan['evaluation_id']}").json()
    review_ids = {f["finding_id"] for f in evaluation["findings"] if f["outcome"] == "needs_review"}
    return [
        {"finding_id": fid, "actor_id": "USR-ARJUN", "note": "Certificate of origin reviewed."}
        for fid in plan["finding_ids"]
        if fid in review_ids
    ]


def _body(client, plan, justification=LONG_ENOUGH, **extra):
    return {
        "action": "approve",
        "plan_version": plan["version"],
        "plan_hash": plan["plan_hash"],
        "justification": justification,
        "acknowledgements": _acks(client, plan),
        **extra,
    }


def _events(client):
    return client.get("/api/v1/audit-events?limit=200").json()["events"]


def test_override_without_justification_is_422(client):
    plan = _p1(client)
    for i, justification in enumerate((None, "", "short", "   " + "x" * 18 + "   ", "a b c d e f g h i j k l m n o p q r s")):
        r = client.post(
            "/api/v1/plans/PLN-0001/decisions",
            headers={**ARJUN, "Idempotency-Key": f"ovr-short-{i:04d}"},
            json=_body(client, plan, justification=justification, override_blocked=True),
        )
        assert r.status_code == 422, justification
        assert r.json()["code"] == "VALIDATION_ERROR"
        assert r.json()["detail"] == "Override justification must be at least 20 characters"
    assert _p1(client)["status"] == "blocked"
    assert _events(client)[-1]["payload"]["code"] == "VALIDATION_ERROR"


def test_override_with_justification_approves_and_records_override(client):
    plan = _p1(client)
    r = client.post(
        "/api/v1/plans/PLN-0001/decisions",
        headers={**ARJUN, "Idempotency-Key": "ovr-approve-0001"},
        json=_body(client, plan, override_blocked=True),
    )
    assert r.status_code == 201, r.text
    decision = r.json()
    assert decision["resulting_plan_status"] == "approved"
    assert decision["override_blocked"] is True
    assert decision["action"] == "approve"

    current = _p1(client)
    assert current["status"] == "approved"
    assert current["approved_with_override"] is True
    assert decision["decision_id"] in current["decision_ids"]

    recorded = [e for e in _events(client) if e["event_type"] == "DECISION_RECORDED"][-1]
    assert recorded["payload"]["override_blocked"] is True
    assert recorded["payload"]["resulting_plan_status"] == "approved"
    assert recorded["payload"]["blocked_reasons"] == ["FND-DEP-SUP-B", "FND-LC-TRANSHIPMENT-RT-C-SIN"]

    verify = client.get("/api/v1/audit-events/verify").json()
    assert verify["valid"] is True


def test_override_approval_survives_reload_via_evaluation_overlay(client):
    plan = _p1(client)
    assert client.post(
        "/api/v1/plans/PLN-0001/decisions",
        headers={**ARJUN, "Idempotency-Key": "ovr-reload-0001"},
        json=_body(client, plan, override_blocked=True),
    ).status_code == 201
    evaluation = client.get(f"/api/v1/evaluations/{plan['evaluation_id']}").json()
    overlaid = next(p for p in evaluation["plans"] if p["plan_id"] == "PLN-0001")
    assert overlaid["status"] == "approved"
    assert overlaid["approved_with_override"] is True
    # The stored plan hash is untouched by the overlay and by the decision.
    assert overlaid["plan_hash"] == plan["plan_hash"]


def test_blocked_plan_without_flag_is_still_refused(client):
    plan = _p1(client)
    r = client.post(
        "/api/v1/plans/PLN-0001/decisions",
        headers={**ARJUN, "Idempotency-Key": "ovr-noflag-0001"},
        json=_body(client, plan),
    )
    assert r.status_code == 422
    assert r.json()["code"] == "PLAN_BLOCKED"
    assert _p1(client)["status"] == "blocked"
    assert "approved_with_override" not in _p1(client)

    # An explicit false is the same as absent.
    r = client.post(
        "/api/v1/plans/PLN-0001/decisions",
        headers={**PRIYA, "Idempotency-Key": "ovr-falseflag-0001"},
        json=_body(client, plan, override_blocked=False),
    )
    assert r.status_code == 422
    assert r.json()["code"] == "PLAN_BLOCKED"


def test_override_by_supply_planner_needs_trade_compliance_acknowledgement(client):
    plan = _p1(client)
    r = client.post(
        "/api/v1/plans/PLN-0001/decisions",
        headers={**PRIYA, "Idempotency-Key": "ovr-priya-0001"},
        json={**_body(client, plan, override_blocked=True), "acknowledgements": []},
    )
    assert r.status_code == 422
    assert r.json()["code"] == "ACKNOWLEDGEMENT_REQUIRED"
    assert _p1(client)["status"] == "blocked"


def test_viewer_cannot_override_blocked_plan(client):
    plan = _p1(client)
    r = client.post(
        "/api/v1/plans/PLN-0001/decisions",
        headers={**VIEWER, "Idempotency-Key": "ovr-viewer-0001"},
        json=_body(client, plan, override_blocked=True),
    )
    assert r.status_code == 403
    assert r.json()["code"] == "ROLE_FORBIDDEN"
    assert _p1(client)["status"] == "blocked"


def test_override_is_idempotent_and_stale_hash_is_refused(client):
    plan = _p1(client)
    body = _body(client, plan, override_blocked=True)
    first = client.post("/api/v1/plans/PLN-0001/decisions", headers={**ARJUN, "Idempotency-Key": "ovr-idem-0001"}, json=body)
    assert first.status_code == 201
    replay = client.post("/api/v1/plans/PLN-0001/decisions", headers={**ARJUN, "Idempotency-Key": "ovr-idem-0001"}, json=body)
    assert replay.status_code == 200
    assert replay.headers.get("Idempotent-Replay") == "true"

    stale = client.post(
        "/api/v1/plans/PLN-0001/decisions",
        headers={**ARJUN, "Idempotency-Key": "ovr-stale-0001"},
        json={**body, "plan_hash": "sha256:" + "0" * 64},
    )
    assert stale.status_code == 409
    assert stale.json()["code"] == "PLAN_VERSION_STALE"
