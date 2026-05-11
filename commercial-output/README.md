# Tank Inspection Copilot — Commercial Output

## Files

### BD Deck (Business Development)
| File | Description |
|------|-------------|
| `build_deck_v3.py` | Main BD deck generator — 13 slides, LAIQ brand, ATEX PDA on S13 |
| `Tank_Inspection_Copilot_BD_Deck_V3.pptx` | Latest BD deck output |
| `gen_pda.py` | Generates `atex_pda_mockup.png` — composites LAIQ dashboard UI into real hardware photo |
| `atex_pda_mockup.png` | Rugged tablet mockup with LAIQ dashboard (used in S13) |
| `pda_landscape.jpg` | Source hardware photo (front-facing landscape rugged tablet) |
| `laiq_logo.png` | LAIQ brand logo (930×430, used in footers and mockup) |
| `WhatsApp Image 2026-04-27 at 21.43.31.jpeg` | LAIQ dashboard UI screenshot (composited into tablet screen) |

### BP Deck (Investor Business Proposal)
| File | Description |
|------|-------------|
| `bp_output/build_bp.py` | 9-slide investor BP deck generator |
| `bp_output/LAIQ_Investor_BP.pptx` | Latest BP deck output |

### Screenshots
`screenshots/` — App UI screenshots used in deck visuals (07_shellut_readings.png, 05_taskboard.png, etc.)

## Regenerating

```bash
cd /Users/oscar/Documents/oscar-code/tank-inspection-coplilot/commercial-output

# Regenerate PDA mockup (update UI image or hardware frame)
python3 gen_pda.py

# Regenerate BD deck
python3 build_deck_v3.py

# Regenerate BP (investor) deck
python3 bp_output/build_bp.py
```

## Serving for download

```bash
# HTTP server already running at port 8765
# Download at: http://100.101.225.110:8765/
```

## Key constants (build_deck_v3.py)

- `LOGO` — path to laiq_logo.png
- `PDA_IMG` — path to atex_pda_mockup.png  
- `UI_IMG` in gen_pda.py — swap this to change the app screenshot on the tablet screen
- `pda_landscape.jpg` — swap this to change the hardware frame photo
