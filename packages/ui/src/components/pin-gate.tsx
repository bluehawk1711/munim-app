"use client"

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
 * Login screen (two steps: email/password → PIN)
 * ──────────────────────────────────────────────────────────────── */

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

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

function LoginScreen({ lock }: { lock: PinLockValue }) {
  const [step, setStep] = React.useState<"credentials" | "pin">("credentials");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);
  const [entry, setEntry] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [shakeKey, setShakeKey] = React.useState(0);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

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

  function press(digit: string) {
    if (timerRef.current) return; // verifying — ignore keys
    setError(null);
    const next = (entry + digit).slice(0, 4);
    setEntry(next);
    if (next.length === 4) {
      // Small delay so the 4th dot renders before the result.
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (lock.unlock(next)) {
          setEntry("");
        } else {
          setShakeKey((k) => k + 1);
          setError("Wrong PIN — try again.");
          setEntry("");
        }
      }, 140);
    }
  }

  function backspace() {
    if (timerRef.current) return;
    setError(null);
    setEntry((e) => e.slice(0, -1));
  }

  const testHint = lock.isTestAccount
    ? "test@munim.app / 1234"
    : null;

  return (
    <div
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background p-6"
      style={{
        background:
          "radial-gradient(60rem 40rem at 15% -10%, color-mix(in srgb, var(--primary) 12%, transparent), transparent 60%), radial-gradient(50rem 36rem at 110% 110%, color-mix(in srgb, var(--primary) 10%, transparent), transparent 55%)",
      }}
    >
      <style>{`
        @keyframes munim-pin-enter { from { opacity: 0; transform: translateY(16px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes munim-pin-shake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-9px); } 40% { transform: translateX(8px); } 60% { transform: translateX(-6px); } 80% { transform: translateX(4px); } }
        .munim-gate-item { opacity: 0; animation: munim-pin-enter 0.45s cubic-bezier(0.25,0.46,0.45,0.94) forwards; }
        .munim-gate-key { transition: transform 0.12s ease, background-color 0.15s ease; }
        .munim-gate-key:hover { background-color: color-mix(in srgb, var(--muted) 85%, var(--foreground) 6%); }
        .munim-gate-key:active { transform: scale(0.92); background-color: color-mix(in srgb, var(--muted) 75%, var(--foreground) 10%); }
      `}</style>
      <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-40 max-w-2xl rounded-b-full bg-primary/10 blur-3xl" />
      <div
        className="glass relative w-full max-w-sm rounded-[2rem] border bg-card/80 p-8 shadow-2xl shadow-black/10 backdrop-blur-2xl"
        style={{ animation: "munim-pin-enter 0.45s cubic-bezier(0.25,0.46,0.45,0.94)" }}
      >
        {step === "credentials" ? (
          <>
            <div className="munim-gate-item mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-lg shadow-primary/10" style={{ animationDelay: "0.04s" }}>
              <Mail className="h-6 w-6" strokeWidth={2.2} />
            </div>
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
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
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
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
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

              <button
                type="submit"
                className="flex h-10 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground shadow-xs transition-all hover:bg-primary/90 active:scale-[0.98]"
              >
                Continue
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="munim-gate-item mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-lg shadow-primary/10" style={{ animationDelay: "0.04s" }}>
              <Lock className="h-6 w-6" strokeWidth={2.2} />
            </div>
            <h1 className="munim-gate-item text-center text-xl font-semibold tracking-tight" style={{ animationDelay: "0.09s" }}>Enter your PIN</h1>
            <p className="munim-gate-item mt-1 text-center text-sm text-muted-foreground" style={{ animationDelay: "0.14s" }}>
              {lock.isTestAccount ? "Test account PIN is 1234" : "Final security step"}
            </p>

            <div
              key={shakeKey}
              className="my-7"
              style={shakeKey > 0 ? { animation: "munim-pin-shake 0.4s ease" } : undefined}
            >
              <PinDots filled={entry.length} />
            </div>

            <div className="mb-4 h-5 text-center">
              {error ? <span className="text-sm font-medium text-destructive">{error}</span> : <span className="text-xs text-muted-foreground">&nbsp;</span>}
            </div>

            <div className="munim-gate-item mx-auto grid max-w-[240px] grid-cols-3 gap-2.5" style={{ animationDelay: "0.22s" }}>
              {KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => press(k)}
                  className="munim-gate-key flex h-16 items-center justify-center rounded-2xl bg-muted text-lg font-semibold shadow-sm"
                >
                  {k}
                </button>
              ))}
              <div /> {/* empty cell keeps the 3×4 grid */}
              <button
                type="button"
                onClick={() => press("0")}
                className="munim-gate-key flex h-16 items-center justify-center rounded-2xl bg-muted text-lg font-semibold shadow-sm"
              >
                0
              </button>
              <button
                type="button"
                onClick={backspace}
                aria-label="Delete digit"
                className="munim-gate-key flex h-16 items-center justify-center rounded-2xl text-muted-foreground shadow-sm"
              >
                <Delete className="h-5 w-5" />
              </button>
            </div>

            <div className="munim-gate-item mt-6 flex items-center justify-center gap-4" style={{ animationDelay: "0.28s" }}>
              <button
                type="button"
                onClick={() => setStep("credentials")}
                className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                ← Back
              </button>
              {!lock.isTestAccount && (
                <button
                  type="button"
                  onClick={() => {
                    lock.resetToTest();
                  }}
                  className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  Forgot PIN? Reset to test account
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
 * Gate
 * ──────────────────────────────────────────────────────────────── */

export function PinGate({ children }: { children: React.ReactNode }) {
  const lock = usePinLock();
  if (lock.status === "loading") return null;
  if (lock.status === "locked") return <LoginScreen lock={lock} />;
  return <PinLockContext.Provider value={lock}>{children}</PinLockContext.Provider>;
}
