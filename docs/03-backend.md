# Member 3 — Backend

| | |
|---|---|
| Role | Backend developer; owner of the system's spine |
| You own (accountable) | MOD-01 Contracts & tooling · MOD-02 API & persistence · MOD-03 Orchestrator · MOD-08 Trade-Compliance Preflight Agent · MOD-09 Inventory Rebalancing Agent · MOD-10 Plan Builder & Financials · MOD-11 Decisions, Execution, Audit · MOD-15 Deployment & demo environment · MOD-19 Backend e2e tests |
| Reviewers of your work | Member 5 (MOD-01, 03, 08, 10, 11, 19), Member 4 (MOD-02, 09), Member 2 (MOD-15) |
| Canonical facts | `docs/00-source-of-truth.md` §7–§11; `contracts/`; `fixtures/` |
| Critical path | You are on it (`docs/00` §13.3). Protect D4–D6. |

---

## 1. The project in brief
After a supplier disruption, the backend runs five agents, builds two recovery plans (P1 unchecked, P2 verified), computes honest money, waits for a human decision, simulates execution and writes a hash-chained audit trail. Deterministic code decides everything; an LLM only extracts fields or explains, through Member 5's gateway. All data is synthetic and loaded from `fixtures/demo/`.

**Glossary:** *option* = one way to get units (inventory source, or quote × route); *finding* = one check result; *exposure* = possible loss, never cost; *plan hash* = fingerprint covering exactly the fields in `plan.schema.json#RecoveryPlan` description; *input snapshot* = hash of all fixture files; *idempotency key* = client-chosen id that makes retries safe. More in `docs/00` §17.

---

## 2. Mission and boundaries
**Mission.** Ship an API that reproduces `fixtures/expected/evaluation_EVAL-0001.json` exactly, enforces approval rules server-side, and never fails silently during the demo.

**Yours:** everything in the modules above, plus integration of Member 4's and Member 5's modules into the orchestrator, the CI job, and the demo runbook.

**Not yours:** graph traversal, alias resolution, routing eligibility, GraphView (Member 4); rule applicability, LLM gateway, LC text extraction, explanation texts (Member 5); screens (Member 2). You call their functions through the interfaces in `docs/00` §9.4 and never re-implement them. You do not change another owner's contract without their review (contract registry: `contracts/README.md`).

---

## 3. Deliverables and locations
| ID | Deliverable | Location | Due |
|---|---|---|---|
| M3-D1 | Contracts v1.0.0 tag, CI job running the checker | `contracts/`, `.github/workflows/contracts.yml` | Sun 25 Oct |
| M3-D2 | FastAPI skeleton: health, scenario, disruptions, reset, stub routes serving goldens | `backend/app/api`, `backend/app/main.py` | D1 |
| M3-D3 | SQLite schema + repositories + id counters | `backend/app/db` | D1 |
| M3-D4 | Inventory agent | `backend/app/agents/inventory` | D2 |
| M3-D5 | Compliance agent (LC + FTA + duty at risk) | `backend/app/agents/compliance` | D2 |
| M3-D6 | Plan builder, plan-level checks, financials, comparison, plan hash | `backend/app/plans` | D3 |
| M3-D7 | Orchestrator with real modules; golden e2e for evaluation | `backend/app/orchestrator`, `backend/tests/e2e` | D4 (golden green D5) |
| M3-D8 | Decisions API, idempotency, amendment requests | `backend/app/decisions` | D5 |
| M3-D9 | Execution simulator + audit chain + verify | `backend/app/decisions/execution.py`, `backend/app/audit` | D6 |
| M3-D10 | Runbook, offline bundle, optional BTP deploy | `ops/runbook.md`, `ops/manifest.yml` | D8 |

---

## 4. Inputs, outputs, contract references
| Direction | Counterpart | Payload / function | Contract |
|---|---|---|---|
| In | Member 4 | `assess_disruption()` → `DisruptionAssessment` | `disruption.schema.json` |
| In | Member 4 | `check_dependency()` → `DependencyResult`; `build_graph_view()` → `GraphView`; `eligible_routes()` | `graph.schema.json`, `master-data#RouteOption` |
| In | Member 5 | `rule_applicability()` → `RuleApplicabilityResult` | `trade-rules.schema.json` |
| In | Member 5 | `explain()` → `Explanation`; `extract_lc_fields()` → dict | `plan.schema.json#Explanation`; `master-data#LetterOfCredit.extracted` |
| Out | Member 2 | all HTTP endpoints | `openapi.yaml`, `api/plan/decision.schema.json` |
| Out | all | goldens, validation-case results, CI status | `fixtures/expected/`, `tools/check_contracts.py` |

