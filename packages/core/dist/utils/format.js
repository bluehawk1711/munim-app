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
export function todayISO() {
    return new Date().toISOString();
}
//# sourceMappingURL=format.js.map