# Member 2 — UI/UX Design and Frontend

| | |
|---|---|
| Role | UI/UX designer and frontend developer |
| You own (accountable) | MOD-13 Frontend application, MOD-14 Graph & evidence components, MOD-20 UI tests & accessibility |
| Reviewer and final design authority | Member 5, at four bounded checkpoints (R1–R4, §12). You own implementation choices between checkpoints. |
| Canonical facts | `docs/00-source-of-truth.md`; API in `contracts/openapi.yaml`; demo data in `fixtures/expected/` |

---

## 1. The project in brief
AegisShield AI checks supply-chain recovery plans before anyone executes them. After a disruption, the backend produces two plans: **P1** (cheapest and fastest, built without checks) and **P2** (only options that passed every check). Your screens must make one moment obvious: *P1 looks better on paper, but AegisShield proves it cannot be executed, and P2 is the safe choice.* Then a person approves P2, execution is simulated, and the audit trail verifies. All data is synthetic.

**Glossary you need:** *finding* = result of one check (`passed`, `needs_review`, `blocked`); *evidence* = the record behind a finding (graph path, LC field, rule passage, fixture record); *exposure* = money that might be lost if a risk materialises (never part of cost); *plan hash* = fingerprint of a plan version that an approval must quote; *LLM mode* = `live` / `recorded` / `off`. Full glossary: `docs/00` §17.

---

## 2. Mission and boundaries
**Mission.** Turn the evaluation payload into a 3-minute story a judge understands without explanation, and make the approval flow safe, accessible and impossible to misuse from the UI.

**You own:** user journeys, screen design, design tokens, all frontend code, Cytoscape graph component, evidence drawer, rule and LC panels, approval modal, execution and audit screens, UI copy, accessibility, Playwright smoke test, frontend build for the demo laptop.

