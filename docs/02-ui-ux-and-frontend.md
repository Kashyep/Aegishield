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

---

## 19. Frontend UI/UX Audit Findings (Static Review)

*Performed against `docs/02-ui-ux-and-frontend.md` requirements and the requested visual system (Alegreya SC / Overpass / Shanti typography; Blöcke UI Kit reference; palette: Text `#080b04`, Background `#fdfefb`, Primary `#a0c346`, Secondary `#98ddc2`, Accent `#79c5d2`). Evidence drawn from `frontend/src/**`, `frontend/tests/**`, and `frontend/public/stubs/**`.*

### 19.1 Visual System & Design Tokens

| ID | Severity | Area | Finding | Evidence | User Impact | Suggested Correction |
|----|----------|------|---------|----------|-------------|----------------------|
| VIS-01 | High | Typography — Global | Current font stack is `font-family: "Segoe UI", Arial, sans-serif` (App.css:2). Required: Alegreya SC (headings), Overpass (body/UI), Shanti (accent/small labels). No font loading or fallbacks for the specified families exist. | `App.css:2-3` | All screens render with system UI font instead of the intended typographic hierarchy; headings lack distinctive character, body text lacks Overpass readability, accent labels lack Shanti styling. | Add `@font-face` or `@import` for Alegreya SC, Overpass, Shanti (Google Fonts or self-hosted). Define CSS custom properties: `--font-heading`, `--font-body`, `--font-accent`. Apply to `h1-h3`, body, `.eyebrow`/`.metric-label`/`.finding-link span` respectively. |
| VIS-02 | High | Colour Palette — Global | Palette uses entirely different values: Primary `#0a6ed1` (blue), Background `#f5f7fa` (cool gray), Text `#1d2939` (dark slate), Success `#187348` (green), Warning `#d98a16` (amber), Error `#c24135` (red). Required: Text `#080b04`, Background `#fdfefb`, Primary `#a0c346`, Secondary `#98ddc2`, Accent `#79c5d2`. No CSS custom properties for colours — raw hex throughout. | `App.css:2-5`, `App.css:31-40`, `App.css:138-148`, `App.css:298-305`, `App.css:452-476`, `App.css:630-665`, `App.css:1012-1049` | Brand identity not reflected; primary actions use blue not green; backgrounds are cool gray not warm off-white; text contrast may differ from spec. | Define CSS custom properties in `:root` for all palette colours. Replace all hard-coded hex values with `var(--color-*)`. Map: `--color-text` `#080b04`, `--color-bg` `#fdfefb`, `--color-primary` `#a0c346`, `--color-secondary` `#98ddc2`, `--color-accent` `#79c5d2`. Derive semantic tokens (e.g., `--color-primary-hover`, `--color-focus`) from these. |
| VIS-03 | Medium | Colour Contrast — Text on Background | Current text `#1d2939` on background `#f5f7fa` = 7.5:1 (passes AA). Spec text `#080b04` on `#fdfefb` = 15.8:1 (passes AAA). However, muted text `#52657a` on `#f5f7fa` = 4.9:1 (fails AA for small text). Spec muted on `#fdfefb` would be lower. | `App.css:4`, `App.css:973-974` | Secondary/metadata text (timestamps, labels, helper text) may not meet WCAG 2.2 AA for 12-13px text. | Ensure muted text token meets 4.5:1 on background. Consider `--color-text-muted` derived from text colour at 60% opacity, or choose a darker muted value (e.g., `#3a3f33`). |
| VIS-04 | Medium | Colour Contrast — Status Badges | Status badge backgrounds use light tints (e.g., `#e8f7ef`, `#fff0ed`, `#fff5d9`) with foreground colours (`#187348`, `#a12c20`, `#805300`). Contrast ratios: Passed ~6.8:1 (OK), Blocked ~5.2:1 (OK), Needs Review ~3.8:1 (fails AA for 11px text). | `App.css:452-476`, `App.css:1017-1023` | "Needs review" badge text may be unreadable for low-vision users at small size. | Adjust `--color-warning-fg` to darker amber (e.g., `#7a4b00`) or darken badge background. Ensure all status badge combos meet 4.5:1. |
| VIS-05 | Medium | Focus Indicator — Colour | Focus ring uses `#5eafff` (light blue) on white cards and blue primary buttons. On primary button (`#0a6ed1` bg), `#5eafff` ring = 2.1:1 (fails 3:1 for focus indicator). On white, `#5eafff` = 2.9:1 (borderline). | `App.css:353-356` | Keyboard users may not perceive focus on primary buttons or light backgrounds. | Use a focus ring colour with ≥3:1 against both primary button bg and white. Options: `--color-primary` darkened (`#085caf` → 3.2:1 on white, but low on primary), or a dedicated `--color-focus-ring` (e.g., `#004080` on white = 8.6:1, on primary = 3.5:1). Consider double-ring (white + dark) for universal contrast. |
| VIS-06 | Low | Spacing & Sizing Tokens | No design tokens for spacing, border-radius, shadows. Values hard-coded (e.g., `padding: 28px 38px`, `border-radius: 10px`, `gap: 16px`). | Throughout `App.css` | Inconsistent rhythm; hard to adjust globally; diverges from Blöcke UI Kit spacing scale. | Define spacing scale (`--space-1`…`--space-8`), radius scale, shadow scale as CSS custom properties. Replace magic numbers. |

