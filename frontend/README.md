# AegisShield AI frontend demo

The existing React + TypeScript + Vite application defaults to fixture mode. Its values come from the recorded evaluation and graph fixtures; the persistent banner marks all demo data as synthetic.

## Run the fixture demo

From the repository root, in PowerShell:

```powershell
Set-Location frontend
npm.cmd install
npm.cmd run dev
```

Open the local URL printed by Vite. Fixture mode is the default unless `VITE_API_MODE=live` is set before starting Vite.

Demo path:

1. In Command Center, compare P1 and P2. P1 remains blocked and its higher net avoided loss is labeled “on paper.”
2. Open P2 approval. Select a simulated identity, review the fixture plan hash and findings, and see any role-specific acknowledgements. Fixture mode has no recorded decision response, so submitting approval is disabled.
3. Review finding evidence. The drawer only shows evidence excerpts and rule results returned in the evaluation fixture. Fields omitted by a result are labeled as not returned rather than filled in.
4. Open Supply graph. Use the graph with a pointer or follow the keyboard-operable text alternative and facility table.
5. Open Audit trail. Fixture mode has no audit events or verification response; evaluation steps are not presented as audit events.

Execution and audit records are displayed only when the API returns them. Fixture mode does not fabricate decisions, executions, events, or chain-verification results.

## Tests and production build

Install the Playwright Chromium browser once:

```powershell
npx.cmd playwright install chromium
```

Then run:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

The Playwright tests cover the blocked-P1/P2-approval journey, the dependency evidence graph (DA-05 path highlighting, SUP-C passed), the LLM badge, the LC amendment entry point, graph keyboard text alternative, fixture audit honesty, and axe WCAG checks on the tested views.

`npm.cmd run test:live` runs the full stack: it starts the backend (`python -m uvicorn backend.app.main:app` on port 8010, fresh SQLite, `AEGIS_LLM_MODE=recorded`) and Vite in live mode on port 4174. It then drives reset → run evaluation → graph → LC amendment → P2 approval → audit verification.

## Live API mode

Live mode uses the backend in `../backend` (`python -m uvicorn backend.app.main:app --port 8000` from the repo root). Its CORS origins come from `AEGIS_CORS_ORIGINS`, defaulting to the Vite dev ports.

Start the frontend against it in a PowerShell session:

```powershell
$env:VITE_API_MODE = 'live'
$env:VITE_API_BASE_URL = 'http://localhost:8000'
npm.cmd run dev
```

Live decision and execution requests carry the contract-required `X-Actor-Id` and `Idempotency-Key` headers. A failed or unavailable request is shown as an error; it is never converted into a success-shaped fixture response.

## Supported data boundaries

- Evaluation: recorded fixture in stub mode; in live mode, the **Reset demo** and **Run evaluation** buttons on the Command Center call `POST /demo/reset` and `POST /evaluations`, then poll.
- Supply graph: the contract `GraphView` (`/evaluations/{id}/graph?focus_supplier_id=`) in live mode. In stub mode, `public/stubs/graph_view_SUP-*.json` are generated from the backend builder by `python frontend/scripts/gen_graph_stubs.py`, and CI fails if they drift.
- LLM badge: `/health` `llm_mode` in live mode, and the evaluation's `llm_mode` in stub mode.
- Deployed build: the Dockerfile builds with `VITE_API_MODE=live` and `VITE_API_BASE_URL=/`, and the backend serves `frontend/dist` at `/` from the same origin.
- Approval and execution: documented live endpoints only; no stub mutation response is available.
- Audit events and verification: documented live GET endpoints only; the fixtures contain neither event records nor verification results.
- Rule and evidence panels: use the evaluation payload’s included evidence and `rule_results`; fields absent from that response remain explicitly unavailable.
