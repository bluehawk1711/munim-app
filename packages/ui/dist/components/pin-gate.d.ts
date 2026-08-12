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
export declare function PinGate({ children }: {
    children: React.ReactNode;
}): React.JSX.Element | null;
export {};
//# sourceMappingURL=pin-gate.d.ts.map