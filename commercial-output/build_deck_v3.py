"""
Tank Inspection Copilot — Commercial BD Deck V3 (Beautified)
LAIQ brand: white bg · #075F5C teal · Arial · LAIQ logo
Slide 3: proper oil-tank cross-section architecture diagram
"""
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.oxml.ns import qn
from lxml import etree
import os

BASE  = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(BASE, "screenshots")
LOGO  = os.path.join(BASE, "laiq_logo.png")
OUT   = os.path.join(BASE, "Tank_Inspection_Copilot_BD_Deck_V3.pptx")
REPORT_SAMPLE = os.path.join(SHOTS, "report_sample_shell_table.png")
PDA_IMG = os.path.join(BASE, "atex_pda_mockup.png")

# ── Palette ───────────────────────────────────────────────────────────────────
TEAL     = RGBColor(0x07, 0x5F, 0x5C)
TEAL_LT  = RGBColor(0xDC, 0xEF, 0xE9)
TEAL_MID = RGBColor(0xB2, 0xCC, 0xC7)
TEAL_DIM = RGBColor(0x8A, 0xAA, 0xA5)
NAVY     = RGBColor(0x1A, 0x3C, 0x6E)
WHITE    = RGBColor(0xFF, 0xFF, 0xFF)
OFFWHITE = RGBColor(0xF4, 0xF7, 0xF6)
DARK     = RGBColor(0x17, 0x20, 0x1E)
MID      = RGBColor(0x52, 0x62, 0x5E)
PALE     = RGBColor(0xA8, 0xB8, 0xB4)
RED      = RGBColor(0xCC, 0x23, 0x23)
AMBER    = RGBColor(0xE6, 0x7E, 0x22)
AMBER_LT = RGBColor(0xFD, 0xF0, 0xE0)
SHADOW   = RGBColor(0xC5, 0xD5, 0xD0)

W = Inches(13.33)
H = Inches(7.5)

prs = Presentation()
prs.slide_width  = W
prs.slide_height = H
BLANK = prs.slide_layouts[6]

FONT = "Arial"

# ── Primitive helpers ─────────────────────────────────────────────────────────

def _shape(slide, mso_type, left, top, w, h):
    return slide.shapes.add_shape(mso_type,
        Inches(left), Inches(top), Inches(w), Inches(h))

def rect(slide, left, top, w, h, color=None, line_color=None, line_w=0.75):
    sh = _shape(slide, 1, left, top, w, h)   # MSO_SHAPE_TYPE.RECTANGLE = 1
    sh.fill.solid() if color else sh.fill.background()
    if color: sh.fill.fore_color.rgb = color
    if line_color:
        sh.line.color.rgb  = line_color
        sh.line.width      = Pt(line_w)
    else:
        sh.line.fill.background()
    return sh

def ellipse(slide, left, top, w, h, color=None, line_color=None, line_w=1.0):
    sh = _shape(slide, 9, left, top, w, h)   # MSO_SHAPE_TYPE.OVAL = 9
    sh.fill.solid() if color else sh.fill.background()
    if color: sh.fill.fore_color.rgb = color
    if line_color:
        sh.line.color.rgb = line_color
        sh.line.width     = Pt(line_w)
    else:
        sh.line.fill.background()
    return sh

def shadow_rect(slide, left, top, w, h, color=OFFWHITE, line_color=TEAL_MID,
                line_w=0.6, shadow_color=SHADOW):
    """Card with a subtle drop shadow."""
    rect(slide, left + 0.07, top + 0.07, w, h, shadow_color)
    return rect(slide, left, top, w, h, color, line_color, line_w)

def txt(slide, text, left, top, w, h,
        size=12, bold=False, color=DARK,
        align=PP_ALIGN.LEFT, wrap=True, italic=False):
    txb = slide.shapes.add_textbox(
        Inches(left), Inches(top), Inches(w), Inches(h))
    txb.word_wrap = wrap
    tf = txb.text_frame
    tf.word_wrap = wrap
    p  = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = text
    run.font.name    = FONT
    run.font.size    = Pt(size)
    run.font.bold    = bold
    run.font.italic  = italic
    run.font.color.rgb = color
    return txb

def txt2(slide, pairs, left, top, w, h, size=11, gap=0, align=PP_ALIGN.LEFT):
    """Multi-run paragraph: pairs = [(text, bold, color), ...]"""
    txb = slide.shapes.add_textbox(
        Inches(left), Inches(top), Inches(w), Inches(h))
    txb.word_wrap = True
    tf = txb.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = align
    for text, bold, color in pairs:
        r = p.add_run()
        r.text = text
        r.font.name  = FONT
        r.font.size  = Pt(size)
        r.font.bold  = bold
        r.font.color.rgb = color
    return txb

def bullets(slide, items, left, top, w, size=11, color=DARK,
            accent=TEAL, gap=0.43, dot="▸"):
    """Render list. items = str | (bold_label, body_str). Returns bottom y."""
    for i, item in enumerate(items):
        tp = top + i * gap
        if isinstance(item, tuple):
            lbl, body = item
            txt2(slide, [
                (lbl + "  ", True,  accent),
                (body,       False, color),
            ], left, tp, w, gap, size=size)
        else:
            txt(slide, f"{dot}  {item}", left, tp, w, gap, size=size, color=color)
    return top + len(items) * gap

# ── Layout helpers ────────────────────────────────────────────────────────────

def bg(slide, color=WHITE):
    fill = slide.background.fill
    fill.solid()
    fill.fore_color.rgb = color

def left_bar(slide, accent=TEAL):
    rect(slide, 0,    0, 0.45, 7.5, accent)
    rect(slide, 0.45, 0, 0.12, 7.5, TEAL_LT)

def header(slide, kicker_text, title_text, accent=TEAL,
           kicker_color=None, rule_color=TEAL_MID):
    kc = kicker_color or accent
    txt(slide, kicker_text, 0.72, 0.28, 10, 0.26,
        size=9, bold=True, color=kc)
    txt(slide, title_text,  0.72, 0.52, 12.1, 0.76,
        size=27, bold=True, color=TEAL)
    rect(slide, 0.72, 1.35, 12.18, 0.04, rule_color)