Reference behaviour for every module you own is in `tools/aegis_oracle.py` (functions `lc_route_findings`, `fta_findings`, `duty_at_risk`, `source_options`, `greedy_plan`, `plan_level_findings`, `financials`, `build_plan`, `plan_hash_material`, `ApprovalModel`). You may port that logic — it is our executable specification — but your tests must be written from `fixtures/validation/cases.json` and the goldens; the independent cross-check is the hand calculation in `docs/00` §10.8 (also hard-coded in `tools/check_contracts.py`).

---

## 5. Backend layout
```
backend/
  app/main.py                  FastAPI app, routers, static frontend (dist) at "/"
  app/config.py                env: AEGIS_DEMO_MODE, AEGIS_LLM_MODE, AEGIS_DB_PATH, AEGIS_SIMULATE_FAIL_AT_STEP
  app/models/                  Pydantic v2 models generated from contracts (datamodel-code-generator) + thin wrappers
  app/api/                     routers: system, scenario, evaluations, plans, executions, audit, rules
  app/api/problems.py          problem+json helpers and error codes
  app/db/                      SQLAlchemy models, session, repositories, counters
  app/fixtures.py              load + validate fixtures, compute input_snapshot_id
  app/orchestrator/            pipeline, step runner, supersession
  app/agents/inventory/        MOD-09
  app/agents/compliance/       MOD-08
  app/agents/sensing/          (Member 4)
  app/agents/dependency/       (Member 4)
  app/agents/routing/          (Member 4)
  app/rules/                   (Member 5)
  app/llm/                     (Member 5)
  app/plans/                   MOD-10
  app/decisions/               MOD-11 decisions, amendments, execution
  app/audit/                   MOD-11 hash chain
  tests/unit/  tests/e2e/  tests/conformance/
```
Generate models once from the schemas: `datamodel-codegen --input ../contracts/schemas --input-file-type jsonschema --output app/models/generated --output-model-type pydantic_v2.BaseModel`. If generation is awkward with cross-file refs, hand-write models but validate every response in tests (§14).

---

## 6. Persistence (SQLite, one file)
| Table | Key columns | Notes |
|---|---|---|
| `meta` | key, value | `input_snapshot_id`, id counters (EVAL, PLN, DEC, EXE, AMD, AUD) |
| `evaluations` | evaluation_id PK, disruption_id, status, llm_mode, input_snapshot_id, created_at, completed_at, payload_json | payload = full `Evaluation` when completed |
| `agent_steps` | (evaluation_id, seq) PK, step, owner, status, attempts, timeout_ms, started_at, finished_at, duration_ms, mode, error_json | updated live for progress polling |
| `plans` | plan_id PK, evaluation_id, version, status, outcome, plan_hash, input_snapshot_id, payload_json | status is the only mutable column after creation |
| `decisions` | decision_id PK, plan_id, plan_version, action, actor_id, role, idempotency_key, payload_json, decided_at | **partial unique index** (plan_id, plan_version) WHERE action IN ('approve','reject') |
| `amendment_requests` | amendment_request_id PK, plan_id, lc_id, lc_version, status, payload_json | |
| `executions` | execution_id PK, plan_id, plan_version UNIQUE pair, decision_id, status, payload_json | one execution per plan version |
| `idempotency` | key PK, endpoint, request_hash, status_code, response_json, created_at | replay store for every mutating endpoint |
| `audit_events` | seq PK, event_id UNIQUE, occurred_at, actor_json, event_type, subject_json, payload_json, evidence_ids_json, prev_hash, event_hash | append-only; no UPDATE/DELETE code paths |
| `lc_versions` | (lc_id, version) PK, payload_json | seeded from fixture; stretch S-1 adds versions |

Every state change (plan status + decision row + audit event; or execution row + audit events) happens in **one transaction**.

---

## 7. Orchestrator (MOD-03)
Pipeline for `POST /api/v1/evaluations` (async background task; one per disruption at a time):

