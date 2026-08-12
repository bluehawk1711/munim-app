"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Check } from "lucide-react";
import { themeLabels, themeNames, themeSwatches } from "@munim/theme";
import { cn } from "../lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger } from "./select";
export function ThemeSelect({ value, onChange, className, }) {
    return (_jsxs(Select, { value: value, onValueChange: (v) => onChange(v), children: [_jsx(SelectTrigger, { className: cn("h-8 gap-2 pr-2 text-xs", className), "aria-label": "Color theme", children: _jsxs("span", { className: "flex items-center gap-2", children: [_jsx(ThemeSwatchDot, { name: value }), themeLabels[value]] }) }), _jsx(SelectContent, { align: "end", className: "min-w-[9rem]", children: themeNames.map((name) => (_jsx(SelectItem, { value: name, className: "gap-2", children: _jsxs("span", { className: "flex items-center gap-2", children: [_jsx(ThemeSwatchDot, { name: name, active: value === name }), themeLabels[name]] }) }, name))) })] }));
}
/** Two-tone circular swatch for a theme, used in the trigger and the list. */
function ThemeSwatchDot({ name, active = false }) {
    const [primary, accent] = themeSwatches[name];
    return (_jsxs("span", { className: "relative flex h-4 w-4 shrink-0 items-center justify-center", children: [_jsx("span", { className: "block h-4 w-4 rounded-full shadow-sm ring-1 ring-black/10 dark:ring-white/15", style: {
                    background: `linear-gradient(135deg, ${primary} 0%, ${primary} 55%, ${accent} 55%, ${accent} 100%)`,
                } }), active && (_jsx("span", { className: "absolute flex h-2 w-2 items-center justify-center rounded-full", style: { background: primary, color: "#ffffff" }, children: _jsx(Check, { className: "h-1.5 w-1.5", strokeWidth: 4 }) }))] }));
}
//# sourceMappingURL=theme-select.js.map