"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "../lib/utils";
import { Badge } from "./badge";
import { Button } from "./button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
export function KhataCard({ title, description, icon: Icon, accent, parties, emptyText, onAction, onViewAll, }) {
    return (_jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-3", children: [_jsxs("div", { className: "flex items-center gap-2.5", children: [_jsx("div", { className: cn("flex h-9 w-9 items-center justify-center rounded-lg", accent === "emerald"
                                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                    : "bg-red-500/15 text-red-600 dark:text-red-400"), children: _jsx(Icon, { className: "h-5 w-5" }) }), _jsxs("div", { children: [_jsx(CardTitle, { className: "text-sm", children: title }), _jsx(CardDescription, { className: "text-xs", children: description })] })] }), _jsx(Button, { variant: "ghost", size: "sm", onClick: onViewAll, className: "text-xs", children: "View all" })] }), _jsx(CardContent, { className: "p-0", children: parties.length === 0 ? (_jsx("p", { className: "px-4 py-8 text-center text-xs text-muted-foreground", children: emptyText })) : (_jsx("div", { className: "divide-y", children: parties.slice(0, 8).map((p) => (_jsxs("div", { className: "flex items-center justify-between gap-3 px-4 py-2.5", children: [_jsxs("div", { className: "flex min-w-0 items-center gap-2.5", children: [_jsx("div", { className: "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold", children: p.name.charAt(0).toUpperCase() }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "truncate text-sm font-medium", children: p.name }), _jsx("p", { className: "text-xs text-muted-foreground capitalize", children: p.type.toLowerCase() })] })] }), _jsxs("div", { className: "flex shrink-0 items-center gap-2", children: [_jsx("span", { className: cn("text-sm font-semibold tabular-nums", accent === "emerald"
                                            ? "text-emerald-600 dark:text-emerald-400"
                                            : "text-red-600 dark:text-red-400"), children: formatMoney(accent === "emerald" ? p.balance : Math.abs(p.balance)) }), _jsx(Badge, { variant: "outline", className: cn("cursor-pointer font-normal", accent === "emerald" ? "hover:border-emerald-500/50" : "hover:border-red-500/50"), onClick: () => onAction(p, accent === "emerald" ? "PAYMENT_IN" : "PAYMENT_OUT"), children: accent === "emerald" ? "Collect" : "Pay" }), _jsxs(Badge, { variant: "outline", className: "cursor-pointer font-normal", onClick: () => onAction(p, accent === "emerald" ? "GIVEN" : "TAKEN"), children: ["+", accent === "emerald" ? "Give" : "Take"] })] })] }, p.id))) })) })] }));
}
/** Local INR formatter so the shared component has no runtime deps on core. */
function formatMoney(value) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(value);
}
//# sourceMappingURL=khata-card.js.map