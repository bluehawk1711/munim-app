/**
 * BarcodeSvg — renders the SHARED barcode SVG string produced by
 * `@munim/core`'s `barcodeSvg()` (EAN-13 / Code 39). Used by web + desktop so
 * both apps show the exact same scannable bars; mobile renders the same SVG
 * string via react-native-svg's SvgXml.
 */
import * as React from "react";
export declare function BarcodeSvg({ value, height, scale, className, }: {
    /** The barcode value (13-digit EAN-13 or any Code-39-safe string). */
    value: string;
    height?: number;
    scale?: number;
    className?: string;
}): React.JSX.Element | null;
//# sourceMappingURL=barcode-svg.d.ts.map