def footer(slide, page_label=""):
    rect(slide, 0.72, 7.18, 12.18, 0.04, TEAL_MID)
    if page_label:
        txt(slide, page_label, 0.72, 7.23, 5, 0.22, size=8, color=PALE)
    logo_h = 0.28
    logo_w = logo_h * (930 / 430)
    if os.path.exists(LOGO):
        slide.shapes.add_picture(LOGO,
            Inches(13.33 - 0.2 - logo_w), Inches(7.5 - 0.06 - logo_h),
            width=Inches(logo_w), height=Inches(logo_h))

def phone(slide, img_path, left, top, height=5.7):
    if not os.path.exists(img_path): return
    pw = height * 0.463
    # shadow
    rect(slide, left + 0.09, top + 0.09, pw, height, SHADOW)
    # bezel
    rect(slide, left,         top,        pw, height, WHITE, TEAL_MID, 0.75)
    # notch hint
    rect(slide, left + pw*0.3, top + 0.04, pw*0.4, 0.06, TEAL_MID)
    # screen
    slide.shapes.add_picture(img_path,
        Inches(left + 0.05), Inches(top + 0.12),
        width=Inches(pw - 0.10), height=Inches(height - 0.22))

def stat_card(slide, left, top, w, h, stat, label, accent=TEAL):
    shadow_rect(slide, left, top, w, h)
    rect(slide, left, top, w, 0.07, accent)
    txt(slide, stat,  left+0.16, top+0.14, w-0.32, 0.65,
        size=30, bold=True, color=accent)
    txt(slide, label, left+0.16, top+0.82, w-0.32, 0.84,
        size=9.5, color=MID, wrap=True)

def step_circle(slide, num, cx, cy, r=0.28, fill=TEAL):
    """Draw a filled circle with a number label."""
    ellipse(slide, cx - r, cy - r, 2*r, 2*r, fill)
    txt(slide, str(num), cx - r, cy - r*0.88, 2*r, 2*r*0.9,
        size=11, bold=True, color=WHITE, align=PP_ALIGN.CENTER)

def arrow_right(slide, cx, cy, color=TEAL_MID):
    txt(slide, "›", cx - 0.18, cy - 0.24, 0.36, 0.48,
        size=24, bold=True, color=color, align=PP_ALIGN.CENTER)


# ═════════════════════════════════════════════════════════════════════════════
#  S1 — COVER
# ═════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
bg(s, WHITE)

# Left teal panel (40% width)
rect(s, 0, 0, 5.33, 7.5, TEAL)
rect(s, 5.33, 0, 0.1, 7.5, TEAL_LT)

# LAIQ logo (white version — draw text since logo has white bg)
logo_h = 0.30
logo_w = logo_h * (930/430)
if os.path.exists(LOGO):
    s.shapes.add_picture(LOGO,
        Inches(0.42), Inches(0.3),
        width=Inches(logo_w), height=Inches(logo_h))

# Product name — spans the panel
txt(s, "TANK INSPECTION", 0.55, 1.75, 4.5, 0.85, size=34, bold=True, color=TEAL_LT)
txt(s, "COPILOT",         0.55, 2.52, 4.5, 1.05, size=50, bold=True, color=WHITE)
rect(s, 0.55, 3.68, 3.8, 0.05, TEAL_LT)

txt(s, "Field inspection → Structured data → Report package",
    0.55, 3.82, 4.5, 0.42, size=12, color=TEAL_LT, italic=True)

# 3U mission badge
rect(s, 0.55, 4.42, 4.5, 0.95, None, TEAL_LT, 1.0)
txt(s, "LAIQ 3U MISSION", 0.78, 4.52, 4.0, 0.28, size=8, bold=True, color=TEAL_LT)
txt(s, "Upskill People  ·  Uplift the Standard  ·  Uptime",
    0.68, 4.82, 4.3, 0.42, size=10.5, bold=True, color=WHITE, align=PP_ALIGN.CENTER)

txt(s, "Commercial Deck V3  ·  April 2026",
    0.55, 7.06, 4.0, 0.28, size=8, color=TEAL_LT)

# Right panel — phone mockup
phone(s, os.path.join(SHOTS, "05_taskboard.png"), left=5.82, top=0.48, height=6.52)

# Tagline right panel
rect(s, 9.58, 1.12, 3.42, 1.65, OFFWHITE, TEAL_MID, 0.5)
txt(s, "Capture readings, findings,\nphotos, and location in one\nguided field flow.",
    9.75, 1.25, 3.08, 1.38, size=11, color=DARK, wrap=True)
rect(s, 9.58, 2.88, 3.42, 0.78, TEAL_LT, TEAL_MID, 0.5)
txt(s, "Leave site with a\nreport-ready output package.",
    9.75, 2.98, 3.1, 0.55, size=11, bold=True, color=TEAL, wrap=True)


# ═════════════════════════════════════════════════════════════════════════════
#  S2 — PROBLEM: current workflow
# ═════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
bg(s, WHITE)
left_bar(s, AMBER)
header(s, "THE PROBLEM",
       "Today's inspection workflow has a broken handoff",
       accent=AMBER, rule_color=AMBER)

txt(s, "Field data and the report are generated in two separate, disconnected workflows.",
    0.72, 1.45, 11.2, 0.36, size=11, color=MID)

