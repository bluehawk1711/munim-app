# TSPL2 Programming Reference

## Source
TSC Bar Code Printer Series Programming Manual (TSPL/TSPL2)
- https://files.digicode.hu/tsc-printers-programming-manual-tspl-tspl2.pdf
- https://hackernoon.com/how-to-print-labels-with-tspl-and-javascript
- https://www.neodynamic.com/articles/How-to-print-raw-TSC-TSPL-TSPL2-commands-from-Javascript

## Key Facts

### Resolution
- **203 DPI**: 1 mm = 8 dots (TE244 default)
- **300 DPI**: 1 mm = 11.8 dots
- Coordinates are in **dots**, not mm or inches
- Only integer portion is used (e.g., 2 mm = 23.6 dots → 23 dots)

### DIRECTION Command (CRITICAL)
The `DIRECTION` command changes the origin point:

```
DIRECTION 0  → Origin (0,0) at TOP-LEFT, Y increases DOWNWARD (paper feed direction)
DIRECTION 1  → Origin (0,0) at BOTTOM-LEFT, Y increases UPWARD (opposite of paper feed)
```

**Example from manual:**
```
DIRECTION 0
CLS
TEXT 56,24,"3",0,1,1,"ABC"
PRINT 1

# With DIRECTION 0, text appears at top-left (x=56, y=24 dots from top)
```

```
DIRECTION 1
CLS
TEXT 56,24,"3",0,1,1,"ABC"
PRINT 1

# With DIRECTION 1, text appears at BOTTOM-LEFT (y=24 dots from BOTTOM)
```

**Rule**: If using DIRECTION 1, Y coordinates are measured from the BOTTOM of the label, not the top!

### Common Label Sizes (203 DPI)
| Size (mm) | Width (dots) | Height (dots) |
|-----------|--------------|---------------|
| 45 × 30  | 360          | 240           |
| 40 × 25  | 320          | 200           |
| 50 × 30  | 400          | 240           |
| 50 × 40  | 400          | 320           |

---

## Commands Reference

### SIZE
Set label size (in inches or mm).
```
SIZE 4,1           # 4 inches × 1 inch
SIZE 50 mm,25 mm   # 50mm × 25mm
```

### GAP
Set gap between labels (0,0 for continuous).
```
GAP 0,0      # Continuous label
GAP 2 mm,0   # 2mm gap between labels
```

### DIRECTION
Set printing direction and origin.
```
DIRECTION 0   # Normal (origin at top-left)
DIRECTION 1   # Reverse (origin at bottom-left)
```

### CLS
Clear image buffer. Must be called before adding new label content.
```
CLS
```

### TEXT
Print text on label.
```
TEXT x,y,"font",rotation,x-multiplication,y-multiplication,"content"
```

| Parameter | Description |
|-----------|-------------|
| x, y | Coordinates in dots (from origin based on DIRECTION) |
| font | Font number: 1-8 (1=small, 8=biggest), "0"=Monotype CG Triumvirate Bold (scalable) |
| rotation | 0, 90, 180, 270 (clockwise degrees) |
| x-multiplication | Horizontal scale factor 1-10 |
| y-multiplication | Vertical scale factor 1-10 |
| alignment | (optional) 1=left, 2=center, 3=right |
| content | Text to print (in quotes) |

**Examples:**
```
TEXT 10,10,"1",0,1,1,"Small Text"      # Font 1, no rotation, scale 1x1
TEXT 10,50,"2",0,1,1,"Medium Text"     # Font 2
TEXT 10,100,"3",0,1,1,"Large Text"     # Font 3
TEXT 10,150,"0",0,2,2,"Scalable Text"  # Font 0 (Monotype), 2x scale
TEXT 10,200,"2",0,1,1,2,"Centered"     # Font 2, center-aligned
```

**Font sizes (approximate at 203 DPI):**
| Font | Height | Width |
|------|--------|-------|
| 1    | ~2mm   | ~1.5mm|
| 2    | ~3mm   | ~2mm  |
| 3    | ~4mm   | ~3mm  |
| 4    | ~5mm   | ~4mm  |
| 5    | ~6mm   | ~5mm  |
| 6    | ~7mm   | ~5mm  |
| 7    | ~8mm   | ~6mm  |
| 8    | ~10mm  | ~7mm  |

### BARCODE
Print 1D barcode.
```
BARCODE x,y,"code_type",height,human_readable,rotation,narrow,wide,"content"
```

