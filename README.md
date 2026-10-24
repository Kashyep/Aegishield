# AegisShield AI — Supply-Chain Recovery Preflight

> **SAP Hackfest Bengaluru 2026** — Synthetic demo for supply-chain disruption recovery with GraphRAG, temporal rule retrieval, deterministic LC/FTA checks, inventory allocation, honest financials, human approval, simulated execution, and hash-chained audit trail.

**All demo data is synthetic.** Companies, prices, penalties, tariff rates, schedules, the letter of credit and outcomes are fictional.

---

## Quick Start

### Prerequisites
- Python 3.12+
- Node.js 20+
- npm 10+

### 1. Contract Verification (Run First)
```bash
pip install "jsonschema>=4.18" pyyaml openapi-spec-validator
python3 tools/check_contracts.py
```
Expected: `RESULT: PASSED`

### 2. Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt
# Set environment variables (see .env.example)
export AEGIS_DEMO_MODE=1
export AEGIS_LLM_MODE=recorded  # live | recorded | off
uvicorn app.main:app --reload --port 8000
```
API available at `http://localhost:8000` — OpenAPI at `/openapi.json`

### 3. Frontend (React 19 + Vite)
```bash
cd frontend
npm install
npm run dev
```
UI available at `http://localhost:5173` — proxied to backend in production build

