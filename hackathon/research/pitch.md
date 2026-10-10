# BiliMind for WorkBuddy: hackathon strategy and pitch

Dormathon at Taylor's University. Track 2: WorkBuddy, agentic solutions.
Team: the Odilovs (four people). Oybek is a student in Malaysia.
Status: complete (2026-10-10). Sections: 0 bet, 1 problem evidence, 2 competitor gap,
3 judging criteria, 4 pitch + demo scripts, 5 showcase courses, 6 name and tagline, 7 Q&A,
8 risks, 9 sources.

Note: `C:\Users\User\Desktop\AI SLIDES .pdf` is a 0-byte file on disk (empty or a cloud placeholder),
so this document works from the hackathon brief relayed in the task. Re-check the slides when the
real file is available, especially judging weights and the demo time limit.

---

## 0. The bet in one paragraph

Students study by rereading their slides, which is the technique learning science rates lowest. The
techniques that work (practice testing and spaced review) take hours to set up by hand, so almost
nobody does them. Our entry: a student types one sentence into WorkBuddy, and WorkBuddy, equipped
with the BiliMind Skill and tools, works like a small course-building team. It reads the files in
the student's folder, plans a path, writes lessons in parallel, records narration, writes and
*runs* code exercises, checks every quiz answer against the slides, and hands back a folder the
student owns: an offline interactive course, Markdown notes, an Anki deck and a calendar of spaced
reviews. The same engine turns a cafe's SOP into a narrated staff-onboarding course in the
languages its staff actually speak. One prompt, one goal, finished files.

---

## 1. Problem evidence

### 1.1 Learning science: what works, and what students actually do

| Claim | Evidence | Source |
|---|---|---|
| Practice testing and distributed (spaced) practice are the two best-rated study techniques; rereading, highlighting and summarising are rated **low utility**. | Review of 10 techniques by five cognitive psychologists. Only practice testing and distributed practice got "high utility". | Dunlosky, Rawson, Marsh, Nathan & Willingham (2013), *Psychological Science in the Public Interest* 14(1). APS release: https://www.psychologicalscience.org/news/releases/which-study-strategies-make-the-grade.html |
| Retrieval, not re-study, is what makes memory stick. | Students learning Swahili-English pairs: conditions with repeated retrieval recalled **about 80%** a week later; conditions that dropped items from testing recalled **36% and 33%**, even when students kept restudying them. Students' predictions of their own recall were uncorrelated with actual recall. | Karpicke & Roediger (2008), "The Critical Importance of Retrieval for Learning", *Science* 319. PDF checked: https://www.brucehayes.org/Teaching/papers/2008_Roediger_Karpicke_Science.pdf |
| Students do the opposite of what works. | Survey of 177 college students: **84%** reread notes or textbook, **55%** said rereading is their number-one strategy, only **11%** practised retrieval, and **1%** (2 of 177) named it as their top strategy. | Karpicke, Butler & Roediger (2009), *Memory* 17(4). PDF checked: https://bpb-us-e2.wpmucdn.com/sites.wustl.edu/dist/8/805/files/2026/06/Karpicke-et-al.-2009-Metacognitive-strategies-in-student-learning-Do-students-practise-retrieval-when-they-study-on-thei.pdf |
| Spacing beats cramming, and students cannot feel it. | Flashcard experiments: spacing beat massing for **90%** of participants, yet **72%** believed massing had worked better. Spacing also beat cramming the day before the test. | Kornell (2009), "Optimising learning using flashcards: Spacing is more effective than cramming", *Applied Cognitive Psychology* 23(9). |
| The spacing effect is one of the most replicated results in psychology. | Meta-analysis: 839 assessments, 317 experiments, 184 articles; the best gap between reviews grows with how long you need to remember. | Cepeda, Pashler, Vul, Wixted & Rohrer (2006), *Psychological Bulletin* 132(3). https://pubmed.ncbi.nlm.nih.gov/16719566/ |
| Practice tests beat restudying across the literature. | Meta-analysis of 118 articles: practice tests were more beneficial than restudying and every other comparison condition. | Adesope, Trevisan & Sundararajan (2017), *Review of Educational Research* 87(3). |
| Passive learning fails more students. | 225 STEM studies: failure rate **33.8%** under lecturing vs **21.8%** with active learning (lecture students 1.5x more likely to fail); exam scores +0.47 SD with active learning. | Freeman et al. (2014), *PNAS* 111(23). https://pmc.ncbi.nlm.nih.gov/articles/PMC4060683 |
| Plain AI answers can make learning worse. | Field experiment, ~1,000 high-school maths students: with ungated GPT-4, practice scores rose 48%, but when access was removed they scored **17% worse** than students who never had it. A tutor version with learning guardrails largely removed the harm. | Bastani et al. (2025), "Generative AI without guardrails can harm learning", *PNAS* 122(26). https://knowledge.wharton.upenn.edu/article/without-guardrails-generative-ai-can-harm-education |

**What this means for the pitch:** "AI that explains your slides" is the wrong product. Rereading an
AI summary is still rereading. The value is turning the slides into **retrieval practice on a
schedule**, which is the expensive part to do by hand. That is the job we give the agent.

Use in the pitch (one line, memorable): *"84% of students reread. Rereading is the technique science
rates lowest. Students who test themselves remember 80% a week later. Students who reread remember
about a third."* (Karpicke 2009 + Karpicke & Roediger 2008.)

### 1.2 The student pain, concretely

- **Cramming from slides.** The real input a student has before an exam is a folder of lecture
  PDFs or PPTX files. Slides are compressed notes for the lecturer, not study material. The common
  routine is: open slides, reread, highlight, maybe ask ChatGPT to "explain this slide". All
  low-utility per Dunlosky.
- **Setup cost kills good habits.** Making 150 good flashcards, a practice quiz with explanations
  and a spaced schedule for one module is hours of work, so students skip it (11% practise
  retrieval). The agent removes the setup cost, which is the actual barrier.
