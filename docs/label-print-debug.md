# Label Printing Debug History

Chronological record of label-printing issues on the shop's TSC TE244
thermal printer. The desktop app appends to
`~/Downloads/munim-print-debug.log` on every print, but the snippets
below are the historical breakpoints — keep this file up to date when
a new regression is caught and fixed.

## Current state — 2026-09-06 (101 × 15 mm wide-strip) ✅ STABLE

**Status: STABLE — all elements visible and correctly positioned.**

Label: 101 mm × 15 mm (SIZE 101 mm,15 mm), DIRECTION 1.
Weight "2.5 mg" at top-left, name "ring1" below it, barcode on right.
All three elements are visible, no overlap, no clipping.

### ⚠️ DIRECTION: MUST be 1 (confirmed by test-prints)
- **DIRECTION 0 mirrors/reverses the entire label** — text and barcode
  are flipped horizontally. NEVER use DIRECTION 0 on this printer.
- **DIRECTION 1 is the ONLY correct approach** for the TSC TE244.

### STABLE values (do NOT change without explicit request)
| Parameter | Value | Notes |
|-----------|-------|-------|
| SIZE | 101 mm, 15 mm | Wide strip, confirmed correct |
| **DIRECTION** | **1** | **MANDATORY — DIRECTION 0 reverses the label** |
| CODEPAGE | UTF-8 | |
| barcodeHeight | 60 dots | User-calibrated, fixed |
| barcodeY | centered | (h - barcodeHeight) / 2 |
| barcode narrow/wide | 1 / 3 | Code 128, narrower bars |
| nameY | 20 | Below weight (lower Y = lower on label) |
| weightY | 72 | Above name (higher Y = higher on label) |
| nameSize | toPt(h * 0.40) | ~17pt |
| weightSize | toPt(h * 0.25) | ~11pt |
| textAreaW | 24% of printable | ~23.6mm for name+weight |
| gapBetween | 2mm | Between text and barcode |
| leftMargin | 3.5mm | Pushed right to avoid left-edge clipping |
| rightMargin | 0.5mm | Pushed right so barcode reaches label edge |
| barcodeHRI | 0 (off) | No human-readable digits |
| barcodeCodepage | 128 (Code 128) | Not EAN-13 (12 digits) |

### Y-axis behavior (DIRECTION 1 on TSC TE244)
- Y=0 is at the BOTTOM of the label, Y increases UPWARD
- Y < ~5 clips at the physical bottom margin
- Higher Y = higher position on the label
- Confirmed by test: weightY=58 went above name, off the top of the label

## Environment
- Printer: **TSC TE244** (203 DPI, 8 dots/mm)
- Connection: Windows print spooler, RAW datatype (no driver rasterization)
- Old software: TSC BarTender UltraLite (used as reference for font/positioning)
- Stock: 45 × 30 mm thermal labels, 2 mm gap
- Currently: 101 × 15 mm wide strip label

## Working baseline (commit ac66510, 2026-08-26)
DIRECTION 1, single column at left margin, font "0" with point sizes,
six fields (shop / name / barcode / details / SKU / price). Barcode
visible, scannable, HRI digits below bars.

## Break: side-by-side layout (commits 0d2ecbd → c5dab51, 2026-09-02)
Switched to DIRECTION 0 and a text-left / barcode-right layout. Barcode
printed near the center of the label instead of the right; some labels
rendered with text overflowing the 30mm boundary. Fixed by later
commits, but the layout was wrong from the start.

## Break: oversized fonts + wrong truncate + EAN-13 digit count
The desktop build pushed at `7029197` produced this stream (captured
from `munim-print-debug.log`):

```
SIZE 45 mm,30 mm
GAP 2 mm,0
DIRECTION 1
CODEPAGE UTF-8
CLS
TEXT 12,216,"0",0,41,41,"ring1"          ← 41pt = ~14mm tall (label is 30mm)
BARCODE 12,180,"EAN13",67,2,0,2,4,"5213839443640"  ← 13 digits, TE244 rejects
TEXT 12,36,"0",0,32,32,"2.5 mg"          ← 32pt
PRINT 1,1
END
```

