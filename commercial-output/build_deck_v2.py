"""
Tank Inspection Copilot — Commercial BD Deck Generator
Template: LAIQ brand (white bg, #075F5C teal, Arial, LAIQ logo)
"""
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
import os

BASE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(BASE, "screenshots")
LOGO  = os.path.join(BASE, "laiq_logo.png")
OUT   = os.path.join(BASE, "Tank_Inspection_Copilot_BD_Deck_V2.pptx")

# ── LAIQ Palette ──────────────────────────────────────────────────────────────
TEAL     = RGBColor(0x07, 0x5F, 0x5C)   # LAIQ primary "blue"
TEAL_LT  = RGBColor(0xDC, 0xEF, 0xE9)   # mint card background
TEAL_MID = RGBColor(0xCB, 0xD8, 0xD4)   # separator / divider
NAVY     = RGBColor(0x1A, 0x3C, 0x6E)   # LAIQ logo navy (accent)
WHITE    = RGBColor(0xFF, 0xFF, 0xFF)
OFFWHITE = RGBColor(0xF4, 0xF7, 0xF6)   # slide background
DARK     = RGBColor(0x17, 0x20, 0x1E)   # body text
MID      = RGBColor(0x52, 0x62, 0x5E)   # secondary / caption text
RED      = RGBColor(0xCC, 0x23, 0x23)   # LAIQ logo red (accent)
AMBER    = RGBColor(0xE6, 0x7E, 0x22)   # warm accent for warnings/stats

W = Inches(13.33)
H = Inches(7.5)

prs = Presentation()
prs.slide_width  = W
prs.slide_height = H
BLANK = prs.slide_layouts[6]

FONT = "Arial"


# ── Helpers ───────────────────────────────────────────────────────────────────

def bg(slide, color=WHITE):
    fill = slide.background.fill
    fill.solid()
    fill.fore_color.rgb = color

def rect(slide, left, top, w, h, color=None, line_color=None, line_w=1):
    shape = slide.shapes.add_shape(1,
        Inches(left), Inches(top), Inches(w), Inches(h))
    if color:
        shape.fill.solid()
        shape.fill.fore_color.rgb = color
    else:
        shape.fill.background()
    if line_color:
        shape.line.color.rgb = line_color
        shape.line.width = Pt(line_w)
    else:
        shape.line.fill.background()
    return shape

def txt(slide, text, left, top, w, h,
        size=13, bold=False, color=DARK,
        align=PP_ALIGN.LEFT, wrap=True, italic=False):
    txb = slide.shapes.add_textbox(
        Inches(left), Inches(top), Inches(w), Inches(h))
    txb.word_wrap = wrap
    tf = txb.text_frame
    tf.word_wrap = wrap
    p = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = text
    run.font.name = FONT
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = color
    return txb

def txt_bullets(slide, items, left, top, w,
                size=12, color=DARK, label_color=TEAL, gap=0.42, h=None):
    """items = list of (label, body) or just str. Returns bottom y."""
    for i, item in enumerate(items):
        tp = top + i * gap
        if isinstance(item, tuple):
            label, body = item
            txb = slide.shapes.add_textbox(
                Inches(left), Inches(tp), Inches(w), Inches(gap))
            tf = txb.text_frame
            tf.word_wrap = True
            p = tf.paragraphs[0]
            r1 = p.add_run()
            r1.text = label + "  "
            r1.font.name = FONT
            r1.font.size = Pt(size)
            r1.font.bold = True
            r1.font.color.rgb = label_color
            r2 = p.add_run()
            r2.text = body
            r2.font.name = FONT
            r2.font.size = Pt(size)
            r2.font.color.rgb = color
        else:
            txt(slide, f"▸  {item}", left, tp, w, gap, size=size, color=color)
    return top + len(items) * gap

def bar(slide, color=TEAL, left=0, top=0, w=0.3, h=7.5):
    rect(slide, left, top, w, h, color)

def rule(slide, top, color=TEAL_MID, left=0.5, w=12.5):
    rect(slide, left, top, w, 0.03, color)

