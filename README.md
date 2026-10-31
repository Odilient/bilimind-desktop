<p align="center">
  <img src="apps/companion/resources/icon.png" width="88" height="88" alt="BiliMind">
</p>

<h1 align="center">BiliMind Desktop</h1>

<p align="center">
  A study app on your own computer: courses, written lessons, checks of what stuck, notes, whiteboards and a daily plan.<br>
  No account. It uses your own DeepSeek or OpenRouter key.
</p>

<p align="center">
  <a href="https://github.com/bilimind/desktop/actions/workflows/ci.yml"><img src="https://github.com/bilimind/desktop/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-2340E6" alt="AGPL-3.0"></a>
</p>

## What works

- **Chat.** Ask about your notes and files, with citations. It can make notes, cards and drawings, and it asks you to try graded work first.
- **Courses from a chat.** Say what you want to learn. You review a draft path, then create it.
- **Lessons.** The model says what kind of knowledge a topic is, and the code picks the formats it must be taught in (22 block types). You can edit, rewrite a part, regenerate and restore history.
- **Build from a folder.** Point it at your slides and past papers. The Checker re-solves every auto-marked answer against your files, throws out what they contradict, and leaves its report in the course. One measured run: a 16-slide PDF, 5 lessons, 165 seconds, $0.04 on DeepSeek.
- **Marking.** Exact answers are marked by code. Written answers are marked by your model against a rubric. If it can't be marked, it says so and scores nothing.
- **Checks.** Questions from memory, days after you studied. Only those count toward readiness, and readiness is compared with your real grade.
- **Today, a planner, notes, whiteboards, flashcards.** These work offline.
- **Also:** calendar links, exam timetable PDFs, pasted announcements, search, narration, a course saved as an offline page, backup and restore.
- **Spending limits:** $1 a course and $2 a day by default. You can change them in Settings, which also shows what each thing cost.

## Not here

These are on [bilimind.com](https://bilimind.com), the hosted version: sync across devices, mobile, classes, Moodle, and AI with no setup.

Your key's text models can't do speech-to-text or read photos, so speaking drills don't hear you, and a timetable photo is refused with the reason. Type or use a PDF instead.

## Platforms

Tested on Linux, as a package, end to end. Windows and macOS builds are set up in the release workflow, but this version hasn't been run on them, and the builds aren't code-signed.

## Privacy

Your data is in a folder on your computer, and your key is sealed with the system keychain where there is one. What leaves your computer, and only when you use it:

- The text a model reads goes to your AI provider: your question and the excerpts of your files it needs.
- Narration sends the words being read to Microsoft's online voice service.
- A link or calendar you add is fetched from its site. Private and local addresses are refused.
- The code sandbox downloads its Python and SQL runtimes from cdn.jsdelivr.net the first time an exercise needs them.

There are no analytics and no account.

## Run from source

Node 22 or newer and pnpm 10.

```bash
git clone https://github.com/bilimind/desktop.git
cd desktop
corepack enable
pnpm install
pnpm start                                  # add ELECTRON_DISABLE_SANDBOX=1 on Ubuntu 24.04+
pnpm test
pnpm --filter @bilimind/companion e2e       # after spa and build; nothing shows on screen
pnpm dist                                   # installers for the OS you are on, in apps/companion/release/
```

`apps/companion` is the app, `packages/*` the engine, types and offline player, `apps/cli` the command line, and `skills/bilimind` a skill built on it. More: [docs/DEVELOPERS.md](docs/DEVELOPERS.md).

## Licence

[AGPL-3.0](LICENSE). Sample courses: [showcase/courses](showcase/courses/).
