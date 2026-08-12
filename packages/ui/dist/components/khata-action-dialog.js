"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * KhataActionDialog — shared dialog for the four khata actions:
 * Give advance / Take advance / Receive payment / Make payment.
 * Used by the web + desktop Advances pages AND the desktop Parties page so the
 * money-movement flow is identical everywhere.
 *
 * Presentational + controlled: the parent owns `open`/`busy` and the core call
 * (createAdvance / recordPayment). Amount + note are owned INSIDE the dialog
 * and reset on open — parents only pass the action's title and the party.
 *
 * Parent contract: render <KhataActionDialog key={action?.party.id + action?.kind ?? "closed"} …>
 * so amount/note reset whenever a different action is opened.
 */
import * as React from "react";
import { HandCoins, Loader2 } from "lucide-react";
import { Button } from "./button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog";
import { Input } from "./input";
import { Label } from "./label";
import { formatMoney } from "../lib/format";
export function KhataActionDialog({ open, onOpenChange, title, subtitle, balance, busy, confirmLabel = "Confirm", onConfirm, }) {
    const [amount, setAmount] = React.useState(0);
    const [note, setNote] = React.useState("");
    const [error, setError] = React.useState(null);
    function submit(e) {
        e.preventDefault();
        if (!amount || amount <= 0) {
            setError("Enter an amount greater than 0.");
            return;
        }
        setError(null);
        onConfirm({ amount, note });
    }
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsx(DialogContent, { className: "sm:max-w-[380px]", children: _jsxs("form", { onSubmit: submit, children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: title }), subtitle ? _jsx(DialogDescription, { children: subtitle }) : null] }), _jsxs("div", { className: "space-y-4 py-2", children: [balance !== undefined ? (_jsxs("div", { className: "flex items-center justify-between rounded-lg bg-muted/50 p-3 text-sm", children: [_jsx("span", { className: "text-muted-foreground", children: "Current balance" }), _jsx("span", { className: "font-semibold", children: formatMoney(balance) })] })) : null, _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { className: "text-xs", children: "Amount (\u20B9)" }), _jsx(Input, { type: "number", min: 0, value: amount || "", onChange: (e) => {
                                            setAmount(Number(e.target.value));
                                            setError(null);
                                        }, className: "h-9", autoFocus: true }), error ? _jsx("p", { className: "text-xs font-medium text-destructive", children: error }) : null] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { className: "text-xs", children: "Note (optional)" }), _jsx(Input, { value: note, onChange: (e) => setNote(e.target.value), placeholder: "e.g. gold purchase advance", className: "h-9" })] })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => onOpenChange(false), children: "Cancel" }), _jsx(Button, { type: "submit", disabled: busy || !amount || amount <= 0, children: busy ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "mr-1.5 h-4 w-4 animate-spin" }), "Saving\u2026"] })) : (_jsxs(_Fragment, { children: [_jsx(HandCoins, { className: "mr-1.5 h-4 w-4" }), confirmLabel] })) })] })] }) }) }));
}
//# sourceMappingURL=khata-action-dialog.js.map