"use client"

/**
 * BarcodeLookupInput — shared web + desktop quick-lookup field for the shop
 * counter. Most USB barcode scanners act like a keyboard: they type the code
 * into the focused input and send Enter. This input focuses that workflow:
 *   - type/scan a code, press Enter → onLookup(code)
 *   - resolves → success flash + clear; rejects → error flash
 *
 * Callers own the actual lookup (they know their db client) and the success
 * action (e.g. open the product). Purely presentational beyond that.
 */
import * as React from "react";
import { Loader2, ScanLine, Check, X } from "lucide-react";
import { cn } from "../lib/utils";

export function BarcodeLookupInput({
  onLookup,
  placeholder = "Scan or type a barcode…",
  className,
  autoFocus = false,
  clearOnSuccess = true,
}: {
  /** Must resolve on a hit and throw on a miss (message shown as feedback). */
  onLookup: (code: string) => Promise<unknown>;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  clearOnSuccess?: boolean;
}) {
  const [value, setValue] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [state, setState] = React.useState<"idle" | "ok" | "error">("idle");
  const [error, setError] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function submit() {
    const code = value.trim();
    if (!code || busy) return;
    setBusy(true);
    setState("idle");
    try {
      await onLookup(code);
      setState("ok");
      if (clearOnSuccess) setValue("");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Product not found");
    } finally {
      setBusy(false);
      // Refocus so the next scan lands immediately.
      inputRef.current?.focus();
    }
  }

  return (
    <div className={cn("relative", className)}>
      <ScanLine className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => {
          setValue(e.target.value);
          setState("idle");
          setError("");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void submit();
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(
          "h-9 w-full rounded-md border bg-background pr-8 pl-9 text-sm text-foreground shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring",
          state === "ok" && "border-emerald-500 focus-visible:ring-emerald-500/40",
          state === "error" && "border-destructive focus-visible:ring-destructive/40",
        )}
      />
      {busy ? (
        <Loader2 className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : state === "ok" ? (
        <Check className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-emerald-500" />
      ) : state === "error" ? (
        <X className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-destructive" />
      ) : null}
      {state === "error" && error ? (
        <p className="absolute -bottom-5 left-0 text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
