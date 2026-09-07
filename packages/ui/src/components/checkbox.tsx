"use client"

import * as React from "react"
import { Check } from "lucide-react"

import { cn } from "../lib/utils.js"

/**
 * Checkbox — dependency-free shadcn-style check control.
 *
 * A native <button role="checkbox"> with a Check icon, matching the kit's
 * Switch (same focus ring, disabled and checked treatments). Used for
 * option toggles that should read as "select this option" rather than
 * on/off settings (e.g. bill creation options).
 */
function Checkbox({
  checked,
  onCheckedChange,
  className,
  disabled,
  id,
  "aria-label": ariaLabel,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  className?: string
  disabled?: boolean
  id?: string
  "aria-label"?: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      id={id}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      data-slot="checkbox"
      data-state={checked ? "checked" : "unchecked"}
      className={cn(
        "focus-visible:border-ring focus-visible:ring-ring/50 flex size-4 shrink-0 items-center justify-center rounded-[4px] border shadow-xs transition-colors outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        checked
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background dark:bg-input/30",
        className
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center text-current transition-none",
          !checked && "invisible"
        )}
      >
        <Check className="size-3" strokeWidth={3} />
      </span>
    </button>
  )
}

export { Checkbox }
