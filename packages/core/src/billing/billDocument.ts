import { amountInWords } from "../utils/numberToWords.js";
import { formatCurrency } from "../utils/format.js";
import type { InvoiceItemPricing } from "../db/schema.js";
import { weightTextToGrams } from "../pricing/product.js";
import { karatFromPurity, toGoldKarat, type GoldKarat } from "../pricing/gold.js";

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

/** What prints under the "Gold rate: ₹X per gm" row (and what the bill
 *  form's rate badge shows) — the purity of the quoted rate:
 *    "off"     → no purity line at all;
 *    "base"    → the shop's base karat ("22 carat" — the original behaviour);
 *    "product" → the bill's first gold line's karat (the selected product's
 *                karat, exactly what the gold-product badge shows);
 *    "karat"   → the karat the operator picked in the dropdown
 *                (`goldRateKaratValue`) — works even when neither the
 *                product nor the shop has a karat set;
 *    "custom"  → the operator's own text (`goldRateKaratText`). */
export type GoldRateKaratMode = "off" | "base" | "product" | "karat" | "custom";

/** Toggleable columns of the E-commerce ESTIMATE grid. The Classic template
 *  has its own fixed layout and ignores these. `weight` is gold's G. Wt.
 *  column (silver's combined Weight column shares the same toggle);
 *  `netWeight` is gold's N. Wt. column (net = gross − nag + chejat);
 *  `chejatNag` is the gold-only merged Chejat/Nag stack. */
export type EstimateColumnId =
  | "description"
  | "purity"
  | "weight"
  | "netWeight"
  | "chejatNag"
  | "rate"
  | "labour"
  | "otherCharges"
  | "amount";

/** Column toggles for the NEW BILL screens (desktop + mobile): gold's grid
 *  fields with their printed headers — `purity` shows as "Remark" (the
 *  client's term for the purity stamp column). */
export const GOLD_ESTIMATE_COLUMNS = [
  { id: "description", label: "Description" },
  { id: "purity", label: "Remark" },
  { id: "weight", label: "G. Wt." },
  { id: "netWeight", label: "N. Wt." },
  { id: "chejatNag", label: "Chejat/Nag" },
  { id: "rate", label: "Rate ₹/gm" },
  { id: "labour", label: "Labour" },
  { id: "otherCharges", label: "Other Charges" },
  { id: "amount", label: "Amount" },
] as const satisfies readonly { id: EstimateColumnId; label: string }[];

/** Silver's grid fields — one combined Weight column, no Chejat/Nag. */
export const SILVER_ESTIMATE_COLUMNS = [
  { id: "description", label: "Description" },
  { id: "purity", label: "Remark" },
  { id: "weight", label: "Weight" },
  { id: "rate", label: "Rate ₹/gm" },
  { id: "labour", label: "Labour" },
  { id: "otherCharges", label: "Other Charges" },
  { id: "amount", label: "Amount" },
] as const satisfies readonly { id: EstimateColumnId; label: string }[];

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
  /** Chejat/Nag cell signs — ON prints `Chejat: 0.100 +` / `Nag: 0.200 −`
   *  (chejat adds to the net weight, nag less subtracts); OFF keeps the
   *  plain `Chejat: 0.100` / `Nag: 0.200` labels. */
  signSuffix: boolean;
  /** Purity line under the gold rate row (see `GoldRateKaratMode`).
   *  Optional so pre-toggle snapshots and partial payload builders still
   *  typecheck — `mergeBillTemplateSettings` defaults it to "base"
   *  (legacy: print the shop base karat, hide when unset). */
  goldRateKaratMode?: GoldRateKaratMode;
  /** Free text for mode "custom" (e.g. "22K hallmark"). Ignored otherwise. */
  goldRateKaratText?: string;
  /** Picked karat (1–24) for mode "karat" — the number printed under the
   *  gold rate row (e.g. `22 carat`). Ignored otherwise. Optional so older
   *  snapshots / payload builders still typecheck. */
  goldRateKaratValue?: number;
  /** Estimate-grid columns turned OFF via the New Bill screen's per-metal
   *  column toggles — hidden from the printed bill. Gold grid and silver
   *  grid have different fields (gold: G. Wt. + Chejat/Nag; silver: the
   *  combined Weight), so each keeps its own list. Missing side / missing
   *  key (old snapshots, web payloads) = every column shown. Optional so
   *  payload builders that predate the toggles still typecheck. */
  hiddenColumns?: {
    gold: EstimateColumnId[];
    silver: EstimateColumnId[];
  };
}

