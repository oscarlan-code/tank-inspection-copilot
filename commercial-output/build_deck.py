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
OUT   = os.path.join(BASE, "Tank_Inspection_Copilot_BD_Deck.pptx")

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

txt(s, "TANK INSPECTION", 0.7, 1.6, 10, 0.9,  size=38, bold=True, color=DARK)
txt(s, "COPILOT",         0.7, 2.4, 10, 1.0,  size=52, bold=True, color=TEAL)
rule(s, 3.55, TEAL, left=0.7, w=9.0)

txt(s, "Field Capture  ·  Structured Data  ·  Report Generated",
    0.7, 3.72, 9, 0.5, size=15, color=MID, italic=True)

# 3U mission tagline
rect(s, 0.7, 4.4, 8.0, 0.7, TEAL_LT, TEAL_MID, 0.5)
txt(s, "LAIQ Mission — 3U:   Upskill People  ·  Uplift the Standard  ·  Uptime",
    0.88, 4.52, 7.6, 0.45, size=12, bold=True, color=TEAL)

txt(s, "Confidential  ·  April 2026",
    0.7, 6.95, 5, 0.35, size=9, color=MID)

logo(s)
phone(s, os.path.join(SHOTS, "05_taskboard.png"), left=9.8, top=0.6, height=6.1)


# ════════════════════════════════════════════════════════════════════════════════
#  SLIDE 2 — The Problem
# ════════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
bg(s, WHITE)
bar(s, AMBER, w=0.35)

kicker(s, "THE PROBLEM", AMBER)
heading(s, "Inspectors leave site with notes — not a report.")
rule(s, 1.38, AMBER, left=0.5, w=12.5)

# 4 stat cards
pain = [
    ("4–8 hrs",  "re-keying field notes\ninto every report", AMBER),
    ("1–3 days", "to write the report\nafter leaving site",  AMBER),
    ("0",        "structured records linking\nfindings to UT rows", RED),
    ("3 PDFs",   "shell + nozzle + MFL —\nnever unified",    AMBER),
]
for i, (stat, desc, acc) in enumerate(pain):
    stat_card(s, 0.5 + i * 3.22, 1.55, 3.05, 1.9, stat, desc, acc)

# Key pain points as bullets
txt(s, "Root cause", 0.5, 3.7, 3.0, 0.35, size=11, bold=True, color=AMBER)
rule(s, 4.1, AMBER, left=0.5, w=12.3)

pain_bullets = [
    ("Paper & clipboard",     "re-keying adds errors and delay"),
    ("Findings de-coupled",   "lost between field capture and final report"),
    ("Vague locations",       "prose descriptions cannot be trended across cycles"),
    ("Incompatible formats",  "every contractor submits a different template"),
    ("MFL in a silo",         "floor data never linked to shell or roof findings"),
    ("Report writing backlog","inspector bandwidth consumed by admin, not field work"),
]
for i, (label, body) in enumerate(pain_bullets):
    col, row = i % 2, i // 2
    lft = 0.5 + col * 6.4
    tp  = 4.18 + row * 0.52
    rect(s, lft, tp, 6.2, 0.47, OFFWHITE)
    txt(s, f"▸  {label}", lft + 0.12, tp + 0.07, 2.1, 0.36, size=10, bold=True, color=DARK)
    txt(s, body, lft + 2.3, tp + 0.07, 3.8, 0.36, size=10, color=MID)

# Root-cause callout
rect(s, 0.5, 5.78, 12.3, 0.52, TEAL_LT, TEAL, 0.8)
txt(s, "Field capture and report generation are two completely separate workflows — that is the gap.",
    0.65, 5.88, 12.0, 0.35, size=11, bold=True, color=TEAL, align=PP_ALIGN.CENTER)

logo(s)


# ════════════════════════════════════════════════════════════════════════════════
#  SLIDE 3 — Workflow (HERO)
# ════════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
bg(s, WHITE)
bar(s, TEAL, w=0.35)

