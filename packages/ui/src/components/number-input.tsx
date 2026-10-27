"use client";

/**
 * NumberInput — decimal-safe controlled numeric input.
 *
 * A plain `<Input type="number" value={numberState}>` cannot be typed into
 * correctly for decimals: every keystroke re-renders with the parsed number,
 * so the intermediate "4." is normalised back to "4" and the dot disappears.
 * This keeps the raw text while the field is focused (parsing to a number for
 * the caller) and only normalises on blur. `step="any"` also stops the browser
 * rejecting values like 4.50643 when the field sits inside a <form>.
 */
import * as React from "react";
import { Input } from "./input.js";

export type NumberInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange" | "type"
> & {
  /** Current numeric value (null/undefined renders as empty). */
  value: number | null | undefined;
  /** Fired with the parsed number, or null when the field is cleared. */
  onValueChange: (value: number | null) => void;
};

export function NumberInput({
  value,
  onValueChange,
  onFocus,
  onBlur,
  ...props
}: NumberInputProps) {
  const [draft, setDraft] = React.useState(value == null ? "" : String(value));
  const [focused, setFocused] = React.useState(false);

  // Follow external updates (product pick, reset, …) only while not editing.
  React.useEffect(() => {
    if (!focused) setDraft(value == null ? "" : String(value));
  }, [value, focused]);

  return (
    <Input
      {...props}
      type="number"
      step="any"
      value={draft}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        if (raw.trim() === "") {
          onValueChange(null);
          return;
        }
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) onValueChange(parsed);
      }}
      onBlur={(e) => {
        setFocused(false);
        const parsed = draft.trim() === "" ? null : Number(draft);
        const normalised = parsed == null || !Number.isFinite(parsed) ? null : parsed;
        setDraft(normalised == null ? "" : String(normalised));
        onValueChange(normalised);
        onBlur?.(e);
      }}
    />
  );
}
