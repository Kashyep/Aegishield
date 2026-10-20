# Contracts changelog

Format: `## <version> — <date>` then one bullet per change with owner and reason. SemVer rules in `docs/00-source-of-truth.md` §15.2.

## 1.0.0 — 19 Oct 2026 (release candidate; freeze on 25 Oct 2026)
- Initial schemas: common, master-data, disruption, graph, trade-rules, plan, decision, api, fixtures (Member 3; graph/disruption Member 4; trade-rules Member 5).
- Initial OpenAPI 3.1 for `/api/v1` (Member 3).
- Synthetic demo scenario `SCN-DEMO-001`, golden outputs, 42 validation cases (39 executable by the reference oracle).
- Decisions reflected: 43T = transhipment, 43P = partial shipments; transhipment blocks only when UCP 600 20(c) is excluded or the container exception fails; non-AIFTA transit → needs_review; arrival dates are not LC inputs; exposures separate from costs.
