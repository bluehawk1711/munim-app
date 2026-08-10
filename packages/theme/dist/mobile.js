/**
 * Mobile (React Native) color palette — derived from the shared tokens.
 *
 * RN cannot consume CSS variables, so this maps the theme tokens (light AND
 * dark — the same values web/desktop use) onto the `colors` object shape used
 * across the app's screens. Change a token in tokens.ts and the mobile app
 * updates too.
 */
import { theme } from "./tokens.js";
/** Maps the shared tokens for a given mode onto the mobile palette. */
export function mobileColorsFor(mode) {
    const t = theme[mode];
    return {
        bg: t.background,
        card: t.card,
        text: t.foreground,
        muted: t.mutedForeground,
        border: t.border,
        primary: t.primary,
        accent: t.accent,
        accentForeground: t.accentForeground,
        onPrimary: t.primaryForeground,
        success: t.success,
        danger: t.destructive,
        warning: t.warning,
        // Dark tints are low-luminance versions of the status hues.
        successSoft: mode === "dark" ? "#0f3327" : "#d1fae5",
        warningSoft: mode === "dark" ? "#3a2d11" : "#fef3c7",
        dangerSoft: mode === "dark" ? "#401418" : "#fee2e2",
        mutedSoft: t.border,
        inputPlaceholder: mode === "dark" ? "#6f6d68" : "#9aa1ac",
    };
}
/** Light palette — kept for back-compat; use `mobileColorsFor(mode)` for theming. */
export const mobileColors = mobileColorsFor("light");
//# sourceMappingURL=mobile.js.map