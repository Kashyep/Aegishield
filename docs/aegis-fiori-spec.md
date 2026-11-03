# AegisShield — Fiori Horizon + stakeholder feedback spec (authoritative, from the user)

Stack: React 19 + Vite + TS, @ui5/webcomponents(+fiori, icons) ^2.28.1, FastAPI backend.
G1 Replace the neomorphic UI with genuine SAP Fiori Horizon (@ui5/webcomponents v2).
G2 Fix every UX/feature issue in section F.
Keep backend API contracts, state transitions, openapi.yaml, plan hashes and the Playwright/pytest suites green.

## SECTION D — DESIGN SYSTEM
D1 Theme: main.tsx imports @ui5/webcomponents/dist/Assets.js and @ui5/webcomponents-fiori/dist/Assets.js. setTheme("sap_horizon") is the default; a ShellBar toggle switches to sap_horizon_dark. Persist the choice in localStorage.
D2 Rewrite tokens.css and neomorphism.css (rename it to fiori.css and update its imports): remove the sage/cream colours, Alegreya SC, Overpass and Shanti, all --shadow-neu-*, and the scale(0.995) press effect. Font '72', sans-serif; 'JetBrains Mono' ONLY for PO/LC/rule/node IDs and hashes. Card: var(--sapTile_Background), 1px var(--sapTile_BorderColor), radius .5rem, var(--sapContent_Shadow0). Semantic 4px left accents use --sapNegativeColor / --sapPositiveColor / --sapCriticalColor / --sapInformativeColor (no hard-coded hex).
D3 Shell: Topbar → ui5-shellbar (primary "AegisShield AI", secondary "Supply-Chain Recovery Preflight"). Scenario switcher → ui5-select; role switcher → ui5-segmented-button (Supply Chain Manager / Trade Compliance Officer); search → ui5-input show-clear-icon. Sidebar → ui5-navigation-layout + ui5-side-navigation with ui5 icons. Sidebar header: REPLACE the logo with a user-profile block (ui5-avatar, name, role); keep the logo in the ShellBar.
D4 Primitives: NeuCard → ui5-card + ui5-card-header; NeuButton → ui5-button (design passed through); NeuChip → ui5-tag; NeuInput → ui5-input. Keep component file names and props so call sites compile, or update every call site in the same commit.
D5 Overlays: Modal → ui5-dialog with a ui5-bar footer (ui5-date-picker for the 44C shipment date). Drawers → ui5-flexible-column-layout or a side column that does not cover the workspace.
D6 Data: decision matrix → ui5-table with currency right-aligned and tabular-nums. Audit → ui5-timeline plus a ui5-table ledger (seq, timestamp, actor, prev_hash, hash). "Verify chain" → ui5-toast.
D7 Execution: SimulationPlayer → 4-step ui5-wizard or process-flow (MT707 AMEND-2026-0019 → MM PO re-issue → TM consignment + AIFTA Form AI → SD ATP reallocation).
D8 Typography: section/screen headings (e.g. "Workspace", "Execution", "Plan", "Decision", "Started") use ui5-title level H3/H4, bold. Labels vs values visibly different (label = --sapContent_LabelColor regular; value = semibold).
D9 JSX.IntrinsicElements typings for every ui5-* tag used.

## SECTION F — FEEDBACK FIXES (each its own commit tagged FB-xx)
FB-01 After a demo reset, Plan Comparison must NOT open with plans already marked passed/blocked. Opening it lands the user in an analysis workspace: alternate supply chains with feasibility, profitability and loss vs the ₹11,60,000 baseline. A plan's verdict appears only after the user runs or inspects it. No detour back to the Command Center.
FB-02 Findings: show by default only the findings most relevant to the active scenario, ranked by relevance, with a "Show more" expander for the rest.
FB-03 Priority colour coding: green = highly recommended (MAX 2), yellow/critical = other alternates. ui5-tag plus a left accent.
FB-04 Each alternate plan gets a 60–80 word justification (why it helps, what could go wrong), generated from plan data or a fixture; unit test enforces the word count.
FB-05 BUG: "Request LC amendment" on blocked plans does nothing. Find root cause (handler, API call, role guard) before fixing; add a test.
FB-06 "Review evidence" opens a ui5-dialog with all evidence instead of page scrolling.
FB-07 Colour-code validation status (Positive/Negative/Critical).
FB-08 Section order: Validation status → Financial status → Check results.
FB-09 "Step results": find what it shows. If it duplicates check results or has no clear purpose, remove it and note why in CHANGELOG; if it has a purpose, rename it clearly and add a one-line description.
FB-10 Evaluation overview → "View evaluation": each section gets a tick that turns green once viewed (IntersectionObserver), with progress shown. Client-side only.
FB-11 "Approve plan" → ui5-button design="Positive"; secondary actions use complementary designs.
FB-12 Simulated execution: redesign around the wizard/process-flow (D7) with status icons, timings and a summary card. "Workspace" and "Execution / Plan / Decision / Started" bold per D8.
FB-13 Supply graph: "Workspace" bold; "Explain candidates" choices larger (comfortable density, larger tap targets).
FB-14 Proposed-candidate dotted lines must NOT be drawn on the disrupted supply-chain view; only in the candidate/P2 view.
FB-15 "Facility records in this graph fixture" directly below the graph, then alternative supply links. Graph/flowchart stays the primary view. Remove the text-only alternative-links list; keep an accessible equivalent (sr-only or collapsed "Text version" expander) — no a11y regression.
FB-16 Graph styling: tier swimlanes, rounded node cards with status bar and mono ID, dashed animated edges with callout pills, filter toolbar (All / P1 / P2). Clicking a node opens a ui5-popover.
FB-17 Audit trail: "Filter by subject ID" control larger and readable; "Simulated identity" on the same row; row larger and visually prominent.
FB-18 New "Supply Network" home screen = default route on open: flowchart of existing supply chains with inventory on hand, stock in transit, movement over time and node status. Fixture/endpoint with synthetic data, labelled "Simulated"; any new endpoint goes in openapi.yaml.
FB-19 Early disruption signal: "Early warning" panel scoring nodes from existing RAG/graph data (shared Tier-2 fab, lead-time drift, inventory cover days below threshold) with reasons. Label heuristic + simulated; claim no prediction accuracy. Design in docs/decisions.

## CONSTRAINTS
- Smallest correct change per item. No new dependencies beyond the @ui5 packages already present unless genuinely needed (justify).
- Keep disclosure text: Zenith is fictional; figures are synthetic; SAP integration is proposed only.
- Do not deploy. Do not touch credentials. Never print secrets.

## VERIFICATION (real output + exit codes)
tsc -b, lint, build, npm test, npm run test:live, backend pytest, tools/check_contracts.py; e2e golden plan hashes unchanged. grep shows no --shadow-neu, .neu- or Alegreya/Overpass/Shanti left. Screenshots of every screen in both themes; WCAG AA contrast checked. Tests for FB-01, 04, 05, 08, 10, 14.

## DELIVERABLE
Commits per FB/D item, push feat/fiori-horizon, open PR (do NOT merge). Report: what changed per item, git diff --stat, commands + output, what was not verified, residual risks.
