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
export async function rasterizeInlineSvgs(html: string): Promise<string> {
  if (typeof document === "undefined") return html;
  if (!html.includes("<svg")) return html;

  const host = document.createElement("div");
  host.innerHTML = html;

  const svgs = Array.from(host.querySelectorAll("svg"));
  if (svgs.length === 0) return html;

  for (const svg of svgs) {
    const svgText = new XMLSerializer().serializeToString(svg);
    // Encode fully so the data URI survives html2canvas's re-serialization.
    const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;

    const img = await loadImage(dataUri);
    const width = svg.getAttribute("width") ? parseFloat(svg.getAttribute("width")!) : img.naturalWidth;
    const height = svg.getAttribute("height") ? parseFloat(svg.getAttribute("height")!) : img.naturalHeight;

    // Render at 2× for crisp bars on the printed label, then downscale.
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * 2));
    canvas.height = Math.max(1, Math.round(height * 2));
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const png = canvas.toDataURL("image/png");

    const imgEl = document.createElement("img");
    imgEl.src = png;
    imgEl.width = Math.round(width);
    imgEl.height = Math.round(height);
    imgEl.alt = "barcode";
    imgEl.style.display = "block";
    imgEl.style.width = `${width}px`;
    imgEl.style.height = `${height}px`;
    svg.replaceWith(imgEl);
  }

  return host.innerHTML;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to rasterize SVG image"));
    img.src = src;
  });
}
