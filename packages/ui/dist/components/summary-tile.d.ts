/**
 * Shared summary tile — one stat with an icon chip. Used in the web and
 * desktop apps' summary strips (invoices, sales, advances) so both render
 * identical tiles from a single component.
 *
 * Accents: default (muted) | primary | amber | emerald | red
 * Sizes:   sm (compact strip, e.g. invoices) | lg (dashboard-style)
 */
import * as React from "react";
declare const ACCENT_STYLES: {
    readonly default: "bg-muted text-muted-foreground";
    readonly primary: "bg-primary/10 text-primary";
    readonly amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400";
    readonly emerald: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
    readonly red: "bg-red-500/15 text-red-600 dark:text-red-400";
};
export type SummaryTileAccent = keyof typeof ACCENT_STYLES;
export declare function SummaryTile({ label, value, icon: Icon, accent, size, className, }: {
    label: string;
    value: string;
    icon: React.ComponentType<{
        className?: string;
    }>;
    accent?: SummaryTileAccent;
    size?: "sm" | "lg";
    className?: string;
}): React.JSX.Element;
export {};
//# sourceMappingURL=summary-tile.d.ts.map