Result: weight text overlapped the barcode band; barcodes garbled
because the printer got 13 digits and a 14mm-tall name; short names
like `ring1` were truncated to `__b..` by an aggressive width budget.

Root causes:
- `toPt(dots) = (dots * dpi) / 72 / 1.5` had a stray `/ 1.5` that
  inflated font sizes 2.67×. Correct: `(dots * 72) / dpi`.
- `truncateToWidth` had a floor of 0, so 1-2 char names became `__..`.
- EAN-13 sent 13 digits; TSPL2 wants 12 (printer calculates check).

## Break: barcode + weight overlap (build after `1c6e5b7`)
After fixing the font / digit / truncate issues, the next test print
showed the barcode band and the "2.5 mg" weight line still
overlapping. Root cause: the BARCODE command was emitting the HRI
(human-readable digits) below the bars, which extended the band
~16 dots past `barcodeHeight` and collided with the weight text
directly underneath.

Fix shipped: set `human_readable=0` on the BARCODE command so the
barcode band is exactly `barcodeHeight` dots tall, and compute the
barcode Y so it is centered in the gap between name and weight.

## Current stream (expected, 45 × 30 mm @ 203 dpi, commit ab547ba)
```
SIZE 45 mm,30 mm
GAP 2 mm,0
DIRECTION 1
CODEPAGE UTF-8
CLS
TEXT 12,213,"0",0,8,8,"ring1"            ← 8pt, top of label
BARCODE 12,90,"EAN13",53,0,0,2,4,"521383944364"  ← 53 dots tall, no HRI
TEXT 12,4,"0",0,6,6,"2.5 mg"             ← 6pt, bottom of label
PRINT 1,1
END
```

## Break: DIRECTION 1 Y-flipping — weight and name positions reversed (2026-09-05)

After switching to 101 × 15 mm wide-strip labels with DIRECTION 1, the
Y-position math for TEXT/BARCODE was wrong repeatedly. The core confusion:

**In TSPL2, TEXT/BARCODE Y is always the TOP of the element, and the
element always extends DOWNWARD on the physical label.** The DIRECTION
command only changes where Y=0 sits:

| DIRECTION | Y=0 at | Y+ direction | Y near 0 = | Y near h = |
|-----------|--------|-------------|------------|------------|
| 0         | top    | downward    | top        | bottom     |
| 1         | bottom | upward      | bottom     | top        |

So for DIRECTION 1:
- name at top → `nameY = h - margin` (large Y = near top)
- weight at bottom → `weightY = weightHeight + margin` (small Y = near bottom)

**Failed attempts (do NOT repeat):**
1. `nameY = h - nameHeight - topMargin` → name appeared at center (text
   height estimate was wrong, or the Y interpretation was inverted).
2. `nameY = h - topMargin` → name disappeared entirely (text extended
   upward off the label — assumed Y was bottom of text, which was wrong).
3. `weightY = bottomMargin` → weight never appeared (same inversion).

**Current correct formulas (commit 9ef77ca):**
```ts
const nameY = direction === 0 ? topMargin : h - topMargin;
const weightY = direction === 0
  ? h - weightHeightDots - bottomMargin
  : weightHeightDots + bottomMargin;
const barcodeY = direction === 0
  ? Math.round((h - barcodeHeight) / 2)
  : Math.round((h + barcodeHeight) / 2);
```

## Break: percentage-based barcode height (2026-09-05)

`Math.round(h * 0.10)` / `0.80` / `0.95` all pushed the barcode
outside the label — the percentage was applied to the wrong axis or
the Y math inverted it. Fixed: `barcodeHeight = 40` (fixed dots).

## How to read the log
- Every entry is `[ISO-timestamp] | message`.
- `event=print_raw called printer="TSC TE244" bytes=N` is the first
  line of a print job.
- `--- OUTGOING TSPL2 STREAM ---` / `--- end stream ---` bracket the
  exact byte stream sent to the spooler, one command per line.
- `event=OpenPrinterW ok` / `StartDocPrinterW ok` / `WritePrinter ok`
  / `EndDocPrinter ok` are the spooler step outcomes. Any FAILED line
  is the most likely culprit when a print is blank or partial.

Log file: `~/Downloads/munim-print-debug.log`
