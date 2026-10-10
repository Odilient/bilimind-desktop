"""Build showcase/sources/boba-day-one: a sample SOP for a fictional bubble-tea bar (DOCX)
and a one-page summary of Malaysia's Food Hygiene Regulations 2009 for food handlers (A4 PDF).

Run: python showcase/sources/_build/build_boba.py
"""
from __future__ import annotations

from pathlib import Path

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor, Cm

from kit import print_pdf, scratch_dir, md_inline

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "boba-day-one"
WORK = scratch_dir() / "boba"

SHOP = "Mutiara Tea Bar"


# ------------------------------------------------------------------ docx helpers
def shade(cell, hex_fill: str) -> None:
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_fill)
    tcPr.append(shd)


def add_runs(par, text: str) -> None:
    """Very small **bold** support."""
    parts = text.split("**")
    for i, part in enumerate(parts):
        if part:
            r = par.add_run(part)
            r.bold = i % 2 == 1


def para(doc, text: str, style: str | None = None):
    p = doc.add_paragraph(style=style)
    add_runs(p, text)
    return p


def bullets(doc, items, numbered: bool = False):
    style = "List Number" if numbered else "List Bullet"
    for it in items:
        para(doc, it, style)


def table(doc, rows, widths_cm=None, header_fill="1F5130"):
    t = doc.add_table(rows=len(rows), cols=len(rows[0]))
    t.style = "Table Grid"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for r, row in enumerate(rows):
        for c, val in enumerate(row):
            cell = t.cell(r, c)
            cell.text = ""
            p = cell.paragraphs[0]
            add_runs(p, val)
            for run in p.runs:
                run.font.size = Pt(9.5)
                if r == 0:
                    run.bold = True
                    run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
            if r == 0:
                shade(cell, header_fill)
    if widths_cm:
        for row in t.rows:
            for c, w in enumerate(widths_cm):
                row.cells[c].width = Cm(w)
    doc.add_paragraph()
    return t


