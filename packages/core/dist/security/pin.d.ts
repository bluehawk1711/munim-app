/**
 * Login + 4-digit PIN lock — pure, platform-agnostic logic shared by web,
 * desktop and mobile.
 *
 * Every device keeps its OWN credentials locally (web/desktop: localStorage,
 * mobile: AsyncStorage) — this module never touches storage. It provides
 * hashing, verification, the pre-created test account, and input validators so
 * all three apps behave identically.
 *
 * The login is two steps: email + password first, then the 4-digit PIN. The
 * password and PIN are stored as SHA-256 hashes of salted strings (never
 * plaintext, and never the bare hash alone). The email is stored as-is
 * (lowercased) — it is not secret and needs to be displayed in Settings.
 * SHA-256 is implemented in pure TS here because Hermes (React Native) has no
 * Web Crypto API — a dependency-free implementation guarantees the same hash
 * on every platform.
 */
/** Test account PIN — pre-created on first launch so the app is instantly usable. */
export declare const TEST_PIN = "1234";
/** Test account email — shown as the login hint on first launch. */
export declare const TEST_EMAIL = "test@munim.app";
/** Test account password — paired with the test email (and PIN 1234). */
export declare const TEST_PASSWORD = "1234";
/** SHA-256 of a UTF-8 string, as 64 lowercase hex chars. */
export declare function sha256Hex(input: string): string;
/** Hash a 4-digit PIN for storage. Never store the PIN itself. */
export declare function hashPin(pin: string): string;
/** Hash a password for storage. Never store the password itself. */
export declare function hashPassword(password: string): string;
/** Hash an email for storage (lowercased + trimmed before hashing). */
export declare function hashEmail(email: string): string;
/** Lowercase + trim an email so comparisons are case-insensitive. */
export declare function normalizeEmail(email: string): string;
/** True for a plausible email address. */
export declare function isEmail(value: string): boolean;
/** True when the password is long enough (min 4, like the PIN). */
export declare function isPassword(value: string): boolean;
/** True for a well-formed stored hash (64 lowercase hex chars). */
export declare function isPasswordHash(value: string | null | undefined): value is string;
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
/** True when the password hash belongs to the test account. */
export declare function isTestPasswordHash(hash: string): boolean;
/** True when the email matches the test account email. */
export declare function isTestEmail(email: string): boolean;
/**
 * Verify a password against a stored hash. Same constant-time-ish comparison
 * as the PIN (fixed-length hex, XOR diff, no early exit).
 */
export declare function verifyPassword(password: string, hash: string): boolean;
/** Compare an entered email against the stored (normalized) email. */
export declare function verifyEmail(email: string, storedEmail: string): boolean;
//# sourceMappingURL=pin.d.ts.map