### 4. Full Demo (Single Process)
```bash
# Build frontend, serve from FastAPI
cd frontend && npm run build
cd ../backend && uvicorn app.main:app --host 0.0.0.0 --port 8000
# Visit http://localhost:8000
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React 19 + Vite)                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │ Command     │  │ Evaluations │  │ Supply Graph│  │ Audit Trail │   │
│  │ Center      │  │             │  │ (Cytoscape) │  │             │   │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘   │
│         │                │                │                │           │
│         └────────────────┼────────────────┼────────────────┘           │
│                          ▼                ▼                            │
│                   ┌─────────────┐  ┌─────────────┐                    │
│                   │ Neomorphic  │  │ Evidence    │                    │
│                   │ UI System   │  │ Drawer +    │                    │
│                   │ (Custom CSS)│  │ Approval    │                    │
│                   └─────────────┘  └─────────────┘                    │
└──────────────────────────────┬────────────────────────────────────────┘
                               │ JSON over HTTP
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         BACKEND (FastAPI + Python 3.12)                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │ /health      │  │ /scenario    │  │ /evaluations │  │ /plans/*   │  │
│  │ /demo/reset  │  │ /disruptions │  │ /plans/{id}  │  │ /executions│  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘  │
│         │                │                │                │             │
│         └────────────────┼────────────────┼────────────────┘             │
│                          ▼                ▼                              │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    ORCHESTRATOR (MOD-03)                         │   │
│  │  Steps: sensing → dependency → routing → inventory → compliance │   │
│  │  → plan_assembly → explanation (LLM gateway)                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│           │         │         │         │         │                   │
│           ▼         ▼         ▼         ▼         ▼                   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│  │ DSA     │ │ SDA     │ │ RTA     │ │ TCA     │ │ IRA     │        │
│  │ Sensing │ │ GraphRAG│ │ Routing │ │ Compliance│ │Inventory│        │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘        │
│       │           │           │           │           │             │
│       └───────────┼───────────┼───────────┼───────────┘             │
│                   ▼           ▼           ▼                         │
│        ┌────────────────┐ ┌────────────────┐                        │
│        │ Temporal Rules │ │ LLM Gateway    │                        │
│        │ (MOD-07)       │ │ live/recorded  │                        │
│        └────────────────┘ └────────────────┘                        │
│                   │                         │                        │
│                   └───────────┬─────────────┘                        │
│                               ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  SQLite (data/aegis.db) — evaluations, plans, decisions,       │ │
│  │  executions, audit_events, lc_versions, idempotency            │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Repository Structure

```
.
├── backend/                    # FastAPI backend
│   ├── app/
│   │   ├── agents/
│   │   │   ├── sensing/        # MOD-04: Disruption Sensing Agent
│   │   │   ├── dependency/     # MOD-05: Supplier Dependency GraphRAG
│   │   │   └── routing/        # MOD-06: Routing Agent
│   │   ├── api/                # FastAPI routes, problem+json errors
│   │   ├── audit/              # MOD-11: Hash-chained audit log
│   │   ├── db/                 # SQLite + SQLAlchemy 2.0
│   │   ├── llm/                # MOD-12: Provider-agnostic gateway (live/recorded/off)
│   │   ├── rules/              # MOD-07: Temporal rule applicability engine
│   │   ├── services/           # Business logic: evaluation, decisions, executions, fixtures
│   │   ├── main.py             # FastAPI app, all endpoints
│   │   ├── models.py           # Pydantic models (generated from contracts)
│   │   └── config.py           # Settings from env
│   ├── tests/                  # pytest: unit, integration, golden-flow
│   ├── requirements.txt
│   └── pytest.ini
│
├── frontend/                   # React 19 + TypeScript + Vite
│   ├── src/
│   │   ├── api/                # Generated API client + types
│   │   ├── app/                # Hash-based routing, navigation
│   │   ├── components/
│   │   │   ├── layout/         # AppShell, Topbar, Sidebar, PageHeader/Body
│   │   │   ├── ui/             # NeuCard, NeuButton, NeuInput, NeuChip, Modal, Drawer
│   │   │   ├── screens/        # CommandCenter, Evaluations, Execution, SupplyGraph, AuditTrail
│   │   │   └── shared/         # MetricCard, PlanCard, DisruptionCard, EvidenceTabs
│   │   ├── hooks/              # useSidebar, useMediaQuery, useLocalStorage
│   │   ├── styles/
│   │   │   ├── tokens.css      # Design tokens (colors, spacing, radius, shadows)
│   │   │   └── neomorphism.css # Neomorphic component utilities
│   │   ├── index.css           # Global styles, component implementations
│   │   └── App.tsx             # Root component, state, modals, drawers
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── contracts/                  # Machine-readable truth
│   ├── schemas/                # 9 JSON Schema 2020-12 files
│   ├── openapi.yaml            # OpenAPI 3.1 spec
│   ├── README.md               # Registry with owners/reviewers
│   └── CHANGELOG.md
│
├── fixtures/
│   ├── demo/                   # 12 synthetic input files for SCN-DEMO-001
│   ├── expected/               # Golden outputs (evaluation, assessment, graph, rules)
│   └── validation/             # 42 validation cases (39 automated, 3 manual)
│
├── tools/
│   ├── check_contracts.py      # Contract checker (schemas, integrity, goldens, OpenAPI)
│   └── aegis_oracle.py         # Reference oracle (executable specification)
│
├── docs/                       # Six decision documents
│   ├── 00-source-of-truth.md   # Canonical decisions, contracts, formulas
│   ├── 01-research-and-deck.md
│   ├── 02-ui-ux-and-frontend.md
│   ├── 03-backend.md
│   ├── 04-graphrag.md
│   └── 05-temporal-rag-ui-review-and-decisions.md
│
├── ops/                        # Deployment, runbooks
├── pitch/                      # Deck, demo script
└── tests/                      # Cross-cutting tests
```

---

## Core Concepts

### Five Logical Agents
| Agent | Purpose | Owner | Deterministic | LLM Use |
|-------|---------|-------|---------------|---------|
| **Disruption Sensing** | Notice → graph nodes, delayed shipments, affected orders, baseline loss | M4 | Alias resolution, penalties, severity | Extract fields from raw_text (validated against gold) |
| **Supplier Dependency (GraphRAG)** | Prove/refute independence of candidate suppliers | M4 | Upstream traversal ≤3 hops, BOM relevance, coverage, cycles | Explain paths citing only allowed citations |
| **Routing** | List feasible route options per quote | M4 | Eligibility: same origin port, ETD ≥ ready date | None |
| **Trade-Compliance Preflight** | LC and FTA checks per option/plan | M3 | All LC/FTA rules, duty at risk | LC text extraction (MOD-12, validated) |
| **Inventory Rebalancing** | ATP and allocation feasibility | M3 | ATP formula, availability date, allocation ≤ ATP | None |

### Evaluation Pipeline (Fixed Order)
1. **disruption_sensing** (10s) — notice → assessment
2. **supplier_dependency** (5s) — independence checks per candidate
3. **routing** (5s) — eligible routes per quote
4. **inventory_rebalancing** (5s) — ATP per source
5. **trade_compliance** (5s) — LC + FTA preflight per option
6. **plan_assembly** (5s) — P1 (cost_time_only) + P2 (constraint_verified), financials
7. **explanation** (10s) — grounded explanations, validated

**Failure propagation:** Steps 1,6 failed → evaluation `failed`. Steps 2-5 failed → affected findings `needs_review` (`check_unavailable=true`); P2 excludes those options.

### Plan States
```
blocked ← evaluation outcome blocked
needs_review ← evaluation outcome needs_review
pending_approval ← evaluation outcome passed
    ↓ approve (approver role + all acknowledgements)
