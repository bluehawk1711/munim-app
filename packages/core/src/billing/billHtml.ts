/**
 * HTML bill renderer — mobile's print path (expo-print) renders the SAME
 * Classic Jewellery / Modern E-commerce templates that web & desktop print
 * via jsPDF (`generateBillPDF`), driven by the same BillTemplateSettings
 * (template, classic colour, WEIGHT column, gold/silver rate rows below the
 * date). One design, two renderers — colours come from `billTheme.ts`.
 */
import { formatCurrency } from "../utils/format.js";
import {
  mergeBillTemplateSettings,
  rateRowsOf,
} from "./billDocument.js";
import type { BillClassicColor, BillDocument, BillLine, BillTemplateSettings } from "./billDocument.js";
import { BILL_FONT_BOLD_B64, BILL_FONT_ITALIC_B64, BILL_FONT_REGULAR_B64 } from "./billFonts.js";
import { BILL_SEAL_DATA_URI } from "./billSeal.js";
import { classicColors, ecommerceColors, rgb } from "./billTheme.js";

const esc = (s: string | null | undefined): string =>
  (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** "24.5g" / "24500mg" — WEIGHT column display (dash when no snapshot). */
const weightText = (l: BillLine): string =>
  l.weight == null ? "-" : `${l.weight}${l.weightUnit === "mg" ? "mg" : "g"}`;

const rateRowHtml = (rows: string[]): string =>
  rows.map((r) => `<div class="rate">${esc(r)}</div>`).join("");

function docStart(title: string, css: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<style>${css}</style>
</head>
<body>`;
}

/** Shared page scaffolding: A4 print margins matching the PDF's 8mm frame. */
const PAGE_CSS = `
  @font-face { font-family: 'MunimBill'; font-style: normal; font-weight: 400;
    src: url(data:font/ttf;base64,${BILL_FONT_REGULAR_B64}) format('truetype'); }
  @font-face { font-family: 'MunimBill'; font-style: normal; font-weight: 700;
    src: url(data:font/ttf;base64,${BILL_FONT_BOLD_B64}) format('truetype'); }
  @font-face { font-family: 'MunimBill'; font-style: italic; font-weight: 400;
    src: url(data:font/ttf;base64,${BILL_FONT_ITALIC_B64}) format('truetype'); }
  @page { size: A4; margin: 8mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'MunimBill', sans-serif; }
  @media screen { body { padding: 16px; background: #f3f3f3; } }
  .money { letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
  .c { text-align: center; }
  .r { text-align: right; }
`;

/* ------------------------------------------------------------------ */
/* Classic Jewellery template                                          */
/* ------------------------------------------------------------------ */

const CLASSIC_CSS = `
${PAGE_CSS}
  .classic { position: relative; background: #fff; color: #1a1a1a; border: 3px solid var(--p); padding: 16px 20px 20px; }
  .classic::before { content: ""; position: absolute; inset: 5px; border: 1px solid var(--a); pointer-events: none; }
  .corner { position: absolute; width: 16px; height: 16px; z-index: 1; }
  .corner::after { content: ""; position: absolute; width: 5px; height: 5px; background: var(--p); transform: rotate(45deg); }
  .corner.tl { top: 8px; left: 8px; border-top: 2px solid var(--p); border-left: 2px solid var(--p); }
  .corner.tl::after { top: -3px; left: -3px; }
  .corner.tr { top: 8px; right: 8px; border-top: 2px solid var(--p); border-right: 2px solid var(--p); }
  .corner.tr::after { top: -3px; right: -3px; }
  .corner.bl { bottom: 8px; left: 8px; border-bottom: 2px solid var(--p); border-left: 2px solid var(--p); }
  .corner.bl::after { bottom: -3px; left: -3px; }
  .corner.br { bottom: 8px; right: 8px; border-bottom: 2px solid var(--p); border-right: 2px solid var(--p); }
  .corner.br::after { bottom: -3px; right: -3px; }
  .watermark { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-family: 'MunimBill'; font-weight: 700; font-size: 170px; color: #f5f5f5; pointer-events: none; z-index: 0; }
  .topbar { position: relative; text-align: center; min-height: 16px; z-index: 1; }
  .ph { position: absolute; left: 0; top: 2px; font-size: 12px; font-weight: 700; color: var(--d); }
  .blessing { font-family: 'MunimBill'; font-style: italic; color: var(--p); font-size: 13px; }
  .shop { position: relative; z-index: 1; text-align: center; font-family: 'MunimBill'; font-weight: 700; font-size: 34px; color: var(--s); margin-top: 4px; line-height: 1.1; }
  .shop-rule { position: relative; z-index: 1; width: 130px; height: 2px; background: var(--p); margin: 7px auto 0; }
  .banner { position: relative; z-index: 1; display: block; width: max-content; margin: 9px auto 0; background: var(--p); color: #fff; font-weight: 700; font-size: 13px; padding: 4px 26px; border-radius: 6px; }
  .addr { position: relative; z-index: 1; text-align: center; color: var(--d); font-size: 13px; margin-top: 10px; }
  .divider { border-top: 2px solid var(--a); margin-top: 10px; }
  .meta { position: relative; z-index: 1; display: flex; justify-content: space-between; color: var(--p); font-weight: 700; font-size: 15px; margin-top: 13px; }
  .rate { position: relative; z-index: 1; text-align: right; color: var(--p); font-weight: 700; font-size: 12px; margin-top: 3px; }
  .cust { position: relative; z-index: 1; margin-top: 11px; color: var(--d); font-size: 13px; line-height: 1.75; }
  table.items { position: relative; z-index: 1; width: 100%; border-collapse: collapse; margin-top: 13px; }
  table.items th { background: var(--p); color: #fff; font-size: 13px; padding: 7px 9px; text-align: left; font-weight: 700; }
  table.items td { padding: 14px 9px; font-size: 13px; border-bottom: 1px solid var(--a); vertical-align: top; line-height: 1.35; }
  .pname { font-weight: 700; }
  .pdesc { font-size: 11px; font-style: italic; color: #666; font-weight: 400; }
  table.totals { width: 300px; margin: 12px 0 0 auto; font-size: 13px; border-collapse: collapse; }
  table.totals td { padding: 3px 6px; }
  .grand-box { position: relative; z-index: 1; display: flex; justify-content: space-between; align-items: center; gap: 12px; width: 300px; margin: 8px 0 0 auto; background: var(--s); color: #fff; border-radius: 6px; padding: 8px 12px; font-weight: 700; font-size: 15px; }
  .words { position: relative; z-index: 1; width: 300px; margin: 8px 0 0 auto; font-family: 'MunimBill'; font-style: italic; font-size: 12px; color: var(--d); }
  .sign { position: relative; z-index: 1; display: flex; justify-content: space-between; align-items: flex-end; margin-top: 34px; }
  .thanks { font-family: 'MunimBill'; font-style: italic; font-size: 13px; color: var(--p); padding-bottom: 4px; }
  .seal { position: relative; width: 194px; }
  .seal img { display: block; width: 100%; height: auto; }
  .seal-line { position: absolute; left: 30%; right: 13%; top: 72%; border-top: 1.5px solid var(--d); }
`;

function renderClassicHtml(
  bill: BillDocument,
  s: BillTemplateSettings,
  color: BillClassicColor,
): string {
  const theme = classicColors[color];
  const vars = `--p:${rgb(theme.primary)};--s:${rgb(theme.secondary)};--a:${rgb(theme.accent)};--d:${rgb(theme.dark)}`;
  const showWeight = s.weightAfterName;
  const rates = rateRowHtml(rateRowsOf(bill, s));
  const hasExtras = bill.deliveryCharge > 0 || bill.discount > 0;

  const rows = bill.lines
    .map(
      (l, i) => `<tr>
        <td><span class="pname">${esc(l.productName)}</span>${
        l.description ? `<div class="pdesc">${esc(l.description)}</div>` : ""
      }</td>
        ${showWeight ? `<td class="c">${weightText(l)}</td>` : ""}
        <td class="c">${l.quantity}</td>
        <td class="c money">${formatCurrency(l.price)}</td>
        <td class="r money"><b>${formatCurrency(l.total)}</b></td>
      </tr>`,
    )
    .join("");

  const extrasRows = hasExtras
    ? `<table class="totals">
        <tr><td>Subtotal:</td><td class="r money">${formatCurrency(bill.subtotal)}</td></tr>
        ${
          bill.deliveryCharge > 0
            ? `<tr><td>Delivery:</td><td class="r money">${formatCurrency(bill.deliveryCharge)}</td></tr>`
            : ""
        }
        ${
          bill.discount > 0
            ? `<tr><td>Discount:</td><td class="r money">- ${formatCurrency(bill.discount)}</td></tr>`
            : ""
        }
      </table>`
    : "";

  return `${docStart(`Bill ${bill.billNo}`, CLASSIC_CSS)}
<div class="classic" style="${vars}">
  <span class="corner tl"></span><span class="corner tr"></span>
  <span class="corner bl"></span><span class="corner br"></span>
  <div class="watermark">JW</div>
  <div class="topbar">
    <span class="ph">Ph: ${esc(bill.shop.phones[0] ?? "")}</span>
    <span class="blessing">|| JAI SHREE SHYAM ||</span>
  </div>
  <div class="shop">${esc(bill.shop.name)}</div>
  <div class="shop-rule"></div>
  <div class="banner">Gold &amp; Silver Jewellery Experts</div>
  <div class="addr">Add: ${esc(bill.shop.address ?? "")}</div>
  <div class="divider"></div>
  <div class="meta"><span>Bill No: ${esc(bill.billNo)}</span><span>Date: ${esc(bill.date)}</span></div>
  ${rates}
  <div class="cust">
    <div>Customer: ${esc(bill.customerName || "________________________________")}</div>
    <div>Address: ${esc(bill.customerAddress || "________________________________")}</div>
    ${bill.customerPhone ? `<div>Phone: ${esc(bill.customerPhone)}</div>` : ""}
  </div>
  <table class="items">
    <thead><tr>
      <th>NAME</th>${showWeight ? `<th class="c">WEIGHT</th>` : ""}
      <th class="c">QTY</th><th class="c">RATE</th><th class="r">AMOUNT</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  ${extrasRows}
  <div class="grand-box"><span>GRAND TOTAL:</span><span class="money">${formatCurrency(bill.total)}</span></div>
  <div class="words">${esc(bill.amountInWords)}</div>
  <div class="sign">
    <div class="thanks">Thank you for your purchase!</div>
    <div class="seal">
      <img src="${BILL_SEAL_DATA_URI}" alt="" />
      <span class="seal-line"></span>
    </div>
  </div>
</div>
</body>
</html>`;
}

/* ------------------------------------------------------------------ */
/* Modern E-commerce template                                           */
/* ------------------------------------------------------------------ */

const ECOMMERCE_CSS = `
${PAGE_CSS}
  .ecom { background: #fff; color: ${rgb(ecommerceColors.text)}; border: 2px solid ${rgb(ecommerceColors.gold)}; padding: 4px; }
  .ecom::before { content: ""; }
  .inner { border: 1px solid ${rgb(ecommerceColors.lightGray)}; outline: 1px solid ${rgb(ecommerceColors.mediumGray)}; outline-offset: -3px; padding: 0 0 14px; }
  .head { display: flex; justify-content: space-between; gap: 14px; background: ${rgb(ecommerceColors.primary)}; color: #fff; padding: 14px 18px; }
  .shop { font-size: 24px; font-weight: 700; }
  .haddr, .htel { color: ${rgb(ecommerceColors.gold)}; font-size: 11px; margin-top: 3px; }
  .head-r { text-align: right; }
  .inv { color: ${rgb(ecommerceColors.gold)}; font-size: 26px; font-weight: 700; line-height: 1; }
  .billno { font-size: 13px; margin-top: 4px; }
  .bdate { color: ${rgb(ecommerceColors.gold)}; font-size: 11px; margin-top: 3px; }
  .rate { text-align: right; color: ${rgb(ecommerceColors.goldDark)}; font-weight: 700; font-size: 11px; margin-top: 4px; padding: 0 14px; }
  .billto { padding: 12px 18px 0; }
  .billto-label { color: ${rgb(ecommerceColors.gold)}; font-size: 12px; font-weight: 700; display: inline-block; border-bottom: 1px solid ${rgb(ecommerceColors.gold)}; padding-bottom: 2px; }
  .cname { font-size: 15px; font-weight: 700; color: ${rgb(ecommerceColors.text)}; margin-top: 8px; }
  .cdetail { font-size: 11px; color: ${rgb(ecommerceColors.mediumGray)}; margin-top: 3px; }
  table.items { width: calc(100% - 36px); margin: 12px 18px 0; border-collapse: collapse; }
  table.items th { background: ${rgb(ecommerceColors.lightGray)}; color: ${rgb(ecommerceColors.primary)}; font-size: 11px; padding: 7px 9px; text-align: left; font-weight: 700; border-bottom: 1px solid ${rgb(ecommerceColors.mediumGray)}; }
  table.items td { padding: 7px 9px; font-size: 12px; border-bottom: 1px solid #eee; }
  table.items tr.alt td { background: #fcfcfd; }
  .pname { font-weight: 700; color: ${rgb(ecommerceColors.text)}; }
  .totals { width: 300px; margin: 12px 18px 0 auto; font-size: 12px; color: ${rgb(ecommerceColors.mediumGray)}; border-collapse: collapse; }
  .totals td { padding: 3px 6px; }
  .totalbox { display: flex; justify-content: space-between; align-items: center; gap: 12px; width: 300px; margin: 8px 18px 0 auto; background: ${rgb(ecommerceColors.primary)}; color: #fff; border-radius: 8px; padding: 9px 14px; font-weight: 700; font-size: 14px; }
  .totalbox .amt { color: ${rgb(ecommerceColors.gold)}; font-size: 16px; }
  .words { margin: 14px 18px 0; font-size: 11px; font-style: italic; color: ${rgb(ecommerceColors.mediumGray)}; }
  .seal-foot { width: 150px; margin: 14px auto 0; }
  .seal-foot img { display: block; width: 100%; height: auto; }
  .foot { margin: 16px 18px 0; padding-top: 8px; border-top: 1px solid ${rgb(ecommerceColors.mediumGray)}; text-align: center; }
  .foot .ty { font-size: 11px; font-style: italic; color: ${rgb(ecommerceColors.mediumGray)}; }
  .foot .em { font-size: 10px; color: ${rgb(ecommerceColors.primary)}; margin-top: 4px; }
`;

function renderEcommerceHtml(bill: BillDocument, s: BillTemplateSettings): string {
  const showWeight = s.weightAfterName;
  const rates = rateRowHtml(rateRowsOf(bill, s));

  const rows = bill.lines
    .map(
      (l, i) => `<tr${i % 2 === 1 ? ' class="alt"' : ""}>
        <td><span class="pname">${esc(l.productName)}</span>${
        l.description ? `<div class="pdesc">${esc(l.description)}</div>` : ""
      }</td>
        ${showWeight ? `<td class="c">${weightText(l)}</td>` : ""}
        <td class="c">${l.quantity}</td>
        <td class="c money">${formatCurrency(l.price)}</td>
        <td class="r money"><b>${formatCurrency(l.total)}</b></td>
      </tr>`,
    )
    .join("");

  return `${docStart(`Bill ${bill.billNo}`, ECOMMERCE_CSS)}
<div class="ecom">
 <div class="inner">
  <div class="head">
    <div class="head-l">
      <div class="shop">${esc(bill.shop.name)}</div>
      <div class="haddr">${esc(bill.shop.address ?? "")}</div>
      <div class="htel">Tel: ${esc(bill.shop.phones.join(" | "))}</div>
    </div>
    <div class="head-r">
      <div class="inv">INVOICE</div>
      <div class="billno">#${esc(bill.billNo)}</div>
      <div class="bdate">Date: ${esc(bill.date)}</div>
    </div>
  </div>
  ${rates}
  <div class="billto">
    <span class="billto-label">BILL TO:</span>
    <div class="cname">${esc(bill.customerName || "-")}</div>
    ${bill.customerAddress ? `<div class="cdetail">${esc(bill.customerAddress)}</div>` : ""}
    ${bill.customerPhone ? `<div class="cdetail">${esc(bill.customerPhone)}</div>` : ""}
  </div>
  <table class="items">
    <thead><tr>
      <th>PRODUCT</th>${showWeight ? `<th class="c">WEIGHT</th>` : ""}
      <th class="c">QTY</th><th class="c">PRICE</th><th class="r">TOTAL</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <table class="totals">
    <tr><td>Subtotal:</td><td class="r money">${formatCurrency(bill.subtotal)}</td></tr>
    ${
      bill.deliveryCharge > 0
        ? `<tr><td>Delivery:</td><td class="r money">${formatCurrency(bill.deliveryCharge)}</td></tr>`
        : ""
    }
    ${
      bill.discount > 0
        ? `<tr><td>Discount:</td><td class="r money">- ${formatCurrency(bill.discount)}</td></tr>`
        : ""
    }
  </table>
  <div class="totalbox"><span>TOTAL</span><span class="amt money">${formatCurrency(bill.total)}</span></div>
  <div class="words">${esc(bill.amountInWords)}</div>
  <div class="seal-foot"><img src="${BILL_SEAL_DATA_URI}" alt="" /></div>
  <div class="foot">
    <div class="ty">Thank you for your business!</div>
    ${bill.shop.email ? `<div class="em">${esc(bill.shop.email)}</div>` : ""}
  </div>
 </div>
</div>
</body>
</html>`;
}

/**
 * HTML render of a bill — the shared, print-friendly markup used by the
 * mobile app (expo-print). Renders the SAME template (Classic Jewellery /
 * Modern E-commerce) and display toggles as the web/desktop PDF renderer.
 * Omitted settings → defaults (Classic Jewellery, red, all toggles ON).
 */
export function renderBillHtml(bill: BillDocument, settings?: BillTemplateSettings): string {
  const s = mergeBillTemplateSettings(settings);
  return s.template === "ecommerce"
    ? renderEcommerceHtml(bill, s)
    : renderClassicHtml(bill, s, s.classicColor);
}
