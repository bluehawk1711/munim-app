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
import type { BillTemplate, BillClassicColor, BillMode } from "@munim/core";
export type { BillTemplate, BillClassicColor, BillMode, BillTemplateSettings } from "@munim/core";
export declare function BillTemplateOptions({ template, classicColor, twoInOne, mode, weightAfterName, goldRateLine, silverRateLine, onTemplate, onClassicColor, onTwoInOne, onMode, onWeightAfterName, onGoldRateLine, onSilverRateLine, className, }: {
    template: BillTemplate;
    classicColor: BillClassicColor;
    twoInOne: boolean;
    mode: BillMode;
    weightAfterName: boolean;
    goldRateLine: boolean;
    silverRateLine: boolean;
    onTemplate: (t: BillTemplate) => void;
    onClassicColor: (c: BillClassicColor) => void;
    onTwoInOne: (on: boolean) => void;
    onMode: (m: BillMode) => void;
    onWeightAfterName: (on: boolean) => void;
    onGoldRateLine: (on: boolean) => void;
    onSilverRateLine: (on: boolean) => void;
    className?: string;
}): React.JSX.Element;
//# sourceMappingURL=bill-template-options.d.ts.map