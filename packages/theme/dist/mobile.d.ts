/**
 * Mobile (React Native) color palette — derived from the shared tokens.
 *
 * RN cannot consume CSS variables, so this maps the theme tokens (light AND
 * dark — the same values web/desktop use) onto the `colors` object shape used
 * across the app's screens. Change a token in tokens.ts and the mobile app
 * updates too.
 */
import { type ThemeMode } from "./tokens.js";
export interface MobileColors {
    bg: string;
    card: string;
    text: string;
    muted: string;
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
/** Maps the shared tokens for a given mode onto the mobile palette. */
export declare function mobileColorsFor(mode: ThemeMode): MobileColors;
/** Light palette — kept for back-compat; use `mobileColorsFor(mode)` for theming. */
export declare const mobileColors: MobileColors;
//# sourceMappingURL=mobile.d.ts.map