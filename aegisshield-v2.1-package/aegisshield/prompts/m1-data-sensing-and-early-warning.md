# Member 1 plan prompt — Enterprise data pipeline, predictive sensing & domain strategy

Paste everything below the line into your coding agent at the repository root after filling the header.

---

## Header
- REPO_ROOT: <path>
- NOW: <YYYY-MM-DD HH:MM IST>
- MODE: <plan-only | execute>
- GIT: <no-commit | commit-locally on branch m1/<topic>>   (never push unless I say so)

## Goal
Deliver Member 1's modules for the AegisShield AI finale demo (Wed 4 Nov 2026) so they match the contracts and goldens exactly:
- **MOD-22** Enterprise data pipeline: fixture ingestion, validation, input snapshot, `GET /api/v1/scenario` and `GET /api/v1/disruptions` (moved to you from Member 2 on 30 Oct, D-031)
- **MOD-04** Disruption Sensing Agent
- **MOD-06** Routing Agent
- **MOD-09** Inventory Rebalancing Agent
- **MOD-21** Early-warning pipeline and its endpoint
- **MOD-24** Domain evidence register

The data pipeline comes first. Member 2's screens and Member 4's orchestrator both read from it.

## Context (read in this order before doing anything)
1. `docs/00-source-of-truth.md`:
   - "Read me first" (incl. the v2.1 note)
   - §1, §2.3 (F1, F2, F9, F10, F12), §2.4 (S/4HANA, IBP and TM rows are now yours), §4.4 (cut list)
   - §7 (ownership, boundaries, handover)
   - §8 (agents, step owners), §9.3–9.4 (endpoints and your function signatures)
   - §10.5 and §10.9 (inventory, early-warning index)
   - §13 (deadlines; contingency C-1 and risk R-13)
   - **Appendix C** (your module specs, including C.5 data pipeline), Appendix F.2/F.5 (wording, evidence register)
2. Contracts:
   - `contracts/schemas/master-data.schema.json` (you own it)
   - `contracts/schemas/api.schema.json` (`ScenarioResponse`, `DisruptionList`)
   - `contracts/schemas/fixtures.schema.json` (file wrappers)
   - `contracts/schemas/disruption.schema.json`
   - `contracts/schemas/signals.schema.json`
   - `common.schema.json` (Finding, Evidence)
   - `openapi.yaml` paths `/api/v1/scenario`, `/api/v1/disruptions`, `/api/v1/early-warnings`
3. Goldens:
   - `input_snapshot_id` in `fixtures/expected/evaluation_EVAL-0001.json` (`sha256:d52c7ecc…d6c0`)
   - `fixtures/expected/disruption_assessment.json`
   - `fixtures/expected/early_warnings_pre_notice.json`, `fixtures/expected/early_warnings_scenario_time.json`
   - `options[]` and `findings[]` with ids `FND-INV-*` in `fixtures/expected/evaluation_EVAL-0001.json`
4. Validation cases in `fixtures/validation/cases.json` whose `owner` is `member_1`: VC-SENSE-01, VC-INV-01…03, VC-EWS-01…06.
5. Reference behaviour in `tools/aegis_oracle.py`:
   - `load_fixtures`, `input_snapshot_id`, `canonical_json`
   - `assess_disruption`, `resolve_alias`
   - inventory part of `source_options`, plus `plan_level_findings` (INV)
   - routing filter in `source_options`
   - `early_warnings`, `_exposure`, `_downstream`, `_ews_summary`

   The fixture-to-schema map is `FIXTURE_SCHEMA` in `tools/check_contracts.py`. You may port this logic; never import it from production code.

Ignore `docs/01…05` and anything under `docs/archive/`; they use an older team numbering.

## You own / you don't
- **Yours:** the six modules above, plus the data loader (wherever it already lives), the `/scenario` and `/disruptions` handlers, their unit tests, and `docs/status/m1.md`.
- **Not yours:**
  - API framework, route mounting, reset, dependency traversal, compliance, plan money, orchestrator (M4)
  - rules, LLM gateway, GraphView, contract change control (M3)
  - any screen, including the early-warning panel (M2)
  - the pitch narrative (M5)

  Raise issues in those areas with their owner; don't fix them yourself.

