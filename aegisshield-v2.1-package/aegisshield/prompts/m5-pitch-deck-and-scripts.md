# Member 5 plan prompt — Final pitch, presentation and scripts

Paste everything below the line into your AI writing assistant, and attach or paste `docs/00-source-of-truth.md` (v2) and `pitch/evidence-register.md` once it exists. This role involves **no UI/UX work and no code**.

---

## Header
- NOW: <YYYY-MM-DD HH:MM IST>
- FINALE_FORMAT: <unknown | e.g. 10 min pitch incl. demo + 5 min Q&A>   (OD-09)
- SPEAKERS: <who speaks besides me, if anyone>
- PERSONAS: <paste the personas and empathy maps from my UX research>

## Goal
Produce everything the team says and shows at the SAP Hackfest Bengaluru 2026 finale on Wed 4 Nov:
- finale deck content
- word-for-word speaker scripts (10-minute and 5-minute versions)
- demo narration synced to the click path
- Q&A bank with answer owners
- backup-video script
- rehearsal log

Every number and claim must come from the approved canon.

## Context (use only these sources)
1. `docs/00-source-of-truth.md`:
   - §1 (product and end-to-end example), §2.3 (corrections to the team context file: these wordings are mandatory)
   - §2.4 (SAP status and allowed wording), §3 (event facts), §10.7–10.10 (money definitions)
   - §12 (scenario and the 3-minute demo script), §14.2 (DA checklist)
   - **Appendix F** (numbers, allowed/banned wording, real vs simulated vs proposed, Q&A owners, evidence register)
2. `pitch/evidence-register.md` from Member 1. Only V-P / V-S claims may be stated as fact; U claims must be phrased as hypotheses or dropped.
3. My personas and empathy maps (PERSONAS header).

Ignore older documents (`docs/01…05`, `docs/archive/`) and the original planning PDF: their roles and numbers are out of date.

## Constraints
- **Numbers:** use only the figures in Appendix F.1, in Indian format (₹11,60,000 or ₹11.6 L). If a number you want isn't there, ask Member 3; don't derive new ones.
- **Banned:** "probability", "predicts outages", accuracy percentages, "first", "no one else", "guaranteed", "never wrong", "<100 ms", scores out of 10.
- **SAP:** product names are "proposed" unless §2.4 says Built ("runs on SAP BTP" only if OD-01 = Built).
- **Synthetic labels:** say "synthetic scenario" on the first data slide and caption every screenshot "synthetic data".
- **Early warning:** always called "a heuristic early-warning index", never a prediction. The approved line: "in our synthetic scenario it flagged the Kulim fab 59 hours before the supplier's notice".
- **LC and FTA wording** exactly as F4/F5 in §2.3: "this LC forbids transhipment and excludes the container exception"; Colombo "needs review", not "blocked".
- **Plans:** P1 is "₹8.26 L on paper, but blocked"; P2 is "₹6.18 L and passes every check". Never present P1's number without "on paper".
- **No UI/UX work.** Screenshots come from Member 2 (Sun 22:00). If one is missing, use a text placeholder, not a mock.

