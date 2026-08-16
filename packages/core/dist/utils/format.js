export function formatCurrency(value, currency = "₹") {
    const safe = Number.isFinite(value) ? value : 0;
    return `${currency}${safe.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}
export function formatNumber(value) {
    const safe = Number.isFinite(value) ? value : 0;
    return safe.toLocaleString("en-IN");
}
export function formatDate(date) {
    if (!date)
        return "—";
    const d = typeof date === "string" ? new Date(date) : date;
    if (Number.isNaN(d.getTime()))
        return "—";
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
export function formatDateTime(date) {
    if (!date)
        return "—";
    const d = typeof date === "string" ? new Date(date) : date;
    if (Number.isNaN(d.getTime()))
        return "—";
    return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}
export function monthLabel(date) {
    return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}
/**
 * Formats a weight stored in milligrams for display: mg → g → kg.
 * e.g. 24500 → "24.5 g", 1500000 → "1.5 kg", 350 → "350 mg".
 * Shared by all three apps so labels and reports read identically.
 */
export function formatWeight(milligrams) {
    const safe = Number.isFinite(milligrams) ? (milligrams ?? 0) : 0;
    if (safe === 0)
        return "—";
    /** Strips trailing zeros: 24.50 → 24.5, 24.00 → 24. */
    const trim = (n) => String(Math.round(n * 100) / 100);
    if (safe >= 1_000_000)
        return `${trim(safe / 1_000_000)} kg`;
    if (safe >= 1000)
        return `${trim(safe / 1000)} g`;
    return `${safe} mg`;
}
export function todayISO() {
    return new Date().toISOString();
}
//# sourceMappingURL=format.js.map