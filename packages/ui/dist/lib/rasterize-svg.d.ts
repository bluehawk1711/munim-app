/**
 * Rasterize inline SVG → PNG data URIs (web + desktop label PDFs).
 *
 * jsPDF's `html()` renders through html2canvas, which cannot load inline
 * `<svg>` elements: it serializes them to a data URI and tries to load that
 * as an image, and the serialized markup (with Tailwind's computed CSS custom
 * properties inlined) fails → "Error loading svg data:image/svg+xml,…" in the
 * console and a blank barcode in the PDF.
 *
 * Fix: before handing the label sheet to jsPDF, replace every inline SVG with
 * a rasterized `<img src="data:image/png;base64,…">`. html2canvas loads PNG
 * data URIs natively, so the printed PDF matches the on-screen preview.
 *
 * The browser print path (`window.print`) and expo-print (mobile) keep the
 * original inline-SVG markup — they render SVG fine — so this helper is only
 * used by the web + desktop jsPDF download path.
 */
export declare function rasterizeInlineSvgs(html: string): Promise<string>;
//# sourceMappingURL=rasterize-svg.d.ts.map