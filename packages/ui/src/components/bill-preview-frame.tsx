"use client";

/**
 * BillPreviewFrame — scaled A4 iframe of the shared bill HTML
 * (`renderBillHtml`, the same markup mobile prints). Web and desktop show the
 * same live preview; `fit="width"` fills a card, `fit="contain"` fits the whole
 * sheet into a dialog. Clickable when `onClick` is given (Enter/Space too).
 */
import * as React from "react";

/** A4 render size at 96dpi — the bill HTML sizes itself in mm, so this box
 *  matches the printed page exactly (794 × 1123 px). */
const BILL_PX = { w: 794, h: 1123 };

export function BillPreviewFrame({
  html,
  fit = "width",
  onClick,
}: {
  html: string;
  fit?: "width" | "contain";
  onClick?: () => void;
}) {
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = React.useState(0.45);
  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const s =
        fit === "contain"
          ? Math.min(el.clientWidth / BILL_PX.w, el.clientHeight / BILL_PX.h)
          : el.clientWidth / BILL_PX.w;
      setScale(s > 0 ? s : 0.1);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit, html]);

  const contain = fit === "contain";
  const frame = (
    <iframe
      title="Bill preview"
      srcDoc={html}
      scrolling="no"
      className={
        contain
          ? "pointer-events-none absolute left-1/2 top-1/2 origin-center border-0"
          : "pointer-events-none absolute left-0 top-0 origin-top-left border-0"
      }
      style={{
        width: BILL_PX.w,
        height: BILL_PX.h,
        transform: contain ? `translate(-50%, -50%) scale(${scale})` : `scale(${scale})`,
      }}
    />
  );

  const boxCls = [
    contain ? "relative h-full w-full" : "relative block aspect-[210/297] w-full",
    "overflow-hidden rounded-lg border bg-white",
    onClick ? "cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" : "",
  ].join(" ");

  if (!onClick) {
    return (
      <div ref={wrapRef} className={boxCls}>
        {frame}
      </div>
    );
  }
  return (
    <div
      ref={wrapRef}
      role="button"
      tabIndex={0}
      aria-label="Enlarge bill preview"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={boxCls}
    >
      {frame}
    </div>
  );
}
