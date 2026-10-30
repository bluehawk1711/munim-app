"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "../lib/utils.js";
export function TooltipContent({ className, sideOffset = 6, ...props }) {
    return (_jsx(TooltipPrimitive.Portal, { children: _jsx(TooltipPrimitive.Content, { "data-slot": "tooltip-content", sideOffset: sideOffset, className: cn("bg-popover text-popover-foreground z-[10000] overflow-hidden rounded-md border px-2.5 py-1 text-xs font-medium shadow-md select-none", className), ...props }) }));
}
export function Tooltip({ label, children, side = "top", align = "center", delayDuration = 250, }) {
    if (!label)
        return children;
    return (_jsx(TooltipPrimitive.Provider, { delayDuration: delayDuration, children: _jsxs(TooltipPrimitive.Root, { children: [_jsx(TooltipPrimitive.Trigger, { asChild: true, children: children }), _jsx(TooltipContent, { side: side, align: align, children: label })] }) }));
}
//# sourceMappingURL=tooltip.js.map