import json
from datetime import datetime, timezone
from typing import Any
from fastapi.responses import JSONResponse

from .fixtures import canonical_json, digest
from ..audit.chain import append_event
from ..api.problems import problem_response


def decide_plan(
    con,
    fx: dict[str, Any],
    plan_id: str,
    x_actor_id: str,
    idempotency_key: str,
    body: dict[str, Any],
    path: str,
) -> tuple[int, dict[str, Any] | JSONResponse, dict[str, str] | None]:
    actors_by_id = {a["actor_id"]: a for a in fx["policies"]["demo_actors"]}
    actor = actors_by_id.get(x_actor_id)
    if not actor:
        return 400, problem_response(400, "ACTOR_REQUIRED", f"Unknown actor {x_actor_id}", instance=path), None
    if actor["role"] == "viewer":
        return 403, problem_response(403, "ROLE_FORBIDDEN", "Viewer role cannot make decisions", instance=path), None

    if not idempotency_key or len(idempotency_key) < 8:
        return 400, problem_response(400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key must be at least 8 characters", instance=path), None

    actor_obj = {
        "actor_id": actor["actor_id"],
        "role": actor["role"],
        "kind": "human",
        "display_name": actor.get("display_name"),
    }
    request_hash = digest({"path": path, "actor_id": x_actor_id, "body": body})

    # 2. Idempotency replay check
    prev_idem = con.execute("SELECT request_hash, response_json, status_code FROM idempotency WHERE key=?", (idempotency_key,)).fetchone()
    if prev_idem:
        if prev_idem["request_hash"] != request_hash:
            return 409, problem_response(409, "IDEMPOTENCY_KEY_REUSED", "Idempotency key reused with different request body", instance=path), None
        return 200, json.loads(prev_idem["response_json"]), {"Idempotent-Replay": "true"}

    # 3. Plan exists
    plan_row = con.execute("SELECT plan_id, evaluation_id, version, status, plan_hash, payload_json FROM plans WHERE plan_id=?", (plan_id,)).fetchone()
    if not plan_row:
        return 404, problem_response(404, "NOT_FOUND", f"Plan {plan_id} does not exist", instance=path), None

    plan = json.loads(plan_row["payload_json"])
    plan_version = plan["version"]
    plan_hash = plan["plan_hash"]
    action = body.get("action")

    # 4. Plan superseded
    if plan["status"] == "superseded":
        append_event(con, "DECISION_REFUSED", actor_obj, {"type": "plan", "id": plan_id, "version": plan_version}, {"action": action, "code": "PLAN_SUPERSEDED"})
        return 409, problem_response(409, "PLAN_SUPERSEDED", f"Plan {plan_id} is superseded", instance=path, current={"status": "superseded"}), None

    # 5. Version and hash match
    if body.get("plan_version") != plan_version or body.get("plan_hash") != plan_hash:
        append_event(con, "DECISION_REFUSED", actor_obj, {"type": "plan", "id": plan_id, "version": plan_version}, {"action": action, "code": "PLAN_VERSION_STALE"})
        return 409, problem_response(
            409,
            "PLAN_VERSION_STALE",
            f"Plan {plan_id} version or hash does not match current plan",
            instance=path,
            current={"plan_version": plan_version, "plan_hash": plan_hash, "status": plan["status"]},
        ), None

    # 6. Plan already decided
    if plan["status"] in ("approved", "rejected", "executing", "completed", "failed"):
        append_event(con, "DECISION_REFUSED", actor_obj, {"type": "plan", "id": plan_id, "version": plan_version}, {"action": action, "code": "DECISION_EXISTS"})
        return 409, problem_response(
            409,
            "DECISION_EXISTS",
            f"Plan {plan_id} has already been decided",
            instance=path,
            current={"status": plan["status"]},
        ), None

    # 7. Action rules
    policy = fx["policies"]["approval_policy"]
    eval_row = con.execute("SELECT payload_json FROM evaluations WHERE evaluation_id=?", (plan_row["evaluation_id"],)).fetchone()
    evaluation = json.loads(eval_row["payload_json"]) if eval_row else {}
    findings_map = {f["finding_id"]: f for f in evaluation.get("findings", [])}

    amendment_request_id = None
    amendment_data = None
    if action == "approve":
        if actor["role"] not in policy["approver_roles"]:
            append_event(con, "DECISION_REFUSED", actor_obj, {"type": "plan", "id": plan_id, "version": plan_version}, {"action": action, "code": "ROLE_FORBIDDEN"})
            return 403, problem_response(403, "ROLE_FORBIDDEN", f"Role {actor['role']} cannot approve plans", instance=path), None

        if plan["status"] == "blocked":
            append_event(con, "DECISION_REFUSED", actor_obj, {"type": "plan", "id": plan_id, "version": plan_version}, {"action": action, "code": "PLAN_BLOCKED"})
            return 422, problem_response(422, "PLAN_BLOCKED", f"Plan {plan_id} is blocked and cannot be approved", instance=path), None

        needs_review_findings = [f_id for f_id in plan.get("finding_ids", []) if findings_map.get(f_id, {}).get("outcome") == "needs_review"]
        acks_by_fnd = {a["finding_id"]: a for a in body.get("acknowledgements", [])}
        for fid in needs_review_findings:
            if fid not in acks_by_fnd:
                append_event(con, "DECISION_REFUSED", actor_obj, {"type": "plan", "id": plan_id, "version": plan_version}, {"action": action, "code": "ACKNOWLEDGEMENT_REQUIRED"})
                return 422, problem_response(422, "ACKNOWLEDGEMENT_REQUIRED", f"Missing acknowledgement for finding {fid}", instance=path, errors=[{"path": "acknowledgements", "message": f"missing {fid}"}]), None

            ack_actor = actors_by_id.get(acks_by_fnd[fid]["actor_id"])
            if not ack_actor:
                append_event(con, "DECISION_REFUSED", actor_obj, {"type": "plan", "id": plan_id, "version": plan_version}, {"action": action, "code": "ROLE_FORBIDDEN"})
                return 403, problem_response(403, "ROLE_FORBIDDEN", f"Unknown acknowledging actor {acks_by_fnd[fid]['actor_id']}", instance=path), None

            finding_agent = findings_map.get(fid, {}).get("agent")
            allowed_roles = policy["acknowledgement_roles"].get(finding_agent, [])
            if ack_actor["role"] not in allowed_roles:
                append_event(con, "DECISION_REFUSED", actor_obj, {"type": "plan", "id": plan_id, "version": plan_version}, {"action": action, "code": "ROLE_FORBIDDEN"})
                return 403, problem_response(403, "ROLE_FORBIDDEN", f"Role {ack_actor['role']} cannot acknowledge findings for agent {finding_agent}", instance=path), None

        resulting_status = "approved"

    elif action == "reject":
        if actor["role"] not in policy["reject_roles"]:
            append_event(con, "DECISION_REFUSED", actor_obj, {"type": "plan", "id": plan_id, "version": plan_version}, {"action": action, "code": "ROLE_FORBIDDEN"})
            return 403, problem_response(403, "ROLE_FORBIDDEN", f"Role {actor['role']} cannot reject plans", instance=path), None

        if not body.get("justification") or len(body["justification"].strip()) < 10:
            return 400, problem_response(400, "VALIDATION_ERROR", "Rejection justification must be at least 10 characters", instance=path), None

        resulting_status = "rejected"

    elif action == "request_amendment":
        if actor["role"] not in policy["amendment_request_roles"]:
            append_event(con, "DECISION_REFUSED", actor_obj, {"type": "plan", "id": plan_id, "version": plan_version}, {"action": action, "code": "ROLE_FORBIDDEN"})
            return 403, problem_response(403, "ROLE_FORBIDDEN", f"Role {actor['role']} cannot request amendments", instance=path), None

        has_blocked_lc = any(
            fid.startswith("FND-LC-") and findings_map.get(fid, {}).get("outcome") == "blocked"
            for fid in plan.get("finding_ids", [])
        )
        if not has_blocked_lc:
            append_event(con, "DECISION_REFUSED", actor_obj, {"type": "plan", "id": plan_id, "version": plan_version}, {"action": action, "code": "NO_AMENDABLE_FINDING"})
            return 422, problem_response(422, "NO_AMENDABLE_FINDING", "No blocked letter-of-credit finding found on plan", instance=path), None

        if not body.get("justification") or len(body["justification"].strip()) < 10:
            return 422, problem_response(422, "VALIDATION_ERROR", "Amendment justification must be at least 10 characters", instance=path), None
        amendment_data = body.get("amendment")
        if not amendment_data:
            return 422, problem_response(422, "VALIDATION_ERROR", "Amendment details are required", instance=path), None
        lc_record = next(
            (lc for lc in fx["letters_of_credit"]["letters_of_credit"] if lc["lc_id"] == amendment_data["lc_id"]),
            None,
        )
        if lc_record is None:
            return 404, problem_response(404, "NOT_FOUND", f"Letter of credit {amendment_data['lc_id']} does not exist", instance=path), None
        if any(change["field_tag"] not in {"43T", "47A"} for change in amendment_data["requested_changes"]):
            return 422, problem_response(422, "VALIDATION_ERROR", "The demo can simulate changes to LC fields 43T and 47A only", instance=path), None

        n_amd = con.execute("SELECT count(*) n FROM amendment_requests").fetchone()["n"] + 1
        amendment_request_id = f"AMD-{n_amd:04d}"
        resulting_status = "blocked"
    else:
        return 400, problem_response(400, "VALIDATION_ERROR", f"Invalid action {action}", instance=path), None

    # 8. Commit
    dec_count = con.execute("SELECT count(*) n FROM decisions").fetchone()["n"] + 1
    decision_id = f"DEC-{dec_count:04d}"
    decided_at = datetime.now(timezone.utc).isoformat()

    decision_record = {
        "schema_version": "1.0.0",
        "decision_id": decision_id,
        "plan_id": plan_id,
        "plan_version": plan_version,
        "plan_hash": plan_hash,
        "action": action,
        "actor": actor_obj,
        "justification": body.get("justification"),
        "acknowledgements": body.get("acknowledgements", []),
        "decided_at": decided_at,
        "resulting_plan_status": resulting_status,
        "amendment_request_id": amendment_request_id,
        "idempotency_key": idempotency_key,
    }

    # Update plan
    plan["status"] = resulting_status
    if "decision_ids" not in plan:
        plan["decision_ids"] = []
    plan["decision_ids"].append(decision_id)
    if amendment_request_id:
        if "amendment_request_ids" not in plan:
            plan["amendment_request_ids"] = []
        plan["amendment_request_ids"].append(amendment_request_id)

    con.execute("UPDATE plans SET status=?, payload_json=? WHERE plan_id=?", (resulting_status, json.dumps(plan), plan_id))

    con.execute(
        """
        INSERT INTO decisions(decision_id, plan_id, plan_version, action, actor_id, role, idempotency_key, payload_json, decided_at)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (decision_id, plan_id, plan_version, action, actor["actor_id"], actor["role"], idempotency_key, json.dumps(decision_record), decided_at),
    )

    if amendment_request_id and amendment_data:
        amd_data = amendment_data
        amd_record = {
            "schema_version": "1.0.0",
            "amendment_request_id": amendment_request_id,
            "lc_id": amd_data["lc_id"],
            "lc_version": lc_record["version"],
            "plan_id": plan_id,
            "plan_version": plan_version,
            "decision_id": decision_id,
            "requested_changes": amd_data["requested_changes"],
            "status": "requested",
            "fee_inr": fx["policies"].get("cost_policy", {}).get("lc_amendment_fee_inr", 8000),
            "created_at": decided_at,
            "simulated": True,
        }
        con.execute(
            """
            INSERT INTO amendment_requests(amendment_request_id, plan_id, lc_id, lc_version, status, payload_json)
            VALUES(?, ?, ?, ?, ?, ?)
            """,
            (amendment_request_id, plan_id, amd_data["lc_id"], lc_record["version"], "requested", json.dumps(amd_record)),
        )
        append_event(
            con,
            "AMENDMENT_REQUESTED",
            actor_obj,
            {"type": "decision", "id": decision_id},
            {"plan_id": plan_id, "amendment_request_id": amendment_request_id, "lc_id": amd_data["lc_id"]},
        )

    append_event(
        con,
        "DECISION_RECORDED",
        actor_obj,
        {"type": "decision", "id": decision_id},
        {"plan_id": plan_id, "action": action, "plan_version": plan_version, "resulting_plan_status": resulting_status},
    )

    con.execute(
        """
        INSERT INTO idempotency(key, endpoint, request_hash, status_code, response_json, created_at)
        VALUES(?, ?, ?, ?, ?, ?)
        """,
        (idempotency_key, path, request_hash, 201, json.dumps(decision_record), decided_at),
    )

    return 201, decision_record, None
