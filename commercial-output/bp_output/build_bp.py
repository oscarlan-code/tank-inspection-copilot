"""
LAIQ Investor BP Deck — v2 (Visual Redesign)
9 slides · figure-first · one message per slide
Style: LAIQ brand — navy / teal / white / amber accent · Arial
"""
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from lxml import etree
import os

BASE   = os.path.dirname(os.path.abspath(__file__))
PARENT = os.path.dirname(BASE)
SHOTS  = os.path.join(PARENT, "screenshots")
LOGO   = os.path.join(PARENT, "laiq_logo.png")
PDA    = os.path.join(PARENT, "atex_pda_mockup.png")
UI_IMG = os.path.join(PARENT, "WhatsApp Image 2026-04-27 at 21.43.31.jpeg")
REPORT_SAMPLE = os.path.join(SHOTS, "report_sample_shell_table.png")
OUT    = os.path.join(BASE,   "LAIQ_Investor_BP.pptx")

# ── Palette ────────────────────────────────────────────────────────────────────
NAVY     = RGBColor(0x0A, 0x16, 0x28)
NAVY2    = RGBColor(0x12, 0x24, 0x40)
TEAL     = RGBColor(0x07, 0x5F, 0x5C)
TEAL_LT  = RGBColor(0xDC, 0xEF, 0xE9)
TEAL_MID = RGBColor(0x8A, 0xBB, 0xB6)
TEAL_DIM = RGBColor(0x4A, 0x80, 0x7C)
WHITE    = RGBColor(0xFF, 0xFF, 0xFF)
OFFWHITE = RGBColor(0xF4, 0xF7, 0xF6)
LGRAY    = RGBColor(0xE2, 0xE8, 0xE6)
MID      = RGBColor(0x52, 0x62, 0x5E)
PALE     = RGBColor(0xA8, 0xB8, 0xB4)
AMBER    = RGBColor(0xE6, 0x7E, 0x22)
AMBER_LT = RGBColor(0xFD, 0xF0, 0xE0)
AMBER_DK = RGBColor(0xB5, 0x60, 0x10)
RED      = RGBColor(0xB0, 0x20, 0x20)
RED_LT   = RGBColor(0xFC, 0xEC, 0xEC)
STEEL    = RGBColor(0x60, 0x70, 0x78)
DARK     = RGBColor(0x17, 0x20, 0x1E)

I = Inches
prs = Presentation()
prs.slide_width  = I(13.33)
prs.slide_height = I(7.5)
BLANK = prs.slide_layouts[6]
FONT  = "Arial"

# ══════════════════════════════════════════════════════════════════════════════
# PRIMITIVE HELPERS
# ══════════════════════════════════════════════════════════════════════════════
def rect(s, l, t, w, h, fill=None, line=None, lw=0.6):
    sh = s.shapes.add_shape(1, I(l), I(t), I(w), I(h))
    sh.fill.solid() if fill else sh.fill.background()
    if fill: sh.fill.fore_color.rgb = fill
    if line: sh.line.color.rgb = line; sh.line.width = Pt(lw)
    else:    sh.line.fill.background()
    return sh

def ellipse(s, l, t, w, h, fill=None, line=None):
    sh = s.shapes.add_shape(9, I(l), I(t), I(w), I(h))
    sh.fill.solid() if fill else sh.fill.background()
    if fill: sh.fill.fore_color.rgb = fill
    sh.line.fill.background() if not line else None
    return sh

def txt(s, text, l, t, w, h, size=11, bold=False, color=DARK,
        align=PP_ALIGN.LEFT, wrap=True, italic=False):
    tb = s.shapes.add_textbox(I(l), I(t), I(w), I(h))
    tb.word_wrap = wrap
    tf = tb.text_frame; tf.word_wrap = wrap
    p  = tf.paragraphs[0]; p.alignment = align
    r  = p.add_run(); r.text = text
    r.font.name = FONT; r.font.size = Pt(size)
    r.font.bold = bold; r.font.italic = italic
    r.font.color.rgb = color
    return tb

def bg(s, color=WHITE):
    f = s.background.fill; f.solid(); f.fore_color.rgb = color

def add_logo(s, rgt=13.13, bot=7.44, h=0.26):
    if not os.path.exists(LOGO): return
    w = h*(930/430)
    s.shapes.add_picture(LOGO, I(rgt-w), I(bot-h), width=I(w), height=I(h))

def footer(s, label=""):
    rect(s, 0, 7.18, 13.33, 0.04, TEAL_MID)
    if label: txt(s, label, 0.18, 7.23, 6, 0.21, size=7.5, color=PALE)
    txt(s, "LAIQ  ·  Confidential", 7, 7.23, 6.13, 0.21,
        size=7.5, color=PALE, align=PP_ALIGN.RIGHT)
    add_logo(s)

def left_bar(s, color=TEAL, accent=TEAL_LT):
    rect(s, 0, 0, 0.32, 7.5, color)
    rect(s, 0.32, 0, 0.07, 7.5, accent)

def slide_kicker(s, kicker, title, tcolor=NAVY, kcolor=TEAL):
    txt(s, kicker, 0.55, 0.20, 12.6, 0.26, size=8.5, bold=True, color=kcolor)
    txt(s, title,  0.55, 0.44, 12.6, 0.72, size=26, bold=True, color=tcolor)
    rect(s, 0.55, 1.20, 12.60, 0.04, TEAL_MID)

