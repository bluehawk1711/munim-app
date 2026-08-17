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
/** Read the lock state. Must be used inside <PinGate>. */
export declare function usePinLockContext(): PinLockValue;
/** Read the saved API base URL — null until onboarding has been completed. */
export declare function getSavedApiUrl(): string | null;
/** Persist the API base URL (used by the onboarding screen). */
export declare function saveApiUrl(url: string): void;
/** Remove the saved API base URL (reset flow). */
export declare function clearApiUrl(): void;
/** Masked host of a URL, e.g. "api.munim.app". */
export declare function maskApiHost(url: string): string;
export declare function OnboardingScreen({ onComplete, pingApiUrl, }: {
    onComplete: () => void;
    /** Platform probe (desktop: pingApiUrl → GET /readyz). Optional — lets the
     *  user verify the URL before continuing. */
    pingApiUrl?: (url: string) => Promise<void>;
}): React.JSX.Element;
export declare function ResetConfigScreen({ onCleared, onCancel, }: {
    onCleared: () => void;
    onCancel: () => void;
}): React.JSX.Element;
export declare function PinGate({ children, onboarding, pingApiUrl, }: {
    children: React.ReactNode;
    /** Enable the first-run onboarding when no API URL is saved yet. Web keeps
     *  this off (env-driven); desktop enables it. */
    onboarding?: boolean;
    /** Platform probe (desktop: pingApiUrl → GET /readyz) used by the onboarding
     *  "Test connection" button. */
    pingApiUrl?: (url: string) => Promise<void>;
}): React.JSX.Element | null;
export {};
//# sourceMappingURL=pin-gate.d.ts.map