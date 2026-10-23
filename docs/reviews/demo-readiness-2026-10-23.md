# Demo Readiness Review — 2026-10-23

**HEADER:**
- **REPO_ROOT:** `C:/Users/kashy/Desktop/Agi`
- **TODAY:** `2026-10-23`
- **BUILD_DAY:** `pre-build` (D1 = Mon 26 Oct 2026) — **MODE in effect:** audit only, no fixes
- **GIT:** no-commit
- **HEAD:** `7e37ad2` on `main` (`= origin/main`), working tree clean
- **SCRATCH:** `work/audit/` (gitignored, `.gitignore:12`)
- **CONVENTIONS:** Every finding and metric is marked **[observed]** (dynamically executed in this audit session) or **[code read]** (verified via static code inspection).

---

## 1. Verdict

**VERDICT: NO-GO** *(rubric: any open P0 blocker)*.

There are three open P0 findings. **F-01** is a false pass in the dependency-graph traversal when a disrupted node lies behind a cycle or an unknown disrupted node ID is supplied; it affects both the product and the oracle but can't be reached in the single demo scenario. **F-02** and **F-03** are demo blockers: docs/00 ranks FR-02 and FR-15 as P0 requirements, DA-02 and DA-04 fail, and demo-script beats 1 and 6 (§12.2) can't be performed as written. Those UI gaps are expected at pre-build; they are Member 2's scheduled D2–D3 work.

The core demo scenario is otherwise fully green. Contract validation passes 39/39 oracle cases and 56 OpenAPI examples. Every baseline suite passes: `pytest backend` 71 passed, root tests 7 passed, `tsc` and `eslint` clean, Vite build to `work/audit-dist` clean, Playwright stub 8 passed, Playwright live 1 passed. `approval_flow` steps 1–16 pass twice in a row from a clean reset against a real Uvicorn server, with 0 schema violations and identical plan hashes: P1 `sha256:e51b38ab2d777e233666de107d9871bc88c42bf59cf39f31891d6ff12927f6f2`, P2 `sha256:3324f97f2eb3e8bc5c9f759e50d99488656e70a8ec194faea6848df207b0adf0`. A container built from a clean clone passes the 16/16 flow and serves the UI (200) at `/`. The three LLM modes (`off`, `recorded`, `live` with an unreachable endpoint) give identical outcomes, amounts and plan hashes. A browser run completes with every non-localhost request aborted.

The verdict becomes **GO WITH RISKS** once F-02 and F-03 are built and M4 and M5 either resolve F-01 or explicitly accept it as a known risk outside the demo scenario. It stays there until the P1 items and the Human-only items are closed.

---

## 2. Baseline Check Commands (Before / After)

All commands were executed against `HEAD` `7e37ad2`. Because this is an audit-only review with zero modifications to tracked files, the *Before* and *After* exit codes and outputs are identical.

*Pre-audit note:* Baseline includes commit `7e37ad2` pushed to `origin/main` in the previous session immediately prior to this audit (`fix(evaluation): format step7 degraded error as StepError object`). Before that commit, `tests/conformance/test_live_api_responses.py` failed when `.env` selected live mode.

| Check Command / Test Suite | Scope | Exit Code (Before) | Exit Code (After) | Status & Observed Metrics [observed] |
|---|---|:---:|:---:|---|
| `python tools/check_contracts.py` | Contract & schema oracle | 0 | 0 | **PASSED** [observed]: 39/39 oracle validation cases pass; 56 OpenAPI examples validate against schema; 12 fixture files valid; referential integrity holds (31 findings, 25 evidence items); hand-calc figures equal oracle. |
| `pytest backend` | Backend unit & agent tests | 0 | 0 | **PASSED** [observed]: 71 passed in 10.80 s (`work/b_backend.log`). |
| `pytest tests` | Root API & conformance tests | 0 | 0 | **PASSED** [observed]: 7 passed in 7.92 s (`work/b_api.log`). |
| `cd frontend && npx tsc -b` | TypeScript compilation | 0 | 0 | **PASSED** [observed]: 0 errors, output clean (`work/b_tsc.log`). |
| `npm --prefix frontend run lint` | ESLint static checks | 0 | 0 | **PASSED** [observed]: 0 lint errors (`work/b_lint.log`). |
| `npx vite build` | Frontend production bundle | 0 | 0 | **PASSED** [observed]: Vite v6.4.5 built to `work/audit-dist` in 643 ms; 34 modules transformed (`work/b_build.log`). |
| `cd frontend && npx playwright test` | Frontend stub E2E tests | 0 | 0 | **PASSED** [observed]: 8 passed in 9.1 s (`work/b_pw.log`). |
| `cd frontend && npx playwright test -c playwright.live.config.ts` | Frontend live E2E test | 0 | 0 | **PASSED** [observed]: 1 passed in 6.9 s (`work/b_pwlive.log`); reset, eval, graph, LC amend, P2 approval verified against live server. |
| `python work/audit/flow_runner.py off 2` (Run 1 & 2) | Full approval flow (steps 1–16) | 0 | 0 | **PASSED** [observed]: 16/16 passed on both runs; 0 schema issues; startup 1.65 s; eval poll time 0.022 s (Run 1) and 0.044 s (Run 2); identical hashes P1 `sha256:e51b38ab...` and P2 `sha256:3324f97f...` (`work/audit/flow_off.json`). |
| `python work/audit/flow_runner.py recorded 1` | Replay mode flow (steps 1–16) | 0 | 0 | **PASSED** [observed]: 16/16 passed; startup 1.61 s; eval poll 0.025 s; identical hashes P1 and P2; golden diff only in recorded explanation content `$.explanations[0].cited_ids[1]` (expected; golden is LLM-off; `work/audit/flow_recorded.json`). |
| `AEGIS_LLM_BASE_URL=http://127.0.0.1:9/v1 … python work/audit/flow_runner.py live 1` (unreachable endpoint) | Degraded fallback flow | 0 | 0 | **PASSED as expected** [observed]: 15/16 (step 15 counts 6 `AGENT_STEP_SUCCEEDED` because step 7 is degraded; flow precondition is LLM off); **eval POST + poll 12.338 s** (synchronous LLM attempts block the request — evidence for F-13); identical hashes P1 and P2; step 7 error `{"code": "LLM_DEGRADED", "message": "ConnectError"}` is schema-valid (`work/audit/flow_live_unreach.json`). |
| `git clone . work/audit/clone` → `docker build -t aegis-audit:clean` → `docker run` | Docker container parity | 0 | 0 | **PASSED** [observed]: image `aegis-audit:clean` (Python 3.12 base) starts; 16/16 flow passes against the container; root UI returns 200 at `/`. |
| `work/audit/pw/offline.spec.ts` | Offline browser drill | 0 | 0 | **PASSED** [observed]: 1 passed; all non-localhost requests intercepted and aborted; 0 external requests made; badge reads "LLM: off (templates)"; screenshot `offline-command.png`. |
| `work/audit/pw/da.spec.ts` | Demo acceptance browser audit | 0 | 0 | **PASSED** [observed]: Observations captured in `work/audit/pw/da-observations.json` and screenshots `da-*.png`. |
| `python work/audit/probe.py` | E2, E3, header error probes | 0 | 0 | **PASSED** [observed]: E2 31 findings valid; E3 false-pass reproduced; 403 vs 400 header errors confirmed. |
| `python work/audit/probe2.py` | E3 traversal variant matrix | 0 | 0 | **PASSED** [observed]: 4-variant matrix confirms E3 cycle/origin bypass in both product and oracle. |
| `python work/audit/amend_check.py` | LC amendment financial check | 0 | 0 | **PASSED** [observed]: P2 after amendment = 438,000 / 25,000 / 697,000; fee line amount is 0 (discrepancy vs VC-AMEND-01 446,000 / 25,000 / 689,000). |

---

## 3. Demo Acceptance Checklist (DA-01 .. DA-15)

Evaluated per `docs/00-source-of-truth.md` §14.2 against the live application and recorded artifacts.

