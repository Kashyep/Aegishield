# M5 — Backup Demo Video (M1-T10, DA-13)

| Field | Value (with citations) |
|---|---|
| Doc | M1-T10 — Backup demo video (docs/01, l.193–204: "Backup demo video \| P0 \| 3-min screen recording of a clean run, captured D8") |
| Accountable owner | M5 review loop (per docs/00 §14.3; named owner in decision-sheet if added) |
| Executor | Recording operator + "viewer stand-in" reviewer (Priya persona per docs/02 §6 S0, l.76–78) |
| Runs | D8 capture (Mon 2 Nov; docs/00 l.629, l.652) during the full dress-rehearsal run (offline-drill.md §3); D9 re-capture slot for redo/corruption (docs/00 l.665–670) |
| Source of truth | docs/02 §5 J1 (l.65) and §6 screens S0–S5 (l.73–112); rules SCN/DA/NFR/modality per docs/00 §14.2–14.3; no invented numbers (see §7) |
| Outputs fed | DA-14 deck fidelity screen (B2.1, docs/00 §14.2); D9 final sweep; M5 review sign-off; offline-drill.md §6 failure playbook ("use backup video" path) |
| Status | DRAFT — grounded against docs/00/01/02/05 as of 2026-10-23 (D2) |

---

Claim-citation rule (per `pitch/AUTHORING-PLAN.md` §4): every claim names file + line/section. Nothing here invents numbers or behavior.

## 1. Purpose (share enough)

M1-T10 (docs/01, l.193–204) requires a **3-min screen recording of a clean run, captured D8**. This doc is the shot list so the recording is:

1. **Replayable** — one operator can execute it with a stopwatch, no judgment calls mid-take (SCN-6 per docs/00 §14.2).
2. **Honest** — it shows the same fenced-demo experience as the live run: persistent SYNTHETIC DATA banner, LLM badge state, actor switcher (docs/02 §6 S0, l.76–78).
3. **Triggered by the drill's failure path** — the offline drill (offline-drill.md §6) ends in the backend-offline error screen (docs/02, l.130) whose "use backup video" fallback **is this recording**. The video must start from the same place users land so the fallback is seamless.

## 2. What the video must show — minute-by-minute (3-min script per M1-T10)

Runtime envelope: ≤ 3:00 of screen recording, no cuts to real data, no narration claiming novelty/performance (D-019; §7 here). "Run again" flow uses Reset demo confirm (S0, docs/02 l.76–78) so the take stays a single config.

