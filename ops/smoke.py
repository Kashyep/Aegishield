#!/usr/bin/env python3
"""AegisShield end-to-end smoke test.

Python stdlib only.
Usage:
    python ops/smoke.py BASE_URL [--reset-token TOKEN]
"""

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
import uuid


def http_request(
    url: str,
    method: str = "GET",
    headers: dict | None = None,
    data: dict | None = None,
    timeout: float = 15.0,
) -> tuple[int, dict]:
    req_headers = {"Accept": "application/json"}
    if headers:
        req_headers.update(headers)
    body_bytes = None
    if data is not None:
        body_bytes = json.dumps(data).encode("utf-8")
        req_headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=body_bytes, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            status = getattr(resp, "status", getattr(resp, "code", 200))
            raw = resp.read().decode("utf-8")
            parsed = json.loads(raw) if raw else {}
            return status, parsed
    except urllib.error.HTTPError as e:
        status = e.code
        try:
            raw = e.read().decode("utf-8")
            parsed = json.loads(raw) if raw else {}
        except Exception:
            parsed = {"raw": raw[:200] if "raw" in locals() else str(e)}
        return status, parsed
    except urllib.error.URLError as e:
        raise RuntimeError(f"Connection error to {url}: {e.reason}") from e


def step_health(base_url: str) -> dict:
    url = f"{base_url}/api/v1/health"
    try:
        status, data = http_request(url)
    except Exception as e:
        print(f"FAIL health: {e}")
        sys.exit(1)

    if status != 200 or data.get("status") != "ok":
        print(f"FAIL health: unexpected response status={status}, body={data}")
        sys.exit(1)

    llm_mode = data.get("llm_mode")
    demo_mode = data.get("demo_mode")
    contract_version = data.get("contract_version")
    print(f"PASS health (llm_mode={llm_mode}, demo_mode={demo_mode}, contract_version={contract_version})")
    return data


def step_scenario(base_url: str) -> str:
    url = f"{base_url}/api/v1/scenario"
    try:
        status, data = http_request(url)
    except Exception as e:
        print(f"FAIL scenario: {e}")
        sys.exit(1)

    if status != 200 or "scenario" not in data:
        print(f"FAIL scenario: unexpected status={status}, body={data}")
        sys.exit(1)

    scenario_obj = data.get("scenario", {})
    disruption_id = scenario_obj.get("primary_disruption_id")
    if not disruption_id:
        disruptions = data.get("disruptions", {}).get("events", [])
        if disruptions:
            disruption_id = disruptions[0].get("disruption_id")
        else:
            disruption_id = "DIS-2026-0042"

    print("PASS scenario")
    return disruption_id


def step_reset(base_url: str, reset_token: str | None) -> dict:
    url = f"{base_url}/api/v1/demo/reset"
    headers = {
        "X-Actor-Id": "USR-PRIYA",
        "Idempotency-Key": f"smoke-reset-{uuid.uuid4()}",
    }
    if reset_token:
        headers["X-Reset-Token"] = reset_token

    try:
        status, data = http_request(url, method="POST", headers=headers)
    except Exception as e:
        print(f"FAIL reset: {e}")
        sys.exit(1)

    if status != 200 or not data.get("counters_reset"):
        print(f"FAIL reset: status={status}, body={data}")
        sys.exit(1)

    print("PASS reset")
    return data


def step_evaluation(base_url: str, disruption_id: str) -> dict:
    url = f"{base_url}/api/v1/evaluations"
    headers = {
        "X-Actor-Id": "USR-PRIYA",
        "Idempotency-Key": f"smoke-eval-{uuid.uuid4()}",
    }
    body = {"disruption_id": disruption_id}

    try:
        status, data = http_request(url, method="POST", headers=headers, data=body)
    except Exception as e:
        print(f"FAIL evaluation: {e}")
        sys.exit(1)

    if status != 202:
        print(f"FAIL evaluation: create failed with status={status}, body={data}")
        sys.exit(1)

    poll_path = data.get("poll_url")
    if not poll_path:
        eval_id = data.get("evaluation_id", "EVAL-0001")
        poll_path = f"/api/v1/evaluations/{eval_id}"

    poll_url = poll_path if poll_path.startswith("http") else f"{base_url}{poll_path}"

    start_time = time.time()
    eval_result = None
    while time.time() - start_time < 60.0:
        try:
            p_status, p_data = http_request(poll_url)
            if p_status == 200:
                state = p_data.get("status")
                if state == "completed":
                    eval_result = p_data
                    break
                if state in ("failed", "error"):
                    print(f"FAIL evaluation: evaluation status marked as {state}")
                    sys.exit(1)
        except Exception as e:
            print(f"FAIL evaluation: polling error: {e}")
            sys.exit(1)
        time.sleep(1.0)

    if not eval_result:
        print("FAIL evaluation: timed out polling after 60s")
        sys.exit(1)

    print("PASS evaluation")
    return eval_result


