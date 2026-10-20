# Member 1 — Research, Evidence and Pitch Lead

| | |
|---|---|
| Role | Research and presentation lead. **No coding responsibilities.** |
| You own | MOD-16 (research, evidence register, Round 1 deck, finale deck, demo narration, judge Q&A) |
| You also do | Run the demo acceptance checklist as independent tester (MOD-18, accountable: Member 5); run OD-01, OD-05, OD-06, OD-07 research |
| Reviewer of your work | Member 5 (final say on claims and scope) |
| Canonical facts | `docs/00-source-of-truth.md`. Never restate a number from memory; copy it from §10.8 or `fixtures/expected/`. |

---

## 1. The project in five sentences
AegisShield AI helps a manufacturer recover from a supply disruption without creating a second problem. A cost-and-time optimiser proposes a recovery plan; AegisShield checks whether the "alternate" supplier depends on the same broken factory, whether the new route breaks the letter of credit or the FTA conditions, and whether stock can cover the gap. It then shows two plans side by side with honest money: what each costs, what loss remains, and what is only at risk. A human approves one plan; execution is simulated; every step is logged in a tamper-evident audit trail. Everything in the demo is synthetic (see `docs/00` §12).

### Words you will use on stage
| Term | Say it like this |
|---|---|
| Letter of credit (LC) | "The bank's promise to pay the supplier if the shipping documents match the agreed terms." |
| 43T / 47A | "The LC field that says transhipment is not allowed, and the extra clause that removes the usual container exception." |
| Transhipment | "Moving the container to another ship at an intermediate port, here Colombo or Singapore." |
| AIFTA / direct consignment | "India and ASEAN give lower duty if goods travel directly, or through other countries only under strict conditions that must be proven." |
| Tier-2/tier-3 | "Our supplier's supplier, and the next level up." |
| GraphRAG | "We trace supplier chains as a graph and only let the AI explain paths we have actually proven." |
| Temporal RAG | "We pick the law that is in force on the import date, from the right authority, before any AI reads it." |
| Needs review | "We don't know enough to say yes, so a person decides." |
| Exposure | "Money that might be lost if a risky assumption fails — shown separately, never hidden inside cost." |

---

## 2. Mission and boundaries
**Mission.** Make judges understand, in ten minutes, why this problem matters to real people, why our design is trustworthy, and why it fits SAP's Domain, Tech and Business lenses — without a single claim we cannot defend.

**You own:** research plan and evidence register; personas and empathy maps; Business Model Canvas; Round 1 deck and script; finale deck and demo narration; judge Q&A bank; rehearsal log; event logistics (registration, venue, travel).

**Others own (do not redefine):** numbers and formulas (Member 3, canonical in `docs/00` §10); graph story details (Member 4); rule and LC wording in the product (Member 5); screens and screenshots (Member 2); scope and final wording calls (Member 5).

---

## 3. Deliverables, locations and dependencies

| ID | Deliverable | Location | Due | Depends on |
|---|---|---|---|---|
| M1-D1 | Registration confirmation for all 5 members (Hackfest + Learning Hub student edition) | `pitch/logistics.md` | **Tue 20 Oct** (deadline 21 Oct) | each member |
| M1-D2 | Research plan + evidence register v1 | `pitch/evidence-register.md` (seed: §5 below) | Wed 21 Oct | — |
| M1-D3 | Answers for OD-05, OD-06 | decision log in `docs/05` §9 (Member 5 records) | Tue 20 / Wed 21 Oct | college coordinator |
| M1-D4 | OD-01 research note (what "SAP technologies" means for our finale; what our Learning Hub access includes) | `pitch/od-01-sap-tech.md` | Wed 21 Oct | coordinator, Learning Hub |
| M1-D5 | Personas, empathy maps, interview notes | `pitch/personas.md` | Thu 22 Oct | 3–5 interviews |
| M1-D6 | Business Model Canvas | `pitch/bmc.md` + slide | Thu 22 Oct | §7 |
| M1-D7 | Round 1 deck v1 + speaker notes | `pitch/round1/` | Thu 22 Oct; final Fri 23 Oct | M2 mock screens, M3/M4 diagram input |
| M1-D8 | Judge Q&A bank | `pitch/qa-bank.md` | Fri 23 Oct; v2 D4 | all |
| M1-D9 | Finale deck + 3-minute demo narration | `pitch/finale/` | v1 D3, numbers locked D6, final D9 | goldens, live app |
| M1-D10 | Rehearsal log + backup demo video | `pitch/rehearsal-log.md`, `pitch/finale/demo-backup.mp4` | D8 | working app |
| M1-D11 | Demo acceptance runs #1 and #2 | `pitch/rehearsal-log.md` | D7, D9 | app |

