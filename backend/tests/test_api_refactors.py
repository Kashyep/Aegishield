import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012

from backend.app import config
from backend.app.main import app
from backend.app.db.sqlite import read_connection, transaction
import backend.app.services.evaluation as eval_module
from backend.app.services.fixtures import load_fixtures

ROOT = Path(__file__).resolve().parents[2]
CONTRACTS = ROOT / "contracts"
FIXTURES_DIR = ROOT / "fixtures" / "demo"


def get_validator(schema_ref: str):
    resources = []
    for path in sorted((CONTRACTS / "schemas").glob("*.schema.json")):
        resources.append(
            (
                path.resolve().as_uri(),
                Resource.from_contents(
                    json.loads(path.read_text(encoding="utf-8")),
                    default_specification=DRAFT202012,
                ),
            )
        )
    registry = Registry().with_resources(resources)
    file_name, fragment = schema_ref.split("#", 1)
    target_uri = f"{(CONTRACTS / 'schemas' / file_name).resolve().as_uri()}#{fragment}"
    return Draft202012Validator({"$ref": target_uri}, registry=registry)


def assert_valid_schema(data: dict, schema_ref: str):
    validator = get_validator(schema_ref)
    errors = list(validator.iter_errors(data))
    assert not errors, f"Schema validation errors for {schema_ref}: {[e.message for e in errors]}"


@pytest.fixture(autouse=True)
def setup_test_env(tmp_path, monkeypatch):
    monkeypatch.setenv("AEGIS_LLM_MODE", "off")
    monkeypatch.setattr("backend.app.db.sqlite.DB_PATH", tmp_path / "test_api_refactors.sqlite3")
    monkeypatch.setattr(config, "RESET_TOKEN", None)
    yield
    monkeypatch.delenv("AEGIS_RESET_TOKEN", raising=False)
    monkeypatch.setattr(config, "RESET_TOKEN", None)


@pytest.fixture
def client():
    with TestClient(app) as c:
        c.post("/api/v1/demo/reset", headers={"X-Actor-Id": "USR-PRIYA"})
        yield c


def test_f26_health_endpoint_normal_and_degraded(client, monkeypatch):
    """F-26: /health reports 'ok' normally and 'degraded' on DB failure, and validates against Health schema."""
    # 1. Normal state: DB is healthy
    r_ok = client.get("/api/v1/health")
    assert r_ok.status_code == 200
    body_ok = r_ok.json()
    assert body_ok["status"] == "ok"
    assert_valid_schema(body_ok, "api.schema.json#/$defs/Health")

    # 2. Degraded state: DB check fails
    def mock_broken_connection():
        raise RuntimeError("Simulated DB connection failure")

    monkeypatch.setattr("backend.app.main.read_connection", mock_broken_connection)

    r_deg = client.get("/api/v1/health")
    assert r_deg.status_code == 200
    body_deg = r_deg.json()
    assert body_deg["status"] == "degraded"
    assert_valid_schema(body_deg, "api.schema.json#/$defs/Health")


def test_b5_scenario_returns_policies_and_validates(client):
    """B5: GET /api/v1/scenario returns policies matching fx['policies'] and validates against ScenarioResponse."""
    r = client.get("/api/v1/scenario")
    assert r.status_code == 200
    body = r.json()
    assert "policies" in body

    expected_policies = json.loads((FIXTURES_DIR / "policies.json").read_text(encoding="utf-8"))
    assert body["policies"] == expected_policies
    assert_valid_schema(body, "api.schema.json#/$defs/ScenarioResponse")


def test_f13_sqlite_write_lock_not_held_during_evaluation_compute(client, monkeypatch):
    """F-13: build_evaluation_payload runs OUTSIDE the SQLite write lock."""
    orig_build = eval_module.build_evaluation_payload
    probe_written = False

    def mock_build_payload(*args, **kwargs):
        nonlocal probe_written
        # Attempt an immediate write transaction during compute.
        # If create_evaluation held BEGIN IMMEDIATE write lock, this would raise sqlite3.OperationalError: database is locked
        with transaction() as con:
            con.execute("INSERT OR REPLACE INTO meta(key, value) VALUES('f13_lock_probe', 'acquired_during_compute')")
        probe_written = True
        return orig_build(*args, **kwargs)

    monkeypatch.setattr(eval_module, "build_evaluation_payload", mock_build_payload)
    monkeypatch.setattr("backend.app.main.build_evaluation_payload", mock_build_payload)

    r = client.post(
        "/api/v1/evaluations",
        headers={"X-Actor-Id": "USR-PRIYA", "Idempotency-Key": "eval-f13-lock-test"},
        json={"disruption_id": "DIS-2026-0042"},
    )
    assert r.status_code == 202
    assert probe_written is True

    with read_connection() as con:
        row = con.execute("SELECT value FROM meta WHERE key='f13_lock_probe'").fetchone()
        assert row is not None
        assert row["value"] == "acquired_during_compute"


