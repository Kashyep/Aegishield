# Architecture Decision Record: FB-19 Early Disruption Signal Panel

## Status
Accepted (FB-19 implementation)

## Context
AegisShield preflight simulation previously computed an external signals early-warning index (MOD-21 / contracts 1.1.0) based on external news, port advisories, and weather events around supplier sites.
However, stakeholders required deeper internal node-level risk scoring derived from structural supply chain graph relationships and operational ERP/inventory telemetry (FB-19 per `fiori-spec.md` §F):
1. **Shared Tier-2/Tier-3 Fab Concentration**: Single points of failure where multiple assembly routes converge on the same upstream wafer fab (e.g. `FAC-FABZ` in Kulim).
2. **Lead-Time Drift**: Cumulative schedule deviation (days late / buffer drift) across transit and processing steps.
3. **Inventory Cover Days Below Threshold**: Facility on-hand buffer divided by daily burn rate dropping below the 14-day safety threshold.

## Design Decisions

### 1. Deterministic Heuristic Scoring Model (No Prediction Claim)
- **Invariant**: The score is strictly a deterministic heuristic index (0–100) and **never** a probability, prediction, or machine-learning forecast.
- **Labels**: Explicitly labelled `Heuristic + Simulated`. The UI and API contract explicitly disclaim prediction accuracy:
  > *"Heuristic index, not a probability. Advisory only — never changes plans or automated decisions. Claim no prediction accuracy."*
- **Scoring Breakdown**:
  - **Shared Fab Risk (0–40 pts)**:
    - 40 pts: Active disruption at a shared upstream facility (`FAC-FABZ`).
    - 25 pts: Direct upstream dependence on a single unhedged fab.
    - 15 pts: Indirect downstream reliance (e.g., via Tier-2 die dicing).
    - 0 pts: Independent or dual-sourced fab (`FAC-FABK`).
  - **Lead-Time Drift (0–30 pts)**:
    - $\min(30, \text{drift\_days} \times 2.5)$.
    - For example, +14 days expected delay contributes ~30 pts; +7 days contributes ~17.5 pts.
  - **Inventory Cover Days Below Threshold (0–30 pts)**:
    - Threshold = 14.0 days.
    - If $\text{cover\_days} < 14.0$: $\text{points} = \text{round}((14.0 - \text{cover\_days}) \times \frac{30}{14.0})$.
    - If $\text{cover\_days} \ge 14.0$: 0 pts.
  - **Composite Score**: $\min(100, \text{Fab Risk} + \text{Lead-Time Drift} + \text{Cover Deficit})$.

### 2. Evaluated Graph Nodes & Ground Truth
From `supply_graph.json`, `inventory.json`, and `orders.json`:
- **`FAC-FABZ` (Zenith Kulim Wafer Fab)**:
  - Shared Tier-2/3 fab: Single point of failure supplying SUP-A and SUP-B (via Kedah).
  - Cleanroom flooded (DIS-2026-0042).
  - Cover days: 1.0 day (< 14d threshold).
  - Lead-time drift: +14 days.
  - Score: **95/100 (DISRUPTED / HIGH RISK)**.
- **`FAC-A-PEN` (Penang Module Assembly, SUP-A)**:
  - Upstream 100% reliant on FAC-FABZ.
  - Cover days: 6.0 days (< 14d threshold).
  - Lead-time drift: +7 days on SHP-A-0901.
  - Score: **82/100 (WARNING)**.
- **`FAC-Q-KDH` (Kedah Die Sort & Dicing)**:
  - Shared Tier-2 facility passing Kulim dies to SUP-B.
  - Cover days: 4.0 days (< 14d threshold).
  - Lead-time drift: +5 days.
  - Score: **68/100 (WARNING)**.
- **`FAC-B-CHB` (Chonburi Module Assembly, SUP-B)**:
  - Latent Tier-2 exposure through FAC-Q-KDH.
  - Cover days: 18.0 days (safe buffer).
  - Lead-time drift: +2 days.
  - Score: **45/100 (WATCH)**.
- **`FAC-KAV-BLR` (Kaveri Bengaluru Plant)**:
  - Cover days: 12.0 days (250 on hand vs 400 needed).
  - Lead-time drift: +4 days transit delay.
  - Score: **40/100 (WATCH)**.
- **`FAC-C-BDG` (Binh Duong Module Assembly, SUP-C)**:
  - Independent wafer fab (Kumgang Gumi `FAC-FABK`). Zero Kulim exposure.
  - Cover days: 22.0 days.
  - Lead-time drift: 0 days.
  - Score: **10/100 (HEALTHY / OPERATIONAL)**.

### 3. Integration & UI Architecture
- **Extend, Do Not Duplicate**: Rather than creating a detached screen, the Node Early Warning panel is seamlessly integrated into `frontend/src/components/screens/EarlyWarningsScreen.tsx` directly alongside the external signals view.
- **Fiori Horizon Styling**:
  - Replaced legacy `.neu-*` classes with `.ae-*` standard semantic design tokens and SAP Fiori Horizon theme CSS variables.
  - Semantic accents using CSS variables: `--sapNegativeColor` (Disrupted/Warning), `--sapCriticalColor` (Watch), `--sapPositiveColor` (Operational), `--sapInformativeColor` (Informational context).
  - Background and surface styling: `--sapTile_Background`, `--sapTile_BorderColor`, `--sapNeutralBackground`, `--sapList_AlternatingBackground`, `--sapTextColor`, `--sapContent_LabelColor`.
  - Font '72', sans-serif for UI labels and headings; JetBrains Mono (`var(--font-mono)` / `.mono`) exclusively for node IDs, part IDs, PO numbers, and signal identifiers.
  - Accessible table, badges, and aria labels conforming to WCAG 2.2 AA contrast standards in both light (`sap_horizon`) and dark (`sap_horizon_dark`) themes.

### 4. Non-Plan Invariant
- The node scoring model is strictly descriptive and advisory. It is never imported by or fed into plan generation, cost formulas, or approval hash calculations, guaranteeing zero disruption to golden test vectors or byte-identical plan hashes.

### 5. Verification & Acceptance
- **Disclaimer Assertion**: The banner and panel must both display verbatim:
  > *"Heuristic index, not a probability. Advisory only — never changes plans or automated decisions. Claim no prediction accuracy."*
- **Badge**: Node early disruption signal panel must bear the explicit badge `Heuristic + Simulated` and disclaim prediction accuracy.
- **Linting**: Clean execution of `eslint src/components/screens/EarlyWarningsScreen.tsx` with zero warnings or errors.
- **WCAG AA Compliance**: Axe accessibility checks in Playwright suite (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`) remain zero violations.
