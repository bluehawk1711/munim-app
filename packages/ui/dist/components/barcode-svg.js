"use client";
import { jsx as _jsx } from "react/jsx-runtime";
/**
 * BarcodeSvg — renders the SHARED barcode SVG string produced by
 * `@munim/core`'s `barcodeSvg()` (EAN-13 / Code 39). Used by web + desktop so
 * both apps show the exact same scannable bars; mobile renders the same SVG
 * string via react-native-svg's SvgXml.
 */
import * as React from "react";
import { barcodeSvg } from "@munim/core";
import { cn } from "../lib/utils";
export function BarcodeSvg({ value, height = 36, scale = 1, className, }) {
    const svg = React.useMemo(() => (value.trim() ? barcodeSvg(value, { height, scale, fontSize: 9 }) : null), [value, height, scale]);
    if (!svg)
        return null;
    return (_jsx("span", { className: cn("inline-flex items-center leading-none", className), title: value, "aria-label": `Barcode ${value}`, dangerouslySetInnerHTML: { __html: svg } }));
}
//# sourceMappingURL=barcode-svg.js.map