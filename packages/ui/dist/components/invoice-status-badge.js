"use client";
import { jsx as _jsx } from "react/jsx-runtime";
/**
 * Shared invoice status badge — the exact same color mapping in the web and
 * desktop invoice lists: PAID (emerald), PARTIAL (amber), UNPAID (red),
 * DRAFT (muted).
 */
import { cn } from "../lib/utils";
import { Badge } from "./badge";
const STATUS_STYLES = {
    PAID: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    PARTIAL: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    UNPAID: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
    DRAFT: "border-muted bg-muted/50 text-muted-foreground",
};
const STATUS_LABELS = {
    PAID: "Paid",
    PARTIAL: "Partially paid",
    UNPAID: "Unpaid",
    DRAFT: "Draft",
};
export function InvoiceStatusBadge({ status }) {
    return (_jsx(Badge, { className: cn("font-normal", STATUS_STYLES[status]), children: STATUS_LABELS[status] }));
}
//# sourceMappingURL=invoice-status-badge.js.map