---

### 19.2 Component & Screen Conformance (vs. §6 Screens Spec)

| ID | Severity | Area | Finding | Evidence | User Impact | Suggested Correction |
|----|----------|------|---------|----------|-------------|----------------------|
| SCR-01 | High | S0 Global Frame — LLM Badge | Spec: LLM badge shows `LLM: off (templates)`, `LLM: recorded`, `LLM: live`; amber "degraded" if health says degraded. Current: `LLM: ${llmMode}${llmMode === 'off' ? ' (templates)' : ''}${health?.status === 'degraded' ? ' · degraded, templates in use' : ''}` (App.tsx:147-148). Missing: explicit `live`/`recorded` labels; "degraded" phrasing differs. | `App.tsx:147-148`, `App.css:113` (`.llm-badge` only in sidebar) | User cannot distinguish live vs recorded LLM mode; degraded state wording inconsistent with spec. | Match spec exactly: `LLM: off (templates)` | `LLM: recorded` | `LLM: live`; if `health?.status === 'degraded'` append ` · degraded` (amber badge). Add amber variant for degraded. |
| SCR-02 | High | S0 Global Frame — Actor Switcher Label | Spec: "Simulated identity" label on actor switcher. Current: `<label htmlFor="actor-select">Simulated identity</label>` exists (App.tsx:617) but select has `aria-label="Simulated identity"` — duplicate labelling. | `App.tsx:617` | Screen readers may announce label twice. | Remove `aria-label` from select since explicit `<label>` exists. |
| SCR-03 | Medium | S0 Global Frame — Reset Demo Confirmation | Spec: "Reset demo (confirm dialog)". Current: `runDemoReset` has no confirmation dialog — executes immediately on click (App.tsx:160-178). | `App.tsx:160-178` | Accidental reset loses evaluation state without warning. | Add confirmation modal (or `window.confirm`) before reset. |
| SCR-04 | High | S1 Command Center — Disruption Card | Spec: "raw notice text in a quote block". Current: Shows facility row, affected orders list, but no quote block with `raw_text` from assessment evidence. | `App.tsx:635-657`, `types.ts:154-170` (`DisruptionAssessment.evidence`) | Operator misses the original disruption notice text. | Add quote block rendering `evaluation.assessment.evidence[0]?.excerpt` or `raw_text` in disruption card. |
| SCR-05 | High | S1 Command Center — Affected Orders Totals | Spec: Totals row showing **₹11,60,000**. Current: Shows baseline loss metric card (₹11,60,000) but no totals row in affected orders section. | `App.tsx:660-664` (metrics grid), `App.tsx:645-654` (affected orders list) | No consolidated penalty total in the orders list itself. | Add totals row to affected orders list summing `baseline_penalty_inr`. |
| SCR-06 | High | S1 Command Center — "What happens next" Strip | Spec: "Small strip naming the five agents". Current: Not present in Command Center view. | `App.tsx:621-664` | User lacks overview of evaluation steps before running. | Add strip with 5 agent names (Disruption sensing, Supplier dependency, Routing, Inventory rebalancing, Trade compliance, Plan assembly, Explanation — 7 per spec §86). |
| SCR-07 | High | S2 Evaluation Progress — Mode Chips | Spec: mode chip values `gold`, `deterministic`, `template`, `recorded`, `live`. Current: Uses `step.mode ?? 'not specified'` (App.tsx:926-933). Fixture shows `gold`, `deterministic` — but `template`/`recorded`/`live` not verified. | `App.tsx:926-933`, `fixtures/expected/evaluation_EVAL-0001.json` | If backend returns `template`/`recorded`/`live`, chip may show "not specified" or raw value. | Map mode values to spec chips exactly; add fallback for unknown. |
| SCR-08 | High | S2 Evaluation Progress — aria-live | Spec: `aria-live="polite"` announces each completed step. Current: `aria-live="polite"` on container (App.tsx:718) but announcement text is static ("Evaluation EVAL-0001 is completed..."). No per-step announcement. | `App.tsx:718-719` | Screen reader users don't hear step completions in real time. | Move `aria-live="polite"` to a dedicated status region that updates per step; or use `aria-live="assertive"` for each step completion. |
| SCR-09 | High | S3 Plan Comparison — "On Paper" Qualifier | Spec: Blocked card net avoided loss shown with **"on paper"** qualifier, strikethrough-free. Current: `{isBlocked ? ' · on paper' : ''}` (App.tsx:682). Implemented correctly. | `App.tsx:682` | ✓ Conforms. | No action needed. |
| SCR-10 | High | S3 Plan Comparison — Source Name Mapping | Spec: Map `option_id` to readable text using `options[]` (e.g., `OPT-RT-B-CMB` → "Chao Phraya (TH) via Colombo"). Current: No mapping — allocation table not shown in plan cards; only financials. `option_id` appears in plan lines but not displayed. | `App.tsx:667-708`, `types.ts:26-34` (`Plan.lines[].option_id`) | User sees cryptic `OPT-` IDs instead of readable source names. | Implement `labels.ts` (per §11) mapping `option_id` → readable text. Show allocation table in plan card with mapped source names. |
| SCR-11 | High | S3 Plan Comparison — "Why?" Button | Spec: "Why?" button opens drawer filtered to non-passed findings. Current: "Review evidence" button opens plan-level evidence panel (App.tsx:705), not finding-filtered drawer. | `App.tsx:705`, `App.tsx:710-711` | User must navigate through plan findings manually to find blocking ones. | Change "Review evidence" to "Why?" on blocked plans; open evidence drawer pre-filtered to `outcome !== 'passed'` findings for that plan. |
| SCR-12 | High | S3 Plan Comparison — Exposure List | Spec: "Exposure list shows each item; mutually exclusive items carry 'either/or'". Current: No exposure list in plan cards. Worst-case exposure shown as single number. | `App.tsx:694-697` | User cannot see individual exposure lines or mutual exclusivity. | Add exposure list below financials showing each exposure line with "either/or" label for `mutually_exclusive_group`. |
| SCR-13 | High | S3 Plan Comparison — Paper Advantage Callout | Spec: Callout "P1 looks ₹2,08,000 better on paper" from `comparison.paper_advantage_of_best_blocked_plan_inr`. Current: Not present. | `App.tsx:665-708`, `types.ts:183-188` (`paper_advantage_of_best_blocked_plan_inr`) | Key narrative moment missing — user doesn't see the "looks better but blocked" comparison. | Add callout under plan cards when `paper_advantage_of_best_blocked_plan_inr > 0`. |
| SCR-14 | High | S4 Evidence Drawer — Header | Spec: Outcome pill, finding title, check code (muted), subject. Current: Has outcome pill, title, check code, subject (App.tsx:872-874). ✓ | `App.tsx:872-874` | ✓ Conforms. | No action needed. |
| SCR-15 | High | S4 Evidence Drawer — "Why" Section | Spec: Deterministic sentence from finding `title` + key `details`. Current: Shows `selectedFinding.title` then `details` as dl (App.tsx:875). Title repeated; no synthesized sentence. | `App.tsx:875` | Redundant title; details shown as raw key/value not natural language. | Implement "Why" as composed sentence: `title` + relevant `details` fields (e.g., transit countries, ETD vs 44C). |
| SCR-16 | High | S4 Evidence Drawer — Evidence Tabs | Spec: Tabs for Graph, Letter of Credit, Rules, Record. Current: Single scrollable sections (Evidence records, LC fields, Rules) — no tabbed interface. | `App.tsx:899-919` | All evidence types stacked; LC fields and Rules may be far apart; no tab navigation. | Implement tabbed interface (ARIA tabs pattern) for the four evidence kinds. |
| SCR-17 | High | S4 Evidence Drawer — Graph Tab | Spec: Cytoscape view focused on supplier; blocking path highlighted; text alternative list below. Current: Graph view is separate screen (`/supply-graph`), not in drawer. Drawer has no graph. | `App.tsx:806-805` (supply-graph screen), `App.tsx:899-919` (drawer) | User must leave drawer to see graph; context lost. | Embed DependencyGraph in drawer for findings with `graph_path` evidence (or link to supply-graph screen with deep link). |
| SCR-18 | High | S4 Evidence Drawer — LC Panel | Spec: Monospace block of MT700-style lines with cited tag highlighted; LC id and version; synthetic label. Current: Shows `lc-field` grid with tag and excerpt (App.tsx:903-906). Excerpt is full MT700 block but cited tag not highlighted. | `App.tsx:903-906`, `App.css:812-816` | User must visually scan for the relevant tag in the LC excerpt. | Highlight `locator.field_tag` in excerpt (e.g., `<mark>`). Show LC id/version from `locator.lc_id`. |
| SCR-19 | High | S4 Evidence Drawer — Rules Panel | Spec: Table with rule id, type, value, effective from–to, authority, outcome (Applied/Superseded/Draft/Not in force/Lower authority/Not yet effective/Expired); conflicts shown as "Resolved: official source overrides newsletter". Current: Shows applicable rules with "Applied"; excluded with reason mapped (App.tsx:907-918). Missing: effective dates, authority level, structured rate for excluded rules; conflict resolution text not matching spec phrasing. | `App.tsx:907-918`, `types.ts:86-107` (`RuleResult`) | Excluded rules lack context (dates, authority); conflict phrasing differs. | For excluded rules, fetch effective dates/authority from rule metadata (may need API enhancement). Use spec conflict phrasing: "Resolved: {conflict.reason} · selected {selected_rule_id} over {excluded_rule_ids}". |
| SCR-20 | Medium | S4 Evidence Drawer — AI Explanation | Spec: Section only if explanation exists; mode badge, validation status; text; cited ids as links. Always labelled "Explanation only — decisions come from the checks above". Current: Not implemented. | `App.tsx:899-920` | No AI explanation display; if backend adds explanations, they won't render. | Add conditional section for `explanations[]` from evaluation; render with mode badge, validation status, links to cited evidence IDs. |
| SCR-21 | Medium | S4 Evidence Drawer — Remedies | Spec: Buttons for allowed actions (only `request_lc_amendment` in MVP, only for compliance role). Current: Renders remedies as read-only cards (App.tsx:920). No action buttons. | `App.tsx:920`, `types.ts:63-73` (`Finding.remedies`) | Compliance officer cannot request LC amendment from drawer (only from approval modal). | For `remedy.action === 'request_lc_amendment'` and compliance role, render as button opening approval modal with amendment context. |
| SCR-22 | High | S5 Approval Modal — Plan Hash | Spec: Short hash (first 12 hex chars) with copy button. Current: Shows full `plan_hash` (64 chars) in monospace (App.tsx:832). No copy button. | `App.tsx:832` | User cannot easily copy short hash for verification. | Display first 12 chars + "…" with copy button (Clipboard API). |
| SCR-23 | High | S5 Approval Modal — Acknowledgements | Spec: One row per `needs_review` finding with checkbox, required note (≥5 chars), role that may acknowledge; disabled with explanation if current actor lacks role. Current: Implemented correctly (App.tsx:842-853). ✓ | `App.tsx:842-853` | ✓ Conforms. | No action needed. |
| SCR-24 | High | S5 Approval Modal — Approve Disabled for Blocked | Spec: Approve disabled for blocked plans with reason shown. Current: `approvalDisabledReason` checks `plan.status === 'blocked'` (App.tsx:250-256). Button disabled with `title` attribute (App.tsx:705). Tooltip-only reason — not visible. | `App.tsx:250-256`, `App.tsx:705` | User sees disabled button but no visible reason (tooltip only on hover). | Show visible disabled reason text near button (as implemented in `blocked-reason` for plan cards). |
| SCR-25 | Medium | S5 Approval Modal — Problem Handling | Spec: 409 stale/superseded → modal shows "This plan changed or was replaced. Reload to review the current version." with Reload button. Current: Shows reload button for `PLAN_VERSION_STALE`, `PLAN_SUPERSEDED`, `DECISION_EXISTS` (App.tsx:866). Message is generic problem title/detail. | `App.tsx:866` | User sees technical problem detail, not the specified user-friendly message. | Map error codes to spec messages: 409 stale/superseded → "This plan changed or was replaced. Reload to review the current version."; 409 `DECISION_EXISTS` → refresh plan silently; 403 → suggest switching actor; 422 → show field errors. |
| SCR-26 | High | S6 Execution — "Simulated" Chip | Spec: "Simulated" chip on every row. Current: `<span className="simulated-chip">Simulated</span>` on each step (App.tsx:777). ✓ | `App.tsx:777` | ✓ Conforms. | No action needed. |
| SCR-27 | Medium | S6 Execution — Poll Interval | Spec: Poll every 500 ms until completed/failed. Current: 500 ms poll (App.tsx:474). ✓ | `App.tsx:474` | ✓ Conforms. | No action needed. |
| SCR-28 | Medium | S7 Audit — Verify Chain | Spec: "Verify chain" button → green "Chain valid (26 events)" or red "Chain broken at seq N". Current: Implemented (App.tsx:818-820). ✓ | `App.tsx:818-820` | ✓ Conforms. | No action needed. |

