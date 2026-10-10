> Superseded planning notes from the event; the current state is in the README and docs/workbuddy.md.

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
6. Budget (DeepSeek, OpenRouter, WorkBuddy credits)
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
- **Organiser clarification (WhatsApp, 17:11 MYT):** "Integration isn't required: WorkBuddy doesn't have to be
  directly built into your final solution. Show your proof: provide proof that you utilized the platform during
  your project. Explain the scenario: in your presentation, clearly explain how, where, and in what scenario you
  used WorkBuddy." → We exceed this (BiliMind runs inside WorkBuddy). Collect PROOF deliberately into
  `hackathon/proof/`: screenshots of the crew run (plan checklist, parallel sub-agent cards, Checker rejection,
  Preview), WorkBuddy credit-usage page, the slides/docs tasks in WorkBuddy, the sites deploy. One slide titled
  "How, where and when we used WorkBuddy".
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

> My Data Structures final is Wednesday 9am. The slides and last year's paper are in this folder.
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
packaging) plus single-shot content calls (one text-model API call per lesson draft).

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
| 2. Agentic workflow | The Lead's plan in its own words ("Past paper: hashing 30% of marks, heaps 25%, AVL 0%. 3 days x 45 min = 4 lessons. Cut: AVL rotations."). Writers in parallel. A Writer repairing its own lesson. Coder: test failed, fixed, passed. Checker: Q7 rejected with a quote from slide 22, rewritten, passed. Two sentences, two different plans (screenshot pair: "Wednesday" vs "tomorrow"). |
| 3. Meaningful use of WorkBuddy | Skill in the Skills list; workspace folder access; Agent sub-agents (Expert Team member cards, P1); TaskCreate checklist; Preview and Artifacts panels; Artifact share link for the study group (if S10 works); the slides and docs themselves made in WorkBuddy (0b). No BiliMind server and no SaaS anywhere in the demo. |
| 4. End-to-end execution | The conversation has exactly one user message. SKILL.md forbids questions; the Lead writes its assumptions at the top of `plan.md`. |
| 5. Usable and verifiable results | Citation chip shows the exact slide text. JS exercise runs green in the page. `REPORT.md` lists every check. Checker benchmark: "caught X of 20 planted wrong answers, Y false alarms" (measured in WP9). |

The six track capabilities: understanding the goal = Lead's goal + assumptions; planning = outline +
past-paper weights + `plan.md` + TaskCreate checklist; executing = CLI tools, file writes, test runs,
TTS; collaborating and validating = Writers, Coder, Checker with real rejections; integrating =
`export` + `build` into one course and one schedule; delivering = files, Preview, share link, the deployed course.

### 1.5 The judges' must-change items: adopted, modified, rejected

| Item | Verdict | Why |
|---|---|---|
| Spike WorkBuddy before writing engine code | **Modified** | The spike comes first for the orchestration layer (SKILL.md, agent prompts, Expert Team): nothing there is frozen until it is done. Ingest, archetypes, validators, TTS and the player are needed whatever the spike shows, so builder agents start them at T+0. Waiting would waste the scarcest resource, hours. |
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
  player, the exports and the FSRS review schedule.
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
| `grade.ts` | Deterministic graders (port of DeterministicGrader, `engine-port.md` §4.2). Used by the player AND by `bilimind grade` (P2), so a question grades the same everywhere |
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

**A. Hero, live: "Data Structures: Final on Wednesday"** (skin cobalt, object `obj-book`)
- Sources (public only, owner decision in 0b): MIT OpenCourseWare 6.006 Introduction to Algorithms,
  Spring 2020, CC BY-NC-SA 4.0: lecture notes 2 (sequences, dynamic arrays), 4 (hashing), 6-7 (binary
  trees, AVL), 8 (binary heaps), plus Quiz 1 problems as the "past paper". Attribution in the course footer
  and `LICENSE.md`. Non-commercial demo use fits the licence. No private student slides anywhere.
- Sentence: "My Data Structures final is Wednesday 9am. The slides and last year's paper are in this
  folder. I have 45 minutes a day. Get me ready." (Pitch is Sunday, so Wednesday = 3 study days.)
- Expected plan: capacity 3 x 45 = 135 min, 60% to new lessons, so 4 lessons; the past paper weights
  hashing and heaps; at least one topic cut with a reason.
- Expected formats: code (JS), diagram, worked_example, playground (load factor vs probes), comparison,
  reference_table (Big-O), flashcards, walkthrough (heap insert), quizzes with slide chips.
