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
export const TEST_PIN = "1234";

/** Test account email — shown as the login hint on first launch. */
export const TEST_EMAIL = "test@munim.app";

/** Test account password — paired with the test email (and PIN 1234). */
export const TEST_PASSWORD = "1234";

/** Static salt so a stored hash is never the raw digest of the bare digits. */
const SALT = "munim.pin.";

/* ────────────────────────────────────────────────────────────────
 * Pure JS SHA-256 (FIPS 180-4). Input is UTF-8; output is lowercase hex.
 * ──────────────────────────────────────────────────────────────── */

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

function toHex(x: number): string {
  return (x >>> 0).toString(16).padStart(8, "0");
}

/** Encode a JS string as UTF-8 bytes (surrogate-safe, no legacy APIs). */
function utf8Bytes(str: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 0x80) {
      out.push(code);
    } else if (code < 0x800) {
      out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
      const next = str.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        const cp = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
        i++;
      } else {
        out.push(0xef, 0xbf, 0xbd);
      }
    } else if (code >= 0xd800 && code <= 0xdfff) {
      out.push(0xef, 0xbf, 0xbd);
    } else {
      out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  return out;
}

/** SHA-256 of a UTF-8 string, as 64 lowercase hex chars. */
export function sha256Hex(input: string): string {
  const bytes = utf8Bytes(input);
  const bitLenHi = Math.floor(bytes.length / 0x20000000);
  const bitLenLo = (bytes.length << 3) >>> 0;
  const padded = bytes.concat([0x80]);
  while (padded.length % 64 !== 56) padded.push(0);
  padded.push(
    (bitLenHi >>> 24) & 0xff,
    (bitLenHi >>> 16) & 0xff,
    (bitLenHi >>> 8) & 0xff,
    bitLenHi & 0xff,
    (bitLenLo >>> 24) & 0xff,
    (bitLenLo >>> 16) & 0xff,
    (bitLenLo >>> 8) & 0xff,
    bitLenLo & 0xff,
  );

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Array<number>(64).fill(0);
  for (let i = 0; i < padded.length; i += 64) {
    for (let t = 0; t < 16; t++) {
      const o = i + t * 4;
      w[t] =
        (((padded[o] ?? 0) << 24) | ((padded[o + 1] ?? 0) << 16) | ((padded[o + 2] ?? 0) << 8) | (padded[o + 3] ?? 0)) >>> 0;
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(w[t - 15] ?? 0, 7) ^ rotr(w[t - 15] ?? 0, 18) ^ ((w[t - 15] ?? 0) >>> 3);
      const s1 = rotr(w[t - 2] ?? 0, 17) ^ rotr(w[t - 2] ?? 0, 19) ^ ((w[t - 2] ?? 0) >>> 10);
      w[t] = ((w[t - 16] ?? 0) + s0 + (w[t - 7] ?? 0) + s1) >>> 0;
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + (K[t] ?? 0) + (w[t] ?? 0)) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7].map(toHex).join("");
}

/** SHA-1 of a UTF-8 string, as 40 lowercase hex chars. Pure TS — works on
 * Hermes, the Tauri webview and Node (used for Cloudinary signed uploads). */
