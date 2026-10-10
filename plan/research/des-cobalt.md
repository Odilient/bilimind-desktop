# COBALT design system: landing + BiliMind Desktop

> Source of truth: `plan/reference/design/hero-v7/11-cobalt-landing.html`, built from
> `plan/reference/design/hero-v7/11/` (`base.css` tokens, `page.css` page sections, `story.css`
> the app redrawn in cobalt, `shell.html`, `bento.html`, `sprite.html` icons, `js/{page,story,obj}.js`,
> `parts/*.html`, `shots/*.png`). Companion file: `plan/research/cobalt-tokens.css` (drop-in tokens,
> light + dark, base element styles).
>
> Every value below was read from those files. Where the app needs a value the landing never
> defines, the line says **(app)** and gives the reasoning. Line references are `file:line`.

## 0. Summary
_pending_

## 1. Tokens

### 1.1 Raw palette (landing, `11/base.css:8-41`)

| Token | Value | Role on the landing |
|---|---|---|
| `--page` | `#ECEEF2` | Page ground behind the slabs (cool light grey) |
| `--canvas` | `#F6F7FA` | The dotted-canvas ground (story section, roadmap board) |
| `--white` | `#FFFFFF` | Cards, fields, light slabs |
| `--cobalt` | `#2340E6` | Brand. Hero slab, links, "alternative" marks, `.cob` heading words |
| `--cobalt-2` | `#1B33CF` | Darker cobalt; gradient start, pressed state |
| `--cobalt-3` | `#3253F4` | Lighter cobalt; hover on cobalt surfaces |
| `--navy` | `#0D1660` | Deepest blue; used in shadows (`rgb(5 10 60 / x)`) and the gradient shade |
| `--cobalt-soft` | `#EEF1FE` | Tinted fill: file chips, "further" chips, avatar, block-kind icon tile |
| `--lime` | `#C6F24E` | The one "go" accent. Always carries ink text |
| `--lime-2` | `#B4E03A` | Lime as a line/dot: "written" dots, tab underline, spine run, quiz-correct ring |
| `--lime-soft` | `#EEF9CF` | Tinted fill: active rail item, current sidebar row, "learning" milestone, correct answer |
| `--lime-ink` | `#4E6A08` | The only lime legible as text (on white and on `--lime-soft`) |
| `--ink` | `#0B0D10` | Text, dark slabs, primary buttons, milestone cards, code stage |
| `--ink-2` | `#1A1D23` | Raised ink surface |
| `--ink-3` | `#2A2E37` | Body text inside the app (prose, rows, options) |
| `--text-2` | `#565B68` | Secondary text |
| `--text-3` | `#8B909C` | Tertiary text, captions, counters, placeholders on chips |
| `--line` | `rgb(11 13 16 / 0.08)` | Hairlines and card insets |
| `--green` | `#12A150` | Success (sparingly; lime does most "done" work) |
| `--coral` | `#FF5A3C` | Error, recording dot, wavy misspelling underline |

Literal colours that recur in the source and deserve names in the app:

| Literal | Where | Proposed app token |
|---|---|---|
| `#F4F5F9` | app rail bg, neutral pill bg (`story.css:33,55`) | `--chrome` |
| `#FAFAFC` | sidebar + tab strip bg (`story.css:67,101`) | `--chrome-2` |
| `#F7F8FB` | quiet inset rows (`.cr-row`, `.ph`) | `--sunken` |
| `#F3F4F7` / `#F1F2F6` | neutral chip fill, "them" chat bubble, attach button (`story.css:161,281`, `page.css:136`) | `--fill` |
| `#EEF0F4` | segmented control track, progress track, group panel (`story.css:75,149,214`) | `--fill-2` |
| `#E5E7EE` | attach button hover | `--fill-hover` |
| `#D9DCE4` | spine stroke, finish pill ring | `--rule-strong` |
| `#CDD0D8` | idle status dot | `--dot-idle` |
| `#C3C6CF` | breadcrumb slash, sub-row bullet | `--text-4` |
| `#B9BDC8` / `#B4B8C2` | idle pill dot, tab close glyph | `--text-4` |
| `#A9ADB8` / `#9DA2AE` | "anytime" mark, connector ties, disabled submit | `--mute` |
| `#8E93A0` | textarea placeholder | `--placeholder` |
| `#6B7080` | rail + top-bar icon colour | `--icon` |
| `#22262E` / `#20242C` | ink hover | `--ink-hover` |
| `#D2F86A` | lime hover | `--lime-hover` |
| `#FFF6DA` / `#6E5410` / `#D9A21B` / `rgb(214 168 40 / .35)` | mentor-note fill / text / icon / ring (`story.css:212`) | `--note-bg`, `--note-ink`, `--note-icon`, `--note-line` |
| `#FFE8DF` / `#B33A16` | low-score pill bg / text (`story.css:303`) | `--coral-soft`, `--coral-ink` |
| `#FCFEF6` | answered question card bg | `--lime-wash` |
| `#3F7D0C` | correct word in speaking drill | `--green-ink` |
| `rgb(141 181 30 / 0.4-0.6)` | lime-tinted 1-1.5px rings | `--lime-line` |

