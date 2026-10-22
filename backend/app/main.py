import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from copy import deepcopy
import yaml
from jsonschema import Draft202012Validator
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012

from fastapi import FastAPI, Header, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import FIXTURES, LLM_MODE, DEMO_MODE, CONTRACT_VERSION
from .services.fixtures import load_fixtures, snapshot_id, digest
from .services.evaluation import build_evaluation_payload
from .agents.dependency.graph import build_graph
from .agents.dependency.view import GraphViewError, graph_view_for_evaluation
from .db.sqlite import read_connection, transaction
from .audit.chain import append_event, verify
from .api.problems import problem_response
from .services.decisions import decide_plan
from .services.executions import execute_plan
from .services.rules import query_rule_applicability
from .models import EvaluationCreateRequest, DecisionRequest, ExecutionRequest, RuleQueryRequest

from contextlib import asynccontextmanager

ROOT = FIXTURES.parent
CONTRACTS = ROOT / "contracts"
OPENAPI_PATH = CONTRACTS / "openapi.yaml"
OPENAPI = yaml.safe_load(OPENAPI_PATH.read_text(encoding="utf-8"))
fx = load_fixtures(FIXTURES)
SNAPSHOT = snapshot_id(fx)


def get_actor_obj(actor_id: str) -> dict[str, Any]:
    actors_by_id = {a["actor_id"]: a for a in fx.get("policies", {}).get("demo_actors", [])}
    actor = actors_by_id.get(actor_id)
    if actor:
        return {
            "actor_id": actor["actor_id"],
            "role": actor["role"],
            "kind": "human",
            "display_name": actor.get("display_name"),
        }
    return {
        "actor_id": actor_id,
        "role": "system",
        "kind": "system",
        "display_name": None,
    }


def seed_audit():
    with transaction() as con:
        if con.execute("SELECT count(*) n FROM audit_events").fetchone()["n"] == 0:
            actor = get_actor_obj("USR-PRIYA")
            append_event(
                con,
                "DEMO_RESET",
                actor,
                {"type": "scenario", "id": "SCN-DEMO-001", "version": None},
                {"input_snapshot_id": SNAPSHOT},
            )


def initialize_runtime_fixtures():
    """Seed immutable LC version 1 records and load the latest accepted versions."""
    global fx, SNAPSHOT
    with transaction() as con:
        for lc in fx["letters_of_credit"]["letters_of_credit"]:
            row = con.execute(
                "SELECT 1 FROM lc_versions WHERE lc_id=? AND version=?",
                (lc["lc_id"], lc["version"]),
            ).fetchone()
            if not row:
                con.execute(
                    "INSERT INTO lc_versions(lc_id, version, payload_json) VALUES(?, ?, ?)",
                    (lc["lc_id"], lc["version"], json.dumps(lc)),
                )
        rows = con.execute(
            "SELECT lc_id, payload_json FROM lc_versions WHERE version = "
            "(SELECT MAX(v2.version) FROM lc_versions v2 WHERE v2.lc_id=lc_versions.lc_id)"
        ).fetchall()
    active = {row["lc_id"]: json.loads(row["payload_json"]) for row in rows}
    fresh = load_fixtures(FIXTURES)
    fresh["letters_of_credit"]["letters_of_credit"] = [
        active.get(lc["lc_id"], lc) for lc in fresh["letters_of_credit"]["letters_of_credit"]
    ]
    fx = fresh
    SNAPSHOT = snapshot_id(fx)


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_runtime_fixtures()
    seed_audit()
    yield


