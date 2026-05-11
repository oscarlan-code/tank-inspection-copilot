"""
Composite LAIQ dashboard into the front-facing landscape rugged tablet photo.
Source: 61GNHHFzRxL.jpg  (1600×1600, front-facing, no perspective distortion)
Screen region: (288,607) → (1295,1202) = 1007×595 px
"""
import os, glob, numpy as np
from PIL import Image, ImageDraw

BASE    = os.path.dirname(os.path.abspath(__file__))
UI_IMG  = os.path.join(BASE, "WhatsApp Image 2026-04-27 at 21.43.31.jpeg")
OUT     = os.path.join(BASE, "atex_pda_mockup.png")

# ── Source: copy from Desktop using glob (filename has unicode narrow-space) ──
def get_src():
    # Try already-copied JPEG first
    local = os.path.join(BASE, "pda_landscape.jpg")
    if os.path.exists(local):
        return local
    patterns = [
        "/Users/oscar/Desktop/61GNHHFzRxL.jpg",
        "/Users/oscar/Desktop/61GNHHFzRxL*.jpg",
    ]
    for pat in patterns:
        hits = glob.glob(pat)
        if hits:
            import shutil
            shutil.copy(hits[0], local)
            return local
    raise FileNotFoundError("Cannot find 61GNHHFzRxL.jpg")

pda_path = get_src()

# ── Screen region coordinates (front-facing, true rectangle) ─────────────────
SX1, SY1 = 288, 607     # top-left  of screen
SX2, SY2 = 1295, 1202   # bottom-right of screen
SW = SX2 - SX1          # 1007
SH = SY2 - SY1          # 595

# ── Load hardware photo ───────────────────────────────────────────────────────
pda = Image.open(pda_path).convert("RGBA")
W, H = pda.size    # 1600 × 1600

# ── Build UI panel from LAIQ dashboard image ──────────────────────────────────
ui = Image.new("RGBA", (SW, SH), (12, 16, 16, 255))
if os.path.exists(UI_IMG):
    app = Image.open(UI_IMG).convert("RGBA")
    aw, ah = app.size
    # Fill screen (centre-crop)
    scale = max(SW / aw, SH / ah)
    nw, nh = int(aw * scale), int(ah * scale)
    app = app.resize((nw, nh), Image.LANCZOS)
    ox = (nw - SW) // 2
    oy = (nh - SH) // 2
    app = app.crop((ox, oy, ox + SW, oy + SH))
    ui.paste(app, (0, 0), app)

# Subtle glass sheen at top
glass = Image.new("RGBA", (SW, SH), (0, 0, 0, 0))
gd = ImageDraw.Draw(glass)
for y in range(min(16, SH)):
    a = int(15 * (1 - y / 16))
    gd.line([(0, y), (SW, y)], fill=(255, 255, 255, a))
ui = Image.alpha_composite(ui, glass)

# Rounded corners for screen
def rr_mask(size, r):
    w, h = size
    m = Image.new("L", size, 0)
    d = ImageDraw.Draw(m)
    d.rectangle([r, 0, w-r, h], fill=255)
    d.rectangle([0, r, w, h-r], fill=255)
    for cx, cy in [(0,0),(w-2*r,0),(0,h-2*r),(w-2*r,h-2*r)]:
        d.ellipse([cx, cy, cx+2*r, cy+2*r], fill=255)
    return m

ui.putalpha(rr_mask((SW, SH), 5))
pda.paste(ui, (SX1, SY1), ui)

# ── Remove white background → transparent ────────────────────────────────────
arr = np.array(pda)
r, g, b = arr[:,:,0], arr[:,:,1], arr[:,:,2]
white = (r > 235) & (g > 235) & (b > 235)
arr[white, 3] = 0
pda = Image.fromarray(arr)

# ── Crop to device content + padding ─────────────────────────────────────────
alpha = np.array(pda)[:, :, 3]
rows = np.any(alpha > 10, axis=1)
cols = np.any(alpha > 10, axis=0)
rmin, rmax = np.where(rows)[0][[0, -1]]
cmin, cmax = np.where(cols)[0][[0, -1]]
PAD = 24
pda = pda.crop((max(0, cmin-PAD), max(0, rmin-PAD),
                min(W, cmax+PAD+1), min(H, rmax+PAD+1)))

pda.save(OUT, "PNG")
print(f"Saved {OUT}  ({pda.size[0]}×{pda.size[1]})")