# ------------------------------------------------------------------ SOP content
def build_sop(path: Path) -> None:
    doc = Document()
    st = doc.styles["Normal"]
    st.font.name = "Calibri"
    st.font.size = Pt(11)
    for s in ("Heading 1", "Heading 2", "Heading 3"):
        doc.styles[s].font.color.rgb = RGBColor(0x1F, 0x51, 0x30)
    sec = doc.sections[0]
    sec.left_margin = sec.right_margin = Cm(2.2)
    sec.top_margin = sec.bottom_margin = Cm(2.0)
    doc.core_properties.title = f"{SHOP}: Crew SOP (sample document, fictional shop)"
    doc.core_properties.author = "BiliMind demo team"
    doc.core_properties.comments = "Sample document, fictional shop. Written for the BiliMind demo. CC BY-SA 4.0."

    # page 1 banner
    banner = doc.add_table(rows=1, cols=1)
    banner.style = "Table Grid"
    c = banner.cell(0, 0)
    shade(c, "FFF3C4")
    p = c.paragraphs[0]
    r = p.add_run("SAMPLE DOCUMENT, FICTIONAL SHOP")
    r.bold = True
    r.font.size = Pt(16)
    r.font.color.rgb = RGBColor(0x9A, 0x34, 0x12)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p2 = c.add_paragraph()
    p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p2.add_run(
        f"Sample document, fictional shop. {SHOP} does not exist. This SOP was written for the BiliMind demo. "
        "Recipes, prices and house rules are realistic examples, not instructions from any real business. "
        "Legal points refer to Malaysia's Food Hygiene Regulations 2009 (see the one-page summary in this folder)."
    ).font.size = Pt(10)
    doc.add_paragraph()

    t = doc.add_heading(f"{SHOP}: Crew Standard Operating Procedure (SOP)", 0)
    t.runs[0].font.size = Pt(24)
    para(doc, "A small bubble-tea kiosk near Taylor's University Lakeside Campus, Subang Jaya (fictional).")
    table(doc, [
        ["Document", "Version", "Applies to", "Owner"],
        ["Crew SOP", "1.0 (October 2026)", "All crew, every shift", "Shop manager"],
    ], [5, 4, 4, 4])

    doc.add_heading("1. How to use this SOP", 1)
    bullets(doc, [
        "Every new crew member reads this SOP and must pass the **day-one quiz (pass mark 80%)** before their first shift.",
        "Rules marked **[LAW]** come from Malaysia's Food Hygiene Regulations 2009 (FHR 2009). Rules marked **[SHOP]** are our house rules.",
        "If you are not sure, ask the shift lead. **Never guess about allergens.**",
    ])

    doc.add_heading("2. Before your first shift", 1)
    bullets(doc, [
        "**Food handler training:** attend a food handler training course at an institution recognised by the Ministry of Health (MOH) and get the certificate. [LAW, FHR 2009 reg. 30]",
        "**Medical examination and typhoid vaccination** by a registered medical practitioner. [LAW, reg. 31(1)]",
        "Give copies of both certificates to the manager. The shop must keep them on file for inspection and may not let anyone work without them. [LAW, reg. 11(1)(b) and (c)]",
        "If you have diarrhoea, vomiting, fever, jaundice or an infected wound, do not come in. Tell the shift lead by phone. You return only when a doctor says you are fit to work. [LAW, reg. 31(2)]",
    ])

    doc.add_heading("3. Shifts and roles", 1)
    table(doc, [
        ["Shift", "Hours", "Arrive by", "Notes"],
        ["Opening", "10:00 to 16:00", "09:30", "Runs the opening checklist (section 4)"],
        ["Closing", "16:00 to 22:30", "15:50", "Shop closes 22:00; runs the closing checklist (section 5)"],
    ], [3, 4, 3, 7])
    bullets(doc, [
        "**Cashier:** takes orders, prints the cup sticker, takes payment (cash, card, DuitNow QR), answers allergen questions.",
        "**Bar:** makes the drinks exactly as the sticker says.",
        "**Prep:** pearls, tea, syrup, washing up, restocking. On a two-person shift the shift lead does Cashier and Prep.",
    ])

    doc.add_heading("4. Opening checklist (09:30 to 10:00)", 1)
    bullets(doc, [
        "Wash hands with soap for at least 20 seconds before touching anything behind the bar. [LAW, reg. 33(1)(c)]",
        "Uniform: shop T-shirt, light-coloured apron, cap, closed shoes. Remove rings, watches, bracelets and pins. [LAW, regs. 32 and 33(1)(f)]",
        "Read the chiller and freezer thermometers and write both in the temperature log. Chiller must be **4 °C or below**, freezer **-18 °C or below**. If the chiller is above 5 °C, tell the shift lead before using any milk. [SHOP]",
        "Check date labels. Throw away anything past its use-by time and record it in the waste log. Use stock **first in, first out**. [LAW, reg. 38(1)(i)]",
        "Start the first batch of pearls (section 6.1). It takes about 50 minutes, so start it first.",
        "Brew black tea and jasmine green tea (section 6.2). Check the brown sugar syrup; make more if the bottle is under half full (section 6.3).",
        "Fill the ice bin with the ice scoop. **Never scoop ice with a cup or your hands.** Leave the scoop in its holder, handle up. [SHOP; ice must be protected from contamination, LAW reg. 35(1)(j)]",
        "Sanitise the counter, shakers, jugs and the sealing machine plate.",
        "Load the cup film and test the sealing machine on an empty cup.",
        "Turn on the POS, check the RM 200 float in the cash drawer, put out the DuitNow QR stand, the menu and the allergen board. Open at 10:00.",
    ], numbered=True)

    doc.add_heading("5. Closing checklist (21:30 to 22:30)", 1)
    bullets(doc, [
        "21:30: stop cooking new pearls. Last orders at 21:55.",
        "Throw away all cooked pearls, brewed tea and opened fresh milk and oat milk (they are prepared fresh every day). Record amounts in the waste log. [SHOP]",
        "Wash shakers, jugs, scoops and the pearl pot with detergent, rinse well, sanitise, and air-dry upside down. Rinse off all detergent. [LAW, reg. 35(1)(i)]",
        "Unplug the sealing machine. Wipe the sealing plate only when it is cool.",
        "Empty the ice bin, wipe it dry and leave the lid open.",
        "Put all food away or cover it **before** sweeping and mopping. No sweeping while food is out. [LAW, reg. 35(1)(l)]",
        "Wipe counters, POS screen and menu boards. Sweep and mop the floor.",
        "Take the rubbish to the bin centre and put in new bin liners. [LAW, reg. 34]",
        "Write the chiller and freezer temperatures in the log.",
        "Count the cash drawer with the shift lead and close the POS.",
        "Switch off the lights, the water heater and the tea urn. Lock up. Post a photo of the completed checklist in the crew group chat.",
    ], numbered=True)

    doc.add_heading("6. Recipes and prep", 1)
    doc.add_heading("6.1 Tapioca pearls (prep, one batch = 200 g dry pearls)", 2)
    table(doc, [
        ["Step", "Do this", "What goes wrong"],
        ["1", "Bring 2 litres of water to a full rolling boil (10 parts water to 1 part pearls).",
         "Pearls added before the water boils turn mushy outside and stick together in one lump."],
        ["2", "Add the pearls and stir at once. When they float, cover and cook on medium heat for 25 minutes, stirring every 5 minutes.",
         "Not stirring: pearls stick to the bottom and burn."],
        ["3", "Turn off the heat and leave covered for 25 minutes.",
         "Skipping the rest: pearls have a hard white centre."],
        ["4", "Drain, rinse in cold drinking water for 30 seconds.",
         "Not rinsing: pearls are slimy and stick together in the cup."],
        ["5", "Put the pearls in the warmer with 100 ml brown sugar syrup. Label the time. **Use within 4 hours**, then throw away.",
         "Old pearls go hard and taste sour; customers complain."],
        ["Check", "Bite test: cut one pearl in half. There must be no white dot in the centre.",
         "A white dot means undercooked: cook 5 more minutes and test again."],
    ], [1.4, 8, 7])

    doc.add_heading("6.2 Tea", 2)
    bullets(doc, [
        "Black tea (for milk teas): 25 g loose leaf per 1 litre of water at 95 to 100 °C. Steep 8 minutes, then strain.",
        "Jasmine green tea (for green and fruit teas): 20 g per 1 litre at 80 °C. Steep 6 minutes, then strain.",
        "Pour into the tea urn and label it with the time. Use within 4 hours. Steeping too long makes the tea bitter.",
    ])

    doc.add_heading("6.3 Brown sugar syrup", 2)
    bullets(doc, [
        "1 kg dark brown sugar + 500 ml water. Simmer on low heat for about 10 minutes, stirring, until it coats the back of a spoon.",
        "Pour into a labelled squeeze bottle. Keep covered at room temperature and use within 2 days. [SHOP]",
        "Keep one bottle in the warm water bath on the bar: warm syrup sticks to the cup wall, cold syrup slides off.",
    ])

    doc.add_heading("6.4 Making a Brown Sugar Milk Tea (BS01), step by step", 2)
    para(doc, "Regular cup 500 ml / large cup 700 ml. Target: under 90 seconds per drink. Brown sugar drinks are **never shaken** at the bar.")
    table(doc, [
        ["Step", "Do this", "What goes wrong"],
        ["1. Read the sticker", "Check size, sweetness, ice, milk type (fresh or oat) and toppings. Look for **ALG** (allergy).",
         "Making from memory: wrong milk for an allergy customer is the most serious mistake in this shop."],
        ["2. Pearls", "Scoop pearls with the slotted pearl spoon: 1 scoop (60 g) regular, 1.5 scoops (90 g) large. Never use bare hands. [LAW, reg. 36(1)(e)]",
         "Too few pearls is the top customer complaint. Bare hands on food is an offence."],
        ["3. Tiger stripes", "Add the brown sugar syrup for the sweetness level (section 7). Tilt and turn the cup so the syrup coats the inside wall.",
         "Cold or thin syrup will not stick: no stripes. Use the bottle from the warm bath."],
        ["4. Ice", "Add ice with the scoop for the ice level (section 7).",
         "Ice before syrup washes the stripes away. Syrup always goes in first."],
        ["5. Milk", "Pour fresh milk slowly over the ice: 160 ml regular, 220 ml large. Oat milk only if the sticker says OAT.",
         "Pouring fast melts the stripes. Wrong milk type can cause an allergic reaction."],
        ["6. Tea", "Top with black tea: 100 ml regular, 140 ml large. Pour slowly over the back of a spoon so it floats as a layer.",
         "Pouring fast mixes everything brown. Still drinkable, but customers photograph this drink."],
        ["7. Seal", "Wipe the cup rim dry. Seal with one full press of the handle. Turn the cup upside down over the sink for 2 seconds.",
         "A wet rim or crooked film leaks: this is how most counter spills start."],
        ["8. Hand over", "Stick the sticker on, give a wide (12 mm) straw, read the order number aloud and say the sweetness and milk type. Tell the customer: shake before drinking.",
         "Shaking at the bar ruins the stripes. A thin straw blocks on the pearls."],
    ], [3, 7.5, 6.5])

    doc.add_heading("7. Sweetness and ice levels", 1)
    para(doc, "One pump = 10 ml. Brown sugar drinks use brown sugar syrup; all other drinks use fructose syrup with the same pump counts.")
    table(doc, [
        ["Sweetness", "Customer may say", "Regular (pumps)", "Large (pumps)"],
        ["100% (normal)", "manis biasa, normal sugar", "4", "6"],
        ["75%", "kurang manis sikit", "3", "5"],
        ["50%", "kurang manis, half sugar", "2", "3"],
        ["25%", "sikit manis, less sugar", "1", "2"],
        ["0%", "tak nak gula, kosong, no sugar", "0", "0"],
    ], [3.5, 6, 3.5, 3.5])
    bullets(doc, [
        "If a customer says **kurang manis** without a number, make **50%** and tell them. [SHOP]",
        "Brown sugar series (BS01, BS02): **minimum 25%**, because the syrup makes the stripes. If a customer asks for 0%, offer 25% or a Classic Milk Tea (CT01) at 0% with pearls.",
    ])
    table(doc, [
        ["Ice level", "Sticker code", "Customer may say", "Regular", "Large"],
        ["No ice", "NI", "tak nak ais, no ice", "none (top up with milk or tea)", "none"],
        ["Less ice", "LI", "kurang ais, less ice", "half scoop (60 g)", "1 scoop (85 g)"],
        ["Normal ice", "RI", "ais biasa, normal", "1 scoop (120 g)", "1.5 scoops (170 g)"],
        ["Hot", "HOT", "panas, hot", "CT01, CT02 and MT01 only", "regular size only"],
    ], [2.6, 2.2, 4.2, 4.2, 3.6])

    doc.add_heading("8. Menu and codes", 1)
    table(doc, [
        ["Code", "Drink", "Regular", "Large", "Contains"],
        ["BS01", "Brown Sugar Milk Tea with Pearls", "RM 10.90", "RM 12.90", "Milk; caffeine"],
        ["BS02", "Brown Sugar Fresh Milk with Pearls (no tea)", "RM 11.90", "RM 13.90", "Milk"],
        ["CT01", "Classic Milk Tea", "RM 7.90", "RM 9.90", "Milk (creamer has milk protein); soy; caffeine"],
        ["CT02", "Jasmine Green Milk Tea", "RM 8.90", "RM 10.90", "Milk (creamer has milk protein); soy; caffeine"],
        ["TH01", "Thai Milk Tea", "RM 8.90", "RM 10.90", "Milk (condensed and evaporated milk); caffeine"],
        ["MT01", "Matcha Latte", "RM 11.90", "RM 13.90", "Milk; caffeine"],
        ["FT01", "Passion Fruit Green Tea", "RM 8.90", "RM 10.90", "No milk in recipe; caffeine"],
        ["FT02", "Lychee Oolong Tea", "RM 9.90", "RM 11.90", "No milk in recipe; caffeine"],
        ["FT03", "Lemon Black Tea", "RM 7.90", "RM 9.90", "No milk in recipe; caffeine"],
    ], [1.6, 6.4, 2, 2, 5])
    table(doc, [
        ["Code", "Add-on", "Price", "Contains"],
        ["+P", "Pearls (brown sugar)", "+RM 1.50", "none of the listed allergens"],
        ["+GJ", "Grass jelly", "+RM 1.50", "none of the listed allergens"],
        ["+AJ", "Aloe vera jelly", "+RM 1.50", "none of the listed allergens"],
        ["+PD", "Egg pudding", "+RM 2.00", "**Egg and milk**"],
        ["+CF", "Cheese foam", "+RM 2.50", "**Milk** (cream cheese, cream)"],
        ["OAT", "Swap to oat milk", "+RM 2.00", "**Oats (gluten)**: our oat milk is not certified gluten-free"],
    ], [1.6, 5, 2.4, 8])
    para(doc, "**Reading a sticker:** \"BS01-L 50% LI OAT +PD ALG:milk\" means Brown Sugar Milk Tea, large, 50% sweet, less ice, oat milk, add egg pudding, customer has a milk allergy. (This order is a problem: +PD contains milk. The cashier must stop and explain before taking payment.)")

    doc.add_heading("9. Allergens", 1)
    para(doc, "Our creamer's label lists: glucose syrup, vegetable oil, **sodium caseinate (milk)**, emulsifier (**soy lecithin**). So:")
    bullets(doc, [
        "**\"Non-dairy creamer\" is NOT safe for a milk allergy.** It contains milk protein. Never tell a customer that non-dairy means dairy-free.",
        "When a customer mentions any allergy, the cashier says it out loud to the bar (\"ALLERGY: milk\") and adds **ALG** to the sticker.",
        "Check the allergen board and section 8 together with the customer. If the drink or topping is not clearly safe, say so.",
        "Making an allergy order: wash hands, new gloves, a shaker and scoop from the clean rack, fresh ice with the clean scoop, no cheese foam or pudding.",
        "Be honest: we handle milk, egg, soy and oats on one small bar, so we cannot promise zero traces. Tell the customer what you did and let them decide.",
        "**If a customer reacts** (swollen lips or face, trouble breathing, hives, vomiting): call **999** at once, tell the shift lead, keep the person still, and ask if they carry their own adrenaline auto-injector. Do not give them anything to eat or drink.",
    ])

    doc.add_heading("10. Hygiene rules", 1)
    table(doc, [
        ["Rule", "Source"],
        ["Wash hands before starting work, right after using the toilet, and after handling raw food, rubbish or anything dirty.", "[LAW] reg. 33(1)(c)"],
        ["Also wash hands after touching money, your phone or your face.", "[SHOP]"],
        ["Keep fingernails short and clean. No nail polish or false nails.", "[LAW] reg. 33(1)(a); polish rule [SHOP]"],
        ["No jewellery, watches, pins or other accessories behind the bar.", "[LAW] reg. 33(1)(f)"],
        ["Take off your apron and cap before going to the toilet.", "[LAW] reg. 33(1)(b)"],
        ["Nothing in apron pockets that could fall into a drink.", "[LAW] reg. 33(1)(e)"],
        ["Wear the apron and cap only inside the shop; keep them in your locker.", "[LAW] reg. 32(2)"],
        ["Never touch unwrapped food (pearls, jelly, fruit) with bare hands: use scoops, tongs or gloves.", "[LAW] reg. 36(1)(e)"],
        ["Never blow into a cup or bag to open it.", "[LAW] reg. 36(1)(g)"],
        ["Store stock at least 20 cm above the floor and 15 cm from the wall; cleaning chemicals never on the same shelf as food.", "[LAW] reg. 38(1)(b) and (d)"],
        ["Chipped or cracked jugs, shakers and scoops go in the bin, not back on the rack.", "[LAW] reg. 35(2)"],
        ["Cover cuts with a blue waterproof plaster and wear a glove over it.", "[SHOP]"],
        ["Phones stay in the locker. No eating, smoking or vaping behind the bar.", "[SHOP]; reg. 33(1)(d)"],
        ["Sick? Stay home and tell the shift lead (see section 2).", "[LAW] reg. 31(2)"],
    ], [12, 5])

    doc.add_heading("11. Customer scenarios", 1)
    doc.add_heading("Scenario A: dairy allergy", 2)
    para(doc, "A parent asks: **\"Is the classic milk tea dairy-free? My daughter is allergic to milk.\"**")
    bullets(doc, [
        "Wrong answer: \"Yes, we use non-dairy creamer.\" The creamer contains sodium caseinate, a milk protein.",
        "Right answer: \"No, the classic milk tea contains milk protein. The fruit teas (FT01, FT02, FT03) have no milk in the recipe. I can make one with clean equipment, without cheese foam or pudding. We do handle milk on this bar, so I can't promise zero traces.\"",
        "Then: say \"ALLERGY: milk\" to the bar, add ALG to the sticker, and follow the allergy steps in section 9.",
    ])
    doc.add_heading("Scenario B: spill at the counter", 2)
    para(doc, "You hand over a BS01; the cup tips and the drink spills across the counter and drips onto the floor.")
    bullets(doc, [
        "Check that nobody is hurt or about to slip. Apologise; do not blame the customer.",
        "Put out the yellow **\"Lantai basah / Wet floor\"** sign at once.",
        "Counter: soak up with paper towels, then clean and sanitise. Floor: use the spill-kit mop. The floor mop and cloths never touch the counter.",
        "Wash your hands before making any drink.",
        "Remake the drink free of charge, whoever caused the spill (spills at the counter are always remade once). [SHOP]",
        "Write it in the waste log. If it leaked because of a bad seal, tell the shift lead so the sealing machine can be checked.",
    ], numbered=True)
    doc.add_heading("Scenario C: \"too sweet\"", 2)
    bullets(doc, [
        "Check the sticker against the drink. Remake once at the level the customer wants, free of charge. [SHOP]",
        "If the sticker was wrong, tell the cashier so it does not happen again.",
    ])
    doc.add_heading("Scenario D: order in Malay", 2)
    bullets(doc, [
        "\"Teh susu kurang manis, kurang ais, satu.\" means one milk tea, less sweet, less ice: **CT01-R 50% LI**.",
        "\"Bungkus\" or \"tapau\" means takeaway; \"minum sini\" means drinking here.",
    ])

    doc.add_heading("12. Before your first shift you must be able to", 1)
    bullets(doc, [
        "Run the opening and closing checklists without missing a step.",
        "Make BS01 in under 90 seconds and explain what goes wrong at each step.",
        "Read any sticker (codes, sweetness, ice, ALG).",
        "Say which drinks and toppings contain milk, egg, soy or oats.",
        "Handle the four scenarios above.",
        "Pass the day-one quiz with 80% or more.",
    ])

    p = doc.add_paragraph()
    r = p.add_run(
        f"Sample document, fictional shop. {SHOP} is fictional. Written for the BiliMind demo, shared under CC BY-SA 4.0. "
        "It does not replace the MOH food handler training course."
    )
    r.italic = True
    r.font.size = Pt(9)
    path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(path)


