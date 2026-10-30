# Contracts changelog

Format: `## <version> — <date>` then one bullet per change with owner and reason. SemVer rules in `docs/00-source-of-truth.md` §15.2.

## 1.1.1 — 30 Oct 2026, 20:30 (owner metadata only)
- The enterprise data pipeline moves from Member 2 to **Member 1** (docs/00 D-031):
  - owner of `master-data.schema.json`
  - owner of the eight data fixtures (`orders`, `inventory`, `master_data`, `route_options`, `supplier_quotes`, `sources`, `scenario`, `policies`)
  - handlers for `/scenario` and `/disruptions`
- Only the master-data schema description and the registry changed. No schema rules, fixtures, goldens, validation cases or hashes changed; `input_snapshot_id` and both plan hashes are as in 1.1.0. No backend action needed.

## 1.1.0 — 30 Oct 2026 (additive; owner remap)
- **New:** `contracts/schemas/signals.schema.json`, `fixtures/demo/external_signals.json`, `GET /api/v1/early-warnings`, goldens `early_warnings_pre_notice.json` and `early_warnings_scenario_time.json`, validation cases VC-EWS-01…06 (owner M1, reviewer M3). The early-warning index is a heuristic, not a probability, and it never changes plans.
- **Unchanged on purpose:** all twelve 1.0.0 demo fixture files are byte-identical. `input_snapshot_id` (`sha256:d52c7ecc…d6c0`) and both plan hashes (`sha256:e51b38ab…f6f2`, `sha256:3324f97f…adf0`) are unchanged. `external_signals.json` is not part of the snapshot.
- **Owner metadata** remapped to the v2 team split: schema descriptions, OpenAPI info, registry, the `owner` field of every validation case, and `owner` in the golden evaluation's `steps[]`:
  - disruption_sensing, routing, inventory_rebalancing → member_1
  - supplier_dependency, trade_compliance, plan_assembly → member_4
  - explanation → member_3
  - **Backend action:** update the step → owner map in the orchestrator to match, or the golden comparison fails on `steps[].owner`.
- `fixtures.schema.json`: the `Patch.file` enum adds `external_signals`, and the `ValidationCase.module` enum adds `early_warning`.
- **Known stale labels (left to keep hashes stable):** `letters_of_credit.json` → `extraction.verified_by_role: "member_5"` and the `master_data.json` agreement note refer to v1 numbering. Treat them as historical text; the LC data owner is M3.

## 1.0.0 — 19 Oct 2026
- Initial schemas: common, master-data, disruption, graph, trade-rules, plan, decision, api, fixtures.
- Initial OpenAPI 3.1 for `/api/v1`.
- Synthetic demo scenario `SCN-DEMO-001`, golden outputs, 42 validation cases (39 executable by the reference oracle).
- Decisions reflected:
  - 43T = transhipment, 43P = partial shipments.
  - Transhipment blocks only when UCP 600 20(c) is excluded or the container exception fails.
  - Non-AIFTA transit → needs_review.
  - Arrival dates are not LC inputs.
  - Exposures are kept separate from costs.
