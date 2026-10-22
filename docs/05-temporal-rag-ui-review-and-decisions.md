# Member 5 — Temporal Trade-Rule RAG, UI Review and Final Decisions

| | |
|---|---|
| Role | RAG system developer (temporal rules), UI/UX reviewer, final decision-maker |
| You own (accountable) | MOD-07 Temporal Rule Service · MOD-12 LLM Gateway & explanations (incl. LC text extraction) · MOD-17 Decision log, scope and design review · MOD-18 Demo acceptance (Member 1 executes) |
| You review | MOD-01, 03, 05, 08, 10, 11, 13, 16, 19, 20 (see `docs/00` §7.3) |
| Your reviewers | Member 4 (MOD-07, MOD-12), Member 1 (MOD-17) |
| Authority | Final calls on scope, design and implementation trade-offs **after consulting the accountable owner** (`docs/00` §15.4) |
| Time budget | Your own build work comes first: reviews are limited to checkpoints R1–R4 plus ≤ 60 min/day of PR reviews and decisions |

---

## 1. The project in brief
AegisShield AI checks recovery plans before execution. Your part answers one question deterministically — *which trade rules apply to this import, on this date, in this jurisdiction, from which authority?* — and runs the only gateway through which any LLM is called. You also keep the team on one product: you decide scope and design trade-offs, review the UI at fixed checkpoints, and sign the go/no-go. All data is synthetic.

**Glossary:** *applicable_on* = legal date the rule must be valid on (MVP: ETA at the Indian port, A-05); *known_as_of* = knowledge cutoff (rules published later are invisible); *supersession* = an explicit `supersedes` link from a newer rule; *authority precedence* = official gazette > official circular > internal policy > secondary; *recorded mode* = replaying stored LLM outputs; *template* = deterministic text used when no valid LLM output exists.

---

## 2. Mission and boundaries
**Mission.** Make rule selection explainable and testable (no similarity-based law), keep every LLM output bounded and validated, and make fast, logged decisions so four builders never block on you.

**Yours:** rule store and applicability engine, passage ranking for display, conflict handling, rule evaluation; LLM gateway (modes, prompts, recorded store, validator), LC text extraction, plan explanation composer; decision log; UI review checkpoints; acceptance sign-off.

**Not yours:** LC and FTA pass/fail logic (Member 3 consumes your results), money, graph logic (Member 4), screen implementation (Member 2 — you may submit small PRs to UI copy and tokens, reviewed by Member 2), pitch wording (Member 1, you approve claims).

---

## 3. Deliverables and locations
| ID | Deliverable | Location | Due |
|---|---|---|---|
| M5-D1 | Decisions OD-01…OD-04, OD-07 recorded | §9 of this doc (decision log) | 22–25 Oct |
| M5-D2 | Rule store + loader + validation | `backend/app/rules/store.py` | D1 |
| M5-D3 | `rule_applicability` (all VC-RULE) | `backend/app/rules/applicability.py` | D2 |
| M5-D4 | Passage ranking (BM25) | `backend/app/rules/passages.py` | D3 |
| M5-D5 | LLM gateway: `off` (D1), `recorded` (D5), `live` (OD-04) | `backend/app/llm/` | D1/D5 |
| M5-D6 | Prompt registry + validator | `backend/app/llm/prompts/`, `backend/app/llm/validate.py` | D4 |
| M5-D7 | LC text extraction (`lc_extract_v1`) compared with gold | `backend/app/llm/lc_extract.py` | D3 |
| M5-D8 | Plan explanation composer (template + `plan_explain_v1`) | `backend/app/llm/explain_plan.py` | D4 |
| M5-D9 | Recorded responses for demo prompts | `fixtures/llm/recorded/<prompt_id>/<request_hash>.json` | D5 |
| M5-D10 | Rule retrieval evaluation report | `backend/app/rules/EVAL.md` | D5 |
| M5-D11 | Review notes R1–R4; acceptance sign-off | `docs/reviews/R1.md` … `R4.md`, `pitch/rehearsal-log.md` | D2, D4, D7, D8, D9 |

---

