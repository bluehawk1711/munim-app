"use client";

/**
 * GoldRateEditor — the shop's metal rates + default labour for dynamic
 * pricing, shared by web and desktop (Settings → Gold rate) so both surfaces
 * stay identical (AGENTS.md §4b).
 *
 * Owns the DRAFT of the 0–24 gold rate table: edits stay local until
 * `onSave(rates)` is called. Derivation uses the SAME core helper the API and
 * the report SQL use (`resolveGoldRateTable`), so the numbers in this grid
 * are exactly the numbers every bill will use.
 *
 * The shop default LABOUR (gold products without their own) and the shop-wide
 * SILVER ₹/g live in the host page (they are settings, saved with the table).
 */
import * as React from "react";
import { BadgeIndianRupee, Loader2, RotateCcw, Save, Sparkles } from "lucide-react";
import { resolveGoldRateTable, type LabourType } from "@munim/core";
import { Button } from "./button.js";
import { Input } from "./input.js";
import { Label } from "./label.js";
import { LabourInput } from "./labour-input.js";
import { Skeleton } from "./skeleton.js";
import { cn } from "../lib/utils.js";

/** A row as the API returns it (quoted or derived). */
export type GoldRateEditorRow = {
  karat: number;
  ratePerGram: number;
  isCustom: boolean;
  derived: boolean;
  purityPercent: number;
};

/** What `onSave` sends back — one entry per karat, 0–24. */
export type GoldRateDraft = {
  karat: number;
  ratePerGram: number;
  isCustom: boolean;
};

export type GoldRateEditorProps = {
  /** Server truth (all 25 karats). `undefined`/`null` → loading skeletons. */
  rates: readonly GoldRateEditorRow[] | null | undefined;
  /** Shop default labour METHOD for gold products without their own. */
  labourType: LabourType;
  /** Shop default labour rate/amount (0 → no default labour). */
  labourValue: number;
  /** Fired when the default labour method or amount changes. */
  onLabourChange: (type: LabourType, value: number) => void;
  /** Shop-wide silver ₹/gram (0 → silver never auto-prices). */
  silverRatePerGram: number;
  /** Fired on every keystroke — the page owns the persisted value. */
  onSilverRateChange: (value: number) => void;
  /** Fired by Save with the complete 0–24 table. */
  onSave: (rates: GoldRateDraft[]) => void;
  saving?: boolean;
  /** Optional: fill `goldKarat` on existing gold products from their purity. */
  onBackfillKarats?: () => void;
  backfilling?: boolean;
  /** Formatted "last updated" stamp (the page decides the format). */
  updatedLabel?: string | null;
  /** Compact mode (product forms): just the base-rate row + Save, no grid. */
  compact?: boolean;
  /** Compact mode: override the base karat (the host already resolved the table). */
  baseKarat?: number;
  /** Compact mode: the already-resolved table (skips the internal draft state). */
  ratesTable?: readonly GoldRateEditorRow[] | null;
};

