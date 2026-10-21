**BiliMind Desktop** turns your own slides, notes and past papers into a narrated course, with every answer checked against your files. It is open source (AGPL-3.0), keeps everything on your computer and runs on your own AI key.

**New in 0.2.0: macOS and Linux**, next to Windows, plus CI on all three systems and a repository set up for contributors. The full list is in the [changelog](https://github.com/Odilient/bilimind-desktop/blob/main/CHANGELOG.md).

## Which file to download

| System | File |
|---|---|
| Windows 10 and 11 (x64) | `BiliMind-Desktop-0.2.0-x64-setup.exe` installs the app; `BiliMind-Desktop-0.2.0-x64-portable.exe` runs without installing |
| macOS, Apple silicon (M1 and later) | `BiliMind-Desktop-0.2.0-mac-arm64.dmg` (or the `.zip`) |
| macOS, Intel | `BiliMind-Desktop-0.2.0-mac-x64.dmg` (or the `.zip`) |
| Linux (x64) | `BiliMind-Desktop-0.2.0-linux-x86_64.AppImage`: `chmod +x` it and run it |
| Debian and Ubuntu (x64) | `BiliMind-Desktop-0.2.0-linux-amd64.deb`: `sudo apt install ./BiliMind-Desktop-0.2.0-linux-amd64.deb` |
| Command line (Node 22+) | `bilimind-cli.mjs` with `sql-wasm.wasm` next to it: `node bilimind-cli.mjs --help` |

`SHA256SUMS.txt` lists the checksums: `sha256sum -c SHA256SUMS.txt --ignore-missing`.

## The builds are not code-signed yet

- **Windows:** SmartScreen may say "Windows protected your PC". Click **More info**, then **Run anyway**.
- **macOS:** the app has an ad-hoc signature and is not notarized. If macOS says it cannot be opened, open **System Settings → Privacy & Security** and click **Open Anyway**, or run `xattr -dr com.apple.quarantine "/Applications/BiliMind Desktop.app"`.

Every file here was built from this tag by the [release workflow](https://github.com/Odilient/bilimind-desktop/blob/main/.github/workflows/release.yml).

## First run

1. Open **Settings**, choose **DeepSeek** or **OpenRouter** and paste your API key. The key stays in `~/.bilimind/config.json` on your computer (`%USERPROFILE%\.bilimind\config.json` on Windows).
2. Drop your files or a folder: lecture slides, a past paper, notes or an SOP (PDF, Word, PowerPoint, Markdown, text, HTML).
3. Type one sentence, for example "My Data Structures final is Wednesday 9am. I have 45 minutes a day. Get me ready.", and click **Build my course**. In our runs it took 3 to 5 minutes and $0.02 to $0.09 of AI.

The course lands in `Documents/BiliMind/<course>/`, and its `index.html` works offline in any browser.

## Known issues

- **BiliMind free, the key-less provider, is paused.** Use your own key for now; the app tells you at the first AI step if none is set.
- The macOS build is new and has been built and tested in CI only. If anything is off on your Mac, please [open an issue](https://github.com/Odilient/bilimind-desktop/issues/new/choose).

Try a finished course in your browser first: [Data Structures final](https://odilient.github.io/bilimind-desktop/courses/ds-final/) · [Boba shop day one](https://odilient.github.io/bilimind-desktop/courses/boba-day-one/) · [Survival Malay](https://odilient.github.io/bilimind-desktop/courses/bm-survival/)