---

### 19.3 Accessibility (vs. §10 MVP Expectations)

| ID | Severity | Area | Finding | Evidence | User Impact | Suggested Correction |
|----|----------|------|---------|----------|-------------|----------------------|
| A11Y-01 | High | WCAG 2.2 AA Contrast — Muted Text | `#52657a` on `#f5f7fa` = 4.9:1 (fails 4.5:1 for 12-13px text). Used for `.eyebrow`, `.subtitle`, `.metric-label`, `.financial-block span`, `.checks-row`, `.plan-detail`, `.topbar`, `.graph-node .node-tag`, `.graph-node .node-meta`, `.graph-note`, `.graph-text-alternative li > span`, `.facility-details dt`, `.finding-link span`, `.field-label span`, `.field-hint`, `.acknowledgement-item p`, `.execution-launch p`, `.detail-list dt`, `.evidence-record-heading span`, `.evidence-meta`, `.lc-field span`, `.finding-details dt`, `.audit-note`, `.audit-table td small`, `.audit-event p`, `.audit-event time` (App.css:973-974). | `App.css:4`, `App.css:973-974` | All secondary/metadata text fails AA contrast. | Define `--color-text-muted` with ≥4.5:1 on `--color-bg`. Recommend `#3a3f33` (6.2:1 on `#fdfefb`) or `#2d3a2a` (5.8:1). |
| A11Y-02 | High | WCAG 2.2 AA Contrast — Needs Review Badge | Badge: `#805300` on `#fff5d9` = 3.8:1 (fails 4.5:1 for 11px). | `App.css:468-471`, `App.css:1022-1023` | "Needs review" status text unreadable for low vision. | Darken foreground to `#7a4b00` (5.1:1) or darken background to `#fde8a3` (4.6:1). |
| A11Y-03 | High | Focus Indicator Contrast | Focus ring `#5eafff` on primary button `#0a6ed1` = 2.1:1 (fails 3:1). On white = 2.9:1 (borderline). | `App.css:353-356`, `App.css:327-331` | Keyboard focus invisible on primary actions. | Use dual-ring: `outline: 2px solid white; outline-offset: 2px; box-shadow: 0 0 0 4px var(--color-focus-ring)` with `--color-focus-ring` = `#003d7a` (8.6:1 on white, 3.5:1 on primary). |
| A11Y-04 | Medium | Focus Order — Sidebar Navigation | Sidebar `nav-item` buttons are in DOM order but visually fixed left. On mobile (<700px), sidebar becomes horizontal scroll (App.css:567-586) — tab order matches visual. ✓ | `App.css:567-586`, `App.tsx:608-612` | ✓ Conforms. | No action needed. |
| A11Y-05 | High | Modal Focus Trap — Approval Dialog | Implemented with keydown listener (App.tsx:521-560). Cycles focusable elements, Escape closes, restores opener focus. ✓ | `App.tsx:521-560` | ✓ Conforms. | No action needed. |
| A11Y-06 | High | Modal Focus Trap — Evidence Drawer | Implemented identically (App.tsx:562-601). ✓ | `App.tsx:562-601` | ✓ Conforms. | No action needed. |
| A11Y-07 | High | Drawer Role | Evidence drawer: `role="dialog"` with `aria-modal="true"` and `aria-labelledby` (App.tsx:870). ✓ | `App.tsx:870` | ✓ Conforms. | No action needed. |
| A11Y-08 | High | Live Regions — Evaluation Progress | `aria-live="polite"` on container but static text (App.tsx:718). No per-step announcement. | `App.tsx:718-719` | Screen readers don't announce step completions. | Add dedicated `aria-live="polite"` region updated per step; or use `aria-live="assertive"` on step row when status changes to succeeded/failed. |
| A11Y-09 | High | Live Regions — Execution Steps | `aria-live="polite"` on execution panel (App.tsx:770). Steps appended as they complete — may announce. ✓ | `App.tsx:770` | ✓ Likely conforms (verify in testing). | Verify step announcements work; consider `aria-atomic="true"` on step container. |
| A11Y-10 | High | Target Size — Minimum 24×24 CSS px | Nav items: 12px padding + 13px font ≈ 37px height (OK). Actor select: 8px padding + 12px font ≈ 28px (OK). Buttons: 10px padding + 12px font ≈ 32px (OK). Checkboxes: 18×18px (App.css:775) — **fails 24×24**. Focus-button: 6px+12px ≈ 24px (borderline). | `App.css:91-100`, `App.css:169-178`, `App.css:316-331`, `App.css:775`, `App.css:1014` | Checkboxes too small for motor-impaired users. | Increase checkbox to 24×24px; ensure all interactive targets meet 24×24. |
| A11Y-11 | High | Body Text ≥ 16px | Base font-size not set on `:root`/`body`; `html` default 16px. But many elements use 11-13px (`.eyebrow` 10px, `.metric-label` 12px, `.financial-block span` 11px, `.checks-row` 11px, `.plan-detail` 12px, `.topbar` 12px, `.node-tag` 9px, `.node-meta` 10px, `.graph-note` 11px, etc.). Spec says "body text ≥ 16px; tables ≥ 14px". | `App.css:3`, `App.css:80-83`, `App.css:374-378`, `App.css:501-504`, `App.css:511-515`, `App.css:484-490`, `App.css:147-148`, `App.css:730-732`, `App.css:737`, `App.css:745` | Body copy (plan-detail, evidence text, audit table cells) at 12-13px fails spec. | Set `html { font-size: 16px; }` or `:root { font-size: 16px; }`. Scale all `rem`-based sizes. Ensure table cells ≥ 14px (currently 13px in `.audit-table td`). |
| A11Y-12 | High | Tables — Headers and Captions | Audit table has `<caption>` and `<th scope="col">` (App.tsx:824). Plan comparison has no table (cards only). Rules table in drawer has caption and headers (App.tsx:909-915). ✓ | `App.tsx:824`, `App.tsx:909-915` | ✓ Conforms where tables exist. | No action needed. |
| A11Y-13 | High | Graph — Text Alternative | Full text alternative implemented: evidence paths list + all supply links as keyboard-navigable buttons + facility records table (DependencyGraph.tsx:113-124). ✓ | `DependencyGraph.tsx:113-124` | ✓ Conforms. | No action needed. |
| A11Y-14 | Medium | Graph — Keyboard Access to Nodes | SVG nodes have `onClick` but not focusable (no `tabindex`, no key handler). Text alternative links are the accessible equivalent (spec §160). ✓ | `DependencyGraph.tsx:99-108` | ✓ Conforms per spec (text alternative is the accessible equivalent). | No action needed. |
| A11Y-15 | Medium | Reduced Motion | `@media (prefers-reduced-motion: reduce)` disables animations (App.css:1003-1010). ✓ | `App.css:1003-1010` | ✓ Conforms. | No action needed. |

