# R1 Evidence Index (Pre-Review Pack)

**Status: DRAFT: pending Member 5 confirmation.**
Prepared by: Member 5 · 2026-10-23 · Branch `m5/prep-part-a` · HEAD verified `729d50e`
Purpose: map each R1 review claim to a file:line anchor that was re-verified at HEAD
`729d50e` with Read/Grep tooling, and register negative findings honestly (NOT FOUND
stays NOT FOUND; no guessing).

Verification rule: only anchors marked **VERIFIED** in this index have been re-read at
HEAD; anything under "To verify at R1" has not been re-confirmed and must be checked
before citing in the live review.

---

## 1. Verified anchor set

### App shell, navigation and modes
| # | Claim | Anchor | Status |
|---|-------|--------|--------|
| 1 | App imports layer (single page-module entry) | `frontend/src/App.tsx:2–6` | VERIFIED |
| 2 | Currency formatting helper `money` | `frontend/src/App.tsx:9` | VERIFIED |
| 3 | Mock-LLM `displayOutcome` switch | `frontend/src/App.tsx:10–15` | VERIFIED |
| 4 | Health fetch on load (`/health` → badges) | `frontend/src/App.tsx:102–105` | VERIFIED |
| 5 | LLM mode + badge state (`llmMode`, `llmBadge`) | `frontend/src/App.tsx:107–108` | VERIFIED |
| 6 | Evaluation polling: 120 × 500 ms, "did not finish within 60 seconds" | `frontend/src/App.tsx:110–118` | VERIFIED |
| 7 | App shell + sidebar (nav map `~483–487`, LLM badge rendered at 488) | `frontend/src/App.tsx:478–489` | VERIFIED |
| 8 | Topbar render points / actor select | `frontend/src/App.tsx:492` | VERIFIED |
| 9 | Synthetic-data banner | `frontend/src/App.tsx:494` | VERIFIED |
| 10 | Command Center section start; **pull-graph gating begins here** (NOT 483) | `frontend/src/App.tsx:496` | VERIFIED |

### Error, status and live-region elements
| # | Claim | Anchor | Status |
|---|-------|--------|--------|
| 11 | `executionError` announced via `role="alert"` | `frontend/src/App.tsx:515` | VERIFIED |
| 12 | Evidence panel element | `frontend/src/App.tsx:516` | VERIFIED |
| 13 | Evaluation-progress gate for `role="status"` | `frontend/src/App.tsx:521–522` | VERIFIED |
| 14 | Evaluation-progress block: `aria-live="polite"`, `aria-atomic="true"` | `frontend/src/App.tsx:524` | VERIFIED |
| 15 | Execution panel `aria-live="polite"` | `frontend/src/App.tsx:537` | VERIFIED |
| 16 | Facility details: `aria-live="polite"`, `aria-label="Selected facility details"` | `frontend/src/App.tsx:568` | VERIFIED |
| 17 | Amendment note `role="status"` | `frontend/src/App.tsx:621` | VERIFIED |
| 18 | `policiesError` `role="alert"` | `frontend/src/App.tsx:623` | VERIFIED |
| 19 | Stub-mode note | `frontend/src/App.tsx:624` | VERIFIED |
| 20 | `decisionError` `role="alert"` with typed codes PLAN_VERSION_STALE / PLAN_SUPERSEDED / DECISION_EXISTS and "Reload current plan" recovery | `frontend/src/App.tsx:625` | VERIFIED |
| 21 | Approve action buttons | `frontend/src/App.tsx:626` | VERIFIED |

### Navigation module
| # | Claim | Anchor | Status |
|---|-------|--------|--------|
| 22 | `Screen` union includes `evaluation-progress` (full 31-line file read) | `frontend/src/app/navigation.ts:1` | VERIFIED |
| 23 | `navItems` excludes evaluation-progress from sidebar | `frontend/src/app/navigation.ts:3` | VERIFIED |
| 24 | `readScreenFromHash` default `'command'` | `frontend/src/app/navigation.ts:24–27` | VERIFIED |
| 25 | `writeScreenToHash` | `frontend/src/app/navigation.ts:29–31` | VERIFIED |

