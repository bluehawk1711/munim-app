"use client";

/**
 * CategoryChips — quick-pick row of category names shared by the web +
 * desktop product forms (mobile mirrors it with RN Pressables).
 *
 * Silver products classify as "Silver · <category>" (see classifyProduct in
 * @munim/core), so the shop's silver sub-categories must be one tap away
 * instead of a dropdown round-trip. Presentational only: the caller owns the
 * category list and the current value.
 *
 * Hidden entirely when there is nothing to pick — never renders an empty row.
 */
import * as React from "react";
import { cn } from "../lib/utils";

export function CategoryChips({
  label,
  hint,
  categories,
  value,
  onSelect,
  className,
}: {
  /** Field label shown above the chips. */
  label: string;
  /** Optional helper line under the chips. */
  hint?: string | null;
  /** Distinct category names to offer (caller pre-filters/sorts). */
  categories: readonly string[];
  /** Currently selected category ("" / undefined = none). */
  value?: string | null;
  /** Fired when a chip is tapped — pass the category name. */
  onSelect: (category: string) => void;
  className?: string;
}) {
  const options = React.useMemo(
    () => categories.filter((c) => c.trim().length > 0),
    [categories],
  );

  if (options.length === 0) return null;

  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((c) => {
          const active = (value ?? "") === c;
          return (
            <button
              key={c}
              type="button"
              aria-pressed={active}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted bg-background",
              )}
              onClick={() => onSelect(c)}
            >
              {c}
            </button>
          );
        })}
      </div>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