## 4. Inputs, outputs, contracts
| Function | Input | Output | Contract / golden |
|---|---|---|---|
| `rule_applicability(q, rules, agreements)` | `RuleQuery` | `RuleApplicabilityResult` | `trade-rules.schema.json`; `fixtures/expected/rule_applicability.json` |
| `rank_passages(q, result, k)` | query + result | top-k passages with scores (display only) | internal; never changes `applicable` |
| `explain(subject_id, context, prompt_id)` | linearised context or plan context | `Explanation` | `plan.schema.json#Explanation`; golden `explanations[]` (template mode) |
| `extract_lc_fields(raw_text)` | MT700-style text | `{field_name: value}` for `transhipment`, `partial_shipments`, `ucp_20c_excluded`, `latest_shipment_date`, `port_of_discharge`, `presentation_period_days` | stored as `LetterOfCredit.extracted`; checked by `LC.EXTRACTION_CONSISTENCY` (Member 3) |
| Gateway config | env `AEGIS_LLM_MODE`, `AEGIS_LLM_BASE_URL`, `AEGIS_LLM_MODEL`, `AEGIS_LLM_API_KEY` | mode + provider | `Health.llm_mode` |

Reference implementation of applicability: `tools/aegis_oracle.py` (`rule_applicability`, `rule_query_for`).

---

## 5. Temporal rule store and applicability (MOD-07)
**Store.** Rules load from `fixtures/demo/trade_rules.json` and validate against `TradeRule`. Every rule has: family, type, jurisdiction, agreement, HS scope, origin scope, `published_date`, `effective_from`, `effective_to` (inclusive, nullable), `status` (`in_force` / `draft` / `withdrawn`), `supersedes`, authority level and issuer, source (with `synthetic`), optional `modeled_on` (real instrument + verification status), passage `text`, and gold `structured` values.

**Applicability algorithm** (canonical in `docs/00` §10.2):
1. Exclude: jurisdiction mismatch → HS scope mismatch → origin scope mismatch → `published_date > known_as_of` (not_yet_published) → status draft/withdrawn → `applicable_on < effective_from` (not_yet_effective).
2. Among the rest: excluded `superseded` if another remaining rule lists it; else `expired` if `applicable_on > effective_to`.
3. Per requested rule type: keep highest authority; equal-authority different values → conflict `unresolved` → outcome `needs_review`; lower-authority rules → `lower_authority` (conflict `authority_precedence` recorded if values differ); among equal-authority agreeing rules choose the latest published, others `duplicate_same_authority`.
4. Missing requested type → `missing_rule_types` → `needs_review`.
5. `retrieval_trace = {selection: "deterministic_metadata_filter", ranker_used_for_selection: false}`.

**Demo outcomes (golden):** for every route, MFN = TR-0003 (15 %, from 1 Nov) with TR-0002 `superseded`, TR-0004 `draft`, TR-0006 `lower_authority`; preference TR-0005 (0 %); consignment TR-0001. VC-RULE-01 (31 Oct): TR-0002 applies, TR-0006 overruled by authority (conflict shown). VC-RULE-06 (knowledge cutoff 29 Sep): MFN unresolved → needs_review.

**Validation cases you own:** VC-RULE-01…07.

**Passage ranking (display only).** BM25 over rule `text` + `title`; query string from rule types, HS label, origin and transit countries. Return top-k among `applicable` and `excluded` so the UI can show "what we read and why we did not use it". A unit test asserts that ranking order can never change `applicable`.

**Corpus governance.** Any new rule needs: source title and URI, authority level, publication and effective dates, verification status, and a `synthetic` flag. A real instrument may only be added with `verified_primary` status and Member 1's evidence-register row; otherwise it is a synthetic encoding with `modeled_on`. Never mix real and synthetic values without labels.

**Rule retrieval evaluation (`EVAL.md`):**
| Metric | Definition | Target |
|---|---|---|
| Applicable-set exactness | `applicable` ids equal expected on every VC-RULE case and golden query | 100 % |
| Exclusion-reason accuracy | each excluded rule has the expected reason | 100 % |
| Superseded/draft leakage | superseded or draft rules appearing in `applicable` | **0** |
| Unresolved-conflict detection | VC-RULE-03 returns needs_review | yes |
| Citation integrity | every applicable rule's `source_id` exists | 100 % |

