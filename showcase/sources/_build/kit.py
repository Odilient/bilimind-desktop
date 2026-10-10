"""Tiny HTML -> PDF kit for the showcase sources (headless Edge print).

Slides: 13.333in x 7.5in landscape pages, sparse university-lecture style.
Docs:   A4 portrait pages.
"""
from __future__ import annotations

import html
import os
import re
import subprocess
import tempfile
from pathlib import Path

EDGE = Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe")


def md_inline(text: str) -> str:
    """Escape, then allow **bold**, `code` and *italic*."""
    t = html.escape(text, quote=False)
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
    t = re.sub(r"`(.+?)`", r"<code>\1</code>", t)
    t = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])", r"<i>\1</i>", t)
    return t


def bullets_html(items) -> str:
    out = ["<ul>"]
    for it in items:
        if isinstance(it, (list, tuple)):
            out.append(bullets_html(it))
        else:
            out.append(f"<li>{md_inline(it)}</li>")
    out.append("</ul>")
    return "".join(out)


def table_html(rows, cls: str = "") -> str:
    head, *body = rows
    h = "".join(f"<th>{md_inline(c)}</th>" for c in head)
    b = "".join("<tr>" + "".join(f"<td>{md_inline(c)}</td>" for c in r) + "</tr>" for r in body)
    return f'<table class="{cls}"><thead><tr>{h}</tr></thead><tbody>{b}</tbody></table>'


def code_html(code: str) -> str:
    return f"<pre>{html.escape(code.strip(chr(10)), quote=False)}</pre>"


SLIDE_CSS = """
@page { size: 13.333in 7.5in; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; color: #1d1d1f; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
section.slide { width: 13.333in; height: 7.5in; position: relative; overflow: hidden; page-break-after: always; break-after: page; background: #fff; }
section.slide:last-child { page-break-after: auto; break-after: auto; }
.bar { position: absolute; left: 0; top: 0; width: 100%; height: 0.16in; background: #0b3d91; }
.bar2 { position: absolute; left: 0; top: 0.16in; width: 100%; height: 0.05in; background: #f2a900; }
h1 { position: absolute; left: 0.7in; top: 0.45in; right: 0.7in; margin: 0; font-size: 34pt; color: #0b3d91; font-weight: 700; }
.body { position: absolute; left: 0.75in; right: 0.75in; top: 1.45in; bottom: 0.75in; font-size: 21pt; line-height: 1.32; }
.body.cols { display: flex; gap: 0.45in; }
.body.cols > div { flex: 1; min-width: 0; }
ul { margin: 0 0 0.12in 0; padding-left: 0.38in; }
ul ul { font-size: 0.86em; margin-top: 0.02in; }
li { margin: 0.05in 0; }
code { font-family: Consolas, 'Courier New', monospace; font-size: 0.9em; background: #f1f3f8; padding: 0 3px; border-radius: 3px; }
pre { font-family: Consolas, 'Courier New', monospace; font-size: 15pt; line-height: 1.28; background: #f4f6fb; border-left: 5px solid #0b3d91; padding: 0.14in 0.2in; margin: 0.08in 0 0.12in 0; white-space: pre; }
table { border-collapse: collapse; font-size: 17pt; margin: 0.06in 0 0.1in 0; width: 100%; }
th { background: #0b3d91; color: #fff; text-align: left; padding: 5px 10px; font-weight: 600; }
td { border-bottom: 1px solid #c9d1e3; padding: 5px 10px; vertical-align: top; }
tr:nth-child(even) td { background: #f6f8fc; }
.note { font-size: 16pt; color: #444; margin-top: 0.08in; }
.foot { position: absolute; left: 0.7in; right: 0.7in; bottom: 0.28in; font-size: 11pt; color: #6b7280; display: flex; justify-content: space-between; border-top: 1px solid #d7dce6; padding-top: 4px; }
/* title slide */
section.title { background: #0b3d91; color: #fff; }
section.title .code { position: absolute; left: 0.9in; top: 1.2in; font-size: 20pt; letter-spacing: 1px; color: #f2a900; font-weight: 700; }
section.title .t { position: absolute; left: 0.9in; top: 1.8in; right: 0.9in; font-size: 44pt; font-weight: 700; line-height: 1.12; }
section.title .s { position: absolute; left: 0.9in; top: 3.75in; right: 0.9in; font-size: 22pt; color: #dbe4ff; }
section.title .lic { position: absolute; left: 0.9in; right: 0.9in; bottom: 0.7in; font-size: 15pt; background: rgba(255,255,255,0.12); border-left: 6px solid #f2a900; padding: 0.12in 0.2in; color: #fff; }
"""


def render_slide(s: dict, n: int, total: int, footer: str) -> str:
    if s.get("kind") == "title":
        return (
            '<section class="slide title">'
            f'<div class="code">{md_inline(s["code"])}</div>'
            f'<div class="t">{md_inline(s["title"])}</div>'
            f'<div class="s">{"<br>".join(md_inline(x) for x in s.get("sub", []))}</div>'
            f'<div class="lic">{"<br>".join(md_inline(x) for x in s["lic"])}</div>'
            "</section>"
        )
    parts = []
    for block in s.get("blocks", []):
        parts.append(render_block(block))
    if "cols" in s:
        inner = "".join("<div>" + "".join(render_block(b) for b in col) + "</div>" for col in s["cols"])
        body = f'<div class="body cols">{inner}</div>'
    else:
        body = f'<div class="body">{"".join(parts)}</div>'
    return (
        '<section class="slide"><div class="bar"></div><div class="bar2"></div>'
        f'<h1>{md_inline(s["title"])}</h1>{body}'
        f'<div class="foot"><span>{md_inline(footer)}</span><span>{n}</span></div></section>'
    )


def render_block(b) -> str:
    kind, val = b
    if kind == "ul":
        return bullets_html(val)
    if kind == "code":
        return code_html(val)
    if kind == "code_s":
        return code_html(val).replace("<pre>", '<pre style="font-size:12.5pt;line-height:1.22">', 1)
    if kind == "table":
        return table_html(val)
    if kind == "note":
        return f'<div class="note">{md_inline(val)}</div>'
    if kind == "p":
        return f"<p>{md_inline(val)}</p>"
    if kind == "html":
        return val
    raise ValueError(kind)


def deck_html(title: str, slides: list[dict], footer: str) -> str:
    body = "".join(render_slide(s, i + 1, len(slides), footer) for i, s in enumerate(slides))
    return (
        f'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>{html.escape(title)}</title>'
        f"<style>{SLIDE_CSS}</style></head><body>{body}</body></html>"
    )


def print_pdf(html_text: str, out_pdf: Path, work: Path) -> None:
    work.mkdir(parents=True, exist_ok=True)
    src = work / (out_pdf.stem + ".html")
    src.write_text(html_text, encoding="utf-8")
    profile = work / "edge-profile"
    profile.mkdir(exist_ok=True)
    out_pdf.parent.mkdir(parents=True, exist_ok=True)
    if out_pdf.exists():
        out_pdf.unlink()
    cmd = [
        str(EDGE),
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        f"--user-data-dir={profile}",
        "--no-pdf-header-footer",
        "--run-all-compositor-stages-before-draw",
        f"--print-to-pdf={out_pdf}",
        src.resolve().as_uri(),
    ]
    subprocess.run(cmd, check=True, timeout=120, capture_output=True)
    if not out_pdf.exists():
        raise RuntimeError(f"Edge did not write {out_pdf}")


def scratch_dir() -> Path:
    d = os.environ.get("BM_SCRATCH") or tempfile.gettempdir()
    return Path(d) / "bilimind-showcase-build"
