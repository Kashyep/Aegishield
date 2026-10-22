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

The Playwright tests cover the blocked-P1/P2-approval journey, graph keyboard text alternative, fixture audit honesty, and axe WCAG checks on the tested views.

## Live API mode

Live mode requires a separately running API service implementing the routes and schemas in `../contracts/openapi.yaml`. The current repository includes the contracts and agent modules, but not an HTTP service exposing these routes. Do not enable live mode until that compatible service is available.

When it is available, start the frontend in a PowerShell session with:

```powershell
$env:VITE_API_MODE = 'live'
$env:VITE_API_BASE_URL = 'http://localhost:8000'
npm.cmd run dev
```

Live decision and execution requests carry the contract-required `X-Actor-Id` and `Idempotency-Key` headers. A failed or unavailable request is shown as an error; it is never converted into a success-shaped fixture response.

## Supported data boundaries

- Evaluation and supply graph: recorded fixtures in stub mode; the current graph component does not map the contract `GraphView` response in live mode.
- Approval and execution: documented live endpoints only; no stub mutation response is available.
- Audit events and verification: documented live GET endpoints only; the fixtures contain neither event records nor verification results.
- Rule and evidence panels: use the evaluation payload’s included evidence and `rule_results`; fields absent from that response remain explicitly unavailable.
