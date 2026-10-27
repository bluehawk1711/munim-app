"use client"

import * as React from "react"
import { Check, Minus } from "lucide-react"

import { cn } from "../lib/utils.js"

/**
 * Checkbox — dependency-free shadcn-style check control.
 *
 * A native <button role="checkbox"> with a Check icon, matching the kit's
 * Switch (same focus ring, disabled and checked treatments). Used for
 * option toggles that should read as "select this option" rather than
 * on/off settings (e.g. bill creation options) — and for table
 * select-all/row checkboxes (`indeterminate` renders a dash).
 */
function Checkbox({
  checked,
  indeterminate = false,
  onCheckedChange,
  className,
  disabled,
  id,
  "aria-label": ariaLabel,
}: {
  checked: boolean
  /** Mixed state — e.g. a select-all header with only some rows ticked. */
  indeterminate?: boolean
  onCheckedChange: (checked: boolean) => void
  className?: string
  disabled?: boolean
  id?: string
  "aria-label"?: string
}) {
  const active = checked || indeterminate
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={ariaLabel}
      id={id}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      data-slot="checkbox"
      data-state={indeterminate ? "indeterminate" : checked ? "checked" : "unchecked"}
      className={cn(
        "focus-visible:border-ring focus-visible:ring-ring/50 flex size-4 shrink-0 items-center justify-center rounded-[4px] border shadow-xs transition-colors outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background hover:border-ring/60 dark:bg-input/30",
        className
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center text-current transition-none",
          !active && "invisible"
        )}
      >
        {indeterminate ? (
          <Minus className="size-3" strokeWidth={3} />
        ) : (
          <Check className="size-3" strokeWidth={3} />
        )}
      </span>
    </button>
  )
}

export { Checkbox }