## Constraints
- Inspect `git status`, `git log -5`, `git branch -vv` and `git remote -v` first. Never force-push, `reset --hard`, rewrite history, stash, or delete branches you didn't create. With GIT=no-commit, leave changes uncommitted.
- **Contracts, goldens and fixtures are read-only.** You own the master-data contract and the eight data fixtures in the registry, but **do not change them before the finale**: any byte change alters `input_snapshot_id` and every plan hash. If code and contract disagree, the code is wrong. Contract problems go to Member 3 via `docs/status/m1.md`. Never run `--write-golden`.
- **The data pipeline never writes the database** (`docs/00` §7.4 rule 1). It provides validated, typed in-memory models. `external_signals.json` is loaded separately and is **never** part of `input_snapshot_id`.
- Do not move or rename existing files. If someone else (Member 2 or Member 4) already wrote the loader or your other modules, take the handover and extend it in place.
- **The early-warning module must not be imported** by the orchestrator, plan builder or decision code (§7.4 rule 6). It must never change plans, money, hashes or `input_snapshot_id`.
- **Wording:** never call the index a probability or a prediction, in code, API text or comments. Keep `score_kind: "heuristic_index"` and `score_note` exactly as in the fixture.
- No new runtime dependencies. At most 2 attempts per failing fix, then record a blocker with evidence and move on.
- "Done" means tests ran and passed: quote commands, exit codes and key output lines. Never skip, weaken or hard-code tests to make them pass.

## Plan

### Phase 0 — Inventory and handover (Fri 30 Oct, finish by 21:00)
1. **Find the existing code** for MOD-22/04/06/09/21: search `backend/` for `load_fixtures`, `fixtures`, `snapshot`, `/scenario`, `assess_disruption`, `eligible_routes`, `atp`, `early`. For each module note: path, author, tests present, tests passing.
2. **Data pipeline check:** does the backend start, does `/health.input_snapshot_id` equal `sha256:d52c7ecc…d6c0`, and do `/scenario` and `/disruptions` validate against `api.schema.json`? If Member 2 wrote the loader, ask for a `handover/MOD-22` branch with `HANDOVER.md` tonight.
3. Check the other `handover/<MOD-id>` branches. List questions for the previous authors; they're available until Sat 13:00.
4. Run `python3 tools/check_contracts.py` and the backend test suite; record exit codes.
5. Write `docs/status/m1.md`:
   - inventory table (module | path | state | tests)
   - gaps vs goldens
   - your plan with times
   - questions for the previous authors

   **If MODE is plan-only, stop here.**