kicker(s, "HOW IT WORKS", TEAL)
heading(s, "Data-First Reporting Architecture")
rule(s, 1.38, TEAL_MID, left=0.5, w=12.5)

txt(s, "Structured field capture driving automated, evidence-linked report generation",
    0.55, 1.45, 10, 0.35, size=11, color=MID)

# 3-column workflow cards
cols = [
    (WHITE,    TEAL,  "1. Field Data Capture",
     "Guided on-site capture via mobile app",
     ["Tank & surface setup",
      "Shell / roof / nozzle UT readings",
      "In-context finding capture",
      "Precise plate location (tap-on-canvas)",
      "Photo evidence — required before save"]),
    (TEAL_LT,  TEAL,  "2. Structured Data Model",
     "Every reading stored against its exact context",
     ["Asset hierarchy: Tank → Surface → Plate",
      "Location: strake, bearing, X/Y, grid ID",
      "Findings: type, severity, description",
      "Evidence: photo linked to UT row",
      "Validation: API 650/653 consistency checks"]),
    (WHITE,    TEAL,  "3. Generated Report",
     "Automated output — no re-keying",
     ["Shell / roof UT thickness tables",
      "Nozzle UT tables (clock positions)",
      "Findings register + linked photos",
      "Shell plate layout map",
      "JSON + CSV export for CMMS / digital twin"]),
]

for i, (bg_c, hdr_c, title, subtitle, bullets) in enumerate(cols):
    lft = 0.5 + i * 4.28
    cw  = 4.08
    rect(s, lft, 1.9, cw, 4.7, bg_c, TEAL_MID, 0.5)
    rect(s, lft, 1.9, cw, 0.06, hdr_c)
    txt(s, title,    lft + 0.2, 2.04, cw - 0.4, 0.45, size=13, bold=True, color=TEAL)
    txt(s, subtitle, lft + 0.2, 2.52, cw - 0.4, 0.35, size=10, color=MID, italic=True)
    rule(s, 2.95, TEAL_MID, left=lft + 0.2, w=cw - 0.4)
    for j, b in enumerate(bullets):
        txt(s, f"✓  {b}", lft + 0.2, 3.05 + j * 0.46, cw - 0.4, 0.42, size=11, color=DARK)

    if i < 2:
        txt(s, "→", lft + cw, 3.8, 0.28, 0.5, size=20, bold=True,
            color=TEAL_MID, align=PP_ALIGN.CENTER)

# Bottom summary
rule(s, 6.75, TEAL_MID, left=0.5, w=12.5)
txt(s, (
    "The inspector never writes a report from scratch. "
    "They capture structured data in the field — the report generates itself."
), 0.55, 6.82, 12.3, 0.5, size=12, bold=True, color=TEAL, align=PP_ALIGN.CENTER)

# 3U mission bar
rect(s, 0.5, 7.1, 12.3, 0.28, TEAL, TEAL, 0)
txt(s, "LAIQ 3U Mission:   Upskill People   ·   Uplift the Standard   ·   Uptime",
    0.55, 7.14, 12.2, 0.22, size=9, bold=True, color=WHITE, align=PP_ALIGN.CENTER)

logo(s)


# ════════════════════════════════════════════════════════════════════════════════
#  SLIDE 4 — Guided Workflow
# ════════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
bg(s, WHITE)
bar(s, TEAL, w=0.35)

kicker(s, "FIELD CAPTURE  ·  STEP 1", TEAL)
heading(s, "Guided Task-Driven Workflow")
rule(s, 1.38, TEAL_MID, left=0.5, w=12.5)

txt(s, "The inspector configures the tank once, selects in-scope tasks, then works through a live Task Board.",
    0.55, 1.47, 7.0, 0.42, size=11, color=MID)

