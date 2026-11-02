from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.evaluation import build_evaluation_payload
from backend.app.services.fixtures import load_fixtures


@pytest.fixture
def client():
    return TestClient(app)


def test_execution_failure_stops_later_steps_and_is_audited(client, monkeypatch):
    # VC-EXE-01 injects the third step failure: earlier actions stay recorded,
    # the first failure stops the run, and all later actions are skipped.
    monkeypatch.setenv("AEGIS_SIMULATE_FAIL_AT_STEP", "3")
    client.post("/api/v1/demo/reset", headers={"X-Actor-Id": "USR-PRIYA"})
    evaluation = client.post(
        "/api/v1/evaluations",
        headers={"X-Actor-Id": "USR-PRIYA", "Idempotency-Key": "failure-eval-01"},
        json={"disruption_id": "DIS-2026-0042"},
    )
    assert evaluation.status_code == 202
    plan = client.get("/api/v1/plans/PLN-0002").json()
    decision = client.post(
        "/api/v1/plans/PLN-0002/decisions",
        headers={"X-Actor-Id": "USR-PRIYA", "Idempotency-Key": "failure-approve-01"},
        json={"action": "approve", "plan_version": 1, "plan_hash": plan["plan_hash"], "justification": None, "acknowledgements": []},
    )
    assert decision.status_code == 201
    execution = client.post(
        "/api/v1/plans/PLN-0002/executions",
        headers={"X-Actor-Id": "USR-PRIYA", "Idempotency-Key": "failure-execute-01"},
        json={"decision_id": decision.json()["decision_id"]},
    )
    assert execution.status_code == 202
    details = client.get(f"/api/v1/executions/{execution.json()['execution_id']}").json()
    assert details["status"] == "failed"
    assert [step["status"] for step in details["steps"]] == ["succeeded", "succeeded", "failed", "skipped", "skipped", "skipped"]
    assert client.get("/api/v1/audit-events/verify").json()["valid"] is True


def test_llm_modes_leave_outcomes_financials_and_plan_hashes_unchanged(monkeypatch):
    # Hermetic: the live leg must never reach a real provider with a local .env key; an unreachable endpoint exercises degradation.
    monkeypatch.setenv("AEGIS_LLM_BASE_URL", "http://127.0.0.1:9/v1")
    monkeypatch.setenv("AEGIS_LLM_TIMEOUT_S", "1")
    fx = load_fixtures(Path(__file__).resolve().parents[2] / "fixtures")
    started = "2026-10-26T09:00:00+05:30"
    completed = "2026-10-26T09:00:07+05:30"
    payloads = [
        build_evaluation_payload(fx, "DIS-2026-0042", "EVAL-0001", ("PLN-0001", "PLN-0002"), mode, started, completed)
        for mode in ("off", "recorded", "live")
    ]
    baseline = payloads[0]["plans"]
    for payload in payloads[1:]:
        assert payload["plans"] == baseline
        assert payload["comparison"] == payloads[0]["comparison"]