approved ← only non-blocked plans
    ↓ execute (once, snapshot unchanged)
executing → completed | failed (first failure stops)
blocked → superseded (new evaluation)
```

### Who May Do What
| Action | Allowed Roles | Rules |
|--------|---------------|-------|
| Approve | supply_planner, trade_compliance_officer | Never blocked; all review findings acknowledged by permitted role |
| Reject | supply_planner, trade_compliance_officer | Justification ≥ 10 chars |
| Request LC amendment | trade_compliance_officer | Plan has blocked LC.* finding; plan stays blocked |
| Execute | any approver | Plan approved, matching decision_id, snapshot unchanged |

---

## API Reference (All `/api/v1`)

| Method & Path | Purpose | Success | Key Errors |
|---------------|---------|---------|------------|
| `GET /health` | Status, LLM mode, snapshot | 200 | — |
| `POST /demo/reset` | Restore fixtures, clear state | 200 | 403 DEMO_MODE_DISABLED |
| `GET /scenario` | Full master data + actors | 200 | — |
| `GET /disruptions` | List disruption events | 200 | — |
| `POST /evaluations` | Start evaluation (async) | 202 | 400, 404, 409 EVALUATION_IN_PROGRESS, 422 |
| `GET /evaluations/{id}` | Progress + results | 200 | 404 |
| `GET /evaluations/{id}/graph?focus_supplier_id=` | GraphView | 200 | 404, 409 EVALUATION_NOT_COMPLETE |
| `GET /plans/{id}` | Current plan with status, decision_ids | 200 | 404 |
| `POST /plans/{id}/decisions` | Approve / reject / request_amendment | 201 (200 replay) | 400, 403, 409 STALE/SUPERSEDED/EXISTS/KEY_REUSED, 422 BLOCKED/ACK/NO_AMENDABLE |
| `POST /plans/{id}/executions` | Simulated execution | 202 | 409 NOT_APPROVED / ALREADY_EXECUTED / PLAN_VERSION_STALE |
| `GET /executions/{id}` | Execution steps | 200 | 404 |
| `POST /demo/amendment-requests/{id}/simulate-acceptance` | Stretch S-1 | 200 | 403, 404 |
| `GET /audit-events` | Log page (filter by subject) | 200 | — |
| `GET /audit-events/verify` | Chain verification | 200 | — |
| `POST /rules/applicability` | Rule evidence panel + tests | 200 | 422 |

**Required headers on mutating calls:** `X-Actor-Id`, `Idempotency-Key`

---

## Frontend — Neomorphic Design System

### Design Tokens (`src/styles/tokens.css`)
- **Base background:** `#f0f2ef` (off-white for shadow visibility)
- **Elevated surface:** `#f8faf6` (cards)
- **Pressed/inset:** `#e8ebe4` (inputs)
- **Primary:** `#a0c346` | **Secondary:** `#98ddc2` | **Accent:** `#79c5d2`
- **Neomorphic shadows:** Single light source (top-left)
  - `--shadow-neu-raised`: `8px 8px 16px #d1d9cc, -8px -8px 16px #fff`
  - `--shadow-neu-pressed`: `inset 4px 4px 8px #d1d9cc, inset -4px -4px 8px #fff`

### Layout
- **Sidebar:** Collapsible (260px ↔ 72px), off-canvas drawer on mobile (<768px), state persisted in localStorage
- **Topbar:** Fixed 56px, hamburger menu, breadcrumb, actor selector, mode chip
- **Page content:** 32px padding, max-width 1400px, generous section gaps (24px)

### Component Library (`src/components/ui/`)
| Component | Variants | Use |
|-----------|----------|-----|
| `NeuCard` | raised, raised-lg, pressed, subtle, inset, interactive | All surfaces |
| `NeuButton` | primary, secondary, ghost, danger; sm/md/lg | All actions |
| `NeuInput` / `NeuTextarea` / `NeuSelect` | inset style | All forms |
| `NeuChip` / `NeuPill` / `NeuPills` | primary, success, warning, error, info, accent, neutral | Status, tabs |
| `Modal` / `Drawer` / `ConfirmDialog` | Portal-rendered, focus-trapped | Dialogs, side panels |

### Screens
| Route | Screen | Key Features |
|-------|--------|--------------|
| `/command` | CommandCenter | Disruption card, metrics, plan comparison grid, approval actions |
| `/evaluations` | EvaluationsScreen | Read-only plan cards, findings list |
| `/evaluation-progress` | EvaluationProgressScreen | Step timeline with live status, mode chips |
| `/execution` | ExecutionScreen | Simulated steps with SAP mappings, retry |
| `/supply-graph` | SupplyGraphScreen | Cytoscape dependency graph, facility details |
| `/audit-trail` | AuditTrailScreen | Filterable audit log, chain verification |

