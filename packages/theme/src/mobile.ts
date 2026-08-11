/**
 * Mobile (React Native) color palette — derived from the shared tokens.
 *
 * RN cannot consume CSS variables, so this maps the theme tokens (light AND
 * dark — the same values web/desktop use) onto the `colors` object shape used
 * across the app's screens. `mobileColorsFor(mode, themeName)` returns the
 * palette for a theme (default "apple"); change a token in tokens.ts and the
 * mobile app updates too.
 */
import { themes, type ThemeMode, type ThemeName } from "./tokens.js";

export interface MobileColors {
  bg: string;
  card: string;
  text: string;
  muted: string;
  /** Muted BACKGROUND (tokens `muted`) — for pressed/hover fills. Distinct
   *  from `muted`, which is the muted FOREGROUND text color. */
  mutedBg: string;
  border: string;
  primary: string;
  accent: string;
  accentForeground: string;
  /** Text/icon color placed on top of `primary`. */
  onPrimary: string;
  success: string;
  danger: string;
  warning: string;
  /** Tinted backgrounds for badges / chips (mode-appropriate). */
  successSoft: string;
  warningSoft: string;
  dangerSoft: string;
  mutedSoft: string;
  inputPlaceholder: string;
}

/** Maps the shared tokens for a given mode + theme onto the mobile palette. */
export function mobileColorsFor(mode: ThemeMode, themeName: ThemeName = "apple"): MobileColors {
  const t = themes[themeName]?.[mode] ?? themes.apple[mode];
  const softIsDark = mode === "dark";
  return {
    bg: t.background,
    card: t.card,
    text: t.foreground,
    muted: t.mutedForeground,
    mutedBg: t.muted,
    border: t.border,
    primary: t.primary,
    accent: t.accent,
    accentForeground: t.accentForeground,
    onPrimary: t.primaryForeground,
    success: t.success,
    danger: t.destructive,
    warning: t.warning,
    // Dark tints are low-luminance versions of the status hues.
    successSoft: softIsDark ? "#0f3327" : "#d1fae5",
    warningSoft: softIsDark ? "#3a2d11" : "#fef3c7",
    dangerSoft: softIsDark ? "#401418" : "#fee2e2",
    mutedSoft: t.border,
    inputPlaceholder: softIsDark ? "#6f6d68" : "#9aa1ac",
  };
}

/** Light palette — kept for back-compat; use `mobileColorsFor(mode, theme)` for theming. */
export const mobileColors: MobileColors = mobileColorsFor("light", "apple");