### 1.2 Gradients and textures

```css
/* the hero/primary slab (base.css:37-40) */
--cobalt-grad:
  radial-gradient(70% 90% at 82% 18%, rgb(120 150 255 / 0.40), transparent 60%),
  radial-gradient(60% 70% at 10% 110%, rgb(10 20 120 / 0.55), transparent 70%),
  linear-gradient(118deg, #1B33CF 0%, #2442EA 38%, #2D4CF2 56%, #2340E6 72%, #1A2FC4 100%);
```

- **Light beams** on the hero (`page.css:38-50`): two blurred 28deg-rotated stripes,
  `linear-gradient(90deg, transparent, rgb(255 255 255/.10) 45%, rgb(255 255 255/.16) 50%, rgb(255 255 255/.10) 55%, transparent)`,
  `filter: blur(18px)`, widths 22% and 10%, at left 42% and 64%. A third `.sweep` stripe (blur 10px,
  peak alpha .22) animates across once.
- **Grain** (`page.css:51-54`): an SVG `feTurbulence` (baseFrequency .9, 2 octaves) tile 160x160,
  `opacity: .16; mix-blend-mode: overlay`. Only on cobalt slabs.
- **Dot grid** (`story.css:9-12`, `183-184`): `radial-gradient(rgb(11 13 16 / 0.13) 1px, transparent 1.4px)`
  at `24px 24px` (section ground) and `rgb(11 13 16 / 0.12) 1px, transparent 1.3px` at `20px 20px`
  (roadmap board). The section variant fades top and bottom with a mask (220px in, 200px out).
- **Shimmer** for text still being written (`page.css:287-289`):
  `linear-gradient(90deg, grey/.25 0 40%, grey/.45 50%, grey/.25 60% 100%) 0 0 / 300% 100%`,
  clipped to text, `animation: shimmer 1.4s linear infinite` to `background-position: -150% 0`.
- **Lime glow** behind a lime heading line: `radial-gradient(60% 70% at 50% 55%, rgb(198 242 78 / .55), transparent 70%)`, blur 14px.

### 1.3 Radii

| Token | Landing value | Under 900px | Use |
|---|---|---|---|
| `--r-card` | 36px | 28px | Slabs, plan cards |
| `--r-md` | 28px | 22px | Bento cards |
| `--r-sm` | 18px | 16px | Small cards |
| field | 32px (26px multi-line / phone) | 26px | The prompt field |
| app window | 26px (30px phone) | | `#story .app` |
| block card | 18px | | `.lc` lesson blocks, question cards `.a-q` |
| inset row | 16px / 14px / 12px | | `.cr-row` 16, `.ph` 14, `.op` 12, milestone `.bd-m` 12 |
| small square | 10-12px | | `.ri` 12, `.a-sq` 10, `.sd-row` 10, `.a-tab` 10 10 0 0 |
| subtopic badge | 9px | | `.bd-s` |
| pill | 99px | | Everything round-ended |

### 1.4 Shadows and rings

