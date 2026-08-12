"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "../lib/utils";
import { Card, CardContent } from "./card";
const ACCENT_STYLES = {
    default: "bg-muted text-muted-foreground",
    primary: "bg-primary/10 text-primary",
    amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    emerald: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    red: "bg-red-500/15 text-red-600 dark:text-red-400",
};
export function SummaryTile({ label, value, icon: Icon, accent = "default", size = "lg", className, }) {
    return (_jsx(Card, { className: className, children: _jsxs(CardContent, { className: "flex items-center gap-3 p-4", children: [_jsx("div", { className: cn("flex shrink-0 items-center justify-center rounded-lg", ACCENT_STYLES[accent], size === "lg" ? "h-10 w-10" : "h-9 w-9"), children: _jsx(Icon, { className: size === "lg" ? "h-5 w-5" : "h-4 w-4" }) }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-xs text-muted-foreground", children: label }), _jsx("p", { className: cn("truncate font-semibold", size === "lg" ? "text-lg" : "text-sm"), children: value })] })] }) }));
}
//# sourceMappingURL=summary-tile.js.map