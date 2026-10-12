/**
 * HTML bill renderer — mobile's print path (expo-print) renders the SAME
 * Classic Jewellery / Modern E-commerce templates that web & desktop print
 * via jsPDF (`generateBillPDF`), driven by the same BillTemplateSettings
 * (template, classic colour, WEIGHT column, gold/silver rate rows below the
 * date). One design, two renderers — colours come from `billTheme.ts`.
 */
import { formatCurrency } from "../utils/format.js";
import {
  estimateLabourTag,
  estimateRowOf,
  estimateWeightLayout,
  materialReturnedTitleOf,
  mergeBillTemplateSettings,
  nameWithPurity,
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
  .seal-line { position: absolute; left: 40%; right: 1.5%; top: 63.6%; border-top: 1.5px solid var(--d); }
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
  const hasExtras = bill.deliveryCharge > 0 || bill.discount > 0 || bill.materialReturnedValue > 0;

  const rows = bill.lines
    .map(
      (l, i) => `<tr>
        <td><span class="pname">${esc(nameWithPurity(l))}</span>${
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
        ${
          bill.materialReturnedValue > 0
            ? `<tr><td>${esc(materialReturnedTitleOf(bill))}${
                bill.materialReturnedWeight ? ` (${esc(bill.materialReturnedWeight)})` : ""
              }:</td><td class="r money">- ${formatCurrency(bill.materialReturnedValue)}</td></tr>`
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
  .inner { border: 1px solid ${rgb(ecommerceColors.lightGray)}; outline: 1px solid ${rgb(ecommerceColors.mediumGray)}; outline-offset: -3px; padding: 8px 5px 14px; }
  .letterhead { text-align: center; padding-top: 2px; }
  .letterhead .shop { font-size: 18px; font-weight: 700; color: ${rgb(ecommerceColors.primary)}; line-height: 1.1; }
  .letterhead .contact { font-size: 10px; color: ${rgb(ecommerceColors.mediumGray)}; margin-top: 3px; }
  .letterhead .est { font-size: 15px; font-weight: 700; color: ${rgb(ecommerceColors.primary)}; letter-spacing: 4px; margin-top: 7px; }
  .hbox { display: flex; border: 1px solid ${rgb(ecommerceColors.mediumGray)}; margin-top: 7px; min-height: 62px; }
  .hb-l { flex: 0 0 58.7%; padding: 5px 8px; border-right: 1px solid ${rgb(ecommerceColors.mediumGray)}; }
  .hb-r { flex: 1; padding: 5px 8px; text-align: right; }
  .hb-l .hlabel { font-size: 10.5px; font-weight: 700; color: ${rgb(ecommerceColors.primary)}; display: inline-block; border-bottom: 1px solid ${rgb(ecommerceColors.primary)}; padding-bottom: 2px; }
  .hb-l .cname { font-size: 13px; font-weight: 700; color: ${rgb(ecommerceColors.text)}; margin-top: 7px; }
  .hb-l .cdetail { font-size: 10.5px; color: ${rgb(ecommerceColors.mediumGray)}; margin-top: 3px; }
  .hb-l .phone { font-size: 10.5px; color: ${rgb(ecommerceColors.mediumGray)}; margin-top: 5px; }
  .hb-l .phone b { color: ${rgb(ecommerceColors.primary)}; margin-right: 6px; }
  .hb-r .vou { font-size: 11.5px; font-weight: 700; color: ${rgb(ecommerceColors.primary)}; }
  .hb-r .bdate { font-size: 11.5px; color: ${rgb(ecommerceColors.primary)}; margin-top: 5px; }
  .hb-r .rate { text-align: right; color: ${rgb(ecommerceColors.goldDark)}; font-weight: 700; font-size: 10px; margin-top: 4px; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 8px; table-layout: fixed; }
  table.items th, table.items td { border: 1px solid ${rgb(ecommerceColors.mediumGray)}; padding: 3px 4px; font-size: 10.5px; }
  table.items th { color: ${rgb(ecommerceColors.primary)}; font-weight: 700; text-align: center; background: transparent; font-size: 9.5px; white-space: nowrap; }
  table.items th.h-desc { text-align: left; }
  table.items th.h-amt, table.items td.amt { text-align: right; }
  table.items td { color: ${rgb(ecommerceColors.text)}; vertical-align: middle; }
  table.items td.c { text-align: center; }
  table.items td.num, table.items td.amt { text-align: right; font-variant-numeric: tabular-nums; }
  .pname { font-weight: 700; }
  .pdesc { font-size: 9px; font-style: italic; color: ${rgb(ecommerceColors.mediumGray)}; font-weight: 400; margin-top: 2px; }
  table.items tr.sum td { font-weight: 700; color: ${rgb(ecommerceColors.primary)}; }
  .adj { width: 65%; margin: 8px 0 0 auto; font-size: 10.5px; color: ${rgb(ecommerceColors.mediumGray)}; border-collapse: collapse; }
  .adj td { padding: 3px 2px; text-align: right; }
  .adj td.v { text-align: right; width: 110px; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .adj tr.closing td { font-weight: 700; color: ${rgb(ecommerceColors.primary)}; }
  .words { margin-top: 7px; font-size: 9.5px; font-style: italic; color: ${rgb(ecommerceColors.mediumGray)}; text-align: right; }
  .seal-foot { position: relative; width: 150px; margin: 14px 10px 0 auto; }
  .seal-foot img { display: block; width: 100%; height: auto; }
  .seal-foot .seal-line { position: absolute; left: 40%; right: 1.5%; top: 63.6%; border-top: 1px solid ${rgb(ecommerceColors.text)}; }
  .foot { margin: 16px 5px 0; padding-top: 8px; border-top: 1px solid ${rgb(ecommerceColors.mediumGray)}; text-align: center; }
  .foot .ty { font-size: 11px; font-style: italic; color: ${rgb(ecommerceColors.mediumGray)}; }
  .foot .em { font-size: 10px; color: ${rgb(ecommerceColors.primary)}; margin-top: 4px; }
`;

function renderEcommerceHtml(bill: BillDocument, s: BillTemplateSettings): string {
  const rates = rateRowHtml(rateRowsOf(bill, s));

  const estNum = (v: number, dp: number): string => v.toFixed(dp);

  // Gold bills keep the G. Wt./N. Wt. pair; silver-only bills show ONE
  // combined "Weight" column (gross weight is gold-only at this shop). The
  // Dia/Stn Wt. column (always "-") is gone; "Other Charges" carries the
  // frozen flat charges summed (nag + povayi + other). Widths total 100% in
  // both layouts.
  const split = estimateWeightLayout(bill) === "split";

  const rows = bill.lines
    .map((l) => {
      const est = estimateRowOf(l);
      const weightCells = split
        ? `<td class="c">${esc(l.grossWeight?.trim() || "-")}</td>
        <td class="c">${l.weight != null ? estNum(l.weight, 3) : "-"}</td>`
        : `<td class="c">${l.weight != null ? estNum(l.weight, 3) : esc(l.grossWeight?.trim() || "-")}</td>`;
      const labourText = est.labour != null ? `${estNum(est.labour, 2)}${estimateLabourTag(l)}` : "-";
      return `<tr>
        <td><span class="pname">${esc(nameWithPurity(l))}</span>${
          l.description ? `<div class="pdesc">${esc(l.description)}</div>` : ""
        }</td>
        ${weightCells}
        <td class="c">${l.quantity}</td>
        <td class="num">${estNum(est.rate, 2)}</td>
        <td class="num">${estNum(est.value, 2)}</td>
        <td class="num">${labourText}</td>
        <td class="num">${est.otherCharges != null && est.otherCharges > 0 ? estNum(est.otherCharges, 2) : "-"}</td>
        <td class="amt"><b>${estNum(l.total, 2)}</b></td>
      </tr>`;
    })
    .join("");

  const grossVals = bill.lines.map((l) => parseFloat(l.grossWeight ?? ""));
  const hasGross = grossVals.some((v) => !Number.isNaN(v));
  const sumGross = grossVals.reduce<number>((t, v) => t + (Number.isNaN(v) ? 0 : v), 0);
  const sumWeight = bill.lines.reduce<number>((t, l) => t + (l.weight ?? 0), 0);
  const labours = bill.lines.map((l) => estimateRowOf(l).labour);
  const hasLabour = labours.some((v) => v != null);
  const sumLabour = labours.reduce<number>((t, v) => t + (v ?? 0), 0);
  const otherChargess = bill.lines.map((l) => estimateRowOf(l).otherCharges);
  const hasOtherCharges = otherChargess.some((v) => v != null && v > 0);
  const sumOtherCharges = otherChargess.reduce<number>((t, v) => t + (v != null && v > 0 ? v : 0), 0);

  const adjRows: string[] = [];
  if (bill.discount > 0) {
    adjRows.push(`<tr><td>LESS:</td><td class="v">- ${estNum(bill.discount, 2)}</td></tr>`);
  }
  if (bill.materialReturnedValue > 0) {
    adjRows.push(
      `<tr><td>${esc(materialReturnedTitleOf(bill))}${
        bill.materialReturnedWeight ? ` (${esc(bill.materialReturnedWeight)})` : ""
      }:</td><td class="v">- ${estNum(bill.materialReturnedValue, 2)}</td></tr>`,
    );
  }
  if (bill.deliveryCharge > 0) {
    adjRows.push(`<tr><td>Delivery:</td><td class="v">+ ${estNum(bill.deliveryCharge, 2)}</td></tr>`);
  }
  if (bill.amountPaid > 0) {
    adjRows.push(`<tr><td>RECEIPT CASH:</td><td class="v">- ${estNum(bill.amountPaid, 2)}</td></tr>`);
  }
  adjRows.push(
    `<tr class="closing"><td>Closing Balance:</td><td class="v">${
      bill.dueAmount > 0 ? estNum(bill.dueAmount, 2) : "NIL"
    }</td></tr>`,
  );

  return `${docStart(`Bill ${bill.billNo}`, ECOMMERCE_CSS)}
<div class="ecom">
 <div class="inner">
  <div class="letterhead">
    <div class="shop">${esc(bill.shop.name)}</div>
    <div class="contact">${esc([bill.shop.address ?? "", bill.shop.phones.length ? `Tel: ${bill.shop.phones.join(" | ")}` : ""].filter(Boolean).join("  ·  "))}</div>
    <div class="est">ESTIMATE</div>
  </div>
  <div class="hbox">
    <div class="hb-l">
      <span class="hlabel">Customer Name &amp; Address :</span>
      <div class="cname">${esc(bill.customerName || "-")}</div>
      ${bill.customerAddress ? `<div class="cdetail">${esc(bill.customerAddress)}</div>` : ""}
      <div class="phone"><b>Ph #</b>${bill.customerPhone ? esc(bill.customerPhone) : ""}</div>
    </div>
    <div class="hb-r">
      <div class="vou">Vou.No.: ${esc(bill.billNo)}</div>
      <div class="bdate">Date : ${esc(bill.date)}</div>
      ${rates}
    </div>
  </div>
  <table class="items">
    <colgroup>${
      split
        ? `<col style="width:23%" /><col style="width:7%" /><col style="width:7%" />
      <col style="width:4.5%" /><col style="width:8.5%" /><col style="width:9%" />
      <col style="width:11.5%" /><col style="width:9.5%" /><col style="width:20%" />`
        : `<col style="width:27%" /><col style="width:9%" /><col style="width:5%" />
      <col style="width:9%" /><col style="width:10%" /><col style="width:13%" />
      <col style="width:11%" /><col style="width:16%" />`
    }</colgroup>
    <thead><tr>${
      split
        ? `<th class="h-desc">Description</th><th>G. Wt.</th><th>N. Wt.</th><th>Pcs.</th>
      <th>Rate ₹/gm</th><th>Value</th><th>Labour</th><th>Other Charges</th><th class="h-amt">Amount (Rupees)</th>`
        : `<th class="h-desc">Description</th><th>Weight</th><th>Pcs.</th>
      <th>Rate ₹/gm</th><th>Value</th><th>Labour</th><th>Other Charges</th><th class="h-amt">Amount (Rupees)</th>`
    }</tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr class="sum">
      <td></td>
      ${
        split
          ? `<td class="c">${hasGross ? estNum(sumGross, 3) : "-"}</td>
      <td class="c">${estNum(sumWeight, 3)}</td>`
          : `<td class="c">${estNum(sumWeight, 3)}</td>`
      }
      <td></td>
      <td></td>
      <td></td>
      <td class="num">${hasLabour ? estNum(sumLabour, 2) : "-"}</td>
      <td class="num">${hasOtherCharges ? estNum(sumOtherCharges, 2) : "-"}</td>
      <td class="amt">${estNum(bill.subtotal, 2)}</td>
    </tr></tfoot>
  </table>
  <table class="adj">${adjRows.join("")}</table>
  <div class="words">Rs.${esc(bill.amountInWords)}</div>
  <div class="seal-foot"><img src="${BILL_SEAL_DATA_URI}" alt="" /><span class="seal-line"></span></div>
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
