import { amountInWords } from "../utils/numberToWords.js";
import { formatCurrency } from "../utils/format.js";
/** Column toggles for the NEW BILL screens (desktop + mobile): gold's grid
 *  fields with their printed headers — `purity` shows as "Remark" (the
 *  client's term for the purity stamp column). */
export const GOLD_ESTIMATE_COLUMNS = [
    { id: "description", label: "Description" },
    { id: "purity", label: "Remark" },
    { id: "weight", label: "G. Wt." },
    { id: "chejatNag", label: "Chejat/Nag" },
    { id: "rate", label: "Rate ₹/gm" },
    { id: "labour", label: "Labour" },
    { id: "otherCharges", label: "Other Charges" },
    { id: "amount", label: "Amount" },
];
/** Silver's grid fields — one combined Weight column, no Chejat/Nag. */
export const SILVER_ESTIMATE_COLUMNS = [
    { id: "description", label: "Description" },
    { id: "purity", label: "Remark" },
    { id: "weight", label: "Weight" },
    { id: "rate", label: "Rate ₹/gm" },
    { id: "labour", label: "Labour" },
    { id: "otherCharges", label: "Other Charges" },
    { id: "amount", label: "Amount" },
];
/** Defaults for the per-bill display toggles — all ON. The template defaults
 *  to the E-commerce estimate sheet (the shop's new default bill design). */
