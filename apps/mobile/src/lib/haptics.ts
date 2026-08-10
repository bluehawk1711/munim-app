/**
 * Haptics helpers — thin, safe wrappers over expo-haptics.
 *
 * All calls swallow errors (no-ops on unsupported platforms / simulators
 * without haptics), so screens can fire feedback without guards.
 */
import * as Haptics from 'expo-haptics';

/** Subtle tick — iOS-style tab selection / generic list-row tap. */
export function selectionTick() {
  Haptics.selectionAsync().catch(() => {});
}

/** Slightly stronger press — opening a section / navigation push. */
export function sectionPress() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