def step_comparison(eval_result: dict) -> tuple[dict, dict]:
    plans = eval_result.get("plans", [])
    p1 = None
    p2 = None
    for p in plans:
        label = p.get("label", "")
        plan_id = p.get("plan_id", "")
        if "P1" in label or plan_id == "PLN-0001":
            p1 = p
        elif "P2" in label or plan_id == "PLN-0002":
            p2 = p

    if not p1 or not p2:
        print("FAIL comparison: could not identify P1 and P2 plans in evaluation")
        sys.exit(1)

    p1_outcome = p1.get("outcome")
    p2_outcome = p2.get("outcome")

    comp_plans = eval_result.get("comparison", {}).get("plans", [])
    comp_p1 = next((cp for cp in comp_plans if cp.get("plan_id") == p1.get("plan_id")), None)
    comp_p2 = next((cp for cp in comp_plans if cp.get("plan_id") == p2.get("plan_id")), None)

    if comp_p1 and comp_p1.get("outcome") != "blocked":
        print(f"FAIL comparison: comparison P1 outcome is {comp_p1.get('outcome')}, expected blocked")
        sys.exit(1)
    if comp_p2 and comp_p2.get("outcome") != "passed":
        print(f"FAIL comparison: comparison P2 outcome is {comp_p2.get('outcome')}, expected passed")
        sys.exit(1)

    if p1_outcome != "blocked":
        print(f"FAIL comparison: P1 outcome is {p1_outcome}, expected blocked")
        sys.exit(1)
    if p2_outcome != "passed":
        print(f"FAIL comparison: P2 outcome is {p2_outcome}, expected passed")
        sys.exit(1)

    print("PASS comparison")
    return p1, p2


def step_approve(base_url: str, p2: dict) -> str:
    p2_id = p2.get("plan_id", "PLN-0002")
    url = f"{base_url}/api/v1/plans/{p2_id}/decisions"
    headers = {
        "X-Actor-Id": "USR-PRIYA",
        "Idempotency-Key": f"smoke-approve-{uuid.uuid4()}",
    }
    body = {
        "action": "approve",
        "plan_version": p2.get("version", 1),
        "plan_hash": p2["plan_hash"],
        "justification": "Independent supplier, direct route, all checks passed.",
        "acknowledgements": [],
    }

    try:
        status, data = http_request(url, method="POST", headers=headers, data=body)
    except Exception as e:
        print(f"FAIL approve: {e}")
        sys.exit(1)

    if status not in (200, 201) or data.get("resulting_plan_status") != "approved":
        print(f"FAIL approve: status={status}, body={data}")
        sys.exit(1)

    decision_id = data.get("decision_id")
    if not decision_id:
        print(f"FAIL approve: decision_id missing in response: {data}")
        sys.exit(1)

    print("PASS approve")
    return decision_id


def step_execute(base_url: str, p2: dict, decision_id: str) -> dict:
    p2_id = p2.get("plan_id", "PLN-0002")
    url = f"{base_url}/api/v1/plans/{p2_id}/executions"
    headers = {
        "X-Actor-Id": "USR-PRIYA",
        "Idempotency-Key": f"smoke-exe-{uuid.uuid4()}",
    }
    body = {"decision_id": decision_id}

    try:
        status, data = http_request(url, method="POST", headers=headers, data=body)
    except Exception as e:
        print(f"FAIL execute: {e}")
        sys.exit(1)

    if status != 202:
        print(f"FAIL execute: execution start failed with status={status}, body={data}")
        sys.exit(1)

    execution_id = data.get("execution_id")
    if not execution_id:
        print(f"FAIL execute: execution_id missing in response: {data}")
        sys.exit(1)

    poll_url = f"{base_url}/api/v1/executions/{execution_id}"
    start_time = time.time()
    exec_result = None
    while time.time() - start_time < 60.0:
        try:
            p_status, p_data = http_request(poll_url)
            if p_status == 200:
                state = p_data.get("status")
                if state == "completed":
                    exec_result = p_data
                    break
                if state in ("failed", "error"):
                    print(f"FAIL execute: execution status marked as {state}")
                    sys.exit(1)
        except Exception as e:
            print(f"FAIL execute: polling error: {e}")
            sys.exit(1)
        time.sleep(1.0)

    if not exec_result:
        print("FAIL execute: timed out polling after 60s")
        sys.exit(1)

    steps = exec_result.get("steps", [])
    if not steps or not all(s.get("status") == "succeeded" for s in steps):
        print(f"FAIL execute: not all execution steps succeeded: {steps}")
        sys.exit(1)

    print("PASS execute")
    return exec_result


def step_audit_verify(base_url: str) -> dict:
    url = f"{base_url}/api/v1/audit-events/verify"
    try:
        status, data = http_request(url)
    except Exception as e:
        print(f"FAIL audit verify: {e}")
        sys.exit(1)

    if status != 200:
        print(f"FAIL audit verify: status={status}, body={data}")
        sys.exit(1)

    if not data.get("valid") or data.get("first_invalid_seq") is not None:
        print(f"FAIL audit verify: valid={data.get('valid')}, first_invalid_seq={data.get('first_invalid_seq')}")
        sys.exit(1)

    print("PASS audit verify")
    return data


def main() -> None:
    parser = argparse.ArgumentParser(description="Smoke test for AegisShield deployment")
    parser.add_argument("base_url", help="Base URL of the service (e.g. http://127.0.0.1:8000)")
    parser.add_argument(
        "--reset-token",
        default=os.getenv("AEGIS_RESET_TOKEN"),
        help="Demo reset token (defaults to AEGIS_RESET_TOKEN env var)",
    )
    args = parser.parse_args()
    base_url = args.base_url.rstrip("/")
    reset_token = args.reset_token

    step_health(base_url)
    disruption_id = step_scenario(base_url)
    step_reset(base_url, reset_token)
    eval_result = step_evaluation(base_url, disruption_id)
    p1, p2 = step_comparison(eval_result)
    decision_id = step_approve(base_url, p2)
    step_execute(base_url, p2, decision_id)
    step_audit_verify(base_url)
    sys.exit(0)


if __name__ == "__main__":
    main()