export const DEFAULT_BILL_TEMPLATE_SETTINGS = {
    template: "ecommerce",
    classicColor: "red",
    twoInOne: false,
    mode: "duplicate",
    weightAfterName: true,
    goldRateLine: true,
    silverRateLine: true,
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
export function mergeBillTemplateSettings(partial) {
    return {
        ...DEFAULT_BILL_TEMPLATE_SETTINGS,
        ...partial,
        hiddenColumns: {
            gold: partial?.hiddenColumns?.gold ?? [],
            silver: partial?.hiddenColumns?.silver ?? [],
        },
    };
}
/** Row label for the material-returned deduction — per-bill title or default. */
export function materialReturnedTitleOf(bill) {
    return bill.materialReturnedTitle?.trim() || "Material Returned";
}
/** Product name with the purity stamp in parentheses (`(22K)`) beside it. */
export function nameWithPurity(line) {
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
export function estimateRowOf(line) {
    const p = line.pricing;
    const rate = p?.ratePerGram != null && p.ratePerGram > 0
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
export function estimateChargeLines(charges) {
    if (!charges)
        return [];
    const parts = [];
    if (charges.nag > 0)
        parts.push(`Nag: ${charges.nag.toFixed(2)}`);
    if (charges.povayi > 0)
        parts.push(`Povayi: ${charges.povayi.toFixed(2)}`);
    if (charges.other > 0)
        parts.push(`Other: ${charges.other.toFixed(2)}`);
    return parts;
}
/** The merged Chejat/Nag cell lines — `Chejat: 0.150` / `Nag: 0.620`, one per
 *  non-empty derivation input (grams, 3 dp), itemized with prefixes exactly
 *  like the Other Charges cell (client merged the two columns into one).
 *  Empty → []. */
export function estimateWeightLines(line) {
    const parts = [];
    if (line.chejatWeight != null && line.chejatWeight > 0)
        parts.push(`Chejat: ${line.chejatWeight.toFixed(3)}`);
    if (line.nagLessWeight != null && line.nagLessWeight > 0)
        parts.push(`Nag: ${line.nagLessWeight.toFixed(3)}`);
    return parts;
}
/** Tallest itemized stack in a row — the Other Charges lines vs the merged
 *  Chejat/Nag lines — gated on which columns are actually visible (a hidden
 *  column's stack doesn't grow the row). Shared by the PDF's draw + height
 *  measurement so the sheet frame always hugs the real table. */
export function estimateRowStackLines(line, visible) {
    return Math.max(visible.otherCharges ? estimateChargeLines(estimateRowOf(line).charges).length : 0, visible.chejatNag ? estimateWeightLines(line).length : 0);
}
/** Estimate row height (mm): base 7 — 10 when the name carries a description
 *  line under it — growing 3.6 mm per itemized stack line. */
export function estimateRowHeightMm(hasDescription, stackLines) {
    return Math.max(hasDescription ? 10 : 7, 7 + 3.6 * (stackLines - 1));
}
/** Totals-row height (mm): 7, or taller when the merged Chejat/Nag totals
 *  cell stacks its prefixed sums ("Chejat: …" above "Nag: …"). */
export function estimateTotalsHeightMm(stackLines) {
    return Math.max(7, 7 + 3.6 * (stackLines - 1));
}
/** Sum of the non-zero flat charges — the totals row's Other Charges cell. */
export function estimateChargesTotal(charges) {
    if (!charges)
        return 0;
    return (charges.nag > 0 ? charges.nag : 0) + (charges.povayi > 0 ? charges.povayi : 0) + (charges.other > 0 ? charges.other : 0);
}
/** Trimmed purity stamp for the estimate's Purity column (null → "-"). */
export function purityCellOf(line) {
    return line.purity?.trim() || null;
}
/** Grams for the estimate's Chejat/Nag weight columns (null → "-"). */
export function weightCellOf(value) {
    return value != null && value > 0 ? value.toFixed(3) : null;
}
/**
 * Labour method tag printed beside the Labour amount on the estimate —
 * "(fixed)" / "(11.82/gm)" / "(2.5%)" so the shop can see whether the
 * labour was a flat charge, a per-gram rate or a percentage of metal value.
 * Blank when the line froze no labour method (legacy/manual lines).
 */
export function estimateLabourTag(line) {
    const p = line.pricing;
    if (!p?.labourType)
        return "";
    if (p.labourType === "PER_GRAM")
        return ` (${formatLabourValue(p.labourValue)}/gm)`;
    if (p.labourType === "FIXED")
        return " (fixed)";
    if (p.labourType === "PERCENT")
        return ` (${formatLabourValue(p.labourValue)}%)`;
    return "";
}
function formatLabourValue(value) {
    if (value == null || !Number.isFinite(value))
        return "0";
    return Number(value.toFixed(2)).toString();
}
/**
 * Does any line of this bill declare a metal? Gates the header rate rows and
 * the estimate's weight columns by what the bill actually bills.
 */
function declaredMetals(bill) {
    let gold = false;
    let silver = false;
    for (const line of bill.lines) {
        if (line.pricing?.metal === "Gold")
            gold = true;
        else if (line.pricing?.metal === "Silver")
            silver = true;
    }
    return { gold, silver };
}
/**
 * Estimate weight-column layout: gold bills show the G. Wt. + N. Wt. pair;
 * silver-only bills show ONE combined "Weight" column (gross weight is a
 * gold-only concept at this shop). Bills with no frozen metal info (all
 * manual/legacy lines) keep the classic pair so old bills look unchanged.
 */
export function estimateWeightLayout(bill) {
    const { gold, silver } = declaredMetals(bill);
    return silver && !gold ? "combined" : "split";
}
/**
 * Shop rate rows gated by the per-bill toggles, present rate values AND the
 * metals the bill actually contains (a silver-only bill never prints the
 * gold rate, and vice versa). Rates state their unit — per gm.
 */
export function rateRowsOf(bill, settings) {
    const { gold, silver } = declaredMetals(bill);
    const anyMetal = gold || silver;
    const rows = [];
    if (settings.goldRateLine && bill.goldRate != null && bill.goldRate > 0 && (!anyMetal || gold)) {
        rows.push(`Gold rate: ${formatCurrency(bill.goldRate)} per gm`);
    }
    if (settings.silverRateLine && bill.silverRate != null && bill.silverRate > 0 && (!anyMetal || silver)) {
        rows.push(`Silver rate: ${formatCurrency(bill.silverRate)} per gm`);
    }
    return rows;
}
function round2(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}
/** Builds a normalized bill document from raw inputs. Pure + shared. */
export function buildBillDocument(input) {
    const lines = input.lines.map((l) => ({
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
    const status = input.status ??
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
        materialReturnedTitle: input.materialReturnedTitle?.trim() || null,
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
export function renderBillText(bill) {
    const currency = bill.currency === "INR" ? "₹" : `${bill.currency} `;
    const metals = declaredMetals(bill);
    const anyMetal = metals.gold || metals.silver;
    const showGoldRate = bill.goldRate != null && bill.goldRate > 0 && (!anyMetal || metals.gold);
    const showSilverRate = bill.silverRate != null && bill.silverRate > 0 && (!anyMetal || metals.silver);
    const lines = [
        bill.shop.name,
        bill.shop.address ?? "",
        `Ph: ${bill.shop.phones.join(", ")}${bill.shop.email ? ` | ${bill.shop.email}` : ""}`,
        "",
        `BILL NO: ${bill.billNo}        DATE: ${bill.date}`,
        showGoldRate ? `Gold rate:   ${currency}${bill.goldRate?.toFixed(2)} per gm` : "",
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
//# sourceMappingURL=billDocument.js.map