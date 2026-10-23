# M5 Dispatch — Undecided-Item Register (DRAFT: 2026-10-23)

> DRAFT — pending Member 5 confirmation. Nothing here is decided.
> Prepared by the protocol agent on Member 5's behalf, per `docs/decisions/decision-sheet.md`.

## Purpose

Per draft decision **D-044**: the M5 register records items as **"raised"** (not
"approved", not "pending approval") for anything undecided — including **OD-04**.
This document is that register, in one place, so the weekly checkpoint calls
(R1–R4) have a single list to consult.

## Rules honored (from the decision sheet)

- "You prepare, humans decide." The protocol agent records positions; Member 5 decides.
- "Prepared by" is always labelled; anything not in the source list stays NOT FOUND.
- No novelty / performance / score claims (D-019).
- Registration date: **21 Oct 2026** (home page) is the date to cite; the FAQ
  placeholder of 15 Oct 2026 is superseded and both pages currently read
  "Registration is closed." Do **not** cite a date in a deck or email until a human
  confirms one date in writing; the FAQ-discrepancy flag stays raised (D-044).
- Numbers quoted are only re-verified ones: MFN 15% = TR-0003 (from 1 Nov),
  AIFTA 0% = TR-0005, SCN-DEMO-001 exposure ~₹11.6 L.

## Raised items (status: raised)

| ID | Status | Owner | Decision needed |
|----|--------|-------|-----------------|
| OD-01 | raised | Member 1, with M5 note | Provisional default: SAP BTP Cloud Foundry trial (`ops/btp/README.md`, `cf push -f ops/btp/manifest.yml`). `cf login` needs a human BTP trial account. |
| OD-02 | raised | Member 5 | No LangGraph; Phase 0 throwaway spikes only. |
| OD-03 | raised | Member 2 | D-023 correction: repo uses plain CSS (`frontend/src/styles/tokens.css` + `frontend/src/App.css`), not Tailwind/shadcn. UI work stays plain CSS. |
| OD-04 | raised | Member 5 | Live LLM mode needs human credentials by Sun 2026-10-25: `AEGIS_LLM_BASE_URL`, `AEGIS_LLM_MODEL`, `AEGIS_LLM_API_KEY`. If missing, system degrades cleanly to recorded mode (D-024). |
| OD-05 | raised | Member 1 | Phase 0 deadline passed Wed 2026-10-21. Decide whether to keep the pre-start frame (contracts + spikes) for this week. |
| OD-06 | raised | Member 1 (BLOCKED) | Sir MVIT: NOT FOUND on the web. The "24 Oct, 10 min pitch + 5 min Q&A" line is unverified rumour. Need an offline artifact or a human call; never guess. |
| OD-07 | raised | Member 1 | Hand-off record drafts (fictional receipts + claim-check) in `docs/decisions/OD-07-claim-check.md`. Sign-off scope: include r-11 weekend availability; one owner signs every hand-off record at the OD-07 call. |
| OD-08 | raised | Member 5 | Stretch S-1 vault/deal/integration module acceptance, before finale; cut for the base prototype unless time allows; depends on OD-01 + OD-04. |

## Draft positions (D-018 … D-044)

- **D-018…D-025** already drafted previously; D-025 (23 Oct) is DRAFT pending M5.
- **D-042** — Contract-showing menu: every outcome shown with its passing contract
  ID (VC-*) next to it. No new code; reuses the green gate (`tools/check_contracts.py`).
- **D-043** — Weekly PR review: Sunday sweep (per docs/02), checkpoint review notes
  logged within one hour. Owner: all members.
- **D-044** — This register: undecided items are recorded as "raised", never
  "approved" or "pending approval". Includes OD-04.

## Member 5 draft notes (N1–N5)

- **N1** — T+2 sandbox interface: found nowhere in docs; recorded as NEEDS INPUT
  rather than guessed. Owner: NEEDS INPUT.
- **N2** — Before the OD-07 sign-off call: we need an explicit list of issues to
  resolve; this document and `docs/M5-open-questions.md` are that list.
- **N3** — "Run the weekly PR sweep" belongs in the R1–R4 weekly SOP, not just
  the slack notes. Sunday cadence per docs/02.
- **N4** — The first M5 working session should deep-pass the Action Plan
  (`docs/00-source-of-truth.md`) as a seed.
- **N5** — The offline drill is independent of OD-04; no live LLM is needed. Both
  tracks run in parallel.

## What each item needs next

1. **OD-04 (time-critical, Sun 2026-10-25)** — human supplies the three
   `AEGIS_LLM_*` variables; M5 then wires live mode and strips nothing from
   VC-LLM-01 hashes.
2. **OD-01** — human runs `cf login` on a BTP trial account; then
   `cf push -f ops/btp/manifest.yml`.
3. **OD-05 / OD-06 / OD-07 / OD-08** — Member 1 decisions; OD-06 stays
   NOT FOUND until an artifact or human input arrives. OD-05's pre-start
   deadline (Wed 2026-10-21) has passed; keep the pre-start framing and
   verify the date/agenda against D-025 only when the official Sir MVIT
   notice is pasted. OD-07's scope includes r-11, and one owner signs
   every hand-off record. OD-08 stays blocked until OD-01 and OD-04
   close. The registration-date question is resolved for docs: cite
   21 Oct 2026, which matches official page content; no date goes into
   the deck or email until a human confirms in writing.
4. **At R1 (Tue 27 Oct 17:00)** — walk this register; anything still "raised"
  after its deadline is bumped to the next checkpoint with a one-line reason.

## Where this fits

- Reviews and change requests: `docs/05-temporal-rag-ui-review-and-decisions.md` §7.
- Backlog owners: same document, §10 (T1–T12).
- `pitch/AUTHORING-PLAN.md` already mirrors this list for deck writing.
