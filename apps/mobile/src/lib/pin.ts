/**
 * Mobile PIN lock — storage + operations for the 4-digit app lock.
 *
 * Mirrors the web/desktop gate (packages/ui pin-gate.tsx) with the same rules:
 *   - absent    → first launch → the TEST account (PIN 1234) is pre-created
 *   - "0"       → lock disabled
 *   - 64-char hash → lock enabled (SHA-256(salt + pin), via @munim/core)
 *
 * Per-device by design (like a banking-app lock): stored in AsyncStorage,
 * works offline, never touches the shared database.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  TEST_PIN,
  hashPin,
  isFourDigitPin,
  isPinHash,
  isTestPinHash,
  verifyPin,
} from '@munim/core';

const STORAGE_KEY = 'munim.pin';
const DISABLED = '0';

export type PinStatus = 'loading' | 'locked' | 'unlocked';

export type PinSnapshot = {
  status: PinStatus;
  /** True while the lock is PERSISTED-enabled — independent of the session
   *  (after a successful unlock, status is "unlocked" but lockEnabled stays
   *  true). Settings reads this, not status. */
  lockEnabled: boolean;
  isTestAccount: boolean;
};

export async function getStoredPin(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

async function setStoredPin(value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Storage unavailable — the lock still works for this session.
  }
}

/** First-launch bootstrap: pre-creates the test account (PIN 1234). */
export async function initializePin(): Promise<PinSnapshot> {
  let stored = await getStoredPin();
  if (stored === null) {
    stored = hashPin(TEST_PIN);
    await setStoredPin(stored);
    return {status: 'locked', lockEnabled: true, isTestAccount: true};
  }
  if (stored === DISABLED) return {status: 'unlocked', lockEnabled: false, isTestAccount: false};
  if (isPinHash(stored)) {
    return {status: 'locked', lockEnabled: true, isTestAccount: isTestPinHash(stored)};
  }
  // Corrupt value → recreate the test account.
  await setStoredPin(hashPin(TEST_PIN));
  return {status: 'locked', lockEnabled: true, isTestAccount: true};
}

export async function unlockPin(pin: string): Promise<boolean> {
  const stored = await getStoredPin();
  if (stored === null || stored === DISABLED || !isPinHash(stored)) return false;
  return verifyPin(pin, stored);
}

/** Change the PIN. Returns an error message, or null on success. */
export async function changePin(current: string, next: string): Promise<string | null> {
  if (!isFourDigitPin(next)) return 'New PIN must be exactly 4 digits.';
  const stored = await getStoredPin();
  if (stored === null || stored === DISABLED || !isPinHash(stored) || !verifyPin(current, stored)) {
    return 'Current PIN is incorrect.';
  }
  await setStoredPin(hashPin(next));
  return null;
}

/** Turn the lock off (requires the current PIN). Returns error or null. */
export async function disablePin(current: string): Promise<string | null> {
  const stored = await getStoredPin();
  if (stored === null || stored === DISABLED || !isPinHash(stored) || !verifyPin(current, stored)) {
    return 'Current PIN is incorrect.';
  }
  await setStoredPin(DISABLED);
  return null;
}

/** Turn the lock on with a new PIN (does not lock this session). */
export async function enablePin(next: string): Promise<string | null> {
  if (!isFourDigitPin(next)) return 'PIN must be exactly 4 digits.';
  await setStoredPin(hashPin(next));
  return null;
}

/** Reset to the test account (1234) — the documented recovery path. */
export async function resetPinToTest(): Promise<PinSnapshot> {
  await setStoredPin(hashPin(TEST_PIN));
  return {status: 'unlocked', lockEnabled: true, isTestAccount: true};
}
