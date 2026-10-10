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
