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

/* ── EAN-13 ─────────────────────────────────────────────────── */

const L_CODES = [
  "0001101", "0011001", "0010011", "0111101", "0100011",
  "0110001", "0101111", "0111011", "0110111", "0001011",
];
const G_CODES = [
  "0100111", "0110011", "0011011", "0100001", "0011101",
  "0111001", "0000101", "0010001", "0001001", "0010111",
];
/** R code for digit d = bitwise complement of L_CODES[d]. */
const R_CODES = L_CODES.map((l) =>
  l.split("").map((b) => (b === "0" ? "1" : "0")).join(""),
);
/** Parity pattern for the first digit (L/G mix for digits 2–7). */
const FIRST_PARITY = [
  "LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG",
  "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL",
];

/** Strips spaces/dashes/prefix noise so barcode lookups are forgiving. */
export function normalizeBarcode(value: string): string {
  return value.replace(/[^0-9A-Za-z$%+\-./ ]/g, "").trim();
}

/**
 * EAN-13 check digit for the first 12 digits.
 * Odd positions (1,3,5,7,9,11) weight 1, even positions weight 3.
 */
export function ean13CheckDigit(first12: string): number {
  const digits = first12.replace(/\D/g, "").slice(0, 12);
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const d = Number(digits[i]);
    sum += (i % 2 === 0 ? 1 : 3) * d;
  }
  return (10 - (sum % 10)) % 10;
}

/** True when the value is a valid 13-digit EAN-13 with a correct check digit. */
export function isEan13(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 13) return false;
  return ean13CheckDigit(digits.slice(0, 12)) === Number(digits[12]);
}

/**
 * Generates a unique 13-digit EAN-13 code (12 random digits + computed check
 * digit) so it scans as a real retail barcode on any reader.
 */
export async function generateEan13(
  exists: (code: string) => Promise<boolean>,
): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    let first12 = "";
    for (let i = 0; i < 12; i++) first12 += Math.floor(Math.random() * 10).toString();
    const code = `${first12}${ean13CheckDigit(first12)}`;
    if (!(await exists(code))) return code;
  }
  // Extremely unlikely: fall back to a time-based 12-digit prefix.
  const first12 = (Date.now().toString().padStart(12, "0")).slice(-12);
  return `${first12}${ean13CheckDigit(first12)}`;
}

/* ── Code 39 (fallback for non-EAN values) ──────────────────── */

/** 9-element patterns (5 bars + 4 spaces), 1 = wide, 0 = narrow. */
const CODE39: Record<string, string> = {
  "0": "000110100", "1": "100100001", "2": "001100001", "3": "101100000",
  "4": "000110001", "5": "100110000", "6": "001110000", "7": "000100101",
  "8": "100100100", "9": "001100100",
  A: "100001001", B: "001001001", C: "101001000", D: "000011001",
  E: "100011000", F: "001011000", G: "000001101", H: "100001100",
  I: "001001100", J: "000011100", K: "100000011", L: "001000011",
  M: "101000010", N: "000010011", O: "100010010", P: "001010010",
  Q: "000000111", R: "100000110", S: "001000110", T: "000010110",
  U: "110000001", V: "011000001", W: "111000000", X: "010010001",
  Y: "110010000", Z: "011010000",
  "-": "010000101", ".": "110000100", " ": "011000100",
  "$": "010101000", "/": "010100010", "+": "010001010", "%": "000101010",
  "*": "010010100",
};

/** Code 39 start/stop marker pattern (also the fallback for unknown chars). */
const CODE39_STAR = "010010100";

function code39Pattern(value: string): string {
  const clean = value.toUpperCase().replace(/[^0-9A-Z\-.\s$%+/]/g, "").slice(0, 60);
  if (!clean) return "";
  const chars = clean.split("");
  // Start/stop marker + inter-character narrow gap.
  const parts: string[] = [];
  for (const ch of ["*", ...chars, "*"]) {
    parts.push(CODE39[ch] ?? CODE39_STAR);
  }
  return parts.join("0"); // narrow gap between characters
}