# 6-step horizontal workflow
steps = [
    ("Field inspection", "UT readings, notes, photos"),
    ("Separate records", "Notebook + phone photos + Excel"),
    ("Back-office re-keying", "Transfer into report tables"),
    ("Rebuild context", "Match photos, findings, locations"),
    ("Merge MFL separately", "Contractor PDF handled outside"),
    ("Final report & QA", "Gaps found after leaving site"),
]
for i, (title, body) in enumerate(steps):
    lft = 0.72 + i * 2.08
    shadow_rect(s, lft, 1.95, 1.9, 1.48, OFFWHITE)
    rect(s,       lft, 1.95, 1.9, 0.07, AMBER)
    step_circle(s, i+1, lft + 0.24, 2.36, r=0.22, fill=AMBER)
    txt(s, title, lft + 0.52, 2.14, 1.24, 0.48, size=10, bold=True, color=DARK, wrap=True)
    txt(s, body,  lft + 0.12, 2.75, 1.66, 0.56, size=9,  color=MID,  wrap=True)
    if i < 5:
        arrow_right(s, lft + 1.99, 2.68, AMBER)

# Pain points — 2×2 grid
txt(s, "Where the workflow breaks", 0.72, 3.68, 4, 0.3, size=11, bold=True, color=AMBER)
rect(s, 0.72, 4.03, 12.18, 0.04, TEAL_MID)

issues = [
    ("Duplicate entry",          "Same reading captured in the field, then typed again in the report."),
    ("Broken evidence links",    "Findings, photos, and UT rows are not connected when observed."),
    ("Weak location traceability","Prose descriptions cannot be trended or returned to next cycle."),
    ("Fragmented deliverables",  "Shell, nozzles, and MFL often end up as separate, unlinked outputs."),
]
for i, (h, b) in enumerate(issues):
    col, row = i % 2, i // 2
    lft = 0.72 + col * 6.22
    tp  = 4.15 + row * 0.88
    shadow_rect(s, lft, tp, 5.95, 0.72, WHITE)
    rect(s, lft, tp, 0.06, 0.72, AMBER)
    txt(s, h, lft+0.22, tp+0.1,  1.95, 0.24, size=10.5, bold=True, color=DARK)
    txt(s, b, lft+2.18, tp+0.1,  3.58, 0.44, size=9.5,  color=MID,  wrap=True)

rect(s, 0.72, 6.08, 12.18, 0.52, TEAL_LT, TEAL, 0.8)
txt(s, "Field capture and report generation are still two separate workflows — that gap is the commercial opportunity.",
    0.88, 6.20, 11.88, 0.3, size=10.5, bold=True, color=TEAL, align=PP_ALIGN.CENTER)

footer(s, "Current State  ·  S2")


# ═════════════════════════════════════════════════════════════════════════════
#  S3 — ARCHITECTURE: oil-tank diagram + 3-column flow
# ═════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
bg(s, WHITE)
left_bar(s, TEAL)
header(s, "ARCHITECTURE",
       "Data-first reporting: from tank surfaces to structured output")

txt(s, "One guided field workflow captures every surface. A canonical inspection record drives automated report assembly.",
    0.72, 1.45, 11.5, 0.36, size=11, color=MID)

# ── Tank cross-section diagram ─────────────────────────────────────────────
# drawn at left side: ~2.8in wide, centred vertically in the slide

TX  = 0.75   # tank left edge
TY  = 1.98   # tank top
TW  = 2.55   # tank width
TH  = 3.90   # shell body height
EH  = 0.48   # ellipse cap height

# Bottom shadow
ellipse(s, TX+0.06, TY + TH - EH/2 + 0.06, TW, EH, SHADOW)
rect(s, TX+0.06, TY + EH/2 + 0.06, TW, TH - EH, SHADOW)

# Shell body
rect(s, TX, TY + EH/2, TW, TH - EH, TEAL_LT, TEAL, 1.5)
# Bottom cap
ellipse(s, TX, TY + TH - EH/2, TW, EH, TEAL_LT, TEAL, 1.5)
# Roof cap (on top)
ellipse(s, TX, TY,              TW, EH, TEAL,    TEAL, 1.5)

# Internal strake lines (shell courses)
for fi in [1, 2, 3]:
    fy = TY + EH/2 + fi * (TH - EH) / 4
    rect(s, TX, fy, TW, 0.025, TEAL_MID)

# Nozzles (left side)
for ni, ny_frac in [(1, 0.25), (2, 0.60)]:
    ny = TY + EH/2 + ny_frac * (TH - EH)
    rect(s, TX - 0.38, ny - 0.08, 0.38, 0.18, TEAL, TEAL, 0)
    rect(s, TX - 0.38, ny - 0.08, 0.38, 0.18, None, WHITE, 0.5)

# Roof nozzle (top)
rect(s, TX + TW/2 - 0.08, TY - 0.28, 0.18, 0.3, TEAL, TEAL, 0)

# Annular ring (base)
ellipse(s, TX - 0.08, TY + TH - EH/2 + EH*0.6, TW + 0.16, EH * 0.5, TEAL_MID, TEAL_DIM, 0.75)

# Labels pointing to tank zones
label_cfg = [
    (TX + TW + 0.12, TY + 0.18,                 "Roof",        "Roof UT plates\n(A–E readings)"),
    (TX + TW + 0.12, TY + EH/2 + (TH-EH)*0.12,  "Shell",       "Strake × N/E/S/W\n× 5 UT readings"),
    (TX + TW + 0.12, TY + EH/2 + (TH-EH)*0.52,  "Nozzles",     "12/3/6/9 clock\n+ pad readings"),
    (TX + TW + 0.12, TY + TH - 0.15,             "Annular",     "Base ring zone\nMFL reference"),
    (TX - 0.92,      TY + EH/2 + (TH-EH)*0.35,  "Shell",       "Nozzle positions\nN/E/S/W clock"),
]
for lx, ly, lbl, detail in label_cfg:
    txt(s, lbl,    lx, ly - 0.02, 1.2, 0.26, size=9.5, bold=True, color=TEAL)
    txt(s, detail, lx, ly + 0.24, 1.2, 0.42, size=8.5, color=MID,  wrap=True)

