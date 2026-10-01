"use client";

/**
 * LabourInput — one shared control for the labour-cost method + amount,
 * used by BOTH web and desktop (Settings → default labour, product forms →
 * per-product labour) so the two apps stay identical (AGENTS.md §4b).
 *
 * Three methods (see `@munim/core` pricing/labour.ts):
 *   PERCENT  → % of metal value
 *   FIXED    → flat ₹ added
 *   PER_GRAM → ₹ per gram × weight
 *
 * Controlled: the host owns `type` + `value` and persists them; this component
 * only renders + reports changes. An empty `value` means "not configured"
 * (gold falls back to the shop default, silver means no labour).
 */
import * as React from "react";
import { IndianRupee, Percent, Scale } from "lucide-react";
import { LABOUR_TYPES, type LabourType } from "@munim/core";
import { Input } from "./input.js";
import { Label } from "./label.js";
import { cn } from "../lib/utils.js";

export type LabourInputProps = {
  /** Selected method. */
  type: LabourType;
  /** Raw text — "" (empty) means "not configured". */
  value: string;
  onTypeChange: (type: LabourType) => void;
  onValueChange: (value: string) => void;
  /** Field label (default "Labour"). */
  label?: string;
  /** Helper line under the input (e.g. the shop-default hint). */
  hint?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
};

const METHOD_META: Record<LabourType, { label: string; unit: string; title: string; Icon: typeof Percent }> = {
  PERCENT: { label: "%", unit: "%", title: "Percent of metal value", Icon: Percent },
  FIXED: { label: "₹", unit: "₹", title: "Fixed amount added", Icon: IndianRupee },
  PER_GRAM: { label: "₹/g", unit: "₹/g", title: "Rupees per gram × weight", Icon: Scale },
};

export function LabourInput({
  type,
  value,
  onTypeChange,
  onValueChange,
  label = "Labour",
  hint,
  id,
  disabled = false,
  className,
}: LabourInputProps) {
  const meta = METHOD_META[type] ?? METHOD_META.PERCENT;
  const inputId = id ?? "labour-value";

  // Live text while the field has focus. Hosts round the number on every
  // change ("12." → 12 → "12"), and a controlled input re-renders would wipe
  // the "." mid-typing — keeping the raw text locally makes decimals typeable.
  const [editing, setEditing] = React.useState<string | null>(null);
  const shown = editing ?? value;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={inputId}>{label}</Label>
      <div className="flex items-center gap-2">
        <div
          role="tablist"
          aria-label="Labour method"
          className="inline-flex shrink-0 items-center gap-0.5 rounded-lg border bg-muted/40 p-0.5"
        >
          {LABOUR_TYPES.map((method) => {
            const m = METHOD_META[method];
            const active = method === type;
            return (
              <button
                key={method}
                type="button"
                role="tab"
                aria-selected={active}
                title={m.title}
                disabled={disabled}
                onClick={() => onTypeChange(method)}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  active
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <m.Icon className="h-3.5 w-3.5" />
                {m.label}
              </button>
            );
          })}
        </div>
        <div className="relative flex-1">
          <Input
            id={inputId}
            type="text"
            inputMode="decimal"
            className="h-9 pr-10 tabular-nums"
            placeholder={type === "FIXED" ? "e.g. 1500" : type === "PER_GRAM" ? "e.g. 120" : "e.g. 12"}
            value={shown}
            disabled={disabled}
            onChange={(e) => {
              setEditing(e.target.value);
              onValueChange(e.target.value);
            }}
            onBlur={() => setEditing(null)}
          />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">
            {meta.unit}
          </span>
        </div>
      </div>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