| Seq | Step | Calls | Timeout | Retries | On failure |
|---|---|---|---|---|---|
| 1 | disruption_sensing | M4 `assess_disruption` (mode from config) | 10 s | LLM 1, else 0 | evaluation `failed` |
| 2 | supplier_dependency | M4 `check_dependency` per quote supplier | 5 s | 0 | affected `DEP` findings → needs_review with `details.check_unavailable=true` |
| 3 | routing | M4 `eligible_routes` per quote | 5 s | 0 | quotes without routes produce no options (logged) |
| 4 | inventory_rebalancing | `inventory_options` | 5 s | 0 | no inventory options; finding blocked |
| 5 | trade_compliance | M5 `rule_applicability` per (quote, route); your LC/FTA checks | 5 s | 0 | `FTA.RULE_APPLICABILITY` needs_review; LC checks still run |
| 6 | plan_assembly | build P1, P2, plan-level checks, financials, comparison | 5 s | 0 | evaluation `failed` |
| 7 | explanation | M5 `explain` per plan (and M4 per supplier) | 10 s | LLM 1 | status `degraded`, template text |

- Run sync functions with `asyncio.wait_for(asyncio.to_thread(fn, …), timeout)`.
- Write an `agent_steps` row before and after each step; emit audit `AGENT_STEP_SUCCEEDED` / `_DEGRADED` / `_FAILED`.
- On start: mark undecided plans (blocked, needs_review, pending_approval) of earlier evaluations of the same disruption as `superseded` (audit `PLAN_SUPERSEDED`), return their ids in `superseded_plan_ids`.
- On completion: persist plans (`PLAN_CREATED` ×2), evaluation payload, `EVALUATION_COMPLETED`.
- Determinism: ids from counters (EVAL-0001, PLN-0001 = P1, PLN-0002 = P2); findings and evidence sorted by id in the payload; options in the order inventory sources (fixture order) then quotes × routes (fixture order).

---

## 8. Trade-Compliance Preflight Agent (MOD-08)
Implements `docs/00` §10.3 and §10.4 exactly. Finding ids are content-derived so they are stable:

| Check code | Finding id | Subject |
|---|---|---|
| LC.TRANSHIPMENT | `FND-LC-TRANSHIPMENT-<route>` | route_option |
| LC.LATEST_SHIPMENT_DATE | `FND-LC-LATEST_SHIPMENT-<route>` | route_option |
| LC.PORT_OF_LOADING / DISCHARGE | `FND-LC-PORT_OF_LOADING-<route>` / `…DISCHARGE-<route>` | route_option |
| LC.PRESENTATION_PERIOD | `FND-LC-PRESENTATION-<route>` | route_option |
| LC.EXTRACTION_CONSISTENCY | `FND-LC-EXTRACTION-<route>` (only when `extracted` exists) | route_option |
| LC.AMOUNT / LC.PARTIAL_SHIPMENTS | `FND-LC-AMOUNT-<plan>-<lc>` / `FND-LC-PARTIAL-<plan>-<lc>` | plan |
| FTA.DIRECT_CONSIGNMENT | `FND-FTA-DIRECT_CONSIGNMENT-<route>` | route_option |
| FTA.CERTIFICATE_OF_ORIGIN | `FND-FTA-CERTIFICATE_OF_ORIGIN-<route>` | route_option |
| FTA.RULE_APPLICABILITY | `FND-FTA-RULES-<route>` | route_option |

Evidence ids: `EVD-LCF-<lc>-<tag>` (LC field line from `raw_text`), `EVD-ROUTE-<route>`, `EVD-RULE-<rule>`, `EVD-QT-<quote>`, `EVD-LCB-<lc>` (balance), `EVD-LCRAW-<lc>`.

Rules worth repeating because they are easy to get wrong:
- Arrival dates are **never** an LC input. 44C is compared with ETD.
- Transhipment is blocked only when 43T is not allowed **and** (20(c) excluded **or** the container/single-B/L exception does not apply).
- Non-AIFTA transit → `needs_review`, never `blocked`. Singapore (party) → passed.
- `applicable_on` for the rule query = route `eta_port`; `known_as_of` = scenario date.
- Duty at risk only for needs_review FTA lines; MFN rate from the **applicable** rule (TR-0003, 1500 bps in the demo).

Validation cases you own: VC-LC-01…07, VC-FTA-01…03.

