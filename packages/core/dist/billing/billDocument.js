import { amountInWords } from "../utils/numberToWords.js";
import { formatCurrency } from "../utils/format.js";
/** Defaults for the per-bill display toggles — all ON. */
export const DEFAULT_BILL_TEMPLATE_SETTINGS = {
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
export function mergeBillTemplateSettings(partial) {
    return { ...DEFAULT_BILL_TEMPLATE_SETTINGS, ...partial };
}
/** Shop rate rows gated by the per-bill toggles + present rate values. */
export function rateRowsOf(bill, settings) {
    const rows = [];
    if (settings.goldRateLine && bill.goldRate != null && bill.goldRate > 0) {
        rows.push(`Gold rate: ${formatCurrency(bill.goldRate)}/g`);
    }
    if (settings.silverRateLine && bill.silverRate != null && bill.silverRate > 0) {
        rows.push(`Silver rate: ${formatCurrency(bill.silverRate)}/g`);
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
//# sourceMappingURL=billDocument.js.map