## 6. LLM gateway and explanations (MOD-12)
- **Modes:** `off` → templates only; `recorded` → look up `fixtures/llm/recorded/<prompt_id>/<request_hash>.json` (request hash = sha256 of canonical JSON of `{prompt_id, prompt_version, input}`); miss → template + step `degraded`; `live` → provider call (OD-04) with 8 s timeout, **1 retry**, then template + `degraded`. Store every live response as a new recorded file (review before commit).
- **Prompt registry:** `prompts/<prompt_id>.md` with version, purpose, input schema, output schema, examples. Initial prompts: `disruption_extract_v1` (Member 4 consumer), `dependency_explain_v1` (Member 4), `lc_extract_v1`, `plan_explain_v1`.
- **Validator** (applies to every model output before use): JSON schema of the prompt's output; `cited_ids ⊆ allowed ids`; no outcome contradiction (e.g. "approved", "independent", "compliant" when the subject outcome is blocked/needs_review); every number in the text appears in the context; length ≤ 600 characters (plan explanations ≤ 900); non-empty. Errors map to `Explanation.validation.errors` codes. Failure → template.
- **Bounded extraction:** LC and disruption extraction use JSON-only outputs with enum-constrained fields; results are compared with the verified record. A mismatch never changes the record; it produces a review finding.
- **Data hygiene:** send only the linearised context or the specific raw text; no keys or personal data in logs; recorded files contain synthetic data only.
- **Templates (golden, template mode):** `XPL-PLN-0001`: "PLN-0001 outcome blocked. FND-DEP-SUP-B is blocked; FND-FTA-DIRECT_CONSIGNMENT-RT-B-CMB is needs_review; FND-LC-TRANSHIPMENT-RT-C-SIN is blocked. Net avoided loss INR 826000." and `XPL-PLN-0002`: "PLN-0002 outcome passed. All checks passed. Net avoided loss INR 618000." (exact strings in `fixtures/expected/evaluation_EVAL-0001.json`).

Validation cases you own: VC-LLM-01, VC-LLM-02 (manual), and the extraction path of VC-LC-07.

---

## 7. UI review responsibilities (separate from Member 2's ownership)
- **Where the UI is specified (canonical, owned by Member 2):** interface flow `docs/02` §5; required screens §6; UI states §7; evidence presentation §8; graph view §9; accessibility expectations §10; review criteria §12. You review against these; you do not keep a second copy.
- **What you do:** review flows and builds at R1–R4 against the criteria in `docs/02` §12; raise at most five change requests per checkpoint, each tagged **must** (demo-breaking, wrong number, misleading claim, accessibility failure) or **should**; decide disputes; optionally submit small PRs to UI copy (`frontend/src/lib/labels.ts`) and tokens (`frontend/src/styles/tokens.css`) that Member 2 reviews.
- **What you do not do:** redesign between checkpoints, implement screens, or block merges for "should" items.
- **Schedule:** R1 D2 17:00 (45 min), R2 D4 17:00 (45 min), R3 D7 15:00 (60 min, freeze decision), R4 D8 12:00 (30 min). Notes in `docs/reviews/Rn.md` within one hour.

## 8. Demo acceptance and go/no-go (MOD-18)
Member 1 executes DA-01…15 (`docs/00` §14.2) on D7 and D9; you sign. **Go** requires: all DA items pass or have an agreed workaround; CI green; golden flow passes twice after reset; offline drill passed; backup video exists. **No-go fallback:** present from the backup video and the deck, with the live app used only for the parts that pass.

## 9. Decision log (canonical; append-only)
Template for new entries: `| D-0NN | date | context | options considered | decision | consulted | follow-up owner |`.