---

### 19.4 Evidence Presentation Rules (vs. §8)

| ID | Severity | Area | Finding | Evidence | User Impact | Suggested Correction |
|----|----------|------|---------|----------|-------------|----------------------|
| EVD-01 | High | Rule 1: Every Finding Shows ≥1 Evidence | Current: Shows "Evidence missing" in red for unresolved IDs (App.tsx:899). ✓ | `App.tsx:899` | ✓ Conforms. | No action needed. |
| EVD-02 | High | Rule 2: Synthetic Sources Show Chip | Current: Shows "· Synthetic" in evidence meta (App.tsx:901). ✓ | `App.tsx:901` | ✓ Conforms. | No action needed. |
| EVD-03 | High | Rule 3: Excerpts as Short Quotes | Current: LC excerpts shown in `<blockquote>` (App.tsx:910). Rule excerpts not shown (metadata not in result). ✓ | `App.tsx:910` | ✓ Conforms for LC. | No action needed. |
| EVD-04 | High | Rule 4: AI Text Visually Separate & Labelled | Not implemented (SCR-20). | `App.tsx:899-920` | If explanations added, they won't be visually separated or labelled. | Implement per SCR-20. |
| EVD-05 | High | Rule 5: Rule Tables Show Why Others Not Used | Current: Excluded rules table shows reason (App.tsx:912-915). Missing effective dates/authority for excluded. | `App.tsx:912-915` | User cannot verify temporal-RAG proof for excluded rules. | Enhance excluded rule display with dates/authority (may need API). |
| EVD-06 | High | Rule 6: Money Format | Uses `Intl.NumberFormat('en-IN', {style: 'currency', currency: 'INR', maximumFractionDigits: 0})` via `money()` helper (App.tsx:9). ✓ | `App.tsx:9` | ✓ Conforms. | No action needed. |