### Dependency graph component
| # | Claim | Anchor | Status |
|---|-------|--------|--------|
| 26 | Graph layout constants: ROLE_COLUMN, ROW_ORDER, NODE_W 205, NODE_H 88, COL_X `[28, 344, 670, 980]` | `frontend/src/components/DependencyGraph.tsx:4–10` | VERIFIED |
| 27 | `STATUS_TAG` record | `frontend/src/components/DependencyGraph.tsx:12–18` | VERIFIED |
| 28 | `PATH_KIND`, `OUTCOME_TEXT` (passed / needs_review / blocked) | `frontend/src/components/DependencyGraph.tsx:19–24` | VERIFIED |
| 29 | `layoutGraph` defined | `frontend/src/components/DependencyGraph.tsx:26` | VERIFIED |
| 30 | Component props | `frontend/src/components/DependencyGraph.tsx:42–49` | VERIFIED |
| 31 | `focusEdgeIds` | `frontend/src/components/DependencyGraph.tsx:52` | VERIFIED |
| 32 | Blocked path literal `shared_disrupted_dependency` | `frontend/src/components/DependencyGraph.tsx:55` | VERIFIED |
| 33 | Focus rail: `.graph-focus` div `role="group"` | `frontend/src/components/DependencyGraph.tsx:59–62` | VERIFIED |
| 34 | Candidate focus buttons use `aria-pressed` | `frontend/src/components/DependencyGraph.tsx:61` | VERIFIED |
| 35 | Verdict live region: `.dependency-verdict`, `aria-live="polite"`, `aria-label="Dependency check result"` | `frontend/src/components/DependencyGraph.tsx:63` | VERIFIED |
| 36 | Verdict text from `OUTCOME_TEXT[result.outcome]` | `frontend/src/components/DependencyGraph.tsx:64` | VERIFIED |

> DependencyGraph.tsx lines 66–119 (render body) were truncated during reading and are
> NOT verified. Layout/props/semantic attributes (26–36) are unaffected. If the live
> review cites node styling or marker internals from 66–119, re-read first — see §2.

### API client
| # | Claim | Anchor | Status |
|---|-------|--------|--------|
| 37 | `requireLiveMode` throws "unavailable in fixture mode" | `frontend/src/api/client.ts:48–52` | VERIFIED |
| 38 | `unsupportedLiveOperation(operation: string): never` | `frontend/src/api/client.ts:54–56` | VERIFIED |