| ID | Item Description | Status | Evidence & Observed Details | Accountable Owner |
|---|---|:---:|---|:---:|
| **DA-01** | Reset works; "SYNTHETIC DATA" banner visible on every screen | **Verified** | **[observed]** `POST /api/v1/demo/reset` restarts audit chain at `AUD-000001`. Banner confirmed visible on all 5 navigation screens: Command Center, Evaluations, Execution, Supply graph, Audit trail (`da01_banner` in `da-observations.json`); the banner sits in the app shell (`App.tsx:494`), so it also renders on the Evaluation progress screen. *Defect noted:* banner is not CSS `position: sticky`, and sidebar LLM badge is hidden at screen widths $\le 700\text{ px}$ (`App.css:968`). | M2 / M3 |
| **DA-02** | Command Center: 3 orders, 6/4/2 days late, ₹11,60,000 baseline | **Fail** | **[observed]** Customer orders SO-1001, SO-1002, SO-1003, days late ("6 days", "4 days", "2 days"), and supplier location "Penang" are completely absent from the Command Center UI (`App.tsx:500-506`). Baseline loss ₹11,60,000 is rendered, but it appears even *before* evaluation runs via an un-evaluated fallback `?? 1160000` (`App.tsx:503`). Script Beat 1 cannot be presented as written. | M2 |
| **DA-03** | Evaluation shows 7 steps with status and mode; completes (record seconds) | **Partial** | **[observed]** All 7 steps render with owner, attempt count, and mode chip (`template`, `deterministic`, or `gold`). Measured on the dev machine (evaluation POST + poll): 0.022 / 0.044 s in `off` mode, 0.025 s in `recorded` mode. SC-9's ≤ 5 s target on the demo laptop in `recorded` mode is not yet measured. *Defect noted:* step completion status is conveyed strictly via an icon (`✓`, `!`, `•`) marked `aria-hidden="true"` with no accessible text alternative (`App.tsx:524`). | M2 |
| **DA-04** | Comparison: P1 ₹3,34,000 / ₹0 / ₹8,26,000 BLOCKED; P2 ₹4,92,000 / ₹50,000 / ₹6,18,000 PASSED; P2 recommended | **Fail** | **[observed]** Only net avoided loss (₹8,26,000 and ₹6,18,000) is rendered on plan cards (`App.tsx:513`). Recovery costs (₹3,34,000 / ₹4,92,000), residual loss (₹50,000), and worst-case exposure (₹5,10,000) are not rendered anywhere in the comparison view. Recommendation badge `"P2 · Recommended"` is hardcoded statically in the DOM before evaluation (`App.tsx:507`). Backend API payload matches golden values exactly. Script Beat 6 cannot be presented as written. | M2 |
| **DA-05** | FND-DEP-SUP-B opens the graph with Chonburi $\leftarrow$ Kedah $\leftarrow$ Zenith highlighted and a text version | **Verified** | **[observed]** `tests/dependency-graph.spec.ts::DA-05` passes; graph view displays 2 highlighted paths in live and offline modes; accessible text alternative (evidence-path list, link list, facility table) at `DependencyGraph.tsx:113-125`. | M2 / M4 |
| **DA-06** | LC finding shows 43T and 47A lines and the remedy "request amendment" | **Verified** | **[observed]** Drawer for `FND-LC-TRANSHIPMENT-RT-C-SIN` displays contractual field excerpts `:43T:NOT ALLOWED`, `:47A:UCP 600 SUB-ARTICLE 20(C) IS EXCLUDED.`, and displays the remedy "request_lc_amendment" (`da-observations.json`, `da-06-lc.png`). | M2 / M3 |
| **DA-07** | FTA finding shows needs review, ₹3,87,600 at 15 % (TR-0003), TR-0002 superseded, TR-0004 draft, TR-0006 lower authority | **Partial** | **[observed]** Drawer for `FND-FTA-DIRECT_CONSIGNMENT-RT-B-CMB` shows outcome `needs_review`, TR-0003 (15 % MFN applied), TR-0002 (superseded), TR-0004 (draft), and TR-0006 (lower authority) (`da-07-fta.png`). *Defect noted:* duty at risk ₹3,87,600 is omitted entirely because plan exposures are not rendered in the frontend. | M2 |
| **DA-08** | Approving P1 shows the server's PLAN_BLOCKED message; nothing changes | **Partial** | **[observed]** API correctly returns `422 PLAN_BLOCKED` and audits `DECISION_REFUSED` (verified in flow step 5). However, the UI disables the "Approve" button on blocked plans (`App.tsx:513`), making it impossible for a presenter to trigger or display the server's refusal message in the UI. Requires Member 5 decision whether UI button disablement satisfies the beat. | M2 / M5 |
| **DA-09** | Priya approves P2; repeating shows "already decided"; Arjun cannot approve again | **Partial** | **[observed]** Priya approves P2 via keyboard; API idempotency replay returns `200` with `Idempotent-Replay: true`, and second distinct key returns `409 DECISION_EXISTS` (flow steps 9–10). However, once approved, the UI transitions to "Start simulated execution" without providing a button to re-submit approval, so "already decided" cannot be triggered via UI. Arjun correctly sees no Approve button (`da-observations.json`). | M2 |
| **DA-10** | Execute $\rightarrow$ 6 simulated steps, all labelled simulated; second execute refused | **Verified** | **[observed]** Execution generates 6 discrete steps, each rendered with a distinct `SIMULATED` pill chip (`da-10-exec.png`); second execution with a new key is rejected with `409 ALREADY_EXECUTED` (flow step 13). | M2 / M3 |
| **DA-11** | Audit list shows refusals and decisions; Verify $\rightarrow$ valid | **Partial** | **[observed]** Audit verification modal recomputes SHA-256 hash chain and confirms: `"Chain valid — API verified 21 events."` (`da-11-audit.png`). *Defect noted:* Because the UI walk never triggers an invalid action, the UI audit table contains only successful lifecycle events; API flow has all 5 refusals. | M2 |
| **DA-12** | Network unplugged + LLM off: same numbers and outcomes; badge "LLM: off (templates)" | **Partial + Human-only** | **[observed]** Verified programmatically in `offline.spec.ts` with all non-localhost requests blocked: UI displays identical financial figures and renders badge `"LLM: off (templates)"`. Physical unplug on the demo laptop remains a human-only verification. | M3 / M1 |
| **DA-13** | Whole approval flow by keyboard; focus visible; statuses have icon + text | **Partial** | **[observed]** Keyboard-only approval functions end-to-end. *Defects noted:* Pressing `Shift+Tab` from the focused approval dialog container escapes the modal (`App.tsx:452-469`); pressing `Escape` fails to close the evidence drawer (`App.tsx:629`); step progress status uses icon glyphs only without visible or accessible text. | M2 |
| **DA-14** | Every number on slides equals the UI | **Human-only / Missing** | **[code read]** Decks `pitch/round1` and `pitch/finale` are currently absent from the repository. Cross-check of deck figures against golden API numbers cannot be executed until slides are drafted. | M1 |
| **DA-15** | Second run after reset gives identical plan hashes | **Verified** | **[observed]** Consecutive reset and evaluation runs in `flow_off.json` yield bit-for-bit identical hashes: P1 `sha256:e51b38ab...` and P2 `sha256:3324f97f...`. | M3 |

### Open Human-Only Items
The following 8 operational and physical items cannot be closed by automated tools and require explicit human completion prior to finale freeze:
1. **Physical Venue Legibility:** Physical projector legibility, contrast verification, and scaling from the back of the auditorium at Sir MVIT / NHCE.
2. **Rehearsals R1–R4:** Timed live rehearsals (SC-6: reset to audit verify in $\le 3\text{ min}$, 3 consecutive rehearsals without manual data intervention).
3. **Registration Confirmation:** Formal team confirmation of NHCE finale registration closing.
4. **Architectural & Design Decisions (OD-01 .. OD-08):** Formal Member 5 sign-offs on OD-01 (SAP technology), OD-02 (agent framework), OD-03 (UI kit), OD-04 (LLM provider), OD-05 (Phase 0 code reuse), OD-06 (regional format), OD-07 (primary legal sources), OD-08 (stretch S-1).
5. **Provisional Decisions D-021 .. D-024:** Human sign-off on agent-drafted decisions, specifically D-023 (plain CSS vs Tailwind/shadcn).
6. **Milestone Sign-Offs:** Formal sign-offs on G0 (contract freeze), D7 (feature freeze), and D9 (demo freeze / go/no-go).
7. **Demo Laptop Performance (SC-9):** Wall-clock timing log on the actual demo laptop running recorded mode (target $\le 5\text{ s}$).
8. **Backup Video Production:** Recording and staging of `pitch/finale/demo-backup.mp4` with a designated operator assigned.