---

### 19.5 Graph View Specification (vs. §9)

| ID | Severity | Area | Finding | Evidence | User Impact | Suggested Correction |
|----|----------|------|---------|----------|-------------|----------------------|
| GRF-01 | High | Layout — Preset Columns by Role | Implemented: `ROLE_COLUMN` maps roles to 4 columns (wafer_fab/material_supplier=0, die_processing=1, module_assembly=2, buyer_plant=3) (DependencyGraph.tsx:5). Row order by `ROW_ORDER` array (DependencyGraph.tsx:7). ✓ | `DependencyGraph.tsx:5-7`, `DependencyGraph.tsx:26-40` | ✓ Conforms. | No action needed. |
| GRF-02 | High | Node Encoding — Never Colour Alone | Uses status tag text (⚠ DISRUPTED, ✕ CANDIDATE · BLOCKED, etc.) + border/stroke + badge (DependencyGraph.tsx:12-18, CSS status classes). ✓ | `DependencyGraph.tsx:12-18`, `App.css:1035-1042` | ✓ Conforms. | No action needed. |
| GRF-03 | High | Highlighted Path Edges | `edge.highlighted` → `kind='path'` → red stroke width 4, path marker (DependencyGraph.tsx:92-95, App.css:1029). ✓ | `DependencyGraph.tsx:92-95`, `App.css:1029` | ✓ Conforms. | No action needed. |
| GRF-04 | High | Interactions — Click Node → Tooltip | Click sets `selectedNodeId` → facility details panel below graph (App.tsx:797-804). Side tooltip not implemented — panel is below. | `App.tsx:797-804`, `DependencyGraph.tsx:102` | Spec says "side tooltip"; current shows panel below. | Either implement side tooltip on hover/focus, or update spec to match panel pattern. |
| GRF-05 | High | Interactions — Keyboard Tab Cycles Text Alternative | Text alternative links are `<button className="graph-link-button">` — focusable, clickable (DependencyGraph.tsx:119-122). ✓ | `DependencyGraph.tsx:119-122` | ✓ Conforms. | No action needed. |
| GRF-06 | Medium | Toggle Chips SUP-B / SUP-C | Implemented as `focus-button` group (DependencyGraph.tsx:59-61). ✓ | `DependencyGraph.tsx:59-61` | ✓ Conforms. | No action needed. |
| GRF-07 | Medium | Edge Direction — Source → Target | Spec: arrows source→target (goods flow towards plant). Current: `edge_direction` from graph view used in subtitle (App.tsx:789); edges drawn source→target in SVG (DependencyGraph.tsx:85-98). ✓ | `DependencyGraph.tsx:85-98`, `App.tsx:789` | ✓ Conforms. | No action needed. |
| GRF-08 | Medium | CANDIDATE_SUPPLY Edges Dashed | `edge.candidate` → `kind='candidate'` → dashed stroke (App.css:1028, 1031). ✓ | `App.css:1028`, `App.css:1031` | ✓ Conforms. | No action needed. |

