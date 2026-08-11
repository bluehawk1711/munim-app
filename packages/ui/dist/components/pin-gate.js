"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * PIN lock gate — shared by the web and desktop apps so both lock screens are
 * pixel-identical.
 *
 * Storage is a single localStorage key (`munim.pin`):
 *   - absent          → first launch → the TEST account (PIN 1234) is
 *                       pre-created and the app is locked with it
 *   - "0"             → lock disabled (gate skips straight to children)
 *   - 64-char hash    → lock enabled; the stored value is SHA-256(salt + pin)
 *
 * The lock is per-device by design (like a banking-app lock): it never touches
 * the shared database, works offline, and each device keeps its own PIN.
 * `PinLockContext` lets Settings cards (inside the gate) change/disable/reset
 * the lock with live status.
 */
import * as React from "react";
import { Delete, Lock } from "lucide-react";
import { TEST_PIN, hashPin, isFourDigitPin, isPinHash, isTestPinHash, verifyPin, } from "@munim/core";
import { cn } from "../lib/utils";
const STORAGE_KEY = "munim.pin";
const DISABLED = "0";
const PinLockContext = React.createContext(null);
/** Read the lock state. Must be used inside <PinGate>. */
export function usePinLockContext() {
    const ctx = React.useContext(PinLockContext);
    if (!ctx)
        throw new Error("usePinLockContext must be used within <PinGate>");
    return ctx;
}
function readStoredPin() {
    if (typeof window === "undefined")
        return null;
    try {
        return window.localStorage.getItem(STORAGE_KEY);
    }
    catch {
        return null;
    }
}
function writeStoredPin(value) {
    try {
        window.localStorage.setItem(STORAGE_KEY, value);
    }
    catch {
        // Storage unavailable — the lock still works for this session.
    }
}
function usePinLock() {
    const [status, setStatus] = React.useState("loading");
    const [lockEnabled, setLockEnabled] = React.useState(false);
    const [isTestAccount, setIsTestAccount] = React.useState(false);
    // Initialize once on mount (client only — SSR keeps "loading").
    React.useEffect(() => {
        if (typeof window === "undefined")
            return;
        const stored = readStoredPin();
        if (stored === null) {
            // First launch → pre-create the test account.
            writeStoredPin(hashPin(TEST_PIN));
            setIsTestAccount(true);
            setLockEnabled(true);
            setStatus("locked");
            return;
        }
        if (stored === DISABLED) {
            setLockEnabled(false);
            setStatus("unlocked");
            return;
        }
        if (isPinHash(stored)) {
            setIsTestAccount(isTestPinHash(stored));
            setLockEnabled(true);
            setStatus("locked");
            return;
        }
        // Corrupt value → recreate the test account.
        writeStoredPin(hashPin(TEST_PIN));
        setIsTestAccount(true);
        setLockEnabled(true);
        setStatus("locked");
    }, []);
    const unlock = React.useCallback((pin) => {
        const stored = readStoredPin();
        if (stored !== null && stored !== DISABLED && isPinHash(stored) && verifyPin(pin, stored)) {
            setStatus("unlocked");
            return true;
        }
        return false;
    }, []);
    const changePin = React.useCallback((current, next) => {
        if (!isFourDigitPin(next))
            return "New PIN must be exactly 4 digits.";
        const stored = readStoredPin();
        if (stored === null || stored === DISABLED || !isPinHash(stored) || !verifyPin(current, stored)) {
            return "Current PIN is incorrect.";
        }
        writeStoredPin(hashPin(next));
        setIsTestAccount(false);
        return null;
    }, []);
    const disable = React.useCallback((current) => {
        const stored = readStoredPin();
        if (stored === null || stored === DISABLED || !isPinHash(stored) || !verifyPin(current, stored)) {
            return "Current PIN is incorrect.";
        }
        writeStoredPin(DISABLED);
        setLockEnabled(false);
        setStatus("unlocked");
        return null;
    }, []);
    const enable = React.useCallback((next) => {
        if (!isFourDigitPin(next))
            return "PIN must be exactly 4 digits.";
        writeStoredPin(hashPin(next));
        setIsTestAccount(false);
        setLockEnabled(true);
        return null;
    }, []);
    const resetToTest = React.useCallback(() => {
        writeStoredPin(hashPin(TEST_PIN));
        setIsTestAccount(true);
        setLockEnabled(true);
        setStatus("unlocked");
    }, []);
    return React.useMemo(() => ({ status, lockEnabled, isTestAccount, unlock, changePin, disable, enable, resetToTest }), [status, lockEnabled, isTestAccount, unlock, changePin, disable, enable, resetToTest]);
}
/* ────────────────────────────────────────────────────────────────
 * Lock screen
 * ──────────────────────────────────────────────────────────────── */
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
function PinDots({ filled }) {
    return (_jsx("div", { className: "flex items-center justify-center gap-3", children: [0, 1, 2, 3].map((i) => (_jsx("span", { className: cn("h-3.5 w-3.5 rounded-full border-2 transition-all duration-150", i < filled
                ? "scale-100 border-transparent bg-primary"
                : "scale-90 border-muted-foreground/40 bg-transparent") }, i))) }));
}
function LockScreen({ lock }) {
    const [entry, setEntry] = React.useState("");
    const [error, setError] = React.useState(null);
    const [shakeKey, setShakeKey] = React.useState(0);
    const timerRef = React.useRef(null);
    React.useEffect(() => {
        return () => {
            if (timerRef.current)
                clearTimeout(timerRef.current);
        };
    }, []);
    function press(digit) {
        if (timerRef.current)
            return; // verifying — ignore keys
        setError(null);
        const next = (entry + digit).slice(0, 4);
        setEntry(next);
        if (next.length === 4) {
            // Small delay so the 4th dot renders before the result.
            timerRef.current = setTimeout(() => {
                timerRef.current = null;
                if (lock.unlock(next)) {
                    setEntry("");
                }
                else {
                    setShakeKey((k) => k + 1);
                    setError("Wrong PIN — try again.");
                    setEntry("");
                }
            }, 140);
        }
    }
    function backspace() {
        if (timerRef.current)
            return;
        setError(null);
        setEntry((e) => e.slice(0, -1));
    }
    return (_jsxs("div", { className: "flex min-h-screen w-full items-center justify-center bg-background p-6", children: [_jsx("style", { children: `
        @keyframes munim-pin-enter { from { opacity: 0; transform: translateY(14px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes munim-pin-shake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-9px); } 40% { transform: translateX(8px); } 60% { transform: translateX(-6px); } 80% { transform: translateX(4px); } }
      ` }), _jsxs("div", { className: "w-full max-w-sm rounded-3xl border bg-card p-8 shadow-xl shadow-black/5", style: { animation: "munim-pin-enter 0.35s cubic-bezier(0.25,0.46,0.45,0.94)" }, children: [_jsx("div", { className: "mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary", children: _jsx(Lock, { className: "h-6 w-6", strokeWidth: 2.2 }) }), _jsx("h1", { className: "text-center text-xl font-semibold tracking-tight", children: "Enter your PIN" }), _jsx("p", { className: "mt-1 text-center text-sm text-muted-foreground", children: lock.isTestAccount ? "Test account is active" : "Munim is locked" }), _jsx("div", { className: "my-7", style: shakeKey > 0 ? { animation: "munim-pin-shake 0.4s ease" } : undefined, children: _jsx(PinDots, { filled: entry.length }) }, shakeKey), _jsx("div", { className: "mb-4 h-5 text-center", children: error ? (_jsx("span", { className: "text-sm font-medium text-destructive", children: error })) : lock.isTestAccount ? (_jsxs("span", { className: "text-xs text-muted-foreground", children: ["Test account PIN is ", _jsx("span", { className: "font-semibold text-foreground", children: "1234" })] })) : (_jsx("span", { className: "text-xs text-muted-foreground", children: "\u00A0" })) }), _jsxs("div", { className: "mx-auto grid max-w-[240px] grid-cols-3 gap-2.5", children: [KEYS.map((k) => (_jsx("button", { type: "button", onClick: () => press(k), className: "flex h-16 items-center justify-center rounded-2xl bg-muted text-lg font-semibold transition-all duration-100 hover:bg-muted/80 active:scale-90", children: k }, k))), _jsx("div", {}), " ", _jsx("button", { type: "button", onClick: () => press("0"), className: "flex h-16 items-center justify-center rounded-2xl bg-muted text-lg font-semibold transition-all duration-100 hover:bg-muted/80 active:scale-90", children: "0" }), _jsx("button", { type: "button", onClick: backspace, "aria-label": "Delete digit", className: "flex h-16 items-center justify-center rounded-2xl text-muted-foreground transition-all duration-100 hover:bg-muted/80 active:scale-90", children: _jsx(Delete, { className: "h-5 w-5" }) })] }), !lock.isTestAccount && (_jsx("button", { type: "button", onClick: () => {
                            lock.resetToTest();
                        }, className: "mx-auto mt-6 block text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline", children: "Forgot PIN? Reset to the test account (1234)" }))] })] }));
}
/* ────────────────────────────────────────────────────────────────
 * Gate
 * ──────────────────────────────────────────────────────────────── */
export function PinGate({ children }) {
    const lock = usePinLock();
    if (lock.status === "loading")
        return null;
    if (lock.status === "locked")
        return _jsx(LockScreen, { lock: lock });
    return _jsx(PinLockContext.Provider, { value: lock, children: children });
}
//# sourceMappingURL=pin-gate.js.map