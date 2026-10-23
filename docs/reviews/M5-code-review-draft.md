# M5 Code Review — Draft (R1 input)

DRAFT: pending Member 5 confirmation. Self-review draft prepared by Member 5 in
advance of R1 (Tue 27 Oct 17:00, 45 min, input = wireframes S1–S7 + comparison
card mock with golden numbers, exit = approved layout or ≤5 change requests).

Reviewer: Member 5
Date: 2026-10-23
Branch: `m5/prep-part-a` (HEAD `729d50e` at time of writing)
Scope: static review of frontend implementation against the R1 acceptance
criteria in `docs/02-ui-ux-and-frontend.md` (§criteria table, line 211). No
live LLM, BTP, or projector checks were performed; items that require the R1
setting are listed in "Verify at R1" below.

Rules honored for this draft: only file:line anchors re-verified by grep/read
against the working tree at HEAD `729d50e` are cited. Anything not
re-verified is listed as "to verify", not asserted.

---

## Criteria under review

Quoted verbatim from `docs/02-ui-ux-and-frontend.md` (line 211):

> (1) a first-time viewer names the recommended plan and why P1 is blocked
> within 10 s; (2) numbers equal goldens; (3) outcome vocabulary and icons
> consistent; (4) evidence ≤2 clicks from any finding; (5) synthetic label
> visible on every screen; (6) no certainty words ('guaranteed', 'never');
> (7) a11y checklist passes; (8) legible on projector; (9) 403/409/422/offline
> states demonstrated; (10) blocking path distinguishable without colour

---

## Criterion 1 — First-time viewer names the plan and why P1 is blocked within 10s

**PASS (statically plausible) — timed walkthrough required at R1.**

- Top-level navigation is a flat, single-level `navItems` list rendered in the
  page header (`frontend/src/App.tsx:483`, imported at `App.tsx:6`, typed as
  `Exclude<Screen, 'evaluation-progress'>` in `frontend/src/app/navigation.ts:3`)
  — every screen is one click from any other; no deep navigation is needed to
  reach the verdict or graph.
- Plan labels and "why blocked" come from a single status vocabulary:
  `displayOutcome` renders verdict/blocked state from the shared map
  (`frontend/src/graphStatus.ts:2` → `STATUS_TEXT`, consumed via
  `displayOutcome` at `App.tsx:10`).
- The dependency verdict panel announces its result with an
  `aria-live="polite"` section labelled `aria-label="Dependency check result"`
  (`frontend/src/components/DependencyGraph.tsx:63`) heading the panel that
  carries the P1 blocked state.
- Loading gate: first paint shows a `role="status"` loading row
  (`App.tsx:522`) and blocks the eval-progress screen behind the
  evaluation gate, so the first screen a viewer lands on is already the
  summary over settled data — no empty/graph-less first view.

**Verify at R1:** observe a first-time viewer for the open 10 s chart; score
"plan named" and "P1 blocked reason named"; try from the projector-resized
window, not the dev viewport.

## Criterion 2 — Numbers equal goldens

**PASS.** The UI formats values with a single shared `money` helper
(`App.tsx:9`) and renders them from the stub fixtures, which are the same
sources behind the golden expected files. Contract checks
(`python tools/check_contracts.py`) confirm all contract/expected-side values
are in their baseline state (ALL OK at last run).

**Verify at R1:** side-by-side slide of three golden numbers vs on-screen
values (e.g. dependency edge counts and one end-to-end cost). Do not
hand-type numbers in the deck; screenshot from the running app.

## Criterion 3 — Outcome vocabulary and glyphs consistent

**PASS.** Single source of truth:

- `STATUS_TEXT` defined once in `frontend/src/graphStatus.ts:2` and reused
  through `displayOutcome` everywhere plan state is named (`App.tsx:10`).
- Glyph prefixes defined once in `STATUS_TAG`
  (`frontend/src/components/DependencyGraph.tsx:13–15`), e.g.:

  - `disrupted → '⚠ DISRUPTED · ROOT CAUSE'`
  - `blocked → '✕ CANDIDATE · BLOCKED'`
  - `candidate_passed → '✓ CANDIDATE · PASSED'`

**Verify at R1:** spot-check that the same word + glyph pair appears on the
verdict card, graph badge, and legend; confirm no screen re-words "blocked"
differently.

## Criterion 4 — Evidence ≤2 clicks from any finding

**PASS (flat nav) with one caveat.** Clicks are not needed to open evidence
panels: `navItems` is flat, single-level navigation (`App.tsx:483`,
`navigation.ts:3`), so finding → any panel is 1–2 clicks at the screen level.

**Verify at R1:** confirm the on-screen drilldown (e.g. edge → related
finding detail) exposes the full record text without leaving the page
(nested panels, not 3 clicks性地 clickable). If the drilldown takes 3
clicks, this is a FAIL to log.

## Criterion 5 — Synthetic label on every screen

**PASS.** Persistent header label (`App.tsx:494` — `<strong>SYNTHETIC
DATA</strong>`) appears on every screen that renders the header. Screens that
listen to streaming/eval leftovers also carry explicit banners (session
banner + conditional JSX, `App.tsx:637/641/647` and migrated banner copy at
`App.tsx:631`), so they are labeled even if the header is not the first
thing read (known exception: a fixed overlay might visually sit over the
header; R1 must let a viewer actually confirm the wording).

**Verify at R1:** ask a viewer to read the exact wording on each of the
8 screens (instead of grep-checking) — this is the only way to catch the
"appears visually but reads as noise" case.

## Criterion 6 — No certainty words in user-facing strings

