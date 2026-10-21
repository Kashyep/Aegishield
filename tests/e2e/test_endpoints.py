import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_scenario_and_disruptions(client):
    # Reset first
    r_reset = client.post("/api/v1/demo/reset", headers={"X-Actor-Id": "USR-PRIYA"})
    assert r_reset.status_code == 200

    # Scenario
    r_scen = client.get("/api/v1/scenario")
    assert r_scen.status_code == 200
    b_scen = r_scen.json()
    assert "scenario" in b_scen
    assert "customer_orders" in b_scen
    assert "suppliers" in b_scen
    assert len(b_scen["actors"]) == 3

    # Disruptions list
    r_dis = client.get("/api/v1/disruptions")
    assert r_dis.status_code == 200
    b_dis = r_dis.json()
    assert "items" in b_dis
    assert len(b_dis["items"]) >= 1
    assert b_dis["items"][0]["disruption_id"] == "DIS-2026-0042"

    # Single disruption
    r_single = client.get("/api/v1/disruptions/DIS-2026-0042")
    assert r_single.status_code == 200
    assert r_single.json()["disruption_id"] == "DIS-2026-0042"

    # Unknown disruption 404
    r_unk = client.get("/api/v1/disruptions/DIS-0000-0000")
    assert r_unk.status_code == 404
    assert r_unk.headers.get("content-type") == "application/problem+json"


def test_graph_and_rules(client):
    # Reset & Evaluate
    client.post("/api/v1/demo/reset", headers={"X-Actor-Id": "USR-PRIYA"})
    client.post(
        "/api/v1/evaluations",
        headers={"X-Actor-Id": "USR-PRIYA", "Idempotency-Key": "eval-demo-0002"},
        json={"disruption_id": "DIS-2026-0042"},
    )

    # Graph
    r_graph = client.get("/api/v1/evaluations/EVAL-0001/graph?focus_supplier_id=SUP-B")
    assert r_graph.status_code == 200
    b_graph = r_graph.json()
    assert "nodes" in b_graph
    assert len(b_graph["nodes"]) > 0
    assert "edges" in b_graph

    # Rules applicability
    rq = {
        "query_id": "RQ-TEST-01",
        "jurisdiction": "IN",
        "rule_types": ["tariff_mfn"],
        "hs_code": "HS-SYN-8504.90",
        "origin_country": "VN",
        "transit_countries": [],
        "agreement_id": "AIFTA",
        "applicable_on": "2026-10-31",
        "known_as_of": "2026-10-26",
    }
    r_rule = client.post("/api/v1/rules/applicability", json=rq)
    assert r_rule.status_code == 200
    b_rule = r_rule.json()
    assert b_rule["schema_version"] == "1.0.0"
    assert b_rule["outcome"] == "resolved"
    assert len(b_rule["applicable"]) >= 1


def test_amendment_request_flow(client):
    # Reset & Evaluate
    client.post("/api/v1/demo/reset", headers={"X-Actor-Id": "USR-PRIYA"})
    original_snapshot = client.get("/api/v1/health").json()["input_snapshot_id"]
    r_eval = client.post(
        "/api/v1/evaluations",
        headers={"X-Actor-Id": "USR-PRIYA", "Idempotency-Key": "eval-demo-0003"},
        json={"disruption_id": "DIS-2026-0042"},
    )
    assert r_eval.status_code == 202

    # Get P1 plan hash
    p1 = client.get("/api/v1/plans/PLN-0001").json()
    p1_hash = p1["plan_hash"]

    # Request amendment on P1 with trade compliance officer
    r_amd_dec = client.post(
        "/api/v1/plans/PLN-0001/decisions",
        headers={"X-Actor-Id": "USR-ARJUN", "Idempotency-Key": "dec-p1-amd-01"},
        json={
            "action": "request_amendment",
            "plan_version": 1,
            "plan_hash": p1_hash,
            "justification": "Ask the bank to allow transhipment via Singapore for Saigon shipment.",
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
    assert r_amd_dec.status_code == 201
    b_amd_dec = r_amd_dec.json()
    amd_id = b_amd_dec["amendment_request_id"]
    assert amd_id is not None
    assert amd_id.startswith("AMD-")

    # Get amendment request
    r_get_amd = client.get(f"/api/v1/amendment-requests/{amd_id}")
    assert r_get_amd.status_code == 200
    b_get_amd = r_get_amd.json()
    assert b_get_amd["status"] == "requested"
    assert b_get_amd["lc_id"] == "LC-SYN-0117"

    # Simulate acceptance
    r_accept = client.post(
        f"/api/v1/demo/amendment-requests/{amd_id}/simulate-acceptance",
        headers={"X-Actor-Id": "USR-ARJUN", "Idempotency-Key": "amd-accept-01"},
    )
    assert r_accept.status_code == 200
    assert r_accept.json()["status"] == "simulated_accepted"
    assert r_accept.json()["lc_version"] == 2

    # Acceptance is idempotent and applies its LC changes to the running scenario.
    r_replay = client.post(
        f"/api/v1/demo/amendment-requests/{amd_id}/simulate-acceptance",
        headers={"X-Actor-Id": "USR-ARJUN", "Idempotency-Key": "amd-accept-01"},
    )
    assert r_replay.status_code == 200
    assert r_replay.headers.get("Idempotent-Replay") == "true"
    lc = client.get("/api/v1/scenario").json()["letters_of_credit"][0]
    assert lc["version"] == 2
    assert lc["structured"]["transhipment"]["value"] == "allowed"
    assert lc["structured"]["ucp_20c_excluded"]["value"] is False

    before_hash = client.get("/api/v1/plans/PLN-0002").json()["plan_hash"]
    r_eval2 = client.post(
        "/api/v1/evaluations",
        headers={"X-Actor-Id": "USR-PRIYA", "Idempotency-Key": "eval-after-amend-01"},
        json={"disruption_id": "DIS-2026-0042"},
    )
    assert r_eval2.status_code == 202
    assert r_eval2.json()["evaluation_id"] == "EVAL-0002"
    assert set(r_eval2.json()["superseded_plan_ids"]) == {"PLN-0001", "PLN-0002"}
    updated_eval = client.get("/api/v1/evaluations/EVAL-0002").json()
    assert updated_eval["input_snapshot_id"] != original_snapshot
    assert updated_eval["plans"][0]["plan_hash"] != before_hash
