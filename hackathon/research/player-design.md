# BiliMind course player: cobalt design spec

The player is the thing a student actually opens at the end of the WorkBuddy run: one
`index.html` per course, double-clicked from the delivered folder, data embedded, audio and
images in sibling folders. It is the "deliverable" judges see, so it must look like a premium
product within three seconds and prove the agents did real, checked work.

Companion file: `hackathon/research/cobalt-tokens.css` (all tokens, density variants, base
patterns; inline it first). Every CSS snippet below uses those tokens.

Sources read for this spec: `plan/reference/design/hero-v7/11/{base.css, page.css, story.css,
shell.html, sprite.html, parts/checks.html, parts/formats.html}`, `shots/*.png`,
`img/11/obj-*.webp`, `plan/context/{bilimind-hero-v7, bilimind-chosen-design-direction,
bilimind-course-is-a-path, bilimind-not-an-admin-panel}.md`, `plan/research/{des-cobalt,
inv-workspace (UI-48..62), inv-blocks (§2-3)}.md`, `frontend/app/components/{blocks,
assessments, workspace/Roadmap.vue}`.

---

## 0. TL;DR: the decisions

1. **Two screens, one file.** Course home (`#/`) and lesson (`#/l/<id>`), hash-routed, plus a
   completion overlay. No login, no settings page, no dashboard, no sidebar of admin links.
2. **The home is a cobalt hero slab + a path on a dotted canvas**, exactly the landing's
   grammar (ink milestones on a spine, white subtopic badges on dotted ties, lime/cobalt/grey
   marks, amber mentor notes, chapter pills on the line, a finish pill). The path IS the
   navigation. A thin study-plan strip sits between them: days until the exam.
3. **A "Checked before you saw it" ink slab** on the home shows the agents' receipts: files
   read, lessons written in parallel, code tests run, quiz answers verified against the source
   pages, minutes of narration. This is the judges' "validation and quality control" made
   visible inside the deliverable, and it is not a dashboard: one sentence and six numbers.
4. **The lesson is a reading column with a floating ink narration dock** (lime play button,
   waveform that fills lime, speed chip). The sentence being read gets a lime marker, and the
   column follows along. A table of blocks on the left (desktop) becomes a "3/8 ▾" pager on
   phones.
5. **Blocks have three frames**: prose (no frame), card (white, hairline, r22), stage (ink:
   code, flashcard backs, speaking). Lime appears in a block only as "do this" (the task dot)
   or "you did it" (correct, passed). That restraint is what makes the lime moments land.
6. **Citations are chips** (`L4 · p.12`) that open a popover with the quoted source passage
   and a link to `sources/<file>.pdf#page=12`. Every quiz explanation carries one.
7. **Completion is a moment, not a toast**: finishing a lesson sends you back to the path and
   a lime run travels the spine to the next milestone; finishing the course raises a cobalt
   slab with the 3D trophy (`img/11/obj-trophy.webp`) and confetti in the four lights.
8. **Offline-first, file:// safe**: no CDN at runtime, no `fetch`, no ES modules, Blob workers
   for code, fonts and objects embedded as data URIs, Mermaid pre-rendered to SVG at build
   time. Two features need more than file:// (Python via Pyodide, speech scoring); both
   degrade gracefully and both work when the folder is opened via `http://localhost`.
9. **Three hero skins keep demo courses visually distinct inside one system**: `cobalt`
   (default, exam prep), `ink` (code courses), `lime` (small-business onboarding). Each course
   also gets its own 3D object and two inline heading chips chosen from its dominant formats.
10. **Stage mode** (`P` key, `data-density="stage"`) scales the whole player ~12% for the
    projector. Build it; it costs ten lines and saves the demo.

---

## 1. What "one offline HTML file" forces (read before building)

### 1.1 file:// facts that shape the design

| Need | What works under file:// (Chrome/Edge, which is what the demo laptop runs) | Decision |
|---|---|---|
| Course data | `fetch('course.json')` is blocked (origin `null`). `<script src="course.js">` (classic) works. | Data embedded in index.html as `<script id="course-data" type="application/json">`. Large courses may split per lesson into `data/l03.js` classic scripts that call `BM.add({...})`. |
| JS modules | `<script type="module" src>` from file:// is blocked by CORS. | One inlined classic `<script>` (IIFE). No bundler output with `import()`. |
| Web Workers | `new Worker('w.js')` from file:// fails. `new Worker(URL.createObjectURL(new Blob([src])))` works. | JS/SQL runners are Blob workers built from inline source strings. |
| Fonts | Relative `@font-face` urls are inconsistent across browsers on file://. | Embed woff2 as data URIs (latin subsets, ~170 KB total). |
| Images, audio | `<img src="img/x.webp">`, `<audio src="audio/l03.mp3">` work. | Sibling folders. The 3D objects (~450 KB for all ten) are referenced, not embedded, except the trophy and the course's own object which are embedded so the first paint is complete. |
| Web Audio analyser on a file:// `<audio>` | The element is cross-origin tainted; the analyser returns silence. | Waveform and orb are driven by a **precomputed peaks array** the generator writes (ffmpeg, 20 values/s). |
| Mermaid | mermaid.min.js is ~3 MB and renders after paint (flash). | **Pre-render to SVG at build time** and inline the SVG. Fallback: ship `lib/mermaid.min.js` (UMD, classic script) and render with the theme in §5.4. |
| Python (Pyodide) | Needs to download wasm + stdlib. A Blob worker can `importScripts('https://cdn.jsdelivr.net/pyodide/v0.27.2/full/pyodide.js')` when online (0.27.2 and sql.js 1.14.1 are the versions the SaaS sandbox pins in `frontend/app/sandbox/protocol.ts:102-105`). | Online only. Run button shows "Loading Python (once, ~7 MB)". Offline: "Python needs internet the first time. JavaScript and SQL exercises run offline." Demo course should use JS or SQL for the live run, or pre-warm. |
| SQL (sql.js) | wasm fetch is blocked, but `initSqlJs({ wasmBinary })` with bytes decoded from base64 works. | Ship `lib/sql-wasm.js` (classic, contains the base64 wasm, ~900 KB) only in courses that have SQL blocks. |
| Speech recognition (`webkitSpeechRecognition`) | **Not available on file://** (Chrome blocks it; needs http(s) or localhost). | Speaking drill degrades to "record and compare" (play yours, play native) on file://, and scores words when opened via `http://localhost`. The WorkBuddy run can finish with "Open course" pointing at a tiny local server; the double-click path still works for everything else. |
| Microphone (`getUserMedia`) | Expect a permission prompt; behaviour on file:// varies by browser version. **Test on the demo laptop on day one.** | Record button handles `NotAllowedError` with a one-line message, never a broken state. |
| localStorage | Works; all file:// pages may share one origin. | Every key is namespaced: `bm:<courseId>:<key>`. Wrap every read/write in try/catch. |
| PDF page links | `sources/lecture-4.pdf#page=12` opens Chrome's viewer at that page from file://. | Citations link to PDFs. Slide decks (.pptx) are converted to PDF by the engine so the same link works. |

### 1.2 Folder the engine delivers (the player's view of it)

```
Data-Structures-Final/
  index.html                 # the player: tokens + CSS + JS + course data + sprite inlined
  course.md / lessons/*.md   # Obsidian vault (not read by the player)
  deck.apkg, plan.ics        # exports, linked from the home footer
  audio/l03.mp3 ...          # one narration file per lesson (+ per speaking phrase)
  img/obj-*.webp             # 3D objects; img/fig-*.webp generated illustrations (no text)
  sources/*.pdf              # the student's own files (copied or converted), for citations
  lib/sql-wasm.js            # only when the course has SQL exercises
```

### 1.3 Data contract the player reads (align with `engine-port.md`)

Keep field names identical to the SaaS where they exist (block `type`/`payload` as in
`inv-blocks.md §3`), so the engine can reuse BiliMind's block schemas verbatim.

```jsonc
{
  "id": "ds-final-1014", "title": "Data Structures Final", "skin": "cobalt",      // cobalt | ink | lime
  "object": "img/obj-book.webp", "chips": ["i-code", "i-tree"],                     // heading chips
  "goal": "Pass the CSC2103 final on Friday", "examAt": "2026-10-17T09:00",
  "language": "en", "builtAt": "2026-10-13T21:40",
  "receipts": { "files": 3, "pages": 142, "lessons": 31, "agents": 4, "tests": 42, "testsPassed": 42,
                "quizChecked": 96, "quizFixed": 7, "narrationMin": 162, "cards": 88, "minutes": 410 },
  "sources": [{ "id": "s1", "title": "Lecture 4 · Trees", "file": "sources/lecture-4.pdf", "pages": 38 }],
  "plan": [{ "date": "2026-10-14", "items": ["l01", "l02"], "review": 0 }, { "date": "2026-10-17", "exam": true }],
  "path": [                                                                          // courseTree() output, flattened
    { "id": "t1", "kind": "topic", "step": 1, "title": "Arrays and big-O", "section": "Foundations",
      "lesson": "l01", "minutes": 14, "note": "Everything later is measured in big-O. Do not skip.",
      "items": [{ "id": "s1a", "title": "Amortised cost", "mark": "recommended", "lesson": "l02", "group": null, "children": [] }] }
  ],
  "lessons": {
    "l01": { "title": "Arrays and big-O", "archetype": "conceptual", "minutes": 14,
             "narration": { "src": "audio/l01.mp3", "duration": 312.4,
                            "cues": [{ "s": "b1.3", "t": 12.48, "d": 3.2 }],   // sentence id, start, duration (s)
                            "peaks": "base64 Uint8, 20/s" },
             "blocks": [{ "id": "b1", "type": "explainer", "title": "Why arrays are fast",
                          "payload": { "markdown": "..." }, "cites": [{ "src": "s1", "page": 12, "quote": "..." }] }] }
  }
}
```

The renderer wraps every sentence of narrated prose in `<span class="s" data-s="b1.3">` at
render time, using the same sentence splitter the engine used to build the TTS script (ship
the splitter as one shared function in both). Cue `s` ids are `blockId.sentenceIndex`.

---

## 2. The design language, as it applies to the player

What carries over from the cobalt landing unchanged:

- **Slabs**: full-width rounded cards inset by `--gut`, r36, cobalt gradient with two blurred
  light beams and an overlay grain. One slab at the top of each screen; never stack two
  cobalt slabs.
- **Display type**: Space Grotesk 700, uppercase, `-0.045em`, line-height 0.9, with **inline
  chips** (`.hchip`, cap-height circles holding an icon, or `.hchip.pill` holding a word).
  Sentence-case Space Grotesk 600 for block titles; Inter for everything you read.
- **Lime carries ink**. It is the "go" (Start, Run, Record, Easy) and the "done" (passed,
  correct, finished). Cobalt is the brand and the "alternative" mark. Ink is the primary
  button, the milestone, the code stage. Coral is only "wrong" and "recording".
- **The dotted canvas with node cards and dashed connectors** is the course itself (the path)
  and, in miniature, the lesson's table of blocks.
- **Glossy 3D objects** (`img/11/obj-{book,mic,cap,check,calendar,globe,docs,rocket,trophy}.webp`,
  25-60 KB each) break out of slab edges with `drop-shadow(0 30px 40px rgb(5 10 60 / .35))`.
  One per hero; the trophy is reserved for the completion moment. Never reuse the hero's
  object elsewhere on the same screen (user correction, hero-v7 round 3).
- **Icons**: the landing sprite (`11/sprite.html`, one 2px stroke family, 58 symbols). Inline it
  once and use `<svg><use href="#i-quiz"/></svg>`. The player needs: `i-play i-pause i-mic
  i-speaker i-code i-quiz i-cards i-steps i-list i-flow i-sliders i-table i-time i-scales
  i-bulb i-warning i-spark i-check i-x i-arrow i-back i-chev i-down i-ext i-file i-book
  i-path i-target i-flame i-bell i-cal i-link i-image i-timer i-tree i-wand mark`.

Product rules the player must respect (from `plan/context`):

- **Not an admin panel**: no internal words on screen (node, block, payload, archetype,
  stub, tier, chunk). Learner words only: lesson, step, part, check, card, "An idea to get".
  Mono type means code, never a duration or a count. One primary action per row.
- **A course is a path**: one solid line of topics; subtopics hang off with dotted ties and a
  mark (Recommended = our pick, Alternative = pick this or the lime one, Anytime = order not
  strict). Only the solid spine means "next".
- **Format follows pedagogy**: the block mix differs per lesson because the archetype
  differs. The player shows that difference (format icons on path nodes and in the table of
  blocks) instead of flattening every lesson into one template.
- **Generated images never contain text**: labels are DOM pins over the picture.
- **Simplicity on the surface, not in the content**: lessons stay full; the chrome stays quiet.

### 2.1 Learner words for archetypes (the lesson's kind tag)

From `parts/formats.html` tabs, extended:

| archetype | tag text | icon | 3D object in the lesson head |
|---|---|---|---|
| procedural | A skill you do | `i-steps` | obj-check |
| conceptual | An idea to get | `i-bulb` | obj-book |
| factual | Stuff to memorise | `i-cards` | obj-docs |
| discriminative | Two things you mix up | `i-scales` | obj-globe |
| quantitative | Numbers to feel | `i-sliders` | obj-calendar |
| communicative | Said out loud | `i-mic` | obj-mic |
| spatial | A picture to read | `i-image` | obj-globe |
| diagnostic | A problem to diagnose | `i-target` | obj-check |
| evolutionary | How it got here | `i-time` | obj-calendar |
| performance | Something to make | `i-rocket` | obj-rocket |
| safety_critical | Get it right first time | `i-warning` | obj-check |

### 2.2 Hero skins (visual variety across demo courses, one system)

| skin | slab | heading accent | primary button | object | use for |
|---|---|---|---|---|---|
| `cobalt` | `--cobalt-grad` + beams + grain | `.lime` words, lime chips | lime pill | book / cap | exam prep (default) |
| `ink` | `--ink-grad` + `--dots-on-cobalt` at 40% | `.lime` words, cobalt chips | lime pill | docs / rocket | code courses (looks like the code stage) |
| `lime` | `--lime-grad` | ink words, one `.cob` word, `.hchip.cobalt` chips | ink pill with lime arrow | check / globe | small-business onboarding, SOPs |

Everything below the hero is identical across skins.

---

## 3. Course home (`#/`)

Top to bottom: top bar, hero slab, study-plan strip (straddling the hero's bottom edge), the
path on a dotted canvas, the "Checked before you saw it" ink slab, sources, footer with
exports. On a 1440x900 screen the hero and the plan strip fill the first viewport; the path
starts one scroll below.

### 3.1 Top bar

Sticky, 64px, transparent at the top, frosted once you scroll (`page.css .nav.scrolled`),
hides on scroll down and returns on scroll up (`.nav.away`).

Left: brand mark (30px `#mark`) + "BiliMind" (Space Grotesk 600 20px) + an ink tag "Made with
WorkBuddy" (lime spark dot). Right: course progress ring (36px, lime-2 arc on `--fill-2`,
percentage beside it) and a `Sources` square button. Nothing else.

```css
.tb { position: sticky; top: 0; z-index: var(--z-sticky); height: var(--topbar-h); display: flex; align-items: center; gap: 12px; padding: 0 calc(var(--gut) + 12px); transition: transform .4s var(--ease-out), background .3s, box-shadow .3s; }
.tb.scrolled { background: rgb(236 238 242 / 0.8); -webkit-backdrop-filter: blur(16px) saturate(1.5); backdrop-filter: blur(16px) saturate(1.5); box-shadow: 0 1px 0 var(--line); }
.tb.away { transform: translateY(-102%); }
.tb .brand { display: inline-flex; align-items: center; gap: 10px; font: 600 20px/1 var(--display); letter-spacing: -0.02em; }
.tb .brand svg { width: 30px; height: 30px; flex: none; }
.tb .made { display: inline-flex; align-items: center; gap: 7px; height: 28px; padding: 0 11px 0 5px; border-radius: 99px; background: var(--ink); color: #fff; font: 600 12px/1 var(--body); }
.tb .made i { width: 18px; height: 18px; border-radius: 50%; background: var(--lime); color: var(--ink); display: grid; place-items: center; }
.tb .grow { flex: 1; }
@media (max-width: 520px) { .tb { gap: 8px; } .tb .made .long { display: none; } }   /* "Made with WorkBuddy" -> "WorkBuddy" */
/* progress ring: conic arc masked to a ring; the % label is a sibling, not a child */
.ringp { --p: .12; width: 36px; height: 36px; border-radius: 50%; background: conic-gradient(var(--lime-2) calc(var(--p) * 1turn), var(--fill-2) 0); -webkit-mask: radial-gradient(closest-side, transparent 70%, #000 71%); mask: radial-gradient(closest-side, transparent 70%, #000 71%); }
```

### 3.2 Hero slab

```
+--------------------------------------------------------------------------+
| (* Built from 3 of your files · last night)                [3D object]   |
| DATA (o code) STRUCTURES                                   ( Grounded in |
| FINAL [4 DAYS]                                               your slides)|
| Your CSC2103 final is Friday. Nine steps, read out loud,   ( Code that   |
| checked against your own lecture slides.                     runs )      |
| 31 lessons | 6h 50m | 42 checks | 88 cards                               |
| [ Start the path  (->) ]   (>) Hear the plan · 0:48        ( Exam Fri 17)|
+--------------------------------------------------------------------------+
   [Mon 13] [Tue 14 TODAY] [Wed 15] [Thu 16] [Fri 17 EXAM]  (Calendar) (Anki)
```