- Live targets (measured in WP9, not promised): one user message; 4 Writers in parallel; at least one
  Checker rejection or label; one Coder fix; wall time under 5 min; text API under $0.08.

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
- Stage beat (15 s): the lime course home at the deployed link. P2: lesson 1 narrated in Malay and
  Burmese (`ms-MY-YasminNeural`, `my-MM-NilarNeural`) with the disclaimer "Translated by AI. Ask a fluent
  colleague to check."

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

Cut: "Why Rereading Lies to You" (the 4th course). Its one stat goes on slide 1 instead.

### 4.2 Stage layout

- Projector: WorkBuddy on the left ~70% (Compact Mode off, font zoom up), the slides on the right ~30%
  (rail mode, or the PDF in a narrow Edge window). The course opens in WorkBuddy's Preview panel.
- The team decides who speaks and who drives the laptop (H14).
- Before the timer: demo workspace `C:\Demo\DS-Final\` (sources only, `bilimind-out` emptied by the reset
  script), Full Access for that folder only, the morning run of the identical sentence open in a second
  WorkBuddy task, player localStorage cleared, the deployed link open in a background tab.
- The slot is 3 minutes in total (0b), and a full crew run takes about 5. So: press Enter when setup
  starts and say so ("I gave it this sentence when we plugged in"). The talk shows the live run in flight
  (plan, cards) and the finished morning run for the outcome. Never claim it started later than it did.

### 4.3 Live flow: 3:00 presentation, then 2:00 Q&A (0b)

| Time | Screen | Said (gist) |
|---|---|---|
| 0:00 | WorkBuddy: the sentence, the live run in progress | "This is WorkBuddy, Tencent's agent workstation. When we plugged in I gave it one sentence." Read it. |
| 0:15 | Slide 1: "Who studies by rereading?" | 84% reread; testing = ~80% vs ~33% a week later; nobody does it because setup takes hours; Oybek's two true sentences. |
| 0:40 | WorkBuddy: the Lead's assumptions and plan, checklist ticking, Writer cards in parallel | "I didn't write these steps. It found last year's paper, weighted topics by marks, sized 4 lessons to my 3 days, and cut one topic with a reason. Four writers, one per lesson. The agents decide what to teach and when; our code decides how each kind of knowledge is taught." (Say what the real run decided.) |
| 1:15 | Transcript (live run, or the morning run): the Checker's rejection, the Coder's fail-then-pass | "It argued with itself. Q7's answer wasn't in slide 22: rejected, rewritten, passed. A test failed; the Coder fixed it." |
| 1:40 | Preview: the finished course (morning run, or live if done): path, receipts slab; click the rewritten Q7's chip; Run the JS exercise | "Every answer shows its slide. Every exercise ran before I saw it." |
| 2:10 | `reviews.ics` in a calendar (5 s), then slide 3: the cafe course | "Reviews already in my calendar. Same crew, a shop's SOP: a day-one onboarding course." |
| 2:30 | Slide 4: honest numbers + what we built here | Cost per course in dollars and credits, wall time, Checker caught X/20 planted errors. "The prompts come from our app BiliMind; everything running in WorkBuddy was built in the last 24 hours." |
| 2:52 | Slide 6 | "One sentence in. A course out. Checked against your slides." |

Q&A assets ready to open: the Malay course (different sentence → speaking drills), the vanilla WorkBuddy
comparison, `REPORT.md`, `plan.md` of the "tomorrow" variant, the deployed link.

Phase 2 (top 18, global video call, 4 min demo + 3 min Q&A, 0b): the same flow with one more minute for
the live run's finished course and the Malay cameo.

### 4.4 Backups (decided before going on stage)

| If | Then | Line |
|---|---|---|
| Live run not finished by 1:40 | Morning run of the identical sentence, same folder | "Still writing. Here's the same sentence from this morning." |
| WorkBuddy, credits or network fail | Screen recording of the best run (if WP13 made one) + offline course folders from USB in Edge + the deployed link on a phone hotspot | "Hackathon Wi-Fi. Here is this exact run, recorded." |
| No real rejection in the live run | Show the morning run's rejection (it must be real, saved in `hackathon/runs/`) | (Never fake a log line.) |
| Preview panel misbehaves | Open the same `index.html` in Edge | |
| A citation looks wrong | Only click the rehearsed chip on stage | |
| Time runs short | Drop the calendar beat, then the cafe slide. Never drop the plan or the rejection. | |

### 4.5 Slides (`pitch/`): required as PDF, made with WorkBuddy (0b)

Six slides, cobalt look, produced in WorkBuddy (the orchestrator drives workbuddy.ai/app) and exported to
PDF for the submission; the same content as a narrow rail for the live screen.

1. "Who studies by rereading?" + 84% + 80% vs 33% (sources in small print).
2. Real screenshot of the sub-agent cards from a real run + "Agents decide what and when. Code decides
   how. Then they check."
3. Cafe: SOP → course (real shop name if H10 succeeds).
4. Measured numbers from `hackathon/runs/` only: $ + credits per course, wall time, Checker X/20 planted;
   students who tried it + one quote if H11 happened; vanilla WorkBuddy vs BiliMind screenshot pair.
5. "What we built here" (the disclosure in §1.6) + GitHub and deployed links.
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

**WP-S Spike kit** · owner `hackathon/spike/` · depends on nothing · **17:00, ~30 min, then it is run in WorkBuddy (H4)**; skip the questions 0b already answered
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
  role `past_paper`. Live allowance: one 20-token call per provider (DeepSeek direct, and OpenRouter to
  confirm the pinned route), about $0.001.

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
  (one manual import into Google or Outlook, screenshot in STATUS.md); `state.json` has one card per quiz
  item and flashcard with first due dates from the plan; `deck.csv` imports into Anki (manual once); `REPORT.md` counts equal counts recomputed from `log.jsonl`;
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
  its root; esbuild targets node22 and the bundle runs under WorkBuddy's bundled Node 22
  (`~\.workbuddy-ai\binaries`) as well as the system Node 24.

**WP7 Skill, playbooks, install** · owner `skills/bilimind` (SKILL.md, references/, install.ps1, zip script) · draft from ~18:15; **final text only after gate G1 (spike)**
- Acceptance (human-run in WorkBuddy, builder reads the transcript): the hero sentence produces a course
  with zero questions to the user; 4 Writer sub-agents ran in parallel; the Coder and Checker ran; every
  repair decision appears in the transcript in the agent's own words; REPORT.md shows at least one real
  rejection or "beyond your slides" label; `index.html` opens in Preview; no command ever called `run`.

**WP8 Showcase sources** · owner `showcase/sources/{ds-final,bm-survival,boba-day-one}` · depends on nothing · 17:00
- Outputs: each folder with its files and `LICENSE.md` (source URL, licence, attribution text); the MIT
  6.006 lecture-note PDFs and Quiz 1 problems; Wikivoyage Malay phrasebook as Markdown; the sample SOP
  (DOCX or PDF, marked "Sample document") + the FHR 2009 one-pager; a slot for H10 material (a real
  shop's SOP only with written permission). No private student material (0b).
- Acceptance: WP1's ingest reads every file; the past paper is detected; no file without a licence note.
  Downloads are approved by the human through the permission prompt (filename, source, size).

**WP9 Integration, measurement, Checker benchmark** · owner `hackathon/runs/` · depends on WP6, WP7 · from G2
- Work: run the CLI `run` end to end and fix contract breaks with the owners; then WorkBuddy runs of the
  hero (owner at the keyboard, or the orchestrator driving WorkBuddy); per run save `REPORT.md`, wall
  time, text-API cost (ledger) and WorkBuddy credits (read from the app); the benchmark: `plant --n 20` on
  a finished hero course, the Checker agent run on it in WorkBuddy, `plant-score` → "caught X/20, Y false
  alarms"; a hand check of 20 supported verdicts against the slides; the "Wednesday" vs "tomorrow" plan pair.
- Acceptance: 3 consecutive WorkBuddy runs on the venue network, each under the target time, numbers in
  `hackathon/runs/summary.md`; every number on the rail traces to a file there.

**WP10 Review loop wiring** · **CUT (Telegram cut by the owner, 0b).** The schedule work lives in WP4
(`state.json`, `reviews.ics`) and WP5a ("Due today" strip). The P2 Automation needs only `due`/`grade`.

**WP11 Slides (P0, submission needs a PDF made with WorkBuddy, 0b)** · owner `pitch/` · depends on screenshots from WP9 (placeholders before)
- Outputs: the 6 slides of §4.5 produced in WorkBuddy (the orchestrator drives workbuddy.ai/app; feed it
  the cobalt tokens, the 3D objects and the measured numbers), exported as `pitch/BiliMind-Dormathon.pdf`;
  plus `pitch/index.html` with the same content and a `?mode=rail` 480px column for the live screen.
- Acceptance: the PDF opens and reads at 1280x720; rail text at least 28px; every number traces to
  `hackathon/runs/summary.md`; the WorkBuddy task that made the slides is kept as evidence (screenshot).

**WP12 Site = the deployed application link (P0, required by the submission, 0b)** · owner `site/` · depends on showcase courses (G4)
- Outputs: a static site: a landing page adapted from `11-cobalt-landing.html` (problem, the crew, how it
  works in WorkBuddy, honest numbers, what was built here), the three showcase courses playable at
  `/courses/<slug>/` (their `index.html` + `audio/` + `img/` + `sources/` where the licence allows), the
  skill zip for download, install steps, links to the GitHub repo.
- Acceptance: works as a static site and from `file://`; 390px without horizontal scroll; courses play
  (narration, quiz, JS exercise) from the deployed URL; no secrets in any deployed file; the human signs
  in to the host (GitHub Pages, Vercel, Netlify or Cloudflare Pages) and the URL goes into the submission.

