import os
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app


def test_f07_post_amendment_p2_financials(tmp_path, monkeypatch):
    """F-07: post-amendment P2 financials 446000/25000/689000."""
    monkeypatch.setenv("AEGIS_LLM_MODE", "off")
    # LLM_MODE is bound at import time from .env (backend/app/config.py:10); patch it so a local live .env never makes network calls.
    monkeypatch.setattr("backend.app.main.LLM_MODE", "off")
    # DB_PATH is bound at import time (backend/app/db/sqlite.py:4); patch the module attribute.
    monkeypatch.setattr("backend.app.db.sqlite.DB_PATH", tmp_path / "test_amend.sqlite3")

    c = TestClient(app)
    P = {"X-Actor-Id": "USR-PRIYA"}
    A = {"X-Actor-Id": "USR-ARJUN"}

    # Reset demo state
    r_reset = c.post("/api/v1/demo/reset", headers=P)
    assert r_reset.status_code == 200

    # First evaluation
    r_ev1 = c.post(
        "/api/v1/evaluations",
        headers={**P, "Idempotency-Key": "eval-a-0001"},
        json={"disruption_id": "DIS-2026-0042"},
    )
    assert r_ev1.status_code == 202

    # Get plan hash
    plan1 = c.get("/api/v1/plans/PLN-0001").json()
    h = plan1["plan_hash"]

    # Request amendment on LC-SYN-0117
    r_dec = c.post(
        "/api/v1/plans/PLN-0001/decisions",
        headers={**A, "Idempotency-Key": "dec-amd-0001"},
        json={
            "action": "request_amendment",
            "plan_version": 1,
            "plan_hash": h,
            "justification": "Ask the bank to allow transhipment via Singapore.",
            "acknowledgements": [],
            "amendment": {
                "lc_id": "LC-SYN-0117",
                "requested_changes": [
                    {"field_tag": "43T", "from": "NOT ALLOWED", "to": "ALLOWED"},
                    {"field_tag": "47A", "from": "UCP 600 SUB-ARTICLE 20(C) IS EXCLUDED.", "to": "(deleted)"},
                ],
            },
        },
    )
    assert r_dec.status_code == 201
    amd_id = r_dec.json()["amendment_request_id"]
    fee = c.get(f"/api/v1/amendment-requests/{amd_id}").json().get("fee_inr")
    assert fee == 8000

    # Simulate acceptance
    r_acc = c.post(
        f"/api/v1/demo/amendment-requests/{amd_id}/simulate-acceptance",
        headers={**A, "Idempotency-Key": "amd-acc-0001"},
    )
    assert r_acc.status_code == 200

    # Second evaluation after amendment acceptance
    r_ev2 = c.post(
        "/api/v1/evaluations",
        headers={**P, "Idempotency-Key": "eval-a-0002"},
        json={"disruption_id": "DIS-2026-0042"},
    )
    assert r_ev2.status_code == 202

    ev = c.get("/api/v1/evaluations/EVAL-0002").json()
    plans = {p["plan_id"]: p for p in ev["plans"]}

    # P1 (PLN-0003) remains blocked and does not get the fee line
    p1 = plans["PLN-0003"]
    assert p1["outcome"] == "blocked"
    assert p1["financials"]["recovery_cost_inr"] == 334000
    assert p1["financials"]["residual_loss_inr"] == 0
    assert p1["financials"]["net_avoided_loss_inr"] == 826000
    assert not any(b["category"] == "lc_amendment_fee" and b["amount_inr"] > 0 for b in p1["financials"]["cost_breakdown"])

    # P2 (PLN-0004) is passed with VC-AMEND-01 financials
    p2 = plans["PLN-0004"]
    assert p2["outcome"] == "passed"
    f2 = p2["financials"]
    assert f2["recovery_cost_inr"] == 446000
    assert f2["residual_loss_inr"] == 25000
    assert f2["net_avoided_loss_inr"] == 689000

    # extra_costs_verified lc_amendment_fee of 8000
    amend_fee_lines = [b for b in f2.get("cost_breakdown", []) if b["category"] == "lc_amendment_fee"]
    assert amend_fee_lines == [{"category": "lc_amendment_fee", "amount_inr": 8000}]
