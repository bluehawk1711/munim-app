/**
 * Shared bill template options — the exact same controls in the web and
 * desktop bill forms, so the two apps stay seamless: template (Classic
 * Jewellery / Modern E-commerce), classic accent color (red / yellow with a
 * swatch), the 2-in-1 toggle and its Duplicate / Separate mode select, plus
 * the per-bill display toggles (Weight column, rate rows, gold-rate karat
 * line with its show/source/custom-text options, Chejat/Nag signs).
 *
 * `karatPicker` opts the caller into the extra "Pick a karat…" source — a
 * second dropdown (24K…9K) that prints the chosen karat under the gold rate
 * even when neither the product nor the shop has one set. Off by default so
 * existing callers keep the original four sources unchanged.
 *
 * Purely presentational — callers own state and can add their own toasts on
 * change (web + desktop both use sonner).
 */
import * as React from "react";
import type { BillTemplate, BillClassicColor, BillMode, GoldRateKaratMode } from "@munim/core";
export type { BillTemplate, BillClassicColor, BillMode, BillTemplateSettings, GoldRateKaratMode } from "@munim/core";
export declare function BillTemplateOptions({ template, classicColor, twoInOne, mode, weightAfterName, goldRateLine, silverRateLine, signSuffix, goldRateKaratMode, goldRateKaratText, karatPicker, goldRateKaratValue, onGoldRateKaratValue, onTemplate, onClassicColor, onTwoInOne, onMode, onWeightAfterName, onGoldRateLine, onSilverRateLine, onSignSuffix, onGoldRateKaratMode, onGoldRateKaratText, className, }: {
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
    /** Show the extra "Pick a karat…" source + its 24K…9K dropdown. */
    karatPicker?: boolean;
    /** Picked karat (1–24) for mode "karat" — defaults to 22 when unset. */
    goldRateKaratValue?: number;
    onGoldRateKaratValue?: (v: number) => void;
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