# RUNBOOK: BiliMind Desktop on stage

Dormathon 2026, Track 2: "How can AI help students and small businesses solve real business problems and
operate more effectively?" Team Opus Magnum (#58), Taylor's University branch: Oybek Odilov, Abdugaffor
Odilov, Ramil Khutlimuratov and Gameel Al-Bazeeli.

- Phase 1 (branch): 3:00 live presentation + 2:00 Q&A.
- Phase 2 (top 18, global video call): 4:00 demo + 3:00 Q&A.
- Download: https://github.com/Odilient/bilimind-desktop/releases/latest
- Website: https://odilient.github.io/bilimind-desktop/
- Source: https://github.com/Odilient/bilimind-desktop

Team decides who speaks and who drives. Below, **Speaker** is whoever talks and **Driver** is whoever works
the laptop; write the names here once decided: Speaker ______ Driver ______ Timer ______.

Rules for everyone on stage:

1. Say only numbers that were measured. Every number here comes from the showcase courses' `REPORT.md`
   files or the two measured unattended runs (268 s / $0.046 and 289 s / $0.047). If a number for today's
   live run is not known, drop the sentence.
2. Never claim the live run started later than it did, and never show a step that did not happen.
3. Never show an API key. Never open `%USERPROFILE%\.bilimind\config.json` on screen. In Settings the app
   shows only the last four characters.

---

## 1. Setup checklist (before the timer starts)

Laptop and screen

- [ ] On mains power; sleep, screen saver and notifications off (Focus assist on). Clock synced.
- [ ] Close every window except BiliMind Desktop and one Edge window (slides). Alt-Tab check.
- [ ] Projector at its native resolution; app window maximised.

BiliMind Desktop

- [ ] Latest build installed from the release (or `pnpm --filter @bilimind/desktop start` from the repo).
- [ ] Settings: provider DeepSeek, key set, **Test key** shows a balance. Narration on.
- [ ] Demo folder `C:\Demo\DS-Final` with the four lecture PDFs and `past-paper.pdf` only (a copy of
      `showcase/sources/ds-final`). No old course for it in `Documents\BiliMind`.
- [ ] A **finished course built earlier from the same folder and sentence** is in the course list. Rehearse
      on it: the rejected answer and its slide quote in the finished screen or `REPORT.md`, the code
      exercise to run, the narration button.
