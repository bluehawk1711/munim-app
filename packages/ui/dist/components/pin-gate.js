"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * Login + PIN lock gate — shared by the web and desktop apps so both lock
 * screens are pixel-identical.
 *
 * Storage (per-device, never the shared database):
 *   - `munim.pin`        localStorage — PIN hash; absent = first launch,
 *                                         "0" = lock disabled, else a 64-char hash
 *   - `munim.email`      localStorage — normalized (lowercased) account email
 *   - `munim.password`   localStorage — hashed account password
 *   - `munim.databaseUrl` localStorage — API base URL (set by onboarding / Settings;
 *                          same key the desktop app's own `lib/env.ts` reads)
 *   - `munim.session`    cookie       — "1" while this device is unlocked
 *
 * First run on desktop: when `onboarding` is enabled and no API URL has been
 * saved yet, a single "connect to your server" step runs BEFORE the login
 * screen (the API proxies the database AND Cloudinary, so no Neon URL or
 * Cloudinary secrets ever live on the device). The login screen has a
 * "Connection settings" link that opens a reset screen — clearing the saved
 * URL sends the user back to onboarding.
 *
 * The login is two steps: email + password FIRST, then the 4-digit PIN
 * (typed into a real input — no keypad buttons). After a successful full
 * login a session cookie is set (30 days), so users don't have to log in
 * again on every refresh.
 */
import * as React from "react";
import { CheckCircle2, Eye, EyeOff, Lock, Mail, RotateCcw, Server, ShieldCheck, XCircle, } from "lucide-react";
import { TEST_EMAIL, TEST_PASSWORD, TEST_PIN, hashPassword, hashPin, isEmail, isFourDigitPin, isPassword, isPinHash, isTestPasswordHash, isTestPinHash, verifyEmail, verifyPassword, verifyPin, } from "@munim/core";
import { cn } from "../lib/utils";
const PIN_KEY = "munim.pin";
const EMAIL_KEY = "munim.email";
const PASSWORD_KEY = "munim.password";
const DATABASE_URL_KEY = "munim.databaseUrl";
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
function removeLocal(key) {
    try {
        window.localStorage.removeItem(key);
    }
    catch {
        // Ignore.
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
 * API connection (base URL) — set during onboarding. Same localStorage key
 * (`munim.databaseUrl`) the desktop app's own env helpers use.
 * ──────────────────────────────────────────────────────────────── */
/** Read the saved API base URL — null until onboarding has been completed. */
export function getSavedApiUrl() {
    const url = readLocal(DATABASE_URL_KEY);
    return url && url.trim() ? url.trim() : null;
}
/** Persist the API base URL (used by the onboarding screen). */
export function saveApiUrl(url) {
    writeLocal(DATABASE_URL_KEY, url.trim());
}
/** Remove the saved API base URL (reset flow). */
export function clearApiUrl() {
    removeLocal(DATABASE_URL_KEY);
}
/** Masked host of a URL, e.g. "api.munim.app". */
export function maskApiHost(url) {
    return url.replace(/^https?:\/\//, "").replace(/\/+$/, "").slice(0, 40) || url.slice(0, 40);
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
 * Shared gate chrome (glass card + entrance animation)
 * ──────────────────────────────────────────────────────────────── */
const GATE_CSS = `
  @keyframes munim-pin-enter { from { opacity: 0; transform: translateY(16px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
  @keyframes munim-pin-shake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-9px); } 40% { transform: translateX(8px); } 60% { transform: translateX(-6px); } 80% { transform: translateX(4px); } }
  .munim-gate-item { opacity: 0; animation: munim-pin-enter 0.45s cubic-bezier(0.25,0.46,0.45,0.94) forwards; }
`;
function GateShell({ children }) {
    return (_jsxs("div", { className: "relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background p-6", style: {
            background: "radial-gradient(60rem 40rem at 15% -10%, color-mix(in srgb, var(--primary) 12%, transparent), transparent 60%), radial-gradient(50rem 36rem at 110% 110%, color-mix(in srgb, var(--primary) 10%, transparent), transparent 55%)",
        }, children: [_jsx("style", { children: GATE_CSS }), _jsx("div", { className: "pointer-events-none absolute inset-x-0 top-0 mx-auto h-40 max-w-2xl rounded-b-full bg-primary/10 blur-3xl" }), _jsx("div", { className: "glass relative w-full max-w-sm rounded-[2rem] border bg-card/80 p-8 shadow-2xl shadow-black/10 backdrop-blur-2xl", style: { animation: "munim-pin-enter 0.45s cubic-bezier(0.25,0.46,0.45,0.94)" }, children: children })] }));
}
function GateBadge({ icon: Icon }) {
    return (_jsx("div", { className: "munim-gate-item mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-lg shadow-primary/10", style: { animationDelay: "0.04s" }, children: _jsx(Icon, { className: "h-6 w-6", strokeWidth: 2.2 }) }));
}
const GATE_INPUT_CLASS = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";
const GATE_PRIMARY_BUTTON_CLASS = "flex h-10 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground shadow-xs transition-all hover:bg-primary/90 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";
/* ────────────────────────────────────────────────────────────────
 * Onboarding — first-run: connect to the API server (a single URL step;
 * the API proxies the database AND Cloudinary, so no credentials are
 * collected on the device).
 * ──────────────────────────────────────────────────────────────── */
export function OnboardingScreen({ onComplete, pingApiUrl, }) {
    const [url, setUrl] = React.useState("");
    const [showUrl, setShowUrl] = React.useState(false);
    const [testing, setTesting] = React.useState(false);
    const [testState, setTestState] = React.useState("idle");
    const [testError, setTestError] = React.useState(null);
    const [saving, setSaving] = React.useState(false);
    async function handleTest() {
        const value = url.trim();
        if (!value || !pingApiUrl)
            return;
        setTesting(true);
        setTestState("idle");
        try {
            await pingApiUrl(value);
            setTestState("ok");
        }
        catch (err) {
            setTestState("fail");
            setTestError(err instanceof Error ? err.message : "Connection failed");
        }
        finally {
            setTesting(false);
        }
    }
    function handleFinish() {
        const value = url.trim();
        if (!value)
            return;
        setSaving(true);
        saveApiUrl(value);
        setSaving(false);
        onComplete();
    }
    return (_jsxs(GateShell, { children: [_jsx(GateBadge, { icon: Server }), _jsx("h1", { className: "munim-gate-item text-center text-xl font-semibold tracking-tight", style: { animationDelay: "0.09s" }, children: "Connect to your server" }), _jsx("p", { className: "munim-gate-item mt-1 text-center text-sm text-muted-foreground", style: { animationDelay: "0.14s" }, children: "Enter the Munim API base URL \u2014 the same server the web app uses" }), _jsxs("div", { className: "munim-gate-item mt-6 space-y-3", style: { animationDelay: "0.2s" }, children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx("label", { htmlFor: "onb-api", className: "text-xs font-medium text-muted-foreground", children: "API base URL" }), _jsxs("div", { className: "relative", children: [_jsx("input", { id: "onb-api", type: "text", autoComplete: "off", spellCheck: false, placeholder: "https://api.munim.app", value: url, onChange: (e) => {
                                            setUrl(e.target.value);
                                            setTestState("idle");
                                        }, className: cn(GATE_INPUT_CLASS, "pr-10 font-mono text-xs") }), _jsx("button", { type: "button", onClick: () => setShowUrl((v) => !v), "aria-label": showUrl ? "Hide URL" : "Show URL", className: "text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer", children: showUrl ? _jsx(EyeOff, { className: "h-4 w-4" }) : _jsx(Eye, { className: "h-4 w-4" }) })] })] }), pingApiUrl ? (_jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("button", { type: "button", onClick: () => void handleTest(), disabled: !url.trim() || testing, className: "flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-xs font-medium transition-all hover:bg-muted active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50", children: [testing ? (_jsx("span", { className: "border-primary size-3 animate-spin rounded-full border-2 border-t-transparent" })) : (_jsx(Server, { className: "h-3.5 w-3.5" })), testing ? "Testing…" : "Test connection"] }), testState === "ok" ? (_jsxs("span", { className: "flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400", children: [_jsx(CheckCircle2, { className: "h-3.5 w-3.5" }), " Connected"] })) : testState === "fail" ? (_jsxs("span", { className: "flex items-center gap-1 text-xs font-medium text-destructive", title: testError ?? undefined, children: [_jsx(XCircle, { className: "h-3.5 w-3.5" }), " Failed"] })) : null] })) : null, _jsx("button", { type: "button", onClick: handleFinish, disabled: !url.trim() || saving, className: cn(GATE_PRIMARY_BUTTON_CLASS, "cursor-pointer"), children: saving ? "Saving…" : "Finish setup" }), _jsx("p", { className: "text-center text-[11px] text-muted-foreground", children: "Stored on this device only \u2014 the API key is baked into the app at build time." })] })] }));
}
/* ────────────────────────────────────────────────────────────────
 * Reset connection screen — reachable from the login screen
 * ──────────────────────────────────────────────────────────────── */
