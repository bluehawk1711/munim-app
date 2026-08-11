import * as React from "react";
import { type ThemeName } from "@munim/theme";
/**
 * Apple-style theme swatch row — shared by web + desktop (both import from
 * @munim/ui). Circles show each theme's primary/accent duo; the selected one
 * gets a springy ring + check. `compact` shows only swatches (topbar),
 * otherwise labels are shown (Settings).
 *
 * Theme state lives in the app (web: `useAccentTheme` in theme-picker.tsx;
 * desktop: `useAccentTheme` in theme-swatches.tsx) — this component is purely
 * presentational so a new theme never requires editing two copies.
 */
export declare function ThemeSwatches({ value, onChange, compact, }: {
    value: ThemeName;
    onChange: (t: ThemeName) => void;
    compact?: boolean;
}): React.JSX.Element;
//# sourceMappingURL=theme-swatches.d.ts.map