# ------------------------------------------------------------------ FHR 2009 one-pager
FHR_CSS = """
@page { size: A4; margin: 11mm 12mm 10mm 12mm; }
body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 10.1pt; line-height: 1.3; color: #111; margin: 0; }
h1 { font-size: 15pt; margin: 0 0 2px 0; color: #1f5130; }
.sub { font-size: 9pt; color: #333; margin-bottom: 6px; }
.warn { border: 1.5px solid #9a3412; background: #fff7ed; padding: 4px 8px; font-size: 9pt; margin-bottom: 7px; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 14px; }
.box { border-top: 2px solid #1f5130; padding-top: 2px; }
h2 { font-size: 10.5pt; margin: 2px 0 2px 0; color: #1f5130; }
ul { margin: 0; padding-left: 15px; }
li { margin: 1px 0; }
.foot { margin-top: 7px; font-size: 8pt; color: #333; border-top: 1px solid #999; padding-top: 4px; }
"""

FHR_SECTIONS = [
    ("Who is a food handler (reg. 2)", [
        "Anyone who is directly involved in preparing food, comes into contact with food or food-contact surfaces, or handles packaged or unpackaged food or appliances in food premises.",
        "Bubble-tea crew who scoop pearls, pour milk, seal cups or wash shakers are food handlers.",
    ]),
    ("Before you start work (regs. 30, 31(1), 11)", [
        "**Training:** attend food handler training and get a Certificate of Food Handlers Training from an institution specified by the Director (MOH-recognised).",
        "**Medical check and vaccination** by a registered medical practitioner (in practice, the anti-typhoid injection).",
        "The owner must not let you work without training, medical examination and vaccination, and must keep these records for inspection.",
    ]),
    ("If you are ill (reg. 31(2))", [
        "If you have, carry, or may have a food-borne disease: do not enter the food premises or handle food.",
        "Report your health condition to the management immediately.",
        "Stay off work until a registered medical practitioner certifies you cured and fit to work.",
    ]),
    ("Clothing (reg. 32)", [
        "Clean, suitable clothing that cannot contaminate food.",
        "A clean, light-coloured overall or apron, a head cover and footwear.",
        "Wear them only in the food premises; keep them in a cupboard or locker when not in use.",
    ]),
    ("Personal hygiene (reg. 33)", [
        "Keep yourself clean; fingernails short and clean.",
        "Remove your overall, apron or head cover before going to the toilet.",
        "Wash hands before starting work, immediately after the toilet, and after handling raw food or contaminated material.",
        "No behaviour that could contaminate food; nothing in pockets that could contaminate food.",
        "No jewellery, watches, pins or other accessories.",
    ]),
    ("Clean premises and equipment (regs. 34, 35)", [
        "Keep the premises free of rubbish, pests, dirt and cobwebs at all times.",
        "Use different cutting boards for raw and cooked food; sanitise raw-food equipment before using it for cooked food.",
        "Rinse cleaning chemicals off food-contact surfaces. Ice must be made from potable water and protected.",
        "No sweeping, wall cleaning or dusting while food is being handled. Throw out chipped, cracked or rusty appliances.",
        "Do not refreeze retail frozen food after thawing.",
    ]),
    ("Preparing and serving (reg. 36)", [
        "Do not handle unwrapped food with bare hands, and stop customers doing so.",
        "Never use your breath to open a bag or wrapper. Wipe hands with a clean towel.",
        "Keep hot food served hot above 60 °C; do not interrupt the cold chain.",
        "Food of swine origin: separate preparation and separate appliances from non-swine food.",
    ]),
    ("Display and storage (regs. 37, 38)", [
        "Protect ready-to-eat food on display (cabinet, cover, container).",
        "Store raw food apart from processed food, and never with cleaning agents or disinfectants.",
        "Keep food 15 cm from the wall and 20 cm above the floor; rotate stock first in, first out.",
        "Retail chilled food between -1 °C and 10 °C; frozen food at -18 °C. Do not overload chillers and freezers.",
    ]),
]


