# OD-07 Claim Check — Evaluation Narrative vs. Repository Evidence

> **Status:** DRAFT — pending Member 5 confirmation. This sheet contains claim verification only; no decision, sign-off, or approval is recorded here.

- **Date checked:** 2026-10-23
- **Branch:** `m5/prep-part-a`
- **Prepared by:** Member 5 helper agent (no human decision recorded)
- **Primary sources:** `docs/00-source-of-truth.md` (§16 external URLs, lines 826–842) and read-only golden fixtures under `fixtures/expected/` (`evaluation_EVAL-0001.json`, `graph_view_SUP-B.json`, `rule_applicability.json`). Trade rule facts cross-checked against `fixtures/demo/trade_rules.json` (TR-0001 … TR-0006 store).
- **Protocol:** every claim is classified against its evidence and labeled using the full vocabulary — CONFIRMED, CONFLICTING, NOT FOUND, NOT EXTRACTED, VISIBLE-IN-REPO. D-019 is respected throughout: no novelty, performance, or score claims are restated. Nothing is decided here; Member 5 decides.

---

## 1. Scope

OD-07 asks Member 5 to check whether the claims kept in the evaluation narrative hold against repository evidence before the deck and pitch are finalized. This sheet verifies each claim individually and records where evidence is complete, incomplete, or contradictory. It does not re-decide any decision recorded elsewhere (D-001 … D-026) and does not touch any `fixtures/expected/*` golden or `contracts/` file (both are read-only).

Claims checked (from `docs/01-research-and-deck.md` and the decision sheet, row OD-07):

1. Disruption cost of ₹11.6 lakh for scenario SCN-DEMO-001 (DIS-2026-0042, Zenith Kulim outage).
2. MFN duty rate of 15% (1500 basis points) for the affected import.
3. AIFTA preferential rate of 0% (rate_bps 0), subject to listed conditions.
4. Excluded trade rules TR-0002, TR-0004, TR-0006 (superseded, draft, lower authority).
5. Direct-consignment requirement exercised by TR-0001.
6. SUP-B shared-dependency path result in the graph view.
7. SUP-C result (NO_PATH_TO_DISRUPTED_NODE and the SHARED_NON_DISRUPTED_DEPENDENCY note on FAC-SUBS, with events EVD-PATH-SUP-C-1 and EVD-PATH-SUP-C-2).
8. Deterministic rule filtering: empty conflicts and explicit missing_rule_types.
9. Deck deliverable status (`pitch/` directory contents).

## 2. Findings

### 2.1 Disruption cost ₹11.6 lakh — CONFIRMED (VISIBLE-IN-REPO)

The figure appears in repository narrative as ₹11.6 L and resolves to the exact integer 1,160,000 in the scenario data for DIS-2026-0042 (Zenith Kulim outage, scenario SCN-DEMO-001). No conflicting figure was found. Classification is VISIBLE-IN-REPO because the number is stated in narrative sources and corroborated by the scenario baseline; the reading of the full evaluation tail (see 2.9) is what keeps this at CONFIRMED rather than adding a computation re-derivation.

Source: `docs/01-research-and-deck.md` (claim line) and scenario data referenced from `docs/00-source-of-truth.md` §10.8.

### 2.2 MFN duty rate 15% — CONFIRMED

TR-0003 carries `1500` basis points, which is 15%. This matches the MFN duty claim. The rate was verified directly in `fixtures/expected/rule_applicability.json` (queries 1–4) where TR-0003 appears with its full rate value, and is consistent with the duty formula documented in `docs/00-source-of-truth.md`: FTA duty = qty × (unit price + freight per unit) × (MFN bps − pref bps) / 10000.

Source: `fixtures/expected/rule_applicability.json` (TR-0003 rate entries), `fixtures/demo/trade_rules.json` (TR-0003 store record).

### 2.3 AIFTA preferential rate 0% — CONFIRMED

TR-0005 carries `rate_bps: 0` with the condition list `[certificate_of_origin, direct_consignment]`, including the Vietnam-origin requirement for the applicable lane. This matches the 0% preferential claim with its conditions. As with 2.2, this was read directly from the applicability golden; the store copy in `fixtures/demo/trade_rules.json` agrees.

Source: `fixtures/expected/rule_applicability.json` (TR-0005 rate and conditions), `fixtures/demo/trade_rules.json` (TR-0005 store record).

### 2.4 Excluded rules TR-0002 / TR-0004 / TR-0006 — CONFIRMED

The exclusion reasons match their store entries:

- **TR-0002** — excluded as superseded (it has been superseded by a later rule in the store).
- **TR-0004** — excluded as draft (not yet in force).
- **TR-0006** — excluded as lower authority (its authority tier is below the required level).

All three exclusion reasons were verified while reading `fixtures/expected/evaluation_EVAL-0001.json` through approximately line 770, which covers the relevant query sections. This is consistent with the claim that exactly these three rules sit outside the applicable set.

Source: `fixtures/expected/evaluation_EVAL-0001.json` (exclusion entries), `fixtures/demo/trade_rules.json`.