---

## 4. Requirements & Non-Functional Requirements (FR-01 .. FR-28, NFR-01 .. NFR-06)

Status rubric: **Met** (fully implemented and tested), **Partial** (implemented with known gaps or latent defects), **Gap** (not implemented or failing acceptance).

| ID | Title / Summary | Pri | Owner | Status | Details & Evidence [observed / code read] |
|---|---|:---:|:---:|:---:|---|
| **FR-01** | Scenario reset and fixture loader | P0 | M3 | **Met** | **[observed]** `POST /api/v1/demo/reset` restores fixtures, resets counters, and emits `AUD-000001` (G-FLOW step 1). |
| **FR-02** | Disruption & orders impact card | P0 | M2 | **Gap** | **[observed]** Fails DA-02: SO-1001/2/3, days late, and Penang absent; ₹11,60,000 shown via un-evaluated fallback (`App.tsx:503`). |
| **FR-03** | Disruption sensing agent | P0 | M4 | **Met** | **[observed]** Maps notice to FAC-FABZ and affected orders; unresolved alias triggers `needs_review` (`VC-SENSE-01` passed). |
| **FR-04** | Route eligibility per quote | P0 | M4 | **Met** | **[observed]** Returns exactly 4 eligible supplier options matching golden options; ETD and port constraints enforced. |
| **FR-05** | Upstream dependency traversal | P0 | M4 | **Partial** | **[observed]** Traverses $\le 3$ hops with evidence paths for demo scenario; latent E3 false pass (F-01) behind graph cycles. |
| **FR-06** | Missing/unverified dependency data fails | P0 | M4 | **Partial** | **[observed]** Missing critical BOM child triggers `needs_review` (`VC-DEP-04`), but cycle-terminated path omits gap (F-01). |
| **FR-07** | Cycle-safe graph traversal | P1 | M4 | **Partial** | **[observed]** Detects cycle edge (`VC-DEP-05`), but cycle node without origin yields neither path nor gap (F-01). |
| **FR-08** | Temporal rule applicability | P0 | M5 | **Met** | **[observed]** Filters by jurisdiction, HS, publication date, status, effective interval; matches golden (`VC-RULE-01..07`). |
| **FR-09** | Equal-authority conflict handling | P0 | M5 | **Met** | **[observed]** Conflicting equal-authority rules yield `needs_review` and record conflict (`VC-RULE-03`). |
| **FR-10** | Letter of credit preflight checks | P0 | M3 | **Partial** | **[observed]** LC-01 and LC-07 tested in product; LC-02..06 implemented via reference port but lack product unit tests (F-08). |
| **FR-11** | FTA preflight & duty at risk | P0 | M3 | **Partial** | **[observed]** FTA-01/02 tested via golden flow; FTA-03 oracle-only (F-08); duty at risk not rendered in UI (F-03). |
| **FR-12** | Inventory ATP & allocation | P0 | M3 | **Partial** | **[observed]** INV-02 tested via golden flow; INV-01 and INV-03 oracle-only without product unit tests (F-08). |
| **FR-13** | Plan builder (P1 & P2) | P0 | M3 | **Partial** | **[observed]** Generates P1 (cost-and-time) and P2 (constraint-verified); LC-05 balance cap tested in oracle only. |
| **FR-14** | Financials & separate exposures | P0 | M3 | **Met** | **[observed]** Implements net avoided loss formula; exposures grouped by mutual exclusivity and reported separately. |
| **FR-15** | Plan comparison screen | P0 | M2 | **Partial** | **[observed]** Comparison view renders, but recommendation badge `"P2 · Recommended"` is hardcoded statically (F-05). |
| **FR-16** | Evidence drawer & graph highlight | P0 | M2 | **Partial** | **[observed]** Drawer renders LC and rules; graph highlights path; but duty at risk omitted and finding has no graph link. |
| **FR-17** | Decisions, roles, idempotency | P0 | M3 | **Partial** | **[observed]** Core state machine enforced; F-09 header contract self-inconsistency (403 vs 400); F-11 partial refusal audit. |
| **FR-18** | Approval UI & role switcher | P0 | M2 | **Met** | **[observed]** Role switcher updates allowed actions; Priya approves P2; blocked plan cannot be approved. |
| **FR-19** | Simulated execution | P0 | M3 | **Partial** | **[observed]** 6 simulated steps executed once; but F-06 hard-codes PO-7001, 900, LC-SYN-0117, and location fallbacks. |
| **FR-20** | Hash-chained audit log & verify | P0 | M3/M2 | **Met** | **[observed]** Append-only log; SHA-256 hash chaining; `/api/v1/audit-events/verify` re-computes and verifies 21 events. |
| **FR-21** | Agent progress timeline | P1 | M2 | **Partial** | **[observed]** 7 steps render with mode chips, but F-24 step records 1–6 are fabricated statically; status icons aria-hidden only. |
| **FR-22** | LLM gateway (live/recorded/off) | P0 | M5 | **Partial** | **[observed]** Off, recorded, and degraded fallback work identically; but OpenRouter model slug returns 404 (F-25); health status always ok (F-26). |
| **FR-23** | Grounded explanation validation | P1 | M5/M4 | **Met** | **[observed]** Validates citations against allowed evidence IDs; unknown citation falls back to template (`VC-LLM-02`). |
| **FR-24** | Raw LC text extraction vs gold | P1 | M5 | **Gap** | **[code read]** Deliberately stubbed per D-024 (provisional pending human confirmation); raw extraction omitted from live flow. |
| **FR-25** | Synthetic labelling across surfaces | P0 | M2/M1 | **Met** | **[observed]** Banner visible on all UI screens; synthetic tag in API schemas; slide deck pending M1. |
| **FR-26** | Request LC amendment action | P1 | M3 | **Met** | **[observed]** Trade compliance officer requests amendment; records `AmendmentRequest`; plan stays blocked (`VC-APR-08`). |
| **FR-27** | Simulated amendment acceptance | P2 | M3 | **Partial** | **[observed]** S-1 endpoint re-evaluates scenario, but P2 recovery cost omits ₹8,000 amendment fee (`amount_inr: 0`, F-07). |
| **FR-28** | Real SAP technology artifact | P0/P1 | M3/M5 | **Met** | **[observed]** OD-01 SAP BTP Cloud Foundry manifest and deployment instructions verified in `ops/btp/manifest.yml`. |
| **NFR-01** | Determinism across runs & modes | P0 | M3 | **Met** | **[observed]** Identical plan hashes, outcomes, and amounts across two clean runs and all three LLM modes (`SC-1`, `SC-5`). |
| **NFR-02** | Offline presentation capability | P0 | M3 | **Partial** | **[observed]** Verified in browser-blocked test (0 external requests); physical hardware unplug pending human drill. |
| **NFR-03** | OpenAPI response conformance | P0 | M3 | **Partial** | **[observed]** 56 schema examples pass; test middleware validates responses; F-09 header contract self-inconsistency noted. |
| **NFR-04** | Accessibility basics (WCAG AA) | P0 | M2 | **Partial** | **[observed]** Keyboard approval operable; F-20 Shift+Tab escapes dialog; drawer lacks Escape key; icon-only step statuses. |
| **NFR-05** | Secret isolation & clean history | P0 | M3 | **Partial** | **[observed]** Git history clean (0 secrets); but F-14 `.env` (real key) not excluded by `.dockerignore` / `.cfignore`. |
| **NFR-06** | Performance measurement | P1 | M3 | **Partial** | **[observed]** Dev machine: startup 1.65 s, eval 0.022–0.044 s; target SC-9 timing on demo laptop pending human measurement. |

---

## 5. Validation Cases Coverage (All 42 IDs)

The contract test `python tools/check_contracts.py` validates **39/39** cases against the reference oracle (`tools/aegis_oracle.py`), but never imports or tests `backend/app`. The 42 validation cases from `fixtures/validation/cases.json` are mapped against production backend test coverage as follows:

### Summary Totals
- **Direct Product Tests:** 17 cases
- **Indirect & Behavioural Coverage:** 10 cases (7 indirect via golden assertions + 3 covered by E2E flow behaviour)
- **Partial Coverage (Product Gaps / Deficiencies):** 6 cases
- **Missing Product Tests (Oracle-Only):** 9 cases
- **Total:** $17 + 10 + 6 + 9 = \mathbf{42}$ cases.
*(Note on prompt summary discrepancy: The prompt text listed "16 direct, 10 indirect/behaviour, 7 partial, 9 missing". Direct enumeration of test functions confirms 17 direct tests and 6 partial tests, both summing exactly to 42. See Section 9 for details).*