/* ── SVG generation ─────────────────────────────────────────── */

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

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Builds `<rect>` markup for a list of [x, width] bars of the given height. */
function barsToSvg(
  bars: { x: number; width: number }[],
  height: number,
  color: string,
  scale: number,
): string {
  return bars
    .map((b) =>
      `<rect x="${b.x * scale}" y="0" width="${b.width * scale}" height="${height}" fill="${color}"/>`,
    )
    .join("");
}

/**
 * EAN-13 SVG from a 13-digit value. 95 modules wide; 1 module = 1px.
 * Includes the value in the standard position under the bars.
 */
export function ean13Svg(value: string, opts: BarcodeSvgOptions = {}): string {
  const digits = value.replace(/\D/g, "");
  const height = opts.height ?? 40;
  const color = opts.color ?? "#000";
  const showText = opts.showText ?? true;
  const scale = opts.scale ?? 1;
  const fontSize = opts.fontSize ?? 9;

  const first = Number(digits[0]);
  const parity = FIRST_PARITY[Number.isFinite(first) ? first : 0] ?? "LLLLLL";
  const left = digits.slice(1, 7).split("");
  const right = digits.slice(7, 13).split("");

  let modules = "101"; // left guard
  left.forEach((d, i) => {
    const table = parity[i] === "L" ? L_CODES : G_CODES;
    modules += table[Number(d)];
  });
  modules += "01010"; // centre guard
  right.forEach((d) => {
    modules += R_CODES[Number(d)];
  });
  modules += "101"; // right guard

  const width = modules.length; // 95
  const bars: { x: number; width: number }[] = [];
  let i = 0;
  while (i < modules.length) {
    if (modules[i] === "1") {
      let run = 1;
      while (i + run < modules.length && modules[i + run] === "1") run++;
      bars.push({ x: i, width: run });
      i += run;
    } else {
      i++;
    }
  }

  const textHeight = showText ? 12 : 0;
  const scaledWidth = width * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${scaledWidth}" height="${height}" viewBox="0 0 ${scaledWidth} ${height}">${barsToSvg(bars, height - textHeight, color, scale)}${showText ? `<text x="${scaledWidth / 2}" y="${height - 2}" text-anchor="middle" font-family="monospace" font-size="${fontSize}" fill="${color}">${esc(digits)}</text>` : ""}</svg>`;
}

/**
 * Code 39 SVG — fallback for values that aren't 13-digit EAN-13. Handles
 * alphanumeric + `- . space $ / + %`. Wide elements are 2× narrow.
 */
export function code39Svg(value: string, opts: BarcodeSvgOptions = {}): string {
  const height = opts.height ?? 40;
  const color = opts.color ?? "#000";
  const showText = opts.showText ?? true;
  const scale = opts.scale ?? 1;
  const fontSize = opts.fontSize ?? 9;
  const pattern = code39Pattern(value);

  let modules = "";
  for (const bit of pattern) modules += bit === "1" ? "11" : "1"; // wide = 2× narrow

  const bars: { x: number; width: number }[] = [];
  let i = 0;
  while (i < modules.length) {
    if (modules[i] === "1") {
      let run = 1;
      while (i + run < modules.length && modules[i + run] === "1") run++;
      bars.push({ x: i, width: run });
      i += run;
    } else {
      i++;
    }
  }
  const width = modules.length;
  const textHeight = showText ? 12 : 0;
  const scaledWidth = width * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${scaledWidth}" height="${height}" viewBox="0 0 ${scaledWidth} ${height}">${barsToSvg(bars, height - textHeight, color, scale)}${showText ? `<text x="${scaledWidth / 2}" y="${height - 2}" text-anchor="middle" font-family="monospace" font-size="${fontSize}" fill="${color}">${esc(value)}</text>` : ""}</svg>`;
}

/**
 * Renders the right symbology for a barcode value:
 * 13-digit EAN-13 → EAN-13; anything else → Code 39.
 */
export function barcodeSvg(value: string, opts: BarcodeSvgOptions = {}): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 13) return ean13Svg(digits, opts);
  return code39Svg(value, opts);
}