---

### 19.6 Test Coverage Gaps

| ID | Severity | Area | Finding | Evidence | Suggested Correction |
|----|----------|------|---------|----------|----------------------|
| TST-01 | Medium | Unit Tests | No Vitest unit tests found (`frontend/tests/unit/` directory doesn't exist). Only Playwright E2E. | `frontend/tests/` listing | Add Vitest unit tests for formatters (`lib/format.ts`), label mappers (`lib/labels.ts`), layout algorithm (`DependencyGraph.tsx:layoutGraph`), financial calculations (`getWorstCaseExposure`). |
| TST-02 | Medium | Visual Regression | No visual regression testing (Storybook, Chromatic, or Playwright screenshot diffs). | `package.json`, `playwright.config.ts` | Add Playwright visual comparison tests for key screens (Command Center, Plan Comparison, Evidence Drawer, Graph View) against Blöcke UI Kit reference images. |
| TST-03 | Low | Axe-Core Coverage | Axe runs in every E2E test (via `expectNoAccessibilityViolations`). ✓ | `tests/dependency-graph.spec.ts:23`, `tests/critical-journey.spec.ts:14` | ✓ Good practice. | No action needed. |

---

### 19.7 Architecture & Code Quality

| ID | Severity | Area | Finding | Evidence | Suggested Correction |
|----|----------|------|---------|----------|----------------------|
| ARC-01 | Medium | CSS Architecture | Single 1190-line `App.css` with all styles; no CSS custom properties; component-scoped via class naming convention. No `styles/tokens.css` per §11. | `App.css`, `frontend/src/styles/` (doesn't exist) | Create `styles/tokens.css` with design tokens (colours, spacing, typography, shadows, radii). Split component styles into feature-scoped CSS modules or files. |
| ARC-02 | Medium | Generated Types | `api/schema.d.ts` not present in repo (generated per §56). `api/types.ts` is hand-written mirror. | `frontend/src/api/types.ts`, `docs/02-ui-ux-and-frontend.md:56-58` | Run type generation script on D1; ensure CI validates generated types match hand-written. |
| ARC-03 | Low | Stub Mode — Graph View Files | `getGraphView` expects `/stubs/graph_view_SUP-B.json` and `graph_view_SUP-C.json` (client.ts:141). Files exist in `public/stubs/`. ✓ | `client.ts:141`, `public/stubs/` | ✓ Conforms. | No action needed. |
| ARC-04 | Low | API Client — Idempotency Keys | Used for mutations (createEvaluation, submitDecision, startExecution) via `crypto.randomUUID()` (App.tsx:187, 294, 378, 447). Reused on retry via `pendingDecisionRef` / `executionKeyRef`. ✓ | `App.tsx:187, 294, 378, 447` | ✓ Conforms. | No action needed. |

---

### 19.8 Summary of Critical Path Blockers

| Priority | Finding IDs | Description |
|----------|-------------|-------------|
| **P0 — Must fix before R1** | VIS-01, VIS-02, SCR-01, SCR-04, SCR-06, SCR-10, SCR-11, SCR-13, SCR-16, SCR-17, SCR-22, A11Y-01, A11Y-02, A11Y-03, A11Y-11 | Visual system not implemented (fonts, palette); key screens missing spec-mandated elements (disruption quote, agent strip, source mapping, paper advantage callout, evidence tabs, graph in drawer, hash copy); accessibility contrast failures on body text, badges, focus rings. |
| **P1 — Must fix before R2** | VIS-03, VIS-04, SCR-02, SCR-03, SCR-05, SCR-07, SCR-08, SCR-12, SCR-15, SCR-18, SCR-19, SCR-20, SCR-21, SCR-24, SCR-25, A11Y-08, A11Y-10 | Muted text contrast; confirmation dialog; totals row; mode chip mapping; per-step live announcements; exposure list; "Why" sentence; LC tag highlighting; excluded rule metadata; AI explanation section; remedy buttons; visible disabled reasons; problem message mapping. |
| **P2 — Polish for R3/R4** | VIS-05, VIS-06, SCR-09 (✓), SCR-14 (✓), GRF-04, ARC-01, ARC-02, TST-01, TST-02 | Focus ring refinement; design tokens file; generated types; unit tests; visual regression; side tooltip vs panel decision. |
