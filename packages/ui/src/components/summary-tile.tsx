"use client"

/**
 * Shared summary tile — one stat with an icon chip. Used in the web and
 * desktop apps' summary strips (invoices, sales, advances) so both render
 * identical tiles from a single component.
 *
 * Accents: default (muted) | primary | amber | emerald | red
 * Sizes:   sm (compact strip, e.g. invoices) | lg (dashboard-style)
 */
import * as React from "react";
import { cn } from "../lib/utils";
import { Card, CardContent } from "./card";

const ACCENT_STYLES = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  emerald: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  red: "bg-red-500/15 text-red-600 dark:text-red-400",
} as const;

export type SummaryTileAccent = keyof typeof ACCENT_STYLES;

export function SummaryTile({
  label,
  value,
  icon: Icon,
  accent = "default",
  size = "lg",
  className,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: SummaryTileAccent;
  size?: "sm" | "lg";
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-lg",
            ACCENT_STYLES[accent],
            size === "lg" ? "h-10 w-10" : "h-9 w-9"
          )}
        >
          <Icon className={size === "lg" ? "h-5 w-5" : "h-4 w-4"} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p
            className={cn(
              "truncate font-semibold",
              size === "lg" ? "text-lg" : "text-sm"
            )}
          >
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
