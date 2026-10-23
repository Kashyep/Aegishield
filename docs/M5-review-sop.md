# M5 Review Checkpoint SOP (R1–R4)

Owner: Member 5 (reviewer + final design authority at checkpoints only)
Applies: D-2 (Fri 2026-10-23) through D-8 (Mon 2026-11-02)
Sources: docs/02-ui-ux-and-frontend.md §12 (lw. 203–209, 282), docs/00-source-of-truth.md day table + R-11 (lw. 646–652, 704) and SC-7 (l. 159), docs/05 §1/§8/§10/§15.4, docs/decisions/decision-sheet.md D-043, docs/decisions/OD-07-claim-check.md.

## 1. Scope

Standing procedure for the four Member 5 review checkpoints. Between checkpoints Member 5 also contributes to MOD-07/12/17/18 implementation work and reviews MOD-01/03/05/08/10/11/13/16/19/20 per docs/05 §1. Implementation choices inside the checkpoints' domain are owned by the team between checkpoints — Member 5 exercises final authority only at the checkpoints themselves (docs/02 l. 7) and at the end as final authority after consulting the owner (docs/05 §15.4).

## 2. Checkpoint schedule

Per docs/02 §12 table (lw. 203–208). Run each checkpoint at the published time; if inputs are not ready, re-schedule within the same day rather than marking the checkpoint passed.

| CP | When | Length | Inputs | Exit criteria |
|---|------|--------|--------|---------------|
| R1 | D2 — Tue 27 Oct 2026, 17:00 | 45 min | Wireframes S1–S7 + comparison card mock carrying the golden numbers (MFN 15% = TR-0003, AIFTA 0% = TR-0005) | Approved layout, or ≤5 change requests |
| R2 | D4 — Thu 29 Oct 2026, 17:00 | 45 min | First integrated build on the live API | ≤5 change requests, each one tagged must / should |
| R3 | D7 — Sun 1 Nov 2026, 15:00 | 60 min | Full user flow J1–J5 + accessibility results (SC-7) | Feature-freeze confirmation |
| R4 | D8 — Mon 2 Nov 2026, 12:00 | 30 min | Rehearsal build | Polish sign-off |

Notes:
- R3 shares D7 with acceptance run #1 and the freeze call (docs/00 day table). The feature freeze takes effect only on a positive R3 exit.
- SC-7 accessibility results are a required R3 input (docs/00 l. 159). If the a11y results are missing, R3 cannot confirm the freeze; run the contingency in §6.
- The M2-T15 rule-timeline graphic (P2, stretch S-3) is built only after R3 approval (docs/02 l. 232) — do not schedule it before R3's exit.

## 3. Standing budget

Reviews are limited to the R1–R4 checkpoints plus at most 60 minutes per day of PR reviews and decision calls (docs/05 l. 10). If checkpoint load exceeds the daily budget on a given day, the overflow moves to the next day rather than inflating the budget.

## 4. Blocking questions and disagreement fallback

Outside the checkpoints, Member 5 answers blocking questions within 4 working hours (docs/02 l. 209). The same rule governs disagreements: if Member 5 has not answered within 4 working hours, the submitting member's latest proposal stands (docs/02 l. 282). Member 5 never blocks team work by silence — the fallback is automatic, not a judgment call.

## 5. Sunday sweep (D-043)

Each Sunday (2026-10-26, 2026-11-02), Member 5 runs one consolidated sweep of open PR reviews and pending decisions, logging review notes within 1 hour (decision-sheet D-043). The sweep is a review pass, not a re-planning session — items it surfaces go into the normal 4-working-hours lane (§4).

## 6. Risk R-11 — weekend availability

R3 falls on Sunday 2026-11-01, inside the 31 Oct – 1 Nov weekend covered by R-11 (docs/00 l. 704). Member 5 confirms weekend availability at kickoff. Protocol:

1. If weekend availability is confirmed at kickoff, run R3 as scheduled.
2. If Weekend availability is unavailable, apply the pre-agreed fallback: shift R3 to D8 (Mon 2 Nov) morning, ahead of the rehearsal slots, and announce the shift to the team. The feature freeze moves with R3; D8's evening acceptance run and rehearsals keep their slot.
3. Log whichever branch was taken as a decision in docs/decisions/decision-sheet.md.

## 7. Claim-check fallback (OD-07)

Per docs/05 §8: if the originators have not logged the OD-07 term/claim check by D3 (Wed 2026-10-28), Member 5 runs it exactly as defined in docs/decisions/OD-07-claim-check.md. Terms or claims that do not match the evidence get the status "not accepted pending corrections" plus a corrections list; matching claims are accepted as-is. The check is evidence-based (-covered docs + fixtures), no re-derivation from memory.

## 8. Per-checkpoint protocol

For each checkpoint:

1. Pre-check that every input listed in §2 exists and is inspectable; if not, re-schedule (§2 preamble).
2. Run the checkpoint within its published length and budget (§3).
3. Write outcomes as decisions in docs/decisions/decision-sheet.md (new D-IDs, dated, with source-doc references). For change requests: keep the ≤5 cap, keep the must/should tagging required at R2, and assign owners.
4. Confirm the exit status explicitly (approved / pass / freeze confirmed / signed off). A checkpoint without a written exit status is not passed.
5. Never upgrade a checkpoint outcome into implementation-directive detail — extra requests go through the normal 4-working-hours lane.

## 9. Final call

At each checkpoint Member 5 is final design authority after consulting the owning member (docs/05 §15.4). If the owner cannot be reached before the checkpoint's scheduled end, note the consultation attempt in the decision log and take the call; do not silently extend the checkpoint.
