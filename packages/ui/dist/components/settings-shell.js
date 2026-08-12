"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { cn } from "../lib/utils";
export function SettingsShell({ sections, active, onSelect, title, subtitle, children, }) {
    const current = sections.find((s) => s.id === active) ?? sections[0];
    return (_jsxs(_Fragment, { children: [_jsx("style", { children: SETTINGS_SECTION_CSS }), _jsxs("div", { className: "flex flex-col gap-5 lg:flex-row lg:items-start", children: [_jsxs("nav", { "aria-label": "Settings sections", className: "glass hidden w-full max-w-[264px] shrink-0 flex-col rounded-2xl border bg-card/70 p-2 shadow-sm backdrop-blur-xl lg:sticky lg:top-4 lg:flex", children: [_jsxs("div", { className: "px-3 pt-2 pb-3", children: [_jsx("h2", { className: "text-sm font-semibold tracking-tight", children: title }), subtitle ? (_jsx("p", { className: "mt-0.5 text-xs text-muted-foreground", children: subtitle })) : null] }), _jsx("div", { className: "flex flex-col gap-1", children: sections.map((s) => {
                                    const isActive = s.id === active;
                                    const Icon = s.icon;
                                    return (_jsxs("button", { type: "button", onClick: () => onSelect(s.id), "aria-current": isActive ? "page" : undefined, className: cn("group flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors duration-150", "text-muted-foreground hover:bg-muted/70 hover:text-foreground", isActive && "bg-primary/10 font-medium text-primary hover:bg-primary/15 hover:text-primary"), children: [_jsx("span", { className: cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors duration-150", isActive
                                                    ? "bg-primary/15 text-primary"
                                                    : "bg-muted text-muted-foreground group-hover:text-foreground"), children: _jsx(Icon, { className: "h-4 w-4", strokeWidth: 2.1 }) }), _jsxs("span", { className: "min-w-0 flex-1", children: [_jsx("span", { className: "block truncate text-[13px] leading-tight font-medium", children: s.label }), _jsx("span", { className: "block truncate text-[11px] text-muted-foreground/80", children: s.description })] }), s.badge ? (_jsx("span", { className: cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", isActive ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"), children: s.badge })) : null] }, s.id));
                                }) })] }), _jsxs("div", { className: "lg:hidden", children: [_jsx("h2", { className: "px-1 text-sm font-semibold tracking-tight", children: title }), subtitle ? (_jsx("p", { className: "px-1 mt-0.5 mb-2 text-xs text-muted-foreground", children: subtitle })) : null, _jsx("div", { "aria-label": "Settings sections", className: "-mx-1 flex gap-2 overflow-x-auto px-1 pb-1", style: { scrollbarWidth: "thin" }, children: sections.map((s) => {
                                    const isActive = s.id === active;
                                    const Icon = s.icon;
                                    return (_jsxs("button", { type: "button", onClick: () => onSelect(s.id), "aria-current": isActive ? "page" : undefined, className: cn("flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-150", isActive
                                            ? "border-primary/30 bg-primary/10 text-primary"
                                            : "border-border bg-card/70 text-muted-foreground hover:text-foreground"), children: [_jsx(Icon, { className: "h-3.5 w-3.5", strokeWidth: 2.1 }), s.label, s.badge ? _jsxs("span", { className: "opacity-70", children: ["\u00B7 ", s.badge] }) : null] }, s.id));
                                }) })] }), _jsxs("div", { className: "settings-section-enter min-w-0 flex-1", children: [_jsxs("div", { className: "mb-4 hidden lg:block", children: [_jsx("h2", { className: "text-base font-semibold tracking-tight", children: current?.label }), current ? (_jsx("p", { className: "mt-0.5 text-sm text-muted-foreground", children: current.description })) : null] }), children] }, active)] })] }));
}
/** Enter animation used by the content pane when switching sections. */
export const SETTINGS_SECTION_CSS = `
@keyframes munim-settings-enter {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.settings-section-enter { animation: munim-settings-enter 0.28s cubic-bezier(0.25, 0.46, 0.45, 0.94) both; }
@media (prefers-reduced-motion: reduce) {
  .settings-section-enter { animation: none; }
}
`;
//# sourceMappingURL=settings-shell.js.map