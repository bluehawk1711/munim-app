"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * Login + PIN lock gate — shared by the web and desktop apps so both lock
 * screens are pixel-identical.
 *
 * Storage (per-device, never the shared database):
 *   - `munim.pin`      localStorage  — PIN hash; absent = first launch,
 *                                       "0" = lock disabled, else a 64-char hash
 *   - `munim.email`    localStorage  — normalized (lowercased) account email
 *   - `munim.password` localStorage  — hashed account password
 *   - `munim.session`  cookie        — "1" while this device is unlocked, so a
 *                                       refresh/navigation doesn't re-prompt
 *
 * The login is two steps: email + password FIRST, then the 4-digit PIN. After
 * a successful full login a session cookie is set (30 days), so users don't
 * have to log in again on every refresh. "Log out / Lock now" in Settings
 * clears the session and locks the app immediately.
 */
import * as React from "react";
import { Delete, Lock, Mail } from "lucide-react";
import { TEST_EMAIL, TEST_PASSWORD, TEST_PIN, hashPassword, hashPin, isEmail, isFourDigitPin, isPassword, isPinHash, isTestPasswordHash, isTestPinHash, verifyEmail, verifyPassword, verifyPin, } from "@munim/core";
import { cn } from "../lib/utils";
const PIN_KEY = "munim.pin";
const EMAIL_KEY = "munim.email";
const PASSWORD_KEY = "munim.password";
const SESSION_COOKIE = "munim.session";
const DISABLED = "0";
const SESSION_MAX_AGE_DAYS = 30;
const PinLockContext = React.createContext(null);
/** Read the lock state. Must be used inside <PinGate>. */
export function usePinLockContext() {
    const ctx = React.useContext(PinLockContext);
    if (!ctx)
        throw new Error("usePinLockContext must be used within <PinGate>");
    return ctx;
}
/* ────────────────────────────────────────────────────────────────
 * Storage helpers (localStorage + session cookie)
 * ──────────────────────────────────────────────────────────────── */
