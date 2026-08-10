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
export const radius = "0.75rem";
export const theme = {
    light: {
        background: "#fcfbf8",
        foreground: "#0c0b09",
        card: "#ffffff",
        cardForeground: "#0c0b09",
        popover: "#ffffff",
        popoverForeground: "#0c0b09",
        primary: "#846324",
        primaryForeground: "#f9f8f7",
        secondary: "#f3f0eb",
        secondaryForeground: "#24211d",
        muted: "#f5f2ee",
        mutedForeground: "#7f7971",
        accent: "#f7e9d6",
        accentForeground: "#4a371b",
        destructive: "#e7000b",
        destructiveForeground: "#fafafa",
        border: "#e6e2dd",
        input: "#e6e2dd",
        ring: "#846324",
        success: "#059669",
        warning: "#d97706",
        chart1: "#9c7a3d",
        chart2: "#387e82",
        chart3: "#ca933e",
        chart4: "#d37040",
        chart5: "#d6455a",
        sidebar: "#fbfaf9",
        sidebarForeground: "#13110f",
        sidebarPrimary: "#846324",
        sidebarPrimaryForeground: "#f9f8f7",
        sidebarAccent: "#f7e9d6",
        sidebarAccentForeground: "#4a371b",
        sidebarBorder: "#e6e2dd",
        sidebarRing: "#846324",
    },
    dark: {
        background: "#080705",
        foreground: "#edebe7",
        card: "#13110e",
        cardForeground: "#edebe7",
        popover: "#13110e",
        popoverForeground: "#edebe7",
        primary: "#b69255",
        primaryForeground: "#0c0b09",
        secondary: "#24211d",
        secondaryForeground: "#edebe7",
        muted: "#23211e",
        mutedForeground: "#a29e98",
        accent: "#372c1d",
        accentForeground: "#f2daba",
        destructive: "#ff6467",
        destructiveForeground: "#fafafa",
        border: "#2b2825",
        input: "#2b2825",
        ring: "#b69255",
        success: "#34d399",
        warning: "#fbbf24",
        chart1: "#b69255",
        chart2: "#4e9397",
        chart3: "#d79f4c",
        chart4: "#e57f4f",
        chart5: "#e45366",
        sidebar: "#0e0d0b",
        sidebarForeground: "#edebe7",
        sidebarPrimary: "#b69255",
        sidebarPrimaryForeground: "#0c0b09",
        sidebarAccent: "#2f281e",
        sidebarAccentForeground: "#f2daba",
        sidebarBorder: "#24211d",
        sidebarRing: "#b69255",
    },
};
//# sourceMappingURL=tokens.js.map