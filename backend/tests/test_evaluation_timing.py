"""Tests for Phase B evaluation step timing (Item B2 / F-24).

Covers:
- B2 (F-24): Real per-step duration_ms, valid timestamps, and accurate statuses for steps 1-7.
- Determinism Invariant: Plan hashes remain byte-identical to golden outputs and timing excluded from plan_hash_material.
"""
import datetime as dt
import json
import pytest

from conftest import golden, load_fx
from backend.app.services.evaluation import (
    build_evaluation_payload,
    evaluate,
    plan_hash_material,
)


def test_steps_have_real_duration_ms_valid_timestamps_and_accurate_statuses():
    """B2 (F-24): Steps 1-6 and step 7 record real duration_ms, valid timestamps, and accurate statuses."""
    fx = load_fx()
    started_at = dt.datetime.now(dt.timezone.utc).isoformat()
    payload = build_evaluation_payload(
        fx=fx,
        disruption_id="DIS-2026-0042",
        evaluation_id="EVAL-0001",
        plan_ids=("PLN-0001", "PLN-0002"),
        llm_mode="off",
        started_at=started_at,
    )

    steps = payload["steps"]
    assert len(steps) == 7

    expected_steps = [
        (1, "disruption_sensing", "member_1", "gold"),
        (2, "supplier_dependency", "member_4", "deterministic"),
        (3, "routing", "member_1", "deterministic"),
        (4, "inventory_rebalancing", "member_1", "deterministic"),
        (5, "trade_compliance", "member_4", "deterministic"),
        (6, "plan_assembly", "member_4", "deterministic"),
        (7, "explanation", "member_3", "template"),
    ]

    for (exp_seq, exp_name, exp_owner, exp_mode), step in zip(expected_steps, steps):
        assert step["seq"] == exp_seq
        assert step["step"] == exp_name
        assert step["owner"] == exp_owner
        assert step["mode"] == exp_mode
        assert step["status"] == "succeeded"
        assert step["attempts"] == 1
        assert step["error"] is None

        # Verify real duration_ms is recorded and >= 0
        assert isinstance(step["duration_ms"], int)
        assert step["duration_ms"] >= 0

        # Verify ISO 8601 timestamps
        assert step["started_at"] is not None
        assert step["finished_at"] is not None
        s_dt = dt.datetime.fromisoformat(step["started_at"])
        f_dt = dt.datetime.fromisoformat(step["finished_at"])
        assert s_dt.tzinfo is not None
        assert f_dt.tzinfo is not None
        assert f_dt >= s_dt


def test_step_status_reflects_degraded_sensing_outcome():
    """B2 (F-24): Step status accurately reflects actual outcome (e.g. degraded sensing)."""
    fx = load_fx()
    evt = copy = json.loads(json.dumps(fx["disruptions"]["events"][0]))
    evt["raw_text"] = "Unknown supplier disruption at an unregistered location."
    evt["gold_extraction"]["root_cause"]["facility_alias"] = "NonExistent Fab"
    fx["disruptions"]["events"] = [evt]

    started_at = dt.datetime.now(dt.timezone.utc).isoformat()
    payload = build_evaluation_payload(
        fx=fx,
        disruption_id="DIS-2026-0042",
        evaluation_id="EVAL-0001",
        plan_ids=("PLN-0001", "PLN-0002"),
        llm_mode="off",
        started_at=started_at,
    )

    steps = payload["steps"]
    step1 = steps[0]
    assert step1["step"] == "disruption_sensing"
    assert step1["status"] == "degraded"
    assert step1["error"] is not None
    assert step1["error"]["code"] == "SENSING_DEGRADED"


def test_determinism_plan_hashes_byte_identical_to_golden():
    """Determinism invariant: Plan hashes remain byte-identical to golden evaluation hashes."""
    fx = load_fx()
    res = evaluate(
        fx=fx,
        disruption_id="DIS-2026-0042",
        evaluation_id="EVAL-0001",
        plan_ids=("PLN-0001", "PLN-0002"),
    )

    golden_eval = golden("evaluation_EVAL-0001.json")
    golden_plans = {p["plan_id"]: p for p in golden_eval["plans"]}

    for plan in res["plans"]:
        pid = plan["plan_id"]
        assert pid in golden_plans
        assert plan["plan_hash"] == golden_plans[pid]["plan_hash"], (
            f"Plan hash mismatch for {pid}: computed {plan['plan_hash']} vs golden {golden_plans[pid]['plan_hash']}"
        )

        material = plan_hash_material(plan)
        material_str = json.dumps(material)
        for volatile_key in ("started_at", "finished_at", "duration_ms", "completed_at", "steps"):
            assert volatile_key not in material_str