**Inputs you consume (read-only):** `docs/00` §1, §3, §10.8, §12; `fixtures/expected/evaluation_EVAL-0001.json` (`comparison` block = deck numbers); `fixtures/expected/graph_view_SUP-B.json` (`text_alternative` = path sentence); Member 2's mock screens; Member 5's decision log.

---

## 4. Research plan

| Question | Why it matters | Method | Sources to try first | Output | Due |
|---|---|---|---|---|---|
| RQ-1 What exactly must the finale show to count as "using SAP technologies"? What does our Learning Hub access include (practice systems, BTP trial, SAP Build/Joule Studio)? | Finale eligibility risk R-01 | Ask college coordinator and SAP contact in writing; check Learning Hub student zone | Official event page, coordinator email | OD-01 note | Wed 21 Oct |
| RQ-2 Is development before 26 Oct allowed? May we reuse code written before? | Rules risk R-09 | Ask coordinator | Event guidelines | OD-05 | Wed 21 Oct |
| RQ-3 Sir MVIT round date, format, judging rubric, SAP approval status | Pitch prep | Coordinator | College circular | OD-06 | Tue 20 Oct |
| RQ-4 How do planners and compliance teams actually coordinate a reroute? Who signs off? | Personas, empathy maps | 3–5 short interviews (30 min): a logistics/supply planner, a freight forwarder or customs broker, a bank trade-finance officer, a supply-chain faculty member | LinkedIn alumni, faculty contacts | Interview notes, quotes (with permission, anonymised) | Thu 22 Oct |
| RQ-5 Primary-source wording for: UCP 600 Art. 20 transhipment, ISBP 821 on excluding 20(c), MT700 field tags, AIFTA Rule 8 direct consignment, AIFTA party list, India's rate-of-duty date rule | Defend C3–C5 in Q&A | Library/ICC publications, CBIC notifications, SWIFT standards | ICC, CBIC, SWIFT | Evidence register entries upgraded to primary | Fri 23 Oct (OD-07) |
| RQ-6 How do companies get tier-2/3 supplier data today? | Top judge question | Desk research + interview | Supplier declarations, audits, trade records | Q&A answer with sources | Fri 23 Oct |
| RQ-7 What do SAP's own products offer here (IBP, TM, GTS, Ariba, Joule agents)? | Avoid "SAP already does this" trap and avoid wrong claims | SAP Help/official product pages only | sap.com, help.sap.com | One-line verified capability per product, or "unverified – don't mention" | Thu 22 Oct |
| RQ-8 What are other Hackfest 2026 teams building? | Differentiation without novelty claims | Public repos already found (see `docs/00` §18) | GitHub | Differentiation slide notes | Thu 22 Oct |

**Interview guide (keep to 20–30 minutes; record notes, not audio, unless consent):**
1. Tell me about the last time a supplier or shipment was delayed. What did you do in the first two hours?
2. Who else had to agree before you changed a supplier or a route? How did they find out?
3. Have you ever fixed one problem and created another (a document mismatch, duty, a customer issue)?
4. How do you know where your supplier's parts come from?
5. What would make you trust a system's recommendation? What would make you ignore it?
6. Who would pay for a tool like this, and from which budget?

Ethics: ask consent; anonymise; never present an interviewee's employer or a quote as an endorsement.

---

## 5. Evidence register (seed — maintain in `pitch/evidence-register.md`)
Status: **V-P** verified primary/official · **V-S** verified secondary · **U** unverified · **SYN** synthetic.

