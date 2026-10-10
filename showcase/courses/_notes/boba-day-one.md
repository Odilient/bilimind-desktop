# boba-day-one: build notes (honest receipts)

Course: `showcase/courses/boba-day-one/` ("Mutiara Tea Bar crew day-one training"). Sources: `showcase/sources/boba-day-one/`
(SOP .docx + FHR 2009 one-page PDF; LICENSE.md copied into `sources/` afterwards for the licence labels). The
dormathon briefing was never used or copied.

Sentence (verbatim): "We hire new crew every few weeks at Mutiara Tea Bar. Turn our SOP folder into a day-one course
they must pass before their first shift, narrated in English and Malay."

## Clock

`doctor` reported `clock_skew_ms` = 21,000 (21 s). The PC clock is now correct, so the old "+8 h" rule no longer applies:
real today = 2026-10-11 (MYT). `run` has no `--start` flag; it already uses the server-corrected time. Every later
`plan` call passed `--start 2026-10-11`. All log, receipt and REPORT times are real MYT.

## Wall time and cost

| Step | Wall | Cost (USD) |
|---|---|---|
| `run --no-cache --max-usd 0.15` (bundle, DeepSeek direct): goal, ingest, outline (83 s), plan, 6 drafts + repairs, fact-check, auto-verdicts, narrate (166 s), export, build | 477 s | 0.080966 |
| Team re-plan (logged as Lead), 3 new drafts (drink_catalog, building_a_drink, malay_order_phrases), 1 `--only walkthrough` re-draft (shift_routines) | about 30 s (parallel) | 0.010650 |
| Checker: fact-check + `verdict --auto` on the 3 new lessons, then hand rulings | about 5 s for the model calls | 0.002678 |
| narrate (twice, en + ms), export, build | about 110 s | 0 |
| **Course total** (crew/log.jsonl, = receipts `cost_usd`) | init 00:11:19 to final build 00:36:32 MYT = **25 min 12 s** (REPORT.md and the README say 24 min 39 s: REPORT.md was written at 00:36:01, so its count stops at the step before, 00:35:58) | **0.094294** (cap 0.15) |

Spend by command: outline 0.0121, draft 0.0733 (hygiene_rules alone: 0.040 over its draft and repair; the first draft took 187 s),
fact-check 0.0036, verdict --auto 0.0052.

## Final counts (build receipts)

7 lessons, 51 blocks, 32 questions (28 supported, 2 "Beyond your slides", 2 self-marked projects), 0 code exercises
(staff course, code-lang none), checks 231/231 (3 repaired by the run, 0 flagged), 1 rejected, 1 rewritten,
68 review cards / 64 Anki cards, 34.7 min of lesson narration plus a 58 s "Hear the plan", index.html 1.2 MB.

Plan: 7 study days x 45 min (Sun 11 to Sat 17 Oct), first shift Sun 18 Oct 09:00 (assumed: no date in the sentence).
Order: food handler law, hygiene, allergens, opening/closing, menu codes, Malay order, building BS01. No plan warnings
except "shift_routines sized 35 min, planned as 30".

## Team review decisions after the run (all logged with `note`, under the Lead's name)

1. The unattended `run` kept 6 lessons in outline order, including the thin "Booking your MOH course" subtopic and a
   second dairy-scenario lesson, and CUT the BS01 build, the menu/sticker codes and the Malay order. Those three are on
   the SOP's own day-one list (section 12) and the sentence asks for Malay. Re-planned to 7 lessons: drafted
   drink_catalog, building_a_drink, malay_order_phrases; cut moh_handler_certificate (folded into the food-handler
   lesson) and dairy_allergy_scenario (its Scenario A is already the allergens lesson's scenario block).
2. First tried allergens-first; the planner then stacked 50-65 min on Sat 17. The page's path follows the outline's
   sections ("Before you touch the bar", "Running the bar"), so "You are here" pointed at lesson 2 while the plan said
   lesson 1. Re-planned in the path's order: plan and path agree, and no day exceeds 45 min.
3. Removed the outline's "After the exam: Getting your food handler certificate" (the certificate is required BEFORE
   the first shift, reg. 30).