### Detailed Breakdown by Category

#### 1. Direct Product Tests (17 IDs)
1. **VC-DEP-01:** `backend/tests/test_dependency.py::test_vc_dep[VC-DEP-01]` [observed] — Unaffected candidate passes.
2. **VC-DEP-02:** `backend/tests/test_dependency.py::test_vc_dep[VC-DEP-02]` [observed] — Disrupted upstream fab blocks candidate.
3. **VC-DEP-03:** `backend/tests/test_dependency.py::test_vc_dep[VC-DEP-03]` [observed] — Unverified edge yields `needs_review`.
4. **VC-DEP-04:** `backend/tests/test_dependency.py::test_vc_dep[VC-DEP-04]` [observed] — Missing critical BOM child yields `needs_review`.
5. **VC-DEP-05:** `backend/tests/test_dependency.py::test_vc_dep[VC-DEP-05]` [observed] — Cycle detected and skipped during traversal.
6. **VC-DEP-06:** `backend/tests/test_dependency.py::test_vc_dep[VC-DEP-06]` [observed] — Traversal truncated at `max_depth` yields `needs_review`.
7. **VC-SENSE-01:** `backend/tests/test_dependency.py::test_vc_sense_01` [observed] — Unresolved supplier alias yields `needs_review`.
8. **VC-RULE-01:** `backend/tests/test_rules.py::test_vc_rule[VC-RULE-01]` [observed] — Rule with future effective date is excluded.
9. **VC-RULE-02:** `backend/tests/test_rules.py::test_vc_rule[VC-RULE-02]` [observed] — Rule active within legal date window is matched.
10. **VC-RULE-03:** `backend/tests/test_rules.py::test_vc_rule[VC-RULE-03]` [observed] — Equal-authority conflicting rules yield `needs_review`.
11. **VC-RULE-04:** `backend/tests/test_rules.py::test_vc_rule[VC-RULE-04]` [observed] — Superseded rule is excluded.
12. **VC-RULE-05:** `backend/tests/test_rules.py::test_vc_rule[VC-RULE-05]` [observed] — Draft rule is excluded.
13. **VC-RULE-06:** `backend/tests/test_rules.py::test_vc_rule[VC-RULE-06]` [observed] — Authority hierarchy precedence (official gazette > circular).
14. **VC-RULE-07:** `backend/tests/test_rules.py::test_vc_rule[VC-RULE-07]` [observed] — Knowledge cutoff date excludes later published rules.
15. **VC-LC-07:** `backend/tests/test_lc_extraction_check.py::test_vc_lc_07_mismatch_needs_review` [observed] — Raw LC text extraction mismatch yields `needs_review`.
16. **VC-LLM-01:** `backend/tests/test_llm.py::test_vc_llm_01_same_outcomes_and_hashes` [observed] — Identical plan hashes across off, recorded, and degraded live modes.
17. **VC-LLM-02:** `backend/tests/test_llm.py::test_vc_llm_02_unknown_citation` [observed] — Hallucinated citation falls back safely to template.

#### 2. Indirect & Behavioural Coverage (10 IDs)
- **Indirect Golden Equality (7 IDs):**
  18. **VC-LC-01:** `tests/e2e/test_golden_flow.py::test_golden_approval_flow` [observed] — 43T transhipment prohibited with 20(c) excluded blocks RT-C-SIN.
  19. **VC-FTA-01:** `tests/e2e/test_golden_flow.py::test_golden_approval_flow` [observed] — Direct consignment through member countries passes.
  20. **VC-FTA-02:** `tests/e2e/test_golden_flow.py::test_golden_approval_flow` [observed] — Transit through non-party without evidence yields `needs_review`.
  21. **VC-INV-02:** `tests/e2e/test_golden_flow.py::test_golden_approval_flow` [observed] — Transfer days > 0 creates stock transfer line.
  22. **VC-FIN-01:** `backend/tests/test_llm.py::test_vc_llm_01_same_outcomes_and_hashes` [observed] — Baseline penalty calculation verified via plan hash.
  23. **VC-FIN-02:** `backend/tests/test_llm.py::test_vc_llm_01_same_outcomes_and_hashes` [observed] — Duty at risk calculation verified via plan hash.
  24. **VC-FIN-03:** `backend/tests/test_llm.py::test_vc_llm_01_same_outcomes_and_hashes` [observed] — Net avoided loss formula verified via plan hash.
- **Covered by E2E Flow Behaviour (3 IDs):**
  25. **VC-APR-01:** `tests/e2e/test_golden_flow.py` step 5 [observed] — Approving blocked plan PLN-0001 refused with `422 PLAN_BLOCKED`.
  26. **VC-APR-02:** `tests/e2e/test_golden_flow.py` step 7 [observed] — Approval with stale hash refused with `409 PLAN_VERSION_STALE`.
  27. **VC-APR-03:** `tests/e2e/test_golden_flow.py` steps 8–10 [observed] — Valid approval records `DECISION_RECORDED`, replaying key yields 200, second key yields 409 `DECISION_EXISTS`.

#### 3. Partial Coverage (Product Gaps) (6 IDs)
28. **VC-APR-04:** `tests/e2e/test_golden_flow.py` step 6 [observed] — Executing unapproved plan is refused, but test tests blocked P1 rather than pending P2.
29. **VC-APR-05:** `tests/e2e/test_failure_and_determinism.py` [observed] — Execution state machine tested, but same-key execution replay remains untested.
30. **VC-APR-07:** `tests/e2e/test_endpoints.py::test_amendment_request_flow` [observed] — Rejection justification validation tested; role restrictions only partially exercised.
31. **VC-APR-08:** `tests/e2e/test_endpoints.py::test_amendment_request_flow` [observed] — LC amendment request creates request; plan stays blocked.
32. **VC-AMEND-01:** `tests/e2e/test_endpoints.py::test_amendment_request_flow` [observed] — Acceptance simulation succeeds and triggers re-evaluation, but product **fails financials**: recovery cost is ₹4,38,000 (missing ₹8,000 amendment fee) vs expected ₹4,46,000 (Finding F-07).
33. **VC-EXE-01:** `tests/e2e/test_failure_and_determinism.py::test_execution_failure_stops_later_steps_and_is_audited` [observed] — Execution step failure stops later steps and marks execution failed.

#### 4. Missing Product Tests (Oracle-Only) (9 IDs)
These cases pass in `tools/check_contracts.py` against `tools/aegis_oracle.py`, but have no corresponding automated unit tests in `backend/tests/`:
34. **VC-LC-02:** Latest shipment date expired (44C) blocks route.
35. **VC-LC-03:** Port of loading does not match 44E blocks route.
36. **VC-LC-04:** Port of discharge does not match 44F blocks route.
37. **VC-LC-05:** Partial shipment prohibited (43P) caps drawing to full amount.
38. **VC-LC-06:** Presentation period (48 + ETD) exceeds 31D expiry.
39. **VC-FTA-03:** Certificate of origin missing / not available yields `needs_review`.
40. **VC-INV-01:** Insufficient ATP above protected floor blocks inventory option.
41. **VC-INV-03:** Transfer capacity or transfer date infeasible blocks inventory option.
42. **VC-APR-06:** Acknowledging actor role mismatch yields `403 ROLE_FORBIDDEN` *(Priority P0)*.

---

## 6. System Invariants (E1 .. E12)

