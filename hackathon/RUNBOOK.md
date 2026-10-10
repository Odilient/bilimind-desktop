# RUNBOOK: BiliMind for WorkBuddy on stage

Dormathon 2026, Track 2 (WorkBuddy agentic solutions). Team Opus Magnum #58, Taylor's University branch:
Oybek, Ulugbek, Sharif and Abdugaffor Odilov.

- Phase 1 (local branch): 3:00 live presentation + 2:00 Q&A.
- Phase 2 (top 18, global video call): 4:00 demo + 3:00 Q&A.
- Public repo: https://gitlab.com/avinmaster/bilimind-workbuddy
- Deployed site: https://bilimind-workbuddy-55b817.gitlab.io/

Rules for everyone on stage:

1. Say only numbers that were measured. Every number in this file comes from
   `hackathon/scratch/b-result.txt` (the G2 integration runs) or is a `{{PLACEHOLDER}}` to fill from the
   real run's `REPORT.md` before going on. If a placeholder is still empty, drop the sentence.
2. Never claim the live run started later than it did. Never show a log line that did not happen.
3. Never show an API key. Never open `.env.local` or `%USERPROFILE%\.bilimind\config.json` on screen.

Roles: **Speaker** Oybek. **Driver** {{DRIVER_NAME}} (PLAN 4.2 suggests Sharif) works the laptop.
**Timer** {{TIMER_NAME}} holds up cards at 1:00, 2:00 and 2:40.

---

## 1. Setup checklist (do it before the timer starts)

Laptop and screen

- [ ] Laptop on mains power, sleep and screen saver off, notifications off (Focus assist on).
- [ ] PC clock synced (Settings > Time > Sync now). If not, the course says "Built ..." with wrong times.
- [ ] Alt-Tab check: close every window that is not part of the demo, including leftover Edge windows
      titled like "Survival Malay ..." or "Data Structures ..." from build and screenshot runs. Only
      WorkBuddy and one Edge window should be left.
- [ ] Projector at 1920x1080 or the venue's native size. WorkBuddy font zoom up one step.

WorkBuddy

- [ ] WorkBuddy open and signed in. Credits read and written down before the run: {{CREDITS_BEFORE}}.
- [ ] **Compact Mode off**, so the agent cards and the checklist show.
- [ ] Skill `bilimind` visible in the Skills list, and the Expert Team **BiliMind Crew** (Lead, Writer,
      Coder, Checker) visible in My Experts.
- [ ] Workspace set to **`C:\Demo\DS-Final`** (sources only: four lecture PDFs and `past-paper.pdf`).
      Its `bilimind-out` folder is empty, so the live run starts clean.
- [ ] **Full Access** granted for `C:\Demo\DS-Final` only, not the whole disk.
- [ ] Task 1 (live): the BiliMind Crew selected, the sentence below typed into the box, **not sent yet**.
- [ ] Task 2 (backup): **a finished morning run of the identical sentence**, open in a second task,
      scrolled to: the plan, a Coder fix, a Checker rejection, and the Preview of `index.html`.
      This must be a real run, not `hackathon/runs/g2/ds-final` (its rejections were scripted).
- [ ] In Task 2, rehearse the exact chip to click (a rewritten quiz item) and the exact code exercise
      to run. Click only those on stage.

Edge (one window, these tabs in this order)

- [ ] Tab 1: the deployed site https://bilimind-workbuddy-55b817.gitlab.io/.
- [ ] Tab 2: the Data Structures showcase course on the site.
- [ ] Tab 3: the Mutiara Tea Bar day-one course (English and Malay narration) on the site.
- [ ] Tab 4: the Bahasa Melayu Survival Kit course on the site (Q&A only).
- [ ] Tab 5: the public repo https://gitlab.com/avinmaster/bilimind-workbuddy
- [ ] Tab 6: the slides PDF (rail view, about 30% of the screen width).
- [ ] Player storage cleared for the hero course (fresh progress, "Due today" list visible).

Offline copies (if Wi-Fi fails)

- [ ] `showcase/courses/ds-final/index.html`, `boba-day-one/index.html`, `bm-survival/index.html`
      copied to the desktop and to a USB stick, each with its `audio/` and `img/` folders. They open from
      `file://` with no network (G2 browser gate: 12 page loads, 0 console errors).
- [ ] Slides PDF and the morning run's `REPORT.md` and `plan.md` on the desktop.
- [ ] Phone hotspot ready, with the deployed link open on the phone.
- [ ] Screen recording of the best run on the desktop, if one was made: {{RECORDING_PATH}}.

Timing of the live run