/** Defaults for the per-bill display toggles — all ON. The template defaults
 *  to the E-commerce estimate sheet (the shop's new default bill design). */
export const DEFAULT_BILL_TEMPLATE_SETTINGS: BillTemplateSettings = {
  template: "ecommerce",
  classicColor: "red",
  twoInOne: false,
  mode: "duplicate",
  weightAfterName: true,
  goldRateLine: true,
  silverRateLine: true,
  signSuffix: true,
  goldRateKaratMode: "base",
  goldRateKaratText: "",
  goldRateKaratValue: 22,
  hiddenColumns: { gold: [], silver: [] },
};

/**
 * Normalize a possibly-partial settings object (e.g. settings snapshots saved
 * before the display toggles existed) into a complete BillTemplateSettings.
 * Missing toggles default ON, matching DEFAULT_BILL_TEMPLATE_SETTINGS.
 * `hiddenColumns` deep-defaults both metals to [] (nothing hidden) — an
 * explicitly-undefined value (payload builders spreading a partial snapshot)
 * also lands on the empty lists.
 */
export function mergeBillTemplateSettings(
  partial?: Partial<BillTemplateSettings> | null,
): BillTemplateSettings {
  return {
    ...DEFAULT_BILL_TEMPLATE_SETTINGS,
    ...partial,
    // Explicit undefined (payload builders spreading a partial snapshot)
    // must land on the defaults, not on `undefined`.
    goldRateKaratMode: partial?.goldRateKaratMode ?? DEFAULT_BILL_TEMPLATE_SETTINGS.goldRateKaratMode,
    goldRateKaratText: partial?.goldRateKaratText ?? DEFAULT_BILL_TEMPLATE_SETTINGS.goldRateKaratText,
    goldRateKaratValue: partial?.goldRateKaratValue ?? DEFAULT_BILL_TEMPLATE_SETTINGS.goldRateKaratValue,
    hiddenColumns: {
      gold: partial?.hiddenColumns?.gold ?? [],
      silver: partial?.hiddenColumns?.silver ?? [],
    },
  };
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
  /** Metal purity stamp — printed in the estimate's Purity column (dropdown
   *  on the bill screens; Classic still appends it to the name). */
  purity?: string | null;
  /** Gross-weight free text (bill G. Wt. column in the estimate template). */
  grossWeight?: string | null;
  /** Bill line's nag-less weight in GRAMS — gold net-weight derivation input
   *  (`net = gross − nag + chejat`); the printed Nag Wt. column. */
  nagLessWeight?: number | null;
  /** Bill line's chejat (stone) weight in GRAMS — the other derivation
   *  input; the printed Chejat Wt. column. */
  chejatWeight?: number | null;
  /** Product weight + unit snapshot — display for the WEIGHT column only. */
  weight?: number | null;
  weightUnit?: string | null;
  quantity: number;
  price: number;
  /** Frozen pricing inputs (rate/metal value/labour/povayi) — estimate columns. */
  pricing?: InvoiceItemPricing | null;
}

export interface BillLine extends BillLineInput {
  /** quantity × price, rounded to 2 decimals */
  total: number;
}

/** What the printed document IS: a normal invoice, or a quotation/estimate
 *  drawn straight from an order. Only the header wording changes — the
 *  numbers, columns and paid/balance block are identical, because an estimate
 *  is a bill the customer hasn't settled yet. */
export type BillKind = "invoice" | "quotation";

/** Header word for the printed document — "Bill" or "Estimate". */
export function billKindLabel(bill: Pick<BillDocument, "kind">): string {
  return bill.kind === "quotation" ? "Estimate" : "Bill";
}

