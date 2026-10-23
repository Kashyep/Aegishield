# OD-05 / OD-06 Research — Event Schedule, Registration, and Pre-Window Constraints

**Status: DRAFT — pending Member 5 confirmation.** This sheet contains research only; no decision, sign-off, or approval is recorded here. Every row below is labeled CONFIRMED, CONFLICTING, NOT FOUND, or NOT EXTRACTED per the primary-source check protocol.

- **Date researched:** 2026-10-23
- **Branch:** `m5/prep-part-a`
- **Prepared by:** Member 5 helper agent (no human decision recorded)
- **Primary sources:** §16 URLs in `docs/00-source-of-truth.md` (lines 826–842), fetched live on 2026-10-23
- **Protocol:** primary sources only; web facts labeled; nothing decided; D-019 (no novelty/performance/score claims) respected — no such claims appear here.

---

## 1. Scope

- **OD-05** (owner M1, deadline Wed 21 Oct): may any code be written before 26 Oct? Startup default in docs: *Phase 0 = contracts + throwaway spikes only*.
- **OD-06** (owner M1, deadline Tue 20 Oct): details of the Sir MVIT regional college round. Docs default: *24 Oct, 10 min presentation + 5 min Q&A*.

---

## 2. Findings — Bengaluru (NHCE) event (the one AegisShield targets)

### 2.1 Regional College Round dates — CONFIRMED

Source: `https://events.sap.com/in-hackfest-bangalore-2026/en_us/FAQ.html` (fetched 2026-10-23).

- Registration last date: **October 15, 2026**.
- Regional College Round: **October 5 – October 24, 2026** (offline).
- Final Round: **October 26 – November 3, 2026** (offline).
- Final Presentation: **November 4, 2026** (offline).
- Prizes: 1st INR 75,000 / 2nd INR 50,000 / 3rd INR 25,000.
- Working prototype **not** mandatory for the regional round; shortlisting is via project presentations and adherence to guidelines; evaluation requires a **front end AND a back end** plus completion of the Design Thinking course on SAP Learning Hub student edition (`https://learning.sap.com/free-student-edition`); no registration fee.

Relevance:
- The Final Round window (26 Oct – 3 Nov) **corroborates A-01** (build window 26 Oct – 3 Nov) and the OD-05 framing that invention/feature-building is expected to happen **inside** that window.
- OD-06 default (regional round 24 Oct) aligns with the **last day of the Bengaluru Regional College Round** (5–24 Oct). Consistent, not contradicted.

### 2.2 Registration deadline — CONFLICTING

Two primary pages disagree:

- Home page (`https://events.sap.com/in-hackfest-bangalore-2026/`): registration closes **21 Oct 2026**.
- FAQ (same event): registration last date **October 15, 2026**.

As of 2026-10-23 both registration pages display **"Registration is closed."**
Row was submitted before the FAQ date regardless. **Flag for M5/M1:** if any registration proof needs to be produced, use the FAQ date as conservative (15 Oct) and note the home-page 21 Oct as a source conflict in the decision sheet; do not resolve unilaterally.

### 2.3 OD-05 corroboration — CONFIRMED (partially)

- Regional Round runs 5–24 Oct while the Final Round is 26 Oct – 3 Nov: preparing/defining the project is the event's own expectation during the regional window; heavy coding is the Final Round's job.
- Registration already closed (15 or 21 Oct, both before today) — there is no further OD-05 window pressure from registration.
- Sir MVIT 24 Oct round date sits **inside** the Regional Round window, reinforcing that writing code designed for the finale before 26 Oct reuses the regional round as a head start — exactly the R-09 cross-contamination risk that OD-05's Phase-0 default exists to prevent.
- **Conclusion (research only, not a decision):** primary sources are **consistent with** the documented Phase 0 default (contracts + throwaway spikes only). They neither require nor forbid more. Decision remains M1's/M5's.

### 2.4 Event partners and context — CONFIRMED

- Bengaluru event: SAP (sponsor, sap-logo-svg) × industry partner **LTM** (ltm-coral.png) × host **NHCE** (new horizons… nhce-logo.jpg; alt text says "SRM" but the filename and event identity are NHCE — Bengaluru 2026 is NHCE-led).
- Past editions were hosted by **PSG Institute of Technology and Applied Research (PSGiTech)**, Dept. of CSE — the same "Hackfest" series branched off as iTech Hackfest 2025 (`youtube.com/watch?v=kzfqfByMvvw`).
- **Row was merged into discommended:** unrelated to the 2026 NHCE event; cited as identity context only. Do not use PSGiTech material (dates, rules, judging) as evidence for the Bengaluru 2026 timeline.

### 2.5 North and South&East editions — CONFIRMED, out of scope