export function GoldRateEditor({
  rates,
  labourType,
  labourValue,
  onLabourChange,
  silverRatePerGram,
  onSilverRateChange,
  onSave,
  saving = false,
  onBackfillKarats,
  backfilling = false,
  updatedLabel,
  compact = false,
  baseKarat: baseKaratProp,
  ratesTable = null,
}: GoldRateEditorProps) {
  const [draft, setDraft] = React.useState<Record<number, GoldRateDraft>>({});
  const [touched, setTouched] = React.useState(false);

  // Live text of the field being typed (see LabourInput): the draft stores
  // parsed numbers, so without this a "7200." would re-render as "7200" and
  // swallow the decimal point mid-typing.
  const [editing, setEditing] = React.useState<{ key: string; text: string } | null>(null);
  const shownText = (key: string, num: number): string =>
    editing?.key === key ? editing.text : num ? String(num) : "";
  const editText = (key: string, text: string, apply: (text: string) => void) => {
    setEditing({ key, text });
    apply(text);
  };

  // Seed the draft from the server rows; a save re-seeds it with fresh values.
  React.useEffect(() => {
    if (!rates) return;
    const next: Record<number, GoldRateDraft> = {};
    for (const row of rates) {
      next[row.karat] = {
        karat: row.karat,
        ratePerGram: row.ratePerGram,
        isCustom: row.isCustom,
      };
    }
    setDraft(next);
    setTouched(false);
    setEditing(null);
  }, [rates]);

  /** The expanded 0–24 table — plain quoted rows plus derived karats. */
  const table = React.useMemo(() => resolveGoldRateTable(Object.values(draft)), [draft]);

  // Base karat = highest quoted karat (usually 24K); it scales every derived row.
  const base = React.useMemo(() => {
    let highest: { karat: number; ratePerGram: number } | null = null;
    for (const entry of table) {
      if (entry.isCustom && entry.ratePerGram > 0) highest = entry;
    }
    return highest;
  }, [table]);
  const baseKarat = baseKaratProp ?? base?.karat ?? 24;
  const baseRate = table.find((entry) => entry.karat === baseKarat)?.ratePerGram ?? 0;

  const isLoading = ratesTable === null ? rates === null || rates === undefined : ratesTable === null;
  const quotedCount = table.filter((entry) => entry.isCustom && entry.ratePerGram > 0).length;

  function setRate(karat: number, value: string) {
    const parsed = Number.parseFloat(value);
    const ratePerGram = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    setDraft((prev) => ({ ...prev, [karat]: { karat, ratePerGram, isCustom: true } }));
    setTouched(true);
  }

  function resetKarat(karat: number) {
    setEditing((prev) => (prev?.key === `rate:${karat}` ? null : prev));
    setDraft((prev) => ({ ...prev, [karat]: { karat, ratePerGram: 0, isCustom: false } }));
    setTouched(true);
  }

  function handleSave() {
    onSave(
      table.map((entry) => ({
        karat: entry.karat,
        ratePerGram: entry.ratePerGram,
        isCustom: entry.isCustom && entry.ratePerGram > 0,
      })),
    );
  }

  function handleLabourValue(value: string) {
    const parsed = Number.parseFloat(value);
    const next = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    onLabourChange(labourType, next);
    setTouched(true);
  }

  function handleSilverRate(value: string) {
    const parsed = Number.parseFloat(value);
    onSilverRateChange(Number.isFinite(parsed) ? Math.max(0, parsed) : 0);
    setTouched(true);
  }

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="gold-compact-base-rate">Base rate — {baseKarat}K (₹/g)</Label>
            <Input
              id="gold-compact-base-rate"
              type="text"
              inputMode="decimal"
              className="h-9 tabular-nums"
              placeholder="e.g. 7200"
              value={shownText("base", baseRate)}
              onChange={(e) => editText("base", e.target.value, (t) => setRate(baseKarat, t))}
              onBlur={() => setEditing(null)}
            />
            <p className="text-[11px] text-muted-foreground">
              Every un-quoted karat follows it proportionally (rate × karat ÷ {baseKarat}).
            </p>
          </div>
          <LabourInput
            id="gold-compact-labour"
            type={labourType}
            value={labourValue ? String(labourValue) : ""}
            onTypeChange={(type) => {
              onLabourChange(type, labourValue);
              setTouched(true);
            }}
            onValueChange={handleLabourValue}
            label="Default labour (gold)"
            hint="Applied when a gold product has no labour of its own."
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={handleSave} disabled={saving || isLoading}>
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            {saving ? "Saving…" : "Save rates"}
          </Button>
          {onBackfillKarats ? (
            <Button
              type="button"
              variant="outline"
              onClick={onBackfillKarats}
              disabled={backfilling}
              title="Fill the karat field on existing gold products from their purity stamp (22K / 916)"
            >
              {backfilling ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Fill karats from purity
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Base rate + default labour + silver rate ─────────────────── */}
      <div className="rounded-2xl border bg-card/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <BadgeIndianRupee className="h-4 w-4" /> Metal rates &amp; default labour
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Gold prices are always <span className="font-medium">weight × karat rate + labour</span>,
              silver <span className="font-medium">weight × purity × silver rate + labour</span> —
              editing a rate re-prices every auto-priced product instantly.
            </p>
          </div>
          {updatedLabel ? (
            <span className="text-[11px] text-muted-foreground">Updated {updatedLabel}</span>
          ) : null}
        </div>

        {isLoading ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="gold-base-rate">Base rate — {baseKarat}K (₹ per gram)</Label>
              <Input
                id="gold-base-rate"
                type="text"
                inputMode="decimal"
                className="h-9 tabular-nums"
                placeholder="e.g. 7200"
                value={shownText("base", baseRate)}
                onChange={(e) => editText("base", e.target.value, (t) => setRate(baseKarat, t))}
                onBlur={() => setEditing(null)}
              />
              <p className="text-[11px] text-muted-foreground">
                Every un-quoted karat follows it proportionally (rate × karat ÷ {baseKarat}).
              </p>
            </div>
            <LabourInput
              id="gold-default-labour"
              type={labourType}
              value={labourValue ? String(labourValue) : ""}
              onTypeChange={(type) => {
                onLabourChange(type, labourValue);
                setTouched(true);
              }}
              onValueChange={handleLabourValue}
              label="Default labour (gold)"
              hint="Applied when a gold product has no labour of its own."
            />
            <div className="space-y-1.5">
              <Label htmlFor="gold-silver-rate">Silver rate (₹ per gram)</Label>
              <Input
                id="gold-silver-rate"
                type="text"
                inputMode="decimal"
                className="h-9 tabular-nums"
                placeholder="e.g. 95"
                value={shownText("silver", silverRatePerGram)}
                onChange={(e) => editText("silver", e.target.value, handleSilverRate)}
                onBlur={() => setEditing(null)}
              />
              <p className="text-[11px] text-muted-foreground">
                0 keeps auto-priced silver products on their stored price.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Karat grid (0–24) ───────────────────────────────────────── */}
      <div className="rounded-2xl border bg-card/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4" /> Karats 0–24
          </h3>
          <span className="text-[11px] text-muted-foreground">
            {quotedCount} of {table.length} quoted
          </span>
        </div>

        {isLoading ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {table.map((row) => {
              const isBase = row.karat === baseKarat;
              return (
                <div
                  key={row.karat}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border bg-background/40 px-3 py-2",
                    row.isCustom && "border-primary/30 bg-primary/5",
                    isBase && "ring-1 ring-primary/20",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold tabular-nums">{row.karat}K</span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {row.purityPercent}%
                      </span>
                      {isBase ? (
                        <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                          Base
                        </span>
                      ) : null}
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {row.isCustom ? "Quoted" : row.derived ? "Derived" : "Not set"}
                    </span>
                  </div>
                  <Input
                    aria-label={`${row.karat}K rate per gram`}
                    type="text"
                    inputMode="decimal"
                    className="h-8 w-24 text-right tabular-nums"
                    value={shownText(`rate:${row.karat}`, row.ratePerGram)}
                    onChange={(e) =>
                      editText(`rate:${row.karat}`, e.target.value, (t) => setRate(row.karat, t))
                    }
                    onBlur={() => setEditing(null)}
                  />
                  {row.isCustom ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      title="Reset to the derived rate"
                      onClick={() => resetKarat(row.karat)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <span className="w-7 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button type="button" onClick={handleSave} disabled={saving || isLoading}>
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            {saving ? "Saving…" : "Save rates"}
          </Button>
          {onBackfillKarats ? (
            <Button
              type="button"
              variant="outline"
              onClick={onBackfillKarats}
              disabled={backfilling}
              title="Fill the karat field on existing gold products from their purity stamp (22K / 916)"
            >
              {backfilling ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Fill karats from purity
            </Button>
          ) : null}
          {!touched ? (
            <span className="text-[11px] text-muted-foreground">
              A karat left blank keeps following the base rate.
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
