# BiliMind for WorkBuddy: final Dormathon build plan

Track 2 (WorkBuddy, Agentic Solutions). Written 2026-10-10. Status: COMPLETE (final build plan).
Section 0b (facts from the real organiser slides and owner decisions) overrides everything else; the
sections below have been aligned with it (Telegram cut, 24-hour timeline, DeepSeek-direct default,
deployed link + public GitHub + PDF slides required).

This file supersedes the "recommendation" parts of the research files in `hackathon/research/`.
Where this plan and a research file disagree, this plan wins.

## Contents

0. Read this first (the five decisions that changed)
1. Locked concept and how it answers every judging criterion
2. Architecture (workspace layout, modules, CLI, MCP, skill, output folder)
3. Block formats to build, with the archetype mapping
4. Showcase courses, live demo flow, backups
5. Work packages for builder agents, and the order
6. OpenRouter budget
7. What the human must do
8. Risks and fallbacks
9. Decisions still open

---

## 0. Read this first: what changed after the judges' review

Three mock judges (Tencent architect, academic, startup) scored the research-stage concept 6.5, 6.5
and 7, and none said it would win. Their shared complaints, and what this plan does about them:

| # | Complaint | Decision in this plan |
|---|---|---|
| 1 | WorkBuddy only runs our shell script ("thin wrapper") | Judgment moves into WorkBuddy agents. Our CLI keeps only deterministic tools and single-shot generation calls. The skill never calls a "do everything" command. `bilimind run` exists only as a developer harness and is not mentioned in SKILL.md. |
| 2 | Nothing tested in WorkBuddy | A 60-minute spike (section 7, H4) runs before the orchestration layer (SKILL.md, agent prompts) is frozen. Engine work that every scenario needs starts in parallel. |
| 3 | Planning is trivial | The Lead agent reads a past-year paper next to the slides, weights topics by marks, sizes the path to the days left, says what it cut and why, and dates reviews backwards from the exam. |
| 4 | Adaptation is shallow | The plan adapts to the goal (days left, past-paper weights, thin or scanned sources) and to the crew's own outcomes (rejected answers rewritten, failing code fixed). One FSRS schedule file drives the calendar and the player's "Due today" list, and answers in the player reschedule cards. (The Telegram loop was cut by the owner, see 0b.) |
| 5 | Scope too big | One hero user and one live course. Two short pre-built cameos (cafe onboarding, Bahasa Melayu). The fourth course, MCP, the Expert Team plugin, KaTeX, Python on stage, multilingual narration everywhere, live speech scoring and confetti are cut or moved to P2. |
| 6 | Judges never see the agents work | WorkBuddy stays on the projector for the whole pitch. The deck runs in a narrow "rail" beside it. The finished course opens in WorkBuddy's own Preview panel. |
| 7 | Borrowed numbers | Only numbers measured on our own runs go on stage: OpenRouter dollars plus WorkBuddy credits per course, wall time, questions checked/rejected/rewritten, code tests failed then fixed, and a planted-error catch rate for the Checker. Plus 3-5 real Taylor's students at the event. |
| 8 | Rules unknown | Now known (0b): 24-hour event, submit by Sunday 09:00 MYT (public GitHub repo, deployed link, slides PDF), a 3-minute live presentation + 2 min Q&A, deliverables made with WorkBuddy. |
| 9 | Contradictions between research docs | Settled here: never ask the user a question; code exercises on stage are JavaScript; Python is online-only P2; the cafe course is "Boba Shop: Day One" unless a real business gives us its SOP; the language cameo is "Bahasa Melayu Survival Kit"; speaking drills use record-and-compare with self-rating, never live recognition scoring. |
| 10 | Budget | Two pools (0b): DeepSeek direct (~$9, the default for content calls) and OpenRouter ($9.69 account balance, not the $12.80 the key shows; fallback, images). A demo-day reserve is locked in each and enforced in code (section 6). WorkBuddy credits (~2,350) pay for the agents. |

### 0b. OVERRIDES after reading the real organiser slides (2026-10-10 ~17:00 MYT). These win over everything below.

- **Event:** 24-hour hackathon, Sat 10 – Sun 11 Oct 2026. **Submission deadline Sunday 11 Oct 09:30 MYT sharp**
  (a 30-minute buffer is enforced, so treat **09:00** as the real deadline). Pitch: Phase 1 local branch demo
  **3 min live presentation + 2 min Q&A** (Sun 10:00-13:00); top 18 go to Phase 2 global video call
  (4 min demo + 3 min Q&A).
- **Submission requires:** (1) a **GitHub** repo link, set to PUBLIC; (2) a **deployed application link**;
  (3) **presentation slides as PDF**; (4) group name and campus branch. Track 2 rule: deliverables
  (implementation, slides, docs) must be delivered **using WorkBuddy**; all course generation in the demo runs
  in WorkBuddy and spends WorkBuddy credits (the account has ~2,350 credits). Slides and docs are produced
  with WorkBuddy (web app at workbuddy.ai/app, driven by the orchestrator through Chrome).
