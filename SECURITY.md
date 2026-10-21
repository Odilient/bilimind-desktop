# Security policy

## Reporting a vulnerability

Please do not open a public issue for a security problem. Report it privately, in either of these ways:

- **GitHub:** [report a vulnerability](https://github.com/Odilient/bilimind-desktop/security/advisories/new)
  (Security tab → "Report a vulnerability").
- **Email:** [oybek@bilimind.com](mailto:oybek@bilimind.com), with "security" in the subject.

Tell us what you found, how to reproduce it, which version and OS, and what an attacker could do with it. If you
have a fix in mind, include it. Please never send a real API key, yours or anyone's.

We aim to acknowledge a report within 3 working days, to keep you posted while we work on it, and to credit you
in the release notes unless you would rather not be named. Please give us a reasonable time to ship a fix before
you publish details.

## Supported versions

Security fixes go into the latest release. Please check that the problem is still there in the
[latest version](https://github.com/Odilient/bilimind-desktop/releases/latest) before you report it.

## In scope

- The desktop app (`apps/desktop`): the boundary between the window and the main process (`window.bilimind`,
  see [CONTRACT.md](apps/desktop/CONTRACT.md)), opening links and files, reading and writing outside the course
  and source folders, anything that would let a course page or a source file run code on your computer.
- The engine and the CLI (`packages/engine`, `apps/cli`): key handling (a key must never be logged, printed,
  written into a course or sent anywhere but the provider), path handling, and the course files they write.
- The course page (`packages/player`): a course built from a hostile source file.
- BiliMind free (`server/free-proxy`): ways to make it spend beyond its guards or to reach its key.

The hosted product at [bilimind.com](https://bilimind.com) is a separate codebase, but you can report problems in
it to the same email address.
