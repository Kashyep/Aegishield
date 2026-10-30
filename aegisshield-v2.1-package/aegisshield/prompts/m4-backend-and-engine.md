# Member 4 plan prompt — Major backend & deterministic check engine

Paste everything below the line into your coding agent at the repository root after filling the header.

---

## Header
- REPO_ROOT: <path>
- NOW: <YYYY-MM-DD HH:MM IST>
- MODE: <plan-only | execute>
- GIT: <no-commit | commit-locally on branch m4/<topic>>   (never push unless I say so)
- BTP: <none | trial account available>   (OD-01)

## Goal
Make the backend reproduce the golden evaluation and the full approval → simulated execution → audit flow by the freeze on Sun 1 Nov 2026 at 20:00. You own:
- **MOD-02** API & persistence, including reset
- **MOD-03** orchestrator
- **MOD-05** dependency traversal
- **MOD-08** trade-compliance checks
- **MOD-10** plans & financials
- **MOD-11** decisions, execution, audit
- **MOD-15** deployment, including the SAP BTP attempt

You are on the critical path.

## Context (read in this order)
1. `docs/00-source-of-truth.md`:
   - "Read me first", §4.4 (cut list), §7 (ownership, boundaries)
   - §8 (step table: the `owner` in each step record changed in 1.1.0), §9 (contracts, API)
   - §10.1, §10.3–10.8 (deterministic rules and money), §11 (approval, execution, audit)
   - §13 (deadlines, contingencies), **Appendix A** and **Appendix B.1–B.2**
2. `contracts/openapi.yaml`, plus the schemas `plan`, `decision`, `api`, `graph` (DependencyResult), `common`, `master-data`.
3. Goldens in `fixtures/expected/`:
   - `evaluation_EVAL-0001.json`
   - `dependency_results.json` (`results`)
   - `approval_flow.json`
4. Validation cases with owner `member_4`: VC-DEP-01…06, VC-LC-01…07, VC-FTA-01…03, VC-FIN-01…03, VC-AMEND-01, VC-APR-01…08, VC-EXE-01.
5. Reference behaviour in `tools/aegis_oracle.py`:
   - `dependency_check`
   - `lc_route_findings`, `fta_findings`, `duty_at_risk`
   - `source_options`, `greedy_plan`, `plan_level_findings`, `financials`, `build_plan`, `plan_hash_material`
   - `ApprovalModel`

   You may port it; never import it from production code.

Ignore `docs/01…05` and `docs/archive/`. In those files "Member 3 — Backend" means you; follow v2 numbering only.

## You own / you don't
- **Yours:** the modules above, integrating M1's and M3's functions into the orchestrator, `ops/runbook.md`, the timing log, and `docs/status/m4.md`.
- **Not yours:** sensing, routing, inventory and early warning (M1); rules, LLM, GraphView/linearisation, e2e tests, contracts (M3); data loader, `/scenario` and `/disruptions` handlers (M1); the UI (M2). Call their functions through the `docs/00` §9.4 signatures; don't re-implement them.

## Constraints
- Inspect `git status`, `git log -5`, `git branch -vv` and `git remote -v` first. Never force-push, `reset --hard`, rewrite history, stash, or delete others' branches. With GIT=no-commit, leave changes uncommitted.
- **Contracts and goldens are read-only.** If your output differs from a golden, your code is wrong unless Member 3 decides otherwise. Never run `--write-golden`.
- **Don't move existing files.** No stack changes, no new runtime dependencies.
- **Determinism:** ids come from counters, and sorting follows Appendix A.2. `plan_hash` covers exactly `plan_hash_material`. `input_snapshot_id` covers only the 12 plan-input fixtures; `external_signals.json` is never part of it.
- **The server enforces every approval rule (§11.3).** The UI is not a safety layer.
- **Never import the early-warning module** from the orchestrator, plans or decisions.
- **Execution is simulated** and every step says so. The first failure stops the run; no retry, no compensation.
- At most 2 attempts per failing fix, then record a blocker with evidence. Never make a test pass by weakening it or hard-coding golden values.

## Plan

### Phase 0 — Inventory (Fri 30 Oct, by 21:00)
1. Inventory every backend module:
   - which endpoints exist
   - which agents run for real versus being stubbed
   - whether golden equality is already tested
   - which code came from people whose role changed (handover branches)
2. **Update the orchestrator's step → owner map** to the 1.1.0 values in §8: member_1, member_4, member_1, member_1, member_4, member_4, member_3.
3. Run `python3 tools/check_contracts.py` and `pytest -q`, and record exit codes.
4. Write `docs/status/m4.md`: module table, the first diff against `evaluation_EVAL-0001.json` (strip volatile keys), and the plan below with times. **If MODE is plan-only, stop here.**

