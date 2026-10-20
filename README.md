# AegisShield AI — SAP Hackfest Bengaluru 2026 team package

Supply-chain recovery preflight: supplier/BOM GraphRAG, temporal trade-rule retrieval, deterministic letter-of-credit and FTA checks, inventory allocation, honest financials, human approval, simulated execution and a hash-chained audit trail.

**All demo data is synthetic.** Companies, prices, penalties, tariff rates, schedules, the letter of credit and outcomes are fictional.

## Start here
| You are | Read |
|---|---|
| Everyone | `docs/00-source-of-truth.md` (canonical shared decisions, contracts summary, formulas, plan) |
| Member 1 — research and pitch | `docs/01-research-and-deck.md` |
| Member 2 — UI/UX and frontend | `docs/02-ui-ux-and-frontend.md` |
| Member 3 — backend | `docs/03-backend.md` |
| Member 4 — GraphRAG, sensing, routing | `docs/04-graphrag.md` |
| Member 5 — temporal RAG, UI review, decisions | `docs/05-temporal-rag-ui-review-and-decisions.md` |

## Repository contents (this package)
```
docs/                      six documents
contracts/                 JSON Schemas (9 files), openapi.yaml, registry README, CHANGELOG
fixtures/demo/             12 synthetic input files for scenario SCN-DEMO-001
fixtures/expected/         golden outputs (evaluation, assessment, dependency, graph view, rules, approval flow)
fixtures/validation/       42 validation cases (39 executable by the oracle, 3 manual)
tools/check_contracts.py   contract checker (schemas, integrity, goldens, hand-calculated figures, cases, OpenAPI)
tools/aegis_oracle.py      reference oracle (executable specification; not production code)
```
`backend/`, `frontend/`, `pitch/` and `ops/` are created by their owners during the build (layouts in each role document).

## Verify the package
```bash
python3 -m pip install "jsonschema>=4.18" pyyaml openapi-spec-validator
python3 tools/check_contracts.py
```
Expected last line: `RESULT: PASSED`.