export interface BillDocument {
  billNo: string;
  /** invoice | quotation — see `billKindLabel`. */
  kind: BillKind;
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
  /** Per-bill label for the deduction row (null → "Material Returned"). */
  materialReturnedTitle: string | null;
  total: number;
  amountInWords: string;
  amountPaid: number;
  dueAmount: number;
  status: BillStatus;
  currency: string;
  /** Shop's gold rate (₹/g) at build time — drives the gold rate row. */
  goldRate: number | null;
  /** Purity of `goldRate` (e.g. 24 → "24 carat") — printed under the gold
   *  rate row. null → no purity line (legacy bills / rates never stamped). */
  goldRateKarat: number | null;
  /** Shop's silver rate (₹/g) at build time — drives the silver rate row. */
  silverRate: number | null;
}

export interface BuildBillInput {
  billNo: string;
  /** Defaults to "invoice" — set "quotation" for an order/estimate print. */
  kind?: BillKind;
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
  /** Per-bill label for the deduction row (blank → "Material Returned"). */
  materialReturnedTitle?: string | null;
  amountPaid?: number;
  status?: BillStatus;
  currency?: string;
  /** Shop rates (₹/g) to print as rate rows; omitted → rows hidden. */
  goldRate?: number | null;
  /** Purity stamp for the gold rate row — the shop's base karat. */
  goldRateKarat?: number | null;
  silverRate?: number | null;
}

/** Row label for the material-returned deduction — per-bill title or default. */
export function materialReturnedTitleOf(bill: BillDocument): string {
  return bill.materialReturnedTitle?.trim() || "Material Returned";
}

/** Adjustments-block label for the advance already collected — orders print
 *  "CASH ADVANCE:" (the client's term for an order advance); invoices keep
 *  the classic "RECEIPT CASH:". */
export function receiptLabelOf(bill: Pick<BillDocument, "kind">): string {
  return bill.kind === "quotation" ? "CASH ADVANCE:" : "RECEIPT CASH:";
}

/** Product name with the purity stamp in parentheses (`(22K)`) beside it. */
export function nameWithPurity(line: BillLineInput): string {
  const p = line.purity?.trim();
  return p ? `${line.productName} (${p})` : line.productName;
}

/**
 * Estimate-template row derivations: per-gram rate, metal value, labour ₹,
 * and the individual flat charges (nag / povayi / other ₹). The bill prints
 * them ITEMIZED inside the Other Charges cell with their prefixes —
 * `Nag: 500.00` / `Povayi: 250.00` / `Other: 150.00` — never summed on a line
 * (the totals row adds them once). Legacy snapshots saved before nag/other
 * were frozen have them missing → 0 (their povayi still shows). NULL when the
 * line froze no pricing at all (manual/legacy lines).
 */
export function estimateRowOf(line: BillLineInput & { total?: number }): {
  rate: number;
  value: number;
  labour: number | null;
  charges: { nag: number; povayi: number; other: number } | null;
} {
  const p = line.pricing;
  const rate =
    p?.ratePerGram != null && p.ratePerGram > 0
      ? p.ratePerGram
      : line.weight && line.weight > 0
        ? line.price / line.weight
        : line.price;
  const value = p?.metalValue ?? line.price;
  const labour = p?.labourAmount ?? null;
  const charges = p == null ? null : { nag: p.nag ?? 0, povayi: p.povayi ?? 0, other: p.other ?? 0 };
  return { rate, value, labour, charges };
}

/** The itemized Other Charges cell lines — one `Prefix: 0.00` entry per
 *  non-empty charge, in the client's order (Nag, Povayi, Other). Empty → []. */
export function estimateChargeLines(
  charges: { nag: number; povayi: number; other: number } | null,
): string[] {
  if (!charges) return [];
  const parts: string[] = [];
  if (charges.nag > 0) parts.push(`Nag: ${charges.nag.toFixed(2)}`);
  if (charges.povayi > 0) parts.push(`Povayi: ${charges.povayi.toFixed(2)}`);
  if (charges.other > 0) parts.push(`Other: ${charges.other.toFixed(2)}`);
  return parts;
}