| ID | Claim | Status | Source (see `docs/00` §18) | May we say it on stage? | Action / owner / due |
|---|---|---|---|---|---|
| E-01 | Registration closes 21 Oct 2026; Learning Hub sign-up mandatory per student | V-P | Bengaluru event page | Yes | M1 confirm all registered by 20 Oct |
| E-02 | Regional round evaluates ideas only, no prototype required; Round 1 is Design Thinking + BMC | V-P | Bengaluru page | Yes | — |
| E-03 | Shortlist 25 Oct (top 5 per college round); finale 4 Nov at NHCE | V-P | Bengaluru page | Yes | — |
| E-04 | Finale needs a working prototype that uses SAP technologies | V-P for North/South-East pages; U for Bengaluru | regional pages | Only after RQ-1 | M1 by 21 Oct |
| E-05 | Theme suggests five agent roles and human approval for high-stakes decisions | V-P | Hackfest 2026 page | Yes | — |
| E-06 | SAP looks at problems through Domain, Tech and Business lenses | V-P | SAP Community event page | Yes | — |
| E-07 | Sir MVIT pitch 24 Oct, 10 + 5 minutes | U | PDF p.9 | Internal only | RQ-3 |
| E-08 | In MT700, 43T = transhipment, 43P = partial shipments, 44C = latest date of shipment | V-S | iotafinance; ICC eUCP briefing | Yes, as "MT700 field 43T" | RQ-5 upgrade |
| E-09 | UCP 600 Art. 20(c): a B/L may show transhipment even if the credit prohibits it when goods are containerised under one B/L | V-S | ICC Forum; Southampton lecture | Yes, paraphrased | RQ-5 |
| E-10 | A prohibition usually needs 20(c) excluded to be effective (ISBP) | V-S (draft text) | ISBP 821 draft | Say "ICC practice notes indicate…" only after RQ-5 | RQ-5 |
| E-11 | AIFTA direct consignment allows non-party transit only under conditions | V-S | India 2009 rules reproduction | Yes, paraphrased | RQ-5 upgrade to CBIC |
| E-12 | India's applicable duty rate is tied to bill-of-entry / entry-inwards timing | U | — | No (we say "import date" and that it is simplified) | RQ-5 |
| E-13 | SAP BTP trial supports Python apps on Cloud Foundry; HANA Cloud has a trial | V-P | SAP Developers tutorials | Yes | — |
| E-14 | Students can get SAP Build with Joule Studio via Learning Hub | V-S (Ukraine programme) | SAP News Ukraine | Not for India until confirmed | RQ-1 |
| E-15 | SAP says deterministic systems of record remain essential for control and auditability in agentic supply chains | V-P (SAP News, Jun 2026) | SAP News | Yes, paraphrased, cite | — |
| E-16 | Other Hackfest 2026 teams built multi-agent supply-chain systems with graph traversal | V-P (public repos) | GitHub | Internally; never claim novelty | — |
| E-17 | "No major company works on this" / "first ever" | U (and untestable) | PDF p.2 | **Never** | — |
| E-18 | "<100 ms", "never uses repealed rules", "9.7/10" | U | PDF p.18–20 | **Never** | — |
| E-19 | All demo companies, prices, penalties, rates, LC and outcomes | SYN | fixtures | Yes, always labelled synthetic | — |
| E-20 | SAP IBP/TM/GTS/Ariba/Joule capabilities | U until RQ-7 | — | Only as "proposed mapping" | RQ-7 |
| E-21 | Prize amounts | U | PDF p.1 | No | — |

---

## 6. Personas and empathy-map inputs (proto-personas — validate with RQ-4)

**Persona A — Priya R., Supply Planner (synthetic).** Mid-size electrical-equipment maker, Bengaluru. Owns component availability for three customer programmes.
- *Says:* "Give me a plan that ships today." *Thinks:* "If I miss the rail customer again we lose the account." *Does:* phones suppliers, books the fastest sailing, emails compliance afterwards. *Feels:* time pressure, blamed for things she cannot see.
- *Pains:* cannot see sub-tier suppliers; compliance surprises after booking; penalties she cannot quantify quickly. *Gains:* one screen that says what will actually work and why.

**Persona B — Arjun M., Trade Compliance Officer (synthetic).**
- *Says:* "Who approved this route?" *Thinks:* "The bank will reject these documents." *Does:* checks LC terms and origin paperwork after the fact. *Feels:* ignored until something breaks.
- *Pains:* informed late; asked to fix discrepancies; rule changes mid-transit. *Gains:* checks before booking, evidence he can cite, the power to block.

