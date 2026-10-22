"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * RecordPaymentDialog — shared record-payment dialog for the invoice lists,
 * used by BOTH the web and desktop apps so the payment flow is identical.
 *
 * Presentational + controlled: the parent owns `open`/`busy` and the actual
 * core call (recordInvoicePayment). The amount is owned INSIDE the dialog and
 * initialised to the outstanding balance, so parents don't duplicate the
 * total/paid/outstanding math.
 *
 * The payment is recorded HOW it was received — a Cash / Online toggle plus
 * an optional reference note (UPI id / txn number / "cash in hand"), so the
 * invoice detail can later show the full payment trail.
 *
 * Parent contract: render <RecordPaymentDialog key={paying?.id ?? "closed"} …>
 * so the amount resets when a different invoice is opened.
 */
import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "./button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog";
import { Input } from "./input";
import { cn } from "../lib/utils";
import { formatMoney } from "../lib/format";
export function RecordPaymentDialog({ open, onOpenChange, invoice, busy, onConfirm, }) {
    // Keyed remount (parent passes key={invoice?.id}) makes this initializer run
    // with the freshly opened invoice — the amount always starts at the
    // outstanding balance.
    const [amount, setAmount] = React.useState(() => invoice ? Math.max(0, invoice.total - invoice.amountPaid) : 0);
    const [method, setMethod] = React.useState("cash");
    const [note, setNote] = React.useState("");
    const [error, setError] = React.useState(null);
    function submit(e) {
        e.preventDefault();
        if (!invoice)
            return;
        if (!amount || amount <= 0) {
            setError("Enter an amount greater than 0.");
            return;
        }
        setError(null);
        onConfirm({ amount, method, note: note.trim() });
    }
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsx(DialogContent, { className: "sm:max-w-[400px]", children: _jsxs("form", { onSubmit: submit, children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Record payment" }), _jsx(DialogDescription, { children: invoice ? `${invoice.invoiceNumber} · ${invoice.customerName || "Walk-in customer"}` : "" })] }), _jsxs("div", { className: "space-y-4 py-2", children: [_jsxs("div", { className: "grid grid-cols-2 gap-3 text-sm", children: [_jsxs("div", { className: "rounded-lg bg-muted/50 p-3", children: [_jsx("p", { className: "text-xs text-muted-foreground", children: "Total" }), _jsx("p", { className: "font-semibold tabular-nums", children: invoice ? formatMoney(invoice.total) : "—" })] }), _jsxs("div", { className: "rounded-lg bg-muted/50 p-3", children: [_jsx("p", { className: "text-xs text-muted-foreground", children: "Already paid" }), _jsx("p", { className: "font-semibold tabular-nums", children: invoice ? formatMoney(invoice.amountPaid) : "—" })] })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx("label", { htmlFor: "record-payment-amount", className: "text-xs font-medium", children: "Amount (\u20B9)" }), _jsx(Input, { id: "record-payment-amount", type: "number", min: 0, value: amount || "", onChange: (e) => {
                                            setAmount(Number(e.target.value));
                                            setError(null);
                                        }, className: "h-9", autoFocus: true }), error ? _jsx("p", { className: "text-xs font-medium text-destructive", children: error }) : null] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx("span", { className: "text-xs font-medium", children: "Paid via" }), _jsx("div", { role: "radiogroup", "aria-label": "Paid via", className: "grid grid-cols-2 overflow-hidden rounded-lg border text-xs font-medium", children: [
                                            ["cash", "Cash"],
                                            ["online", "Online"],
                                        ].map(([value, label]) => (_jsx("button", { type: "button", role: "radio", "aria-checked": method === value, onClick: () => setMethod(value), className: cn("py-2 transition-colors", method === value
                                                ? "bg-primary text-primary-foreground"
                                                : "bg-background text-muted-foreground hover:bg-muted", value === "online" && "border-l"), children: label }, value))) })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsxs("label", { htmlFor: "record-payment-note", className: "text-xs font-medium", children: ["Note ", _jsx("span", { className: "font-normal text-muted-foreground", children: "(optional \u2014 UPI ref, txn no.)" })] }), _jsx(Input, { id: "record-payment-note", value: note, maxLength: 120, onChange: (e) => setNote(e.target.value), placeholder: method === "online" ? "UPI id / transaction no." : "e.g. cash in hand", className: "h-9" })] })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => onOpenChange(false), children: "Cancel" }), _jsx(Button, { type: "submit", disabled: busy || !amount || amount <= 0, children: busy ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "mr-1.5 h-4 w-4 animate-spin" }), "Saving\u2026"] })) : ("Confirm payment") })] })] }) }) }));
}
//# sourceMappingURL=record-payment-dialog.js.map