def build_fhr(path: Path) -> None:
    boxes = "".join(
        f'<div class="box"><h2>{md_inline(t)}</h2><ul>{"".join(f"<li>{md_inline(x)}</li>" for x in items)}</ul></div>'
        for t, items in FHR_SECTIONS
    )
    html_text = f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Food handler hygiene: FHR 2009 one-page summary</title><style>{FHR_CSS}</style></head><body>
<h1>Food handler hygiene in Malaysia: Food Hygiene Regulations 2009 (one-page summary)</h1>
<div class="sub">Plain-English summary of Part IV (Food handler) and related duties in the Food Hygiene Regulations 2009,
P.U.(A) 95/2009, made under the Food Act 1983 [Act 281]. Prepared for the BiliMind "Boba Shop: Day One" demo.</div>
<div class="warn"><b>This summary does not replace MOH food-handler training.</b> Every food handler must still attend a
food handler training course recognised by the Ministry of Health Malaysia and get the certificate. This page is not legal
advice; the regulations may have been amended since 2009, so check the current text with the Food Safety and Quality
Division, Ministry of Health Malaysia.</div>
<div class="grid">{boxes}</div>
<div class="foot"><b>Penalties:</b> most food-handler offences (regs. 30, 31, 33-38) carry a fine of up to RM 10,000 or
imprisonment of up to 2 years; the clothing offence (reg. 32) carries a fine of up to RM 1,000.
<b>Source:</b> Food Hygiene Regulations 2009, P.U.(A) 95/2009 (28 February 2009), text read from the FAOLEX database copy,
https://faolex.fao.org/docs/pdf/mal91581.pdf (accessed 10 October 2026). Summary written in our own words; the shop SOP in
this folder is a fictional example.</div>
</body></html>"""
    print_pdf(html_text, path, WORK)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    build_sop(OUT / "mutiara-tea-bar-SOP.docx")
    print("wrote mutiara-tea-bar-SOP.docx")
    build_fhr(OUT / "food-hygiene-regulations-2009-one-page.pdf")
    print("wrote food-hygiene-regulations-2009-one-page.pdf")


if __name__ == "__main__":
    main()
