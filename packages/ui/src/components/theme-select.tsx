"use client"

/**
 * Compact theme picker — a normal shadcn Select with a color swatch on the
 * left and the theme label on the right. Shared by web + desktop for the
 * header and Settings so both platforms look identical and stay compact.
 *
 * Uses the same token sources as ThemeSwatches (@munim/theme), so a new theme
 * never requires touching this component.
 */
import * as React from "react";
import { Check } from "lucide-react";
import { themeLabels, themeNames, themeSwatches, type ThemeName } from "@munim/theme";
import { cn } from "../lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger } from "./select";

export function ThemeSelect({
  value,
  onChange,
  className,
}: {
  value: ThemeName;
  onChange: (t: ThemeName) => void;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ThemeName)}>
      <SelectTrigger className={cn("h-8 gap-2 pr-2 text-xs", className)} aria-label="Color theme">
        <span className="flex items-center gap-2">
          <ThemeSwatchDot name={value} />
          {themeLabels[value]}
        </span>
      </SelectTrigger>
      <SelectContent align="end" className="min-w-[9rem]">
        {themeNames.map((name) => (
          <SelectItem key={name} value={name} className="gap-2">
            <span className="flex items-center gap-2">
              <ThemeSwatchDot name={name} active={value === name} />
              {themeLabels[name]}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Two-tone circular swatch for a theme, used in the trigger and the list. */
function ThemeSwatchDot({ name, active = false }: { name: ThemeName; active?: boolean }) {
  const [primary, accent] = themeSwatches[name];
  return (
    <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
      <span
        className="block h-4 w-4 rounded-full shadow-sm ring-1 ring-black/10 dark:ring-white/15"
        style={{
          background: `linear-gradient(135deg, ${primary} 0%, ${primary} 55%, ${accent} 55%, ${accent} 100%)`,
        }}
      />
      {active && (
        <span
          className="absolute flex h-2 w-2 items-center justify-center rounded-full"
          style={{ background: primary, color: "#ffffff" }}
        >
          <Check className="h-1.5 w-1.5" strokeWidth={4} />
        </span>
      )}
    </span>
  );
}
