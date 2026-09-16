Every TEXT command and which field controls its Y position
SILVER label — 2 TEXT commands
TEXT leftMargin, nameY,     "0", 0, nameSize,   nameSize,   "Product Name - sil"
TEXT leftMargin, weightY,   "0", 0, weightSize,  weightSize, "100 mg"
TEXT barcodeX,   barcodeY,  "0", 0, height,      narrow,     barcode
Text element	Field	Default
Product name	nameY	25
Weight	weightY	80
Barcode	barcodeY	30
GOLD label — up to 8 TEXT commands
TEXT leftMargin, effectiveNameY,     "0", 0, nameSize,  nameSize,  "Product Name"
TEXT leftMargin, autoY + nudge,     "0", 0, smallSize, smallSize, "100 mg"     ← weight
TEXT leftMargin, autoY + nudge,     "0", 0, smallSize, smallSize, "G:10.5"     ← gross
TEXT leftMargin, autoY + nudge,     "0", 0, smallSize, smallSize, "N:2.3"      ← nag less
TEXT leftMargin, autoY + nudge,     "0", 0, smallSize, smallSize, "NR:560"     ← nag rate
TEXT leftMargin, autoY + nudge,     "0", 0, smallSize, smallSize, "C:1.2"      ← chejat
TEXT leftMargin, autoY + nudge,     "0", 0, smallSize, smallSize, "Net:7.0"    ← net
TEXT barcodeX,   barcodeY,          "0", 0, height,    narrow,    barcode
Text element	Field	Default
Product name	goldNameY (if >0) else nameY	0 → falls back to nameY=25
Weight fields (all 5+weight)	Auto-stacked	—
Gold field Y formula breakdown
finalY = goldFieldsStartY + (row × goldLineSpacing) + goldColY + fieldNudge
Variable	Field	Default
goldFieldsStartY	Fields start Y	55
goldLineSpacing	Gold row gap	28
goldColY	Gold col Y nudge	0
goldColSpacing	Gold col gap	96
Per-field nudges (move individual fields from their auto-stacked position):
Field	Default
grossWeightY	0
nagLessWeightY	0
nagRateY	0
chejatWeightY	0
netWeightY	0
Round-robin column distribution
Fields are distributed alternating left/right:
Row 0:  weight (left)    | G:xx (right)
Row 1:  NR:xx (left)     | N:xx (right)
Row 2:  C:xx (left)      | Net:xx (right)
So row = Math.floor(fieldIndex / 2) for each column.
Print pipeline verification — ALL values flow correctly
Dialog printSettings
    ↓ handlePrint() → directPrint.onPrint(printSettings)
    ↓ handleLabelDirectPrint(printSettings)
    ↓ printLabelsToThermal(name, labels, copies, printSettings)
    ↓ ps = { ...getSavedLabelPrintSettings(), ...printSettings }
    ↓ buildLabelTspl2(labels, { ...size, copies, useDefaults, nameY, weightY,
        goldFieldsStartY, goldNameY, goldColSpacing, goldColY, goldLineSpacing,
        leftMarginMm, barcodeX, barcodeY, showPurity, showGrossWeight,
        showNagLessWeight, showNagRate, showChejatWeight, showNetWeight,
        grossWeightY, nagLessWeightY, nagRateY, chejatWeightY, netWeightY,
        gapMm, hri, narrow, wide })
    ↓ TSPL2 TEXT commands with correct Y values
Every field now passes through. The previous bug (missing goldNameY, goldColSpacing, goldColY, goldLineSpacing, useDefaults in printer.ts:147-171) is fixed.