txt_bullets(s, [
    ("Configure once", "tank geometry drives all report header fields"),
    ("Scope selection", "defines which UT tables appear in the report"),
    ("Live Task Board", "shows completion — nothing is missed"),
    ("Draft save / resume", "works across sessions, no data lost"),
], left=0.55, top=2.05, w=6.8, size=12, color=DARK, label_color=TEAL, gap=0.48)

phone(s, os.path.join(SHOTS, "01_home.png"),        left=7.3,  top=0.75, height=5.8)
phone(s, os.path.join(SHOTS, "03_setup_filled.png"), left=10.1, top=0.75, height=5.8)

logo(s)


# ════════════════════════════════════════════════════════════════════════════════
#  SLIDE 5 — UT Data Capture
# ════════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
bg(s, WHITE)
bar(s, TEAL, w=0.35)

kicker(s, "FIELD CAPTURE  ·  STEP 2", TEAL)
heading(s, "Structured UT Data Capture")
rule(s, 1.38, TEAL_MID, left=0.5, w=12.5)

txt(s, "Every UT reading tagged to its exact surface, course, and position — feeds report tables directly.",
    0.55, 1.47, 6.8, 0.42, size=11, color=MID)

rows = [
    ("Surface",        "Entry method",                    "Report section"),
    ("Shell UT",       "Strake × N/E/S/W × 5 readings",  "Shell Plate Thickness Table"),
    ("Roof UT",        "Plate × A–E readings",            "Roof Plate Thickness Table"),
    ("Shell Nozzles",  "12 / 3 / 6 / 9 o'clock + pad",   "Shell Nozzle Thickness Table"),
    ("Roof Nozzles",   "N / E / S / W + pad",             "Roof Nozzle Thickness Table"),
    ("Bottom MFL",     "Import contractor report",        "MFL section (attachment)"),
]
col_w  = [1.5, 2.4, 2.0]
col_lf = [0.65, 2.25, 4.75]
for i, row in enumerate(rows):
    is_hdr = (i == 0)
    bg_c = TEAL if is_hdr else (OFFWHITE if i % 2 == 0 else WHITE)
    lc   = TEAL_MID if not is_hdr else None
    rect(s, 0.55, 2.08 + i * 0.48, 6.1, 0.48, bg_c,
         None if is_hdr else TEAL_MID, 0.3)
    for cell, lf, cw in zip(row, col_lf, col_w):
        fc = WHITE if is_hdr else (DARK if i % 2 == 0 else MID)
        txt(s, cell, lf, 2.15 + i * 0.48, cw, 0.36,
            size=10, bold=is_hdr, color=fc)

phone(s, os.path.join(SHOTS, "07_shellut_readings.png"), left=7.3,  top=0.75, height=5.8)
phone(s, os.path.join(SHOTS, "11_roof_ut.png"),           left=10.1, top=0.75, height=5.8)

logo(s)


# ════════════════════════════════════════════════════════════════════════════════
#  SLIDE 6 — In-Context Finding Capture
# ════════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
bg(s, WHITE)
bar(s, AMBER, w=0.35)

kicker(s, "FIELD CAPTURE  ·  STEP 3", AMBER)
heading(s, "In-Context Finding Capture")
rule(s, 1.38, AMBER, left=0.5, w=12.5)

txt(s, "Tap 'Add Finding Here' mid-task — strake, bearing & UT context pre-filled automatically.",
    0.55, 1.47, 8.0, 0.42, size=11, color=MID)