### Phase 1 — Data pipeline first, then the small agents (Sat 31 Oct)
6. **By 12:00 — MOD-22 data pipeline** (Appendix C.5):
   - The loader validates all 12 plan-input fixtures against their schemas. On failure it stops startup and names the file and the JSON path.
   - It computes `input_snapshot_id` exactly like the oracle: canonical JSON of `{file_stem: content}`, excluding `external_signals.json`. The value must equal the golden.
   - It exposes `ScenarioContext` models to the agents and to Member 4's code.
   - The `/scenario` and `/disruptions[/{id}]` handlers validate against `api.schema.json` (404 problem+json for an unknown id). Member 4 mounts the routes.
   - Tests:
     - snapshot equals the golden
     - a deliberately broken copy of one fixture (in a temp directory) is rejected with a clear error
     - both endpoints validate
     - reset (Member 4's endpoint) reloads through your loader and the snapshot is unchanged
   - Tell Member 2 and Member 4 the endpoints are live.
7. **By 13:00:**
   - **MOD-04 Sensing (gold mode):** output equals `disruption_assessment.json`. Add a test for VC-SENSE-01 (unresolved alias → `needs_review`, empty `disrupted_node_ids`). Implement the issue codes from Appendix C.1.
   - **MOD-06 Routing:** `eligible_routes(quote, routes)` yields RT-B-CMB, RT-B-DIR for QT-B-01 and RT-C-SIN, RT-C-DIR for QT-C-01.
   - **MOD-09 Inventory:**
     - `inventory_options()` gives ATP 150/150, availability dates 26 Oct / 29 Oct, costs ₹0 / ₹40.
     - `allocation_findings(plan_id, lines, options)` produces `FND-INV-ALLOCATION-<plan>-<source>`.
     - Tests for VC-INV-01…03.
   - Tell Member 4 the import paths and signatures, matching `docs/00` §9.4.

### Phase 2 — Early warning (Sat 31 Oct, by 18:00; P1)
8. Implement `early_warnings(ctx, signals, as_of)` exactly per `docs/00` §10.9:
   - inclusion order: `not_yet_observed`, then `outside_window`, then `unmapped_area`
   - integer contribution with half-up rounding; cap at 100
   - level thresholds from the fixture policy
   - exposure via downstream traversal (≤ 4 hops, cycle-safe)
   - summary template string exactly as in the goldens
9. Add the endpoint `GET /api/v1/early-warnings?as_of=`: default `scenario.as_of`; malformed value → 400 problem+json `VALIDATION_ERROR`. Agree the router file with Member 4; you own the handler.
10. Tests:
    - both EWS goldens equal (no volatile fields)
    - VC-EWS-01…05
    - VC-EWS-06: a critical Binh Duong signal leaves plan hashes and `input_snapshot_id` unchanged
    - a boundary test that fails if `orchestrator`, `plans` or `decisions` import your module
11. Tell Member 2 the endpoint is live and which fields the panel uses (`docs/00` Appendix E.2).
12. **If you are behind at 18:00,** tell Member 3: early warning is P1 and on the cut list (items 6–7). The data pipeline and the three agents are P0 and come first.

### Phase 3 — Evidence and support (Sun 1 Nov)
13. **MOD-24 evidence register:**
    - Complete `pitch/evidence-register.md` from `docs/00` Appendix F.5.
    - Try to upgrade E-08…E-12 to primary sources: UCP 600 Art. 20, ISBP wording on 20(c), AIFTA Rule 8 official text, AIFTA party list, India's duty-date rule.
    - Record status V-P / V-S / U with a URL.
    - Give it to Member 5 and Member 3 by **18:00** (OD-07).
14. **Contingency C-1:** if Member 3 calls it at Sat 13:00 *and* your Sat items are green, take over only the `execution` and `audit` files Member 3 names. Keep exclusive ownership and have Member 4 review.
15. **Before the 20:00 freeze:** run all your tests twice from a clean reset and record the results.

### Phase 4 — Fixes and Q&A (Mon 2 – Tue 3 Nov)
16. Fixes only, each traced to a failing test or a DA item.
17. Prepare two Q&A answers, ≤ 40 words each, using Appendix F.2 wording:
    - "How does the early warning work, and is it a prediction?"
    - "Where does the enterprise data come from?" Answer: synthetic fixtures shaped like ERP records; S/4HANA, IBP and TM are proposed sources (§2.4).

## Deliverables
- **Code and tests** for MOD-22, MOD-04, MOD-06, MOD-09 and MOD-21. All VC cases with owner `member_1` are automated and green.
- **Endpoints:**
  - `/scenario` and `/disruptions`, validating against `api.schema.json`
  - `/api/v1/early-warnings`, matching the golden
- **`pitch/evidence-register.md`** and **`docs/status/m1.md`**.

## Handoffs
| To | What | When |
|---|---|---|
| M2, M4 | data loader, `/scenario`, `/disruptions`, snapshot | **Sat 12:00** |
| M4 | sensing, routing and inventory functions with signatures | Sat 13:00 |
| M2 | early-warning endpoint + field notes | Sat 18:00 |
| M5, M3 | evidence register | Sun 18:00 |
| M5 | early-warning and enterprise-data Q&A answers | Mon 12:00 |

## Done when
- `python3 tools/check_contracts.py` passes, and your unit tests pass twice in a row after reset; exit codes are recorded in `docs/status/m1.md`.
- `/health.input_snapshot_id` equals `sha256:d52c7ecc…d6c0` after a reset, and `/scenario` and `/disruptions` validate against the schema.
- Live API output equals `disruption_assessment.json` (inside the golden evaluation) and both EWS goldens.
- The boundary test proves MOD-21 isn't imported by plan code, and VC-EWS-06 passes.
- No text you produced calls the index a probability.

## If blocked
Write the blocker in `docs/status/m1.md` with exact evidence, tell Member 3 at the next stand-up or merge window, and continue with the next task. A decision that isn't answered within 2 working hours defaults to your written proposal (`docs/00` §15.4).