**Not yours (consume, don't recompute):** outcomes, amounts, dates and recommendations come from the API. **The UI never calculates money or decides outcomes.** It formats them. Plan status changes only via API responses. Contracts are owned by Member 3 (API), Member 4 (graph view), Member 5 (rules). Copy for legal claims is approved by Member 5.

---

## 3. Deliverables, locations, dependencies
| ID | Deliverable | Location | Due | Depends on |
|---|---|---|---|---|
| M2-D1 | User flows + wireframes (all 7 screens) | `frontend/design/wireframes.pdf` or Figma link in `frontend/design/README.md` | v0 Tue 20, v1 Wed 21 Oct | this doc |
| M2-D2 | Mock screens for Round 1 slide 8 | `pitch/round1/mocks/` | Thu 22 Oct | goldens |
| M2-D3 | App shell, tokens, API client, generated types | `frontend/src/{app,api,styles}` | D1 | `contracts/openapi.yaml` |
| M2-D4 | Command Center, Evaluation progress, Plan Comparison | `frontend/src/features/*` | D2–D4 | stub API (D1), live API (D4) |
| M2-D5 | Evidence drawer, Graph view, Rule panel, LC panel | `frontend/src/features/evidence` | D3–D4 | GraphView (M4), rule results (M5) |
| M2-D6 | Approval modal, actor switcher | `frontend/src/features/approval` | D5 | decisions API (M3) |
| M2-D7 | Execution and Audit screens | `frontend/src/features/{execution,audit}` | D6 | execution/audit API (M3) |
| M2-D8 | Playwright smoke + a11y checklist | `frontend/tests` | D6–D7 | full flow |
| M2-D9 | Demo build + offline instructions | `ops/runbook.md` (section "Frontend") | D8 | M3 runbook |

---

## 4. Inputs, outputs and contract references
| Screen | Calls | Fields used | Schema |
|---|---|---|---|
| Global header | `GET /api/v1/health`, `GET /api/v1/scenario` | `data_mode`, `llm_mode`, `status`; `scenario.notice`, `actors[]` | `api.schema.json#Health`, `#ScenarioResponse` |
| Command Center | `GET /api/v1/disruptions`, `GET /api/v1/scenario`; after evaluation: `assessment` | event `raw_text`, orders, `affected_orders[]`, `baseline_loss_inr`, `severity` | `disruption.schema.json` |
| Evaluation progress | `POST /api/v1/evaluations` then poll `GET /api/v1/evaluations/{id}` every 500 ms | `status`, `steps[]` (`step`, `status`, `mode`, `attempts`) | `plan.schema.json#Evaluation`, `#AgentStep` |
| Plan Comparison | same evaluation | `comparison`, `plans[]` (`lines`, `financials`, `check_outcome_counts`, `outcome`, `status`), `explanations[]` | `#PlanComparison`, `#RecoveryPlan`, `#PlanFinancials` |
| Evidence drawer | evaluation (findings, evidence, rule_results), `GET /api/v1/evaluations/{id}/graph?focus_supplier_id=` | `findings[]`, `evidence[]`, `rule_results[]`, `GraphView` | `common.schema.json#Finding`, `#Evidence`, `graph.schema.json#GraphView`, `trade-rules.schema.json#RuleApplicabilityResult` |
| Approval modal | `GET /api/v1/plans/{id}`, `POST /api/v1/plans/{id}/decisions` | `version`, `plan_hash`, `status`, needs_review findings | `decision.schema.json#DecisionRequest`, `#Decision`, Problem |
| Execution | `POST /api/v1/plans/{id}/executions`, poll `GET /api/v1/executions/{id}` | `steps[]` with `simulated`, `proposed_sap_mapping` | `#Execution` |
| Audit | `GET /api/v1/audit-events`, `GET /api/v1/audit-events/verify` | events, `valid`, `first_invalid_seq` | `#AuditEventPage`, `#AuditVerifyResult` |
| Demo controls | `POST /api/v1/demo/reset` | `audit_event_id` | `#DemoResetResponse` |

**Type generation (do on D1):** bundle then generate, so external `$ref`s resolve:
`npx @redocly/cli bundle ../contracts/openapi.yaml -o build/openapi.bundled.yaml && npx openapi-typescript build/openapi.bundled.yaml -o src/api/schema.d.ts`.
Never hand-write API types. If generation fails, tell Member 3 the same day.

**Stub mode:** `VITE_API_MODE=stub` serves `fixtures/expected/evaluation_EVAL-0001.json` and `graph_view_SUP-B.json` from `public/stubs/` so you can build before the backend exists. Member 3 also serves the same goldens from real routes on D1.

---

## 5. User journeys
**J1 — Priya recovers the orders (main demo).** Sees disruption → runs evaluation → watches agents finish → compares P1/P2 → opens "Why is P1 blocked?" → sees the graph path and LC clause → returns → approves P2 → executes → checks audit.
**J2 — Approving a blocked plan.** Priya clicks Approve on P1 → button is disabled with reason; if forced through the API, the server's `PLAN_BLOCKED` message is shown verbatim.
**J3 — Arjun requests an LC amendment (P1).** Switch actor to Arjun → open LC finding → "Request LC amendment" → enter justification → plan stays Blocked, amendment request id shown.
**J4 — Review items (validation scenario).** For a plan with needs_review findings, each finding has an acknowledgement checkbox enabled only for the permitted role; Approve unlocks when all are acknowledged.
**J5 — Something changed.** Approval returns 409 `PLAN_VERSION_STALE` or `PLAN_SUPERSEDED` → modal shows "This plan changed or was replaced. Reload to review the current version." with a Reload button.

---

## 6. Screens
Layout target: 1920×1080 projector at 3 m and 1366×768 laptop. Left: content; right: evidence drawer (overlay, 480 px).

### S0 Global frame
- Top bar: product name; scenario `SCN-DEMO-001`; persistent **"SYNTHETIC DATA — fictional companies and figures"** banner (not dismissible); LLM badge (`LLM: off (templates)`, `LLM: recorded`, `LLM: live`; amber "degraded" if health says degraded); actor switcher labelled "Simulated identity" (Priya – Supply Planner, Arjun – Trade Compliance, Guest viewer); Reset demo (confirm dialog).
- Left nav: Command Center · Evaluation · Execution · Audit.

### S1 Command Center
- Disruption card: title, received time, channel, severity pill, the raw notice text in a quote block, "Run recovery evaluation" primary button.
- Affected orders table: Order, Customer, Units, Need-by, Revised arrival, Days late, Penalty (baseline). Totals row: **₹11,60,000**.
- Small "What happens next" strip naming the five agents.

### S2 Evaluation progress
- Vertical timeline of 7 steps: Disruption sensing · Supplier dependency · Routing · Inventory rebalancing · Trade compliance · Plan assembly · Explanation. Each row: status icon + text, mode chip (`gold`, `deterministic`, `template`, `recorded`, `live`), attempts if > 1. `aria-live="polite"` announces each completed step.
- On `completed`, auto-scroll to S3. On `failed`, show `error.message` and "Run again".

### S3 Plan Comparison (the money shot)
- Two cards side by side, ordered P1 then P2, recommended card marked "Recommended" with the rule as tooltip (`comparison.recommendation_rule`).
- Each card: label; outcome pill; status text; four big numbers (Recovery cost, Residual loss, Net avoided loss, Worst-case exposure); check counts ("15 passed · 1 needs review · 2 blocked"); allocation table (Order, Source, Units, Arrives, Days late); buttons: "Why?" (opens drawer filtered to non-passed findings), Approve, Reject.
- Blocked card: net avoided loss shown with the qualifier **"on paper"**, strikethrough-free (do not hide it), plus a banner "Cannot be approved: 2 blocking findings". Exposure list shows each item; mutually exclusive items carry "either/or".
- Callout under cards: "P1 looks ₹2,08,000 better on paper" from `comparison.paper_advantage_of_best_blocked_plan_inr`.
- Source names: map `option_id` to readable text using `options[]` (e.g. `OPT-RT-B-CMB` → "Chao Phraya (TH) via Colombo"), `OPT-INV-BLR` → "Bengaluru plant stock".

### S4 Evidence drawer (per finding)
- Header: outcome pill, finding title, check code (muted), subject.
- "Why" section: deterministic sentence from the finding `title` + key `details` (e.g. transit countries, ETD vs 44C).
- "Evidence" tabs by kind:
  - **Graph** (graph_path) — Cytoscape view (§9) focused on the supplier; blocking path highlighted; text alternative list below.
  - **Letter of credit** (lc_field) — monospace block of the MT700-style lines with the cited tag highlighted; LC id and version; synthetic label.
  - **Rules** (rule_passage) — table from `rule_results` for that route: rule id, type, value, effective from–to, authority, and outcome: *Applied*, *Superseded*, *Draft — not in force*, *Lower authority*, *Not yet effective*, *Expired*; conflicts shown as "Resolved: official source overrides newsletter".
  - **Record** (fixture_record/source_document) — key/value view with source title.
- "AI explanation" section only if an explanation exists: mode badge, validation status; text; cited ids rendered as links. Always labelled "Explanation only — decisions come from the checks above".
- Remedies: buttons for allowed actions (only `request_lc_amendment` is actionable in MVP, and only for the compliance role).

### S5 Approval modal
- Shows: plan label, version, short hash (first 12 hex chars) with copy button, four numbers, outcome.
- Acknowledgements: one row per `needs_review` finding with checkbox, required note (≥ 5 chars), and the role that may acknowledge; disabled with explanation if the current actor lacks the role.
- Justification textarea (required for Reject, optional for Approve).
- Buttons: Approve (disabled for blocked plans with the reason shown), Reject, Request LC amendment (only compliance role + blocked LC finding).
- Idempotency: generate one UUID per modal submit intent and reuse it on network retry; new intent → new key.
- Problem handling: show `title` + `detail` from problem+json; for 409 stale/superseded show Reload; for 409 `DECISION_EXISTS` refresh the plan; for 403 suggest switching actor; for 422 show the field errors.

### S6 Execution
- Header: plan, decision id, execution status.
- Steps list: step type, human description, refs summary, status, **"Simulated"** chip on every row, "Proposed SAP mapping:" small text.
- Poll every 500 ms until completed/failed. Failed: show failed step and skipped steps; no retry button (by design).

### S7 Audit
- Table: Seq, Time, Actor (role), Event, Subject, Hash (8 chars). Filters: subject id. "Verify chain" button → green "Chain valid (26 events)" (26 after the golden flow) or red "Chain broken at seq N".

---

## 7. UI states (apply consistently)
| State | Where | Treatment |
|---|---|---|
| Loading | all | skeletons; never spinners longer than 300 ms without text |
| Empty | Audit before reset; Comparison before evaluation | short instruction + primary action |
| Backend offline | global | full-width error "Backend not reachable at localhost:8000" + Retry; presenter note "use backup video" |
| LLM degraded | global badge | amber badge; tooltip "Explanations use templates; decisions unaffected" |
| Evaluation running / failed | S2 | timeline / error + Run again |
| Plan `blocked` | S3/S5 | red-family pill + "Blocked" text + octagon icon; Approve disabled with reason |
| Plan `needs_review` | S3/S5 | amber pill + "Needs review"; acknowledgement checklist |
| Plan `pending_approval` | S3/S5 | neutral/blue pill "Ready for approval" |
| `approved` / `executing` / `completed` / `failed` / `rejected` / `superseded` | S3/S6 | distinct text + icon; superseded cards greyed with "Replaced by newer evaluation" |
| Finding `not_applicable` | S4 | grey "Not applicable" |
| Stale (409) | S5 | Reload prompt with current hash |

Outcome vocabulary is fixed: **Passed**, **Needs review**, **Blocked**, **Not applicable**. Use the same icon set everywhere (check, eye/question, octagon, dash).

---

## 8. Evidence presentation rules
1. Every finding shows ≥1 evidence item; if an evidence id cannot be resolved, show "Evidence missing" in red and report it (it is a contract bug).
2. Synthetic sources show a "Synthetic" chip; secondary sources show "Secondary source".
3. Excerpts are shown as short quotes with the source title; never invent text.
4. AI text is visually separate from deterministic text and always labelled with its mode.
5. Rule tables always show **why other rules were not used**, because that is the temporal-RAG proof.
6. Money format: `Intl.NumberFormat('en-IN', {style: 'currency', currency: 'INR', maximumFractionDigits: 0})` → ₹11,60,000. Dates: `3 Nov 2026`. Percentages from bps: `1500 → 15 %`.

---

## 9. Graph view specification (Cytoscape.js)
- Data: `GraphView` from `/evaluations/{id}/graph?focus_supplier_id=SUP-B` (golden: `fixtures/expected/graph_view_SUP-B.json`).
- Direction: draw arrows **source → target** (goods flow towards our plant). `CANDIDATE_SUPPLY` edges dashed.
- Layout: `preset` with deterministic columns by `role` — wafer_fab/material_supplier (col 0) → die_processing (col 1) → module_assembly (col 2) → buyer_plant (col 3); rows sorted by node id. Stable across runs (good for rehearsals).
- Node encoding (never colour alone): `disrupted` = octagon + "Disrupted" label line; `blocked` = thick border + "Blocked" badge; `candidate_passed` = "Passed" badge; `affected_primary` = dashed border + "Delayed"; `buyer` = hexagon "Our plant"; `normal` = plain. Each node label: facility label + country code.
- Highlighted path edges (`highlighted: true`): thicker line + arrowhead + "path" pattern; others muted.
- Interactions: click node → side tooltip with org name, country, role, synthetic; keyboard: Tab cycles focusable list of nodes in the text alternative (Cytoscape canvas is not keyboard-accessible, so the list is the accessible equivalent); "Reset view" button.
- Text alternative: render `text_alternative[]` as an ordered list under the graph; screen-reader heading "Supplier paths".
- Toggle chips: SUP-B / SUP-C to switch `focus_supplier_id`.

---

## 10. Accessibility expectations (MVP)
- WCAG 2.2 AA text contrast; status = icon + text + colour; focus always visible; logical tab order.
- Modal: focus trap, Escape closes, focus returns to the trigger; drawer: `role="dialog"` with label.
- `aria-live="polite"` for evaluation progress and execution steps.
- Minimum target size 24×24 CSS px; body text ≥ 16 px; tables ≥ 14 px; respects `prefers-reduced-motion`.
- Graph has a text alternative; tables have headers and captions.
- Test: keyboard-only run of J1 and J2; axe DevTools scan with zero serious issues on S1–S7 (record in `frontend/tests/a11y.md`).

---

## 11. Frontend architecture
```
frontend/
  src/
    api/schema.d.ts         generated
    api/client.ts           fetch wrapper: base URL, X-Actor-Id, Idempotency-Key, problem+json parsing
    api/hooks.ts            TanStack Query hooks; polling helpers
    app/                    router, layout, global header
    features/command-center/
    features/evaluation/    progress + comparison
    features/evidence/      EvidenceDrawer, GraphView, RulePanel, LcPanel, RecordPanel
    features/approval/
    features/execution/
    features/audit/
    lib/format.ts           money, dates, bps, outcome labels
    lib/labels.ts           option_id → readable source text, step names
    styles/tokens.css       colour, spacing, type tokens (light theme; projector-friendly)
  public/stubs/             copies of fixtures/expected for stub mode
  tests/unit/               Vitest
  tests/e2e/smoke.spec.ts   Playwright
```
Routes: `/` (S1), `/evaluations/:evaluationId` (S2+S3; drawer via `?finding=<id>`), `/executions/:executionId` (S6), `/audit` (S7).
State: server state only via TanStack Query; local UI state per feature; actor id in context + `localStorage` wrapped in try/catch.

---

## 12. Design review with Member 5 (bounded)
| Checkpoint | When | Length | Input | Exit |
|---|---|---|---|---|
| R1 | D2 Tue 27 Oct, 17:00 | 45 min | wireframes for S1–S7, comparison card mock with golden numbers | Approved layout or ≤5 change requests |
| R2 | D4 Thu 29 Oct, 17:00 | 45 min | first integrated build on live API | ≤5 change requests, each tagged must/should |
| R3 | D7 Sun 1 Nov, 15:00 | 60 min | full flow J1–J5, a11y results | Feature freeze confirmation |
| R4 | D8 Mon 2 Nov, 12:00 | 30 min | rehearsal build | Polish sign-off |
Outside checkpoints, Member 5 answers blocking questions within 4 working hours; otherwise your proposal stands.

**Review criteria:** (1) a first-time viewer names the recommended plan and why P1 is blocked within 10 s; (2) numbers equal goldens; (3) outcome vocabulary and icons consistent; (4) evidence ≤2 clicks from any finding; (5) synthetic label visible on every screen; (6) no certainty words ("guaranteed", "never"); (7) a11y checklist passes; (8) legible on projector; (9) 403/409/422/offline states demonstrated; (10) blocking path distinguishable without colour.

---

## 13. Backlog (priority order)
| ID | Task | Pri | Acceptance criteria |
|---|---|---|---|
| M2-T1 | Wireframes S1–S7 + flows J1–J5 | P0 | Reviewed in kickoff; used for deck mocks |
| M2-T2 | Project setup, tokens, generated types, client with headers | P0 | `npm run build` passes; types generated from contract |
| M2-T3 | Stub mode | P0 | Comparison renders golden numbers with backend off |
| M2-T4 | Command Center | P0 | DA-02 |
| M2-T5 | Evaluation progress | P1 | 7 steps render; aria-live announces |
| M2-T6 | Plan Comparison | P0 | DA-04; option labels readable |
| M2-T7 | Evidence drawer + Rule panel + LC panel | P0 | DA-06, DA-07 |
| M2-T8 | Graph view | P0 | DA-05 with text alternative |
| M2-T9 | Approval modal + actor switcher + problem handling | P0 | DA-08, DA-09; J3, J4, J5 work against the API |
| M2-T10 | Execution screen | P0 | DA-10 |
| M2-T11 | Audit screen + verify | P0 | DA-11 |
| M2-T12 | Global badges, banner, reset | P0 | DA-01, DA-12 |
| M2-T13 | Playwright smoke | P1 | Passes on demo laptop twice in a row |
| M2-T14 | Accessibility pass | P0 | DA-13; axe zero serious |
| M2-T15 | Rule timeline graphic (stretch S-3) | P2 | Only after R3 approval |

## 14. Your first working session (~3 hours)
1. Read `docs/00` §1, §4, §11, §12 and this document (45 min).
2. Run `python3 tools/check_contracts.py` (5 min) and open `fixtures/expected/evaluation_EVAL-0001.json`; find `comparison`, `plans[0].lines`, `findings`, `evidence` (20 min).
3. Sketch S3 Plan Comparison with the real numbers on paper first (30 min).
4. Sketch S4 drawer for `FND-DEP-SUP-B` and `FND-LC-TRANSHIPMENT-RT-C-SIN` (30 min).
5. Draft flows J1–J5 (30 min). Share with Member 5 and Member 1 for the deck.

## 15. Day-by-day plan
| Day | Work | Checkpoint |
|---|---|---|
| Tue 20 | Flows + wireframes v0; OD-03 options to Member 5 | Kickoff |
| Wed 21 | Wireframes v1 | — |
| Thu 22 | Mock screens for deck (golden numbers, "design mock" label) | Deck v1 |
| Fri 23–Sun 25 | Pitch support; design tokens; contract review sign-off | G0 |
| D1 | Setup, types, client, stub mode, header, S1 | M1 milestone |
| D2 | S3 Comparison on stub | **R1** |
| D3 | S4 drawer, Rule/LC panels | M2 milestone |
| D4 | Switch to live API; Graph view; S2 progress | **R2** |
| D5 | Approval modal, actor switcher, problem handling | M3 milestone |
| D6 | Execution + Audit; Playwright smoke | — |
| D7 | a11y pass; polish; fixes from acceptance run | **R3**, feature freeze |
| D8 | Rehearsal fixes only | **R4** |
| D9 | Fixes only; demo build packaged | G1 |

## 16. Handoffs
| From → To | What | When |
|---|---|---|
| M2 → M1 | Wireframes and mock screens | 21–22 Oct |
| M3 → M2 | Stub endpoints serving goldens | D1 |
| M4 → M2 | GraphView endpoint live; label/role conventions | D3–D4 |
| M5 → M2 | Rule status wording; explanation display rules | D3 |
| M2 → M3 | Contract issues found in generated types | same day |
| M2 → M1 | Final click path and timings for narration | D5 |
| M2 → all | Demo build + runbook section | D8 |

## 17. Validation and definition of done
- Builds without TypeScript errors with generated types; lint passes.
- All numbers on S1/S3 match `fixtures/expected/evaluation_EVAL-0001.json` (unit test compares rendered values to the golden).
- Playwright smoke passes against the live backend twice in a row after reset.
- DA-01…DA-13 pass in Member 1's acceptance run.
- No API call without `X-Actor-Id` on mutating requests; idempotency keys reused on retry.

## 18. Blockers, escalation, fallbacks
| Blocker | Escalate | Fallback |
|---|---|---|
| Type generation fails on external refs | Member 3 (same day) | Use the bundled spec committed by Member 3 |
| Backend not ready | Member 3 | Stub mode |
| Cytoscape issues | Member 4 for data; Member 5 for scope | Render the text alternative list with highlighted path rows (still meets DA-05 wording) |
| Design disagreement | Member 5 at the next checkpoint or within 4 h | Your proposal stands if no answer |
| Time pressure on D6–D7 | Member 5 | Drop S2 animation, rule timeline, and audit filters first |
