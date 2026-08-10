import { amountInWords } from "../utils/numberToWords";

/**
 * Shared bill/invoice generation — THE single source of truth used by all
 * three apps (web, desktop, mobile). Every app builds the SAME bill from the
 * same code: totals, discount, delivery, amount-in-words, due amount, status.
 * Apps only add a thin platform renderer (jsPDF / print / share text) on top.
 */

export type BillStatus = "DRAFT" | "UNPAID" | "PARTIAL" | "PAID";

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