# Bottom label — MFL
txt(s, "Bottom / MFL",   TX + 0.3, TY + TH + 0.15,       1.6, 0.24, size=9.5, bold=True, color=TEAL)
txt(s, "Import MFL metadata\nand attachment ref", TX + 0.3, TY + TH + 0.38, 1.6, 0.40, size=8.5, color=MID, wrap=True)

# Big arrow from tank to first column card
arrow_right(s, 3.72, 3.68)

# ── 3-column architecture flow ─────────────────────────────────────────────
COL_X = [3.95, 7.0, 10.05]
COL_W = 2.85
COL_Y = 1.95
COL_H = 4.9

col_data = [
    (TEAL,    "1  Field Capture",
     "Guided on-site workflow",
     ["Tank & surface configuration",
      "UT rows: shell, roof, nozzle",
      "In-context finding capture",
      "Photo evidence linked at source",
      "Coarse or precise location"]),
    (TEAL_LT, "2  Inspection Record",
     "Canonical structured data",
     ["Asset hierarchy: Tank→Surface→Plate",
      "Location: strake, bearing, X/Y",
      "Findings: type, severity, evidence",
      "MFL source metadata & attachment",
      "Completeness & API 653 checks"]),
    (TEAL,    "3  Report Package",
     "Automated output assembly",
     ["Shell / roof UT tables (auto-filled)",
      "Findings register + linked photos",
      "Shell plate layout map",
      "MFL section with reference",
      "JSON + CSV export for CMMS"]),
]

for i, (hdr_fill, title, subtitle, blist) in enumerate(col_data):
    lft = COL_X[i]
    is_dark = (hdr_fill == TEAL)
    shadow_rect(s, lft, COL_Y, COL_W, COL_H, OFFWHITE if not is_dark else WHITE)
    rect(s, lft, COL_Y, COL_W, 0.62, hdr_fill)
    txt(s, title,    lft+0.18, COL_Y+0.08, COL_W-0.36, 0.32,
        size=11.5, bold=True, color=WHITE if is_dark else TEAL)
    txt(s, subtitle, lft+0.18, COL_Y+0.40, COL_W-0.36, 0.22,
        size=8.5, color=TEAL_LT if is_dark else MID, italic=True)

    for j, b in enumerate(blist):
        txt(s, f"•  {b}", lft+0.18, COL_Y+0.78+j*0.46, COL_W-0.36, 0.38,
            size=9.8, color=DARK)

    if i < 2:
        arrow_right(s, lft + COL_W + 0.015, COL_Y + COL_H/2)

# Bottom bar
rect(s, 0.72, 7.00, 12.18, 0.14, TEAL)
txt(s, "LAIQ 3U  ·  Upskill People   ·   Uplift the Standard   ·   Uptime",
    0.72, 7.01, 12.18, 0.12, size=9, bold=True, color=WHITE, align=PP_ALIGN.CENTER)

footer(s, "Architecture  ·  S3")


# ═════════════════════════════════════════════════════════════════════════════
#  S4 — FIELD CAPTURE: guided workflow
# ═════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
bg(s, WHITE)
left_bar(s, TEAL)
header(s, "FIELD CAPTURE  ·  STEP 1",
       "Guided task-driven workflow")

txt(s, "Configure the tank once. Select in-scope surfaces. Work from a live Task Board that tracks completion.",
    0.72, 1.45, 6.95, 0.42, size=11, color=MID)

bullets(s, [
    ("Configure once",     "tank geometry and references drive all later tasks"),
    ("Scope selection",    "only surfaces in scope appear in the workflow"),
    ("Live Task Board",    "progress, warnings, and completion counts at a glance"),
    ("Draft save/resume",  "supports real-world field interruptions"),
], left=0.72, top=2.02, w=6.8, size=11.5, accent=TEAL)

# Key message card
shadow_rect(s, 0.72, 4.32, 6.8, 0.96, TEAL_LT)
rect(s, 0.72, 4.32, 0.07, 0.96, TEAL)
txt(s, "No second entry.", 0.92, 4.45, 6.42, 0.28, size=12.5, bold=True, color=TEAL)
txt(s, "Everything captured in the Task Board flows directly into the report output — no manual transfer required.",
    0.92, 4.76, 6.38, 0.44, size=10.5, color=DARK, wrap=True)

phone(s, os.path.join(SHOTS, "03_setup_filled.png"), left=7.55, top=0.75, height=5.95)
phone(s, os.path.join(SHOTS, "05_taskboard.png"),    left=10.4, top=0.75, height=5.95)

footer(s, "Field Capture Step 1  ·  S4")


# ═════════════════════════════════════════════════════════════════════════════
#  S5 — FIELD CAPTURE: UT data capture
# ═════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
bg(s, WHITE)
left_bar(s, TEAL)
header(s, "FIELD CAPTURE  ·  STEP 2",
       "Structured UT data capture")

txt(s, "Each surface task captures readings in exactly the structure the report needs. Nothing is re-entered.",
    0.72, 1.45, 6.7, 0.36, size=11, color=MID)

# Table
rows = [
    ("Surface",       "Entry method",                 "Output section"),
    ("Shell UT",      "Strake × N/E/S/W × 5 pts",    "Shell thickness table"),
    ("Roof UT",       "Plate × A–E readings",         "Roof thickness table"),
    ("Shell Nozzles", "12/3/6/9 o'clock + pad",       "Shell nozzle table"),
    ("Roof Nozzles",  "N/E/S/W + pad",                "Roof nozzle table"),
    ("Bottom MFL",    "Import report metadata",        "MFL section"),
]
CW = [1.58, 2.55, 2.07]
CL = [0.82, 2.52, 5.22]
for i, row in enumerate(rows):
    is_h = (i == 0)
    bg_c = TEAL if is_h else (OFFWHITE if i % 2 == 0 else WHITE)
    lc   = None if is_h else TEAL_MID
    rect(s, 0.72, 2.06+i*0.50, 6.45, 0.50, bg_c, lc, 0.3)
    for cell, lf, cw in zip(row, CL, CW):
        fc = WHITE if is_h else (DARK if i % 2 == 0 else MID)
        txt(s, cell, lf, 2.14+i*0.50, cw, 0.38, size=10, bold=is_h, color=fc)

