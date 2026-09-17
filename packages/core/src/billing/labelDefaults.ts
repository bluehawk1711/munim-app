/**
 * Label defaults — single source of truth for all label print settings.
 *
 * Every consumer (core TSPL builder, HTML label sheet, desktop printer,
 * mobile print, UI dialog) imports from here so there's exactly one place
 * to change a default value.
 */

export type LabelPrintSettings = {
  /** Gap between labels in mm (0 for continuous stock). */
  gapMm: number;
  /** BARCODE human-readable interpretation: 0 = off, 1 = left, 2 = center, 3 = right. */
  hri: 0 | 1 | 2 | 3;
  /** Number of copies per label. */
  copies: number;
  /** Barcode narrow element width in dots. */
  narrow: number;
  /** Barcode wide element width in dots. */
  wide: number;
  /** Name text Y position in dots. */
  nameY: number;
  /** Weight text Y position in dots. */
  weightY: number;
  /** Left margin in mm. */
  leftMarginMm: number;
  /** Barcode X position in dots. */
  barcodeX: number;
  /** Barcode Y position in dots. */
  barcodeY: number;
  /** Include the product purity after its name. */
  showPurity: boolean;
  /** Gold label weight field visibility toggles. */
  showGrossWeight: boolean;
  showNagLessWeight: boolean;
  showNagRate: boolean;
  showChejatWeight: boolean;
  showNetWeight: boolean;
  /** Gold label weight field Y nudges (dots) from each field's auto-stacked
   *  position in its column. 0 = auto. */
  grossWeightY: number;
  nagLessWeightY: number;
  nagRateY: number;
  chejatWeightY: number;
  netWeightY: number;
  /** Y (dots) where the gold weight-fields column starts, below the name. */
  goldFieldsStartY: number;
  /** Name Y position for gold labels (dots). 0 = use nameY. */
  goldNameY: number;
  /** Column gap between left and right weight fields in gold labels (dots). */
  goldColSpacing: number;
  /** Global Y nudge (dots) for the entire gold weight-field block. Positive = down. */
  goldColY: number;
  /** Vertical spacing between rows in gold weight fields (dots). */
  goldLineSpacing: number;
  /** When true, ignore saved settings and always use these defaults. */
  useDefaults: boolean;
};

/** Default settings for the first print — easy to override in the dialog. */
export const DEFAULT_LABEL_PRINT_SETTINGS: LabelPrintSettings = {
  gapMm: 2,
  hri: 0,
  copies: 1,
  narrow: 2,
  wide: 3,
  nameY: 30,
  weightY: 67,
  goldFieldsStartY: 60,
  goldNameY: 30,
  goldColSpacing: 96,
  goldColY: 0,
  goldLineSpacing: 22,
  leftMarginMm: 3.5,
  barcodeX: 295,
  barcodeY: 65,
  showPurity: true,
  showGrossWeight: true,
  showNagLessWeight: true,
  showNagRate: true,
  showChejatWeight: true,
  showNetWeight: true,
  grossWeightY: 0,
  nagLessWeightY: 0,
  nagRateY: 0,
  chejatWeightY: 0,
  netWeightY: 0,
  useDefaults: false,
};