def test_f12_prior_plans_not_superseded_when_evaluation_fails(client, monkeypatch):
    """F-12: Prior plans are marked superseded ONLY if build_evaluation_payload succeeds."""
    # 1. First evaluation creates PLN-0001 (blocked) and PLN-0002 (pending_approval)
    r1 = client.post(
        "/api/v1/evaluations",
        headers={"X-Actor-Id": "USR-PRIYA", "Idempotency-Key": "eval-f12-first"},
        json={"disruption_id": "DIS-2026-0042"},
    )
    assert r1.status_code == 202

    p1 = client.get("/api/v1/plans/PLN-0001").json()
    p2 = client.get("/api/v1/plans/PLN-0002").json()
    assert p1["status"] == "blocked"
    assert p2["status"] == "pending_approval"

    # 2. Second evaluation fails during compute
    def mock_failing_compute(*args, **kwargs):
        raise RuntimeError("Simulated compute pipeline failure")

    monkeypatch.setattr("backend.app.main.build_evaluation_payload", mock_failing_compute)

    r2 = client.post(
        "/api/v1/evaluations",
        headers={"X-Actor-Id": "USR-PRIYA", "Idempotency-Key": "eval-f12-failing"},
        json={"disruption_id": "DIS-2026-0042"},
    )
    assert r2.status_code == 202
    assert r2.json()["superseded_plan_ids"] == []

    # Verify prior plans were NOT marked superseded
    p1_after_fail = client.get("/api/v1/plans/PLN-0001").json()
    p2_after_fail = client.get("/api/v1/plans/PLN-0002").json()
    assert p1_after_fail["status"] == "blocked"
    assert p2_after_fail["status"] == "pending_approval"

    # Verify no PLAN_SUPERSEDED event exists
    events = client.get("/api/v1/audit-events?limit=200").json()["events"]
    assert not any(e["event_type"] == "PLAN_SUPERSEDED" for e in events)

    # 3. Third evaluation succeeds
    monkeypatch.undo()
    monkeypatch.setenv("AEGIS_LLM_MODE", "off")
    monkeypatch.setattr(config, "RESET_TOKEN", None)

    r3 = client.post(
        "/api/v1/evaluations",
        headers={"X-Actor-Id": "USR-PRIYA", "Idempotency-Key": "eval-f12-success"},
        json={"disruption_id": "DIS-2026-0042"},
    )
    assert r3.status_code == 202
    assert set(r3.json()["superseded_plan_ids"]) == {"PLN-0001", "PLN-0002"}

    # Verify prior plans are NOW marked superseded
    p1_superseded = client.get("/api/v1/plans/PLN-0001").json()
    p2_superseded = client.get("/api/v1/plans/PLN-0002").json()
    assert p1_superseded["status"] == "superseded"
    assert p2_superseded["status"] == "superseded"

    events = client.get("/api/v1/audit-events?limit=200").json()["events"]
    superseded_events = [e for e in events if e["event_type"] == "PLAN_SUPERSEDED"]
    assert len(superseded_events) == 2