**Affected stakeholders (for the "who gets hurt" slide):** a rail component customer, a water utility, and a cold-chain operator waiting for drives (all synthetic). The event page asks teams to think about who is affected when systems fail [E-05].

**Empathy-map grid to fill after interviews:** Says / Thinks / Does / Feels for each persona; add 2–3 anonymised interview observations each. Replace any assumption that interviews contradict and log the change in the evidence register.

---

## 7. Business Model Canvas inputs (all hypotheses; label as such on the slide)

| Block | Hypothesis |
|---|---|
| Customer segments | Beachhead: Indian mid-size manufacturers importing critical electronic/electrical components from ASEAN under FTAs and documentary credits. Later: freight forwarders, customs brokers, bank trade-finance desks. |
| Value proposition | Recovery plans that pass supplier-independence, LC and FTA checks before booking; evidence a compliance officer can sign; honest cost vs risk. |
| Channels | Extension on SAP BTP alongside existing ERP/planning systems (proposed); SAP partner and system-integrator ecosystem. |
| Customer relationships | Assisted onboarding of supplier declarations and LC terms; shared review workflow between planning and compliance. |
| Revenue streams | Subscription per plant or legal entity; optional per-evaluation tier for small importers. No price points until validated. |
| Key resources | Supplier dependency graph with provenance; curated, dated rule corpus; deterministic check engines; audit trail. |
| Key activities | Rule curation with effective dates; supplier-data collection and verification; model-free decision logic maintenance. |
| Key partners | SAP ecosystem; customs brokers; banks; supplier-audit firms; trade-data providers. |
| Cost structure | Rule and data curation (people), cloud runtime, LLM usage for explanations (optional), support. |

---

## 8. Round 1 deck (10 minutes, ideas only — no code required [E-02])

| # | Slide | Lens | Time | Content | Speaker-note guidance |
|---|---|---|---|---|---|
| 1 | Title | — | 0:15 | "AegisShield AI — recovery plans you can actually execute". Team names, college. | One sentence, no jargon. |
| 2 | A Tuesday morning | Domain | 0:50 | Kulim fab outage → Penang shipment 7 days late → three customers (rail, water utility, cold chain) late 6/4/2 days; ₹11.6 L at stake (SYNTHETIC) | Tell it as a story. Say "synthetic" once, clearly. |
| 3 | Who feels it | Design Thinking | 1:15 | Priya and Arjun empathy maps; one interview insight each | Use interview words, not ours. |
| 4 | The blind spot | Domain | 1:00 | Planners optimise cost/time; compliance learns late; sub-tier data invisible → "fixes" that break LC terms or depend on the same broken factory | Draw the cross-role gap as two lanes meeting too late. |
| 5 | Problem statement | Design Thinking | 0:30 | "How might planners choose a recovery plan that is independent, compliant and affordable before anything is booked?" | Read it once, pause. |
| 6 | How it works | Tech | 1:15 | Five agents + human approval (diagram from `docs/00` §7.1 simplified) | Name agents in the event's vocabulary (`docs/00` §8 table). |
| 7 | Why you can trust it | Tech | 1:00 | Code decides, AI explains; missing data → "needs review"; law chosen by date and authority, not similarity; every finding has evidence | Contrast with "chatbot answers". No "never", no "100 %". |
| 8 | Storyboard | Tech + Domain | 1:15 | Mock screens of beats 2–7 (Member 2): P1 cheapest but blocked; P2 verified | Point to one finding: "Kulim fab, three hops up". |
| 9 | Business model | Business | 1:00 | BMC (§7) | "These are hypotheses we'll test with…". |
| 10 | SAP fit | Business + Tech | 0:30 | Proposed mapping: IBP (inventory), TM (freight), GTS (trade compliance), Ariba (suppliers), BTP (where it runs); what we will actually use (OD-01) | Say "proposed" for anything not built. |
| 11 | Feasibility | Business | 0:30 | 9-day build plan, roles, top 3 risks + fallbacks | Show we planned failure modes. |
| 12 | Close | — | 0:15 | "Recover fast without creating a second crisis." | Stop on time. |