- **Context switching.** Today a student who wants the good version uses 4-5 tools: slides in a
  viewer, ChatGPT for explanations, Quizlet or Anki for cards (typed by hand or copy-pasted),
  a calendar for reviews, an IDE for code practice. Nothing joins them. WorkBuddy's own tagline is
  "1 brief. 100+ Experts. Multiple agents in parallel. 0 copy-paste." (Tencent Cloud guide:
  https://www.tencentcloud.com/techpedia/144100?lang=en). Our entry is that tagline applied to
  studying.

### 1.3 Malaysia / Taylor's context (why the judges will recognise it)

| Fact | Source |
|---|---|
| Malaysia had **159,138 international students** in public and private higher education at 31 Dec 2025, **12.6%** of 1,264,541 total enrolment. Top sources of new students in Jan-Nov 2025: China (29,388), Bangladesh (8,957), India (3,410). | The Star, 5 Jul 2026, citing MOHE: https://www.thestar.com.my/news/nation/2026/07/05/international-students-account-for-126-of-higher-education-institutions039-enrollment-says-ministry ; Malay Mail, 18 Dec 2025 (EMGS figures) |
| The MQA requires every student, Malaysian or international, to complete MPU general studies to be awarded a certificate, diploma or degree (modular MPU since 2014). | https://en.wikipedia.org/wiki/Mata_Pelajaran_Umum |
| **At Taylor's, international degree students must pass "Bahasa Melayu Komunikasi 2"** (2 credits, MPU U1) to graduate; diploma students take "Bahasa Melayu Komunikasi 1". | Taylor's University, "Malaysian Compulsory and General Studies Modules": https://university.taylors.edu.my/en/student-life/manage-your-studies/malaysian-compulsory-and-general-studies-modules.html |
| Taylor's is ranked in the global top 40 for international student share (QS indicator); an older published breakdown listed 3,795 international students from 85+ countries (China 31%, Indonesia 20%, Bangladesh 7.8%, Maldives 6.5%). Treat the 3,795 as dated; say "students from 85+ countries" in the pitch, not the number. | Unienrol guide: https://articles.unienrol.com/the-complete-guide-to-taylors-university/ |

So: every international degree student at the host university has a graduation requirement that
is mostly **speaking** practice in a language they do not hear at home. That is our first showcase
course (Section 5), and the voice + microphone drill is the most entertaining thing we can put on
stage.

### 1.4 Small business: the same problem in a cafe

| Fact | Source |
|---|---|
| MSMEs are **96.1%** of Malaysian business establishments (1,086,386 firms) and **48.7%** of employment (2024). | DOSM, MSME Performance 2024: https://www.dosm.gov.my/portal-main/release-content/micro-small--medium-enterprises-msmes-performance-2024 |
| Southeast Asian frontline sectors (F&B, retail, hospitality...) see turnover of **up to 48% a year**, costing **US$22.6 billion** a year in replacement and retraining. These sectors employ 137 million people, 46% of the region's workforce. | Momentum Works x Lark, "Transforming Frontline Industries", 23 Jul 2024: https://thelowdown.momentum.asia/press-release-frontline-turnover-costs-businesses-us22-6-billion-annually-in-southeast-asia-momentum-works-and-lark-report/ |
| Malaysia had **2,144,789 foreign workers** at 30 Jun 2025: Bangladesh 803,322, Indonesia 543,514, Nepal 332,712, Myanmar 173,630, India 106,929. | Free Malaysia Today, 28 Aug 2025, citing the HR Ministry: https://fmtv5.freemalaysiatoday.com/category/nation/2025/08/28/2-14mil-migrant-workers-in-malaysia-says-hr-ministry |
| Malaysian F&B operators describe language as a core onboarding problem: staff meetings switch between English, Malay and Cantonese, with Myanmar and Bangladeshi team members in the mix; a PJ cafe owner went viral asking customers for patience while training Myanmar and Bangladeshi staff. | StoreHub Malaysia onboarding guide: https://www.storehub.com/my/blog/how-to-staff-onboarding-malaysia ; SAYS foreign-worker stories: https://says.com/my/stories/tagged/foreignworkers |

The cafe version of the pain: the owner has an SOP in a Google Doc (in English or Malay), a new hire
every few weeks, no time to train, and staff whose first language is Burmese, Bengali or Nepali.
**Verified on this machine (2026-10-10): the free Edge-TTS voice list includes `ms-MY` (Yasmin,
Osman), `my-MM` Burmese (Nilar, Thiha), `bn-BD` Bengali (Nabanita, Pradeep), `ne-NP` Nepali
(Hemkala, Sagar), `ta-MY` Malaysian Tamil (Kani, Surya) and `id-ID` Indonesian (Gadis, Ardi).**
So the agent can narrate the same SOP lesson in the new hire's own language at zero voice cost.
The honest caveat (say it before a judge does): machine translation of safety steps must be
checked by a fluent staff member, and the course says so on its first page.

### 1.5 Measurable value we can claim (and how we show it on stage)

| Value | Number | How we prove it |
|---|---|---|
| Setup time for retrieval practice | Hours by hand (150 cards + quiz + schedule) vs one sentence and ~5 min of agent time | The live run's wall clock, shown in WorkBuddy |
| Model cost per course | BiliMind SaaS production: **$0.00216 per lesson** (595 flash expansions, deepseek-v4-flash via OpenRouter) and ~$0.01-0.02 for an outline, so an 8-lesson course is **about 3-5 US cents** of text generation. Narration (Edge-TTS) is free. | The cost log from the live run, summed on screen. Re-measure on our hackathon runs and replace these numbers before the pitch. |
| Recall | Retrieval practice ~80% vs ~33-36% a week later (Karpicke & Roediger 2008) | Cited, not claimed as our own result. We do not claim grade improvements we have not measured. |
| Quiz trustworthiness | Every answer carries a citation to a slide/page; the checker rejects answers it cannot find in the sources | Show the checker's rejection log from the run (Section 3) |

---

## 2. Competitor gap

The judge's first thought will be "NotebookLM already does this". The answer has to be one
sentence, then a table if they push.

**One sentence:** *NotebookLM gives you a chat and a pile of separate study artifacts inside
Google; BiliMind on WorkBuddy gives you an ordered course, with practice that is checked against
your slides and reviews already on your calendar, as files you keep.*

### 2.1 What each tool does and does not do (October 2026)

| Tool | What it is good at | What it does not do (our opening) | Source |
|---|---|---|---|
| **NotebookLM / Gemini Notebook** (renamed 16 Jul 2026; 30M+ users) | Grounded chat with clickable citations; Studio artifacts: audio/video overviews, mind maps, reports, flashcards, quizzes (4 types since Sep 2026), slides, infographics. Free tier is generous. | **No course structure**: "a notebook is a pile of sources + one-off artifacts. No ordered path, prerequisites, progress, or 'what should I study next'". **No spaced-repetition scheduler** (flashcards have Got it / Missed it, no due dates). **No runnable code exercises for learners** (its cloud computer is for the model's data analysis). **No full export**: flashcards and quizzes cannot be exported; notes go to Google Docs only. Gemini-only, cloud-only, 50 sources per notebook on free. Infographics and slides bake text into images that come out misspelt, especially non-Latin scripts. | `plan/research/res-notebooklm.md` §1, §3.3, §10, §11, §13, §20; `res-oss-rivals.md` §6 |
| **Gemini app "Study Notebooks"** (Jun 2026) | Diagnostic quiz -> personalised study plan -> progress dashboard. Google's closest thing to a course. | Lives in a separate app from Notebook, cloud only, a dashboard (not files), no code practice, no calendar/Anki output. | `res-notebooklm.md` §10.3, §13 |
| **ChatGPT study mode** (29 Jul 2025) | Socratic step-by-step tutoring, knowledge checks, adapts to level. | A conversation, not an artefact. Nothing persists as a course, no schedule, no deck, no files; the student has to drive every step (the opposite of "one prompt, end-to-end"). | https://openai.com/index/chatgpt-study-mode/ |
| **Quizlet** (Plus $7.99/mo or $35.99/yr) | Magic Notes turns uploaded notes/PDFs into flashcards and practice tests; Learn mode; huge card network. | Cards and tests only, no lessons, no code, no narration, no ordered path. Free tier caps AI generation (about 2 documents/week) and Learn rounds. Data lives in Quizlet. | https://nibble-app.com/blog/quizlet-cost ; `res-oss-rivals.md` §5 |
| **Anki** (free; FSRS scheduler built in since 23.10, Nov 2023) | The best spaced-repetition engine there is. | You make every card by hand. No generation, no lessons. **We do not compete with Anki, we feed it**: the course ships a ready `.apkg` deck. | https://en.wikipedia.org/wiki/Anki_(software) |
| **Coursera** (Plus $59/mo or $399/yr; Coursera Coach AI tutor) | Professionally made university courses with certificates. | Courses about *their* syllabus, not your lecturer's slides or your shop's SOP. Cannot build a course from your files. | subger.com Coursera pricing (third-party) |
| **StudyFetch / Turbo AI / Knowt / Mindgrasp** | Upload-everything study apps; StudyFetch even builds a study plan from deadlines with a cram mode. | Cloud subscriptions ($5-15/mo), mobile-first, usage caps, outputs locked in the app, no runnable code, no agent you can extend. | `res-oss-rivals.md` §5 |
| **DeepTutor (open source)** | Closest open-source rival: typed lesson "Books", mastery path, practice. | Python/Docker install; not a WorkBuddy skill; not files a student opens in Anki/Calendar/Obsidian. | `res-oss-rivals.md` §2.1 |

### 2.2 The gap, as a checklist judges can read in five seconds

| Needed before an exam | NotebookLM | ChatGPT study | Quizlet | Anki | Coursera | **BiliMind on WorkBuddy** |
|---|---|---|---|---|---|---|
| Built from **your** files | yes | paste-in | yes | by hand | no | **yes (local folder)** |
| Ordered course (what to study first, next) | no | no | no | no | yes (theirs) | **yes** |
| Lesson formats chosen by the kind of knowledge | no | no | no | no | fixed | **yes (archetypes)** |
| Narration you can play | podcast only | voice chat | no | no | video | **yes, per lesson, 16+ languages** |
| Runnable code practice | no | no | no | no | some | **yes (in-browser Python/JS/SQL)** |
| Quiz answers checked against the source | partly (citations) | no | no | n/a | n/a | **yes (checker rejects unsupported answers)** |
| Spaced review on a calendar | no | no | partial (Learn) | yes (manual cards) | no | **yes (.ics + Anki deck)** |
| You own the output as files | no | no | no | yes | no | **yes (HTML, Markdown, .apkg, .ics)** |
| One sentence, no further steering | no | no | no | no | no | **yes** |

### 2.3 Where competitors are better (say it before they do)

- NotebookLM's audio overviews are more polished than single-voice Edge-TTS narration, and it
  is free with no setup. Our answer: we are not competing on podcasts; we are the step after
  understanding (practice and schedule), and our output works offline forever.
- Anki's scheduler (FSRS) is better than our SM-2. Our answer: that is why we export to Anki.
- Coursera's content is expert-written. Our answer: your exam is on your lecturer's slides, not
  on Coursera's syllabus.

---

## 3. The concept mapped to every judging criterion

### 3.1 The agent team we are showing (so every proof below has something to point at)

WorkBuddy is the orchestrator. The BiliMind Skill (a `SKILL.md` plus bundled tools; WorkBuddy
loads skills from `~/.codebuddy/skills/` or a project's `.codebuddy/skills/`, picks them by their
`description`, and can run a skill in a forked sub-agent: https://www.workbuddy.ai/docs/cli/skills)
tells WorkBuddy how to act as a course team. Content generation goes through the student's own
OpenRouter key (BYOK, deepseek-v4-flash class models), so WorkBuddy credits pay for orchestration
and the text costs cents.

| Role | What it does | Tool(s) it calls | Output |
|---|---|---|---|
| **Reader** | Opens every file in the authorised folder; splits it into anchored chunks (`L3 slide 14`, `SOP p.2`) | WorkBuddy's built-in PDF/PPT skills or our `read_sources` | `sources.json` with anchors |
| **Planner** | Turns the goal + deadline into an ordered path; labels each topic with an archetype (procedure, concept, calculation, speaking...) so **code, not the model, picks the lesson formats** | `plan_course` | `course.json` roadmap |
| **Writers (in parallel)** | One sub-agent per lesson, grounded only in that lesson's chunks, every claim and quiz answer carries an anchor | `write_lesson` | lesson JSON + Markdown |
| **Narrator** | Records narration per lesson in the right voice and language | `narrate` (Edge-TTS: ms-MY, my-MM, bn-BD, ne-NP, en, zh...) | `audio/*.mp3` |
| **Coder** | Writes code exercises with hidden tests, then **runs** the reference solution against the tests; fixes or drops anything that fails | `run_code_tests` (local Python) | exercises that are known to pass |
| **Checker** | Rejects any quiz answer whose cited anchor does not support it; rejects malformed blocks; sends rejects back to the writer with the reason | `check_quiz`, schema validators | pass/fail log |
| **Packager** | Builds the deliverables and a report of what was checked | `build_deck` (Anki .apkg), `build_schedule` (.ics), `package_course` (offline index.html in the cobalt design + Markdown vault) | the finished folder + `REPORT.md` |
| **Coach (Automation)** | Each morning until the exam, sends the day's due review questions | WorkBuddy scheduled Automation + Telegram connector | a message on the student's phone |

Build checklist implied by this table (every row must be real before the demo, or cut from the
script): the checker must produce at least one genuine rejection in the recorded run; the coder
must actually execute tests; the Automation must actually send a message.

### 3.2 The six capabilities the brief lists

| Capability (from the brief) | What our agent does | What the judges see |
|---|---|---|
| Understanding the goal | Parses "final on Friday, slides in this folder" into: subject, deadline (date), sources, and what "ready" means (practice + schedule). States assumptions at the top instead of asking ("45 min a day, exam on Friday 9:00, dated from today"). | The assumptions block at the top of WorkBuddy's plan and on the course's first page |
| Planning tasks | Writes its own task list: read, plan, write x N, narrate, code+test, check, package, schedule | WorkBuddy's task plan panel, generated from one sentence |
| Executing actions | Calls real tools: reads PDFs, writes files, runs Python, synthesises audio, builds .apkg/.ics | Files appearing in the output folder during the run |
| Collaborating and validating | Writers hand to the checker; checker hands rejects back; coder runs tests | The rejection log: "Q7 rejected: slide 22 does not state O(n log n) worst case -> rewritten -> passed" |
| Integrating results | Packager merges lessons, audio, deck and schedule into one coherent course with one roadmap | One `index.html` that ties everything together; `REPORT.md` with counts |
| Delivering the final outcome | A folder on the student's disk + an Automation that keeps working after the chat ends | Opening the files in a browser, Anki and a calendar; a Telegram message arriving |

### 3.3 The five criteria and the core question

| Criterion | Our claim | The exact proof we show live | Risk if we cannot show it |
|---|---|---|---|
| **Core question: "Can your AI Agent use WorkBuddy to solve a real problem and actually get things done?"** | Yes: input is a folder of slides, output is a finished study system in standard file formats. | Before: folder with 3 lecture PDFs. After: folder with `index.html`, `lessons/*.md`, `deck.apkg`, `reviews.ics`, `audio/`, `REPORT.md`. We open three of them in real apps on stage. | If the live run is slow, show the morning run of the same sentence (Section 4.3). Never show a spinner for more than 10 seconds. |
| **1. Real problem and user value** | User: a university student with a final in 5 days and a folder of slides. Second user: a cafe owner with an SOP and a new hire. Problem: the techniques that work take hours to set up. | One stat slide (84% reread; 80% vs ~1/3 recall). Live numbers from the run: minutes taken, cards made, cost in cents. | Judges think it is "nice to have". Counter with the Taylor's BMK2 requirement and the F&B turnover stat: these are people who must learn something specific by a date. |
| **2. Agentic workflow** | Task decomposition, multi-step execution, tool calls, parallel sub-agents, validation, adaptation on failure. | WorkBuddy's plan panel; 4+ lesson writers running at once; the checker's rejection and the rewrite; a code test that failed then passed. | If it looks like one big prompt, we lose this criterion. The rejection log is the single most important screen in the demo. |
| **3. Meaningful use of WorkBuddy** | WorkBuddy is the execution platform: skill, local folder access, built-in file skills, parallel agents, Automations, IM connector. Not a chat wrapper: the deliverable is files and a scheduled job. | The BiliMind skill in WorkBuddy's skill list; the authorised folder; the Automation entry; the Telegram message. | If we show our own web app doing the work, judges will say WorkBuddy is decoration. The SaaS must not appear in the demo. |
| **4. End-to-end execution** | One prompt, zero follow-ups. | The WorkBuddy conversation has exactly one user message. Say it out loud: "I typed once." | If the agent stops to ask a question mid-run, the demo breaks the rule. The Skill must tell the agent to assume and record, never ask. |
| **5. Usable and verifiable results** | Files open in apps students already use; every quiz answer cites a slide; every code exercise has passing tests; a report says what was checked. | Click a citation chip in a quiz -> the slide text appears. Run a code exercise -> green tests. Open `REPORT.md`: "41 questions, 3 rejected and rewritten, 6/6 code tests pass, cost $0.04, 4 min 12 s". | If a citation points to the wrong slide on stage, trust collapses. Rehearse on the exact demo files; pick a lesson we have checked by hand. |

---

## 4. Pitch script (3 minutes) and live demo script (2 minutes)

### 4.0 The structure, and why

- **The trick:** the pitch starts by pressing Enter on the live run, so the agent works *during*
  the talk. The demo then opens with a finished result instead of a progress bar. That is the
  reveal moment, and it proves "end to end, no steering" better than any slide.
- **Roles:** Oybek speaks. A second team member drives the laptop (call them the **driver**;
  Sharif is the natural fit as the engineer). A third holds the backup laptop with every
  pre-generated course already open in tabs. Ulugbek takes business-model questions in Q&A.
  (Confirm who will be on stage; the script works with two people.)
- **Pace:** about 420 spoken words (counted) plus two pauses (the hand raise, the turn to the
  screen). That needs ~150 words a minute to land at 3:00, so speak briskly in the problem and
  output paragraphs and slow down only for the checker. If a rehearsal runs over, shorten the bubble-tea
  paragraph to its first sentence and the last one; never cut the checker paragraph.
- **Every number said on stage is in Section 1 with a source.** Do not improvise numbers.
- **Personal story slot (0:30-0:40).** The script uses only facts we know: Oybek is from
  Uzbekistan and studies in Malaysia; *bilim* is Uzbek for knowledge. If Oybek has a true,
  specific memory (the night before an exam with only slides; his own Bahasa Melayu class; a
  friend's cafe struggling with new staff), add it here in two sentences, with a detail only he
  would know (the module, the time of night, the phrase he could not pronounce). Do not invent
  one: a judge from Taylor's may ask a follow-up.

### 4.1 Pitch, word for word (0:00-3:00)

**[0:00] Screen: WorkBuddy, empty conversation. The folder "DSA Final" with three lecture PDFs is
authorised and visible.**

OYBEK: "Before I say anything else, I'm going to give an AI agent one sentence."

*(Driver pastes, Oybek reads it aloud as it appears:)* "My Data Structures final is on Friday.
The slides are in this folder. Get me ready."

*(Enter.)*

"That's the whole interface. We'll come back to it in three minutes."

**[0:15] Slide: one line, "Who has studied by rereading the slides?"**

"Quick show of hands. Who has prepared for an exam by rereading the slides?"

*(Pause. Most hands go up.)*

"Keep your hand up if you still remembered them a week later."

*(Hands drop. Laugh.)*

"Same. I'm Oybek. I'm from Uzbekistan, and I study here in Malaysia. Our project is called
BiliMind. *Bilim* means knowledge in Uzbek."

**[0:40] Slide: "84%" large; under it "80% vs 36%".**

"Here's the uncomfortable part. In one survey, 84% of students said they study by rereading, and
learning scientists rate rereading near the bottom. What works is testing yourself, spread over
days. In one experiment, students who kept testing themselves remembered about 80% a week later. Students who kept restudying remembered about a
third."

"So why doesn't everyone do it? Because turning slides into good questions, flashcards and a
review schedule takes hours. And nobody has hours on the Tuesday night before a Friday exam."

**[1:15] Slide: the agent team on the dotted cobalt canvas: Reader, Planner, four Writers,
Narrator, Coder, Checker, Packager, joined by dashed connectors.**

"So we gave those hours to an agent. BiliMind is a skill that turns WorkBuddy into a
course-building team. From one sentence, it plans the job itself, reads the slides, draws a study
path, and splits up. Four writers work on lessons at the same time. A
narrator records every lesson. A coder writes programming exercises and actually runs them, so
we know they work."

"And then there's the strict one: the checker. Every quiz answer has to point to a slide. If it
can't, the checker throws it back, and the writer tries again. You never get quizzed on
something your lecturer didn't say."

**[1:55] Slide: four file icons: index.html, Notes (Markdown), Anki deck, Calendar.**

"What comes back is not a chat. It's a folder. An interactive course that works offline. Notes
in Markdown. A deck for Anki. And your reviews, already in your calendar, spaced the way the
science says. Your files. On your laptop. Forever."

**[2:15] Slide: a cup object in the cobalt style (generate one without text if
`img/11/obj-*.webp` has none); "SOP.pdf -> onboarding course in Malay, Bengali, Burmese".**

"It isn't only for students. Picture a bubble-tea shop in SS15: new staff every month, an SOP
nobody reads, and half the crew speaks Bengali or Burmese. Same agent, one sentence: a narrated
onboarding course in their languages, with a quiz they pass before their first shift."
*(Add only if a rehearsal comes in under 2:50: "Frontline businesses in our region lose up to
half their staff a year. Training them again is the cost nobody budgets.")*

**[2:35] Slide: "about 4 cents per course".**

"A whole course costs about four cents of AI. The narration is free. And it took about..."

*(Oybek turns to the screen.)* "...as long as this talk. Let's see what it did."

**[2:50]** "One sentence in. A course out."

### 4.2 Live demo, click by click (3:00-5:00)

The driver clicks; Oybek narrates. Times are from the start of the demo.

| Time | Driver does | Screen shows | Oybek says |
|---|---|---|---|
| 0:00 | Scroll WorkBuddy's run to the top | WorkBuddy's own task plan, generated from the sentence: read 3 files -> plan path -> write N lessons (parallel) -> narrate -> write + test code -> check quizzes -> build deck + calendar -> package. Assumptions line: exam date, minutes per day. | "This plan was written by the agent. I typed one sentence; I didn't write any of these steps. It even worked out which date 'Friday' is." |
| 0:15 | Scroll to the parallel section | Four or more lesson writers running or finished side by side with timings | "Here are the four writers working at the same time." |
| 0:25 | Open the checker's log (or the step in WorkBuddy that shows it) | A real rejection: "Q7 rejected: the cited slide does not support the answer. Rewritten. Passed." And: "Code: 6 exercises, 6/6 tests pass (exercise 4 failed once, fixed)." | "This is my favourite part. It argued with itself. The checker caught a question the slides didn't support, and sent it back." |
| 0:40 | Open the output folder in Explorer | `index.html`, `lessons/`, `audio/`, `DSA-Final.apkg`, `reviews.ics`, `REPORT.md` | "And this is what I actually get. Files." |
| 0:45 | Double-click `index.html` | The course in the cobalt design: the roadmap path, topics as dark milestone cards on a dotted canvas | "A course with an order: what to learn first, what next." |
| 0:55 | Click topic "Hash tables" (or the topic rehearsed), press play on narration for 3 seconds, scroll to a quiz | Lesson page; narration plays; diagram; a quiz question with a citation chip "Lecture 4 - slide 12" | "Every answer shows where it came from." *(Click the chip: the slide text appears.)* |
| 1:10 | Scroll to the code exercise, click **Run** | Python runs in the browser; tests turn green | "Real Python, running in the browser. No install." |
| 1:20 | Double-click `reviews.ics` | Calendar shows reviews spread across Mon-Thu mornings before Friday | "And my reviews are already in my calendar. Spaced out, not crammed." |
| 1:30 | Switch to the backup laptop's tab: the **Bahasa Melayu Survival Kit** course, speaking drill | Card: "Teh tarik kurang manis, satu." Malay voice (Yasmin) plays it | "Same agent, different sentence. Every international student here has to pass Bahasa Melayu to graduate. So..." *(Oybek says the phrase into the mic; the score appears. If the score is low, try once more: the retry is the joke.)* |
| 1:50 | Hold up the phone (or show it mirrored) | A Telegram message from the WorkBuddy Automation: "Good morning. 5 Data Structures questions are due today." | "And every morning until Friday, it sends me what to review. One sentence, and it keeps working after I close the chat. That's BiliMind on WorkBuddy." |

### 4.3 Backup plan (decide before going on stage, not during)

| If... | Then... | Line to say |
|---|---|---|
| The live run is still going at demo start | Show the plan and the parallel writers (still impressive), then open the morning run of **the same sentence on the same folder**, already finished | "It's still writing the last lessons. Here's the same sentence I ran at 9 this morning." |
| WorkBuddy or the network fails | Play the screen recording of the best rehearsal run (sped up 4x with a visible clock), then open the pre-generated folders, which work offline | "Hackathon wifi. Here's the recording of this exact run from this morning." |
| The mic or speech scoring fails | Play the Malay audio and skip scoring; the drill has a type-it fallback | "The microphone is shy today." |
| The Telegram message does not arrive | Show the message from the previous morning (screenshot in the deck) | "Here's the one it sent me this morning." |
| A citation chip opens the wrong slide | Do not click citations live except on the one rehearsed question | (Avoid the situation.) |
| Time is short | Drop the calendar step (1:20) first, then the code step (1:10). Never drop the checker log or the speaking drill. | |

Preparation that makes the backups real:
1. The morning run: same sentence, same folder, run on the demo laptop on the day; keep it open.
2. Screen recording of a full run (OBS, 1080p), sped up with a visible timer; plus a still
   screenshot of every screen in 4.2 inside the slide deck as the last-resort fallback.
3. All four showcase courses as folders on both laptops and a USB stick. The offline course
   must vendor its runtime (Pyodide, fonts, Mermaid) locally, so it works with wifi off. Test
   that with wifi off.
4. Phone hotspot as the second network. OpenRouter balance checked the night before. WorkBuddy
   credits checked (the free tier is 100 credits a month plus 250 for new users; Pro is $10 for
   2,000 credits a month: https://www.workbuddy.ai/docs/workbuddy/pricing). Buy Pro for the
   hackathon week rather than risk running out in rehearsal.
5. Rehearse the live run at least three times in a row on the venue network. If it does not
   finish in under 4 minutes all three times, cut the live course to 4 lessons.

### 4.4 Optional closing gag (only if there is time, and only if the team likes it)

Run the BiliMind skill on the organisers' own judging brief before the event and hand the judges
a 60-second "course": the five criteria as flashcards. Closing line: "We made one more course,
for you. It's five questions long. We hope we pass it." This is memorable and shows the agent on
a document the judges know by heart, but it can read as cheeky. Keep it for the end of Q&A, not
the pitch.

---

## 5. Showcase courses

Rules for all four: real public sources with their licence shown in the course footer, or a
sample document that says "Sample document, fictional business" on its first page. Images never
contain text (labels are real text over the picture). Keep each course to 6-8 lessons so a run
costs a few cents and finishes in minutes. Generate each showcase at most three times; keep the
best run. Budget check: at ~$0.002-0.003 per lesson plus ~$0.02 per outline, all four courses
with retries cost well under $2 of the ~$12 OpenRouter balance.

Archetype -> mandatory formats (from `plan/research/inv-generation.md` §8.1) is what makes each
course look different without anyone asking for formats: procedure -> walkthrough + checklist;
concept -> explainer + diagram + analogy; facts -> flashcards + reference table; calculation ->
worked example + playground; history -> timeline; safety -> checklist + scenario; speaking ->
speaking drill + role-play.

### 5.1 "Bahasa Melayu Survival Kit" (voice): the crowd-pleaser

- **Who it is for:** an international student in their first month in Malaysia, who also has to
  pass Bahasa Melayu Komunikasi to graduate (Section 1.3).
- **Why it wows:** the room hears a Malaysian voice (Edge-TTS `ms-MY-YasminNeural`), the presenter
  speaks into the mic and gets a score, and the role-play is at a mamak. Malaysian judges will
  recognise every phrase; the presenter's accent is the joke, not the product.
- **Block formats shown:** `speaking` (repeat after the native voice, word-level score), `dialogue`
  (role-play: order teh tarik kurang manis, ask a Grab driver to stop at the main gate), `flashcards`
  (numbers, food, directions), `reference_table` (pronunciation: "c" sounds like "ch", the
  unstressed "e"), `audio` (Listen), `quiz` (cloze: "____ kurang manis, satu").
- **Source material (honest):** Wikivoyage "Malay phrasebook" (CC BY-SA:
  https://en.wikivoyage.org/wiki/Malay_phrasebook): pronunciation, basics, numbers, transport,
  eating, drinking, money. The course footer says: "A practice companion, not the official BMK
  syllabus." Taylor's MPU page cited for why it matters.
- **One-sentence WorkBuddy prompt:** "I'm an international student at Taylor's with zero Malay;
  make me a survival course for my first month (mamak, Grab, campus) that also gets me started for
  my Bahasa Melayu Komunikasi class."
- **15-second demo moment:** play "Teh tarik kurang manis, satu", say it, show the score, retry.
- **Risks:** browser speech recognition for `ms-MY` needs Chrome/Edge and internet; the drill must
  fall back to "listen and type". The live `dialogue` role-play needs a model call; in the offline
  course, ship it as a scripted branching exchange or let it call the student's own key.

### 5.2 "Data Structures: Final on Friday" (code): the main live run

- **Who it is for:** the core user from the pitch: a CS student five days before a final.
- **Why it wows:** green tests on real Python in the browser; quiz answers with clickable slide
  citations; a Big-O cheat sheet the student keeps. This is the course that proves "verifiable".
- **Block formats shown:** `code` (runnable Python with hidden tests, executed by the coder agent
  before delivery and again in the browser via the WASM sandbox), `diagram` (Mermaid: hash buckets,
  tree rotation), `worked_example` (insert into a binary heap step by step), `playground` (drag
  the load factor, watch probe counts rise), `comparison` (array vs linked list vs dynamic array),
  `reference_table` (Big-O cheat sheet), `quiz` with citation chips, `flashcards` exported to Anki.
- **Source material (honest):** MIT OpenCourseWare 6.006 *Introduction to Algorithms*, Spring
  2020, lecture notes (CC BY-NC-SA 4.0, attribution to MIT and the instructors in the footer):
  https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/pages/lecture-notes .
  Suggested live folder: three PDFs, e.g. Lecture 2 (data structures and dynamic arrays), Lecture 4
  (hashing), Lecture 8 (binary heaps). Non-commercial demo use fits the licence. If a teammate has
  real Taylor's lecture slides, use them only on the laptop, never in a published artifact.
- **One-sentence WorkBuddy prompt:** "My Data Structures final is on Friday; the slides are in this
  folder, get me ready."
- **15-second demo moment:** click Run, tests turn green; click a citation chip, the slide text
  appears.
- **Risks:** Pyodide is ~10 MB; vendor it into the course folder so the demo works offline.
  Some OCW notes are dense maths; check that the planner does not produce 15 lessons (cap at 6).

### 5.3 "Boba Shop: Day One" (small business, multilingual voice)

- **Who it is for:** the owner of a small bubble-tea or kopitiam shop with a new hire every few
  weeks and a crew that speaks Malay, Bengali, Burmese or Nepali (Section 1.4).
- **Why it wows:** the same lesson narrated in Burmese (`my-MM-NilarNeural`) and Bengali
  (`bn-BD-NabanitaNeural`) at the click of a language switch, by a shop owner who speaks neither.
  It answers the track's "small businesses" half with something a judge can picture tomorrow.
- **Block formats shown:** `walkthrough` (make a brown-sugar milk tea: numbered steps, with what
  goes wrong at each step), `checklist` (opening and closing shift, tickable on a phone),
  `scenario` (a customer says they are allergic to dairy; a cup spills by the cashier: choose what
  to do), `reference_table` (sweetness and ice levels), `audio` in four languages, `quiz` with a
  pass mark before the first shift.
- **Source material (honest):** (1) a sample SOP we write, marked "Sample document, fictional
  shop" on page one; (2) the real legal baseline, cited accurately: Malaysia's Food Hygiene
  Regulations 2009 require food handlers to attend Food Handler Training at an MOH-recognised
  school and to be vaccinated against typhoid
  (https://www.informea.org/en/legislation/food-hygiene-regulations-2009 ; Malay Mail, 7 Feb 2025).
  The course says it is **not** a substitute for the MOH food-handler course.
- **One-sentence WorkBuddy prompt:** "Turn our SOP folder into a day-one onboarding course for new
  crew, in English, Malay, Burmese and Bengali, with a quiz they must pass before their first
  shift."
- **15-second demo moment:** switch the lesson language to Burmese, play two seconds of narration.
- **Risks:** machine translation of safety steps. The course's first page says "Translated by AI.
  Ask a fluent colleague to check before use", and the pitch says it first. Do not claim
  translation quality we have not checked; if a teammate or friend reads Burmese or Bengali, ask
  them to check one lesson and mention it.

### 5.4 "Why Rereading Lies to You" (visual: playground + timeline): the course about our own evidence

- **Who it is for:** any student; and the judges, because it is the evidence behind the pitch,
  built by the product itself.
- **Why it wows:** the most visual blocks in the catalogue: a forgetting-curve `playground` (drag
  the review interval and watch retention fall or hold), a `timeline` from Ebbinghaus (1885) to
  Anki's FSRS scheduler (2023), a `misconception` block ("rereading feels like learning: the
  fluency illusion"), and a `scenario` (it is 10 pm, the exam is at 9 am: what do you do with
  the next hour?). Useful in Q&A: "Is there evidence?" -> "We built a course about it."
- **Block formats shown:** `playground`, `timeline`, `misconception`, `analogy`, `scenario`,
  `explainer`, `quiz`, `flashcards`.
- **Source material (honest):** the open papers and summaries cited in Section 1.1: Karpicke &
  Roediger 2008 (PDF), Karpicke, Butler & Roediger 2009 (PDF), the APS release on Dunlosky et al.
  2013, the Cepeda et al. 2006 abstract, Anki's FSRS release notes.
- **One-sentence WorkBuddy prompt:** "Using the papers in this folder, make me a short course on how
  to study for exams that actually explains the science and makes me practise it."
- **15-second demo moment:** drag the slider from "review once" to "review on days 1, 3, 7";
  the curve flattens.
- **Risks:** the playground needs a formula the model writes; the checker or a test must confirm it
  renders a sensible curve. If not, show the timeline instead.

### 5.5 How the four fit the stage

| Course | Shown where | Formats nobody else has in one place |
|---|---|---|
| Data Structures | The live run + demo 0:00-1:20 | code that is tested before delivery, citations, Anki + calendar |
| Bahasa Melayu | Demo 1:30 (the laugh) | speaking drill with a native voice, role-play |
| Boba Shop | Pitch 2:15 (one slide + optional 10 s clip) | the same lesson in four languages, shift checklist |
| Rereading | Q&A ("is there evidence?") | playground, timeline, misconception |

---

## 6. Name, tagline, and the sentence judges should remember

### 6.1 Name options (BiliMind stays the brand)

| Option | For | Against |
|---|---|---|
| **BiliMind for WorkBuddy** (recommended for the submission form) | Says exactly what it is and names the platform the track is about | Plain |
| **BiliMind Crew** | Says "a team of agents" in two words; easy to say on stage ("the Crew") | Needs the subtitle to explain |
| BiliMind Course Crew | Clear and alliterative | Long |
| BiliMind Agent | Simple | Generic; every entry is an "agent" |
| BiliMind Exam Mode | Instantly understood by students | Undersells the small-business half |

Recommended usage: project title **"BiliMind for WorkBuddy"**, and on stage call the agents
"the BiliMind crew". Say the name origin once: "*Bilim* means knowledge in Uzbek." Anchor the
pronunciation early (BEE-lee-mind) by saying it slowly the first time.

### 6.2 Tagline options

1. **"One sentence in. A course out."** (recommended: short, true, repeats the demo)
2. "Stop rereading. Start remembering." (best for the student poster; ties to the science)
3. "Your slides, turned into a course you can practise, hear, run and schedule."
4. "From a folder of slides to a study system you own."
5. "Your study team, inside WorkBuddy."
6. Small-business line: "Your SOP, turned into training your crew will actually finish."

### 6.3 The one sentence judges should remember

> **"Type one sentence into WorkBuddy, and BiliMind's agent crew turns your folder of slides into
> a finished course: narrated, with code that runs, quiz answers checked against your own slides,
> and reviews already in your calendar."**

Short form, for the last slide and the end of every answer in Q&A: **"One sentence in, a course
out, checked against your own slides."**

---

## 7. Q&A preparation: the hardest questions

Rule: answer in two or three sentences, then stop. End with a fact or a thing you can show.

**1. "Isn't this just NotebookLM?"**
NotebookLM gives you a chat and separate study artifacts that live in Google. It has no ordered
course, no spaced-review schedule, no runnable code exercises, and you cannot export its
flashcards or quizzes. We give you a course you own as files, with practice that is checked
against your slides and reviews already on your calendar. (Section 2; source:
`plan/research/res-notebooklm.md` §10, §13, §20.)

**2. "Why does this need WorkBuddy? Isn't WorkBuddy just calling your API?"**
There is no BiliMind server in this demo. WorkBuddy does the planning, splits the work across
parallel agents, reads the local folder, runs the tests, loops rejected work back, writes the
files and keeps the daily Automation running after the chat ends. Our skill is the know-how and
the tools; WorkBuddy is the one doing the work, like a team using its own toolbox.

**3. "How do you stop hallucinations?"**
Three layers. Each lesson writer sees only the source chunks for its topic; every quiz answer must
cite a chunk, and the checker rejects answers the chunk does not support; code exercises are
executed against tests before delivery. What we cannot fully prevent is a weak sentence of
explanation, which is why every claim shows its slide in one click and `REPORT.md` lists what was
rejected.

**4. "Privacy: students' slides and a company's SOPs go into an AI?"**
The files stay on the user's disk; WorkBuddy reads only folders the user authorises, and the
output is local files, not a cloud account. Text excerpts go to the model provider the user chose
with their own key, and for a sensitive SOP that can be a local model. Honest caveat: WorkBuddy's
own orchestrating model sees the task and tool results, so this is "private by default", not
"air-gapped".

**5. "What does it cost, and who pays?"**
Text generation runs on the user's own OpenRouter key: in BiliMind's production data a lesson
costs about $0.002, so a course is about four cents. Narration uses free voices. WorkBuddy credits
pay only for orchestration (free tier 100 credits a month, Pro $10 for 2,000). (Replace with the
cost measured on our demo runs.)

**6. "What did you actually build this weekend? BiliMind existed before."**
The BiliMind web app existed: a course generator with 27 lesson formats and a learning-science
pipeline. What is new here: the agent version (one sentence, no clarifying round, assumptions
written down), reading local files through WorkBuddy, the checker that verifies quiz answers
against sources, code exercises verified by running tests, file outputs (offline course, Markdown,
Anki, calendar) and the daily Automation. (Builders: correct this list to exactly what shipped.)

**7. "How is this agentic and not a fixed pipeline?"**
The agent decides the plan from the goal: a language course gets speaking drills, a CS course gets
code, a two-day deadline compresses the schedule, a failed check triggers a rewrite and a failed
test triggers a fix. Two different sentences produce two different plans, which we can show side
by side (the Data Structures run vs the Bahasa Melayu run).

**8. "What is the business model?"**
The skill is free, and students pay cents to their own model provider, so there is no paywall in
front of learning. Revenue comes from people who need records: small businesses and training teams
pay per seat for the hosted side (who finished onboarding, quiz scores, refresher reminders), and
institutions pay for course packs. The BiliMind SaaS already has a paid Pro plan, so billing
exists. (Hypothesis, not validated: say "we plan to test", not "we charge".)

**9. "Does it scale?"**
Each run happens on the user's machine with the user's key, so our marginal cost per course is
near zero, and a thousand students making a course each is about $40 of model spend in total,
paid by them. The generation engine is already running in production for the SaaS. The bottleneck
is WorkBuddy credits per run, which is why heavy text goes through the cheap BYOK model.

**10. "Are students allowed to turn their lecturer's slides into a course?"**
It is the same as making your own notes: the student uses material they were given, for personal
study, and the output stays private on their laptop. We do not publish anything. For this demo we
used MIT OpenCourseWare notes under their Creative Commons licence, with attribution.

**11. "Is there evidence it improves grades?"**
The methods it automates (practice testing and spaced review) are the two best-supported study
techniques in the research (Dunlosky et al. 2013). We have not run a controlled trial of
BiliMind itself and we will not claim one. The next step is a pilot with one Taylor's module.

**12. "Machine-translated safety steps for workers: isn't that dangerous?"**
Yes, if unchecked, which is why the course says on its first page that a fluent colleague must
check it, and why it never replaces the MOH food-handler course. The value is that the owner now
has something to check, instead of nothing in the worker's language at all.

**13. "Won't students just let the AI do the learning for them?"**
That is the failure mode the research warns about: ungated chatbots made students score 17% worse
once access was removed (Bastani et al. 2025). Our output is the opposite of an answer machine: it
gives you questions, not answers, and schedules you to answer them again.

**14. "What if the slides are scanned images or half empty?"**
Text-based PDFs and PPTX are read directly. Scanned pages need OCR or a vision model, and quality
drops, so the reader reports which pages it could not read. If a topic has thin sources, the
planner marks it and the course says "your slides say little about this topic" rather than
making things up. (Builders: confirm what the reader actually does with a scanned page before
anyone gives this answer.)

---

## 8. Risks, open items, and what to verify before the pitch

| # | Risk / open item | Why it matters | Action |
|---|---|---|---|
| 1 | The organisers' slides (`AI SLIDES .pdf`) were a 0-byte file when this was written | Judging weights, time limits and submission rules may differ from the relayed brief | Re-open the real file; adjust the 3+2 minute split to the official limit |
| 2 | Live run time | Production numbers: outline p50 114 s on the pro model, lesson p50 82 s / p90 217 s. A 6-lesson run with parallel writers is ~3-5 minutes before WorkBuddy's own overhead | Rehearse three runs in a row on venue wifi; cap at 4-6 lessons; use a flash-class model for the outline in agent mode |
| 3 | The checker must produce a real rejection | Without it, the "agentic" criterion rests on a claim | Keep the recorded run whose log shows a genuine reject + rewrite. Never fake a log line |
| 4 | WorkBuddy credits | Free tier is 100/month + 250 starter; parallel agents burn credits | Buy Pro ($10, 2,000 credits) for the week; check balance before every rehearsal |
| 5 | OpenRouter budget (~$12) | Must last the build and the demo | ~4 cents per course; cap showcase regenerations at 3 each; log every run's cost |
| 6 | Offline course depends on CDNs | Pyodide, fonts and Mermaid from a CDN fail on bad wifi | Vendor them into the course folder; test with wifi off |
| 7 | Speech recognition for Malay | Browser `ms-MY` recognition needs Chrome/Edge and internet | Type-it fallback; rehearse on the stage laptop |
| 8 | Translation quality (Burmese, Bengali) | A judge may ask, a native speaker may be in the room | First-page disclaimer; get one lesson checked by a fluent speaker if possible |
| 9 | "WorkBuddy is decoration" perception | Criterion 3 | Never show the BiliMind SaaS in the demo; show the skill, the folder, the Automation, the Telegram message |
| 10 | Personal story facts | Taylor's judges may ask a follow-up | Use only true details (Section 4.0) |
| 11 | Numbers in this file | Production cost numbers come from the SaaS (`inv-generation.md` §1-2) | Replace with the costs measured on the hackathon runs before rehearsal |
| 12 | Business-model claims | Not validated | Present as plan/hypothesis, never as revenue |
| 13 | Licensing of showcase sources | MIT OCW is CC BY-NC-SA; Wikivoyage is CC BY-SA | Attribution in every course footer; no commercial use of the OCW-derived course |
| 14 | Team on stage | Script assumes a speaker and a driver | Confirm who presents; assign Q&A owners (Ulugbek: business, Sharif: tech, Oybek: product) |

---

## 9. Sources

Learning science
- Dunlosky, Rawson, Marsh, Nathan & Willingham (2013), *Psychological Science in the Public
  Interest* 14(1): APS release https://www.psychologicalscience.org/news/releases/which-study-strategies-make-the-grade.html
- Karpicke & Roediger (2008), *Science* 319: https://www.brucehayes.org/Teaching/papers/2008_Roediger_Karpicke_Science.pdf (figures read from the PDF)
- Karpicke, Butler & Roediger (2009), *Memory* 17(4): https://bpb-us-e2.wpmucdn.com/sites.wustl.edu/dist/8/805/files/2026/06/Karpicke-et-al.-2009-Metacognitive-strategies-in-student-learning-Do-students-practise-retrieval-when-they-study-on-thei.pdf (figures read from the PDF)
- Kornell (2009), *Applied Cognitive Psychology* 23(9): https://cir.nii.ac.jp/crid/1361699994055985152
- Cepeda et al. (2006), *Psychological Bulletin* 132(3): https://pubmed.ncbi.nlm.nih.gov/16719566/
- Adesope, Trevisan & Sundararajan (2017), *Review of Educational Research* 87(3): https://journals.sagepub.com/doi/10.3102/0034654316689306
- Freeman et al. (2014), *PNAS* 111(23): https://pmc.ncbi.nlm.nih.gov/articles/PMC4060683
- Bastani et al. (2025), *PNAS* 122(26): https://knowledge.wharton.upenn.edu/article/without-guardrails-generative-ai-can-harm-education

Malaysia and Taylor's
- The Star, 5 Jul 2026 (159,138 international students): https://www.thestar.com.my/news/nation/2026/07/05/international-students-account-for-126-of-higher-education-institutions039-enrollment-says-ministry
- Malay Mail, 18 Dec 2025 (EMGS source countries): https://malaymail.com/news/malaysia/2025/12/18/why-malaysian-campuses-are-a-hit-with-students-from-china-bangladesh-and-india/201793
- Taylor's MPU modules (BMK2 compulsory for international degree students): https://university.taylors.edu.my/en/student-life/manage-your-studies/malaysian-compulsory-and-general-studies-modules.html
- MPU overview: https://en.wikipedia.org/wiki/Mata_Pelajaran_Umum
- Unienrol guide to Taylor's (dated international breakdown): https://articles.unienrol.com/the-complete-guide-to-taylors-university/
- DOSM MSME Performance 2024: https://www.dosm.gov.my/portal-main/release-content/micro-small--medium-enterprises-msmes-performance-2024
- Momentum Works x Lark (frontline turnover, 23 Jul 2024): https://thelowdown.momentum.asia/press-release-frontline-turnover-costs-businesses-us22-6-billion-annually-in-southeast-asia-momentum-works-and-lark-report/
- Free Malaysia Today, 28 Aug 2025 (foreign workers by country): https://fmtv5.freemalaysiatoday.com/category/nation/2025/08/28/2-14mil-migrant-workers-in-malaysia-says-hr-ministry
- StoreHub Malaysia staff onboarding: https://www.storehub.com/my/blog/how-to-staff-onboarding-malaysia
- Food Hygiene Regulations 2009: https://www.informea.org/en/legislation/food-hygiene-regulations-2009 ; Malay Mail, 7 Feb 2025 (typhoid vaccination): https://www.malaymail.com/news/malaysia/2025/02/07/health-ministry-mandates-typhoid-vaccination-for-food-handlers-at-fairs-and-expos-strict-hygiene-standards-enforced/165905

WorkBuddy
- TechNode, 29 May 2026 (global launch; 100+ expert roles; Slack/Telegram/Discord/WeChat; MCP to GitHub, Jira, Drive, Gmail, Notion): https://technode.com/2026/05/29/tencent-launches-workbuddy-productivity-ai-agent-for-global-users/
- Tencent Cloud overseas guide (100+ Expert Skills, Markdown skills, Automations, tagline): https://www.tencentcloud.com/techpedia/144100?lang=en
- Skills docs (paths, frontmatter, fork context, auto and slash invocation): https://www.workbuddy.ai/docs/cli/skills
- Pricing and credits: https://www.workbuddy.ai/docs/workbuddy/pricing ; https://www.workbuddy.ai/docs/workbuddy/credits

Competitors
- `plan/research/res-notebooklm.md` (NotebookLM / Gemini Notebook, Oct 2026) and `plan/research/res-oss-rivals.md` §5-8
- ChatGPT study mode: https://openai.com/index/chatgpt-study-mode/
- Quizlet pricing (third-party): https://nibble-app.com/blog/quizlet-cost
- Anki FSRS: https://en.wikipedia.org/wiki/Anki_(software)
- Coursera pricing (third-party): https://subger.com/en/skills-courses

Showcase sources
- MIT OCW 6.006 Spring 2020 lecture notes (CC BY-NC-SA 4.0): https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/pages/lecture-notes
- Wikivoyage Malay phrasebook (CC BY-SA): https://en.wikivoyage.org/wiki/Malay_phrasebook

BiliMind facts
- `plan/research/inv-generation.md` §1-2, §8.1 (pipeline, measured costs, archetypes)
- `plan/research/inv-blocks.md` §2.1 (27 block types)
- `plan/context/*.md` (team, name, format follows pedagogy, imagery rules)
- Edge-TTS voice list checked locally on 2026-10-10 (`python -m edge_tts --list-voices`)
