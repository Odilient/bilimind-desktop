# WP8 Showcase sources: STATUS

- **Works:** `ds-final/` has 4 landscape 16:9 lecture decks (16/16/15/14 slides, slide 1 says "Sample lecture deck compiled from Wikipedia (CC BY-SA 4.0) for a demo") + `past-paper.pdf` (A4, 5 questions, 100 marks: hashing 30, heaps 30, analysis/arrays 15, BST 15, linked lists 10, no AVL). Every worked example and code snippet was checked by running it in Node.
- **Works:** `boba-day-one/` has `mutiara-tea-bar-SOP.docx` (fictional shop, "SAMPLE DOCUMENT, FICTIONAL SHOP" on page 1, 12 headed sections, 10 tables) + `food-hygiene-regulations-2009-one-page.pdf` (checked against the P.U.(A) 95/2009 text, regs. 2, 11, 30-38, says it does not replace MOH training).
- **Works:** `bm-survival/` has `malay-survival-phrasebook.md` (Wikivoyage CC BY-SA + † demo additions: mamak, Grab, campus) + `bmk2-note.md` (Taylor's MPU page: BMK2 = MPU31002, U1, international degree students).
- **Works:** `dormathon-briefing/dormathon-briefing.pdf`: organiser deck, re-compressed 68 MB to 11.7 MB with the same text layer. Git-ignored; never put it in a committed course. Pages 6 and 9-14 are image-only (scanned).
- **Verified:** `python showcase/sources/_build/verify.py` → OK. Every PDF page has text, the decks are landscape, every folder has a LICENSE.md, and the three committed folders are under 1 MB each.
- **Rebuild:** `python showcase/sources/_build/build_ds.py` and `build_boba.py` (headless Edge + python-docx).
- **Not done / next:** the WP1 ingest has not run on these files yet (the engine does not exist yet). Ingest must skip `LICENSE.md` in each folder. A native Malay speaker still needs to check the phrasebook (H15). There is no private H9/H10 material; `showcase/sources/private/` is git-ignored for it.
