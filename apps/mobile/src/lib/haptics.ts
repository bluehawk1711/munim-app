/**
 * Haptics helpers — thin, safe wrappers over expo-haptics.
 *
 * All calls swallow errors (no-ops on unsupported platforms / simulators
 * without haptics), so screens can fire feedback without guards.
 *
 * Users can disable haptics from Settings — the module keeps a persisted
 * flag in AsyncStorage (`munim.hapticsEnabled`, default ON). While disabled,
 * every helper below no-ops, so callers never need to check the flag.
 */
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'munim.hapticsEnabled';

let enabled = true;

/** Restore the persisted preference (call once at app start). */
export async function loadHapticsEnabled(): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    enabled = stored !== 'false'; // absent → default ON
  } catch {
    enabled = true;
  }
  return enabled;
}

/** Current in-memory preference (synchronous — safe to read from renders). */
export function isHapticsEnabled(): boolean {
  return enabled;
}

/** Persist a new preference; applies immediately to all future calls. */
export async function setHapticsEnabled(value: boolean): Promise<void> {
  enabled = value;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
  } catch {
    // Storage unavailable — the preference still applies for this session.
  }
}

/** Subtle tick — iOS-style tab selection / generic list-row tap. */
export function selectionTick() {
  if (!enabled) return;
  Haptics.selectionAsync().catch(() => {});
}

/** Slightly stronger press — opening a section / navigation push. */
export function sectionPress() {
  if (!enabled) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Medium press — primary action buttons (sell, save, settle). */
export function actionPress() {
  if (!enabled) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** Success confirmation — after a mutation completes (iOS-style ding). */
export function successFeedback() {
  if (!enabled) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** Error / destructive confirmation — when an action fails. */
export function errorFeedback() {
  if (!enabled) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}