- Grid `minmax(0, 57%) minmax(0, 43%)` (the landing hero's split). Height
  `clamp(560px, calc(100svh - var(--topbar-h) - 120px), 880px)` so the plan strip peeks.
- **Eyebrow** `.eb.on-dark`: "Built from 3 of your files · last night" (from `receipts`).
- **Title**: `.display.hero`, uppercase. The renderer inserts one `.hchip` after the first
  word (icon = `chips[0]`) and, when there is an exam date, a `.hchip.pill` at the end with
  the countdown ("4 DAYS", "TOMORROW", "TODAY"). Titles over 26 characters get `.long`
  (`clamp(40px, 5.6vw, 96px)`). Max 3 lines on desktop; `text-wrap: balance`.
- **Lede**: the goal rewritten by the engine as one sentence (≤ 140 characters).
- **Stats**: four numbers in Space Grotesk 700, labels 13px `--on-cobalt-2`, 1px dividers
  `rgb(255 255 255 / .18)`. Numbers, no adjectives (the landing's numbers section).
- **Actions**: lime `.pill.lg` "Start the path" (becomes "Continue · Step 3, Trees" once there
  is progress) + the **narrator orb** "Hear the plan · 0:48" (a 60-second spoken overview the
  engine writes and records; pressing it and hearing the course talk back in a natural voice
  is the strongest ten seconds of the demo).
- **Object**: the course object, `width: min(44vw, 560px)`, breaking out of the slab top by
  ~6%, rotated -8deg, drifting 10px on a 6s alternate loop (transform only). Three floating
  tags (`page.css .obj-stage .tag`: white 93%, blur 10px, 42px tall) with real facts:
  "Grounded in your slides", "Code that runs", "Exam · Fri 17 Oct".

```css
.c-hero { display: grid; grid-template-columns: minmax(0, 57%) minmax(0, 43%); min-height: clamp(560px, calc(100svh - var(--topbar-h) - 120px), 880px); }
.c-hero .copy { position: relative; z-index: 3; min-width: 0; padding: clamp(32px, 5vh, 64px) 20px clamp(80px, 10vh, 112px) var(--pad-x); display: flex; flex-direction: column; justify-content: center; gap: clamp(16px, 2.4vh, 26px); }
.c-hero .display.hero.long { font-size: clamp(40px, 5.6vw, 96px); }
.c-stats { display: flex; flex-wrap: wrap; row-gap: 14px; margin: 4px 0 0; padding: 0; list-style: none; }
.c-stats li { display: grid; gap: 6px; padding: 0 22px; box-shadow: inset 1px 0 0 rgb(255 255 255 / 0.18); }
.c-stats li:first-child { padding-left: 0; box-shadow: none; }
.c-stats b { font: 700 clamp(28px, 2.7vw, 44px)/0.9 var(--display); letter-spacing: -0.04em; font-variant-numeric: tabular-nums; }
.c-stats span { font-size: 13px; color: var(--on-cobalt-2); }
.slab.lime .c-stats span { color: rgb(11 13 16 / 0.62); }
.slab.lime .c-stats li { box-shadow: inset 1px 0 0 rgb(11 13 16 / 0.14); }
.slab.lime .c-stats li:first-child { box-shadow: none; }
.c-acts { display: flex; align-items: center; flex-wrap: wrap; gap: 14px 22px; }
.c-hero .stage { position: relative; z-index: 2; pointer-events: none; }
.c-hero .obj { position: absolute; right: 4%; top: -6%; width: min(44vw, 560px); transform: rotate(-8deg); filter: var(--drop-obj); animation: drift 6s ease-in-out infinite alternate; }
@keyframes drift { to { translate: 0 -10px; rotate: 2deg; } }
.c-hero .ftag { position: absolute; z-index: 4; display: inline-flex; align-items: center; gap: 10px; height: 42px; padding: 0 18px 0 7px; border-radius: 99px; background: rgb(255 255 255 / 0.93); color: var(--ink); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); box-shadow: var(--sh-tag); font-size: 14.5px; font-weight: 600; white-space: nowrap; }
.c-hero .ftag i { width: 28px; height: 28px; border-radius: 50%; background: var(--cobalt); color: #fff; display: grid; place-items: center; }
.c-hero .ftag.t2 i { background: var(--lime); color: var(--ink); }
.c-hero .ftag.t1 { left: 2%; top: 56%; } .c-hero .ftag.t2 { right: 7%; top: 20%; } .c-hero .ftag.t3 { right: 10%; bottom: 16%; }
```

**Narrator orb** (hero and lesson head). The ring breathes on the precomputed peaks, so it
works on file:// where a Web Audio analyser on an `<audio>` element returns silence.

```css
.orb { position: relative; display: inline-flex; align-items: center; gap: 14px; color: inherit; text-align: left; }
.orb .core { position: relative; width: 60px; height: 60px; border-radius: 50%; display: grid; place-items: center; background: var(--ink); color: #fff; box-shadow: var(--sh-play); transition: transform var(--d-press), background var(--d-fast); }
.orb .core svg { position: relative; z-index: 1; width: 18px; height: 18px; margin-left: 3px; }
.orb .core::after { content: ""; position: absolute; inset: -6px; border-radius: 50%; border: 1.5px solid rgb(255 255 255 / 0.35); animation: ring 2.6s ease-out infinite; }
.orb:hover .core { transform: scale(1.06); }
.orb .lbl b { display: block; font-size: 15px; font-weight: 600; }
.orb .lbl small { font-size: 13px; color: var(--on-cobalt-2); }
.orb.on .core { background: var(--lime); color: var(--ink); }
.orb.on .core svg { margin-left: 0; }
/* JS writes --a (0..1) from peaks[] every animation frame while playing */
.orb.on .core::after { animation: none; border-color: rgb(198 242 78 / 0.6); transform: scale(calc(1.05 + var(--a, 0) * 0.35)); opacity: calc(0.35 + var(--a, 0) * 0.65); }
.orb.on .core::before { content: ""; position: absolute; inset: -18px; border-radius: 50%; background: radial-gradient(closest-side, rgb(198 242 78 / 0.38), transparent); transform: scale(calc(0.8 + var(--a, 0) * 0.5)); }
.slab.lime .orb .core::after { border-color: rgb(11 13 16 / 0.25); }
.slab.lime .orb .lbl small { color: rgb(11 13 16 / 0.62); }
```

### 3.3 Study-plan strip

A row of day cards that **straddles the hero's bottom edge** (`margin-top: -56px`, above the
slab), the way the landing's lime ticker covered a seam. In one glance: today, how much,
where the exam is.

- One card per day from today to the exam (7 visible, the rest scroll with snap).
- Card: white, r18, hairline + `--sh-card`, 148px wide. Eyebrow day name; date in Space
  Grotesk 600 26px; one 8px dot per lesson (lime-2 done, `--dot-idle` future, cobalt ring for a
  review); caption "2 lessons · 25 min" or "Review · 8 cards".
- **Today**: ink card, lime dots, lime "Today" tag.
- **Exam day**: lime card with `--ring-halo`, `i-flame` tag "Exam 9:00".
- **Missed day**: hatched like the landing's plan card, caption "Moved to Thu". The plan
  slides; it never shows red.
- Right end: two light pills, "Add to calendar" (`plan.ics`) and "Anki deck" (`deck.apkg`).

```css
.c-plan { position: relative; z-index: 4; margin: -56px calc(var(--gut) + var(--pad-x)) 0; display: flex; align-items: stretch; gap: 10px; overflow-x: auto; scroll-snap-type: x mandatory; padding: 4px 4px 14px; scrollbar-width: none; }
.c-plan::-webkit-scrollbar { display: none; }
.day { flex: 0 0 148px; scroll-snap-align: start; display: grid; gap: 6px; align-content: start; padding: 12px 14px 14px; border-radius: var(--r-sm); background: var(--surface); box-shadow: var(--hair), var(--sh-card); }
.day .dn { font: var(--t-eyebrow); letter-spacing: var(--track-eyebrow); text-transform: uppercase; color: var(--text-3); }
.day .dd { font: 600 26px/1 var(--display); letter-spacing: -0.03em; }
.day .dots { display: flex; gap: 4px; min-height: 8px; }
.day .dots i { width: 8px; height: 8px; border-radius: 50%; background: var(--dot-idle); }
.day .dots i.done { background: var(--lime-2); }
.day .dots i.rv { background: none; box-shadow: inset 0 0 0 1.5px var(--cobalt); }
.day .cap { font: var(--t-cap); color: var(--text-2); }
.day.today { background: var(--ink); color: #fff; box-shadow: var(--sh-milestone); }
.day.today .dn, .day.today .cap { color: var(--on-ink-2); }
.day.today .dots i { background: var(--lime); }
.day.exam { background: var(--lime); color: var(--ink); box-shadow: var(--ring-halo); }
.day.exam .dn, .day.exam .cap { color: rgb(11 13 16 / 0.66); }
.day.missed { background: repeating-linear-gradient(135deg, #F1F2F5 0 6px, #E9EBEF 6px 12px); box-shadow: var(--hair); }
.c-plan .exports { flex: none; display: flex; flex-direction: column; justify-content: center; gap: 8px; padding-left: 6px; }
```

### 3.4 The path (the centrepiece)

A `.canvas-sec` (canvas `#F6F7FA` with the masked 24px dot grid). Head, centred: `.eb` "Your
path · 9 steps · 31 lessons", `.display` "ONE LINE (o path) TO FRIDAY." (the last word is the
exam weekday, or "DONE." when there is no exam), lede "Ink boxes are the line. White ones
hang off it. Lime means our pick." Legend: three `.mk` dots with labels.

Board grammar (identical to `story.css .bd-*`, which is the SaaS roadmap redrawn in cobalt):

- **Spine**: 2px `--rule-strong` down the middle column. Everything above the current
  milestone is overdrawn by the **lime run** (`--lime-2`, 6px, round, glow).
- **Topic milestone**: ink card 248px wide, r12, step chip, title 14.5px 600, meta line ("14
  min" + up to three 13px format icons at 60% white).
- **Subtopic**: white badge r9, hairline 0.12, 13px text, 15px mark dot on its left.
- **Tie**: dotted Bézier from the milestone edge to each subtopic row (`#9DA2AE 1.4px,
  dasharray 2 4, round caps`), the same curve as `useRoadmap.tie()`:
  `bend = max(18, |tx - sx| * 0.5)`, `M sx sy C sx+dir*bend sy, tx-dir*bend ty, tx ty`.
- **Mentor note**: amber card on the opposite flank (`--note-*`, sparkles icon), max 260px.
- **Group**: sunken `--fill-2` panel r12 with an uppercase eyebrow around its members.
- **Chapter pill**: white 24px pill ON the spine, uppercase 10.5px.
- **Finish pill**: "Exam · Fri 17 Oct" with a check circle; lime with `--ring-halo` when every
  milestone is done.
- Clusters alternate sides per topic that has one (right first), as in `useRoadmap` step 5.

Layout is DOM grid rows (`1fr 248px 1fr`), not absolute coordinates. After layout one SVG
overlay (`.p-wires`) is drawn by JS from `getBoundingClientRect()` of each milestone and row,
and redrawn by a `ResizeObserver` on the board. Max board width 1080px.

```css
.p-board { position: relative; max-width: 1080px; margin: 0 auto; padding: 24px var(--pad-x) 80px; display: grid; gap: 26px; }
.p-board::before { content: ""; position: absolute; left: 50%; top: 0; bottom: 40px; width: 2px; translate: -1px 0; background: var(--rule-strong); border-radius: 2px; }
.p-run { position: absolute; left: 50%; top: 0; width: 6px; translate: -3px 0; height: var(--run, 0px); background: var(--lime-2); border-radius: 6px; filter: drop-shadow(0 0 5px rgb(160 210 30 / 0.7)); transition: height var(--d-run) var(--ease-io); }
.p-wires { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
.p-wires path { fill: none; stroke: var(--mute); stroke-width: 1.4; stroke-dasharray: 2 4; stroke-linecap: round; transition: stroke .2s; }
.p-wires path.lit { stroke: var(--lime-2); stroke-width: 2.2; }   /* hovering a milestone lights its ties */
.p-row { position: relative; z-index: 1; display: grid; grid-template-columns: minmax(0, 1fr) 248px minmax(0, 1fr); align-items: center; column-gap: clamp(28px, 3.6vw, 56px); }
.p-l, .p-r { display: grid; gap: 7px; align-content: center; }
.p-l { justify-items: end; } .p-r { justify-items: start; }

.p-topic { position: relative; display: grid; grid-template-columns: 26px 1fr; gap: 4px 10px; align-items: center; min-height: 56px; padding: 11px 14px 11px 11px; border-radius: var(--r-node); background: var(--ink); color: #fff; text-align: left; box-shadow: var(--sh-milestone); transition: background var(--d-base), color var(--d-base), box-shadow var(--d-base), transform var(--d-press); }
.p-topic:hover { transform: translateY(-1px); }
.p-topic .no { grid-row: span 2; width: 26px; height: 26px; border-radius: 50%; background: rgb(255 255 255 / 0.14); display: grid; place-items: center; font: 600 12px/1 var(--display); }
.p-topic .tt { font: 600 14.5px/1.2 var(--body); }
.p-topic .mt { display: flex; align-items: center; gap: 6px; font-size: 12px; color: rgb(255 255 255 / 0.6); }
.p-topic .mt svg { width: 13px; height: 13px; }
.p-topic.cur { background: var(--lime-soft); color: var(--ink); box-shadow: inset 0 0 0 1.5px var(--lime-line), var(--ring-hot); }
.p-topic.cur .no { background: var(--lime); color: var(--ink); }
.p-topic.cur .mt { color: var(--lime-ink); }
.p-topic.done { background: var(--surface); color: var(--text-3); box-shadow: inset 0 0 0 1.5px var(--lime-2); }
.p-topic.done .tt { text-decoration: line-through; text-decoration-color: rgb(11 13 16 / 0.3); }
.p-topic.done .no { background: var(--lime); color: var(--ink); }   /* number swapped for i-check */
.p-topic.done .mt { color: var(--text-3); }
.p-topic:focus-visible { box-shadow: var(--sh-milestone), var(--ring-hot); }

.p-sub { position: relative; display: inline-flex; align-items: center; gap: 8px; min-height: 34px; max-width: 100%; padding: 6px 12px; border-radius: var(--r-chip); background: var(--surface); box-shadow: var(--hair-strong); font-size: 13px; color: var(--ink-3); text-align: left; transition: box-shadow var(--d-fast), transform var(--d-press); }
.p-sub:hover { box-shadow: inset 0 0 0 1.5px var(--cobalt-line); transform: translateY(-1px); }
.p-sub.done { background: var(--sunken); color: var(--text-3); text-decoration: line-through; }
.mk { width: 15px; height: 15px; border-radius: 50%; display: grid; place-items: center; flex: none; }
.mk svg { width: 9px; height: 9px; }
.mk.rec { background: var(--mark-rec); color: var(--mark-rec-ink); }
.mk.alt { background: var(--mark-alt); color: var(--mark-alt-ink); }
.mk.any { background: var(--mark-any); color: var(--mark-any-ink); }
.p-note { display: flex; gap: 8px; max-width: 260px; padding: 9px 12px; border-radius: 10px; background: var(--note-bg); box-shadow: inset 0 0 0 1px var(--note-line); font-size: 12.5px; line-height: 1.4; color: var(--note-ink); }
.p-note svg { width: 12px; height: 12px; flex: none; margin-top: 2px; color: var(--note-icon); }
.p-grp { display: grid; gap: 6px; padding: 8px 9px 9px; border-radius: var(--r-node); background: var(--fill-2); box-shadow: var(--hair); }
.p-grp em { font: normal 600 10px/1 var(--body); letter-spacing: var(--track-eyebrow); text-transform: uppercase; color: var(--text-3); padding: 2px 3px; }
.p-sec { justify-self: center; position: relative; z-index: 1; height: 24px; padding: 0 12px; border-radius: 99px; background: var(--surface); box-shadow: inset 0 0 0 1px rgb(11 13 16 / 0.14); display: inline-flex; align-items: center; font: 600 10.5px/1 var(--body); letter-spacing: var(--track-eyebrow); text-transform: uppercase; color: var(--text-2); }
.p-fin { justify-self: center; position: relative; z-index: 1; display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 18px 0 8px; border-radius: 99px; background: var(--surface); box-shadow: inset 0 0 0 1.5px var(--rule-strong); font: 600 14.5px/1 var(--display); color: var(--text-3); transition: background var(--d-base), color var(--d-base), box-shadow var(--d-base); }
.p-fin .ck { width: 28px; height: 28px; border-radius: 50%; background: var(--fill-2); display: grid; place-items: center; }
.p-fin.lit { background: var(--lime); color: var(--ink); box-shadow: var(--ring-halo); }
.p-fin.lit .ck { background: var(--ink); color: var(--lime); }
```

**"You are here" token**: the landing's lime `.token` (lime pill, ink icon circle, Space
Grotesk 600 14px, `--sh-token`) pinned above-left of the current milestone, text "You are
here". When a lesson is completed it hops to the next milestone (§6.1).

**Brief popover** (click a node; the SaaS `NodeBrief`, slimmed): white r20, `--sh-popover`,
340px wide, anchored beside the node on desktop, a bottom sheet on phones (r28 top corners,
drag handle). Content: place row (step chip, "Step 3 · Foundations", mark tag); title Space
Grotesk 600 22px; one-line summary; format chips (`page.css .fmt`: icon dot + label,
cobalt-soft); a cite chip "From Lecture 4 · p.12-19"; the mentor note if any; ONE ink `.pill`
"Open lesson" with a lime arrow; a quiet "Mark done" text button. Esc or outside click closes.

