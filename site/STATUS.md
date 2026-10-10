# WP12 Site: status

Owner lane: `site/`. The public landing page for "BiliMind for WorkBuddy", which is the submission's
deployed application link. It is ported from `plan/reference/design/hero-v7/11-cobalt-landing.html`
(the Cobalt landing) and rewritten for this product. It is plain HTML, CSS and JS with no build step,
and it works from `file://` and from any static host.

## Works

- **`index.html`** has these sections, in order:
  1. Hero: "One sentence in. A course out. Checked against your slides."
  2. Bento flip cards
  3. Ticker
  4. The problem: 84% of students reread; about 80% vs about 33% recall, with sources
  5. The crew story
  6. The crew roster: Lead, Writers, Coder, Checker, each with "decides" and "code enforces"
  7. Formats: 11 archetype chips, a physics pit of the 22 enabled formats, and the mandatory formats from `core/archetypes.ts`
  8. Outputs: the course, plan.md, reviews.ics, deck.csv, lessons/*.md, REPORT.md
  9. Small business: the cafe SOP, the Malay/Burmese narration chips, and the turnover stat
  10. Three showcase course cards
  11. Install the skill (4 steps, with copy buttons)
  12. Honest numbers
  13. "What we built at Dormathon"
  14. FAQ (the §1.6 answers)
  15. Team: four Odilovs
  16. Closing card
  17. Footer
- **Kept from the reference:** the layout and motion the owner likes.
  - GSAP 3.15 and ScrollTrigger from cdnjs (no Flip plugin), matter.js 0.20 for the formats pit, and three.js 0.186.1 for the 3D path.
  - The 3D path is the reference `obj.js`, inlined because module scripts cannot load from `file://`. If three.js cannot load, it falls back to `img/object.webp`.
  - The one field lives in three homes: hero → dock → closing card. It is parked from the problem section to the closing card.
  - The field grows with the text and folds the hero copy aside.
  - Flip cards, the ticker, the odometer numbers, the sweeping light, and drifting 3D objects.
- **Hero field = the WorkBuddy prompt.**
  - It cycles through three sentences: DS final, boba shop and Malay. The chips swap, the 3D path builds, and the bento cards flip to each course's lessons. A cut lesson is shown struck through.
  - "Copy for WorkBuddy" copies the sentence. It has a fallback for `file://`, shows a toast, then jumps to #install.
  - The round play button opens `courses/ds-final/index.html`.
- **Crew story (`js/crew.js`, `css/crew.css`).** It is pinned and scrubbed, and it plays in reverse when you scroll back up. The stage is a WorkBuddy-style window: workspace files, a 9-task checklist, the transcript and the composer. The five steps are:
  1. The sentence is typed and sent.
  2. The Lead's assumptions appear, then the past-paper weights grow as bars, then AVL is cut.
  3. Four Writers run in parallel.
  4. The Coder fails a test, fixes it and passes; at the same time the Checker rejects Q7 with a slide quote and rewrites it.
  5. The Preview panel opens on the course, with "Due today" and the receipts.

  The data comes from the sample DS folder (WP8 notes): the heap insert result and the L02 slide 12 probe formula. A caption under the stage says it is an illustration. `?crew=0..1` jumps the story to a point.
- **`?still` and reduced motion** show the resolved frames with no pinning. If the GSAP CDN cannot be reached, the page falls back to the same still mode.
- **`scripts/verify.mjs`** (puppeteer-core, borrowed from `packages/player`, with the installed Edge) checks:
  - zero console errors, page errors and failed requests;
  - no horizontal overflow at 1440 or at 390;
  - every section is present;
  - the crew story pins;
  - the copy button toasts and lands on #install;
  - a `{{...}}` link does not navigate;
  - a formats tab switches and a FAQ row opens;
  - every course link has a file.

  It writes screenshots to `shots/`: `1440-*.png` and `390-*.png` (the hero, five crew frames, and every section). **Last run: ok, 0 errors, 0 px overflow at both widths. `?still` also ok.**
- **`scripts/assemble.mjs`**
  - Copies the built courses from `showcase/courses/<slug>/` into `courses/<slug>/`, skipping `crew/cache/`.
  - Copies `skills/dist/bilimind-skill.zip` to `downloads/` (already done: 1.8 MB).
  - Scans the whole site for key shapes and key variable names. The last scan was clean.
- **`scripts/fill-numbers.mjs <numbers.json>`** fills the `{{PLACEHOLDERS}}` in place. `--check` lists what is left. Until a number is filled, it shows as "—" with a dashed "to do" chip, and placeholder links show a toast instead of navigating.
- `courses/{ds-final,boba-day-one,bm-survival}/index.html` are placeholder pages, so the links never 404.

## Stubbed (waiting on other lanes)

- **Showcase courses:** placeholders until `showcase/courses/<slug>/index.html` exist (G4). Then run `node site/scripts/assemble.mjs`.
- **Placeholders still in the page:**
  - GITHUB_URL
  - NUMBERS_NOTE
  - COST_CENTS, CREDITS, WALL_MIN
  - ITEMS_CHECKED, ITEMS_REJECTED, ITEMS_LABELLED
  - TESTS_RUN, CODE_FIXED
  - PLANTED_CAUGHT, FALSE_ALARMS
  - TEAM_MEMBER_4, TEAM_ROLE_4

  Fill them from `hackathon/runs/` with `node site/scripts/fill-numbers.mjs numbers.json`. Whole numbers of up to 4 digits roll as odometers; anything else is printed as is.
- **Claims to check against what ships** (edit the copy if one did not ship):
  - Malay and Burmese narration chips on the cafe course (PLAN lists this as P2).
  - "22 lesson formats": this is ENABLED_TYPES, and the player has all 22 components.
  - The crew story's example numbers (7 blocks, 6 of 6 tests, Q7): these are illustrative, and labelled as such.

## Next

1. Deploy. Pick one:
   - WorkBuddy's own `workbuddy_sites_deploy`. This needs the owner's "publish" wording, and it counts as using WorkBuddy.
   - GitHub Pages through an Actions workflow that uploads `site/` (Pages cannot serve `/site` from a branch directly). `.nojekyll` is already here.
   - Netlify, Vercel or Cloudflare Pages with the publish directory set to `site`.
2. After G4: run `assemble.mjs`, then `fill-numbers.mjs`, then `verify.mjs`. Repeat `verify.mjs --url https://<deployed>/` against the live URL, and open it on a phone.
3. Deploy size: `shots/` (screenshots, about 11 MB) and `scripts/` are dev-only. Exclude them from the upload if the host has a size limit; the page never links to them.
4. Optional: an OG image and a favicon PNG for link previews. The film dialog from the reference was dropped because there is no video yet.