def test_f11_decision_refusals_audited(client):
    """F-11: Decision refusal paths append DECISION_REFUSED audit events."""
    # Create plans
    r_eval = client.post(
        "/api/v1/evaluations",
        headers={"X-Actor-Id": "USR-PRIYA", "Idempotency-Key": "eval-f11-dec"},
        json={"disruption_id": "DIS-2026-0042"},
    )
    assert r_eval.status_code == 202

    p1 = client.get("/api/v1/plans/PLN-0001").json()
    p2 = client.get("/api/v1/plans/PLN-0002").json()
    p1_hash = p1["plan_hash"]
    p2_hash = p2["plan_hash"]

    def latest_event():
        events = client.get("/api/v1/audit-events?limit=200").json()["events"]
        return events[-1]

    # 1. Viewer role forbidden
    r = client.post(
        "/api/v1/plans/PLN-0002/decisions",
        headers={"X-Actor-Id": "USR-VIEW", "Idempotency-Key": "dec-viewer-01"},
        json={"action": "approve", "plan_version": 1, "plan_hash": p2_hash, "justification": None, "acknowledgements": []},
    )
    assert r.status_code == 403
    ev = latest_event()
    assert ev["event_type"] == "DECISION_REFUSED"
    assert ev["payload"]["code"] == "ROLE_FORBIDDEN"

    # 2. Rejection justification < 10 chars
    r = client.post(
        "/api/v1/plans/PLN-0002/decisions",
        headers={"X-Actor-Id": "USR-PRIYA", "Idempotency-Key": "dec-rej-short"},
        json={"action": "reject", "plan_version": 1, "plan_hash": p2_hash, "justification": "short", "acknowledgements": []},
    )
    assert r.status_code == 400
    ev = latest_event()
    assert ev["event_type"] == "DECISION_REFUSED"
    assert ev["payload"]["code"] == "VALIDATION_ERROR"

    # 3. Amendment justification < 10 chars
    r = client.post(
        "/api/v1/plans/PLN-0001/decisions",
        headers={"X-Actor-Id": "USR-ARJUN", "Idempotency-Key": "dec-amd-short"},
        json={
            "action": "request_amendment",
            "plan_version": 1,
            "plan_hash": p1_hash,
            "justification": "short",
            "acknowledgements": [],
            "amendment": {"lc_id": "LC-SYN-0117", "requested_changes": [{"field_tag": "43T", "from": "NOT ALLOWED", "to": "ALLOWED"}]},
        },
    )
    assert r.status_code == 422
    ev = latest_event()
    assert ev["event_type"] == "DECISION_REFUSED"
    assert ev["payload"]["code"] == "VALIDATION_ERROR"

    # 4. Missing amendment details
    r = client.post(
        "/api/v1/plans/PLN-0001/decisions",
        headers={"X-Actor-Id": "USR-ARJUN", "Idempotency-Key": "dec-amd-nodata"},
        json={
            "action": "request_amendment",
            "plan_version": 1,
            "plan_hash": p1_hash,
            "justification": "Valid amendment justification text here",
            "acknowledgements": [],
            "amendment": None,
        },
    )
    assert r.status_code == 422
    ev = latest_event()
    assert ev["event_type"] == "DECISION_REFUSED"
    assert ev["payload"]["code"] == "VALIDATION_ERROR"

    # 5. Unknown LC
    r = client.post(
        "/api/v1/plans/PLN-0001/decisions",
        headers={"X-Actor-Id": "USR-ARJUN", "Idempotency-Key": "dec-amd-bad-lc"},
        json={
            "action": "request_amendment",
            "plan_version": 1,
            "plan_hash": p1_hash,
            "justification": "Valid amendment justification text here",
            "acknowledgements": [],
            "amendment": {"lc_id": "LC-NON-EXISTENT", "requested_changes": [{"field_tag": "43T", "from": "NOT ALLOWED", "to": "ALLOWED"}]},
        },
    )
    assert r.status_code == 404
    ev = latest_event()
    assert ev["event_type"] == "DECISION_REFUSED"
    assert ev["payload"]["code"] == "NOT_FOUND"

    # 6. Invalid requested change field tag (not 43T or 47A)
    r = client.post(
        "/api/v1/plans/PLN-0001/decisions",
        headers={"X-Actor-Id": "USR-ARJUN", "Idempotency-Key": "dec-amd-bad-field"},
        json={
            "action": "request_amendment",
            "plan_version": 1,
            "plan_hash": p1_hash,
            "justification": "Valid amendment justification text here",
            "acknowledgements": [],
            "amendment": {"lc_id": "LC-SYN-0117", "requested_changes": [{"field_tag": "44A", "from": "OLD", "to": "NEW"}]},
        },
    )
    assert r.status_code == 422
    ev = latest_event()
    assert ev["event_type"] == "DECISION_REFUSED"
    assert ev["payload"]["code"] == "VALIDATION_ERROR"

    # 7. Plan blocked on approve (PLAN_BLOCKED)
    r = client.post(
        "/api/v1/plans/PLN-0001/decisions",
        headers={"X-Actor-Id": "USR-PRIYA", "Idempotency-Key": "dec-app-blocked"},
        json={"action": "approve", "plan_version": 1, "plan_hash": p1_hash, "justification": "Valid approval text", "acknowledgements": []},
    )
    assert r.status_code == 422
    ev = latest_event()
    assert ev["event_type"] == "DECISION_REFUSED"
    assert ev["payload"]["code"] == "PLAN_BLOCKED"

    # 8. Request body schema failure
    r = client.post(
        "/api/v1/plans/PLN-0002/decisions",
        headers={"X-Actor-Id": "USR-PRIYA", "Idempotency-Key": "dec-bad-body"},
        json={"action": "invalid_action_value"},
    )
    assert r.status_code == 422
    ev = latest_event()
    assert ev["event_type"] == "DECISION_REFUSED"
    assert ev["payload"]["code"] == "VALIDATION_ERROR"

    # 9. Header validation refusal with resolvable actor (missing idempotency key)
    r = client.post(
        "/api/v1/plans/PLN-0002/decisions",
        headers={"X-Actor-Id": "USR-PRIYA"},
        json={"action": "approve", "plan_version": 1, "plan_hash": p2_hash},
    )
    assert r.status_code == 403
    ev = latest_event()
    assert ev["event_type"] == "DECISION_REFUSED"
    assert ev["payload"]["code"] == "IDEMPOTENCY_KEY_REQUIRED"

    # Verify entire chain remains valid
    v = client.get("/api/v1/audit-events/verify").json()
    assert v["valid"] is True