def heading(slide, text, top=0.55, size=28):
    txt(slide, text, 0.55, top, 12.4, 0.8, size=size, bold=True, color=TEAL)

def kicker(slide, text, color=MID, top=0.28):
    txt(slide, text, 0.55, top, 10, 0.28, size=9, bold=True, color=color)

def logo(slide, right_edge=13.0, bottom_edge=7.25, height=0.32):
    if not os.path.exists(LOGO):
        return
    w = height * (930 / 430)
    slide.shapes.add_picture(
        LOGO,
        Inches(right_edge - w), Inches(bottom_edge - height),
        width=Inches(w), height=Inches(height))

def phone(slide, img_path, left, top, height=5.6):
    if not os.path.exists(img_path):
        return
    pw = height * 0.463
    rect(slide, left + 0.06, top + 0.08, pw, height, TEAL_MID)
    rect(slide, left,        top,        pw, height, WHITE, TEAL_MID, 0.5)
    slide.shapes.add_picture(
        img_path,
        Inches(left + 0.04), Inches(top + 0.09),
        width=Inches(pw - 0.08),
        height=Inches(height - 0.18))

def stat_card(slide, left, top, w, h, stat, label, accent=TEAL):
    rect(slide, left, top, w, h, OFFWHITE, TEAL_MID, 0.5)
    rect(slide, left, top, w, 0.06, accent)
    txt(slide, stat,  left + 0.15, top + 0.12, w - 0.3, 0.65,
        size=28, bold=True, color=accent)
    txt(slide, label, left + 0.15, top + 0.78, w - 0.3, 0.9,
        size=10, color=MID, wrap=True)


# ════════════════════════════════════════════════════════════════════════════════
#  SLIDE 1 — Cover
# ════════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
bg(s, WHITE)
bar(s, TEAL,    left=0,    w=0.35)
bar(s, TEAL_LT, left=0.35, w=0.15)

txt(s, "TANK INSPECTION", 0.7, 1.45, 10, 0.9,  size=38, bold=True, color=DARK)
txt(s, "COPILOT",         0.7, 2.22, 10, 1.0,  size=52, bold=True, color=TEAL)
rule(s, 3.38, TEAL, left=0.7, w=9.2)

txt(s, "From field inspection workflow to structured inspection package",
    0.7, 3.55, 9.6, 0.45, size=15, color=MID, italic=True)

rect(s, 0.7, 4.18, 8.55, 0.86, TEAL_LT, TEAL_MID, 0.5)
txt(s, "Capture readings, findings, photos, location, and MFL context in one guided flow — then leave site with a report-ready output package.",
    0.92, 4.42, 8.1, 0.4, size=13, bold=True, color=TEAL)

txt(s, "Commercial deck V2  ·  April 2026",
    0.7, 6.95, 5.2, 0.35, size=9, color=MID)

logo(s)
phone(s, os.path.join(SHOTS, "05_taskboard.png"), left=9.78, top=0.62, height=6.05)


# ════════════════════════════════════════════════════════════════════════════════
#  SLIDE 2 — Current Workflow
# ════════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
bg(s, WHITE)
bar(s, AMBER, w=0.35)

kicker(s, "CURRENT STATE", AMBER)
heading(s, "Current inspection workflow")
rule(s, 1.38, AMBER, left=0.5, w=12.5)

txt(s, "The problem is not inspection effort alone. It is the broken handoff between field capture and final reporting.",
    0.55, 1.47, 10.8, 0.42, size=11, color=MID)