Phone (< 900px): the spine moves to a 26px left rail (`story.css` phone rules). Milestones go
full width with `padding-left: 26px`; subtopics stack under their milestone, indented 42px,
with a short dotted tie. Notes and groups stay (they are content); the legend hides.

### 3.5 "Checked before you saw it" (the agents' receipts)

An ink slab that answers the judges' question (did the agents do the work, and was it
validated?) inside the student's own deliverable, in student language.

- `.eb.on-dark` "How this course was made".
- `.display` "CHECKED (o check) BEFORE YOU SAW IT." with "BEFORE YOU SAW IT." in `.lime`.
- Lede: "WorkBuddy split the work across 4 agents, then checked every answer against the
  page it came from."
- Six steps on a rail with a dashed lime connector (3+3 under 1100px, 2 columns on phones).
  Each: 40px icon tile, a lime number (Space Grotesk 700 ~44px), a label.
  Read **3** files, 142 pages · Planned **9** steps · Wrote **31** lessons, 4 agents in
  parallel · Ran **42/42** code checks · Verified **96** quiz answers, 7 fixed · Recorded
  **2h 42m** of narration.
- A quiet disclosure "See what each agent did" opens an ink list (mono 12.5px, one line per
  event from `build-log.json`: time, agent, action, result). Collapsed by default.
- When the slab scrolls into view, a lime pulse travels the connector once (1.6s).

```css
.c-proof { padding: clamp(40px, 5vw, 84px) var(--pad-x); margin-top: var(--sec-y); overflow: hidden; }
.c-steps { margin: clamp(32px, 4vw, 56px) 0 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; position: relative; }
.c-steps::before { content: ""; position: absolute; left: 20px; right: 20px; top: 20px; border-top: 1.5px dashed rgb(198 242 78 / 0.35); }
.c-steps li { position: relative; display: grid; gap: 10px; align-content: start; }
.c-steps .ic { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; background: var(--ink-2); box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.12); color: #fff; }
.c-steps .ic svg { width: 17px; height: 17px; }
.c-steps b { font: 700 clamp(32px, 3.2vw, 46px)/0.9 var(--display); letter-spacing: -0.04em; color: var(--lime); font-variant-numeric: tabular-nums; }
.c-steps span { font-size: 13.5px; line-height: 1.4; color: var(--on-ink-2); max-width: 18ch; }
.c-steps .pulse { position: absolute; left: 20px; top: 15px; width: 10px; height: 10px; border-radius: 50%; background: var(--lime); box-shadow: 0 0 12px var(--lime); opacity: 0; }
.c-proof.in .c-steps .pulse { animation: travel 1.6s var(--ease-io) .3s 1 both; }
@keyframes travel { 0% { opacity: 0; left: 20px; } 10%, 90% { opacity: 1; } 100% { opacity: 0; left: calc(100% - 30px); } }
@media (max-width: 1100px) { .c-steps { grid-template-columns: repeat(3, minmax(0, 1fr)); row-gap: 28px; } .c-steps::before, .c-steps .pulse { display: none; } }
@media (max-width: 600px) { .c-steps { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
```

### 3.6 Sources and footer

- **Sources**: eyebrow "Built from your files", one white card per source (r18, 40px file tile
  in cobalt-soft with a 3-letter type label PDF/PPT/DOC in Space Grotesk 700 11px, title 15px
  600, caption "38 pages · cited 54 times", an "Open" text link). Three per row.