### Styling (App.css, fully read to EOF; 1030 lines)
| # | Claim | Anchor | Status |
|---|-------|--------|--------|
| 39 | Responsive breakpoints: `max-width: 1000px` (531) and `max-width: 700px` (549, 963) | `frontend/src/App.css:531, 549, 963` | VERIFIED |
| 40 | Legend dots: disrupted #c24135, affected #d98a16; `.graph-legend` at 693 | `frontend/src/App.css:693–696` | VERIFIED |
| 41 | Graph scroll container `overflow-x: auto`; **`.supply-graph` min-width 760px** at line 700 | `frontend/src/App.css:699–700` | VERIFIED |
| 42 | Edge classes: `.graph-edge` edge-disrupted #c24135 w3; is-connected #0a6ed1 w3.5 | `frontend/src/App.css:701–706` | VERIFIED |
| 43 | Dimming: `.graph-edge.is-dimmed, .graph-node.is-dimmed` opacity .26 | `frontend/src/App.css:707` | VERIFIED |
| 44 | **Focus ring**: `.graph-node:focus-visible rect, .graph-node.is-selected rect` stroke #0a6ed1 width 3 | `frontend/src/App.css:711` | VERIFIED |
| 45 | Node text sizes: tag 9px, label 12px, meta 10px | `frontend/src/App.css:712–714` | VERIFIED |
| 46 | Disrupted node rect #fff5f3 / #c24135 w2.5 | `frontend/src/App.css:715` | VERIFIED |
| 47 | Node tag/meta fills | `frontend/src/App.css:958–961` | VERIFIED |
| 48 | `prefers-reduced-motion` block | `frontend/src/App.css:985–992` | VERIFIED |
| 49 | Focus rail flex row + focus buttons: `.active` #0a6ed1, `:focus-visible` outline 3px #5eafff | `frontend/src/App.css:995–998` | VERIFIED |
| 50 | Verdict variants: `.blocked` (#c24135/#fff5f3), `.passed` (#1f7a45/#f1faf4), `.needs_review` (#d98a16/#fff9ed) | `frontend/src/App.css:999–1005` | VERIFIED |
| 51 | Edge line styles: edge-path #c24135 w4; edge-focus #0a6ed1 w2.5; edge-candidate dashed 7 5 | `frontend/src/App.css:1011–1013` | VERIFIED |
| 52 | Marker arrows: default/candidate #73879d, path #c24135, focus #0a6ed1 | `frontend/src/App.css:1014–1016` | VERIFIED |
| 53 | Status-scoped node variants: disrupted (1017–1018), blocked dashed (1019), candidate_passed (1020–1021), affected_primary (1022–1023), buyer (1024) | `frontend/src/App.css:1017–1024` | VERIFIED |
| 54 | Misc tail: `.evidence-paths code` (1026), `.llm-badge` (1027), `.demo-controls` (1028), `.amendment-section` (1029–1030) | `frontend/src/App.css:1025–1030` | VERIFIED |

Adjusted draft claim (edit applied): "media queries at `@media`" → breakpoints at
App.css 531 / 549 / 963, replacing the earlier unverified line numbers.

---

## 2. To verify at R1 (not yet re-read)

| Item | Where | Why |
|------|-------|-----|
| DependencyGraph.tsx render body (marker internals, node class composition) | `DependencyGraph.tsx:66–119` | Truncated read; claims touching these lines are unsourced. Layout + semantic attributes above are sufficient for R1. |
| App.css middle gap | `App.css:717–949` | Not blocking — all GraphView claims already covered by verified regions; re-read only if a new claim is added. |
| App.tsx lines outside cited regions (e.g. 19–101, 129–477, 525–567, 569–619) | `frontend/src/App.tsx` | Only cite with a fresh Read; not needed for the R1 packet. |

---

## 3. Negative findings (registered, NOT gaps)

| Claim | Result | Where checked | Status |
|-------|--------|---------------|--------|
| `aria-selected` used anywhere in `frontend/src` | **NOT FOUND** — zero matches; the pre-review index statement "NOT FOUND" is confirmed | Grep across `frontend/src/*.tsx/*.ts` at HEAD 729d50e | CONFIRMED ABSENT |
| Literal status codes `403|409|422` hard-coded in frontend/src error paths | **NOT FOUND** — only incidental match is binary `frontend/src/assets/react.svg`; error paths use `ApiError` + `role="alert"` (App.tsx 515/623/625) | Grep OU-network | CONFIRMED ABSENT |
| `frontend/src/styles/tokens.css` | Does not exist; styling lives entirely in `App.css` | File check | CONFIRMED ABSENT |
| `frontend/src/lib/` (labels/format helpers referenced by docs/02) | Directory does not exist — docs/02 §claim re `lib/labels.ts` / `lib/format.ts` is stale; flag at R1 with correction to App.tsx:9 formatting | File check | CONFIRMED ABSENT |
| OD-06 "Sir MVIT" source | **NOT FOUND** | Prior research round | NOT FOUND — never guess |

---

## 4. Wireframe-to-code traceability (R1 input)

| Wireframe | Approx. first-claim anchor | Status |
|-----------|----------------------------|--------|
| S1 Command Center | `frontend/src/App.tsx:496` (section start, includes pull-graph gate) | VERIFIED anchor |
| S2 Sidebar/shell navigation | `frontend/src/App.tsx:478–489` + `frontend/src/app/navigation.ts:1–31` (full file verified) | VERIFIED anchors |
| S3 Evidence panel run | `frontend/src/App.tsx:515–516` | VERIFIED anchors |
| S4 Evaluation progress + execution | `frontend/src/App.tsx:521–524, 537` | VERIFIED anchors |
| S5 Facility details (+ change plan / actions) | `frontend/src/App.tsx:568, 620–627` | VERIFIED anchors |
| S6 Dependency graph (comparison card mock) | `frontend/src/components/DependencyGraph.tsx:4–64` + `frontend/src/App.css:690–716, 995–1030` | VERIFIED anchors |
| S7 Amendment / policies / decision errors | `frontend/src/App.tsx:621–626` | VERIFIED anchors |

Wireframe-to-anchor mapping (~483–487 nav, ~488 badge) is anchor-level rather than
run-level; associate to panels only after the timed walkthrough. C1 verdict:
**PASS (statically plausible) — timed walkthrough required at R1.**

---

## 5. Open queries (human/non-fast-input)

| Query | Reference | Ongoing state |
|-------|-----------|---------------|
| EVAL-0001 sampled fixtures — full tail not read / not expected to prove | New-regulation coverage tail beyond head only; final decision = human ask at R1 | Deferred: not actionable without transcript check |
| LLM live-mode credentials (`AEGIS_LLM_BASE_URL` etc.) | OD final decisions + Part C gating | BLOCKED: secret input only, no side-channel |
| Sir MVIT naming-level procurement source | OD-06 | NOT FOUND: final proof = human ask |
| Registry date contradiction (FAQ 15 Oct vs home page 21 Oct) | Prior research rounds | Needs human probe of home page |

---

## 6. Index maintenance

- Any claim upgraded from "To verify" to "VERIFIED" requires a fresh Read/Grep at the
  current HEAD — line numbers are valid only for `729d50e`.
- Negative findings are never upgraded to positives without a re-run.
- ON HOLD: nothing; revise freely within commits on this branch while PR #8 is open.