### Phase 1 — Golden evaluation via API (Sat 31 Oct, G2 at 18:00)
5. **By 12:00:**
   - **OD-01** — if a BTP trial is available, try a ≤ 1 h deploy of `/api/v1/health` to Cloud Foundry (python buildpack) and report "works / fails because…" to Member 3.
6. **MOD-05:**
   - `check_dependency` equals `dependency_results.json` `results`
   - VC-DEP-01…06 automated
7. **MOD-08:**
   - VC-LC-01…07 and VC-FTA-01…03; finding and evidence ids exactly as in Appendix A.3
   - the rule query uses `applicable_on = eta_port`, `known_as_of = scenario date`, and calls Member 3's `rule_applicability`
8. **MOD-10:**
   - P1/P2 lines, financials, comparison and `plan_hash` equal to the golden
   - VC-FIN-01…03 and VC-LC-05
   - M1's `allocation_findings` is called for the inventory checks
9. **MOD-03:**
   - wire M1 (data loader, sensing, routing, inventory) and M3 (rules, explanations in `off` mode)
   - `GET /api/v1/evaluations/EVAL-0001` equals the golden, volatile keys ignored
   - run it twice after reset and compare plan hashes
10. Serve `GET /evaluations/{id}/graph` from Member 3's `build_graph_view`.
11. **13:00** — tell Member 3 whether MOD-11 execution/audit has started (contingency C-1).

### Phase 2 — Decisions, execution, audit (Sun 1 Nov, by 15:00)
12. **Decisions API:**
    - validation order exactly as in Appendix A.5
    - idempotency store; refusals audited
    - VC-APR-01…08
    - `approval_flow.json` steps 5–10
13. **Execution simulator:**
    - step generation per Appendix A.6
    - refs equal to `approval_flow.json` step 12
    - `AEGIS_SIMULATE_FAIL_AT_STEP` gives VC-EXE-01 behaviour
    - snapshot check before executing
14. **Audit chain:**
    - append-only; verify endpoint
    - exactly 26 events after the golden flow
    - reset starts the chain at `AUD-000001`
15. **Amendment request (P1, FR-26).** Stretch S-1 only if Member 3 approves (OD-08).
16. Fix whatever acceptance run #1 (17:00) finds before the **20:00 freeze**.

### Phase 3 — Demo environment (Mon 2 – Tue 3 Nov)
17. **11:00 — offline drill:** Wi-Fi off, `AEGIS_LLM_MODE=off`, FastAPI serving `frontend/dist`; the full flow gives identical numbers and hashes (DA-12, DA-15).
18. **Timing log:** evaluation duration over 5 runs in `recorded` mode, reported as measured numbers (SC-9 is a target).
19. **`ops/runbook.md`:** start, reset, health, switch LLM mode, failure drills, where the backup video is. BTP final by **Mon 12:00**, else fallback C-4.
20. Fixes only after Mon. Tag `demo-freeze` once Member 3 approves at G4.

## Deliverables
- Backend modules with tests for every VC case you own.
- Golden evaluation and golden flow passing.
- Runbook, timing log, `docs/status/m4.md`.
- A BTP result (deployed URL, or the documented failure).

## Handoffs
| From → to | What | When |
|---|---|---|
| M1 → you | data loader (`ScenarioContext`, snapshot) and the `/scenario`, `/disruptions` handlers to mount | Sat 12:00 |
| M1 → you | sensing, routing and inventory functions | Sat 13:00 |
| M3 → you | `rule_applicability`, `linearize`, `build_graph_view`, `explain` (off mode) | Sat 12:00–18:00 |
| you → M2 | live evaluation | Sat 18:00 |
| you → M2 | decisions, execution and audit endpoints | Sun 15:00 |
| you → M3 | e2e can run steps 1–16 | Sun 15:00 |
| you → M5 | BTP status and SAP-mapping facts for the slide | Mon 12:00 |

## Done when
- `python3 tools/check_contracts.py` and `pytest -q` pass; `approval_flow.json` steps 1–16 pass twice in a row after reset with identical plan hashes.
- Every response validates against `openapi.yaml`.
- The offline + LLM-off run is identical; the timing log and runbook exist.
- No endpoint lets a blocked, stale, superseded or unapproved plan execute.

## If blocked
Record the blocker in `docs/status/m4.md` with evidence and tell Member 3 at the next merge window. Member 3 may trigger C-1 (Member 1 takes the execution and audit files, but only if Member 1 is on schedule). Never cut approval enforcement.