# ── Flow / card helpers ────────────────────────────────────────────────────────
def flow_box(s, label, l, t, w=1.80, h=0.56, fill=TEAL, tcolor=WHITE,
             size=9.5, bold=True, sub=None):
    rect(s, l, t, w, h, fill)
    if sub:
        txt(s, label, l+0.08, t+0.05, w-0.16, 0.28,
            size=size, bold=bold, color=tcolor, align=PP_ALIGN.CENTER)
        txt(s, sub, l+0.08, t+0.32, w-0.16, 0.22,
            size=7.5, color=tcolor, align=PP_ALIGN.CENTER, italic=True)
    else:
        txt(s, label, l+0.08, t+0.06, w-0.16, h-0.10,
            size=size, bold=bold, color=tcolor, align=PP_ALIGN.CENTER)

def harrow(s, l, cy, gap=0.18, color=TEAL_MID, size=16):
    txt(s, "▶", l, cy-0.22, gap+0.16, 0.44,
        size=size, bold=True, color=color, align=PP_ALIGN.CENTER)

def varrow(s, cx, t, gap=0.12, color=TEAL_MID):
    txt(s, "↓", cx-0.20, t, 0.40, gap+0.16,
        size=14, bold=True, color=color, align=PP_ALIGN.CENTER)

def card(s, l, t, w, h, title, body="", fill=OFFWHITE, tfill=TEAL,
         tcolor=WHITE, bcolor=DARK, accent_h=0.06, tsize=10, bsize=8.5):
    rect(s, l, t, w, h, fill, TEAL_MID, 0.5)
    rect(s, l, t, w, accent_h, tfill)
    txt(s, title, l+0.10, t+accent_h+0.06, w-0.20, 0.30,
        size=tsize, bold=True, color=DARK)
    if body:
        txt(s, body, l+0.10, t+accent_h+0.38, w-0.20, h-accent_h-0.44,
            size=bsize, color=MID, wrap=True)

def arch_layer(s, label, items, l, t, w, h, fill=NAVY, tcolor=WHITE,
               item_color=TEAL_LT, label_w=1.80):
    rect(s, l, t, w, h, fill)
    txt(s, label, l+0.14, t+0.10, label_w-0.20, h-0.18,
        size=10, bold=True, color=tcolor, align=PP_ALIGN.CENTER)
    rect(s, l+label_w, t+0.06, 0.025, h-0.12, TEAL_DIM)
    ix = l + label_w + 0.20
    remaining = w - label_w - 0.26
    iw = (remaining - 0.10*(len(items)-1)) / len(items)
    for item in items:
        rect(s, ix, t+0.08, iw, h-0.16, NAVY2)
        txt(s, item, ix+0.08, t+0.12, iw-0.16, h-0.28,
            size=8.5, color=item_color, align=PP_ALIGN.CENTER)
        ix += iw + 0.10

def bullet_pts(s, items, l, t, w, gap=0.38, size=10, color=DARK, dot="▸"):
    for i, item in enumerate(items):
        txt(s, f"{dot}  {item}", l, t+i*gap, w, gap+0.02, size=size, color=color)

def fit_image(s, path, l, t, w, h, fill=WHITE, line=TEAL_MID, lw=0.5):
    rect(s, l, t, w, h, fill, line, lw)
    if not os.path.exists(path):
        return
    from PIL import Image as _PIL
    iw, ih = _PIL.open(path).size
    ar = iw / ih
    box_w = w - 0.16
    box_h = h - 0.16
    if ar >= box_w / box_h:
        pw = box_w
        ph = pw / ar
    else:
        ph = box_h
        pw = ph * ar
    px = l + (w - pw) / 2
    py = t + (h - ph) / 2
    s.shapes.add_picture(path, I(px), I(py), width=I(pw), height=I(ph))

def hline(s, l, t, w, color=LGRAY, h=0.02):
    rect(s, l, t, w, h, color)

# ══════════════════════════════════════════════════════════════════════════════
# S1 — COVER
# ══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
bg(s, NAVY)
rect(s, 0, 0, 0.40, 7.5, TEAL)
rect(s, 0.40, 0, 0.08, 7.5, TEAL_DIM)

# Logo
if os.path.exists(LOGO):
    lh=0.30; lw=lh*(930/430)
    s.shapes.add_picture(LOGO, I(0.62), I(0.24), width=I(lw), height=I(lh))

# Title (left 60%)
txt(s, "Leave Site with a", 0.62, 1.20, 7.8, 0.50, size=32, color=TEAL_LT)
txt(s, "Report-Ready\nInspection Package",
    0.62, 1.68, 7.8, 1.10, size=42, bold=True, color=WHITE)
txt(s, "AI-powered field inspection and asset intelligence · starting with oil & gas",
    0.62, 2.86, 7.8, 0.32, size=11.5, color=PALE)

# Divider
rect(s, 0.62, 3.28, 7.8, 0.03, TEAL_DIM)