| # | Time | Screen / state | Person | Action | Evidence anchor |
|---|---|---|---|---|---|
| SH-0 | 0:00–0:08 | Dashboard landing (S0 global frame) | Priya (switcher set on camera) | Show LLM badge ("recorded" green or amber-degraded), actor switcher "Simulated identity", persistent SYNTHETIC DATA banner (never dismissed). | docs/02 §6 S0, l.76–78 |
| SH-1 | 0:08–0:20 | S1 Command Center | Priya | Select the disruption card (title, received time, channel, severity pill, raw notice quote) and the affected-orders table incl. baseline-penalty column and totals row **₹11,60,000**. Never touch numbers. | docs/02 §6 S1, l.80–83; docs/00 SCN §14.2 (₹ figures only as recalled, no re-typing) |
| SH-2 | 0:20–0:30 | S1 | Priya | Click "Run recovery evaluation". Show confirmed evaluation id (e.g. EVAL-0001) lands in URL / header before agents start. | docs/02 §6 S1→S2, l.85–87 |
| SH-3 | 0:30–0:50 | S2 Evaluation progress timeline | Priya (hands off) | Watch the 7-step timeline (Disruption sensing → Explanation) auto-advance; call out one attempt > 1 if ladder contains it; do not click anything. Show mode chip (`recorded` not `live`). | docs/02 §6 S2, l.85–87; ladder per fixtures/expected/evaluation_EVAL-0001.json |
| SH-4 | 0:50–1:15 | S3 Plan Comparison — the "money shot" | Priya | Two cards P1 then P2 with four big numbers (Recovery cost / Residual loss / Net avoided loss / Worst-case exposure); check counts ("15 passed · 1 needs review · 2 blocked"); blocked card's "on paper" qualifier and banner "Cannot be approved: 2 blocking findings"; callout "P1 looks ₹2,08,000 better on paper". | docs/02 §6 S3, l.89–95 |
| SH-5 | 1:15–1:30 | S3 option_id mapping + allocation table | Priya | Show OPT-RT-B-CMB → "Chao Phraya (TH) via Colombo", OPT-INV-BLR → "Bengaluru plant stock", allocation rows (Order / Source / Units / Arrives / Days late). | docs/02 §6 S3, l.89–95 |
| SH-6 | 1:30–1:55 | S3 → S4 evidence drawer, **Graph** tab | Priya | Click "Why?" on P1 (blocked). Drawer opens with Cytoscape focused on supplier (blocking path highlighted); show text alternative list for a11y. Show deterministic "Why" sentence from finding `title`+`details`. | docs/02 §6 S4, l.96–106; l.50–58 `GET /api/v1/evaluations/{id}/graph?focus_supplier_id=` |
| SH-7 | 1:55–2:15 | S4 drawer — **Letter of credit** tab | Priya | Show LC id/version, MT700-style monospace lines; highlight the cited tags (43T transhipment NOT ALLOWED + 47A UCP 600 sub-article 20(c) excluded, per finding FND-LC-TRANSHIPMENT-RT-C-SIN). | docs/02 §6 S4, l.96–106; SAN-02 per docs/00 §14.2 |
| SH-8 | 2:15–2:30 | S4 drawer — **Rules** tab | Priya | Show the conflict line including "Resolved: official source overrides newsletter" — one of the strongest reviewer moments on camera. | docs/02 §6 S4, l.96–106 |
| SH-9 | 2:30–2:50 | S4 drawer — **Record** tab + "AI explanation" section (if present) | Priya | Show Record key/value view (source title) and — if explanation exists — the mode badge + validation status + always labelled "Explanation only — decisions come from the checks above". | docs/02 §6 S4, l.96–106 (Shared labels, l.107–112) |
| SH-10 | 2:50–2:58 | S5 Approval modal | Priya (Arjun cameo via switcher optional) | Show plan label, version short hash (first 12 hex chars), four numbers, outcome pill, `needs_review` acknowledgement rows (checkbox, required note, role that may acknowledge), Reject-required/Approve-optional justification, buttons Approve (disabled for blocked plan, reason shown) / Reject / Request LC amendment (Arjun only). Click Approve success. | docs/02 §6 S5, l.107–112 |
| SH-11 | 2:58–3:00 | Execution / Audit | Priya | High-level J1-final steps only (J4): show the plan lands in Execution and the audit verify call reflects the decision; no deep screen-spec claims here (S6–S7 not yet extracted from docs/02 §6 — verify against §6 before capture, pending). | docs/02 §5 J1, l.65 (and §5 J2–J5 l.66–69) |

**Runtime math:** 3:00 exactly per M1-T10; keep 5 s of headroom so an accidental frame can be trimmed without dropping a shot.

## 3. Pre-capture checklist (do before D8, in rehearsal run)

| # | Check | Evidence / source |
|---|---|---|
| PV-1 | Fixtures present: `fixtures/expected/evaluation_EVAL-0001.json`, `graph_view_SUP-B.json` under `public/stubs/`; stub mode `VITE_API_MODE=stub` if backend unavailable | docs/02, l.50–58 |
| PV-2 | LLM mode intended (recorded on, off, live) decided and matches the config shown in SH-0; any degraded state is amber *on camera*, not edited out | docs/02 §6 S0, l.76–78 |
| PV-3 | Numbers seen on screen match docs/00 §14.2 (₹ figures per S1/S3). Any drift → re-run evaluation, never a retake with edited numbers | docs/02 §6 S1–S3, l.80–95 |
| PV-4 | Captured resolution ≥ 1280 px wide; projector target 1920×1080 or the laptop fallback — no scrolling-jagged zoom | docs/02 §6 layout target, l.73–74 |
| PV-5 | Handled uninstall-then-reinstall if a previous demo run left stale data; or used Reset demo confirm dialog to return to fixture state | docs/02 §6 S0, l.76–78 |
| PV-6 | Screen recording tool configured, mic off (silent recording), mouse cursor visible | — (operator setup, no rule) |
| PV-7 | Shared labels audit — "Explanation only", "on paper", "Cannot be approved" banners present in the take as-is | docs/02 §6 S3–S4, l.89–112 |