**WP13 Film** · owner `film/` · P2 (no video is required in Phase 1, 0b); a raw screen recording of the best run is enough as a backup · depends on raw recordings (H13)
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

**WP15 MCP** · **CUT for the 24-hour build (0b).** `packages/mcp` stays an empty slot.

**WP16 Expert Team plugin (P1; P0 if the spike shows plain-skill sub-agents get no cards)** · owner `plugin/bilimind-team` · per `workbuddy.md` §7.5 and 0b
- Outputs: the plugin package (plugin.json with `expertType: team`, lead + Writer/Coder/Checker agent files
  that point at the same playbooks, `settings.json`, avatars made from the 3D objects), registered into
  `C:\Users\User\.workbuddy-ai\plugins\marketplaces\my-experts\plugins\bilimind-team` with WorkBuddy's own
  `validate_expert.py` and `register_expert.py` (paths in 0b).
- Acceptance: `validate_expert.py` passes; the team appears in My Experts; a run shows member cards for
  Lead, Writer, Coder, Checker and uses the same skill and CLI.

**WP17 Submission package (P0, 0b)** · owner repo root `README.md`, `docs/`, `hackathon/SUBMISSION.md` · depends on G4 · 03:00-06:00
- Outputs: `README.md` (what it is, the one sentence, how the crew works, install the skill in WorkBuddy,
  run it, the three courses, honest numbers, what was built at Dormathon vs reused, licences); docs made
  with WorkBuddy where the rule asks for it; a secrets scan before the repo goes public (`.env.local` and
  any `*.env*` never committed, `git grep` for `sk-or-`, `sk-`, API key patterns, `config.json` keys);
  `hackathon/SUBMISSION.md` with the four required items (public GitHub URL, deployed URL, slides PDF,
  group name + campus branch) ready to paste.
