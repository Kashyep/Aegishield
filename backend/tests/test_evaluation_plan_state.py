from fastapi.testclient import TestClient

from backend.app.main import app


def test_approval_is_visible_in_evaluation_read(tmp_path, monkeypatch):
    """Approving a plan persists: GET /evaluations/{id} shows the plan's current status, not the stored evaluation snapshot."""
    monkeypatch.setenv("AEGIS_LLM_MODE", "off")
    monkeypatch.setattr("backend.app.main.LLM_MODE", "off")
    monkeypatch.setattr("backend.app.db.sqlite.DB_PATH", tmp_path / "test_plan_state.sqlite3")

    c = TestClient(app)
    P = {"X-Actor-Id": "USR-PRIYA"}

    assert c.post("/api/v1/demo/reset", headers=P).status_code == 200
    r_ev = c.post("/api/v1/evaluations", headers={**P, "Idempotency-Key": "eval-plan-state-0001"},
                  json={"disruption_id": "DIS-2026-0042"})
    assert r_ev.status_code == 202
    evaluation_id = r_ev.json()["evaluation_id"]

    before = c.get(f"/api/v1/evaluations/{evaluation_id}").json()
    p2_before = next(p for p in before["plans"] if p["plan_id"] == "PLN-0002")
    assert p2_before["status"] == "pending_approval"
    plan_hash = p2_before["plan_hash"]

    r_dec = c.post(
        "/api/v1/plans/PLN-0002/decisions",
        headers={**P, "Idempotency-Key": "dec-plan-state-0001"},
        json={"action": "approve", "plan_version": p2_before["version"], "plan_hash": plan_hash,
              "justification": None, "acknowledgements": []},
    )
    assert r_dec.status_code == 201, r_dec.text
    decision_id = r_dec.json()["decision_id"]

    after = c.get(f"/api/v1/evaluations/{evaluation_id}")
    assert after.status_code == 200
    p2_after = next(p for p in after.json()["plans"] if p["plan_id"] == "PLN-0002")
    assert p2_after["status"] == "approved"
    assert p2_after["decision_ids"] == [decision_id]
    assert p2_after["plan_hash"] == plan_hash  # overlay never changes hashed content

    # Overlay agrees with the plan endpoint, and the other plans are untouched.
    assert c.get("/api/v1/plans/PLN-0002").json()["status"] == "approved"
    for p_before, p_after in zip(before["plans"], after.json()["plans"]):
        if p_before["plan_id"] != "PLN-0002":
            assert p_after["status"] == p_before["status"]
            assert p_after["plan_hash"] == p_before["plan_hash"]
