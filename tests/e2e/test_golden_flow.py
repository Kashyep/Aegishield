import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app

VOLATILE = {
    "created_at", "updated_at", "started_at", "finished_at", "completed_at", "decided_at",
    "occurred_at", "duration_ms", "generated_at", "reset_at", "prev_hash", "event_hash",
}


def strip_volatile(obj):
    if isinstance(obj, dict):
        return {k: strip_volatile(v) for k, v in obj.items() if k not in VOLATILE}
    if isinstance(obj, list):
        return [strip_volatile(v) for v in obj]
    return obj


@pytest.fixture
def client():
    return TestClient(app)


def test_golden_approval_flow(client):
    root = Path(__file__).resolve().parents[2]
    golden_eval = json.loads((root / "fixtures" / "expected" / "evaluation_EVAL-0001.json").read_text(encoding="utf-8-sig"))

    # Step 1: Reset demo state
    r1 = client.post("/api/v1/demo/reset", headers={"X-Actor-Id": "USR-PRIYA"})
    assert r1.status_code == 200
    b1 = r1.json()
    assert b1["scenario_id"] == "SCN-DEMO-001"
    assert b1["counters_reset"] is True
    assert b1["audit_event_id"] == "AUD-000001"

    # Step 2: Health
    r2 = client.get("/api/v1/health")
    assert r2.status_code == 200
    b2 = r2.json()
    assert b2["data_mode"] == "synthetic"
    assert b2["llm_mode"] == "off"
    assert b2["input_snapshot_id"] == golden_eval["input_snapshot_id"]

    # Step 3: Start evaluation
    r3 = client.post(
        "/api/v1/evaluations",
        headers={"X-Actor-Id": "USR-PRIYA", "Idempotency-Key": "eval-demo-0001"},
        json={"disruption_id": "DIS-2026-0042"},
    )
    assert r3.status_code == 202
    b3 = r3.json()
    assert b3["evaluation_id"] == "EVAL-0001"
    assert b3["status"] in ["queued", "running"]
    assert b3["poll_url"] == "/api/v1/evaluations/EVAL-0001"
    assert b3["superseded_plan_ids"] == []

    # Step 4: Poll evaluation
    r4 = client.get("/api/v1/evaluations/EVAL-0001")
    assert r4.status_code == 200
    b4 = r4.json()
    assert b4["status"] == "completed"
    assert strip_volatile(b4) == strip_volatile(golden_eval)
    plan_hash_p1 = b4["plans"][0]["plan_hash"]
    plan_hash_p2 = b4["plans"][1]["plan_hash"]

    # Step 5: Approving blocked naive plan is refused
    r5 = client.post(
        "/api/v1/plans/PLN-0001/decisions",
        headers={"X-Actor-Id": "USR-PRIYA", "Idempotency-Key": "dec-p1-approve-01"},
        json={
            "action": "approve",
            "plan_version": 1,
            "plan_hash": plan_hash_p1,
            "justification": None,
            "acknowledgements": [],
        },
    )
    assert r5.status_code == 422
    b5 = r5.json()
    assert b5["code"] == "PLAN_BLOCKED"

    # Step 6: Executing unapproved plan is refused
    r6 = client.post(
        "/api/v1/plans/PLN-0001/executions",
        headers={"X-Actor-Id": "USR-PRIYA", "Idempotency-Key": "exe-p1-01"},
        json={"decision_id": "DEC-0001"},
    )
    assert r6.status_code == 409
    b6 = r6.json()
    assert b6["code"] == "NOT_APPROVED"

    # Step 7: Approval with stale hash is refused
    r7 = client.post(
        "/api/v1/plans/PLN-0002/decisions",
        headers={"X-Actor-Id": "USR-PRIYA", "Idempotency-Key": "dec-p2-stale-01"},
        json={
            "action": "approve",
            "plan_version": 1,
            "plan_hash": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
            "justification": None,
            "acknowledgements": [],
        },
    )
    assert r7.status_code == 409
    b7 = r7.json()
    assert b7["code"] == "PLAN_VERSION_STALE"
    assert b7["current"]["plan_hash"] == plan_hash_p2
    assert b7["current"]["status"] == "pending_approval"

    # Step 8: Supply planner approves verified plan
    r8 = client.post(
        "/api/v1/plans/PLN-0002/decisions",
        headers={"X-Actor-Id": "USR-PRIYA", "Idempotency-Key": "dec-p2-approve-01"},
        json={
            "action": "approve",
            "plan_version": 1,
            "plan_hash": plan_hash_p2,
            "justification": "Independent supplier, direct route, all checks passed.",
            "acknowledgements": [],
        },
    )
    assert r8.status_code == 201
    b8 = r8.json()
    assert b8["decision_id"] == "DEC-0001"
    assert b8["resulting_plan_status"] == "approved"
    assert b8["actor"]["role"] == "supply_planner"

    # Step 9: Replay same request with same Idempotency-Key
    r9 = client.post(
        "/api/v1/plans/PLN-0002/decisions",
        headers={"X-Actor-Id": "USR-PRIYA", "Idempotency-Key": "dec-p2-approve-01"},
        json={
            "action": "approve",
            "plan_version": 1,
            "plan_hash": plan_hash_p2,
            "justification": "Independent supplier, direct route, all checks passed.",
            "acknowledgements": [],
        },
    )
    assert r9.status_code == 200
    b9 = r9.json()
    assert b9["decision_id"] == "DEC-0001"
    assert r9.headers.get("Idempotent-Replay") == "true"

    # Step 10: Second decision with new key is refused
    r10 = client.post(
        "/api/v1/plans/PLN-0002/decisions",
        headers={"X-Actor-Id": "USR-ARJUN", "Idempotency-Key": "dec-p2-approve-02"},
        json={
            "action": "approve",
            "plan_version": 1,
            "plan_hash": plan_hash_p2,
            "justification": None,
            "acknowledgements": [],
        },
    )
    assert r10.status_code == 409
    b10 = r10.json()
    assert b10["code"] == "DECISION_EXISTS"
    assert b10["current"]["status"] == "approved"

    # Step 11: Start simulated execution
    r11 = client.post(
        "/api/v1/plans/PLN-0002/executions",
        headers={"X-Actor-Id": "USR-PRIYA", "Idempotency-Key": "exe-p2-01"},
        json={"decision_id": "DEC-0001"},
    )
    assert r11.status_code == 202
    b11 = r11.json()
    assert b11["execution_id"] == "EXE-0001"
    assert b11["simulated"] is True

    # Step 12: Poll execution until completed
    r12 = client.get("/api/v1/executions/EXE-0001")
    assert r12.status_code == 200
    b12 = r12.json()
    assert b12["status"] == "completed"
    step_types = [s["step_type"] for s in b12["steps"]]
    assert step_types == ["REDUCE_PO", "CREATE_PO", "BOOK_FREIGHT", "CREATE_STOCK_TRANSFER", "RESERVE_STOCK", "NOTIFY_CUSTOMER"]
    assert b12["steps"][0]["refs"] == {"po_id": "PO-7001", "from_qty": 900, "to_qty": 300}
    assert b12["steps"][1]["refs"] == {"supplier_id": "SUP-C", "quote_id": "QT-C-01", "qty": 600, "unit_price_inr": 6600, "lc_id": "LC-SYN-0117", "lc_drawing_inr": 3960000}
    assert b12["steps"][2]["refs"] == {"route_option_id": "RT-C-DIR", "qty": 600}
    assert b12["steps"][3]["refs"] == {"inventory_source_id": "INV-PNQ", "to_location_id": "LOC-KAV-BLR", "qty": 150}
    assert b12["steps"][4]["refs"] == {"inventory_source_id": "INV-BLR", "order_id": "SO-1001", "qty": 150}
    assert b12["steps"][5]["refs"] == {"order_id": "SO-1001", "qty_late": 100, "days_late": 2}
    assert all(s["simulated"] and s["status"] == "succeeded" for s in b12["steps"])

    # Step 13: Second execution with new key is refused
    r13 = client.post(
        "/api/v1/plans/PLN-0002/executions",
        headers={"X-Actor-Id": "USR-PRIYA", "Idempotency-Key": "exe-p2-02"},
        json={"decision_id": "DEC-0001"},
    )
    assert r13.status_code == 409
    b13 = r13.json()
    assert b13["code"] == "ALREADY_EXECUTED"

    # Step 14: Plan shows completed
    r14 = client.get("/api/v1/plans/PLN-0002")
    assert r14.status_code == 200
    b14 = r14.json()
    assert b14["status"] == "completed"
    assert b14["plan_hash"] == plan_hash_p2
    assert b14["decision_ids"] == ["DEC-0001"]
    assert b14["execution_id"] == "EXE-0001"

    # Step 15: Audit trail complete and ordered
    r15 = client.get("/api/v1/audit-events?limit=200")
    assert r15.status_code == 200
    b15 = r15.json()
    events = b15["events"]
    assert len(events) == 26
    assert [e["seq"] for e in events] == list(range(1, 27))

    expected_types = [
        "DEMO_RESET",
        "EVALUATION_REQUESTED",
        *(["AGENT_STEP_SUCCEEDED"] * 7),
        "PLAN_CREATED",
        "PLAN_CREATED",
        "EVALUATION_COMPLETED",
        "DECISION_REFUSED",
        "EXECUTION_REFUSED",
        "DECISION_REFUSED",
        "DECISION_RECORDED",
        "DECISION_REFUSED",
        "EXECUTION_REQUESTED",
        *(["EXECUTION_STEP_SUCCEEDED"] * 6),
        "EXECUTION_COMPLETED",
        "EXECUTION_REFUSED",
    ]
    actual_types = [e["event_type"] for e in events]
    assert actual_types == expected_types

    # Step 16: Audit hash chain verifies
    r16 = client.get("/api/v1/audit-events/verify")
    assert r16.status_code == 200
    b16 = r16.json()
    assert b16["valid"] is True
    assert b16["first_invalid_seq"] is None
    assert b16["checked_events"] == 26