4. Moved 15 unreferenced mp3s (cut lessons, superseded narrations, 13.6 MB) out of `audio/`; all 17 referenced files exist.

## Lecturer fixes (lesson JSON edited, ids kept; every lesson re-checked, then narrate + export + build)

Wrong keys / wrong facts:
- shift_routines q4: WRONG KEY. Freezer at -16 °C keyed "write both readings and carry on"; section 4 says -18 °C or
  below. Rewritten (chiller 6 °C, freezer -18 °C): log both and tell the shift lead before using milk.
- shift_routines b2 (opening walkthrough): not the SOP's section 4 (invented clock-in, a water-heater step, a personal
  POS log-in and an opening photo; missed uniform, date labels, ice, sanitising, sealer test, RM 200 float, allergen
  board). Root cause: this lesson's retrieval never received chunks 10-11 (section 4). One `draft --only walkthrough
  --note` re-draft ($0.0015) still invented the same steps, so I rewrote the 10 steps from section 4 and cited chunks 10, 11.
- shift_routines q6: the auto-Checker rejected q1 (right call) but its rewrite q6 put the thermometers after the pearls
  and kept the non-SOP water-heater step, and the auto-Checker then ruled it "supported". Rewritten from the section 4
  bullet order and re-ruled.
- shift_routines b1: "pearls older than four hours are a food-safety problem, not a texture problem" contradicts 6.1
  (old pearls go hard and sour); b4 misconception and b6 project (opening photo; the SOP posts a photo only at closing) fixed.
- drink_catalog b1: wrong rule "large always takes two more pumps than regular" (section 7: 4/6, 3/5, 2/3, 1/2, 0/0).
- drink_catalog b4: less ice on a large cup given as half a scoop (60 g); section 7 says 1 scoop (85 g). Also "oat
  milk is a swap rather than a removal of the milk base" was wrong; the problem is +PD (egg and milk).
- building_a_drink: the worked sticker "BS01-L 70% LI OAT" used a sweetness level that does not exist (0/25/50/75/100)
  and "STD" is not an ice code (NI/LI/RI/HOT): 75% and RI everywhere (walkthrough, example, scenario, q2, q3, project),
  with pump counts and scoop weights from section 7. b1 misquoted 6.4 ("making from memory is the most serious
  mistake"; the SOP says wrong milk for an allergy customer is).
- food_handler_law b4: "Role D, counter only" said the cashier "may not" be a food handler; reg. 2 covers handling
  packaged food (the lesson's own explainer says so). Title said three roles for four. b2 reg. 36 row said "tear the
  wrapper with your hands, not your teeth"; the rule is "never use your breath to open a bag or wrapper".
- hygiene_rules b4 s3: scored "wash after carrying a SEALED bag of pearls" as required, which no source says and which
  contradicts the lesson's own q5 (restocking sealed cups is not a trigger); rewritten around carrying rubbish
  (reg. 33(1)(c)). The no-polish rule was cited as reg. 33(1)(a); the SOP marks it [SHOP] (b3, b6).
- allergens: removed unsourced medical/legal claims ("casein triggers anaphylaxis", "non-dairy is a legal butterfat
  label", "can close a child's airway within minutes"); pudding row said "dairy" only (section 8: egg AND milk);
  scenario option "let me check" was scored a failure though SOP section 1 says ask when unsure; q3 ordering had an
  ambiguous step (when to check the allergen board) and was cut to the 4 steps whose order section 9 fixes.
- malay_order_phrases: "refuse" a 0% brown sugar order -> the SOP's offer (25%, or CT01 at 0% with pearls).
- Also removed invented "the inspector times it / checks first" lines (hygiene b1, b2, b6) and fixed 3 explanations
  (hygiene q2, building q2, malay q3).
- The `fact-check` pass on building_a_drink "fixed" 3 correct values it could not see (the blocks did not cite
  section 7): it deleted "(120 g)" for RI and "from the warm bath". Restored, and chunk 18 added to the cites of
  building_a_drink b2/b4 and drink_catalog b4.

## Checker rulings (real, quotes verbatim; `verdict --file`, 0 refused)

| Lesson | Ruling summary |
|---|---|
| food_handler_law | q1-q3 supported (auto, quotes checked); q4 supported ("Bubble-tea crew who scoop pearls, pour milk, seal cups or wash shakers are food handlers.") |
| hygiene_rules | q1 OVERRULED supported -> not_covered (the auto quote was the blue-plaster rule; the SOP gives no hand-wash sequence); q2, q5 supported; q3 not_covered (auto, agreed); q4, q6 supported (section 10, [SHOP] money trigger; [LAW] reg. 33(1)(b) apron rule) |
| allergens | q4 OVERRULED not_covered -> supported (section 9 states it: "call 999 at once, tell the shift lead, keep the person still, ..."); q1 supported (auto); q2, q3 supported (section 9 allergy-order steps) |
| shift_routines | q1 contradicted, re-ruled with a real quote and reason (the auto reason claimed a wrong "re-solved" order and quoted the item's own explanation): "Section 4 has no water-heater step and ends with the POS, float and allergen board; the checklist photo belongs to closing (section 5)." Replaced by q6 (rewritten, supported). q2 supported (auto); q3, q4 supported |
| drink_catalog | q1-q3 supported (auto, 3/3 agree); q4 supported ("75% \| kurang manis sikit \| 3 \| 5") |
| building_a_drink | q1, q2, q4 supported (auto, 3/3 agree; q1 re-cited to 6.4); q3 supported (6.4 step 3) |
| malay_order_phrases | q1, q2 supported (auto); q3, q4 supported (Scenario D, section 7) |

Totals: 1 rejected (shift_routines q1), 1 rewritten (q6), 2 "Beyond your slides" (hygiene q1, q3), 2 self-marked projects.

## Narration

`narrate --langs en,ms`: lessons in en-US-AvaMultilingualNeural; the Malay lesson's 8 speaking phrases and its
dialogue opener in ms-MY-YasminNeural. The CLI's `--langs` only selects voices for speaking/dialogue blocks: there is
one narration track per lesson, so "lesson 1 also in Malay" is NOT supported and was not faked.

## Browser gate (`hackathon/runs/g2/shoot.mjs`, headless Edge, file://)

Gate run (home + food_handler_law + hygiene_rules at 1440 and 390): 0 console errors, 0 page errors, 0 error
boundaries; screenshots in `showcase/courses/_shots/boba-day-one/`. Extra run over the other 5 lessons: same, 0 overflow.
The only failed requests are mp3s aborted when the tab closes (known).

NOT passing: home at 1440 reports **overflow 1 px** (scrollWidth 1441). Cause: the hero object (`.c-hero .obj`,
img/obj-check.webp, which every staff course uses) rotated and drifting near the right edge. Verified fix in the
player (not in this lane): `.c-hero { overflow-x: clip; }` in packages/player/src/styles/shell.css -> scrollWidth 1440.
Removing the drop-shadow filter alone does not fix it.

Also seen (player lane): at 390 px, after a lesson was opened, the hero CTA "Continue · Step 1, Who is a food handler
under FHR 2009" is clipped inside its pill (needs ellipsis or wrapping). The lesson head says "Step 4 of 6" in a
7-lesson course (it counts path steps). The sources card says "20 pages" for the SOP .docx (20 sections).
`narrate` rewrites speaking/dialogue payloads on every run, so `build` warns "changed after its last check" until
`check` runs again (done here).