workflow = [
    ("1", "Field inspection", "UT readings, notes, photos"),
    ("2", "Separate records", "Notebook, phone photos, Excel sheets"),
    ("3", "Back-office re-keying", "Transfer readings into report tables"),
    ("4", "Rebuild context", "Match photos, findings, and locations"),
    ("5", "Merge MFL separately", "Contractor PDF handled outside workflow"),
    ("6", "Final QA and report", "Gaps discovered after leaving site"),
]
for i, (num, title, body) in enumerate(workflow):
    lft = 0.55 + i * 2.03
    rect(s, lft, 2.0, 1.78, 1.55, OFFWHITE, TEAL_MID, 0.5)
    rect(s, lft, 2.0, 1.78, 0.08, AMBER)
    txt(s, num, lft + 0.12, 2.16, 0.28, 0.28, size=13, bold=True, color=AMBER)
    txt(s, title, lft + 0.45, 2.12, 1.18, 0.34, size=11, bold=True, color=DARK)
    txt(s, body,  lft + 0.12, 2.58, 1.5, 0.56, size=9.5, color=MID)
    if i < len(workflow) - 1:
        txt(s, "→", lft + 1.8, 2.55, 0.25, 0.35, size=18, bold=True, color=TEAL_MID, align=PP_ALIGN.CENTER)

txt(s, "Where the workflow breaks", 0.55, 4.08, 4.0, 0.3, size=12, bold=True, color=AMBER)
rule(s, 4.43, TEAL_MID, left=0.55, w=12.25)

