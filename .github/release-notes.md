**BiliMind Desktop** turns your own slides, notes and past papers into a narrated course, with every answer checked against your files. Open source (AGPL-3.0), local files, your own AI key.

## What's new in 0.2.1

- **First run asks for your own key.** Before the first build, the home screen asks for a DeepSeek key (the cheapest) or an OpenRouter key, with links to where you get each one. A course costs 2 to 9 cents of your own credit in our runs.
- **BiliMind free is paused.** The key-less service no longer answers, so the app stops offering it instead of failing at the first step.
- **Time zones:** the app reads "Wednesday 9am" and writes the review calendar in your computer's time zone (since 0.2.0). The same default for the command line is in review in [#11](https://github.com/Odilient/bilimind-desktop/pull/11).

Full list: [changelog](https://github.com/Odilient/bilimind-desktop/blob/main/CHANGELOG.md).

## Download

| System | File |
|---|---|
| Windows 10 and 11 (x64) | `BiliMind-Desktop-0.2.1-x64-setup.exe`, or `…-x64-portable.exe` without installing |
| macOS, Apple silicon / Intel | `BiliMind-Desktop-0.2.1-mac-arm64.dmg` / `…-mac-x64.dmg` |
| Linux (x64) | `BiliMind-Desktop-0.2.1-linux-x86_64.AppImage` (`chmod +x`), or `…-linux-amd64.deb` |
| Command line (Node 22+) | `bilimind-cli.mjs` with `sql-wasm.wasm` next to it |

The builds are not code-signed yet. On Windows, click **More info → Run anyway**. On macOS, use **System Settings → Privacy & Security → Open Anyway**, or run `xattr -dr com.apple.quarantine "/Applications/BiliMind Desktop.app"`. Checksums are in `SHA256SUMS.txt`.