## Deliverables (all under `pitch/finale/`)
1. **`deck-outline.md`**, slide by slide, for the 10-minute version:

   | # | Slide | Time | Content | Lens |
   |---|---|---|---|---|
   | 1 | Title | 0:15 | AegisShield AI — recover fast without creating a second crisis; team ChainGang, Sir MVIT | — |
   | 2 | A synthetic Monday morning | 0:45 | Fri 23 Oct: grid signals near Kulim. Mon 26 Oct 08:40: the supplier's notice arrives 59 h later. 3 orders late; ₹11.6 L at stake | Domain |
   | 3 | Who gets hurt | 0:45 | My personas; the rail, water-utility and cold-chain customers | Design thinking |
   | 4 | The blind spot | 0:45 | The cheapest fix on paper fails on sub-tier dependency, LC terms and FTA conditions | Domain |
   | 5 | How AegisShield works | 0:45 | Early warning → sensing → dependency → routing → inventory → compliance → human approval; "code decides, AI explains" | Tech |
   | 6 | **Live demo** | 3:00 | Narration file below | Tech |
   | 7 | Why you can trust it | 0:45 | Deterministic checks; missing data → review; law chosen by date and authority; evidence on every finding; audit chain | Tech |
   | 8 | The money | 0:40 | P1 vs P2 table from F.1; exposure ₹5.1 L; "₹2.08 L better on paper, cannot be executed" | Business |
   | 9 | Real vs simulated vs proposed + SAP fit | 0:40 | F.3 and the §2.4 table | Business/Tech |
   | 10 | Business model | 0:40 | Segment and revenue hypotheses (§1); who pays and why | Business |
   | 11 | What's next | 0:20 | Verified supplier data onboarding; real rule corpus with legal review; SAP integrations from §2.4 | Business |
   | 12 | Close | 0:15 | One-line promise; thank you | — |

   The 5-minute version keeps slides 1, 2, 6 (a 2:30 demo: beats 0, 2, 3, 4, 5, 7), 8 and 12.
2. **`script-10min.md` and `script-5min.md`:** word-for-word, with timings per slide and each speaker's name. Use spoken language, at most 150 words per minute, no jargon without a one-line explanation (glossary in §17).
3. **`demo-narration.md`:** beats 0–7 from §12.2, each with:
   - the exact click Member 2 makes
   - what the audience should notice
   - a 1–2 sentence line to say
   - a recovery line if the beat fails ("Let me reset — ten seconds.")
4. **`qa-bank.md`:** the Appendix F.4 questions plus the 10 hardest you can think of. Each needs an answer of ≤ 40 words, an owner (M1–M5) and a source (Appendix F or the evidence-register id).
5. **`backup-video-script.md`:** a 3-minute voice-over matching the demo narration. Member 2 records a clean run Mon 16:00; you record and edit the voice-over and save `pitch/finale/demo-backup.mp4` on two devices.
6. **`rehearsal-log.md`:** a table per rehearsal: date, version, duration, DA items checked, issues, owner, fixed?

## Plan
| When | Task |
|---|---|
| Fri 30 Oct | Join the 18:30 re-plan call. Send the coordinator the OD-09 questions (pitch length, live demo allowed, Q&A length, projector/HDMI, internet, reporting time). Hand Member 2 your design files (a 15-min hand-off). Draft the story arc from §1. |
| Sat 31 Oct, by 12:00 | Report the OD-09 answer to Member 3. |
| Sat 31 Oct, by 20:00 | Deck outline v1 and script v1 (10-min). Check the claims against the evidence register with Member 1. |
| Sun 1 Nov 17:00 | Acceptance run #1: you execute DA-01…17 while Member 2 drives; log the results for Member 3. |
| Sun 1 Nov 18:00 | Rehearsal #1 on the live app. |
| Sun 1 Nov 22:00 | Deck v2 with real screenshots. |
| Mon 2 Nov | Rehearsals at 11:00, 15:00 and 19:00 (time each; SC-6 needs three clean runs ≤ 3 min of demo). Backup video edited by 20:00. **Numbers and deck locked at 20:00 (G3).** |
| Tue 3 Nov | 15:00 acceptance run #2. 16:30 final dress rehearsal. PDF export and video on a USB stick plus one cloud copy. |
| Wed 4 Nov | Present. |

## Done when
- Every number in the deck and scripts appears in Appendix F.1 (DA-14 is checked by someone other than you).
- No banned phrase appears anywhere; "synthetic" appears on the first data slide and on every screenshot.
- The 10-minute script runs ≤ 10:00 and the 5-minute ≤ 5:00, each with ≥ 20 s slack, in timed rehearsal.
- The Q&A bank has an owner for every answer, and each owner has read their answers.
- The backup video exists on two devices.

## If blocked
- Unknown finale format → prepare both versions.
- Claim not in the canon → ask Member 3; until then, use the cautious wording in Appendix F.2.
- Missing screenshot → use a placeholder, and tell Member 2 at the next sync.