| ID | Date | Decision | Why | Consulted |
|---|---|---|---|---|
| D-001 | 19 Oct | Final idea is AegisShield AI; no re-scoring | [REQ] | all |
| D-002 | 19 Oct | Roles per [REQ]; ownership matrix `docs/00` §7.3; routing and sensing agents → Member 4; inventory and compliance agents → Member 3 | Fill gaps while balancing load | M3, M4 |
| D-003 | 19 Oct | One synthetic scenario `SCN-DEMO-001`; numbers canonical in `fixtures/expected/` | PDF figures inconsistent (C6) | M1, M3 |
| D-004 | 19 Oct | Two plans: P1 `cost_time_only`, P2 `constraint_verified` | Shows the naive vs verified contrast | M2, M3 |
| D-005 | 19 Oct | 43T = transhipment, 43P = partial shipments; block transhipment only when 20(c) excluded or exception fails | Correct PDF error (C3, C4) | M1, M3 |
| D-006 | 19 Oct | Non-party transit under AIFTA → needs_review, not blocked | Rule 8 allows conditional transit (C4) | M3 |
| D-007 | 19 Oct | Arrival is never an LC input | 44C is a shipment date (C5) | M3 |
| D-008 | 19 Oct | Money definitions; exposures separate; mutually exclusive exposures not summed | Avoid double counting | M3, M1 |
| D-009 | 19 Oct | Stack per `docs/00` §6 | Simplest reliable for 9 days | M2, M3, M4 |
| D-010 | 19 Oct | LLM modes live/recorded/off; outcomes independent of LLM | Venue risk; trust | M3, M4 |
| D-011 | 19 Oct | Every plan needs human approval; blocked plans never approvable; review items need role-specific acknowledgement | HITL [REQ]; event guidance | M3, M2 |
| D-012 | 19 Oct | Execution simulated; first failure stops; no auto-retry/compensation | Bounded execution | M3 |
| D-013 | 19 Oct | Hash-chained audit with verify endpoint | Auditability | M3 |
| D-014 | 19 Oct | Contracts v1.0.0 freeze 25 Oct; minor-only after D5; fixes-only after D7 | Parallel work | M3 |
| D-015 | 19 Oct | `applicable_on` = ETA at Indian port (A-05), flagged as simplification | Legal date rule unverified | M1 |
| D-016 | 19 Oct | Graph edges provider → consumer everywhere | One convention for data, API, UI | M4, M2 |
| D-017 | 19 Oct | Graph uses deterministic preset layout by role | Stable demo visuals | M2, M4 |
| D-018 | 19 Oct | Reviews bounded to R1–R4; 4-hour decision SLA; silence = owner's proposal | Avoid blocking | all |
| D-019 | 19 Oct | No novelty, performance or score claims | Unverifiable (C7) | M1 |
| D-020 | 19 Oct | Phase 0 code = throwaway spikes until OD-05 answered | Rules risk R-09 | M1 |
| D-021 | 22 Oct | OD-01 **provisional default**: (a) host the backend on SAP BTP Cloud Foundry trial, plus the proposed-SAP-mapping slide | No recorded decision by the 22 Oct deadline; documented default (`docs/00` §14.5) applied per D-018. Member 5 to confirm or overrule | pending |
| D-022 | 22 Oct | OD-02 **provisional default**: no LangGraph wrapper; plain Python pipeline | Same as D-021 | pending |
| D-023 | 22 Oct | OD-03 **provisional default**: Tailwind/shadcn with Fiori-inspired density | Same as D-021 | pending |
| D-024 | 22 Oct | MOD-12 integration: (1) recorded demo responses are hand-authored, labelled `origin: hand_authored`, until OD-04 picks a provider; live responses are captured to `work/llm/captured/` for review before commit; (2) `extract_lc_fields` is not run inside the evaluation, because an extra `LC.EXTRACTION_CONSISTENCY` finding would change plan hashes across modes (VC-LLM-01); when to store `LetterOfCredit.extracted` stays with Member 3 | Keep outcomes and hashes identical in off/recorded/live | M3, M4 |
| D-025 | 23 Oct | DRAFT: pending Member 5 confirmation — decision-sheet snapshot recorded (`docs/decisions/decision-sheet.md`): OD-01 BTP CF trial default, OD-02 no LangGraph, OD-03 plain CSS correction proposal, OD-04 live LLM needs env creds, OD-05 Phase 0 overdue, OD-06 NOT FOUND pending offline artifact, OD-07 claim check filed, OD-08 stretch not started | Why: OD decisions are tracked in one place and never auto-decided | M5 |
| D-026 | 23 Oct | DRAFT: pending Member 5 confirmation — D-023 correction proposal: ship plain CSS (Fiori-inspired density via `tokens.css`) in repo and list Tailwind/shadcn migration for Member 2 decision before 26 Oct | Why: Phase 0 avoid the popular-stacks spiral | M2, M5 |

Open decisions you must close (from `docs/00` §14.5): **OD-01** SAP technology (22 Oct), **OD-02** LangGraph wrapper (22 Oct), **OD-03** UI kit (22 Oct), **OD-04** live LLM provider (25 Oct), **OD-05/06** event rules (20–21 Oct, research by Member 1), **OD-07** primary-source verification for pitch wording (23 Oct), **OD-08** stretch S-1 (D5).

Decision procedure: read the owner's proposal → ask the consulted members (≤ 15 min) → decide → log the same day → announce in the channel. Reversible decisions are made fast; irreversible ones (contract majors after D5, cutting a P0) need the owner present.

---

