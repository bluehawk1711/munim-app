/**
 * Shared bill template options — the exact same controls in the web and
 * desktop bill forms, so the two apps stay seamless: template (Classic
 * Jewellery / Modern E-commerce), classic accent color (red / yellow with a
 * swatch), the 2-in-1 toggle and its Duplicate / Separate mode select.
 *
 * Purely presentational — callers own state and can add their own toasts on
 * change (web + desktop both use sonner).
 */
import * as React from "react";
export type BillTemplate = "jewellery" | "ecommerce";
export type BillClassicColor = "red" | "yellow";
export type BillMode = "duplicate" | "distinct";
export declare function BillTemplateOptions({ template, classicColor, twoInOne, mode, onTemplate, onClassicColor, onTwoInOne, onMode, className, }: {
    template: BillTemplate;
    classicColor: BillClassicColor;
    twoInOne: boolean;
    mode: BillMode;
    onTemplate: (t: BillTemplate) => void;
    onClassicColor: (c: BillClassicColor) => void;
    onTwoInOne: (on: boolean) => void;
    onMode: (m: BillMode) => void;
    className?: string;
}): React.JSX.Element;
//# sourceMappingURL=bill-template-options.d.ts.map