# Right callout card
shadow_rect(s, 0.72, 5.16, 6.45, 1.08, TEAL_LT)
txt(s, "Why it matters", 0.92, 5.28, 6.0, 0.28, size=11, bold=True, color=TEAL)
txt(s, "UT readings arrive in the report already mapped to the right table section. The inspector does not rebuild the structure from handwritten notes.",
    0.92, 5.58, 6.1, 0.52, size=10.2, color=DARK, wrap=True)

phone(s, os.path.join(SHOTS, "07_shellut_readings.png"), left=7.55, top=0.75, height=5.95)
phone(s, os.path.join(SHOTS, "11_roof_ut.png"),           left=10.4, top=0.75, height=5.95)

footer(s, "Field Capture Step 2  ·  S5")


# ═════════════════════════════════════════════════════════════════════════════
#  S6 — FIELD CAPTURE: inline findings
# ═════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
bg(s, WHITE)
left_bar(s, AMBER)
header(s, "FIELD CAPTURE  ·  STEP 3",
       "In-context finding capture", accent=AMBER, rule_color=AMBER)

txt(s, "When something is found during a UT task, the inspector documents it there and then — not later from memory.",
    0.72, 1.45, 8.4, 0.36, size=11, color=MID)

steps_data = [
    (TEAL,  "1  Photo",          "Take photo — auto-linked to the active UT task row"),
    (TEAL,  "2  Annotate",       "Circle, arrow, or label the visible anomaly"),
    (TEAL,  "3  Type + severity","Crack, corrosion, deformation, or weld concern"),
    (TEAL,  "4  Location",       "Strake, bearing, and UT context already pre-filled"),
    (TEAL,  "5  Measurements",   "Add pit depth, crack length, or custom notes"),
    (AMBER, "6  Save & return",  "Back to UT task with zero duplicate entry"),
]
for i, (color, label, desc) in enumerate(steps_data):
    tp = 2.02 + i * 0.50
    rect(s, 0.72, tp, 0.58, 0.44, color)
    txt(s, label, 0.80, tp+0.07, 1.85, 0.30, size=10, bold=True, color=WHITE)
    txt(s, desc,  2.48, tp+0.07, 5.05, 0.32, size=10.5, color=MID)

shadow_rect(s, 0.72, 5.18, 7.05, 0.92, AMBER_LT)
rect(s, 0.72, 5.18, 0.07, 0.92, AMBER)
txt(s, "Linked at source", 0.92, 5.30, 6.5, 0.26, size=11, bold=True, color=AMBER)
txt(s, "Each finding is permanently associated with its UT task row — it appears in the Findings Register with full evidence context, no separate entry required.",
    0.92, 5.58, 6.6, 0.44, size=10.2, color=DARK, wrap=True)

phone(s, os.path.join(SHOTS, "08_shell_finding.png"), left=9.9, top=0.75, height=5.95)

footer(s, "Field Capture Step 3  ·  S6")


# ═════════════════════════════════════════════════════════════════════════════
#  S7 — FIELD CAPTURE: location intelligence
# ═════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
bg(s, WHITE)
left_bar(s, TEAL)
header(s, "FIELD CAPTURE  ·  STEP 4",
       "Location intelligence by surface")

txt(s, "The right level of mapping for each surface — from coarse UT position to precise repeatable coordinates.",
    0.72, 1.45, 7.0, 0.36, size=11, color=MID)

mapping = [
    ("Shell",         "Strake + compass direction for coarse UT. Tap-on-canvas for precise plate coordinates."),
    ("Roof",          "Plate-based entry for routine UT readings across ring and section."),
    ("Shell nozzles", "Course + clock position before readings — linked to shell location."),
    ("Roof nozzles",  "Roof map registration before N/E/S/W + pad measurements."),
]
for i, (h, b) in enumerate(mapping):
    tp = 2.02 + i * 0.92
    shadow_rect(s, 0.72, tp, 6.82, 0.76, WHITE)
    rect(s, 0.72, tp, 0.07, 0.76, TEAL)
    txt(s, h, 0.92, tp+0.10, 1.7,  0.28, size=11,   bold=True, color=DARK)
    txt(s, b, 2.52, tp+0.10, 4.82, 0.48, size=10.2, color=MID, wrap=True)

shadow_rect(s, 0.72, 5.82, 6.82, 1.12, TEAL_LT)
txt(s, "Why precise location matters",  0.92, 5.92, 6.42, 0.28, size=11, bold=True, color=TEAL)
txt(s, (
    "Most reports record location as prose: \"near the third strake, north side.\" "
    "That cannot be mapped, trended, or reliably returned to in the next inspection cycle. "
    "A repeatable coordinate can."
), 0.92, 6.22, 6.42, 0.62, size=10.2, color=DARK, wrap=True)

phone(s, os.path.join(SHOTS, "09_shell_layout_setup.png"), left=7.55, top=0.75, height=5.95)
phone(s, os.path.join(SHOTS, "10b_shell_map_marked.png"),  left=10.4, top=0.75, height=5.95)

footer(s, "Field Capture Step 4  ·  S7")


# ═════════════════════════════════════════════════════════════════════════════
#  S8 — OUTPUT PACKAGE
# ═════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
bg(s, WHITE)
left_bar(s, TEAL)
header(s, "OUTPUT VALUE",
       "What the customer gets at the end")

txt(s, "The value is not just the capture flow. It is the inspection package that is ready for review, handover, and downstream use.",
    0.72, 1.45, 10.6, 0.36, size=11, color=MID)

