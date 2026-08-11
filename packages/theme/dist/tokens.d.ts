/**
 * @munim/theme tokens — THE single source of truth for every Munim app.
 *
 * Edit this file, then run `pnpm --filter @munim/theme build` and every app
 * picks up the change:
 *   - web + desktop  consume `dist/tokens.css` (CSS custom properties, one
 *                    `[data-theme="…"]` block per theme)
 *   - mobile         consumes `mobileColorsFor(mode, themeName)`
 *
 * Five themes ship out of the box. "apple" is the default (warm silver/gold);
 * the others are curated alternatives (cool ocean blues, forest greens,
 * rose pinks, midnight indigo). All values are hex so every platform can use
 * them — the mobile color parser rejects oklch.
 */
export declare const radius = "0.75rem";
export interface ThemeTokens {
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    popover: string;
    popoverForeground: string;
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    muted: string;
    mutedForeground: string;
    accent: string;
    accentForeground: string;
    destructive: string;
    destructiveForeground: string;
    border: string;
    input: string;
    ring: string;
    /** Positive status (paid, stock-in, etc.) — shared so all apps can use it. */
    success: string;
    /** Pending/partial status. */
    warning: string;
    chart1: string;
    chart2: string;
    chart3: string;
    chart4: string;
    chart5: string;
    sidebar: string;
    sidebarForeground: string;
    sidebarPrimary: string;
    sidebarPrimaryForeground: string;
    sidebarAccent: string;
    sidebarAccentForeground: string;
    sidebarBorder: string;
    sidebarRing: string;
}
export type ThemeMode = "light" | "dark";
export interface Theme {
    light: ThemeTokens;
    dark: ThemeTokens;
}
export type ThemeName = "apple" | "ocean" | "forest" | "rose" | "midnight";
export declare const themeNames: ThemeName[];
export declare const themeLabels: Record<ThemeName, string>;
/** Two-tone swatch used by the theme pickers (primary + accent). */
export declare const themeSwatches: Record<ThemeName, [string, string]>;
/** Back-compat alias — the default theme. */
export declare const theme: Theme;
export declare const themes: Record<ThemeName, Theme>;
//# sourceMappingURL=tokens.d.ts.map