- Acceptance: a fresh clone builds with `pnpm install && pnpm -r build`; the scan finds nothing; the human
  flips the repo to public and submits before 09:00 MYT.

### 5.3 Order, lanes and gates

The event is 24 hours and submission closes Sunday 09:00 MYT in practice (0b), so this is a P0-only
plan with P1 items taken only when a lane is idle. Times are MYT, Saturday 10 → Sunday 11 October.

```
17:00    WP0 contracts ─────────┐      WP-S spike kit ──> spike (orchestrator/owner in WorkBuddy) ──> G1
         WP8 sources ───────┐   │
18:15                      G0 contracts frozen (types, schemas, fixture)
18:15    Lane A  WP1 engine I/O
         Lane B  WP2 outline / exam-map / plan / draft
         Lane C  WP3 validators + agent tools
         Lane D  WP4 tts / review / export / build
         Lane E  WP5a player shell
         Lane F  WP5b blocks (reading/visual)
         Lane G  WP5c blocks (interactive)
         Lane H  WP6 CLI + bundle, WP7 skill draft, WP16 Expert Team draft
~19:30   G1  spike facts in hackathon/SPIKE.md → finalise WP7 shape; plain skill or Expert Team on stage
~22:30   G2  `bilimind run` on the MIT folder → valid course, opens via file:// in Edge with zero errors
~23:30   G3  first full WorkBuddy run of the hero sentence (WP7 acceptance)
00:00    WP9 measurements + Checker benchmark; showcase courses through WorkBuddy; WP12 site + deploy
03:00    G4  three showcase courses committed; numbers in hackathon/runs/; site deployed
03:00    WP11 slides via WorkBuddy → PDF; WP17 README/docs/secrets scan/public repo; WP14 runbook
06:00    Feature freeze (fixes only)
06:00    G5  3 consecutive rehearsal runs under target; pitch rehearsed 3 times with a timer
09:00    SUBMIT (GitHub public URL, deployed URL, slides PDF, group + campus). Pitch 10:00-13:00.
```

