"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
export function BarcodeLookupInput({ onLookup, placeholder = "Scan or type a barcode…", className, autoFocus = false, clearOnSuccess = true, }) {
    const [value, setValue] = React.useState("");
    const [busy, setBusy] = React.useState(false);
    const [state, setState] = React.useState("idle");
    const [error, setError] = React.useState("");
    const inputRef = React.useRef(null);
    async function submit() {
        const code = value.trim();
        if (!code || busy)
            return;
        setBusy(true);
        setState("idle");
        try {
            await onLookup(code);
            setState("ok");
            if (clearOnSuccess)
                setValue("");
        }
        catch (err) {
            setState("error");
            setError(err instanceof Error ? err.message : "Product not found");
        }
        finally {
            setBusy(false);
            // Refocus so the next scan lands immediately.
            inputRef.current?.focus();
        }
    }
    return (_jsxs("div", { className: cn("relative", className), children: [_jsx(ScanLine, { className: "pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" }), _jsx("input", { ref: inputRef, type: "text", value: value, autoFocus: autoFocus, onChange: (e) => {
                    setValue(e.target.value);
                    setState("idle");
                    setError("");
                }, onKeyDown: (e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        void submit();
                    }
                }, placeholder: placeholder, "aria-label": placeholder, className: cn("h-9 w-full rounded-md border bg-background pr-8 pl-9 text-sm text-foreground shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring", state === "ok" && "border-emerald-500 focus-visible:ring-emerald-500/40", state === "error" && "border-destructive focus-visible:ring-destructive/40") }), busy ? (_jsx(Loader2, { className: "absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" })) : state === "ok" ? (_jsx(Check, { className: "absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-emerald-500" })) : state === "error" ? (_jsx(X, { className: "absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-destructive" })) : null, state === "error" && error ? (_jsx("p", { className: "absolute -bottom-5 left-0 text-xs text-destructive", children: error })) : null] }));
}
//# sourceMappingURL=barcode-lookup-input.js.map