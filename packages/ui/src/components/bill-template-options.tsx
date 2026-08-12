"use client"

/**
 * Shared bill template options — the exact same controls in the web and
 * desktop bill forms, so the two apps stay seamless: template (Classic
 * Jewellery / Modern E-commerce), classic accent color (red / yellow with a
 * swatch), the 2-in-1 toggle and its Duplicate / Separate mode select.
 *
 * Purely presentational — callers own state and can add their own toasts on
 * change (web + desktop both use sonner).
 */
import * as React from "react";
import { cn } from "../lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
// The template settings model lives in @munim/core (the global model all three
// apps share) — imported here AND re-exported so the existing
// `from "@munim/ui"` imports in web + desktop keep working while mobile types
// from core directly.
import type { BillTemplate, BillClassicColor, BillMode, BillTemplateSettings } from "@munim/core";
export type { BillTemplate, BillClassicColor, BillMode, BillTemplateSettings } from "@munim/core";

export function BillTemplateOptions({
  template,
  classicColor,
  twoInOne,
  mode,
  onTemplate,
  onClassicColor,
  onTwoInOne,
  onMode,
  className,
}: {
  template: BillTemplate;
  classicColor: BillClassicColor;
  twoInOne: boolean;
  mode: BillMode;
  onTemplate: (t: BillTemplate) => void;
  onClassicColor: (c: BillClassicColor) => void;
  onTwoInOne: (on: boolean) => void;
  onMode: (m: BillMode) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <Select value={template} onValueChange={(v) => onTemplate(v as BillTemplate)}>
        <SelectTrigger className="h-8 w-[180px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="jewellery">Classic Jewellery</SelectItem>
          <SelectItem value="ecommerce">Modern E-commerce</SelectItem>
        </SelectContent>
      </Select>

      {template === "jewellery" && (
        <Select value={classicColor} onValueChange={(v) => onClassicColor(v as BillClassicColor)}>
          <SelectTrigger className="h-8 w-[150px] text-xs">
            <span className="flex items-center gap-2">
              <span
                className={cn("h-3.5 w-3.5 rounded-full", classicColor === "red" ? "bg-red-600" : "bg-yellow-500")}
              />
              {classicColor === "red" ? "Red theme" : "Yellow theme"}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="red">
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 rounded-full bg-red-600" /> Red theme
              </span>
            </SelectItem>
            <SelectItem value="yellow">
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 rounded-full bg-yellow-500" /> Yellow theme
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      )}

      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={twoInOne}
          onChange={(e) => onTwoInOne(e.target.checked)}
          className="accent-amber-500"
        />
        2-in-1 bill
      </label>

      {twoInOne && (
        <Select value={mode} onValueChange={(v) => onMode(v as BillMode)}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="duplicate">Duplicate</SelectItem>
            <SelectItem value="distinct">Separate</SelectItem>
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