| Parameter | Description |
|-----------|-------------|
| x, y | Coordinates in dots |
| code_type | EAN13, EAN8, EAN128, 128, 39, 93, UPC-A, UPC-E, etc. |
| height | Barcode height in dots |
| human_readable | 0=not visible, 1=left-aligned, 2=center, 3=right |
| rotation | 0, 90, 180, 270 (clockwise degrees) |
| narrow | Width of narrow element in dots |
| wide | Width of wide element in dots |
| alignment | (optional) 1=left, 2=center, 3=right |
| content | Barcode data (in quotes) |

**Examples:**
```
BARCODE 10,10,"EAN13",80,2,0,2,4,"5218394436400"   # EAN-13, 80 dots tall, text below
BARCODE 10,100,"128",60,1,0,2,2,"PRODUCT-123"       # Code 128, 60 dots tall, text left
BARCODE 10,200,"39",50,2,0,1,3,"ABC123"              # Code 39, 50 dots tall, text center
```

**Barcode types:**
- `EAN13` - European Article Number (13 digits)
- `EAN8` - European Article Number (8 digits)
- `UPC-A` - Universal Product Code (12 digits)
- `UPC-E` - Universal Product Code (compressed)
- `128` - Code 128 (any ASCII)
- `39` - Code 39 (uppercase + digits + special)
- `93` - Code 93
- `EAN128` - GS1-128

**Narrow/Wide ratios:**
- `1,1` or `2,2` - Equal width (standard)
- `2,5` - Narrow:Wide = 2:5
- `1,3` - Narrow:Wide = 1:3

### QRCODE
Print QR code.
```
QRCODE x,y,"content",rotation,mode,version,error_correction
```

| Parameter | Description |
|-----------|-------------|
| x, y | Coordinates in dots |
| content | QR data (in quotes) |
| rotation | 0, 90, 180, 270 |
| mode | 0=auto, 1=numeric, 2=alphanumeric, 3=byte |
| version | 1-40 (size) |
| error_correction | L, M, Q, H |

### BOX
Draw rectangle.
```
BOX x,y,x_end,y_end,thickness
```

### LINE
Draw line.
```
LINE x,y,x_end,y_end,thickness
```

### PRINT
Print labels.
```
PRINT m,n    # Print m copies, n gap offset
PRINT 1      # Print 1 copy
```

### END
End of program (optional but recommended).
```
END
```

---

## Example: Complete Label

```
SIZE 45 mm,30 mm
GAP 2 mm,0
DIRECTION 0
CLS
TEXT 10,10,"2",0,1,1,"Product Name"
BARCODE 10,60,"EAN13",80,2,0,2,4,"5218394436400"
TEXT 10,170,"1",0,1,1,"24.5 g"
PRINT 1
END
```

---

## TE244 Specific Notes

- Resolution: 203 DPI
- Max print width: 108mm (864 dots)
- Max print length: 500mm
- Supports: TSPL/TSPL2 commands
- Font "0" (Monotype CG Triumvirate Bold) is scalable via x/y multiplication
- Barcodes are printed natively (no rasterization needed)
- HRI (Human Readable Interpretation) text is printed by the printer firmware

### Common Issues
1. **DIRECTION 1 inverts Y axis** - Use high Y values for top of label
2. **Font "0" is scalable** - Use multiplication factors for size control
3. **Rotation=90 may not work** on all firmware versions
4. **LINE command may not work** on some TE244 firmware
5. **EAN-13 expects 12 digits** - The printer calculates the check digit itself. Send `digits.slice(0, 12)`, not the full 13-digit code.
6. **Narrow/Wide for Code 128** - Use `narrow=1, wide=2` (not `2,4`) to fit barcodes in small label zones. At `2,4` a 12-char Code 128 is ~190 dots wide — too much for a 45mm label's right half.
7. **Font 0 at 3pt/2pt is too small** - On 45×30mm labels, use 7–8pt for names and 6–7pt for details. Below 6pt the text is barely readable on thermal stock.

### Recommended Layout for 45×30mm (203 DPI)
```
SIZE 45 mm,30 mm
GAP 2 mm,0
DIRECTION 0
CLS
TEXT 12,19,"0",0,8,8,"Product Name"
BARCODE 173,48,"EAN13",77,2,0,1,2,"521839443640"
TEXT 12,187,"0",0,7,7,"24.5 g"
PRINT 1
END
```
- Name: x=12, y=19 (2.4mm from top), font 0 scale 8 (~12mm tall)
- Barcode: x=173 (48% width), y=48, height=77 dots (32%), narrow=1, wide=2
- Weight: x=12, y=187 (23.4mm from top), font 0 scale 7 (~10.5mm tall)
- EAN-13: 12 digits only (printer adds check digit)
- Code 128 fallback: narrow=1, wide=2 (fits ~155 dots in right zone)

