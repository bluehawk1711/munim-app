import { amountInWords } from "../utils/numberToWords.js";

/**
 * Shared bill/invoice generation — THE single source of truth used by all
 * three apps (web, desktop, mobile). Every app builds the SAME bill from the
 * same code: totals, discount, delivery, amount-in-words, due amount, status.
 * Apps only add a thin platform renderer (jsPDF / print / share text) on top.
 */

export type BillStatus = "DRAFT" | "UNPAID" | "PARTIAL" | "PAID";

/**
 * Bill template settings — the shared model behind the template / classic
 * color / 2-in-1 options. Lives in core (not the UI kit) so all three apps
 * can type the saved `templateSettings` snapshot without importing a UI
 * package. `@munim/ui` re-exports these for the web/desktop form.
 */
export type BillTemplate = "jewellery" | "ecommerce";
export type BillClassicColor = "red" | "yellow";
export type BillMode = "duplicate" | "distinct";

export interface BillTemplateSettings {
  template: BillTemplate;
  classicColor: BillClassicColor;
  /** 2-in-1: two bills on one sheet. */
  twoInOne: boolean;
  /** duplicate = same bill twice; distinct = a second, separate bill. */
  mode: BillMode;
}

export interface BillShopDetails {
  name: string;
  address: string | null;
  phones: string[];
  email: string | null;
}

export interface BillLineInput {
  productName: string;
  description?: string | null;
  sku?: string | null;
  color?: string | null;
  size?: string | null;
  quantity: number;
  price: number;
}

export interface BillLine extends BillLineInput {
  /** quantity × price, rounded to 2 decimals */
  total: number;
}

export interface BillDocument {
  billNo: string;
  /** ISO date (yyyy-mm-dd) */
  date: string;
  customerName: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  shop: BillShopDetails;
  lines: BillLine[];
  subtotal: number;
  discount: number;
  deliveryCharge: number;
  total: number;
  amountInWords: string;
  amountPaid: number;
  dueAmount: number;
  status: BillStatus;
  currency: string;
}

