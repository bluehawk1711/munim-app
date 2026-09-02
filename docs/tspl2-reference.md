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
CODEPAGE UTF-8
CLS
TEXT 12,19,"0",0,8,8,"Product Name"
BARCODE 173,48,"EAN13",77,2,0,1,2,"521839443640"
TEXT 12,187,"0",0,7,7,"24.5 g"
PRINT 1
```
- Name: x=12, y=19 (2.4mm from top), font 0 at 8pt
- Barcode: x=173 (48% width), y=48, height=77 dots (32%), narrow=1, wide=2
- Weight: x=12, y=187 (23.4mm from top), font 0 at 7pt
- EAN-13: 12 digits only (printer adds check digit)
- Code 128 fallback: narrow=1, wide=2 (fits ~155 dots in right zone)
