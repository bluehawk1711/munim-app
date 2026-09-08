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
 * Format a weight value with its display unit.
 * e.g. (24.5, "gm") → "24.5 gm", (24500, "mg") → "24500 mg".
 * Shared by all three apps so labels and reports read identically.
 */
export function formatWeight(weight, unit) {
    const safe = Number.isFinite(weight) ? (weight ?? 0) : 0;
    if (safe === 0)
        return "—";
    const u = unit === "mg" ? "mg" : "gm";
    return `${safe} ${u}`;
}
export function todayISO() {
    return new Date().toISOString();
}
//# sourceMappingURL=format.js.map