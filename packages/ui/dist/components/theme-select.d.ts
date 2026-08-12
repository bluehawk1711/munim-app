/**
 * Compact theme picker — a normal shadcn Select with a color swatch on the
 * left and the theme label on the right. Shared by web + desktop for the
 * header and Settings so both platforms look identical and stay compact.
 *
 * Uses the same token sources as ThemeSwatches (@munim/theme), so a new theme
 * never requires touching this component.
 */
import * as React from "react";
import { type ThemeName } from "@munim/theme";
export declare function ThemeSelect({ value, onChange, className, }: {
    value: ThemeName;
    onChange: (t: ThemeName) => void;
    className?: string;
}): React.JSX.Element;
//# sourceMappingURL=theme-select.d.ts.map