"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Boxes } from "lucide-react";
import { cn } from "../lib/utils.js";
export function SidebarNav({ sections, activeKey, onNavigate, }) {
    return (_jsx("nav", { className: "flex flex-col gap-4 px-3 py-4", "aria-label": "Main navigation", children: sections.map((section) => (_jsxs("div", { children: [_jsx("p", { className: "px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70", children: section.label }), _jsx("div", { className: "flex flex-col gap-0.5", children: section.items.map((item) => {
                        const Icon = item.icon;
                        const active = activeKey === item.key;
                        return (_jsxs("button", { type: "button", onClick: () => onNavigate(item.key), "aria-current": active ? "page" : undefined, className: cn("group relative flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-all duration-200", "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground", active
                                ? "bg-sidebar-primary/10 text-sidebar-primary shadow-sm"
                                : "text-sidebar-foreground/80 hover:text-sidebar-foreground"), children: [active && (_jsx("span", { className: "absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-sidebar-primary transition-all duration-300" })), _jsx(Icon, { className: "h-4 w-4 shrink-0" }), _jsxs("span", { className: "flex flex-col items-start leading-tight", children: [_jsx("span", { children: item.label }), _jsx("span", { className: cn("text-[11px] font-normal", active ? "text-sidebar-primary/60" : "text-muted-foreground"), children: item.description })] })] }, item.key));
                    }) })] }, section.label))) }));
}
export function SidebarBrand({ title = "Munim", subtitle = "Shop Management", }) {
    return (_jsxs("div", { className: "flex h-16 items-center gap-2.5 border-b border-sidebar-border px-5", children: [_jsx("div", { className: "flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm shadow-primary/20", children: _jsx(Boxes, { className: "h-5 w-5" }) }), _jsxs("div", { className: "flex flex-col leading-tight", children: [_jsx("span", { className: "text-sm font-semibold text-sidebar-foreground", children: title }), _jsx("span", { className: "text-[11px] text-muted-foreground", children: subtitle })] })] }));
}
export function SidebarFooter({ note = "Stock · Billing · Khata" }) {
    return (_jsx("div", { className: "border-t border-sidebar-border px-5 py-4", children: _jsx("p", { className: "text-[11px] text-muted-foreground", children: note }) }));
}
//# sourceMappingURL=sidebar-nav.js.map