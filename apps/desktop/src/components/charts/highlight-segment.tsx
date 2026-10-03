"use client";

import { type MotionValue, motion } from "motion/react";
import { type RefObject, useEffect, useId, useState } from "react";

// Hover-highlight overlay: re-strokes the base path `d`, clipped to a vertical
// band whose x/width spring to track the hovered point, so only the segment
// around the dot shows brighter. The band comes from `useHighlightSegment`;
// because the bright stroke reuses the base `d`, it follows whatever curve is
// drawn (see `highlight-segment-bounds.ts` for the band-extent caveat).

export interface HighlightSegmentProps {
  /** Ref to the rendered base stroke `<path>` — its `d` is re-used verbatim. */
  pathRef: RefObject<SVGPathElement | null>;
  /** Whether to render (caller gates on showHighlight + active + loaded). */
  visible: boolean;
  stroke: string;
  strokeWidth: number;
  /** Plot height — the clip band spans it fully. */
  height: number;
  /** Spring-eased left edge of the clip band (px). */
  x: MotionValue<number>;
  /** Spring-eased width of the clip band (px). */
  width: MotionValue<number>;
}

export function HighlightSegment({
  pathRef,
  visible,
  stroke,
  strokeWidth,
  height,
  x,
  width,
}: HighlightSegmentProps) {
  const clipId = useId();
  const [baseD, setBaseD] = useState("");
  // Re-read the base path's `d` after every render: it changes with animation
  // and data independently of any hook dep, and the same string re-read bails
  // out via Object.is — no update chain is possible.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  useEffect(() => {
    setBaseD(pathRef.current?.getAttribute("d") ?? "");
  });
  if (!(visible && baseD)) {
    return null;
  }
  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <motion.rect height={height} width={width} x={x} y={0} />
        </clipPath>
      </defs>
      <motion.path
        animate={{ opacity: 1 }}
        clipPath={`url(#${clipId})`}
        d={baseD}
        exit={{ opacity: 0 }}
        fill="none"
        initial={{ opacity: 0 }}
        stroke={stroke}
        strokeLinecap="round"
        strokeWidth={strokeWidth}
        transition={{ duration: 0.4, ease: "easeInOut" }}
      />
    </>
  );
}

HighlightSegment.displayName = "HighlightSegment";

export default HighlightSegment;
