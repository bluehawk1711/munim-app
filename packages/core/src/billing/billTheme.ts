/**
 * Bill template colour themes — ONE source of truth shared by the jsPDF
 * renderer (`generateBillPdf.ts`, web/desktop print) and the HTML renderer
 * (`billHtml.ts`, mobile print) so both presentations can never drift apart.
 */

export type RgbTuple = [number, number, number];

/** CSS `rgb(r,g,b)` string from a tuple. */
export const rgb = (c: RgbTuple): string => `rgb(${c[0]},${c[1]},${c[2]})`;

/** Color themes for the classic jewellery template. */
export const classicColors = {
  red: {
    primary: [180, 40, 50] as RgbTuple,
    secondary: [140, 20, 30] as RgbTuple,
    accent: [220, 80, 80] as RgbTuple,
    dark: [100, 20, 25] as RgbTuple,
  },
  yellow: {
    primary: [180, 140, 50] as RgbTuple,
    secondary: [150, 110, 30] as RgbTuple,
    accent: [220, 180, 80] as RgbTuple,
    dark: [120, 90, 20] as RgbTuple,
  },
};

export type ClassicTheme = (typeof classicColors)["red"];

/** E-commerce theme colors (luxury dark/gold). */
export const ecommerceColors = {
  primary: [15, 23, 42] as RgbTuple,
  gold: [180, 150, 80] as RgbTuple,
  goldDark: [140, 110, 50] as RgbTuple,
  lightGray: [248, 250, 252] as RgbTuple,
  mediumGray: [100, 116, 139] as RgbTuple,
  text: [30, 41, 59] as RgbTuple,
  white: [255, 255, 255] as RgbTuple,
};