export function sha1Hex(input: string): string {
  const bytes = utf8Bytes(input);
  const bitLen = (bytes.length << 3) >>> 0;
  const padded = bytes.concat([0x80]);
  while (padded.length % 64 !== 56) padded.push(0);
  // 64-bit length field — messages here are tiny so the high word is always 0.
  padded.push(0, 0, 0, 0, (bitLen >>> 24) & 0xff, (bitLen >>> 16) & 0xff, (bitLen >>> 8) & 0xff, bitLen & 0xff);

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;

  const w = new Array<number>(80).fill(0);
  for (let i = 0; i < padded.length; i += 64) {
    for (let t = 0; t < 16; t++) {
      const o = i + t * 4;
      w[t] =
        (((padded[o] ?? 0) << 24) | ((padded[o + 1] ?? 0) << 16) | ((padded[o + 2] ?? 0) << 8) | (padded[o + 3] ?? 0)) >>> 0;
    }
    for (let t = 16; t < 80; t++) {
      // SHA-1 schedule: ROTL1(w[t-3] ^ w[t-8] ^ w[t-14] ^ w[t-16]) ≡ ROTR31(...)
      w[t] = rotr(((w[t - 3] ?? 0) ^ (w[t - 8] ?? 0) ^ (w[t - 14] ?? 0) ^ (w[t - 16] ?? 0)) >>> 0, 31);
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    for (let t = 0; t < 80; t++) {
      const f =
        t < 20
          ? (b & c) | (~b & d)
          : t < 40
            ? b ^ c ^ d
            : t < 60
              ? (b & c) | (b & d) | (c & d)
              : b ^ c ^ d;
      const k = t < 20 ? 0x5a827999 : t < 40 ? 0x6ed9eba1 : t < 60 ? 0x8f1bbcdc : 0xca62c1d6;
      // ROTL(a, 5) ≡ ROTR(a, 27)
      const temp = (rotr(a, 27) + f + e + (k >>> 0) + (w[t] ?? 0)) >>> 0;
      e = d;
      d = c;
      // ROTL(b, 30) ≡ ROTR(b, 2)
      c = rotr(b, 2);
      b = a;
      a = temp;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }
  return [h0, h1, h2, h3, h4].map(toHex).join("");
}

/* ────────────────────────────────────────────────────────────────
 * PIN API
 * ──────────────────────────────────────────────────────────────── */

/** Hash a 4-digit PIN for storage. Never store the PIN itself. */
export function hashPin(pin: string): string {
  return sha256Hex(SALT + pin);
}

/** Hash a password for storage. Never store the password itself. */
export function hashPassword(password: string): string {
  return sha256Hex(SALT + "password." + password);
}

/** Hash an email for storage (lowercased + trimmed before hashing). */
export function hashEmail(email: string): string {
  return sha256Hex(SALT + "email." + normalizeEmail(email));
}

/** Lowercase + trim an email so comparisons are case-insensitive. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** True for a plausible email address. */
export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** True when the password is long enough (min 4, like the PIN). */
export function isPassword(value: string): boolean {
  return value.length >= 4 && value.length <= 128;
}

/** True for a well-formed stored hash (64 lowercase hex chars). */
export function isPasswordHash(value: string | null | undefined): value is string {
  return isPinHash(value);
}

/** True for a well-formed stored hash (64 lowercase hex chars). */
export function isPinHash(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

/** True when the input is exactly four ASCII digits. */
export function isFourDigitPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

/**
 * Verify a PIN against a stored hash. Both sides are fixed-length hex, so a
 * byte-wise XOR diff gives a constant-time-ish comparison (no early exit).
 */
export function verifyPin(pin: string, hash: string): boolean {
  if (!isPinHash(hash)) return false;
  const candidate = hashPin(pin);
  let diff = 0;
  for (let i = 0; i < candidate.length; i++) {
    diff |= candidate.charCodeAt(i) ^ hash.charCodeAt(i);
  }
  return diff === 0;
}

/** True when the stored hash belongs to the pre-created test account. */
export function isTestPinHash(hash: string): boolean {
  return isPinHash(hash) && verifyPin(TEST_PIN, hash);
}

/** True when the password hash belongs to the test account. */
export function isTestPasswordHash(hash: string): boolean {
  return isPasswordHash(hash) && verifyPassword(TEST_PASSWORD, hash);
}

/** True when the email matches the test account email. */
export function isTestEmail(email: string): boolean {
  return normalizeEmail(email) === TEST_EMAIL;
}

/**
 * Verify a password against a stored hash. Same constant-time-ish comparison
 * as the PIN (fixed-length hex, XOR diff, no early exit).
 */
export function verifyPassword(password: string, hash: string): boolean {
  if (!isPasswordHash(hash)) return false;
  const candidate = hashPassword(password);
  let diff = 0;
  for (let i = 0; i < candidate.length; i++) {
    diff |= candidate.charCodeAt(i) ^ hash.charCodeAt(i);
  }
  return diff === 0;
}

/** Compare an entered email against the stored (normalized) email. */
export function verifyEmail(email: string, storedEmail: string): boolean {
  return normalizeEmail(email) === normalizeEmail(storedEmail);
}