Parallelism: 8 builder lanes after G0. Integration is continuous: each lane runs against the fixture
first, then against the CLI. The only hard serial chain is WP0 → (WP1..WP6) → G2 → WP7 final → G3.

Out of the 24-hour build: WP10 (cut), WP13 film beyond a raw recording, WP15 MCP, `.apkg`, Tier B blocks,
Mermaid pre-render, Malay/Burmese narration of the cafe course, the diagnostic, Python. Never drop: the
past-paper plan, the Checker and Coder loops, the receipts slab, citation chips, the deployed link, the
slides PDF, the public repo.

### 5.4 Final verification before G5 (on the demo laptop)

1. Fresh WorkBuddy task, hero sentence, `--no-cache` everywhere: one user message, run finishes, REPORT.md
   numbers recorded.
2. `index.html` from `bilimind-out/` and from USB, Wi-Fi off: home, a lesson, quiz, JS exercise, narration.
3. Stage mode at the projector resolution (ask the venue; test 1280x720 and 1920x1080).
4. The deployed link on a phone (mobile data): a course plays, narration and JS exercise included.
5. Ledger: balance minus reserve still positive after rehearsals; `doctor` green.
6. Phone hotspot run: the same sentence finishes over the hotspot.
7. `scripts/demo-reset.ps1`, then the morning run kept open in a second task.

---

## 6. Budget: text-model APIs and WorkBuddy credits

### 6.1 The real numbers

Three pools (0b). Builder agents (Claude) spend none of them; only engine calls and WorkBuddy runs do.

- **DeepSeek API direct, about $9** (`DEEPSEEK_API_KEY`): the default for every content call
  (`deepseek-flash` for drafts, rewrites and outlines; never `deepseek-v4-pro` without `--allow-expensive`).
  Balance read live from `GET https://api.deepseek.com/user/balance`.
- **OpenRouter, $9.69 account balance** (`/api/v1/credits`: $75.00 bought, $65.31 used; the key's $12.80
  is not the ceiling): fallback for content, images, music, and the BYOK agent model if WorkBuddy credits run out.
- **WorkBuddy credits, about 2,350 on the account** (0b): pay for every agent loop (Lead, Writers, Coder,
  Checker) and for the slides and docs made in WorkBuddy.

Measured unit costs on OpenRouter (`engine-port.md` §7.2, `media.md` §3), deepseek-v4-flash on pinned
providers: lesson draft $0.0011-0.0012 (33 s, reasoning off); outline $0.0016 (63 s, reasoning on); one
quiz-item call $0.00003. DeepSeek direct is priced per token from its own price table; WP1 records the
real per-call cost in the ledger, and WP9 replaces these estimates with measured ones. Planning number:
$0.08 per 4-lesson course with repairs; hard cap $0.25 per run. Narration is free.

### 6.2 Allocation

DeepSeek direct (about $9; adjust the slack to the real balance `doctor` reports):

| Bucket | Cap | Covers |
|---|---|---|
| **Demo-day reserve (locked)** | **$3.00** | Morning run, stage run, retries, spare runs. The ledger refuses calls that would cross it unless `BILIMIND_DEMO_DAY=1` |
| Engine development | $0.75 | WP1-WP4 live allowances (§5.2), prompt fixes |
| CLI regression runs | $0.50 | 6-8 full `run` courses during integration |
| Showcase courses through WorkBuddy | $0.75 | 3 courses x up to 3 runs |
| Rehearsal runs | $0.75 | At least 6 hero runs before G5 |
| Checker benchmark, rewrites | $0.30 | |
| Slack | rest (~$2.95) | |

OpenRouter ($9.69):