| Invariant | Description | Status | Evidence & Verification Details [observed / code read] |
|---|---|:---:|---|
| **E1** | Plan hash determinism & scope | **Holds** | **[observed]** Plan hash material is explicitly defined in `evaluation.py:495-516`; excludes volatile human strings, timestamps, and explanations; covers lines, findings, outcome, financials, and snapshot ID. Hashes match identically across runs. |
| **E2** | Every finding links to $\ge 1$ evidence item | **Holds (demo)** | **[observed]** `work/audit/probe.py` confirms all 31 findings across P1 and P2 resolve to valid evidence items (0 unresolved). *Latent defect noted:* F-29 in `evaluation.py:208-213` attaches empty `rule_ev = []` if no trade rule applies. |
| **E3** | Missing data is never evidence of independence | **VIOLATED** | **[observed]** Probed in `work/audit/probe2.py`. When a graph cycle exists and a node's only other supply edge is removed (e.g. VC-DEP-05 with edge E-102 `FAC-C-BDG` $\rightarrow$ `FAC-VDIE` and E-008 removed), disrupting `FAC-VDIE` results in **`passed`** (false pass) in both product and oracle! Traversal also returns `passed` when given an unknown disrupted ID (`FAC-NOT-IN-GRAPH`). See detailed analysis below. |
| **E4** | Temporal rule exclusion & precedence | **Holds** | **[observed]** Implemented in `backend/app/rules/applicability.py:18-67, 86`; correctly excludes draft, withdrawn, not yet effective, expired, and superseded rules; resolves equal-authority conflicts to `needs_review`. |
| **E5** | LC constraints strictly enforced | **Holds** | **[code read]** Verified in `evaluation.py:148-161, 169, 187-188, 377`; transhipment 43T/47A, latest shipment date 44C, loading/discharge ports 44E/44F, and presentation period 48/31D correctly block unamended options. |
| **E6** | Non-party transit requires direct consignment evidence | **Holds** | **[code read]** Verified in `evaluation.py:214-225`; non-party transit without evidence yields `needs_review` (`FND-FTA-DIRECT_CONSIGNMENT-RT-B-CMB`). *Latent defect noted:* F-28 (`worst([])` returns `"passed"`). |
| **E7** | Exposures reported separately; never added to recovery cost | **Holds** | **[observed]** Implemented in `evaluation.py:440-455`; formula enforces separation; mutually exclusive exposures are grouped, yielding worst-case exposure ₹5,10,000 for P1 (not the sum ₹8,97,600). |
| **E8** | Verified strategy respects constraints & caps drawing | **Holds** | **[observed]** Verified in `evaluation.py:324, 329-334`; greedy allocator restricts options to policy-approved outcomes and caps supplier drawing to available LC balance (`available_balance_inr // unit_price_inr`). |
| **E9** | Decisions require prerequisite roles & state machine | **Holds** | **[observed]** Steps 5–14 verify that unapproved plans cannot be executed, blocked plans cannot be approved, and role permissions are enforced. *Contract design noted:* F-34 accepts acknowledging actor from request body. |
| **E10** | Determinism: identical inputs produce identical outputs | **Holds** | **[observed]** Re-running evaluation across runs 1 and 2 produces identical plan IDs, outcomes, amounts, and SHA-256 hashes. |
| **E11** | Audit log is append-only with SHA-256 hash chaining | **Holds** | **[observed]** Maintained by application convention in `backend/app/services/audit.py` and `backend/app/main.py`; genesis block uses 64 zeros; event hash covers canonical JSON. (Enforced by convention; no DB trigger). |
| **E12** | Audit log chain verifies end-to-end | **Holds** | **[observed]** Verified via `GET /api/v1/audit-events/verify`; recomputes event hashes and links for all 21 events without error (`da-observations.json`). |

### Detailed Analysis of Invariant E3 Violation (Finding F-01)
`work/audit/probe2.py` executed a 4-variant matrix testing supplier `SUP-C` (part `PRT-PM750`):
```
product VDIE disrupted cycle=False dropE008=False: blocked  [Normal baseline]
product VDIE disrupted cycle=True  dropE008=False: blocked  [Cycle present, alternative path blocked]
product VDIE disrupted cycle=False dropE008=True:  blocked  [Alternative path dropped, baseline blocked]
product VDIE disrupted cycle=True  dropE008=True:  passed   <-- VIOLATION (False Pass)
ORACLE  VDIE disrupted cycle=True  dropE008=True:  passed   <-- Oracle shares the identical defect
ORACLE  unknown disrupted id (FAC-NOT-IN-GRAPH):   passed   <-- Disrupted ID not validated
```
**Root Cause [code read]:**
In `backend/app/agents/dependency/check.py:24-50`, the depth-first search helper `upstream_paths` appends to `paths` only when `not ins` (a terminal node with no relevant incoming edges) or `depth == max_depth`. When an incoming edge points to a node already in `pnodes` (`e["source"] in pnodes`), it sets `flags["cycle"] = True` and executes `continue`. If all incoming edges to a node form cycles, the function never recurses, never executes line 35 (`paths.append(...)`), and never executes line 34 (`flags["gaps"].append({"kind": "upstream_unknown", ...})`). As a consequence:
1. The cycle-terminated branch produces **neither a path record nor a gap**.
2. At `check.py:87`, `disrupted_paths` checks only `raw_paths`, so it never detects that the disrupted node was reached.
3. At `check.py:121`, because `disrupted_paths` is empty and `gaps` is empty, the function falls through to `outcome, reason = "passed", "NO_PATH_TO_DISRUPTED_NODE"`.
4. In addition, `disrupted_node_ids` is never validated against the graph node set (`check.py:121`), allowing unmapped/unknown facility IDs to pass silently.

*Demo Impact:* In the single demo scenario `SCN-DEMO-001`, the disrupted node is `FAC-FABZ` (Zenith Kulim Fab), and candidate `SUP-C`'s die comes from `FAC-KGUM` via `FAC-VDIE` without cycle edge `E-102`. Therefore, the demo scenario itself traverses cleanly and is unreachable by this bug.

---

## 7. Findings Ranked by Priority (P0 .. P3)

Status options: **Open** (requires developer fix), **Needs owner decision** (requires architectural or trade-off decision by designated member). Nothing was modified or fixed during this audit.

### Priority P0 (Finale Blocker)
- **F-01: False-pass in dependency traversal behind cycles and unknown disrupted IDs**
  - **File & Lines:** `backend/app/agents/dependency/check.py:24-50, 87, 121` and `tools/aegis_oracle.py:226-327` (`upstream_paths` 226, `dependency_check` 270, final `passed` at 327).
  - **Evidence:** **[observed]** `work/audit/probe2.py` matrix; cycle-only terminal node produces neither path nor gap, returning `passed` when disrupted.
  - **Owners:** M4 (MOD-05 traversal), M3 (oracle sync), M5 (`docs/00` §10.1 specification wording).
  - **Status:** **Needs owner decision** (M4/M5 must decide whether to patch pre-build or explicitly accept for the demo scenario).
- **F-02: Orders, days late, and Penang origin not rendered on Command Center** — P0 demo blocker (FR-02 is a P0 requirement; DA-02 Fail; script beat 1 cannot be shown). Expected at pre-build; scheduled M2 work.
  - **File & Lines:** `frontend/src/App.tsx:500-506`.
  - **Evidence:** **[observed]** `da-observations.json`; SO-1001/2/3, Penang, and days late are missing from the DOM.
  - **Owner:** M2 (MOD-13).
  - **Status:** **Open**.
- **F-03: Recovery cost, residual loss, worst-case exposure, and duty at risk not rendered** — P0 demo blocker (FR-15 is a P0 requirement; DA-04 Fail, DA-07 Partial; script beat 6 cannot be shown). Expected at pre-build; scheduled M2 work.
  - **File & Lines:** `frontend/src/App.tsx:513` (plan card), `:596` (approval modal shows net only), drawer `:629-657` (no exposures).
  - **Evidence:** **[observed]** `da-observations.json`; only net avoided loss is rendered on plan cards.
  - **Owner:** M2 (MOD-13).
  - **Status:** **Open**.

### Priority P1 (High Severity / Should Fix)
- **F-04: Stale red error banner persists after successful evaluation run**
  - **File & Lines:** `frontend/src/App.tsx:131, 140-156`.
  - **Evidence:** **[observed]** Screenshot `work/audit/pw/offline-command.png` shows the red banner persisting after Reset → Run. **[code read]** Mechanism: reset sets the error (`App.tsx:131`) while `evaluationId` stays `'EVAL-0001'` (`:68`). The first run after reset is also `EVAL-0001`, so `setEvaluationId` (`:146`) doesn't change state, `loadEvaluation` (`:69-80`, which clears the error at `:71`) doesn't run again, and `runEvaluation()` (`:140-156`) never clears it.
  - **Owner:** M2 (MOD-13).
  - **Status:** **Open** (Smallest, most visible cosmetic bug).