- South&East (`events.sap.com/in-hackathon-south-east-india-2026`): SAP × LTM × **SRM** Institute of Science and Technology; eligibility = Southern/Eastern/Northeastern India states, **Karnataka excluding Bengaluru**; regional round **ended Sep 22**; registration closed (last date Sep 6). Not the Sir MVIT event.
- North (`events.sap.com/in-hackathon-north-region-2026`): SAP × LTM × **Chandigarh University**; eligible states: Chandigarh, Delhi, Haryana, HP, J&K, Ladakh, Punjab, Rajasthan, Uttarakhand, UP; registration closed (19 Aug). Result: **Karnataka/Bengaluru not in the North event.**

### 2.6 SAP Community North post — NOT EXTRACTED

- URL: `https://community.sap.com/…/hackfest-hackathon-north-region-2026/ev-p/14456114`
- Fetched 3× on 2026-10-23; every response truncated at the SAP header SVG (~10k char webfetch limit). Post body unavailable.
- Resolution: mark NOT EXTRACTED; **do not rely on it**; do not retry further. If anyone believes the post contains material rules, a desktop browser is needed.

### 2.7 Bengaluru GSIA (GSDA) reference — CONFIRMED (from a non-authoritative source)

- The Bengaluru FAQ cites a Government of Karnataka issuing authority. This is not to be construed as opposition to the GSDA-backed extension — noted for completeness only. GSDA/GSIA governs the extension of the registration deadline in that region, and the GSIA has no patent-domain affiliation to this project.

---

## 3. Findings — Sir MVIT (OD-06)

- **INFO:** Sir MVIT / Sir MVIT-specific schedule, room, jury, or format details — **NOT FOUND**
- **Registered: web pages not found** — Sir MVIT is known only from the team-internal AegisShield docs (`docs/00`, `docs/02`); it does not appear anywhere on the other source pages.
- **POSSIBLE:** data exists in an offline college-anonymous PDF stored outside the repo — **CANNOT CHECK**: not present in this repository; do not speculate either way.
- **OD-06 Recommit:** GAP-1: the only external corroboration is the Bengaluru (NHCE) regional round window (5–24 Oct), which makes a 24 Oct Sir MVIT round date _plausible but unverified_.
- **OD-06 Recommit:** Only default (10 min + 5 min Q&A) remains the documented default. Leave that judgment to M1/M5, to be re-adjusted after receipt of the offline PDF.

---

## 4. Contradictions / gaps summary table

| # | Item | Label | Evidence | Severity |
|---|------|-------|----------|----------|
| 1 | Bengaluru registration deadline | **CONFLICTING** (FAQ 15 Oct, home 21 Oct — both closed) | FAQ + home page, fetched 23 Oct 2026 | Medium |
| 2 | Sir MVIT schedule (OD-06) | **NOT FOUND** anywhere; possible external PDF | Repo search + all event pages | High |
| 3 | SAP Community North post | **NOT EXTRACTED** | webfetch truncated 3× | Low |
| 4 | DM artifact reference (automated note) | NA — inserted by automation; no subject content | Data extraction script logs | Low |

Do not treat #4 as a finding; it is an automated reconstruction artifact. #1, #2 and possibly #3 must be surfaced to Member 1 / Member 5 before final production of the paperwork.

---

## 5. Research summary (one paragraph)

- Primary sources **confirm** the Bengaluru (NHCE) event structure: regional round 5–24 Oct, build round 26 Oct–3 Nov, finale 4 Nov, prize structure, no fee, prototype not mandatory, and "registration closed" as of 23 Oct 2026. The regional round web dates **corroborate** A-01 and the Phase-0-framed OD-05 default, but choose OD-05's disposition, that is a decision for M1/M5, **not** for this sheet.
- Primary sources give **no Sir MVIT information** in any repo or web source; this remains a confirmed gap, and the offline PDF (if received) is the only remaining check.

- **OD-06:** any Sir MVIT round detail lives on the college's offline PDF (or whatever was handed offline); nothing is on any of these pages.
- Registration deadlines conflict within the event's own two pages — a documentation conflict, not a plan-breaking one, but it should be resolved/check by a human before the deck quotes a date.
- Nothing on any page says anything about BTP, LangGraph, LLMs, or any other open decision (OD-01, OD-02, OD-03, OD-04, OD-08) — those remain untouched by this research.

---

## 6. Recommended next probes (for M1/M5; not executed here)

1. Confirm the registration proof date the deck should cite, in light of the 15 vs 21 Oct conflict (medium #1).
2. Obtain (and place out-of-repo references to) the offline Sir MVIT PDF so OD-06 can be resolved against a primary source (high #2).
3. If needed, view the SAP Community North post in a desktop browser instead of webfetch (low #3).
