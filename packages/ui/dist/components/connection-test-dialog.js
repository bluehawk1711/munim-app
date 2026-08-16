"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { cn } from "../lib/utils.js";
import { Button } from "./button.js";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from "./dialog.js";
/**
 * Modal shown while testing a database connection. Cannot be dismissed while
 * `state === "testing"` (no close button, outside-click and Escape are
 * swallowed) so the user can't miss the in-flight state; once the ping
 * resolves it flips to a success or error panel with a Close action.
 */
export function ConnectionTestDialog({ open, onOpenChange, state, error, onRetry, }) {
    const busy = state === "testing";
    return (_jsx(Dialog, { open: open, onOpenChange: (next) => {
            // Never allow closing while the test is in flight.
            if (!busy)
                onOpenChange(next);
        }, children: _jsxs(DialogContent, { className: "sm:max-w-md", showCloseButton: !busy, onEscapeKeyDown: (e) => {
                if (busy)
                    e.preventDefault();
            }, onPointerDownOutside: (e) => {
                if (busy)
                    e.preventDefault();
            }, onInteractOutside: (e) => {
                if (busy)
                    e.preventDefault();
            }, children: [_jsxs(DialogHeader, { children: [_jsxs(DialogTitle, { className: "flex items-center gap-2", children: [state === "testing" ? (_jsx(Loader2, { className: "size-4 animate-spin", "aria-hidden": "true" })) : state === "ok" ? (_jsx(CheckCircle2, { className: "size-4 text-emerald-500", "aria-hidden": "true" })) : (_jsx(XCircle, { className: "size-4 text-destructive", "aria-hidden": "true" })), state === "testing"
                                    ? "Testing connection"
                                    : state === "ok"
                                        ? "Connected"
                                        : "Connection failed"] }), _jsx(DialogDescription, { children: state === "testing"
                                ? "Contacting the database…"
                                : state === "ok"
                                    ? "The database responded successfully."
                                    : "Could not reach the database. Check the connection string and try again." })] }), state === "fail" && error ? (_jsx("p", { className: cn("rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs leading-relaxed text-destructive"), children: error })) : null, state !== "testing" && (_jsxs(DialogFooter, { children: [state === "fail" && onRetry ? (_jsx(Button, { variant: "outline", onClick: onRetry, children: "Try again" })) : null, _jsx(Button, { onClick: () => onOpenChange(false), children: "Close" })] }))] }) }));
}
//# sourceMappingURL=connection-test-dialog.js.map