| Bucket | Cap | Covers |
|---|---|---|
| **Fallback reserve (locked)** | **$4.00** | Used only if DeepSeek direct fails on demo day (`BILIMIND_PROVIDER=openrouter`) |
| BYOK agent model (only if WorkBuddy credits run out) | $2.50 | A separate OpenRouter key with a $2.50 key limit (H6), model `anthropic/claude-haiku-5.5`; about 1.5M input tokens per full crew run, so $0.20-0.40 per run |
| Fallback content runs | $1.00 | If the DeepSeek pool is exhausted before demo day |
| Optional images (extra 3D objects or avatars for the Expert Team, never text) | $0.50 | At most 12 images on a nano-banana-class model; the existing `img/11/obj-*.webp` and `cafe.webp` come first |
| Optional music (one Lyria clip for the site) | $0.10 | |
| Slack | $1.59 | |
| **Total** | **$9.69** | |

WorkBuddy credits (about 2,350): the spike measures credits for one 4-lesson crew run (plain skill) and
one Expert Team run (documented at 3-5x a single expert). Keep at least 600 credits untouched for Sunday
morning (morning run + stage run + a spare). If a crew run costs C credits, the build may use at most
(2,350 - 600) / C runs for showcases, the benchmark and rehearsals; the slides and docs come out of the
same pool, so budget them first (about 100-200 credits).

### 6.3 Rules that keep it true

1. Every content call goes through `llm.ts`. On OpenRouter: `require_parameters: true` and
   `max_price {prompt 0.2, completion 0.4}`, so routing never lands on the $1.28/M-output endpoints.
2. No `deepseek-v4-pro`, no image or music model, without `--allow-expensive`.
3. Caps in code: $0.25 per course run, $2.00 per day, and the per-provider floors above. `doctor` prints
   provider, balance, reserve and today's spend; run it at the start of every session and before every rehearsal.
4. Cache during development (re-building a course after a player change costs $0); `--no-cache` only for
   measured runs and on stage.
5. Never use DeepSeek through OpenRouter as the WorkBuddy BYOK agent model: WorkBuddy cannot send our
   provider pin, so it could land on a $1.28/M-output route. Use `anthropic/claude-haiku-5.5` there.
6. Checkpoints: if WorkBuddy credits fall under 1,200 before G4, stop rehearsal runs until the showcase
   courses are committed; under 800, only the final rehearsal and the stage runs remain.

### 6.4 Recording costs

Every measured run writes its text-API dollars (ledger) and WorkBuddy credits (read from the app before
and after) to `hackathon/runs/<time>/`, because a judge will ask what a run really costs.

---

## 7. What the human (Oybek and team) must do

We cannot sign in, set system settings, create bots or accept terms for you. Each item says when it
blocks something.