- **F-05: UI hardcodes disruption card, fallback ₹11,60,000, "P2 · Recommended", and "P0001" badge**
  - **File & Lines:** `frontend/src/App.tsx:500, 503, 505, 507, 513`.
  - **Evidence:** **[observed]** Static strings in DOM; PLN-0001 rendered as "P0001" via `.replace('PLN-', 'P')`; static recommendation before evaluation.
  - **Owner:** M2 (MOD-13).
  - **Status:** **Open**.
- **F-06: Execution steps generator hardcodes PO-7001, 900, LC-SYN-0117, and location fallbacks**
  - **File & Lines:** `backend/app/services/executions.py:20-21, 57-62, 92-97, 120, 123`.
  - **Evidence:** **[code read]** Execution generator uses hardcoded constants and computes `lc_drawing_inr` outside MOD-10.
  - **Owner:** M3 (MOD-11).
  - **Status:** **Open**.
- **F-13a: UI never triggers server refusal so UI audit list never displays refusals**
  - **File & Lines:** `frontend/src/App.tsx:513` and `da-observations.json`.
  - **Evidence:** **[observed]** Disabling the Approve button prevents triggering `422 PLAN_BLOCKED`; DA-08 and DA-11 cannot show refusals.
  - **Owners:** M2 + M5.
  - **Status:** **Needs owner decision** (decide whether to enable button and show server error modal).
- **F-14: Secret `.env` containing real API key not excluded by `.dockerignore` or `.cfignore`**
  - **File & Lines:** `.dockerignore` (9 lines) and `.cfignore` (9 lines) at the repo root; neither lists `.env`.
  - **Evidence:** **[observed]** Neither ignore file includes `.env`. Git history verified clean (`git log --all -- .env` and `-S sk-or-v1` empty).
  - **Owner:** M3 (MOD-15).
  - **Status:** **Open** (Risk of accidental credential leak on `cf push` or `docker build`).
- **F-17: Clean-clone deployment runbook missing**
  - **File & Lines:** `ops/runbook.md` (missing; cited in `docs/03-backend-spec.md:227`).
  - **Evidence:** **[observed]** `Test-Path ops/runbook.md` returns `False`.
  - **Owner:** M3 (MOD-15).
  - **Status:** **Open**.
- **F-20: Accessibility defects: focus escape, missing drawer Escape key, icon-only statuses**
  - **File & Lines:** `frontend/src/App.tsx:452-469, 524, 629`.
  - **Evidence:** **[observed]** `Shift+Tab` from focused dialog container escapes dialog; drawer lacks Escape key handler; step progress lacks text labels.
  - **Owner:** M2 (MOD-13/20).
  - **Status:** **Open**.
- **F-23a: Backup video shot list script films "44C mismatch" but 44C passes**
  - **File & Lines:** `pitch/backup-video-shot-list.md:38`.
  - **Evidence:** **[code read]** SH-7 directs camera to "44C mismatch", but 44C passes in the scenario; actual blockers are 43T and 47A.
  - **Owner:** M1 (MOD-16).
  - **Status:** **Open**.

### Priority P2 (Medium Severity)
- **F-07: LC amendment re-evaluation omits ₹8,000 amendment fee in P2 financials**
  - **File & Lines:** `backend/app/main.py:523-617` (`simulate_amendment_acceptance` never passes a fee into re-evaluation), `backend/app/services/evaluation.py:399` (`lc_amendment_fee: 0`), `:530, 539` (`extra_costs_verified` unused by callers); fee recorded only on the request at `backend/app/services/decisions.py:215`.
  - **Evidence:** **[observed]** `work/audit/amend_check.py`; P2 recovery cost is ₹4,38,000 with fee `amount_inr: 0` vs VC-AMEND-01 expected ₹4,46,000 / ₹25,000 / ₹6,89,000.
  - **Owner:** M3 (MOD-10), M5 decides fee timing.
  - **Status:** **Needs owner decision**.
- **F-08: 9 validation cases lack product unit tests (ported from oracle)**
  - **File & Lines:** `fixtures/validation/cases.json` (VC-LC-02..06, FTA-03, INV-01, INV-03, APR-06).
  - **Evidence:** **[code read]** Cases pass in `check_contracts.py` but have no test in `backend/tests/`.
  - **Owner:** M3 (MOD-19).
  - **Status:** **Open**.
- **F-09: HTTP header validation contract self-inconsistency (403 vs 400)**
  - **File & Lines:** `contracts/openapi.yaml:60-77 vs 512-518` and `backend/app/main.py`.
  - **Evidence:** **[observed]** `work/audit/probe.py`; missing header returns 403 VALIDATION_ERROR; unknown actor returns 403 on reset/evaluations but 400 on decisions.
  - **Owner:** M3 (MOD-01/02).
  - **Status:** **Needs owner decision**.
- **F-10: Error codes `AMENDMENT_ALREADY_ACCEPTED` and `LC_VERSION_STALE` not in OpenAPI schema**
  - **File & Lines:** `backend/app/main.py:559, 562` and `contracts/schemas/common.schema.json`.
  - **Evidence:** **[code read]** Returned by application endpoints but absent from the contract enum.
  - **Owner:** M3 (MOD-01).
  - **Status:** **Open**.
- **F-11: Not every API refusal is audited**
  - **File & Lines:** `backend/app/main.py`, `backend/app/services/decisions.py:124`.
  - **Evidence:** **[code read]** Header validation errors and short rejection justifications return 400/403 without writing audit events.
  - **Owner:** M3 (MOD-11).
  - **Status:** **Open**.
- **F-12: Plans marked superseded before evaluation generation succeeds**
  - **File & Lines:** `backend/app/main.py:316-327 vs 330-338`.
  - **Evidence:** **[code read]** If evaluation throws an exception, previous valid plans remain marked superseded.
  - **Owner:** M3 (MOD-03).
  - **Status:** **Open**.
- **F-13: Evaluation execution runs synchronously inside SQLite `BEGIN IMMEDIATE` transaction**
  - **File & Lines:** `backend/app/main.py:272-410`, `backend/app/db/sqlite.py:134` (`BEGIN IMMEDIATE`), `:114` (other writers wait at most `timeout=10` s).
  - **Evidence:** **[code read]** Holds database write lock for the entire duration of evaluation pipeline.
  - **Owner:** M3 (MOD-02).
  - **Status:** **Open**.
- **F-15: `python-dotenv` undeclared in requirements**
  - **File & Lines:** `requirements.txt`, `backend/requirements.txt`.
  - **Evidence:** **[code read]** Imported in `backend/app/config.py:3` but absent from requirements (imported transitively via `openapi-spec-validator`).
  - **Owner:** M3 (MOD-02).
  - **Status:** **Open**.
- **F-16: `.env.example` defaults to live mode and omits required configuration variables**
  - **File & Lines:** `.env.example:1-10`, `backend/app/config.py:3-6`.
  - **Evidence:** **[code read]** Defaults to `live`; `load_dotenv` unconditionally loads `.env` during test execution.
  - **Owners:** M5 / M3.
  - **Status:** **Open**.
- **F-18: Backup video file missing from repository**
  - **File & Lines:** `pitch/finale/demo-backup.mp4` (missing; scheduled for D8).
  - **Evidence:** **[observed]** `Test-Path pitch/finale/demo-backup.mp4` returns `False`.
  - **Owner:** M1 (MOD-16).
  - **Status:** **Open**.
- **F-19: Hand-written frontend types with drift; policies loaded from stubs in live mode**
  - **File & Lines:** `frontend/src/api/types.ts`, `frontend/src/api/client.ts:151-153`.
  - **Evidence:** **[code read]** `getPolicies()` returns static stub even when `VITE_API_MODE=live`.
  - **Owner:** M2 (MOD-13).
  - **Status:** **Open**.
- **F-21: Plan status badge derives CSS colour from outcome but displays status text**
  - **File & Lines:** `frontend/src/App.tsx:513`, `frontend/src/App.css:443-458` (`.plan-status` classes); `not_applicable` findings styled via `.finding-outcome` at `App.css:779`.
  - **Evidence:** **[code read]** Status class derived from `plan.outcome === 'passed'`, while inner text is `fullPlan?.status`.
  - **Owner:** M2 (MOD-13).
  - **Status:** **Open**.
- **F-24: Evaluation steps 1–6 fabricated statically with zero duration and no timeouts**
  - **File & Lines:** `backend/app/services/evaluation.py:585-600`.
  - **Evidence:** **[code read]** Definitions 1–6 are hardcoded as `succeeded` with `attempts: 1` and `duration_ms: 0`.
  - **Owner:** M3 (MOD-03).
  - **Status:** **Open**.