- **Telegram is CUT** (owner's decision). Delete WP10, every Telegram beat, `due --format telegram`, the
  Assistant reply path. The review loop stays as: `review/state.json` (FSRS) → `reviews.ics` + the player's
  "Due today" list. A WorkBuddy Automation that rebuilds a "today's review" page is P2.
- **No private/real student slides** (owner's decision). Hero sources are public/permitted material only
  (WP8). Honest labels on anything written for the demo ("Sample document").
- **LLM provider:** the engine supports any OpenAI-compatible endpoint. Presets: `deepseek` (direct,
  `https://api.deepseek.com`, models `deepseek-flash` (V4.1 Flash) / `deepseek-v4-pro`, key `DEEPSEEK_API_KEY`,
  ~$9 balance: the DEFAULT for our own runs) and `openrouter` (`OPENROUTER_API_KEY`, `deepseek/deepseek-v4-flash`,
  ~$9.69 balance, reserved for images/music and as fallback). Auto-pick: DEEPSEEK_API_KEY if set, else
  OPENROUTER_API_KEY. The ledger's balance check uses `GET https://api.deepseek.com/user/balance` for DeepSeek
  and `/api/v1/credits` for OpenRouter. Keys load from `bilimind-desktop/.env.local` in dev (never printed).
- **WorkBuddy facts verified on this machine:** user skills dir `C:\Users\User\.workbuddy-ai\skills\<name>\SKILL.md`
  (watched by the app); Expert packages live in `C:\Users\User\.workbuddy-ai\plugins\marketplaces\my-experts\plugins\<name>`
  and are registered with WorkBuddy's own `expert-manager` scripts (`validate_expert.py`, `register_expert.py` in
  `C:\Program Files\WorkBuddyAI\resources\app.asar.unpacked\resources\plugins\workbuddy-builtin\skills\expert-manager\scripts`);
  WorkBuddy bundles Node 22 and Python 3.13 in `~\.workbuddy-ai\binaries`. Skills use `${CODEBUDDY_SKILL_DIR}`.
  The web app (workbuddy.ai/app) also accepts custom skills ("Add Skill") and runs them in a cloud sandbox.
- **Network:** registry.npmjs.org is blocked by the venue FortiGate; `.npmrc` uses `registry=https://registry.yarnpkg.com/`
  (verified working) — npmmirror also works. Never disable TLS verification.
- **Clock:** the PC clock is still ~8 h slow (local reads UTC). The TTS skew fix is mandatory, not optional.
- **Compressed timeline (MYT):** 17:00 WP0+WP8+spike kit → ~18:15 lanes WP1-WP7 in parallel → ~22:30 G2
  (`run` makes a valid course) → ~23:30 G3 (first WorkBuddy run, owner at the keyboard) → 00:00-03:00 showcase
  courses + site + deploy → 03:00-06:00 slides/docs via WorkBuddy, GitHub public, README → 06:00-08:30 rehearse,
  fix only → 09:00 submit. Film (WP13) only if time remains. WP15 MCP stays cut. WP16 Expert Team is P1
  (cheap: it wraps the same skill; gives member cards in the UI).

Everything below is written so builder agents can start without reading the research files.
For detail: prompts and validators `research/engine-port.md`; player visuals `research/player-design.md`,
`research/cobalt-tokens.css`, `research/player-proto.html`; media facts `research/media.md`; WorkBuddy
facts `research/workbuddy.md`; evidence and Q&A `research/pitch.md`.

---

## 1. Locked concept

### 1.1 The one-liners

- **Name (submission):** BiliMind for WorkBuddy. On stage the agents are "the BiliMind crew".
  Say once: "*Bilim* means knowledge in Uzbek" (BEE-lee-mind).
- **Tagline:** One sentence in. A course out. Checked against your slides.
- **Pitch sentence:** Tell WorkBuddy when your exam is and where your slides are. The BiliMind crew
  reads them and your past paper, plans the days you have, builds a course checked against your
  slides, and puts your reviews in your calendar until exam day.
- **User:** a university student (Oybek, or a Taylor's CS student) with a Data Structures final in
  three days, a folder of lecture slides plus last year's paper, and 45 minutes a day.
- **Second user (cameo):** a small food-and-drink shop owner with an SOP and a new hire every few
  weeks who reads Malay or Burmese more easily than English.
- **Problem:** what works for exams (testing yourself, spread over days) takes hours to set up:
  questions, flashcards, a schedule, and working out which topics the exam actually weights. So 84% of
  students reread instead (Karpicke, Butler and Roediger 2009), the technique rated low utility
  (Dunlosky et al. 2013). Malaysian students revise from past-year papers, but mapping a past paper onto
  the slides and a calendar is manual work nobody does at 11 pm. For the shop: an SOP nobody reads,
  frontline turnover up to 48% a year in Southeast Asia (Momentum Works x Lark 2024), training repeated
  by hand for every new hire.
- **Personal hook:** two true sentences from Oybek (H12): his own exam night with only slides, or his
  own Bahasa Melayu class. Never invented.

### 1.2 What goes in, what comes out

In: one message in WorkBuddy, with the workspace set to the folder.

> My Data Structures final is Thursday 9am. The slides and last year's paper are in this folder.
> I have 45 minutes a day. Get me ready.

Out: a folder the student owns, every file opened from WorkBuddy's Results panel.

| File | Opens in | Why it matters |
|---|---|---|
| `index.html` | WorkBuddy Preview, any browser, offline | The course: a path, lessons whose format follows the kind of knowledge, runnable JS exercises, quizzes with slide citation chips, narration, and a "Checked before you saw it" receipts slab |
| `plan.md` | WorkBuddy Artifacts, Obsidian | What the crew decided: assumptions, topic weights from the past paper, what was cut and why, the day-by-day plan |
| `reviews.ics` | Google / Outlook calendar | Study blocks and spaced reviews dated backwards from the exam |
| `deck.csv` (P0), `deck.apkg` (P1) | Anki | Every flashcard and cloze item |
| `lessons/*.md` | Obsidian | Notes with slide citations as callouts |
| `REPORT.md` | WorkBuddy Artifacts | What each agent did, every check run, rejections and fixes, cost in dollars and credits, wall time |
| `review/state.json` | (data) | The single schedule. The calendar and the player's "Due today" list are generated from it |

After the chat: the course home shows "Due today" from the schedule; answering in the player reschedules
the card locally. P2 only: a WorkBuddy Automation that rebuilds a "today's review" page each morning.
(Telegram was cut by the owner, 0b.)

### 1.3 The crew: who decides what

The rule that answers the "thin wrapper" complaint: **agents decide; code enforces.** Agents make every
judgment call in WorkBuddy's own loop, visible in the transcript. Our CLI does what must be
deterministic or cheap (parsing files, the archetype-to-format table, schema checks, running tests, TTS,
packaging) plus single-shot content calls (one OpenRouter call per lesson draft).

| Agent (in WorkBuddy) | Judgment it makes, in its own words | Tools (our CLI through Bash/PowerShell, plus WorkBuddy Read/Edit/Write) | What code enforces |
|---|---|---|---|
| **Lead** (the skill's main thread) | Reads the sentence: exam date and time, minutes a day, audience, language. Assumes and records, never asks. Inspects the folder: which file is a past paper, which pages are scans, which topics are thin. Chooses lessons to keep and cut from the days left and the past-paper weights. Writes the plan. Dispatches Writers in parallel, then Coder and Checker in parallel. Delivers, offers the Automation. | `goal`, `ingest`, `outline`, `exam-map`, `plan`, `narrate`, `export`, `build`, `note`; TaskCreate/TaskUpdate; Agent; Artifact | `plan` warns when kept lessons exceed the minutes available or break the archetype variety gate; `outline` derives block formats from archetypes, never from the model |
| **Writer x N** (one sub-agent per lesson, parallel, max 6) | Runs one draft, reads the check report, decides how to repair: edits the JSON itself for small faults or re-drafts one block with its own instruction. Stops after 2 rounds and says what is still flagged. | `draft`, `check`, `draft --note "<its own instruction>"`; Edit on `lessons/<key>.json` | `check` re-validates every change: mandatory formats, schema, MCQ cap, citations resolve, thin lesson |
| **Coder** (one sub-agent, after the Writers) | For each code exercise: dumps it to real files, runs the tests, reads failures, fixes the reference solution, the starter or a wrong expectation, and re-runs until the reference passes every test and the starter fails at least one | `code-test --dump`, `code-test --apply`; Edit on `.work/code/<lesson>-b<n>/{solution.js,starter.js,tests.json}` | `code-test` runs in `node:vm` with a 2 s timeout; nothing ships unless the reference passes |
| **Checker** (one sub-agent, parallel with the Coder) | Reads every quiz item next to the slide text it cites and rules supported / contradicted / not covered, with a reason and a verbatim quote. Sends contradicted items for a rewrite and rules again. | `evidence`, `verdict`, `rewrite-item` | `verdict` refuses a quote that is not verbatim in the cited chunk (the Checker cannot invent evidence); contradicted items never reach the course; not-covered items get a visible "Beyond your slides" label |
| **Coach** (P2, WorkBuddy Automation; Telegram cut per 0b) | Picks today's due questions and writes a "today's review" page | `due`, `grade` | FSRS state in `review/state.json`; `.ics` regenerated from it |

Line to say on stage: **"The agents decide what to teach and when. Our code decides how each kind of
knowledge must be taught, and checks that it was."**

### 1.4 How it answers every judging criterion

| Criterion | Proof judges see (live, or recorded from a real run) |
|---|---|
| Core question: "Can your agent use WorkBuddy to solve a real problem and actually get things done?" | One sentence, no further messages. Files appear in WorkBuddy's Artifacts. The course opens in WorkBuddy's Preview. The calendar opens in a real calendar. The same course is live at the deployed link. |
| 1. Real problem and user value | A named user with a dated exam and a past paper. One stat (84% reread; ~80% vs ~33% recall a week later with testing). Measured at the event: agent minutes vs a student making 20 cards plus a schedule by hand; 3-5 Taylor's students' reactions and one quote. |
| 2. Agentic workflow | The Lead's plan in its own words ("Past paper: hashing 30% of marks, heaps 25%, AVL 0%. 3 days x 45 min = 4 lessons. Cut: AVL rotations."). Writers in parallel. A Writer repairing its own lesson. Coder: test failed, fixed, passed. Checker: Q7 rejected with a quote from slide 22, rewritten, passed. Two sentences, two different plans (screenshot pair: "Thursday" vs "tomorrow"). |
| 3. Meaningful use of WorkBuddy | Skill in the Skills list; workspace folder access; Agent sub-agents (Expert Team member cards, P1); TaskCreate checklist; Preview and Artifacts panels; Artifact share link for the study group (if S10 works); the slides and docs themselves made in WorkBuddy (0b). No BiliMind server and no SaaS anywhere in the demo. |
| 4. End-to-end execution | The conversation has exactly one user message. SKILL.md forbids questions; the Lead writes its assumptions at the top of `plan.md`. |
| 5. Usable and verifiable results | Citation chip shows the exact slide text. JS exercise runs green in the page. `REPORT.md` lists every check. Checker benchmark: "caught X of 20 planted wrong answers, Y false alarms" (measured in WP9). |

The six track capabilities: understanding the goal = Lead's goal + assumptions; planning = outline +
past-paper weights + `plan.md` + TaskCreate checklist; executing = CLI tools, file writes, test runs,
TTS; collaborating and validating = Writers, Coder, Checker with real rejections; integrating =
`export` + `build` into one course and one schedule; delivering = files, Preview, share link, Automation.

### 1.5 The judges' must-change items: adopted, modified, rejected

| Item | Verdict | Why |
|---|---|---|
| Spike WorkBuddy before writing engine code | **Modified** | The spike comes first for the orchestration layer (SKILL.md, agent prompts, Telegram loop): nothing there is frozen until it is done. Ingest, archetypes, validators, TTS and the player are needed whatever the spike shows, so builder agents start them at T+0. Waiting would waste the scarcest resource, hours. |
| Get the real organiser slides; ask for credit codes and a ruling on pre-existing code | Done (0b) | 3-min live presentation + 2 min Q&A; ~2,350 WorkBuddy credits on the account. Pre-existing code: disclose (§1.6). |
| Move every decision into WorkBuddy agents; delete `run --concurrency` from the skill | Adopted | Section 1.3. The fixed correction sentence is gone from the agent path: `draft` makes one attempt, `check` reports, the Writer decides. `run` stays in `apps/cli` for tests and fixtures only. |
| Past-year paper drives planning; size to days left; state cuts; date reviews back from the exam | Adopted | P0: `exam-map` + `plan`. |
| Interactive Telegram review loop, triggered live | **Cut by the owner (0b)** | No time in a 3-minute slot and a 24-hour build. Adaptation is shown through the goal-sized plan, the crew's rejections and fixes, and the FSRS "Due today" list. A morning Automation is P2. |
| One hero user, one live course; cameos pre-built | Adopted | Hero = Data Structures. Cafe and Malay are pre-built cameos, also generated through WorkBuddy so their receipts are true. |
| Cut to ~10 block types | **Rejected as stated** | A lesson whose archetype's mandatory format has no renderer silently loses its core block, and the SaaS already has a Vue component for all 18 types (`frontend/app/components/blocks`). We cut polish, not types: 12 types get stage polish, 6 render cleanly but plainly (section 3). |
| Run the pitch with no slides | Modified | WorkBuddy is on screen the whole time; the deck runs as a narrow "rail" beside it (4-6 cards). A pure no-slide talk loses the one stat and the cafe beat. |
| Small business as a full half of the demo | Modified | A 20-second beat, not a second live run: a real local shop's SOP if we can get one with permission (H10), else the labelled sample; its onboarding course on screen and at the deployed link. Two live runs double the failure risk. |
| Run the checker on a different model family | Adopted, differently | The Checker is a WorkBuddy agent, so it runs on WorkBuddy's model, not the DeepSeek model that drafted the lesson. If the spike shows Auto routing picks DeepSeek, or credits force BYOK, the custom model is `anthropic/claude-haiku-5.5`. |
| Measure the checker with planted errors; match the claim | Adopted | `plant` / `plant-score` commands. Claim: "every answer is checked against your slides, and the ones that aren't are labelled". |
| 5-question diagnostic | Deferred to P2 | Adaptation is covered by the review loop (P0) and the "how sure are you?" rating before each reveal (P1, also feeds FSRS). |
| `.apkg` in P0 | Modified | `deck.csv` is P0 (Anki imports it); `.apkg` is P1 (sql.js + fflate, about 150 lines). |
| Expert Team plugin, MCP | Expert Team P1, MCP cut (0b) | The Expert Team wraps the same skill and playbooks and gives member cards in the UI; WorkBuddy's own `expert-manager` scripts validate and register it (0b). MCP stays out of the 24-hour build; `packages/mcp` remains an empty slot. |
| Mermaid pre-render, KaTeX | Modified | KaTeX cut. Diagrams are mandatory for two archetypes, so P0 lazy-loads Mermaid from jsDelivr with an alt-text box offline; P1 pre-renders SVG with the already-tested `scratch/media/mermaid-prerender.mjs`. |
| Use the organisers' own slides as live input | P2 gag only | Only if the real PDF arrives: a 5-card course on the judging criteria for the end of Q&A. The hero stays on DS because it needs a past paper and code. |
| Vanilla WorkBuddy side-by-side | Adopted | H16: the same sentence without the skill, once; keep a 5-second clip and its summary .md. |
| Disclose pre-existing code | Adopted | One line in the pitch and one card (section 4.5). The `bilimind-desktop` repo starts today, so its history is the timestamped record. |
| Narration framed as listen mode | Adopted | Pitch it for commutes and language drills; the sentence highlight is optional, not the selling point (avoids the redundancy-effect objection). |

### 1.6 Three answers to have ready

- **"WorkBuddy already has student experts that make exam outlines."** Those give you a summary to
  reread. Ours gives you practice that was executed and checked against your slides, a plan weighted by
  your past paper, and a review loop that keeps running after the chat ends. (Show the vanilla clip.)
- **"What did you build here?"** BiliMind existed as a web app (Laravel + Nuxt). We reused its pedagogy:
  the lesson prompts and the archetype-to-format rules. Built at Dormathon: the Node engine port, the
  WorkBuddy skill and agent crew, the past-paper planner, the Checker and Coder loops, the offline cobalt
  player, the exports and the Telegram review loop.
- **"What does it cost?"** Measured per course: text-model API $0.0X (DeepSeek direct) plus N WorkBuddy
  credits (fill in from REPORT.md after gate G4). Narration is free (Edge voices).

---

## 2. Architecture

### 2.1 Shape in one picture

```
WorkBuddy (desktop, the execution platform)
 ├─ Skill "bilimind" (SKILL.md = the Lead's playbook; references/*.md = Writer, Coder, Checker, Coach playbooks)
 │    Lead ──Agent──> Writer x N (parallel) ──> Coder + Checker (parallel) ──> Lead packages + delivers
 │      │                │                        │          │
 │      └──── Bash/PowerShell: node "${CODEBUDDY_SKILL_DIR}/scripts/bilimind.mjs" <command> --course <dir> --as "<agent>"
 ├─ Expert Team "BiliMind crew" (P1): the same playbooks as member agents, for member cards in the UI
 └─ Automation "Today's review" (P2): rebuilds a due-today page from review/state.json

bilimind.mjs (one esbuild bundle of apps/cli + packages/engine + packages/core, no node_modules at runtime)
 ├─ DeepSeek API direct (default) or OpenRouter (fallback, provider price-pinned)      ← content calls only
 ├─ Edge TTS (free, msedge-tts, clock-skew fix)                                         ← narration
 ├─ node:vm sandbox                                                                      ← code tests
 └─ writes <workspace>/bilimind-out/<slug>/ (deliverables + crew/ workbench)

packages/player  ── built once at dev time ──> templates/player.html (Vue 3, one file, file:// safe)
                    `bilimind build` pastes course.json into it ──> index.html
```

No server, no account, no BiliMind backend. Everything runs on the student's machine under WorkBuddy.

### 2.2 Workspace layout (`C:\oybek\projects\bilimind\bilimind-desktop`)

The repo already has `package.json` (pnpm 10.18.1, Node >= 22, TypeScript 5.9.3, tsx, vitest),
`pnpm-workspace.yaml` (`packages/*`, `apps/*`), `tsconfig.base.json`, `.gitignore`, `.env.local`
(OPENROUTER_API_KEY and others; never print it, never copy it into a shipped file).

```
bilimind-desktop/
  .npmrc                    registry=https://registry.yarnpkg.com/ (verified working on the venue network, 0b);
                            npmmirror also works; never disable TLS verification
  pnpm-workspace.yaml       add: film
  packages/
    core/                   NEW, first: types, zod schemas, archetype table, graders, sentence splitter (shared by all)
    engine/                 ingest, llm, outline, exam-map, plan, draft, validate, code tests, evidence/verdict,
                            tts, review (FSRS), exports, build
    player/                 Vue 3 + Vite + vite-plugin-singlefile → dist/player.html (the course template)
    mcp/                    P2: MCP stdio server, thin wrapper over engine (only if the spike says it helps)
  apps/
    cli/                    `bilimind` CLI (commander); esbuild bundle → skills/bilimind/scripts/bilimind.mjs
  skills/
    bilimind/               the WorkBuddy skill (SKILL.md + references + built scripts + templates); zipped for upload
  plugin/                   P2, conditional: bilimind-team Expert Team wrapper (workbuddy.md §7.5)
  showcase/
    sources/<course>/       input folders with LICENSE.md (public or permitted material only)
    courses/<course>/       generated course folders, committed (.gitignore already excludes /courses/ at root only)
  site/                     P1: static landing page in cobalt (index.html + assets)
  pitch/                    HTML deck in cobalt, full mode + "rail" mode (narrow column beside WorkBuddy)
  film/                     ffmpeg pipeline for the demo video (package.json with scripts)
  hackathon/
    PLAN.md                 this file
    SPIKE.md                facts measured on the real WorkBuddy install (written during H4)
    RUNBOOK.md              stage runbook: setup checklist, timings, fallbacks (written in WP14)
    runs/                   one folder per measured run: REPORT.md copy, timings, credits, screenshots
    research/, scratch/     existing
```

Version pins (from `research/media.md` §8, all checked on npmmirror today): vite 8.3.4, vue 3.5.43,
@vitejs/plugin-vue 6.0.10, vite-plugin-singlefile 2.3.3, typescript 5.9.3 (already in root; do NOT move
to 7.x, it breaks vue-tsc), zod 4.6.5, @modelcontextprotocol/sdk 1.32.1, msedge-tts 2.0.9, unpdf 1.8.1,
mammoth 1.13.0, fflate 0.8.3, sql.js 1.14.2, ts-fsrs 5.4.2, commander 15.0.0, minisearch (latest),
puppeteer-core 25.13.0 (dev only: smoke tests and Mermaid pre-render with the installed Edge), esbuild (latest).
No `ics` package: the .ics writer is 60 lines of our own code.

### 2.3 Modules and responsibilities

**packages/core** (no I/O, runs in Node and in the browser)

| File | Responsibility |
|---|---|
| `types.ts` | All stage types from `engine-port.md` §1.1 plus: `Goal`, `FileRole` (`lecture`, `past_paper`, `syllabus`, `sop`, `other`), `ExamQuestion`, `TopicWeight`, `PlanDay`, `Verdict`, `ReviewCard`, `LogEvent`, `Receipts`, and `Course` (the player contract, `player-design.md` §1.3) |
| `archetypes.ts` | Verbatim port of `ConceptArchetype` (`engine-port.md` §2): FORMATS, OPTIONAL, ASSESSMENT_BIAS, TEST, WRITING_NOTE, LABEL, `mandatoryFormats` (annotated_media → walkthrough), `plannedBlockTypes`, plus the learner tag words and icons (`player-design.md` §2.1) |
| `blocks.ts` | `ENABLED_TYPES` (18 Tier A + 4 Tier B), one zod schema per payload, assessment schemas (mcq, multi_select, ordering, numeric, cloze, short_answer, essay, project, code) |
| `course-schema.ts` | zod schema of `course.json`; the player and `build` both validate against it |
| `grade.ts` | Deterministic graders (port of DeterministicGrader, `engine-port.md` §4.2). Used by the player AND by `bilimind grade` for Telegram answers, so a question grades the same everywhere |
| `sentences.ts` | One sentence splitter + `spokenText()` (Markdown → narration text). Narration cue ids (`blockId.sentenceIndex`) and the player's highlighted spans come from the same function |
| `fsrs.ts` | Thin wrapper over ts-fsrs: new card, rate (again/hard/good/easy), due list, "review dates backwards from the exam" |
| `fixtures/` | `course-ds-mini.json`: a hand-written 2-lesson course containing every P0 block type, every assessment kind, citations, narration cues and receipts. Unblocks the player before the engine works |

**packages/engine** (Node only)

| Module | Responsibility |
|---|---|
| `config.ts` | Provider presets (0b): `deepseek` (direct, `https://api.deepseek.com`, models `deepseek-flash` / `deepseek-v4-pro`, key `DEEPSEEK_API_KEY`) and `openrouter` (`OPENROUTER_API_KEY`, `deepseek/deepseek-v4-flash`). Auto-pick DeepSeek if its key is set. Keys from env, else `bilimind-desktop/.env.local` in dev, else `%USERPROFILE%\.bilimind\config.json`. Never printed |
| `llm.ts` | OpenAI-compatible JSON call, port of `LlmClient::json` (`engine-port.md` §3.0): `response_format json_object`, JSON repair, schema check with one corrective turn, no retry on 4xx except 429, reasoning/thinking on only for outline/relabel. OpenRouter only: `usage.include`, `provider {require_parameters: true, max_price {prompt 0.2, completion 0.4}}`. DeepSeek direct: cost computed from returned token usage x a price table the builder copies from DeepSeek's pricing page (cite the date in a comment) |
| `ledger.ts` | Global spend ledger `%USERPROFILE%\.bilimind\ledger.jsonl` (every call: ts, course, cmd, provider, model, tokens, cost). Caps: $0.25 per course run, $2.00 per day, and a floor per provider: refuse a call when the live balance (DeepSeek `GET /user/balance`, OpenRouter `GET /api/v1/credits`) minus that provider's demo reserve (§6) is below zero, unless `BILIMIND_DEMO_DAY=1` |
| `cache.ts` | Response cache by sha256(model + messages) in `crew/cache/`. `--no-cache` for every rehearsal and stage run (a cached stage run would be fake speed) |
| `log.ts` | Course log `crew/log.jsonl`: ts, agent label (`--as`), command, args summary, result summary, ms, cost. Receipts and REPORT.md are computed only from this file |
| `ingest/` | `pdf.ts` (unpdf, one section per page, locator `Page N`, "Slide N" when the page is landscape), `pptx.ts` (fflate unzip, `<a:t>` text + speaker notes, locator `Slide N`), `docx.ts` (mammoth, split on headings), `md.ts`, `chunk.ts` (1200 chars / 150 overlap, chunk keeps its section locator), `digest.ts` (6000-char even spread), `roles.ts` (heuristic file role: "Question 1", "marks", "Answer ALL", "Time allowed" → past_paper; "Learning outcome", "CLO" → syllabus; "SOP", "procedure", "shift" → sop), scanned-page detection (no text layer), words per file |
| `retrieve.ts` | minisearch over chunks with the SaaS term recipe (stopwords, >= 3 chars, prefix on >= 4); top 6 per lesson; every lesson gets its 2 best chunks even on weak overlap |
| `prompts/` | Verbatim ports of OutlinePrompt, ArchetypeRelabelPrompt, ExpandNodePrompt and PromptSupport fragments (`engine-port.md` §3), tables rendered from `core` constants, `// HACKATHON` markers for the compact counts (5-8 topics + 2-5 subtopics, no parts stage). New: `rewriteItem.ts` (rewrite one assessment item grounded in its chunks), `explain.ts` (P1: 60-word spoken explanation of a missed item from its chunk) |
| `outline.ts` | One call (reasoning on), GraphBuilder normalisation, variety gate with `strictSmall`, relabel up to 2 passes then accept, `allows_code` overridden in code, marks fix, derived `planned_block_types`, thin-topic flag (fewer than ~150 words of supporting chunks) |
| `exam.ts` | Past paper → questions (regex on "Question N", "QN", "(a)", "[N marks]") → each question matched to outline topics by retrieval over title + summary + the topic's chunks → weights = share of marks. Deterministic and explainable: writes `crew/exam-map.md` with each question, its marks and matched terms. `--assign "Q3=hashing"` lets the Lead override |
| `plan.ts` | Takes the Lead's keep/cut decision. Capacity = days x minutes; 60% to new lessons, 40% to reviews; warns when over. Orders kept lessons by prerequisite (outline order) then weight. Writes `plan.json` and `plan.md` (assumptions, weights table, kept and cut with reasons, day-by-day schedule, review dates computed backwards from the exam with `core/fsrs.ts`) |
| `draft.ts` | One expand call per lesson (reasoning off) with the lesson's top-6 chunks, neighbours and derived formats. `--note` appends the agent's own repair instruction; `--only <type>` regenerates one block and merges it. Normalisers, singleton rule, MCQ cap (demote), strip code when `allows_code` is false. NO automatic re-ask (the Writer decides) |
| `normalise/` | Port of BlockPayloadNormaliser for the enabled types and of normaliseAssessment (`engine-port.md` §4 table, §5.1) |
| `validate/` | Q1-Q17 from `engine-port.md` §5.2 as pure functions returning `Check[]` with a one-line `detail` and a `suggestion`. `code-js.ts`: node:vm harness (2 s timeout, deepEqual), reference must pass all, starter must fail one. `playground.ts`: `isSafeFormula` + 28-point sweep in vm. `mermaid.ts`: plausibility. `citations.ts`, `thin.ts` |
| `codework.ts` | `dump`: writes `crew/code/<lesson>-b<n>/{instructions.md, starter.js, solution.js, tests.json}`; `apply`: reads them back into the lesson JSON and re-runs the tests |
| `evidence.ts` | Per lesson: one Markdown packet per item (prompt, options, the accepted answer in words, each cited chunk's file + locator + up to 700 chars) → `crew/evidence/<lesson>.md` |
| `verdict.ts` | Applies the Checker's rulings. Normalises whitespace and checks the quote is a substring of a cited chunk; refuses otherwise. contradicted → item excluded and logged; not_covered → `label: "beyond_slides"`; supported → the quote becomes the answer explanation with its chip |
| `rewrite.ts` | One cheap call to rewrite one item from its chunks and the Checker's reason; the new item is `pending` until the Checker rules again |
| `plant.ts` | Benchmark: copies a course, flips N answer keys (wrong option, off-by-one numeric, swapped order) and records them in a hidden key; `plant-score` reads the Checker's verdicts and prints caught / missed / false alarms |
| `tts.ts` | msedge-tts with the clock-skew fix (`media.md` §1), XML-escape, one request per paragraph (150-400 chars), concurrency 8, cache by sha256(text, voice, rate), word timings → sentence cues via `core/sentences.ts`, waveform bars derived from word timings (no audio decoding), byte-concat of same-format mp3 frames per lesson |
| `review.ts` | `review/state.json`: one FSRS card per quiz item and flashcard, first due dates from the plan; `reviews.ics` generated from it; the player's "Due today" list embedded from it. P2: `due` (pick N, write a today's-review page) and `grade` (parse "1 b, 2 chaining, 3 O(n)", grade with `core/grade.ts`, reschedule, regenerate `reviews.ics`) for a WorkBuddy Automation |
| `export/` | `markdown.ts` (Obsidian: callouts, task lists, mermaid fences, citation callouts), `anki-csv.ts` (front, back, tags), `apkg.ts` (P1), `ics.ts` (study blocks + reviews from state.json, TZ Asia/Kuala_Lumpur), `report.ts` (REPORT.md from log + checks + verdicts + ledger), `receipts.ts` (the numbers on the receipts slab) |
| `build.ts` | Assembles `course.json` (resolves chunk ids to file + locator + page + quote), validates it with `core/course-schema.ts`, pastes it into `templates/player.html` (escape `</` as `<\/`), copies `img/obj-*.webp` and `sources/`, writes `index.html`. P1: Mermaid → SVG pre-render when puppeteer-core and Edge are present |

**packages/player** (Vue 3, `research/player-design.md` is the visual spec)

| Part | Responsibility |
|---|---|
| `vite.config.ts` | vite-plugin-singlefile, `build.rollupOptions.output.format: 'iife'`, `inlineDynamicImports`, assets inlined; output `dist/player.html` with the placeholder `<script id="bm-course" type="application/json">__BM_COURSE__</script>` |
| `src/styles/` | `tokens.css` = `research/cobalt-tokens.css`; component CSS copied from `player-design.md` §3-8 and `player-proto.html`; Space Grotesk 600/700 + Inter 400/500/600 latin subsets embedded as base64 woff2 |
| `src/sprite.ts` | The 11/sprite.html symbols the player needs (list in `player-design.md` §2) |
| `src/router.ts` | Hash routes `#/` and `#/l/<lessonId>`; completion overlay |
| `src/views/Home.vue` | Hero slab (skins cobalt / ink / lime), study-plan strip with countdown, the path on a dotted canvas (milestones, subtopics on dotted ties, marks, mentor notes, "You are here"), receipts slab "Checked before you saw it" with the per-agent log, sources, footer with exports |
| `src/views/Lesson.vue` | Lesson head, table of blocks (pager under 1200px), 720px reading column, narration dock (lime play, word-timing waveform, speed chip, follow toggle), finish card |
| `src/blocks/*.vue` | One component per enabled type, ported from `frontend/app/components/blocks/*.vue` and `assessments/*.vue` (read-only source: copy logic, restyle in cobalt, drop Nuxt/Pinia/API code) |
| `src/runtime/` | `jsRunner.ts` (classic Blob worker from an inline source string, terminate after 1.5 s), `progress.ts` (localStorage `bm:<courseId>:*` in try/catch), `cites.ts` (popover + `sources/<file>#page=N`), `speak.ts` (MediaRecorder record-and-compare + self-rating; Web Speech scoring only when served over http and online, never relied on) |
| Stage mode | `P` key → `data-density="stage"` |

**apps/cli**: `src/main.ts` (commander), one file per command, the JSON-line contract below, `--as`
attribution on every command, `scripts/bundle.mjs` (esbuild → `skills/bilimind/scripts/bilimind.mjs`,
copies `packages/player/dist/player.html` → `skills/bilimind/templates/player.html` and the objects).

**packages/mcp** (P2): `src/server.ts` on `@modelcontextprotocol/sdk` 1.32.1 over stdio, one tool per
CLI command (same engine functions, same JSON), every call short (one lesson per call, under 30 s).

### 2.4 The course output folder (what the student owns)

```
<workspace>/bilimind-out/<slug>/          e.g. bilimind-out/ds-final-2026-10-15/
  index.html          the course (player + course data inlined); opens offline by double-click and in WorkBuddy Preview
  plan.md             assumptions, past-paper weights, kept/cut with reasons, day-by-day plan
  REPORT.md           what each agent did; checks run/passed/repaired/flagged; verdicts; code tests; cost (USD + credits); wall time
  reviews.ics         study blocks + spaced reviews (generated from review/state.json)
  deck.csv            Anki import (P0); deck.apkg (P1)
  lessons/NN-<key>.md Obsidian notes with citation callouts
  audio/<hash>.mp3    narration + speaking phrases (+ <hash>.json word timings)
  img/                3D objects used by this course
  sources/            copies of the student's files (citation chips link to sources/<file>.pdf#page=N)
  course.json         the full data the page uses
  review/state.json   the one schedule (FSRS cards); outbox.json (last questions sent); history.jsonl (answers)
  crew/               the crew's workbench, visible on purpose:
    goal.json  ingest.json  outline.json  exam-map.json  exam-map.md  plan.json
    lessons/<key>.json      lesson drafts the Writers edit
    checks/<key>.json       check results per round
    code/<key>-b<n>/        files the Coder edits (instructions.md, starter.js, solution.js, tests.json)
    evidence/<key>.md       packets the Checker reads
    verdicts/<key>.json     the Checker's rulings with reasons and quotes
    log.jsonl               every command with agent, time, result, cost
    cache/                  LLM response cache (ignored on stage runs)
```

### 2.5 CLI contract (every command)

`node "${CODEBUDDY_SKILL_DIR}/scripts/bilimind.mjs" <command> [--course <dir>] [--as "<agent label>"] [flags]`

- `--course` defaults to the newest folder under `./bilimind-out/`.
- stdout is exactly one JSON line: `{"ok":true,"cmd":"draft","data":{...},"cost_usd":0.0012,"ms":34120}`
  or `{"ok":false,"cmd":"draft","error":"<one sentence>","hint":"<what to do next>"}`. Exit code 0 or 1.
  Progress goes to stderr. Paths in output are relative to the course folder.
- Every command appends to `crew/log.jsonl`. `--no-cache`, `--model <id>`, `--max-usd <n>` are global.
- No command takes longer than ~60 s (one lesson per call), so the same functions fit MCP's 30 s guidance
  once narration is split per lesson.

| Command | Used by | Input | Output `data` |
|---|---|---|---|
| `doctor` | Lead (first) | none | `{node, key: bool, balance_usd, reserve_usd, spent_today_usd, clock_skew_ms, edge_tts: bool}`; fails with a hint when the key is missing or the balance is under the reserve |
| `init --src <folder> --sentence "<text>" [--slug s]` | Lead | the source folder (default: cwd) and the user's sentence | `{course}`: creates the course folder, copies files to `sources/` |
| `goal --deadline <ISO> [--exam-time HH:MM] --minutes-per-day N --audience student\|staff --lang en --code-lang js [--assume "<text>"]...` | Lead | the Lead's reading of the sentence | `{goal}`; writes `crew/goal.json` with the assumptions list |
| `ingest [--role "<file>=past_paper"]...` | Lead | `sources/` | `{files:[{name, kind, role, pages, words, scanned_pages:[]}], chunks, thin_files:[]}` |
| `outline [--max-topics 8]` | Lead | goal + digest of lecture files (past papers excluded) | `{title, allows_code, topics:[{key, title, archetype, kind_label, formats:[], minutes, track, parent, thin}]}` |
| `exam-map [--assign "Q3=<key>"]...` | Lead | past-paper chunks + outline | `{questions: n, total_marks, weights:[{key, title, marks, share, questions:["Q2b","Q5"]}], unmatched:["Q7"]}` + `crew/exam-map.md` |
| `plan --keep k1,k2,... [--cut "<key>=<reason>"]... [--order k2,k1,...]` | Lead | the Lead's decision | `{lessons:[{key, title, day, minutes}], capacity_min, used_min, reviews: n, warnings:[]}` + `plan.md` |
| `draft --lesson <key> [--note "<instruction>"] [--only <type>]` | Writer | lesson + top-6 chunks + derived formats | `{blocks:[types], items: n, code_blocks: n, cites: n}` + `crew/lessons/<key>.json` |
| `check --lesson <key>` | Writer, Lead | the lesson JSON | `{passed, failed:[{rule, block, item, detail, suggestion}], auto_fixed:[{rule, detail}]}` |
| `code-test --lesson <key> [--block n] [--dump\|--apply\|--disable --reason "<text>"]` | Coder | lesson code blocks / the dumped files | `{blocks:[{block, reference:{passed, total, failures:[{test, expected, actual}]}, starter:{passed, total}}]}` |
| `evidence --lesson <key>` | Checker | lesson items + chunks | `{items: n, packet: "crew/evidence/<key>.md"}` |
| `verdict --lesson <key> (--item q3 --verdict supported\|contradicted\|not_covered --quote "<verbatim>" --reason "<text>" \| --file <verdicts.json>)` | Checker | the Checker's rulings | `{applied: n, refused:[{item, why}], excluded: n, labelled: n}` |
| `rewrite-item --lesson <key> --item q3 --reason "<checker reason>"` | Checker | the item + its chunks | `{item: {...new...}, status: "pending"}` |
| `narrate [--lessons k1,k2] [--voice <id>] [--langs en,ms]` | Lead | lessons | `{clips, minutes, failed:[]}` |
| `export` | Lead | everything | `{files:["lessons/01-...md", "deck.csv", "reviews.ics", "REPORT.md"]}` |
| `build` | Lead | everything | `{index_html, size_kb, lessons, receipts:{...}}` |
| `note --text "<decision>"` | any agent | free text | `{}`; the line appears in REPORT.md and the receipts' per-agent log |
| `due --n 3` (P2) | Coach Automation | `review/state.json` | `{questions:[{n, id, prompt, options?}], page: "review/today.html"}` |
| `grade --answers "<reply>"` (P2) | Coach Automation | the last `due` + reply | `{results:[{n, correct, expected, cite: "Lecture 4 · Slide 22", quote, next_due}], ics_updated: true}` |
| `plant --lesson <key> --n 10` / `plant-score` | builders (WP9) | a copy of a course | `{planted}` / `{caught, missed, false_alarms}` |
| `status` | Lead (resume) | course folder | `{stages:{ingest: done, ...}, lessons:{k1: "checked", ...}}` |
| `run --src <folder> --sentence "<text>"` | builders only, NOT in SKILL.md | everything | a full course without agents; used for fixtures, regression and cost measurement |

MCP tools (P2) mirror these one to one in snake_case (`plan_course` is `outline`, and so on), same
inputs, same `data` as `structuredContent`.

### 2.6 The skill (`skills/bilimind/`)

```
skills/bilimind/
  SKILL.md                      name, description with trigger words, the Lead's playbook (below)
  references/
    writer.md  coder.md  checker.md               sub-agent playbooks (15-40 lines each); coach.md only if P2 ships
    planning.md                 how to weigh past papers, capacity math, what to cut first, plan.md shape
    output-spec.md              what every output file is
    troubleshooting.md          missing key, sandbox denial, budget refusal, Edge TTS 403, scanned PDFs
  scripts/bilimind.mjs          the bundle (built)
  templates/player.html         the player template (built)
  assets/obj-*.webp, silence.mp3
  install.ps1                   copies the skill to C:\Users\User\.workbuddy-ai\skills\bilimind\ (the app watches this
                                folder, 0b) and to <demo workspace>\.codebuddy\skills\bilimind; never writes or reads a key
```

SKILL.md body, in order (the final text is written in WP7 after the spike):

1. **Never ask the user a question.** Unknown? Assume, record it with `goal --assume`, continue.
2. Create the task checklist (TaskCreate): Understand the goal · Read the folder · Plan the path ·
   Write lessons (parallel) · Test code · Check answers against the slides · Narrate · Package · Schedule reviews.
3. `doctor`, then `init`, then `goal` with your reading of the sentence (date, time, minutes, audience,
   language, `--code-lang js`).
4. `ingest`. Look at the roles; correct any with `--role`. Say which pages are scans and which files are thin.
5. `outline`, then `exam-map` if a past paper exists. Open `crew/exam-map.md`, sanity-check the top
   matches, fix wrong ones with `--assign`.
6. Decide what to keep and what to cut (`references/planning.md`): capacity from the goal, weight from
   the past paper, prerequisites from the outline. Run `plan` with your reasons. Show the plan in at most
   10 lines. Do not wait for approval.
7. Launch one Writer sub-agent per kept lesson **in parallel** with the Agent tool, name
   "Writer · <lesson title>", prompt: "Read ${CODEBUDDY_SKILL_DIR}/references/writer.md and follow it for
   lesson <key> in <course dir>." Never write lesson content yourself.
8. When all Writers return: launch "Coder" (if any lesson has code) and "Checker" in parallel, each with
   its playbook.
9. `narrate`, `export`, `build`. Open `index.html` in the Preview panel.
10. Reply with: what was built (counts), what was checked (from REPORT.md: checks, rejections, rewrites,
    code fixes, labels), cost in USD, wall time, and the file list. Then one sentence pointing at
    `reviews.ics` ("import this into your calendar") and the course's "Due today" list.

Rules: content comes only from the user's files; the CLI decides block formats from the archetype,
never change them; images never contain text; write only inside `bilimind-out/`; never print the key;
stop and report when the CLI refuses on budget.

Writer playbook (`writer.md`, abridged): run `draft`; run `check`; for each failure decide: missing
mandatory format → `draft --only <type> --note "<what this block must teach, from which slide>"`; small
schema or answer-key fault → edit `crew/lessons/<key>.json` yourself; thin lesson → one full `draft
--note`; re-run `check`; at most 2 repair rounds; log each decision with `note`; return one line
("hashing: 7 blocks, 5 questions, 15/15 checks, repaired: added walkthrough").

Coder playbook (`coder.md`, abridged): `code-test --dump`; run; if the reference fails, read expected vs
actual and decide whether the solution or the test is wrong from the instructions and the cited slide;
edit the files; `code-test --apply`; if the starter passes every test, remove the line that solves it and
leave a TODO; at most 3 rounds per exercise, else `--disable --reason`; `note` each fix.

Checker playbook (`checker.md`, abridged): for each lesson, `evidence`, read the packet, rule on every
item using only the excerpts, quote the shortest deciding phrase verbatim, reason in at most 25 words;
`verdict --file`; for each contradicted item, `rewrite-item` once and rule again; leave not-covered items
labelled; never use your own knowledge to support an answer.

### 2.7 The review schedule (Telegram cut, 0b)

- One schedule: `review/state.json` (FSRS via `core/fsrs.ts`). First due dates come from `plan` (dated
  backwards from the exam). `reviews.ics` and the player's "Due today" strip are generated from it.
- In the player, answering a due question or rating a card reschedules it in localStorage
  (`bm:<courseId>:fsrs`); the page says honestly that the calendar file reflects the plan, not later ratings.
- P2 (only if everything else is done): a WorkBuddy Automation "Today's review" (daily 08:00, skill
  bilimind, prompt: run `due --course <abs path> --n 5` and open `review/today.html`), plus `grade` for
  answers typed into WorkBuddy chat. No external messaging.

---

## 3. Block formats to build

### 3.1 The archetype mapping (code, never the model)

Verbatim from `ConceptArchetype.php` (`engine-port.md` §2), with the hackathon swap (no research images,
so spatial's `annotated_media` becomes `walkthrough`). `quiz` is added to every lesson unless a mandatory
format already carries assessments.

| Archetype | Learner tag (player) | Mandatory formats | Assessment bias | Likely in |
|---|---|---|---|---|
| procedural | A skill you do | walkthrough, checklist | ordering, short_answer, project | DS (heap insert), cafe (make a drink) |
| conceptual | An idea to get | explainer, diagram, analogy | short_answer, mcq, essay | DS (hashing) |
| factual | Stuff to memorise | flashcards, reference_table | cloze, mcq, multi_select | DS (Big-O table), Malay (numbers, food), cafe (menu) |
| discriminative | Two things you mix up | comparison, example | multi_select, short_answer, mcq | DS (array vs linked list) |
| diagnostic | A problem to diagnose | scenario, diagram | short_answer, ordering, multi_select | DS (why is my hash table slow) |
| quantitative | Numbers to feel | worked_example, playground | numeric, code, short_answer | DS (load factor, amortised cost) |
| spatial | A picture to read | diagram, walkthrough | mcq, short_answer, cloze | rare |
| evolutionary | How it got here | timeline, explainer | ordering, short_answer, mcq | rare |
| performance | Something to make | project, checklist | project, essay | DS capstone, cafe first shift |
| safety_critical | Get it right first time | checklist, scenario | multi_select, short_answer, ordering | cafe (allergens, hygiene) |
| communicative | Said out loud | speaking, dialogue | short_answer, cloze, mcq | Malay |

The outline variety gate (strictSmall: at least 3 archetypes, none above 40%, at least one performance or
communicative node) runs on the outline. On the Lead's selection it is a warning, not a block: the Lead may
keep 4 lessons that are mostly conceptual if the past paper says so, and `plan.md` says why.

### 3.2 Build priority

Every type below must at least render, because a mandatory format without a renderer silently empties a
lesson. Polish is what we ration.

| Priority | Types | What "done" means | Ported from (`frontend/app/components/`) |
|---|---|---|---|
| **P0 stage polish** (shown or likely shown on stage) | explainer, diagram, quiz (+ mcq, multi_select, cloze, numeric, short_answer, ordering with up/down buttons), code (JS function mode), flashcards, walkthrough, checklist, scenario, comparison, worked_example, playground, speaking | Full cobalt spec from `player-design.md` §5, interactions, states, phone layout, keyboard | `blocks/ExplainerBlock`, `DiagramBlock`, `QuizBlock` + `assessments/*`, `CodeBlock` + `sandbox/runner.worker.ts` (JS path only), `FlashcardsBlock`, `WalkthroughBlock`, `ChecklistBlock`, `ScenarioBlock`, `ComparisonBlock`, `WorkedExampleBlock`, `PlaygroundBlock`, `SpeakingBlock` |
| **P0 clean render** | analogy, example, reference_table, timeline, project (self-marked rubric), dialogue (scripted, opening line voiced) | Correct content, tokens and spacing right, no special motion | `AnalogyBlock`, `ExampleBlock`, `ReferenceTableBlock`, `TimelineBlock`, `ProjectBlock`, `DialogueBlock` |
| **P0 cross-cutting** | citation chips + popover, "Beyond your slides" label, narration dock + sentence cues, receipts slab, path with "You are here", lesson-complete path fill, stage mode | As `player-design.md` §3-6 | `workspace/Roadmap.vue` (path geometry) |
| **P1** | key_points, misconception, audio, reflection (Tier B, re-enable in `ENABLED_TYPES` once rendered); Mermaid pre-rendered to SVG; "how sure are you?" rating before reveal; course-complete overlay with the trophy; essay grading by rubric (self-marked) | | `KeyPointsBlock`, `MisconceptionBlock`, `AudioBlock`, `ReflectionBlock` |
| **P2** | Match mode on flashcards, drag ordering, Python via Pyodide (online, `media.md` §4 data: URL module worker), SQL via Python sqlite3, diagnostic quiz, night theme, confetti, completion voice line | | |
| **Disabled** | illustration, annotated_media, video, resource, exam | Removed from `ENABLED_TYPES` and the prompt catalogue, so the model never emits them | |

Code exercises: the engine passes `--code-lang js` (from `goal`), so DS exercises are JavaScript
`function` mode with `{name, call, expect}` tests: they run instantly offline in a Blob worker in the page
and in `node:vm` for the Coder. Never say "Python in the browser" on stage.

---

## 4. Showcase courses, live demo, backups

### 4.1 The three courses

All three are generated **through WorkBuddy with the skill** (so their receipts slab is true), at most 3
runs each, best run committed to `showcase/courses/<slug>/` together with its `REPORT.md`.

**A. Hero, live: "Data Structures: Final on Thursday"** (skin cobalt, object `obj-book`)
- Sources, option 1 (preferred, H9): Oybek's own module slides plus a past-year paper, kept on the laptop,
  never published; lecturer permission if shown on the projector.
- Sources, option 2 (default until H9 answers, public): MIT OpenCourseWare 6.006 Introduction to
  Algorithms, Spring 2020, CC BY-NC-SA 4.0: lecture notes 2 (sequences, dynamic arrays), 4 (hashing),
  6-7 (binary trees, AVL), 8 (binary heaps), plus Quiz 1 problems as the "past paper". Attribution in the
  course footer and `LICENSE.md`. Non-commercial demo use fits the licence.
- Sentence: "My Data Structures final is Thursday 9am. The slides and last year's paper are in this
  folder. I have 45 minutes a day. Get me ready." (Thursday = 3 days after pitch day; adjust the word.)
- Expected plan: capacity 3 x 45 = 135 min, 60% to new lessons, so 4 lessons; the past paper weights
  hashing and heaps; at least one topic cut with a reason.
- Expected formats: code (JS), diagram, worked_example, playground (load factor vs probes), comparison,
  reference_table (Big-O), flashcards, walkthrough (heap insert), quizzes with slide chips.
- Live targets (measured in WP9, not promised): one user message; 4 Writers in parallel; at least one
  Checker rejection or label; one Coder fix; wall time under 5 min; OpenRouter under $0.08.

**B. Cameo: "Boba Shop: Day One"** or the real shop's name (skin lime, object `img/11/cafe.webp` or `obj-check`)
- Sources: a real local shop's SOP and menu sheet with written permission (H10). Fallback: a sample SOP
  written by WP8, first page "Sample document, fictional shop", plus an accurate one-page summary of the
  Food Hygiene Regulations 2009 food-handler duties (the course says it does not replace MOH food-handler
  training).
- Sentence: "We hire new crew every few weeks. Turn our SOP folder into a day-one course they must pass
  before their first shift."
- Formats: walkthrough (make a brown-sugar milk tea, what goes wrong at each step), checklist (opening and
  closing shift), scenario (dairy allergy, spill at the counter), reference_table (sweetness and ice
  levels), flashcards (menu codes), quiz with a pass mark.
- Stage beat (25 s): the course home on the rail, then the new hire's Telegram question. P1: lesson 1
  narrated in Malay and Burmese (`ms-MY-YasminNeural`, `my-MM-NilarNeural`) and the Telegram question in
  Burmese, with the disclaimer "Translated by AI. Ask a fluent colleague to check."

**C. Cameo: "Bahasa Melayu Survival Kit"** (skin ink, object `obj-mic`)
- Sources: Wikivoyage "Malay phrasebook" (CC BY-SA) saved as Markdown in the folder with attribution,
  and a one-paragraph note citing Taylor's MPU page (international degree students must pass Bahasa
  Melayu Komunikasi 2). Footer: "A practice companion, not the official BMK syllabus."
- Sentence: "I'm an international student at Taylor's with zero Malay. Make me a survival course for my
  first month (mamak, Grab, campus) that also starts me on Bahasa Melayu Komunikasi."
- Formats: speaking (Yasmin, rate -10%), dialogue (ordering at the mamak), flashcards, reference_table
  (pronunciation), cloze quiz.
- Stage use: 10 seconds, only if time allows or in Q&A: play "Teh tarik kurang manis, satu", record,
  play it back next to the native voice, self-rate. No score is claimed. A Malaysian friend checks the
  phrases first (H15). Its real job: proof that a different sentence gives a different course.

Cut: "Why Rereading Lies to You" (the 4th course). Its one stat goes on a rail card instead.

### 4.2 Stage layout

- Projector: WorkBuddy on the left ~70% (Compact Mode off, font zoom up), the pitch rail on the right
  ~30% (`pitch/index.html?mode=rail` in an Edge window). The course opens in WorkBuddy's Preview panel.
- Phone with Telegram on the table; Telegram Desktop pinned under the rail as the projector copy.
- Driver (Sharif or whoever H14 names) works the laptop; Oybek speaks.
- Before the timer: demo workspace `C:\Demo\DS-Final\` (sources only, `bilimind-out` emptied by the reset
  script), Full Access for that folder only, the Automation already created, the morning run of the
  identical sentence open in a second WorkBuddy task, player localStorage cleared.
- Rule for pressing Enter: if rehearsal p90 is under 4:30, press Enter at 0:00 on stage. If over, and the
  organisers give setup time, press Enter during setup and say so ("I pressed Enter when we plugged in,
  two minutes ago"). Never claim it started later than it did.

### 4.3 Live flow (assumes 3 min pitch + 2 min demo; re-time when the real rules arrive)

| Time | Screen | Said (gist) |
|---|---|---|
| 0:00 | WorkBuddy, empty task, folder visible in All Files | "This is WorkBuddy, Tencent's agent workstation. I'm giving it one sentence." Paste, Enter. |
| 0:20 | Rail card 1: "Who studies by rereading?" | Hands up; 84% reread; testing = ~80% vs ~33% a week later; why nobody does it: hours of setup; Oybek's two true sentences. |
| 0:50 | WorkBuddy: the Lead's assumptions and plan, checklist ticking | "I didn't write these steps. It found last year's paper, weighted topics by marks, sized 4 lessons to my 3 days, and cut AVL rotations because the paper never asks it." (Example wording: say what the real run decided.) |
| 1:30 | Writer sub-agent cards running in parallel | "Four writers, one per lesson. The agents decide what to teach and when; our code decides how each kind of knowledge is taught: a calculation gets a slider, a procedure a walkthrough." |
| 2:00 | Rail card 3: the cafe course + the new hire's Telegram question | "Same crew, a shop's SOP: a day-one course and a question on the new hire's phone." |
| 2:25 | Rail card 4: honest numbers | Cost per course in dollars and credits, wall time, Checker caught X/20 planted errors, N students tried it today + one quote. "The engine's prompts come from our app BiliMind; everything running in WorkBuddy was built here." |
| 2:50 | Rail card 6 | "One sentence in. A course out. Checked against your slides." |
| D 0:00 | Automation page: press **Run now** (questions will arrive in ~40 s) | "While that runs, here's what the crew did." |
| D 0:10 | Transcript: the Checker's rejection, then the Coder's fail-then-pass | "It argued with itself. Q7 said worst case O(n log n); slide 22 says otherwise. Rejected, rewritten, passed. And a test failed, the Coder fixed it." |
| D 0:35 | Preview: `index.html` home, path, receipts slab | "A course with an order, and the receipts." |
| D 0:50 | A lesson: click the rewritten Q7's chip (slide text pops up); Run the JS exercise (green) | "Every answer shows its slide. Every exercise was run before I saw it." |
| D 1:10 | Phone buzzes: 3 due questions; a teammate answers one wrong | "It keeps working after the chat closes." |
| D 1:30 | WorkBuddy's reply on Telegram: correct answer, slide quote, "moved to tomorrow"; `reviews.ics` updated | "Wrong answer, so it comes back tomorrow, in my calendar too." |
| D 1:50 | Close | Tagline. |

If the live run is still going at D 0:00, show its checklist and cards, then switch to the morning run for
the rejection and the course ("Here is the same sentence at 9 this morning").

### 4.4 Backups (decided before going on stage)

| If | Then | Line |
|---|---|---|
| Live run not finished by D 0:00 | Morning run of the identical sentence, same folder | "Still writing the last lesson. Here's the same sentence from this morning." |
| WorkBuddy, credits or network fail | Film segment (sped up with a visible clock) + offline course folders from USB in Edge | "Hackathon Wi-Fi. Here is this exact run, recorded." |
| No real rejection in the live run | Show the morning run's rejection (it must be real, saved in `hackathon/runs/`) | (Never fake a log line.) |
| Telegram does not arrive in 60 s | "Run now" result inside WorkBuddy chat; reply there | "Here's the same loop inside WorkBuddy." |
| Preview panel misbehaves | Open the same `index.html` in Edge | |
| A citation looks wrong | Only click the rehearsed chip on stage | |
| Time runs short | Drop the calendar beat, then the cafe card. Never drop the rejection or the Telegram reply. | |
| Rules require a video | `film/out/bilimind-3min.mp4` (WP13) is the submission; the live slot uses the same flow | |

### 4.5 Rail cards (`pitch/`)

1. "Who studies by rereading?" + 84% + 80% vs 33% (sources in small print).
2. Real screenshot of the sub-agent cards from a real run (replaces the planned agent diagram) + "Agents
   decide what and when. Code decides how. Then they check."
3. Cafe: SOP → course → Telegram question (real shop name if H10 succeeds).
4. Measured numbers from `hackathon/runs/` only: $ + credits per course, wall time, Checker X/20 planted,
   students who tried it + one quote; vanilla WorkBuddy vs BiliMind (5-second clip or screenshot pair).
5. "What we built here" (the disclosure in §1.6).
6. "One sentence in. A course out. Checked against your slides."

---

## 5. Work packages for builder agents, and the order

### 5.1 Conventions for every builder

- Own only your directory. `packages/core` is the only shared contract; after gate G0 a change to it needs
  a line in `packages/core/CHANGELOG.md` and must keep `fixtures/course-ds-mini.json` valid.
- Never modify or run git in `C:\oybek\projects\bilimind\backend` or `frontend` (read-only sources to port
  from). Commits in `bilimind-desktop` are the orchestrator's call; commit at each gate, because the
  history is our evidence of what was built at the event.
- Installs: `pnpm install --registry=https://registry.npmmirror.com` (npmjs is blocked on campus). Never
  plan `npx` or an install inside a demo or inside the skill at runtime.
- Real LLM calls only through `packages/engine/src/llm.ts` (it enforces the ledger). Use `--no-cache` only
  when measuring. Tests use recorded fixtures (`hackathon/research/engine-port-samples/*.json`) and mocked
  fetch; a WP's live-call allowance is in its row.
- Frontend checks without a visible browser: puppeteer-core driving the installed Edge
  (`plan/context/bilimind-verify-frontend-without-browser.md`), screenshots at 1440x900 and 390x844,
  console errors collected and asserted empty.
- Done = acceptance tests pass AND a 3-line status note (what works, what is stubbed, what is next) in the
  WP's directory `STATUS.md`.

### 5.2 The packages

**WP0 Foundation and contracts** · owner `packages/core`, root config · depends on nothing · **first, ~1.5 h**
- Inputs: `engine-port.md` §1.1, §2, §4; `player-design.md` §1.3; `engine-port-samples/lesson-bst-*.json`.
- Outputs: `.npmrc` registry fixed if needed; `pnpm-workspace.yaml` + `film`; package skeletons
  (`packages/{core,engine,player,mcp}`, `apps/cli`) with `package.json`, `tsconfig.json`, `vitest`;
  `packages/core/src/{types,archetypes,blocks,course-schema,grade,sentences,fsrs}.ts`;
  `fixtures/course-ds-mini.json` (2 lessons, every P0 block type and assessment kind, citations, cues,
  receipts, plan, a "beyond_slides" label, one rejected item excluded).
- Acceptance: `pnpm install` and `pnpm -r typecheck` pass; `pnpm -F @bilimind/core test`: the fixture
  validates; the 3 sample lessons validate after a `fromSaasLesson()` converter; `grade.ts` unit tests
  cover all kinds (multi_select Jaccard, ordering pairs, numeric "13,04", cloze normalisation);
  `sentences.ts` gives the same ids for the same text in Node and in a browser bundle.

**WP-S Spike kit** · owner `hackathon/spike/` · depends on nothing · **T+0, ~30 min, then the human runs it (H4)**
- Outputs: `hackathon/spike/bilimind-spike/` skill (SKILL.md + `scripts/hello.mjs`) that prints shell,
  node version, cwd, skill dir, whether `OPENROUTER_API_KEY` is set (yes/no only), then launches 3 parallel
  sub-agents that each run `hello.mjs --sleep 20 --id N`, creates a TaskCreate checklist, writes
  `spike.html` (an mp3 from `scratch/media/out/`, a Blob-worker JS test, a `sources/x.pdf#page=3` link, a
  localStorage test) and opens it in Preview, and tries the Artifact share tool; a zip of it; and
  `hackathon/SPIKE.md` as a fill-in form with the questions in §7 H4.
- Acceptance: the zip has SKILL.md at its root and is under 1 MB; `node hello.mjs` runs from a temp copy.

**WP1 Engine I/O: LLM, ledger, cache, log, ingest, retrieval** · owner `packages/engine/src/{config,llm,ledger,cache,log,ingest/*,retrieve}.ts` · depends on WP0 (WP8 for real files)
- Acceptance: unit tests with mocked fetch: provider block and reasoning flag sent as specified; 4xx stops,
  429 retries; corrective turn on invalid JSON; ledger refuses above $0.25/run, $2/day, and when
  balance - $4 reserve < 0 (unless `BILIMIND_DEMO_DAY=1`); cache hit costs $0. Ingest: a hand-written
  minimal PDF fixture gives `Page N` locators; a hand-built pptx (fflate) gives `Slide N` with speaker
  notes; a text-less PDF page is reported as scanned; on WP8's MIT folder every file ingests, the quiz is
  role `past_paper`. Live allowance: one 20-token OpenRouter call to confirm the pinned route ($0.001).

**WP2 Engine planning and drafting: prompts, outline, exam-map, plan, draft, normalisers** · owner `packages/engine/src/{prompts/*,outline,exam,plan,draft,normalise/*}.ts` · depends on WP0, WP1 (llm interface can be mocked)
- Acceptance: golden tests on `outline-trees-heaps-noreason.json` (fails the gate: procedural 55%, wrong
  `allows_code`, too many topics) and `-reasoning.json` (passes after the marks fix); prompt text matches
  the PHP heredocs (`engine-port-samples/measure*.py` extraction as the reference); `exam-map` on the MIT
  quiz assigns at least 70% of marks to topics and writes a readable `exam-map.md`; `plan` with 3 days x
  45 min keeps 4 lessons, all review dates fall before the exam, over-capacity selection produces a
  warning; `draft` normalises `lesson-bst-*.json` (MCQ cap demotes, duplicate diagram dropped). Live
  allowance $0.05: 2 outlines + 4 drafts on the MIT folder; at least 3 of 4 drafts carry all mandatory
  formats on the first attempt (record the rate in STATUS.md).

**WP3 Engine validation and the agents' tools: validate, code-test, evidence, verdict, rewrite, plant** · owner `packages/engine/src/{validate/*,codework,evidence,verdict,rewrite,plant}.ts` · depends on WP0
- Acceptance: fixtures where (a) the reference solution fails a test → `check` fails with expected vs
  actual, (b) the starter passes every test → flagged, (c) an infinite loop is killed at 2 s, (d) a
  constant playground formula is flagged, (e) a bad Mermaid is dropped, (f) a cite id not supplied is
  stripped; `code-test --dump` then an edit then `--apply` round-trips; `verdict` refuses a quote that is
  not verbatim, excludes contradicted items from `course.json`, labels not-covered ones; `plant --n 10`
  then a scripted perfect checker scores 10/10, a scripted "all supported" checker scores 0/10. Live
  allowance $0.01 (rewrite-item twice).

**WP4 Engine media, review and packaging: tts, review, export, build** · owner `packages/engine/src/{tts,review,export/*,build}.ts` · depends on WP0; `build` needs WP5's template (use a stub template until then)
- Acceptance: `narrate` on the fixture works with the PC clock 8 h off (skew fix), mp3 duration > 0 by
  ffprobe, cue count equals the player's sentence spans for the same text; 12 parallel clips in under 20 s;
  `.ics` parses back, has study blocks plus reviews, every event before the exam, TZ Asia/Kuala_Lumpur
  (one manual import into Google or Outlook, screenshot in STATUS.md); `due` → `grade "1 b, 2 x, 3 O(n)"`
  updates `state.json`, `history.jsonl` and `reviews.ics`, and the reply text carries the slide quote;
  `deck.csv` imports into Anki (manual once); `REPORT.md` counts equal counts recomputed from `log.jsonl`;
  `build` on the fixture produces `index.html` under 2.5 MB that validates against `course-schema.ts`.

**WP5a Player shell** · owner `packages/player` (shell, routing, home, lesson view, dock, cites, runtime, build) · depends on WP0's fixture
- Acceptance: `pnpm -F @bilimind/player build` → `dist/player.html` under 1.5 MB with the placeholder;
  a dev script pastes the fixture in and the Edge smoke test opens it via `file://` with zero console
  errors; home (all 3 skins), path with states and "You are here", receipts slab with the per-agent log,
  lesson view with dock: audio plays and the highlighted sentence advances; cite popover shows the quote
  and links `sources/<file>#page=N`; lesson complete fills the path; stage mode at 1280x720 has no
  horizontal overflow; 390px screenshots match `player-proto.html` phone fixes; localStorage keys are
  `bm:<courseId>:*` and survive reload. Also the first check of the day: an inline-script singlefile build
  runs from `file://` (if not, switch output format before anything else).

**WP5b Player blocks: reading and visual** · owner `packages/player/src/blocks/{Explainer,Analogy,Example,Diagram,Comparison,ReferenceTable,Timeline,WorkedExample,Playground}.vue` (+ P1 Tier B) · depends on WP0, WP5a's shell (can start with a bare harness page)
- Acceptance: each type renders the fixture and the 3 sample lessons; Diagram lazy-loads Mermaid from
  jsDelivr with the cobalt theme and shows `alt_text` offline (P1: pre-rendered SVG used when present);
  WorkedExample reveals step by step; Playground recomputes in a Blob worker with a 1.5 s timeout and
  draws the 28-point sparkline; screenshots of each at 1440 and 390 in STATUS.md.

**WP5c Player blocks: interactive** · owner `packages/player/src/blocks/{Quiz,Code,Flashcards,Walkthrough,Checklist,Scenario,Project,Speaking,Dialogue}.vue`, `src/assessments/*` · depends on WP0, WP5a
- Acceptance: every assessment kind grades with `core/grade.ts` and shows the cited explanation after
  submit, never before (answer keys not in the DOM); Code: Run executes the JS tests in a Blob worker and
  shows per-test pass/fail, an infinite loop is killed, hints unlock after one run; Flashcards flip, rate
  (again/good/easy) and store locally; Scenario reaches the debrief on every path; Speaking plays the
  native mp3, records with MediaRecorder, plays back, self-rates, and on `NotAllowedError` shows one line,
  never a broken state; an automated puppeteer test clicks Run on the fixture's exercise and reads green.

**WP6 CLI and bundle** · owner `apps/cli` · depends on WP0; wires WP1-WP4 as they land (stubs before)
- Acceptance: every command in §2.5 exists and prints exactly one JSON line (a contract test runs all of
  them on the fixture); `scripts/bundle.mjs` produces `skills/bilimind/scripts/bilimind.mjs` that runs
  `doctor` from a temp folder with no `node_modules`; `run` on the MIT folder makes a schema-valid course in
  under 6 min and under $0.08 (record both in STATUS.md); the skill zip is under 10 MB with SKILL.md at
  its root.

**WP7 Skill, playbooks, install** · owner `skills/bilimind` (SKILL.md, references/, install.ps1, zip script) · draft from T+2h; **final text only after gate G1 (spike)**
- Acceptance (human-run in WorkBuddy, builder reads the transcript): the hero sentence produces a course
  with zero questions to the user; 4 Writer sub-agents ran in parallel; the Coder and Checker ran; every
  repair decision appears in the transcript in the agent's own words; REPORT.md shows at least one real
  rejection or "beyond your slides" label; `index.html` opens in Preview; no command ever called `run`.

**WP8 Showcase sources** · owner `showcase/sources/{ds-final,bm-survival,boba-day-one}` · depends on nothing · T+0
- Outputs: each folder with its files and `LICENSE.md` (source URL, licence, attribution text); the MIT
  6.006 lecture-note PDFs and Quiz 1 problems; Wikivoyage Malay phrasebook as Markdown; the sample SOP
  (DOCX or PDF, marked fictional) + the FHR 2009 one-pager; slots for H9 and H10 material (never committed
  if private: add their paths to `.gitignore`).
- Acceptance: WP1's ingest reads every file; the past paper is detected; no file without a licence note.
  Downloads are approved by the human through the permission prompt (filename, source, size).

**WP9 Integration, measurement, Checker benchmark** · owner `hackathon/runs/` · depends on WP6, WP7 · from G2
- Work: run the CLI `run` end to end and fix contract breaks with the owners; then WorkBuddy runs of the
  hero (human at the keyboard); per run save `REPORT.md`, wall time, OpenRouter cost (ledger) and
  WorkBuddy credits (read from the app); the benchmark: `plant --n 20` on a finished hero course, the
  Checker agent run on it in WorkBuddy, `plant-score` → "caught X/20, Y false alarms"; a hand check of 40
  supported verdicts against the slides; the "Thursday" vs "tomorrow" plan pair.
- Acceptance: 3 consecutive WorkBuddy runs on the venue network, each under the target time, numbers in
  `hackathon/runs/summary.md`; every number on the rail traces to a file there.

**WP10 Review loop wiring** · owner `skills/bilimind/references/coach.md` + `packages/engine/src/review.ts` fixes · depends on WP4, WP7, H8
- Acceptance: Automation "Run now" → the phone receives 3 questions within 60 s; a reply with one wrong
  answer → graded reply with the slide quote and the new due date within 60 s; `state.json` and
  `reviews.ics` updated; the fallback (answering inside WorkBuddy chat) works the same.

**WP11 Pitch deck** · owner `pitch/` · depends on screenshots from WP9 (placeholders before)
- Outputs: `pitch/index.html`, cobalt tokens, 6 cards (§4.5), `?mode=rail` (480px column) and full mode,
  arrow keys, works offline, fonts embedded.
- Acceptance: rail text at least 28px; opens from `file://` with no network; every number links to its
  `hackathon/runs/` source in the speaker notes; 1280x720 and 1920x1080 screenshots.

**WP12 Site (P1)** · owner `site/` · depends on showcase courses (G4)
- Outputs: one-page landing adapted from `11-cobalt-landing.html` (problem, the crew, the three courses
  as links to their static `index.html`, install steps for the skill, honest numbers, what was built here).
- Acceptance: works offline from `file://` and as a static site; 390px without horizontal scroll; every
  outbound link works. Publishing is the human's decision.

**WP13 Film** · owner `film/` · P1, P0 if the rules require a video · depends on raw recordings (H13)
- Outputs: `film/build.mjs`: `film/raw/*.mp4` + `film/cuts.json` (in/out, speed, caption) → title cards
  rendered from cobalt HTML with puppeteer-core → ffmpeg concat with speed ramps and a visible clock on
  sped-up parts, burned captions, Oybek's voice-over (fallback `en-US-AndrewMultilingualNeural`) →
  `film/out/bilimind-3min.mp4` (1080p, at most 3:00) and a 30-second teaser.
- Acceptance: plays in Windows Media Player and Chrome; duration within limits; every claim matches
  `hackathon/runs/summary.md`.

**WP14 Runbook and demo reset** · owner `hackathon/RUNBOOK.md`, `scripts/demo-reset.ps1` · depends on WP9
- Outputs: setup checklist (§4.2), exact sentences, the timing table, fallback decisions, who does what;
  a reset script that rebuilds `C:\Demo\DS-Final\` from `showcase/sources/ds-final` and empties only its
  `bilimind-out\`.
- Acceptance: a teammate who has not seen the build can set up the demo from the runbook in 10 minutes.

**WP15 MCP (P2, conditional)** · owner `packages/mcp` · only if G1 says named tools beat Bash calls on screen
- Acceptance: `@modelcontextprotocol/sdk` 1.32.1 stdio server lists every tool with zod schemas; a v1
  client test calls `check` and `verdict`; added to WorkBuddy via Connectors → Custom connector.

**WP16 Expert Team plugin (P2, conditional; P0 if the spike shows plain-skill sub-agents get no cards)** · owner `plugin/bilimind-team` · per `workbuddy.md` §7.5
- Acceptance: installs locally (Create expert team flow or `.codebuddy/agents`), shows member cards for
  Lead, Writer, Coder, Checker, and runs the same playbooks.

### 5.3 Order, lanes and gates

```
T+0      WP0 contracts ─────────┐      WP-S spike kit ──> H1-H5 + spike (human) ──> G1
         WP8 sources ───────┐   │
T+1.5h                     G0 contracts frozen (types, schemas, fixture)
T+1.5h   Lane A  WP1 engine I/O
         Lane B  WP2 outline / exam-map / plan / draft
         Lane C  WP3 validators + agent tools
         Lane D  WP4 tts / review / export / build
         Lane E  WP5a player shell
         Lane F  WP5b blocks (reading/visual)
         Lane G  WP5c blocks (interactive)
         Lane H  WP6 CLI + bundle, WP7 skill draft
T+~3h    G1 spike facts in hackathon/SPIKE.md → finalise WP7 shape; decide WP15/WP16
T+10h    G2  `bilimind run` on the MIT folder → valid course, opens via file:// in Edge with zero errors
T+12h    G3  first full WorkBuddy run of the hero sentence (WP7 acceptance)
T+12h+   WP9 measurements, WP10 Telegram, fixes; Lane I: WP11 deck, WP14 runbook, WP13 film, WP12 site
T+16h    G4  three showcase courses generated through WorkBuddy and committed; numbers in hackathon/runs/
T+18h    Feature freeze (only fixes after this)
T+20h+   G5  3 consecutive rehearsal runs on venue Wi-Fi under target; full pitch rehearsed 3 times
```

Parallelism: 8 builder lanes after G0. Integration is continuous: each lane runs against the fixture
first, then against the CLI. The only hard serial chain is WP0 → (WP1..WP6) → G2 → WP7 final → G3.

If the event leaves less than about 24 hours from T0: P0 only. Drop WP12, WP15, WP16, `.apkg`, Tier B
blocks, Mermaid pre-render, Burmese narration and the voice reply; WP13 becomes a raw screen recording
with captions. Never drop: the past-paper plan, the Checker and Coder loops, the Telegram text loop, the
receipts slab, citation chips.

### 5.4 Final verification before G5 (on the demo laptop)

1. Fresh WorkBuddy task, hero sentence, `--no-cache` everywhere: one user message, run finishes, REPORT.md
   numbers recorded.
2. `index.html` from `bilimind-out/` and from USB, Wi-Fi off: home, a lesson, quiz, JS exercise, narration.
3. Stage mode at the projector resolution (ask the venue; test 1280x720 and 1920x1080).
4. Telegram loop twice in a row; the second reply reflects the first answer's rescheduling.
5. Ledger: balance minus reserve still positive after rehearsals; `doctor` green.
6. Phone hotspot run: the same sentence finishes over the hotspot.
7. `scripts/demo-reset.ps1`, then the morning run kept open in a second task.

---

## 6. OpenRouter budget

### 6.1 The real number

`/api/v1/credits` on 2026-10-10: $75.00 bought, $65.31 used, **$9.69 left**. The key shows $12.80 left of
a $15 limit, but the account runs dry first. Plan on $9.69. Builder agents (Claude) spend no OpenRouter
money; only engine calls do.

Measured unit costs (`engine-port.md` §7.2, `media.md` §3), deepseek/deepseek-v4-flash, price-pinned
providers: lesson draft $0.0011-0.0012 (33 s, reasoning off); outline $0.0016 (63 s, reasoning on); one
quiz-item call $0.00003. A 4-lesson hero course with repairs and rewrites is about $0.01-0.03; the cap per
run is $0.25 and the planning number is $0.08. Narration is free.

### 6.2 Allocation

| Bucket | Cap | Covers |
|---|---|---|
| **Demo-day reserve (locked)** | **$4.00** | Live run, morning run, retries, Telegram explanations, two spare runs. Enforced: the ledger refuses any call that would take the balance below $4.00 unless `BILIMIND_DEMO_DAY=1` is set on the day |
| Engine development | $0.75 | WP1-WP4 live allowances (§5.2) and prompt fixes |
| CLI regression runs | $0.50 | 6-8 full `run` courses during integration |
| Showcase courses through WorkBuddy | $0.75 | 3 courses x up to 3 runs |
| Rehearsal runs | $0.50 | At least 6 hero runs before G5 |
| WorkBuddy agent loop on BYOK (only if WorkBuddy credits run out) | $2.50 | A separate OpenRouter key with a $2.50 key limit (H6), model `anthropic/claude-haiku-5.5`; roughly 1.5M input tokens per full crew run, so about $0.20-0.40 per run, 6-10 runs |
| Checker benchmark, rewrites, explanations, P1 translations | $0.30 | |
| Optional images (extra 3D objects, never text) | $0.25 | At most 8 images on a nano-banana-class model; the existing `img/11/obj-*.webp` and `cafe.webp` come first |
| Slack | $0.14 | |
| **Total** | **$9.69** | |

### 6.3 Rules that keep it true

1. Every content call goes through `llm.ts`: provider `require_parameters: true` and
   `max_price {prompt 0.2, completion 0.4}`, so routing never lands on the $1.28/M-output endpoints.
2. No `deepseek-v4-pro`, no image or music model, without `--allow-expensive`.
3. Caps in code: $0.25 per course run, $2.00 per day, the $4.00 floor. `doctor` prints balance, reserve
   and today's spend; run it at the start of every work session and before every rehearsal.
4. Cache during development (re-building a course after a player change costs $0); `--no-cache` only for
   measured runs and on stage.
5. Never use DeepSeek as the WorkBuddy BYOK agent model: WorkBuddy cannot send our provider pin, so it
   could land on a $1.28/M-output route. Use `anthropic/claude-haiku-5.5` there.
6. Checkpoints: if the balance is under $6.00 before G4, stop rehearsal runs until the showcase courses are
   committed; if it is under $4.50 before demo day, only the final rehearsal and the stage runs remain.

### 6.4 WorkBuddy credits (separate from OpenRouter)

Free: 250 sign-up credits (14 days) + 100 a month + 30 a day for using the desktop client. Pro: $10 a month
($7 the first month) for 2,000. Per-run cost is unknown until the spike measures a 4-lesson run (H4).
Order of preference: organiser credit codes (H5) → Free credits for the spike and first runs → Pro at $7 if
a full run costs more than about 60 credits (the human decides) → BYOK agent model from the $2.50 bucket.
Record credits per run in `hackathon/runs/` because a judge will ask what a run really costs.

---

## 7. What the human (Oybek and team) must do

We cannot sign in, set system settings, create bots or accept terms for you. Each item says when it
blocks something.

| # | Task | When | Time | Unblocks |
|---|---|---|---|---|
| H1 | Windows Settings → Time & language → Date & time → "Set time automatically" ON → Sync now (the clock is 8 h slow; it breaks Edge TTS and may break WorkBuddy sign-in) | Now | 1 min | H3, narration |
| H2 | Get the real organiser slides (the Desktop PDF is 0 bytes: re-download or ask). Note: time limits, judging weights, submission format (video?), WorkBuddy requirements, rules on pre-existing code, deadline. Ask for WorkBuddy credit codes. Put the PDF in `hackathon/` | Today | 15 min | Re-timing §4.3, WP13 priority |
| H3 | Install WorkBuddy (international, workbuddy.ai), sign in with Google or GitHub. Settings: English, Compact Mode OFF, Prevent Sleep ON, Auto-install non-high-risk skills ON | Now | 15 min | H4 |
| H4 | Run the spike with the WP-S kit (60 min); fill `hackathon/SPIKE.md` and take screenshots. Questions and what each answer changes are below | T+1h | 60 min | G1, WP7 final |
| H5 | Credits: ask organisers for codes; if none and the spike shows a run costs more than ~60 credits, decide on Pro ($7 first month) | After H4 | 5 min | Rehearsals |
| H6 | OpenRouter key for the CLI: `setx OPENROUTER_API_KEY <key>` (or `%USERPROFILE%\.bilimind\config.json`), then fully quit and restart WorkBuddy. Optional: create a second key "workbuddy-agents" with a $2.50 limit and add it in WorkBuddy Settings → Model → Custom (`https://openrouter.ai/api/v1/chat/completions`, model `anthropic/claude-haiku-5.5`, tool calling ticked) | After H4 | 10 min | G3 |
| H7 | Install the skill: Skills → Add skill → Upload skill (zip from WP6), confirm the security scan; run `install.ps1` so a copy sits in the demo workspace's `.codebuddy\skills\bilimind` | At G2 | 10 min | G3 |
| H8 | Telegram: BotFather `/newbot`, paste the token in WorkBuddy Assistant → Channels → Telegram, press Start in the bot on the phone. Create the Automation "BiliMind daily review" (prompt from §2.7, skill bilimind, daily 08:00, push to Telegram) | After G3 | 20 min | WP10 |
| H9 | Hero material: decide by T+3h whether the live course uses your own module's slides + a past paper (and get the lecturer's OK if they will be on the projector) or the MIT OCW default | T+3h | 10 min | WP8, rehearsals |
| H10 | Small business: ask one real shop near Taylor's (cafe, boba, dorm canteen) for its SOP or menu sheet and written permission, plus a one-line reaction after they see the course | By T+20h | 1-2 h | Course B, rail card 3 |
| H11 | Real users: 3-5 Taylor's students at the event run it on their own slides (on our laptop, outputs deleted after) or try a course for 10 minutes; time one person making 20 cards + a schedule by hand; collect "would you use it before your next exam?" and one quote with consent | After G3 | 1-2 h | Rail card 4 |
| H12 | Write two true sentences for the personal hook | Before rehearsal | 10 min | Pitch |
| H13 | Record raw footage with OBS (1080p): the best full run, the Telegram loop, the course walkthrough; record the voice-over | After G4 | 1 h | WP13 |
| H14 | Decide who is on stage: speaker (Oybek), driver, backup laptop holder; Q&A owners (Ulugbek business, Sharif tech, Oybek product) | Before rehearsal | 10 min | RUNBOOK |
| H15 | A Malaysian friend checks the Malay course phrases (and the cafe's Malay lines if P1 ships) | After G4 | 20 min | Course C on stage |
| H16 | Run the hero sentence once in WorkBuddy WITHOUT the skill (or with the built-in study expert); keep a 5-second clip and its output file | After H4 | 10 min | Rail card 4 |
| H17 | Rehearse: 3 consecutive runs on venue Wi-Fi plus one on the phone hotspot; the full pitch 3 times with a timer | Before the pitch | 2 h | G5 |

### 7.1 Spike questions (H4) and what each answer changes

| # | Question | If yes | If no |
|---|---|---|---|
| S1 | Is `${CODEBUDDY_SKILL_DIR}` substituted in an uploaded skill? Where does the upload land on disk (`%USERPROFILE%\.workbuddy\skills`?) | SKILL.md uses it | `install.ps1` writes the absolute path into the installed SKILL.md |
| S2 | Does the workspace `.codebuddy\skills\` copy load in Work mode? | Keep both copies | Upload only |
| S3 | Which shell runs commands (PowerShell or Git Bash)? Is `node` on PATH? | | Quote rules in SKILL.md adjusted; full path to node.exe |
| S4 | Do 3 parallel Agent sub-agents from a plain skill show as cards? | Plain skill is the stage version | Try `.codebuddy/agents/*.md` custom agents; if still no cards, WP16 Expert Team becomes P0; if nothing parallel renders, run Writers one by one and cap the live run at 3 lessons |
| S5 | Does TaskCreate render as a ticking checklist? | Use it | The Lead ticks a checklist in `plan.md`, shown in Preview |
| S6 | Credits for the spike run; is a custom model selectable on this account? | | Budget decisions in §6.4 |
| S7 | Preview panel: does the test page play mp3, run a Blob worker, keep localStorage, open `#page=` links? | Course opens in Preview on stage | Open in Edge on stage |
| S8 | Permission prompts for scripts and network; does Full Access for one folder silence them? | Full Access in `C:\Demo\` only | Pre-approve each command type in rehearsal |
| S9 | Is `OPENROUTER_API_KEY` visible to the skill's shell after a restart? | | `%USERPROFILE%\.bilimind\config.json` |
| S10 | Does the Artifact tool publish an HTML share link? | "Share with your study group" beat (P1) | Skip |
| S11 | Automation: can it push to Telegram? Does a Telegram reply become a WorkBuddy task with skills? Can the bot send a file back? | Full loop; voice reply P1 if files work | Fallback loop inside WorkBuddy chat |
| S12 | Is the CodeBuddy CLI usable on this plan (International login, headless `-p`)? | Scripted regression runs in WP9 | WP9 uses WorkBuddy only |
| S13 | Exact English UI labels (Skills, Experts, Automation, Assistant, Results panel tabs) | Into RUNBOOK and the script | |

---

## 8. Risks and fallbacks

| # | Risk | Likelihood | Fallback / mitigation |
|---|---|---|---|
| R1 | Rules differ from our assumptions (PDF is 0 bytes): video submission, different time limits, a ban on pre-existing code | Medium | H2 first. Film pipeline ready (WP13). Disclosure line and repo history show what was built at the event; the reused part is prompts and rules, not running code |
| R2 | Plain-skill sub-agents do not render as cards | Medium | S4 ladder: custom agents → Expert Team plugin → sequential agents with a 3-lesson live cap |
| R3 | Live run too slow for the slot (outline 63 s, lessons 33-60 s each, plus agent overhead and repair rounds) | High | 4-lesson cap from capacity math; press Enter during setup when p90 > 4:30; morning run of the identical sentence; never show a spinner for more than 10 s |
| R4 | WorkBuddy credits run out during rehearsals | Medium | Organiser codes, Pro $7, or BYOK `claude-haiku-5.5` from the $2.50 bucket |
| R5 | OpenRouter balance drained | Low (code caps) | Ledger floor at $4.00; cached development; checkpoints in §6.3 |
| R6 | Campus Wi-Fi (FortiGate) blocks something on the day | Medium | Nothing installs at demo time; npmmirror; phone hotspot tested (§5.4 step 6); offline course folders on USB |
| R7 | Clock skew breaks sign-in or TTS | High until H1 | H1; the skew fix in `tts.ts` regardless; all showcase narration pre-rendered |
| R8 | Edge TTS endpoint changes or rate-limits | Low | Showcase audio already rendered and shipped in the folders; narration failure leaves the transcript and is logged, never blocks the build |
| R9 | No genuine Checker rejection in a given run | Medium | Real rejections are common on cheap no-reasoning drafts; keep every run's verdicts in `hackathon/runs/`; show a saved real one; never fake |
| R10 | The Checker is wrong (false alarm or misses) | Medium | Measured with planted errors and a 40-item hand check; the claim matches the measurement; "beyond your slides" label instead of a silent pass |
| R11 | Telegram loop unavailable on the international build or slow | Medium | S11; fallback loop inside WorkBuddy chat; "Run now" pressed at demo start to absorb latency |
| R12 | The singlefile player breaks on `file://` (module script, worker) | Low | WP5a's first test of the day; IIFE output; classic Blob workers (verified working in `media.md` §4) |
| R13 | Preview panel cannot play audio or run workers | Low-medium | S7; open in Edge |
| R14 | Past-paper parsing fails on a real paper's layout | Medium | Regexes for "Question N", "QN", "Problem N", "[N marks]", "(N points)"; the Lead reads `exam-map.md` and fixes matches with `--assign`; if a paper cannot be parsed, the plan says so and weights by slide coverage |
| R15 | Scanned slides or very thin slides | Medium | Ingest reports scanned pages (no OCR); thin topics flagged in `plan.md` ("your slides say little about X"); demo on text-based slides |
| R16 | Machine-translated safety steps (cafe P1) | Medium | Disclaimer on page one; a fluent check if possible; English-only cafe course is the P0 |
| R17 | Answer keys visible in devtools in an offline single file | Certain | Say so honestly if asked; keys never in the DOM before submit |
| R18 | Judges read it as "WorkBuddy already has student experts" | Medium | §1.6 answer + H16 vanilla clip + the receipts slab |
| R19 | Story too dense | Medium | One user, one stat, one before/after, three files named aloud (course, calendar, Telegram); every other feature only if a judge asks |
| R20 | A builder lane slips | High (some lane will) | Fixture-first lanes are independent; the 24-hour cut list in §5.3; the P0 cross-cutting items and the Checker/Coder loops are protected, polish is not |
| R21 | Licensing of showcase sources | Low | MIT OCW CC BY-NC-SA and Wikivoyage CC BY-SA with attribution in footers; private slides never committed or published |

---

## 9. Decisions still open (owner, deadline)

- Event length and pitch format: H2, today. Changes §4.3 timing and WP13 priority.
- Hero material (own module vs MIT OCW): H9, T+3h.
- Plain skill vs Expert Team for the stage: S4, at G1.
- Pro plan or BYOK for agents: H5, after the spike.
- Real shop for course B: H10, by T+20h, else the labelled sample.
