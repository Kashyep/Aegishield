# Team prompt — Demo-readiness audit, scoped fixes and go/no-go evidence (v2)

Member 3 runs this at acceptance run #1 (Sun 1 Nov 17:00) and run #2 (Tue 3 Nov 15:00); anyone may run it in `audit-only` mode at any time. Paste everything below the line into a coding agent at the repository root after filling the header.

---

## Header
- REPO_ROOT: <path>
- NOW: <YYYY-MM-DD HH:MM IST>
- MODE: <audit-only | audit-and-fix>   (after Sun 1 Nov 20:00 freeze: fixes for P0/P1 only, each approved by Member 3)
- GIT: <no-commit (default) | commit-locally>

## Goal
Determine, with evidence, whether the AegisShield AI demo works end to end from a clean state, exactly as specified. In `audit-and-fix` mode, also fix demo blockers without changing contract-defined behaviour. Finish with a report and a verdict: GO / GO WITH RISKS / NO-GO.

## Context (sources of truth; highest wins on conflict)
1. `contracts/` 1.1.1: schemas, `openapi.yaml`, and the `README.md` registry of owners.
2. `fixtures/expected/` (goldens, `approval_flow.json` steps 1–16, both early-warning goldens) and `fixtures/validation/cases.json` (48 cases: 45 executable by the oracle, 3 manual).
3. `docs/00-source-of-truth.md` v2:
   - §5 requirements FR-01…36, NFR-01…07
   - §7.3–7.4 modules and boundaries
   - §8 agents and step owners
   - §10 deterministic rules incl. §10.9 early warning
   - §11 approval/execution/audit
   - §12.2 demo script
   - §14.2 DA-01…17
   - §15 change control
   - Appendix E: UI spec
   - Appendix F: pitch canon
4. `docs/status/m1.md` … `m5.md` and `pitch/`.

`tools/aegis_oracle.py` is the reference specification and `tools/check_contracts.py` is the contract gate. Ignore `docs/01…05` and `docs/archive/`.

**Golden sanity values (SYNTHETIC):**
- Baseline: 11,60,000.
- P1 blocked: 3,34,000 / 0 / 8,26,000 / exposure 5,10,000.
- P2 passed: 4,92,000 / 50,000 / 6,18,000 / 0.
- Duty at risk: 3,87,600.
- Early warning: Kulim fab 97 (23 Oct 21:00) and 100 (scenario time).
- 26 audit events after the full flow.
- Plan hashes `sha256:e51b38ab…f6f2` (P1) and `sha256:3324f97f…adf0` (P2).
- `input_snapshot_id` `sha256:d52c7ecc…d6c0`.

## Constraints
- **Git safety:** inspect `git status`, `git log -5`, `git branch -vv` and `git remote -v` first. Never reset, force-push, rewrite history, stash, delete branches, or discard others' work. Don't push or touch remotes.
- **Read-only contracts:** don't edit `contracts/`, `fixtures/`, or goldens, and don't run `--write-golden`. Contract disagreements become findings for the registry owner.
- **Scope:** every changed line traces to a finding. No refactors after the freeze. No new dependencies. Don't move files.
- **Bounded fixes:** at most 2 attempts per fix. Never make a check pass by skipping, weakening or hard-coding.
- **Evidence:** quote commands, exit codes and output. Keep observed separate from inferred.

## Procedure
1. **Baseline (read-only).** Run each of the following and record the exit code:
   - `python3 tools/check_contracts.py`
   - backend tests
   - frontend build, lint, typecheck and tests
   - Playwright smoke, if present
2. **Requirements:** FR/NFR status (Done / Partial / Missing / Fail) with file:line or command evidence, and the owner from §7.3.
3. **Validation-case coverage:** map each of the 48 case ids to an automated test in its owner's module, and run them.
4. **Golden behaviour.** After reset:
   - `GET /api/v1/evaluations/EVAL-0001` equals the golden, volatile keys ignored, including `steps[].owner` per §8.
   - `GET /api/v1/early-warnings?as_of=2026-10-23T21:00:00+05:30` and the default as-of equal their goldens.
   - `approval_flow.json` steps 1–16 run exactly as written.
5. **Invariants.** Check each with evidence:
   1. Code decides; outcomes and hashes are identical in LLM off, recorded and live.
   2. Every finding has evidence.
   3. Missing or unverified graph data never passes.
   4. Rule selection is by metadata only.
   5. LC: 43T vs 43P correct; arrival is never an LC input.
   6. FTA: non-party transit gives needs_review.
   7. Money identities hold; exposures are separate; the UI never computes money.
   8. P2 uses only passed options and respects the LC cap.
   9. Approval rules (§11.3) are enforced server-side.
   10. Execution is simulated and stops on the first failure.
   11. The audit chain verifies; reset restarts it.
   12. Two runs give identical hashes.
   13. Early warnings never change plans or the snapshot, and are never called a probability.
   14. The boundary rules in §7.4 hold, including no import of the early-warning module from plan code and no production import of the oracle.
6. **UI:** Appendix E screens and states; DA-01…13, 16, 17; synthetic banner; heuristic caption; keyboard-only approval.
7. **Demo operations:**
   - startup from the runbook
   - one origin
   - reset
   - offline + LLM off run
   - measured timings
   - backup video on two devices
   - BTP status per OD-01
8. **Pitch:** numbers in `pitch/finale/` equal Appendix F.1; no banned phrases; SAP wording per §2.4; synthetic labels.
9. **Fix (audit-and-fix only):** P0, then P1. For each behaviour bug, write a failing test named after its VC/DA/FR id, make the minimal fix, then rerun the affected tests, the checker and the golden flow.
10. **Dress run:** reset → full flow twice → compare hashes → repeat with LLM off. Mark each DA item Verified, Partial, Fail, or Human-only (with the owner named).

## Done when
`docs/reviews/demo-readiness-<date>.md` exists and contains, in order:
1. Verdict and rationale.
2. A before/after table of command exit codes.
3. A DA-01…17 table with evidence and owner.
4. FR/NFR coverage.
5. Validation-case coverage.
6. Invariant results.
7. Findings ranked P0–P3, each with file:line, evidence, owner and status.
8. Changes made, with verification.
9. What was not verified, and why.
10. Next actions per member.

**Verdict rule:**
- **GO:** no open P0; checker and all tests green; golden flow twice with identical hashes; LLM-off identical; every DA item Verified or Human-only.
- **GO WITH RISKS:** no open P0, but P1 items or unconfirmed Human-only items remain.
- **NO-GO:** any open P0.