issues = [
    ("Duplicate entry", "The same reading is captured in the field, then typed again in the report."),
    ("Broken links", "Findings, photos, and UT rows are not connected at the moment they are observed."),
    ("Weak location traceability", "Prose descriptions are hard to trend across inspection cycles."),
    ("Fragmented outputs", "Shell, nozzles, and MFL often end up as separate deliverables."),
]
for i, (h, b) in enumerate(issues):
    lft = 0.55 + (i % 2) * 6.2
    tp = 4.65 + (i // 2) * 0.88
    rect(s, lft, tp, 5.95, 0.72, WHITE, TEAL_MID, 0.4)
    txt(s, h, lft + 0.16, tp + 0.1, 2.3, 0.24, size=11, bold=True, color=DARK)
    txt(s, b, lft + 2.42, tp + 0.1, 3.32, 0.42, size=9.5, color=MID)

rect(s, 0.55, 6.58, 12.25, 0.5, TEAL_LT, TEAL, 0.7)
txt(s, "Today, the inspection and the report are still two different workflows.",
    0.72, 6.68, 11.9, 0.3, size=11, bold=True, color=TEAL, align=PP_ALIGN.CENTER)

logo(s)


# ════════════════════════════════════════════════════════════════════════════════
#  SLIDE 3 — Proposed Workflow
# ════════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
bg(s, WHITE)
bar(s, TEAL, w=0.35)

kicker(s, "PROPOSED WORKFLOW", TEAL)
heading(s, "One guided flow from inspection to output")
rule(s, 1.38, TEAL_MID, left=0.5, w=12.5)

txt(s, "Tank Inspection Copilot turns field capture, findings, MFL reference, review, and export into one connected process.",
    0.55, 1.47, 10.9, 0.42, size=11, color=MID)

future = [
    ("1", "Configure tank", "Asset, geometry, roof type, reference"),
    ("2", "Run tasks", "Shell UT, roof UT, nozzles, MFL"),
    ("3", "Capture findings in context", "Photo, note, severity, location"),
    ("4", "Link location and evidence", "Coarse by default, precise when needed"),
    ("5", "Review on site", "Warnings surfaced before leaving"),
    ("6", "Export structured package", "Tables, findings, map, JSON, CSV"),
]
for i, (num, title, body) in enumerate(future):
    lft = 0.55 + i * 2.03
    rect(s, lft, 2.0, 1.78, 1.55, WHITE, TEAL_MID, 0.5)
    rect(s, lft, 2.0, 1.78, 0.08, TEAL)
    txt(s, num, lft + 0.12, 2.16, 0.28, 0.28, size=13, bold=True, color=TEAL)
    txt(s, title, lft + 0.45, 2.12, 1.18, 0.34, size=11, bold=True, color=DARK)
    txt(s, body,  lft + 0.12, 2.58, 1.5, 0.56, size=9.5, color=MID)
    if i < len(future) - 1:
        txt(s, "→", lft + 1.8, 2.55, 0.25, 0.35, size=18, bold=True, color=TEAL, align=PP_ALIGN.CENTER)

benefits = [
    ("Single capture path", "No separate note-to-report reconstruction"),
    ("Evidence linked at source", "Finding and photo stay tied to the active task"),
    ("Standard output structure", "Same delivery package across inspection jobs"),
]
for i, (h, b) in enumerate(benefits):
    lft = 0.8 + i * 4.1
    rect(s, lft, 4.58, 3.5, 1.15, TEAL_LT, TEAL_MID, 0.5)
    txt(s, h, lft + 0.18, 4.75, 3.1, 0.26, size=11.5, bold=True, color=TEAL)
    txt(s, b, lft + 0.18, 5.12, 3.1, 0.38, size=9.8, color=DARK)

rect(s, 0.55, 6.12, 12.25, 0.68, TEAL, TEAL, 0)
txt(s, "Commercial message: the customer is not buying another inspection form. They are buying a cleaner workflow and a better inspection package at the end.",
    0.82, 6.28, 11.7, 0.36, size=11, bold=True, color=WHITE, align=PP_ALIGN.CENTER)

logo(s)


# ════════════════════════════════════════════════════════════════════════════════
#  SLIDE 4 — Guided Workflow
# ════════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
bg(s, WHITE)
bar(s, TEAL, w=0.35)

kicker(s, "FIELD CAPTURE  ·  STEP 1", TEAL)
heading(s, "Guided task-driven workflow")
rule(s, 1.38, TEAL_MID, left=0.5, w=12.5)

txt(s, "The inspector configures the tank once, selects the inspection scope, and then works from a live task board.",
    0.55, 1.47, 6.95, 0.42, size=11, color=MID)

txt_bullets(s, [
    ("Configure once", "tank geometry and reference drive later tasks"),
    ("Scope selection", "only in-scope tasks appear in the workflow"),
    ("Task board", "progress, warnings, and counts stay visible"),
    ("Draft save / resume", "supports real field interruptions"),
], left=0.55, top=2.05, w=6.8, size=12, color=DARK, label_color=TEAL, gap=0.48)

phone(s, os.path.join(SHOTS, "03_setup_filled.png"), left=7.3,  top=0.75, height=5.8)
phone(s, os.path.join(SHOTS, "05_taskboard.png"),    left=10.1, top=0.75, height=5.8)

logo(s)


# ════════════════════════════════════════════════════════════════════════════════
#  SLIDE 5 — Structured UT Data Capture
# ════════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
bg(s, WHITE)
bar(s, TEAL, w=0.35)

kicker(s, "FIELD CAPTURE  ·  STEP 2", TEAL)
heading(s, "Structured UT data capture")
rule(s, 1.38, TEAL_MID, left=0.5, w=12.5)

txt(s, "Each task captures readings in the same structure the report needs later.",
    0.55, 1.47, 6.7, 0.42, size=11, color=MID)

rows = [
    ("Surface",        "Entry method",                    "Output section"),
    ("Shell UT",       "Strake × N/E/S/W × 5 readings",  "Shell thickness table"),
    ("Roof UT",        "Plate × A–E readings",            "Roof thickness table"),
    ("Shell Nozzles",  "12 / 3 / 6 / 9 + pad",           "Shell nozzle table"),
    ("Roof Nozzles",   "N / E / S / W + pad",             "Roof nozzle table"),
    ("Bottom MFL",     "Import report metadata",          "MFL section"),
]
col_w  = [1.5, 2.45, 1.95]
col_lf = [0.65, 2.28, 4.88]
for i, row in enumerate(rows):
    is_hdr = (i == 0)
    bg_c = TEAL if is_hdr else (OFFWHITE if i % 2 == 0 else WHITE)
    rect(s, 0.55, 2.08 + i * 0.48, 6.25, 0.48, bg_c,
         None if is_hdr else TEAL_MID, 0.3)
    for cell, lf, cw in zip(row, col_lf, col_w):
        fc = WHITE if is_hdr else (DARK if i % 2 == 0 else MID)
        txt(s, cell, lf, 2.15 + i * 0.48, cw, 0.36,
            size=10, bold=is_hdr, color=fc)

phone(s, os.path.join(SHOTS, "07_shellut_readings.png"), left=7.3,  top=0.75, height=5.8)
phone(s, os.path.join(SHOTS, "11_roof_ut.png"),           left=10.1, top=0.75, height=5.8)

logo(s)


# ════════════════════════════════════════════════════════════════════════════════
#  SLIDE 6 — Inline Findings
# ════════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
bg(s, WHITE)
bar(s, AMBER, w=0.35)

kicker(s, "FIELD CAPTURE  ·  STEP 3", AMBER)
heading(s, "In-context finding capture")
rule(s, 1.38, AMBER, left=0.5, w=12.5)

txt(s, "When something is found during a task, the inspector documents it there and then — not later from memory.",
    0.55, 1.47, 8.2, 0.42, size=11, color=MID)

steps = [
    (TEAL,  "1 Photo",          "Take photo while still on the active task"),
    (TEAL,  "2 Annotate",       "Circle, arrow, or label the visible issue"),
    (TEAL,  "3 Type + severity","Crack, corrosion, deformation, weld concern"),
    (TEAL,  "4 Location",       "Task context already pre-filled"),
    (TEAL,  "5 Measurements",   "Add pit depth, crack length, or notes"),
    (AMBER, "6 Save",           "Return to UT task with no duplicate entry"),
]
for i, (color, label, desc) in enumerate(steps):
    tp = 2.05 + i * 0.48
    rect(s, 0.55, tp, 0.52, 0.42, color)
    txt(s, label, 0.67, tp + 0.06, 1.7, 0.3, size=10.5, bold=True, color=WHITE)
    txt(s, desc, 2.25, tp + 0.06, 4.6, 0.34, size=11, color=MID)

phone(s, os.path.join(SHOTS, "08_shell_finding.png"), left=9.7, top=0.75, height=5.8)

logo(s)


# ════════════════════════════════════════════════════════════════════════════════
#  SLIDE 7 — Mapping by Surface
# ════════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
bg(s, WHITE)
bar(s, TEAL, w=0.35)

kicker(s, "FIELD CAPTURE  ·  STEP 4", TEAL)
heading(s, "Location intelligence by surface")
rule(s, 1.38, TEAL_MID, left=0.5, w=12.5)

txt(s, "The app does not force one location method for every surface. It uses the right level of mapping for the job.",
    0.55, 1.47, 7.0, 0.42, size=11, color=MID)

mapping = [
    ("Shell", "Coarse UT by strake + direction. Precise shell mapping available when needed."),
    ("Roof", "Coarse roof layout by ring and section. Plate-based entry for routine UT."),
    ("Shell nozzles", "Course + degree on an unwrapped shell surface before readings."),
    ("Roof nozzles", "Roof map registration before N/E/S/W or pad measurements."),
]
for i, (h, b) in enumerate(mapping):
    tp = 2.05 + i * 0.86
    rect(s, 0.55, tp, 6.55, 0.7, WHITE, TEAL_MID, 0.4)
    rect(s, 0.55, tp, 0.07, 0.7, TEAL)
    txt(s, h, 0.75, tp + 0.1, 1.65, 0.24, size=11, bold=True, color=DARK)
    txt(s, b, 2.05, tp + 0.1, 4.8, 0.4, size=10, color=MID)

phone(s, os.path.join(SHOTS, "09_shell_layout_setup.png"), left=7.3,  top=0.75, height=5.8)
phone(s, os.path.join(SHOTS, "10b_shell_map_marked.png"),  left=10.1, top=0.75, height=5.8)

logo(s)


# ════════════════════════════════════════════════════════════════════════════════
#  SLIDE 8 — Output Package
# ════════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
bg(s, WHITE)
bar(s, TEAL, w=0.35)

kicker(s, "OUTPUT VALUE", TEAL)
heading(s, "What the customer gets at the end")
rule(s, 1.38, TEAL_MID, left=0.5, w=12.5)

txt(s, "The value is not just the capture flow. The value is the inspection package that is ready for review, handover, and downstream use.",
    0.55, 1.47, 10.6, 0.42, size=11, color=MID)

cards = [
    ("UT tables", "Shell, roof, and nozzle readings already structured for reporting"),
    ("Findings register", "Finding type, severity, measurement, and linked photo"),
    ("Location record", "Coarse or precise shell location saved with the finding"),
    ("MFL section", "Contractor reference and attachment context included"),
    ("Structured export", "JSON + CSV for analytics, CMMS, or digital twin ingestion"),
]
for i, (h, b) in enumerate(cards):
    lft = 0.55 + (i % 2) * 3.35
    tp = 2.0 + (i // 2) * 1.05
    rect(s, lft, tp, 3.05, 0.88, TEAL_LT if i == 4 else WHITE, TEAL_MID, 0.4)
    txt(s, h, lft + 0.14, tp + 0.12, 2.76, 0.22, size=10.8, bold=True, color=TEAL if i == 4 else DARK)
    txt(s, b, lft + 0.14, tp + 0.38, 2.76, 0.34, size=9.4, color=MID)

phone(s, os.path.join(SHOTS, "13_export.png"), left=9.9, top=0.78, height=5.8)

rect(s, 0.55, 5.95, 8.55, 0.82, TEAL, TEAL, 0)
txt(s, "Commercial message: the output package is already organised for handover. The inspector leaves site with structured inspection data, not disconnected notes and photos.",
    0.82, 6.15, 8.0, 0.38, size=11, bold=True, color=WHITE)

logo(s)


# ════════════════════════════════════════════════════════════════════════════════
#  SLIDE 9 — Business Value
# ════════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
bg(s, WHITE)
bar(s, AMBER, w=0.35)

kicker(s, "BUYER VALUE", AMBER)
heading(s, "Why it matters commercially")
rule(s, 1.38, AMBER, left=0.5, w=12.5)

value_cards = [
    ("Less admin load", "Reduce re-keying and post-site report reconstruction"),
    ("Better traceability", "Tie findings, photos, and location to the original task record"),
    ("Cleaner contractor handover", "Standard structure instead of multiple templates"),
    ("Better readiness for analytics", "Structured data suitable for trend analysis and asset systems"),
]
for i, (h, b) in enumerate(value_cards):
    lft = 0.55 + (i % 2) * 6.2
    tp = 1.75 + (i // 2) * 1.65
    rect(s, lft, tp, 5.95, 1.3, OFFWHITE, TEAL_MID, 0.5)
    rect(s, lft, tp, 0.08, 1.3, AMBER)
    txt(s, h, lft + 0.22, tp + 0.16, 2.2, 0.28, size=13, bold=True, color=DARK)
    txt(s, b, lft + 0.22, tp + 0.55, 5.45, 0.4, size=10.5, color=MID)

rect(s, 0.55, 5.38, 12.25, 1.15, TEAL_LT, TEAL_MID, 0.5)
txt(s, "Positioning statement", 0.75, 5.55, 2.8, 0.24, size=11.5, bold=True, color=TEAL)
txt(s, "Tank Inspection Copilot is not just a mobile form. It is a structured inspection workflow that improves how inspection data is captured, checked, handed over, and reused.", 
    0.75, 5.92, 11.6, 0.36, size=11, color=DARK)

logo(s)


# ════════════════════════════════════════════════════════════════════════════════
#  SLIDE 10 — Why Now / Who Buys
# ════════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
bg(s, WHITE)
bar(s, TEAL, w=0.35)

kicker(s, "MARKET CONTEXT", TEAL)
heading(s, "Why now — and who buys")
rule(s, 1.38, TEAL_MID, left=0.5, w=12.5)

tailwinds = [
    ("API 653 and audit pressure", ["More demand for clearer finding evidence", "Better traceability across inspection cycles"]),
    ("Inspection workforce change", ["Good practice needs to be encoded in tools", "Less dependence on inspector memory and personal templates"]),
    ("Digital asset initiatives", ["Operators want structured inspection data", "PDF-only workflows slow analysis and reuse"]),
    ("Mobile field readiness", ["Rugged tablets and phones are already standard", "The missing layer is the workflow itself"]),
]
for i, (h, bullets) in enumerate(tailwinds):
    col, row = i % 2, i // 2
    lft = 0.55 + col * 6.45
    tp  = 1.75 + row * 1.8
    rect(s, lft, tp, 6.2, 1.58, OFFWHITE, TEAL_MID, 0.5)
    rect(s, lft, tp, 0.07, 1.58, TEAL)
    txt(s, h, lft + 0.25, tp + 0.12, 5.8, 0.32, size=12.5, bold=True, color=DARK)
    for j, b in enumerate(bullets):
        txt(s, f"▸  {b}", lft + 0.25, tp + 0.55 + j * 0.38, 5.7, 0.32, size=10.5, color=MID)

rect(s, 0.55, 5.62, 12.25, 1.45, TEAL_LT, TEAL_MID, 0.5)
txt(s, "Primary buyers", 0.75, 5.78, 2.8, 0.24, size=11.5, bold=True, color=TEAL)
buyers = [
    ("Inspection companies", "Faster delivery and stronger data quality positioning"),
    ("Asset owners / operators", "Standard output across tanks and contractors"),
    ("Inspection consultancies", "Move away from bespoke Excel reporting packs"),
]
for i, (seg, why) in enumerate(buyers):
    tp = 6.08 + i * 0.28
    txt(s, f"▸  {seg}", 0.78, tp, 2.6, 0.24, size=10.5, bold=True, color=DARK)
    txt(s, why, 3.05, tp, 8.8, 0.24, size=10.2, color=MID)

logo(s)


# ════════════════════════════════════════════════════════════════════════════════
#  SLIDE 11 — Pilot Proposal
# ════════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
bg(s, WHITE)
bar(s, TEAL,    w=0.35)
bar(s, TEAL_LT, left=0.35, w=0.15)

kicker(s, "NEXT STEP", TEAL)
heading(s, "Recommended pilot")
rule(s, 1.38, TEAL_MID, left=0.5, w=12.5)

pilot = [
    ("Pilot scope", "1 tank type or 1 contractor workflow", TEAL),
    ("Users", "2–4 inspectors plus 1 report reviewer", TEAL),
    ("Pilot goal", "Verify capture flow, output usability, and data completeness", TEAL),
    ("Success criteria", "Less manual rework, clearer linked evidence, usable structured export", AMBER),
]
for i, (h, b, accent) in enumerate(pilot):
    lft = 0.55 + (i % 2) * 6.2
    tp = 1.75 + (i // 2) * 1.35
    rect(s, lft, tp, 5.95, 1.05, OFFWHITE, TEAL_MID, 0.5)
    rect(s, lft, tp, 0.08, 1.05, accent)
    txt(s, h, lft + 0.22, tp + 0.14, 2.0, 0.24, size=12, bold=True, color=DARK)
    txt(s, b, lft + 2.2, tp + 0.14, 3.45, 0.45, size=10.5, color=MID)

rect(s, 0.55, 4.78, 12.25, 1.1, TEAL, TEAL, 0)
txt(s, "Suggested close", 0.75, 4.95, 2.0, 0.24, size=12, bold=True, color=WHITE)
txt(s, "Run a controlled pilot on one inspection workflow, prove the output package is useful, then expand surface coverage and reporting depth from there.",
    0.75, 5.28, 11.6, 0.34, size=11, color=WHITE)

rect(s, 0.55, 6.18, 12.25, 0.82, TEAL_LT, TEAL_MID, 0.5)
txt(s, "Tank Inspection Copilot turns inspection work into structured inspection data that is easier to check, easier to hand over, and easier to reuse.",
    0.82, 6.43, 11.8, 0.26, size=11, bold=True, color=TEAL, align=PP_ALIGN.CENTER)

logo(s)


# ════════════════════════════════════════════════════════════════════════════════
#  SAVE
# ════════════════════════════════════════════════════════════════════════════════
prs.save(OUT)
print(f"✅  Saved → {OUT}")