| # | Task | When | Time | Unblocks |
|---|---|---|---|---|
| H1 | Windows Settings → Time & language → Date & time → "Set time automatically" ON → Sync now (the clock is still ~8 h slow, 0b; the TTS fix covers narration, but sign-in and request signing may still break) | Now | 1 min | Fewer surprises |
| H2 | ~~Get the real organiser slides~~ Done (0b) | | | |
| H3 | ~~Install WorkBuddy and sign in~~ Done (0b: skills dir and expert scripts verified). Check the settings: English, Compact Mode OFF, Prevent Sleep ON, Auto-install non-high-risk skills ON | Now | 5 min | Demo |
| H4 | Spike: the remaining questions below (sub-agent cards, Preview, credits per run, permission prompts). The orchestrator can drive it; the owner approves prompts | 17:30-19:30 | 45 min | G1, WP7 final |
| H5 | Credits: ~2,350 on the account (0b). Watch the checkpoints in §6.3; buy a top-up only if the spike shows a crew run costs more than ~150 credits (owner decides) | After H4 | 5 min | Rehearsals |
| H6 | Keys: `DEEPSEEK_API_KEY` (default) and `OPENROUTER_API_KEY` visible to WorkBuddy's shell (`setx`, then fully restart WorkBuddy) or `%USERPROFILE%\.bilimind\config.json`. Optional: a second OpenRouter key "workbuddy-agents" with a $2.50 limit for the BYOK agent model (`anthropic/claude-haiku-5.5`, tool calling ticked) | After H4 | 10 min | G3 |
| H7 | Install the skill: run `install.ps1` (copies to `C:\Users\User\.workbuddy-ai\skills\bilimind\`), confirm it shows in Skills; P1: register the Expert Team (WP16) | At G2 | 10 min | G3 |
| H8 | ~~Telegram~~ Cut (0b) | | | |
| H9 | ~~Hero material choice~~ Decided (0b): public MIT OCW material only | | | |
| H10 | Small business (optional): one real shop near Taylor's (cafe, boba, dorm canteen) gives its SOP or menu sheet with written permission; else the labelled sample | By 01:00 | 30 min | Course B, slide 3 |
| H11 | Real users (optional, if anyone is awake): 2-3 students at the venue try the hero course for 5 minutes; "would you use it before your next exam?" + one quote with consent | 00:00-03:00 | 30 min | Slide 4 |
| H12 | Write two true sentences for the personal hook | Before 06:00 | 10 min | Pitch |
| H13 | OBS screen recording of the best full run (backup only) | After G4 | 15 min | §4.4 |
| H14 | Decide who presents and who drives; Q&A owners (team decides) | Before 06:00 | 10 min | RUNBOOK |
| H15 | A Malaysian friend checks the Malay course phrases | After G4 | 20 min | Course C in Q&A |
| H16 | Run the hero sentence once in WorkBuddy WITHOUT the skill; keep a screenshot of its output | After H4 | 10 min | Slide 4 |
| H17 | Rehearse: 3 consecutive runs plus one on the phone hotspot; the 3-minute pitch 3 times with a timer | 06:00-08:30 | 2 h | G5 |
| H18 | Sign in to the static host (GitHub Pages, Vercel, Netlify or Cloudflare Pages) so the site can deploy; flip the GitHub repo to PUBLIC after the secrets scan (WP17) | 00:00-06:00 | 15 min | Submission |
| H19 | Submit: public GitHub URL, deployed URL, slides PDF, group name + campus branch | **Before 09:00 Sunday** | 10 min | Everything |

### 7.1 Spike questions (H4) and what each answer changes

| # | Question | If yes | If no |
|---|---|---|---|
| S1 | Answered (0b): skills live in `C:\Users\User\.workbuddy-ai\skills\<name>\` and use `${CODEBUDDY_SKILL_DIR}`. Still confirm the substitution in one real run | SKILL.md uses it | `install.ps1` writes the absolute path into the installed SKILL.md |
| S2 | Does the workspace `.codebuddy\skills\` copy load in Work mode? | Keep both copies | Upload only |
| S3 | Which shell runs commands (PowerShell or Git Bash)? Is `node` on PATH? (WorkBuddy bundles Node 22 in `~\.workbuddy-ai\binaries`, 0b; our bundle must run on Node 22) | | Quote rules in SKILL.md adjusted; full path to node.exe |
| S4 | Do 3 parallel Agent sub-agents from a plain skill show as cards? | Plain skill is the stage version | Try `.codebuddy/agents/*.md` custom agents; if still no cards, WP16 Expert Team becomes P0; if nothing parallel renders, run Writers one by one and cap the live run at 3 lessons |
| S5 | Does TaskCreate render as a ticking checklist? | Use it | The Lead ticks a checklist in `plan.md`, shown in Preview |
| S6 | Credits for a 4-lesson crew run (plain skill) and for an Expert Team run; is a custom model selectable on this account? | | Budget decisions in §6.2 |
| S7 | Preview panel: does the test page play mp3, run a Blob worker, keep localStorage, open `#page=` links? | Course opens in Preview on stage | Open in Edge on stage |
| S8 | Permission prompts for scripts and network; does Full Access for one folder silence them? | Full Access in `C:\Demo\` only | Pre-approve each command type in rehearsal |
| S9 | Are `DEEPSEEK_API_KEY` / `OPENROUTER_API_KEY` visible to the skill's shell after a restart? | | `%USERPROFILE%\.bilimind\config.json` |
| S10 | Does the Artifact tool publish an HTML share link? | "Share with your study group" beat (P1) | Skip |
| S11 | ~~Telegram loop~~ Cut (0b) | | |
| S12 | Is the CodeBuddy CLI usable on this plan (International login, headless `-p`)? | Scripted regression runs in WP9 | WP9 uses WorkBuddy only |
| S13 | Exact English UI labels (Skills, Experts, Automation, Assistant, Results panel tabs) | Into RUNBOOK and the script | |

---

## 8. Risks and fallbacks

| # | Risk | Likelihood | Fallback / mitigation |
|---|---|---|---|
| R1 | Missing the 09:00 submission (24-hour event, 0b) | Medium | Timeline in §5.3 with feature freeze at 06:00; WP17 prepares the four items by 06:00; H19 submits by 09:00 even if polish is unfinished |
| R1b | Judges penalise pre-existing code | Low-medium | Disclosure line and slide 5; repo history shows what was built at the event; the reused part is prompts and rules, not running code |
| R1c | A secret leaks when the repo goes public | Low, severe | `.gitignore` already excludes `.env.*`; WP17 secrets scan before flipping to public; keys never in the skill, the site or course folders |
| R1d | Deployed link fails or a course does not play from it | Medium | WP12 acceptance on the real URL from a phone; fallback host; courses are static files with no server |
| R2 | Plain-skill sub-agents do not render as cards | Medium | S4 ladder: custom agents → Expert Team plugin → sequential agents with a 3-lesson live cap |
| R3 | Live run too slow for the slot (outline 63 s, lessons 33-60 s each, plus agent overhead and repair rounds) | High | 4-lesson cap from capacity math; press Enter during setup when p90 > 4:30; morning run of the identical sentence; never show a spinner for more than 10 s |
| R4 | WorkBuddy credits (~2,350) run out during rehearsals or slide-making | Medium | 600-credit floor for Sunday; checkpoints in §6.3; BYOK `claude-haiku-5.5` from the $2.50 OpenRouter bucket |
| R5 | DeepSeek or OpenRouter balance drained | Low (code caps) | Per-provider floors in the ledger; cached development; switch provider with `BILIMIND_PROVIDER` |
| R6 | Campus Wi-Fi (FortiGate) blocks something on the day | Medium | Nothing installs at demo time; npmmirror; phone hotspot tested (§5.4 step 6); offline course folders on USB |
| R7 | Clock skew breaks sign-in or TTS | High until H1 | H1; the skew fix in `tts.ts` regardless; all showcase narration pre-rendered |
| R8 | Edge TTS endpoint changes or rate-limits | Low | Showcase audio already rendered and shipped in the folders; narration failure leaves the transcript and is logged, never blocks the build |
| R9 | No genuine Checker rejection in a given run | Medium | Real rejections are common on cheap no-reasoning drafts; keep every run's verdicts in `hackathon/runs/`; show a saved real one; never fake |
| R10 | The Checker is wrong (false alarm or misses) | Medium | Measured with planted errors and a 40-item hand check; the claim matches the measurement; "beyond your slides" label instead of a silent pass |
| R11 | A 5-minute crew run does not fit a 3-minute slot | Certain | Press Enter at setup and say so; show the live run in flight and the morning run's finished course (§4.2) |
| R12 | The singlefile player breaks on `file://` (module script, worker) | Low | WP5a's first test of the day; IIFE output; classic Blob workers (verified working in `media.md` §4) |
| R13 | Preview panel cannot play audio or run workers | Low-medium | S7; open in Edge |
| R14 | Past-paper parsing fails on a real paper's layout | Medium | Regexes for "Question N", "QN", "Problem N", "[N marks]", "(N points)"; the Lead reads `exam-map.md` and fixes matches with `--assign`; if a paper cannot be parsed, the plan says so and weights by slide coverage |
| R15 | Scanned slides or very thin slides | Medium | Ingest reports scanned pages (no OCR); thin topics flagged in `plan.md` ("your slides say little about X"); demo on text-based slides |
| R16 | Machine-translated safety steps (cafe P1) | Medium | Disclaimer on page one; a fluent check if possible; English-only cafe course is the P0 |
| R17 | Answer keys visible in devtools in an offline single file | Certain | Say so honestly if asked; keys never in the DOM before submit |
| R18 | Judges read it as "WorkBuddy already has student experts" | Medium | §1.6 answer + H16 vanilla clip + the receipts slab |
| R19 | Story too dense for 3 minutes | High | One user, one stat, one before/after, three things named aloud (the plan, the rejection, the course); every other feature only if a judge asks |
| R20 | A builder lane slips | High (some lane will) | Fixture-first lanes are independent; the 24-hour cut list in §5.3; the P0 cross-cutting items and the Checker/Coder loops are protected, polish is not |
| R21 | Licensing of showcase sources | Low | MIT OCW CC BY-NC-SA and Wikivoyage CC BY-SA with attribution in footers; private slides never committed or published |

---

## 9. Decisions still open (owner, deadline)

- Plain skill vs Expert Team for the stage: S4 and S6 (cards and credits), at G1 (~19:30).
- Top-up or BYOK for agents if credits run short: H5, after the spike.
- Real shop for course B: H10, by 01:00, else the labelled sample.
- Static host for the deployed link: H18, by 00:00.
- Who presents and drives: H14, by 06:00.
