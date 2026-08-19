"use client"

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
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  RotateCcw,
  Server,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import {
  TEST_EMAIL,
  TEST_PASSWORD,
  TEST_PIN,
  hashPassword,
  hashPin,
  isEmail,
  isFourDigitPin,
  isPassword,
  isPinHash,
  isTestPasswordHash,
  isTestPinHash,
  verifyEmail,
  verifyPassword,
  verifyPin,
} from "@munim/core";
import { cn } from "../lib/utils";

const PIN_KEY = "munim.pin";
const EMAIL_KEY = "munim.email";
const PASSWORD_KEY = "munim.password";
const DATABASE_URL_KEY = "munim.databaseUrl";
const SESSION_COOKIE = "munim.session";
const DISABLED = "0";
const SESSION_MAX_AGE_DAYS = 30;

type PinStatus = "loading" | "locked" | "unlocked";

export type PinLockValue = {
  status: PinStatus;
  /** True while the lock is PERSISTED-enabled — independent of the session
   *  (after a successful unlock, status is "unlocked" but lockEnabled stays
   *  true). Settings cards read this, not status. */
  lockEnabled: boolean;
  /** True when the stored hash belongs to the pre-created test account. */
  isTestAccount: boolean;
  /** Normalized account email (for display in Settings). */
  accountEmail: string;
  /** Verify the email + password step. Returns true on success. */
  verifyCredentials: (email: string, password: string) => boolean;
  /** Attempt the PIN step (after credentials pass). Returns true on success
   *  and persists the unlocked session. */
  unlock: (pin: string) => boolean;
  /** Change the account password. Returns an error message, or null. */
  changePassword: (current: string, next: string) => string | null;
  /** Change the PIN. Returns an error message, or null on success. */
  changePin: (current: string, next: string) => string | null;
  /** Turn the lock off (requires the current PIN). Returns error or null. */
  disable: (current: string) => string | null;
  /** Turn the lock on with a new PIN (does not lock this session). */
  enable: (next: string) => string | null;
  /** Reset to the test account (1234) — the documented recovery path. */
  resetToTest: () => void;
  /** Clear the session and lock the app now (Settings → Log out). */
  lockNow: () => void;
};

const PinLockContext = React.createContext<PinLockValue | null>(null);

/** Read the lock state. Must be used inside <PinGate>. */
export function usePinLockContext(): PinLockValue {
  const ctx = React.useContext(PinLockContext);
  if (!ctx) throw new Error("usePinLockContext must be used within <PinGate>");
  return ctx;
}

/* ────────────────────────────────────────────────────────────────
 * Storage helpers (localStorage + session cookie)
 * ──────────────────────────────────────────────────────────────── */

function readLocal(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable — the lock still works for this session.
  }
}

function removeLocal(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore.
  }
}

function readSession(): boolean {
  if (typeof document === "undefined") return false;
  try {
    return document.cookie.split("; ").some((c) => c.startsWith(`${SESSION_COOKIE}=1`));
  } catch {
    return false;
  }
}

