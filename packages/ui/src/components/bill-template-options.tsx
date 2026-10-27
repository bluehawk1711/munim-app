"use client"

/**
 * Shared bill template options — the exact same controls in the web and
 * desktop bill forms, so the two apps stay seamless: template (Classic
 * Jewellery / Modern E-commerce), classic accent color (red / yellow with a
 * swatch), the 2-in-1 toggle and its Duplicate / Separate mode select, plus
 * the per-bill display toggles (Weight column, rate rows, gold-rate karat
 * line with its show/source/custom-text options, Chejat/Nag signs).
 *
 * Purely presentational — callers own state and can add their own toasts on
 * change (web + desktop both use sonner).
 */
import * as React from "react";
import { cn } from "../lib/utils";
import { Input } from "./input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { Switch } from "./switch";
// The template settings model lives in @munim/core (the global model all three
// apps share) — imported here AND re-exported so the existing
// `from "@munim/ui"` imports in web + desktop keep working while mobile types
// from core directly.
import type { BillTemplate, BillClassicColor, BillMode, BillTemplateSettings, GoldRateKaratMode } from "@munim/core";
export type { BillTemplate, BillClassicColor, BillMode, BillTemplateSettings, GoldRateKaratMode } from "@munim/core";

/** Labels for the gold-rate purity line modes — one place so web/desktop match. */
const GOLD_RATE_KARAT_LABELS: Record<GoldRateKaratMode, string> = {
  off: "No karat line",
  base: "Shop base karat",
  product: "Product's karat",
  custom: "Custom text…",
};

export function BillTemplateOptions({
  template,
  classicColor,
  twoInOne,
  mode,
  weightAfterName,
  goldRateLine,
  silverRateLine,
  signSuffix,
  goldRateKaratMode,
  goldRateKaratText,
  onTemplate,
  onClassicColor,
  onTwoInOne,
  onMode,
  onWeightAfterName,
  onGoldRateLine,
  onSilverRateLine,
  onSignSuffix,
  onGoldRateKaratMode,
  onGoldRateKaratText,
  className,
}: {
  template: BillTemplate;
  classicColor: BillClassicColor;
  twoInOne: boolean;
  mode: BillMode;
  weightAfterName: boolean;
  goldRateLine: boolean;
  silverRateLine: boolean;
  /** Chejat/Nag direction marks — ON prints "Chejat: 0.100 +" / "Nag: 0.200 −". */
  signSuffix: boolean;
  /** What prints under the gold rate row — see `GoldRateKaratMode`. */
  goldRateKaratMode: GoldRateKaratMode;
  /** Free text for mode "custom". */
  goldRateKaratText: string;
  onTemplate: (t: BillTemplate) => void;
  onClassicColor: (c: BillClassicColor) => void;
  onTwoInOne: (on: boolean) => void;
  onMode: (m: BillMode) => void;
  onWeightAfterName: (on: boolean) => void;
  onGoldRateLine: (on: boolean) => void;
  onSilverRateLine: (on: boolean) => void;
  onSignSuffix: (on: boolean) => void;
  onGoldRateKaratMode: (m: GoldRateKaratMode) => void;
  onGoldRateKaratText: (t: string) => void;
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

      <div className="flex items-center gap-2">
        <Switch checked={twoInOne} onCheckedChange={onTwoInOne} aria-label="2-in-1 bill" />
        <label
          className="cursor-pointer text-xs font-medium text-muted-foreground select-none"
          onClick={() => onTwoInOne(!twoInOne)}
        >
          2-in-1 bill
        </label>
      </div>

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

      <div className="flex items-center gap-2">
        <Switch checked={weightAfterName} onCheckedChange={onWeightAfterName} aria-label="Weight column" />
        <label
          className="cursor-pointer text-xs font-medium text-muted-foreground select-none"
          onClick={() => onWeightAfterName(!weightAfterName)}
        >
          Weight column
        </label>
      </div>

      <div className="flex items-center gap-2">
        <Switch checked={goldRateLine} onCheckedChange={onGoldRateLine} aria-label="Gold rate line" />
        <label
          className="cursor-pointer text-xs font-medium text-muted-foreground select-none"
          onClick={() => onGoldRateLine(!goldRateLine)}
        >
          Gold rate line
        </label>
      </div>

      {/* Purity under the gold rate row — shown only while the row itself is
          on. "Product's karat" prints the bill's first gold line's karat
          (the selected product's), "Custom text…" lets the shop word it. */}
      {goldRateLine && (
        <>
          <Select value={goldRateKaratMode} onValueChange={(v) => onGoldRateKaratMode(v as GoldRateKaratMode)}>
            <SelectTrigger className="h-8 w-[152px] text-xs" aria-label="Karat line under gold rate">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(GOLD_RATE_KARAT_LABELS) as GoldRateKaratMode[]).map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {GOLD_RATE_KARAT_LABELS[mode]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {goldRateKaratMode === "custom" && (
            <Input
              value={goldRateKaratText}
              onChange={(e) => onGoldRateKaratText(e.target.value)}
              placeholder="e.g. 22K hallmark"
              maxLength={80}
              className="h-8 w-[140px] text-xs"
              aria-label="Custom karat text"
            />
          )}
        </>
      )}

      <div className="flex items-center gap-2">
        <Switch checked={silverRateLine} onCheckedChange={onSilverRateLine} aria-label="Silver rate line" />
        <label
          className="cursor-pointer text-xs font-medium text-muted-foreground select-none"
          onClick={() => onSilverRateLine(!silverRateLine)}
        >
          Silver rate line
        </label>
      </div>

      {template === "ecommerce" && (
        <div className="flex items-center gap-2">
          <Switch checked={signSuffix} onCheckedChange={onSignSuffix} aria-label="Chejat/Nag signs" />
          <label
            className="cursor-pointer text-xs font-medium text-muted-foreground select-none"
            onClick={() => onSignSuffix(!signSuffix)}
          >
            Chejat/Nag signs
          </label>
        </div>
      )}
    </div>
  );
}