function readLocal(key) {
    if (typeof window === "undefined")
        return null;
    try {
        return window.localStorage.getItem(key);
    }
    catch {
        return null;
    }
}
function writeLocal(key, value) {
    try {
        window.localStorage.setItem(key, value);
    }
    catch {
        // Storage unavailable — the lock still works for this session.
    }
}
function readSession() {
    if (typeof document === "undefined")
        return false;
    try {
        return document.cookie.split("; ").some((c) => c.startsWith(`${SESSION_COOKIE}=1`));
    }
    catch {
        return false;
    }
}
function writeSession(active) {
    if (typeof document === "undefined")
        return;
    try {
        if (active) {
            const maxAge = SESSION_MAX_AGE_DAYS * 24 * 60 * 60;
            document.cookie = `${SESSION_COOKIE}=1; path=/; max-age=${maxAge}; samesite=lax`;
        }
        else {
            document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0`;
        }
    }
    catch {
        // Cookie unavailable — the lock still works for this session.
    }
}
/* ────────────────────────────────────────────────────────────────
 * Lock state hook
 * ──────────────────────────────────────────────────────────────── */
function usePinLock() {
    const [status, setStatus] = React.useState("loading");
    const [lockEnabled, setLockEnabled] = React.useState(false);
    const [isTestAccount, setIsTestAccount] = React.useState(false);
    const [accountEmail, setAccountEmail] = React.useState(TEST_EMAIL);
    const seedTestCredentials = React.useCallback(() => {
        writeLocal(EMAIL_KEY, TEST_EMAIL);
        writeLocal(PASSWORD_KEY, hashPassword(TEST_PASSWORD));
        setAccountEmail(TEST_EMAIL);
        setIsTestAccount(true);
    }, []);
    // Initialize once on mount (client only — SSR keeps "loading").
    React.useEffect(() => {
        if (typeof window === "undefined")
            return;
        const stored = readLocal(PIN_KEY);
        if (stored === null) {
            // First launch → pre-create the test account.
            writeLocal(PIN_KEY, hashPin(TEST_PIN));
            seedTestCredentials();
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
            // Back-compat: a device with a PIN but no email/password keys gets the
            // test-account credentials seeded (its own PIN is preserved).
            if (readLocal(EMAIL_KEY) === null) {
                seedTestCredentials();
            }
            else {
                setAccountEmail(readLocal(EMAIL_KEY) ?? TEST_EMAIL);
                setIsTestAccount(isTestPinHash(stored) && isTestPasswordHash(readLocal(PASSWORD_KEY) ?? ""));
            }
            // Session cookie → already unlocked on this device.
            setStatus(readSession() ? "unlocked" : "locked");
            return;
        }
        // Corrupt value → recreate the test account.
        writeLocal(PIN_KEY, hashPin(TEST_PIN));
        seedTestCredentials();
        setLockEnabled(true);
        setStatus("locked");
    }, [seedTestCredentials]);
    const verifyCredentials = React.useCallback((email, password) => {
        const storedEmail = readLocal(EMAIL_KEY);
        const storedPw = readLocal(PASSWORD_KEY);
        if (storedEmail === null || storedPw === null || !isPasswordHash(storedPw))
            return false;
        return verifyEmail(email, storedEmail) && verifyPassword(password, storedPw);
    }, []);
    const unlock = React.useCallback((pin) => {
        const stored = readLocal(PIN_KEY);
        if (stored !== null && stored !== DISABLED && isPinHash(stored) && verifyPin(pin, stored)) {
            writeSession(true);
            setStatus("unlocked");
            return true;
        }
        return false;
    }, []);
    const changePassword = React.useCallback((current, next) => {
        if (!isPassword(next))
            return "Password must be at least 4 characters.";
        const storedPw = readLocal(PASSWORD_KEY);
        if (storedPw === null || !isPasswordHash(storedPw) || !verifyPassword(current, storedPw)) {
            return "Current password is incorrect.";
        }
        writeLocal(PASSWORD_KEY, hashPassword(next));
        setIsTestAccount(false);
        return null;
    }, []);
    const changePin = React.useCallback((current, next) => {
        if (!isFourDigitPin(next))
            return "New PIN must be exactly 4 digits.";
        const stored = readLocal(PIN_KEY);
        if (stored === null || stored === DISABLED || !isPinHash(stored) || !verifyPin(current, stored)) {
            return "Current PIN is incorrect.";
        }
        writeLocal(PIN_KEY, hashPin(next));
        setIsTestAccount(false);
        return null;
    }, []);
    const disable = React.useCallback((current) => {
        const stored = readLocal(PIN_KEY);
        if (stored === null || stored === DISABLED || !isPinHash(stored) || !verifyPin(current, stored)) {
            return "Current PIN is incorrect.";
        }
        writeLocal(PIN_KEY, DISABLED);
        writeSession(false);
        setLockEnabled(false);
        setStatus("unlocked");
        return null;
    }, []);
    const enable = React.useCallback((next) => {
        if (!isFourDigitPin(next))
            return "PIN must be exactly 4 digits.";
        writeLocal(PIN_KEY, hashPin(next));
        setIsTestAccount(false);
        setLockEnabled(true);
        return null;
    }, []);
    const resetToTest = React.useCallback(() => {
        writeLocal(PIN_KEY, hashPin(TEST_PIN));
        seedTestCredentials();
        setLockEnabled(true);
        setStatus("unlocked");
    }, [seedTestCredentials]);
    const lockNow = React.useCallback(() => {
        writeSession(false);
        setStatus("locked");
    }, []);
    return React.useMemo(() => ({
        status,
        lockEnabled,
        isTestAccount,
        accountEmail,
        verifyCredentials,
        unlock,
        changePassword,
        changePin,
        disable,
        enable,
        resetToTest,
        lockNow,
    }), [status, lockEnabled, isTestAccount, accountEmail, verifyCredentials, unlock, changePassword, changePin, disable, enable, resetToTest, lockNow]);
}
// Local alias so the password-hash shape check reads naturally.
function isPasswordHash(value) {
    return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}
/* ────────────────────────────────────────────────────────────────
 * Login screen (two steps: email/password → PIN)
 * ──────────────────────────────────────────────────────────────── */
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
function PinDots({ filled }) {
    return (_jsx("div", { className: "flex items-center justify-center gap-3", children: [0, 1, 2, 3].map((i) => (_jsx("span", { className: cn("h-3.5 w-3.5 rounded-full border-2 transition-all duration-150", i < filled
                ? "scale-100 border-transparent bg-primary"
                : "scale-90 border-muted-foreground/40 bg-transparent") }, i))) }));
}
function LoginScreen({ lock }) {
    const [step, setStep] = React.useState("credentials");
    const [email, setEmail] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [formError, setFormError] = React.useState(null);
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
    function submitCredentials(e) {
        e.preventDefault();
        setFormError(null);
        if (!isEmail(email)) {
            setFormError("Enter a valid email address.");
            return;
        }
        if (!isPassword(password)) {
            setFormError("Password must be at least 4 characters.");
            return;
        }
        if (!lock.verifyCredentials(email, password)) {
            setFormError("Incorrect email or password.");
            return;
        }
        setStep("pin");
        setEntry("");
        setError(null);
    }
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
    const testHint = lock.isTestAccount
        ? "test@munim.app / 1234"
        : null;
    return (_jsxs("div", { className: "relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background p-6", style: {
            background: "radial-gradient(60rem 40rem at 15% -10%, color-mix(in srgb, var(--primary) 12%, transparent), transparent 60%), radial-gradient(50rem 36rem at 110% 110%, color-mix(in srgb, var(--primary) 10%, transparent), transparent 55%)",
        }, children: [_jsx("style", { children: `
        @keyframes munim-pin-enter { from { opacity: 0; transform: translateY(16px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes munim-pin-shake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-9px); } 40% { transform: translateX(8px); } 60% { transform: translateX(-6px); } 80% { transform: translateX(4px); } }
        .munim-gate-item { opacity: 0; animation: munim-pin-enter 0.45s cubic-bezier(0.25,0.46,0.45,0.94) forwards; }
        .munim-gate-key { transition: transform 0.12s ease, background-color 0.15s ease; }
        .munim-gate-key:hover { background-color: color-mix(in srgb, var(--muted) 85%, var(--foreground) 6%); }
        .munim-gate-key:active { transform: scale(0.92); background-color: color-mix(in srgb, var(--muted) 75%, var(--foreground) 10%); }
      ` }), _jsx("div", { className: "pointer-events-none absolute inset-x-0 top-0 mx-auto h-40 max-w-2xl rounded-b-full bg-primary/10 blur-3xl" }), _jsx("div", { className: "glass relative w-full max-w-sm rounded-[2rem] border bg-card/80 p-8 shadow-2xl shadow-black/10 backdrop-blur-2xl", style: { animation: "munim-pin-enter 0.45s cubic-bezier(0.25,0.46,0.45,0.94)" }, children: step === "credentials" ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "munim-gate-item mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-lg shadow-primary/10", style: { animationDelay: "0.04s" }, children: _jsx(Mail, { className: "h-6 w-6", strokeWidth: 2.2 }) }), _jsx("h1", { className: "munim-gate-item text-center text-xl font-semibold tracking-tight", style: { animationDelay: "0.09s" }, children: "Welcome back" }), _jsx("p", { className: "munim-gate-item mt-1 text-center text-sm text-muted-foreground", style: { animationDelay: "0.14s" }, children: lock.isTestAccount ? "Test account is active" : "Sign in to unlock Munim" }), _jsxs("form", { onSubmit: submitCredentials, className: "munim-gate-item mt-6 space-y-3", style: { animationDelay: "0.2s" }, children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx("label", { htmlFor: "login-email", className: "text-xs font-medium text-muted-foreground", children: "Email" }), _jsx("input", { id: "login-email", type: "email", autoComplete: "username", placeholder: "you@shop.com", value: email, onChange: (e) => setEmail(e.target.value), className: "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx("label", { htmlFor: "login-password", className: "text-xs font-medium text-muted-foreground", children: "Password" }), _jsx("input", { id: "login-password", type: "password", autoComplete: "current-password", placeholder: "\u2022\u2022\u2022\u2022", value: password, onChange: (e) => setPassword(e.target.value), className: "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]" })] }), _jsx("div", { className: "h-5 pt-1", children: formError ? (_jsx("span", { className: "text-sm font-medium text-destructive", children: formError })) : testHint ? (_jsxs("span", { className: "text-xs text-muted-foreground", children: ["Test account \u2014 ", _jsx("span", { className: "font-semibold text-foreground", children: testHint })] })) : null }), _jsx("button", { type: "submit", className: "flex h-10 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground shadow-xs transition-all hover:bg-primary/90 active:scale-[0.98]", children: "Continue" })] })] })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "munim-gate-item mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-lg shadow-primary/10", style: { animationDelay: "0.04s" }, children: _jsx(Lock, { className: "h-6 w-6", strokeWidth: 2.2 }) }), _jsx("h1", { className: "munim-gate-item text-center text-xl font-semibold tracking-tight", style: { animationDelay: "0.09s" }, children: "Enter your PIN" }), _jsx("p", { className: "munim-gate-item mt-1 text-center text-sm text-muted-foreground", style: { animationDelay: "0.14s" }, children: lock.isTestAccount ? "Test account PIN is 1234" : "Final security step" }), _jsx("div", { className: "my-7", style: shakeKey > 0 ? { animation: "munim-pin-shake 0.4s ease" } : undefined, children: _jsx(PinDots, { filled: entry.length }) }, shakeKey), _jsx("div", { className: "mb-4 h-5 text-center", children: error ? _jsx("span", { className: "text-sm font-medium text-destructive", children: error }) : _jsx("span", { className: "text-xs text-muted-foreground", children: "\u00A0" }) }), _jsxs("div", { className: "munim-gate-item mx-auto grid max-w-[240px] grid-cols-3 gap-2.5", style: { animationDelay: "0.22s" }, children: [KEYS.map((k) => (_jsx("button", { type: "button", onClick: () => press(k), className: "munim-gate-key flex h-16 items-center justify-center rounded-2xl bg-muted text-lg font-semibold shadow-sm", children: k }, k))), _jsx("div", {}), " ", _jsx("button", { type: "button", onClick: () => press("0"), className: "munim-gate-key flex h-16 items-center justify-center rounded-2xl bg-muted text-lg font-semibold shadow-sm", children: "0" }), _jsx("button", { type: "button", onClick: backspace, "aria-label": "Delete digit", className: "munim-gate-key flex h-16 items-center justify-center rounded-2xl text-muted-foreground shadow-sm", children: _jsx(Delete, { className: "h-5 w-5" }) })] }), _jsxs("div", { className: "munim-gate-item mt-6 flex items-center justify-center gap-4", style: { animationDelay: "0.28s" }, children: [_jsx("button", { type: "button", onClick: () => setStep("credentials"), className: "text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline", children: "\u2190 Back" }), !lock.isTestAccount && (_jsx("button", { type: "button", onClick: () => {
                                        lock.resetToTest();
                                    }, className: "text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline", children: "Forgot PIN? Reset to test account" }))] })] })) })] }));
}
/* ────────────────────────────────────────────────────────────────
 * Gate
 * ──────────────────────────────────────────────────────────────── */
export function PinGate({ children }) {
    const lock = usePinLock();
    if (lock.status === "loading")
        return null;
    if (lock.status === "locked")
        return _jsx(LoginScreen, { lock: lock });
    return _jsx(PinLockContext.Provider, { value: lock, children: children });
}
//# sourceMappingURL=pin-gate.js.map