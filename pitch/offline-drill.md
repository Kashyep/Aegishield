# M5 — Offline Drill (DA-12, SC-5)

| Field | Value |
| --- | --- |
| Doc | Offline drill runbook and log for the demo (M5 Part B) |
| Accountable owner | M5 |
| Executor | M3 (backend/offline bundle) + M5 (drill execution, log) |
| Runs | D8 (full dress run: Tue 27 Oct → rescheduled slot; docs/00 l.629, l.652) and D9 (final sweep, docs/00 l.665–670; test-strategy table "manual" row) |
| Source of truth | docs/00-source-of-truth.md (SC-5 l.157, SC-9 l.161, MOD-15 l.313, gates l.669–670, §14.2 DA-12 l.686, §14.3 R-02 l.695); docs/02-ui-ux-and-frontend.md l.130–131; docs/05-temporal-rag-ui-review-and-decisions.md l.106, §15 l.205–211; docs/M5-review-sop.md; ops/ runbook (MOD-15) |
| Outputs fed | Go/No-go checklist (offline-drill-passed row, docs/05 l.106); D8 non-functional gate (docs/00 l.670); DA-14/DA-15 re-checks; decision log (docs/05 l.109) if anything fails |
| Status | DRAFT — grounded against docs/00/01/02/05 as of 2026-10-23 (D2) |

Claim-citation rule (per `pitch/AUTHORING-PLAN.md` §4): every claim names file + line/section. Nothing here invents numbers or behavior.

---

## 1. Purpose

- Prove the offline acceptance check DA-12 exactly as specified in docs/00-source-of-truth.md l.686: "Network unplugged + LLM off: same numbers and outcomes; badge 'LLM: off (templates)'".
- Satisfy SC-5 (docs/00 l.157): "Same plan hashes in `live`, `recorded` and `off` modes; demo runs with network unplugged | VC-LLM-01, offline drill | D8".
- This is a P0 gate: NFR-02 (docs/00 l.200) is priority P0 with owner M3 and verified by DA-12.
- Feed the Go/No-go checklist: docs/05 l.106 lists "offline drill passed" as a required condition for Go before the target event.

## 2. Gate and fallback

- The drill is performed at full dress-rehearsal (D8) and re-confirmed at the final sweep run (D9) per the non-functional gate (docs/00 l.670): "Timing log (SC-9), offline drill, LLM-off run | M3, M5 | D8".
- Pass criteria: every DA-12 observation holds (same numbers and outcomes as the online run; amber badge text exactly "Explanations use templates; decisions unaffected" per docs/02 l.131 for degraded LLM, and the `off`-mode badge per docs/00 l.686); plan hashes match across modes (SC-5).
- If the drill fails, the agreed fallback is R-02 (docs/00 §14.3, Mitigation "| `recorded` default; outcomes independent of LLM | Fallback `off` mode") and, if the backend itself is unreachable, the backup video plus deck (docs/02 l.130: full-width error "Backend not reachable at localhost:8000" + Retry; presenter note "use backup video"); docs/05 §15 confirms the no-LLM fallback (`off`/`recorded` modes) is fully acceptable.
- Any deviation is escalated per docs/M5-review-sop.md and recorded in the decision log (docs/05 l.109 template).

## 3. Pre-drill checklist (owner: M3, with M5)

1. Offline bundle and local runbook prepared in `ops/` per MOD-15 (docs/00 l.313): "Local runbook, offline bundle, optional SAP BTP CF deploy | M3 | M2 | `ops/`".
2. Demo laptop state: seed data reset via the idempotent reset path, so DA-15 (docs/00 l.689: second run after reset → identical plan hashes) can be re-run immediately if a reset repeat is needed.
3. Record the online/`live` baseline: one full run with network up, capturing plan hashes and the audit list for comparison against `off`-mode output.
4. Confirm the LLM credentials question (OD-04, due Sun 2026-10-25) outcome: if no creds, the whole drill runs in `recorded` mode by plan (D-024) and DA-12 is still exercised with LLM off.

## 4. Drill steps (network unplugged, LLM off)

1. Unplug the venue/laptop network (no Wi-Fi, no tethering). Verify absence of connectivity from the browser, not just from the backend.
2. Start the backend from the `ops/` offline bundle and open the UI; the frontend must show normal state, not the docs/02 l.130 error ribbon ("Backend not reachable at localhost:8000" + Retry), because the backend is local and reachable.
3. Run the same demonstration scenario used online; evaluation completes (SC-9 allows ≤ 5 s in `recorded` mode on the demo laptop — a target, not yet measured: docs/00 l.161).
4. Verify DA-12 conditions:
   - Same numbers and outcomes as the `live` baseline (no invented values);
   - Badge shows "LLM: off (templates)" (docs/00 l.686);
   - Audit list still shows refusals and decisions and Verify → valid (DA-11, docs/00 l.685);
   - Keyboard-only flow works with statuses shown as icon + text (DA-13, docs/00 l.687).
5. Capture plan hashes from the run and compare to the online/`recorded` baselines (SC-5).
6. DA-14 re-check: every number quoted on the slides equals the UI exactly (docs/00 l.688) — the drill is also where the deck numbers are frozen for D8 (R-07, docs/00 §14.3).
7. Log results in this file's log table (§5) as the drill happens; do not reconstruct from memory.

## 5. Drill log (fill at run time)

| Run id | Date | Mode (`live`/`recorded`/`off`) | DA-12 result | Plan hash match (SC-5) | Notes / deviations | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| OD-P1 | (pending) | off | (pending) | (pending) | (pending) | M5 |
| OD-F1 | (pending) | off | (pending) | (pending) | (pending) | M5 |

- OD-P1 = planned D8 dress drill; OD-F1 = D9 final-sweep confirmation. Rows remain `(pending)` until the runs happen; M5 fills them, humans decide Go/No-go.
- No timing or performance numbers are claimed here beyond re-quoting SC-9's published target with its citation.

## 6. Failure playbook

| Failure | First response | Fallback if unresolved | Owner |
| --- | --- | --- | --- |
| Backend cannot start on laptop | `ops/` runbook section for local start; retry from bundle | Backup video + deck (docs/02 l.130 note) | M3 |
| Plan hashes differ across modes | Stop; re-run both `off` and baseline before presenting; log deviation | `recorded` default position (R-02) | M3/M5 |
| Numbers drift on screen vs deck | Freeze the deck to the app's numbers on the spot (R-07 guidance, docs/00 §14.3) | Deck stays frozen; discrepancy logged | M1/M5 |
| Demo state corrupted mid-run | Reset button → re-run; verify DA-15 identical hashes | Recorded video (R-06, docs/00 §14.3) | M2 |

All failures that reach the room are escalated per docs/M5-review-sop.md and entered into the decision log (docs/05 l.109).

## 7. Sign-off

- M5 signs the run above; M3 confirms the `ops/` bundle items in §3.
- Go/No-go: humans (docs/05 l.106) use this log as the evidence row for "offline drill passed". This document only records the drill; it does not cast the Go vote.