export function ResetConfigScreen({ onCleared, onCancel, }) {
    const setup = getSavedApiUrl();
    return (_jsxs(GateShell, { children: [_jsx(GateBadge, { icon: ShieldCheck }), _jsx("h1", { className: "munim-gate-item text-center text-xl font-semibold tracking-tight", style: { animationDelay: "0.09s" }, children: "Connection settings" }), _jsx("p", { className: "munim-gate-item mt-1 text-center text-sm text-muted-foreground", style: { animationDelay: "0.14s" }, children: "Saved on this device only \u2014 never in the shared database." }), _jsxs("div", { className: "munim-gate-item mt-6 space-y-2.5", style: { animationDelay: "0.2s" }, children: [_jsxs("div", { className: "rounded-xl border bg-muted/40 p-3.5", children: [_jsx("p", { className: "text-[11px] font-semibold tracking-wide text-muted-foreground uppercase", children: "Server" }), _jsx("p", { className: "mt-1 font-mono text-xs font-medium", children: setup ? maskApiHost(setup) : "Not configured" })] }), _jsxs("button", { type: "button", onClick: () => {
                            clearApiUrl();
                            onCleared();
                        }, className: "mt-1 flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-destructive text-sm font-medium text-destructive-foreground shadow-xs transition-all hover:bg-destructive/90 active:scale-[0.98]", children: [_jsx(RotateCcw, { className: "h-4 w-4" }), " Clear & start over"] }), _jsx("p", { className: "text-center text-[11px] leading-relaxed text-muted-foreground", children: "Wrong server URL? Clearing returns you to the setup screen." }), _jsx("button", { type: "button", onClick: onCancel, className: "text-muted-foreground hover:text-foreground h-8 w-full cursor-pointer text-xs font-medium underline-offset-2 hover:underline", children: "Back to login" })] })] }));
}
/* ────────────────────────────────────────────────────────────────
 * Login screen (two steps: email/password → PIN input)
 * ──────────────────────────────────────────────────────────────── */
