# Member 3 plan prompt — Main RAG system, contracts and final decisions

Paste everything below the line into your coding agent at the repository root after filling the header. Your agent helps with code, tests and logs; the decisions themselves are yours.

---

## Header
- REPO_ROOT: <path>
- NOW: <YYYY-MM-DD HH:MM IST>
- MODE: <plan-only | execute>
- GIT: <no-commit | commit-locally on branch m3/<topic>>   (never push unless I say so)

## Goal
Keep five people building one product, and deliver Member 3's modules:
- **MOD-01** contracts & tooling
- **MOD-07** Temporal Rule Service
- **MOD-12** LLM gateway & explanations (incl. LC extraction)
- **MOD-23** GraphRAG context & GraphView
- **MOD-19** golden-flow e2e & conformance tests
- **MOD-17** decision log
- **MOD-18** demo acceptance and go/no-go

You are the final decision-maker (`docs/00` §15.4).

## Context (read in this order)
1. `docs/00-source-of-truth.md`, all of it. Pay particular attention to:
   - "Read me first", §2.3–2.4, §4.4 (cut list)
   - §7 (ownership, boundaries, handover protocol), §10.2 (rules)
   - §13 (daily plan, contingencies C-1…C-5)
   - §14 (tests, DA-01…17, risks, open decisions), §15 (change control)
   - Appendices B.3–B.5 and D, §20 (decision log)
2. `contracts/README.md` and `contracts/CHANGELOG.md` (1.1.1: 1.1.0 additions plus the data-pipeline owner move).
3. Schemas: `trade-rules.schema.json`, `graph.schema.json` (LinearizedContext, GraphView), `plan.schema.json` (Explanation).
4. Goldens in `fixtures/expected/`:
   - `rule_applicability.json`
   - `dependency_results.json` (`linearized_contexts`)
   - `graph_view_SUP-B.json`
   - `explanations[]` in `evaluation_EVAL-0001.json`
   - `approval_flow.json`
5. Validation cases with owner `member_3`: VC-RULE-01…07, VC-LLM-01, VC-LLM-02.
6. Reference behaviour: `tools/aegis_oracle.py` (`rule_applicability`, `linearize_path`, `linearized_context`, `graph_view`), and `tools/check_contracts.py` (golden builder, explanation templates, conformance helpers).

Ignore `docs/01…05` and `docs/archive/` (older numbering).

## You own / you don't
- **Yours:** the modules above, the decision log (§20), contract change control, UI checkpoints U1/U2, acceptance sign-off, go/no-go, and `docs/status/m3.md`.
- **Not yours:**
  - LC/FTA pass/fail logic and money (M4)
  - traversal outcomes (M4)
  - early warning (M1)
  - screens (M2)
  - slides (M5)

  Decide disputes, but don't implement other people's modules.

## Constraints
- Inspect `git status`, `git log -5`, `git branch -vv` and `git remote -v` first. Never force-push, `reset --hard`, rewrite history, stash, or delete others' branches. With GIT=no-commit, leave changes uncommitted.
- **You are the only person who may run `python3 tools/check_contracts.py --write-golden`.** Only do it for a reviewed behaviour change. Diff every regenerated golden line by line before merging.
- **Contract change windows:** from Sat 31 Oct, patch-only. After Sun 1 Nov 20:00, fixes only, and each needs a decision-log entry. Never change the 12 plan-input fixtures: that changes every plan hash.
- **Rules:** applicability is decided only by metadata filtering (§10.2). Ranking never selects. `retrieval_trace.ranker_used_for_selection` is always `false`.
- **LLM:** outcomes, amounts and hashes must be identical in `off`, `recorded` and `live`. Every model output passes the validator or becomes a template. No keys in the repo or logs.
- **Your review time is bounded:** U1 (30 min), U2 (45 min), PR reviews in the 13:00/19:00 merge windows, and the acceptance runs. Protect your own build work.
- At most 2 attempts per failing fix. "Done" means it was run and the output read.

## Plan

