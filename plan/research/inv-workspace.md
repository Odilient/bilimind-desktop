# Inventory — App UI / Workspace (BiliMind web → BiliMind Desktop)

Status: IN PROGRESS (skeleton). Sections are filled as each is finished.

Source: `/home/iphone8/projects/odilient/bilimind/frontend/app` (Nuxt 4).

## 0. Checklist (UI-xx)

Every user-visible feature or behaviour in this slice. Detailed specs follow in §1–§10; the desktop mapping is §11. IDs UI-D01… are NEW surfaces the desktop needs (no web equivalent).

**Design system and primitives (§1)**
- UI-01 Semantic token system — surfaces/borders/text/accent/state tokens; components never name raw colours.
- UI-02 Floating frame on a desk — the app is a white card with 14px margin on a cream desk.
- UI-03 Typography — Instrument Sans body, Bricolage display, Geist Mono only for code; tabular figures.
- UI-04 Motion vocabulary — pulse/rise/fade/sheet/shimmer, staggered list entrance, reduced-motion kill switch.
- UI-05 Icon registry — inline 24px stroke SVG set + two filled glyphs (`spark`, `node`).
- UI-06 Button — 7 variants (ink primary, lime accent = "go/spend"), 4 pill sizes, loading keeps width.
- UI-07 Badge — tone pills with dot/icon.
- UI-08 Node status dot + vocabulary — ready/writing/queued/not written/needs another go, same everywhere.
- UI-09 Card — tone/pad/link-hover container.
- UI-10 Empty state — dashed box, icon well, title, description, actions.
- UI-11 Skeleton — shimmering bars, multi-line ragged.
- UI-12 Segmented control — sunken track, raised selected pill, optional counts.
- UI-13 Modal — focus-trapped dialog, bottom-anchored on phones, persistent option.
- UI-14 Bottom sheet — phone dialog from the thumb end.
- UI-15 Overflow menu — one primary action on a row, the rest in a popover/sheet.
- UI-16 Text field — label/hint/error, counter only near the limit, lime focus halo.
- UI-17 Toasts — global queue, tones, optional action (Undo), auto-dismiss.
- UI-18 Progress ring — animated SVG ring with "N%".
- UI-19 Allowance meter — countable dots ≤24 else a track; top-ups separate → becomes the cost meter.

**Shell (§2)**
- UI-20 Layout set — default / workspace / auth / start / landing; app-level palette + toasts.
- UI-21 Navigation rail — 62px icons or 208px labelled, persisted; Today, Courses, Materials, New course, Search.
- UI-22 Phone bottom nav — Today, Courses, Files + lime New.
- UI-23 Page head — sticky phone bar vs desktop masthead with actions.
- UI-24 Account menu — initials avatar → Settings / Sign out.
- UI-25 Activity bell — unread dot, notifications modal, mark read/all read, one shared 45s poll.
- UI-26 Search palette — ⌘K or `/`, course scope chip, 7-state machine, recent queries, cache, keyboard combobox.
- UI-27 Search result row — kind icon, highlighted snippet (no v-html), format/status chip, breadcrumb.

**Vocabulary (§3)**
- UI-28 Learner-facing vocabulary — lessons not nodes, "write" not "expand", progress lines and verbs from one file.

**Prompt flow (§4)**
- UI-29 Composer — one field (type / drop files / paste notes / speak), typing placeholder, two skins.
- UI-30 Voice input — live speech-to-text or recorded clip fallback.
- UI-31 Pending prompt — the sentence survives sign-up and reload; lost files named.
- UI-32 Send from a public page — keep the sentence, route stranger→/start, member→dashboard.
- UI-33 Ghost flight — the composer DOM is cloned and flown between pages under a veil.
- UI-34 /start page — sign up beside your sentence; it flies on to the dashboard.
- UI-35 Dashboard runner — transcribe → upload files → save notes → create course → draft, with a ticked step list.

**Create flow (§5)**
- UI-36 Durable create address — `/create/{uuid}` minted before anything exists.
- UI-37 Draft autosave — debounced, coalescing, silent; "Draft saved — you can close this".
- UI-38 Resume logic — draft → course-by-uuid → legacy id → fresh compose.
- UI-39 Compose step — topic, examples, goal, language/level/pace panel, materials, skip-questions toggle.
- UI-40 Clarify step — waiting skeleton + bounded poll, failure card, skip.
- UI-41 Clarify questions — chips + free text per question, progress, persisted controls.
- UI-42 Material picker — attach library items or add new inline; status badges; "Sort it out".
- UI-43 Generation progress — stopwatch ring, phase chips, streamed plan steps, node grid, event log, PACE estimates, hand-off with `?expand=1`.

**Library and course pages (§6)**
- UI-44 Library — filter chips with counts, filter box → search hand-off, cards with one verb, archive/trash/restore/undo, delete-forever confirm.
- UI-45 Drafts strip — "Pick up where you left off" with state lines and discard.
- UI-46 Course addresses — `/{user}/{slug}?node={key}`, legacy redirects.
- UI-47 Course page = two readers — owner workspace vs public read-only (+SEO).

**Roadmap (§8)**
- UI-48 Roadmap vocabulary — track, mark (recommended/alternative/anytime), progress states.
- UI-49 courseTree — topics on a line, subtopics ≤2 deep, nothing dropped.
- UI-50 wrapLabel — deterministic char-count wrapping with ellipsis.
- UI-51 Roadmap metrics — the pixel contract between layout and drawing.
- UI-52 useRoadmap layout — alternating flanks, row packing, groups/families/notes/links, ties, spine, finish.

**Workspace (§7)**
- UI-53 Desktop workspace frame — top bar (breadcrumb, readiness, Write lessons/Draw the plan, Share, Aa, menu, assistant), stacked panes.
- UI-54 Tabs model — map/lesson/sandbox/board tabs, neighbour focus on close, openNext, reconcile, smart initial tab.
- UI-55 Tab strip — status dots, close, middle-click close, auto-scroll to active.
- UI-56 Sidebar — Map button + Lessons/Plan/Files.
- UI-57 Lesson list — numbered topics, folding clusters, badges, progress styling, right-click done.
- UI-58 Roadmap board — fit-to-pane canvas, legend, progress, hover-lit ties, writing dots, marking gestures, brief on click.
- UI-59 Node brief — place, status, live writing clock/queue position, summary, covers/neighbours, mark group, one action.
- UI-60 Lesson pane — heading, pinned strip, state card, reading/editing/preview modes, finish card, regenerate, pen.
- UI-61 Lesson spine — section counter and jump list.
- UI-62 Progress marking — optimistic done/learning/skip with Undo.
- UI-63 Write dialog — pick lessons, presets, gap warning, time estimate, allowance-aware submit.
- UI-64 Writing status line — what's being written, clock, ETA, parts, "is written — Open it".
- UI-65 Plan panel — build a schedule, week stats, slippage reassurance, tick sessions.
- UI-66 Files panel — per-material status and which open lessons used it.
- UI-67 Whiteboard tab — private board per lesson.
- UI-68 Assistant dock — docked/floating/closed, scope, derived openers, pinned block, artifacts.
- UI-69 Artifact panel — html/pdf/markdown viewer sharing the right dock.
- UI-70 History panel — revisions docked in place of the assistant.
- UI-71 Phone workspace — Study/Map/Plan/Files/Ask tabs + focus sheet.
- UI-72 Phone roadmap — the same grammar as a vertical list.
- UI-73 Share — copy the course's own URL, read-only semantics.

**Composables and transport (§9)**
- UI-74 useWorkspace (see UI-54).
- UI-75 useNodePlayer — fetch, attempts, time on task, progress, regenerate/expand, polling.
- UI-76 useApi / useAsyncApi — typed transport + ApiError semantics.
- UI-77 Supporting composables index.
- UI-78 Block deep-link anchoring — wait, scroll under the strip, flash.

**Course components and reading (§10)**
- UI-79 Public read-only course — the shareable rendering.
- UI-80 Course schedule tab (legacy alternate view) — pointer only.
- UI-81 Reading settings and themes — text size, serif/sans, paper/warm/dim, set as default.

**New in BiliMind Desktop (§11)**
- UI-D01 First-run welcome — choose/create vault, add a provider key or detect Ollama, then the Composer.
- UI-D02 Settings — providers & keys, model per task, concurrency, budget, vault, appearance, reading defaults, shortcuts.
- UI-D03 Cost meter + ledger — spend per course/month, budget cap, per-generation receipts.
- UI-D04 Export / Publish dialog — static site, single HTML, PDF, Markdown zip, Anki, JSON Canvas.
- UI-D05 External-change awareness — file watcher, conflict banner, reload/merge.
- UI-D06 Provider status — offline/Ollama/model availability chip and graceful errors.
- UI-D07 Command palette commands — actions alongside search results.
- UI-D08 OS integration — native notifications, dock/taskbar progress, deep links `bilimind://`, reveal in Finder, open in Obsidian.
- UI-D09 Import — bring in a BiliMind web export, a folder of markdown, or another vault's course.
- UI-D10 App-wide dark theme following the OS.

## 1. Design tokens and primitives (main.css, components/ui, Icon registry)

Source: `frontend/app/assets/css/main.css` (1743 lines, Tailwind v4 `@theme`), `components/ui/*`.

### UI-01 Semantic token system
Components never name a raw colour; they use semantic tokens exposed as Tailwind colours (`bg-surface`, `text-text-muted`, `border-border-strong`...). Light theme only for the app shell (reading pane has its own themes, see UI-81). Values:

