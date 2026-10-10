"""Verify every showcase source: PDFs have a text layer on every page, slide decks are landscape,
each folder has a LICENSE.md and stays under 5 MB (dormathon-briefing is local-only and exempt).

Run: python showcase/sources/_build/verify.py [--render DIR]
"""
from __future__ import annotations

import sys
from pathlib import Path

import fitz  # PyMuPDF

ROOT = Path(__file__).resolve().parent.parent
FOLDERS = ["ds-final", "boba-day-one", "bm-survival", "dormathon-briefing"]
LIMIT = 5 * 1024 * 1024


def main() -> int:
    render = None
    if "--render" in sys.argv:
        render = Path(sys.argv[sys.argv.index("--render") + 1])
        render.mkdir(parents=True, exist_ok=True)
    ok = True
    for name in FOLDERS:
        d = ROOT / name
        if not d.exists():
            print(f"[MISSING] {name}")
            ok = False
            continue
        files = sorted(p for p in d.iterdir() if p.is_file())
        size = sum(p.stat().st_size for p in files)
        lic = (d / "LICENSE.md").exists()
        flag = "" if size < LIMIT or name == "dormathon-briefing" else "  <-- over 5 MB"
        print(f"\n== {name}: {len(files)} files, {size / 1e6:.2f} MB, LICENSE.md={'yes' if lic else 'NO'}{flag}")
        ok &= lic and (size < LIMIT or name == "dormathon-briefing")
        for p in files:
            if p.suffix.lower() == ".pdf":
                doc = fitz.open(p)
                fitz.TOOLS.mupdf_display_errors(False)
                empty = [i + 1 for i, pg in enumerate(doc) if len(pg.get_text().strip()) < 20]
                land = sum(1 for pg in doc if pg.rect.width > pg.rect.height)
                w, h = doc[0].rect.width / 72, doc[0].rect.height / 72
                words = sum(len(pg.get_text().split()) for pg in doc)
                print(f"  {p.name}: {doc.page_count} pages, {w:.2f}x{h:.2f} in, landscape {land}/{doc.page_count}, "
                      f"{words} words, pages without text: {empty or 'none'}")
                if empty and name != "dormathon-briefing":
                    ok = False
                if render is not None and name != "dormathon-briefing":
                    for i in range(doc.page_count):
                        doc[i].get_pixmap(dpi=40).save(render / f"{p.stem}-{i + 1:02d}.png")
            elif p.suffix.lower() == ".docx":
                import docx

                dx = docx.Document(p)
                words = sum(len(par.text.split()) for par in dx.paragraphs)
                words += sum(len(c.text.split()) for t in dx.tables for r in t.rows for c in r.cells)
                heads = sum(1 for par in dx.paragraphs if par.style.name.startswith("Heading"))
                print(f"  {p.name}: {words} words, {heads} headings, {len(dx.tables)} tables")
            elif p.suffix.lower() == ".md":
                print(f"  {p.name}: {len(p.read_text(encoding='utf-8').split())} words")
            else:
                print(f"  {p.name}: {p.stat().st_size} bytes")
    print("\nRESULT:", "OK" if ok else "PROBLEMS")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