/** The merged Chejat/Nag cell lines — `Chejat: 0.150 +` / `Nag: 0.620 −`,
 *  one per non-empty derivation input (grams, 3 dp), itemized with prefixes
 *  exactly like the Other Charges cell (client merged the two columns into
 *  one). `signs` appends the direction marker — chejat ADDS to the net
 *  weight, nag less SUBTRACTS from it — and is driven by the per-bill
 *  `signSuffix` toggle (off → the plain labels). Empty → []. */
export function estimateWeightLines(line: BillLineInput, signs = false): string[] {
  const parts: string[] = [];
  if (line.chejatWeight != null && line.chejatWeight > 0)
    parts.push(`Chejat: ${line.chejatWeight.toFixed(3)}${signs ? " +" : ""}`);
  if (line.nagLessWeight != null && line.nagLessWeight > 0)
    parts.push(`Nag: ${line.nagLessWeight.toFixed(3)}${signs ? " −" : ""}`);
  return parts;
}

/**
 * The estimate's N. Wt. cell — net = gross − nag + chejat, the SAME
 * derivation the gold price uses (`calcNetWeight`), evaluated on the frozen
 * bill-line values: `grossWeight` free text parsed as grams, `nagLessWeight`
 * / `chejatWeight` already stored in grams. Lines without a parseable gross
 * fall back to the priced `weight` (gold invoices freeze the derived NET
 * there, order lines freeze the product weight) minus any frozen nag/chejat.
 * Empty / non-positive → null (prints "-").
 */
export function netWeightCellOf(line: BillLineInput): string | null {
  const gross =
    weightTextToGrams(line.grossWeight, null) ??
    (line.weight != null && line.weight > 0 ? line.weight : null);
  if (gross === null) return null;
  const net = gross - (line.nagLessWeight ?? 0) + (line.chejatWeight ?? 0);
  const rounded = Math.round(net * 10000) / 10000;
  return rounded > 0 ? rounded.toFixed(3) : null;
}

/** Sum of the parseable per-line net weights — the N. Wt. totals cell. */
export function estimateNetWeightTotal(lines: readonly BillLineInput[]): number | null {
  let any = false;
  let sum = 0;
  for (const line of lines) {
    const cell = netWeightCellOf(line);
    if (cell === null) continue;
    any = true;
    sum += parseFloat(cell);
  }
  return any ? Math.round(sum * 10000) / 10000 : null;
}

/** Tallest itemized stack in a row — the Other Charges lines vs the merged
 *  Chejat/Nag lines — gated on which columns are actually visible (a hidden
 *  column's stack doesn't grow the row). Shared by the PDF's draw + height
 *  measurement so the sheet frame always hugs the real table. */
export function estimateRowStackLines(
  line: BillLineInput,
  visible: { chejatNag: boolean; otherCharges: boolean },
): number {
  return Math.max(
    visible.otherCharges ? estimateChargeLines(estimateRowOf(line).charges).length : 0,
    visible.chejatNag ? estimateWeightLines(line).length : 0,
  );
}

/** Estimate row height (mm): base 7 — 10 when the name carries a description
 *  line under it — growing 3.6 mm per itemized stack line. */
export function estimateRowHeightMm(
  hasDescription: boolean,
  stackLines: number,
): number {
  return Math.max(hasDescription ? 10 : 7, 7 + 3.6 * (stackLines - 1));
}

/** Totals-row height (mm): 7, or taller when the merged Chejat/Nag totals
 *  cell stacks its prefixed sums ("Chejat: …" above "Nag: …"). */
export function estimateTotalsHeightMm(stackLines: number): number {
  return Math.max(7, 7 + 3.6 * (stackLines - 1));
}

/** Sum of the non-zero flat charges — the totals row's Other Charges cell. */
export function estimateChargesTotal(
  charges: { nag: number; povayi: number; other: number } | null,
): number {
  if (!charges) return 0;
  return (charges.nag > 0 ? charges.nag : 0) + (charges.povayi > 0 ? charges.povayi : 0) + (charges.other > 0 ? charges.other : 0);
}

/** Trimmed purity stamp for the estimate's Purity column (null → "-"). */
export function purityCellOf(line: BillLineInput): string | null {
  return line.purity?.trim() || null;
}

