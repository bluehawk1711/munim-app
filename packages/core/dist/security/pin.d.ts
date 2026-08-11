/**
 * 4-digit PIN lock — pure, platform-agnostic logic shared by web, desktop and
 * mobile.
 *
 * Every device keeps its OWN lock locally (web/desktop: localStorage, mobile:
 * AsyncStorage) — this module never touches storage. It provides hashing,
 * verification, the pre-created test account, and input validators so all three
 * apps behave identically.
 *
 * The PIN is stored as a SHA-256 hash of a salted string (never plaintext, and
 * never the bare hash of the digits alone). SHA-256 is implemented in pure TS
 * here because Hermes (React Native) has no Web Crypto API — a dependency-free
 * implementation guarantees the same hash on every platform.
 */
/** Test account PIN — pre-created on first launch so the app is instantly usable. */
export declare const TEST_PIN = "1234";
/** SHA-256 of a UTF-8 string, as 64 lowercase hex chars. */
export declare function sha256Hex(input: string): string;
/** Hash a 4-digit PIN for storage. Never store the PIN itself. */
export declare function hashPin(pin: string): string;
/** True for a well-formed stored hash (64 lowercase hex chars). */
export declare function isPinHash(value: string | null | undefined): value is string;
/** True when the input is exactly four ASCII digits. */
export declare function isFourDigitPin(pin: string): boolean;
/**
 * Verify a PIN against a stored hash. Both sides are fixed-length hex, so a
 * byte-wise XOR diff gives a constant-time-ish comparison (no early exit).
 */
export declare function verifyPin(pin: string, hash: string): boolean;
/** True when the stored hash belongs to the pre-created test account. */
export declare function isTestPinHash(hash: string): boolean;
//# sourceMappingURL=pin.d.ts.map