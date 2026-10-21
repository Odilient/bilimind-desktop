# Changelog

All notable changes to BiliMind Desktop. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project uses [semantic versioning](https://semver.org/).

## [Unreleased]

## [0.2.0] - 2026-10-21

The first release for macOS and Linux, and the first one built for contributors.

### Added

- **macOS and Linux builds** next to Windows: a `.dmg` and `.zip` for Apple silicon and Intel (ad-hoc signed,
  not notarized), and an AppImage and a `.deb` for x64 Linux.
- macOS: the window buttons sit in the title bar, and the app has the App, Edit and Window menus (Cmd+Q, Cmd+C,
  Cmd+V, Cmd+W).
- Linux: the AppImage starts on Ubuntu 24.04 and later (its launcher adds `--no-sandbox` only where the OS blocks
  Chromium's sandbox), and the `.deb` installs an AppArmor profile so the installed app keeps the sandbox.
- A release workflow that builds the installers on Windows, macOS and Linux, plus the one-file CLI
  (`bilimind-cli.mjs` and `sql-wasm.wasm`), and publishes them with `SHA256SUMS.txt`.
- CI on every push and pull request, on Linux, Windows and macOS: install, typecheck, 338 tests, the build, the
  skill playbook tests, and a hidden-window smoke test of the desktop app on Linux.
- Contributor docs: [CONTRIBUTING.md](CONTRIBUTING.md), a [Code of Conduct](CODE_OF_CONDUCT.md),
  [SECURITY.md](SECURITY.md), issue forms and a pull request template.
- A mirror of the repository on GitLab ([avinmaster/bilimind-workbuddy](https://gitlab.com/avinmaster/bilimind-workbuddy)).

### Changed

- Dates in your sentence ("Wednesday 9am") and the review calendar now use your computer's time zone in the
  desktop app. They were Malaysian time (`Asia/Kuala_Lumpur`) for everyone. The CLI keeps that default for now.
- No balance reserve by default. The Dormathon build kept $3 (DeepSeek) and $4 (OpenRouter) back for its demo and
  refused calls below that; set `reserve_usd` in the config file to keep a floor.
- Messages name the config file as it is on your system: `~/.bilimind/config.json` on macOS and Linux,
  `%USERPROFILE%\.bilimind\config.json` on Windows.
- Installs from source use the public npm registry and Electron's GitHub downloads again (the Dormathon build
  pointed at a mirror because of the venue's firewall).
- The README is rewritten for users and contributors; the Dormathon entry moved to [hackathon/README.md](hackathon/README.md).
- Settings: the About text names the BiliMind team.

### Known issues

- **BiliMind free, the key-less provider, is paused.** Add a DeepSeek or OpenRouter key in Settings; the app says
  so at the first AI step if you have none.
- The builds are not code-signed. Windows SmartScreen and macOS Gatekeeper warn on first launch (see the README).
- The macOS build is new and has only been built and tested in CI, not on many Macs yet.

## [0.1.0] - 2026-10-10

The Dormathon 2026 build, for Windows (a portable `.exe` and an installer).

- One sentence and a folder of files in, a narrated course out: a Lead that plans to your exam date and weighs the
  past paper, Writers in parallel, a Coder that runs every exercise, a Checker that re-solves every auto-marked
  answer against your files with word-for-word quotes.
- The course workspace with an assistant that answers from your files and cites the file, page and quote.
- Exports: `index.html` (offline), `plan.md`, `REPORT.md`, `deck.csv` (Anki), `reviews.ics`, Markdown notes.
- BiliMind free (no key needed), DeepSeek and OpenRouter.
- The `bilimind` CLI and the WorkBuddy skill and Expert Team.

[Unreleased]: https://github.com/Odilient/bilimind-desktop/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/Odilient/bilimind-desktop/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Odilient/bilimind-desktop/releases/tag/v0.1.0
