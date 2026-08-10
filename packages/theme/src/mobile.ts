/**
 * Mobile (React Native) color palette — derived from the shared tokens.
 *
 * RN cannot consume CSS variables, so this maps the light theme (mobile is
 * light-only today) onto the `colors` object shape used across the app's
 * screens. Change a token in tokens.ts and the mobile app updates too.
 */
import { theme } from "./tokens.js";

export const mobileColors = {
  bg: theme.light.background,
  card: theme.light.card,
  text: theme.light.foreground,
  muted: theme.light.mutedForeground,
  border: theme.light.border,
  primary: theme.light.primary,
  /** Text/icon color placed on top of `primary`. */
  onPrimary: theme.light.primaryForeground,
  success: theme.light.success,
  danger: theme.light.destructive,
  warning: theme.light.warning,
  /** Light tint backgrounds for badges / chips (light mode only). */
  successSoft: "#d1fae5",
  warningSoft: "#fef3c7",
  dangerSoft: "#fee2e2",
  mutedSoft: theme.light.border,
  inputPlaceholder: "#9aa1ac",
} as const;

export type MobileColors = typeof mobileColors;