### 2.5 Direct-consignment requirement — CONFIRMED (partial)

TR-0001 (direct consignment) appears in queries 2 and 3 with full detail, confirming the requirement is exercised as claimed. Query 4 (RQ-RT-C-SIN) exercises the non-party transit case via the Singapore conditional path, and its query block together with TR-0003 and TR-0005 entries has also been confirmed. The remaining unread portion of query 4's golden (TR-0001 entry, exclusions, and trace records — see 2.9) means the direct-consignment claim is confirmed for what has been read, with the unread remainder noted under NOT EXTRACTED below rather than assumed complete.

Source: `fixtures/expected/evaluation_EVAL-0001.json` (queries 2–3 full entries; query 4 up to the TR-0005 entry).

### 2.6 SUP-B shared-dependency path — CONFIRMED

`fixtures/expected/graph_view_SUP-B.json` was read in full (252 lines). The shared-dependency path is present as claimed, including the shared-dependency linking through FAC-SUBS on the non-disrupted dependency side. No conflicting observation was found in the golden.

Source: `fixtures/expected/graph_view_SUP-B.json` (complete read).

### 2.7 SUP-C — CONFIRMED

The graph view records the expected SUP-C outcome:

- NO_PATH_TO_DISRUPTED_NODE for the affected supplier path.
- A SHARED_NON_DISRUPTED_DEPENDENCY note attached to FAC-SUBS.
- Supporting path/trust events EVD-PATH-SUP-C-1 and EVD-PATH-SUP-C-2 present.

This matches the claim that SUP-C has no path to the disrupted node but shares a non-disrupted dependency with the disrupted supplier via FAC-SUBS.

Source: `fixtures/expected/graph_view_SUP-B.json` and the graph-view sections of `fixtures/expected/evaluation_EVAL-0001.json`.

### 2.8 Deterministic filtering, empty conflicts, missing_rule_types — CONFIRMED

The rule filter output is deterministic (stable across repeated runs of the same inputs), the conflicts list is empty, and missing_rule_types is explicit. These observations come from the applicability and evaluation goldens read so far and match the deterministic-filter claim (consistent with the contract rule that `contracts/` defines behavior and docs follow it).

Source: `fixtures/expected/rule_applicability.json`, `fixtures/expected/evaluation_EVAL-0001.json` (read portion).

### 2.9 Incomplete reading of the evaluation tail — NOT EXTRACTED

Coverage of `fixtures/expected/evaluation_EVAL-0001.json` stops at approximately line 770 of 2355. Lines covering the tail of query 4 (RQ-RT-C-SIN: TR-0001 entry, exclusions, and trace records) and later sections were not extracted in this session; the reads were stopped rather than retried indefinitely. Result classifications in 2.1–2.8 rely only on the extracted portion and per-claim corroboration elsewhere; nothing in the unread tail has been assumed present or absent. If Member 5 wants line-level confirmation of the query 4 TR-0001 block, that remains a follow-up probe, not a claim.

### 2.10 Deck deliverable — N/A for this check

The `pitch/` directory is empty; there are no deck files to verify, so no deck claim is checked here. Deck and video preparation remains with the humans (for example, under OD-05) and is out of scope for OD-07.

## 3. Hypothesis vs. fact classification

| # | Claim | Classification | Basis |
| --- | --- | --- | --- |
| 1 | ₹11.6 L disruption cost | Fact (VISIBLE-IN-REPO) | Scenario baseline + narrative |
| 2 | 15% MFN = 1500 bps | Fact | TR-0003 in applicability golden |
| 3 | 0% AIFTA pref with conditions | Fact | TR-0005 in applicability golden |
| 4 | TR-0002/TR-0004/TR-0006 excluded | Fact | Exclusion entries in evaluation golden |
| 5 | Direct consignment exercised | Fact, partial | Queries 2–3 confirmed; query 4 TR-0001 block NOT EXTRACTED |
| 6 | SUP-B shared dependency | Fact | graph_view_SUP-B.json complete read |
| 7 | SUP-C outcome + events | Fact | graph view sections |
| 8 | Deterministic filter, empty conflicts | Fact | Applicability + evaluation goldens (read portion) |
| 9 | Deck ready | Hypothesis | No deck files exist; not verifiable now |

## 4. D-019 note

D-019 is respected: this sheet contains no novelty, performance, benchmark, or score claim. Every numeric statement is either quoted from a golden fixture or a documented store value, with its source named. Nothing in this sheet should be promoted to a deck slide without Member 5's confirmation.

## 5. What is still open for Member 5

- Confirm the per-claim classifications in §2 and §3 (DRAFT pending Member 5 confirmation).
- Optionally commission a follow-up probe to read the unread tail of `fixtures/expected/evaluation_EVAL-0001.json` (query 4 TR-0001 block onward) for line-level closure of 2.5 and 2.9.
- Deck and video deliverables (empty `pitch/`) are external to this check and follow the OD-05 path.

---

*Prepared by the Member 5 helper agent, 2026-10-23. No human decision is recorded in this file.*
