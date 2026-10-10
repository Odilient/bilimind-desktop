# boba-day-one: sources, licence and attribution

Cameo showcase input for "Boba Shop: Day One". No real business supplied these files.

| File | What it is | Licence |
|---|---|---|
| `mutiara-tea-bar-SOP.docx` | Crew SOP for **Mutiara Tea Bar, a fictional bubble-tea kiosk** near Taylor's Lakeside Campus: opening and closing checklists, pearls/tea/syrup prep, Brown Sugar Milk Tea step by step with "what goes wrong", sweetness and ice tables, menu codes, allergens, hygiene rules, four customer scenarios | CC BY-SA 4.0, written for this demo |
| `food-hygiene-regulations-2009-one-page.pdf` | One-page plain-English summary of food-handler duties in Malaysia's Food Hygiene Regulations 2009 | CC BY-SA 4.0 for the summary text; the regulations themselves are Malaysian legislation |

## Honest labels

- Page 1 of the SOP says "SAMPLE DOCUMENT, FICTIONAL SHOP". Mutiara Tea Bar does not exist; recipes, prices,
  creamer ingredients and house rules are realistic examples, not any real shop's.
- The one-pager says it does not replace the Ministry of Health food-handler training course, and that it is not
  legal advice.

## Source for the legal points

Food Hygiene Regulations 2009, P.U.(A) 95/2009 (28 February 2009), made under section 34 of the Food Act 1983
[Act 281]. Text read from the FAOLEX (FAO) database copy: https://faolex.fao.org/docs/pdf/mal91581.pdf
(accessed 10 October 2026). Regulation numbers cited in both files (regs. 2, 11, 30-38) were checked against that
text. The summary is written in our own words. The regulations may have been amended since 2009; check the current
text with the Food Safety and Quality Division, Ministry of Health Malaysia.

"In practice, the anti-typhoid injection" is our explanatory note: reg. 31(1) itself says "medically examined and
vaccinated by a registered medical practitioner".

## Rebuild

`python showcase/sources/_build/build_boba.py` (python-docx for the SOP; headless Edge for the PDF).