| Group | Token | Value | Use |
|---|---|---|---|
| Surface | `--bg` | `#ece8de` | the "desk" behind the floating frame |
| | `--surface` | `#ffffff` | content (prose, blocks) |
| | `--surface-chrome` (= `--surface-raised`) | `#faf7f0` | rail, sidebar, tab bar (the landing's cream) |
| | `--surface-sunken` | `#f5f2ea` | code chips, segmented items, avatar wells |
| | `--surface-track` | `#efece2` | progress tracks, segmented background |
| | `--surface-mute` | `#f9f6ef` | whisper fills, status pills |
| Border (ink at alpha, so it works on white AND cream) | `--border` | `rgb(20 22 28/.07)` | hairline panel splits |
| | `--border-strong` | `/.12` | buttons, liftable cards |
| | `--border-field` | `/.15` | inputs |
| | `--border-rule` | `/.05` | row dividers inside lists |
| | `--border-dashed` | `/.22` | drop targets, diagram nodes, stub dots |
| Text (ink `#14161c` stepped by alpha) | `--text` | `#14161c` | headings, key numbers |
| | `--text-body` | `/.88` | long prose |
| | `--text-dim` | `/.76` | button labels |
| | `--text-soft` | `/.65` | supporting copy |
| | `--text-muted` | `/.60` | descriptions, captions |
| | `--text-faint` | `/.48` | labels, metadata, eyebrows |
| | `--text-ghost` | `/.28` | near-decorative suffixes |
| Accent (lime) | `--accent` | `--lime #c8f135` | loud fill — always carries INK text (`--on-accent: #14161c`), never white |
| | `--accent-strong` (= `--accent-dim`) | `#55710b` | the only lime legible as text (5.0:1 on accent-soft) |
| | `--accent-soft` | `#f3f8dd` | selected row / active nav fill |
| | `--accent-line` | `#dcecab` | accent borders |
| Success (green = *written*, not *passed*) | `--success` `#2e7d32`, `-bright #3fa34d` (dots), `-soft #eff7ef`, `-line #d3e8d5`, `-text #276b2b` |
| Warn (amber = time: missed session, moved lesson; never alarming) | `--warn #a8730a`, `-bright #ffc933`, `-soft #fff3ce`, `-line #ffe3a0`, `-text #8d6006`, `-text-soft #9c6c08` |
| Danger (coral = the one thing wrong) | `--danger #cf432a`, `-bright #ff6b4a`, `-on-dark #ff9b85`, `-soft #fff1ec`, `-line #ffd2c5`, `-text #b93a22` |
| Code sandbox (the one dark region) | `--code-bg #14161c`, `--code-bar #1d2027`, `--code-line #262a33`, `--code-text #e9e6de`, `--code-meta paper/.45`, `--code-dim paper/.72`, `--accent-on-dark` lime, `--success-on-dark #7fd18a` |
| Elevation (ink-cast) | `--shadow-frame` `0 1px 3px /.05, 0 18px 50px /.08`; `--shadow-card` `0 1px 2px /.05`; `--shadow-raised` `0 2px 6px /.06`; `--shadow-segment` `0 1px 3px /.08`; `--shadow-pop` `0 24px 60px /.18` (modals, floating assistant); `--shadow-lift` `0 12px 32px /.16` (closed-assistant pill); `--shadow-sheet` `0 -14px 44px /.2` |
| Grid | `--grid-line` | `rgb(20 22 31/.045)` | `.blueprint` 28px grid behind heroes |

Brand palette (landing + composer, also available as `bg-lime` etc.): grounds `--cream #faf7f0`, `--cream-2 #fbfaf6`, `--cream-3 #efede6`, `--cream-4 #e0ded6`; stage `--ink #14161c`, `--ink-2 #1d2027`, `--ink-3 #262a33`; ink-on-page `--ink-text`/`-2 .65`/`-3 .45`/`-4 .28`; lines `--line-day .08/.14/.25`; paper-on-stage `--paper` + `.78/.55/.35`; `--line-ink` white `.1/.2/.32`. **Four lights:** lime (Go: send, recommended, done) `#c8f135` / deep `#8fb61f` / text `#5f7f0d` / soft `#f3f8dd`; coral (You: your voice/ink/edits + errors) `#ff6b4a` / light `#ff9b85` / text `#e2543c` / soft `#ffdcd2`; sky (Anytime: third path badge, links) `#7fb5ff` / text `#3d7de0` / soft `#e3eeff`; amber (Time: alternatives, streaks, schedule) `#ffc933` / text `#c98a00` / soft `#fff3ce`.

Base layer: `* {border-color: var(--border)}`, `::selection` accent-soft, `:focus-visible` 2px lime outline offset 2px radius 6px, range inputs restyled (5px track `--border-field`, 16px white thumb with 1.5px lime ring) because sliders drive "playground" blocks.

Note: `useTheme.ts` (dark/light via `.light` class on `<html>`, localStorage `bilimind-theme`) is legacy; only `course/PublicView.vue` calls it. The app is light-only; dark exists only as the reading theme `dim`.

### UI-02 Floating frame on a desk
`ShellFrame`: `h-dvh bg-bg`, on `lg` 14px padding (`p-3.5`) and an inner white card `rounded-[20px] border shadow-frame overflow-hidden`. On phones the desk disappears (full-bleed). The "frame floating on desk" is called the single most character-defining decision.

### UI-03 Typography
- Body/UI: **Instrument Sans** (self-hosted woff2, metric-matched local fallback `Instrument Sans Fallback` = Arial at `size-adjust 102.6%`, ascent 94.5%, descent 24.4%).
- Display: **Bricolage Grotesque** 800, `opsz` 96/72/24 (fallback Arial Bold `size-adjust 93.3%`).
- Mono: **Geist Mono** — ONLY for code (line counts, timers, gutters). Rule: "a duration is not code" — figures use `.num` (tabular-nums) not mono.
- Utilities: `eyebrow` (12px/500/faint), `eyebrow-loud` (10.5px/600/uppercase/.03em), `num`, `mono-num`, `code-chip` (mono .87em, sunken, 1px 6px, r6), `t-display` (Bricolage 800 opsz96 -0.025em lh .98 balance), `t-title` (opsz72), `t-head` (opsz24, 700, -0.015em, lh 1.15 — used for card titles, page headings 30px), `t-label` (12px/700/.07em/uppercase).
- Radii: xs 6, sm 8, md 10, lg 13, xl 16, 2xl 20, 3xl 28. Buttons and badges are full pills.

### UI-04 Motion vocabulary
Keyframes: `pulse-dot` (opacity 1↔.4, 1.6s — "work in flight"), `blink`, `rise` (fade + translateY 10px, .28s), `fade` (.2s), `sheet` (translateY 100%→0, .32s), `spin-slow` (1s), `shimmer` (opacity .45↔.85, 1.5s — skeletons). Utility classes `.rise` (list entrance with per-row `--d` delay, .42s cubic-bezier(.16,.84,.44,1)), `.fade-in`, `.pop-in` (.22s). `prefers-reduced-motion: reduce` collapses every animation/transition to 0.001ms. `.om-scroll` thin overlay scrollbars (10px, thumb `#dcdce0`); `.om-tabs` hides the tab-strip scrollbar.

### UI-05 Icon registry (`UiIcon`)
Inline SVG, 24×24 viewBox, `stroke=currentColor`, default size 18, stroke 1.6, round caps/joins, `aria-hidden`. Unknown names fall back to `dots`. No icon fonts, no emoji. Stroke icons by group:
- Navigation: `calendar, book, file, graph, layers, home, workspace` (page + left structure panel), `map` (3-node triangle = DAG tier), `spine` (vertical line with 3 nodes = mobile roadmap / a block inside a lesson), `inbox, archive`.
- Actions: `plus, x, check, check-circle, search, trash, refresh, play, pause, pencil, upload, link, external`.
- Panels: `panel-right` (assistant dock toggle), `panel-left` (lesson list toggle), `pop-out` (float the assistant), `dock`, `settings`.
- Direction: `chevron-right/left/down/up, arrow-right, arrow-up-right`.
- State: `clock, alert, flame, sparkles, target, globe, bell, lock`.
- Theme: `sun, moon`. Account: `user, users, key, card, logout`. `image` (illustration meter — a picture, not a camera). Misc: `menu, dots, mic, send, loader`.
- Filled icons (things, not actions): `spark` (the assistant's mark, 4-point star), `node` (rounded square rx 4.5 — "one lesson", used as the allowance unit glyph instead of a coin/star).

### UI-06 Button (`UiBtn`)
Props: `variant` (`primary|accent|secondary|ghost|subtle|danger|success`, default secondary), `size` (`xs` h28/11.5px, `sm` h32/12.5px, `md` h34/13px, `lg` h40/13.5px — all `rounded-full`), `to` (router link) | `href` (external, new tab, noopener) | button `type`, `disabled`, `loading` (centred spinning `loader`, label kept invisible to preserve width, `aria-busy`), `block`, `square` (icon-only circle), `icon`, `trailingIcon`, `label` (aria-label). Semantics: **primary = ink** (commit to something already decided: mark complete, rebuild, open map); **accent = lime with ink text + lime glow shadow** — reserved for "go"/spending (writing lessons); secondary = white + strong border + card shadow; ghost = transparent faint; subtle = accent-soft fill with accent-strong text; danger = white with coral text/border; success = success-soft. All: `active:scale-[.98]`, disabled/loading = `opacity-45 pointer-events-none`.

### UI-07 Badge (`UiBadge`)
Pills, `tone` neutral|accent|success|warn|danger|outline, `size` xs (h20, 10.5px) | sm (h24, 11.5px), optional leading `dot` or `icon`, `mono` (uppercase mono metadata chip — rarely used now).

### UI-08 Node status dot + vocabulary (`UiStatusDot`, `useNodeStatus.ts`)
An 8px dot (size prop) that means the same thing in all five places (sidebar list, tab strip, map, mobile roadmap, focus sheet). `title` = label. `still` suppresses pulse in long lists. **Green = content written, NOT learner finished** (learner progress is drawn separately as a ring/check).

| status | label | dot | pulse | blurb (used in empty states) |
|---|---|---|---|---|
| `ready` | Ready | `bg-success-bright` | no | "This lesson is written and ready to read." |
| `generating` | Writing | `bg-accent` | yes | "BiliMind is writing this now — usually about two minutes. Read something else meanwhile; it opens here the moment it is done." |
| `queued` | Queued | white with 1.5px accent-line ring | no | "Waiting its turn behind the lessons already being written..." |
| `stub` | Not written | white with 1.5px dashed-border ring | no | "This one is in the plan but nothing has been written for it yet... it is your call which lessons get made." |
| `failed` | Needs another go | `bg-danger-bright` | no | "Writing this one didn't finish, so it doesn't count against your lessons. Try it again whenever you like." |

Helpers: `isReadable(status)` = ready; `isWorking(status)` = generating|queued.

### UI-09 Card (`UiCard`)
`rounded-xl border`, tones default/raised/sunken/accent/danger/warn/success, pad none/sm(12)/md(16)/lg(20–24), link (`to`/`href`) or `interactive` adds hover border-strong + shadow-raised, `as` tag.

### UI-10 EmptyState (`UiEmptyState`)
Dashed rounded box (`border-dashed bg-surface-mute`, danger tone variant), icon well (accent-soft square 44/36px), `t-head` title 17/14.5px, description max-w-sm, default slot = action buttons. `size` page (py-14) | inline (py-8).

### UI-11 Skeleton (`UiSkeleton`)
`animate-shimmer bg-border` bar; `w`, `h`, `rounded`, `lines` (N bars, last at 62% width, 90ms staggered delay).

### UI-12 Segmented control (`UiSegmented`)
Sunken pill track (`bg-surface-track p-[3px] rounded-full`), selected = white pill + `shadow-segment`. Options `{value,label,icon?,count?}` (count is a small trailing tabular number). `v-model`, `size` xs/sm/md, `block` (stretch, flex-1 items), role=tablist/tab.

### UI-13 Modal (`UiModal`)
Teleported to body, `v-model:open`, `title`, `description`, `size` sm(384)/compact(440)/md(512)/lg(672), `persistent` (no backdrop/Esc dismiss). Backdrop `rgb(20 22 28/.55)` + 3px blur. Phone: bottom-anchored with rounded top (22px); ≥sm centred, rounded 22px. Header (title 16px semibold + description + ghost close X), body `px-5 py-4`, optional footer (right-aligned, border-top). Focus trap on Tab/Shift-Tab, Esc closes, body scroll locked, autofocuses `[autofocus]` or the panel.

### UI-14 Bottom sheet (`UiSheet`)
Phone dialog: backdrop `rgb(16 17 20/.35)` tap-to-close, panel slides up (`animate-sheet`), max-h 78%, rounded-t-3xl, 38×5px grab handle, optional title 19px + description, Esc closes, body scroll lock.

### UI-15 Overflow menu (`UiMenu`)
"One primary action stays on the row, everything else moves in here" (prevents admin-table rows). `actions: {label, icon?, destructive?, disabled?, run}[]`; destructive items render coral under a divider. Desktop: 32–36px `dots` trigger → popover min-w 184px, `align` left/right, closes on outside pointerdown/Esc. Phone (`useIsPhone`, <1024px): same actions in a `UiSheet` with optional `title`, 15px rows with 19px icons.

### UI-16 Text field (`UiTextField`)
`label` (12.5px semibold soft, `*` if required), `hint`, `error` (coral with alert icon; aria-invalid/describedby), `placeholder`, `type`, `multiline` + `rows` (resizable textarea), `icon` (leading, inputs only), `maxlength` with a counter that appears ONLY near the limit (remaining ≤ min(120, 15% of max)) as "N left", `size` sm/md/lg, `#suffix` slot, exposes `focus()`. Inputs are sunken fill; textareas are white ("you write into white"). Focus = lime-deep border + 3px lime-soft halo.

### UI-17 Toasts (`useToast` + `UiToast`)
Global queue (`useState('bilimind-toasts')`), mounted once in `app.vue`. API: `push(input|string, tone)`, `success`, `error`, `warn`, `info`, `dismiss(id)`, `clear()`. Input `{title, body?, tone?, duration?, action?: {label, handler}}`. Default duration 4200ms, danger 7000ms, 0 = sticky. Bottom-centre on phone, bottom-right on desktop; each toast: tone icon (neutral=sparkles, success=check-circle, warn/danger=alert), title 13.5px, optional body, optional action link (runs then dismisses), X dismiss. `aria-live=polite`.

### UI-18 Progress ring (`UiProgressRing`)
SVG ring, `value` 0–100, `size` 46, `stroke` 4, tone accent/success/warn/danger/muted, track `--border`. Animates from empty to value on mount (900ms). Centre shows `N%` (the `%` is deliberate: reads as "15% through", not a counter) or `caption`/slot.

### UI-19 Allowance meter (`UiAllowanceMeter`) — becomes the desktop cost meter
Input `MeterAllowance {metered, plan_limit, plan_used, plan_remaining, topup_remaining, remaining, percent_used}`, `unit` ("lessons"), `label`, `icon` (default `node`), `compact`. If limit+topup ≤ 24 → one 7px rounded-square dot per unit (spent = track colour, unspent = fill), a 1px divider, then top-up units as outlined squares. Otherwise a continuous 7px track showing remaining % plus a 32px outlined pill for top-ups. Tone: danger when 0 left; warn when no top-up and ≥80% used; else accent. Caption: "N of L used this month · T topped up" or "No lessons left this month."

## 2. Layouts and shell

### UI-20 Layout set
- `default` (Today, Courses/library, Materials, Create): `ShellFrame` > `ShellRail` (footer slot = `ShellActivity` bell) + column: `<main class="om-scroll overflow-y-auto">` + `ShellBottomNav` (phone only).
- `workspace` (course page): frame + rail only; the page owns its top bar, panels and scrolling. The workspace as a whole never scrolls.
- `auth` (login/register): one column on cream with dotted background (`dots-day`), wordmark (lime 17px rotated-45° rounded lozenge + "BiliMind" Bricolage 23px), white `card-day` r24 card, footer line "Planning a course is always free. You only pay to have lessons written."
- `start` (`/start`): bare cream `t-body` container; page draws its two panes (see §4).
- `landing`: marketing (cream, pill nav, footer, JSON-LD Organization/SoftwareApplication/WebSite). Not in scope for the app rebuild but the composer lives in it.
- `app.vue` mounts globally: `NuxtRouteAnnouncer`, `UiToast`, `ShellSearchPalette`, `useSearchHotkey()` (⌘K) and `useBlockAnchor()` (`#block-{id}` deep links land on one paragraph).

### UI-21 Navigation rail (`ShellRail`, `useRail`)
Desktop only (`lg+`). Collapsed 62px icons (default) or expanded 208px icons+labels; width transition 200ms so content slides rather than reflows. State persisted in cookie `bilimind_rail` = '1'|'0' for a year (SSR-correct), mirrored to `useState('shell:rail-expanded')`. Contents top→bottom: wordmark (30px ink rounded square with 13px lime lozenge; name shown when expanded) → **Search** button (action, not destination; expanded shows `⌘K` kbd) → nav items `Today (/today, home)`, `Courses (/library, workspace — active also on /courses/*)`, `Materials (/materials, file)`, `New course (/create, plus)` → spacer → footer slot (Activity bell) + collapse/expand chevron (rotated) → `ShellAccountMenu` avatar. Active item: accent-soft fill + accent-strong icon + a 3×20px lime marker bar in the rail's left gutter. Items 40px tall, radius 11px.

### UI-22 Phone bottom nav (`ShellBottomNav`)
`lg:hidden`, translucent white + 14px blur, safe-area padding. Three destinations `Today`, `Courses`, `Files` (=/materials) with 23px icons (stroke 2 when active, accent-strong) + 10.5px labels, plus a 4th "New" item drawn as an always-lime 38×26 pill with a plus (ring when on /create). Four items max ("five reads as a menu").

### UI-23 Page head (`ShellPageHead`)
Props `title`, `eyebrow`, `subtitle`, `back` (route), `width` 3xl/4xl/6xl (must match body container), `barOnly`. Phone: sticky 52px translucent bar — optional back chevron, 17px title, search button, `#bar-actions` (defaults to `#actions`), and the account avatar on top-level screens (no avatar when `back` is set). Desktop: static masthead that scrolls away — eyebrow 12.5px faint, 30px `t-head` title, subtitle 13.5px muted, right-aligned `#actions`.

### UI-24 Account menu (`ShellAccountMenu`)
Avatar with initials ("Ada Lovelace"→AL, email→first 2 chars, fallback `?`) on a cream gradient. Desktop popover opens upward (224px): name + email, divider, Settings (/account), Sign out. Phone: bottom sheet with the same two rows. Closes on outside click/Esc.

### UI-25 Activity bell (`ShellActivity`)
Bell button (rail 40px, or `compact` 36px in phone bars / Today header) with a lime unread dot. One shared notification list and ONE 45s poll across however many bells are mounted (module-level refcount). Click opens `UiModal` "Activity — Daily plans and generation updates.": skeletons while loading; empty state "Nothing yet — Your daily plan lands here every morning once a course is scheduled."; list of rows (unread lime dot, title, relative time `just now/5m ago/3h ago/yesterday/4d ago`, body). Clicking a row marks it read optimistically (`POST /notifications/{id}/read`, revert on failure). Footer "Mark all read" (first 50 unread) + Close.

### UI-26 Search palette (`ShellSearchPalette`, `useSearch`)
Global singleton, opened by ⌘K/Ctrl-K (toggle) anywhere when signed in, by bare `/` when focus is not in an input/textarea/select/contenteditable, by the rail/phone-bar search buttons, and programmatically `openPalette({scope?, seed?})`.
- Layout: not a modal — pinned near top (`pt-[9vh]`, max-w 620px; phone pins to very top so the keyboard does not cover results). Backdrop black/45 + 2px blur.
- Field row: search icon, optional **scope chip** (accent-soft, course title, X; clicking removes scope; Backspace in an empty field also removes it), input (placeholder "Search this course" when scoped else "Search courses, lessons and files"), clear X when query non-empty, phone-only close X, and a 1px pulsing lime hairline under the field while busy (the only loading indicator).
- Combobox a11y: caret stays in the input; list is `role=listbox`; current row via `aria-activedescendant`; `sr-only aria-live` announces "N results" / "No results" / "Search failed".
- Keys: ↑/↓ move (wraps), Enter opens (⌘/Ctrl+Enter = new tab), Esc closes, Tab closes, Backspace-on-empty clears scope. Only keyboard moves scroll the active row into view (pointer moves don't, to avoid a feedback loop). Mouse hover sets active index.
- States (explicit state machine): `idle` (nothing typed → "Recent" list of up to 6 previous queries with clock icons, else "Search across every course, every lesson and every file you have added."), `short` (no token ≥2 chars and no quoted phrase → "Keep typing — two letters is enough."), `loading` (previous answer stays visible at 55% opacity; first-ever search shows 3 skeleton rows), `slow` (in flight >900ms → "Still looking. A large library takes a moment."), `ready`, `empty` ("Nothing matches "q"", plus "This search is limited to {course}" + "Search everything" button when scoped, else "Lessons nobody has written yet have nothing to search."), `failed` (alert + message + "Try again").
- Mechanics: 200ms debounce; AbortController + monotonic sequence id so stale responses never land; LRU cache of 40 answers keyed `scopeId|term` (backspacing is instant); recent queries recorded on choose; close clears query and runtime but keeps cache.
- Results grouped by server groups (`{key,label,results,has_more}`), sticky uppercase 11px group headings, "More in {group} — narrow the search to see them." when `has_more`.
- Hit routing: course → course URL; node → node URL; block → node URL + `#block-{id}` (and imperatively anchors, so choosing the lesson you are already on still scrolls); material → `/materials?material={id}`.
- Scope source: the course page publishes `setScope({id,title})`; fallback reads the route's cached course (never scopes to a shared course you don't own).
- Footer: kbd hints "↑ ↓ to move · ↵ to open · esc to close" (≥sm) and, when the server says `retrieval: 'like'`, "Index rebuilding — results may be incomplete".

### UI-27 Search result row (`ShellSearchResultRow`)
Fully controlled (`active` prop, no CSS hover). Kind icon in a 28px well (course=`book`, node=`layers`, block=`spine`, material=`file`), title 13.5px (accent-strong when active, row bg accent-soft), right chip = block's format label (`type_label`, e.g. "Walkthrough") or, for a lesson, its status label only when not ready. Snippet (2-line clamp) with matches highlighted as `<mark>` — the server wraps matches in private-use code points U+E000/U+E001 and `splitHighlights()` builds DOM runs (never `v-html`; unbalanced markers dropped). Context line (breadcrumb) 11.5px faint.

## 3. Learner vocabulary (utils/words.ts)

### UI-28 Learner-facing vocabulary layer
Rule: the API says node/stub/expand/outline; the learner never sees those words. Every structural string comes from `utils/words.ts`; internal names (types, props, API fields) keep "node".
- `lessons(n)` → "1 lesson" / "14 lessons"; `plural(n, one, many?)`.
- `courseProgressLine({total, completed, ready?, writing?})` (first match wins): total 0 → "Nothing planned yet"; writing>0 → "Writing {w} of {N lessons}"; all completed → "All {N lessons} finished"; completed>0 → "{c} of {N lessons} finished"; ready unknown → "{N lessons} · not started"; ready 0 → "{N lessons} planned · none written yet"; ready=total → "{N lessons} · ready to read"; else "{N lessons} · {r} ready to read".
- `courseAction({ready, completed, writing, started?})` → the card's verb IS the state: writing → "See progress" (secondary); ready 0 → "Choose lessons" (accent); nothing completed and nothing started → "Start" (primary); else "Continue" (primary).
- `courseStatusLabel`: ready→"Ready", outlined→"Plan ready", expanding→"Being written", failed→"Needs another go", else "Draft".
- `lessonStateLabel` (prose, blunter than the dot labels): ready→"Ready to read", generating→"Being written", queued→"Waiting to be written", failed→"Needs another go", else "Not written yet".
- `languageName(code)` for en, uz, ru, es, fr, de, tr, ar, pt, it, zh, ja, ko, hi (fallback upper-cased code).
- `agoLabel(iso)`: <2 min "just now", "N min ago", "an hour ago"/"N hours ago", "yesterday", "N days ago" (<7), "last week" (<14), "N weeks ago" (<60 days), "N months ago". Deliberately vague = calm.
- Other copy rules visible across screens: "Write"/"Writing" not "expand"; "plan" not "outline"; "lesson" not "node"; "Needs another go" not "failed"; durations are never mono.

## 4. Prompt flow (hero field, pending prompt, /start, ghost flight)

Files: `components/prompt/Composer.vue`, `components/prompt/Runner.vue`, `composables/usePendingPrompt.ts`, `usePromptHandoff.ts`, `usePromptStart.ts`, `usePromptVoice.ts`, `useStartCourse.ts`, `pages/start.vue`, `pages/today.vue` (dashboard runner section), `components/landing/Hero.vue` + `Closing.vue`, `utils/landing.ts` (`HERO_PHRASES`, `SUGGESTIONS`).

### UI-29 The Composer (one field, three appearances)
`PromptComposer` is the same component on the landing hero, the `/start` left pane and the dashboard ("the field a visitor types into is the field they find after signing in"). Two skins via CSS variables on `.composer`: `tone="ink"` (glass on dark: bg white/.10, border white/.28, focus border lime/.7, white text, chip border white/.3, chip hover lime, blur 22px, shadow `0 24px 70px black/.35`) and `tone="day"` (`.is-day`: white bg, ink/.1 border, focus `rgb(143 182 31/.8)`, ink text, cream chips, lime-soft file pills). Sizes `lg` (hero: 17–19px text, 50px send) and `md` (15.5px, 44px send).
- Props: `tone`, `size`, `typing` (animated placeholder), `placeholder` (default "What do you want to learn?"), `autofocus`, `busy` (locks + spinner in send), `disabled`, `sendLabel` (aria/title of the send button; "Build my course" hero, "Keep this" on /start, "Plan my course" dashboard).
- Model: `ComposerDraft {topic, notes, files: File[], lostFiles: PendingFile[], voice: Blob|null, voiceSeconds}`. Emits `submit(PromptPayload {topic, notes, files, voice, voiceSeconds})` and `typed(text)`. Exposes `root`, `send()`, `focus()`.
- Textarea: one line at rest, auto-grows to max 220px, maxlength 2000, Enter sends / Shift+Enter newline (IME-safe). Paste of files from clipboard attaches them.
- **Typing placeholder** (`typing`): after 900ms types "I want to learn {phrase}|" char by char (36–76ms/char), holds 2.1s, deletes at 14ms/char, pauses 350ms, next phrase. Phrases: "espresso — I want café shots at home", "Spanish for my trip in June", "SQL… I'm an analyst now, apparently", "anatomy — exam in 6 weeks, help", "public speaking without the panic", "keeping bees through their first winter". Reduced motion → static first phrase.
- **Three doors + button** (chips row): `Drop files`/`Add more` (paperclip; opens file picker; accept = `.pdf,.docx,.pptx,.ppsx,.epub,.txt,.text,.md,.markdown,.mdown,.csv,.tsv,.json,.html,.htm,.srt,.vtt,.png,.jpg,.jpeg,.webp,.gif`; max 12 files; de-duped by name:size; overflow message "Kept the first N — 12 files is the most one course needs."), `Paste notes`/`Notes added` (toggles a folded textarea, maxlength 200 000, placeholder "Paste your notes, a syllabus, the bits of the handbook that matter…"), `Say it out loud` (voice; 3 coral bars animate while live, label becomes "Listening · m:ss · tap to stop"). Whole form is a drop target (lime ring while dragging).
- Attachment pills: file icon by extension (pdf, doc, presentation, csv, image, subtitles, epub, text), truncated name, size (B/KB/MB), remove X. **Lost files** (from a reload — names survive, Blobs don't): dashed, struck-through pill with amber warning, "add again", forget X. Voice note pill: waveform icon + "Voice note · m:ss" + remove.
- Interim speech appears under the textarea in italic coral-light ("…"), `aria-live`.
- Validation: topic must be ≥3 chars; otherwise focus field and show an amber in-flow hint for 3.2s: "Add a few words about what to build from this." (if files/voice present) or "Tell BiliMind what you want to learn — a few words is enough." Never a red box.

### UI-30 Voice input (`usePromptVoice`)
Web Speech API when present (`lang` = navigator.language, interim + continuous): interim text streams live, each final phrase is appended to the topic (space-joined). Otherwise MediaRecorder records a clip returned as `onClip(blob, seconds)` (transcribed server-side later by the Runner). Errors: blocked mic → "Microphone access was blocked. Allow it in your browser, or just type."; other → "Could not hear you. Try again, or just type."; no support → "This browser cannot record audio. Type it instead." `no-speech`/`aborted` ignored; Chrome's auto-end after silence is a normal stop. Exposes `supported, canRecord, listening, interim, seconds, error, start, stop, cancel` (cancel on scope dispose).

### UI-31 Pending prompt (survives sign-up and reload)
`usePendingPrompt`: the words (`topic`, `notes`, file metadata `{name,size,type}[]`, `voice: {seconds}|null`, `at` epoch ms) live in `useState('prompt:pending')` + localStorage key `bilimind:pending-prompt` (expires after 24h). `File`/`Blob` objects are held in module scope for the tab's life only. API: `pending`, `hasPending`, `set(payload)`, `patch({topic, notes})`, `clear()`, `heldFileList()`, `heldVoiceBlob()`. `draftFromPending(pending, files, voice)` rebuilds a ComposerDraft and computes `lostFiles` = metadata entries with no held File. Consumed once: cleared as soon as the course exists (back button never re-runs it).

### UI-32 Send from a public page (`usePromptStart`)
`begin(payload, sourceEl)`: `pending.set(payload)` then `handoff.depart(sourceEl, signedIn ? '/today' : '/start')`. `useStartCourse().startTo(topic?, level?)` for plain links: signed-in → `/create?topic&level`; stranger → `/start?next=/create?...`.

### UI-33 Ghost flight (`usePromptHandoff`) — the field never leaves the screen
- `depart(source, to)`: (reduced motion or no source → plain navigate). Clone the composer DOM node (`cloneNode(true)`), copy textarea/input values + heights + placeholders into the clone, give it `id="prompt-ghost"` (position fixed, z 9999, pointer-events none) pinned exactly over the source rect; append a `#prompt-veil` (fixed inset 0, z 9998, ink background, opacity 0). Hide the source (`visibility:hidden`). GSAP: veil → opacity 1 (0.5s power2.out); ghost "lift" scale 1→1.03 with shadow `0 24px 70px /.35` → `0 40px 90px /.5` (0.45s). A 9s give-up timer removes ghost+veil if nobody claims it. Then navigate.
- `arrive(target, {crossfade?, onLanded?})` on the next page after its composer mounts: returns false if no ghost (page reveals normally). Hides target; after two rAFs, GSAP timeline (power3.inOut): ghost tweens top/left/width/height to the target rect, scale 1, shadow `/.25`, 0.95s; veil fades out (0.7s, starting 0.25s in); `crossfade` (dashboard, different skin) fades target in and ghost out over the last 0.3s. On complete: unhide target, teardown, `onLanded()`. Hard land-by timer 2.6s (works even in a background tab where rAF is paused). Live DOM clone (not screenshot) so text re-wraps during the flight.
- Routes: hero → `/start` left pane; `/start` → `/today` (dashboard) after auth.

### UI-34 `/start` page (sign up without letting go of the sentence)
Two panes (`lg`: `minmax(360px,44%) | 1fr`; phone: stacked). **Left (ink stage)**: dots + lime radial glow, wordmark, the Composer (`tone=ink size=md`, send label "Keep this" — pressing send saves to pending and focuses the first form input instead of navigating), then eyebrow "Ready when you are"/"What happens next", title "Your course is queued. Sign in, and it starts." / "Say what you want to learn, then sign in.", a desktop-only list of 4 next steps (check "Your sentence is kept — it comes with you" [lime when a sentence exists], question "A few quick questions about you and the subject", flow "The path draws itself, topic by topic, live", calendar "Lessons land on your calendar, review sets itself"), and "Free to plan. No card. You read the whole plan before a single lesson is written." Items with `data-r` stagger in (0.7s, 0.08 stagger) after the ghost lands. **Right**: segmented "Create account | I have one" (`?mode=login`), title "Almost there." / "Welcome back.", copy, form (Name, Email, Password ["At least 8 characters"], Confirm password), per-field errors, form error box (401 → "That email and password do not match."), password mismatch check client-side. `?topic=` seeds the field (clipped to 240 chars) only if nothing is pending. Edits to topic/notes are patched into pending (reload-safe). On success: current field contents become the pending prompt (or it is cleared if empty) and the field flies to `/today`. — **Desktop port: no auth, so this page disappears** (see §11).

### UI-35 Dashboard runner (`PromptRunner` on `/today`)
The dashboard shows the Composer (`tone=day size=md`, send "Plan my course"): for a brand-new learner as the whole screen ("What do you want to learn?" + "Name a subject, drop in your files, or say it out loud. BiliMind plans the whole course for you — planning is free.", autofocus, placeholder "e.g. reading a balance sheet like an analyst") with suggestion chips below (`SUGGESTIONS`: "Balance sheets", "Italian for a trip", "Postgres performance", "Anatomy", "Sourdough"... clicking fills the field and focuses it); for an existing learner as a "Learn something new · Planning is free" card at the top of the day. On mount: `handoff.arrive(composer, {crossfade:true, onLanded: runPending})`; if no ghost but a pending prompt exists, `runPending` after 250ms (fills the draft; if topic <3 chars just leaves it filled and clears pending). `?topic=` pre-fills (does not run).
`PromptRunner` (props `payload`, `autostart`; emits `done(course)`, `failed(message)`; exposes `run`, `uuid`) shows a white card: lime 32px badge (pulsing while running; warning on failure) + headline "Starting your course…" / "Ready — opening your questions" / "That didn't go through", then an ordered step list built only from inputs present:
1. `voice` "Listening to your voice note" → `POST /speech/transcribe` (FormData `audio`=prompt.webm); appends text to topic; note shows the quoted transcript (≤80 chars); failure/empty = `skip` with "Could not transcribe it here — the typed words will do".
2. `files` "Saving N files" → `POST /materials` (FormData `file`) one at a time; note "Skipped: name — reason · ..." for refusals; all refused = skip.
3. `notes` "Keeping your notes" → `POST /materials {text, title:'Pasted notes'}`.
4. `read` "Reading your sentence" → `POST /courses {uuid, topic, material_ids?, skip_clarify:false}` (uuid makes retries idempotent); failure = `fail` + stop.
5. `ask` "Working out what to ask you" → `PUT /course-drafts/{uuid} {step: clarifying?'clarify':'generating', topic, material_ids, skip_clarify:false, course_id}` (silent on failure).
Step glyphs: wait = empty ring; run = spinner (lime-deep); done = filled lime-deep check; skip = amber warning; fail = coral X; optional note line under each. Failure shows a coral box with the message; the dashboard keeps the field filled and editable and hides the runner after 4s. Done → clear pending → navigate to `/create/{uuid}`.

## 5. Create flow (pages/create, ClarifyQuestions, MaterialPicker, GenerationProgress)

### UI-36 Durable create address (`/create` → `/create/{uuid}`)
`/create` is a doorway: mints `crypto.randomUUID()` and `replace`-redirects to `/create/{uuid}` keeping the query (`topic`, `level`). An invalid uuid param is silently replaced with a fresh one. The page is keyed by uuid (switching drafts rebuilds it). Three steps on one page: `compose` → `clarify` → `generating`. Phone bar: title "New course" (or the course title once known), back to `/library`, `barOnly`.

### UI-37 Draft autosave (`useCourseDraft(uuid)`)
State `{topic, goal, language:'en', level:'any', minutes_per_week:0, material_ids:[], skip_clarify:false, clarify: Record<questionId,{chips[], text}>}` + `step` + `course`. Deep watcher → debounced 700ms `PUT /course-drafts/{uuid}` with the whole body (+`course_id`); coalescing (a save in flight is awaited, then the latest state is sent); never surfaces errors; nothing saved until something changes (`dirty`); a `hydrating` flag stops `load()` from echoing the server's own data back. `load()` = `GET /course-drafts/{uuid}` (404 = new). `attach(course, step)` records the produced course and flushes immediately. `discard()` stops autosave and `DELETE`s the draft (called when generation finishes). Flush on unmount. UI shows a quiet line under the submit button once saved: spinner "Saving…" or check "Draft saved — you can close this and come back to it."

### UI-38 Resume logic
On mount `restore()` tries, in order: legacy `?course=ID` → fetch and redirect to `/create/{course.uuid}`; the saved draft (if it has a course → resume at clarify/generating); no draft → `GET /courses/{uuid}` (the uuid is also the course's address; library links straight here for courses still being built) and re-link the draft; else compose fresh, seeding `topic`/`level` from query without overwriting typed text. Opens the goal field and options panel if they hold non-defaults. `resumeFrom(course)`: status `clarifying` → clarify step (+poll if questions not there yet), else generating.

### UI-39 Step 1 — Compose
- Heading "What do you want to learn?" (27/34px) + "Say it the way you would to a teacher — the subject, and what you want to be able to do. BiliMind plans the whole course for you, free."
- Multiline topic `UiTextField` (4 rows, autofocus, maxlength 2000, server field error), placeholder "e.g. I keep writing slow database queries and want to understand how to reason about them properly."
- "Or start from one of these": 4 full-sentence example buttons (fill the topic): "Postgres query performance for application developers", "Kalman filters, with worked numeric examples", "Conversational Uzbek for a two-week trip", "Reading a company balance sheet like an analyst".
- "+ Say why you're learning it" → goal field (label "Why are you learning this?", hint "A real deadline or project changes what gets included — "pass the exam in March" beats "learn AWS".", 2000 chars).
- Collapsible "Language, level and pace" panel with a one-line summary (e.g. "English · beginner · 2 hrs a week"): native `<select>` of 15 lesson languages (en, uz "O'zbek", ru, es, pt-BR, fr, de, it, tr, ar, hi, id, zh, ja, ko — labelled in their own script); level toggle buttons `Not sure | Beginner | Intermediate | Advanced`; weekly time `Not sure yet | 1 hour | 2 hours | 3 hours | 5 hours` (0/60/120/180/300 min) with note "Only used to spread the lessons over a calendar. You can change it later." Selected = accent border + accent-soft fill.
- `MaterialPicker` (UI-42).
- Submit: lime `UiBtn` lg block (auto width ≥sm) "Continue" (or "Plan my course" when skipping questions), trailing arrow, disabled until topic ≥3 chars. → `POST /courses {uuid, topic, language, level? (omitted for 'any'), goal?, minutes_per_week? (>0), material_ids?, skip_clarify}`; validation errors are mapped per field + toast.
- Footer line: "Planning is free — you pick which lessons get written afterwards." + toggle link "Skip the questions and plan it now" / "Actually, ask me a couple of questions first".

### UI-40 Step 2 — Clarify
- While questions are being generated (async job): eyebrow "Step 2 of 3 · About you", "Working out what to ask you", explanation ("...Writing them takes about half a minute."), 3 skeleton question cards (rise-staggered), ghost "Skip the questions". Poll `GET /courses/{id}` every 1.5s up to 120s; stop when questions arrive, status `failed` (→ failed card), status moved past clarifying (→ generating), or deadline (→ failed card).
- Failed card (danger tone): "The questions didn't come through" + `failure_reason` + "You can plan the course anyway — what you already told BiliMind is enough to work with." Buttons "Plan it anyway" (= skip) and "Keep waiting" (restart poll).
- `ClarifyQuestions` (UI-41) when questions exist; submit → `POST /courses/{id}/clarify {answers:[{id, answer}]}` → step generating. Skip sends a single answer `{id: firstQuestionId|'skipped', answer: 'No preference — use your best judgement for scope, depth and format.'}`.

### UI-41 Clarify questions component
Props `questions: {id, question, why?, suggestions?[]}[]` (model asks 3–5), `submitting`, `topic` (shown under the heading, 2-line clamp). `v-model:draft` = `Record<id, {chips: string[], text: string}>` (persisted so a reload restores which chips are lit and the typed text). Header: eyebrow "Step 2 of 3 · About you", "A few questions before we draw the map", counter `answered/total` + 96px progress bar. Each question card (rise stagger 60ms): number badge → lime check when answered (card gets accent-line border, raised tone), question 14.5px, `why` 12.5px muted, suggestion chips (toggle; selected = lime fill with check; multi-select), small text field ("Add your own…" / "Type your answer…"). Composed answer per question = `"{chips joined by ', '}. {text}"` (or either alone); unanswered questions are omitted. Actions: primary "Build the outline" (sparkles; disabled until ≥1 answered), ghost "Skip the questions"; right-aligned status "All answered — this will be a sharper course" / "Answer at least one to continue" / "N unanswered — that's fine".

### UI-42 Material picker ("Ground it in your own material")
Collapsible section. Summary row: file icon well, title, subtitle = selected titles joined by " · " or "Slides, PDFs, notes, links — optional, but it changes everything", accent badge "N attached", chevron. Expanded: `MaterialsDropBar compact` (add file / link / pasted text inline; newly created material is auto-selected + toast "Material added — BiliMind is reading it in the background."), then "Your library" list (filter field appears when >6 items; filters title/url): each row a checkbox-style toggle with format icon, title, size line ("PDF · 12 min read" for ready material using char_count/1000 minutes, else KB/MB — never chunk counts), status badge with dot (pending neutral, processing accent, ready success, failed danger, needs_input warn). Stuck materials (`needs_input`/`failed`) show their reason + "Sort it out →" link to `/materials?material={id}`. Polls `GET /materials[?course_id]` every 3s while any row is pending/processing. Loading skeletons, error line, empty text "Nothing here yet. Anything you add above lands in your library and can be reused by any course." Props `courseId` (scope list to one course + course-less library), `disabled`, `startOpen`; emits `created`.

### UI-43 Step 3 — Generation progress (`GenerationProgress`)
Desktop header: eyebrow "Step 3 of 3 · Planning your course" + course title. The card (props `courseId`, `compact`, `initialCourse`; emits `refreshed(course)`, `done(course|null)`, `failed(reason)`; `#footer` slot with `{status, course}`):
- Transport: `useGenerationStream` polls `GET /courses/{id}` every 1600ms (SSE was dropped because EventSource cannot send a bearer header); terminal = status in `ready|failed|outlined|clarifying` AND no node queued/generating; on done does a final refetch and emits.
- **Ring** (76px, stroke 5; tone danger/success/accent): shows a **stopwatch `m:ss`** while outlining (title "Usually about 2 min"), a spinner when indeterminate (clarifying with no nodes), else the percent.
- **Headline** by status/phase: clarifying "Thinking about what to ask you"; outlining+waiting "Getting started", +thinking "Thinking through your course", +writing "Writing the steps", +checking "Checking the mix of lessons"; outlined "Your plan is ready"; expanding "Writing your lessons"; ready "Your course is ready"; failed "That didn't work".
- **Subline**: failed → failure_reason; outlining → (slow when elapsed > 2×120s: "Taking longer than usual, but still working. You can leave — the plan will wait for you.") thinking "Working out what to cover and in what order. The steps appear below as they are written — usually about 2 min in all." / writing "N steps so far, with more on the way." / checking "Making sure the course does not teach every lesson the same way. Nearly done." / waiting "Your course is next. This part usually takes a few seconds."; expanding → "Now writing: {title}" or "R of T lessons written"; outlined → "T lessons planned — now choose which ones to write".
- **Progress bar**: outlining progress = max(eased time progress `min(.95, 1-exp(-1.6·elapsed/120))`, phase floor [checking .9; writing min(.9, .5 + items×.015)]) and never goes backwards (high-water mark); otherwise max(stream percent, (ready+failed)/total). Indeterminate = shimmering 1/3 bar.
- **Phase chips**: during outlining `Start → Think it through → Write the steps → Lessons` (done/active/pending from `pipeline.phase`); otherwise `Plan → Lessons → Ready`. Right: "R/T lessons · N failed".
- **Grid**: while outlining with streamed `pipeline.items` (`{title, side}`) → cards appear live (numbered when on the path, dotted+dashed when a side item), plus 2 skeleton placeholders while phase=writing; with nothing yet → 8 dashed skeleton rows; once nodes exist → node cards with status glyph (check/alert/spinner/dot), title, `{estimated_minutes}m`, tone per status, and a pop-in flash for 1.4s when a node becomes ready.
- Note while outlining: "Once the steps are written, your course opens and BiliMind breaks each step into smaller lessons there. You can start choosing what to write straight away."
- **Event log** (diff of node statuses between polls, newest first, max 24 kept, 5 shown / 2 in compact): "Plan ready — N lessons", "Writing "X"", "Finished "X"", "Could not write "X"" (tone accent/success/danger). Poll error shown as a warn line.
- `useStopwatch(source)` advances server-counted `elapsed` once a second between polls (anchor reset on each fresh answer) so clocks tick instead of jump.
- `PACE` constants (measured prod p50/p90): planSeconds 120, planThinkingSeconds 55, lessonSeconds 95, researchSeconds 35, lessonSlowSeconds 220, partsBatchSeconds 150, writers 2. Helpers: `clockLabel` ("1:42"), `aboutLabel` ("under a minute" / "about N min", rounds up), `writingEstimate(n)` = max(130, n·130/2), `easedProgress`, `writingQueue(ordered, elapsed)` → `{writing, waiting, secondsLeft, slow}`, `startsIn(ahead, queue, elapsed)`.
- On done (not failed): drop the draft, show "Open my course" (lime) + "Taking you there…", and after 1.2s navigate to the course URL with `?expand=1` (opens the "choose which lessons to write" dialog immediately — the outline is free, writing is the paid step). On failed: "Try again" (`POST /courses/{id}/retry`; result `clarifying` → back to clarify step, else remount the progress card via `genKey`) and "Start over" (new uuid, topic carried in the query).

## 6. Library and courses pages

### UI-44 Library (`/library`, "Courses")
Page head: title "Courses", eyebrow "Your library", subtitle "N courses on the go" / "Nothing here yet"; desktop action lime "New course" (+), phone bar action `+` icon. Data: `GET /courses?shelf=library|archived|trash` with envelope `{data: CourseSummary[], meta: {shelf, counts: {library, archived, trash}, trash_retention_days}}` and `GET /course-drafts`.
- **One filter control** (`UiSegmented` with counts): `All` (always) + `In progress` (0<percent<100), `Being built` (status in clarifying|outlining|outlined|expanding), `Finished` (percent≥100) — each shown only on the library shelf and only when count>0 — then shelf chips `Archived` / `Trash` shown only when that shelf has items (or is selected). Selecting archived/trash refetches; the others filter client-side. If the selected chip disappears, falls back to All.
- **Filter box** (only when >4 courses): "Filter courses" — matches title/topic/goal only (explicitly NOT search). Filtered-to-nothing empty state: "No course matches — This filter only reads course titles and goals. Search to look inside lessons and files too." + primary "Search everything for "q"" (opens palette global, seeded) + "Show all courses".
- Courses represented by an open draft are hidden from the grid (shown in the Drafts strip instead) — library shelf only.
- States: load error (danger empty state + Try again); 6 skeleton cards; empty archived ("Nothing archived — Archiving takes a course out of your library without deleting anything. It keeps its link and everything in it.") / empty trash ("The trash is empty — A course you delete waits here for N days before it really goes.") with "Back to your courses"; brand-new ("No courses yet" + pitch + lime "Plan a course" + secondary "Start from my own files" → /materials); drafts-only ("Nothing planned yet — finish one of the above, or start something new.").
- **Course card** (grid 1/2/3 cols, rise stagger 40ms, whole card is a link except in trash): title (2-line clamp, accent on hover), summary line (`courseProgressLine` with writing = queued+generating), progress ring 42px when percent>0 (success at 100), overflow `UiMenu` (click stopped from navigating), blurb = goal or topic unless it equals the title (normalised), failure reason in danger text when failed, footer = **one verb button** (from `courseAction`; failed → "See what happened" secondary; clarifying → "Answer a few questions" accent; tone primary=ink, accent=accent-soft, secondary=outlined) + right-aligned context: "Archived {ago}" / "Being written now" / "Next {day}" / "Shared by link" / language name if not English. Card link: clarifying courses go to `/create/{uuid}`, others to the course URL.
- **Archive / trash / restore** — reversible, no confirm, toast with Undo: archive (`POST /courses/{id}/archive`, toast "“T” archived — It keeps its link and everything in it. Find it under Archived." Undo → `DELETE …/archive`), trash (`DELETE /courses/{id}`, "moved to the trash — Nothing is deleted yet — it stays for N days." Undo → `POST …/restore`). Menu actions: library card → Archive (or "Back to library" when archived), Move to trash (destructive). Trash card (dashed border, not a link) → footer "Put it back" button + "Deletes in N days"/"Deletes tomorrow"/"Deletes today" (from `purges_at`); menu Put it back / Delete forever.
- **Delete forever** is the only confirm: modal "Delete this course for good?" — "{title} and every lesson in it will be deleted now, along with anything you wrote or uploaded inside it. This cannot be undone." + "Leave it in the trash and it goes by itself in N days." Buttons "Keep it" / danger "Delete forever" (`DELETE /courses/{id}/forever`).

### UI-45 Drafts strip ("Pick up where you left off")
`CourseDraftsStrip` (library + Today): dashed accent-line box on accent-soft/35, pencil icon + "Pick up where you left off" + count when >1. Row per draft: title (course title || topic || "Untitled course"), state line + `agoLabel(updated_at)`: compose → "Just a topic so far"; clarify → "Working out what to ask you" (no questions yet) / "Questions answered — ready to plan" / "N of M questions answered" / "M questions waiting for you"; generating → "Planning stopped partway" (failed) / course status label / "Being planned". "Continue →" pill (≥sm) linking to `draft.path` (`/create/{uuid}`), trash button that discards the draft AND the half-built course (`DELETE /courses/{course_id}` then `DELETE /course-drafts/{uuid}`).

### UI-46 Course addresses and legacy redirects
Canonical course URL `/{username}/{slug}` (`course.path` from server; fallback `/courses/{id}`); a lesson is `?node={key}` on the course URL (key = stable slug from the outline, survives regeneration; numeric ids still accepted). `/courses/{id}` → 301 to canonical (carries `?node`); `/courses/{id}/nodes/{nodeId}` → 301 to canonical `?node={key}`. Not-found card "No course at this address — It may have been deleted, or it belongs to someone else." + "Back to courses". Helpers: `courseUrl`, `nodeUrl`, `nodeKeyById`, `findNode` (key or id), `requestedNodeKey`, `courseNodeUrl`.

### UI-47 Course page = two readers
`/{username}/{slug}`: route `validate` (user `^[A-Za-z0-9_-]{3,30}$`, slug `^[a-z0-9-]{1,60}$`) and SSR sets a real 404/502 status. Data `GET /u/{user}/{slug}`. If payload has `is_shared: true` → render `CoursePublicView` (read-only, no chrome) — indexable only when ≥4 written lessons (`INDEXABLE_MIN_LESSONS`) with schema.org `Course` (+`CourseInstance`, `syllabusSections` per written lesson) and `BreadcrumbList`, description built from topic + "N written lessons in an ordered path, with graded practice." (≤158 chars). Otherwise the owner's workspace (§7). Error card: not found → "No course at this address" + ("It may have been deleted, renamed, or it belongs to someone else." / signed-out "It may be private. If it is yours, sign in to open it.") + Sign in / Back to courses + Try again.

## 7. Workspace (Sidebar, TabBar, RoadmapBoard, Roadmap phone, NodeList, NodeView, NodeBrief, PlanPanel, FilesPanel, BoardTab, Assistant dock)

Host page: `pages/[user]/[course].vue` (owner branch) inside `layouts/workspace` (frame + rail; the page owns all scrolling). Desktop and phone layouts are both in the DOM; CSS hides one (`lg:flex` / `lg:hidden`); `useIsPhone()` tells the hidden copy it is hidden so time-on-task and section observers do not double count.

### UI-53 Desktop workspace frame (three panes + tabs)
Top bar (h-56px, border-bottom), left→right:
- **Lesson-list toggle** (`panel-left` icon, 32px; when the list is hidden the button turns accent-soft so it is findable). Persisted in localStorage `bilimind:sidebar` = open|closed, global across courses.
- **Breadcrumb**: course title (faint, links to /library) `/` active tab name (semibold): "Roadmap" for the map tab, sandbox title, or the lesson title.
- spacer
- **Readiness pill** (surface-mute, 7px dot + 12.5px text; tooltip "N not written yet"): in flight → pulsing lime dot "Writing N of T lessons"; failures → coral "N of T lessons need another go"; else green (all written) / dashed "R of T lessons written".
- **Primary course action**: planless (no nodes) → lime "Try again" (status failed) / "Draw the plan" with refresh icon (`POST /courses/{id}/retry`; if result is `clarifying`, toast "A few questions first — BiliMind is working out what to ask, then it can plan the course properly." and navigate to `/create/{uuid}`; else toast "Drawing the plan — This usually takes under a minute."). Otherwise, when stubs or failed lessons exist → secondary "● Write lessons" (opens the Write dialog, UI-63).
- **Share** (secondary; UI-73).
- **ReadingSettings** popover (UI-81).
- **Course overflow menu**: Archive / Move to trash (both navigate to /library first, then toast; no "delete forever" here).
- **Assistant toggle** (`panel-right` square; accent-styled while open; toggles closed ↔ docked).

Under the bar: `WorkspaceWritingStatus` line (UI-64). Then a row: `WorkspaceSidebar` (274px, when open) | `main` (tab strip + panes) | optional `HistoryPanel` | `WorkspaceAssistant` (docked 320px or floating) | optional `WorkspaceArtifactPanel` (docked 400px or floating).
- A failed course shows a coral banner at the top of `main`: failure reason + (if planless) danger "Try again".
- **Panes are stacked, not swapped**: every open tab is an absolutely positioned scroll box; inactive ones get `visibility:hidden` + `inert` (not `display:none`, not KeepAlive) so scroll position and un-submitted answers survive switching.
- No tabs at all → empty state "No lesson open — Pick a lesson from the list on the left, or open the roadmap to see how they connect." + primary "Open the roadmap" (`map` icon).
- New lesson tab first fetch → skeleton (eyebrow bar, title bar, 18rem block).
- Background polling: every 4s, while visible and (any node queued/generating OR `course.is_generating` OR `course.pipeline` set) → refetch course.
- `?node={key}` deep links open that lesson; the URL is kept in sync with the active lesson (client-side `router.replace`). `?panel=plan` opens the sidebar on Plan once then drops the flag. `?expand=1` opens the Write dialog pre-ticking the first 3 when stubs exist, then drops the flag.
- The page publishes a search scope `{id, title}` for the palette while mounted.

### UI-54 Tabs model (`useWorkspace(courseId)`)
State per course in `useState('workspace:courses')` map `{[courseId]: {tabs, activeId, sidebar}}` (session-lived; deliberately not in the URL beyond the active lesson). Tab kinds:
- `{kind:'map', id:'map'}` — always inserted at the front.
- `{kind:'node', id:'node:{nodeId}', nodeId}` — appended.
- `{kind:'sandbox', id:'sandbox:{key}', title, lang, code, tests?}` — opened by a lesson's code exercise via injected `OPEN_SANDBOX`; re-opening focuses rather than reseeding.
- `{kind:'board', id:'board:{uuid}', nodeId, uuid, title}` — a whiteboard.
API: `focus(id)`, `openMap()`, `openNode(id)`, `openSandbox(payload)`, `openBoard(nodeId, uuid, title)`, `close(id)` (closing the active tab focuses its right neighbour, else the left), `openNext(nodeId, replacingTabId)` (open next lesson and close the one being left — only when the caller says it is safe), `reconcile(nodes)` (drop node/board tabs whose node no longer exists; refocus last), `openInitial(course, requestedId)`: requested node if present; else if tabs already exist do nothing; else resume = first ready lesson in progress → first ready not completed/skipped → first ready; none ready → open the map. Global prefs: `assistant` mode (`docked|float|closed`, default docked) and `sidebarOpen`.

### UI-55 Tab strip (`WorkspaceTabBar`)
40px chrome strip, horizontally scrollable with hidden scrollbar. Tab = icon (map: lime `map`; sandbox: lime `play`; board: lime `pencil`; lesson: its 8px status dot) + title (max 172px ellipsis; semibold when active) + 19px close X. Active tab: white background + 2px lime inset bottom border. Middle-click closes. The active tab is scrolled into view when focused from elsewhere.

### UI-56 Sidebar (`WorkspaceSidebar`)
274px chrome column: header "Course" + a small **Map** button (accent when the map tab is active) → `openMap`; segmented control `Lessons | Plan | Files` (block); scrolling body renders `NodeList`, `PlanPanel` or `FilesPanel`. Default view Lessons (works before anything else exists).

### UI-57 Lesson list (`WorkspaceNodeList` + `NodeListRow`) — the roadmap's table of contents
Built from `courseTree`. Per step: optional chapter heading (10.5px uppercase faint) where `step.opens`; topic row = fold chevron (only if it has a cluster; rotates), numbered 18px circle (green check when completed; lime when active; else sunken), title (accent-strong semibold when active; muted when stub; struck through when completed/skipped [skipped ghosted]; underlined lime when in progress), still status dot, and a trailing count: folded → "done/total" of the cluster (e.g. "2/7") else `{estimated_minutes}m`. The topic containing the active lesson auto-unfolds unless the learner folded it by hand (manual fold/unfold sets tracked separately). Unfolded → subtopic rows (`NodeListRow`): indent 38px (depth 1) / 54px (depth 2), mark badge (13px coloured circle with white check) or a 6px grey dot, title (same progress styling), a 5px dot if open in a background tab, 6px status dot. Tooltip "title — Mark label — in Group". **Right-click a row toggles completed ↔ available** (roadmap.sh gesture). Active row: accent-soft fill.

### UI-58 Roadmap board (`WorkspaceRoadmapBoard`, desktop map tab)
Draws the `useRoadmap` layout (§8). Props `nodes, activeNodeId, title, further, selectedIds?, readonly?`; emits `open, expand, progress, further`.
- **Sticky header**: "Roadmap" + "N topics · M subtopics · {minutes label}"; legend of the 3 badges (coloured 14px circle + label; tooltip = blurb); hint "Click a box to see what it covers" (≥2xl); progress bar (112px green) + "P% done" (tooltip "d of t done, l learning").
- Empty: "The plan has not been drawn yet."
- **Fit to pane**: canvas laid out at fixed width (980) and CSS-scaled to `clamp(0.62, (paneWidth-16)/width, 1)` via ResizeObserver; below 0.62 the pane scrolls horizontally. Outer box takes the scaled height so the scrollbar is honest.
- **Desk**: white with a 20px dot grid (`radial-gradient rgb(20 22 31/.1) 1px`).
- **SVG layer**: dotted lead and tail (`stroke text-ghost 2.5, dasharray .5 7`), start circle r5 at the top, ties (`text-ghost 2.2, dasharray .5 5.5`; **lit** lime 2.5 when hovering the topic or a box the tie reaches), spine segments (`text-faint 3`; **done** = success green; drawn in on mount with `stroke-dashoffset` 460ms, 55ms stagger per segment).
- **Title**: 22px/26px `t-head` centred at the head of the line.
- **Chapter labels**: pills ON the line (eyebrow-loud, white, strong border), tooltip "Steps a–b".
- **Groups/families**: sunken panels (radius 13) behind items; group heading as eyebrow-loud; border turns accent-line when its topic is hovered.
- **Notes**: warm amber card (warn-soft/warn-line/warn-text, sparkles icon), clamped to the predicted lines.
- **Subtopic box** (`rm-item`): white card, strong border, radius 8, 13px/17px centred label clamped to predicted lines; hover lifts 1px; "kin" (its topic hovered) → accent-line border; tint by progress: done = sunken, faint, struck; learning = accent-soft/accent-strong; skipped = transparent dashed ghost struck. **Mark badge** 14px at the vertical middle of the edge nearer the spine. **Writing indicator**: 10px lime dot at the top-right corner, pulsing when generating, hollow ring when queued.
- **Topic box** (`rm-topic`): dark ink milestone (bg/border `--text`, white text, radius 10, 14px semibold, left padding 38px for the step badge); step badge 20px circle (white/16% → green with check when done, lime when learning/active, dashed when skipped); tints: done = white with success-line border + muted struck text; learning = accent-soft; skipped = dashed ghost. Rise-in stagger 40ms (max 14).
- Active lesson ring: `0 0 0 2px surface, 0 0 0 4px accent`; brief-open ring uses accent-line; selection ring (for a selection mode) uses accent.
- **End**: "Where to go from here" box with further-course link buttons, or "The finish line" pill (target icon, green).
- **Further links** (`rm-link`): accent-soft buttons with arrow-up-right; click → `/create?topic={link.topic}` (start a new course); tooltip "Start a new course: {topic}".
- **Interactions**: click → open the **brief** dialog (not the lesson); **right-click** toggles done; **shift-click** toggles learning; **alt-click** toggles skipped; keyboard Enter/Space = brief, `d` = toggle done. Box tooltip: "title — Mark — Status, N min — Step n — Done/Learning/Skipped". Marking is optimistic (UI-62).

### UI-59 Node brief (`WorkspaceNodeBrief`) — what a lesson is for, before opening
Shown in a compact modal (desktop board) or bottom sheet (phone, `phone` prop: stacked actions, 48px full-width button). All derived from `courseTree`.
- Place row: numbered badge (green check if done; lime if learning; ink if on the path; sunken otherwise) + "Step n" / "Under step n" · chapter · group · mark pill (dot + label, tooltip blurb).
- Title 18px; status line: dot + status label · N min · Done/Learning/Skipped.
- **Writing line** (live, ticks every second via `useStopwatch`): generating → "Writing for m:ss · usually about 2 min" or, past 220s, "Writing for m:ss — longer than usual, still going"; queued → "Next in line · starting now|starts in about N min" or "K ahead of it · starts in …" (computed with `writingQueue` + `startsIn`).
- Summary paragraph (node.summary, else "Step n of N on the path. The lessons beside it fill in the detail." / "Part of “Topic”." / "A lesson in this course."); mark blurb; topic **note** as an amber aside.
- "Covers" (topic) / "Includes" (family) chips for what hangs off it — clicking focuses that lesson's brief.
- Neighbour rows: on-path → "Before" / "Next" topics; subtopic → "Part of" family and "Step"/"Part of" topic; plus "This is where the course starts." / "This is the last step on the path."
- Actions: a 3-way mark group `Done (check) | Learning (play) | Skip (arrow-right)` (each toggles back to available) and the **one button**: ready → primary "Open lesson"; generating → status pill "Being written now" with spinner; queued → "Waiting to be written"; stub/failed → lime "Write this lesson" (sparkles) which opens the Write dialog pre-ticked with this lesson. Readonly hides actions.

### UI-60 Lesson pane (`WorkspaceNodeView`) — one open lesson
Props `nodeId, language, level, active, editable, allowsCode, preview (RevisionDetail), refreshToken`; emits `changed, open, next, close, blocks(nodeId, blocks), history(nodeId), board(nodeId, board)`. Server-rendered content (awaits `player.ready`). Applies reading-settings classes/zoom (UI-81).
- **Heading** (scrolls away): context line "Step n" (core, layer+1) or the mark label / "Under this step" · "N min" · `after “Prev”` · `then “Next”` (next step only, never a detour; titles clipped to 30 chars; "then" hidden on phones); title 21/25px `t-head` (or the preview's title).
- **Pinned strip** (sticky, translucent; only when there is content and not previewing): `LessonSpine` (UI-61) on the left; right side: Edit (secondary pencil; only when editable, ready, has blocks; disabled while writing or markup open), Mark complete / Completed (primary ↔ success), overflow menu (History [owner], Regenerate…). Strip height is measured (ResizeObserver) and published as `--lesson-header-h` so `#block-{id}` jumps land below it.
  - Editing mode strip: save state ("Not saved" / "Saving…" / "Unsaved changes" / "Saved"), Undo / Redo (Ctrl+Z / Ctrl+Shift+Z, foreground pane only), Cancel (asks "Discard your changes? — This lesson goes back to the version you started editing. Anything saved along the way is undone, and stays in History if you want it later." → Keep editing / Discard changes), Done (primary check). Conflict banner: "This lesson changed elsewhere. Reload to see the latest version — your unsaved typing here will be lost." + Reload / Stop editing.
  - Orphaned highlights note: "N highlights could not be placed since this lesson changed."
  - **Regenerate panel**: "Ask for it again, differently. Your progress and past answers are kept." (+ warning when `edited_at`: "This lesson has your edits — regenerating replaces them, and you can always restore them from History."), instruction input (placeholder "e.g. more practical, shorter, focus on the math", Enter submits) + primary "Rebuild", preset chips (`REGENERATE_PRESETS`: "more practical" → "Make it more practical — more worked examples, fewer definitions."; "shorter" → "Shorter. Cut anything that is not load-bearing."; "go deeper" → "Go deeper. Assume I already know the basics."; "harder practice" → "Add a harder assessment that makes me apply this, not recall it."). After submit: green note "Rewriting this lesson…" / "Rewriting with “…”. Your progress and past answers are kept." (dismissible).
- **History preview mode**: sticky accent bar "Viewing the version from {date} — {summary}. Changed parts are outlined. Removed here: …"; blocks render read-only; added blocks ringed green ("Added in this version"), changed ringed lime ("Changed · moved" + "Show changes"/"Hide changes" field-level token diff via `GET /revisions/{id}/field?block&field`), moved labelled.
- **State card** (status ≠ ready or no blocks): icon well (alert / layers / spinning loader), label (status label or working label), blurb (failure reason or status blurb), the stub's summary in a sunken box, for working lessons a progress bar (generating: eased progress vs 95s; queued: shimmer) + note ("Waiting its turn — lessons are written two at a time" / "Longer than usual, but still going" / "Usually about 2 min") + clock; buttons: stub → lime "Write this lesson", failed → primary "Try again", always "Close tab". Below: neighbour lists "Comes before" (prerequisites) and "Comes next" / "Under this step" (next steps solid, detours dashed with their mark dot).
- **Reading mode** (`.lesson` grid: text measure 760px, wide 1040px; wide-measure block types take the wide track; 40px row gaps; rise stagger 45ms): each block wrapped in `MarkupBlock` (personal highlights/ink) around `BlockRenderer` (grading emits `graded`). Then `LessonAttachments` (owner files), then the **Finish card**: "You finished this lesson." / "Done with this lesson?", "k of n assessments passed." or "Nothing here is graded — mark it complete when you are ready.", assessments progress bar (120px) "k/n passed", Mark complete button; "Comes next" (next step rows → `goNext`: replaces this tab only if the lesson is completed or has nothing to answer, else opens alongside) and "Under this step" detour chips.
- **Editing mode**: block list with `InsertMenu` between blocks and at the end (type picker + optional instruction → AI writes the block), `EditorFrame` per block (select, done, cancel, rewrite, remove, duplicate, move up/down, drag handle; native drag-and-drop with a lime 2px drop line above/below), selected block shows `BlockEditor`, others render read-only; editable title, summary textarea and minutes (1–600); `RewriteDialog` for per-block AI rewrite.
- **Pen** (signed-in reader, reading mode): floating 44px pencil button bottom-right; opens `MarkupToolbar` (tool, colour, size, undo/redo, whiteboards list, "new board", Done) sticky at the bottom centre.
- Section tracking: IntersectionObserver on `.lesson-section` (root = the pane's scroller, rootMargin -56px top) sets the active ordinal = topmost visible section; only while `active`.

### UI-61 Lesson spine (`LessonSpine`)
Shown when the outline has >1 section. Closed: "a/N" + current section heading + chevron. Open: popover (17.5rem, max 60vh) listing sections with a 5px dot (lime when the section's voice is `task` — something to do; dashed otherwise), heading, ordinal; click jumps (smooth scroll). Outline from `lessonSections(blocks)`: a block opens a section if it is first, has an authored name (explainer's leading `#`–`###` heading or `payload.title`), or is not an explainer; unnamed explainers fold into the section above. Heading = authored name → presentation label → outline noun (Explanation, Key points, Example, Worked example, Diagram, Comparison, Picture, Video) → voice noun.

### UI-62 Progress marking (optimistic)
`setProgress(nodeId, state)` on the page: paints immediately (`node.progress` replaced), `POST /nodes/{id}/progress {state}`; on `completed` toast "Marked as done — {title}" with Undo (→ available); on failure revert + error toast. Lesson pane's "Mark complete" toggles completed ↔ in_progress via the player. States: `available | in_progress | completed | skipped`.

### UI-63 Write dialog (`WorkspaceExpandDialog`) — choosing which lessons get written
Modal lg: "Which lessons should BiliMind write?" / "Planning the course was free. Writing a lesson takes a couple of minutes each, so you choose which ones are worth it."
- List = expandable lessons (status stub or failed) in reading order (`courseTree.flat`); subtopics indented; checkbox, title (accent when selected), mark dot, "retry" chip for failed, summary, `Nm`. Empty: "Every lesson in this course has already been written."
- Presets: Next 3, Next 6, All N, Clear. Opening with `initial` pre-ticks those; with `suggest` (hand-off from a fresh plan) pre-ticks the first min(suggest, remaining allowance).
- **Gap warning**: core lessons above the deepest selected one that are still empty and unselected → amber box "An earlier lesson on the path stays empty" / "N earlier lessons…" + "You can still study what you picked, but “A”, “B”, “C” and K more come first and will have nothing inside." + "Add them to the selection". Detours never count as missing.
- Footer estimate: "N lessons · {study minutes} of study · {about X} to write" (`writingEstimate`). Allowance line only when low (≤ 1/5 left) or over: "Only N left this month — your plan tops back up {reset}" / "N left this month". Buttons: Cancel; lime "Write N lessons"; when over allowance "Write the first N"; at zero "See plans".
- On submit (page): mark selected lessons `queued` locally at once (prevents double press), `POST /courses/{id}/expand {node_ids}` → toast "Writing N lessons — Usually about X. Keep reading meanwhile — the line at the top of the course shows how far along it is."; refetch course + allowance. 409 → info "Already on it"; 402 → refresh allowance; other errors → toast + refetch.

### UI-64 Writing status line (`WorkspaceWritingStatus`)
Renders only while something is happening. Accent-soft strip under the top bar (phone: two lines). Lessons row: spinner + "Writing N lessons" · "k done" · "Now: {title (link opens it)} m:ss" (the one writing longest) or "· starting" · right "about X left" / "Taking longer than usual". Parts row (pipeline stage `parts`): "Adding smaller lessons under each step · part b of B · N added so far" + "about X left"/"Nearly done". When the last in-flight lesson lands: green strip "“Title” is written" + "Open it" (single) or "N lessons written", for 6s. A 2px progress bar on the bottom edge: lessons = (done + Σ eased progress of writing ones)/(done+in flight); parts = max(batches_done/total, eased time). Only lessons seen in flight while on screen are counted as "finished".

### UI-65 Plan panel (`WorkspacePlanPanel`) — the course on a calendar
- No nodes: "The plan appears once the structure exists."
- No schedule: card "Put this on the calendar — Pick a weekly budget and your study days. Miss one and the rest shifts forward." → "Set a schedule" opens a form: Start date (default today), Minutes per week (default course minutes_per_week if ≥10 else 240; step 15, min 10), Study days (7 toggles, default Mon/Wed/Fri = [1,3,5]); validation "Pick at least one study day." / "A study week needs at least 10 minutes in it."; "Build plan" → `POST /courses/{id}/schedule {starts_on, minutes_per_week, days_of_week}` → toast "Schedule built — N sessions on the calendar."
- With schedule: two stat tiles "This week h/budget h" and "Sessions done/total"; **slippage** amber note (never red): "One session slipped — no problem." / "N sessions slipped — no problem." + "Your plan shifted D days so you keep X hrs a week. Nothing was dropped."; rows sorted by date: weekday + day-of-month column, lesson title (click opens it), badge by tone — done "Done", skipped "Skipped", overdue "Moved forward · was Nd ago" (amber), today "Today · N min" (lime), pending "N min"; a check button marks done (`PATCH /schedule-items/{id} {state}` — returns the whole recompacted schedule; toggling the same state goes back to pending). `moveTo(item, date)` exists for rescheduling.

### UI-66 Files panel (`WorkspaceFilesPanel`)
Per course material: format icon, title, status dot (ready green; processing lime pulsing "Extracting"; pending dashed "Queued"; failed coral; needs_input amber "Needs you"), summary line: stuck → failure reason; not ready → "Still being read…"; ready → "{Format} · used by N lessons you have open" / "· open a lesson to see where it was used" / "· not used by any lesson you have open yet" (attribution from `block.source_material_ids` of lessons loaded this session — never claims "0" for unopened lessons); stuck → link "Paste the transcript" (when `wants=transcript`) / "Sort it out" → `/materials?material={id}`; chips of lessons that used it (click opens). Empty text: "No files on this course yet. Add your own slides or notes and BiliMind will teach from them, quoting them back to you instead of inventing an example." Dashed "+ Add material" → `/materials?course={id}`.

### UI-67 Whiteboard tab (`WorkspaceBoardTab`)
Private markup record (kind `board`) keyed by uuid on a lesson. Uses `useAnnotations(nodeId)`; draws the seeded record immediately (handed over by the lesson pane) until the server copy arrives; edits upsert. States: "Opening the whiteboard…", gone → "This whiteboard is gone — It was removed, or it belongs to a lesson you can no longer open."

### UI-68 Assistant dock (`WorkspaceAssistant` + `AssistantBody`, `useAssistant`)
Three homes: **docked** (320px right column; header spark icon + "Assistant" + pop-out + close), **floating** (372×564 card bottom-right over content, "FLOATING" tag, dock + close; overlays rather than reflows), **closed** (a pill "✦ Ask assistant" bottom-right, shadow-lift). Body:
- Scope segmented `This lesson | Course | Materials` ("what the assistant is grounded in").
- Empty thread: "Grounded in **this lesson/the whole course/your materials**. Tap a starting point:" + up to 4 **openers derived from the open lesson's blocks**: analogy → "Where exactly does this analogy stop working?"; worked_example with >1 steps → "Walk me through step n of the worked example" (n = min(steps, ceil(steps/2)+1)); playground → "What actually happens when I raise {first input label}?"; code → "I'm stuck on the code exercise — give me a hint, not the answer"; diagram → "Talk me through this diagram one arrow at a time"; comparison → "Which of these would you actually pick, and why?"; scenario → "I picked wrong in the scenario — what was I missing?"; always a fallback "Explain “{lesson title}” to me like I have five minutes".
- Messages: user = ink bubble right (pre-wrap); assistant = chrome bubble left rendered as Markdown; typing indicator = three blinking dots. An assistant reply may carry an **artifact** card ("Made for you · tap to open", file or sparkles icon) → opens the Artifact panel.
- Composer: pinned-block chip "Asking about the block you pointed at" (target icon, X unpins), input "Ask, or point at a block…" (Enter sends), ink send button (disabled while busy/empty).
- Wire: `POST /assistant/chat {message, course_id, node_id (only when scope=node), block_id (pinned), conversation_id}` → `{message, conversation_id?, artifact?: {id, kind: html|pdf|markdown, title, url?}}`. Pin clears after a reply. 404/405/501 → "The assistant is not wired up on this server yet…". Switching lesson resets the thread (new grounding).

### UI-69 Artifact panel (`WorkspaceArtifactPanel`)
The assistant's "made for you" outputs. Shares the single right dock with the assistant: whichever was last asked into the dock takes it, the other floats; closing the artifact returns a floating assistant to the dock. Docked 400px or floating 560px tall card. Header: kind chip (mono glyph `</>` orange for html / `PDF` red / `MD` blue), title, "Made by the assistant · Web page|PDF|Note", Preview/Code flip (html/markdown), "Assistant" switch (docked), overflow (Open in a new tab, Copy source, Download as `{slug}.{html|pdf|md}`), dock/float, close. Body: loading spinner "Rendering your web page…"; error state with Try again / Open in a new tab; html in a faux browser window (traffic lights, filename "url", open button) inside an `<iframe srcdoc sandbox="allow-scripts allow-popups allow-forms allow-modals">` (never same-origin); pdf via blob object URL iframe; markdown rendered (max 640px) or raw source. Data: `GET /artifacts/{id}`, `GET /artifacts/{id}/raw`.

### UI-70 History panel (docked)
`HistoryPanel` (components/history; detailed in the editing inventory) docks where the assistant lives; opening it closes the assistant and restores the previous assistant mode on close. Lists revisions, preview a version (renders in the lesson pane as UI-60 preview mode), "back to latest", restore (bumps that pane's `refreshToken` and refetches the course).

### UI-71 Phone workspace (`WorkspaceMobile`)
Full-screen surface (no rail/PageHead): 48px top bar (back to /library, course title, ReadingSettings sm, search button [the only way to search on a phone], "● Write lessons" when stubs/failed exist, course overflow menu); WritingStatus (phone variant); failure banner with "Try again" if planless; content by tab; bottom tab bar **Study (workspace) · Map (spine) · Plan (calendar) · Files (file) · Ask (spark)** (`?panel=plan` opens Plan).
- Study: the active lesson in one `NodeView` (no tabs on a phone; `next` simply opens the next lesson; close → Map), or empty "Nothing open — Pick a lesson from the map and it opens here." + "Open the map".
- Map: `WorkspaceRoadmap` (UI-72); tapping a box opens the **focus sheet** (NodeBrief `phone`); its button opens the lesson and switches to Study, or opens the Write dialog.
- Plan: "Your plan" + PlanPanel. Files: "Files — What you added yourself. BiliMind teaches from these and quotes them back to you." + FilesPanel. Ask: "Assistant" + `AssistantMobile` (generic opener only; artifacts open in a new browser tab).

### UI-72 Phone roadmap (`WorkspaceRoadmap`)
Same grammar, no geometry: "Your roadmap" (23px), "N topics and M subtopics. Work down the line — you are on step n / at the start.", green progress bar "P% · d/t", legend + "Tap a box to see what it covers." Each step: a vertical rail column (3px line; segment below a completed topic turns green) with a 24px numbered circle (green check / lime when active or learning / dashed when skipped / ink), chapter eyebrow when it opens, the topic card (ink until done, then clears; status label · N min; chevron), the note as an amber aside, then the cluster indented with dotted connectors (group headings as eyebrows followed by members; family children one indent further), mark badges, `Nm`; per-topic further links; end "Where to go from here" or "The finish line" pill. Right-click/long-press marks done; tap → focus sheet.

### UI-73 Share
Desktop "Share": if `course.share_url` exists use it, else `POST /courses/{id}/share` → `{share_url}`; copy to clipboard; toast "Share link copied — Read-only: no answer keys, no progress, and none of your uploaded materials." The shared URL is the course's own `/{user}/{slug}` (now publicly readable via `CoursePublicView`).

## 8. Roadmap layout algorithm (useRoadmap.ts)

Source: `composables/useRoadmap.ts` (1105 lines). Pure, synchronous, DOM-free (identical on server and client). Two stages: `courseTree(nodes)` reads the shape; `useRoadmap(nodes, {title, further})` returns a computed `RoadmapLayout` with pixel coordinates. `RoadmapBoard.vue` only draws what it is handed. **This is roadmap.sh's grammar** (one solid line of topics; dotted ties to what each topic covers), deliberately not a DAG.

### UI-48 Vocabulary used by the roadmap and everywhere else
- **Track** (`lessonTrack(node)`): `core` (a TOPIC on the solid line) or `subtopic` (hangs off a topic). Legacy `recommended`/`optional` tracks are read as `subtopic`; missing track = `core`.
- **Mark** (`lessonMark(node)`): badge on a subtopic — `recommended` (label "Recommended", short "our pick", blurb "Our pick — do this one.", colour `var(--accent)`), `alternative` ("Alternative", "pick this or the violet one", "Pick this or the recommended one, not both.", `var(--success)`), `anytime` ("Learn anytime", "order not strict", "Order not strict. Come back to it whenever.", `var(--text-faint)`). Legacy: track `recommended` → mark recommended; `optional` → anytime. `MARK_ORDER = [recommended, alternative, anytime]`. (Copy still says "violet" from an older palette — the badge is now lime; fix the copy in the port.)
- `TRACK_META`: core "On the path" / "Follow these in order — each one is assumed by the next."; subtopic "Under this step" / "What a step covers. Tied to it with a dotted line."
- **Progress** (`progressOf(node)`): `completed | in_progress | skipped | null` (null = pending; `available` maps to null). roadmap.sh's four states.
- `orderedLessons(nodes)`: sort by `layer`, then `position`, then `id`.
- Node fields consumed: `id, key, title, track, mark, group, note, branch_of_node_id, section, layer, position, estimated_minutes, status, progress`. `FurtherCourse {title, topic, after_key|null}`.

### UI-49 `courseTree(nodes)` — reading the shape (never drops a node)
1. `ordered = orderedLessons(nodes)`; `topics = ordered.filter(track==core)`; `spine = topics.length ? topics : ordered` (a course with no topics is a plain sequence).
2. `steps[i] = {node, step: i+1, items: [], opens}` where `opens = node.section` (trimmed) if non-empty and different from the previous spine node's section, else null (chapter heading only where a chapter starts).
3. Parent resolution, walking `ordered` and tracking `lastTopic`: for each non-spine node, `parent = branch_of_node_id` if it exists in the course and is not itself, else `lastTopic ?? spine[0]`.
4. `topicOf(id)` climbs parents (max 8 hops) to the owning spine node.
5. Placement: if the parent is a topic, OR the parent is a subtopic that is not itself first-level (chain deeper than 2) → depth-1 item on the owning step (`parentOf = topic`). If the parent is a first-level subtopic (its parent is a topic) → depth-2 item (`parentOf = parent`). `stepOf` records each node's step.
6. Second pass: depth-2 items join their parent's `children`; if the parent turned out not to be depth-1, the item is lifted to depth 1 on its owning step. **Max depth is 2** (topic → subtopic → sub-subtopic, "one level, never more").
7. Items and children sorted by `position`, then `id`.
8. Output `{steps, byId, parentOf, stepOf, flat}` where `flat` = reading order: topic (depth 0), then each item (depth 1) followed by its children (depth 2). The board, the sidebar list and the phone list all use this, so they never disagree.

### UI-50 `wrapLabel(text, charsPerLine, maxLines)` — deterministic wrap
Character-count greedy word wrap (no text measurement, so SSR and client agree). Collapses whitespace; empty → `['Untitled']`. Words longer than a line are hard-broken with a trailing `-` (chunks of `chars-1`). If text overflows `maxLines`, the last line is cut to `chars-1` and gets `…`. **Anything rendering these labels must clamp to the same line count.**

### UI-51 Metrics (CSS px; the board's CSS must match)
`pad 28`, `flank 300` (band beside the spine where a cluster goes), `gap 44` (topic edge → flank inner edge), topic `{width 236, padY 12, line 18, chars 24, maxLines 3, font 14}`, item `{padY 8, line 17, chars 38, shortChars 18, maxLines 2, font 13}`, `charPx 7.0` (generous avg glyph width at 13px), `gutter 8`, group `{pad 10, head 22, chars 34}`, note `{padY 10, line 16, chars 38, maxLines 4}`, link `{height 34, chars 26}`, label `{height 24, gapAbove 30, gapBelow 22}`, `stack 10` (vertical gap between rows), `step 34` (gap between topic rows), title `{line 26, chars 30, maxLines 2, lead 48, gapBelow 34}`, finish `{pad 12, head 22, width 560, tail 44}`, finishPill `{width 176, height 30}`.
Heights: `topicH = 2·12 + lines·18`; `itemH = 2·8 + lines·17`; `noteH = 2·10 + lines·16`.

### UI-52 `useRoadmap` — the layout pass
- **Canvas**: `spineX = pad + flank + gap + topicW/2 = 28+300+44+118 = 490`; `width = 2·spineX = 980` (min 720); height computed (min 320). The spine is a vertical line at `x = spineX`.
- **Head**: title wrapped at 30 chars/2 lines; box `x = spineX-190, width 380, y = pad + 48`; `lead` = dotted line `M spineX pad L spineX titleTop-8`. `cursorY = titleTop + titleH + 34`. The title acts as the first spine anchor (`bottom = titleTop+titleH+6`).
- **Further links split**: each `further` link whose `after_key` matches a topic key goes into that topic's cluster (`linksAfter`); the rest are `endLinks`.
- **Per topic (in step order)**:
  1. If `step.opens`: push a LabelBox (chapter heading on the line) at `y = cursorY + 30`, `x = spineX-150, width 300, height 24`, with `fromStep` and `steps` (= run length until the next chapter); `cursorY = y + 24 + 22`.
  2. Topic label wrapped at 24 chars / 3 lines; `topicH`.
  3. **Build cluster rows in reading order** over `step.items`:
     - item with children → flush loose; `family` row: header item wrapped at 34 chars/2 lines + inner rows packed into `flank - 2·10` width; height `= 2·10 + itemH(header) + 10 + innerHeight`.
     - item with a non-empty `group` → first member creates a `group` row at that position (later members join it regardless of position); flush loose before creating.
     - otherwise → `loose` buffer.
     - `flushLoose` = `packInner(loose, flank)`: **two consecutive short titles (≤18 chars) share a row** (cell width `(W-8)/2`, cell chars `floor((cell-20)/7)` min 8); otherwise the item takes a full row (chars `floor((W-20)/7)` min 10); row height = itemH of the taller label. Emits `pair` or `item` rows.
     - Groups with <2 members are demoted to a plain `item` row (wrapped at 38 chars). Real groups: inner packed into `flank-20`, height `= 2·10 + 22 + innerHeight`.
     - Then one `link` row per further-link anchored after this topic (1 line at 26 chars, height 34).
     - `innerHeight(rows) = Σ heights + (n-1)·10`; `clusterH = Σ row heights + (rows-1)·10`.
  4. **Note**: `node.note` wrapped 38 chars/4 lines → `noteH`.
  5. **Side alternation**: `clusterSide = leadRight ? 'right' : 'left'`; `noteSide` = the opposite flank when there is a cluster, else the cluster's side. `leadRight` flips only for topics that have a cluster or a note (bare topics don't burn the alternation). Starts with right.
  6. `rowH = max(topicH, clusterH, noteH)`; `centerY = cursorY + rowH/2`. Topic box `x = spineX - 118, y = centerY - topicH/2, width 236`.
  7. **Spine segment** from previous anchor's bottom to this topic's top: `M spineX y1 L spineX y2`, `done = previous topic is completed` (the line fills in as you progress). The title→first topic segment is never done.
  8. **Stack cluster rows** down the flank, vertically centred on the topic: `x0 = side right ? topic.x+236+44 : topic.x-44-300`; `y` starts at `centerY - clusterH/2`. For each row: tie target x `tx = right ? x0 : x0+300`, `cy = row centre`.
     - pair/item rows → ItemBox(es) (depth 1, parent = topic); pair cells at `x0 + k·(cell+8)`.
     - group → GroupBox `{kind:'group', title, x0, y, width 300, height}`; members placed inside at `(x0+10, y+10+22)` width 280.
     - family → GroupBox `{kind:'family', itemId}`; header ItemBox at `(x0+10, y+10)` width 280 (depth 1); members below at `y+10+headH+10` (depth 2, parent = family item).
     - link → LinkBox `{side, topicId}` full flank width, height 34.
     - **One dotted tie per ROW** (a pair shares one, a group gets exactly one): `tie(sx, sy, tx, cy)` from the topic's near edge midpoint (`sx = right ? topic.x+236 : topic.x`, `sy = topic.cy`). `y += row.height + 10`.
  9. Note box on `noteSide` at the same flank x, vertically centred on the topic, with its own tie.
  10. `cursorY = centerY + rowH/2 + 34`.
- **Tie path** (`tie(sx,sy,tx,ty)`): cubic Bézier bulging horizontally: `bend = max(18, |tx-sx|·0.5)`, `dir = sign(tx-sx)`; `M sx sy C sx+dir·bend sy, tx-dir·bend ty, tx ty`. Values rounded to 2 decimals.
- **End**: if `endLinks` exist → "Where to go from here" finish box (width 560 centred on spine, `y = cursorY + 6`), links in a grid of `min(3, n)` columns, cell width `(560 - 24 - 8·(cols-1))/cols`, rows of height 34 with 8 gutters, header 22, padding 12; spine segment to the box. Else if any topics → finish pill (176×30 at `cursorY - 4`, "course finished" marker) with a spine segment to it. `tail` = dotted `M spineX bottom+6 L spineX bottom+44`; `height = bottom + 44 + 28`.
- **Counts** over `tree.flat`: `topics, subtopics, total, done, learning, skipped, minutes` (sum of estimated_minutes).
- Output: `{width, height, spineX, title, topics, labels, items, groups, notes, links, ties, spine, lead, tail, finish, finishPill, topicById, itemById, counts}`.
- Semantics rule: **only the solid spine means "next"; dotted ties never do**.

## 9. Composables (useWorkspace, useNodePlayer, useApi)

### UI-74 `useWorkspace` — see UI-54 (tabs, sidebar view, assistant mode, sidebar open, openInitial, openNext, reconcile).

### UI-75 `useNodePlayer(nodeId, onCourseChanged, isForeground)` — one open lesson's brain
One instance per open tab.
- **Fetch**: `useAsyncApi('player-node-{id}', '/nodes/{id}')` (SSR-rendered; caller awaits `ready`). Two sources: last fetch + a session-local override (`local`) that wins until the next refetch. `PlayerNode` = node fields + `blocks[]`, `assessments[]` (each optionally with embedded `attempts[]`), `attachments[]`, `prerequisites[]`/`next_nodes[]` (`NodeBrief {id, key, title, status, layer, track}`), `progress {state, time_spent_seconds, completed_at, last_seen_at}`, `course {id, title, language, status}`, `writing_for`, `edited_at`, `current_revision_id`.
- `blocks` sorted by position, id. `attempts` = embedded or fetched per assessment (`GET /assessments/{id}/attempts`), newest first. `passedCount` = assessments with any passed attempt.
- `onGraded({assessmentId, attempt, nodeState?, nodeCompleted?})`: prepend attempt; update node progress state; when the node completes → toast "Lesson complete — Every assessment here has been passed." + `onCourseChanged`.
- **Time on task**: 1s ticker counts only while the browser tab is visible AND the pane is foreground; ships `POST /nodes/{id}/progress {time_spent_seconds}` every 30s (re-queues on failure), flushes when the pane goes to background, on unmount, and via `api.beacon` (keepalive fetch) on `beforeunload`/`pagehide`.
- `setState(target)` optimistic `POST /nodes/{id}/progress {state}` with revert + toast; `toggleComplete()` = completed ↔ in_progress.
- `regenerate(instruction)` → `POST /nodes/{id}/regenerate {instruction?}` → show queued → poll. `expand()` → `POST /courses/{courseId}/expand {node_ids:[id]}` (409 = already queued → still poll). Busy flag set *before* the request (prevents double press).
- **Polling** a working node: every 1.6s (first after 1.2s) `GET /nodes/{id}` until ready/failed, deadline 20 min (then toast "Still working — This lesson is taking longer than usual. It will appear here as soon as it is written."). On finish: reload attempts, `onCourseChanged`, toast "Lesson written"/"Lesson rewritten" or "Generation failed" + reason. Auto-starts polling on mount if the node is queued/generating.
- Exposes `working`, `workingLabel` ("Writing this lesson" / "Rewriting this lesson" / "Rewriting: “…”"), `inFlight`.
- `REGENERATE_PRESETS` — see UI-60.

### UI-76 `useApi` / `useAsyncApi` — the transport (replace in desktop)
- `useApi()` → `{base, url(path), beacon(path, body), request, get, post, put, patch, del}`; options `{query, headers, body (FormData supported — JSON headers dropped), signal, timeout, unwrap (default true: peel Laravel `{data}`)}`; `retry: 0`. Attaches `Authorization: Bearer {cookie bilimind_token}`. 401 on a session that existed → clears auth state and redirects to `/login?next=` (never for `/auth/*` or anonymous readers).
- `ApiError {message, status, statusCode, errors: Record<field, string[]>, data}` with `isNetwork` (status 0), `isValidation` (422 + errors), `isNotFound`, `first(field)`, `allMessages`. `toApiError(any)` normalises; status fallbacks: 0 "Can't reach the BiliMind API. Is the backend running?", 401/403 "That action is not allowed.", 404 "Not found.", 409 "That conflicts with something that already exists.", 419 session expired, 422 "Some of those details need fixing.", 429 "Too many requests. Wait a moment and try again.", 5xx "The server hit an error. Try again in a moment.".
- `useAsyncApi(key, path, opts)` = SSR-safe `useAsyncData` wrapper with the same unwrap/error semantics.
- Base URL: browser `public.apiBase`; SSR `apiInternalBase` when set.

### UI-77 Other composables this UI leans on
`useSearch` (UI-26), `useToast` (UI-17), `useNodeStatus` (UI-08), `useRail` (UI-21), `useIsPhone` (<1024px media query; false on SSR), `usePendingPrompt`/`usePromptHandoff`/`usePromptStart`/`usePromptVoice`/`useStartCourse` (§4), `useCourseDraft` (UI-37), `useGenerationStream` (UI-43), `useStopwatch` + `utils/pace.ts` (UI-43), `useSchedule` (UI-65), `useAssistant` + `useArtifacts` (UI-68/69), `useReadingSettings` (UI-81), `useBlockAnchor` (UI-78), `useAllowance` (meter + `low()` = ≤ 1/5 left, `resetsLabel`, `ensure()`, `load()`), `useAnnotations`/`useMarkupTool` (markup), `useRevisions` (history), `useLessonEditor` (editing), `useLessonSections` (UI-61).

### UI-78 Block deep-link anchoring (`useBlockAnchor`)
Hash `#block-{id}` (from search hits or pasted links) → waits (poll every 100ms, up to 6s) for an element `#block-{id}` that is NOT inside an `inert` (hidden-tab) pane, scrolls it into view (its `.lesson-section` scroll-margin clears the pinned strip), and flashes a ring for 1.4s (inline box-shadow, radius 14px). A newer request supersedes a pending one. `anchorBlock(id)` can be called imperatively (re-choosing the lesson you are already on).

## 10. Course components and reading themes

### UI-79 Public read-only course (`CoursePublicView`)
Rendered for anyone who doesn't own the course (and only if public). Header: lime lozenge + "BiliMind", outline badge "Shared course" (≥sm), light/dark theme toggle (legacy `useTheme`), lime "Make your own" (→ `/start` or `/create` via `startTo()`). Hero: eyebrow "Shared course", title 32/42px, "by {owner name}", goal or topic, outline badges (N lessons, total reading time "Xh Ym", level, LANGUAGE code). Body: every lesson in order as an `<article id="{node.key}">` (anchor by key, e.g. `#superposition`) with "Lesson n", title, summary, "N min · k assessments", then all blocks read-only (no answer keys, no progress, no attempts — stripped server-side), or a dashed "This lesson is in the outline but hasn't been written yet."; empty course → "This course has no lessons yet — The owner shared it before the outline finished generating." Desktop right rail (220px, sticky): "Contents" numbered links + "w/N lessons written". Footer: "Made with BiliMind — a course you can schedule, resume and own." + lime "Build one from your own notes". (Also used when indexable: SEO head/JSON-LD — UI-47.)

### UI-80 Course schedule tab (not in this slice's file list)
`components/CourseScheduleTab.vue` (727 lines) exists as an older/alternate schedule view; the workspace uses `PlanPanel` (UI-65). Implementers porting the calendar should read it alongside the scheduling inventory.

### UI-81 Reading settings ("Aa" popover) and reading themes
`ReadingSettings` button ("A" + small "a", 32/36px; accent when open) opens a 300px popover (right/left aligned):
- **Text size**: small-A button, range slider 0.75–1.6 step 0.05 (shows "N%"), large-A button. Applied as CSS `zoom: var(--reading-zoom)` on `.lesson` and `.lesson-heading` only.
- **Typeface**: Sans | Serif (serif = `Charter, 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Georgia, serif`, applied to the lesson column and the lesson title).
- **Background**: Paper (#fff/#18181b swatch) | Warm (#f6efe2/#2b2418) | Dim (#1f2024/#e6e6ec), each a swatch tile "Aa" + label.
- Footer: primary "Set as default" / disabled "This is your default" (signed out: "Sign in to keep these on every device."), "Reset" when the session differs from the default.
- Model: account default `users.preferences.reading {scale, font, theme}` (defaults `{1, 'sans', 'paper'}`) overlaid by a session-local working copy (`useState('reading:local')`) shared by every lesson pane; changes preview instantly; only "Set as default" writes (`updateProfile`), toast "Saved as your default". `classes` = `reading-surface reading-font-{font} reading-theme-{theme}`, `style` = `--reading-zoom`.
- Themes re-point only the `--color-*` tokens inside the lesson container (nothing outside notices):
  - **warm**: bg `#f1e9da`, surface `#f8f2e6`, chrome/raised/mute `#f3ecdd`, sunken `#ede4d3`, track `#e9dfcc`, borders `#e6dbc7` / strong `#dccfb8` / field `#d9ccb4` / rule `#ece2d0` / dashed `#c9bba1`, text `#2a2318` / body `#33291c` / dim `#3f3527` / soft `#5b4f3e` / muted `#76695a` / faint `#9c8f7d` / ghost `#c2b6a5`, accent-soft `#eef3d4`, accent-line `#d6e5a2`.
  - **dim** (color-scheme dark, the landing's stage): bg `#0f1116`, surface `#14161c`, chrome/raised/mute `#1d2027`, sunken `#262a33`, track `#2c313b`; borders white `.10/.20/.24/.07/.32`; text paper `#faf7f0` then `.88/.78/.66/.52/.40/.26`; accent `#c8f135`, accent-strong `#cfe870` (lifted for text on dark), accent-soft `#262d10`, accent-line `#3e4a1b`; success soft `#14261b` line `#1f3d2a` text `#7fd18a`; warn soft `#2b2411` line `#4a3c17` text `#ffc933`; danger soft `#331e18` line `#4d2b22` text/base `#ff9b85`.
  - **paper**: the default light tokens.

## 11. Porting to BiliMind Desktop

_pending_
