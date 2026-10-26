"use client"

/**
 * PaymentMethodPicker — shared "how was it paid" control for every payment
 * form (bill forms, record-payment dialogs) on web + desktop.
 *
 * Presets (Cash · UPI · Card · Cheque · Bank transfer) come from core so all
 * three apps agree on ids/labels; "Custom…" reveals a free-text input for
 * anything else (e.g. "Paytm", "Sodexo").
 *
 * Controlled: the parent owns the raw `payments.method` string — a preset id
 * or the custom text itself. When the stored value isn't a preset the picker
 * shows "Custom…" pre-selected with that text.
 */
import * as React from "react"
import { Input } from "./input"
import { cn } from "../lib/utils"
import { CUSTOM_PAYMENT_METHOD, PAYMENT_METHOD_PRESETS, type PaymentMethodId } from "@munim/core"

export type PaymentMethodPickerProps = {
  /** Raw method value — preset id ("cash", "upi"…) or custom free text. */
  value: string
  onChange: (method: string) => void
  /** Optional label rendered above the control (omit in dialogs with their own labels). */
  label?: string
  id?: string
  className?: string
}

function presetOf(value: string): PaymentMethodId | typeof CUSTOM_PAYMENT_METHOD {
  const v = value.trim().toLowerCase()
  return PAYMENT_METHOD_PRESETS.some((p) => p.id === v)
    ? (v as PaymentMethodId)
    : CUSTOM_PAYMENT_METHOD
}

export function PaymentMethodPicker({ value, onChange, label, id, className }: PaymentMethodPickerProps) {
  const selected = presetOf(value)
  const isCustom = selected === CUSTOM_PAYMENT_METHOD
  // Only show free text that ISN'T one of the presets (legacy/typed values).
  const [customText, setCustomText] = React.useState(() => (isCustom ? value.trim() : ""))

  function select(preset: PaymentMethodId) {
    setCustomText("")
    onChange(preset)
  }

  function selectCustom() {
    setCustomText(isCustom ? value.trim() : "")
    onChange(isCustom ? value.trim() : customText)
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <span className="text-xs font-medium" id={id ? `${id}-label` : undefined}>
          {label}
        </span>
      ) : null}
      <div
        role="radiogroup"
        aria-label={label ?? "Paid via"}
        className="flex flex-wrap overflow-hidden rounded-lg border text-xs font-medium"
      >
        {PAYMENT_METHOD_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            role="radio"
            aria-checked={!isCustom && selected === preset.id}
            onClick={() => select(preset.id)}
            className={cn(
              "flex-1 basis-[33%] px-2 py-2 transition-colors",
              !isCustom && selected === preset.id
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-muted",
            )}
          >
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          role="radio"
          aria-checked={isCustom}
          onClick={selectCustom}
          className={cn(
            "flex-1 basis-[33%] px-2 py-2 transition-colors",
            isCustom ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted",
          )}
        >
          Custom…
        </button>
      </div>
      {isCustom ? (
        <Input
          value={customText}
          maxLength={40}
          onChange={(e) => {
            setCustomText(e.target.value)
            onChange(e.target.value)
          }}
          placeholder="e.g. Paytm, cheque no…"
          className="h-9"
          aria-label="Custom payment method"
        />
      ) : null}
    </div>
  )
}
