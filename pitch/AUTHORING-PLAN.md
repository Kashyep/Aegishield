# Pitch Authoring Plan

Status: DRAFT: pending Member 5 confirmation
Date: 2026-10-23
Owner: Member 5 (docs/05)
Branch: `m5/prep-part-a` (docs only; new code drafts go on `m5/prep-part-b` per docs/05 §10)

---

## 1. Purpose

This plan records what Member 5 authors, reviews, and delegates for the pitch track
(docs/01), and how each artifact is grounded before sign-off. It follows docs/05:

- §8 pitch sign-off — M5 reviews M1's pitch outputs pre-publication; sign-off means
  every accepted claim is grounded in an artifact per docs/05 §9; deviations go through
  OD sheets.
- §9 decision sheet — anchor `docs/decisions/decision-sheet.md`; OD-05/06 = M5+M1,
  OD-07 = M1+M5.
- §15 — if no LLM access, `off`/`recorded` only; if legal wording is uncertain, use
  cautious phrasing per docs/01 §10; disagreement → M5 decides after hearing both,
  choosing the option that protects the D5 golden milestone.

## 2. Milestones relevant to this plan (verified)

- Tonight (D-2 → 23 Oct 2026): M5 finalizes OD-01…OD-04 as decision lead.
- D3 Mon 27 Oct 17:00: R1 checkpoint. If M1 has not logged OD-07 by D3, M5 runs the
  claim-check with minimum docs/00 page references and outputs
  `not accepted pending corrections` + a corrections list (docs/05 §8).
- D5 golden milestone: recorded responses (M5-D9) and EVAL.md (M5-D10) land before or
  at D5. Pitch claims must not outrun what `off`/`recorded` mode can show.
- D9: final review sweep + rehearsal log.

## 3. What M5 authors (and where)

| Artifact | Grounding | Status |
| --- | --- | --- |
| `pitch/AUTHORING-PLAN.md` (this file) | docs/05 §§8–9, docs/01 | this update |
| `pitch/acceptance-dry-run.md` | docs/05 §14 acceptance criteria; final sweep D8/D9 | to write |
| `pitch/offline-drill.md` | docs/05 §15 no-LLM fallback (`off`/`recorded`) | to write |
| `pitch/rehearsal-log.md` | docs/05 §3 M5-D11; R1–R4 dates docs/02 §13 | log only, no prose |
| Backup-video shot list (pitch-adjacent) | S1–S7 UI states docs/02 §7 | to write |
| Decision-sheet updates (OD-01…OD-04, OD-07 draft state) | docs/05 §9; D-024/D-042/D-043/D-044 | next commit |

## 4. What M5 reviews (M1-owned, pre-publication)

- `pitch/logistics.md`, `pitch/personas.md`, `pitch/bmc.md`, `pitch/round1/`,
  `pitch/qa-bank.md`, `pitch/evidence-register.md`, `pitch/od-01-sap-tech.md`.
- Review output: accepted / corrections list / `not accepted pending corrections`
  (OD-07 path, docs/05 §8).
- Every accepted claim must cite an artifact: a verified file:line anchor, a golden
  fixture, or a contract check. Claims that only exist as PREP/UNVERIFIED annotations
  are not publishable.

## 5. Sign-off mechanics

1. Draft state: annotations say "DRAFT: pending Member 5 confirmation".
2. M5 reads against docs/05 §9 acceptance (§14 criteria: VC-RULE-01…07 green,
   mode-identical evaluation output, template-backed explanations, decision-log
   completeness, review notes R1–R4).
3. Accepted claims get sign-off entered in the decision sheet; corrections go back to
   M1 with a one-page list.
4. Final deck v1 sign-off is M1-T5 per docs/01 line 19; M5's pre-read does not replace it.

## 6. Residual items needing a human

- Live LLM credentials (`AEGIS_LLM_BASE_URL`, `AEGIS_LLM_MODEL`, `AEGIS_LLM_API_KEY`)
  — until provided, all pitch demos stay `off`/`recorded` (acceptable per docs/05 §15).
- OD final decisions (board-level approvals).
- Registration-deadline discrepancy (FAQ 15 Oct vs home page 21 Oct) — pitch logistics
  quotes 15 Oct until a human resolves it.
- OD-06 Sir MVIT institution fact: NOT FOUND; never guessed; needs a human source
  (e.g. SAP Community North contact).
