/**
 * @munim/theme tokens — THE single source of truth for every Munim app.
 *
 * Edit this file, then run `pnpm --filter @munim/theme build` and every app
 * picks up the change:
 *   - web + desktop  consume `dist/tokens.css` (CSS custom properties)
 *   - mobile         consumes `mobileColors` (React Native can't read CSS vars,
 *                    and its color parser rejects oklch — so values are hex)
 *
 * Values below are the Apple-neutral warm-silver/gold palette, converted from
 * the original oklch() definitions to hex so all three platforms can use them.
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
export declare const theme: Theme;
//# sourceMappingURL=tokens.d.ts.map