# bm-survival: generation receipts

Course: `showcase/courses/bm-survival` (index.html 1187 KB, course.json, plan.md, REPORT.md, reviews.ics, deck.csv, lessons/*.md, audio/).
Sources: `showcase/sources/bm-survival` (bmk2-note.md, malay-survival-phrasebook.md; LICENSE.md copied into sources/ by hand because init skips it). dormathon-briefing was not used.
Sentence (verbatim): "I'm an international student at Taylor's with zero Malay. Make me a survival course for my first month (mamak, Grab, campus) that also starts me on Bahasa Melayu Komunikasi. I have 20 minutes a day for 2 weeks."

## Time, cost, counts

- Clock: doctor reported clock_skew_ms = 21000 (the PC clock is now correct), so real today = local today = Sun 11 Oct 2026. The `run` CLI has no `--start` flag (RunOptions.start exists but is not wired); it uses the server-skewed clock, so day 1 is 11 Oct either way. The manual re-plan passed `--start 2026-10-11`.
- Wall time: 30 min 39 s from `run` start (00:11:22 local, local = MYT) to the last build and gate (00:42:01). The unattended `run` itself took 265.8 s (4 lessons). Receipts wall_ms: 1,801,424 (the 30 min 1 s in REPORT.md and the README).
- Cost: $0.055227 in DeepSeek direct calls (BILIMIND_PROVIDER=deepseek, `--no-cache`); the cap was $0.15. Breakdown: run $0.035430 (outline $0.015483, 5 drafts including 1 re-draft, fact-checks, auto-verdicts); 5 new drafts $0.015265; Checker passes on them $0.004532. TTS is free (Edge).
- Counts (build receipts): 8 lessons, 62 blocks, 31 questions, 0 code exercises, 72 Anki cards, 115 study minutes, 39.2 min lesson narration (English voice) plus 33 speaking clips and 4 dialogue openers in ms-MY-YasminNeural (46.1 min of audio in all). Checks: 204/205 on the 8 kept lessons (the 1 failure is Q15 "thin lesson" advice on the capstone, sized at 60 min in the outline but planned as 15). Receipts say 228/229 because they also count the cut greeting_etiquette draft. Rejected 3, rewritten 3, "beyond your slides" 4.
- Plan: 14 study days (11 to 24 Oct), 20 min a day, lessons on days 1 to 9, reviews after. Engine warnings kept and not fixed: 3 crowded review days (18, 22 and 24 Oct need 35 to 40 min, because review dates are counted backwards from the deadline at -1/-3/-7 days); 7 lessons clamped from 20 to 60 min down to 15 min.
- Gate: `node hackathon/runs/g2/shoot.mjs <course> <_shots/bm-survival>` gave ok, 0 console errors, 0 page errors, 0 boundary errors and 0 horizontal overflow on 6 pages (home plus 2 lessons, at 1440 and 390). I also shot the other 6 lessons (14 pages, scratch only) with the same result. The only failed requests are mp3 preloads aborted when the tab closes; all 43 referenced mp3s exist.

## What I did to the pipeline output (and why)

1. `run` read "for 2 weeks" as no date: exam assumed in 7 days (18 Oct), code language js. Its no-past-paper keep rule then kept the first 4 outline topics (sounds, greetings, Assalamualaikum etiquette, numbers) and cut mamak, Grab and campus, the three things the sentence names. Fix: I emptied the wrong assumptions and re-ran `goal` (deadline 2026-10-25 09:00, 20 min, student, en, code-lang none, 4 explicit assumptions). Then `plan --start 2026-10-11` keeping malay_sounds, greetings_and_address, numbers_money_and_time, mamak_ordering, grab_and_directions, campus_and_classroom, bmk_module_context and capstone_a_day_in_malay, and cutting greeting_etiquette, sentence_patterns, little_words_in_speech and emergency_phrases, each with a reason.
2. I drafted the 5 new lessons with `draft --no-cache` (all in parallel), each with a `--note` asking for Malay only from the sources. Mamak, Grab and campus also asked for speaking and dialogue blocks with payload.language "ms"; BMK asked for the note's facts only. Then I ran the same Checker steps that `run` uses: check, fact-check, check, `verdict --auto` and evidence. No check failures needed a re-draft, and I used no `draft --note` re-drafts after review.
3. Narrate (all lessons; run twice, the second time to pick up edits), export and build. Every edited lesson was re-checked before the next build, and the final build shows no "changed after its last check" warning; `status` reports all lessons verified. I deleted 6 mp3s that nothing referenced any more (7 MB of stale clips from the first narration).
4. I recorded three `note` entries in REPORT.md and the receipts log, so the course itself shows the hand corrections.

## Lecturer review: every fix (lesson JSON edited, then check, re-rule and build)

malay_sounds
- b4 example said the final -a of *terima* is "not word-final, so no softening", but it is word-final. Corrected the row.
- b1: fixed a stray backtick (`*a\``) and changed "English e has four sounds" to "several".
- Outline note said "twenty minutes here", but the lesson is planned as 15. Reworded.

greetings_and_address
- Changed *pakcik/makcik* to *pak cik/mak cik* everywhere, matching the phrasebook and the standard spelling; the speaking clip was re-voiced.
- b1 claimed the phrasebook's dagger (†) means "the one you will hear least". It actually marks rows added for the demo. Rewrote the line as the four time-of-day greetings.
- b1 pointed to "the next node" for Assalamualaikum, but that lesson is cut. The reply *Waalaikumussalam* is now stated inline.
- The lesson advised *anda* face to face for strangers. The phrasebook says *anda* is for signs and ads, and lists Encik, Puan and Cik. Changed b1, the b2 comparison (the anda row), the b5 table row and b5's note to use Encik, Puan or Cik.
- b7 scenario: plain "Terima kasih." was marked wrong ("what you say to a machine"). Replaced that distractor with "Sama-sama." (the reply, not the thanks).
- q2 had two defensible answers (selamat petang vs tengah hari) because the time was not stated. Added "It is 4 pm"; the Checker re-ruled it supported.
- The q5 rewrite (accepted kakak, awak and anda) contradicted the lesson and the Checker's own q1 ruling. Options changed to kakak, mak cik, anda, Puan and abang, with key kakak and Puan; removed the duplicated "Select all that apply". Re-ruled supported.
- Block citations: the address-term blocks cited section 2 only; they now cite section 3 (chunk 8).
- b3 example: the dialogue lines in blockquotes rendered as one run-on paragraph. Split into separate lines.

numbers_money_and_time
- The b5 phonetic "suh-BLAYSS" was wrong; changed to "suh-buh-LAHS" (and the same for "buh-LAHS" in dua belas and tiga belas).
- b6 scenario s1: asking to confirm the price was marked wrong, which contradicts the lesson's own advice. It is now "Say *Lapan ringgit?* to check" and marked correct. Also changed "Tak ada kecil?" to "Ada duit kecil?" and "When and where in the day" to "When is that?".
- Replaced the jargon "node" with "lesson" (b1, and the b8 title).

mamak_ordering
- Changed "two switches" to "three switches" (the table has three).
- The b2 intro said every mamak drink is one of these four teas. It now says these are the four tea orders you will use most.
- b7 scenario s2: *roti kosong* also comes with curry, so the "wrong" option was not wrong. Rewrote the step around *roti telur* (from the phrasebook).
- Removed an unsupported price claim.
- The *bungkus* phonetic said "BOONG-goos"; changed to "BOONG-koos". Changed "nahk" to "nah'" (final k is a stop).
- Softened "satu goes after the dish, not before it" to "the way the phrasebook's dialogue says it".
- The q3 prompt answered "Makan?" with "Bungkus". Re-framed it as a takeaway request.
- The misconception belief rendered with doubled quotes; reworded it.
- b3 dialogue blockquotes split into separate lines; "node" changed to "lesson".

grab_and_directions
- The ride order was wrong in b1 and in the b2 walkthrough: say the destination first, then answer the driver's call. The driver finds you before you get in, and the Checker rejected q1 for exactly this. Reordered the b1 list and the walkthrough steps (pickup call, then "Abang dah sampai?", then destination, directions, stop, on foot), and rewrote the walkthrough intro.
- Updated the project brief and the q5 reference answer and rubric to the new order.
- Removed unsupported claims: "Malaysian Grab drivers call rather than text", "you will be charged for waiting", "pick up the wrong passenger more often than you would think" and "stacked rides".
- The phrase "lead with the fact that you are not fluent" did not match the phrase that followed it. Fixed.
- Phonetics: "BAY-lo'" changed to "buh-LO'", "ber-HEN-tee" to "buhr-HUHN-tee" and "PER-ghee" to "PUHR-gee"; the speaking intro now mentions *belok* instead of *tidak*.
- The dialogue opener "Hello" changed to the Malay spelling "Helo" (re-voiced).
- The q3 reference answer misquoted the phrasebook ("final consonants are weakened"). Corrected it to what the phrasebook says about final k and r.
- Changed "the next node's job" to "the campus lesson".

campus_and_classroom
- b1 repeated the dagger misreading ("marks the last two ... the high-value ones"). Rewrote it.
- b7 said "you are one of the few international students in the room". The BMK note says Malaysian students take other U1 modules, so a BMK class is all international students. Removed the line.
- The walkthrough closed with a second "Minta maaf" ("makes the first one credible"). Changed it to "Terima kasih".
- Removed "ninety minutes" (class length is not in the sources). b6 now says "had to be submitted ... by 5pm on Sunday".
- The q4 rewrite asked "which line do you say first?" with key "Boleh ulang?", against the lesson's own walkthrough. The question now asks which line requests a repeat; the Checker re-ruled it supported with a quote from section 2.
- The speaking and flashcards blocks had no citations; added sections 2 and 7.

bmk_module_context (facts checked against bmk2-note.md)
- "Who takes it: students who take the MPU requirement" was wrong. It is now international students on Taylor's degree programmes; Malaysian students take other U1 modules.
- Added the U1 neighbours (Kursus Integriti dan Antirasuah, Citra Malaysia) to the table, explainer and flashcards, and spelled out MPU as Mata Pelajaran Pengajian Umum.
- Removed unsupported claims: "a four-credit core paper", "every student in the country", "the code is on your results slip", "which is why the code looks different" and "computer science papers".
- Added "as listed on Taylor's MPU page on 10 October 2026; check the page".
- Citations: every block cited phrasebook section 1 (chunk 4) or 7; they now cite the BMK note (chunks 1 and 2).

capstone_a_day_in_malay
- The walkthrough said "you have no phrasebook line for the driver", but section 6 is all Grab lines. The Grab scene now uses *Saya nak pergi ke Taylor's, Lakeside Campus*, *Tolong berhenti di sini* and *Terima kasih, bang*.
- Removed unsupported checklist claims ("highest-frequency lines", "need every single day").
- The outline mentor note said "Book the table" (nobody books a mamak table). Reworded.

Malay phrases: I read every Malay word and sentence in the 8 lessons, including speaking items, dialogue openers, hints, tables and scenarios. Apart from the fixes above, the Malay matches the phrasebook or is standard Malaysian Malay. The model-written lines outside the phrasebook that I accepted are: "Baik, semua faham? Tugasan pertama perlu dihantar minggu depan.", "Tugasan kumpulan perlu dihantar sebelum kelas minggu depan.", "Maaf, Encik, boleh saya tanya?", "Dekat atau jauh?", "Siapa nama pak cik?", "Nak apa?", "Ya, lapan ringgit." and "Ada duit kecil?". A native-speaker check is still open (it was already planned for the phrasebook).

## Checker rulings (crew/verdicts/*.json)

Unattended re-solve (`verdict --auto`, fast model, key hidden):
- malay_sounds: 3/3 agree (q1, q2, q3 supported).
- greetings_and_address: q1 contradicted (key kakak+anda; the re-solve gave kakak only), rewritten as q5 (supported); q2 not_covered.
- numbers_money_and_time: 3/3 agree.
- mamak_ordering: 2/2 agree.
- grab_and_directions: q1 contradicted (the ride order put the destination before the pickup call), rewritten as q6 (pickup first, supported); q2 not_covered; q4 supported.
- campus_and_classroom: q1 contradicted (key "Minta maaf"; the re-solve gave "Boleh ulang?"), rewritten as q4 (not_covered); q2 supported.
- bmk_module_context: 3/3 agree.
- capstone_a_day_in_malay: 3/3 agree.
- greeting_etiquette (later cut): 1/1 agree.

Rulings I applied as the Checker (`verdict --file`, quotes verbatim from the cited chunks; 4 were first refused (greetings q2 and q3, campus q3 and q4) because the quote sat in a chunk the item did not cite, so I pointed each item's cite at that chunk and they then applied):
- Supported:
  - greetings q5 (after my option fix) and q2 (after adding the time), both quoting section 3's kakak and abang rows; greetings q4 ("Tumpang lalu ... for squeezing past people").
  - malay_sounds q4 (the ng row); numbers q4 ("Tens add puluh").
  - mamak q2 ("teh O kosong = black tea, no sugar"); grab q3 ("Belok kanan | Turn right").
  - campus q4 ("Boleh ulang? † | Can you repeat that?").
- Not covered (labelled "Beyond your slides"): greetings q3 (awak versus pak cik is the lesson's advice), campus q3 (the order of the class phrases), capstone q5 (study advice). With grab q2 that makes 4 labels.
- Re-quoted contradictions: the 3 auto-rejected items (greetings q1, grab q1, campus q1) had no quote, so the course's "Rejected by the Checker" cards showed the item's own explanation under "Your file says". I re-applied each contradicted ruling with a verbatim source quote and a short reason. They stay rejected (3), and the cards now quote the phrasebook.
- Not ruled: grab q5 and capstone q1 (project rubrics, self-marked).

## Engine or player problems seen here and not fixed (outside this lane)

1. `run` parseSentence: "for 2 weeks" (or "N weeks") is not parsed, so it assumes 7 days. It also defaults codeLang to js for a language course. The `run` CLI does not expose `--start`.
2. `run` chooseLessons with no past paper keeps outline order while the days fit. That cut the three topics the sentence named.
3. A non-exam goal still reads as an exam: the plan narration says "Your exam is on Sunday 25 October", and the home page shows "EXAM IN", "Exam · Sun 25 Oct" and "After the exam". The hero chip says "Grounded in your slides" for Markdown sources.
4. Build lede grammar: "every auto-marked answers checked against your files".
5. Receipts checks count cut lessons' drafts (229 vs 205).
6. core excludedItems falls back to the item explanation when a contradicted ruling has no quote, and the player labels it "Your file says". `verdict --auto` should store the deciding quote.
7. `fact-check` returned "0 errors" in under 1 s with 5 output tokens for all 9 lessons, yet the review above found real errors (the terima row, the dagger claims, phonetics). It looks like it is not really checking.
8. Writers cite the wrong chunks (the BMK lesson cited phrasebook section 1), and two Writers misread the † mark.
9. Plan review dates cluster at deadline -1/-3/-7, so any course with more than 4 lessons gets crowded review days.