app = FastAPI(
    title="AegisShield AI Backend",
    version="1.0.0",
    description="Synthetic supply-chain recovery preflight API",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def request_validation_error_handler(request: Request, exc: RequestValidationError):
    errors = [
        {"path": ".".join(map(str, error["loc"][1:])), "message": error["msg"]}
        for error in exc.errors()
    ]
    header_errors = [error for error in exc.errors() if error["loc"] and error["loc"][0] == "header"]
    missing = {error["loc"][-1] for error in header_errors if error["type"] == "missing"}
    code = (
        "ACTOR_REQUIRED" if missing & {"x_actor_id", "X-Actor-Id"}
        else "IDEMPOTENCY_KEY_REQUIRED" if missing & {"idempotency_key", "Idempotency-Key"}
        else "VALIDATION_ERROR"
    )
    return problem_response(
        403 if header_errors else 422,
        code,
        "Request parameters or headers do not satisfy the API contract",
        instance=request.url.path,
        errors=errors,
    )


def request_body_problem(operation_id: str, body: dict[str, Any], instance: str):
    operation = next(
        op for path_item in OPENAPI["paths"].values()
        for op in path_item.values()
        if isinstance(op, dict) and op.get("operationId") == operation_id
    )
    schema = operation["requestBody"]["content"]["application/json"]["schema"]
    if schema.get("$ref", "").startswith("#/"):
        target = OPENAPI
        for part in schema["$ref"][2:].split("/"):
            target = target[part]
        schema = target
    if schema.get("$ref", "").startswith("./"):
        file_name, fragment = schema["$ref"].split("#", 1)
        schema = {"$ref": f"{(CONTRACTS / file_name).resolve().as_uri()}#{fragment}"}
    resources = [
        (path.resolve().as_uri(), Resource.from_contents(json.loads(path.read_text(encoding="utf-8")), default_specification=DRAFT202012))
        for path in sorted((CONTRACTS / "schemas").glob("*.schema.json"))
    ]
    registry = Registry().with_resources(resources)
    errors = sorted(
        Draft202012Validator(schema, registry=registry).iter_errors(body),
        key=lambda error: list(map(str, error.absolute_path)),
    )
    if not errors:
        return None
    return problem_response(
        422,
        "VALIDATION_ERROR",
        errors[0].message,
        instance=instance,
        errors=[
            {"path": ".".join(map(str, error.absolute_path)), "message": error.message}
            for error in errors
        ],
    )


@app.get("/api/v1/health")
def health():
    return {
        "status": "ok",
        "api_version": "v1",
        "contract_version": CONTRACT_VERSION,
        "data_mode": "synthetic",
        "llm_mode": LLM_MODE,
        "demo_mode": DEMO_MODE,
        "scenario_id": "SCN-DEMO-001",
        "input_snapshot_id": SNAPSHOT,
    }


@app.post("/api/v1/demo/reset")
def reset_demo(x_actor_id: str = Header(..., pattern=r"^USR-[A-Z]+$")):
    global fx, SNAPSHOT
    if not DEMO_MODE:
        return problem_response(403, "DEMO_MODE_DISABLED", "Demo reset is only available when AEGIS_DEMO_MODE=1", instance="/api/v1/demo/reset")
    if get_actor_obj(x_actor_id)["role"] == "system":
        return problem_response(403, "ACTOR_REQUIRED", f"Unknown actor {x_actor_id}", instance="/api/v1/demo/reset")

    fresh = load_fixtures(FIXTURES)
    fresh_snapshot = snapshot_id(fresh)
    actor = get_actor_obj(x_actor_id)
    with transaction() as con:
        for table in (
            "evaluations",
            "agent_steps",
            "plans",
            "decisions",
            "amendment_requests",
            "executions",
            "idempotency",
            "audit_events",
            "lc_versions",
        ):
            con.execute(f"DELETE FROM {table}")

        for lc in fresh["letters_of_credit"]["letters_of_credit"]:
            con.execute(
                "INSERT INTO lc_versions(lc_id, version, payload_json) VALUES(?, ?, ?)",
                (lc["lc_id"], lc["version"], json.dumps(lc)),
            )

        event = append_event(
            con,
            "DEMO_RESET",
            actor,
            {"type": "scenario", "id": "SCN-DEMO-001", "version": None},
            {"input_snapshot_id": fresh_snapshot},
        )
        con.execute("INSERT OR REPLACE INTO meta(key, value) VALUES('evaluation_counter', '1')")

    fx = fresh
    SNAPSHOT = fresh_snapshot
    return {
        "scenario_id": "SCN-DEMO-001",
        "input_snapshot_id": fresh_snapshot,
        "reset_at": event["occurred_at"],
        "counters_reset": True,
        "audit_event_id": event["event_id"],
    }


@app.get("/api/v1/scenario")
def scenario():
    master = fx["master_data"]
    return {
        "scenario": fx["scenario"],
        "customer_orders": fx["orders"]["customer_orders"],
        "purchase_orders": fx["orders"]["purchase_orders"],
        "shipments": fx["orders"]["shipments"],
        "suppliers": master["suppliers"],
        "inventory": fx["inventory"]["positions"],
        "letters_of_credit": fx["letters_of_credit"]["letters_of_credit"],
        "actors": fx["policies"]["demo_actors"],
    }


@app.get("/api/v1/disruptions")
def disruptions():
    return {"items": fx["disruptions"]["events"]}


@app.get("/api/v1/disruptions/{disruption_id}")
def disruption(disruption_id: str):
    found = next((d for d in fx["disruptions"]["events"] if d["disruption_id"] == disruption_id), None)
    if not found:
        return problem_response(404, "NOT_FOUND", f"Disruption {disruption_id} not found", instance=f"/api/v1/disruptions/{disruption_id}")
    return found


@app.post("/api/v1/evaluations", status_code=202)
def create_evaluation(
    body: EvaluationCreateRequest,
    response: Response,
    idempotency_key: str = Header(..., min_length=8, max_length=100),
    x_actor_id: str = Header(..., pattern=r"^USR-[A-Z]+$"),
):
    path = "/api/v1/evaluations"
    body = body.model_dump(exclude_unset=True)
    invalid = request_body_problem("createEvaluation", body, path)
    if invalid:
        return invalid
    actor = get_actor_obj(x_actor_id)
    if actor["role"] == "system":
        return problem_response(403, "ACTOR_REQUIRED", f"Unknown actor {x_actor_id}", instance=path)
    if actor["role"] == "viewer":
        return problem_response(403, "ROLE_FORBIDDEN", "Viewer cannot start evaluations", instance=path)

    disruption_id = body.get("disruption_id")
    if disruption_id not in {d["disruption_id"] for d in fx["disruptions"]["events"]}:
        return problem_response(404, "NOT_FOUND", f"Disruption {disruption_id} not found", instance=path)
    max_depth = body.get("max_depth")
    if max_depth is not None and (not isinstance(max_depth, int) or isinstance(max_depth, bool) or not 1 <= max_depth <= 4):
        return problem_response(422, "VALIDATION_ERROR", "max_depth must be an integer from 1 through 4", instance=path)

    request_hash = digest({"path": path, "actor_id": x_actor_id, "body": body})

    with transaction() as con:
        prev = con.execute("SELECT request_hash, response_json FROM idempotency WHERE key=?", (idempotency_key,)).fetchone()
        if prev:
            if prev["request_hash"] != request_hash:
                return problem_response(409, "IDEMPOTENCY_KEY_REUSED", "Idempotency key reused with different request body", instance=path)
            poll = json.loads(prev["response_json"])["poll_url"]
            response.headers["Idempotent-Replay"] = "true"
            response.headers["Location"] = poll
            return json.loads(prev["response_json"])

        eval_number = con.execute("SELECT COUNT(*) n FROM evaluations").fetchone()["n"] + 1
        evaluation_id = f"EVAL-{eval_number:04d}"
        plan_number = con.execute("SELECT COUNT(*) n FROM plans").fetchone()["n"] + 1
        plan_ids = (f"PLN-{plan_number:04d}", f"PLN-{plan_number + 1:04d}")
        poll = f"/api/v1/evaluations/{evaluation_id}"

        superseded_plan_ids = []
        for row in con.execute(
            "SELECT p.plan_id, p.payload_json FROM plans p "
            "JOIN evaluations e ON e.evaluation_id=p.evaluation_id "
            "WHERE e.disruption_id=? AND p.status IN ('blocked', 'needs_review', 'pending_approval')",
            (disruption_id,),
        ).fetchall():
            pid = row["plan_id"]
            previous_plan = json.loads(row["payload_json"])
            previous_plan["status"] = "superseded"
            con.execute("UPDATE plans SET status='superseded', payload_json=? WHERE plan_id=?", (json.dumps(previous_plan), pid))
            append_event(con, "PLAN_SUPERSEDED", actor, {"type": "plan", "id": pid}, {"status": "superseded"})
            superseded_plan_ids.append(pid)

        append_event(con, "EVALUATION_REQUESTED", actor, {"type": "evaluation", "id": evaluation_id}, {"disruption_id": disruption_id})
        started_at = datetime.now(timezone.utc).isoformat()
        try:
            payload = build_evaluation_payload(
                fx, disruption_id, evaluation_id, plan_ids, LLM_MODE,
                started_at, max_depth=max_depth,
            )
            completed_at = payload["completed_at"]
            evaluation_status = payload["status"]
        except Exception as exc:
            completed_at = datetime.now(timezone.utc).isoformat()
            evaluation_status = "failed"
            error = {"code": "EVALUATION_FAILED", "message": str(exc)[:500]}
            payload = {
                "schema_version": "1.0.0", "evaluation_id": evaluation_id,
                "disruption_id": disruption_id, "status": "failed", "data_mode": "synthetic",
                "llm_mode": LLM_MODE, "input_snapshot_id": SNAPSHOT,
                "created_at": started_at, "completed_at": completed_at, "steps": [],
                "assessment": None, "dependency_results": [], "rule_results": [],
                "options": [], "findings": [], "evidence": [], "plans": [],
                "comparison": None, "explanations": [], "error": error,
            }

        for step in payload["steps"]:
            step_name = step["step"]
            con.execute(
                """
                INSERT INTO agent_steps(
                    evaluation_id, seq, step, owner, status, attempts,
                    timeout_ms, started_at, finished_at, duration_ms, mode, error_json
                ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (evaluation_id, step["seq"], step_name, step["owner"], step["status"], step["attempts"],
                 step["timeout_ms"], step["started_at"], step["finished_at"], step["duration_ms"],
                 step["mode"], json.dumps(step["error"]) if step["error"] else None),
            )
            event_type = {
                "succeeded": "AGENT_STEP_SUCCEEDED",
                "degraded": "AGENT_STEP_DEGRADED",
                "failed": "AGENT_STEP_FAILED",
            }.get(step["status"], "AGENT_STEP_FAILED")
            append_event(con, event_type, actor, {"type": "evaluation", "id": evaluation_id},
                         {"step": step_name, "owner": step["owner"], "status": step["status"], "error": step["error"]})

        for plan in payload["plans"]:
            plan_obj = deepcopy(plan)
            plan_obj["decision_ids"] = []
            plan_obj["execution_id"] = None
            con.execute(
                "INSERT INTO plans(plan_id, evaluation_id, version, status, outcome, plan_hash, input_snapshot_id, payload_json) "
                "VALUES(?, ?, ?, ?, ?, ?, ?, ?)",
                (plan_obj["plan_id"], evaluation_id, plan_obj["version"], plan_obj["status"], plan_obj["outcome"],
                 plan_obj["plan_hash"], plan_obj["input_snapshot_id"], json.dumps(plan_obj)),
            )
            append_event(
                con,
                "PLAN_CREATED",
                actor,
                {"type": "plan", "id": plan_obj["plan_id"]},
                {"evaluation_id": evaluation_id, "strategy": plan_obj["strategy"], "status": plan_obj["status"], "plan_hash": plan_obj["plan_hash"]},
            )

        con.execute(
            """
            INSERT INTO evaluations(evaluation_id, disruption_id, status, llm_mode, input_snapshot_id, created_at, completed_at, payload_json)
            VALUES(?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (evaluation_id, disruption_id, evaluation_status, LLM_MODE, payload["input_snapshot_id"], started_at, completed_at, json.dumps(payload)),
        )
        append_event(
            con,
            "EVALUATION_COMPLETED" if evaluation_status == "completed" else "EVALUATION_FAILED",
            actor,
            {"type": "evaluation", "id": evaluation_id},
            {"disruption_id": disruption_id, "input_snapshot_id": payload["input_snapshot_id"], "status": evaluation_status},
        )

        accepted = {
            "evaluation_id": evaluation_id,
            "status": "queued",
            "poll_url": poll,
            "superseded_plan_ids": superseded_plan_ids,
        }
        con.execute(
            """
            INSERT INTO idempotency(key, endpoint, request_hash, status_code, response_json, created_at)
            VALUES(?, ?, ?, ?, ?, ?)
            """,
            (idempotency_key, path, request_hash, 202, json.dumps(accepted), completed_at),
        )

    response.headers["Location"] = poll
    return accepted


@app.get("/api/v1/evaluations/{evaluation_id}")
def get_evaluation(evaluation_id: str):
    with read_connection() as con:
        row = con.execute("SELECT payload_json FROM evaluations WHERE evaluation_id=?", (evaluation_id,)).fetchone()
    if not row:
        return problem_response(404, "NOT_FOUND", f"Evaluation {evaluation_id} not found", instance=f"/api/v1/evaluations/{evaluation_id}")
    return json.loads(row["payload_json"])


@app.get("/api/v1/evaluations/{evaluation_id}/graph")
def get_graph(evaluation_id: str, focus_supplier_id: str = Query("SUP-B", pattern=r"^SUP-[A-Z0-9]+$")):
    instance = f"/api/v1/evaluations/{evaluation_id}/graph"
    with read_connection() as con:
        row = con.execute("SELECT payload_json FROM evaluations WHERE evaluation_id=?", (evaluation_id,)).fetchone()
    evaluation = json.loads(row["payload_json"]) if row else None
    try:  # MOD-05 (Member 4) owns the view and its 404/409 rules
        return graph_view_for_evaluation(evaluation, build_graph(fx["supply_graph"], fx["master_data"]), focus_supplier_id)
    except GraphViewError as e:
        code = "NOT_FOUND" if e.status == 404 else e.code
        return problem_response(e.status, code, e.detail, instance=instance)


@app.get("/api/v1/plans/{plan_id}")
def get_plan(plan_id: str):
    with read_connection() as con:
        row = con.execute("SELECT payload_json FROM plans WHERE plan_id=?", (plan_id,)).fetchone()
    if not row:
        return problem_response(404, "NOT_FOUND", f"Plan {plan_id} not found", instance=f"/api/v1/plans/{plan_id}")
    return json.loads(row["payload_json"])


@app.post("/api/v1/plans/{plan_id}/decisions", status_code=201)
def handle_plan_decision(
    plan_id: str,
    body: DecisionRequest,
    response: Response,
    x_actor_id: str = Header(..., pattern=r"^USR-[A-Z]+$"),
    idempotency_key: str = Header(..., min_length=8, max_length=100),
):
    path = f"/api/v1/plans/{plan_id}/decisions"
    body = body.model_dump(mode="json", by_alias=True, exclude_unset=True)
    invalid = request_body_problem("decidePlan", body, path)
    if invalid:
        return invalid
    with transaction() as con:
        status_code, result, headers = decide_plan(con, fx, plan_id, x_actor_id, idempotency_key, body, path)

    if headers:
        for k, v in headers.items():
            response.headers[k] = v
    if isinstance(result, JSONResponse):
        return result
    response.status_code = status_code
    return result


@app.post("/api/v1/plans/{plan_id}/executions", status_code=202)
def handle_plan_execution(
    plan_id: str,
    body: ExecutionRequest,
    response: Response,
    x_actor_id: str = Header(..., pattern=r"^USR-[A-Z]+$"),
    idempotency_key: str = Header(..., min_length=8, max_length=100),
):
    path = f"/api/v1/plans/{plan_id}/executions"
    body = body.model_dump(exclude_unset=True)
    invalid = request_body_problem("executePlan", body, path)
    if invalid:
        return invalid
    with transaction() as con:
        status_code, result, headers = execute_plan(con, fx, plan_id, x_actor_id, idempotency_key, body, path, SNAPSHOT)

    if headers:
        for k, v in headers.items():
            response.headers[k] = v
    if isinstance(result, JSONResponse):
        return result
    response.status_code = status_code
    return result


@app.get("/api/v1/executions/{execution_id}")
def get_execution(execution_id: str):
    with read_connection() as con:
        row = con.execute("SELECT payload_json FROM executions WHERE execution_id=?", (execution_id,)).fetchone()
    if not row:
        return problem_response(404, "NOT_FOUND", f"Execution {execution_id} not found", instance=f"/api/v1/executions/{execution_id}")
    return json.loads(row["payload_json"])


@app.get("/api/v1/amendment-requests/{amendment_request_id}")
def get_amendment_request(amendment_request_id: str):
    with read_connection() as con:
        row = con.execute("SELECT payload_json FROM amendment_requests WHERE amendment_request_id=?", (amendment_request_id,)).fetchone()
    if not row:
        return problem_response(404, "NOT_FOUND", f"Amendment request {amendment_request_id} not found", instance=f"/api/v1/amendment-requests/{amendment_request_id}")
    return json.loads(row["payload_json"])


@app.post("/api/v1/demo/amendment-requests/{amendment_request_id}/simulate-acceptance")
def simulate_amendment_acceptance(
    amendment_request_id: str,
    response: Response,
    x_actor_id: str = Header(..., pattern=r"^USR-[A-Z]+$"),
    idempotency_key: str = Header(..., min_length=8, max_length=100),
):
    global fx, SNAPSHOT
    path = f"/api/v1/demo/amendment-requests/{amendment_request_id}/simulate-acceptance"
    if not DEMO_MODE:
        return problem_response(403, "DEMO_MODE_DISABLED", "Simulate acceptance is only available in demo mode", instance=path)

    actor = get_actor_obj(x_actor_id)
    if actor["role"] == "system":
        return problem_response(403, "ACTOR_REQUIRED", f"Unknown actor {x_actor_id}", instance=path)
    if actor["role"] == "viewer":
        return problem_response(403, "ROLE_FORBIDDEN", "Viewer cannot simulate amendment acceptance", instance=path)
    request_hash = digest({"path": path, "actor_id": x_actor_id, "body": {}})
    accepted_lc = None
    with transaction() as con:
        previous = con.execute(
            "SELECT request_hash, response_json FROM idempotency WHERE key=?", (idempotency_key,)
        ).fetchone()
        if previous:
            if previous["request_hash"] != request_hash:
                return problem_response(409, "IDEMPOTENCY_KEY_REUSED", "Idempotency key reused with different request", instance=path)
            accepted = json.loads(previous["response_json"])
            response.headers["Idempotent-Replay"] = "true"
            return accepted

        row = con.execute("SELECT payload_json FROM amendment_requests WHERE amendment_request_id=?", (amendment_request_id,)).fetchone()
        if not row:
            return problem_response(404, "NOT_FOUND", f"Amendment request {amendment_request_id} not found", instance=path)

        amd = json.loads(row["payload_json"])
        if amd["status"] != "requested":
            return problem_response(409, "AMENDMENT_ALREADY_ACCEPTED", "Amendment request is no longer pending", instance=path)
        lc = next((item for item in fx["letters_of_credit"]["letters_of_credit"] if item["lc_id"] == amd["lc_id"]), None)
        if lc is None or lc["version"] != amd["lc_version"]:
            return problem_response(409, "LC_VERSION_STALE", "Letter of credit changed after this request was created", instance=path)

        accepted_lc = deepcopy(lc)
        for change in amd["requested_changes"]:
            tag = change["field_tag"]
            value = change["to"].strip()
            if tag == "43T" and value.upper() in {"ALLOWED", "NOT ALLOWED"}:
                accepted_lc["structured"]["transhipment"]["value"] = "allowed" if value.upper() == "ALLOWED" else "not_allowed"
                raw_value = "ALLOWED" if value.upper() == "ALLOWED" else "NOT ALLOWED"
                lines = accepted_lc["raw_text"].splitlines()
                accepted_lc["raw_text"] = "\n".join(
                    f":43T:{raw_value}" if line.startswith(":43T:") else line for line in lines
                )
            elif tag == "47A" and value.lower() in {"(deleted)", "deleted", ""}:
                accepted_lc["structured"]["ucp_20c_excluded"]["value"] = False
                accepted_lc["raw_text"] = "\n".join(
                    line for line in accepted_lc["raw_text"].splitlines() if not line.startswith(":47A:")
                )
            elif tag == "47A" and "20(C)" in value.upper() and "EXCLUDED" in value.upper():
                accepted_lc["structured"]["ucp_20c_excluded"]["value"] = True
                lines = accepted_lc["raw_text"].splitlines()
                line = f":47A:{value.upper()}"
                if any(item.startswith(":47A:") for item in lines):
                    accepted_lc["raw_text"] = "\n".join(line if item.startswith(":47A:") else item for item in lines)
                else:
                    accepted_lc["raw_text"] = "\n".join(lines + [line])
            else:
                return problem_response(422, "VALIDATION_ERROR", f"Unsupported or invalid simulated LC change for field {tag}", instance=path)

        accepted_lc["version"] += 1
        con.execute(
            "INSERT INTO lc_versions(lc_id, version, payload_json) VALUES(?, ?, ?)",
            (accepted_lc["lc_id"], accepted_lc["version"], json.dumps(accepted_lc)),
        )
        amd["lc_version"] = accepted_lc["version"]
        amd["status"] = "simulated_accepted"
        con.execute("UPDATE amendment_requests SET status=?, payload_json=? WHERE amendment_request_id=?", ("simulated_accepted", json.dumps(amd), amendment_request_id))

        append_event(
            con,
            "AMENDMENT_SIMULATED_ACCEPTED",
            actor,
            {"type": "lc", "id": amd["lc_id"], "version": accepted_lc["version"]},
            {"amendment_request_id": amendment_request_id, "new_lc_version": accepted_lc["version"]},
        )
        accepted_at = datetime.now(timezone.utc).isoformat()
        con.execute(
            "INSERT INTO idempotency(key, endpoint, request_hash, status_code, response_json, created_at) VALUES(?, ?, ?, ?, ?, ?)",
            (idempotency_key, path, request_hash, 200, json.dumps(amd), accepted_at),
        )
    fx["letters_of_credit"]["letters_of_credit"] = [
        accepted_lc if item["lc_id"] == accepted_lc["lc_id"] else item
        for item in fx["letters_of_credit"]["letters_of_credit"]
    ]
    SNAPSHOT = snapshot_id(fx)
    return amd


@app.get("/api/v1/audit-events")
def list_audit_events(
    after_seq: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    subject_id: str | None = Query(None),
):
    with read_connection() as con:
        if subject_id:
            rows = con.execute(
                """
                SELECT seq, event_id, occurred_at, actor_json, event_type,
                       subject_json, payload_json, evidence_ids_json, prev_hash, event_hash
                FROM audit_events
                WHERE seq > ? AND json_extract(subject_json, '$.id') = ?
                ORDER BY seq ASC LIMIT ?
                """,
                (after_seq, subject_id, limit),
            ).fetchall()
        else:
            rows = con.execute(
                """
                SELECT seq, event_id, occurred_at, actor_json, event_type,
                       subject_json, payload_json, evidence_ids_json, prev_hash, event_hash
                FROM audit_events
                WHERE seq > ?
                ORDER BY seq ASC LIMIT ?
                """,
                (after_seq, limit),
            ).fetchall()

        events = []
        for r in rows:
            events.append({
                "schema_version": "1.0.0",
                "event_id": r["event_id"],
                "seq": r["seq"],
                "occurred_at": r["occurred_at"],
                "actor": json.loads(r["actor_json"]),
                "event_type": r["event_type"],
                "subject": json.loads(r["subject_json"]),
                "payload": json.loads(r["payload_json"]),
                "evidence_ids": json.loads(r["evidence_ids_json"]),
                "prev_hash": r["prev_hash"],
                "event_hash": r["event_hash"],
            })

        next_after_seq = events[-1]["seq"] if (len(events) == limit) else None
        return {"next_after_seq": next_after_seq, "events": events}


@app.get("/api/v1/audit-events/verify")
def verify_audit():
    with read_connection() as con:
        return verify(con)


@app.post("/api/v1/rules/applicability")
def rules_applicability(body: RuleQueryRequest):
    body = body.model_dump(exclude_unset=True)
    invalid = request_body_problem("queryRuleApplicability", body, "/api/v1/rules/applicability")
    if invalid:
        return invalid
    return query_rule_applicability(fx, body)
