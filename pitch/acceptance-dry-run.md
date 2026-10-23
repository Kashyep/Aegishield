# M5 — Demo Acceptance Dry-Run (DA-01 … DA-15)

| Field | Value |
| --- | --- |
| Doc | `pitch/acceptance-dry-run.md` (M5 Part B) |
| Accountable owner | M5 |
| Executor | M1, acting as an **independent tester** (docs/00 L316, MOD-18: M1 executes; M5 reviews and is accountable) |
| Runs | **D7** = full dress-rehearsal run; **D9** = final sweep run (docs/00 L665–670, test-strategy table, "manual" row) |
| Source of truth | `docs/00-source-of-truth.md` §14.2 (L672–690). Every requirement line below is quoted **verbatim** from that section. |
| Outputs fed | docs/00 §14.2 run record + `pitch/rehearsal-log.md` (per-run log is rendered in `pitch/rehearsal-log.md`; updated from this doc) |
| Status | DRAFT — grounded against docs/00/01/02/05 as of 2026-10-23 (D2) |

Claim-citation rule (per `pitch/AUTHORING-PLAN.md` §4): every claim names file + line/section. Nothing here invents numbers or behavior.

---

## 1. Purpose

DA-01…DA-15 is the product-independent script that proves "everything in the demo actually works" (docs/00 §14.2). It is executed twice:

- **D7** — the causal run: catches breakages while D-3…D-8 fixes are still possible.
- **D9** — the final sweep: confirms the demo environment on presentation day, after any late changes.

M1 runs the checks **without the builders helping** (independent tester). M5 records results, escalates failures, and is accountable for the §14.2 output plus the rehearsal log.

## 2. Gate and fallback

Go/No-go for the demo (docs/05 L106):

- All DA-01…15 pass, **or** every failing one has an agreed workaround recorded here;
- CI is green (including `python tools/check_contracts.py` in the green gate);
- the golden approval flow **passes twice after reset** (covers DA-09, DA-15);
- the **offline drill** has passed (`pitch/offline-drill.md`, DA-12);
- a **backup demo video** exists (M1-T10, docs/01 L195–229).

**No-go fallback:** present from the backup video + the Round-1 deck; the live app is only used for the parts that pass locally. This is captured in the written demo plan so we are never surprised by Wi-Fi or live-environment issues (docs/05; test-strategy table, docs/00 L665–670).

## 3. Checklist — verbatim requirements

| ID | Requirement (verbatim, docs/00 §14.2) | Task mapping | Pass evidence source |
| --- | --- | --- | --- |
| DA-01 | "Reset works; 'SYNTHETIC DATA' banner visible on every screen" | M2-T12 (docs/02 L221–229) | FR-25 (docs/00 L796) |
| DA-02 | "Command Center: 3 orders, 6/4/2 days late, ₹11,60,000 baseline" | M2-T4 (docs/02 L221–229) | FR-02; SCN-DEMO-001 re-verified numbers |
| DA-03 | "Evaluation shows 7 steps with status and mode; completes (record seconds)" | M3 execution-step display (R-03 fallback: M4 builds the step generator, docs/00 §14.3) | SC-9 timing log (docs/00 L665–670 NF row) |
| DA-04 | "Comparison: P1 ₹3,34,000 / ₹0 / ₹8,26,000 BLOCKED; P2 ₹4,92,000 / ₹50,000 / ₹6,18,000 PASSED; P2 recommended" | M2-T6 | FR-15; S3 spec numbers (docs/02 L90–95) |
| DA-05 | "FND-DEP-SUP-B opens the graph with Chonburi ← Kedah ← Zenith highlighted and a text version" | M2-T8 | FR-16; S4 graph spec (docs/02 L96–103); text fallback = text list |
| DA-06 | "LC finding shows 43T and 47A lines and the remedy 'request amendment'" | M2-T7 | FR-16; S4 MT700-style LC (docs/02 L96–103) |
| DA-07 | "FTA finding (Colombo) shows needs review, ₹3,87,600 at 15 % (TR-0003), TR-0002 superseded, TR-0004 draft, TR-0006 lower authority" | M2-T7 | FR-16; S4 `rule_results` badges (docs/02 L96–103) |
| DA-08 | "Approving P1 shows the server's PLAN_BLOCKED message; nothing changes" | M2-T9 | FR-18; J2 (docs/02 L65–69): disabled button + reason; forced API call still returns `PLAN_BLOCKED` |
| DA-09 | "Priya approves P2; repeating shows 'already decided'; Arjun cannot approve again" | M2-T9 | FR-18; J5 409 `PLAN_VERSION_STALE` / `PLAN_SUPERSEDED` → modal + Reload |
| DA-10 | "Execute → 6 simulated steps, all labelled simulated; second execute refused" | M2-T10 | FR-20 area |
| DA-11 | "Audit list shows refusals and decisions; Verify → valid" | M2-T11 | FR-20 |
| DA-12 | "Network unplugged + LLM off: same numbers and outcomes; badge 'LLM: off (templates)'" | M2-T12 | FR-22; §14.3 risk R-02 (LLM fail → template fallback, `off` mode); offline drill |
| DA-13 | "Whole approval flow by keyboard; focus visible; statuses have icon + text" | M2-T14 + accessibility check | FR-3x; axe scan (docs/02 L221–229) |
| DA-14 | "Every number on slides equals the UI" | M1-T8 (docs/01 L195–229) | FR-25; deck-vs-golden cross-check |
| DA-15 | "Second run after reset gives identical plan hashes" | M2-T? / repeatability | NFR-01 (docs/00 L799); golden approval flow runs twice after reset |

