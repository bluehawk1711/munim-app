"use client"

/**
 * EstimateColumnToggles — the per-metal "Bill columns" switch grid that
 * hides columns of the Modern E-commerce estimate. Shared by the web AND
 * desktop bill forms (the desktop previously forked this markup inline), so
 * the two apps can never drift.
 *
 * Purely presentational — callers own `hiddenGold`/`hiddenSilver` (the
 * `BillTemplateSettings.hiddenColumns` arrays) and the toggle handler.
 * Column labels come from core (`GOLD_ESTIMATE_COLUMNS` /
 * `SILVER_ESTIMATE_COLUMNS`) — the same list the PDF/HTML renderers honour.
 */
import * as React from "react";
import {
  GOLD_ESTIMATE_COLUMNS,
  SILVER_ESTIMATE_COLUMNS,
  type BillTemplate,
  type EstimateColumnId,
} from "@munim/core";
import { Switch } from "./switch";

export function EstimateColumnToggles({
  template,
  hiddenGold,
  hiddenSilver,
  onToggle,
}: {
  /** Classic Jewellery has a fixed layout — the grid explains that and hides the switches. */
  template: BillTemplate;
  hiddenGold: EstimateColumnId[];
  hiddenSilver: EstimateColumnId[];
  onToggle: (metal: "gold" | "silver", column: EstimateColumnId) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Bill columns</p>
        <p className="text-[11px] text-muted-foreground">
          {template === "jewellery"
            ? "Column toggles apply to the Modern E-commerce estimate grid — the Classic Jewellery template has its own fixed layout."
            : "Turn a column off to hide it from the printed bill — per metal, since gold and silver have different fields."}
        </p>
      </div>
      {template === "jewellery" ? null : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Gold bill</p>
            {GOLD_ESTIMATE_COLUMNS.map((c) => (
              <label key={`g-${c.id}`} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">{c.label}</span>
                <Switch
                  checked={!hiddenGold.includes(c.id)}
                  onCheckedChange={() => onToggle("gold", c.id)}
                  aria-label={`Gold: ${c.label}`}
                />
              </label>
            ))}
          </div>
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Silver bill</p>
            {SILVER_ESTIMATE_COLUMNS.map((c) => (
              <label key={`s-${c.id}`} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">{c.label}</span>
                <Switch
                  checked={!hiddenSilver.includes(c.id)}
                  onCheckedChange={() => onToggle("silver", c.id)}
                  aria-label={`Silver: ${c.label}`}
                />
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