function writeSession(active: boolean): void {
  if (typeof document === "undefined") return;
  try {
    if (active) {
      const maxAge = SESSION_MAX_AGE_DAYS * 24 * 60 * 60;
      document.cookie = `${SESSION_COOKIE}=1; path=/; max-age=${maxAge}; samesite=lax`;
    } else {
      document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0`;
    }
  } catch {
    // Cookie unavailable — the lock still works for this session.
  }
}

/* ────────────────────────────────────────────────────────────────
 * API connection (base URL) — set during onboarding. Same localStorage key
 * (`munim.databaseUrl`) the desktop app's own env helpers use.
 * ──────────────────────────────────────────────────────────────── */

/** Read the saved API base URL — null until onboarding has been completed. */
export function getSavedApiUrl(): string | null {
  const url = readLocal(DATABASE_URL_KEY);
  return url && url.trim() ? url.trim() : null;
}

/** Persist the API base URL (used by the onboarding screen). */
export function saveApiUrl(url: string): void {
  writeLocal(DATABASE_URL_KEY, url.trim());
}

/** Remove the saved API base URL (reset flow). */
export function clearApiUrl(): void {
  removeLocal(DATABASE_URL_KEY);
}

/** Masked host of a URL, e.g. "api.munim.app". */
export function maskApiHost(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/+$/, "").slice(0, 40) || url.slice(0, 40);
}

/* ────────────────────────────────────────────────────────────────
 * Lock state hook
 * ──────────────────────────────────────────────────────────────── */

function usePinLock(): PinLockValue {
  const [status, setStatus] = React.useState<PinStatus>("loading");
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
    if (typeof window === "undefined") return;
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
      } else {
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

  const verifyCredentials = React.useCallback((email: string, password: string): boolean => {
    const storedEmail = readLocal(EMAIL_KEY);
    const storedPw = readLocal(PASSWORD_KEY);
    if (storedEmail === null || storedPw === null || !isPasswordHash(storedPw)) return false;
    return verifyEmail(email, storedEmail) && verifyPassword(password, storedPw);
  }, []);

  const unlock = React.useCallback((pin: string): boolean => {
    const stored = readLocal(PIN_KEY);
    if (stored !== null && stored !== DISABLED && isPinHash(stored) && verifyPin(pin, stored)) {
      writeSession(true);
      setStatus("unlocked");
      return true;
    }
    return false;
  }, []);

  const changePassword = React.useCallback((current: string, next: string): string | null => {
    if (!isPassword(next)) return "Password must be at least 4 characters.";
    const storedPw = readLocal(PASSWORD_KEY);
    if (storedPw === null || !isPasswordHash(storedPw) || !verifyPassword(current, storedPw)) {
      return "Current password is incorrect.";
    }
    writeLocal(PASSWORD_KEY, hashPassword(next));
    setIsTestAccount(false);
    return null;
  }, []);

  const changePin = React.useCallback((current: string, next: string): string | null => {
    if (!isFourDigitPin(next)) return "New PIN must be exactly 4 digits.";
    const stored = readLocal(PIN_KEY);
    if (stored === null || stored === DISABLED || !isPinHash(stored) || !verifyPin(current, stored)) {
      return "Current PIN is incorrect.";
    }
    writeLocal(PIN_KEY, hashPin(next));
    setIsTestAccount(false);
    return null;
  }, []);

  const disable = React.useCallback((current: string): string | null => {
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

  const enable = React.useCallback((next: string): string | null => {
    if (!isFourDigitPin(next)) return "PIN must be exactly 4 digits.";
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

  return React.useMemo(
    () => ({
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
    }),
    [status, lockEnabled, isTestAccount, accountEmail, verifyCredentials, unlock, changePassword, changePin, disable, enable, resetToTest, lockNow],
  );
}

// Local alias so the password-hash shape check reads naturally.
function isPasswordHash(value: string | null | undefined): value is string {
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

function GateShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background p-6"
      style={{
        background:
          "radial-gradient(60rem 40rem at 15% -10%, color-mix(in srgb, var(--primary) 12%, transparent), transparent 60%), radial-gradient(50rem 36rem at 110% 110%, color-mix(in srgb, var(--primary) 10%, transparent), transparent 55%)",
      }}
    >
      <style>{GATE_CSS}</style>
      <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-40 max-w-2xl rounded-b-full bg-primary/10 blur-3xl" />
      <div
        className="glass relative w-full max-w-sm rounded-[2rem] border bg-card/80 p-8 shadow-2xl shadow-black/10 backdrop-blur-2xl"
        style={{ animation: "munim-pin-enter 0.45s cubic-bezier(0.25,0.46,0.45,0.94)" }}
      >
        {children}
      </div>
    </div>
  );
}

function GateBadge({ icon: Icon }: { icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }) {
  return (
    <div className="munim-gate-item mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-lg shadow-primary/10" style={{ animationDelay: "0.04s" }}>
      <Icon className="h-6 w-6" strokeWidth={2.2} />
    </div>
  );
}

const GATE_INPUT_CLASS =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

const GATE_PRIMARY_BUTTON_CLASS =
  "flex h-10 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground shadow-xs transition-all hover:bg-primary/90 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

/* ────────────────────────────────────────────────────────────────
 * Onboarding — first-run: connect to the API server (a single URL step;
 * the API proxies the database AND Cloudinary, so no credentials are
 * collected on the device).
 * ──────────────────────────────────────────────────────────────── */

export function OnboardingScreen({
  onComplete,
  pingApiUrl,
}: {
  onComplete: () => void;
  /** Platform probe (desktop: pingApiUrl → GET /readyz). Optional — lets the
   *  user verify the URL before continuing. */
  pingApiUrl?: (url: string) => Promise<void>;
}) {
  const [url, setUrl] = React.useState("");
  const [showUrl, setShowUrl] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [testState, setTestState] = React.useState<"idle" | "ok" | "fail">("idle");
  const [testError, setTestError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  async function handleTest() {
    const value = url.trim();
    if (!value || !pingApiUrl) return;
    setTesting(true);
    setTestState("idle");
    try {
      await pingApiUrl(value);
      setTestState("ok");
    } catch (err) {
      setTestState("fail");
      setTestError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setTesting(false);
    }
  }

  function handleFinish() {
    const value = url.trim();
    if (!value) return;
    setSaving(true);
    saveApiUrl(value);
    setSaving(false);
    onComplete();
  }

  return (
    <GateShell>
      <GateBadge icon={Server} />
      <h1 className="munim-gate-item text-center text-xl font-semibold tracking-tight" style={{ animationDelay: "0.09s" }}>
        Connect to your server
      </h1>
      <p className="munim-gate-item mt-1 text-center text-sm text-muted-foreground" style={{ animationDelay: "0.14s" }}>
        Enter the Munim API base URL — the same server the web app uses
      </p>

      <div className="munim-gate-item mt-6 space-y-3" style={{ animationDelay: "0.2s" }}>
        <div className="space-y-1.5">
          <label htmlFor="onb-api" className="text-xs font-medium text-muted-foreground">
            API base URL
          </label>
          <div className="relative">
            <input
              id="onb-api"
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="https://api.munim.app"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setTestState("idle");
              }}
              className={cn(GATE_INPUT_CLASS, "pr-10 font-mono text-xs")}
            />
            <button
              type="button"
              onClick={() => setShowUrl((v) => !v)}
              aria-label={showUrl ? "Hide URL" : "Show URL"}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer"
            >
              {showUrl ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {pingApiUrl ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleTest()}
              disabled={!url.trim() || testing}
              className="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-xs font-medium transition-all hover:bg-muted active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
            >
              {testing ? (
                <span className="border-primary size-3 animate-spin rounded-full border-2 border-t-transparent" />
              ) : (
                <Server className="h-3.5 w-3.5" />
              )}
              {testing ? "Testing…" : "Test connection"}
            </button>
            {testState === "ok" ? (
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> Connected
              </span>
            ) : testState === "fail" ? (
              <span className="flex items-center gap-1 text-xs font-medium text-destructive" title={testError ?? undefined}>
                <XCircle className="h-3.5 w-3.5" /> Failed
              </span>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleFinish}
          disabled={!url.trim() || saving}
          className={cn(GATE_PRIMARY_BUTTON_CLASS, "cursor-pointer")}
        >
          {saving ? "Saving…" : "Finish setup"}
        </button>
        <p className="text-center text-[11px] text-muted-foreground">
          Stored on this device only — the API key is baked into the app at build time.
        </p>
      </div>
    </GateShell>
  );
}

/* ────────────────────────────────────────────────────────────────
 * Reset connection screen — reachable from the login screen
 * ──────────────────────────────────────────────────────────────── */

export function ResetConfigScreen({
  onCleared,
  onCancel,
}: {
  onCleared: () => void;
  onCancel: () => void;
}) {
  const setup = getSavedApiUrl();

  return (
    <GateShell>
      <GateBadge icon={ShieldCheck} />
      <h1 className="munim-gate-item text-center text-xl font-semibold tracking-tight" style={{ animationDelay: "0.09s" }}>
        Connection settings
      </h1>
      <p className="munim-gate-item mt-1 text-center text-sm text-muted-foreground" style={{ animationDelay: "0.14s" }}>
        Saved on this device only — never in the shared database.
      </p>

      <div className="munim-gate-item mt-6 space-y-2.5" style={{ animationDelay: "0.2s" }}>
        <div className="rounded-xl border bg-muted/40 p-3.5">
          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Server</p>
          <p className="mt-1 font-mono text-xs font-medium">{setup ? maskApiHost(setup) : "Not configured"}</p>
        </div>

        <button
          type="button"
          onClick={() => {
            clearApiUrl();
            onCleared();
          }}
          className="mt-1 flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-destructive text-sm font-medium text-destructive-foreground shadow-xs transition-all hover:bg-destructive/90 active:scale-[0.98]"
        >
          <RotateCcw className="h-4 w-4" /> Clear &amp; start over
        </button>
        <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
          Wrong server URL? Clearing returns you to the setup screen.
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground h-8 w-full cursor-pointer text-xs font-medium underline-offset-2 hover:underline"
        >
          Back to login
        </button>
      </div>
    </GateShell>
  );
}

/* ────────────────────────────────────────────────────────────────
 * Login screen (two steps: email/password → PIN input)
 * ──────────────────────────────────────────────────────────────── */

function PinDots({ filled }: { filled: number }) {
  return (
    <div className="flex items-center justify-center gap-3">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={cn(
            "h-3.5 w-3.5 rounded-full border-2 transition-all duration-150",
            i < filled
              ? "scale-100 border-transparent bg-primary"
              : "scale-90 border-muted-foreground/40 bg-transparent"
          )}
        />
      ))}
    </div>
  );
}

function LoginScreen({
  lock,
  onOpenConnectionSettings,
}: {
  lock: PinLockValue;
  onOpenConnectionSettings: () => void;
}) {
  const [step, setStep] = React.useState<"credentials" | "pin">("credentials");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);
  const [entry, setEntry] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [shakeKey, setShakeKey] = React.useState(0);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
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

  function submitCredentials(e: React.FormEvent) {
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
    if (timerRef.current) return;
    if (entry.length !== 4) return;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (lock.unlock(entry)) {
        setEntry("");
      } else {
        setShakeKey((k) => k + 1);
        setError("Wrong PIN — try again.");
        setEntry("");
        pinInputRef.current?.focus();
      }
    }, 140);
  }

  function handlePinChange(value: string) {
    if (timerRef.current) return; // verifying — ignore input
    setError(null);
    const digits = value.replace(/\D/g, "").slice(0, 4);
    setEntry(digits);
    if (digits.length === 4) submitPin();
  }

  const testHint = lock.isTestAccount ? "test@munim.app / 1234" : null;

  return (
    <GateShell>
      {step === "credentials" ? (
        <>
          <GateBadge icon={Mail} />
          <h1 className="munim-gate-item text-center text-xl font-semibold tracking-tight" style={{ animationDelay: "0.09s" }}>Welcome back</h1>
          <p className="munim-gate-item mt-1 text-center text-sm text-muted-foreground" style={{ animationDelay: "0.14s" }}>
            {lock.isTestAccount ? "Test account is active" : "Sign in to unlock Munim"}
          </p>

          <form onSubmit={submitCredentials} className="munim-gate-item mt-6 space-y-3" style={{ animationDelay: "0.2s" }}>
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="text-xs font-medium text-muted-foreground">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                placeholder="you@shop.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={GATE_INPUT_CLASS}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="login-password" className="text-xs font-medium text-muted-foreground">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                placeholder="••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={GATE_INPUT_CLASS}
              />
            </div>

            <div className="h-5 pt-1">
              {formError ? (
                <span className="text-sm font-medium text-destructive">{formError}</span>
              ) : testHint ? (
                <span className="text-xs text-muted-foreground">
                  Test account — <span className="font-semibold text-foreground">{testHint}</span>
                </span>
              ) : null}
            </div>

            <button type="submit" className={cn(GATE_PRIMARY_BUTTON_CLASS, "cursor-pointer")}>
              Continue
            </button>
          </form>

          <div className="munim-gate-item mt-5 text-center" style={{ animationDelay: "0.26s" }}>
            <button
              type="button"
              onClick={onOpenConnectionSettings}
              className="text-muted-foreground hover:text-foreground cursor-pointer text-xs font-medium underline-offset-2 hover:underline"
            >
              Connection settings — change database / credentials
            </button>
          </div>
        </>
      ) : (
        <>
          <GateBadge icon={Lock} />
          <h1 className="munim-gate-item text-center text-xl font-semibold tracking-tight" style={{ animationDelay: "0.09s" }}>Enter your PIN</h1>
          <p className="munim-gate-item mt-1 text-center text-sm text-muted-foreground" style={{ animationDelay: "0.14s" }}>
            {lock.isTestAccount ? "Test account PIN is 1234" : "Final security step"}
          </p>

          <div
            key={shakeKey}
            className="relative my-8"
            style={shakeKey > 0 ? { animation: "munim-pin-shake 0.4s ease" } : undefined}
          >
            <PinDots filled={entry.length} />
            {/* Real PIN input overlaid on the dots — no keypad buttons. */}
            <input
              ref={pinInputRef}
              autoFocus
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              value={entry}
              onChange={(e) => handlePinChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitPin();
              }}
              aria-label="Enter your 4-digit PIN"
              className="absolute inset-0 h-full w-full cursor-text opacity-0"
            />
          </div>

          <div className="mb-5 h-5 text-center">
            {error ? <span className="text-sm font-medium text-destructive">{error}</span> : <span className="text-xs text-muted-foreground">&nbsp;</span>}
          </div>

          <div className="munim-gate-item flex items-center justify-center gap-4" style={{ animationDelay: "0.2s" }}>
            <button
              type="button"
              onClick={() => {
                setStep("credentials");
                setEntry("");
                setError(null);
              }}
              className="text-muted-foreground hover:text-foreground cursor-pointer text-xs font-medium underline-offset-2 hover:underline"
            >
              ← Back
            </button>
            {!lock.isTestAccount && (
              <button
                type="button"
                onClick={() => {
                  lock.resetToTest();
                }}
                className="text-muted-foreground hover:text-foreground cursor-pointer text-xs font-medium underline-offset-2 hover:underline"
              >
                Forgot PIN? Reset to test account
              </button>
            )}
          </div>
        </>
      )}
    </GateShell>
  );
}

/* ────────────────────────────────────────────────────────────────
 * Gate
 * ──────────────────────────────────────────────────────────────── */

export function PinGate({
  children,
  onboarding = false,
  pingApiUrl,
  buildTimeApiUrl,
}: {
  children: React.ReactNode;
  /** Enable the first-run onboarding when no API URL is saved yet. Web keeps
   *  this off (env-driven); desktop enables it. */
  onboarding?: boolean;
  /** Platform probe (desktop: pingApiUrl → GET /readyz) used by the onboarding
   *  "Test connection" button. */
  pingApiUrl?: (url: string) => Promise<void>;
  /** Build-time API URL (VITE_API_URL) — when set alongside `onboarding`,
   *  the onboarding screen is skipped because the app already knows where to
   *  connect. */
  buildTimeApiUrl?: string;
}) {
  const lock = usePinLock();
  const [phase, setPhase] = React.useState<"onboarding" | "reset" | "gate">("gate");
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

  if (!setupChecked || lock.status === "loading") return null;

  if (phase === "onboarding") {
    return (
      <OnboardingScreen
        onComplete={() => setPhase("gate")}
        pingApiUrl={pingApiUrl}
      />
    );
  }
  if (phase === "reset") {
    return (
      <ResetConfigScreen
        onCleared={() => setPhase("onboarding")}
        onCancel={() => setPhase("gate")}
      />
    );
  }
  if (lock.status === "locked") {
    return <LoginScreen lock={lock} onOpenConnectionSettings={() => setPhase("reset")} />;
  }
  return <PinLockContext.Provider value={lock}>{children}</PinLockContext.Provider>;
}