### Phase 0 — Re-plan and contracts (Fri 30 Oct)
1. **18:30 — chair the re-plan call** (30 min):
   - walk §7.1/§7.3 (5 min)
   - each person names code they wrote whose owner changed, and the handover branch (10 min)
   - deadlines and contingencies C-1…C-5 (5 min)
   - owners for OD-01, 04, 09, 10, 11 (5 min)
   - top risks R-03, R-04, R-06 (5 min)
2. **By 21:00 — merge contracts 1.1.1:**
   - checker green
   - the 12 plan-input fixtures unchanged
   - `input_snapshot_id` and both plan hashes unchanged
3. Log D-021…D-031 in §20 if they aren't there yet, plus any decisions made in the call.
4. **Inventory your modules** (rules, gateway, linearise/GraphView, e2e) and record them in `docs/status/m3.md`. **If MODE is plan-only, stop here.**

### Phase 1 — Your modules + integration (Sat 31 Oct)
5. **By 12:00:**
   - VC-RULE-01…07 automated and green; `rule_applicability.json` equal.
   - Decide OD-01 (with M4's BTP result), OD-04 and OD-09 (with M5's coordinator answer), and log them.
6. **By 18:00:**
   - `linearize()` byte-equal to the golden.
   - `build_graph_view()` equal to `graph_view_SUP-B.json`; confirm with Member 4 who serves `GET /evaluations/{id}/graph`.
   - Gateway `off` mode giving the golden template explanations.
   - Validator rejecting unknown citations (VC-LLM-02).
7. **e2e skeleton:** `backend/tests/e2e/test_golden_flow.py` runs `approval_flow.json` steps 1–4 against the live API. A conformance helper validates every response against the schemas.
8. **13:00 — contingency check C-1** (MOD-11 started?). **17:00 — UI checkpoint U1:** at most 5 change requests, tagged must/should, written to `docs/reviews/U1.md` within an hour. **18:00 — check C-2 and gate G2** (golden evaluation via API).

### Phase 2 — Full flow and freeze (Sun 1 Nov)
9. **e2e:** all 16 steps green by 16:00, including the 26-event audit and chain verification.
10. **Recorded mode:** recorded files for the demo prompts in `fixtures/llm/recorded/`. VC-LLM-01 in `off` and `recorded` gives identical plan hashes.
11. **15:00 — UI checkpoint U2.** **17:00 — acceptance run #1:** Member 5 executes DA-01…17, Member 2 drives, you sign and log the defects with owners.
12. Apply the cut list if needed (C-3). **20:00 — declare the freeze** in the decision log.

### Phase 3 — Stabilise and decide (Mon 2 – Tue 3 Nov)
13. Triage fixes. Rerun the checker and e2e after each merge window and post the exit codes.
14. **By Sun 18:00:** approve or reject the pitch claims from Member 1's evidence register (OD-07). **Before G3 (Mon 20:00):** review Member 5's deck against Appendix F.
15. **Tue 15:00 — acceptance run #2.** **18:00 — go/no-go (G4).** Go requires:
    - no open P0
    - checker and all tests green
    - golden flow passing twice with identical hashes
    - LLM-off run identical
    - DA items verified
    - backup video present

    Then approve the `demo-freeze` tag. If no-go, apply C-5.

## Deliverables
- Rules and gateway modules with tests.
- `linearize` and GraphView.
- e2e and conformance tests.
- Recorded LLM files.
- Decision log entries.
- `docs/reviews/U1.md`, `U2.md`, acceptance results in `pitch/rehearsal-log.md`.
- `docs/status/m3.md`.

## Done when
- The checker passes; VC-RULE and VC-LLM cases are automated and green.
- e2e steps 1–16 pass twice after reset.
- Every open decision in §14.5 is closed or defaulted and logged.
- Go/no-go is recorded with its evidence.

## If blocked
Decide using the cut list and the "never cut" list (§4.4). Log the decision with what you gave up. Never trade away approval enforcement, golden equality or synthetic labelling.
