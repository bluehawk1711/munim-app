"use client"

/**
 * AnalyticsPeriodFilter — pill group that selects the Articles analytics time
 * window. Shared by web AND desktop (mobile mirrors it with RN chips) so the
 * presets, labels and ordering can never drift between platforms.
 *
 * Purely presentational: the caller owns the preset state and passes it to
 * `useArticlesAnalytics(preset)`.
 */
import * as React from "react"
import {
  ARTICLE_ANALYTICS_PRESETS,
  ARTICLE_ANALYTICS_PRESET_LABELS,
  type ArticleAnalyticsPreset,
} from "@munim/core"
import { cn } from "../lib/utils.js"

export function AnalyticsPeriodFilter({
  value,
  onChange,
  className,
}: {
  value: ArticleAnalyticsPreset
  onChange: (preset: ArticleAnalyticsPreset) => void
  className?: string
}) {
  return (
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
            onClick={() => onChange(preset)}
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
  )
}
