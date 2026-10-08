import { amountInWords } from "../utils/numberToWords.js";
import { formatCurrency } from "../utils/format.js";

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
  /** Show the WEIGHT column (product weight + unit) after the name column. */
  weightAfterName: boolean;
  /** Show the shop's gold rate row (₹/g) on the bill. */
  goldRateLine: boolean;
  /** Show the shop's silver rate row (₹/g) on the bill. */
  silverRateLine: boolean;
}

/** Defaults for the per-bill display toggles — all ON. */
export const DEFAULT_BILL_TEMPLATE_SETTINGS: BillTemplateSettings = {
  template: "jewellery",
  classicColor: "red",
  twoInOne: false,
  mode: "duplicate",
  weightAfterName: true,
  goldRateLine: true,
  silverRateLine: true,
};

/**
 * Normalize a possibly-partial settings object (e.g. settings snapshots saved
 * before the display toggles existed) into a complete BillTemplateSettings.
 * Missing toggles default ON, matching DEFAULT_BILL_TEMPLATE_SETTINGS.
 */
export function mergeBillTemplateSettings(
  partial?: Partial<BillTemplateSettings> | null,
): BillTemplateSettings {
  return { ...DEFAULT_BILL_TEMPLATE_SETTINGS, ...partial };
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
  /** Product weight + unit snapshot — display for the WEIGHT column only. */
  weight?: number | null;
  weightUnit?: string | null;
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
  /** Material returned by customer — weight description, e.g. "5gm". */
  materialReturnedWeight: string | null;
  /** Monetary value of material returned (deducted from total). */
  materialReturnedValue: number;
  total: number;
  amountInWords: string;
  amountPaid: number;
  dueAmount: number;
  status: BillStatus;
  currency: string;
  /** Shop's gold rate (₹/g) at build time — drives the gold rate row. */
  goldRate: number | null;
  /** Shop's silver rate (₹/g) at build time — drives the silver rate row. */
  silverRate: number | null;
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
  materialReturnedWeight?: string | null;
  materialReturnedValue?: number;
  amountPaid?: number;
  status?: BillStatus;
  currency?: string;
  /** Shop rates (₹/g) to print as rate rows; omitted → rows hidden. */
  goldRate?: number | null;
  silverRate?: number | null;
}

/** Shop rate rows gated by the per-bill toggles + present rate values. */
export function rateRowsOf(bill: BillDocument, settings: BillTemplateSettings): string[] {
  const rows: string[] = [];
  if (settings.goldRateLine && bill.goldRate != null && bill.goldRate > 0) {
    rows.push(`Gold rate: ${formatCurrency(bill.goldRate)}/g`);
  }
  if (settings.silverRateLine && bill.silverRate != null && bill.silverRate > 0) {
    rows.push(`Silver rate: ${formatCurrency(bill.silverRate)}/g`);
  }
  return rows;
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
  const materialReturnedValue = round2(Math.max(0, input.materialReturnedValue ?? 0));
  const total = round2(Math.max(0, subtotal - discount - materialReturnedValue + deliveryCharge));
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
    materialReturnedWeight: input.materialReturnedWeight?.trim() || null,
    materialReturnedValue,
    total,
    amountInWords: amountInWords(total),
    amountPaid,
    dueAmount,
    status,
    currency: input.currency ?? "INR",
    goldRate: input.goldRate ?? null,
    silverRate: input.silverRate ?? null,
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
    bill.goldRate != null && bill.goldRate > 0 ? `Gold rate:   ${currency}${bill.goldRate.toFixed(2)}/g` : "",
    bill.silverRate != null && bill.silverRate > 0 ? `Silver rate: ${currency}${bill.silverRate.toFixed(2)}/g` : "",
    `Customer: ${bill.customerName ?? ""}${bill.customerPhone ? ` (${bill.customerPhone})` : ""}`,
    "",
    ...bill.lines.flatMap((l) => {
      const weight = l.weight != null ? `${l.weight}${l.weightUnit === "mg" ? "mg" : "g"}` : null;
      return [
        `${l.quantity} × ${l.productName}${weight ? ` [${weight}]` : ""} @ ${currency}${l.price.toFixed(2)}`,
        `    ${currency}${l.total.toFixed(2)}`,
      ];
    }),
    "",
    `Subtotal:      ${currency}${bill.subtotal.toFixed(2)}`,
    bill.discount > 0 ? `Discount:      -${currency}${bill.discount.toFixed(2)}` : "",
    bill.materialReturnedValue > 0 ? `Material Retd:  -${currency}${bill.materialReturnedValue.toFixed(2)}${bill.materialReturnedWeight ? ` (${bill.materialReturnedWeight})` : ""}` : "",
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
