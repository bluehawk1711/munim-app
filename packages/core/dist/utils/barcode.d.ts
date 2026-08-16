/**
 * Barcode utilities — pure TypeScript, zero dependencies.
 *
 * Every app (web, desktop, mobile) imports from here so the SAME barcode
 * renders everywhere:
 *   - `generateEan13`   → unique, structurally-valid EAN-13 codes (auto-assigned
 *                         to new products and backfilled for existing ones).
 *   - `barcodeSvg`      → a self-contained SVG string (bars only + optional
 *                         human-readable text). Web/desktop inject it as HTML,
 *                         mobile renders it via react-native-svg's SvgXml, and
 *                         label HTML embeds it inline for expo-print / jsPDF.
 *
 * Symbologies: EAN-13 (13-digit retail standard, has a check digit) for the
 * generated codes; Code 39 (alphanumeric, no check digit required) as a
 * fallback so manually-entered barcodes still print scannably.
 */
/** Strips spaces/dashes/prefix noise so barcode lookups are forgiving. */
export declare function normalizeBarcode(value: string): string;
/**
 * EAN-13 check digit for the first 12 digits.
 * Odd positions (1,3,5,7,9,11) weight 1, even positions weight 3.
 */
export declare function ean13CheckDigit(first12: string): number;
/** True when the value is a valid 13-digit EAN-13 with a correct check digit. */
export declare function isEan13(value: string): boolean;
/**
 * Generates a unique 13-digit EAN-13 code (12 random digits + computed check
 * digit) so it scans as a real retail barcode on any reader.
 */
export declare function generateEan13(exists: (code: string) => Promise<boolean>): Promise<string>;
export type BarcodeSvgOptions = {
    /** Overall height in px (bars + optional text). Default 40. */
    height?: number;
    /** Show the human-readable value under the bars. Default true. */
    showText?: boolean;
    /** Bar color. Default black. */
    color?: string;
    /** Module multiplier — wider bars for labels/print. Default 1. */
    scale?: number;
    /** Font size of the human-readable text. Default 9. */
    fontSize?: number;
};
/**
 * EAN-13 SVG from a 13-digit value. 95 modules wide; 1 module = 1px.
 * Includes the value in the standard position under the bars.
 */
export declare function ean13Svg(value: string, opts?: BarcodeSvgOptions): string;
/**
 * Code 39 SVG — fallback for values that aren't 13-digit EAN-13. Handles
 * alphanumeric + `- . space $ / + %`. Wide elements are 2× narrow.
 */
export declare function code39Svg(value: string, opts?: BarcodeSvgOptions): string;
/**
 * Renders the right symbology for a barcode value:
 * 13-digit EAN-13 → EAN-13; anything else → Code 39.
 */
export declare function barcodeSvg(value: string, opts?: BarcodeSvgOptions): string;
//# sourceMappingURL=barcode.d.ts.map