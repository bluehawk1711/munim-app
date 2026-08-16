/**
 * "Force animation play" preference (mobile).
 *
 * The mobile ThemeToggleButton respects `prefers-reduced-motion` (via
 * reanimated's useReducedMotion) and skips its sun/moon spin. This flag lets
 * the user opt OUT of that from Settings, so the animation plays even when
 * the OS has reduced motion on.
 *
 * Device-local on purpose (AsyncStorage): it overrides the OS animation
 * preference of THIS device, so it is NOT mirrored to the shared DB settings
 * row like theme/mode are. Mirrors the haptics.ts store pattern.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'munim.forceThemeTransition';

let enabled = false;

/** Restore the persisted preference (call once at app start). */
export async function loadForceTransition(): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    enabled = stored === '1';
  } catch {
    enabled = false;
  }
  return enabled;
}

/** Current in-memory preference (synchronous — safe to read from renders). */
export function isForceTransitionEnabled(): boolean {
  return enabled;
}

/** Persist a new preference; applies immediately to all future calls. */
export async function setForceTransitionEnabled(value: boolean): Promise<void> {
  enabled = value;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  } catch {
    // Storage unavailable — the preference still applies for this session.
  }
}