cards_data = [
    ("UT Tables",          "Shell, roof, and nozzle readings structured for reporting",  TEAL),
    ("Findings Register",  "Type, severity, measurement, and linked photo evidence",     TEAL),
    ("Location Record",    "Coarse UT position or precise shell coordinate per finding", TEAL),
    ("MFL Section",        "Contractor reference and attachment context included",        TEAL),
    ("Structured Export",  "JSON + CSV for CMMS, analytics, or digital twin ingestion",  AMBER),
]
for i, (h, b, acc) in enumerate(cards_data):
    col, row = i % 2, i // 2
    if i == 4: col, row = 0, 2
    lft = 0.72 + col * 3.52
    tp  = 2.0  + row * 1.06
    shadow_rect(s, lft, tp, 3.32, 0.88, TEAL_LT if acc == AMBER else WHITE)
    rect(s, lft, tp, 0.07, 0.88, acc)
    txt(s, h, lft+0.20, tp+0.11, 2.9, 0.28, size=11, bold=True, color=acc)
    txt(s, b, lft+0.20, tp+0.42, 2.9, 0.38, size=9.5, color=MID, wrap=True)

phone(s, os.path.join(SHOTS, "13_export.png"), left=9.9, top=0.78, height=5.95)

rect(s, 0.72, 5.62, 8.45, 0.85, TEAL)
txt(s, "Commercial message",
    0.90, 5.72, 2.2, 0.24, size=11, bold=True, color=TEAL_LT)
txt(s, "The inspector leaves site with structured inspection data — not disconnected notes and photos.",
    3.12, 5.72, 5.85, 0.62, size=11, color=WHITE, wrap=True)

footer(s, "Output Value  ·  S8")


# ═════════════════════════════════════════════════════════════════════════════
#  S9 — BUSINESS VALUE
# ═════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
bg(s, WHITE)
left_bar(s, AMBER)
header(s, "BUYER VALUE",
       "Why it matters commercially", accent=AMBER, rule_color=AMBER)

value_cards = [
    ("Less admin load",           "Reduce re-keying and post-site report reconstruction"),
    ("Better traceability",       "Tie findings, photos, and location to the original UT task record"),
    ("Cleaner contractor handover","Standard structure instead of multiple custom templates"),
    ("Analytics-ready data",      "Structured output suitable for trend analysis and asset systems"),
]
for i, (h, b) in enumerate(value_cards):
    col, row = i % 2, i // 2
    lft = 0.72 + col * 6.25
    tp  = 1.78 + row * 1.7
    shadow_rect(s, lft, tp, 5.98, 1.45, OFFWHITE)
    rect(s, lft, tp, 0.07, 1.45, AMBER)
    txt(s, h, lft+0.22, tp+0.14, 5.55, 0.34, size=13, bold=True, color=DARK)
    txt(s, b, lft+0.22, tp+0.55, 5.55, 0.52, size=10.5, color=MID, wrap=True)

shadow_rect(s, 0.72, 5.38, 12.18, 1.42, TEAL_LT)
rect(s, 0.72, 5.38, 0.07, 1.42, TEAL)
txt(s, "Positioning statement",
    0.90, 5.52, 4.0, 0.26, size=11.5, bold=True, color=TEAL)
txt(s, (
    "Tank Inspection Copilot is not just a mobile form. "
    "It is a structured inspection workflow that improves how inspection data "
    "is captured, checked, handed over, and reused."
), 0.90, 5.82, 11.8, 0.84, size=11, color=DARK, wrap=True)

footer(s, "Buyer Value  ·  S9")


# ═════════════════════════════════════════════════════════════════════════════
#  S10 — MARKET CONTEXT
# ═════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
bg(s, WHITE)
left_bar(s, TEAL)
header(s, "MARKET CONTEXT",
       "Why now — and who buys")

tailwinds = [
    ("API 653 & audit pressure",
     ["More demand for clearer finding evidence",
      "Traceability across inspection cycles now expected"]),
    ("Workforce knowledge risk",
     ["Good practice must be encoded in tools",
      "Less dependence on inspector memory and personal templates"]),
    ("Digital asset initiatives",
     ["Operators want structured inspection data in CMMS",
      "PDF-only workflows slow analysis and reuse"]),
    ("Mobile field readiness",
     ["Rugged tablets and phones are already field-standard",
      "The missing layer is the structured workflow itself"]),
]
for i, (h, blist) in enumerate(tailwinds):
    col, row = i % 2, i // 2
    lft = 0.72 + col * 6.25
    tp  = 1.78 + row * 1.8
    shadow_rect(s, lft, tp, 5.98, 1.58, OFFWHITE)
    rect(s, lft, tp, 0.07, 1.58, TEAL)
    txt(s, h, lft+0.22, tp+0.14, 5.6, 0.30, size=12.5, bold=True, color=DARK)
    for j, b in enumerate(blist):
        txt(s, f"▸  {b}", lft+0.22, tp+0.55+j*0.40, 5.6, 0.36, size=10.5, color=MID)

# Who buys
shadow_rect(s, 0.72, 5.65, 12.18, 1.5, TEAL_LT)
txt(s, "Primary buyers", 0.90, 5.78, 3.0, 0.26, size=11.5, bold=True, color=TEAL)
buyers = [
    ("Inspection companies",     "Faster delivery and stronger data quality positioning"),
    ("Asset owners / operators", "Standard output across tanks and contractors"),
    ("Inspection consultancies", "Move away from bespoke Excel reporting packs"),
]
for i, (seg, why) in enumerate(buyers):
    tp = 6.15 + i * 0.32
    txt(s, f"▸  {seg}", 0.90, tp, 2.75, 0.28, size=10.5, bold=True, color=DARK)
    txt(s, why,          3.78, tp, 8.8,  0.28, size=10.2, color=MID)

footer(s, "Market Context  ·  S10")


# ═════════════════════════════════════════════════════════════════════════════
#  S11 — PILOT PROPOSAL
# ═════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
bg(s, WHITE)
left_bar(s, TEAL)
header(s, "NEXT STEP",
       "Recommended pilot")