## 9. Inventory Rebalancing Agent (MOD-09)
- `atp = max(0, on_hand − reserved − protected_floor)`; option `OPT-<inventory_source_id>`, `eta_plant = scenario date + transfer_days`, unit cost = transfer cost.
- Finding `FND-INV-ATP-<source>` (passed if atp > 0 else blocked); plan-level `FND-INV-ALLOCATION-<plan>-<source>`.
- Cases: VC-INV-01…03.

## 10. Plan Builder & Financials (MOD-10)
Greedy allocation (both strategies), as specified in `docs/00` §10.6:
```
for order in affected_orders sorted by (need_by, order_id):
    remaining = order.qty_affected
    while remaining > 0:
        candidates = options allowed by strategy with remaining capacity in their capacity_group
        on_time = [o for o in candidates if o.eta_plant <= order.need_by]
        if on_time: pick = min(on_time, key=(unit_incremental_cost_inr, eta_plant, option_id))
        else:
            late = [o for o in candidates if o.eta_plant < baseline_revised_arrival]
            if not late: break
            pick = min(late, key=(eta_plant, unit_incremental_cost_inr, option_id))
        take = min(remaining, capacity_left[pick.capacity_group]); append line; reduce
    if remaining: append BASELINE-PO line with eta = baseline_revised_arrival
line_id = L01, L02… in creation order
```
- P2 (`constraint_verified`): options with outcome `passed` only; LC-funded capacity capped at `available_balance_inr // unit_price_inr`.
- Plan findings = `FND-SENSE-<disruption>` + findings of options used (first-use order) + plan-level findings.
- Financials, exposures and worst-case exactly per `docs/00` §10.7 and `plan.schema.json#PlanFinancials`. `cost_breakdown` always lists the five categories in schema order, zeros included.
- Plan hash: `"sha256:" + sha256(canonical_json(plan_hash_material(plan)))`, canonical JSON = `json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)`.
- Comparison and recommendation rule per `docs/00` §10.6.
- Expected demo values: P1 3,34,000 / 0 / 8,26,000 / exposure 5,10,000; P2 4,92,000 / 50,000 / 6,18,000 / 0. Cases: VC-FIN-01…03, VC-LC-05, VC-AMEND-01 (stretch).

---

## 11. Decisions (MOD-11)
`POST /api/v1/plans/{plan_id}/decisions` validation order (first failure wins) — identical to `openapi.yaml`:
1. `X-Actor-Id` present → else 400 ACTOR_REQUIRED; actor known and not viewer → else 403 ROLE_FORBIDDEN. `Idempotency-Key` present → else 400.
2. Idempotency: key exists with same request hash → replay stored response (200 + `Idempotent-Replay: true`); different hash → 409 IDEMPOTENCY_KEY_REUSED.
3. Plan exists → else 404.
4. Plan `superseded` → 409 PLAN_SUPERSEDED.
5. `plan_version`/`plan_hash` match → else 409 PLAN_VERSION_STALE with `current`.
6. Plan already approved/rejected/executing/completed/failed → 409 DECISION_EXISTS.
7. Action rules (approve / reject / request_amendment) as in `docs/00` §11.2.
8. Commit: decision row, plan status, amendment request (if any), audit `DECISION_RECORDED` (or `AMENDMENT_REQUESTED`), idempotency row — one transaction.
Every refusal from step 3 onward writes `DECISION_REFUSED` with the error code. Request hash = sha256 of canonical JSON of `{path, actor_id, body}`.

Cases: VC-APR-01…08 and golden flow steps 5–10.

## 12. Simulated execution (MOD-11)
`POST /api/v1/plans/{plan_id}/executions`: actor + key checks → replay → plan exists → status must be `approved` (else 409 NOT_APPROVED; `executing/completed/failed` → 409 ALREADY_EXECUTED) → `decision_id` must be the approving decision → current `input_snapshot_id` equals the plan's (else 409 PLAN_VERSION_STALE) → create `EXE-nnnn`, status `queued`, return 202, run in background.

