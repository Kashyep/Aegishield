# Member 2 plan prompt — UI/UX and frontend

Paste everything below the line into your coding agent at the repository root after filling the header.

---

## Header
- REPO_ROOT: <path>
- NOW: <YYYY-MM-DD HH:MM IST>
- MODE: <plan-only | execute>
- GIT: <no-commit | commit-locally on branch m2/<topic>>   (never push unless I say so)
- DESIGN_FILES: <path or link to Member 5's delivered design>   (OD-10)

## Goal
Make the AegisShield AI demo work in the browser for the finale on Wed 4 Nov 2026. You own:
- **MOD-13** frontend application
- **MOD-14** graph and evidence components
- **MOD-20** UI tests and accessibility

You took over UI/UX from Member 5, whose design is already delivered and is the visual reference. Member 5 does no UI work now, so you decide visual details within that design. Member 3 reviews at two checkpoints only.

The enterprise data pipeline (fixture loader, `/scenario`, `/disruptions`) moved to **Member 1** on 30 Oct (D-031). You consume it like any other endpoint, and you now work only on the frontend.

## Context (read in this order)
1. `docs/00-source-of-truth.md`:
   - "Read me first" (incl. the v2.1 note), §1, §4 (scope and cut list), §7 (ownership, boundaries rule 4: the UI never computes money or outcomes)
   - §9.3 (API table), §11 (approval rules the UI must mirror), §12.2 (demo script: you drive the clicks)
   - §13 (deadlines), §14.2 (DA-01…17)
   - **Appendix E**: canonical screen, state, evidence, graph and accessibility spec
2. `contracts/openapi.yaml`, plus the schemas `api`, `plan`, `decision`, `graph` (GraphView), `signals` (EarlyWarningResult) and `master-data`. You read `master-data`; Member 1 owns it.
3. Goldens you render, in `fixtures/expected/`:
   - `evaluation_EVAL-0001.json`
   - `graph_view_SUP-B.json`
   - `early_warnings_pre_notice.json`, `early_warnings_scenario_time.json`
   - `approval_flow.json` (the click path the backend must support)
4. The design files at DESIGN_FILES.

Ignore `docs/01…05` and `docs/archive/`; they use an older team numbering.

## You own / you don't
- **Yours:** everything under `frontend/`, the Playwright smoke test, the a11y checklist, the demo frontend build, `docs/status/m2.md`.
- **Not yours:**
  - outcomes, money, recommendations, plan status (computed by the backend; the UI formats them)
  - API framework, reset, decisions, execution, audit (M4)
  - data loader, `/scenario`, `/disruptions`, early-warning logic (M1)
  - GraphView payload (M3)
  - the pitch (M5)

## Constraints
- Inspect `git status`, `git log -5`, `git branch -vv` and `git remote -v` first. Never force-push, `reset --hard`, rewrite history, stash, or delete others' branches. With GIT=no-commit, leave changes uncommitted.
- Contracts and goldens are read-only. Contract problems go to Member 3; data or endpoint problems go to Member 1 (`/scenario`, `/disruptions`, `/early-warnings`) or Member 4 (everything else).
- **Types:** generate them from the contract (bundle with `@redocly/cli`, then `openapi-typescript`). Never hand-write API types.
- **Display only:** the UI never adds, subtracts or derives money, outcomes or recommendations. It shows API fields formatted (`en-IN`, INR, no decimals). Filtering the active warnings in the approval modal is display logic and is allowed (Appendix E.6).
- **Synthetic labels:** a "SYNTHETIC DATA" banner on every screen. The early-warning panel always shows "Heuristic early-warning index, not a probability".
- **Files:** keep the UI kit and folder structure already in use (OD-11). Don't move existing files. No new runtime dependencies without Member 3's OK.
- **Bounded fixes:** at most 2 attempts per failing fix, then record a blocker with evidence. Never mark a check done without running it.

## Plan

### Phase 0 — Inventory and handover (Fri 30 Oct, by 21:00)
1. Collect DESIGN_FILES from Member 5 (a 15-minute hand-off of existing files). List which Appendix E screens the design covers and which it doesn't; you design the gaps in the same language.
2. **Inventory existing code:**
   - frontend screens built (S0–S7 in Appendix E)
   - whether they use generated types
   - whether stub mode exists
   - any data-loader or `/scenario` / `/disruptions` code **you** wrote earlier: push it to `handover/MOD-22` with a 5-line `HANDOVER.md` for Member 1 by 21:00 (`docs/00` §7.5)
3. Run `python3 tools/check_contracts.py`, the frontend build, lint and typecheck, and any tests. Record exit codes.
4. Write `docs/status/m2.md` with a screen-by-screen table (screen | built | live/stub | gaps vs Appendix E | DA ids) and the plan below with times. **If MODE is plan-only, stop here.**