function PinDots({ filled }) {
    return (_jsx("div", { className: "flex items-center justify-center gap-3", children: [0, 1, 2, 3].map((i) => (_jsx("span", { className: cn("h-3.5 w-3.5 rounded-full border-2 transition-all duration-150", i < filled
                ? "scale-100 border-transparent bg-primary"
                : "scale-90 border-muted-foreground/40 bg-transparent") }, i))) }));
}
function LoginScreen({ lock, onOpenConnectionSettings, }) {
    const [step, setStep] = React.useState("credentials");
    const [email, setEmail] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [formError, setFormError] = React.useState(null);
    const [entry, setEntry] = React.useState("");
    const [error, setError] = React.useState(null);
    const [shakeKey, setShakeKey] = React.useState(0);
    const timerRef = React.useRef(null);
    const pinInputRef = React.useRef(null);
    React.useEffect(() => {
        return () => {
            if (timerRef.current)
                clearTimeout(timerRef.current);
        };
    }, []);
    React.useEffect(() => {
        // Refocus the PIN input when the step becomes visible (some browsers blur
        // it after a re-render with autoFocus).
        if (step === "pin") {
            const t = setTimeout(() => pinInputRef.current?.focus(), 250);
            return () => clearTimeout(t);
        }
    }, [step]);
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
    function submitPin() {
        if (timerRef.current)
            return;
        if (entry.length !== 4)
            return;
        timerRef.current = setTimeout(() => {
            timerRef.current = null;
            if (lock.unlock(entry)) {
                setEntry("");
            }
            else {
                setShakeKey((k) => k + 1);
                setError("Wrong PIN — try again.");
                setEntry("");
                pinInputRef.current?.focus();
            }
        }, 140);
    }
    function handlePinChange(value) {
        if (timerRef.current)
            return; // verifying — ignore input
        setError(null);
        const digits = value.replace(/\D/g, "").slice(0, 4);
        setEntry(digits);
        if (digits.length === 4)
            submitPin();
    }
    const testHint = lock.isTestAccount ? "test@munim.app / 1234" : null;
    return (_jsx(GateShell, { children: step === "credentials" ? (_jsxs(_Fragment, { children: [_jsx(GateBadge, { icon: Mail }), _jsx("h1", { className: "munim-gate-item text-center text-xl font-semibold tracking-tight", style: { animationDelay: "0.09s" }, children: "Welcome back" }), _jsx("p", { className: "munim-gate-item mt-1 text-center text-sm text-muted-foreground", style: { animationDelay: "0.14s" }, children: lock.isTestAccount ? "Test account is active" : "Sign in to unlock Munim" }), _jsxs("form", { onSubmit: submitCredentials, className: "munim-gate-item mt-6 space-y-3", style: { animationDelay: "0.2s" }, children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx("label", { htmlFor: "login-email", className: "text-xs font-medium text-muted-foreground", children: "Email" }), _jsx("input", { id: "login-email", type: "email", autoComplete: "username", placeholder: "you@shop.com", value: email, onChange: (e) => setEmail(e.target.value), className: GATE_INPUT_CLASS })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx("label", { htmlFor: "login-password", className: "text-xs font-medium text-muted-foreground", children: "Password" }), _jsx("input", { id: "login-password", type: "password", autoComplete: "current-password", placeholder: "\u2022\u2022\u2022\u2022", value: password, onChange: (e) => setPassword(e.target.value), className: GATE_INPUT_CLASS })] }), _jsx("div", { className: "h-5 pt-1", children: formError ? (_jsx("span", { className: "text-sm font-medium text-destructive", children: formError })) : testHint ? (_jsxs("span", { className: "text-xs text-muted-foreground", children: ["Test account \u2014 ", _jsx("span", { className: "font-semibold text-foreground", children: testHint })] })) : null }), _jsx("button", { type: "submit", className: cn(GATE_PRIMARY_BUTTON_CLASS, "cursor-pointer"), children: "Continue" })] }), _jsx("div", { className: "munim-gate-item mt-5 text-center", style: { animationDelay: "0.26s" }, children: _jsx("button", { type: "button", onClick: onOpenConnectionSettings, className: "text-muted-foreground hover:text-foreground cursor-pointer text-xs font-medium underline-offset-2 hover:underline", children: "Connection settings \u2014 change database / credentials" }) })] })) : (_jsxs(_Fragment, { children: [_jsx(GateBadge, { icon: Lock }), _jsx("h1", { className: "munim-gate-item text-center text-xl font-semibold tracking-tight", style: { animationDelay: "0.09s" }, children: "Enter your PIN" }), _jsx("p", { className: "munim-gate-item mt-1 text-center text-sm text-muted-foreground", style: { animationDelay: "0.14s" }, children: lock.isTestAccount ? "Test account PIN is 1234" : "Final security step" }), _jsxs("div", { className: "relative my-8", style: shakeKey > 0 ? { animation: "munim-pin-shake 0.4s ease" } : undefined, children: [_jsx(PinDots, { filled: entry.length }), _jsx("input", { ref: pinInputRef, autoFocus: true, type: "password", inputMode: "numeric", autoComplete: "one-time-code", maxLength: 4, value: entry, onChange: (e) => handlePinChange(e.target.value), onKeyDown: (e) => {
                                if (e.key === "Enter")
                                    submitPin();
                            }, "aria-label": "Enter your 4-digit PIN", className: "absolute inset-0 h-full w-full cursor-text opacity-0" })] }, shakeKey), _jsx("div", { className: "mb-5 h-5 text-center", children: error ? _jsx("span", { className: "text-sm font-medium text-destructive", children: error }) : _jsx("span", { className: "text-xs text-muted-foreground", children: "\u00A0" }) }), _jsxs("div", { className: "munim-gate-item flex items-center justify-center gap-4", style: { animationDelay: "0.2s" }, children: [_jsx("button", { type: "button", onClick: () => {
                                setStep("credentials");
                                setEntry("");
                                setError(null);
                            }, className: "text-muted-foreground hover:text-foreground cursor-pointer text-xs font-medium underline-offset-2 hover:underline", children: "\u2190 Back" }), !lock.isTestAccount && (_jsx("button", { type: "button", onClick: () => {
                                lock.resetToTest();
                            }, className: "text-muted-foreground hover:text-foreground cursor-pointer text-xs font-medium underline-offset-2 hover:underline", children: "Forgot PIN? Reset to test account" }))] })] })) }));
}
/* ────────────────────────────────────────────────────────────────
 * Gate
 * ──────────────────────────────────────────────────────────────── */
export function PinGate({ children, onboarding = false, pingApiUrl, buildTimeApiUrl, }) {
    const lock = usePinLock();
    const [phase, setPhase] = React.useState("gate");
    const [setupChecked, setSetupChecked] = React.useState(false);
    React.useEffect(() => {
        if (!onboarding) {
            setPhase("gate");
            setSetupChecked(true);
            return;
        }
        setPhase(getSavedApiUrl() || buildTimeApiUrl ? "gate" : "onboarding");
        setSetupChecked(true);
    }, [onboarding, buildTimeApiUrl]);
    if (!setupChecked || lock.status === "loading")
        return null;
    if (phase === "onboarding") {
        return (_jsx(OnboardingScreen, { onComplete: () => setPhase("gate"), pingApiUrl: pingApiUrl }));
    }
    if (phase === "reset") {
        return (_jsx(ResetConfigScreen, { onCleared: () => setPhase("onboarding"), onCancel: () => setPhase("gate") }));
    }
    if (lock.status === "locked") {
        return _jsx(LoginScreen, { lock: lock, onOpenConnectionSettings: () => setPhase("reset") });
    }
    return _jsx(PinLockContext.Provider, { value: lock, children: children });
}
//# sourceMappingURL=pin-gate.js.map