- [ ] The Mutiara Tea Bar crew day-one course (made from the shop's SOP) is in the course list, for the
      small-business beat.
- [ ] Home screen open, folder picked, the sentence typed, **Build not pressed yet**.

The sentence (typed on the home screen):

> My Data Structures final is Wednesday 9am. The slides and last year's paper are in this folder. I have 45 minutes a day. Get me ready.

(The pitch is on Sunday, so Wednesday leaves three study days.)

Edge (one window)

- [ ] Tab 1: the slides PDF (only the WorkBuddy slide and the closing slide are used on stage).
- [ ] Tab 2: https://github.com/Odilient/bilimind-desktop/releases/latest

Backups

- [ ] The three showcase courses (`showcase/courses/*/index.html` with `audio/` and `img/`) copied to the
      desktop and a USB stick; they open from `file://` with no network.
- [ ] Phone hotspot ready.
- [ ] A screen recording of a full build, if one was made, on the desktop.

Timing of the live build

- A real build takes about 5 minutes with narration (measured unattended runs: 268 s and 289 s). The pitch
  is 3 minutes, so **press Build at 0:00**, show the live building screen, then switch to the finished
  course made earlier from the same sentence. Say so out loud.

---

## 2. Phase 1: the 3-minute pitch

About 400 words. Stage directions in brackets.

**[0:00] Driver presses Build. Building screen visible.**

Speaker: "Three days before an exam, most of us have the same thing: a folder of slides, last year's paper,
and no plan. I just gave this app that folder and one sentence: *My Data Structures final is Wednesday 9am.
I have 45 minutes a day. Get me ready.* It started building when I pressed this button. I will not touch it
again."

**[0:20] Building screen: the steps ticking, the plan appearing**

"This is BiliMind Desktop. It is open source and runs on my laptop with my own AI key. A Lead reads my
files, finds last year's paper, weights every topic by its marks, fits the plan to my three days and cuts
what the paper never asks, with a reason. Then Writers write the lessons in parallel."

**[0:45] Switch to the finished course made earlier from the same folder and sentence**

"A full build takes about five minutes, so here is the same sentence, built earlier. Two more roles check
the work. The Coder runs every code exercise: nothing ships unless the solution passes its tests. The
Checker re-solves every auto-marked answer against my own slides. Here it rejected one: the answer key said
49 goes to slot 9, and it quoted slide 11, '49 goes to 9, taken, try 0', then rewrote the question. In
this course: 80 of 80 checks passed, 14 of 14 code tests, 3 answers rejected and rewritten."

**[1:20] Course: press Run on the exercise, press play on narration for 3 seconds, click a citation chip**

"The code runs in the page. Every answer shows the slide it came from. And it reads itself aloud, for the
bus ride."

**[1:40] Finished screen: the files**

"And it is not a chat. It is a folder I own: the course as one offline file, a day-by-day plan, an Anki
deck, review dates in my calendar counted back from the exam, and a report of every check. That course
cost four cents of AI. About five cents is typical."

**[2:00] Course list: Mutiara Tea Bar**

"Small businesses have the same problem. A bubble-tea shop hires new crew every few weeks and trains them
from an SOP nobody reads. Same app, their SOP folder, one sentence: a day-one course with a pass mark,
narrated in English and Malay. 7 lessons, 231 of 231 checks passed, nine cents."

**[2:25] Slide: how and where we used WorkBuddy**

"How we used WorkBuddy: our pitch deck was made in WorkBuddy's Slides Creation, we compared plain WorkBuddy
on this same student request, and we shipped BiliMind as a WorkBuddy skill and Expert Team too, so a
WorkBuddy user gets this course from one sentence."

**[2:45] Closing slide + the releases page**

"BiliMind Desktop is open source under AGPL. Download it from GitHub, bring your own key, and your files
never go to a server of ours. Drop in your files. Get a course, checked against them."

### Timing table (Phase 1)

| Start | End | Screen | Beat | Cut first if late |
|---|---|---|---|---|
| 0:00 | 0:20 | Building screen | The personal problem, Build pressed | never |
| 0:20 | 0:45 | Building screen | Lead plans and cuts, Writers in parallel | shorten |
| 0:45 | 1:20 | Finished course (earlier build) | Coder, Checker rejection with slide quote, numbers | never |
| 1:20 | 1:40 | Course | Run code, citation, narration | drop narration |
| 1:40 | 2:00 | Finished screen | Files you own, cost | shorten |
| 2:00 | 2:25 | Mutiara Tea Bar | Small business half of the theme | 2nd to cut |
| 2:25 | 2:45 | Slide | How and where we used WorkBuddy | never (organisers ask for it) |
| 2:45 | 3:00 | Slide + releases page | Open source, download | never |

If the timer shows 2:00 while still on the course: one sentence on the shop, then the WorkBuddy slide.

---

## 3. Phase 2: the 4-minute demo (video call)

Same setup; share the app window only. Press Build when the call starts. Changes to Phase 1:

| Start | End | Screen | Beat (additions in bold) |
|---|---|---|---|
| 0:00 | 0:25 | Home, then Building | Personal problem, Build pressed. **Show the folder: four slide decks and a past paper.** |
| 0:25 | 1:00 | Building | Lead, plan, Writers. **Point at a kept topic and a cut topic with its reason.** |
| 1:00 | 1:45 | Finished course (earlier build) | Coder and Checker, the rejection with the slide 11 quote. **Open `REPORT.md` for 5 s: every check, every rejection, the cost.** |
| 1:45 | 2:25 | Course | Run code, citation chip, narration. **Open `plan.md`: assumptions written instead of questions, topic weights, cut reasons.** |
| 2:25 | 2:55 | Mutiara Tea Bar | Small business. **Play the Malay narration for 2 s.** |
| 2:55 | 3:20 | Building screen | **If the live build has finished, open it and say so; if not, show how far it got and say so.** |
| 3:20 | 3:40 | Slide | How and where we used WorkBuddy |
| 3:40 | 4:00 | Slide + releases page | Open source, download, tagline |

---

## 4. Backup plan

| If | Then | Say |
|---|---|---|
| The live build is still running at 0:45 (expected) | Switch to the earlier course | "Still writing. Here is the same sentence, built earlier." |
| The live build fails | Leave it; use the earlier course | "It stopped on the venue network. Here is the same sentence, built earlier." |
| The app will not start or the network fails | Showcase `index.html` from the desktop in Edge | "Hackathon Wi-Fi. Here is the same course as files on the laptop." |
| Narration does not play | Skip it | "It also reads itself aloud." |
| Time runs short | Drop narration, then `plan.md`, then the shop. Never drop the rejection, the WorkBuddy slide or the download. | |

---

## 5. Q&A: 12 likely questions

Rule: two or three sentences, then stop. End on a fact or something you can show.

**1. Privacy: where do my files go?**
Your files stay on your laptop and the course is a folder on your disk. Only the passages needed for each
step go to the AI provider you chose, with your own key; there is no BiliMind server and no account. So it
is private by default, not air-gapped.

**2. What does it cost?**
About five cents a course in AI text: our two measured runs cost $0.046 and $0.047. The showcase courses
cost $0.040, $0.094 and $0.055. Narration uses free Edge voices. The app itself is free and open source.

**3. How do you stop hallucinations?**
Every auto-marked answer is re-solved against your files by the Checker, and it must quote the slide word
for word; the code refuses a quote that is not in the file. Wrong answers are rejected and rewritten
(3 of 3 in the Data Structures course), and anything not in your files is labelled "Beyond your slides".
Every answer shows its source in one click.

**4. Why a desktop app?**
Your slides and your company's SOP stay on your machine, you use your own key, and the result is files you
keep: an offline course, an Anki deck, a calendar. No login and nothing to host.

**5. Why not NotebookLM, or just ChatGPT?**
They give you a chat. We give you an ordered course weighted by your past paper, code that was run before
you saw it, answers checked against your slides, narration, and reviews in your calendar, as files you own.
We ran plain WorkBuddy on the same request: a reasonable plan, but no slide citations, no tested code, no
narration and no exports.

**6. Does it work offline?**
The finished course does: one HTML file that opens from disk with no network. Building a course needs the
internet for the AI calls and the voices.

**7. Business model?**
For students it stays free and open source; they pay cents to their own AI provider. Our hypothesis, not yet
tested: small businesses pay for team features (who finished onboarding, scores, refreshers) and schools for
course packs.

**8. How did you use WorkBuddy?**
Three ways: the pitch deck was generated in WorkBuddy's Slides Creation; we compared plain WorkBuddy on the
same student request; and we shipped BiliMind as a WorkBuddy skill and Expert Team, validated with
WorkBuddy's own validator. The desktop app itself we built with AI coding agents outside WorkBuddy. Links and
screenshots: `docs/workbuddy.md`.

**9. Which languages?**
Lessons are written in the language you ask for, and narration uses Edge voices: the tea shop course is
narrated in English and Malay, and the Malay survival course drills Malay phrases. Code exercises run
JavaScript for now.

**10. Does it scale?**
Each build runs on the user's own machine with the user's own key, so our cost per course is close to zero.
Writers run in parallel; bigger folders take longer, not more of our money.

**11. What's next?**
A pilot with one Taylor's module, with a proper comparison, because we do not claim grade gains we have not
measured. Then macOS and Linux builds, Python exercises, reading scanned slides, and a real shop's SOP with
its permission.

**12. Who are you and what did you build here?**
Opus Magnum: Oybek Odilov, Abdugaffor Odilov, Ramil Khutlimuratov and Gameel Al-Bazeeli. BiliMind existed as
a web app; we reused its teaching prompts. The engine, the Checker and Coder, the past-paper planner, the
offline player, the WorkBuddy skill and the desktop app were built this weekend; the repo history is the
timestamped record.

Spare answers (only if asked):

- "Tests?" core 55, engine 195, player 73, CLI 12, skill 12, all passing at the last integration gate.
- "Slow?" The long steps are the outline (109-117 s) and narration (about 100 s); lessons are written in
  parallel.
- "Is turning lecturer slides into a course allowed?" Same as making your own notes for personal study, kept
  on your laptop. Our demo uses openly licensed teaching material with attribution.
- "Why does testing yourself matter?" Students who test themselves remember far more a week later than
  students who reread (Karpicke and Roediger 2008, Science). Sources in `hackathon/research/pitch.md`.