/** Grams for the estimate's Chejat/Nag weight columns (null → "-"). */
export function weightCellOf(value: number | null | undefined): string | null {
  return value != null && value > 0 ? value.toFixed(3) : null;
}

/**
 * Labour method tag printed beside the Labour amount on the estimate —
 * "(fixed)" / "(11.82/gm)" / "(2.5%)" so the shop can see whether the
 * labour was a flat charge, a per-gram rate or a percentage of metal value.
 * Blank when the line froze no labour method (legacy/manual lines).
 */
export function estimateLabourTag(line: BillLineInput): string {
  const p = line.pricing;
  if (!p?.labourType) return "";
  if (p.labourType === "PER_GRAM") return ` (${formatLabourValue(p.labourValue)}/gm)`;
  if (p.labourType === "FIXED") return " (fixed)";
  if (p.labourType === "PERCENT") return ` (${formatLabourValue(p.labourValue)}%)`;
  return "";
}

function formatLabourValue(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "0";
  return Number(value.toFixed(2)).toString();
}

/**
 * Does any line of this bill declare a metal? Gates the header rate rows and
 * the estimate's weight columns by what the bill actually bills.
 */
function declaredMetals(bill: BillDocument): { gold: boolean; silver: boolean } {
  let gold = false;
  let silver = false;
  for (const line of bill.lines) {
    if (line.pricing?.metal === "Gold") gold = true;
    else if (line.pricing?.metal === "Silver") silver = true;
  }
  return { gold, silver };
}

/**
 * Estimate weight-column layout: gold bills show the G. Wt. + N. Wt. pair;
 * silver-only bills show ONE combined "Weight" column (gross weight is a
 * gold-only concept at this shop). Bills with no frozen metal info (all
 * manual/legacy lines) keep the classic pair so old bills look unchanged.
 */
export function estimateWeightLayout(bill: BillDocument): "split" | "combined" {
  const { gold, silver } = declaredMetals(bill);
  return silver && !gold ? "combined" : "split";
}

/**
 * Karat of the bill's FIRST gold line that carries one — the "selected
 * product's karat" the client wants under the gold rate. Pass 1 reads the
 * frozen pricing snapshot (the product's karat at sale time, then its
 * purity stamp); pass 2 covers unpriced manual/legacy lines, where only
 * the stamp can say (silver stamps like "925" never parse as a gold
 * karat). null when nothing resolves.
 */
export function firstGoldKarat(
  lines: readonly { pricing?: InvoiceItemPricing | null; purity?: string | null }[],
): GoldKarat | null {
  for (const line of lines) {
    if (line.pricing?.metal !== "Gold") continue;
    const karat = toGoldKarat(line.pricing.karat) ?? karatFromPurity(line.purity);
    if (karat !== null && karat > 0) return karat;
  }
  for (const line of lines) {
    if (line.pricing != null) continue;
    const karat = karatFromPurity(line.purity);
    if (karat !== null && karat > 0) return karat;
  }
  return null;
}

/**
 * The purity line under the "Gold rate: ₹X per gm" row, per the template's
 * `goldRateKaratMode` — THE one resolver, shared by the PDF/HTML rate rows,
 * the share text and the bill-form badge so every surface agrees.
 * Returns null when nothing should print.
 */
export function goldRateKaratLine(
  bill: BillDocument,
  settings: BillTemplateSettings,
): string | null {
  const mode = settings.goldRateKaratMode ?? "base";
  if (mode === "off") return null;
  if (mode === "custom") return settings.goldRateKaratText?.trim() || null;
  if (mode === "product") {
    const karat = firstGoldKarat(bill.lines);
    return karat !== null && karat > 0 ? `${karat} carat` : null;
  }
  if (mode === "karat") {
    // Explicit dropdown pick — shown even when neither the product nor the
    // shop quoted a karat. Out-of-range / unset → nothing (defensive).
    const picked = settings.goldRateKaratValue;
    return picked != null && Number.isFinite(picked) && picked >= 1 && picked <= 24
      ? `${Math.round(picked)} carat`
      : null;
  }
  // "base" — the shop's quoted-rate purity; unset → no line (legacy bills).
  return bill.goldRateKarat != null && bill.goldRateKarat > 0 ? `${bill.goldRateKarat} carat` : null;
}