## 10. Backlog (priority order)
| ID | Task | Pri | Acceptance criteria |
|---|---|---|---|
| M5-T1 | Kickoff; decide OD-02, OD-03; log D-001…D-020 | P0 | Logged by 20 Oct |
| M5-T2 | Decide OD-01 with Member 1's note | P0 | Logged by 22 Oct |
| M5-T3 | Rule store + applicability | P0 | VC-RULE-01…07; golden `rule_applicability.json` equal |
| M5-T4 | Gateway `off` mode + templates | P0 | Golden `explanations[]` equal |
| M5-T5 | Validator | P0 | VC-LLM-02 |
| M5-T6 | LC extraction + gold comparison | P1 | Correct fields from `raw_text`; mismatch → `extracted` set → review finding |
| M5-T7 | Passage ranking | P1 | Top-3 passages shown; selection unchanged |
| M5-T8 | Recorded mode + recorded files for demo prompts | P0 | VC-LLM-01 with `recorded`; identical outcomes and hashes |
| M5-T9 | Live mode (OD-04) | P2 | Works with the chosen provider; degrades cleanly |
| M5-T10 | Reviews R1–R4 | P0 | Notes within 1 h; ≤5 CRs each |
| M5-T11 | Acceptance sign-off | P0 | D7 and D9 signed |
| M5-T12 | Rule evaluation report | P1 | Metrics table filled |

## 11. Your first working session (~3 hours)
1. Read `docs/00` fully (60 min) and skim docs 01–04 (30 min).
2. Run the checker; open `rule_applicability.json` and trace TR-0002/0003/0004/0006 by hand for 31 Oct and 1 Nov (30 min).
3. Prepare the kickoff agenda: demo walkthrough (15 min), ownership matrix (10 min), OD-02/03/05/06 (15 min), calendar and checkpoints (10 min), risks (10 min) (30 min).
4. Start `backend/app/rules/store.py` with schema validation (30 min).

## 12. Day-by-day plan
| Day | Build work | Decision/review work |
|---|---|---|
| Mon 19 | First session | — |
| Tue 20 | Rule store spike | **Kickoff**; OD-02, OD-03; D-log |
| Wed 21 | Applicability spike | Review deck v0; OD-05 |
| Thu 22 | Validator spike | **OD-01**; deck v1 review |
| Fri 23 | — | Rehearsal judge; OD-07 wording |
| Sat 24 | — | Pitch |
| Sun 25 | — | **G0** sign-off; OD-04 |
| D1 | Store + VC-RULE-01/02; gateway `off` | — |
| D2 | All VC-RULE; conflicts | **R1** |
| D3 | LC extraction; passage ranking | M2 milestone check |
| D4 | Validator + plan templates | **R2** |
| D5 | Recorded mode + files; EVAL.md | M3 milestone; close breaking-change window; OD-08 |
| D6 | VC-LLM cases | PR reviews |
| D7 | Fixes | **R3** freeze; acceptance run #1 sign-off |
| D8 | Live mode if OD-04; fixes | **R4**; rehearsals |
| D9 | Fixes only | **Go/no-go**; approve `demo-freeze` tag |

## 13. Handoffs
| From → To | What | When |
|---|---|---|
| M5 → M3 | `rule_applicability` passing VC-RULE | D2 |
| M5 → M3/M4 | `explain()` (off mode) and prompt registry | D4 |
| M5 → M3 | `extract_lc_fields` | D3 |
| M5 → M2 | Rule status wording; explanation labelling rules | D3 |
| M5 → M1 | Approved claim wording (LC/FTA/rules) | 22–23 Oct |
| M4 → M5 | `dependency_explain_v1` spec | D5 |
| M1 → M5 | OD-01/05/06 research; acceptance results | 20–22 Oct; D7, D9 |

## 14. Validation and definition of done
- VC-RULE-01…07 automated and green; golden rule results equal; leakage metric 0.
- In `off`, `recorded` and `live` modes the evaluation's outcomes, amounts and plan hashes are identical (VC-LLM-01).
- Every explanation shown in the UI has `validation.passed = true` or is a template.
- Decision log has an entry for every OD and every scope change; review notes exist for R1–R4.

## 15. Blockers, escalation, fallbacks
| Blocker | Escalate | Fallback |
|---|---|---|
| No LLM access | — | `off`/`recorded` only (fully acceptable) |
| Legal wording uncertain | Member 1 research | Use the cautious phrasing in `docs/01` §10 |
| Reviews eating build time | yourself | Skip optional PR reviews; checkpoints only |
| Disagreement between owners | you decide after hearing both | Choose the option that keeps the D5 golden milestone |