pilot = [
    ("Pilot scope",      "1 tank type or 1 contractor inspection workflow",              TEAL),
    ("Users",            "2–4 field inspectors  +  1 report reviewer",                  TEAL),
    ("Pilot goal",       "Verify capture flow, output usability, and data completeness", TEAL),
    ("Success criteria", "Less manual rework  ·  Clearer linked evidence  ·  Usable export", AMBER),
]
for i, (h, b, acc) in enumerate(pilot):
    col, row = i % 2, i // 2
    lft = 0.72 + col * 6.25
    tp  = 1.78 + row * 1.42
    shadow_rect(s, lft, tp, 5.98, 1.18, OFFWHITE)
    rect(s, lft, tp, 0.07, 1.18, acc)
    txt(s, h, lft+0.22, tp+0.14, 5.6, 0.28, size=12, bold=True, color=DARK)
    txt(s, b, lft+0.22, tp+0.52, 5.6, 0.52, size=10.5, color=MID, wrap=True)

rect(s, 0.72, 4.84, 12.18, 1.08, TEAL)
txt(s, "Suggested close",
    0.90, 4.95, 2.5, 0.24, size=12, bold=True, color=TEAL_LT)
txt(s, (
    "Run a controlled pilot on one inspection workflow, prove the output package is useful, "
    "then expand surface coverage and reporting depth from there."
), 0.90, 5.28, 11.8, 0.50, size=11, color=WHITE, wrap=True)

shadow_rect(s, 0.72, 6.12, 12.18, 0.82, TEAL_LT)
txt(s, (
    "Tank Inspection Copilot turns inspection work into structured inspection data "
    "that is easier to check, easier to hand over, and easier to reuse."
), 0.90, 6.36, 11.88, 0.44, size=11, bold=True, color=TEAL, align=PP_ALIGN.CENTER)

footer(s, "Pilot Proposal  ·  S11")


# ═════════════════════════════════════════════════════════════════════════════
#  S12 — REPORT IN ONE CLICK
# ═════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
bg(s, WHITE)
left_bar(s, TEAL)
header(s, "FINAL VALUE",
       "From captured data to report in one click")

txt(s, "Convert the structured inspection record into a report-ready document package — without rebuilding the story manually.",
    0.72, 1.45, 10.9, 0.36, size=11, color=MID)

phone(s, os.path.join(SHOTS, "13_export.png"), left=0.88, top=2.0, height=5.08)

# AI bridge node
AX, AY = 4.12, 3.08
rect(s, AX, AY, 2.32, 1.38, TEAL_LT, TEAL, 1.0)
txt(s, "AI",                 AX+0.18, AY+0.14, 0.55, 0.38, size=20, bold=True, color=TEAL)
txt(s, "Report Intelligence",AX+0.76, AY+0.14, 1.42, 0.26, size=11, bold=True, color=TEAL)
txt(s, "Normalise  ·  Map to template\nAssemble draft  ·  Package output",
    AX+0.18, AY+0.62, 2.0, 0.62, size=9.2, color=DARK, align=PP_ALIGN.CENTER)

txt(s, "→", AX - 0.38, AY + 0.46, 0.34, 0.42, size=22, bold=True, color=TEAL, align=PP_ALIGN.CENTER)
txt(s, "→", AX + 2.38, AY + 0.46, 0.34, 0.42, size=22, bold=True, color=TEAL, align=PP_ALIGN.CENTER)

# Report sample
shadow_rect(s, 6.95, 1.95, 5.38, 5.18, WHITE)
if os.path.exists(REPORT_SAMPLE):
    s.shapes.add_picture(REPORT_SAMPLE, Inches(7.08), Inches(2.08),
                         width=Inches(5.1), height=Inches(4.82))
    # mask headers/footers
    rect(s, 7.08, 2.08, 5.1, 0.50, WHITE)
    rect(s, 7.08, 6.52, 5.1, 0.46, WHITE)
txt(s, "Sample report output", 7.08, 1.98, 2.6, 0.20, size=10.5, bold=True, color=TEAL)

proof = [
    ("UT tables",     "Auto-filled from shell, roof, and nozzle captured data"),
    ("Linked evidence","Finding photos and context tied to each UT record"),
    ("Location",      "Shell coordinates or coarse references flow into output"),
    ("Handover ready","Clean review package for customer, operator, or consultant"),
]
for i, (h, b) in enumerate(proof):
    txt(s, f"•  {h}:", 0.90, 7.12+i*0.22, 1.7, 0.20, size=9.4, bold=True, color=TEAL)
    txt(s, b,          2.28, 7.12+i*0.22, 4.3, 0.20, size=9.4,              color=MID)

rect(s, 0.72, 6.95, 12.18, 0.30, TEAL)
txt(s, "LAIQ  ·  Tank Inspection Copilot  ·  Confidential  ·  April 2026",
    0.72, 6.98, 12.18, 0.22, size=9.5, bold=True, color=WHITE, align=PP_ALIGN.CENTER)


# ═════════════════════════════════════════════════════════════════════════════
#  S13 — HARDWARE + OUTCOMES: field reality, ATEX PDA, LAIQ impact
# ═════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
bg(s, WHITE)
left_bar(s, NAVY)
header(s, "HARDWARE & OUTCOMES",
       "Purpose-built hardware. Measurable business results.",
       accent=NAVY, rule_color=TEAL_MID)

# ══ LEFT PANEL: field reality ─────────────────────────────────────────────
# Outlined container
rect(s, 0.72, 1.48, 3.48, 5.72, OFFWHITE, TEAL_MID, 0.5)
txt(s, "Field reality — why a\nsmartphone is not enough",
    0.88, 1.60, 3.14, 0.52, size=10.5, bold=True, color=DARK, wrap=True)
rect(s, 0.88, 2.15, 3.14, 0.03, TEAL_MID)