/**
 * Shop rate rows gated by the per-bill toggles, present rate values AND the
 * metals the bill actually contains (a silver-only bill never prints the
 * gold rate, and vice versa). Rates state their unit — per gm.
 */
export function rateRowsOf(bill: BillDocument, settings: BillTemplateSettings): string[] {
  const { gold, silver } = declaredMetals(bill);
  const anyMetal = gold || silver;
  const rows: string[] = [];
  if (settings.goldRateLine && bill.goldRate != null && bill.goldRate > 0 && (!anyMetal || gold)) {
    rows.push(`Gold rate: ${formatCurrency(bill.goldRate)} per gm`);
    // Purity of the quoted rate — printed directly under it ("22 carat").
    const purity = goldRateKaratLine(bill, settings);
    if (purity) rows.push(purity);
  }
  if (settings.silverRateLine && bill.silverRate != null && bill.silverRate > 0 && (!anyMetal || silver)) {
    rows.push(`Silver rate: ${formatCurrency(bill.silverRate)} per gm`);
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
    kind: input.kind ?? "invoice",
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
    materialReturnedTitle: input.materialReturnedTitle?.trim() || null,
    total,
    amountInWords: amountInWords(total),
    amountPaid,
    dueAmount,
    status,
    currency: input.currency ?? "INR",
    goldRate: input.goldRate ?? null,
    goldRateKarat: input.goldRateKarat ?? null,
    silverRate: input.silverRate ?? null,
  };
}

/**
 * Plain-text render of a bill — the platform-agnostic export that works in
 * every app (copy/share/print). Richer renders (jsPDF, HTML) should consume
 * BillDocument and keep the same numbers. `settings` drives the gold-rate
 * purity line (omitted → the defaults, i.e. the legacy base-karat line).
 */
export function renderBillText(bill: BillDocument, settings?: BillTemplateSettings): string {
  const currency = bill.currency === "INR" ? "₹" : `${bill.currency} `;
  const metals = declaredMetals(bill);
  const anyMetal = metals.gold || metals.silver;
  const showGoldRate = bill.goldRate != null && bill.goldRate > 0 && (!anyMetal || metals.gold);
  const showSilverRate = bill.silverRate != null && bill.silverRate > 0 && (!anyMetal || metals.silver);
  const goldPurity = showGoldRate
    ? goldRateKaratLine(bill, settings ?? DEFAULT_BILL_TEMPLATE_SETTINGS)
    : null;
  const lines = [
    bill.shop.name,
    bill.shop.address ?? "",
    `Ph: ${bill.shop.phones.join(", ")}${bill.shop.email ? ` | ${bill.shop.email}` : ""}`,
    "",
    `BILL NO: ${bill.billNo}        DATE: ${bill.date}`,
    showGoldRate ? `Gold rate:   ${currency}${bill.goldRate?.toFixed(2)} per gm` : "",
    goldPurity ?? "",
    showSilverRate ? `Silver rate: ${currency}${bill.silverRate?.toFixed(2)} per gm` : "",
    `Customer: ${bill.customerName ?? ""}${bill.customerPhone ? ` (${bill.customerPhone})` : ""}`,
    "",
    ...bill.lines.flatMap((l) => {
      const weight = l.weight != null ? `${l.weight}${l.weightUnit === "mg" ? "mg" : "g"}` : null;
      return [
        `${l.quantity} × ${l.productName}${l.purity?.trim() ? ` (${l.purity.trim()})` : ""}${weight ? ` [${weight}]` : ""} @ ${currency}${l.price.toFixed(2)}`,
        `    ${currency}${l.total.toFixed(2)}`,
      ];
    }),
    "",
    `Subtotal:      ${currency}${bill.subtotal.toFixed(2)}`,
    bill.discount > 0 ? `Discount:      -${currency}${bill.discount.toFixed(2)}` : "",
    bill.materialReturnedValue > 0 ? `${materialReturnedTitleOf(bill)}:  -${currency}${bill.materialReturnedValue.toFixed(2)}${bill.materialReturnedWeight ? ` (${bill.materialReturnedWeight})` : ""}` : "",
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