---

## TSC TE244 — Full Specification

### Hardware
| Spec | Value |
|---|---|
| Model | TSC TE244 |
| Resolution | 203 DPI (8 dots/mm) |
| Print method | Thermal Transfer + Direct Thermal |
| Max print width | 108mm (4.25", 864 dots) |
| Max print length | 1000mm (2890 dots at 203 DPI) |
| Print speed | Up to 6 ips (152 mm/s) |
| Media width | 20mm – 112mm |
| Memory | 8MB Flash, 16MB SDRAM |
| Interface | USB 2.0 |
| Programming language | TSPL/TSPL2 (TSPL-EZ) |

### Internal Fonts
| Font | Type | Notes |
|---|---|---|
| 1 | Bitmap | Smallest fixed font (~2mm) |
| 2 | Bitmap | ~3mm |
| 3 | Bitmap | ~4mm |
| 4 | Bitmap | ~5mm |
| 5 | Bitmap | ~6mm |
| 6 | Bitmap | ~7mm |
| 7 | Bitmap | ~8mm |
| 8 | Bitmap | ~10mm |
| "0" | **Scalable** | Monotype CG Triumvirate Bold Condensed. x/y params are **scale factors 1–10** (NOT point sizes). Base height ~12 dots (1.5mm) at 203 DPI, so scale 8 = ~96 dots (~12mm). |

### Supported Barcode Types
| Type | TSPL name | Notes |
|---|---|---|
| EAN-13 | `EAN13` | 12 data digits + auto check digit. narrow/wide **ignored** (fixed by ISO standard). |
| EAN-8 | `EAN8` | 7 data digits + auto check digit |
| UPC-A | `UPCA` | 11 data digits + auto check digit |
| UPC-E | `UPCE` | Compressed UPC |
| Code 128 | `128` | Any ASCII. narrow/wide **used** (module width). |
| Code 39 | `39` | Uppercase + digits + special. narrow/wide **used**. |
| Code 93 | `93` | Higher density than Code 39 |
| GS1-128 | `EAN128` | GS1 application identifiers |

### CODEPAGE Support
Standard TSPL codepages: `USA`, `UK`, `HEX8859-1` through `HEX8859-15`, `HEX037`, etc. The string `"UTF-8"` is **not** in the standard list — some firmware versions accept it, others silently ignore it. For ASCII-only labels (product names, weights), the codepage doesn't matter. For Hindi/Devanagari, verify firmware support or use a supported 8-bit codepage.

---

## TE244 Audit (2026-09-02)

Audit of Munim's `packages/core/src/billing/labelTspl.ts` against TSC TE244 specs.

### ✅ Verified Correct

| Item | Our code | TE244 spec | Verdict |
|---|---|---|---|
| Resolution | `dpi = 203` | 203 DPI | ✅ Match |
| DPI→dots | `mm × 203 / 25.4 = 8 dots/mm` | 8 dots/mm | ✅ Exact |
| SIZE command | `SIZE 45 mm,30 mm` | Supports mm format | ✅ Works |
| GAP command | `GAP 2 mm,0` | Standard TSPL | ✅ Works |
| DIRECTION | `DIRECTION 0` | Origin top-left, Y down | ✅ Correct |
| FONT "0" | Monotype scalable font | TE244 has it | ✅ Available |
| TEXT syntax | `TEXT x,y,"0",0,scale,scale,"text"` | Standard TSPL | ✅ Correct |
| EAN-13 digits | `digits.slice(0, 12)` | TSPL expects 12 data digits | ✅ Fixed |
| Code 128 narrow/wide | `1,2` | Fits in 45mm label right zone | ✅ Works |
| Empty barcode | Falls back to "NO BARCODE" text | N/A | ✅ Graceful |
| CLS | Clears buffer before each label | Standard TSPL | ✅ Correct |
| PRINT | `PRINT copies,1` | Standard TSPL | ✅ Correct |

### ⚠️ Known Issues (non-blocking)

| # | Issue | Impact | Fix |
|---|---|---|---|
| 1 | **`CODEPAGE UTF-8`** not in standard TSPL codepage list | Low — ASCII labels work regardless; Hindi would need firmware-verified codepage | Remove the command or make conditional |
| 2 | **Font scale comment says "points"** — they're actually scale factors 1–10 | Misleading comment only; code works correctly | Fix comment: "x/y multiplication factors (1–10), not points" |
| 3 | **EAN-13 narrow/wide params are ignored** by printer (fixed by ISO) | None — harmless values | Add comment clarifying they're ignored for EAN-13 |
| 4 | **Default `LABEL_WIDTH_MM = 63.5`** is for A4 sheets, not thermal stock | If `printer.ts` doesn't pass the saved size, wrong SIZE sent to printer | Verify `printer.ts` always passes `opts.widthMm/heightMm` from Settings |
| 5 | **No `END` command** | Low — `PRINT` flushes buffer; `END` is best practice | Add `END` at end of command stream |

### Font Scale Reference (Font "0" at 203 DPI)

The x/y multiplication factors for FONT "0" are **scale factors**, not point sizes:

| Scale | Height (dots) | Height (mm) | Use case |
|---|---|---|---|
| 1 | ~12 | ~1.5 | Too small |
| 2 | ~24 | ~3.0 | Tiny, barely readable |
| 3 | ~36 | ~4.5 | Small details |
| 4 | ~48 | ~6.0 | Compact labels |
| 5 | ~60 | ~7.5 | Good for weight/price |
| 6 | ~72 | ~9.0 | Balanced |
| 7 | ~84 | ~10.5 | Readable details |
| 8 | ~96 | ~12.0 | Product name |
| 9 | ~108 | ~13.5 | Large text |
| 10 | ~120 | ~15.0 | Header/title |

**Current Munim settings:** nameSize=8 (~12mm), weightSize=7 (~10.5mm). On a 30mm label, text takes 75% of vertical space — large but readable. Consider scale 6/5 for more compact labels.

### Code 128 Width at Different Narrow/Wide Ratios

For a 12-character Code 128 barcode (11 modules/char × 12 + 23 start/stop = 155 modules):

| Narrow, Wide | Module width (dots) | Total width (dots) | Total width (mm) | Fits in 45mm label? |
|---|---|---|---|---|
| 1, 1 | 1 | 155 | 19.4 | ✅ Yes |
| 1, 2 | 1 | 155 | 19.4 | ✅ Yes (our choice) |
| 2, 2 | 2 | 310 | 38.8 | ⚠️ Barely (right zone = 28mm) |
| 2, 3 | 2 | 310 | 38.8 | ❌ Overflow |
| 2, 4 | 2 | 310 | 38.8 | ❌ Overflow |
| 2, 5 | 2 | 310 | 38.8 | ❌ Overflow |

**Conclusion:** `narrow=1, wide=2` is the correct choice for small labels. The `2,4` ratio that some tutorials show is for 4-inch shipping labels, not 45mm product labels.

### EAN-13 Width

EAN-13 uses fixed module widths per ISO 13633 (ignores narrow/wide params):
- 95 modules × 0.33mm = **31.35mm** barcode width
- Plus quiet zones (~9.5mm left + 9.5mm right) = **~50mm total**
- On a 45mm label: the barcode alone is 31mm, leaving ~7mm on each side for quiet zones — **tight but scannable**
- Height of 77 dots = 9.6mm — **well above the 12.5mm minimum for reliable scanning**

### Layout Math (45×30mm, 203 DPI = 360×240 dots)

```
┌──────────────────────────────────────────┐ 0 dots (0mm)
│                                          │
│  Product Name     (y=19, scale 8)        │ 19 dots (2.4mm)
│  [~96 dots tall]                         │
│                                          │
│                     ┌─────────────────┐  │ 48 dots (6mm)
│                     │  ||||||||||||||| │  │
│                     │  ||||||||||||||| │  │ EAN-13: 77 dots
│                     │  521839443640   │  │ (9.6mm tall)
│                     └─────────────────┘  │ 125 dots (15.6mm)
│                                          │
│  24.5 g          (y=187, scale 7)        │ 187 dots (23.4mm)
│  [~84 dots tall]                         │
│                                          │ 240 dots (30mm)
└──────────────────────────────────────────┘
← 42% text →│← 52% barcode →
  x=12         x=173
```

**Overflow check:**
- Name bottom: 19 + 96 = 115 dots (< 240) ✅
- Barcode bottom: 48 + 77 = 125 dots (< 240) ✅
- Weight bottom: 187 + 84 = 271 dots (> 240) ⚠️ — weight text extends ~31 dots below label!

**This means the weight text is partially cut off at the bottom.** Fix: move weight Y up to ~155 dots (19.4mm) or reduce scale to 5 (~60 dots, fits at y=180).
