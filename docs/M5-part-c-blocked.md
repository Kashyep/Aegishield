# M5 Part C — BLOCKED items (human input required)

**DRAFT — pending Member 5 confirmation. Nothing here is decided.**

Part C companion to `docs/M5-dispatch.md` (Part A, open: 2026-10-23) and `docs/M5-open-questions.md` (Part B, pre-read for R1 on Tue 2026-10-27). This file lists **only the items that cannot move without a human decision or a secret** — the work an agent must stop and ask for. Everything optional, disputed, or previously proven-not-found stays out.

## Rules honored

These rules carry over verbatim from the M5 dispatch and decision sheet; nothing in this list may break them.

1. **You prepare, humans decide.** Agent prep work stops where a person's click, credential, or word is needed. No item below is "done" by an agent under any posture.
2. **Verification-first.** Only re-verified numbers are quoted (SC-9 / SCN-DEMO-001 exposure ~₹11.6 L is verified; D-019 forbids any novelty, performance, or score claim). Unverified statements stay NOT FOUND.
3. **Register rows stay "raised".** Per D-044, anything still undecided — including financial arrangements like OD-04 — is recorded as "raised", never "approved" or "pending approval", in every doc, deck, or sign-off that shows it.
4. **No new scope without a B-note.** Fragment-lifecycle (memory anchors, modularization) rides in fetch-pass B-notes only; this list does not create it.
5. **Shots-list discipline.** The capture rules below already exist in `pitch/backup-video-shot-list.md` §7–§9 and are repeated only as pointers: "Explanation only — decisions come from the checks above" (docs/02 §6 S4); "on paper" qualifier on any undecided callout; SYNTHETIC DATA bannering; never hand-write API types or numbers on screen (docs/02 l.50–58); Mute narration is deprecated, not removed.

## The blocked list

Each item names what a human must supply, why the agent is stuck, and where the missing input will show up once provided. Owners and deadlines follow the open-questions register.

### T+2 by **Sun 2026-10-25** (hard deadline — else demo degrades)

- [ ] **OD-04 — LLM credentials** (owner: Member 5; raised per D-044). Need three `AEGIS_LLM_*` values: `AEGIS_LLM_BASE_URL`, `AEGIS_LLM_MODEL`, `AEGIS_LLM_API_KEY`. **Why stuck:** live matching cannot start; agent cannot mint credentials. **Where it shows up:** Phase 0 core live mode; `docs/M5-dispatch.md` OD-04 row moves raised → decided; Q1 in `docs/M5-open-questions.md` closes. **If not supplied:** demo deliberately degrades to recorded mode per D-024 fallback — acceptable, and nothing is stripped from VC-LLM-01 hashes.

### Right after SUN 2026-10-25 (D3)

- [ ] **OD-05 / OD-06 — event logistics confirmation** (owner: Member 5 / org; NOT FOUND to date). "24 Oct, 10 min pitch + 5 min Q&A" at Sir MVIT is an unverified claim; per D-025 it stays NOT FOUND until a human confirms date, venue, slot order, and timing from the official notice. Agent work legally timeboxed; organizer response pending. **Where it shows up:** deck cover slide; demo-time cut re-check; `docs/M5-dispatch.md` OD-05/OD-06 rows.

### Before R1 **Tue 2026-10-27 17:00**

- [ ] **OD-07 — sign-off scope** (owner: Member 5; drafts ready, decision pending). Need a yes/no on: scope of r-11 weekend-availability statement in the prepared-by line; scope of OD-05 pre-start frame keep/drop (decision deadline passed Wed 2026-10-21 — treat as keep unless told otherwise); who provides the T+2 sandbox interface (N1 in `docs/M5-open-questions.md`: NEEDS INPUT). **Why stuck:** drafts cite `docs/decisions/OD-07-claim-check.md`; only a human can pick the scope. **Where it shows up:** dispatch OD-07 row; open-questions Q5/Q6/Q7.

### Before D8 **Mon 2026-11-02** (deck numbers lock)

- [ ] **Registration-date choice: 15 vs 21 Oct** (owner: Member 5; raised). Wall pages show "Registration is closed"; FAQ closure "15 Oct 2026" was introduced by the agent only as a conservative placeholder and is NOT FOUND as an official date. **Decision:** docs may cite 21 Oct 2026, matching official page content; no date is placed in the deck, email, or the BV-P2 attestation until a human confirms in writing (still D-025). The flag stays **raised**. **Where it shows up:** deck cover, Q&A prep sheet.
- [ ] **OD-08 — stretch S-1 (arbitrary decision-language brands)** (owner: Member 1; raised, depends on OD-01 + OD-04). Blocked upstream: S-1 is useful only after the BTP trial account is up (OD-01) and LLM creds land (OD-04). No action until both close. **Where it shows up:** dispatch OD-08 row; nothing else owns it.

### Capture-prep items (D8/D9 window)

- [x] **OD-01 — BTP trial account** (owner: Member 1; DEPLOYED & VERIFIED). Deployed to SAP BTP Cloud Foundry trial: `https://aegisshield-demo.cfapps.ap21.hana.ondemand.com`. Health check (`/api/v1/health`) and demo reset (`/api/v1/demo/reset`) verified live.
- [ ] **BV-P1 — recording operator + Priya stand-in** (owner: to confirm). `pitch/backup-video-shot-list.md` §9 declares a named probe for who operates the recording and who stands in for the Priya persona in SH-0/SH-5. **Why stuck:** naming a person is a human choice. **Where it shows up:** shot-list §8 sign-off "prepared by" line stays "Claude (M5 dispatch) 2026-10-23 (D2)" until then.
- [ ] **BV-P2 — SH-11 J1 citation confirmation** (owner: to confirm). SH-11 cites §5 J1 because the §6 S6/S7 (Execution/Audit) specs were not extracted from docs/02 §6 during initial review. A human should confirm this is acceptable before the final D8 capture, or request extraction. **Where it shows up:** shot-list §6 SH-11; docs/02 §6.
- [ ] **BV-P3 — `ops/` parking owner** (owner: to confirm). Per docs/00 §14.2 DA-12 anchor and OD-15 naming convention tied to the D9 final sweep, a human decides where path-based artifacts park and under what naming. **Why stuck:** path convention is a repo-owner decision. **Where it shows up:** OD-15 row; D9 final-sweep checklist.

## What does NOT belong here

- OD-02 (no LangGraph) and OD-03 (plain CSS) are already decided by the agent per D-023 — they appear in the dispatch register only, not here.
- OD-05 pre-start frame keep/drop already has a default (keep); it appears above under OD-07 only because sign-off mentions it.
- Anything NOT FOUND (e.g. the "24 Oct" claim, official registration date) is tracked in `docs/M5-open-questions.md` as a search result, not a human request.

## Prepared by

Draft prepared by Claude (M5 dispatch), 2026-10-23 (D2). Human input closes each checkbox; untracked rows return to `docs/M5-open-questions.md`.

**AIGIS-G115** — M5 Part C BLOCKED list.