field_issues = [
    ("☀", "Sunlight",
     "Consumer screens wash out\nat >80 klux. Inspectors\ncannot see the app."),
    ("⚠", "ATEX Zone 1/2",
     "Smartphones & consumer\ntablets are prohibited by law\nin hazardous areas."),
    ("💧", "IP rating",
     "Rain, dust, chemicals —\nIP54 minimum. Touch must\nwork with wet gloves."),
    ("✈", "Offline",
     "No Wi-Fi or cellular on many\ntank farms. Device must\nwork air-gapped."),
]
for i, (icon, title, body) in enumerate(field_issues):
    tp = 2.24 + i * 1.18
    shadow_rect(s, 0.88, tp, 3.14, 1.08, WHITE)
    rect(s, 0.88, tp, 0.06, 1.08, NAVY)
    # icon circle
    ellipse(s, 1.02, tp + 0.15, 0.40, 0.40, TEAL_LT)
    txt(s, icon, 1.02, tp + 0.12, 0.40, 0.44,
        size=13, color=DARK, align=PP_ALIGN.CENTER)
    txt(s, title, 1.55, tp + 0.08, 2.34, 0.28,
        size=10.5, bold=True, color=DARK)
    txt(s, body,  1.55, tp + 0.36, 2.34, 0.64,
        size=9, color=MID, wrap=True)

# ══ CENTRE PANEL: real PDA + specs ────────────────────────────────────────
# Teal solution card container
rect(s, 4.38, 1.48, 4.62, 5.72, TEAL_LT, TEAL_MID, 0.5)
rect(s, 4.38, 1.48, 4.62, 0.50, TEAL)
txt(s, "Solution — Explosion-Proof ATEX / IECEx PDA Tablet",
    4.55, 1.56, 4.28, 0.36, size=10.5, bold=True, color=WHITE, wrap=True)

# Real PDA mockup image — landscape front-facing, centred in the card
PDA_H = 2.58
PDA_ASPECT = 1556 / 877   # landscape  (gen_pda.py output: 1556×877)
PDA_W = PDA_H * PDA_ASPECT
PDA_X = 4.38 + (4.62 - PDA_W) / 2
if os.path.exists(PDA_IMG):
    s.shapes.add_picture(PDA_IMG,
        Inches(PDA_X), Inches(2.20),
        width=Inches(PDA_W), height=Inches(PDA_H))

# Compact spec bullets below PDA
pda_specs = [
    "ATEX / IECEx Zone 1 & 2  ·  IP68  ·  –20 °C to +60 °C",
    "1000 nit sunlight-readable  ·  glove-friendly touch",
    "100% offline — no network needed",
]
for j, spec in enumerate(pda_specs):
    txt(s, f"•  {spec}", 4.55, 4.92 + j * 0.21, 4.28, 0.20,
        size=8.5, color=MID)

txt(s, "e.g. Ecom Tab-Ex 02  ·  Bartec ZONE 2  ·  Pepperl+Fuchs BM-T35",
    4.38, 5.60, 4.62, 0.16, size=7.5, color=PALE, italic=True,
    align=PP_ALIGN.CENTER)

# Arrow: field → PDA
txt(s, "▶", 4.05, 3.48, 0.28, 0.42,
    size=18, bold=True, color=TEAL, align=PP_ALIGN.CENTER)

# ══ RIGHT PANEL: 3 outcome pillars ────────────────────────────────────────
rect(s, 9.18, 1.48, 3.72, 5.72, TEAL_LT, TEAL_MID, 0.5)
txt(s, "LAIQ outcomes — what customers measure",
    9.34, 1.58, 3.42, 0.40, size=10.5, bold=True, color=DARK, wrap=True)
rect(s, 9.34, 2.02, 3.42, 0.03, TEAL_MID)

# Arrow: PDA → outcomes
txt(s, "▶", 8.88, 3.48, 0.28, 0.42,
    size=18, bold=True, color=TEAL, align=PP_ALIGN.CENTER)

outcomes = [
    (TEAL,  "Inspection\nCycle Time",  "↓ 40–70%",
     ["Re-keying eliminated",
      "Completeness check on site",
      "Report assembly automated"]),
    (NAVY,  "Data Loss",               "Zero",
     ["Offline-first — writes instantly",
      "No paper transcription errors",
      "Photos linked at capture"]),
    (TEAL,  "Automated\nReport",       "1-Click",
     ["Structured data → report draft",
      "UT tables auto-populated",
      "Findings register pre-built"]),
]
OW = 1.10
OGap = 0.06
for i, (acc, label, metric, blist) in enumerate(outcomes):
    lft = 9.28 + i * (OW + OGap)

    # Metric header block
    shadow_rect(s, lft, 2.12, OW, 1.88, OFFWHITE)
    rect(s, lft, 2.12, OW, 0.06, acc)
    txt(s, label,  lft+0.08, 2.20, OW-0.16, 0.48,
        size=9, bold=True, color=DARK, wrap=True)
    txt(s, metric, lft+0.06, 2.66, OW-0.12, 0.96,
        size=22, bold=True, color=acc, wrap=True)

    # Separator
    rect(s, lft, 4.05, OW, 0.03, TEAL_MID)

    # Bullet details
    for j, b in enumerate(blist):
        txt(s, f"▸  {b}", lft+0.08, 4.14+j*0.68, OW-0.16, 0.62,
            size=8.8, color=MID, wrap=True)

# Vertical dividers between outcome columns
for di in [1, 2]:
    rect(s, 9.28 + di*(OW+OGap) - OGap, 2.12, OGap, 5.0, TEAL_MID)

# ══ BOTTOM BAR ────────────────────────────────────────────────────────────
rect(s, 0.72, 7.18, 12.18, 0.26, TEAL)
txt(s, "LAIQ  ·  Upskill People   ·   Uplift the Standard   ·   Uptime",
    0.88, 7.22, 11.98, 0.18,
    size=9.5, bold=True, color=WHITE, align=PP_ALIGN.CENTER)

footer(s, "Hardware & Outcomes  ·  S13")


# ═════════════════════════════════════════════════════════════════════════════
#  SAVE
# ═════════════════════════════════════════════════════════════════════════════
prs.save(OUT)
print(f"✅  Saved → {OUT}")
