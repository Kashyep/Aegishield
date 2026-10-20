# Member 4 — Supplier/BOM GraphRAG, Disruption Sensing and Routing

| | |
|---|---|
| Role | RAG system developer (graph) |
| You own (accountable) | MOD-05 Supplier Dependency Agent (GraphRAG) · MOD-04 Disruption Sensing Agent · MOD-06 Routing Agent |
| You review | MOD-02 API & persistence, MOD-07 Temporal Rule Service, MOD-09 Inventory, MOD-12 LLM Gateway, MOD-14 Graph UI (data correctness) |
| Your reviewers | Member 5 (MOD-05), Member 3 (MOD-04, MOD-06) |
| Canonical facts | `docs/00` §8, §9.5, §10.1, §12; `contracts/schemas/graph.schema.json`, `disruption.schema.json` |

---

## 1. The project in brief
A recovery plan that switches to an "alternate" supplier is only safe if that supplier does not depend on the same broken factory. Your GraphRAG proves or refutes that, path by path, with provenance on every edge, and hands the UI and the LLM only what was proven. You also own the first agent in the pipeline (turning a supplier notice into graph nodes and affected orders) and the small routing agent. Deterministic graph code decides; the LLM only explains your paths and may cite only your ids. All data is synthetic.

**Glossary:** *SUPPLIES edge* = provider facility → consumer facility for one part; *upstream* = towards raw materials (follow incoming edges); *BOM closure* = a part plus all its sub-parts; *origin node* = a facility that produces a part from raw inputs (path may legitimately end there); *coverage gap* = a critical input with no known source; *linearised context* = deterministic text form of paths for the LLM; *GraphView* = the frontend's Cytoscape payload.

---

## 2. Mission and boundaries
**Mission.** Never call a supplier independent without proof. Make the shared-dependency finding visible in one highlighted path and one sentence.