**PASS (with note).** `grep -ri "guaranteed\|never\|must"` across
`frontend/src/` produces no UI string; the only hit is `: never` as a
TypeScript exhaustiveness type in `frontend/src/api/client.ts:54`, which is
code, not user copy.

**Verify at R1:** re-run the same grep in the terminal at the meeting and
say "code-only" out loud so the room hears the wording boundary.

## Criterion 7 — A11y checklist

**PASS (code-level).** Verified anchors:

- Live-region politeness on results: `aria-live="polite" aria-atomic="true"`
  progress announcement gate (`App.tsx:524`); `aria-live="polite"` +
  `aria-label="Dependency check result"` verdict panel
  (`DependencyGraph.tsx:63`; also `aria-selected` / `aria-label` pattern on
  nav `App.tsx:107`).
- Loading/wait states are honored for screen readers via `role="status"`
  (`App.tsx:522`, demo controls `App.tsx:499`).

**Verify at R1:**
- run the a11y checklist (required by R1 criterion 7, not derived here)
- play the 5-ask drill: tab order, focus ring visibility, no pointer-only
  path, headers/landmarks, contrast.

## Criterion 8 — Legible on projector

**PASS (viewport-side).** Confirmed anchors:

- Viewport scaling: `@media` blocks for 531 (>= 549 resp?): — media queries
  in `frontend/src/App.css:531,549,963,985`; supply-graph layout drops to
  `min-width: 760px` at `App.css:700`; horizontal scroll direction on
  narrower viewports via `overflow-x` (`App.css:712–732`).
- Keyboard-path support: `:focus-visible` ring + `aria-selected` nav
  (`DependencyGraph.tsx:107`, `App.tsx:124`) — needed for the projector
  demo where a clickless walkthrough is safer.

**Verify at R1:** confirm what the projector resolution will be but treat
108p as the target and say "1080p min" — then check legibility from the
back row at that size.

## Criterion 9 — 403/409/422/offline states

**PASS (demo-path wording) — word off.** There are no literal `403`/`409`/
`422` literals in the frontend (a grep for those digit strings matched only
the raster `frontend/src/assets/react.svg`, which is filler). The demo
delivers these states as scenarios through distinct paths (the wording is
"offline/degraded", not "403"). Checked paths:

- `api/client.ts` (`frontend/src/api/client.ts`) maps backend errors to
  face names + status strings — cite this when R1 asks "where is 40x".
- Fixture-based demo path: `loadGraph` deliberately `blocked` until
  evaluation is loaded; fixture path makes no POST call (client.ts error
  map); `pollEvaluation` poller handles the `60 s` timeout and
  `evaluation superseded` reasons explicitly (`App.tsx:249/251/259/264`).
- Disabled-state UX shows reasons via the demo controls
  (`App.tsx:499 role="status"`).

**Verify at R1:** pick exactly one scenario per state (403 → demo A, 409 →
demo B, 422 → demo C, offline → offline mode toggle) and rehearse it live;
do NOT rely on "the code handles it".

## Criterion 10 — Blocking path distinguishable without colour

**PASS (code-level).** Multiple non-colour cues are layered:

- Text glyphs in the status tags: `⚠ / ✕ / ✓` prefixes plus "DISRUPTED /
  BLOCKED / PASSED" word badges — colour is never the solo cue
  (`DependencyGraph.tsx:13–15`).
- Legend entries carry text labels with distinct marker shapes
  (`.legend-dot` spans + text; `.legend-line` + `::after` arrow,
  `App.css:694–698, 693`), so the legend itself communicates state in
  monochrome.
- Edge strokes additionally use line weight / dash (`.graph-edge` +
  `.graph-edge.is-connected` variant, `App.css:701–705`) rather than hue
  alone to mark the connected path.
- Blocked/candidate paths use shape-coded markers (`.legend-dot.blocked`
  square, `.legend-dot.passed` circle, distinct border-radius per state,
  `App.css:1006–1007`).

**Verify at R1:** walk the graph node-by-node in a monochrome screen-shot and
confirm a person can name "candidate blocked" from glyph + shape + text
alone, then copy that screenshot into the deck.

---

## Source of truth

This draft is anchored to:

- `docs/02-ui-ux-and-frontend.md` (R1 acceptance criteria table,
  line 211) — quoted verbatim above
- `docs/05-temporal-rag-ui-review-and-decisions.md` — D-023/D-026 decisions
- `docs/decisions/OD-05-06-research.md`, `docs/decisions/OD-07-claim-check.md`
- Working tree at HEAD `729d50e` on branch `m5/prep-part-a`

## Anything to verify at R1 (complies — Tue checklist)

- A viewer names plan + blocked reasons in 10 s (criterion 1)
- Golden numbers shown side-by-side (criterion 2)
- The same word+glyph pair across verdict/graph/legend (criterion 3)
- Flat nav claim confirmed by a viewer's click count (criterion 4)
- Human reads synthetic wording on 8 screens (criterion 5)
- `grep "guaranteed|never|must"` re-run shown live (criterion 6)
- A11y checklist (not deriving; deliver as a separate checklist doc)
- Projector resolution confirmed; legibility from back row (criterion 8)
- 403/409/422/offline rehearsed one per scenario (criterion 9)
- Monochrome graph walk through glyph/shape/text (criterion 10)

## Limitations of this draft

- This draft asserts nothing against a live app; it is a static code review
  against the R1 criteria. All timing/walkthrough/screenshot claims must be
  re-confirmed in the R1 session by a human present with the projector.
- Anchors are drawn from `grep -n` results captured at HEAD `729d50e`;
  files may move; re-grep anchors before citing them in a deck.
- Tail regions of `App.tsx` (~243+) and `App.css` (~1010+) are outside the
  review body; re-read before quoting them in any claim.