## 4. Capture process (one take, then stop)

1. Load the app in the state described by SH-0 (per PV-5).
2. Enable the screen recorder on the entire viewport; start with a 3 s lead so SH-0's first second is not cut.
3. Execute SH-0 → SH-11 in order (one continuous take, no switching config).
4. At 3:00, stop recording. Do not re-record unless "clean run" criteria fail (see §5).
5. Save to `ops/` (path agreed with OD-15 owner, decision-sheet) alongside the DA-12 offline bundle.3.

## 5. Clean-run criteria & re-take policy

"Clean run" is satisfied when, in one take:

- No uncaught error state from backend neo4j/failure (backend-offline error per docs/02, l.130) appears mid-take.
- Numbers and check counts do not change between SH-1 and SH-10 (same evaluation id end-to-end).
- The persistent SYNTHETIC DATA banner is visible in every frame (S0, docs/02 l.76–78).
- LLM badge state matches PV-2 exactly (no score drift, no silent "live" swap).
- No manual typing of numbers; only navigation and clicks.

If any criterion fails → re-run Reset demo (PV-5) and take a fresh take during the **same D8 slot**; if D8 runs out of time, D9 (final sweep, docs/00 l.665–670) is the re-capture slot. This mirrors the offline drill's D8→D9 ladder.

## 6. Failure playbook (when the video itself is the fallback)

| Symptom | Action |
|---|---|
| (This doc triggered) backend offline | If the offline drill's NA-1 path (offline-drill.md §6) fires and shows "Backend not reachable at localhost:8000" + Retry + "use backup video" (docs/02, l.130), open the recording in full-screen and play SH-1 through SH-11. Do not narrate over it; pause at each determinant shot for questions. |
| Video file missing / corrupt on D8 | Run the drill's D9 re-capture (docs/00 l.665–670). The drill log (`offline-drill.md` §5 OD-F1) records the gap; this doc records the retry in §8. |
| Numbers shown differ from `fixtures/expected` | Halt recording; restart with Reset demo confirm; if drift persists, wait for backend neo4j owner (OD register) before re-recording, per "You prepare, humans decide". |
| A viewer asks about freshness during M5 review | Answer from the offline-drill "stale fixture" ground anchor (`fixtures/expected`) and from this doc's SH anchors, not from the recording's playback speed. |

## 7. Labels we must keep on camera (fairness)

- **"Explanation only — decisions come from the checks above"** whenever explanations are visible (docs/02 §6 S4 l.96–112). Never crop this label out.
- **"on paper"** qualifier on the blocked-plan callout (S3, docs/02 l.89–95). Never crop.
- **Persistent SYNTHETIC DATA banner** every frame (S0, docs/02 l.76–78).
- **Never hand-write API types / numbers on screen**; operators navigate, they do not annotate (docs/02, l.50–58).
- **No novelty, performance, or score claims** (D-019). Narration deprecated by Mute; mouse cursor movement is the only "speaker". SH-7's LC panel and SH-8's "Resolved: official source overrides newsletter" are shown, not interpreted aloud.

## 8. Sign-off

| Role | Name | Date | Signature |
|---|---|---|---|
| Prepared by (M5 member 5) | Claude (M5 dispatch) | 2026-10-23 (D2) | draft — pending review |
| Camera / recording operator | (pending) | — | — |
| Reviewer (Priya persona) | (pending) | — | — |
| Accepted (M5 loop) | (pending — sign-off per docs/00 §14.3) | — | — |

---

## 9. Pending clarifications for the accountable owner (carried to docs/M5-open-questions.md)

1. **BV-P1.** Who is the named probe for the recording operator role, and does the operator also act as the "viewer stand-in" (Priya persona) in SH-0/SH-5? See decision-sheet.
2. **BV-P2.** SH-11 currently cites §5 J1 because S6–S7 screen specs (Execution / Audit) have not been extracted from docs/02 §6; the owner to confirm whether the extracted §6 S6/S7 details exist before final D8 capture.
3. **BV-P3.** Where the recording is parked under `ops/` (docs/00 §14.2 DA-12 anchor) and how it is named — confirm OD-15 naming convention tied to the reminder rule (D9 final sweep).

---

AIGIS-115 — end of drafted doc; prepare/acquisition notes (human decisions pending).