**Yours:** graph ingestion and validation, traversal, coverage, cycle and truncation handling, evidence paths, linearisation, dependency explanations (through Member 5's gateway), GraphView builder, disruption extraction and impact, route eligibility, graph evaluation harness.

**Not yours:** LC/FTA outcomes and money (Member 3), rule applicability and the LLM gateway itself (Member 5), drawing the graph (Member 2). Do not compute penalties outside the sensing agent's baseline (formula in `docs/00` §10.7) and never decide plan outcomes.

---

## 3. Deliverables and locations
| ID | Deliverable | Location | Due |
|---|---|---|---|
| M4-D1 | Graph loader + validator | `backend/app/agents/dependency/graph.py` | D1 |
| M4-D2 | `check_dependency` (traversal, coverage, outcomes, notes, evidence) | `backend/app/agents/dependency/check.py` | D2 |
| M4-D3 | `linearize` + `build_graph_view` | `backend/app/agents/dependency/{linearize,view}.py` | D3 |
| M4-D4 | `eligible_routes` | `backend/app/agents/routing/` | D3 |
| M4-D5 | `assess_disruption` (gold/recorded/live, alias, impact, severity) | `backend/app/agents/sensing/` | D4 |
| M4-D6 | Dependency explanation prompt + template (via MOD-12) | `backend/app/agents/dependency/explain.py` | D6 |
| M4-D7 | Graph evaluation harness + report | `backend/tests/graph_eval/`, `backend/app/agents/dependency/EVAL.md` | D5 |
| M4-D8 | GraphView endpoint support for `?focus_supplier_id=` (with Member 3) | router in `backend/app/api/evaluations.py` | D4 |

---

## 4. Inputs, outputs, contracts
| Function | Input | Output | Golden |
|---|---|---|---|
| `load_graph(path)` | `fixtures/demo/supply_graph.json` | validated `SupplyGraph` + NetworkX `MultiDiGraph` | — |
| `check_dependency(q, graph, parts, policy)` | `DependencyQuery` | `DependencyResult` | `fixtures/expected/dependency_results.json` (`results[]`) |
| `linearize(result, graph)` | `DependencyResult` | `LinearizedContext` | same file (`linearized_contexts[]`) |
| `build_graph_view(results, graph, focus, evaluation_id)` | results for all candidate suppliers | `GraphView` | `fixtures/expected/graph_view_SUP-B.json` |
| `eligible_routes(quote, routes)` | quote + route options | list of routes | evaluation golden `options[]` |
| `assess_disruption(event, ctx, mode)` | `DisruptionEvent` | `DisruptionAssessment` | `fixtures/expected/disruption_assessment.json` |

Schemas: `graph.schema.json` (`GraphNode`, `GraphEdge`, `SupplyGraph`, `DependencyQuery`, `DependencyResult`, `DependencyPath`, `LinearizedContext`, `GraphView`), `disruption.schema.json`. Reference implementation: `tools/aegis_oracle.py` (`upstream_paths`, `dependency_check`, `linearize_path`, `linearized_context`, `graph_view`, `assess_disruption`, `resolve_alias`).

---

## 5. Graph model, ingestion and validation
- Nodes are **facilities** (`FAC-*`) with `supplier_id` (nullable), `country`, `role`, `origin_for_part_ids`, `aliases`. Organisations appear as `org_name` attributes; ownership graphs are out of scope (stretch S-6).
- Edges are `SUPPLIES` with `source` = provider, `target` = consumer, `part_id`, `source_ref` (provenance), `confidence` (`verified` / `unverified`). Direction is **provider → consumer** everywhere (data, API, UI arrows).
- Validation on load (fail fast with a clear error; tested): unique node and edge ids; endpoints exist; `part_id` exists in master data; `source_ref` exists in `supply_graph.sources`; no self-loops; confidence in enum; every supplier's `supplying_facility_id` exists. Cycles are allowed in data and handled in traversal.
- Build a NetworkX `MultiDiGraph` with edge keys = `edge_id`. Keep insertion and iteration sorted by id for determinism.

## 6. Dependency algorithm (MOD-05)
```
relevant = bom_closure(part_id)                      # PM-750 → {PM-750, IGBT die, DBC substrate}
start    = suppliers[supplier_id].supplying_facility_id
paths, gaps, cycle, truncated = [], [], False, False
def dfs(node, depth, path_nodes, path_edges):
    ins = sorted(incoming SUPPLIES edges of node with part_id in relevant, by edge_id)
    if not ins:
        if path_edges and path_edges[-1].part_id not in node.origin_for_part_ids:
            gaps.append(upstream_unknown(node, path_edges[-1].part_id))
        if path_edges: paths.append(complete(path_nodes, path_edges))
        return
    if depth == max_depth: truncated = True; paths.append(truncated(path_nodes, path_edges)); return
    for e in ins:
        if e.source in path_nodes: cycle = True; continue
        dfs(e.source, depth+1, path_nodes+[e.source], path_edges+[e])
dfs(start, 0, [start], [])
for child in parts[part_id].bom if child.critical and no incoming edge at start for child.part:
    gaps.append(missing_critical_input(start, child))
cut each path at its first disrupted node → kind shared_disrupted_dependency
```
Outcome rules (first match wins) — identical to `docs/00` §10.1:
1. `disrupted_node_ids` empty → `needs_review` / `DISRUPTED_NODE_UNKNOWN`
2. any disrupted path → `blocked` / `SHARED_DISRUPTED_DEPENDENCY` if every edge on all disrupted paths is verified; else `needs_review` / `UNVERIFIED_PATH_TO_DISRUPTED_NODE`
3. any gap → `needs_review` / `INCOMPLETE_DEPENDENCY_DATA`
4. truncated → `needs_review` / `TRAVERSAL_TRUNCATED`
5. else `passed` / `NO_PATH_TO_DISRUPTED_NODE`

Also compute `upstream_node_ids` (sorted), `shared_with_primary_node_ids` (upstream of candidate ∩ upstream of the primary supplier), notes `SHARED_NON_DISRUPTED_DEPENDENCY` for shared undisrupted nodes and `CYCLE_DETECTED`. Path ids `PATH-<supplier>-<n>` in discovery order; evidence `EVD-PATH-<supplier>-<n>` for **every** path (so passed results have evidence too).

**Demo results (golden):** SUP-B → blocked via `FAC-B-CHB ← E-004 ← FAC-Q-KDH ← E-005 ← FAC-FABZ`; SUP-C → passed, shares `FAC-SUBS` with the primary (concentration note). Note the tier lesson: Zenith fab is tier-2 via SUP-A and tier-3 via SUP-B.

Validation cases you own: **VC-DEP-01…06** (shared dependency, valid alternate, missing data, unverified edge, cycle, truncation) and **VC-SENSE-01**.

## 7. Evidence paths and linearisation (`aegis-path-v1`)
Exact format (golden-compared, so keep it byte-identical):
```
QUERY supplier=<SUP> part=<PRT> max_depth=<n> disrupted=<FAC,...>
RESULT outcome=<outcome> reason=<REASON> coverage_complete=<true|false> truncated=<true|false>
PATH <PATH-ID> [<kind>] (<label> | <org_name> | <country> | <node_id>)[ [DISRUPTED]] <-SUPPLIES[<part short name>; <edge_id>; <source_ref>; <confidence>]- (<next node>) ...
NOTE <CODE> <node_id>
```
`part short name` = part name up to " (". `triples` = one per edge on any path; `allowed_citation_ids` = all path ids + edge ids. Linearised context is the **only** graph material the LLM sees.

## 8. Dependency explanations (through MOD-12)
- Prompt id `dependency_explain_v1`, owned by you, registered in Member 5's prompt registry. Input: `LinearizedContext.lines`. Output JSON: `{text, cited_ids}`.
- Rules the validator enforces (Member 5): every cited id ∈ `allowed_citation_ids`; text must not contradict `outcome` (e.g. "independent" when blocked); no numbers absent from the context; ≤ 600 characters.
- Template fallback (deterministic, always available):
  - blocked: "`<supplier name>` is not independent: `<part>` comes through `<path node labels>` from `<disrupted label>`, the disrupted site (`<path id>`: `<edge ids>`)."
  - passed: "No upstream path from `<supplier name>` reaches the disrupted site within `<n>` hops; all critical inputs have known sources. Shared but undisrupted: `<labels>`."
  - needs_review: one sentence per reason code (missing input, unverified edge, truncated, unknown disrupted node).

## 9. GraphView builder
- Nodes kept: buyer plant, primary supplier facility, each candidate's start node and upstream nodes.
- `status`: `disrupted` (in assessment), `buyer`, `affected_primary` (primary supplier's facility), candidate start nodes take their result (`blocked` / `needs_review` / `candidate_passed`), others `normal`.
- Edges: every stored `SUPPLIES` edge between kept nodes; `highlighted = true` for edges on the focus supplier's disrupted paths; plus one `CANDIDATE_SUPPLY` edge per candidate (`CAND-<SUP>`, dashed in UI).
- `paths`: focus supplier's paths; `text_alternative`: their linearised strings.
- Golden: `graph_view_SUP-B.json`. Member 2 relies on `role` for column layout and on `status` for shape/label.

## 10. Disruption Sensing Agent (MOD-04)
- **Modes:** `gold` (use `gold_extraction`; demo default), `recorded` (Member 5's recorded LLM output for prompt `disruption_extract_v1`), `live`.
- **Extraction contract:** output must validate as `GoldExtraction`. If a gold record exists and any field differs → issue `EXTRACTION_MISMATCH`, outcome `needs_review`. For events without gold (stretch S-5), only consistency checks apply.
- **Consistency:** `new_etd == planned_etd + delay_days` else issue `NEW_ETD_INCONSISTENT_WITH_DELAY`; shipment ids must exist else `UNKNOWN_SHIPMENT`.
- **Alias resolution:** exact, case-insensitive match against node `aliases`; exactly one match required; else `ROOT_CAUSE_ALIAS_UNRESOLVED`, `disrupted_node_ids = []`, outcome `needs_review` (this forces every dependency check to needs_review downstream).
- **Impact:** revised plant arrival = planned + delay; affected orders from PO pegging with days late > 0; penalty = qty × rate × min(days, cap); baseline = sum; severity from `policies.severity_policy`.
- Golden: SHP-A-0901 2 Nov → 9 Nov; SO-1001/1002/1003 late 6/4/2 days; ₹6,00,000 + ₹3,60,000 + ₹2,00,000 = **₹11,60,000**; severity high.

## 11. Routing Agent (MOD-06)
- Eligible if `route.origin_port_id == quote.origin_port_id` and `route.etd >= quote.ready_date`. Sorted by `route_option_id`.
- Returns routes with transhipment ports and their countries (from locations). No optimisation, no LLM.
- Demo: QT-B-01 → RT-B-CMB, RT-B-DIR; QT-C-01 → RT-C-SIN, RT-C-DIR.

## 12. Graph retrieval evaluation (MOD-05 harness)
Run on the demo plus VC-DEP patches; report in `EVAL.md` and in CI:
| Metric | Definition | Target |
|---|---|---|
| Disrupted-path recall | expected disrupted paths found / expected | 1.0 on all cases |
| Path precision | reported disrupted paths that are expected / reported | 1.0 |
| False-pass rate | cases with gaps/unverified/truncation/unknown disruption reported as passed | **0** |
| Determinism | identical JSON on two runs | 100 % |
| Explanation grounding | explanations whose cited ids ⊆ allowed (recorded mode) | 100 % (else template) |
| Latency | `check_dependency` wall time on demo graph | target ≤ 50 ms, **measure on D8** |

---

## 13. Backlog (priority order)
| ID | Task | Pri | Acceptance criteria |
|---|---|---|---|
| M4-T1 | Graph loader + validation with tests for each rule | P0 | Bad fixtures rejected with clear errors |
| M4-T2 | Traversal + outcomes | P0 | VC-DEP-01…04, 06 |
| M4-T3 | Cycle handling | P1 | VC-DEP-05 |
| M4-T4 | Evidence + linearisation | P0 | Byte-equal to golden `linearized_contexts` |
| M4-T5 | GraphView | P0 | Equal to `graph_view_SUP-B.json`; SUP-C view sane |
| M4-T6 | Routing agent | P0 | Options equal golden |
| M4-T7 | Sensing agent (gold) | P0 | Equal to `disruption_assessment.json`; VC-SENSE-01 |
| M4-T8 | Sensing recorded/live extraction | P1 | Mismatch → needs_review |
| M4-T9 | Explanations + templates | P1 | Validator passes; template on failure |
| M4-T10 | Evaluation harness | P1 | Report with all metrics |

## 14. Your first working session (~3 hours)
1. Run the checker; open `dependency_results.json` and `graph_view_SUP-B.json` (20 min).
2. Draw the demo graph on paper from `supply_graph.json`; trace SUP-B and SUP-C by hand (30 min).
3. Implement `load_graph` with validation and a NetworkX build (60 min).
4. Implement the DFS and assert VC-DEP-01 and VC-DEP-02 (60 min).
5. Note anything ambiguous for Member 5 (10 min).

## 15. Day-by-day plan
| Day | Work | Checkpoint |
|---|---|---|
| Tue 20 – Fri 23 | Spikes: loader, DFS, linearisation; graph slide input for deck | — |
| Sun 25 | Review graph contracts; sign off | G0 |
| D1 | Loader, validation, traversal | M1 |
| D2 | Outcomes, coverage, cycles, truncation (all VC-DEP) | — |
| D3 | Evidence, linearisation, GraphView, routing | **M2** (your goldens green) |
| D4 | Sensing agent; integration with Member 3; GraphView endpoint | — |
| D5 | Evaluation harness | M3 |
| D6 | Explanations (recorded) + templates; take over execution-step generator if Member 5 assigns it | — |
| D7 | Bug fixes; review Member 2's graph rendering against golden | M4 |
| D8 | Latency measurement; rehearsal support | M5 |
| D9 | Fixes only | G1 |

## 16. Handoffs
| From → To | What | When |
|---|---|---|
| M4 → M3 | `check_dependency`, `eligible_routes` with passing goldens | D3 |
| M4 → M3 | `assess_disruption` | D4 |
| M4 → M2 | GraphView endpoint + node/edge semantics | D3–D4 |
| M4 → M5 | Prompt `dependency_explain_v1` spec + allowed-citation rules | D5 |
| M4 → M1 | One-sentence path explanation + answer to "where does tier-2 data come from?" | 22 Oct, D4 |

## 17. Validation and definition of done
- Your goldens equal byte-for-byte (except volatile fields); all VC-DEP and VC-SENSE cases are unit tests.
- False-pass rate 0; determinism 100 %.
- Every path evidence cites existing sources; no LLM text without validation.

## 18. Blockers, escalation, fallbacks
| Blocker | Escalate | Fallback |
|---|---|---|
| Golden mismatch you believe is a golden bug | Member 5 + Member 3 | Raise a contract PR with reasoning; never edit goldens alone |
| LLM gateway not ready | Member 5 | Templates only (always acceptable for the demo) |
| Time pressure | Member 5 | Drop live extraction (keep gold), then explanations; never drop outcome rules or evidence |