- [ ] The CLI harness run measured 268 s and 289 s (about 4.5-5 min). A full crew run inside WorkBuddy
      takes longer: {{CREW_WALL_TIME}} (read it from the morning run's `REPORT.md`). So **press Enter
      when setup starts**, not when the timer starts, and say so honestly in the first line.
- [ ] Phase 1 has 3 minutes. The outcome is always shown from the morning run (Task 2) unless the
      live run has finished.

### The exact prompt (one sentence, typed into Task 1)

> My Data Structures final is Wednesday 9am. The slides and last year's paper are in this folder. I have 45 minutes a day. Get me ready.

(It is the crew's default prompt in `workbuddy/bilimind-crew/.codebuddy-plugin/plugin.json`. The
pitch is on Sunday, so Wednesday leaves three study days.)

---

## 2. Phase 1: the 3-minute script, word for word

About 380 words. Stage directions are in brackets. Fill the `{{...}}` items from the morning run's
`plan.md` and `REPORT.md` before rehearsal; if one is still empty, say the bracketed fallback.

**[0:00] Driver: press Enter on Task 1 (or, if it was sent at setup, show the run already in flight.)**

"This is WorkBuddy, Tencent's agent workspace. When we plugged in, I gave it one sentence: *My Data
Structures final is Wednesday 9am. The slides and last year's paper are in this folder. I have 45
minutes a day. Get me ready.* I have not touched it since."

**[0:15] Slide 1 in the rail: "Who studies by rereading?"**

"Here is the problem. 84% of students study by rereading. Students who test themselves remember about
80% a week later. Students who keep rereading remember about a third. Testing works, but setting it up
takes hours: questions, a schedule, and working out what the exam actually weights."

**[0:35] WorkBuddy, Task 1: the Lead's plan and the checklist ticking**

"So we built BiliMind for WorkBuddy: a skill and an Expert Team, the BiliMind Crew. The Lead found last
year's paper, weighted every topic by its marks, sized the plan to my three days, and cut
{{CUT_TOPIC}} [fallback: one topic] because the paper gives it no marks. Then it sent out Writers in
parallel, one per lesson. The agents decide what to teach and when. Our code decides how each kind of
knowledge must be taught, and checks that it was."

**[1:05] Task 2 (morning run): the Coder's fix, then the Checker's rejection**

"And they check each other. This is the same sentence, run this morning. The Coder ran every
exercise: this test failed, it fixed the solution, it passed. The Checker read
every quiz answer next to the slide it cites. This one was rejected, with the exact quote from
{{REJECTED_SLIDE}} [fallback: the slide], then rewritten and checked again."

**[1:30] Preview: the finished course. Click the rehearsed citation chip, press Run on the exercise, press play on narration for 3 seconds**

"Here is the course. Click an answer to see its slide. This exercise runs in the
page. And it reads itself aloud, for the bus ride. It is one offline file, plus a plan, Anki
flashcards, and reviews in my calendar, counted back from the exam."

**[2:00] Edge Tab 3: Mutiara Tea Bar course, switch narration English then Malay (2 seconds each)**

"Same crew, different job. Mutiara Tea Bar hires new crew every few weeks. Their SOP became a day-one
course in English and Malay, with an allergy scenario and a pass mark."

**[2:15] Slide: "How, where and when we used WorkBuddy"**

"How, where and when we used WorkBuddy: it is the runtime. Every course you saw was made inside
WorkBuddy, on this laptop, during Dormathon: our skill, our crew of agents, the local folder, the
Preview. Text runs on your own DeepSeek or OpenRouter key, about five cents a course in our
measured runs. Narration uses free voices."

**[2:35] Slide: "What we built here"**

"To be clear: the teaching prompts come from our existing app, BiliMind. Everything running in
WorkBuddy, the engine port, the crew, the checker and coder loops, the past-paper planner and the
player, we built here."

**[2:50] Last slide**

"One sentence in. A course out. Checked against your slides."

### Timing table (Phase 1)

| Start | End | Screen | Beat | Cut first if late |
|---|---|---|---|---|
| 0:00 | 0:15 | WorkBuddy Task 1 | The sentence, the run in flight | never |
| 0:15 | 0:35 | Slide 1 | One stat: 84% reread; ~80% vs ~33% recall a week later | never |
| 0:35 | 1:05 | Task 1: plan, checklist, Writer cards | Past paper weights, cut topic, parallel Writers, "agents decide, code enforces" | shorten the cut-topic clause |
| 1:05 | 1:30 | Task 2: Coder fix, Checker rejection | They check each other | never |
| 1:30 | 2:00 | Preview of `index.html` | Citation chip, Run code, narration | drop narration (3 s) |
| 2:00 | 2:15 | Edge Tab 3 | Mutiara Tea Bar, English + Malay | 2nd to cut |
| 2:15 | 2:35 | Slide | How, where and when we used WorkBuddy; cost | never (organisers asked for it) |
| 2:35 | 2:50 | Slide | Honest disclosure | never |
| 2:50 | 3:00 | Last slide | Tagline | never |

If the timer card says 2:00 and you are still on the course: skip the Mutiara beat and go straight to
the WorkBuddy line.

---

## 3. Phase 2: the 4-minute demo (video call)

Same setup, shared screen at 1920x1080, WorkBuddy full screen (no slide rail; switch to the slides PDF
only for the stat and the tagline). Press Enter on the live run before the call joins. Use the Phase 1
script with these changes:

| Start | End | Screen | Beat (additions to Phase 1 in bold) |
|---|---|---|---|
| 0:00 | 0:20 | Task 1 | The sentence, the run in flight. **"Bilim means knowledge in Uzbek."** |
| 0:20 | 0:40 | Slides PDF | One stat (same words) |
| 0:40 | 1:20 | Task 1, then `plan.md` | Plan, cut topic, parallel Writers. **Open `plan.md`: the assumptions the Lead wrote instead of asking, the topic weights, the cut and its reason.** |
| 1:20 | 1:55 | Task 2 | Coder fix and Checker rejection. **Open `REPORT.md` for 5 s: every check, every rejection, the cost.** |
| 1:55 | 2:40 | Preview | Chip, Run, narration. **Open `reviews.ics` in a calendar for 5 s. If the live run has finished by now, show its Preview instead of the morning run and say so.** |
| 2:40 | 3:05 | Edge Tabs 3-4 | Mutiara Tea Bar (English + Malay). **Then the Bahasa Melayu Survival Kit: "A different sentence gives a different course: speaking drills, not code."** |
| 3:05 | 3:30 | Slide | How, where and when we used WorkBuddy; measured cost and time |
| 3:30 | 3:50 | Slide | Honest disclosure, repo link |
| 3:50 | 4:00 | Slide | Tagline |

Extra words for 0:00 in Phase 2: "Tell WorkBuddy when your exam is and where your slides are. The
BiliMind crew reads them and your past paper, plans the days you have, builds a course checked against
your slides, and puts your reviews in your calendar until exam day."

Video-call specifics: share one window, not the whole desktop (no Alt-Tab surprises, no notifications).
Keep the offline `index.html` files open in a second Edge window, ready to share if WorkBuddy freezes.

---

## 4. Backup plan

| If | Then | Say |
|---|---|---|
| The live run is not finished by 1:05 (expected) | Switch to Task 2, the morning run of the identical sentence and folder | "Still writing. Here is the same sentence from this morning." |
| The live run fails or stops | Leave it; use Task 2 for everything | "It stopped on the venue network. Here is the same sentence from this morning." |
| WorkBuddy freezes, credits run out or the network fails | Offline `index.html` from the desktop in Edge; slides PDF; `REPORT.md` from the desktop; recording if one exists | "Hackathon Wi-Fi. Here is this exact run, as files on the laptop." |
| The live run has no rejection | Show the morning run's rejection (real, saved) | Never fake one. |
| No Coder fix in either run | Show `REPORT.md` code-test rows and say what was tested | "Every exercise ran before you saw it." |
| The Preview panel misbehaves | Open the same `index.html` in Edge | (nothing; just continue) |
| A citation chip looks wrong | Click only the rehearsed chip | |
| Narration does not play | Skip it | "It also reads itself aloud." |
| The deployed site is down | Offline copies on the desktop or USB | |
| Projector shows the wrong resolution | Driver zooms WorkBuddy to 90%; skip the slide rail, use full-screen slides for the stat | |
| Time runs short | Drop narration, then the Mutiara beat, then the calendar (Phase 2). Never drop the stat, the rejection, the WorkBuddy line or the disclosure. | |

---

## 5. Q&A prep: the 12 hardest questions

Rule: two or three sentences, then stop. End on a fact or something you can show.

**1. "How do you stop hallucinations?"**
Each Writer sees only the slide chunks for its topic, and every quiz answer must cite one. The Checker
rules each answer supported, contradicted or not covered with a verbatim quote; the tool refuses a
quote that is not word for word in the cited slide, contradicted answers never reach the course, and
answers the slides do not cover get a visible "Beyond your slides" label. What we cannot fully stop is
a weak sentence of explanation, so every answer shows its slide in one click. (Planted-error test:
{{PLANTED_CAUGHT}} of 20 caught, {{FALSE_ALARMS}} false alarms; drop this sentence if not measured.)

**2. "What does it cost, including WorkBuddy credits?"**
Text generation: our two measured full runs on DeepSeek direct cost $0.046 and $0.047, about five
cents a course, in 268 and 289 seconds. WorkBuddy credits for the crew run: {{CREDITS_PER_RUN}} (read
before and after the morning run). Narration is free (Edge voices).

**3. "Privacy? Does it work offline?"**
WorkBuddy gets Full Access to one folder, and the output is files on your disk, not an account. The
course is one HTML file that opens from disk with no network; we tested it with zero console errors.
Honest caveat: slide excerpts go to the model provider you chose with your own key, and WorkBuddy's
model sees the task, so it is private by default, not air-gapped.

**4. "Why WorkBuddy? Isn't it just calling your API?"**
There is no BiliMind server. WorkBuddy does the work: the plan checklist, the parallel sub-agents, the
local folder, the shell that runs our tests, the loop that sends rejected answers back, and the Preview.
Our skill is the know-how and the tools; the agents make every judgment, and our code enforces the rules.

**5. "NotebookLM, or WorkBuddy's own student experts, already do this."**
They give you a chat and separate summaries or quizzes to reread. We give you an ordered course weighted
by your past paper, code exercises that were run before you saw them, answers checked against your
slides, and reviews in your calendar, all as files you own. NotebookLM has no spaced-review schedule and
does not export its flashcards or quizzes.

**6. "What is the business model?"**
The skill is free and students pay cents to their own model provider, so there is no paywall in front of
learning. Our hypothesis, not yet tested: small businesses and training teams pay per seat for records
(who finished onboarding, scores, refreshers), and institutions pay for course packs.

**7. "What did you build here? BiliMind existed before."**
The BiliMind web app existed; we reused its teaching prompts and the rules that map each kind of
knowledge to a lesson format. Built at Dormathon: the engine port, the WorkBuddy skill and the
BiliMind Crew, the Checker and Coder loops, the past-paper planner, the offline player, the exports and
the landing site. The repo's history is the timestamped record.

**8. "Does it scale?"**
Each run happens on the user's machine with the user's key, so our cost per course is close to zero. The
Lead runs up to six Writers in parallel. The limit is WorkBuddy credits per run, which is why the heavy
text goes through a cheap model on the user's own key.

**9. "What if the generated code exercise is wrong?"**
It often is: in our integration runs, 3 of the 4 exercises we examined needed a fix (a missing helper,
a wrong expected value, a starter that never finished). That is why the Coder exists: it runs every
exercise, fixes it, and nothing ships unless the reference solution passes every test. If it cannot be
fixed, the exercise is switched to self-marked rather than shipped broken.

**10. "Which languages?"**
The crew replies in the user's language, and narration uses Edge voices: the Mutiara Tea Bar course is
narrated in English and Malay, and the Survival Kit drills Malay phrases. Translated text carries a note
to have a fluent speaker check it. Code exercises run JavaScript only for now.

**11. "Is it accessible?"**
Every lesson can be listened to, with the current sentence highlighted, and the page works at phone
width (checked at 390 px, no horizontal overflow) and offline. We have not done a screen-reader audit
yet; that is on the list.

**12. "What are the next steps?"**
A pilot with one Taylor's module, with a controlled comparison, because we do not claim grade gains we
have not measured. Then a WorkBuddy Automation that builds each morning's review page, Anki `.apkg`
export, Python exercises, OCR for scanned slides, and a real shop's SOP with permission.

Spare answers (only if asked):

- "Engineering quality?" Tests pass across the packages: core 55, engine 172, player 72, CLI 12.
- "Are students allowed to turn lecturer slides into a course?" Same as making your own notes, for
  personal study, kept on the laptop. Our demo uses openly licensed teaching material with attribution.
- "Slow?" The two long steps are the outline (109-117 s) and narration (about 100 s); drafts run in
  parallel. The crew run takes longer than the harness because the agents read, fix and check.

---

## 6. Placeholders to fill before rehearsal

| Placeholder | Where to read it |
|---|---|
| `https://bilimind-workbuddy-55b817.gitlab.io/` | the site deploy result |
| `{{DRIVER_NAME}}`, `{{TIMER_NAME}}` | team decision |
| `{{CREDITS_BEFORE}}`, `{{CREDITS_PER_RUN}}` | WorkBuddy credit page, before and after the morning run |
| `{{CREW_WALL_TIME}}` | morning run `REPORT.md`, "Wall time" |
| `{{CUT_TOPIC}}` | morning run `plan.md`, cut list |
| `{{REJECTED_SLIDE}}` | morning run `REPORT.md`, rejected item's cite |
| `{{PLANTED_CAUGHT}}`, `{{FALSE_ALARMS}}` | planted-error benchmark (`plant` / `plant-score`), if run |
| `{{RECORDING_PATH}}` | the screen recording, if made |

Evidence for the stat: Karpicke, Butler & Roediger (2009), *Memory* 17(4) (84% reread); Karpicke &
Roediger (2008), *Science* 319 (about 80% vs 33-36% a week later). Full links in
`hackathon/research/pitch.md`.
