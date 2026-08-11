import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Check } from "lucide-react";
import { themeNames, themeLabels, themeSwatches } from "@munim/theme";
import { cn } from "../lib/utils";
/**
 * Apple-style theme swatch row — shared by web + desktop (both import from
 * @munim/ui). Circles show each theme's primary/accent duo; the selected one
 * gets a springy ring + check. `compact` shows only swatches (topbar),
 * otherwise labels are shown (Settings).
 *
 * Theme state lives in the app (web: `useAccentTheme` in theme-picker.tsx;
 * desktop: `useAccentTheme` in theme-swatches.tsx) — this component is purely
 * presentational so a new theme never requires editing two copies.
 */
export function ThemeSwatches({ value, onChange, compact = false, }) {
    return (_jsx("div", { className: cn("flex flex-wrap gap-2.5", compact ? "gap-2" : "gap-3"), children: themeNames.map((name) => {
            const [primary, accent] = themeSwatches[name];
            const active = value === name;
            return (_jsxs("button", { type: "button", onClick: () => onChange(name), "aria-label": `${themeLabels[name]} theme`, "aria-pressed": active, title: themeLabels[name], className: cn("group relative flex items-center gap-2.5 rounded-xl p-1.5 transition-colors active:scale-95", !compact && "w-full sm:w-auto sm:flex-col sm:items-center sm:gap-1.5 sm:rounded-2xl sm:p-3", active ? "bg-accent text-accent-foreground ring-1 ring-ring" : "hover:bg-muted/70"), children: [_jsxs("span", { className: "relative flex h-8 w-8 items-center justify-center", children: [_jsx("span", { className: "block h-8 w-8 rounded-full shadow-sm ring-1 ring-black/10 dark:ring-white/15", style: {
                                    background: `linear-gradient(135deg, ${primary} 0%, ${primary} 55%, ${accent} 55%, ${accent} 100%)`,
                                } }), _jsx("span", { className: cn("absolute flex h-4 w-4 items-center justify-center rounded-full transition-all duration-200", active ? "scale-100 opacity-100" : "scale-0 opacity-0"), style: { background: primary, color: "#ffffff" }, children: _jsx(Check, { className: "h-3 w-3", strokeWidth: 3.5 }) })] }), !compact && (_jsx("span", { className: "text-xs font-medium leading-tight sm:text-center", children: themeLabels[name] }))] }, name));
        }) }));
}
//# sourceMappingURL=theme-swatches.js.map