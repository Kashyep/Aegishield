import json
import os
from datetime import datetime, timezone
from typing import Any
from fastapi.responses import JSONResponse

from .fixtures import canonical_json, digest
from ..audit.chain import append_event
from ..api.problems import problem_response


def generate_execution_steps(fx: dict[str, Any], plan: dict[str, Any], evaluation: dict[str, Any]) -> list[dict[str, Any]]:
    steps = []
    lines = plan.get("lines", [])
    
    # 1. REDUCE_PO
    # Disrupted PO from event
    disruptions = fx.get("disruptions", {}).get("events", [])
    disruption = next((d for d in disruptions if d["disruption_id"] == evaluation.get("disruption_id")), disruptions[0] if disruptions else None)
    po_id = "PO-7001"
    from_qty = 900
    if disruption and "gold_extraction" in disruption:
        po_ids = disruption["gold_extraction"].get("affected_po_ids", [])
        if po_ids:
            po_id = po_ids[0]

    # Find total units bought from supplier quotes
    supplier_options = {opt["option_id"]: opt for opt in evaluation.get("options", []) if opt.get("kind") == "supplier"}
    supplier_units = sum(line["qty"] for line in lines if line["option_id"] in supplier_options)
    to_qty = max(0, from_qty - supplier_units)

    steps.append({
        "seq": 1,
        "step_type": "REDUCE_PO",
        "refs": {"po_id": po_id, "from_qty": from_qty, "to_qty": to_qty},
        "description": f"Reduce delayed {po_id} from {from_qty} to {to_qty} units under its force-majeure clause (simulated)",
        "status": "pending",
        "simulated": True,
        "proposed_sap_mapping": "S/4HANA purchase order change",
        "error": None,
    })

    # 2. CREATE_PO per quote
    quotes_by_id = {q["quote_id"]: q for q in fx.get("supplier_quotes", {}).get("quotes", [])}
    routes_by_id = {r["route_option_id"]: r for r in fx.get("route_options", {}).get("route_options", [])}
    
    quote_qty: dict[str, int] = {}
    for line in lines:
        opt = supplier_options.get(line["option_id"])
        if opt and opt.get("quote_id"):
            qid = opt["quote_id"]
            quote_qty[qid] = quote_qty.get(qid, 0) + line["qty"]

    seq = 2
    for qid, qty in quote_qty.items():
        q = quotes_by_id.get(qid, {})
        supplier_id = q.get("supplier_id", "SUP-C")
        supplier_name = next((s["name"] for s in fx.get("master_data", {}).get("suppliers", []) if s["supplier_id"] == supplier_id), "Saigon Precision Electronics")
        part_id = q.get("part_id", "PM-750")
        unit_price = q.get("unit_price_inr", 6600)
        lc_id = "LC-SYN-0117"
        lc_drawing = qty * unit_price
        steps.append({
            "seq": seq,
            "step_type": "CREATE_PO",
            "refs": {
                "supplier_id": supplier_id,
                "quote_id": qid,
                "qty": qty,
                "unit_price_inr": unit_price,
                "lc_id": lc_id,
                "lc_drawing_inr": lc_drawing,
            },
            "description": f"Create PO for {qty} {part_id} from {supplier_name} under {lc_id} (simulated)",
            "status": "pending",
            "simulated": True,
            "proposed_sap_mapping": "S/4HANA purchase order with SAP Global Trade Services documentary credit reference",
            "error": None,
        })
        seq += 1

    # 3. BOOK_FREIGHT per route
    route_qty: dict[str, int] = {}
    for line in lines:
        opt = supplier_options.get(line["option_id"])
        if opt and opt.get("route_option_id"):
            rid = opt["route_option_id"]
            route_qty[rid] = route_qty.get(rid, 0) + line["qty"]

    for rid, qty in route_qty.items():
        r = routes_by_id.get(rid, {})
        origin = r.get("origin_port_id", "VNSGN")
        dest = r.get("destination_port_id", "INMAA")
        etd = r.get("etd", "2026-10-29")
        steps.append({
            "seq": seq,
            "step_type": "BOOK_FREIGHT",
            "refs": {"route_option_id": rid, "qty": qty},
            "description": f"Book direct sailing {origin} to {dest} ETD {etd} (simulated)",
            "status": "pending",
            "simulated": True,
            "proposed_sap_mapping": "SAP Transportation Management freight order",
            "error": None,
        })
        seq += 1

    # 4. CREATE_STOCK_TRANSFER per inventory source with transfer_days > 0
    inv_positions = {p["inventory_source_id"]: p for p in fx.get("inventory", {}).get("positions", [])}
    for line in lines:
        opt_id = line["option_id"]
        if opt_id.startswith("OPT-INV-"):
            inv_id = opt_id.replace("OPT-", "")
            pos = inv_positions.get(inv_id, {})
            if pos.get("transfer_days", 0) > 0:
                steps.append({
                    "seq": seq,
                    "step_type": "CREATE_STOCK_TRANSFER",
                    "refs": {
                        "inventory_source_id": inv_id,
                        "to_location_id": "LOC-KAV-BLR",
                        "qty": line["qty"],
                    },
                    "description": f"Transfer {line['qty']} units Pune DC to Bengaluru plant (simulated)",
                    "status": "pending",
                    "simulated": True,
                    "proposed_sap_mapping": "S/4HANA stock transport order",
                    "error": None,
                })
                seq += 1

    # 5. RESERVE_STOCK per plant source and order
    for line in lines:
        opt_id = line["option_id"]
        if opt_id.startswith("OPT-INV-"):
            inv_id = opt_id.replace("OPT-", "")
            pos = inv_positions.get(inv_id, {})
            if pos.get("transfer_days", 0) == 0:
                steps.append({
                    "seq": seq,
                    "step_type": "RESERVE_STOCK",
                    "refs": {
                        "inventory_source_id": inv_id,
                        "order_id": line["order_id"],
                        "qty": line["qty"],
                    },
                    "description": f"Reserve {line['qty']} plant units for {line['order_id']} (simulated)",
                    "status": "pending",
                    "simulated": True,
                    "proposed_sap_mapping": "S/4HANA reservation",
                    "error": None,
                })
                seq += 1

    # 6. NOTIFY_CUSTOMER per order with late units
    orders_by_id = {o["order_id"]: o for o in fx.get("orders", {}).get("customer_orders", [])}
    late_orders: dict[str, dict[str, int]] = {}
    for line in lines:
        if line.get("days_late", 0) > 0:
            oid = line["order_id"]
            if oid not in late_orders:
                late_orders[oid] = {"qty_late": 0, "days_late": 0}
            late_orders[oid]["qty_late"] += line["qty"]
            late_orders[oid]["days_late"] = max(late_orders[oid]["days_late"], line["days_late"])

    for oid, info in late_orders.items():
        c_name = orders_by_id.get(oid, {}).get("customer_name", "customer")
        steps.append({
            "seq": seq,
            "step_type": "NOTIFY_CUSTOMER",
            "refs": {
                "order_id": oid,
                "qty_late": info["qty_late"],
                "days_late": info["days_late"],
            },
            "description": f"Draft notice to {c_name} that {info['qty_late']} units arrive {info['days_late']} days late (simulated, not sent)",
            "status": "pending",
            "simulated": True,
            "proposed_sap_mapping": "S/4HANA sales order delivery date update",
            "error": None,
        })
        seq += 1

    return steps