---

## Contracts & Verification

### Schema Files (in `contracts/schemas/`)
| File | Entities |
|------|----------|
| `api.schema.json` | Health, DemoResetResponse, ScenarioResponse, DisruptionList |
| `common.schema.json` | Evidence, Finding, Problem, Actor, Subject |
| `decision.schema.json` | DecisionRequest, Decision, Acknowledgement, AmendmentRequest, Execution, AuditEvent, AuditVerifyResult |
| `disruption.schema.json` | DisruptionEvent, GoldExtraction, DisruptionAssessment |
| `graph.schema.json` | GraphNode, GraphEdge, DependencyQuery, DependencyResult, DependencyPath, LinearizedContext, GraphView |
| `master-data.schema.json` | Scenario, Location, Agreement, Part, Customer, Supplier, CustomerOrder, PurchaseOrder, Shipment, SupplierQuote, RouteOption, InventoryPosition, LetterOfCredit, Source, Policies |
| `plan.schema.json` | SourceOption, PlanLine, Exposure, PlanFinancials, RecoveryPlan, PlanComparison, AgentStep, Explanation, Evaluation |
| `trade-rules.schema.json` | TradeRule, RuleQuery, RuleApplicabilityResult |

### Verification Commands
```bash
# Contract integrity
python3 tools/check_contracts.py

# Backend tests
cd backend && pytest -v

# Frontend type check
cd frontend && npx tsc --noEmit

# Frontend build
cd frontend && npm run build

# Playwright tests (requires running dev server)
cd frontend && npm run test
```

---

## Demo Scenario (SCN-DEMO-001)

**Buyer:** Kaveri Motion Systems, Bengaluru (PM-750 IGBT modules)  
**Primary Supplier:** SUP-A Penang PowerTech — PO-7001, 900 units @ ₹6,000, shipment SHP-A-0901 (Port Klang → Chennai), planned arrival 2 Nov  
**Disruption:** DIS-2026-0042 — Zenith Wafer Fab (Kulim) outage 24 Oct → shipment departs 2 Nov (+7 days) → plant arrival 9 Nov  
**Orders:** SO-1001 (400u, need 3 Nov, ₹250/u/d), SO-1002 (300u, need 5 Nov, ₹300/u/d), SO-1003 (200u, need 7 Nov, ₹500/u/d)  
**Baseline loss:** ₹11,60,000

**Quote B:** SUP-B Chao Phraya (TH) — ₹6,300, 400u, ready 27 Oct Laem Chabang, advance payment  
**Quote C:** SUP-C Saigon Precision (VN) — ₹6,600, 600u, ready 28 Oct Ho Chi Minh, under LC-SYN-0117  

