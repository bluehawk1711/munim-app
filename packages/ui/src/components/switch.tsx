"use client"

import * as React from "react"

import { cn } from "../lib/utils.js"

/**
 * Switch — dependency-free shadcn-style toggle.
 *
 * A native <button role="switch"> with a sliding thumb, so web + desktop
 * Settings get an on/off control without pulling in Radix. Visually matches
 * the shadcn switch (w-9 track, w-4 thumb) and the rest of the kit.
 */
function Switch({
  checked,
  onCheckedChange,
  className,
  disabled,
  "aria-label": ariaLabel,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  className?: string
  disabled?: boolean
  "aria-label"?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      data-slot="switch"
      className={cn(
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent shadow-xs transition-colors outline-none focus-visible:ring disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-input",
        className
      )}
    >
      <span
        data-slot="switch-thumb"
        data-state={checked ? "checked" : "unchecked"}
        className={cn(
          "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-sm ring-0 transition-transform",
          checked ? "translate-x-4" : "translate-x-0.5"
        )}
      />
    </button>
  )
}

export { Switch }