# Value chain flow
CHAIN = [
    ("Field\nInspection", TEAL),
    ("Structured\nCapture", TEAL_DIM),
    ("AI Report\nPackage", AMBER),
    ("Asset\nKnowledge", TEAL_DIM),
    ("Weak Point /\nFMEA Intel", NAVY2),
]
BW, BH, BG = 1.40, 0.68, 0.12
cx = 0.62
for i, (lbl, fc) in enumerate(CHAIN):
    rect(s, cx, 3.40, BW, BH, fc)
    txt(s, lbl, cx+0.07, 3.44, BW-0.14, BH-0.08,
        size=8.5, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    if i < len(CHAIN)-1:
        harrow(s, cx+BW+0.01, 3.40+BH/2, BG, PALE, 13)
    cx += BW + BG

# 4 tag pills
TAGS = [
    ("Beachhead: Oil & Gas",         TEAL,  TEAL_LT),
    ("Model: Free Capture + Paid Reports", AMBER, AMBER_LT),
    ("Hardware: ATEX/IECEx Device",   NAVY,  TEAL_LT),
    ("Moat: Asset Intelligence",      TEAL,  TEAL_LT),
]
tx = 0.62
for lbl, col, bg2 in TAGS:
    tw = len(lbl)*0.072 + 0.22
    rect(s, tx, 4.22, tw, 0.28, bg2, col, 0.5)
    txt(s, lbl, tx+0.08, 4.24, tw-0.14, 0.22,
        size=7.5, bold=True, color=col)
    tx += tw + 0.10

# PDA image (right panel)
if os.path.exists(PDA):
    from PIL import Image as _PIL
    _w, _h = _PIL.open(PDA).size
    _ar = _w/_h
    ph = 2.70; pw = ph*_ar
    px = 8.62 + (4.50-pw)/2
    s.shapes.add_picture(PDA, I(px), I(2.70), width=I(pw), height=I(ph))
    txt(s, "ATEX/IECEx certified rugged tablet with LAIQ Field App",
        8.62, 5.46, 4.50, 0.24, size=7.5, color=PALE,
        align=PP_ALIGN.CENTER, italic=True)

rect(s, 8.50, 1.10, 0.03, 6.0, TEAL_DIM)
footer(s, "S1 · Cover")

# ══════════════════════════════════════════════════════════════════════════════
# S2 — PAIN VS LAIQ
# ══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
bg(s)
left_bar(s, TEAL)
slide_kicker(s, "PROBLEM + SOLUTION",
             "Manual Inspection Data Capture Breaks Report Generation", TEAL)

txt(s, "Most tank inspections still move through notebooks, phone photos, spreadsheets, and back-office report assembly. LAIQ replaces that with one structured capture path.",
    0.55, 1.28, 12.4, 0.28, size=10.5, color=MID)

# Left: current pain
rect(s, 0.55, 1.68, 5.95, 3.18, WHITE, RED, 0.9)
rect(s, 1.90, 1.48, 1.72, 0.34, RED)
txt(s, "TODAY", 2.04, 1.53, 1.44, 0.18, size=11.5, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
txt(s, "Current inspection workflow", 0.82, 1.96, 2.3, 0.20, size=9.5, bold=True, color=RED)

today_x = [0.96, 2.24, 3.52, 4.80]
today_steps = ["Field\nNotes", "Excel\nEntry", "Photo\nFolder", "Manual\nReport"]
for i, (x, label) in enumerate(zip(today_x, today_steps)):
    rect(s, x, 2.26, 0.90, 0.66, OFFWHITE, TEAL_MID, 0.4)
    txt(s, label, x+0.08, 2.98, 0.74, 0.40, size=9.3, bold=True, color=DARK, align=PP_ALIGN.CENTER)
    if i < 3:
        txt(s, "▶", x+0.96, 2.48, 0.22, 0.22, size=18, bold=True, color=RED, align=PP_ALIGN.CENTER)

# simple icons
for i in range(4):
    x = today_x[i]
    if i == 0:
        rect(s, x+0.24, 2.42, 0.26, 0.34, WHITE, STEEL, 0.8)
        for j in range(3):
            hline(s, x+0.28, 2.50+j*0.08, 0.16, STEEL, 0.01)
    elif i == 1:
        rect(s, x+0.20, 2.40, 0.32, 0.36, RGBColor(0x43, 0xA0, 0x47))
        txt(s, "X", x+0.24, 2.49, 0.10, 0.10, size=13, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    elif i == 2:
        rect(s, x+0.18, 2.46, 0.38, 0.24, STEEL)
        rect(s, x+0.24, 2.38, 0.14, 0.10, STEEL)
    else:
        rect(s, x+0.24, 2.40, 0.24, 0.34, WHITE, STEEL, 0.8)
        hline(s, x+0.29, 2.50, 0.14, STEEL, 0.01)
        hline(s, x+0.29, 2.58, 0.14, STEEL, 0.01)
        hline(s, x+0.29, 2.66, 0.14, STEEL, 0.01)

hline(s, 0.82, 3.46, 5.40, TEAL_MID, 0.02)
PAIN_LIST = [
    "Duplicate entry: field notes are typed again in the office",
    "Broken evidence chain: photos and findings live outside the UT record",
    "Weak traceability: location is reconstructed later from memory",
    "Slow turnaround: report assembly starts after the site visit ends",
]
bullet_pts(s, PAIN_LIST, 0.92, 3.66, 5.20, gap=0.30, size=8.6, color=RED)

# Right: LAIQ workflow
rect(s, 6.82, 1.68, 6.35, 3.18, WHITE, RGBColor(0x62, 0xB4, 0x62), 0.9)
rect(s, 8.92, 1.48, 2.12, 0.34, RGBColor(0x62, 0xB4, 0x62))
txt(s, "WITH LAIQ", 9.10, 1.53, 1.76, 0.18, size=11.5, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
txt(s, "Structured capture to report-ready package", 7.10, 1.96, 3.2, 0.20, size=9.5, bold=True, color=TEAL)

laiq_x = [7.12, 8.62, 10.12, 11.62]
laiq_steps = ["Guided\nCapture", "Structured\nRecord", "AI Report\nPackage", "Asset\nHistory"]
laiq_colors = [TEAL, TEAL_DIM, AMBER, NAVY]
for i, (x, label, fill) in enumerate(zip(laiq_x, laiq_steps, laiq_colors)):
    rect(s, x, 2.26, 1.06, 0.66, fill)
    txt(s, label, x+0.08, 2.36, 0.90, 0.36, size=9.3, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    if i < 3:
        txt(s, "▶", x+1.10, 2.48, 0.22, 0.22, size=18, bold=True, color=RGBColor(0x62, 0xB4, 0x62), align=PP_ALIGN.CENTER)

hline(s, 7.10, 3.46, 5.72, TEAL_MID, 0.02)
GOOD_LIST = [
    "One-time capture: measurements, findings, and photos stay in one record",
    "Structured evidence: shell, roof, nozzle, and MFL context stay linked",
    "Faster report draft: AI assembles tables and evidence from the same record",
    "Asset history: every finished job becomes reusable inspection memory",
]
bullet_pts(s, GOOD_LIST, 7.18, 3.66, 5.48, gap=0.30, size=8.6, color=RGBColor(0x2E, 0x7D, 0x32))

# Bottom output strip
rect(s, 3.95, 4.98, 5.80, 0.30, WHITE, LGRAY, 0.3)
txt(s, "INSPECTION PACKAGE OUTPUT", 4.14, 5.04, 5.42, 0.16, size=11.5, bold=True, color=DARK, align=PP_ALIGN.CENTER)

OUT_CARDS = [
    ("UT Tables", "Shell · Roof · Nozzle", "grid"),
    ("Findings Register", "Severity · note · measurement", "list"),
    ("Linked Evidence", "Photo → task → finding", "link"),
    ("Report Package", "Structured export + draft", "report"),
]
cx = 0.76
cw = 2.98
cg = 0.16
for title, body, kind in OUT_CARDS:
    rect(s, cx, 5.28, cw, 1.08, WHITE, TEAL_MID, 0.5)
    rect(s, cx, 5.28, cw, 0.20, STEEL)
    txt(s, title, cx+0.10, 5.33, cw-0.20, 0.12, size=9.2, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    txt(s, body, cx+0.14, 5.58, 1.70, 0.36, size=8.5, color=DARK)
    if kind == "grid":
        rect(s, cx+2.02, 5.54, 0.74, 0.46, WHITE, STEEL, 0.8)
        for i in range(1,4):
            hline(s, cx+2.02, 5.54+i*0.115, 0.74, STEEL, 0.01)
            rect(s, cx+2.02+i*0.185, 5.54, 0.01, 0.46, STEEL)
    elif kind == "list":
        rect(s, cx+2.12, 5.54, 0.50, 0.44, WHITE, STEEL, 0.8)
        for i in range(3):
            ellipse(s, cx+2.18, 5.61+i*0.11, 0.04, 0.04, RED, None)
            hline(s, cx+2.28, 5.62+i*0.11, 0.20, STEEL, 0.01)
    elif kind == "link":
        rect(s, cx+2.00, 5.56, 0.26, 0.34, WHITE, STEEL, 0.8)
        rect(s, cx+2.34, 5.64, 0.26, 0.34, WHITE, STEEL, 0.8)
        ellipse(s, cx+2.18, 5.70, 0.16, 0.08, WHITE, STEEL)
    else:
        rect(s, cx+2.04, 5.52, 0.38, 0.52, WHITE, STEEL, 0.8)
        hline(s, cx+2.10, 5.64, 0.22, STEEL, 0.01)
        hline(s, cx+2.10, 5.74, 0.22, STEEL, 0.01)
        hline(s, cx+2.10, 5.84, 0.22, STEEL, 0.01)
        rect(s, cx+2.28, 5.52, 0.14, 0.14, WHITE, STEEL, 0.8)
    cx += cw + cg

rect(s, 0.55, 6.56, 12.62, 0.48, TEAL_LT, TEAL_MID, 0.5)
txt(s, "The value is not the form. The value is a structured inspection record that becomes a report-ready package.",
    0.82, 6.68, 12.05, 0.18, size=11.5, bold=True, color=TEAL, align=PP_ALIGN.CENTER)

footer(s, "S2 · Pain vs LAIQ")

# ══════════════════════════════════════════════════════════════════════════════
# S5 — BEACHHEAD WORKFLOW
# ══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
bg(s)
left_bar(s, TEAL)
slide_kicker(s, "BEACHHEAD MARKET",
             "Start with Oil & Gas Tank Inspection", TEAL)

txt(s, "Why this beachhead first: high-frequency inspection workflows, heavy capture burden, and reports that are still largely assembled manually.",
    0.55, 1.28, 12.4, 0.28, size=10.5, color=MID)

# Left panel: market and workflow burden
rect(s, 0.55, 1.68, 4.10, 5.00, OFFWHITE, TEAL_MID, 0.5)
txt(s, "Inspection scale and burden", 0.78, 1.86, 2.8, 0.22,
    size=10, bold=True, color=NAVY)
txt(s, "Public tank counts are fragmented. Commercial terminal datasets still show a very large installed base.", 0.78, 2.10, 3.40, 0.28,
    size=8.2, color=PALE, italic=True)

cards = [
    ("10,100+", "tank terminals worldwide\nin TankTerminals demo scope", TEAL),
    ("12,600+", "tank storage facilities in\nbroader platform scope", TEAL_DIM),
    ("~1,000–2,000+", "terminal-level external inspection\ncycles per year at a 5-year cadence", AMBER),
    ("580+", "structured capture points in one sample tank report\nbefore photos and MFL maps", NAVY),
]
for i, (stat, body, accent) in enumerate(cards):
    col = i % 2
    row = i // 2
    l = 0.78 + col * 1.94
    t = 2.54 + row * 1.48
    rect(s, l, t, 1.76, 1.22, WHITE, TEAL_MID, 0.4)
    rect(s, l, t, 0.06, 1.22, accent)
    txt(s, stat, l+0.16, t+0.12, 1.44, 0.28, size=17, bold=True, color=accent, align=PP_ALIGN.CENTER)
    txt(s, body, l+0.16, t+0.50, 1.44, 0.50, size=7.7, color=DARK, align=PP_ALIGN.CENTER)

rect(s, 0.78, 5.62, 3.64, 0.82, WHITE, TEAL_MID, 0.4)
txt(s, "Sample report burden", 0.96, 5.78, 1.8, 0.18, size=9.5, bold=True, color=TEAL)
txt(s, "36–74 pages\n9.5k–12.3k words\n195 checklist items\n~385 UT readings", 0.96, 6.02, 3.10, 0.34, size=8.4, color=DARK)

# Center panel: current manual flow vs LAIQ solution
rect(s, 4.88, 1.68, 4.18, 5.00, TEAL_LT, TEAL_MID, 0.5)
rect(s, 4.88, 1.68, 4.18, 0.54, TEAL)
txt(s, "Solution — structured field capture to AI report package", 5.12, 1.82, 3.70, 0.18,
    size=10.2, bold=True, color=WHITE, align=PP_ALIGN.CENTER)

txt(s, "Today: notebook → Excel → photo folder → report assembly", 5.10, 2.40, 3.72, 0.18, size=8.6, color=MID, align=PP_ALIGN.CENTER)
flow_box(s, "Field\nCapture", 5.12, 2.72, 0.88, 0.46, STEEL, size=8.2)
harrow(s, 6.04, 2.95, 0.08, MID, 10)
flow_box(s, "Excel\nRe-key", 6.18, 2.72, 0.88, 0.46, STEEL, size=8.2)
harrow(s, 7.10, 2.95, 0.08, MID, 10)
flow_box(s, "Photo\nFolder", 7.24, 2.72, 0.88, 0.46, STEEL, size=8.2)
varrow(s, 7.68, 3.24, 0.10, MID)
flow_box(s, "Manual\nReport", 7.24, 3.48, 0.88, 0.46, STEEL, size=8.2)

fit_image(s, PDA, 5.10, 4.04, 2.18, 1.92, fill=TEAL_LT, line=None, lw=0)
txt(s, "LAIQ field workflow", 5.34, 6.00, 1.72, 0.14, size=7.5, color=PALE, italic=True, align=PP_ALIGN.CENTER)

txt(s, "AI", 7.52, 4.48, 0.42, 0.22, size=18, bold=True, color=TEAL, align=PP_ALIGN.CENTER)
txt(s, "▶", 7.26, 4.86, 0.24, 0.18, size=16, bold=True, color=TEAL, align=PP_ALIGN.CENTER)
txt(s, "▶", 7.96, 4.86, 0.24, 0.18, size=16, bold=True, color=TEAL, align=PP_ALIGN.CENTER)

fit_image(s, REPORT_SAMPLE, 8.10, 4.02, 0.72, 1.98, fill=WHITE, line=TEAL_MID, lw=0.3)
rect(s, 8.16, 4.08, 0.60, 0.18, WHITE, None, 0)
rect(s, 8.16, 5.72, 0.60, 0.16, WHITE, None, 0)
txt(s, "AI report output", 7.86, 6.00, 1.18, 0.14, size=7.5, color=PALE, italic=True, align=PP_ALIGN.CENTER)

rect(s, 5.12, 6.20, 3.70, 0.30, TEAL)
txt(s, "1 capture path → structured record → report draft", 5.24, 6.28, 3.46, 0.14, size=8.4, bold=True, color=WHITE, align=PP_ALIGN.CENTER)

# Right panel: what LAIQ changes
rect(s, 9.28, 1.68, 3.89, 5.00, OFFWHITE, TEAL_MID, 0.5)
txt(s, "What LAIQ changes", 9.52, 1.86, 2.2, 0.22, size=10, bold=True, color=NAVY)

OUTS = [
    ("One-time capture", "No notebook → Excel → report re-key chain", TEAL),
    ("Structured evidence", "UT, findings, photos, and MFL stay linked at source", TEAL_DIM),
    ("1-click report draft", "Tables, findings register, and evidence pack assemble from the same record", AMBER),
    ("Asset history starts now", "Every finished report becomes reusable inspection memory", NAVY),
]
for i, (title, body, accent) in enumerate(OUTS):
    t = 2.18 + i * 1.04
    rect(s, 9.52, t, 3.42, 0.82, WHITE, TEAL_MID, 0.4)
    rect(s, 9.52, t, 0.07, 0.82, accent)
    txt(s, title, 9.72, t+0.10, 3.00, 0.18, size=9.4, bold=True, color=DARK)
    txt(s, body, 9.72, t+0.34, 3.00, 0.28, size=8.2, color=MID)

txt(s, "Source note: TankTerminals commercial database pages; 5-year external inspection cadence from API 653 market-practice references; sample-report burden from LAIQ analysis of 3 reports in /data.",
    0.72, 6.90, 12.1, 0.16, size=6.6, color=PALE, italic=True)

footer(s, "S3 · Beachhead")

# ══════════════════════════════════════════════════════════════════════════════
# S6 — BUSINESS MODEL FLYWHEEL
# ══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
bg(s)
left_bar(s, TEAL)
slide_kicker(s, "BUSINESS MODEL",
             "Free Capture Creates Paid Report Volume", TEAL)

txt(s, "The model starts with low-friction adoption, then monetises the report package and expands into recurring intelligence products.",
    0.55, 1.28, 12.4, 0.28, size=10.5, color=MID)

# Left: monetisation stack
txt(s, "Commercial stack", 0.55, 1.72, 2.4, 0.22, size=10, bold=True, color=NAVY)
STACK = [
    ("1. Device", "ATEX/IECEx field device", "USD 5,000 / device", TEAL),
    ("2. Seats", "Inspectors and reviewers", "USD 50–80 / user / year", TEAL_DIM),
    ("3. Reports", "AI-generated inspection package", "USD 50–300 / report", AMBER),
    ("4. Enterprise", "Asset memory + reliability modules", "Premium subscription", NAVY),
]
for i, (step, desc, price, accent) in enumerate(STACK):
    tp = 2.04 + i * 1.02
    rect(s, 0.55, tp, 5.35, 0.82, OFFWHITE, TEAL_MID, 0.4)
    rect(s, 0.55, tp, 0.09, 0.82, accent)
    txt(s, step, 0.74, tp+0.10, 1.5, 0.20, size=9.5, bold=True, color=DARK)
    txt(s, desc, 2.05, tp+0.10, 2.35, 0.22, size=8.8, color=MID)
    txt(s, price, 3.80, tp+0.40, 1.80, 0.22, size=12, bold=True, color=accent, align=PP_ALIGN.RIGHT)

rect(s, 0.55, 6.30, 5.35, 0.48, TEAL_LT, TEAL_MID, 0.5)
txt(s, "Free capture is an acquisition strategy. Paid value starts when LAIQ assembles the report package.",
    0.72, 6.42, 5.0, 0.24, size=8.8, color=TEAL, italic=True)

# Right: flywheel
txt(s, "Data flywheel", 6.35, 1.72, 2.4, 0.22, size=10, bold=True, color=NAVY)
ellipse(s, 8.75, 3.00, 2.10, 1.04, TEAL_LT, TEAL_MID)
txt(s, "Better\nReport Agent", 8.95, 3.18, 1.70, 0.56, size=12, bold=True, color=TEAL, align=PP_ALIGN.CENTER)

rect(s, 6.45, 2.10, 1.92, 0.74, TEAL)
txt(s, "Free Capture", 6.56, 2.20, 1.70, 0.18, size=9.5, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
txt(s, "more inspectors", 6.56, 2.46, 1.70, 0.16, size=7.8, color=TEAL_LT, align=PP_ALIGN.CENTER)

rect(s, 11.00, 2.10, 1.92, 0.74, TEAL_DIM)
txt(s, "More Records", 11.10, 2.20, 1.72, 0.18, size=9.5, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
txt(s, "structured history", 11.10, 2.46, 1.72, 0.16, size=7.8, color=TEAL_LT, align=PP_ALIGN.CENTER)

rect(s, 11.00, 4.22, 1.92, 0.74, AMBER)
txt(s, "Paid Reports", 11.10, 4.32, 1.72, 0.18, size=9.5, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
txt(s, "faster output", 11.10, 4.58, 1.72, 0.16, size=7.8, color=AMBER_LT, align=PP_ALIGN.CENTER)

rect(s, 6.45, 4.22, 1.92, 0.74, NAVY)
txt(s, "Asset Memory", 6.56, 4.32, 1.70, 0.18, size=9.5, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
txt(s, "better recommendations", 6.56, 4.58, 1.70, 0.16, size=7.6, color=TEAL_LT, align=PP_ALIGN.CENTER)

txt(s, "▶", 8.38, 2.30, 0.28, 0.24, size=16, bold=True, color=TEAL_MID, align=PP_ALIGN.CENTER)
txt(s, "▼", 11.76, 2.88, 0.28, 0.24, size=16, bold=True, color=TEAL_MID, align=PP_ALIGN.CENTER)
txt(s, "◀", 8.38, 4.42, 0.28, 0.24, size=16, bold=True, color=TEAL_MID, align=PP_ALIGN.CENTER)
txt(s, "▲", 8.00, 2.88, 0.28, 0.24, size=16, bold=True, color=TEAL_MID, align=PP_ALIGN.CENTER)

rect(s, 6.35, 5.40, 6.65, 1.08, OFFWHITE, TEAL_MID, 0.5)
txt(s, "Why this matters", 6.56, 5.58, 2.0, 0.20, size=9.5, bold=True, color=TEAL)
txt(s, "Every completed report improves the structured dataset, which improves future report generation and makes higher-value intelligence products more credible.",
    6.56, 5.88, 6.05, 0.42, size=9.2, color=DARK, wrap=True)

footer(s, "S4 · Business Model")

# ══════════════════════════════════════════════════════════════════════════════
# S7 — MARKET SIZE
# ══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
bg(s)
left_bar(s, NAVY)
slide_kicker(s, "MARKET SIZE",
             "Focused Oil & Gas Entry, Larger Industrial Inspection TAM", NAVY)

txt(s, "Use a narrow entry wedge first, then expand the same structured workflow into adjacent asset-heavy inspections.",
    0.55, 1.28, 12.4, 0.28, size=10.5, color=MID)

# Left: TAM / SAM / SOM ladder
txt(s, "Addressable ladder", 0.55, 1.72, 2.4, 0.22, size=10, bold=True, color=NAVY)
LADDER = [
    ("TAM", "USD 1.9B–6.5B", "Industrial inspection workflow + report layer", TEAL),
    ("SAM", "USD 36M–134M", "Digitally ready oil & gas inspection workflows", TEAL_DIM),
    ("SOM", "USD 0.9M–7.1M", "3-year beachhead in oil & gas tank inspection", NAVY),
]
for i, (label, value, desc, accent) in enumerate(LADDER):
    t = 2.06 + i * 1.22
    w = 6.40 - i * 0.72
    l = 0.55 + i * 0.36
    rect(s, l, t, w, 0.92, accent)
    txt(s, label, l+0.14, t+0.12, 1.1, 0.22, size=10, bold=True, color=WHITE)
    txt(s, value, l+1.20, t+0.10, 2.55, 0.26, size=20, bold=True, color=WHITE)
    txt(s, desc, l+3.88, t+0.12, w-4.02, 0.44, size=8.8, color=TEAL_LT)

rect(s, 0.55, 5.86, 6.20, 0.54, TEAL_LT, TEAL_MID, 0.5)
txt(s, "Illustrative sizing based on device, seat, and report-generation layers.",
    0.78, 6.02, 5.80, 0.22, size=8.6, color=TEAL, italic=True)

# Right: revenue pools and assumptions
txt(s, "Revenue pools inside the wedge", 7.10, 1.72, 3.4, 0.22, size=10, bold=True, color=NAVY)
POOLS = [
    ("Report generation", "USD 900M–3.6B / yr", AMBER, 0.94),
    ("Field devices", "USD 1.0B–3.0B", TEAL, 0.78),
    ("Subscriptions", "USD 30M–144M / yr", TEAL_DIM, 0.42),
]
for i, (label, value, accent, rel) in enumerate(POOLS):
    t = 2.06 + i * 1.06
    rect(s, 7.10, t, 5.55, 0.86, OFFWHITE, TEAL_MID, 0.4)
    txt(s, label, 7.26, t+0.10, 2.10, 0.20, size=9.4, bold=True, color=DARK)
    rect(s, 7.26, t+0.42, 4.95 * rel, 0.22, accent)
    txt(s, value, 7.38, t+0.42, 4.70, 0.18, size=8.8, bold=True,
        color=WHITE if rel > 0.55 else DARK)

rect(s, 7.10, 5.40, 5.55, 1.10, OFFWHITE, TEAL_MID, 0.5)
txt(s, "Assumptions", 7.28, 5.58, 1.4, 0.20, size=9.5, bold=True, color=TEAL)
bullet_pts(s, [
    "USD 5k certified field device",
    "USD 50–80 user subscription per year",
    "USD 50–300 per report package",
], 7.28, 5.88, 5.0, gap=0.24, size=8.8)

rect(s, 0.55, 6.70, 12.62, 0.04, LGRAY)
txt(s, "Expansion industries:", 0.55, 6.80, 1.8, 0.20, size=8.8, bold=True, color=NAVY)
INDS = ["Oil & Gas", "Chemical", "Petrochemical", "Power", "Mining", "Marine", "Utilities", "Heavy Machinery"]
ix2 = 2.25
for ind in INDS:
    iw2 = len(ind)*0.076 + 0.20
    rect(s, ix2, 6.78, iw2, 0.26, TEAL_LT, TEAL_MID, 0.4)
    txt(s, ind, ix2+0.08, 6.80, iw2-0.14, 0.18, size=7.8, color=TEAL, bold=True)
    ix2 += iw2 + 0.08

footer(s, "S5 · Market Size")

# ══════════════════════════════════════════════════════════════════════════════
# S8 — EXPANSION ARCHITECTURE
# ══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
bg(s)
left_bar(s, TEAL)
slide_kicker(s, "EXPANSION STRATEGY",
             "From Report Generation to Asset Intelligence", TEAL)

txt(s, "The report is the entry point.   The asset knowledge base is the platform.",
    0.55, 1.26, 12.62, 0.26, size=10.5, bold=True, color=TEAL, italic=True)
rect(s, 0.55, 1.58, 12.62, 0.04, LGRAY)

txt(s, "Three horizons, one data spine", 0.55, 1.78, 3.0, 0.22, size=10, bold=True, color=NAVY)

HORIZONS = [
    ("1", "Report-ready workflow", "Win the inspection workflow and the report package", "Per-device + per-report", TEAL),
    ("2", "Structured asset memory", "Accumulate inspection history across tanks, contractors, and cycles", "Subscription / dashboard", TEAL_DIM),
    ("3", "Reliability intelligence", "Turn structured history into weak-point, life, and maintenance signals", "Premium enterprise module", AMBER),
]
for i, (num, title, body, monetise, accent) in enumerate(HORIZONS):
    l = 0.55 + i * 4.22
    rect(s, l, 2.12, 3.82, 3.10, OFFWHITE, TEAL_MID, 0.5)
    rect(s, l, 2.12, 3.82, 0.06, accent)
    ellipse(s, l+0.18, 2.28, 0.42, 0.42, accent)
    txt(s, num, l+0.18, 2.28, 0.42, 0.42, size=11, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    txt(s, title, l+0.72, 2.24, 2.80, 0.28, size=11.5, bold=True, color=DARK)
    rect(s, l+0.18, 2.72, 3.42, 0.03, LGRAY)
    txt(s, body, l+0.18, 2.90, 3.42, 0.88, size=9.2, color=MID, wrap=True)
    rect(s, l+0.18, 4.36, 2.30, 0.26, accent)
    txt(s, monetise, l+0.26, 4.41, 2.14, 0.16, size=7.8, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    if i < 2:
        txt(s, "▶", l+3.92, 3.56, 0.28, 0.24, size=16, bold=True, color=TEAL_MID, align=PP_ALIGN.CENTER)

rect(s, 0.55, 5.58, 12.62, 0.04, LGRAY)
txt(s, "Expansion industries", 0.55, 5.72, 2.0, 0.20, size=8.8, bold=True, color=NAVY)
INDS2 = ["Oil & Gas", "Chemical", "Petrochemical", "Power", "Mining", "Marine", "Utilities", "Heavy Machinery"]
ix3 = 2.18
for ind in INDS2:
    iw3 = len(ind)*0.078 + 0.18
    rect(s, ix3, 5.70, iw3, 0.26, TEAL_LT, TEAL_MID, 0.4)
    txt(s, ind, ix3+0.08, 5.72, iw3-0.14, 0.18, size=7.8, bold=True, color=TEAL)
    ix3 += iw3 + 0.08

rect(s, 0.55, 6.14, 12.62, 0.62, NAVY, TEAL_DIM, 0.4)
txt(s, "Expansion principle: keep the same structured capture and report spine, then add higher-value memory and intelligence layers on top.",
    0.82, 6.32, 12.0, 0.22, size=10.2, bold=True, color=TEAL_LT, align=PP_ALIGN.CENTER)

footer(s, "S6 · Expansion")

# ══════════════════════════════════════════════════════════════════════════════
# S9 — MOAT
# ══════════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
bg(s, NAVY)
rect(s, 0, 0, 0.40, 7.5, TEAL)
rect(s, 0.40, 0, 0.08, 7.5, TEAL_DIM)

if os.path.exists(LOGO):
    lh=0.26; lw=lh*(930/430)
    s.shapes.add_picture(LOGO, I(0.62), I(0.20), width=I(lw), height=I(lh))

txt(s, "COMPETITIVE MOAT", 0.62, 0.20, 12.5, 0.24, size=8.5, bold=True, color=TEAL)
txt(s, "Every Report Builds the Customer's Asset Intelligence",
    0.62, 0.42, 12.5, 0.70, size=26, bold=True, color=WHITE)
rect(s, 0.62, 1.16, 12.55, 0.04, TEAL_DIM)

txt(s, "Compounding moat loop", 0.62, 1.34, 2.4, 0.20, size=9.5, bold=True, color=TEAL_LT)
ellipse(s, 3.22, 2.66, 2.70, 1.22, TEAL_LT, TEAL_DIM)
txt(s, "Structured\nAsset Memory", 3.54, 2.96, 2.06, 0.56, size=15, bold=True, color=TEAL, align=PP_ALIGN.CENTER)

rect(s, 0.88, 2.06, 1.90, 0.76, TEAL)
txt(s, "Captured\nData", 1.00, 2.22, 1.66, 0.30, size=11, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
txt(s, "UT · findings · photos", 1.00, 2.50, 1.66, 0.16, size=7.6, color=TEAL_LT, align=PP_ALIGN.CENTER)

rect(s, 6.34, 2.06, 1.90, 0.76, AMBER)
txt(s, "Better\nReports", 6.46, 2.22, 1.66, 0.30, size=11, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
txt(s, "faster, more consistent", 6.46, 2.50, 1.66, 0.16, size=7.6, color=AMBER_LT, align=PP_ALIGN.CENTER)

rect(s, 0.88, 4.06, 1.90, 0.76, NAVY2)
txt(s, "Higher\nRetention", 1.00, 4.22, 1.66, 0.30, size=11, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
txt(s, "workflow becomes sticky", 1.00, 4.50, 1.66, 0.16, size=7.6, color=TEAL_LT, align=PP_ALIGN.CENTER)

rect(s, 6.34, 4.06, 1.90, 0.76, TEAL_DIM)
txt(s, "Intelligence\nModules", 6.46, 4.22, 1.66, 0.30, size=11, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
txt(s, "life · weak points · FMEA", 6.46, 4.50, 1.66, 0.16, size=7.2, color=TEAL_LT, align=PP_ALIGN.CENTER)

txt(s, "▶", 2.86, 2.30, 0.28, 0.22, size=16, bold=True, color=TEAL_MID, align=PP_ALIGN.CENTER)
txt(s, "▼", 7.06, 3.08, 0.28, 0.22, size=16, bold=True, color=TEAL_MID, align=PP_ALIGN.CENTER)
txt(s, "◀", 2.86, 4.30, 0.28, 0.22, size=16, bold=True, color=TEAL_MID, align=PP_ALIGN.CENTER)
txt(s, "▲", 1.56, 3.04, 0.28, 0.22, size=16, bold=True, color=TEAL_MID, align=PP_ALIGN.CENTER)

txt(s, "Why this is hard to copy", 8.94, 1.34, 3.6, 0.20, size=9.5, bold=True, color=TEAL_LT)
MOAT_CARDS = [
    ("Customer-specific report logic", "Templates and evidence logic embed inside the workflow."),
    ("Inspection history", "Every cycle adds more context than a static report archive."),
    ("Model tuning from real field data", "Better structured data improves future AI output quality."),
    ("Workflow lock-in", "Once the report package is trusted, replacement becomes harder."),
]
for i, (title, body) in enumerate(MOAT_CARDS):
    t = 1.62 + i * 1.00
    rect(s, 8.94, t, 3.98, 0.82, NAVY2, TEAL_DIM, 0.5)
    rect(s, 8.94, t, 3.98, 0.05, TEAL)
    txt(s, title, 9.10, t+0.10, 3.66, 0.22, size=9.2, bold=True, color=WHITE)
    txt(s, body, 9.10, t+0.38, 3.66, 0.28, size=8.2, color=PALE, wrap=True)

rect(s, 0.62, 5.46, 12.30, 0.74, TEAL)
txt(s, "Generic AI can generate text. LAIQ's moat comes from owning the structured inspection memory behind every report.",
    0.92, 5.70, 11.7, 0.24, size=11.2, bold=True, color=WHITE, align=PP_ALIGN.CENTER)

footer(s, "S7 · Moat")

# ══════════════════════════════════════════════════════════════════════════════
prs.save(OUT)
print(f"✅  Saved → {OUT}")
