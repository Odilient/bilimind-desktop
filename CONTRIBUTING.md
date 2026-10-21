# Contributing to BiliMind Desktop

Thank you for helping. Bug reports, tests on your system, docs fixes and code are all welcome, and small pull
requests are the easiest to review.

- **Questions and ideas:** [Discussions](https://github.com/Odilient/bilimind-desktop/discussions).
- **Bugs and concrete feature requests:** [issues](https://github.com/Odilient/bilimind-desktop/issues/new/choose).
- **Security problems:** not in public; see [SECURITY.md](SECURITY.md).
- **A first task:** issues labelled [good first issue](https://github.com/Odilient/bilimind-desktop/labels/good%20first%20issue)
  are small and self-contained; [help wanted](https://github.com/Odilient/bilimind-desktop/labels/help%20wanted) ones are bigger.
  Comment on an issue before you start, so two people don't build the same thing.

Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## Set up

You need Node.js 22 or newer (CI uses 24), Git and pnpm 10.

```bash
git clone https://github.com/<you>/bilimind-desktop.git
cd bilimind-desktop
corepack enable
pnpm install
pnpm start          # build everything and open the app
pnpm dev            # the app with the renderer on Vite (hot reload) and the showcase courses in the library
```

On Ubuntu 24.04 and later, run the development app with `ELECTRON_DISABLE_SANDBOX=1` (the OS blocks the user
namespaces Chromium's sandbox needs; the packaged app handles this itself).

You do not need an AI key to work on most of the code. The tests never call a provider, and the renderer runs in
a browser with a mock that replays a recorded run: run `pnpm dev` and open the `renderer:` URL it prints.

## Where things are

| Path | What |
|---|---|
| `packages/core` | Shared types, the course schema (`bilimind.course/1`), lesson archetypes and formats, graders, FSRS |
| `packages/engine` | Ingest, outline, exam map, planner, drafts, checks, code tests, verdicts, narration, exports, build |
| `packages/player` | The offline course page (Vue + Vite, built into one HTML file) |
| `apps/desktop` | The Electron app: main process, preload, the worker that runs the engine, the Vue renderer. [CONTRACT.md](apps/desktop/CONTRACT.md) is the main-to-window API |
| `apps/cli` | The `bilimind` command line; bundled into `skills/bilimind/scripts/bilimind.mjs` |
| `skills/bilimind`, `workbuddy/` | The WorkBuddy skill and Expert Team |
| `server/free-proxy` | BiliMind free, the Cloudflare Worker behind `desktop-api.bilimind.com` |
| `showcase/` | Sample source folders (with their licences) and the courses built from them |
| `site/` | The website on GitHub Pages |
| `hackathon/`, `pitch/`, `plan/` | History: the Dormathon entry, the pitch deck and the original plans |

More: [docs/DEVELOPERS.md](docs/DEVELOPERS.md), [docs/how-it-works.md](docs/how-it-works.md),
[docs/course-format.md](docs/course-format.md).

## Before you open a pull request

```bash
pnpm typecheck
pnpm test
pnpm build
node --test "skills/bilimind/test/*.test.mjs"
```

CI runs the same on Linux, Windows and macOS, plus a hidden-window smoke test of the desktop app
(`apps/desktop/scripts/e2e-main.mjs`; it needs a display, so on a Linux server use `xvfb-run -a`).

If you change the engine or the CLI, rebuild the bundled CLI and the Expert Team copy, and commit them with your
change (the skill tests fail otherwise):

```bash
cd apps/cli && node scripts/bundle.mjs && cd ../..
node skills/bilimind/scripts/zip-skill.mjs --team
```

## How we write code here

- TypeScript and ES modules, on Node. Match the file you are in: its naming, its comment density, its idioms.
- Comments say why, not what. A trap you hit is worth a comment; a restatement of the code is not.
- Add or update a test with every behaviour change (Vitest, next to the package's other tests).
- Text a learner reads is plain English with no jargon: "Your OpenRouter key was rejected" rather than "401".
- **Never commit a key.** `.env`, `.env.*` and `.env.local` are git-ignored. Code must never log, print or return
  a key; error messages go through `redact()` in the engine.
- Keep the course a folder of plain files that opens offline. New outputs go into the course folder, documented in
  [docs/course-format.md](docs/course-format.md).

Commit messages: one plain sentence saying what changed, then a short body with why when it isn't obvious. Look at
`git log` for the style.

## Pull requests

- One change per pull request, with a description of what and why, and how you tested it.
- Screenshots or a short clip for anything visible.
- Link the issue it closes (`Closes #12`).
- Update [CHANGELOG.md](CHANGELOG.md) under "Unreleased" for anything a user would notice.

A maintainer reviews every pull request. We may ask for changes; that is normal and not a judgement of you.

## Releases

Maintainers bump the versions, update [CHANGELOG.md](CHANGELOG.md) and
[.github/release-notes.md](.github/release-notes.md), and push a tag like `v0.3.0`. The release workflow builds
the installers for Windows, macOS and Linux and publishes them. A tag with a suffix (`v0.3.0-rc.1`) makes a
pre-release.

## Licence

BiliMind Desktop is licensed under the [GNU Affero General Public License v3.0 only](LICENSE). By contributing,
you agree that your contribution is licensed under the same licence.