| Name | Value | Where |
|---|---|---|
| hairline inset | `inset 0 0 0 1px var(--line)` | Every white card on a light ground |
| outline inset | `inset 0 0 0 1px rgb(11 13 16 / 0.10-0.14)` | Outline buttons, chips, options |
| eyebrow | `inset 0 0 0 1px var(--line), 0 1px 2px rgb(11 13 16 / .04)` | `.eb` |
| hero slab | `0 34px 70px -34px rgb(20 40 200 / .5)` | Cobalt slab lift |
| pro card | `0 40px 80px -40px rgb(20 40 200 / .6)` | Cobalt card on light page |
| field | `0 14px 34px -10px rgb(5 10 60 / .42), inset 0 0 0 1px rgb(11 13 16 / .05)` | Prompt field on cobalt |
| field focus | add `0 0 0 4px rgb(198 242 78 / .6)` | Lime focus halo |
| dock field | `0 24px 50px -16px rgb(11 13 16 / .45), 0 0 0 1px rgb(11 13 16 / .06)` | Floating field on light |
| app window | `0 0 0 1px var(--line), 0 40px 90px -40px rgb(11 13 16 / .42)` | `#story .app` |
| milestone | `0 10px 20px -12px rgb(11 13 16 / .6)` | Ink node card |
| hot ring | `0 0 0 4px rgb(198 242 78 / .7)` | Node being pointed at |
| lime halo | `0 0 0 6px rgb(198 242 78 / .35)` | "Finished" pill lit |
| token | `0 14px 28px -10px rgb(100 140 10 / .55-.7)` | Lime token in flight |
| popover | `0 20px 40px -12px rgb(11 13 16 / .25)` | Mobile menu |
| dialog | `0 40px 80px -20px rgb(0 0 0 / .6)` + backdrop `rgb(6 9 30 / .72)` blur 10px | Film dialog |
| tag on cobalt | `0 12px 26px -8px rgb(5 10 60 / .45)` | Floating labels |
| play | `0 10px 30px -8px rgb(5 10 60 / .5)` | Round ink play button |
| object drop | `drop-shadow(0 30px 40px rgb(5 10 60 / .35))` / `(0 24px 30px rgb(11 13 16 / .18))` | 3D objects |

### 1.5 Spacing and layout constants

| Token | Value | Notes |
|---|---|---|
| `--gut` | 20px (10px under 900px) | Slab inset from the viewport edge |
| `--pad-x` | `clamp(20px, 4.2vw, 76px)` | Content inset in a section |
| `--sec-y` | `clamp(88px, 10.5vw, 168px)` | Vertical rhythm between landing sections |
| `--nav-h` | 80px (66px phone) | Landing nav |
| `--field-min` | 64px | Prompt field min height |
| bento gap | 16px (10px phone) | |
| app rail | 60px wide (story) / 62px (SaaS v2) | |
| app top bar | 56px (52px phone) | |
| tab strip | 42px, tabs 36px | |
| sidebar | `clamp(220px, 17vw, 262px)`, padding 16px 14px, gap 12px | |
| assistant | `clamp(240px, 19vw, 300px)`, padding 14px | |
| lesson column | `max-width: 760px`, padding 18px 32px 40px, block gap 16px | |

Spacing values that actually occur in the app redraw: 2, 4, 6, 7, 8, 10, 12, 14, 16, 18, 20, 22,
24, 28, 32px. The app scale in §8.1 normalises these to a 4px grid with 2/6/10/14 half-steps kept.

### 1.6 Motion tokens

| Token | Value | Source |
|---|---|---|
| `--ease-out` | `cubic-bezier(.2, .8, .2, 1)` | Nav hide, collapsible rows, FAQ, caption, dock |
| `--ease-pop` | `cubic-bezier(.2, .9, .3, 1.2)` | Dock play button arriving (slight overshoot) |
| `--ease-pop-2` | `cubic-bezier(.2, .9, .25, 1.1)` | Dialog `pop` keyframe |
| press | `transform .15s` → `scale(.97)` pills, `.95` build button, `.94` story press | |
| colour | `background .2s`, `box-shadow .2s-.3s`, `color .25s` | |
| layout | `.45s-.5s` with `--ease-out` | grid-rows collapse, font-size shrink |
| textarea grow | `height .22s cubic-bezier(.2,.8,.2,1)` | |
| pulse | `1s` opacity .35↔1 | "writing" dots |
| spin | `.8s linear` | Busy spinner |
| blink | `1s steps(1)` | Caret |
| ring | `2.6s ease-out infinite`, scale .92→1.22, fade | Play button halo |
| shimmer | `1.4s linear infinite` | Writing title |

## 2. Typography
_pending_

## 3. Global patterns
_pending_

## 4. Components (landing)
_pending_

## 5. Motion language
_pending_

## 6. Iconography (sprite)
_pending_

## 7. Imagery
_pending_

## 8. Desktop app surfaces
_pending_

## 9. Dark variant
_pending_

## 10. Porting notes
_pending_
