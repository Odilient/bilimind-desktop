# TASK C: landing = exact copy of hero-v7/11-cobalt-landing.html

- [start] Source: plan/reference/design/hero-v7/11-cobalt-landing.html (432563 bytes). Assets referenced: img/09/{poster,card-poster}.jpg, img/09/object.webp, img/11/*.webp, film ../pitch/out/bilimind-pitch-v2.mp4.
- Film found at C:\oybek\projects\bilimind\design\pitch\out\bilimind-pitch-v2.mp4 (35.7 MB) -> site/vid/.
- [copy] site/index.html = byte copy of the design file, then 12 link targets swapped (9 lines; `git diff --no-index --stat` = 9+/9-). Line endings, text, classes, styles, scripts and all animation timings untouched.
- [assets] site/img/09/{poster.jpg,card-poster.jpg,object.webp} and site/img/11/*.webp copied byte for byte (same relative paths as the design). site/vid/bilimind-pitch-v2.mp4 copied (35.7 MB).
- [removed] old remade landing: site/css/, site/js/, site/STATUS.md, site/scripts/fill-numbers.mjs, site/img/*.webp (root level), old site/shots/*.png. Nothing outside them referenced these (only hackathon/scratch history and plan notes).
- [kept] site/scripts/assemble.mjs (dry run OK: 3 showcase courses + skill zip, secret scan clean), site/downloads/, site/courses/, site/.nojekyll.
- [verify] site/scripts/verify.mjs rewritten as the exactness check (old one checked the old page's sections).

## Every changed link

| line | before | after |
|---|---|---|
| 1206 | href https://bilimind.com/start (nav "Start free") | https://github.com/Odilient/bilimind-desktop/releases/latest |
| 1236 | form action https://bilimind.com/start (hero field) | https://github.com/Odilient/bilimind-desktop/releases/latest |
| 4443 | href https://bilimind.com/for-institutions | https://github.com/Odilient/bilimind-desktop |
| 4574 | href https://bilimind.com/start (pricing Free) | https://github.com/Odilient/bilimind-desktop/releases/latest |
| 4590 | href https://bilimind.com/register?plan=pro (pricing "Go Pro") | https://github.com/Odilient/bilimind-desktop/releases/latest |
| 4636 | href https://bilimind.com/start (footer) | https://github.com/Odilient/bilimind-desktop/releases/latest |
| 4636 | href https://bilimind.com/for-institutions (footer) | https://github.com/Odilient/bilimind-desktop |
| 4637 | href https://bilimind.com/terms | https://github.com/Odilient/bilimind-desktop/blob/main/LICENSE |
| 4637 | href https://bilimind.com/privacy | https://github.com/Odilient/bilimind-desktop/blob/main/LICENSE |
| 4637 | href https://bilimind.com/refunds | https://github.com/Odilient/bilimind-desktop/blob/main/LICENSE |
| 4657 | video src ../pitch/out/bilimind-pitch-v2.mp4 | vid/bilimind-pitch-v2.mp4 |
| 4675 | script `const START = 'https://bilimind.com/start'` (Build my course goes here, + `?topic=`) | https://github.com/Odilient/bilimind-desktop/releases/latest |

Not changed on purpose: line 4060 `bilimind.com/you/espresso-at-home` is visible text in a mock browser bar (not a link); `#signin` anchors (in-page); cdnjs / Google Fonts URLs (libraries, same as design).

## Diff report (node site/scripts/verify.mjs, headless Chrome 1440x900 and 390x844)

1. Text: 6014 lines in both; every differing line differs only inside href/src/action or the START constant (the 12 links above). PASS.
2. Pixels, `?still` (the page's own reduced-motion mode), full page:
   - Page height identical: 15031 px at 1440, 19600 px at 390. Zero page errors in both.
   - The original is not pixel-stable against ITSELF: the WebGL 3D object in the hero and the rolling number digits change between two loads of the same file (control run: original vs original = 1.6 M differing pixels at 1440). So the original is shot 3 times; 16x16 blocks where those disagree (dilated one block) form a noise mask.
   - Copy vs original outside the noise mask: **0 differing pixels at 1440 (mask 3.8% of the page) and 0 at 390 (mask 30.8%)**. PASS.
   - Harness note: in a fresh headless session the first load at a new viewport can lay the hero out mid-way (seen at 390 on whichever file happened to load first, original or copy alike). verify.mjs does one discarded warm-up load per file per viewport.
3. Pixels with motion (same scroll stops, same timings, seeded Math.random), viewport shots: share of differing pixels 0-16%, all at the 3D object / animated parts (hero at scrollY 0, numbers band); several stops identical. Reported, not gated: animation timing is not reproducible run to run.
- Screenshots of the copy: site/shots/{1440,390}-full-still.png and {1440,390}-motion-0..6.png.

## GitHub Pages
- .github/workflows/pages.yml: push to main + workflow_dispatch, ubuntu-latest, node 22, assemble.mjs, rsync site/ -> _site (excluding shots/, scripts/, NOTES*), upload-pages-artifact@v3, deploy-pages@v4, permissions pages: write + id-token: write.
- All asset paths in index.html are relative (img/09, img/11, vid/), so https://odilient.github.io/bilimind-desktop/ works.
- Repo setting needed once: Settings > Pages > Source = GitHub Actions.

## Owner-approved change (02:35)
The owner asked to change the browser tab title: `<title>` and the meta description (head only, not visible on the page) now name BiliMind Desktop instead of the design draft name "Landing 11 Cobalt landing". Everything else stays exact; only link targets differ.

## Owner-approved header change (03:15)
No sign-in: the "Sign in" pill, its phone menu item and the footer item became GitHub links (pill with the GitHub mark and a live star count from api.github.com). "Start free" became "Download" (header, pricing card, footer). Nothing below the header changed.

## Owner-approved link change (03:25)
"For institutions" (section pill and footer) now opens the real shop course `courses/boba-day-one/`, so visitors who will not install the exe still see real output. Link targets only.

## Owner-approved text fixes (04:50)
Owner: "Minimal text fixes: same design and layout; change only the text that's false for this app (hero label, pricing text, platform list, institutions contacts) and swap the film." Words, two link targets and the video src/poster only. No class, style, script logic, image, animation timing or element count changed. `site/scripts/verify.mjs` (text-diff part) now reports these lines as differing outside links; that is expected.

| Where | Before | After |
|---|---|---|
| Hero eyebrow | AI course generator · 27 lesson formats | Free Windows app · Open source |
| Hero sub | BiliMind is an AI course generator. Name a topic, or drop in your PDFs and slides … a plan that bends. | BiliMind is a free Windows app. Drop in your slides or SOP, type one sentence … practice checked against your files, a study plan. |
| Hero note | Free to start · no card · 20 languages | Free · no account · no key needed |
| Film labels (8 places + JS) | 1:22 / 1 minute 22 seconds | 1:12 / 1 minute 12 seconds (new film is 72 s) |
| FAQ lede | …in a minute and a half. | …in about a minute. |
| Video | src vid/bilimind-pitch-v2.mp4, poster img/09/poster.jpg | src vid/bilimind-desktop.mp4, poster vid/bilimind-desktop-poster.png (copy of docs/img/film-poster.png) |
| Bento lime card | 27 lesson formats. 20 languages. | 27 lesson formats. Your own files. |
| How lede | this is the app itself … three questions get answered | this is how a course is made … level, aim and time get read |
| How mock | A few questions before we draw the map / Planning is free — you pick which lessons get written. | What your sentence says, before the map / All free — the Lead picks which lessons get written. |
| How captions | Three questions — the ones a tutor asks… / Then it keeps you going, week by week, all the way to Finished. / rail "Questions" | No questions — level, aim and time, read from your one sentence. / Then it keeps you going: a study plan, an Anki deck, a calendar. / rail "Your goal" |
| Formats (audio pill bubble, JS) | in 29 voices / 29 voices, 20 languages | sentence by sentence / the sentence lit as it's read |
| Materials | company handbook, lecture subtitles, a stack of links / Sources are verified… Dead links don't ship. / PDF, Word, PowerPoint, EPUB, subtitles, text, Markdown, CSV, JSON and HTML. | last year's paper, the shop's SOP, a folder of notes / Every answer is checked against your files, word for word. / PDF, Word (.docx), PowerPoint (.pptx), text, Markdown and HTML web pages. |
| Numbers | lede "voice and language … lesson renderer"; 29 narration voices; 20 languages | "voice and cost cap … engine code"; 3 narration voices (English, Malay, Burmese: engine/tts-edge.ts); 25 cents a course (default cap; real runs 2 to 9). 27 formats / 11 kinds / 9 question types / 4 runtimes kept: they match packages/core/src/types.ts and engine/codework.ts |
| Everywhere | Web · iOS · Android · Telegram; lede about iOS/Android apps and Telegram sign-in; doors The web / iOS & Android / Inside Telegram; tags; "Signed in through Telegram — no form"; "Narrated · 29 voices"; "20 languages, 29 narration voices" | Windows · WorkBuddy · CLI · Browser; Windows app, WorkBuddy skill + Expert Team, command line, course = one HTML file in any browser, no account; Any browser / On your phone / Inside WorkBuddy; Your course, in any browser / Opens on your phone, too / In WorkBuddy, from one chat; "No sign-in — the course is one file"; "Narrated · Edge voices"; "Narrated by Microsoft Edge voices" |
| Institutions | For schools, bootcamps & teams; One teacher tries it… center follows; accounts/seats lede; Roles & seats / Progress you can prove | For students, shops & tutors; One owner builds it… crew follows; no accounts, one HTML file, one link; One HTML file / Checks you can prove (a report per course) |
| Institutions mock | Nodira Rashidova, Jamshid Aliev, Malika Yusupova, Dilnoza Tursunova, sardor@ at lingua.uz, "Lingua Centre", Owner/Admin/Member, Invite, Profile/Plan & billing/API keys/Your team, toasts | A student (no account needed) / Data Structures final, A boba shop / Day one for new crew, An exchange student / Survival Malay, A tutor's class, "new crew, Monday" (Shared); Builds/Learns; Share the course; Folder / Spending limits / Your own key / Who it's for; no e-mail addresses left |
| Pricing | lede "four months is the product"; Monthly / Yearly; Free: 12 lessons/month etc.; Pro $15/month, $149/year, 150 lessons, illustrations, 2 GB; "Go Pro"; footnote about plans/VAT | costs cents, BiliMind free pays; Per course / Per day; Free: no account/key/card, BiliMind free pays for the AI, narration/code/quizzes, Open source AGPL-3.0; "Own key" 2–9¢ / course (real runs $0.016–$0.094), capped at $0.25, $2 / day default cap, DeepSeek or OpenRouter, text goes straight to them, key on your PC; "Your key" -> README #free-and-private; footnote: rate limit, USD, AI only, real runs |
| FAQ (JS) | schedules/grades/brings back; Can I change what it generates?; free plan 12 lessons; links verified; Web/iOS/Android/Telegram, 20 languages, 29 voices | checks answers against your files and runs code; Do I need an account or a key?; Does BiliMind free actually stay free? (free, AGPL, rate limit); your files are the sources; Windows app, WorkBuddy skill + Expert Team, command line, one HTML file |
| Closing | Free to start · no card / 27 lesson formats · 20 languages · web, iOS, Android and Telegram | Free · no account · no key / 27 lesson formats · Windows, WorkBuddy, command line, any browser |

Not changed on purpose: header/footer (already approved), mock lesson content (Italian, espresso, Spanish), the plan/checks sections, the ticker, `bilimind.com/you/…` in the mock URL bar, the Telegram-styled phone graphic, bento card-poster image (images stay), site/vid/bilimind-pitch-v2.mp4 (now unreferenced, left on disk).

Layout check (headless Chrome, `?still`, warm-up load, 1440x900 and 390x844): every `section` box and 27 groups of text elements (eyebrows, ledes, h2s, plan cards and items, FAQ items, institution rows, tags, captions…) have the same top and height as before the change, to the pixel; page height 15031 / 19600 before and after; no horizontal overflow at 390; no page errors. Three wordings were adjusted to get there (hero eyebrow shortened, institutions h2 "One owner builds it", numbers cell 6 label shortened).
