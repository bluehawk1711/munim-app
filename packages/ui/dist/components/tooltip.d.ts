/**
 * Tooltip — one small wrapper over Radix so icon-only buttons can carry a
 * label across web + desktop. Each tooltip owns its provider (there are only
 * a handful of icon buttons per screen), so apps never need extra wiring.
 */
import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
export declare function TooltipContent({ className, sideOffset, ...props }: React.ComponentProps<typeof TooltipPrimitive.Content>): React.JSX.Element;
export declare function Tooltip({ label, children, side, align, delayDuration, }: {
    label: React.ReactNode;
    children: React.ReactElement;
    side?: React.ComponentProps<typeof TooltipPrimitive.Content>["side"];
    align?: React.ComponentProps<typeof TooltipPrimitive.Content>["align"];
    delayDuration?: number;
}): React.JSX.Element;
//# sourceMappingURL=tooltip.d.ts.map