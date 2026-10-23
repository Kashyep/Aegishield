# Decision Sheet — Status Snapshot (od-01 … od-08)

**DRAFT: pending Member 5 confirmation. Nothing here is decided.**
This sheet snapshots each open decision from `docs/00-source-of-truth.md` §14.5, the research
evidence gathered (`docs/decisions/OD-05-06-research.md`), and today's state (2026-10-23).
Member 5 (decision authority) confirms or overrides each row; the protocol agent must never
decide on its behalf.

Legend: DEFAULT = fallback is safe if no human input arrives. NEEDS INPUT = cannot be advanced
without credential, login, or offline artifact. CONFIRMED = the fact is already verified by
research; the *decision* still rests with Member 5.

| ID | Topic | Owner | Decision by | Default (per docs/00 §14.5) | Current state | Status |
|----|-------|-------|-------------|------------------------------|---------------|--------|
| OD-01 | SAP technology for the live SAP alignment (SAP Build/Joule vs BTP CF trial; stack spin-up) | M1 | before finale | BTP CF trial; `ops/btp/` scaffold exists | Deploy steps documented in `ops/btp/README.md` (`cf push -f ops/btp/manifest.yml`) but could not be executed: `cf login` requires a BTP trial account (human). No deploy attempted. | NEEDS INPUT (credential: BTP trial / `cf login`) |
| OD-02 | LangGraph for the planner (pipelined agentic loop) vs plain networkx greedy | M3 | before finale | No — plain deterministic greedy planner | No change. Research did not alter the inputs to this decision; default stands unmodified. | DEFAULT PENDING — Member 3 decides; protocol supports either without new work |
| OD-03 | Tailwind/shadcn/ui templates for the UI | M2 | before finale | Yes (Tailwind/shadcn) **or** M2's preference | **D-023 correction proposal:** repo actually uses plain CSS (see `frontend/src/styles/tokens.css`, `frontend/src/App.css`) — no Tailwind/shadcn dependency is present. Proposed correction: log D-023 as "plain CSS, not Tailwind" pending Member 2 confirmation. UI kit choice (labels/tokens) is deliverable as a small PR either way. | NEEDS DECISION (Member 2) |
| OD-04 | Turn on live LLM mode for the demo (VC-LLM-01: identical plan hashes in off/recorded/live) | M5 (Member 5) | Sun 2026-10-25 | Recorded-only; live mode off | Can't prepare further: live mode requires `AEGIS_LLM_BASE_URL`, `AEGIS_LLM_MODEL`, `AEGIS_LLM_API_KEY` (human-supplied credentials). Recordings are in place; recorded-only default remains in force until creds exist and VC-LLM-01 hash identity is verified live. | NEEDS INPUT (credentials + OD-04 decision) |
| OD-05 | What work (if any) to do before the official 26 Oct–3 Nov build window | M1 | Wed 2026-10-21 (passed — overdue) | Phase 0 pre-start set: contracts + throwaway spikes only | Research confirms Phase 0 constraint is consistent with the NHCE-hosted round's Oct 5–24 regional window and Oct 26–Nov 3 finale build window (`docs/decisions/OD-05-06-research.md` §2.7). No Phase 0 contract-definition or creative work executed here; only research + preparation. | NEEDS DECISION (Member 1 — overdue per original deadline; default Phase 0 already in effect) |
| OD-06 | Sir MVIT regional round date & format | M1 | Tue 2026-10-20 (passed — overdue) | 24 Oct 10 min pitch + 5 min Q&A, as widely rumoured | **NOT FOUND on the web.** Sir MVIT's specific schedule/room/panel/format does not appear anywhere this protocol could reach; the only corroboration for "24 Oct" is that it falls inside the Bengaluru regional window (Oct 5–24) — plausible but unverified. Details may exist only in any offline/unpublished college PDF. Protocol refuses to speculate or assign a date. | NEEDS DECISION (Member 1 — overdue — status remains BLOCKED pending offline artifact or human call) |
| OD-07 | Which primary sources to cite for prototype claims (origin story, template, dates, etc.) | M1 | Fri 2026-10-23 (today) | Vague/cautious wording until confirmed | Primary sources were fetched live and are listed in `docs/00-source-of-truth.md` §16. OD-07 claim check produced separately at `docs/decisions/OD-07-claim-check.md` per explicit todo. | NEEDS DECISION (Member 1 — check and proposed wording delivered today; call is human) |
| OD-08 | Stretch S-1: vault/deal/integration module acceptance (beyond base scope) | M5 (Member 5) | before finale | Cut for base prototype; only if time allows | No work started. Dependencies: OD-01 (SAP stack) and OD-04 (live LLM) execution readiness. | NEEDS DECISION (Member 5) |

## Cross-cutting flag: registration deadline

Sponsor-side registration deadlines conflict across the sponsor's own pages:
FAQ says registration closed after **15 Oct 2026**; home page says **21 Oct 2026**.
Both pages currently read "Registration is closed." as of 2026-10-23.
Use **15 Oct** as the conservative assumption for any date-stamped narrative; do not
unilaterally pick 21 Oct. **Needs human decision** before any deck or email cites a date.

## D-023 correction proposal (carry-over)

Sponsor template correction surfaced during UI kit research: the project uses
**plain CSS** (not Tailwind). Captured here so it lands cleanly in the decision log as a
DRAFT row; nothing is signed.

## Rules honored

- "You prepare, humans decide" — every row remains DRAFT; no OD is decided, signed, or marked approved.
- No novelty/performance/score claims (per D-019).
- Records only what was actively checked; NOT FOUND is recorded as NOT FOUND, never guessed.
