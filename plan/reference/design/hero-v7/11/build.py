#!/usr/bin/env python3
"""Inline 11/shell.html into one standalone page: ../11-cobalt-landing.html.

Markers in the shell:
  /*@css:name.css*/      -> contents of 11/name.css
  /*@js:name.js*/        -> contents of 11/js/name.js
  <!--@file:name.html--> -> contents of 11/name.html
  <!--@part:id-->        -> contents of 11/parts/id.html (a placeholder comment if the part is missing)
"""
import os
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE.parent / '11-cobalt-landing.html'
# PARTS=none → no parts (to test the page's own sections alone); OUT=… → another file name.
ONLY = os.environ.get('PARTS')
if os.environ.get('OUT'):
    OUT = HERE.parent / os.environ['OUT']


def read(p: pathlib.Path) -> str:
    return p.read_text(encoding='utf-8')


def main() -> int:
    html = read(HERE / 'shell.html')
    html = re.sub(r'/\*@css:([\w.-]+)\*/', lambda m: read(HERE / m.group(1)), html)
    html = re.sub(r'/\*@js:([\w.-]+)\*/', lambda m: read(HERE / 'js' / m.group(1)), html)
    html = re.sub(r'<!--@file:([\w.-]+)-->', lambda m: read(HERE / m.group(1)), html)

    missing = []

    def part(m):
        p = HERE / 'parts' / f'{m.group(1)}.html'
        if ONLY is not None and m.group(1) not in ONLY.split(','):
            return f'<!-- part "{m.group(1)}" skipped -->'
        if not p.exists():
            missing.append(m.group(1))
            return f'<!-- part "{m.group(1)}" not built yet -->'
        return f'<!-- ═══ part: {m.group(1)} ═══ -->\n' + read(p)

    html = re.sub(r'<!--@part:([\w-]+)-->', part, html)
    OUT.write_text(html, encoding='utf-8')
    print(f'wrote {OUT.relative_to(HERE.parent.parent)} ({len(html) // 1024} KB)' + (f'; missing parts: {", ".join(missing)}' if missing else ''))
    return 0


if __name__ == '__main__':
    sys.exit(main())