### Phase 1 — Core screens (Sat 31 Oct)
5. **API client:** generated types plus a client that adds `X-Actor-Id` and `Idempotency-Key` and parses problem+json. Switch `/scenario` and `/disruptions` to live as soon as Member 1 announces them (target 12:00).
6. **Stub mode** (if missing): `VITE_API_MODE=stub` serves the goldens from `public/stubs/`, so screens progress without the backend.
7. **By 18:00, on the live API where it exists, else stub:**
   - S0 global frame: banner, LLM badge, actor switcher, reset.
   - S1 Command Center: orders table, ₹11,60,000.
   - S3 Plan Comparison: P1/P2 cards, "on paper", recommended badge, exposures with "either/or".
   - S4 Evidence drawer: graph (Cytoscape preset layout by role, text alternative), LC panel, rule table, record panel.
   - Verify DA-02, DA-04…07 against the goldens.
8. **17:00 — UI checkpoint U1** with Member 3 (30 min). Show S1/S3/S4; apply only "must" items the same evening.

### Phase 2 — Decision flow + early warnings (Sun 1 Nov, by 15:00)
9. **S5 Approval modal:**
   - version and short hash
   - acknowledgement rows gated by role
   - Approve disabled for blocked plans, with the server reason
   - one idempotency key per intent, reused on retry
   - problem+json handling (409 → Reload, 403 → switch actor, 422 → field errors)
   - the **Active warnings** section (DA-17: P1 shows the Kulim fab warning via SUP-B; P2 shows none)
10. **S6 Execution** with "Simulated" chips; **S7 Audit** with "Verify chain" (26 events after the golden flow).
11. **Early-warning panel** in S1, with the "As of 23 Oct 21:00 / Now" toggle calling `/early-warnings?as_of=` (DA-16).
12. **S2 progress timeline** (P1, cut first if late).
13. **15:00 — UI checkpoint U2** (45 min). Then the accessibility pass: keyboard-only approval flow, visible focus, icon + text status, an axe scan with zero serious issues, results in `frontend/tests/a11y.md`.
14. **Playwright smoke** (from a reset): early warnings → evaluate → open FND-DEP-SUP-B → try to approve P1 (refused) → approve P2 → execute → verify audit. It must pass twice in a row.
15. **17:00 — drive acceptance run #1** while Member 5 checks the DA items. **20:00 — freeze.**

### Phase 3 — Rehearse (Mon 2 – Tue 3 Nov)
16. Fixes only, each traced to a DA item or a failing test.
17. Drive rehearsals at 11:00, 15:00 and 19:00, following `docs/00` §12.2. At 16:00, do a clean run for Member 5 to record as the backup video.
18. Package the demo build (`frontend/dist`) and confirm FastAPI serves it from one origin with Wi-Fi off (with Member 4).

## Contingency
At Sat 18:00, if S3/S4 aren't on the live API (C-2), drop S2 (progress timeline) and the as-of toggle (cut-list items 4 and 6). Work is not reassigned, because Member 1 already carries the data pipeline.

## Deliverables
- Frontend S0–S7 plus the early-warning panel.
- Generated types and the API client.
- Playwright smoke.
- `frontend/tests/a11y.md`.
- Demo build.
- `docs/status/m2.md`.

## Handoffs
| From → to | What | When |
|---|---|---|
| M5 → you | design files | Fri 21:00 |
| you → M1 | any loader / scenario code you wrote (handover branch) | Fri 21:00 |
| M1 → you | `/scenario`, `/disruptions` live | Sat 12:00 |
| M4 → you | live evaluation | Sat 18:00 |
| M4 → you | decisions/execution/audit | Sun 15:00 |
| M1 → you | early-warning endpoint | Sat 18:00 |
| M3 → you | GraphView endpoint | Sat |
| you → M5 | final click path and screenshots | Sun 22:00 |
| you → M5 | clean run for the video | Mon 16:00 |

## Done when
- Build, lint and typecheck are green with generated types.
- Every number rendered on S1/S3 equals `evaluation_EVAL-0001.json`; a unit test compares them.
- DA-01…13, 16 and 17 pass in acceptance run #1 or have a fix scheduled before Tue 14:00.
- Playwright smoke passes twice in a row after reset against the live backend.
- No mutating request is sent without `X-Actor-Id` and `Idempotency-Key`.

## If blocked
Write it in `docs/status/m2.md` with evidence; tell the module owner and Member 3 at the next merge window; keep building on stub data. A decision that isn't answered within 2 working hours defaults to your written proposal.