def execute_plan(
    con,
    fx: dict[str, Any],
    plan_id: str,
    x_actor_id: str,
    idempotency_key: str,
    body: dict[str, Any],
    path: str,
    current_snapshot_id: str,
) -> tuple[int, dict[str, Any] | JSONResponse, dict[str, str] | None]:
    actors_by_id = {a["actor_id"]: a for a in fx["policies"]["demo_actors"]}
    actor = actors_by_id.get(x_actor_id)
    if not actor:
        return 400, problem_response(400, "ACTOR_REQUIRED", f"Unknown actor {x_actor_id}", instance=path), None
    if actor["role"] == "viewer":
        return 403, problem_response(403, "ROLE_FORBIDDEN", "Viewer role cannot execute plans", instance=path), None

    if not idempotency_key or len(idempotency_key) < 8:
        return 400, problem_response(400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key must be at least 8 characters", instance=path), None

    actor_obj = {
        "actor_id": actor["actor_id"],
        "role": actor["role"],
        "kind": "human",
        "display_name": actor.get("display_name"),
    }
    request_hash = digest({"path": path, "actor_id": x_actor_id, "body": body})

    # 2. Idempotency replay
    prev_idem = con.execute("SELECT request_hash, response_json, status_code FROM idempotency WHERE key=?", (idempotency_key,)).fetchone()
    if prev_idem:
        if prev_idem["request_hash"] != request_hash:
            return 409, problem_response(409, "IDEMPOTENCY_KEY_REUSED", "Idempotency key reused with different request body", instance=path), None
        return 202, json.loads(prev_idem["response_json"]), {"Idempotent-Replay": "true"}

    # 3. Plan exists
    plan_row = con.execute("SELECT plan_id, evaluation_id, version, status, plan_hash, input_snapshot_id, payload_json FROM plans WHERE plan_id=?", (plan_id,)).fetchone()
    if not plan_row:
        return 404, problem_response(404, "NOT_FOUND", f"Plan {plan_id} does not exist", instance=path), None

    plan = json.loads(plan_row["payload_json"])
    plan_version = plan["version"]

    # 4. Plan status check
    if plan["status"] in ("executing", "completed", "failed"):
        append_event(con, "EXECUTION_REFUSED", actor_obj, {"type": "plan", "id": plan_id}, {"code": "ALREADY_EXECUTED"})
        return 409, problem_response(409, "ALREADY_EXECUTED", f"Plan {plan_id} was already executed", instance=path, current={"status": plan["status"]}), None

    if plan["status"] != "approved":
        append_event(con, "EXECUTION_REFUSED", actor_obj, {"type": "plan", "id": plan_id}, {"code": "NOT_APPROVED"})
        return 409, problem_response(409, "NOT_APPROVED", f"Plan {plan_id} is not approved (current status: {plan['status']})", instance=path, current={"status": plan["status"]}), None

    # 5. Decision id check
    decision_id = body.get("decision_id")
    if not decision_id or decision_id not in plan.get("decision_ids", []):
        append_event(con, "EXECUTION_REFUSED", actor_obj, {"type": "plan", "id": plan_id}, {"code": "NOT_APPROVED"})
        return 409, problem_response(409, "NOT_APPROVED", f"Decision {decision_id} is not the approving decision for plan {plan_id}", instance=path), None

    # 6. Snapshot id check
    if plan["input_snapshot_id"] != current_snapshot_id:
        append_event(con, "EXECUTION_REFUSED", actor_obj, {"type": "plan", "id": plan_id}, {"code": "PLAN_VERSION_STALE"})
        return 409, problem_response(409, "PLAN_VERSION_STALE", "Input fixtures changed since plan creation. Re-evaluate.", instance=path), None

    # Generate execution record
    exe_count = con.execute("SELECT count(*) n FROM executions").fetchone()["n"] + 1
    execution_id = f"EXE-{exe_count:04d}"
    started_at = datetime.now(timezone.utc).isoformat()

    eval_row = con.execute("SELECT payload_json FROM evaluations WHERE evaluation_id=?", (plan_row["evaluation_id"],)).fetchone()
    evaluation = json.loads(eval_row["payload_json"]) if eval_row else {}

    raw_steps = generate_execution_steps(fx, plan, evaluation)

    # Check simulated failure injection
    fail_step_env = os.getenv("AEGIS_SIMULATE_FAIL_AT_STEP")
    fail_step = int(fail_step_env) if fail_step_env and fail_step_env.isdigit() else None

    # Emit EXECUTION_REQUESTED
    append_event(
        con,
        "EXECUTION_REQUESTED",
        actor_obj,
        {"type": "execution", "id": execution_id},
        {"plan_id": plan_id, "plan_version": plan_version, "decision_id": decision_id},
    )

    steps = []
    overall_status = "completed"
    error = None

    for step in raw_steps:
        s_seq = step["seq"]
        if fail_step is not None and s_seq == fail_step:
            step["status"] = "failed"
            step["error"] = {"code": "STEP_FAILED", "message": f"Injected failure at step {s_seq}"}
            overall_status = "failed"
            error = step["error"]
            steps.append(step)
            append_event(
                con,
                "EXECUTION_STEP_FAILED",
                actor_obj,
                {"type": "execution", "id": execution_id},
                {"step_seq": s_seq, "step_type": step["step_type"], "error": step["error"]},
            )
        elif fail_step is not None and s_seq > fail_step:
            step["status"] = "skipped"
            steps.append(step)
        else:
            step["status"] = "succeeded"
            steps.append(step)
            append_event(
                con,
                "EXECUTION_STEP_SUCCEEDED",
                actor_obj,
                {"type": "execution", "id": execution_id},
                {"step_seq": s_seq, "step_type": step["step_type"]},
            )

    finished_at = datetime.now(timezone.utc).isoformat()

    if overall_status == "completed":
        append_event(
            con,
            "EXECUTION_COMPLETED",
            actor_obj,
            {"type": "execution", "id": execution_id},
            {"plan_id": plan_id, "status": "completed"},
        )
        plan["status"] = "completed"
    else:
        append_event(
            con,
            "EXECUTION_FAILED",
            actor_obj,
            {"type": "execution", "id": execution_id},
            {"plan_id": plan_id, "status": "failed", "error": error},
        )
        plan["status"] = "failed"

    plan["execution_id"] = execution_id
    con.execute("UPDATE plans SET status=?, payload_json=? WHERE plan_id=?", (plan["status"], json.dumps(plan), plan_id))

    execution_record = {
        "schema_version": "1.0.0",
        "execution_id": execution_id,
        "plan_id": plan_id,
        "plan_version": plan_version,
        "decision_id": decision_id,
        "status": overall_status,
        "simulated": True,
        "steps": steps,
        "started_at": started_at,
        "finished_at": finished_at,
        "error": error,
    }

    con.execute(
        """
        INSERT INTO executions(execution_id, plan_id, plan_version, decision_id, status, payload_json)
        VALUES(?, ?, ?, ?, ?, ?)
        """,
        (execution_id, plan_id, plan_version, decision_id, overall_status, json.dumps(execution_record)),
    )

    con.execute(
        """
        INSERT INTO idempotency(key, endpoint, request_hash, status_code, response_json, created_at)
        VALUES(?, ?, ?, ?, ?, ?)
        """,
        (idempotency_key, path, request_hash, 202, json.dumps(execution_record), finished_at),
    )

    return 202, execution_record, None
