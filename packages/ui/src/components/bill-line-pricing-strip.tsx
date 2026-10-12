"use client";

/**
 * BillLinePricingStrip — the per-line pricing editor row shown under a bill
 * line once an auto-priced Gold/Silver product is picked: the rate (₹/g),
 * labour method + value, and the flat ₹ charges (nag on gold, povayi, other)
 * that feed the printed bill's Rate/Labour/Other Charges columns and price.
 * The read-out also shows the combined Other Charges total — exactly what
 * the bill's "Other Charges" column prints (nag + povayi + other summed).
 *
 * Presentational only: the host owns the raw strings (empty = "keep the
 * product's default"), computes the read-only slices (metal value / labour
 * amount) with the core pricing engine, and re-prices on every change.
 *
 * Desktop New Bill uses it today; web New Bill wires THIS component next —
 * never fork it into an app (AGENTS.md §4b).
 */
import { LABOUR_TYPES, isLabourType, type LabourType } from "@munim/core";
import { Input } from "./input.js";
import { Label } from "./label.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select.js";
import { formatMoney } from "../lib/format.js";
import { cn } from "../lib/utils.js";

export type BillLinePricingStripValue = {
  /** ₹/gram applied to this line ("" = the bill/table rate). */
  ratePerGram: string;
  /** Labour method — "" = the product's own method. */
  labourType: string;
  /** Labour rate/amount ("" = product/default). */
  labourValue: string;
  /** Silver purity % (silver lines only). */
  silverPercentage: string;
  /** Flat ₹ nag charge (gold lines only). */
  nag: string;
  /** Flat ₹ povayi charge. */
  povayi: string;
  /** Flat ₹ other charges. */
  otherCharges: string;
};

export type BillLinePricingStripProps = {
  /** Which metal priced this line — hides the other metal's fields. */
  metal: "Gold" | "Silver";
  value: BillLinePricingStripValue;
  onChange: (patch: Partial<BillLinePricingStripValue>) => void;
  /** Effective labour method when the line hasn't set one (product/shop default). */
  effectiveLabourType?: LabourType;
  /** Placeholder for an empty rate — the ₹/g actually applied. */
  effectiveRatePerGram?: string;
  /** Placeholder for an empty labour value — the amount actually applied. */
  effectiveLabourValue?: string;
  /** Read-only computed slices (null/undefined → nothing to show). */
  metalValue?: number | null;
  labourAmount?: number | null;
  /** Combined Other Charges ₹ (nag + povayi + other) from the live breakdown
   *  — exactly what the bill's "Other Charges" column will print for this
   *  line. Null → hidden. */
  otherChargesTotal?: number | null;
  /** False → auto pricing is inactive (e.g. weight missing): show a hint. */
  autoPricing?: boolean;
  className?: string;
};

function SmallField({
  label,
  value,
  placeholder,
  onChange,
  className,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-muted-foreground text-[11px]">{label}</Label>
      <Input
        type="number"
        min={0}
        step="any"
        inputMode="decimal"
        className="h-8 text-xs tabular-nums"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function BillLinePricingStrip({
  metal,
  value,
  onChange,
  effectiveLabourType,
  effectiveRatePerGram,
  effectiveLabourValue,
  metalValue,
  labourAmount,
  otherChargesTotal,
  autoPricing = true,
  className,
}: BillLinePricingStripProps) {
  const labourType: LabourType = isLabourType(value.labourType)
    ? value.labourType
    : (effectiveLabourType ?? "PERCENT");

  return (
    <div className={cn("border-t pt-2", className)}>
      <div className="flex flex-wrap items-end gap-2">
        <SmallField
          label="Rate ₹/g"
          className="w-24"
          value={value.ratePerGram}
          placeholder={effectiveRatePerGram}
          onChange={(v) => onChange({ ratePerGram: v })}
        />
        {metal === "Silver" && (
          <SmallField
            label="Silver %"
            className="w-20"
            value={value.silverPercentage}
            onChange={(v) => onChange({ silverPercentage: v })}
          />
        )}
        <div className="w-44 space-y-1.5">
          <Label className="text-muted-foreground text-[11px]">Labour</Label>
          <div className="flex items-center gap-1">
            <Select value={labourType} onValueChange={(v) => onChange({ labourType: v })}>
              <SelectTrigger className="h-8 w-20 gap-1 text-xs" aria-label="Labour method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LABOUR_TYPES.map((method) => (
                  <SelectItem key={method} value={method}>
                    {method === "PERCENT" ? "%" : method === "FIXED" ? "₹" : "₹/g"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              className="h-8 flex-1 text-xs tabular-nums"
              value={value.labourValue}
              placeholder={effectiveLabourValue}
              onChange={(e) => onChange({ labourValue: e.target.value })}
              aria-label="Labour value"
            />
          </div>
        </div>
        {metal === "Gold" && (
          <SmallField
            label="Nag ₹"
            className="w-20"
            value={value.nag}
            onChange={(v) => onChange({ nag: v })}
          />
        )}
        <SmallField
          label="Povayi ₹"
          className="w-20"
          value={value.povayi}
          onChange={(v) => onChange({ povayi: v })}
        />
        <SmallField
          label="Other ₹"
          className="w-20"
          value={value.otherCharges}
          onChange={(v) => onChange({ otherCharges: v })}
        />
        {autoPricing ? (
          <p className="text-muted-foreground ml-auto self-center pb-2 text-[11px] tabular-nums">
            Metal {formatMoney(metalValue ?? 0)} · Labour {formatMoney(labourAmount ?? 0)}
            {otherChargesTotal != null && otherChargesTotal > 0
              ? ` · Other ${formatMoney(otherChargesTotal)}`
              : ""}
          </p>
        ) : (
          <p className="text-amber-600 dark:text-amber-400 ml-auto self-center pb-2 text-[11px]">
            Enter weight for auto pricing
          </p>
        )}
      </div>
    </div>
  );
}
