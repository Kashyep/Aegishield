# M5 Open Questions — Pre-Read for Weekly Checkpoints (DRAFT: 2026-10-23)

> **Status: DRAFT.** Pending Member 5 confirmation. Nothing here is decided.
> Companion to `docs/M5-dispatch.md` (the full undecided-item register). This file is the
> shorter "what must be resolved before the OD-07 sign-off call" view, intended as the
> explicit pre-read for R1 (Tue 2026-10-27, 17:00) and the recurring checkpoints R2–R4.

## Purpose and framing (N2)

Part B of the milestone is doable without human input; the items below are **not** Part B
issues — they are the issues that a human must resolve. Per the N2 framing, this doc exists
to make those issues explicit before the sign-off call on the M1 hand-off drafts
(`docs/decisions/OD-07-claim-check.md`), so that the call is short and the questions are not
re-discovered on the day.

Rules honored (same as the dispatch doc):
- **You prepare, humans decide.** Each item below states the question, the concrete
  resources that would answer it, and who/on when — never a recommendation.
- Anything whose answer is not currently in a source we control is marked **NOT FOUND**.
- No novelty, performance, or score claims (D-019). Numbers quoted are only re-verified ones.
- Registration date: **21 Oct 2026 (home page)** supersedes the 15 Oct 2026 FAQ
  placeholder. Both pages read "Registration is closed." Until a human confirms one
  date in writing, no hand-off draft may cite a registration date or treat the event
  as future; the FAQ-discrepancy flag stays raised (D-044).

## Question 1 — LLM credentials (OD-04, blocks live mode)

Will the M5 run have a live LLM at the ND/VC stage, or is recorded mode the plan?

- Needs, by **Sun 2026-10-25**: `AEGIS_LLM_BASE_URL`, `AEGIS_LLM_MODEL`, `AEGIS_LLM_API_KEY`.
- If not supplied, the demo degrades to recorded mode (D-024 fallback) — that is acceptable
  degradation, not a blocker to the offline drill, but it changes the pitch narrative.

## Question 2 — Timeline and venue facts (OD-05, OD-06)

The M1 deadline (Wed 2026-10-21) has passed; nothing in our sources recorded what was
decided afterward.

- Whether the pitch event really is "24 Oct, 10 min pitch + 5 min Q&A" at Sir MVIT is an
  **unverified rumour**. Mark NOT FOUND until a human verifies against an authoritative
  calendar or organiser notice.
- The recurring-checkpoint rehearsal schedule (R1 Tue 27 Oct 17:00) proceeds on its own; it
  does not depend on the event date being confirmed (R-rehearsal hint redundant).

## Question 3 — Hand-off sign-off scope (OD-07)

Which of the M1 hand-off drafts get the human sign-off, and who is present at that call to
sign? Until a human confirms, no submission is made on the drafts' behalf and no draft is
sent anywhere. The drafts live at `docs/decisions/OD-07-claim-check.md` and are referenced
also by the PR #8 conversation.
**Scope decision:** the sign-off covers r-11, and one owner signs every hand-off record;
Q3 stays open until that human sign-off is recorded.

## Question 4 — Stretch item S-1 (OD-08) — deferred on purpose

The M5 stretch item depends on the answer to Question 1 (OD-04) and the Berkeley/OD-01
timeline. Do not draft Part B copy for it yet — that is the explicit dependency.
If a human decides before part B closes, a placeholder row can be added here; absent that,
it is NOT FOUND/debt and listed on the Part C blocking list rather than drafted now.

## Question 5 — Registration-deadline claim (kept from the dispatch wording)

Renamed issue, no substantive change from what we emitted in §7 inquiries: the flag fires
when the audit snapshot does **not** match the live portal. Whether the flag wording shifts
("Registration is closed." on both pages, with 15 Oct vs. 21 Oct dates recorded in different
artifacts) is a wording decision for a human, not a gate we can resolve locally.

## Question 6 — Who operates the camera for the backup video?

Shot-list BV-P1 (§9.1, line 108): the shot list assumes someone records the backup video, but no owner or method for that recording has been named in any doc. Does the operator also act as the "viewer stand-in" for SH-0/SH-5 (props in the Priya persona frame, docs/02 §6 S0 lines 76–78), and does the recording operator need sign-off from whoever is named in the shot-list §8 sign-off table (lines 102–103)?

**Who/on-when**: characters/theater lead + recording operator — decide before D8, 2 Nov.

## Question 7 — Are S6/S7 screen specs available for SH-11?

Shot-list BV-P2 (§9.2, line 109): SH-11 currently cites docs/05 §5 J1 for the Execution/Audit screen, but S6–S7 screen specs have not been extracted from docs/02 §6. Is the plan to extract those specs before the D8 capture, or is the J1 citation accepted as a placeholder?

**Who/on-when**: M5 docs lead — confirm extraction before D8, 2 Nov.

## Question 8 — Where is the recorded video parked, and how is it named?

Shot-list BV-P3 (§9.3, line 110): the shot list says the recording is parked under `ops/` but does not name a path or a naming convention. Does OD-15's "owner decides" cover the parking location and file naming here, and is the D9 final-sweep reminder rule the relay point (`ops/` per docs/00 §14.2 DA-12 anchor and OD-15 row)?

**Who/on-when**: OD-15 owner (docs lead shell) — decide before D9 sweep, 3 Nov 18:00, per docs/00 l.655.

## Resolved / non-issues (carried from dispatch for completeness)

- OD-01 (BTP/SAP): resources to check (if needed) are in `ops/btp/README.md` — `cf push -f ops/btp/manifest.yml`; the 15% MFN number is unaffected (TR-0003, effective 1 Nov).
- OD-02: M5 does **not** use LangGraph. Confirmed non-issue.
- OD-03: M2 uses plain CSS on `frontend/src/styles/tokens.css` + `frontend/src/App.css`.
  Confirmed non-issue.
- OD-04 column-preserving? — no: see Question 1.

## Not Questions — do not raise on the call

- Part B deliverables; the pitch drafts PITCH-01/02/03; PR1 research refresh; SOP R1–R4;
  acceptance dry-run; offline drill; backup video shot list; FR2 skeleton — these are
  "you prepare" items, in the todo list, and off this document's scope.
- Anything not in the dispatch register stays where it was found.