export interface BuildBillInput {
  billNo: string;
  date?: string | Date;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  shop: BillShopDetails;
  lines: BillLineInput[];
  discount?: number;
  deliveryCharge?: number;
  amountPaid?: number;
  status?: BillStatus;
  currency?: string;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Builds a normalized bill document from raw inputs. Pure + shared. */
export function buildBillDocument(input: BuildBillInput): BillDocument {
  const lines: BillLine[] = input.lines.map((l) => ({
    ...l,
    total: round2(Math.max(0, l.quantity) * Math.max(0, l.price)),
  }));

  const subtotal = round2(lines.reduce((sum, l) => sum + l.total, 0));
  const discount = round2(Math.max(0, input.discount ?? 0));
  const deliveryCharge = round2(Math.max(0, input.deliveryCharge ?? 0));
  const total = round2(Math.max(0, subtotal - discount + deliveryCharge));
  const amountPaid = round2(Math.min(Math.max(0, input.amountPaid ?? 0), total));
  const dueAmount = round2(total - amountPaid);

  const status: BillStatus =
    input.status ??
    (total > 0 && dueAmount <= 0 ? "PAID" : amountPaid > 0 ? "PARTIAL" : "UNPAID");

  const rawDate = input.date ? new Date(input.date) : new Date();
  const date = `${rawDate.getFullYear()}-${String(rawDate.getMonth() + 1).padStart(2, "0")}-${String(rawDate.getDate()).padStart(2, "0")}`;

  return {
    billNo: input.billNo,
    date,
    customerName: input.customerName?.trim() || null,
    customerPhone: input.customerPhone?.trim() || null,
    customerAddress: input.customerAddress?.trim() || null,
    shop: input.shop,
    lines,
    subtotal,
    discount,
    deliveryCharge,
    total,
    amountInWords: amountInWords(total),
    amountPaid,
    dueAmount,
    status,
    currency: input.currency ?? "INR",
  };
}

/**
 * Plain-text render of a bill — the platform-agnostic export that works in
 * every app (copy/share/print). Richer renders (jsPDF, HTML) should consume
 * BillDocument and keep the same numbers.
 */
export function renderBillText(bill: BillDocument): string {
  const currency = bill.currency === "INR" ? "₹" : `${bill.currency} `;
  const lines = [
    bill.shop.name,
    bill.shop.address ?? "",
    `Ph: ${bill.shop.phones.join(", ")}${bill.shop.email ? ` | ${bill.shop.email}` : ""}`,
    "",
    `BILL NO: ${bill.billNo}        DATE: ${bill.date}`,
    `Customer: ${bill.customerName ?? ""}${bill.customerPhone ? ` (${bill.customerPhone})` : ""}`,
    "",
    ...bill.lines.flatMap((l) => [
      `${l.quantity} × ${l.productName} @ ${currency}${l.price.toFixed(2)}`,
      `    ${currency}${l.total.toFixed(2)}`,
    ]),
    "",
    `Subtotal:      ${currency}${bill.subtotal.toFixed(2)}`,
    bill.discount > 0 ? `Discount:      -${currency}${bill.discount.toFixed(2)}` : "",
    bill.deliveryCharge > 0 ? `Delivery:      +${currency}${bill.deliveryCharge.toFixed(2)}` : "",
    `TOTAL:         ${currency}${bill.total.toFixed(2)}`,
    `Amount paid:   ${currency}${bill.amountPaid.toFixed(2)}`,
    `Due:           ${currency}${bill.dueAmount.toFixed(2)}`,
    "",
    bill.amountInWords,
    "",
    `Status: ${bill.status} — Thank you for your business!`,
  ].filter((line) => line !== "");
  return lines.join("\n");
}

const esc = (s: string | null | undefined): string =>
  (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * HTML render of a bill — the shared, print-friendly markup used by the
 * mobile app (expo-print) and available to any platform that prints HTML.
 * Same numbers as `renderBillText` / jsPDF — one model, any renderer.
 */
export function renderBillHtml(bill: BillDocument): string {
  const symbol = bill.currency === "INR" ? "₹" : `${esc(bill.currency)} `;
  const money = (n: number) =>
    `${symbol}${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const itemRows = bill.lines
    .map(
      (l, i) => `<tr>
        <td>${i + 1}</td>
        <td>${esc(l.productName)}${l.color ? `<br/><small>${esc(l.color)}${l.size ? ` / ${esc(l.size)}` : ""}</small>` : l.size ? `<br/><small>${esc(l.size)}</small>` : ""}</td>
        <td>${esc(l.sku ?? "")}</td>
        <td class="num">${l.quantity}</td>
        <td class="num">${money(l.price)}</td>
        <td class="num">${money(l.total)}</td>
      </tr>`,
    )
    .join("");

  const extraRows = [
    ...(bill.discount > 0 ? [`<tr><td colspan="5">Discount</td><td class="num">− ${money(bill.discount)}</td></tr>`] : []),
    ...(bill.deliveryCharge > 0 ? [`<tr><td colspan="5">Delivery</td><td class="num">+ ${money(bill.deliveryCharge)}</td></tr>`] : []),
  ].join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 32px; }
  .shop { border-bottom: 3px solid #111; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
  .shop h1 { margin: 0; font-size: 22px; letter-spacing: 0.3px; }
  .shop p { margin: 2px 0; color: #555; font-size: 11px; }
  .meta { text-align: right; }
  .meta .no { font-size: 14px; font-weight: 600; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #444; margin: 18px 0 6px; }
  .cust { font-size: 12px; line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
  th { text-align: left; background: #f4f4f4; padding: 8px; border-bottom: 2px solid #111; }
  td { padding: 7px 8px; border-bottom: 1px solid #e5e5e5; vertical-align: top; }
  td small { color: #777; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .totals { margin-top: 14px; margin-left: auto; width: 280px; font-size: 12px; }
  .totals td { padding: 4px 8px; }
  .grand td { font-size: 15px; font-weight: 700; border-top: 2px solid #111; border-bottom: none; }
  .words { margin-top: 16px; font-size: 11px; color: #333; }
  .words b { color: #111; }
  .foot { margin-top: 28px; font-size: 10px; color: #888; display: flex; justify-content: space-between; border-top: 1px solid #ddd; padding-top: 10px; }
</style>
</head>
<body>
  <div class="shop">
    <div>
      <h1>${esc(bill.shop.name)}</h1>
      ${bill.shop.address ? `<p>${esc(bill.shop.address)}</p>` : ""}
      <p>Ph: ${esc(bill.shop.phones.join(", "))}${bill.shop.email ? ` | ${esc(bill.shop.email)}` : ""}</p>
    </div>
    <div class="meta">
      <div class="no">INVOICE / BILL</div>
      <p>No: ${esc(bill.billNo)}</p>
      <p>Date: ${esc(bill.date)}</p>
      <p>Status: ${esc(bill.status)}</p>
    </div>
  </div>

  <h2>Bill To</h2>
  <div class="cust">
    <b>${esc(bill.customerName ?? "Walk-in Customer")}</b><br/>
    ${bill.customerAddress ? `${esc(bill.customerAddress)}<br/>` : ""}
    ${bill.customerPhone ? `Ph: ${esc(bill.customerPhone)}` : ""}
  </div>

  <table>
    <thead>
      <tr><th>#</th><th>Item</th><th>SKU</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <table class="totals">
    <tr><td>Subtotal</td><td class="num">${money(bill.subtotal)}</td></tr>
    ${extraRows}
    <tr class="grand"><td>TOTAL</td><td class="num">${money(bill.total)}</td></tr>
    <tr><td>Amount paid</td><td class="num">${money(bill.amountPaid)}</td></tr>
    <tr><td>Due</td><td class="num">${money(bill.dueAmount)}</td></tr>
  </table>

  <div class="words"><b>Amount in words:</b> ${esc(bill.amountInWords)}</div>

  <div class="foot">
    <span>Generated by Munim</span>
    <span>Thank you for your business!</span>
  </div>
</body>
</html>`;
}