**Speaker-note rules:** each slide ≤ 40 words on screen; numbers only from `docs/00` §10.8; one owner per slide during Q&A (Members 3/4/5 take technical questions on their modules).

## 9. Finale deck and demo narration
- Structure: 1 problem story (60 s) → 2 live demo (3 min, script `docs/00` §12.2) → 3 how it works (60 s) → 4 what is real vs simulated (30 s) → 5 business + SAP fit (60 s) → 6 close (15 s). Adjust to the official finale format once known.
- **Numbers to use** (all SYNTHETIC, from goldens): baseline ₹11,60,000; P1 recovery ₹3,34,000, residual ₹0, net ₹8,26,000 *on paper*, blocked, worst-case exposure ₹5,10,000; P2 recovery ₹4,92,000, residual ₹50,000, net ₹6,18,000, all checks passed; P1 looks ₹2,08,000 better but cannot be executed; duty at risk ₹3,87,600 at 15 % (₹2,58,400 if the repealed 10 % rule were used).
- **"What is real" slide:** real = working software, deterministic checks, validation tests, audit chain; simulated = companies, prices, schedules, LC, rules, execution; proposed = SAP product integrations (except what OD-01 adds).

## 10. Likely judge questions (answer owners in brackets)
| Question | Answer outline |
|---|---|
| Where would tier-2/3 data come from? [M4] | Supplier declarations, sub-tier audits, trade records; each edge stores its source and verification status; missing or unverified data produces "needs review", never a pass. |
| Isn't this what SAP IBP / Joule already do? [M1] | We don't replace them; we add a preflight that checks recovery options against sub-tier dependencies and documentary/FTA terms before execution, designed as an extension (proposed mapping). Only cite SAP capabilities verified in RQ-7. |
| Does transhipment always break an LC? [M5] | No. UCP 600 lets a B/L show transhipment in container cases unless the credit excludes that exception. We block only when 43T says not allowed and 20(c) is excluded; otherwise we pass with a note. |
| Does transit via Colombo kill the FTA preference? [M5] | Not automatically. Direct-consignment rules allow non-party transit under conditions; without evidence we mark "needs review" and show duty at risk. |
| How do you pick the right tariff rule? [M5] | Filter by jurisdiction, product scope, publication date, status, effective dates, explicit supersession, then authority. Retrieval ranking only orders passages for reading. Shown live: 10 % rule superseded, draft ignored, newsletter overruled. |
| What does the AI actually do? [M5] | Extracts fields from notices/LC text into a fixed schema (checked against the record) and writes explanations that may cite only proven evidence ids. Turning it off changes no decision (we demo that). |
| Why not fully autonomous? [M3] | Recovery commits money and legal positions; the event itself asks for human approval on high-stakes decisions. The server refuses execution without approval. |
| What if two official sources disagree? [M5] | Unresolved conflict → needs review; a person decides. |
| How accurate is it? [M3] | On our synthetic scenario all 39 automated validation cases pass; we make no real-world accuracy claim. |
| What SAP technology did you use? [M3] | Answer per OD-01 outcome. |
| Will it scale? [M4] | The demo graph is small and in-memory; production would move graph and rules into a managed store (for example SAP HANA Cloud) — a proposal, not built. |
| Who pays and why? [M1] | BMC hypotheses; validated with interviews (§4). |
| Isn't the data fake? [M1] | Yes, deliberately and labelled; the logic and tests are real. |
| Liability if it's wrong? [M5] | Decision support with evidence; the compliance officer and planner decide; every decision is audited. |
| Why ASEAN–India? [M1] | Electronics sourcing from ASEAN into Indian ports under AIFTA is a realistic setting; the engine is rule-data driven, not hard-coded to one agreement. |

---

## 11. Backlog (priority order)

