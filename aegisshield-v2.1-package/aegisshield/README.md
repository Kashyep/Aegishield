# AegisShield AI — SAP Hackfest Bengaluru 2026 (team ChainGang)

AegisShield AI is a supply-chain recovery preflight. It combines:
- a heuristic early-warning index over external signals
- disruption sensing
- supplier/BOM GraphRAG
- temporal trade-rule retrieval
- deterministic letter-of-credit and FTA checks
- inventory allocation and honest financials
- human approval, simulated execution and a hash-chained audit trail

**All demo data is synthetic.**

## Start here
| You are | Read |
|---|---|
| Everyone | `docs/00-source-of-truth.md` (v2.1, 30 Oct 2026): canonical owners, decisions, formulas, dates and demo numbers |
| Member 1 — data pipeline, sensing & domain strategy | `prompts/m1-data-sensing-and-early-warning.md` |
| Member 2 — UI/UX & frontend | `prompts/m2-ui-ux-and-frontend.md` |
| Member 3 — main RAG, contracts, final decisions | `prompts/m3-rag-contracts-and-decisions.md` |
| Member 4 — major backend & deterministic engine | `prompts/m4-backend-and-engine.md` |
| Member 5 — final pitch, presentation, scripts | `prompts/m5-pitch-deck-and-scripts.md` |
| Audit / go-no-go | `prompts/team-demo-readiness-audit.md` |

The v1 role documents (`docs/01…05`) are retired; their member numbering differs from v2. Delete them or move them to `docs/archive/v1/`.

## Package contents
```
docs/00-source-of-truth.md   single source of truth (v2.1)
prompts/                     five member plan prompts + team audit prompt
contracts/                   10 JSON Schemas, openapi.yaml, contracts 1.1.1, registry README, CHANGELOG
fixtures/demo/               12 plan-input fixtures (unchanged since 1.0.0) + external_signals.json
fixtures/expected/           golden outputs, incl. two early-warning goldens
fixtures/validation/         48 validation cases (45 executable by the oracle, 3 manual)
tools/check_contracts.py     contract checker
tools/aegis_oracle.py        reference oracle (executable specification; not production code)
```

## Verify
```bash
python3 -m pip install "jsonschema>=4.18" pyyaml openapi-spec-validator
python3 tools/check_contracts.py
```
The last line should read `RESULT: PASSED`.
