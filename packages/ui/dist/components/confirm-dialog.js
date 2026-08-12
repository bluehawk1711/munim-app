"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "./button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog";
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, busy, destructive = true, onConfirm, }) {
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogContent, { role: "alertdialog", className: "sm:max-w-[400px]", children: [_jsx(DialogHeader, { children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive", children: _jsx(AlertTriangle, { className: "h-5 w-5" }) }), _jsxs("div", { children: [_jsx(DialogTitle, { children: title }), _jsx(DialogDescription, { children: description })] })] }) }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: () => onOpenChange(false), children: "Cancel" }), _jsx(Button, { variant: destructive ? "destructive" : "default", onClick: onConfirm, disabled: busy, className: "gap-1.5", children: busy ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "h-4 w-4 animate-spin" }), confirmLabel, "\u2026"] })) : (confirmLabel) })] })] }) }));
}
//# sourceMappingURL=confirm-dialog.js.map