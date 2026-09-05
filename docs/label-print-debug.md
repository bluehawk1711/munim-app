# Label Printing Debug History

Chronological record of label-printing issues on the shop's TSC TE244
thermal printer. The desktop app appends to
`~/Downloads/munim-print-debug.log` on every print, but the snippets
below are the historical breakpoints — keep this file up to date when
a new regression is caught and fixed.

## Current state — commit ab547ba (2026-09-02)

**Status: stable baseline, known minor issues.**

The barcode prints correctly, centered between the name and weight.
Font sizes (8pt name, 6pt weight) match the BarTender reference.
EAN-13 sends 12 digits, the printer adds the check digit, scanners
read it back cleanly.

**Known issue (open):** the three fields (name / barcode / weight) can
land on DIFFERENT physical labels when the gap sensor on the TE244 is
faint or the die-cut shape has long gaps. The TSPL2 stream itself is
correct (single `CLS`, three `TEXT`/`BARCODE` lines, one `PRINT`) — the
printer is over-feeding between draws. The most likely cause is one of:

  1. The label-size settings in Settings → Printing don't match the
     physical stock (try bumping `gapMm` from 2 to 3, or measuring the
     stock with calipers and updating width/height).
  2. The TE244's gap sensor is dirty or miscalibrated — run the
     printer's auto-calibration routine (hold the feed button at
     power-on until it flashes twice, or send `~JC` from the TSC
     console).
  3. The label stock has black marks on the back instead of a gap;
     in that case the printer needs `GAP` swapped for `BLINE` in the
     TSPL2 stream.

The next test print should capture a new `munim-print-debug.log` entry.
Compare the `SIZE` and `GAP` lines against the actual stock to confirm.

## Environment
- Printer: **TSC TE244** (203 DPI, 8 dots/mm)
- Connection: Windows print spooler, RAW datatype (no driver rasterization)
- Old software: TSC BarTender UltraLite (used as reference for font/positioning)
- Stock: 45 × 30 mm thermal labels, 2 mm gap

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