def test_f11_execution_refusals_audited(client):
    """F-11: Execution refusal paths append EXECUTION_REFUSED audit events."""
    # Create plans
    r_eval = client.post(
        "/api/v1/evaluations",
        headers={"X-Actor-Id": "USR-PRIYA", "Idempotency-Key": "eval-f11-exe"},
        json={"disruption_id": "DIS-2026-0042"},
    )
    assert r_eval.status_code == 202

    def latest_event():
        events = client.get("/api/v1/audit-events?limit=200").json()["events"]
        return events[-1]

    # 1. Viewer role cannot execute plans
    r = client.post(
        "/api/v1/plans/PLN-0002/executions",
        headers={"X-Actor-Id": "USR-VIEW", "Idempotency-Key": "exe-viewer-01"},
        json={"decision_id": "DEC-0001"},
    )
    assert r.status_code == 403
    ev = latest_event()
    assert ev["event_type"] == "EXECUTION_REFUSED"
    assert ev["payload"]["code"] == "ROLE_FORBIDDEN"

    # 2. Unknown actor cannot execute plans
    r = client.post(
        "/api/v1/plans/PLN-0002/executions",
        headers={"X-Actor-Id": "USR-UNKNOWN", "Idempotency-Key": "exe-actor-unknown"},
        json={"decision_id": "DEC-0001"},
    )
    assert r.status_code == 400
    ev = latest_event()
    assert ev["event_type"] == "EXECUTION_REFUSED"
    assert ev["payload"]["code"] == "ACTOR_REQUIRED"

    # 3. Not approved plan execution refused
    r = client.post(
        "/api/v1/plans/PLN-0002/executions",
        headers={"X-Actor-Id": "USR-PRIYA", "Idempotency-Key": "exe-not-app-01"},
        json={"decision_id": "DEC-0001"},
    )
    assert r.status_code == 409
    ev = latest_event()
    assert ev["event_type"] == "EXECUTION_REFUSED"
    assert ev["payload"]["code"] == "NOT_APPROVED"

    # 4. Request body problem
    r = client.post(
        "/api/v1/plans/PLN-0002/executions",
        headers={"X-Actor-Id": "USR-PRIYA", "Idempotency-Key": "exe-bad-body"},
        json={"extra_unexpected_field": "test"},
    )
    assert r.status_code == 422
    ev = latest_event()
    assert ev["event_type"] == "EXECUTION_REFUSED"
    assert ev["payload"]["code"] == "VALIDATION_ERROR"

    # 5. Header refusal (missing idempotency key)
    r = client.post(
        "/api/v1/plans/PLN-0002/executions",
        headers={"X-Actor-Id": "USR-PRIYA"},
        json={"decision_id": "DEC-0001"},
    )
    assert r.status_code == 403
    ev = latest_event()
    assert ev["event_type"] == "EXECUTION_REFUSED"
    assert ev["payload"]["code"] == "IDEMPOTENCY_KEY_REQUIRED"

    # Verify entire chain remains valid
    v = client.get("/api/v1/audit-events/verify").json()
    assert v["valid"] is True
