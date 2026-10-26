/**
 * Shared bill template options — the exact same controls in the web and
 * desktop bill forms, so the two apps stay seamless: template (Classic
 * Jewellery / Modern E-commerce), classic accent color (red / yellow with a
 * swatch), the 2-in-1 toggle and its Duplicate / Separate mode select, plus
 * the per-bill display toggles (Weight column, rate rows, gold-rate karat
 * line with its show/source/custom-text options, Chejat/Nag signs).
 *
 * Purely presentational — callers own state and can add their own toasts on
 * change (web + desktop both use sonner).
 */
import * as React from "react";
import type { BillTemplate, BillClassicColor, BillMode, GoldRateKaratMode } from "@munim/core";
export type { BillTemplate, BillClassicColor, BillMode, BillTemplateSettings, GoldRateKaratMode } from "@munim/core";
export declare function BillTemplateOptions({ template, classicColor, twoInOne, mode, weightAfterName, goldRateLine, silverRateLine, signSuffix, goldRateKaratMode, goldRateKaratText, onTemplate, onClassicColor, onTwoInOne, onMode, onWeightAfterName, onGoldRateLine, onSilverRateLine, onSignSuffix, onGoldRateKaratMode, onGoldRateKaratText, className, }: {
    template: BillTemplate;
    classicColor: BillClassicColor;
    twoInOne: boolean;
    mode: BillMode;
    weightAfterName: boolean;
    goldRateLine: boolean;
    silverRateLine: boolean;
    /** Chejat/Nag direction marks — ON prints "Chejat: 0.100 +" / "Nag: 0.200 −". */
    signSuffix: boolean;
    /** What prints under the gold rate row — see `GoldRateKaratMode`. */
    goldRateKaratMode: GoldRateKaratMode;
    /** Free text for mode "custom". */
    goldRateKaratText: string;
    onTemplate: (t: BillTemplate) => void;
    onClassicColor: (c: BillClassicColor) => void;
    onTwoInOne: (on: boolean) => void;
    onMode: (m: BillMode) => void;
    onWeightAfterName: (on: boolean) => void;
    onGoldRateLine: (on: boolean) => void;
    onSilverRateLine: (on: boolean) => void;
    onSignSuffix: (on: boolean) => void;
    onGoldRateKaratMode: (m: GoldRateKaratMode) => void;
    onGoldRateKaratText: (t: string) => void;
    className?: string;
}): React.JSX.Element;
//# sourceMappingURL=bill-template-options.d.ts.map