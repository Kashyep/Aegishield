# Plan prompts (v2.1, 30 Oct 2026)

v2.1 moves the enterprise data pipeline from Member 2 to Member 1. The two prompts were renamed accordingly: `m1-sensing-and-early-warning.md` is now `m1-data-sensing-and-early-warning.md`, and `m2-data-pipeline-and-frontend.md` is now `m2-ui-ux-and-frontend.md`. Discard the old copies.

One prompt per team member. Each prompt is self-contained: open your AI coding agent at the repository root, fill the header, and paste everything below the `---` line. Member 5's prompt is for a writing assistant, not a coding agent.

| File | Who | Role |
|---|---|---|
| `m1-data-sensing-and-early-warning.md` | Member 1 | Enterprise data pipeline, predictive sensing & domain strategy |
| `m2-ui-ux-and-frontend.md` | Member 2 | UI/UX and frontend |
| `m3-rag-contracts-and-decisions.md` | Member 3 | Main RAG system, contracts, final decisions |
| `m4-backend-and-engine.md` | Member 4 | Major backend & deterministic check engine |
| `m5-pitch-deck-and-scripts.md` | Member 5 | Final pitch, presentation and scripts (no UI/UX) |
| `team-demo-readiness-audit.md` | Anyone (M3 runs it Sun 17:00 and Tue 15:00) | Audit, scoped fixes, go/no-go evidence |

All prompts point to `docs/00-source-of-truth.md` (v2.1) as the single source of truth. Member numbers follow v2 and do **not** match the retired v1 role documents (`docs/01…05`), which should be deleted or moved to `docs/archive/v1/`.

**Header values everyone uses**

- `MODE: plan-only` — the agent inventories, then writes a plan and a status file; it changes no code.
- `MODE: execute` — the agent builds according to the plan.

Run `plan-only` first on Fri 30 Oct, then switch to `execute`.

**Status files.** Every agent keeps `docs/status/m<N>.md` up to date: inventory, progress against deadlines, test results with exit codes, blockers. Member 3 reads all five before each stand-up.
