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
type PinStatus = "loading" | "locked" | "unlocked";
export type PinLockValue = {
    status: PinStatus;
    /** True while the lock is PERSISTED-enabled — independent of the session
     *  (after a successful unlock, status is "unlocked" but lockEnabled stays
     *  true). Settings cards read this, not status. */
    lockEnabled: boolean;
    /** True when the stored hash belongs to the pre-created test account. */
    isTestAccount: boolean;
    /** Attempt an unlock. Returns true on success. */
    unlock: (pin: string) => boolean;
    /** Change the PIN. Returns an error message, or null on success. */
    changePin: (current: string, next: string) => string | null;
    /** Turn the lock off (requires the current PIN). Returns error or null. */
    disable: (current: string) => string | null;
    /** Turn the lock on with a new PIN (does not lock this session). */
    enable: (next: string) => string | null;
    /** Reset to the test account (1234) — the documented recovery path. */
    resetToTest: () => void;
};
/** Read the lock state. Must be used inside <PinGate>. */
export declare function usePinLockContext(): PinLockValue;
export declare function PinGate({ children }: {
    children: React.ReactNode;
}): React.JSX.Element | null;
export {};
//# sourceMappingURL=pin-gate.d.ts.map