- **F-25: Live model slug returns 404 at OpenRouter**
  - **File & Lines:** local untracked `.env` (`AEGIS_LLM_MODEL=meta-llama/llama-3.3-70b-instruct:free`; value read earlier in this audit, file not printed); `.env.example:9` defaults to `gpt-4o-mini`. Free slugs `nvidia/nemotron-3.5-lightning:free` and `liquid/lfm-2.5-2.6b:free` returned 200 when probed.
  - **Evidence:** **[observed]** Free tier endpoint slug is no longer routed by OpenRouter.
  - **Owner:** M5 (MOD-12).
  - **Status:** **Needs owner decision**.
- **F-26: Health endpoint status unconditionally returns "ok"**
  - **File & Lines:** `backend/app/main.py:182`.
  - **Evidence:** **[code read]** `{"status": "ok"}` hardcoded regardless of database connectivity.
  - **Owner:** M3 (MOD-02).
  - **Status:** **Open**.
- **F-28: Latent bugs: `worst([])` returns `"passed"`; missing MFN rate risks `KeyError` in exposure basis**
  - **File & Lines:** `backend/app/services/evaluation.py:36-39, 244, 424`.
  - **Evidence:** **[code read]** Empty outcomes return `"passed"`. `duty_at_risk` returns `(None, None)` when `tariff_mfn` is missing (`evaluation.py:244-245`), but the exposure basis string at `:424` indexes `rates['tariff_mfn']` directly, so an incomplete rules set risks a `KeyError` rather than a clean `needs_review`.
  - **Owner:** M3 (MOD-08).
  - **Status:** **Open**.
- **F-29: Latent bug: `FTA.RULE_APPLICABILITY` attaches 0 evidence IDs when no rule applies**
  - **File & Lines:** `backend/app/services/evaluation.py:208-213`.
  - **Evidence:** **[code read]** Can emit empty evidence IDs list, violating schema `minItems: 1`.
  - **Owner:** M3 (MOD-08).
  - **Status:** **Open**.
- **F-34: Acknowledging actor ID trusted from request body by contract design**
  - **File & Lines:** `backend/app/services/decisions.py:100-116`.
  - **Evidence:** **[observed]** `USR-PRIYA` can submit approval asserting `USR-ARJUN` as acknowledging actor in body (tested in `probe_ack.py`; matches VC-APR-06 step 3).
  - **Owners:** M3 / M5.
  - **Status:** **Needs owner decision**.
- **F-23b: Agent-written documentation asserts unconfirmed decisions and fictitious IDs**
  - **File & Lines:** `docs/M5-part-c-blocked.md:47`, `ops/btp/README.md:5`.
  - **Evidence:** **[code read]** Claims decisions made by agents ("per D-023"); cites nonexistent tokens (`tokens.css`, `OD-15`, `AIGIS-115`); claims BTP is "Not yet deployed" while M5 doc claims deployed.
  - **Owners:** M5 / M1 / M3.
  - **Status:** **Open**.

### Priority P3 (Low Severity / Polish)
- **F-27: Dead code in routing agent and LLM service**
  - **File & Lines:** `backend/app/agents/routing/agent.py:transhipment_countries`, `backend/app/llm/service.py:PROMPT_SPEC`.
  - **Evidence:** **[code read]** Unused helper functions and registry constants.
  - **Owner:** M4 / M5.
  - **Status:** **Open**.
- **F-30: Potential comparison null dereference in frontend**
  - **File & Lines:** `frontend/src/App.tsx:503-509, 530`.
  - **Evidence:** **[code read]** `evaluation?.comparison.baseline_loss_inr` (missing optional chaining on `.comparison`).
  - **Owner:** M2.
  - **Status:** **Open**.
- **F-31: `render.yaml` contains unquoted `off`**
  - **File & Lines:** `render.yaml:11-12`.
  - **Evidence:** **[code read]** `value: off` parses as boolean `false` in standard YAML parsers.
  - **Owner:** M3.
  - **Status:** **Open**.
- **F-32: Vacuous hash assertion in E2E amendment test**
  - **File & Lines:** `tests/e2e/test_endpoints.py:152` (`before_hash` = PLN-0002, the P2 hash of EVAL-0001) and `:163` (asserts EVAL-0002 `plans[0]`, the P1 hash, differs from it). P1 and P2 hashes always differ, so the assertion can't fail.
  - **Evidence:** **[code read]** Compares P1 plan hash of EVAL-0002 against P2 plan hash of EVAL-0001.
  - **Owner:** M3.
  - **Status:** **Open**.
- **F-33: E2E test suite executes against default demo SQLite database**
  - **File & Lines:** `client` fixtures at `tests/e2e/test_endpoints.py:10`, `tests/e2e/test_failure_and_determinism.py:12`, `tests/e2e/test_golden_flow.py:23` (no `tests/conftest.py` exists); none override `AEGIS_DB_PATH`, so they use the default `work/aegis-demo.sqlite3` (`backend/app/config.py:8`).
  - **Evidence:** **[code read]** Modifies `work/aegis-demo.sqlite3` directly rather than an isolated temporary database.
  - **Owner:** M3.
  - **Status:** **Open**.
- **F-35: CI container health loop does not fail on timeout**
  - **File & Lines:** `.github/workflows/ci.yml:58`.
  - **Evidence:** **[code read]** `for i in $(seq 1 30); do curl -fs localhost:8000/api/v1/health && break; sleep 1; done` exits with 0 even if loop exhausts without break.
  - **Owner:** M3.
  - **Status:** **Open**.

---

## 8. Changes Made During Audit

- **Tracked Files:** **NONE.** No tracked files in `contracts/`, `fixtures/`, `backend/`, `frontend/`, `tools/`, `ops/`, or `pitch/` were modified. No `git add`, `git commit`, or `git push` was performed.
- **New File Created:** `docs/reviews/demo-readiness-2026-10-23.md` (this report).
- **Gitignored Scratch Artifacts:** Staged in `work/audit/` (covered by `.gitignore:12` `work/` rule):
  - `work/audit/flow_runner.py`, `flow_off.json`, `flow_recorded.json`, `flow_live_unreach.json`
  - `work/audit/probe.py`, `probe2.py`, `probe_ack.py`, `amend_check.py`
  - `work/audit/pw/da.spec.ts`, `offline.spec.ts`, `pw.config.ts`, `da-observations.json`, and associated screenshots
  - `work/audit/clone/` (isolated clean clone for Docker verification)
- **Pre-Audit Disclosure:** Prior to launching this audit, commit `7e37ad2` was pushed to `origin/main` to format step 7 errors as a schema-compliant `StepError` object (`backend/app/services/evaluation.py:657-658`). No regression test was committed for this change. The untracked local `.env` file was toggled from `AEGIS_LLM_MODE=live` to `AEGIS_LLM_MODE=off`.

---

## 9. Items Not Verified & Artifact Discrepancies

### Unverified Items
1. **Physical Hardware / Venue:** Physical ethernet unplug, Wi-Fi disabling, and projector display from auditorium distance (human physical actions).
2. **Live LLM Execution with Working Model:** No API credits were expended against commercial providers; live model slug `meta-llama/llama-3.3-70b-instruct:free` currently returns 404 at OpenRouter.
3. **SAP BTP Cloud Foundry Redeploy:** Cloud Foundry CLI login (`cf login`) requires human interactive credentials; the running trial instance predates commit `7e37ad2` (acceptable while demo mode is `off`).
4. **Python 3.12 test suites:** pytest suites ran under local Python 3.14.3 only. Under Python 3.12 only the API flow was exercised (against the clean-clone Docker image, row above); pytest was not rerun inside the image this session.
5. **Automated Axe Accessibility Audits:** Formal automated axe scans were not executed on S2 (progress), Evaluations, S6 (execution), S7 (audit), S5 variants (acknowledgements), or SUP-C graph view.
6. **Code-Read Items:** Items designated as **[code read]** were verified via static code inspection rather than dynamic unit or end-to-end execution.
7. **Slide Deck Verification (DA-14):** Slide decks in `pitch/round1` and `pitch/finale` are not yet created.
8. **Render Deployment:** `render.yaml` configuration was not deployed to Render.