| ID | Task | Pri | Acceptance criteria |
|---|---|---|---|
| M1-T1 | Confirm all five members are registered (Hackfest + Learning Hub) | P0 | Screenshot/confirmation per member in `pitch/logistics.md` by 20 Oct |
| M1-T2 | Ask coordinator RQ-1/2/3 in writing | P0 | Written answers logged; Member 5 informed |
| M1-T3 | Evidence register v1 | P0 | All rows E-01…E-21 present with status and action |
| M1-T4 | 3–5 interviews | P1 | Notes for ≥3; personas updated |
| M1-T5 | Round 1 deck v1 + notes | P0 | 12 slides, timed rehearsal ≤ 10:00, Member 5 sign-off |
| M1-T6 | Q&A bank with owners | P0 | ≥15 questions, each with owner and ≤ 40-word answer |
| M1-T7 | Primary-source upgrade (RQ-5) | P1 | E-08…E-12 upgraded or wording softened |
| M1-T8 | Finale deck + narration | P0 | Numbers match goldens (DA-14); timed ≤ format |
| M1-T9 | Demo acceptance runs | P0 | DA-01…15 recorded with pass/fail and defect owner |
| M1-T10 | Backup demo video | P0 | 3-min screen recording of a clean run, captured D8 |

## 12. Your first working session (Mon 19 Oct, ~2 hours)
1. Read `docs/00` §1, §2, §3, §10.8, §12 (40 min).
2. Message every member to confirm registration status; record in `pitch/logistics.md` (15 min).
3. Draft the coordinator email with RQ-1, RQ-2, RQ-3 (15 min); send after Member 5's quick look.
4. Copy §5 into `pitch/evidence-register.md` (10 min).
5. List 6 interview candidates and send requests (30 min).
6. Outline Round 1 slides 1–5 in plain text (10 min).

## 13. Day-by-day plan
| Day | Focus | Milestone / checkpoint |
|---|---|---|
| Mon 19 | First session above | Registration status known |
| Tue 20 | Kickoff; send coordinator email; first interviews | OD-05/06 answers requested |
| Wed 21 | **Registration deadline**; evidence register v1; OD-01 note; deck v0 | Deck v0 to Member 5 |
| Thu 22 | Interviews; personas; BMC; deck v1 with Member 2 mocks | Member 5 review (30 min) |
| Fri 23 | Two timed rehearsals; Q&A drill with all | Deck final |
| Sat 24 | Regional pitch (tentative) | — |
| Sun 25 | Shortlist; plan finale story | — |
| D1–D2 | Evidence upgrades (RQ-5); finale deck outline; demo script v1 | — |
| D3 | Finale deck v1 | Member 5 review |
| D4 | Q&A bank v2 after seeing live app | — |
| D5 | Script v2 on live app with Member 2 | — |
| D6 | Lock numbers from goldens | DA-14 pre-check |
| D7 | **Acceptance run #1**; file defects with owners | Member 5 R3 |
| D8 | Three rehearsals; record backup video | SC-6 evidence |
| D9 | Final deck; acceptance run #2; logistics for 4 Nov | Go/no-go |

## 14. Handoffs
| From → To | What | When |
|---|---|---|
| M1 → M5 | Coordinator answers (OD-01/05/06), evidence register | 20–21 Oct |
| M2 → M1 | Mock screens for slide 8 | 22 Oct |
| M3/M4 → M1 | One architecture sentence each + diagram feedback | 22 Oct |
| M5 → M1 | Approved wording for LC/FTA/rule claims | 22 Oct |
| M1 → M2 | Demo narration timings | D5 |
| M1 → all | Acceptance defects with owner and DA id | D7, D9 |
| M1 → M5 | Rehearsal log, go/no-go input | D8–D9 |

## 15. Validation and definition of done
- Every on-stage claim has an evidence-register row with status V-P, V-S or SYN, or is phrased as a hypothesis.
- Every number on a slide appears in `docs/00` §10.8 or a golden file.
- "Synthetic" appears on the first data slide and on every screenshot.
- Banned phrases absent: "first", "no one else", "guaranteed", "never wrong", "100 % accurate", "<100 ms", any score out of 10.
- Timed rehearsal within the format with ≥ 30 s slack.

## 16. Blockers, escalation, fallbacks
| Blocker | Escalate to | Fallback |
|---|---|---|
| Coordinator silent by 21 Oct | Member 5 | Use defaults in `docs/00` §14.5 |
| No interviewees | Member 5 | Use desk research; label personas "assumption-based" |
| App not ready for screenshots | Member 2 | Use Member 2's mocks labelled "design mock" |
| Disagreement on a claim | Member 5 decides | Use the more cautious wording |
