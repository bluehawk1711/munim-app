"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * App-lock settings card — shared by the web and desktop Settings pages.
 * Consumes `usePinLockContext` (from PinGate) so status stays live: change the
 * password or PIN, disable/enable the lock, log out (lock now), or reset to the
 * pre-created test account.
 */
import * as React from "react";
import { KeyRound, LogOut, ShieldCheck, ShieldOff, RotateCcw } from "lucide-react";
// Same-module toast as <Toaster /> — never import from "sonner" directly (see sonner.tsx).
import { toast } from "./sonner.js";
import { cn } from "../lib/utils";
import { usePinLockContext } from "./pin-gate";
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import { Badge } from "./badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
function PinFields({ current, newPin, confirm, showCurrent = true, onChange, }) {
    const pinProps = (field, value) => ({
        type: "password",
        inputMode: "numeric",
        pattern: "[0-9]*",
        maxLength: 4,
        autoComplete: "off",
        value,
        onChange: (e) => onChange(field, e.target.value.replace(/\D/g, "").slice(0, 4)),
        className: "text-center tracking-[0.4em] font-mono",
    });
    return (_jsxs("div", { className: cn("grid gap-3", showCurrent ? "sm:grid-cols-3" : "sm:grid-cols-2"), children: [showCurrent && (_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "pin-current", children: "Current" }), _jsx(Input, { id: "pin-current", placeholder: "\u2022\u2022\u2022\u2022", ...pinProps("current", current) })] })), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "pin-new", children: "New PIN" }), _jsx(Input, { id: "pin-new", placeholder: "\u2022\u2022\u2022\u2022", ...pinProps("newPin", newPin) })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "pin-confirm", children: "Confirm" }), _jsx(Input, { id: "pin-confirm", placeholder: "\u2022\u2022\u2022\u2022", ...pinProps("confirm", confirm) })] })] }));
}
export function PinSettingsCard() {
    const lock = usePinLockContext();
    const [current, setCurrent] = React.useState("");
    const [newPin, setNewPin] = React.useState("");
    const [confirm, setConfirm] = React.useState("");
    const [pwCurrent, setPwCurrent] = React.useState("");
    const [pwNew, setPwNew] = React.useState("");
    const [pwConfirm, setPwConfirm] = React.useState("");
    const [busy, setBusy] = React.useState(false);
    const clear = () => {
        setCurrent("");
        setNewPin("");
        setConfirm("");
        setPwCurrent("");
        setPwNew("");
        setPwConfirm("");
    };
    async function handleChangePin() {
        if (newPin !== confirm) {
            toast.error("New PINs do not match");
            return;
        }
        setBusy(true);
        const err = lock.changePin(current, newPin);
        setBusy(false);
        if (err) {
            toast.error(err);
            return;
        }
        clear();
        toast.success("PIN updated");
    }
    async function handleChangePassword() {
        if (pwNew !== pwConfirm) {
            toast.error("New passwords do not match");
            return;
        }
        setBusy(true);
        const err = lock.changePassword(pwCurrent, pwNew);
        setBusy(false);
        if (err) {
            toast.error(err);
            return;
        }
        clear();
        toast.success("Password updated");
    }
    async function handleDisable() {
        setBusy(true);
        const err = lock.disable(current);
        setBusy(false);
        if (err) {
            toast.error(err);
            return;
        }
        clear();
        toast.success("App lock disabled");
    }
    async function handleEnable() {
        if (newPin !== confirm) {
            toast.error("PINs do not match");
            return;
        }
        setBusy(true);
        const err = lock.enable(newPin);
        setBusy(false);
        if (err) {
            toast.error(err);
            return;
        }
        clear();
        toast.success("App lock enabled");
    }
    function handleLogOut() {
        if (!window.confirm("Lock the app now? You'll need your email, password and PIN to unlock.")) {
            return;
        }
        lock.lockNow();
        toast.success("App locked");
    }
    function handleResetToTest() {
        if (!window.confirm("Reset to the test account (test@munim.app / 1234 / PIN 1234)? This replaces your current credentials.")) {
            return;
        }
        lock.resetToTest();
        clear();
        toast.success("Reset to test account");
    }
    // Persisted state — NOT the session status (after unlocking, status is
    // "unlocked" but the lock is still enabled).
    const enabled = lock.lockEnabled;
    return (_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsxs(CardTitle, { className: "flex items-center gap-2 text-sm", children: [_jsx(KeyRound, { className: "h-4 w-4" }), " App lock & account"] }), _jsx(CardDescription, { className: "text-xs", children: "Sign in with your email + password, then a 4-digit PIN. Stored locally (hashed), never sent to the database. Your session is remembered on this device." })] }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [enabled ? (_jsxs(Badge, { className: "gap-1", children: [_jsx(ShieldCheck, { className: "h-3 w-3" }), " PIN lock enabled"] })) : (_jsxs(Badge, { variant: "secondary", className: "gap-1", children: [_jsx(ShieldOff, { className: "h-3 w-3" }), " Lock disabled"] })), _jsx(Badge, { variant: "secondary", className: "font-mono text-xs", children: lock.accountEmail }), lock.isTestAccount && _jsx(Badge, { variant: "secondary", children: "Test account \u2014 1234" })] }), enabled ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "space-y-2 border-t pt-4", children: [_jsx("p", { className: "text-xs font-medium text-foreground", children: "Change password" }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-3", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "pw-current", children: "Current" }), _jsx(Input, { id: "pw-current", type: "password", autoComplete: "current-password", value: pwCurrent, onChange: (e) => setPwCurrent(e.target.value), className: "text-sm" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "pw-new", children: "New password" }), _jsx(Input, { id: "pw-new", type: "password", autoComplete: "new-password", value: pwNew, onChange: (e) => setPwNew(e.target.value), className: "text-sm" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { htmlFor: "pw-confirm", children: "Confirm" }), _jsx(Input, { id: "pw-confirm", type: "password", autoComplete: "new-password", value: pwConfirm, onChange: (e) => setPwConfirm(e.target.value), className: "text-sm" })] })] }), _jsxs(Button, { onClick: handleChangePassword, disabled: busy, size: "sm", variant: "outline", className: "gap-1.5", children: [_jsx(KeyRound, { className: "h-3.5 w-3.5" }), " Change password"] })] }), _jsxs("div", { className: "space-y-2 border-t pt-4", children: [_jsx("p", { className: "text-xs font-medium text-foreground", children: "Change PIN" }), _jsx(PinFields, { current: current, newPin: newPin, confirm: confirm, onChange: (f, v) => {
                                            if (f === "current")
                                                setCurrent(v);
                                            if (f === "newPin")
                                                setNewPin(v);
                                            if (f === "confirm")
                                                setConfirm(v);
                                        } }), _jsxs(Button, { onClick: handleChangePin, disabled: busy, size: "sm", className: "gap-1.5", children: [_jsx(KeyRound, { className: "h-3.5 w-3.5" }), " Change PIN"] })] }), _jsxs("div", { className: "flex flex-wrap gap-2 border-t pt-4", children: [_jsxs(Button, { variant: "outline", size: "sm", onClick: handleDisable, disabled: busy, className: "gap-1.5", children: [_jsx(ShieldOff, { className: "h-3.5 w-3.5" }), " Disable lock"] }), _jsxs(Button, { variant: "secondary", size: "sm", onClick: handleLogOut, className: "gap-1.5", children: [_jsx(LogOut, { className: "h-3.5 w-3.5" }), " Log out (lock now)"] }), _jsxs(Button, { variant: "ghost", size: "sm", onClick: handleResetToTest, className: "gap-1.5 text-muted-foreground", children: [_jsx(RotateCcw, { className: "h-3.5 w-3.5" }), " Reset to test account"] })] })] })) : (_jsxs("div", { className: "space-y-2 border-t pt-4", children: [_jsx("p", { className: "text-xs text-muted-foreground", children: "Enable the lock with a new 4-digit PIN. You'll be asked for it next launch." }), _jsx(PinFields, { current: "", newPin: newPin, confirm: confirm, showCurrent: false, onChange: (f, v) => {
                                    if (f === "newPin")
                                        setNewPin(v);
                                    if (f === "confirm")
                                        setConfirm(v);
                                } }), _jsxs(Button, { onClick: handleEnable, disabled: busy, size: "sm", className: "gap-1.5", children: [_jsx(ShieldCheck, { className: "h-3.5 w-3.5" }), " Enable lock"] })] }))] })] }));
}
//# sourceMappingURL=pin-settings-card.js.map