### Artifact Discrepancies
- **Section 5 Validation Cases Count Discrepancy:** The prompt's initial summary line listed *"Totals: 16 direct, 10 indirect/behaviour, 7 partial, 9 missing"*. Enumerating the actual test functions in `backend/tests/` yields **17 direct** test cases (`test_vc_dep` $\times 6$, `test_vc_sense_01` $\times 1$, `test_vc_rule` $\times 7$, `test_vc_lc_07_mismatch_needs_review` $\times 1$, `test_vc_llm_01_same_outcomes_and_hashes` $\times 1$, `test_vc_llm_02_unknown_citation` $\times 1$) and **6 partial** test cases (`VC-APR-04`, `VC-APR-05`, `VC-APR-07`, `VC-APR-08`, `VC-AMEND-01`, `VC-EXE-01`). The artifact total remains exactly **42** ($17 + 10 + 6 + 9 = 42$).

---

## 10. Next Actions per Team Member

### Member 1 (M1 — Research, Deck, Rehearsals)
- [ ] Draft finale slide deck using numbers sourced directly from `fixtures/expected/` goldens; lock all slide figures.
- [ ] Correct Beat SH-7 in `pitch/backup-video-shot-list.md:38`: film the 43T transhipment prohibition and 47A exclusion, not "44C mismatch".
- [ ] Capture and stage the offline demo backup video (`pitch/finale/demo-backup.mp4`) by D8.
- [ ] Correct rehearsal and dry-run dates in `pitch/rehearsal-log.md`.
- [ ] Execute formal Demo Acceptance runs DA-01 .. DA-15 on D7 and D9.

### Member 2 (M2 — UI/UX & Frontend)
- [ ] **Fix F-04 immediately (Smallest, most visible fix):** In `frontend/src/App.tsx:140-156`, add `setEvaluationError('')` inside `runEvaluation()` so the stale red alert box clears on evaluation.
- [ ] **Fix F-02:** Render orders SO-1001, SO-1002, SO-1003, days late (6, 4, 2), and origin "Penang" on the Command Center disruption card (`App.tsx:500-506`).
- [ ] **Fix F-03:** Render recovery costs (₹3,34,000 / ₹4,92,000), residual loss (₹50,000), worst-case exposure (₹5,10,000), and duty at risk (₹3,87,600) on plan cards and evidence drawer (`App.tsx:513, 596`).
- [ ] **Fix F-05:** Remove hardcoded fallback `?? 1160000`, remove hardcoded recommendation badge, and fix PLN-0001 badge formatting (show "P1" instead of "P0001").
- [ ] **Fix F-20:** Trap keyboard focus inside approval dialog when `Shift+Tab` is pressed from container; bind `Escape` key to close the evidence drawer; add visible/accessible text labels to step progress statuses.
- [ ] **Fix F-19:** Regenerate frontend types from `contracts/openapi.yaml` via `openapi-typescript`; load policies from live backend API rather than stubs.
- [ ] **Fix F-21:** Align status badge pill styling with status rather than outcome.
- [ ] Run automated Axe accessibility scans across all screens to ensure WCAG 2.2 AA compliance.

### Member 3 (M3 — Backend, Tooling, Deployment)
- [ ] **Fix F-14 immediately:** Add `.env*` (keeping `!.env.example`) to the root `.dockerignore` and `.cfignore` before any deployment.
- [ ] **Fix F-17:** Author `ops/runbook.md` detailing clean-clone setup, environment configuration, and execution.
- [ ] **Fix F-06:** Generalize execution step generator in `backend/app/services/executions.py`: eliminate hardcoded PO-7001, 900, LC-SYN-0117, and location fallbacks.
- [ ] **Fix F-08:** Add automated product unit tests in `backend/tests/` for the 9 oracle-only validation cases (prioritizing P0 case VC-APR-06).
- [ ] **Fix F-09 / F-10:** Reconcile OpenAPI header error responses (400 vs 403); declare `AMENDMENT_ALREADY_ACCEPTED` and `LC_VERSION_STALE` in `ErrorCode` enum.
- [ ] **Fix F-11:** Ensure all 4xx/409/422 refusal paths write an audit log event.
- [ ] **Fix F-12:** Defer marking plans as superseded until after evaluation generation completes successfully.
- [ ] **Fix F-15:** Explicitly declare `python-dotenv` in `requirements.txt` and `backend/requirements.txt`.
- [ ] Assist Member 4 in updating the oracle reference implementation for F-01.

### Member 4 (M4 — GraphRAG & Routing)
- [ ] **Fix F-01 in `backend/app/agents/dependency/check.py`:** Update `upstream_paths` so that a cycle-terminated traversal emits an `upstream_unknown` gap when the node is not an origin; validate `disrupted_node_ids` against graph nodes and reject unmapped facility IDs; author new regression test case `VC-DEP-07`.
- [ ] Coordinate with Member 3 to update `tools/aegis_oracle.py::dependency_check` to maintain oracle-product parity.
- [ ] Clean up dead code in F-27 (`routing.transhipment_countries`, `PROMPT_SPEC`).

### Member 5 (M5 — Decisions, Governance, Review)
- [ ] **Architectural Decisions:**
  - **F-01:** Formally decide whether to patch F-01 pre-build or explicitly accept it as a known non-blocker for the demo scenario.
  - **F-07:** Decide timing of the ₹8,000 LC amendment fee application (at acceptance vs at execution).
  - **F-13a / DA-08:** Decide whether the UI should permit clicking Approve on blocked plans to display the server's `422 PLAN_BLOCKED` refusal message.
  - **F-34:** Confirm whether trusting client-asserted acknowledging actor ID in the decision request body is acceptable by contract design.
- [ ] Formally review and confirm provisional decisions D-021 .. D-024 (including D-023 plain CSS).
- [ ] Correct agent-generated claims of finalized decisions in documentation (F-23b).
- [ ] Select final demo LLM mode (strongly recommend `off` for rock-solid deterministic presentation); update model slug (F-25) if `live` mode is chosen.
- [ ] Key hygiene: rotate OpenRouter API key after finale (or immediately if any git/docker build occurred from a dirty working copy).
- [ ] Sign off on Go / No-Go verdict.

### Repository Owner
- [ ] Following Member 3's fix of F-14 (`.dockerignore` and `.cfignore`), rebuild `frontend/dist` and execute `cf push -f ops/btp/manifest.yml` to refresh the SAP BTP Cloud Foundry demonstration app.

## Addendum — post-audit fixes (2026-10-23, evening, uncommitted)

On the user's instruction, findings were fixed after the audit above was taken; sections 1–10 still describe HEAD `7e37ad2`.

- **Fixed:**
  - **F-01:** cycle-only incoming edges now end a path (leaf check before depth check); a disrupted id that isn't in the graph gives `needs_review DISRUPTED_NODE_UNKNOWN`. The change is in both the product and the oracle, and on the demo graph the patched oracle matches HEAD across all 594 supplier × part × node × depth 1–6 combinations.
  - **F-02, F-03, F-05, F-21, DA-03 text, DA-13:** done in `App.tsx` and `App.css`.
  - **F-04, F-07:** P2 after amendment is now 446,000 / 25,000 / 689,000.
  - **F-14, F-16, F-17:** added `ops/runbook.md`.
  - **F-23:** the three stale docs are corrected.
  - Tests were added for F-01, for F-07, and a regression test for `7e37ad2`.
- **Re-run (all exit 0):**
  - `check_contracts`: PASSED.
  - Test suites: backend 74 passed, `tests` 7 passed, `tsc` and lint clean, Playwright stub 10 passed, Playwright live 1 passed.
  - Flow: `off 2` gives 16/16 twice with the same P1/P2 hashes as before.
  - Browser walks (`da.spec`, `offline.spec`), run on a live-mode build: DA-02 and DA-04 all values present; DA-07 shows ₹3,87,600; no stale alert; Escape and Shift+Tab are trapped correctly.
- **Verdict after fixes: GO WITH RISKS.** No P0 is open. Still outstanding: the remaining P1s (F-06, F-13a, F-20) and all Human-only items.
- **Docker:** an image built from the working tree (`aegis-audit:mvp`) passes the flow 16/16 twice with 0 schema issues and serves the UI (200). The image contains only `/srv/aegis/.env.example`, so `.env` is excluded (F-14 confirmed). The BTP redeploy is still pending.
