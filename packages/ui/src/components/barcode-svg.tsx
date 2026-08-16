"use client"

/**
 * BarcodeSvg — renders the SHARED barcode SVG string produced by
 * `@munim/core`'s `barcodeSvg()` (EAN-13 / Code 39). Used by web + desktop so
 * both apps show the exact same scannable bars; mobile renders the same SVG
 * string via react-native-svg's SvgXml.
 */
import * as React from "react";
import { barcodeSvg } from "@munim/core";
import { cn } from "../lib/utils";

export function BarcodeSvg({
  value,
  height = 36,
  scale = 1,
  className,
}: {
  /** The barcode value (13-digit EAN-13 or any Code-39-safe string). */
  value: string;
  height?: number;
  scale?: number;
  className?: string;
}) {
  const svg = React.useMemo(
    () => (value.trim() ? barcodeSvg(value, { height, scale, fontSize: 9 }) : null),
    [value, height, scale],
  );

  if (!svg) return null;
  return (
    <span
      className={cn("inline-flex items-center leading-none", className)}
      title={value}
      aria-label={`Barcode ${value}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