Additional checkpoint tied to D7: SC-4 / SC-7 — the dependency and rule-evidence screens must be legible for the Colombo 15 % and Chonburi→Kedah→Zenith story (docs/02 L203–209 gets its specs from S3/S4).

## 4. How to run each item & pass criteria

Executor: M1, on the seeded reset environment, no builder assistance. Record every row in the §5 template.

- **DA-01** Press Reset from any screen; verify the banner on *every* screen (navigate 8 screens from docs/02 §7 L73). Pass: reset completes; banner present everywhere.
- **DA-02** Open Command Center. Pass: exactly 3 order cards; lateness 6/4/2 days; baseline ₹11,60,000. All three numbers must match the golden generator, not the slide.
- **DA-03** Run evaluation once. Pass: 7 steps rendered, each with a status and a mode (live vs simulated); the run completes. Record wall-clock seconds — SC-9 needs it.
- **DA-04** Open plan comparison (S3). Pass: four big numbers; per-plan totals exactly as quoted above; P1 row shows BLOCKED, P2 PASSED, system recommends P2; the "15 passed · 1 needs review · 2 blocked" strip; OPT-RT-B-CMB → "Chao Phraya (TH) via Colombo"; OPT-INV-BLR → "Bengaluru plant stock".
- **DA-05** Open FND-DEP-SUP-B (S4 graph). Pass: Chonburi ← Kedah ← Zenith highlighted edges; if Cytoscape fails to load, the text-list fallback is present (accepted fallback, docs/02).
- **DA-06** Open the LC finding (MT700-style, S4). Pass: both the 43T and 47A lines visible; remedy readable as "request amendment".
- **DA-07** Open the FTA finding (Colombo). Pass: `needs review`; ₹3,87,600 at 15 % sourced to TR-0003; badges = TR-0002 *Superseded*, TR-0004 *Draft — not in force*, TR-0006 *Lower authority*; "Resolved: official source overrides newsletter" visible.
- **DA-08** **UI first**: Priya's Approve on P1 must be disabled with the reason. Then a prepared forced API call on P1 approval must return the server's `PLAN_BLOCKED` message and change nothing. Pass both.
- **DA-09** Approve P2 as Priya (approval token). Repeat → "already decided". Arjun cannot approve again. If a stale-version path is hit: 409 `PLAN_VERSION_STALE` or `PLAN_SUPERSEDED` → modal with Reload. Pass: idempotent, role-gated.
- **DA-10** Execute P2. Pass: 6 steps, all labelled simulated; a second execute attempt is refused.
- **DA-11** Open the audit list. Pass: refusals (DA-08, DA-10 second) and approvals (DA-09) appear; press Verify → valid.
- **DA-12** Unplug the network and turn LLM off (D8 offline drill, run as its own exercise). Pass: same numbers and outcomes; badge reads `LLM: off (templates)`. See `pitch/offline-drill.md`.
- **DA-13** Complete the whole approval flow using only the keyboard. Pass: focus indicator visible at every step; every status renders icon **+ text** (no icon-only statuses).
- **DA-14** Line up the Round-1 deck numbers with the UI one by one. Pass: every number on slides equals the app (this is why older numbers were replaced with the re-verified SCN-DEMO-001 values).
- **DA-15** Reset and run the golden approval flow a second time. Pass: identical plan hashes; this is also the "passes twice after reset" element of the Go/No-go gate.

## 5. Per-run record template (copy for D7 and D9)

```
Run:          D7  |  Executed by: M1  |  Accountable: M5  |  Date: ______
Environment:  seed = ______  |  LLM mode: on / off  |  URL: ______
--------------------------------------------------------------
| DA  | Result (PASS / FAIL / WORKAROUND) | Evidence (id / note) |
| 01  |                                   |                      |
| ... |                                   |                      |
| 15  |                                   |                      |
--------------------------------------------------------------
Suite timing (SC-9): evaluation ______ s
Failures / workarounds agreed: ____________________________
Go/No-go input:  [ ] Safe to demo   [ ] Workarounds agreed   [ ] Escalated (file: ______)
```

Gray-out rule: any row left empty at the end of the run counts as **FAIL** in the summary, and the failure gets an escalation entry (§6).

## 6. Escalation

- DA failures with no agreed workaround → review-interview escalation per `docs/M5-review-sop.md`.
- Questions that are outside the docs or need a human answer → `docs/M5-open-questions.md` (PITCH-01/02/03, PR1 are currently blocked there).
- Human-input blockers (OD-04 LLM credentials, event logistics, sign-offs) → recorded in the decision sheet; they do not block *this* dry-run being scheduled, only the live LLM portion (falls back to `off` mode per R-02).
- Structural/product changes found during the run go to `docs/decisions/decision-sheet.md`, never into this doc directly.

---

*Prepared by M5 (Part B). Reviewers: M1 (executes), M3/M4 (owners of DA-03 fixtures). Next update after the D7 run.*
