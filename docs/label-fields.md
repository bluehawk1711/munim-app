# Label Print Fields Reference

Single source of truth for every configurable field in the thermal label printer
(TSC TE244) and the HTML label sheet. All values live in
`packages/core/src/billing/labelDefaults.ts`.

**Stable commit:** `3110c44` — restore to this commit if label layout breaks.

---

## Label layout

### Silver label
```
┌────────────────────────────┬────────────────────────────┐
│  Product Name              │                            │
│  (nameY)                   │        BARCODE             │
│                            │        (barcodeX, barcodeY)│
│  100 gm                    │                            │
│  p: ₹12,500               │                            │
└────────────────────────────┴────────────────────────────┘
  LEFT (~24%)                   RIGHT (~76%)
```

### Gold label
```
┌────────────────────────────┬────────────────────────────┐
│  Product Name              │                            │
│  (goldNameY / nameY)       │        BARCODE             │
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
| `nameY` | `30` | Silver + Gold | Y position of product name. For Gold, overridden by `goldNameY` if > 0. |
| `goldNameY` | `30` | Gold only | Y position of product name on gold labels. `0` = fall back to `nameY`. |
| `weightY` | `67` | Silver only | Y position of weight text below the name. |
| `goldFieldsStartY` | `60` | Gold only | Y where the first row of weight fields begins (below name). |
| `goldColY` | `0` | Gold only | ± nudge the entire gold field block up/down from `goldFieldsStartY`. |
| `goldLineSpacing` | `22` | Gold only | Vertical spacing between rows of weight fields (dots). |
| `goldColSpacing` | `96` | Gold only | Horizontal gap between left and right weight columns (dots). |
| `barcodeX` | `295` | Both | X position of barcode. `0` = auto-computed (right side). |
| `barcodeY` | `65` | Both | Y position of barcode. `0` = vertically centered. |
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

With defaults (`goldFieldsStartY=60`, `goldLineSpacing=22`, `goldColY=0`):

```
Row 0 (Y=60):   weight (left)     |  G:xx (right)
Row 1 (Y=82):   NR:xx (left)      |  N:xx (right)
Row 2 (Y=104):  C:xx (left)       |  Net:xx (right)
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
| `useDefaults` | `false` | When `true`, all position/visibility values from `DEFAULT_LABEL_PRINT_SETTINGS` are used. Locally saved values and dialog edits are ignored at print time. |

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

Silver labels show: **product name** (large), **weight** (medium), **selling price** (medium, prefixed `p:`). No "- sil" suffix — weight fields already distinguish gold from silver, and the suffix wastes horizontal space needed for the larger silver font.

```
TEXT leftMargin, nameY,     "0", 0, nameSize,   nameSize,   "Product Name"
TEXT leftMargin, weightY,   "0", 0, weightSize,  weightSize, "24.5 gm"
TEXT leftMargin, priceY,    "0", 0, weightSize,  weightSize, "p: ₹12,500"
BARCODE barcodeX, barcodeY, "128", height, hri, 0, narrow, wide, "BARCODE"
```

**Font sizes** (silver):
- `nameSize`: capped at `h × 0.26` (~11pt), fitting within the text area width. Dominant text.
- `weightSize`: `h × 0.20` (~9pt). Secondary text.

**Price:** Only shown when `sellingPrice > 0`. Formatted as `p: ₹XX,XXX` (Indian comma grouping). Positioned at `weightY + weightSize × 3.2` below the weight.

## Gold label — TEXT commands

Gold labels show: **product name** + purity, then weight + up to 5 weight fields in 2 columns. No selling price.

```
TEXT leftMargin, effectiveNameY, "0", 0, nameSize,  nameSize,  "Product Name 92.5"
TEXT leftMargin, autoY+nudge,    "0", 0, smallSize, smallSize, "100 gm"
TEXT leftMargin, autoY+nudge,    "0", 0, smallSize, smallSize, "G:10.5"
TEXT leftMargin, autoY+nudge,    "0", 0, smallSize, smallSize, "N:2.3"
TEXT leftMargin, autoY+nudge,    "0", 0, smallSize, smallSize, "NR:560"
TEXT leftMargin, autoY+nudge,    "0", 0, smallSize, smallSize, "C:1.2"
TEXT leftMargin, autoY+nudge,    "0", 0, smallSize, smallSize, "Net:7.0"
BARCODE barcodeX, barcodeY, "128", height, hri, 0, narrow, wide, "BARCODE"
```

**Font sizes** (gold):
- `nameSize`: capped at `h × 0.30` (~13pt), fitting within the text area width.
- `smallSize`: `h × 0.16` (~7pt). All weight fields use this smaller size to fit in 15mm.

---

## Key differences — Gold vs Silver

| Aspect | Gold | Silver |
|--------|------|--------|
| Name size | `h × 0.30` (capped by width) | `h × 0.26` (capped by width) |
| Weight/field size | `h × 0.16` (small) | `h × 0.20` (medium) |
| Weight fields | 2-column layout, up to 6 entries | Single weight line |
| Selling price | Not shown | Shown (`p: ₹XX,XXX`) |
| Purity | Appended to name | Appended to name |
| "- sil" suffix | No | No |

---

## Files

| File | Role |
|------|------|
| `packages/core/src/billing/labelDefaults.ts` | Type + default values (single source of truth) |
| `packages/core/src/billing/labelTspl.ts` | TSPL2 command builder (`buildLabelTspl2`) |
| `packages/core/src/billing/labelDocument.ts` | HTML label sheet renderer + `ProductLabel` type + `buildProductLabel()` |
| `packages/ui/src/components/label-print-dialog.tsx` | Print dialog UI (shared web + desktop) |
| `apps/desktop/src/lib/printer.ts` | Desktop thermal print bridge + localStorage |
| `apps/desktop/src/pages/settings.tsx` | Settings → Printing (useDefaults toggle) |
| `apps/desktop/src/pages/products.tsx` | Products page — label print + gold/silver filter |
| `apps/web/src/views/products-view.tsx` | Web products — label print |
