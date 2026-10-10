# packages/player: STATUS (WP5a, the player shell)

Last run: 2026-10-10. `pnpm -F @bilimind/player typecheck` is clean, `test` passes (72 tests, 17 of them for the shell runtime in
`test/runtime.test.ts`), `build` passes, and `e2e` passes 39/39 with zero console errors from `file://` in headless Edge.

## How to check it

```
pnpm -F @bilimind/player build:demo   # dist/player.html (template) + dist/demo.html (fixture pasted) + placeholder audio
pnpm -F @bilimind/player e2e          # 39 acceptance checks; screenshots in shots/; results in shots/e2e.json
pnpm -F @bilimind/player smoke        # quick: home + first lesson render, no console errors
pnpm -F @bilimind/player dev          # open /player.html (the fixture loads automatically)
```

To pin "today" for a demo or a screenshot, add `?now=2026-10-12` to the hash (e.g. `index.html#/?now=2026-10-12`). The override
survives navigation.

## Works (checked by scripts/e2e.mjs, screenshots in shots/)

- **Template**: `dist/player.html` is 833 KB, under the 1.5 MB limit. It holds one `__BM_COURSE__` placeholder, one inline
  IIFE script, and embedded fonts (Space Grotesk 500-700 and Inter 400-700, latin, plus Inter Greek for α). It works from
  `file://`. The 3D objects are in `public/img/obj-*.webp` and are copied to `dist/img/`.
- **Home** (`#/`), in all 3 skins (cobalt, ink, lime; see `home-*-1440.png`):
  - top bar with the progress ring
  - hero slab: an inline icon chip after the first word, the last word in the accent colour, the exam countdown pill
    ("3 days", "Tomorrow", "Today") worked out in the course's time zone, four stats, the Start or "Continue · Step N" CTA,
    "Hear the plan" (plays `course.narration`; the orb reacts to the peaks), and the course object with three fact tags
  - plan strip: a live "Exam in 3d 1h 00m" card, then one card per plan day (today in ink, the exam day in lime, missed days
    hatched), plus the Add to calendar and Anki deck pills
- **Due today**: cards due by the end of today in the course's time zone, from `course.review.cards`. A learner's own FSRS
  state in `localStorage bm:<id>:fsrs` overrides the planned due date. Each row links to the lesson and the exact block. When
  nothing is due, the card shows the next review day.
- **The path**:
  - dotted canvas, chapter pills, ink milestones (minutes, format icons, the share of past-paper marks), subtopic badges with
    marks, groups, dotted Bézier ties
  - mentor notes; cut topics are dashed and show their reason; "You are here"; the finish pill; "After the exam"
  - clicking a milestone opens a brief popover (a bottom sheet on phones) with Open lesson and Mark done
  - on phones the spine moves to a left rail
- **Lesson complete moment**: Mark complete stamps the card and fires confetti. Then `#/?from=<id>`: the milestone flips to
  done, the lime run grows to the next milestone, the token hops along an arc, and "Continue · Step N" attaches under it
  (`path-filled-1440.png`). Finishing the last lesson opens the PATH DONE overlay with the trophy and confetti
  (`done-1440.png`).
- **Receipts slab** ("Checked before you saw it"): six numbers, extra tags (rewritten, beyond your slides, checks, repairs,
  wall time, cost, credits), cards for the items the Checker rejected (with the quote and its cite chip), and the per-agent
  log behind "See what each agent did".
- **Sources** (type tile, pages, times cited, role, Open link), then a footer with every `course.exports` download, the giant
  outlined title, and "Start over".
- **Lesson** (`#/l/<id>`):
  - head slab in the course skin: step and learner tag, the title as cue `title.0`, meta chips, Listen orb, archetype object
  - mentor note, thin-source warning, mini-path table of blocks (seen / current / task / passed / speaking states)
  - 720px reading column; wide blocks break out to 1040px
  - every block renders through the registry inside `BlockFrame`: anchor `#bf-<id>`, block cite chips unless the block
    renders its own, and an error boundary
  - the finish card, with Up next
- **Narration dock**:
  - lime play button, the current part's name, a waveform from the peaks (click, drag or arrow keys to seek), time, speed
    (1×, 1.25×, 1.5×, 0.75×), follow
  - collapses to a circle when idle and scrolled; "Back to the voice" chip; Media Session
  - the lit sentence follows the cues (checked: it advances b1.1 → b1.2), and tapping a sentence plays from there
  - the shell wraps sentences itself (`runtime/wrap.ts`) for any block that does not render its own `.s[data-s]` spans: 36/36
    cue ids of fixture lesson 1 are found in the DOM
  - a missing audio file shows a one-line message and nothing else breaks
- **Cite popover**: one shared popover for every chip. It shows the source title, the locator, the excerpt with the quote
  marked, and "Open page N", which links to `sources/<file>#page=N` (`cite-1440.png`).
- **Stage mode**: the `P` key, or the Aa menu, which also has text size S/M/L and night reading. At 1280x720 neither the
  home nor the lesson scrolls sideways.
- **390x844**: no horizontal overflow on the home or the lesson (`*-390.png`).
- **Storage**: `localStorage` keys are `bm:<courseId>:progress` (`{v, lessons{seen, passed, done, at}, last}`) and
  `bm:<courseId>:prefs`. They survive a reload. Blocks report a passed task with `markPassed(lesson, block)` or a bubbling
  `bm:passed` CustomEvent.
- **Keys**: K or Space play/pause, `[` `]` speed, P stage mode, `?` key list, Esc closes popups.

## Stubbed or simplified

- The token hop and lime run are WAAPI/CSS. The ties do not draw themselves in with an animated stroke.
- The "Back to the voice" chip checks only the last 4 s of wheel or touch scrolling.
- There is no Python or speech scoring (out of scope for the shell).
- `scripts/fake-audio.mjs` writes quiet placeholder mp3s for the fixture (its audio paths do not exist). It is for tests
  only; never ship `dist/audio/`.

## Next

- Run the e2e on a real `bilimind build` output (`node scripts/e2e.mjs path/to/course.json` pastes any course.json).
- If the demo laptop wants a more condensed stage mode, tune `:root[data-density="stage"]` in `src/styles/tokens.css`.
