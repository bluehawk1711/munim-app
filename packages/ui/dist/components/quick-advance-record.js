"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Loader2, Plus } from "lucide-react";
import { Button } from "./button";
import { Card, CardContent } from "./card";
import { Input } from "./input";
import { Label } from "./label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
export function QuickAdvanceRecord({ parties, partyId, onPartyChange, kind, onKindChange, amount, onAmountChange, busy, onRecord, }) {
    return (_jsx(Card, { className: "border-primary/20 bg-primary/[0.03]", children: _jsxs(CardContent, { className: "flex flex-col gap-3 p-4 sm:flex-row sm:items-end", children: [_jsxs("div", { className: "flex-1 space-y-1.5", children: [_jsx(Label, { className: "text-xs", children: "Party" }), _jsxs(Select, { value: partyId, onValueChange: onPartyChange, children: [_jsx(SelectTrigger, { className: "h-9", children: _jsx(SelectValue, { placeholder: "Select party\u2026" }) }), _jsx(SelectContent, { children: parties.map((p) => (_jsx(SelectItem, { value: p.id, children: p.name }, p.id))) })] })] }), _jsxs("div", { className: "flex-1 space-y-1.5", children: [_jsx(Label, { className: "text-xs", children: "Type" }), _jsxs(Select, { value: kind, onValueChange: (v) => onKindChange(v), children: [_jsx(SelectTrigger, { className: "h-9", children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "GIVEN", children: "I gave advance (they owe me)" }), _jsx(SelectItem, { value: "TAKEN", children: "I took advance (I owe them)" })] })] })] }), _jsxs("div", { className: "flex-1 space-y-1.5", children: [_jsx(Label, { className: "text-xs", children: "Amount (\u20B9)" }), _jsx(Input, { type: "number", min: 0, value: amount || "", onChange: (e) => onAmountChange(Number(e.target.value)), className: "h-9" })] }), _jsxs(Button, { onClick: onRecord, disabled: !partyId || amount <= 0 || busy, className: "h-9 gap-1.5", children: [busy ? _jsx(Loader2, { className: "h-4 w-4 animate-spin" }) : _jsx(Plus, { className: "h-4 w-4" }), "Record"] })] }) }));
}
//# sourceMappingURL=quick-advance-record.js.map