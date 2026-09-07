/**
 * Mobile (React Native) color palette — derived from the shared tokens.
 *
 * RN cannot consume CSS variables, so this maps the theme tokens (light AND
 * dark — the same values web/desktop use) onto the `colors` object shape used
 * across the app's screens. `mobileColorsFor(mode, themeName)` returns the
 * palette for a theme (default "apple"); change a token in tokens.ts and the
 * mobile app updates too.
 */
import { type ThemeMode, type ThemeName } from "./tokens.js";
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
    /** Always-dark surface (camera overlays, image placeholders) + the light
     *  content that sits on it — constant across modes by design. */
    inverseSurface: string;
    inverseOnSurface: string;
    /** Modal/backdrop scrim — same value web uses (`bg-black/50`), both modes. */
    overlay: string;
    /** Skeleton shimmer sheen — a translucent white sweep, tuned per mode. */
    shimmerSweep: string;
    /** Chart palette (tokens `chart1`–`chart5`) — for SVG charts on Home,
     *  Reports, etc. Mode-appropriate, so they stay legible in dark mode. */
    chart1: string;
    chart2: string;
    chart3: string;
    chart4: string;
    chart5: string;
}
/** Maps the shared tokens for a given mode + theme onto the mobile palette. */
export declare function mobileColorsFor(mode: ThemeMode, themeName?: ThemeName): MobileColors;
/** Light palette — kept for back-compat; use `mobileColorsFor(mode, theme)` for theming. */
export declare const mobileColors: MobileColors;
//# sourceMappingURL=mobile.d.ts.map