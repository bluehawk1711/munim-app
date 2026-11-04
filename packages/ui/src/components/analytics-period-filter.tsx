"use client"

/**
 * AnalyticsPeriodFilter — pill group that selects the Articles analytics time
 * window, plus the two date inputs that appear when "Custom" is picked.
 * Shared by web AND desktop (mobile mirrors it with RN chips + a date sheet)
 * so the presets, labels and ordering can never drift between platforms.
 *
 * Purely presentational: the caller owns the preset/range state and passes it
 * to `useArticlesAnalytics({ preset, from, to })`.
 */
import * as React from "react"
import {
  ARTICLE_ANALYTICS_PRESETS,
  ARTICLE_ANALYTICS_PRESET_LABELS,
  isoDayOffset,
  type ArticleAnalyticsPreset,
} from "@munim/core"
import { Input } from "./input.js"
import { cn } from "../lib/utils.js"

/** Inclusive `YYYY-MM-DD` bounds for a custom analytics window. */
export type AnalyticsRange = { from: string; to: string }

/** Default custom window — the last 30 days, ending today. */
export function defaultAnalyticsRange(): AnalyticsRange {
  return { from: isoDayOffset(-29), to: isoDayOffset(0) }
}

export function AnalyticsPeriodFilter({
  value,
  onChange,
  range,
  onRangeChange,
  className,
}: {
  value: ArticleAnalyticsPreset
  onChange: (preset: ArticleAnalyticsPreset) => void
  /** Current custom range. Defaults to the last 30 days when omitted. */
  range?: AnalyticsRange
  /** Required for the custom option to render its date inputs. */
  onRangeChange?: (range: AnalyticsRange) => void
  className?: string
}) {
  const current = range ?? defaultAnalyticsRange()
  const showRange = value === "custom" && !!onRangeChange

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="group"
        aria-label="Analytics time period"
        className={cn("bg-muted flex flex-wrap gap-1 rounded-full p-1", className)}
      >
        {ARTICLE_ANALYTICS_PRESETS.map((preset) => {
          const active = preset === value
          return (
            <button
              key={preset}
              type="button"
              aria-pressed={active}
              onClick={() => {
                // Picking "Custom" needs a range to query — seed the default.
                if (preset === "custom" && onRangeChange && !range) onRangeChange(current)
                onChange(preset)
              }}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {ARTICLE_ANALYTICS_PRESET_LABELS[preset].label}
            </button>
          )
        })}
      </div>

      {showRange ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <Input
            type="date"
            aria-label="From date"
            value={current.from}
            max={current.to}
            onChange={(e) => onRangeChange({ from: e.target.value, to: current.to })}
            className="h-8 w-[140px] text-xs"
          />
          <span className="text-muted-foreground text-xs">to</span>
          <Input
            type="date"
            aria-label="To date"
            value={current.to}
            min={current.from}
            onChange={(e) => onRangeChange({ from: current.from, to: e.target.value })}
            className="h-8 w-[140px] text-xs"
          />
        </div>
      ) : null}
    </div>
  )
}