**P1 (cost_time_only):** On paper ₹8,26,000 net avoided loss — **BLOCKED** (Thai supplier depends on same fab; Singapore transhipment breaks LC 43T)  
**P2 (constraint_verified):** ₹6,18,000 net avoided loss — **PASSED** (Vietnamese supplier direct sailing)

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AEGIS_DEMO_MODE` | `0` | Enable `/demo/reset`, `/demo/amendment-requests/*/simulate-acceptance` |
| `AEGIS_LLM_MODE` | `recorded` | `live` \| `recorded` \| `off` — LLM gateway mode |
| `AEGIS_CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated CORS origins |
| `AEGIS_FRONTEND_DIST` | `../frontend/dist` | Path to built frontend for single-origin serving |

---

## Development Workflow

### Adding a New API Endpoint
1. Add schema to `contracts/schemas/*.schema.json`
2. Update `contracts/openapi.yaml`
3. Run `python3 tools/check_contracts.py`
4. Generate types: `cd frontend && npx openapi-typescript ../contracts/openapi.yaml -o src/api/types.ts`
5. Implement backend route in `backend/app/main.py`
6. Add frontend API call in `src/api/client.ts`

### Adding a New UI Screen
1. Create component in `src/components/screens/`
2. Export from `src/components/screens/index.ts`
3. Add route in `App.tsx` (inside `Routes`)
4. Add nav item in `src/app/navigation.ts`

### Running Validation Cases
```bash
cd backend
pytest tests/test_rules.py tests/test_dependency.py tests/test_schema_conformance.py -v
```

---

## Key Files for AI Agents

| Need | File |
|------|------|
| **Canonical decisions, formulas, contracts** | `docs/00-source-of-truth.md` |
| **Backend architecture, module boundaries** | `docs/03-backend.md` |
| **Frontend architecture, component structure** | `docs/02-ui-ux-and-frontend.md` |
| **GraphRAG, dependency traversal logic** | `docs/04-graphrag.md` |
| **Temporal rule engine, applicability logic** | `docs/05-temporal-rag-ui-review-and-decisions.md` |
| **All contracts (machine-readable)** | `contracts/schemas/*.schema.json` |
| **OpenAPI spec** | `contracts/openapi.yaml` |
| **Golden outputs** | `fixtures/expected/*.json` |
| **Validation cases** | `fixtures/validation/cases.json` |
| **Backend entry point** | `backend/app/main.py` |
| **Frontend entry point** | `frontend/src/App.tsx` |
| **Design tokens** | `frontend/src/styles/tokens.css` |
| **Neomorphic utilities** | `frontend/src/styles/neomorphism.css` |

---

## Common Tasks

### Reset Demo State
```bash
curl -X POST http://localhost:8000/api/v1/demo/reset \
  -H "X-Actor-Id: USR-PRIYA" \
  -H "Idempotency-Key: $(uuidgen)"
```

### Start Evaluation
```bash
curl -X POST http://localhost:8000/api/v1/evaluations \
  -H "X-Actor-Id: USR-PRIYA" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"disruption_id": "DIS-2026-0042"}'
```

### Poll Evaluation
```bash
curl http://localhost:8000/api/v1/evaluations/EVAL-0001
```

### Approve Plan
```bash
curl -X POST http://localhost:8000/api/v1/plans/PLN-0002/decisions \
  -H "X-Actor-Id: USR-PRIYA" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"action": "approve", "plan_version": 1, "plan_hash": "abc123..."}'
```

### Verify Audit Chain
```bash
curl http://localhost:8000/api/v1/audit-events/verify
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `check_contracts.py` fails | Ensure `contracts/openapi.yaml` and all `schemas/*.schema.json` are in sync |
| Frontend shows "Connection refused" | Backend not running on port 8000; check `AEGIS_CORS_ORIGINS` |
| Evaluation stuck in `queued` | Check backend logs; LLM gateway may be timing out in `live` mode |
| `PLAN_VERSION_STALE` on approval | Re-fetch plan with `GET /plans/{id}` for current version/hash |
| Sidebar not collapsing | localStorage may have stale value; clear `aegisshield:sidebar-state` |
| Neomorphic shadows not visible | Ensure background is `#f0f2ef` (not pure white) in `tokens.css` |

---

## Stretch Goals (Post-MVP)

| ID | Goal | Validation Case |
|----|------|-----------------|
| S-1 | Simulated LC amendment acceptance + re-evaluation | VC-AMEND-01 |
| S-2 | Live LLM extraction of supplier notice | VC-LLM-02 |
| S-3 | Rule timeline graphic | — |
| S-4 | SAP HANA Cloud vector engine for rule passages | — |
| S-5 | One real RSS feed classified by sensing agent | — |
| S-6 | Ownership edges in supply graph | — |
| S-7 | Third plan "P3 with acknowledged review items" | — |

---

## License

Internal demo package for SAP Hackfest Bengaluru 2026. Not for production use.

---

## For AI Agents Working on This Repo

1. **Read `docs/00-source-of-truth.md` first** — it contains every canonical decision, formula, and contract summary
2. **Contracts are truth** — `contracts/schemas/` and `contracts/openapi.yaml` define all data shapes
3. **Fixtures are goldens** — `fixtures/expected/` contains the exact outputs your code must produce
4. **Determinism is mandatory** — same inputs must produce same IDs, amounts, and plan hashes across `live`/`recorded`/`off` modes
5. **Neomorphic UI** — use `NeuCard`, `NeuButton`, `NeuInput`, `NeuChip` from `components/ui/`; never write custom shadows
6. **Sidebar state** — use `useSidebar()` hook; it handles collapse/expand, mobile drawer, and localStorage persistence
7. **Hash routing** — screens map to URL hashes (`#command`, `#evaluations`, etc.) via `src/app/navigation.ts`
8. **Modals/Drawers** — use `Modal`, `Drawer`, `ConfirmDialog` from `components/ui/`; they handle focus trapping and portals
9. **API client** — all calls go through `src/api/client.ts` with `X-Actor-Id` and `Idempotency-Key` headers
10. **Type safety** — run `npx tsc --noEmit` in `frontend/` before committing