Step generation from plan lines (deterministic):
1. `REDUCE_PO` `{po_id, from_qty, to_qty}` — to_qty = from_qty − Σ supplier-line units.
2. `CREATE_PO` per quote (by quote_id) `{supplier_id, quote_id, qty, unit_price_inr, lc_id, lc_drawing_inr}` (`lc_id`/`lc_drawing_inr` null without LC).
3. `BOOK_FREIGHT` per route (by route_option_id) `{route_option_id, qty}`.
4. `CREATE_STOCK_TRANSFER` per inventory source with `transfer_days > 0` `{inventory_source_id, to_location_id, qty}`.
5. `RESERVE_STOCK` per plant source (`transfer_days == 0`) and order `{inventory_source_id, order_id, qty}`.
6. `NOTIFY_CUSTOMER` per order with late units `{order_id, qty_late, days_late}` (max days late).
Each step: `simulated: true`, `proposed_sap_mapping` text (golden examples in `openapi.yaml`). `AEGIS_SIMULATE_FAIL_AT_STEP=N` makes step N fail; later steps `skipped`; plan `failed`; audit `EXECUTION_STEP_FAILED`, `EXECUTION_FAILED`; **no retry, no compensation** (VC-EXE-01). Golden for P2: `fixtures/expected/approval_flow.json` step 12.

## 13. Audit chain (MOD-11)
- `event_hash = "sha256:" + sha256(canonical_json(event without event_hash))`; `prev_hash` = previous `event_hash`, genesis `sha256:` + 64 zeros.
- Append through one function `append_audit(event_type, actor, subject, payload, evidence_ids)` holding a process-wide lock inside the transaction.
- `GET /audit-events/verify` recomputes all hashes and links; returns first broken seq.
- Reset deletes all rows then writes `DEMO_RESET` as seq 1 (`AUD-000001`).
- Payloads: ids, statuses, error codes, plan_hash, amounts. Never secrets or whole documents.

## 14. API conventions and tests
- Problem responses: `application/problem+json`, `type = https://aegisshield.local/problems/<kebab-code>`, stable `code`.
- CORS: allow `http://localhost:5173` in dev; in demo, serve `frontend/dist` from FastAPI so there is one origin.
- **Conformance tests:** every response in tests is validated against its schema (reuse `registry()`/`validator_for()` from `tools/check_contracts.py` via a small test helper, or bundle the OpenAPI spec and use `openapi-core`).
- **Unit tests:** one test per validation case for your modules (`VC-LC-*`, `VC-FTA-*`, `VC-INV-*`, `VC-FIN-*`, `VC-APR-*`, `VC-LC-05`).
- **Golden e2e:** implement `fixtures/expected/approval_flow.json` steps 1–16 as `tests/e2e/test_golden_flow.py`; compare evaluation with the golden ignoring the volatile keys listed in `tools/check_contracts.py` (`VOLATILE`).
- CI: `contracts.yml` runs `python3 tools/check_contracts.py` and `pytest -q`.

## 15. Deployment and demo environment (MOD-15)
- **Local (primary):** `make demo` = build frontend once, start `uvicorn app.main:app --port 8000` serving API + `frontend/dist`. Config: `AEGIS_DEMO_MODE=1`, `AEGIS_LLM_MODE=recorded` (or `off`).
- **Offline:** `pip download -r requirements.txt -d ops/wheels`; keep `frontend/dist` built; verify with Wi-Fi off (D8, DA-12).
- **SAP BTP Cloud Foundry (if OD-01 = a):** `ops/manifest.yml` (python buildpack, `command: uvicorn app.main:app --host 0.0.0.0 --port $PORT`, 512M). SQLite on CF is ephemeral, so the app resets on start — acceptable for a demo. Spike on D2 (≤ 1 h), final on D8. If it fails, local demo + mapping slide, and tell Member 5 immediately (R-01).
- **Runbook** (`ops/runbook.md`): start, reset, health check, switch LLM mode, failure drills, where the backup video is.

---

## 16. Backlog (priority order)
| ID | Task | Pri | Acceptance criteria |
|---|---|---|---|
| M3-T1 | CI with checker; contracts tag v1.0.0 | P0 | CI green on main; tag on 25 Oct |
| M3-T2 | Skeleton, fixture loader with schema validation, snapshot id, health, scenario, disruptions, reset | P0 | `GET /health.input_snapshot_id` equals golden; reset → AUD-000001 |
| M3-T3 | Stub routes serving goldens | P0 | Member 2 builds against them on D1 |
| M3-T4 | Inventory agent | P0 | VC-INV-01…03 |
| M3-T5 | Compliance agent | P0 | VC-LC-01…07, VC-FTA-01…03 |
| M3-T6 | Plan builder + financials + hash | P0 | VC-FIN-01…03, VC-LC-05; P1/P2 equal golden incl. plan_hash |
| M3-T7 | Orchestrator + async evaluation + steps | P0 | Golden evaluation equal (SC-1) by D5 |
| M3-T8 | Decisions + idempotency + amendment request | P0 | VC-APR-01…08; golden steps 5–10 |
| M3-T9 | Execution simulator + failure injection | P0 | Golden steps 11–14; VC-EXE-01 |
| M3-T10 | Audit chain + verify | P0 | Golden steps 15–16 |
| M3-T11 | Response conformance tests | P0 | Every endpoint covered |
| M3-T12 | Runbook, offline bundle, timing log | P0 | DA-12; SC-9 measured |
| M3-T13 | BTP deploy (OD-01) | P1 | Public URL serves health + demo |
| M3-T14 | Amendment acceptance + re-evaluation (S-1) | P2 | VC-AMEND-01 via API |