- **Footer**: light pills for the exports ("Notes for Obsidian", "Anki deck", "Study plan
  .ics"), then the landing's giant outlined word (`page.css .foot .huge`): the course title
  in transparent text with `-webkit-text-stroke: 1.5px rgb(35 64 230 / .25)`, the first word
  solid cobalt, `clamp(64px, 18vw, 320px)`, clipped. Under it, 13px "BiliMind × WorkBuddy ·
  made for you on 13 Oct 2026".

---

## 4. Lesson view (`#/l/<lessonId>`)

```
 [< Path]  Step 3 · Trees                       ===----- 4/8   (Aa) [ Mark complete ]   <- top bar 64, frosted
+--------------------------------------------------------------------------+
| (Step 3 of 9 · An idea to get)                              [obj-book]   |   <- lesson head slab
| BINARY SEARCH (o) TREES                                                  |      (skin colour, r36,
| 14 min · 8 parts · 3 checks · narrated          (>) Listen · 5:12        |       min-height 300)
+--------------------------------------------------------------------------+
  o Why order matters         |  WHY ORDER MATTERS                         |
  | (o) Key terms             |  A binary search tree keeps every left ... |
  o The shape, drawn          |  [lime marker on the sentence being read]  |
  | * Try it: insert 7        |  ...                                       |
  o Check yourself            |  [card: Key terms]                         |
  :                           |  [wide card: Diagram]                      |
  table of blocks (sticky)    |  reading column 720                        |
                    +-----------------------------------------------+
                    | (>) Listen · Why order matters  |||||||.....  1:24/5:12  1x  (follow) |  <- narration dock
                    +-----------------------------------------------+
```

### 4.1 Grid

```css
.l-wrap { display: grid; grid-template-columns: var(--toc-w) minmax(0, 1fr); gap: clamp(24px, 3vw, 56px); max-width: 1440px; margin: clamp(28px, 3.4vw, 48px) auto 0; padding: 0 calc(var(--gut) + var(--pad-x)) calc(var(--dock-h) + 80px); }
/* breakout grid: text blocks sit on the 720 measure, .wide blocks take up to 1040 */
.l-col { display: grid; grid-template-columns: [wide-start] minmax(0, 1fr) [text-start] minmax(0, var(--read-w)) [text-end] minmax(0, 1fr) [wide-end]; row-gap: clamp(28px, 3vw, 44px); }
.l-col > * { grid-column: text; min-width: 0; }
.l-col > .wide { grid-column: wide; width: 100%; max-width: var(--wide-w); justify-self: center; }
@media (max-width: 1199px) { .l-wrap { grid-template-columns: minmax(0, 1fr); } .toc { display: none; } }
```

### 4.2 Lesson head

A shorter version of the course hero, same skin as the course: `.slab` r36, min-height 300px,
padding `clamp(28px, 4vw, 56px) var(--pad-x)`.

- `.eb.on-dark`: "Step 3 of 9 · An idea to get" (step + archetype tag from §2.1, with its icon
  in the lime dot).
- Title: `.display` (`--t-h1`), uppercase, one `.hchip` after the first word using the
  archetype icon. Never more than 3 lines; long titles step down to `--t-h1-sm`.
- Meta: three `.tag`-style chips on dark (`rgb(255 255 255 / .1)` fill, white text):
  "14 min", "8 parts", "3 checks", plus "Grounded in Lecture 4" as a cite chip (on-dark variant).
- Right: the narrator orb "Listen · 5:12" and the lesson's 3D object (per archetype, §2.1)
  at 220px, bottom-right, overlapping the slab's bottom edge by 30px.
- Under the slab, in the column: a one-sentence "By the end you can..." line in
  `--t-lede` (from the lesson's objective).

### 4.3 Top bar (lesson)

Same 64px frosted bar as the home. Left: a light pill "Path" with `i-back` (returns to `#/`
scrolled to this milestone), then the crumb "Step 3 · Trees" (13.5px, text-2, truncates).
Right: a 120px progress track (`--fill-2`, 6px, lime-2 fill = parts seen), the label "4/8"
(tabular), an `Aa` square button (popover: text size S/M/L, Night reading on/off, Stage mode
on/off), and the ONE primary action: ink pill "Mark complete" (turns lime "Completed" with a
check once done). Phones keep: back, the "3/8 ▾" pager (§4.4), Mark complete as an icon.

### 4.4 Table of blocks (desktop) and the pager (narrow)

The lesson's contents drawn as a **mini path**: a 2px rail with one node per part, so the
lesson rhymes with the course.

- Node: 12px dot on the rail + a 22px icon tile (format icon) + the part's name (block title,
  else the learner noun: Explanation, Key terms, Diagram, Try it, Check yourself, Practice
  cards, Say it, Worked example, Summary). 13.5px, ink-3.
- States: seen = lime-2 dot; current = ink dot with a lime 4px ring (`--ring-hot` scaled);
  task not yet done = hollow dot with 1.5px lime-2 ring; task passed = lime dot with an ink
  check; narrating now = the current node's tile gets a 3-bar equaliser instead of its icon.
- The rail fills ink from the top down to the current node (`height` transition 500ms). The fill
  is an `<li class="fill" aria-hidden="true">` first child of the `<ol>` (absolutely positioned,
  so it takes no grid row and the list stays valid HTML).
- Footer under the list: "2 checks left" / "All checks passed" (lime tag).
- Click scrolls to the part (`scrollIntoView({ block: 'start' })`, smooth unless reduced
  motion) and flashes `--ring-anchor` on it for 1.4s (SaaS `anchorBlock`).
- Sticky at `top: calc(var(--topbar-h) + 24px)`, max-height `calc(100svh - 160px)`, scrolls
  on its own if long.
- Under 1200px it becomes the **pager** in the top bar: "3/8 Diagram ▾" opens a popover list
  with the same rows (SaaS `LessonSpine`).

```css
.toc { position: sticky; top: calc(var(--topbar-h) + 24px); align-self: start; max-height: calc(100svh - 160px); overflow: auto; padding: 4px 4px 4px 0; }
.toc ol { position: relative; margin: 0; padding: 0; list-style: none; display: grid; gap: 2px; }
.toc ol::before { content: ""; position: absolute; left: 10px; top: 14px; bottom: 14px; width: 2px; background: var(--rule-strong); border-radius: 2px; }
.toc .fill { position: absolute; left: 10px; top: 14px; width: 2px; height: var(--fill, 0px); background: var(--ink); border-radius: 2px; transition: height var(--d-slow) var(--ease-out); }
.toc a { position: relative; display: grid; grid-template-columns: 22px 22px 1fr; align-items: center; gap: 8px; min-height: 38px; padding: 4px 8px 4px 0; border-radius: 10px; font-size: 13.5px; color: var(--ink-3); }
.toc a:hover { background: rgb(11 13 16 / 0.04); }
.toc .dt { justify-self: center; width: 12px; height: 12px; border-radius: 50%; background: var(--surface); box-shadow: inset 0 0 0 2px var(--dot-idle); z-index: 1; }
.toc .ti { width: 22px; height: 22px; border-radius: 7px; display: grid; place-items: center; background: var(--cobalt-soft); color: var(--cobalt); }
.toc .ti svg { width: 12px; height: 12px; }
.toc a.task .ti { background: var(--lime); color: var(--ink); }
.toc a.seen .dt { background: var(--lime-2); box-shadow: none; }
.toc a.task:not(.passed) .dt { background: var(--surface); box-shadow: inset 0 0 0 2px var(--lime-2); }
.toc a.passed .dt { background: var(--lime); box-shadow: inset 0 0 0 1.5px var(--ink); }
.toc a[aria-current="true"] { color: var(--ink); font-weight: 600; background: var(--surface); box-shadow: var(--hair); }
.toc a[aria-current="true"] .dt { background: var(--ink); box-shadow: 0 0 0 4px rgb(198 242 78 / 0.7); }
.toc .eq { display: none; gap: 2px; align-items: end; height: 12px; }
.toc a.speaking .ti svg { display: none; }
.toc a.speaking .eq { display: flex; }
.toc .eq i { width: 2.5px; height: 100%; background: currentColor; border-radius: 2px; animation: eq .9s ease-in-out infinite alternate; }
.toc .eq i:nth-child(2) { animation-delay: -.3s; } .toc .eq i:nth-child(3) { animation-delay: -.6s; }
@keyframes eq { from { transform: scaleY(.25); } to { transform: scaleY(1); } }
```

### 4.5 Narration dock

The landing's fixed bottom dock (`page.css .dock`), as an ink audio bar. It is the
lesson's second primary control and the thing judges remember.

- Fixed, bottom `max(18px, env(safe-area-inset-bottom))`, centred, width
  `min(820px, 100vw - 2 * var(--gut))`, height `--dock-h` (68px), ink, r99, `--sh-dock`.
- Contents left to right: **play** (52px lime circle, ink icon; the one lime thing in the
  bar), a two-line label ("Listen" 13.5px 600 white / current part name 12px
  `--on-ink-2`, truncates), the **waveform** (flex 1: 64 bars from `peaks`, 3px wide, gap
  2px, played bars lime, unplayed `rgb(255 255 255 / .22)`, click or drag to seek), time
  "1:24 / 5:12" (12.5px tabular, `--on-ink-2`), **speed** chip (cycles 1× → 1.25× → 1.5× →
  0.75×; 32px, `rgb(255 255 255 / .1)`), **follow** toggle (`i-down` icon, `aria-pressed`).
- Idle and scrolled away from the head: the dock collapses to a 56px circle with the lime
  ring keyframe and a "Listen · 5 min" tooltip (like the landing dock's play button).
- When the reader scrolls away from the sentence being read (user scroll in the last 4s), a
  small lime chip appears above the dock: "Back to the voice" (scrolls to the current
  sentence and turns follow back on).
- Keys: `K` or Space (outside inputs) play/pause, `[` `]` speed, `←` `→` previous/next
  sentence. Media Session API sets title/artist so headphone buttons work.

```css
.dock { position: fixed; z-index: var(--z-dock); left: 50%; bottom: max(18px, env(safe-area-inset-bottom)); translate: -50% 0; width: min(820px, calc(100vw - 2 * var(--gut))); height: var(--dock-h); display: flex; align-items: center; gap: 12px; padding: 0 14px 0 8px; border-radius: 99px; background: var(--ink); color: #fff; box-shadow: var(--sh-dock); transition: width var(--d-slow) var(--ease-out), opacity var(--d-base), translate var(--d-slow) var(--ease-out); }
.dock .pp { width: 52px; height: 52px; border-radius: 50%; flex: none; display: grid; place-items: center; background: var(--lime); color: var(--ink); transition: transform var(--d-press); }
.dock .pp:active { transform: scale(.94); }
.dock .pp svg { width: 18px; height: 18px; }
.dock .who { min-width: 0; flex: 0 1 180px; display: grid; gap: 2px; }
.dock .who b { font-size: 13.5px; font-weight: 600; }
.dock .who small { font-size: 12px; color: var(--on-ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dock .wave { flex: 1 1 auto; min-width: 0; height: 36px; display: flex; align-items: center; gap: 2px; overflow: hidden; cursor: pointer; touch-action: none; }
/* JS renders floor(waveWidth / 5) bars (64 on desktop, ~20-30 on phones) on load and on resize */
.dock .wave i { flex: 0 0 3px; height: calc(var(--h) * 100%); min-height: 3px; border-radius: 2px; background: rgb(255 255 255 / 0.22); }
.dock .wave i.p { background: var(--lime); }
.dock .wave i.now { background: #fff; }
.dock .tm { font-size: 12.5px; color: var(--on-ink-2); font-variant-numeric: tabular-nums; white-space: nowrap; }
.dock .sp { height: 32px; min-width: 46px; padding: 0 10px; border-radius: 99px; background: rgb(255 255 255 / 0.1); font: 600 12.5px/1 var(--body); }
.dock .fw { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; color: var(--on-ink-2); }
.dock .fw[aria-pressed="true"] { color: var(--lime); background: rgb(198 242 78 / 0.12); }
.dock.mini { width: 56px; height: 56px; padding: 2px; gap: 0; }
.dock.mini > :not(.pp) { display: none; }
.dock.mini .pp::after { content: ""; position: absolute; inset: -6px; border-radius: 50%; border: 1.5px solid rgb(11 13 16 / 0.18); animation: ring 2.6s ease-out infinite; }
.dock-back { position: fixed; z-index: var(--z-dock); left: 50%; translate: -50% 0; bottom: calc(var(--dock-h) + 30px); height: 32px; padding: 0 14px 0 6px; border-radius: 99px; background: var(--lime); color: var(--ink); font: 600 12.5px/1 var(--body); display: inline-flex; align-items: center; gap: 8px; box-shadow: var(--sh-token); }
```

### 4.6 Sentence highlight ("it reads to you")

- Renderer wraps every sentence of narrated text in `<span class="s" data-s="b2.4">`
  (explainer, example, analogy, key points, misconception's belief + truth, timeline lines,
  captions). Quizzes, code and answers are silent (SaaS rule: never read answers).
- On `timeupdate` plus a rAF loop while playing, binary-search `cues` by time, swap `.on` from
  the previous span to the new one. Past sentences get nothing (no greying; reading back
  must stay comfortable).
- Follow: if the `.on` span is outside the band 20%-70% of the viewport and the user has not
  scrolled in the last 4s, `scrollIntoView({ block: 'center', behavior: 'smooth' })`.
- Clicking any sentence while the dock is open seeks to it ("tap to listen from here"). A 1px
  dotted underline appears on hover to signal it.
- No cues (TTS failed for a lesson)? The dock hides and the orb shows "Narration not ready"
  disabled. Never a broken player.

```css
.s { border-radius: 4px; transition: background-color var(--d-fast), box-shadow var(--d-fast); -webkit-box-decoration-break: clone; box-decoration-break: clone; }
.s.on { background: var(--lime-soft); box-shadow: 0 0 0 3px var(--lime-soft); color: var(--ink); }
.listening .s:hover { cursor: pointer; text-decoration: underline dotted rgb(11 13 16 / 0.35); text-underline-offset: 4px; }
.slab .s.on, .fc-back .s.on { background: rgb(198 242 78 / 0.22); box-shadow: 0 0 0 3px rgb(198 242 78 / 0.22); color: #fff; }
```

### 4.7 Progress inside a lesson

- A part counts as **seen** when 60% of it has passed the top 40% of the viewport
  (IntersectionObserver, thresholds `[0, .6]`). Tasks count as **passed** when graded.
- The top-bar track shows seen/total; the table of blocks shows both; the course ring on the
  home updates from completed lessons.
- Everything persists in `localStorage` under `bm:<courseId>:progress` as
  `{ lessons: { l03: { seen: ["b1","b2"], passed: ["b4"], done: true, at: 1760... } }, srs: {...} }`.

### 4.8 The finish card (end of every lesson)

A white card r28 at the end of the column: eyebrow "End of step 3"; Space Grotesk 600 26px
"Done with this lesson?"; "3 of 3 checks passed" with a 160px lime-2 progress bar; a lime
`.pill.lg` "Mark complete". Below, "Up next" as a mini milestone (ink card, step chip, title,
minutes) and any subtopics as `.p-sub` chips. When marked complete, see §6.1.

---

## 5. Blocks: precise visual spec

### 5.0 Mapping and the shared shell

What the brief asks for, mapped to BiliMind's real types (`inv-blocks.md §2.1`) so the engine
can reuse the SaaS schemas. "new" = not in the SaaS's 27; the engine adds it.

| Player block | SaaS type / assessment kind | Frame | Measure | Icon | Eyebrow | Voice |
|---|---|---|---|---|---|---|
| Explainer text | `explainer`, `example` | prose | text | (none) | (title only) | read aloud |
| Callout / mentor note | new `callout` {tone: note, tip, warn, truth}; also `analogy` "where it breaks", `misconception` "what is true", roadmap `note` | inset | text | `i-spark` / `i-bulb` / `i-warning` / `i-check` | Mentor note / Tip / Watch out / What is actually true | read aloud |
| Key terms | new `key_terms` {terms: [{term, definition, cite}]} (also feeds the Anki deck) | card | text | `i-list` | Key terms | read aloud |
| Mermaid diagram | `diagram` | card | wide | `i-flow` | Diagram | caption read |
| Runnable code | `code` (function, script, query, build) | card + ink stage | text | `i-code` | Try it | silent |
| Quiz single / multi | `quiz` → `mcq`, `multi_select` | card, task | text | `i-quiz` | Check yourself | silent |
| Flashcards | `flashcards` | none, own deck | text | `i-cards` | Practice cards | silent |
| Cloze | `quiz` → `cloze` | card, task | text | `i-pencil` | Fill the gaps | silent |
| Ordering | `quiz` → `ordering` | card, task | text | `i-steps` | Put in order | silent |
| Matching | new `matching` assessment kind {pairs: [{left, right}]} | card, task | text | `i-link` | Match them | silent |
| Timeline | `timeline` | rule | text | `i-time` | How it got here | read aloud |
| Worked example | `worked_example` | card | text | `i-steps` | Worked example | problem read |
| Speaking drill | `speaking` | card, task | text | `i-mic` | Say it | phrases played on demand |
| Explorable | `playground` | card, task | wide | `i-sliders` | Try it | guidance read |
| Compare table | `comparison` | card | wide | `i-scales` | Side by side | best-for lines read |
| Summary | new `summary` {can_do: [{text, proved_by}], next} | lime slab | wide | `i-check` | What you can do now | read aloud |
| Citation chip | `cites` on any block | inline | | `i-file` | | |
| Illustration (bonus, for the café course) | `illustration` with DOM pins | card | text | `i-image` | Illustration | caption read |

Rule of lime inside blocks: the icon tile is lime only for task blocks ("do this"); lime fills
appear only for correct, passed, Easy, Record, Run. Everything else is cobalt-soft, ink, white.

```css
.blk { position: relative; scroll-margin-top: calc(var(--topbar-h) + 20px); }
.blk-h { display: flex; align-items: center; gap: 10px; min-height: 26px; margin: 0 0 12px; }
.blk-h .bi { width: 26px; height: 26px; border-radius: 8px; flex: none; display: grid; place-items: center; background: var(--cobalt-soft); color: var(--cobalt); }
.blk-h .bi svg { width: 13px; height: 13px; }
.blk.task .blk-h .bi { background: var(--lime); color: var(--ink); }
.blk-h .be { font: var(--t-eyebrow); letter-spacing: var(--track-eyebrow); text-transform: uppercase; color: var(--text-3); white-space: nowrap; }
.blk-h .act { margin-left: auto; display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 8px; }
@media (max-width: 520px) { .blk-h { flex-wrap: wrap; } .blk-h .act .tag.opt-long { display: none; } }  /* e.g. "Answers checked against your slides" moves to the block footer */
.blk-t { margin: 0 0 12px; font: var(--t-h3); letter-spacing: var(--track-h); color: var(--text); text-wrap: balance; }
.blk.card { background: var(--surface); border-radius: var(--r-block); box-shadow: var(--hair), var(--sh-card); padding: clamp(18px, 2vw, 26px) clamp(18px, 2.2vw, 28px) clamp(20px, 2.2vw, 28px); }
.blk.rule { padding-top: 20px; border-top: 1px solid var(--line); }
.blk.card.passed { box-shadow: inset 0 0 0 1.5px var(--lime-2), var(--sh-card); }
.blk.flash { animation: anchor 1.4s var(--ease-out); }
@keyframes anchor { 0%, 60% { box-shadow: var(--ring-anchor); } }
.blk-foot { margin-top: 16px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font: var(--t-cap); color: var(--text-3); }
.tag.stamp { animation: stamp .45s var(--ease-pop) both; }   /* "Passed" tag arriving */
```

### 5.1 Explainer text

Plain prose on the page, no frame (the SaaS `prose` voice). Title as `.blk-t`. The first
paragraph of the lesson is the lead (1.12em, ink). Lists use the landing's diamond bullet in
cobalt; ordered lists use ink number circles (the walkthrough look). Inline code is a fill
chip in mono. **Key terms** inside prose get a cobalt dotted underline; focus or hover shows a
small ink tooltip with the definition (from the lesson's `key_terms`).

```css
.prose { font: var(--t-read); color: var(--text-body); max-width: 68ch; }
.prose p { margin: 0 0 1em; text-wrap: pretty; }
.prose p.lead { font-size: 1.12em; line-height: 1.6; color: var(--text); }
.prose h3 { margin: 1.6em 0 .5em; font: var(--t-h3); letter-spacing: var(--track-h); color: var(--text); }
.prose b, .prose strong { font-weight: 600; color: var(--text); }
.prose code { font: 500 .86em/1 var(--mono); padding: .18em .42em; border-radius: 6px; background: var(--fill); color: var(--ink); }
.prose ul, .prose ol { margin: .4em 0 1em; padding: 0; list-style: none; }
.prose ul li { position: relative; padding-left: 26px; margin: .45em 0; }
.prose ul li::before { content: ""; position: absolute; left: 6px; top: .68em; width: 7px; height: 7px; border-radius: 1.5px; background: var(--cobalt); transform: rotate(45deg); }
.prose ol { counter-reset: n; }
.prose ol li { counter-increment: n; position: relative; padding-left: 36px; margin: .6em 0; }
.prose ol li::before { content: counter(n); position: absolute; left: 0; top: .15em; width: 24px; height: 24px; border-radius: 50%; background: var(--ink); color: #fff; font: 600 12px/24px var(--display); text-align: center; }
.prose blockquote { margin: 1.2em 0; padding: 2px 0 2px 18px; border-left: 3px solid var(--lime-2); color: var(--ink-3); }
.kt { color: var(--text); text-decoration: underline dotted var(--cobalt); text-decoration-thickness: 2px; text-underline-offset: 5px; cursor: help; }
.kt-tip { position: absolute; z-index: var(--z-popover); max-width: 280px; padding: 9px 12px; border-radius: 10px; background: var(--ink); color: #fff; font: 400 13.5px/1.45 var(--body); box-shadow: var(--sh-lift); animation: pop .22s var(--ease-pop-2); }
.kt-tip b { display: block; color: var(--lime); font-weight: 600; margin-bottom: 2px; }
```

### 5.2 Callout and mentor note

One component, four tones. The mentor note is the roadmap's amber note carried into the lesson
(when the topic has a note it opens the lesson, right under the head). Analogy blocks end in
a `tip` callout "Where the analogy breaks"; misconception blocks show the wrong belief as quiet
italic reported speech (muted, left border, never bold) and then a `truth` callout, the only
loud element (SaaS rule: the refutation is what must survive skimming).

```css
.callout { display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 12px; padding: 16px 18px 16px 16px; border-radius: var(--r-sm); font: 400 15.5px/1.55 var(--body); color: var(--ink-3); }
.callout .ci { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; }
.callout .ci svg { width: 16px; height: 16px; }
.callout .ce { margin: 3px 0 6px; font: var(--t-eyebrow); letter-spacing: var(--track-eyebrow); text-transform: uppercase; }
.callout p { margin: 0; }
.callout.note { background: var(--note-bg); box-shadow: inset 0 0 0 1px var(--note-line); color: var(--note-ink); }
.callout.note .ci { background: #fff; color: var(--note-icon); box-shadow: inset 0 0 0 1px var(--note-line); }
.callout.note .ce { color: var(--note-ink); }
.callout.tip { background: var(--cobalt-soft); }
.callout.tip .ci { background: var(--cobalt); color: #fff; }
.callout.tip .ce { color: var(--cobalt); }
.callout.warn { background: var(--coral-soft); }
.callout.warn .ci { background: var(--coral-ink); color: #fff; }
.callout.warn .ce { color: var(--coral-ink); }
.callout.truth { background: var(--lime-soft); box-shadow: inset 0 0 0 1px var(--lime-line); }
.callout.truth .ci { background: var(--lime); color: var(--ink); }
.callout.truth .ce { color: var(--lime-ink); }
.belief { margin: 0 0 12px; padding: 2px 0 2px 16px; border-left: 3px solid var(--rule-strong); font: italic 400 17px/1.55 var(--body); color: var(--text-2); }
.belief::before { content: "\201C"; } .belief::after { content: "\201D"; }
```

### 5.3 Key terms

A numbered 2-column grid of term cards (1 column under 640px). Header action: "Quiz me"
toggles `.quiz`: definitions blur until tapped (cheap self-test; tapped ones stay open).
Each card carries a small "In your deck" cobalt tag because every term also lands in
`deck.apkg`.

```css
.terms { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 0; counter-reset: t; }
.term { position: relative; margin: 0; padding: 14px 16px 14px 54px; border-radius: var(--r-row); background: var(--surface-2); box-shadow: var(--hair); counter-increment: t; }
.term::before { content: counter(t, decimal-leading-zero); position: absolute; left: 14px; top: 14px; width: 28px; height: 28px; border-radius: 8px; background: var(--ink); color: var(--lime); font: 700 11px/28px var(--display); text-align: center; }
.term dt { font: 600 17px/1.2 var(--display); letter-spacing: -0.015em; color: var(--text); }
.term dd { margin: 5px 0 0; font: 400 14.5px/1.5 var(--body); color: var(--text-2); transition: filter var(--d-base); }
.terms.quiz .term:not(.open) dd { filter: blur(6px); user-select: none; cursor: pointer; }
@media (max-width: 640px) { .terms { grid-template-columns: minmax(0, 1fr); } }
```

### 5.4 Mermaid diagram

Wide card. The diagram sits on a small **dotted canvas** (the same 20px grid as the path, so
diagrams feel native, not pasted). Nodes white with a 1.5px ink border and r10, the key node
lime (`classDef hot`), edges `#9DA2AE` curved (basis). On reveal the edges draw in (dashoffset)
with a 60ms stagger and nodes fade up. Toolbar action: "Full screen" (dialog, cobalt backdrop
blur). Caption below; it is what narration reads. On phones the SVG keeps its natural width
and scrolls inside the canvas with a right-edge fade.

Pre-render at build time with this config (also the runtime fallback config):

```js
mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'base',
  themeVariables: {
    background: 'transparent', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '14px',
    primaryColor: '#FFFFFF', primaryBorderColor: '#0B0D10', primaryTextColor: '#0B0D10',
    secondaryColor: '#EEF1FE', secondaryBorderColor: '#2340E6', secondaryTextColor: '#1B33CF',
    tertiaryColor: '#EEF9CF', tertiaryBorderColor: '#B4E03A', tertiaryTextColor: '#0B0D10',
    lineColor: '#9DA2AE', textColor: '#2A2E37', clusterBkg: '#FFFFFF', clusterBorder: '#D9DCE4',
    edgeLabelBackground: '#F6F7FA', noteBkgColor: '#FFF6DA', noteBorderColor: '#D9A21B', noteTextColor: '#6E5410',
    actorBkg: '#0B0D10', actorTextColor: '#FFFFFF', actorBorder: '#0B0D10', signalColor: '#2A2E37'
  },
  flowchart: { htmlLabels: false, curve: 'basis', nodeSpacing: 36, rankSpacing: 52, padding: 14 } });
// The engine appends to every flowchart:  classDef hot fill:#C6F24E,stroke:#0B0D10,color:#0B0D10
// and marks the ONE node the lesson is about with  class X hot
```

```css
.dgm .pane { position: relative; border-radius: var(--r-sm); background: var(--canvas); background-image: radial-gradient(rgb(11 13 16 / 0.12) 1px, transparent 1.3px); background-size: 20px 20px; box-shadow: var(--hair); padding: clamp(16px, 2.4vw, 36px); overflow: auto; }
.dgm svg { margin: 0 auto; height: auto; max-height: 560px; }
.dgm svg .node rect, .dgm svg .node polygon, .dgm svg .node circle { stroke-width: 1.5px; }
.dgm svg .node rect { rx: 10px; ry: 10px; }
.dgm svg .edgeLabel { font-size: 12.5px; }
html.js .dgm .pane svg .flowchart-link { stroke-dasharray: 600; stroke-dashoffset: 600; }
.dgm.in .pane svg .flowchart-link { animation: draw 800ms var(--ease-out) forwards; animation-delay: calc(var(--i, 0) * 60ms); }
@keyframes draw { to { stroke-dashoffset: 0; } }
.dgm figcaption { margin: 10px 2px 0; font: var(--t-small); color: var(--text-2); }
@media (max-width: 640px) { .dgm .pane svg { max-width: none; } .dgm .pane { -webkit-mask-image: linear-gradient(90deg, #000 85%, transparent); mask-image: linear-gradient(90deg, #000 85%, transparent); } }
```

### 5.5 Runnable code (the stage)

A white card holding the task and then the **ink stage** (from `parts/checks.html` `.sb`,
scaled up from landing-mock size to real reading size).

- **Task**: instructions (prose), a tag row "3 checks · JavaScript · runs on your laptop".
  Debug mode adds a `warn` callout "What it does now". Query mode adds "Tables you can query"
  chips (`orders (id, total, placed_at)`).
- **Stage header** 44px: language glyph tile (`JS` / `PY` / `SQL` / `HTML`, `#1E2A44`
  fill, `--code-fn` text), file name `solution.js` (white 13px 600), mode caption
  "function · 3 checks", right: runtime status ("Ready" green dot / "Loading Python, once"
  amber pulse / "Offline: Python needs internet the first time" dim).
- **Editor**: transparent `<textarea>` over a highlighted `<pre>` (identical font metrics),
  44px gutter of line numbers, 14px/1.7 mono, lime caret, cobalt selection, min 8 lines, max
  22 then scroll. Tab = 2 spaces, Shift+Tab outdent, **Esc releases focus** so keyboard users
  are never trapped, Ctrl/Cmd+Enter runs. A 60-line regex highlighter (keywords, strings,
  numbers, comments, call names) for JS, Python, SQL is enough.
- **Tabs**: Checks | Console (lime 2px underline on the active one). Query mode adds Result
  (an ink table with a lime header rule).
- **Checks list**: one row per test: status (idle dot, spinner, green check, coral x), the
  test name, and for failures `expected 5, got undefined` in mono `#FF9D85`.
- **Footer** `#0E1014`: lime **Run** (36px, r10, play icon), `Ctrl ⏎` hint, status in mono
  ("2/3 passing · 41 ms" green or coral), right: Reset and Hint ghost buttons. Hints stay
  locked until the first run ("Have a go first. A hint read before trying replaces the
  trying." from the SaaS).
- **Run drama** (cheap and readable): results arrive at once from the worker, but rows flip
  run→pass/fail one after another, 120ms apart. All pass: the stage gets a lime ring and lime
  glow, the block's header tag stamps "Passed", 14 confetti bits burst from Run.
- **Limits**: Blob worker per run, 3s timeout → "Stopped after 3 seconds. An endless loop?".
  Output capped at 200 lines.

```css
.code-stage { margin-top: 16px; border-radius: var(--r-sm); overflow: hidden; background: var(--code-bg); color: var(--code-text); box-shadow: 0 30px 50px -30px rgb(0 0 0 / 0.55); transition: box-shadow var(--d-base); }
.code-stage.passed { box-shadow: 0 0 0 2px var(--lime), 0 30px 60px -26px rgb(198 242 78 / 0.45); }
.cs-h { display: flex; align-items: center; gap: 9px; height: 44px; padding: 0 12px; border-bottom: 1px solid var(--code-line); font-size: 12.5px; white-space: nowrap; }
.cs-h .gl { width: 24px; height: 24px; border-radius: 7px; flex: none; display: grid; place-items: center; background: #1E2A44; color: var(--code-fn); font: 700 9.5px/1 var(--body); letter-spacing: .02em; }
.cs-h b { color: #fff; font-weight: 600; font-size: 13px; }
.cs-h .mt { color: var(--code-dim); font-size: 11.5px; overflow: hidden; text-overflow: ellipsis; }
.cs-h .rs { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--code-dim); }
.cs-h .rs i { width: 7px; height: 7px; border-radius: 50%; background: var(--code-com); }
.cs-h .rs.ready i { background: var(--code-pass); }
.cs-h .rs.loading i { background: var(--code-num); animation: pulse 1s infinite; }
.cs-ed { display: grid; grid-template-columns: 44px minmax(0, 1fr); max-height: calc(22 * 1.7em + 28px); overflow: auto; font: var(--t-code); }
.cs-ed .gut { padding: 14px 12px 14px 0; text-align: right; color: var(--code-gutter); white-space: pre; user-select: none; }
.cs-ed .area { position: relative; min-width: 0; }
.cs-ed pre, .cs-ed textarea { margin: 0; padding: 14px 16px 14px 0; border: 0; font: inherit; letter-spacing: 0; white-space: pre; tab-size: 2; min-height: calc(8 * 1.7em + 28px); }
.cs-ed pre { pointer-events: none; color: var(--code-text); overflow: visible; }
.cs-ed textarea { position: absolute; inset: 0; width: 100%; height: 100%; resize: none; overflow: hidden; background: transparent; color: transparent; caret-color: var(--lime); outline: none; }
.cs-ed textarea::selection { background: rgb(35 64 230 / 0.6); color: transparent; }
.cs-ed:focus-within { box-shadow: inset 0 0 0 1.5px rgb(198 242 78 / 0.5); }
.tk-k { color: var(--code-kw); } .tk-f { color: var(--code-fn); } .tk-s { color: var(--code-str); } .tk-n { color: var(--code-num); } .tk-c { color: var(--code-com); font-style: italic; }
.cs-tabs { display: flex; gap: 2px; padding: 0 10px; border-top: 1px solid var(--code-line); border-bottom: 1px solid var(--code-line); }
.cs-tabs button { padding: 10px 10px 8px; border-bottom: 2px solid transparent; font-size: 12.5px; color: #7C8290; }
.cs-tabs button[aria-selected="true"] { color: #fff; border-bottom-color: var(--lime); }
.cs-checks { margin: 0; padding: 6px 14px; list-style: none; min-height: 120px; }
.cs-checks li { display: grid; grid-template-columns: 16px minmax(0, 1fr); gap: 10px; padding: 9px 0; border-top: 1px solid rgb(255 255 255 / 0.06); }
.cs-checks li:first-child { border-top: 0; }
.cs-checks .st { width: 16px; height: 16px; margin-top: 1px; border-radius: 50%; display: grid; place-items: center; color: var(--code-bg); }
.cs-checks .st svg { width: 10px; height: 10px; display: none; }
.cs-checks [data-s="idle"] .st::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: #3A3F4B; }
.cs-checks [data-s="run"] .st { border: 2px solid #3A3F4B; border-top-color: var(--lime); animation: spin .7s linear infinite; }
.cs-checks [data-s="pass"] .st { background: var(--code-pass); animation: stamp .3s var(--ease-pop); }
.cs-checks [data-s="fail"] .st { background: var(--code-fail); animation: stamp .3s var(--ease-pop); }
.cs-checks [data-s="pass"] .st .y, .cs-checks [data-s="fail"] .st .x { display: block; }
.cs-checks .nm { font-size: 13px; line-height: 1.4; color: #C9CDD6; }
.cs-checks .dt { display: block; margin-top: 3px; font: 500 12px/1.5 var(--mono); color: var(--code-dim); white-space: pre-wrap; }
.cs-checks [data-s="fail"] .dt { color: #FF9D85; }
.cs-console { margin: 0; padding: 12px 16px; min-height: 120px; max-height: 240px; overflow: auto; font: 500 12.5px/1.6 var(--mono); white-space: pre-wrap; }
.cs-console .err { color: #FF9D85; }
.cs-foot { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: var(--code-bg-2); border-top: 1px solid var(--code-line); }
.cs-run { height: 36px; padding: 0 14px 0 10px; border-radius: 10px; display: inline-flex; align-items: center; gap: 7px; background: var(--lime); color: var(--ink); font: 700 13px/1 var(--body); transition: transform var(--d-press), background var(--d-fast); }
.cs-run:hover { background: var(--lime-hover); }
.cs-run:active { transform: scale(.96); }
.cs-run svg { width: 11px; height: 11px; }
.cs-kbd { font: 500 11px/1 var(--mono); color: var(--code-gutter); }
.cs-st { min-width: 0; font: 500 12px/1 var(--mono); color: var(--code-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cs-st.good { color: var(--code-pass); } .cs-st.bad { color: var(--code-fail); }
.cs-foot .grow { flex: 1; }
.cs-ghost { height: 32px; padding: 0 12px; border-radius: 9px; font-size: 12.5px; color: var(--code-dim); box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.12); }
.cs-ghost[aria-disabled="true"] { opacity: .45; cursor: not-allowed; }
.cs-result { width: 100%; border-collapse: collapse; font: 500 12.5px/1.4 var(--mono); }
.cs-result th { text-align: left; padding: 8px 12px; color: var(--lime); border-bottom: 1.5px solid rgb(198 242 78 / 0.5); font-weight: 600; }
.cs-result td { padding: 7px 12px; border-bottom: 1px solid var(--code-line); }
@media (max-width: 640px) { .cs-ed { font-size: 13px; grid-template-columns: 34px minmax(0, 1fr); } .cs-kbd { display: none; } }
```

### 5.6 Quiz (single and multi)

The real `story.css .op` options, at reading size. One question per row group; "Question 1 of
4" tag; multi shows "Select all that apply · 2 are right". The header shows "Answers checked
against your slides" as a quiet tag (the receipts promise, visible where it matters).

- Option: 54px min, r14, hairline 0.12, a 28px key circle (A, B, C) or rounded square for
  multi. Hover: sunken fill. Selected: 1.5px ink ring, ink key.
- Check: ink pill sm "Check" (mute until something is selected). After checking:
  right = lime-soft + lime-2 ring + lime key with `i-check`; your wrong pick = coral-soft +
  coral ring + coral-ink key with `i-x` + a 320ms shake; a right answer you missed (multi) =
  lime-2 ring with faint lime hatching and a "Missed" tag.
- Explanation (`.why`) slides open under the options: "Why" eyebrow, one or two sentences,
  and a cite chip to the exact page. Lime-soft when right, sunken when wrong.
- "Try again" ghost reshuffles the options. Passing increments the header tag ("2/4 passed")
  with the stamp animation and turns the table-of-blocks node lime.

```css
.q { display: grid; gap: 12px; }
.q + .q { margin-top: 22px; padding-top: 22px; border-top: 1px solid var(--line); }
.q-q { margin: 0; font: 600 18px/1.4 var(--body); color: var(--text); text-wrap: pretty; }
.opts { display: grid; gap: 8px; margin: 0; padding: 0; border: 0; }
.opt { position: relative; display: grid; grid-template-columns: 28px minmax(0, 1fr) auto; align-items: center; gap: 12px; min-height: 54px; padding: 10px 16px 10px 12px; border-radius: var(--r-row); background: var(--surface); box-shadow: var(--hair-strong); font: 500 15.5px/1.4 var(--body); color: var(--ink-3); cursor: pointer; text-align: left; transition: background var(--d-fast), box-shadow var(--d-fast), transform var(--d-press); }
.opt input { position: absolute; opacity: 0; pointer-events: none; }
.opt .k { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; box-shadow: inset 0 0 0 1.5px rgb(11 13 16 / 0.16); font: 600 12.5px/1 var(--display); color: var(--text-3); transition: background var(--d-fast), color var(--d-fast); }
.q.multi .opt .k { border-radius: 8px; }
.opt:hover { background: var(--sunken); }
.opt:active { transform: scale(.995); }
.opt.sel { box-shadow: var(--hair-ink); color: var(--ink); }
.opt.sel .k { background: var(--ink); color: #fff; box-shadow: none; }
.opt:has(input:focus-visible) { outline: 3px solid var(--ink); outline-offset: 2px; }
.opt.right { background: var(--ok-fill); box-shadow: var(--ok-ring); color: var(--ink); }
.opt.right .k { background: var(--lime); color: var(--ink); box-shadow: none; }
.opt.wrong { background: var(--bad-fill); box-shadow: var(--bad-ring); color: var(--ink); animation: shake .32s var(--ease-out); }
.opt.wrong .k { background: var(--coral-ink); color: #fff; box-shadow: none; }
.opt.missed { box-shadow: inset 0 0 0 1.5px var(--lime-2); background-image: repeating-linear-gradient(135deg, transparent 0 8px, rgb(198 242 78 / 0.14) 8px 16px); }
.opt .flag { font: 600 11.5px/1 var(--body); color: var(--lime-ink); }
.opt.wrong .flag { color: var(--coral-ink); }
.q-f { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; }
.why { display: grid; grid-template-rows: 0fr; transition: grid-template-rows var(--d-slow) var(--ease-out); }
.why.open { grid-template-rows: 1fr; }
.why > div { overflow: hidden; }
.why .wb { margin-top: 4px; padding: 14px 16px; border-radius: var(--r-row); background: var(--lime-soft); font: 400 14.5px/1.55 var(--body); color: var(--ink-3); }
.why.bad .wb { background: var(--sunken); box-shadow: var(--hair); }
.why .we { display: block; margin-bottom: 4px; font: var(--t-eyebrow); letter-spacing: var(--track-eyebrow); text-transform: uppercase; color: var(--lime-ink); }
.why.bad .we { color: var(--text-2); }
```

### 5.7 Flashcards (3D flip, Again / Hard / Good / Easy)

The deck is the hero of factual lessons; it should feel physical.

- Deck: `min(100%, 560px)` wide, 16:10, two ghost cards peeking behind (rotated -2.5° and
  1.8°, scaled .96/.98) so it reads as a stack.
- Front: white r24, term centred in Space Grotesk 600 `clamp(22px, 3vw, 32px)`, corner labels
  "CARD" (eyebrow) and "3 / 12", footer hint "Tap or press Space". Back: **cobalt gradient**
  r24, answer in Inter 500 19px white, lime "ANSWER" corner, optional example line at 72%
  white, cite chip (on-dark variant). Flip = `rotateY(180deg)` over 600ms `--ease-io`
  (`perspective: 1400px`, `backface-visibility: hidden`, no transition under reduced motion).
- After the flip, the rating row rises in (opacity + 8px): **Again** (coral-soft / coral-ink),
  **Hard** (fill / ink-3), **Good** (cobalt-soft / cobalt), **Easy** (lime / ink). Each shows
  the next interval underneath from SM-2 ("<1 min", "1 day", "3 days", "6 days"). Keys 1-4.
- Rating flies the card out (Again to the left with -12°, others to the right with 10°,
  360ms) and the next card is dealt from the stack (`deal`, `--ease-pop`).
- Progress dots under the deck (lime-2 = good/easy, coral = again, ink ring = current).
- End: "Deck done · 9 remembered, 3 to see again" + "They come back tomorrow" + link "Also in
  deck.apkg". SM-2 state persists in `bm:<course>:srs` and drives the plan strip's review dots.

```css
.fc { display: grid; justify-items: center; gap: 18px; }
.fc-deck { position: relative; width: min(100%, 560px); aspect-ratio: 16 / 10; perspective: 1400px; }
.fc-deck::before, .fc-deck::after { content: ""; position: absolute; inset: 0; border-radius: 24px; background: var(--surface); box-shadow: var(--hair-strong); }
.fc-deck::before { transform: translateY(16px) rotate(-2.5deg) scale(.96); opacity: .65; }
.fc-deck::after { transform: translateY(8px) rotate(1.8deg) scale(.98); opacity: .9; }
.fc-card { position: absolute; inset: 0; z-index: 1; transform-style: preserve-3d; transition: transform var(--d-flip) var(--ease-io); cursor: pointer; }
.fc-card.flipped { transform: rotateY(180deg); }
.fc-card:focus-visible { outline: none; }
.fc-card:focus-visible .fc-face { box-shadow: var(--hair-strong), 0 0 0 4px var(--ink); }
.fc-face { position: absolute; inset: 0; display: grid; place-items: center; padding: 40px 44px; border-radius: 24px; text-align: center; -webkit-backface-visibility: hidden; backface-visibility: hidden; }
.fc-front { background: var(--surface); box-shadow: var(--hair-strong), var(--sh-lift); }
.fc-front p { margin: 0; font: 600 clamp(22px, 3vw, 32px)/1.15 var(--display); letter-spacing: -0.025em; color: var(--text); text-wrap: balance; }
.fc-back { transform: rotateY(180deg); background: var(--cobalt-grad); color: #fff; box-shadow: var(--sh-slab); }
.fc-back p { margin: 0; max-width: 36ch; font: 500 19px/1.45 var(--body); }
.fc-back .ex { margin-top: 10px; font-size: 14.5px; color: rgb(255 255 255 / 0.72); }
.fc-face .corner, .fc-face .count { position: absolute; top: 16px; font: var(--t-eyebrow); letter-spacing: var(--track-eyebrow); text-transform: uppercase; color: var(--text-3); }
.fc-face .corner { left: 18px; } .fc-face .count { right: 18px; }
.fc-back .corner { color: var(--lime); } .fc-back .count { color: rgb(255 255 255 / 0.6); }
.fc-face .hint { position: absolute; left: 0; right: 0; bottom: 16px; font: var(--t-cap); color: var(--text-3); }
.fc-card.deal { animation: deal 360ms var(--ease-pop) both; }
@keyframes deal { from { transform: translateY(16px) scale(.95); opacity: .5; } }
.rate { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; width: min(100%, 560px); opacity: 0; translate: 0 8px; pointer-events: none; transition: opacity var(--d-base), translate var(--d-base) var(--ease-out); }
.fc.flipped .rate { opacity: 1; translate: 0 0; pointer-events: auto; }
.rate button { display: grid; gap: 4px; justify-items: center; align-content: center; height: 60px; border-radius: 16px; font: 600 14.5px/1 var(--body); transition: transform var(--d-press), filter var(--d-fast); }
.rate button:hover { filter: brightness(.97); }
.rate button:active { transform: scale(.96); }
.rate small { font: 500 11.5px/1 var(--body); opacity: .8; }
.rate .again { background: var(--coral-soft); color: var(--coral-ink); }
.rate .hard { background: var(--fill); color: var(--ink-3); }
.rate .good { background: var(--cobalt-soft); color: var(--cobalt); }
.rate .easy { background: var(--lime); color: var(--ink); }
.fc-dots { display: flex; flex-wrap: wrap; justify-content: center; gap: 5px; }
.fc-dots i { width: 8px; height: 8px; border-radius: 50%; background: var(--dot-idle); }
.fc-dots i.good { background: var(--lime-2); } .fc-dots i.again { background: var(--coral); } .fc-dots i.now { background: var(--surface); box-shadow: inset 0 0 0 2px var(--ink); }
```

Fly-out: wrap `.fc-card` in a `.fc-fly` element (`position:absolute; inset:0; z-index:1`) and
animate the wrapper, not the card, so the flip's `rotateY` never mirrors the throw direction:
`.fc-fly.out-l { transform: translateX(-120%) rotate(-12deg); opacity: 0; }`,
`.fc-fly.out-r { transform: translateX(120%) rotate(10deg); opacity: 0; }`, 360ms `--ease-out`.
After `transitionend`, swap the content, un-flip without transition, and add `.deal`.

### 5.8 Cloze

The sentence stays a sentence: gaps are inline inputs sized to the answer (`--w` = answer
length in ch), with a cobalt underline, so the paragraph keeps its rhythm. An optional word
bank under it (tap a chip to fill the focused gap; used chips go dashed). Check: right gaps
turn lime-soft with lime-ink text; wrong gaps go coral-soft and struck, and the right word
pops above in a small ink tag. Matching is case- and whitespace-insensitive with the
engine-provided alternatives.

```css
.cz { font: var(--t-read); color: var(--text-body); }
.gap { position: relative; display: inline-block; vertical-align: baseline; margin: 0 2px; }
.gap input { width: calc(var(--w, 8) * 1ch + 1.4em); height: 1.75em; padding: 0 .5em; border: 0; border-radius: 8px 8px 4px 4px; background: var(--fill-2); box-shadow: inset 0 -2px 0 var(--cobalt); font: 600 .95em/1 var(--body); color: var(--ink); text-align: center; transition: background var(--d-fast), box-shadow var(--d-fast); }
.gap input:focus { outline: none; background: var(--surface); box-shadow: inset 0 0 0 2px var(--cobalt); }
.gap.ok input { background: var(--lime-soft); box-shadow: inset 0 -2px 0 var(--lime-2); color: var(--lime-ink); }
.gap.bad input { background: var(--coral-soft); box-shadow: inset 0 -2px 0 var(--coral); color: var(--coral-ink); text-decoration: line-through; }
.gap .fix { position: absolute; left: 50%; bottom: calc(100% + 6px); translate: -50% 0; padding: 5px 9px; border-radius: 8px; background: var(--ink); color: #fff; font: 600 12.5px/1 var(--body); white-space: nowrap; animation: pop .3s var(--ease-pop-2); }
.bank { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.bank button { height: 36px; padding: 0 14px; border-radius: 99px; background: var(--surface); box-shadow: var(--hair-strong); font: 600 14px/1 var(--body); color: var(--ink-3); transition: transform var(--d-press), box-shadow var(--d-fast); }
.bank button:hover { box-shadow: inset 0 0 0 1.5px var(--cobalt-line); }
.bank button.used { background: transparent; box-shadow: none; outline: 1.5px dashed var(--rule-strong); outline-offset: -1.5px; color: var(--text-3); }
```


### 5.9 Ordering (drag)

Rows you can pick up. Pointer Events (one code path for mouse and touch), not HTML5
drag-and-drop (no touch support, ugly ghost image).

- Row: 56px min, white r14, hairline 0.12; grip (six dots, `--text-3`) on the left, position
  chip 26px, text 15.5px. Only the grip has `touch-action: none`, so the page still scrolls on
  phones.
- Dragging: the row lifts (scale 1.02, `--sh-lift`, rotate 0.6°), a dashed lime-2 placeholder
  with `--lime-wash` fill holds its slot, siblings slide with a 200ms FLIP.
- Keyboard: Space on the grip picks up (`aria-pressed="true"`, live region "Picked up 'Hash
  the key'. Position 3 of 5. Arrow keys move, Space drops."), arrows move, Space drops, Esc
  cancels.
- Check: rows in the right place go lime-soft with a lime check chip; wrong ones go
  coral-soft with a "goes 2nd" tag. "Show the right order" animates every row into place (FLIP
  500ms, 60ms stagger). That last animation is the satisfying bit; keep it.

```css
.ord { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.ord li { position: relative; display: grid; grid-template-columns: 22px 26px minmax(0, 1fr) auto; align-items: center; gap: 10px; min-height: 56px; padding: 8px 14px 8px 8px; border-radius: var(--r-row); background: var(--surface); box-shadow: var(--hair-strong); font: 500 15.5px/1.4 var(--body); color: var(--ink-3); transition: background var(--d-fast), box-shadow var(--d-fast); }
.ord .grip { width: 22px; height: 32px; display: grid; place-items: center; color: var(--text-3); cursor: grab; touch-action: none; border-radius: 6px; }
.ord .grip:hover { background: var(--fill); }
.ord .pos { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; background: var(--fill-2); font: 600 12px/1 var(--display); color: var(--text-2); }
.ord li.lift { z-index: 5; background: var(--surface); box-shadow: var(--hair-ink), var(--sh-lift); transform: scale(1.02) rotate(.6deg); cursor: grabbing; }
.ord li.ph { background: var(--lime-wash); box-shadow: none; outline: 1.5px dashed var(--lime-2); outline-offset: -1.5px; }
.ord li.ph > * { visibility: hidden; }
.ord li.ok { background: var(--ok-fill); box-shadow: var(--ok-ring); color: var(--ink); }
.ord li.ok .pos { background: var(--lime); color: var(--ink); }
.ord li.bad { background: var(--bad-fill); box-shadow: var(--bad-ring); color: var(--ink); }
.ord li.bad .pos { background: var(--coral-ink); color: #fff; }
```

### 5.10 Matching

Two columns: terms on the left as **ink chips**, meanings on the right as white cards. Tap a
term (it gets the lime hot ring), tap a meaning: an SVG curve draws between them (cobalt 2px
with 6px end dots, 300ms dashoffset draw) and both get a small numbered badge. Tap a paired
item to unpair. Check: correct links go lime-2 3px solid, wrong ones coral dashed with the
pair shaking once; "3 of 4 matched". Under 600px the columns stack and each term gets a
"Choose its meaning" button that opens a bottom sheet of meanings (no lines on phones).

```css
.mx { position: relative; display: grid; grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr); gap: 12px clamp(40px, 8vw, 96px); }
.mx-col { display: grid; gap: 8px; align-content: start; }
.mx-l { position: relative; display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 10px 14px; border-radius: var(--r-node); background: var(--ink); color: #fff; font: 600 14.5px/1.3 var(--body); text-align: left; box-shadow: var(--sh-milestone); transition: box-shadow var(--d-fast), transform var(--d-press); }
.mx-l.hot { box-shadow: var(--sh-milestone), var(--ring-hot); }
.mx-r { position: relative; min-height: 48px; padding: 10px 14px; border-radius: var(--r-node); background: var(--surface); box-shadow: var(--hair-strong); font: 400 14.5px/1.45 var(--body); color: var(--ink-3); text-align: left; transition: box-shadow var(--d-fast); }
.mx-r:hover { box-shadow: inset 0 0 0 1.5px var(--cobalt-line); }
.mx .badge { position: absolute; top: -7px; width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; background: var(--cobalt); color: #fff; font: 700 10.5px/1 var(--display); }
.mx-l .badge { right: -7px; } .mx-r .badge { left: -7px; }
.mx-wires { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
.mx-wires path { fill: none; stroke: var(--cobalt); stroke-width: 2; stroke-linecap: round; }
.mx-wires circle { fill: var(--cobalt); }
.mx-wires .ok { stroke: var(--lime-2); stroke-width: 3; } .mx-wires .ok + circle { fill: var(--lime-2); }
.mx-wires .bad { stroke: var(--coral); stroke-dasharray: 5 5; }
.mx-r.ok { background: var(--ok-fill); box-shadow: var(--ok-ring); }
.mx-r.bad { background: var(--bad-fill); box-shadow: var(--bad-ring); animation: shake .32s var(--ease-out); }
@media (max-width: 600px) { .mx { grid-template-columns: minmax(0, 1fr); } .mx-wires { display: none; } }
```

### 5.11 Timeline

A vertical rail (the path's language again). `when` sits left in Space Grotesk 600 cobalt,
tabular, right-aligned in an 88px column; a 14px dot on a 2px rail; title 16px 600 and detail
14.5px text-2 on the right. As you scroll, an ink fill runs down the rail and each dot pops
lime-2 when it passes the middle of the viewport. Events marked `turning: true` get a
bigger dot with an ink ring and a lime "Turning point" tag. Use CSS scroll-driven animation
where supported (`animation-timeline: view()`), IntersectionObserver classes otherwise. On
phones the `when` moves above the title.

```css
.tl { position: relative; margin: 0; padding: 0; list-style: none; display: grid; gap: 22px; --col: 88px; }
.tl::before { content: ""; position: absolute; left: calc(var(--col) + 21px); top: 8px; bottom: 8px; width: 2px; background: var(--rule-strong); border-radius: 2px; }
.tl .run { position: absolute; left: calc(var(--col) + 21px); top: 8px; width: 2px; height: var(--run, 0px); background: var(--ink); border-radius: 2px; transition: height var(--d-slow) var(--ease-out); }
.tl li { position: relative; display: grid; grid-template-columns: var(--col) 44px minmax(0, 1fr); align-items: start; }
.tl .when { padding-top: 1px; text-align: right; font: 600 14px/1.3 var(--display); color: var(--cobalt); font-variant-numeric: tabular-nums; }
.tl .pt { justify-self: center; position: relative; z-index: 1; width: 14px; height: 14px; margin-top: 3px; border-radius: 50%; background: var(--surface); box-shadow: inset 0 0 0 2px var(--rule-strong); transition: background var(--d-base), box-shadow var(--d-base), transform var(--d-base) var(--ease-pop); }
.tl li.in .pt { background: var(--lime-2); box-shadow: none; transform: scale(1.1); }
.tl li.turn .pt { width: 20px; height: 20px; margin-top: 0; box-shadow: inset 0 0 0 2px var(--ink); }
.tl li.turn.in .pt { background: var(--lime); box-shadow: inset 0 0 0 2px var(--ink), var(--ring-halo); }
.tl .tt { margin: 0; font: 600 16px/1.35 var(--body); color: var(--text); }
.tl .dd { margin: 4px 0 0; font: 400 14.5px/1.55 var(--body); color: var(--text-2); }
@media (max-width: 640px) { .tl { --col: 0px; } .tl li { grid-template-columns: 30px minmax(0, 1fr); } .tl::before, .tl .run { left: 14px; } .tl .when { grid-column: 2; text-align: left; margin-bottom: 2px; } .tl .pt { grid-row: 1 / span 3; grid-column: 1; } }
```

### 5.12 Worked example (step reveal)

- Problem: a cobalt-soft panel r18, "Problem" eyebrow in cobalt, the problem in Inter 500
  17px ink.
- Steps on a rail (ink number circles joined by a 2px line). Each step: the **expression** in
  a small ink code strip (mono 14px, the code-stage colours, r10) then the explanation in
  15.5px/1.6. Only step 1 shows at first.
- Footer: lime `.pill.sm` "Next step" with a counter tag "2 / 5", and "Show all" as a quiet
  text button. A new step opens with `grid-template-rows: 0fr → 1fr` (500ms) and fades in; its
  number circle turns lime as the previous one turns ink-on-lime-check.
- After the last step: the **answer band** (lime, r16, "Answer" eyebrow, Space Grotesk 600
  22px) and "Common mistakes" (coral-ink eyebrow, list with coral x icons).

```css
.wx-prob { padding: 16px 18px; border-radius: var(--r-sm); background: var(--cobalt-soft); }
.wx-prob .we { font: var(--t-eyebrow); letter-spacing: var(--track-eyebrow); text-transform: uppercase; color: var(--cobalt); }
.wx-prob p { margin: 6px 0 0; font: 500 17px/1.5 var(--body); color: var(--ink); }
.wx-steps { position: relative; margin: 18px 0 0; padding: 0; list-style: none; display: grid; }
.wx-steps > li { display: grid; grid-template-rows: 0fr; opacity: 0; transition: grid-template-rows var(--d-slow) var(--ease-out), opacity var(--d-base); }
.wx-steps > li.shown { grid-template-rows: 1fr; opacity: 1; }
.wx-steps > li > div { overflow: hidden; display: grid; grid-template-columns: 30px minmax(0, 1fr); gap: 14px; padding-bottom: 18px; position: relative; }
.wx-steps > li > div::before { content: ""; position: absolute; left: 14px; top: 32px; bottom: 2px; width: 2px; background: var(--rule-strong); }
.wx-steps > li:last-child > div::before { display: none; }
.wx-n { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; background: var(--ink); color: #fff; font: 600 13px/1 var(--display); }
.wx-steps > li.done .wx-n { background: var(--lime); color: var(--ink); }
.wx-expr { margin: 2px 0 8px; padding: 10px 14px; border-radius: 10px; background: var(--code-bg); color: var(--code-text); font: var(--t-code); white-space: pre-wrap; overflow-x: auto; }
.wx-why { margin: 0; font: 400 15.5px/1.6 var(--body); color: var(--text-body); }
.wx-ans { margin-top: 6px; padding: 16px 18px; border-radius: 16px; background: var(--lime); color: var(--ink); animation: stamp .45s var(--ease-pop); }
.wx-ans .we { font: var(--t-eyebrow); letter-spacing: var(--track-eyebrow); text-transform: uppercase; color: rgb(11 13 16 / 0.62); }
.wx-ans b { display: block; margin-top: 4px; font: 600 22px/1.2 var(--display); letter-spacing: -0.02em; }
.wx-miss { margin: 16px 0 0; padding: 0; list-style: none; display: grid; gap: 6px; }
.wx-miss li { display: grid; grid-template-columns: 18px 1fr; gap: 8px; font: 400 14.5px/1.5 var(--body); color: var(--ink-3); }
.wx-miss svg { width: 14px; height: 14px; margin-top: 3px; color: var(--coral-ink); }
```

### 5.13 Speaking drill

The block that makes "voice" visible in the demo. One phrase card at a time, with a dot pager.

- **Phrase**: Space Grotesk 600 `clamp(24px, 2.6vw, 34px)` ink; translation 15px text-2;
  phonetic 14px italic text-3.
- **Controls** (centred row): **Native** (52px ink circle, speaker icon; while playing, three
  lime equaliser bars dance inside it) · **Record** (64px lime circle, ink mic: the one big
  action; while recording it turns ink with a coral dot and the lime `ping` ring, label
  "Listening… tap to stop") · **Yours** (40px hairline circle, appears after a take).
- **Live waveform** while recording: 32 ink bars driven by an AnalyserNode on the mic stream
  (mic streams are not cross-origin tainted, so this works where the narration analyser
  does not).
- **Result**: a 56px score ring (lime-2 ≥ 80, amber 50-79, coral below), "Heard: “…”"
  13.5px text-3, then the target words: matched in `--green-ink` with a 3px lime-soft
  underline, missed in text-3 with a wavy coral underline. One-line tip with a cobalt
  sparkle (the SaaS coach prompt; on file:// a canned tip by score band).
- **Fallback** (no speech recognition, i.e. file:// or Firefox): the result area becomes
  "Compare by ear": Native / Yours play buttons side by side and three self-rating chips
  ("Nailed it", "Close", "Again") that feed the SRS. Message: "Scoring needs the course opened
  from localhost; you can still record and compare." Never a dead button.

```css
.spk-card { display: grid; justify-items: center; gap: 6px; padding: clamp(18px, 3vw, 32px) 16px; border-radius: var(--r-sm); background: var(--surface-2); box-shadow: var(--hair); text-align: center; }
.spk-ph { margin: 0; font: 600 clamp(24px, 2.6vw, 34px)/1.15 var(--display); letter-spacing: -0.025em; color: var(--text); text-wrap: balance; }
.spk-tr { margin: 0; font: 400 15px/1.45 var(--body); color: var(--text-2); }
.spk-pn { margin: 0; font: italic 400 14px/1.4 var(--body); color: var(--text-3); }
.spk-ctl { display: flex; align-items: center; justify-content: center; gap: 18px; margin-top: 18px; }
.spk-nat { width: 52px; height: 52px; border-radius: 50%; display: grid; place-items: center; background: var(--ink); color: #fff; box-shadow: var(--sh-play); }
.spk-rec { position: relative; width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; background: var(--lime); color: var(--ink); box-shadow: 0 14px 28px -12px rgb(100 140 10 / 0.6); transition: transform var(--d-press), background var(--d-fast); }
.spk-rec svg { width: 24px; height: 24px; }
.spk-rec:active { transform: scale(.95); }
.spk-rec.on { background: var(--ink); color: #fff; animation: ping 1.3s ease-out infinite; }
.spk-rec.on::after { content: ""; position: absolute; top: 12px; right: 12px; width: 10px; height: 10px; border-radius: 50%; background: var(--coral); animation: pulse 1s infinite; }
.spk-you { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; background: var(--surface); box-shadow: var(--hair-strong); color: var(--ink-3); }
.spk-wave { display: flex; align-items: center; justify-content: center; gap: 3px; height: 36px; margin-top: 10px; }
.spk-wave i { width: 3px; height: 100%; border-radius: 3px; background: var(--ink); transform: scaleY(var(--v, .12)); transition: transform 60ms linear; }
.spk-res { display: grid; grid-template-columns: 56px minmax(0, 1fr); gap: 14px; align-items: center; margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--line); text-align: left; }
.spk-ring { --p: .86; --c: var(--lime-2); width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; background: radial-gradient(closest-side, var(--surface) 76%, transparent 77%), conic-gradient(var(--c) calc(var(--p) * 1turn), var(--fill-2) 0); font: 700 15px/1 var(--display); color: var(--ink); }
.spk-ring.mid { --c: #F2B233; } .spk-ring.low { --c: var(--coral); }
.spk-heard { margin: 0; font: 400 13.5px/1.4 var(--body); color: var(--text-3); }
.spk-words { display: flex; flex-wrap: wrap; gap: 2px 8px; margin-top: 4px; font: 500 17px/1.6 var(--body); }
.spk-words .ok { color: var(--green-ink); text-decoration: underline 3px var(--lime-soft); text-underline-offset: 4px; }
.spk-words .miss { color: var(--text-3); text-decoration: underline wavy var(--coral); text-underline-offset: 4px; }
.spk-tip { display: flex; gap: 8px; margin: 8px 0 0; font: 400 14px/1.45 var(--body); color: var(--ink-3); }
.spk-tip svg { width: 14px; height: 14px; flex: none; margin-top: 3px; color: var(--cobalt); }
```

### 5.14 Explorable (slider-driven chart)

The SaaS `playground` (sliders bound to a safe `compute(i)` formula), redrawn as the most
"alive" block. Wide card; desktop grid `320px | 1fr` (controls | chart), stacked on phones.

- Guidance sentence on top says what to look for ("Push the load factor past 0.75 and watch
  the probes").
- Sliders: label 13.5px 600 + value in Space Grotesk 600 16px cobalt (tabular) + unit; a custom
  range: 6px `--fill-2` track, cobalt fill up to the thumb (`--p` set by JS), 24px white thumb
  with a 2px ink ring and an 8px lime centre.
- Output: eyebrow label, the number in Space Grotesk 700 56px ink (tabular) + unit 18px text-2.
- Chart: 100% x 240 SVG. Dashed `#E5E7EE` grid, 11.5px axis labels, cobalt 2.5px line over a
  cobalt-to-transparent area (18% → 0), a dashed ink marker at the current value with a 10px
  lime dot (2px ink ring) and an ink value pill. The curve is the 28-point sweep of the first
  input (SaaS behaviour), recomputed (debounced 60ms) when another input changes.
- **Discovery**: when the payload has `discover: { input, op, value, say }` and the learner
  crosses it, a lime-soft band fills that zone of the chart and a lime chip slides in under
  the output: "You found it: " + `say`. It marks the block passed. This is the explorable's
  reason to exist; do not ship it without one.
- Reset ghost in the header. Runs in the same Blob worker as code, 1.5s timeout.

```css
.ex-grid { display: grid; grid-template-columns: 320px minmax(0, 1fr); gap: clamp(20px, 3vw, 40px); align-items: start; }
.ex-ctl { display: grid; gap: 18px; }
.ex-row { display: grid; gap: 8px; }
.ex-row label { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; font: 600 13.5px/1.2 var(--body); color: var(--ink-3); }
.ex-row output { font: 600 16px/1 var(--display); color: var(--cobalt); font-variant-numeric: tabular-nums; }
.range { --p: 50%; -webkit-appearance: none; appearance: none; width: 100%; height: 24px; background: transparent; cursor: pointer; }
.range::-webkit-slider-runnable-track { height: 6px; border-radius: 99px; background: linear-gradient(90deg, var(--cobalt) var(--p), var(--fill-2) var(--p)); }
.range::-moz-range-track { height: 6px; border-radius: 99px; background: var(--fill-2); }
.range::-moz-range-progress { height: 6px; border-radius: 99px; background: var(--cobalt); }
.range::-webkit-slider-thumb { -webkit-appearance: none; width: 24px; height: 24px; margin-top: -9px; border-radius: 50%; background: radial-gradient(circle, var(--lime) 0 4px, #fff 4.5px); box-shadow: inset 0 0 0 2px var(--ink), 0 4px 10px -2px rgb(11 13 16 / 0.3); transition: transform var(--d-press); }
.range::-moz-range-thumb { width: 24px; height: 24px; border: 0; border-radius: 50%; background: radial-gradient(circle, var(--lime) 0 4px, #fff 4.5px); box-shadow: inset 0 0 0 2px var(--ink), 0 4px 10px -2px rgb(11 13 16 / 0.3); }
.range:active::-webkit-slider-thumb { transform: scale(1.12); }
.range:focus-visible { outline: none; }
.range:focus-visible::-webkit-slider-thumb { box-shadow: inset 0 0 0 2px var(--ink), 0 0 0 4px rgb(198 242 78 / 0.8); }
.ex-out { padding-top: 14px; border-top: 1px solid var(--line); }
.ex-out .we { font: var(--t-eyebrow); letter-spacing: var(--track-eyebrow); text-transform: uppercase; color: var(--text-3); }
.ex-out b { display: block; margin-top: 6px; font: 700 56px/0.9 var(--display); letter-spacing: -0.04em; color: var(--ink); font-variant-numeric: tabular-nums; }
.ex-out b small { font: 500 18px/1 var(--body); letter-spacing: 0; color: var(--text-2); margin-left: 6px; }
.ex-chart { width: 100%; height: 240px; overflow: visible; }
.ex-chart .grid line { stroke: #E5E7EE; stroke-dasharray: 3 4; }
.ex-chart .ax { font: 500 11.5px/1 var(--body); fill: var(--text-3); }
.ex-chart .area { fill: url(#exArea); }   /* <linearGradient id="exArea"> cobalt .18 -> 0 */
.ex-chart .line { fill: none; stroke: var(--cobalt); stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }
.ex-chart .mark { stroke: var(--ink); stroke-width: 1; stroke-dasharray: 3 3; }
.ex-chart .dot { fill: var(--lime); stroke: var(--ink); stroke-width: 2; }
.ex-chart .zone { fill: var(--lime-soft); opacity: 0; transition: opacity var(--d-slow); }
.ex-chart .zone.on { opacity: 1; }
.ex-found { display: inline-flex; align-items: center; gap: 8px; margin-top: 12px; padding: 8px 14px 8px 8px; border-radius: 99px; background: var(--lime); color: var(--ink); font: 600 14px/1.3 var(--body); animation: pop .4s var(--ease-pop); }
.ex-found i { width: 24px; height: 24px; border-radius: 50%; background: var(--ink); color: var(--lime); display: grid; place-items: center; }
@media (max-width: 760px) { .ex-grid { grid-template-columns: minmax(0, 1fr); } }
```

### 5.15 Compare table

The `story.css .cmp` table at reading size. Wide card. Axes as uppercase 11px column
headers, item names in Space Grotesk 600 15px, cells 14.5px. The item the lesson recommends
for the common case is the `win` row (lime-soft with r10 ends). Under the table, "best for"
lines: target icon in cobalt, **name** — when to choose it. Under 640px: one card per item
(name as title, axes as `dt/dd`), best-for at the bottom of each card.

```css
.cmp-wrap { overflow-x: auto; margin: 0 -4px; padding: 0 4px; }
.cmp { width: 100%; border-collapse: separate; border-spacing: 0; font: 400 14.5px/1.5 var(--body); }
.cmp th { padding: 0 14px 10px; text-align: left; font: var(--t-eyebrow); letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-3); border-bottom: 1px solid var(--line); white-space: nowrap; }
.cmp td { padding: 13px 14px; vertical-align: top; color: var(--ink-3); border-bottom: 1px solid var(--line); }
.cmp td.k { font: 600 15px/1.25 var(--display); letter-spacing: -0.01em; color: var(--ink); white-space: nowrap; }
.cmp tr:hover td { background: var(--sunken); }
.cmp tr.win td { background: var(--lime-soft); border-bottom-color: transparent; }
.cmp tr.win td:first-child { border-radius: 10px 0 0 10px; }
.cmp tr.win td:last-child { border-radius: 0 10px 10px 0; }
.cmp tr.win td.k::after { content: "Our pick"; margin-left: 8px; padding: 3px 7px; border-radius: 99px; background: var(--lime); color: var(--ink); font: 600 10.5px/1 var(--body); vertical-align: 2px; }
.best { margin: 16px 0 0; padding: 0; list-style: none; display: grid; gap: 8px; }
.best li { display: grid; grid-template-columns: 18px 1fr; gap: 10px; font: 400 14.5px/1.5 var(--body); color: var(--ink-3); }
.best svg { width: 15px; height: 15px; margin-top: 3px; color: var(--cobalt); }
.best b { color: var(--ink); font-weight: 600; }
@media (max-width: 640px) { .cmp, .cmp tbody, .cmp tr, .cmp td { display: block; } .cmp thead { display: none; } .cmp tr { margin-bottom: 10px; padding: 12px 14px; border-radius: var(--r-row); box-shadow: var(--hair-strong); } .cmp td { padding: 4px 0; border: 0; } .cmp td:not(.k)::before { content: attr(data-axis); display: block; font: var(--t-eyebrow); letter-spacing: .06em; text-transform: uppercase; color: var(--text-3); margin-top: 6px; } .cmp tr.win { background: var(--lime-soft); box-shadow: var(--ok-ring); } .cmp tr.win td { background: none; border-radius: 0; } .cmp tr:hover td { background: none; } }
```

### 5.16 Summary: "what you can do now"

The lesson's closing statement, as a **lime slab** inside the column (wide measure). It turns
the objective list into proof: every line links to the block that proved it.

- `.display` at `--t-h1-sm`, ink: "NOW YOU CAN (o check)" with an ink `.hchip`.
- Items: 22px ink circle with a lime check + 17px 500 ink text + a small ink tag link
  "Proved in Check yourself · Q2" (scrolls to that block and flashes it). Items not yet
  proved show a hollow circle and the tag "Not yet tried".
- Footer: ink `.pill` "Next: Step 4 · Heaps" with lime arrow + quiet "8 cards come back
  tomorrow".

```css
.sum { padding: clamp(24px, 3vw, 40px) clamp(22px, 3vw, 40px); border-radius: var(--r-md); background: var(--lime-grad); color: var(--ink); }
.sum .display { font: var(--t-h1-sm); letter-spacing: var(--track-display); }
.sum ul { margin: 22px 0 0; padding: 0; list-style: none; display: grid; gap: 12px; }
.sum li { display: grid; grid-template-columns: 26px minmax(0, 1fr); gap: 12px; align-items: start; font: 500 17px/1.45 var(--body); }
.sum li .c { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; background: var(--ink); color: var(--lime); }
.sum li .c svg { width: 13px; height: 13px; }
.sum li.todo .c { background: transparent; box-shadow: inset 0 0 0 2px rgb(11 13 16 / 0.35); color: transparent; }
.sum li a { display: inline-flex; align-items: center; gap: 6px; margin-top: 6px; height: 24px; padding: 0 10px; border-radius: 99px; background: var(--ink); color: #fff; font: 600 11.5px/1 var(--body); }
.sum li.todo a { background: rgb(11 13 16 / 0.1); color: var(--ink); }
.sum .foot { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 18px; margin-top: 26px; font: 500 14px/1.4 var(--body); color: rgb(11 13 16 / 0.66); }
```

### 5.17 Citation chips

Inline, after the sentence or paragraph they support; also inside quiz explanations,
flashcard backs and the lesson head. A chip names the source short and the page: `L4 · p.12`.

- Chip: 22px pill, cobalt-soft, cobalt 11.5px 600 text, a 16px white circle with a file icon.
  Hover/focus: cobalt ring. On dark surfaces: `rgb(255 255 255 / .14)` fill, white text.
- Click/Enter opens a **popover** (320px, white r16, `--sh-popover`): header (28px cobalt-soft
  file tile, source title 13.5px 600, "Page 12" text-3), the **quoted passage** from the
  source (14px/1.55, 3px lime-2 left border, the matched phrase marked lime-soft), footer link
  pill "Open page 12" with `i-ext` → `sources/lecture-4.pdf#page=12` (new tab).
- The quote is what the verifier agent matched; showing it is the strongest "this is grounded"
  signal in the product. Never show a chip without a quote.

```css
.cite { display: inline-flex; align-items: center; gap: 5px; height: 22px; margin-left: 4px; padding: 0 8px 0 3px; border-radius: 99px; vertical-align: 0.12em; background: var(--cobalt-soft); color: var(--cobalt); font: 600 11.5px/1 var(--body); white-space: nowrap; transition: box-shadow var(--d-fast); }
.cite i { width: 16px; height: 16px; border-radius: 50%; background: #fff; display: grid; place-items: center; }
.cite i svg { width: 9px; height: 9px; }
.cite:hover, .cite[aria-expanded="true"] { box-shadow: inset 0 0 0 1.5px var(--cobalt); }
.on-dark .cite, .fc-back .cite, .slab .cite { background: rgb(255 255 255 / 0.14); color: #fff; }
.on-dark .cite i, .fc-back .cite i, .slab .cite i { background: rgb(255 255 255 / 0.2); color: #fff; }
.cite-pop { position: absolute; z-index: var(--z-popover); width: min(320px, calc(100vw - 32px)); padding: 14px 16px 12px; border-radius: 16px; background: var(--surface); box-shadow: var(--sh-popover); animation: pop .22s var(--ease-pop-2); }
.cite-pop .hd { display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 10px; align-items: center; }
.cite-pop .hd i { width: 28px; height: 28px; border-radius: 8px; background: var(--cobalt-soft); color: var(--cobalt); display: grid; place-items: center; font: 700 8.5px/1 var(--display); }
.cite-pop .hd b { font: 600 13.5px/1.25 var(--body); color: var(--ink); }
.cite-pop .hd small { display: block; font: 500 12px/1.2 var(--body); color: var(--text-3); }
.cite-pop blockquote { margin: 12px 0 10px; padding: 0 0 0 12px; border-left: 3px solid var(--lime-2); font: 400 14px/1.55 var(--body); color: var(--ink-3); }
.cite-pop blockquote mark { background: var(--lime-soft); color: var(--ink); border-radius: 3px; padding: 0 2px; }
```

### 5.18 Illustration with DOM pins (bonus; needed for the café onboarding course)

A generated picture with no text in it (product rule); labels are DOM pins over it, the
landing's `story.css .pin`: 14px lime dot with a 3px ink ring + an ink label (white 12px 600,
optional 10.5px sub-line). Pins appear one by one when the block enters the viewport (80ms
stagger). The permanent caption line "Illustration · drawn for this lesson, not a
photograph" stays (SaaS rule). Under 640px the sub-lines hide and labels shrink to 10.5px.

```css
.ill .pic { position: relative; border-radius: var(--r-row); overflow: hidden; aspect-ratio: var(--ar, 1100 / 614); background: var(--fill-2); }
.ill .pic img { width: 100%; height: 100%; object-fit: cover; }
.pin { position: absolute; display: flex; align-items: center; gap: 7px; transform: translate(-7px, -7px); }
.pin.r { flex-direction: row-reverse; transform: translate(calc(-100% + 7px), -7px); }
.pin i { width: 14px; height: 14px; flex: none; border-radius: 50%; background: var(--lime); box-shadow: 0 0 0 3px rgb(11 13 16 / 0.85); }
.pin span { padding: 5px 9px 6px; border-radius: 9px; background: rgb(11 13 16 / 0.86); color: #fff; font: 600 12px/1.15 var(--body); white-space: nowrap; }
.pin small { display: block; font-weight: 400; font-size: 10.5px; color: rgb(255 255 255 / 0.65); }
html.js .ill .pin { opacity: 0; transform: translate(-7px, -3px); }
.ill.in .pin { opacity: 1; transform: translate(-7px, -7px); transition: opacity .3s, transform .4s var(--ease-pop); transition-delay: calc(var(--i, 0) * 80ms); }
.ill .cap { margin: 10px 2px 0; font: var(--t-cap); color: var(--text-3); }
```

---

## 6. Completion moments

### 6.1 Lesson complete: "the path fills"

The moment the demo should land on. Sequence (total ~2.4s, every step skippable by clicking):

1. **Stamp** (0-450ms). The finish card's "Mark complete" morphs into a lime band reading
   "LESSON DONE." (Space Grotesk 700 uppercase 28px, ink `.hchip` check) with the `stamp`
   keyframe; 18 confetti bits burst from the button (lime, cobalt, ink, coral: white is
   invisible on the white page).
2. **Back to the path** (at 900ms, or on "Up next"). Route to `#/?from=l03`. The home renders
   with the path already scrolled (instantly, no smooth scroll) so the finished milestone sits
   at 40% of the viewport height.
3. **Milestone flips to done** (0-300ms on the home): ink card → white with lime-2 ring, the
   number becomes a check with `stamp`, the title strikes through.
4. **Lime run** (300-1200ms): `.p-run` height grows from the finished milestone to the next one
   (`--d-run` 900ms, `--ease-io`); the next milestone's ties light lime as the run reaches it.
5. **Token hop** (1200-1800ms): "You are here" jumps along an arc to the next milestone
   (WAAPI keyframes: `translate(0,0)` → `translate(dx/2, -28px)` → `translate(dx, dy)`, 600ms,
   `--ease-pop`), the next milestone takes `.cur` with two pulses of `--ring-hot`.
6. **Call to action** (1800ms+): a lime `.pill.sm` "Continue · Step 4, Heaps" attaches under the
   new current milestone; the top-bar ring ticks; today's dot in the plan strip turns lime-2.
   If a chapter just ended, its chapter pill flashes lime once.

### 6.2 Course complete: "PATH DONE."

Triggered when the last milestone is marked done (or the lit finish pill is clicked later).

- Backdrop `--backdrop` + blur 10px. A cobalt slab (beams + grain), `min(1100px, 100vw - 2 *
  var(--gut))` wide, `min(680px, 100svh - 48px)` tall, pops in (`pop`, 420ms, `--ease-pop-2`).
- Copy (left 58%): `.eb.on-dark` "Data Structures Final · 9 of 9 steps"; `.display.hero`
  "PATH (o check) DONE." with "DONE." in lime; lede "You're ready for Friday."; the hero's stats
  row, now in past tense: "31 lessons", "42 checks passed", "2h 42m listened", "88 cards in
  your deck"; actions: lime `.pill.lg` "Review tomorrow's 12 cards" + `.pill.ghost-dark`
  "Back to the path".
- **Trophy** (`obj-trophy.webp`, embedded): `width: min(34vw, 420px)`, right side, breaking
  out of the slab's top edge by ~14%, a lime glow disc behind it (`--lime-glow`, blur 24px,
  static). Entry: from `translateY(-70px) rotate(-14deg) scale(.82)` to `rotate(8deg)`
  over 900ms `--ease-pop`, then the 6s drift loop.
- **Confetti**: 80 pieces from both bottom corners of the slab, colours lime, white, ink,
  coral (on cobalt all four read), 8x8 squares r2 and 4x12 strips, WAAPI with random end x,
  y, rotation, 1.6-2.4s, removed on finish. None under reduced motion.
- **Voice line** (cheap delight, P2): the engine records one extra TTS clip in the course
  voice, "Path done. You're ready for Friday.", played once when the slab appears (only if
  the learner has played narration before in this session, so it never surprises).
- Behind the overlay, the path's finish pill is lit (`.p-fin.lit`) and stays lit.

```css
.done-ov { position: fixed; inset: 0; z-index: var(--z-dialog); display: grid; place-items: center; padding: 24px var(--gut); background: var(--backdrop); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); }
.done-slab { position: relative; isolation: isolate; width: min(1100px, 100%); min-height: min(680px, calc(100svh - 48px)); display: grid; grid-template-columns: minmax(0, 58%) minmax(0, 42%); border-radius: var(--r-card); background: var(--cobalt-grad); color: #fff; box-shadow: var(--sh-dialog); animation: pop .42s var(--ease-pop-2); }
.done-slab .copy { padding: clamp(32px, 5vw, 72px) 20px clamp(32px, 5vw, 64px) clamp(28px, 4vw, 64px); display: flex; flex-direction: column; justify-content: center; gap: 22px; }
.done-slab .glow { position: absolute; right: 6%; top: 4%; width: 46%; aspect-ratio: 1; border-radius: 50%; background: var(--lime-glow); filter: blur(24px); opacity: .7; z-index: -1; }
.done-slab .trophy { position: absolute; right: 6%; top: -14%; width: min(34vw, 420px); filter: var(--drop-obj); animation: trophy .9s var(--ease-pop) both, drift 6s ease-in-out .9s infinite alternate; }
@keyframes trophy { from { transform: translateY(-70px) rotate(-14deg) scale(.82); opacity: 0; } to { transform: rotate(8deg); opacity: 1; } }
.confetti { position: fixed; inset: 0; z-index: var(--z-confetti); pointer-events: none; overflow: hidden; }
.confetti i { position: absolute; width: 8px; height: 8px; border-radius: 2px; will-change: transform, opacity; }
.confetti i.strip { width: 4px; height: 12px; }
@media (max-width: 900px) { .done-slab { grid-template-columns: minmax(0, 1fr); } .done-slab .trophy { width: 150px; top: -54px; right: 16px; } .done-slab .copy { padding-top: 96px; } }
```

```js
// confetti: ~25 lines, no library. colours = ['#C6F24E', '#FFFFFF', '#0B0D10', '#FF5A3C']
function confetti(x, y, n = 80, colours) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = document.createElement('div'); box.className = 'confetti'; document.body.append(box);
  const runs = [];
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i'); if (i % 3 === 0) p.className = 'strip';
    p.style.background = colours[i % colours.length]; p.style.left = x + 'px'; p.style.top = y + 'px'; box.append(p);
    const dx = (Math.random() - .5) * 900, up = -(260 + Math.random() * 420), fall = 520 + Math.random() * 380, r = (Math.random() - .5) * 1080;
    runs.push(p.animate([
      { transform: 'translate(0,0) rotate(0)', opacity: 1 },
      { transform: `translate(${dx * .6}px, ${up}px) rotate(${r * .5}deg)`, opacity: 1, offset: .35 },
      { transform: `translate(${dx}px, ${up + fall}px) rotate(${r}deg)`, opacity: 0 }
    ], { duration: 1600 + Math.random() * 800, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'forwards' }).finished);
  }
  Promise.all(runs).then(() => box.remove());
}
```

---

## 7. Motion

**No GSAP.** The landing used GSAP + ScrollTrigger from cdnjs; the player is offline and on
file://, and the landing notes already record that GSAP's Flip throws in `getState`. CSS
transitions and the Web Animations API (`el.animate()`) cover everything here.

Principles: animate `transform` and `opacity` only; one `requestAnimationFrame` loop at most
(the narration clock); `IntersectionObserver` for reveals, unobserved after firing;
`backdrop-filter` only on the top bar and overlays; no animated `filter`; every animation
has a reduced-motion equivalent (instant state change).

| Element | Trigger | What moves | Duration / easing |
|---|---|---|---|
| Route change | hash change | old view opacity → 0; new head rises 14px | 200ms out; 500ms `--ease-out` in |
| Blocks, cards | enter viewport | `[data-rv]` opacity + 14px rise, `--i` stagger | 600ms `--ease-out`, 45ms stagger, cap 12 |
| Hero object | load | drift 10px + 2° | 6s ease-in-out alternate, infinite |
| Hero floating tags | load | `pop` | 420ms `--ease-pop-2`, 120ms stagger |
| Plan strip days | load | rise | 500ms, 40ms stagger |
| Path spine | first view | `scaleY(0 → 1)`, origin top | 900ms `--ease-io` |
| Path milestones | first view | rise | 500ms, 40ms stagger, cap 14 |
| Path ties | after their milestone | stroke-dashoffset draw | 300ms `--ease-out` |
| Hover (cards, nodes) | hover | translateY(-1px), shadow | 150ms |
| Press (all buttons) | :active | scale(.97) (.94-.96 for round buttons) | 150ms |
| Quiz wrong / right | check | `shake` / tag `stamp` | 320ms / 450ms `--ease-pop` |
| Explanation | check | grid-rows 0fr → 1fr | 500ms `--ease-out` |
| Flashcard | tap / Space | rotateY 180° | 600ms `--ease-io` |
| Card out / in | rate | fly-out wrapper / `deal` | 360ms `--ease-out` / 360ms `--ease-pop` |
| Code checks | run result | rows flip run → pass/fail in sequence | 120ms apart; icon `stamp` 300ms |
| Code all-pass | result | lime ring + glow; 14 confetti | 300ms; 900ms |
| Worked-example step | Next step | grid-rows + fade | 500ms `--ease-out` |
| Diagram | enter viewport | edges draw, nodes rise | 800ms, 60ms stagger |
| Timeline | scroll | ink run height; dots pop lime | 500ms; `--ease-pop` |
| Sentence marker | cue change | background-color | 200ms |
| Orb rings | playing | scale/opacity from peaks | per frame, values smoothed (lerp .3) |
| Dock collapse | idle + scrolled | width 820 → 56 | 500ms `--ease-out` |
| Lesson complete | Mark complete | §6.1 sequence | ~2.4s total |
| Course complete | last milestone | §6.2 overlay, trophy, confetti | 420ms; 900ms; 1.6-2.4s |

The whole motion layer is ~120 lines: `reveal()` (IntersectionObserver adding `.in` and
setting `--i`), `flip(list)` (FLIP for ordering/"show right order"), `hop(el, from, to)`,
`confetti()`, and the narration clock.

---

## 8. Responsive (down to 390px)

| Width | Changes |
|---|---|
| ≥ 1200 | Full: lesson TOC + column; hero 57/43; path 3-column rows; receipts 6 across. |
| 1100-1199 | TOC becomes the top-bar pager "3/8 ▾"; receipts 3+3. |
| 900-1099 | Hero object shrinks to `38vw`; floating tag t1 moves inside the stage. |
| < 900 (phone) | `--gut` 10px, radii step down (tokens file). Hero single column: copy, then a 300px object stage with the three tags repositioned (page.css phone rules); stats 2x2; Start pill full width, orb below it. Plan strip scrolls with snap. Path on a 26px left rail. Lesson head single column, object 120px peeking from the top-right corner, meta wraps. Dock full width. Blocks r18, padding 16-18. Tables → cards. Matching → stacked with a sheet. Explorable stacked. Brief → bottom sheet. |
| ≤ 420 | Dock hides the label stack and the follow toggle while playing (play, waveform, time, speed remain: 52 + ~120 + 64 + 46 px). Flashcard 4:3, rating buttons 56px tall with interval sublabels kept. Code editor 13px, gutter 34px. Display headings floor at 40px (hero) / 30px (lesson). |

Rules that keep 390px clean (390 − 2×16 = 358px of content):

- Every grid with responsive columns also declares `minmax(0, 1fr)` tracks (the SaaS bug where
  an implicit `auto` track overflowed phones by 100px is recorded in the design notes).
- No fixed widths above 358px: popovers use `min(320px, 100vw - 32px)`; the deck uses
  `min(100%, 560px)`; milestone width is 248px desktop, `100%` on phones.
- Touch targets ≥ 44px: quiz options 54px, rating buttons 56px, grip 32x44 hit area, dock
  buttons 52/32 with an invisible 44px hit box (`::after { inset: -6px }`), cite chips get a
  transparent `::before { inset: -11px -4px }` hit area.
- Long words in display headings: `overflow-wrap: anywhere` on `.display` under 420px (course
  titles like "THERMODYNAMICS" at 40px are 330px wide; fine, but user-provided titles vary).
- Safe areas: dock bottom uses `env(safe-area-inset-bottom)`; the page has
  `padding-bottom: calc(var(--dock-h) + 80px)` so the last block never hides under the dock.

```css
@media (max-width: 900px) {
  .c-hero { grid-template-columns: minmax(0, 1fr); min-height: 0; }
  .c-hero .copy { padding: 28px 18px 8px; }
  .c-hero .stage { height: 270px; }
  .c-hero .obj { position: absolute; left: 50%; top: 0; width: 260px; translate: -50% 0; }
  .c-hero .ftag.t3 { display: none; }   /* the exam day is in the plan strip right below */
  .c-hero .ftag { height: 34px; font-size: 12.5px; padding: 0 13px 0 5px; }
  .c-hero .ftag i { width: 24px; height: 24px; }
  .c-hero .ftag.t1 { left: auto; right: 10px; top: 48%; } .c-hero .ftag.t2 { right: auto; left: 10px; top: 6%; } .c-hero .ftag.t3 { right: auto; left: 14px; bottom: 9%; }
  .c-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .c-stats li:nth-child(odd) { padding-left: 0; box-shadow: none; }
  .c-acts .pill.lg { width: 100%; justify-content: space-between; }
  .c-plan { margin-inline: var(--gut); margin-top: -40px; }
  .p-board { padding: 16px 12px 60px 16px; }
  .p-board::before, .p-run { left: 29px; }            /* rail 13px inside the 16px padding */
  .p-row { grid-template-columns: minmax(0, 1fr); row-gap: 7px; padding-left: 30px; }
  .p-topic::before { content: ""; position: absolute; left: -17px; top: 50%; width: 15px; border-top: 2px solid var(--rule-strong); }
  .p-topic { order: -1; }
  .p-l, .p-r { justify-items: start; padding-left: 16px; }
  .p-l:empty, .p-r:empty { display: none; }
  .p-wires { display: none; }   /* no Bézier ties on phones: each hanging item gets a short dotted stub to the rail */
  .p-l > *, .p-r > * { position: relative; }
  .p-l > *::before, .p-r > *::before { content: ""; position: absolute; left: -31px; top: 50%; width: 25px; border-top: 2px dotted var(--mute); }
  .p-sec, .p-fin { justify-self: start; margin-left: 30px; }
  .l-wrap { padding-inline: calc(var(--gut) + 6px); }
  .blk.card { padding: 16px 16px 18px; }
  .dock { width: calc(100vw - 2 * var(--gut)); gap: 8px; padding-right: 10px; }
  .dock .who { display: none; }
}
@media (max-width: 420px) {
  .dock .fw { display: none; }
  .dock .tm .total { display: none; }   /* "1:24" only */
  .display { overflow-wrap: anywhere; }
}
```

---

## 9. Accessibility

### 9.1 Contrast (computed, WCAG 2.x)

| Pair | Ratio | Use |
|---|---|---|
| ink `#0B0D10` on lime `#C6F24E` | 15.0 | every lime fill's text: OK |
| white on lime | 1.3 | **forbidden** |
| lime on white | 1.3 | **forbidden** (use `--lime-ink`, 6.2) |
| lime on cobalt | 5.5 | display words, focus outline on cobalt: OK |
| lime on ink / code bg | 15.0 | strings, focus, numbers: OK |
| cobalt on white / canvas / cobalt-soft | 7.1 / 6.7 / 6.3 | links, chips: OK |
| white on cobalt-2 | 8.7 | slab text: OK; secondary white 74% ≈ 4.5 (keep ≥ .74) |
| text-2 `#565B68` on white | 6.8 | secondary text: OK |
| landing text-3 `#8B909C` on white / canvas | 3.2 / 3.0 | **decoration only**; player `--text-3` = `#6B7080` (4.9) |
| lime-ink on lime-soft | 5.6 | correct-state text: OK |
| note-ink on note-bg | 6.6 | mentor notes: OK |
| coral-ink on coral-soft | 5.05 | wrong-state text: OK |
| coral `#FF5A3C` on white | 3.1 | icons and underlines only, never text |
| code text / comment / gutter on `#121419` | 12.9 / 5.05 / 2.3 | comments lifted from 3.8; line numbers are decorative |
| "anytime" mark `#8B909C` on white | 3.2 | non-text 3:1: OK (landing's `#A9ADB8` was 2.2) |

### 9.2 Rules

- **Lime carries ink**, enforced by a build-time grep: any `color: var(--lime)` or
  `color: #C6F24E` outside a `.slab.cobalt`, `.slab.ink`, `.dock`, `.code-stage`, `.fc-back`
  or `[data-theme="night"]` context fails the build.
- **Focus**: `:focus-visible` = 3px ink outline, offset 2 (lime on dark surfaces). Never
  `outline: none` without a replacement. Path nodes, quiz options and the flashcard add
  `--ring-hot` on focus as well.
- **Colour is never the only signal**: right/wrong carry check/x icons and a text flag;
  marks have a labelled legend; "today" and "exam" in the plan strip are written words; the
  score ring prints its number.
- **Semantics**: the path is an `<ol>` of milestone buttons, each followed by a nested `<ul>`
  of subtopics; wires are `aria-hidden`; each milestone has `aria-describedby` status text
  ("Done", "You are here", "14 minutes"). Quizzes are `<fieldset>`/`<legend>` with native
  radio/checkbox inputs (visually hidden, the `.opt` label is the target). Results go to one
  polite live region per lesson ("Correct." / "Not quite. The answer is B, because …").
  Flashcard: a `<button aria-pressed>` for the flip, the back text announced on flip.
  Ordering: grip buttons with `aria-pressed` while lifted and live-region instructions.
  Code editor: `<textarea aria-label="Code editor, JavaScript">`, Esc leaves it; the checks
  list announces only the summary ("2 of 3 checks passing").
- **Narration dock**: `role="region" aria-label="Narration"`; play is `aria-pressed`; the
  waveform is `role="slider"` with `aria-valuetext="1 minute 24 of 5 minutes 12"` and arrow
  keys seek 5s; speed button label "Speed 1.25 times". Sentence highlighting is visual only
  (no announcements; screen-reader users already have their own voice).
- **Keyboard map** (shown by `?`): `K`/Space play/pause, `[` `]` speed, `←` `→` sentence (when
  the dock has focus), `P` stage mode, `Esc` closes popovers; flashcards Space/1-4/arrows;
  code Ctrl/Cmd+Enter, Esc.
- **Text size**: the `Aa` menu sets `--t-read` to 16 / 18 / 20.5px; everything is rem-free
  but scales with browser zoom (no `px` locks on containers).
- **Language**: `<html lang>` from the course; speaking phrases carry their own `lang`.
- **Images**: 3D objects `alt=""` (decorative); illustrations require `alt_text`; diagrams
  are `role="img"` with `aria-label` from `alt_text` and a visible caption.
- **Reduced motion**: handled globally in the tokens file; confetti, drift, and follow-scroll
  smoothing switch off.

---

## 10. Building it in a hackathon day

### 10.1 Files

```
player/
  tokens.css     = hackathon/research/cobalt-tokens.css
  player.css     components from this doc (copy the snippets in order: 3, 4, 5, 6, 8)
  player.js      router, renderers per block type, narration clock, workers, progress, motion helpers
  sprite.svg     11/sprite.html symbols
  build.mjs      inlines tokens + css + js + sprite + course JSON + fonts/trophy/object (base64) into index.html
```

- **Reference render**: `hackathon/research/player-proto.html` is a static page built from
  exactly the tokens file + every CSS block in this doc, with sample markup for the hero, plan
  strip, path, receipts, lesson head, table of blocks, explainer with a live sentence marker,
  mentor note, key terms, code stage, quiz, flashcard, compare table, summary slab and dock.
  It was rendered headless at 1440px and at a true 390px viewport and the phone fixes are
  folded into §8. Open it next to the real player while building; copy markup shapes from it.
- **Vanilla JS**, one IIFE, a 10-line `h(tag, attrs, ...children)` helper, one renderer
  function per block type (`R.quiz(block) → Element`). No framework, no bundler, no modules;
  it inlines cleanly and runs on file://.
- **Size budget** for a 30-lesson course: index.html ≤ 2 MB (text ~300 KB, fonts ~170 KB,
  sprite 14 KB, trophy + course object ~100 KB, CSS ~60 KB, JS ~120 KB, pre-rendered diagram
  SVGs ~15 KB each). Audio and other images stay in sibling folders.

### 10.2 Priority (cut from the bottom when time runs out)

- **P0, the demo depends on it**: tokens; course home hero (with orb) + plan strip + path with
  states and the lesson-complete run (§6.1); lesson head + reading column + narration dock
  with sentence highlight; explainer, callout, key terms; quiz with explanations and cite
  popovers; code block with JS in a Blob worker; flashcards with SM-2; summary slab; receipts
  slab; completion overlay with trophy; stage mode.
- **P1**: Mermaid (pre-rendered), worked example, compare table, speaking drill (with the
  file:// fallback), table of blocks, timeline, SQL via embedded sql.js.
- **P2**: matching, ordering, cloze, explorable with discovery, Python via Pyodide, night
  reading, illustration pins, the completion voice line.

### 10.3 Three demo courses, three looks (same player)

| Course | Skin | Object | Heading chips | Signature blocks |
|---|---|---|---|---|
| "Data Structures Final" (Oybek's own exam, from his lecture PDFs) | cobalt | obj-book | `i-code`, countdown pill | code (JS) with tests, diagram of a BST, flashcards, quiz with slide citations |
| "Speak Malay at the Mamak" (a student new to Malaysia) | ink | obj-mic | `i-mic`, `i-chat` | speaking drills with native voice, cloze, key terms, narration everywhere |
| "Barista Onboarding, Kopi & Co." (a small café's SOP PDFs) | lime | obj-check | `i-steps`, `i-cards` | illustration with pins, walkthrough-style worked example, ordering ("pull a shot"), compare table, summary slab |

### 10.4 Pre-demo checks (on the actual demo laptop)

1. Double-click `index.html` in Chrome and in Edge: fonts render (no fallback flash), the
   sprite icons show, audio plays, progress survives a reload.
2. Microphone prompt appears from file://; if not, open via `http://localhost` and confirm
   speech scoring works there.
3. Python block offline shows the friendly message; online, first run loads within ~10s.
4. Stage mode (`P`) at 1920x1080 and 1280x720 (projector) — nothing clips, the dock fits.
5. Chrome devtools at 390x844: home, path, one lesson of each skin, completion overlay.
6. Reduced motion on (OS setting): no confetti, nothing broken.
7. Clear `localStorage` before going on stage so the path starts at step 1 (or seed it at
   step 3 for a "continue" story; decide which and rehearse it).

### 10.5 The 40-second player walkthrough (for the pitch)

Open `index.html` → the cobalt hero with the countdown chip → press the orb, the course
speaks ("Four days to your final; here's the plan") → scroll: the path with "You are here"
→ Continue → the lesson head, the dock plays, the lime marker walks through the sentences →
a quiz answer, open its cite chip: the exact sentence from the student's own slide → Run the
code block, three checks flip green, lime ring → Mark complete → back on the path, the lime
run travels to the next step and the token hops → (cut) last step done: trophy, confetti,
"PATH DONE."
