# Label Print Fields Reference

Single source of truth for every configurable field in the thermal label printer
(TSC TE244) and the HTML label sheet. All values live in
`packages/core/src/billing/labelDefaults.ts`.

---

## Label layout

```
┌────────────────────────────┬────────────────────────────┐
│  Product Name              │                            │
│  (nameY / goldNameY)       │        BARCODE             │
│                            │        (barcodeX, barcodeY)│
│ ── gold fields start ──    │                            │
│  weight        G:xx        │                            │
│  NR:xx         N:xx        │                            │
│  C:xx          Net:xx      │                            │
└────────────────────────────┴────────────────────────────┘
  LEFT (~24%)                   RIGHT (~76%)
```

**Label size:** 101 × 15 mm (120 dots at 203 DPI).

---

## Position fields (Y = dots from top, X = dots from left)

| Field | Default | Affects | Description |
|-------|---------|---------|-------------|
| `nameY` | `25` | Silver + Gold | Y position of product name. For Gold, overridden by `goldNameY` if > 0. |
| `goldNameY` | `25` | Gold only | Y position of product name on gold labels. `0` = fall back to `nameY`. |
| `weightY` | `80` | Silver only | Y position of weight text below the name. |
| `goldFieldsStartY` | `55` | Gold only | Y where the first row of weight fields begins (below name). |
| `goldColY` | `0` | Gold only | ± nudge the entire gold field block up/down from `goldFieldsStartY`. |
| `goldLineSpacing` | `28` | Gold only | Vertical spacing between rows of weight fields (dots). |
| `goldColSpacing` | `96` | Gold only | Horizontal gap between left and right weight columns (dots). |
| `barcodeX` | `305` | Both | X position of barcode. `0` = auto-computed (right side). |
| `barcodeY` | `30` | Both | Y position of barcode. `0` = vertically centered. |
| `leftMarginMm` | `3.5` | Both | Left margin in mm. Text starts here. |

---

## Gold weight field Y nudges

Each gold weight field has a **toggle** (show/hide) and a **Y nudge** (dots from
its auto-stacked position). `0` = auto-positioned.

| Toggle field | Y nudge field | Prefix on label | Description |
|---|---|---|---|
| `showGrossWeight` | `grossWeightY` | `G:` | Gross weight |
| `showNagLessWeight` | `nagLessWeightY` | `N:` | Nag less weight |
| `showNagRate` | `nagRateY` | `NR:` | Nag rate |
| `showChejatWeight` | `chejatWeightY` | `C:` | Chejat weight |
| `showNetWeight` | `netWeightY` | `Net:` | Net weight |

### Auto-stacking formula

```
finalY = goldFieldsStartY + (row × goldLineSpacing) + goldColY + fieldNudge
```

Fields are distributed round-robin into two columns:
- Left column: entries at index 0, 2, 4, ...
- Right column: entries at index 1, 3, 5, ...

Row = `Math.floor(indexInColumn)`.

---

## Gold field Y example

With defaults (`goldFieldsStartY=55`, `goldLineSpacing=28`, `goldColY=0`):

```
Row 0 (Y=55):   weight (left)     |  G:xx (right)
Row 1 (Y=83):   NR:xx (left)      |  N:xx (right)
Row 2 (Y=111):  C:xx (left)       |  Net:xx (right)
```

To move ALL gold fields down by 10 dots: set `goldColY = 10`.
To move ONLY gross weight down: set `grossWeightY = 10`.

---

## Printer settings

| Field | Default | Description |
|-------|---------|-------------|
| `gapMm` | `2` | Gap between labels in mm. `0` = continuous roll. |
| `hri` | `0` | Barcode human-readable digits. `0`=off, `1`=left, `2`=center, `3`=right. |
| `copies` | `1` | Number of physical labels per product. |
| `narrow` | `2` | Barcode narrow bar width (dots). |
| `wide` | `3` | Barcode wide bar width (dots). |
| `showPurity` | `true` | Append purity (e.g. "916") after product name. |

---

## Use defaults flag

| Field | Default | Description |
|-------|---------|-------------|
| `useDefaults` | `true` | When `true`, all position/visibility values from `DEFAULT_LABEL_PRINT_SETTINGS` are used. Locally saved values and dialog edits are ignored at print time. |

**Flow when `useDefaults: true`:**
1. `getSavedLabelPrintSettings()` returns `{ ...DEFAULT_LABEL_PRINT_SETTINGS, useDefaults: true }`
2. Dialog opens showing default values (inputs disabled)
3. `buildLabelTspl2()` replaces all opts with `DEFAULT_LABEL_PRINT_SETTINGS` (only keeps dpi, widthMm, heightMm, gapMm, direction, codepage, copies from caller)

**Flow when `useDefaults: false`:**
1. `getSavedLabelPrintSettings()` returns saved values from localStorage
2. Dialog opens showing saved values (inputs enabled)
3. User edits are passed to `buildLabelTspl2()` and used directly

---

## Silver label — TEXT commands

```
TEXT leftMargin, nameY,    "0", 0, nameSize,   nameSize,   "Product Name - sil"
TEXT leftMargin, weightY,  "0", 0, weightSize,  weightSize, "100 gm"
BARCODE barcodeX, barcodeY, "128", height, hri, 0, narrow, wide, "BARCODE"
```

## Gold label — TEXT commands

```
TEXT leftMargin, effectiveNameY, "0", 0, nameSize,  nameSize,  "Product Name"
TEXT leftMargin, autoY+nudge,    "0", 0, smallSize, smallSize, "100 gm"
TEXT leftMargin, autoY+nudge,    "0", 0, smallSize, smallSize, "G:10.5"
TEXT leftMargin, autoY+nudge,    "0", 0, smallSize, smallSize, "N:2.3"
TEXT leftMargin, autoY+nudge,    "0", 0, smallSize, smallSize, "NR:560"
TEXT leftMargin, autoY+nudge,    "0", 0, smallSize, smallSize, "C:1.2"
TEXT leftMargin, autoY+nudge,    "0", 0, smallSize, smallSize, "Net:7.0"
BARCODE barcodeX, barcodeY, "128", height, hri, 0, narrow, wide, "BARCODE"
```

---

## Files

| File | Role |
|------|------|
| `packages/core/src/billing/labelDefaults.ts` | Type + default values (single source of truth) |
| `packages/core/src/billing/labelTspl.ts` | TSPL2 command builder (`buildLabelTspl2`) |
| `packages/core/src/billing/labelDocument.ts` | HTML label sheet renderer |
| `packages/ui/src/components/label-print-dialog.tsx` | Print dialog UI (shared web + desktop) |
| `apps/desktop/src/lib/printer.ts` | Desktop thermal print bridge + localStorage |
| `apps/desktop/src/pages/settings.tsx` | Settings → Printing (useDefaults toggle) |