## 17. Your first working session (~3 hours)
1. Run `python3 tools/check_contracts.py`; read its output and `tools/aegis_oracle.py` top to bottom (60 min).
2. Read `contracts/openapi.yaml` and `plan.schema.json`, `decision.schema.json` (40 min).
3. Write `backend/app/fixtures.py` that loads all 12 fixture files, validates them with the schemas, and prints the input snapshot id; it must equal the golden `input_snapshot_id` (40 min).
4. Create the FastAPI skeleton with `/api/v1/health` returning that id (20 min).
5. Post the repo layout (§5) and CI plan in the team channel (10 min).

## 18. Day-by-day plan
| Day | Work | Milestone / checkpoint |
|---|---|---|
| Tue 20 – Fri 23 | Spikes: fixture loader, stub routes, SQLite schema; pitch support | — |
| Sun 25 | Contract review; tag v1.0.0; CI | **G0** |
| D1 | Skeleton, loader, reset, counters, stub routes | **M1** |
| D2 | Inventory + compliance agents; BTP spike (≤1 h if OD-01 a) | Member 5 R1 (UI) — not yours |
| D3 | Plan builder + financials + hash | **M2** |
| D4 | Orchestrator wiring M4/M5 modules; golden evaluation test | — |
| D5 | Golden evaluation green; decisions API | **M3**; contract change window closes |
| D6 | Execution simulator; audit chain; conformance tests | — |
| D7 | All VC-APR; bug fixes from acceptance run #1 | **M4** feature freeze |
| D8 | Timing log; offline drill; BTP final; runbook | **M5** |
| D9 | Fixes only; tag `demo-freeze` | **G1** |
If you have not started MOD-11 execution by D5 noon, Member 5 may assign the step generator (§12) to Member 4; you keep accountability.

## 19. Handoffs
| From → To | What | When |
|---|---|---|
| M3 → all | Contracts v1.0.0, CI | 25 Oct |
| M3 → M2 | Stub endpoints | D1 |
| M4 → M3 | `assess_disruption`, `check_dependency`, `eligible_routes`, `build_graph_view` passing their goldens | D3 (sensing D4) |
| M5 → M3 | `rule_applicability` passing VC-RULE-*; `explain` in `off` mode | D2; D4 |
| M3 → M2 | Live evaluation, decisions, execution, audit endpoints | D4, D5, D6 |
| M3 → M1 | Timing log, offline drill result | D8 |
| M3 → M5 | Go/no-go evidence (CI, e2e, conformance) | D9 |

## 20. Validation and definition of done
- `python3 tools/check_contracts.py` passes; `pytest -q` passes; golden flow passes twice in a row after reset with identical plan hashes.
- No endpoint returns a body that fails its schema.
- Refusals produce audit events; audit verify returns valid after the full flow.
- Demo runs offline with `AEGIS_LLM_MODE=off` and gives identical outcomes and hashes.

## 21. Blockers, escalation, fallbacks
| Blocker | Escalate | Fallback |
|---|---|---|
| Member 4/5 module late | Member 5 at stand-up | Use oracle-equivalent stub for that step behind a feature flag, clearly logged; never in the final demo without Member 5's approval |
| Model generation from schemas fails | — | Hand-written Pydantic models + schema validation in tests |
| Plan hash mismatch with golden | Member 5 | Diff `plan_hash_material` field by field; never "fix" by regenerating goldens without review |
| BTP deploy blocked | Member 5 (R-01) | Local demo + mapping slide |
| Running out of time | Member 5 | Cut in order: S-1, explanation step polish, audit filters; never cut approval enforcement |
