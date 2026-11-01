# M5 — Rehearsal Log (SC-9, MOD-18, R1–R4)

| Doc | Accountable owner | Executor | Runs | Source of truth | Outputs fed | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `pitch/rehearsal-log.md` | Member 5 (M5) | Member 4 with demo dummies; presenters + Member 2 (needs) for the graded runs | R1 (D2 17:00, 45 min), R2 (D4 17:00, 45 min), R3 (D7 15:00, 60 min + freeze decision), R4 (D8 12:00, 30 min), D9 final sweep | `docs/00` l.629, l.652–653 (three clean rehearsals D8; final sweep D9); `docs/05` l.103 (R-cycle), l.105–106 (MOD-18) | MOD-18 Go/No-go (`docs/05` l.105–106); SC-9 timing log (`docs/00` l.161); acceptance-criteria gate R-01…R-08 (`docs/00` l.694–701) | DRAFT — grounded against docs/00/01/02/05 as of 2026-10-23 (D2) |

Claim-citation rule (per `pitch/AUTHORING-PLAN.md` §4): every claim names file + line/section. Nothing here invents numbers or behavior.

---

## 1. Purpose

This log records each rehearsal run of the approval-UI demo (MOD-11) against the R-cycle and feeds the MOD-18 Go/No-go decision ([docs/05](../docs/05-temporal-rag-ui-review-and-decisions.md) l.105–106). It is the paper twin of the offline drill ([pitch/offline-drill.md](offline-drill.md)) and the backup-video playbook ([pitch/backup-video-shot-list.md](backup-video-shot-list.md)).

## 2. Run schedule and ground rules

Schedule per `docs/05` l.103 (R1 D2 17:00 — 45 min; R2 D4 17:00 — 45 min; R3 D7 15:00 — 60 min, freeze decision; R4 D8 12:00 — 30 min) and `docs/00` l.652 (three clean rehearsals on D8; two runs after reset in the golden flow). Rules that come from `docs/05` l.101, not us:

- At most five change requests per checkpoint; each tagged **must** (demo-breaking, wrong number, misleading claim, accessibility failure) or **should**; disputes decided by M5; no redesign between checkpoints.
- Review notes go into `docs/reviews/Rn.md` within one hour of the checkpoint (R1→R4); this log holds the per-run evidence rows the notes point at.

Ground rules for every run section below:

- Numbers are re-verified against outputs live during the run — never re-typed from memory.
- Fits the "You prepare, humans decide" rule: M5 records, the run participants decide outcomes.
- Any failure that would reach a judge in the graded window is triaged against the backup-video playbook (`pitch/backup-video-shot-list.md`) the same day.
- Acceptance is judged against R-01…R-08 (`docs/00` l.694–701) and MOD-18's DA-01…15 pass list (`docs/05` l.105–106).

## 3. R1 — D2 17:00, 45 min (pre-review draft)

`(pending — run today)`

- Numbers verified: `(pending)`
- KR tags raised (KR-1…KR-k, each **must** or **should**): none yet
- Next steps: `(pending)`
- Sign-offs: `(pending)`

## 4. R2 — D4 17:00, 45 min

`(pending)`

- Numbers verified: `(pending)`
- KR tags raised: `(pending)`
- Next steps: `(pending)`
- Sign-offs: `(pending)`

## 5. R3 — D7 15:00, 60 min (freeze decision)

`(pending)`

- Numbers verified: `(pending)`
- KR tags raised: `(pending)`
- Freeze decision (per `docs/05` l.103; full DA-01…15 pass on D7 feeds MOD-18, `docs/05` l.105): `(pending)`
- Next steps: `(pending)`
- Sign-offs: `(pending)`

## 6. R4 — D8 12:00, 30 min (final pre-drill run)

`(pending)` — D8 also carries the offline drill run ([pitch/offline-drill.md](offline-drill.md) §2) and the locked deck numbers (`docs/00` l.629).

- Numbers verified: `(pending)`
- KR tags raised: `(pending)`
- Next steps: `(pending)`
- Sign-offs: `(pending)`

## 7. D9 final sweep (MOD-18 re-confirmation)

`(pending)` — demo-freeze tag + laptops packed per `docs/00` l.630/l.653.

- Numbers verified: `(pending)`
- KR tags raised: `(pending)`
- Sign-offs: `(pending)` — M5 signs the MOD-18 gate on this run (`docs/05` l.106).

## 7a. Automated pre-check before the Sun 17:00 acceptance run (M3, 1 Nov 2026 ~15:30)

Machine evidence only. It is not the human acceptance run, and nobody has signed it off. Source: `main` 1a6c7b4 plus `/health` version fix. Local stack: uvicorn with `AEGIS_LLM_MODE=recorded` + Vite in live API mode.

| DA | Automated evidence | Result |
| --- | --- | --- |
| DA-01 | "SYNTHETIC DATA" banner visible on Command Center (page snapshot) | pass (other screens: check by hand) |
| DA-02 | SO-1001/1002/1003 at 6/4/2 days late; baseline ₹11,60,000 | pass |
| DA-03 | Golden evaluation has 7 steps; UI reports "Evaluation EVAL-0001 completed." | pass (UI step list: check by hand) |
| DA-04 | P1 ₹3,34,000 / ₹0 / ₹8,26,000 BLOCKED; P2 ₹4,92,000 / ₹50,000 / ₹6,18,000 PASSED; "P2 · Recommended" | pass |
| DA-05 | `frontend/tests-live/live-demo.spec.ts`: SUP-B graph with 2 highlighted path elements; SUP-C passed | pass (text version: check by hand) |
| DA-06, DA-07 | Not automated (evidence-drawer selector changed in the UI redesign) | check by hand |
| DA-08 | P1 Approve disabled with "Cannot be approved: 2 blocking findings. P1 remains blocked."; API refusal `422 PLAN_BLOCKED` in golden e2e step 5 | pass (per D-043) |
| DA-09–DA-11 | `work/audit/flow_runner.py` against the real API, run 1 Nov: `approval_flow` steps 1–16 pass twice in `off` (15:09) and twice in `recorded` (15:29), identical plan hashes | pass at API level; check UI by hand |
| DA-12 | The `off` runs above: 16/16, same plan hashes as `recorded` (only the explanation text differs, as VC-LLM-01 allows) | pass at API level; network-unplugged drill by hand |
| DA-13 | Not automated | check by hand |
| DA-14 | Deck not in repo | M5 |
| DA-15 | Two runs after reset: P1 `sha256:e51b38ab…`, P2 `sha256:3324f97f…` both times | pass |
| DA-16, DA-17 | Cut (D-034): early warning shown as one slide built from the EWS goldens | cut |

KR candidates for the run (M3): none blocking. Note for presenters: P1's Approve is disabled by design (D-043).

## 8. Feeding the Go/No-go

MOD-18 Go requires: all DA pass or agreed workaround; CI green; golden flow twice after reset; offline drill passed; backup video exists (`docs/05` l.105–106). The rows above (R1–R4 + D9) plus the offline-drill log table are the inputs; the decision itself is recorded by M5 at the D9 gate — *(You prepare, humans decide.)*