steps = [
    (TEAL,  "Photo",           "Take photo → auto-linked to active UT row"),
    (TEAL,  "Annotate",        "Draw arrow, circle, or text on photo"),
    (TEAL,  "Type & severity", "Crack / Corrosion / Deformation / etc."),
    (TEAL,  "Location",        "Strake + bearing auto-filled from context"),
    (TEAL,  "Measurements",    "Pit depth, crack length, or custom field"),
    (AMBER, "Report entry",    "Finding + photo + location → report ready"),
]
for i, (color, label, desc) in enumerate(steps):
    tp = 2.05 + i * 0.48
    rect(s, 0.55, tp, 0.38, 0.42, color)
    txt(s, str(i + 1), 0.55, tp + 0.04, 0.38, 0.34,
        size=12, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    txt(s, label, 1.05, tp + 0.06, 1.6, 0.34, size=11, bold=True, color=DARK)
    txt(s, desc,  2.75, tp + 0.06, 4.1, 0.34, size=11, color=MID)

phone(s, os.path.join(SHOTS, "08_shell_finding.png"), left=9.7, top=0.75, height=5.8)

logo(s)


# ════════════════════════════════════════════════════════════════════════════════
#  SLIDE 7 — Precise Shell Location
# ════════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
bg(s, WHITE)
bar(s, TEAL, w=0.35)

kicker(s, "FIELD CAPTURE  ·  STEP 4", TEAL)
heading(s, "Precise Shell Location Mapping")
rule(s, 1.38, TEAL_MID, left=0.5, w=12.5)

txt(s, "Tap-on-canvas unwrapped shell map → repeatable plate coordinate stored in report.",
    0.55, 1.47, 6.8, 0.42, size=11, color=MID)

txt_bullets(s, [
    ("Plate geometry", "configured once per inspection"),
    ("Tap-to-mark",    "SVG unwrapped shell canvas"),
    ("Manual fallback","X/Y or plate/seam reference also supported"),
    ("Coordinate →",   "Shell Plate Layout section in report"),
], left=0.55, top=2.05, w=6.6, size=12, color=DARK, label_color=TEAL, gap=0.48)

rect(s, 0.55, 4.15, 6.6, 1.4, TEAL_LT, TEAL_MID, 0.5)
txt(s, "Why this matters", 0.72, 4.24, 6.2, 0.35, size=11, bold=True, color=TEAL)
txt(s, (
    "Most reports record location as prose: \"near the third strake, north side.\" "
    "That cannot be mapped, trended, or returned to. A precise coordinate can."
), 0.72, 4.62, 6.2, 0.85, size=11, color=DARK)

phone(s, os.path.join(SHOTS, "09_shell_layout_setup.png"), left=7.3,  top=0.75, height=5.8)
phone(s, os.path.join(SHOTS, "10b_shell_map_marked.png"),  left=10.1, top=0.75, height=5.8)

logo(s)


# ════════════════════════════════════════════════════════════════════════════════
#  SLIDE 8 — Pre-Export Review
# ════════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
bg(s, WHITE)
bar(s, TEAL, w=0.35)

kicker(s, "FIELD CAPTURE  ·  STEP 5", TEAL)
heading(s, "Pre-Export Review — Completeness Check")
rule(s, 1.38, TEAL_MID, left=0.5, w=12.5)

txt(s, "Gaps surfaced on-site while the inspector can still fix them — not discovered during report writing.",
    0.55, 1.47, 8.0, 0.42, size=11, color=MID)

checks = [
    (TEAL,  "Pass",    "All shell readings complete"),
    (TEAL,  "Pass",    "All in-scope nozzles measured"),
    (AMBER, "Warning", "2 findings missing photo evidence"),
    (AMBER, "Warning", "Roof UT: 3 plates not yet entered"),
    (TEAL,  "Pass",    "MFL report attached"),
    (NAVY,  "Info",    "Precise location pending for 1 finding"),
]
for i, (color, status, msg) in enumerate(checks):
    tp = 2.05 + i * 0.55
    rect(s, 0.55, tp, 6.6, 0.49, OFFWHITE, TEAL_MID, 0.3)
    rect(s, 0.55, tp, 0.07, 0.49, color)
    txt(s, status, 0.75,  tp + 0.1, 0.95, 0.32, size=10, bold=True, color=color)
    txt(s, msg,    1.85, tp + 0.1, 5.2,  0.32, size=11, color=DARK)

rect(s, 0.55, 5.43, 6.6, 0.5, TEAL_LT, TEAL, 0.7)
txt(s, "Fix on site = no surprises during report generation.",
    0.72, 5.53, 6.3, 0.3, size=11, bold=True, color=TEAL)

phone(s, os.path.join(SHOTS, "12_review.png"), left=9.7, top=0.75, height=5.8)

logo(s)


# ════════════════════════════════════════════════════════════════════════════════
#  SLIDE 9 — Report Output
# ════════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
bg(s, WHITE)
bar(s, TEAL, w=0.35)

kicker(s, "REPORT OUTPUT", TEAL)
heading(s, "Structured Export — Report Ready")
rule(s, 1.38, TEAL_MID, left=0.5, w=12.5)

txt(s, "Every field captures maps directly to a report section.  No re-keying.  No reconstruction from memory.",
    0.55, 1.47, 12.3, 0.42, size=11, color=MID)

sections = [
    ("Report Section",              "Source in App",                        "Format"),
    ("Tank / Client Header",        "Inspection Setup fields",              "JSON"),
    ("Shell Plate Thickness Table", "Shell UT (strake × bearing)",          "CSV + JSON"),
    ("Roof Plate Thickness Table",  "Roof UT (plate × A–E)",                "CSV + JSON"),
    ("Shell Nozzle UT Table",       "Shell nozzle (12/3/6/9)",              "CSV + JSON"),
    ("Roof Nozzle UT Table",        "Roof nozzle (N/E/S/W)",                "CSV + JSON"),
    ("Findings Register",           "Type, severity, location, photo",      "JSON"),
    ("Shell Plate Layout",          "Precise shell coordinates",            "JSON"),
    ("MFL Section",                 "Contractor, reference, coverage",      "JSON + attachment"),
]
col_w  = [3.6, 4.6, 1.6]
col_lf = [0.65, 4.35, 9.05]
for i, row in enumerate(sections):
    is_hdr = (i == 0)
    bg_c = TEAL if is_hdr else (OFFWHITE if i % 2 == 0 else WHITE)
    rect(s, 0.55, 2.0 + i * 0.46, 10.1, 0.46, bg_c, None if is_hdr else TEAL_MID, 0.3)
    for cell, lf, cw in zip(row, col_lf, col_w):
        fc = WHITE if is_hdr else (DARK if i % 2 == 0 else MID)
        txt(s, cell, lf, 2.07 + i * 0.46, cw, 0.34,
            size=10, bold=is_hdr, color=fc)

phone(s, os.path.join(SHOTS, "13_export.png"), left=11.0, top=0.75, height=5.8)

logo(s)


# ════════════════════════════════════════════════════════════════════════════════
#  SLIDE 10 — Why Now / Who Buys
# ════════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
bg(s, WHITE)
bar(s, AMBER, w=0.35)

kicker(s, "MARKET CONTEXT", AMBER)
heading(s, "Why Now — and Who Buys")
rule(s, 1.38, AMBER, left=0.5, w=12.5)

tailwinds = [
    ("API 653 scrutiny tightening",
     ["Regulators want structured finding evidence", "Traceability across cycles — PDFs not sufficient"]),
    ("Inspection workforce attrition",
     ["Experienced inspectors are retiring", "Guided tools encode good practice into the workflow"]),
    ("CMMS & digital twin demand",
     ["Asset platforms need structured inspection data", "Most data still arrives as PDFs — that gap is the opportunity"]),
    ("Mobile hardware is ready",
     ["Rugged tablets / IP67 phones are now field standard", "Only barrier left: a workflow that matched the field"]),
]
for i, (h, bullets) in enumerate(tailwinds):
    col, row = i % 2, i // 2
    lft = 0.55 + col * 6.45
    tp  = 1.55 + row * 2.0
    rect(s, lft, tp, 6.2, 1.78, OFFWHITE, TEAL_MID, 0.5)
    rect(s, lft, tp, 0.07, 1.78, AMBER)
    txt(s, h, lft + 0.25, tp + 0.12, 5.8, 0.38, size=13, bold=True, color=DARK)
    for j, b in enumerate(bullets):
        txt(s, f"▸  {b}", lft + 0.25, tp + 0.6 + j * 0.44, 5.8, 0.38, size=11, color=MID)

# Who buys
rect(s, 0.55, 5.6, 12.3, 1.65, TEAL_LT, TEAL_MID, 0.5)
txt(s, "Who buys", 0.72, 5.68, 3.0, 0.35, size=12, bold=True, color=TEAL)
segments = [
    ("Independent inspection companies", "Reduce report turnaround  ·  Differentiate on data quality"),
    ("Oil & gas operators",              "Standardise across sites  ·  Enable trend analysis"),
    ("Inspection consultancies",         "Replace bespoke Excel templates with a supported product"),
    ("Certification bodies",             "Audit-ready traceability  ·  Structured finding evidence"),
]
for i, (seg, why) in enumerate(segments):
    col, row = i % 2, i // 2
    lft = 0.72 + col * 6.2
    tp  = 6.1 + row * 0.48
    txt(s, f"▸  {seg}", lft, tp, 2.9, 0.4, size=11, bold=True, color=DARK)
    txt(s, why, lft + 3.05, tp, 3.0, 0.4, size=10, color=MID)

logo(s)


# ════════════════════════════════════════════════════════════════════════════════
#  SLIDE 11 — CTA
# ════════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
bg(s, WHITE)
bar(s, TEAL,    w=0.35)
bar(s, TEAL_LT, left=0.35, w=0.15)

kicker(s, "LET'S TALK", TEAL)
heading(s, "Four questions to start the conversation")
rule(s, 1.38, TEAL_MID, left=0.5, w=12.5)

questions = [
    ("Q1", "How many hours does your team spend writing the report after leaving site?",
     "Every hour saved on report writing is an hour back in the field or billable on the next job."),
    ("Q2", "Can you tell me exactly where that corrosion indication was in your 2021 inspection?",
     "Precise, repeatable coordinates make cross-cycle trending possible.  Prose descriptions don't."),
    ("Q3", "How many Excel templates do your inspection contractors submit — and how long to normalise them?",
     "One structured export format from every inspection = no normalisation before analysis."),
    ("Q4", "When your best inspector retires, where does their inspection knowledge live?",
     "A guided workflow encodes good practice into the tool — not just the person holding the clipboard."),
]
for i, (label, q, insight) in enumerate(questions):
    tp = 1.55 + i * 1.32
    rect(s, 0.55, tp, 12.3, 1.22, OFFWHITE, TEAL_MID, 0.3)
    rect(s, 0.55, tp, 0.07, 1.22, TEAL)
    txt(s, label,   0.75, tp + 0.1,  0.55, 0.42, size=14, bold=True, color=TEAL)
    txt(s, q,       1.4,  tp + 0.08, 10.9, 0.46, size=13, bold=True, color=DARK)
    txt(s, insight, 1.4,  tp + 0.6,  10.9, 0.5,  size=11, color=MID, italic=True)

# 3U footer
rect(s, 0.55, 6.88, 12.3, 0.42, TEAL)
txt(s, "LAIQ  ·  Upskill People   ·   Uplift the Standard   ·   Uptime   ·   Tank Inspection Copilot",
    0.72, 6.96, 12.0, 0.3, size=10, bold=True, color=WHITE, align=PP_ALIGN.CENTER)

logo(s)


# ════════════════════════════════════════════════════════════════════════════════
#  SAVE
# ════════════════════════════════════════════════════════════════════════════════
prs.save(OUT)
print(f"✅  Saved → {OUT}")
