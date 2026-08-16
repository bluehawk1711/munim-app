/**
 * Mobile login + PIN lock — storage + operations for the app lock.
 *
 * Mirrors the web/desktop gate (packages/ui pin-gate.tsx) with the same rules:
 *   - `munim.pin`      AsyncStorage — PIN hash; absent = first launch,
 *                                       "0" = lock disabled, else a hash
 *   - `munim.email`    AsyncStorage — normalized account email
 *   - `munim.password` AsyncStorage — hashed account password
 *   - `munim.session`  AsyncStorage — "1" while unlocked (so app restarts /
 *                       refreshes don't re-prompt; clear via lockNow)
 *
 * Login is two steps: email + password first, then the 4-digit PIN. After a
 * successful full login the session flag is set, so users don't have to log in
 * again on every app restart.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  TEST_EMAIL,
  TEST_PASSWORD,
  TEST_PIN,
  hashPassword,
  hashPin,
  isFourDigitPin,
  isPassword,
  isPinHash,
  isTestPasswordHash,
  isTestPinHash,
  verifyEmail,
  verifyPassword,
  verifyPin,
} from '@munim/core';

const PIN_KEY = 'munim.pin';
const EMAIL_KEY = 'munim.email';
const PASSWORD_KEY = 'munim.password';
const SESSION_KEY = 'munim.session';
const DISABLED = '0';

export type PinStatus = 'loading' | 'locked' | 'unlocked';

export type PinSnapshot = {
  status: PinStatus;
  /** True while the lock is PERSISTED-enabled — independent of the session
   *  (after a successful unlock, status is "unlocked" but lockEnabled stays
   *  true). Settings reads this, not status. */
  lockEnabled: boolean;
  isTestAccount: boolean;
  /** Normalized account email (for display in Settings). */
  accountEmail: string;
};

async function getStored(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function setStored(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // Storage unavailable — the lock still works for this session.
  }
}

function isPasswordHash(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

/** First-launch bootstrap: pre-creates the test account (email/password/PIN). */
export async function initializePin(): Promise<PinSnapshot> {
  let stored = await getStored(PIN_KEY);
  if (stored === null) {
    stored = hashPin(TEST_PIN);
    await setStored(PIN_KEY, stored);
    await setStored(EMAIL_KEY, TEST_EMAIL);
    await setStored(PASSWORD_KEY, hashPassword(TEST_PASSWORD));
    return {status: 'locked', lockEnabled: true, isTestAccount: true, accountEmail: TEST_EMAIL};
  }
  if (stored === DISABLED) {
    return {status: 'unlocked', lockEnabled: false, isTestAccount: false, accountEmail: TEST_EMAIL};
  }
  if (isPinHash(stored)) {
    // Back-compat: seed test credentials if the email/password keys are missing.
    const email = await getStored(EMAIL_KEY);
    const pw = await getStored(PASSWORD_KEY);
    let isTest = isTestPinHash(stored);
    if (email === null || pw === null) {
      await setStored(EMAIL_KEY, TEST_EMAIL);
      await setStored(PASSWORD_KEY, hashPassword(TEST_PASSWORD));
      isTest = isTestPinHash(stored) && isTestPasswordHash(hashPassword(TEST_PASSWORD));
    } else {
      isTest = isTestPinHash(stored) && isTestPasswordHash(pw);
    }
    const session = await getStored(SESSION_KEY);
    return {
      status: session === '1' ? 'unlocked' : 'locked',
      lockEnabled: true,
      isTestAccount: isTest,
      accountEmail: (email ?? TEST_EMAIL),
    };
  }
  // Corrupt value → recreate the test account.
  await setStored(PIN_KEY, hashPin(TEST_PIN));
  await setStored(EMAIL_KEY, TEST_EMAIL);
  await setStored(PASSWORD_KEY, hashPassword(TEST_PASSWORD));
  return {status: 'locked', lockEnabled: true, isTestAccount: true, accountEmail: TEST_EMAIL};
}

/** Verify the email + password step. */
export async function verifyCredentials(email: string, password: string): Promise<boolean> {
  const [storedEmail, storedPw] = await Promise.all([
    getStored(EMAIL_KEY),
    getStored(PASSWORD_KEY),
  ]);
  if (storedEmail === null || storedPw === null || !isPasswordHash(storedPw)) return false;
  return verifyEmail(email, storedEmail) && verifyPassword(password, storedPw);
}

/** Attempt the PIN step (after credentials pass). Persists the session on success. */
export async function unlockPin(pin: string): Promise<boolean> {
  const stored = await getStored(PIN_KEY);
  if (stored === null || stored === DISABLED || !isPinHash(stored)) return false;
  if (!verifyPin(pin, stored)) return false;
  await setStored(SESSION_KEY, '1');
  return true;
}

/** Change the account password. Returns an error message, or null on success. */
export async function changePassword(current: string, next: string): Promise<string | null> {
  if (!isPassword(next)) return 'Password must be at least 4 characters.';
  const storedPw = await getStored(PASSWORD_KEY);
  if (storedPw === null || !isPasswordHash(storedPw) || !verifyPassword(current, storedPw)) {
    return 'Current password is incorrect.';
  }
  await setStored(PASSWORD_KEY, hashPassword(next));
  return null;
}

/** Change the PIN. Returns an error message, or null on success. */
export async function changePin(current: string, next: string): Promise<string | null> {
  if (!isFourDigitPin(next)) return 'New PIN must be exactly 4 digits.';
  const stored = await getStored(PIN_KEY);
  if (stored === null || stored === DISABLED || !isPinHash(stored) || !verifyPin(current, stored)) {
    return 'Current PIN is incorrect.';
  }
  await setStored(PIN_KEY, hashPin(next));
  return null;
}

/** Turn the lock off (requires the current PIN). Returns error or null. */
export async function disablePin(current: string): Promise<string | null> {
  const stored = await getStored(PIN_KEY);
  if (stored === null || stored === DISABLED || !isPinHash(stored) || !verifyPin(current, stored)) {
    return 'Current PIN is incorrect.';
  }
  await setStored(PIN_KEY, DISABLED);
  await setStored(SESSION_KEY, '0');
  return null;
}

/** Turn the lock on with a new PIN (does not lock this session). */
export async function enablePin(next: string): Promise<string | null> {
  if (!isFourDigitPin(next)) return 'PIN must be exactly 4 digits.';
  await setStored(PIN_KEY, hashPin(next));
  return null;
}

/** Reset to the test account (1234) — the documented recovery path. */
export async function resetPinToTest(): Promise<PinSnapshot> {
  await setStored(PIN_KEY, hashPin(TEST_PIN));
  await setStored(EMAIL_KEY, TEST_EMAIL);
  await setStored(PASSWORD_KEY, hashPassword(TEST_PASSWORD));
  await setStored(SESSION_KEY, '1');
  return {status: 'unlocked', lockEnabled: true, isTestAccount: true, accountEmail: TEST_EMAIL};
}

/** Clear the session and lock the app now (Settings → Log out). */
export async function lockNow(): Promise<void> {
  await setStored(SESSION_KEY, '0');
}
