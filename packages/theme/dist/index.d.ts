/**
 * @munim/theme — shared design tokens for the munim monorepo.
 *
 * One source of truth (`src/tokens.ts`) that drives all 3 apps:
 *  - web + desktop import `@munim/theme/tokens.css` (generated CSS variables,
 *    one `[data-theme="…"]` block per theme)
 *  - mobile imports `mobileColorsFor(mode, themeName)` (React Native palette)
 */
export { theme, radius, themes, themeNames, themeLabels, themeSwatches } from "./tokens.js";
export type { Theme, ThemeMode, ThemeName, ThemeTokens } from "./tokens.js";
export { mobileColors, mobileColorsFor } from "./mobile.js";
export type { MobileColors } from "./mobile.js";
//# sourceMappingURL=index.d.ts.map