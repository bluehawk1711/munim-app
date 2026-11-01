"use client";

import {
  cloneElement,
  isValidElement,
  type ReactElement,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import {
  type LegendItemData,
  LegendItemProvider,
  LegendProvider,
} from "./legend-context";

export interface LegendProps {
  /** Legend items data */
  items: LegendItemData[];
  /** Controlled hover state */
  hoveredIndex?: number | null;
  /** Hover state change callback */
  onHoverChange?: (index: number | null) => void;
  /** Title shown above the legend */
  title?: string;
  /** Title class name */
  titleClassName?: string;
  /** Container class name */
  className?: string;
  /** Children - should contain a single LegendItem that will be mapped for each item */
  children: ReactElement;
  /** Cap rendered rows; the remainder collapses into a "+N more" hint. */
  maxItems?: number;
  /** Scroll the item list inside a bounded height (keeps tall legends compact). */
  scrollable?: boolean;
  /** Max-height utility for the scroll area. Default: `max-h-36`. */
  scrollMaxHeightClassName?: string;
}

export function Legend({
  items,
  hoveredIndex: controlledHoveredIndex,
  onHoverChange,
  title,
  titleClassName = "text-sm font-semibold",
  className = "",
  children,
  maxItems,
  scrollable = false,
  scrollMaxHeightClassName = "max-h-36",
}: LegendProps) {
  const [internalHoveredIndex, setInternalHoveredIndex] = useState<
    number | null
  >(null);

  // Controlled or uncontrolled hover state
  const isControlled = controlledHoveredIndex !== undefined;
  const hoveredIndex = isControlled
    ? controlledHoveredIndex
    : internalHoveredIndex;
  const setHoveredIndex = (index: number | null) => {
    if (isControlled) {
      onHoverChange?.(index);
    } else {
      setInternalHoveredIndex(index);
    }
  };

  const contextValue = {
    items,
    hoveredIndex,
    setHoveredIndex,
  };
  const visibleItems = maxItems ? items.slice(0, maxItems) : items;
  const hiddenCount = items.length - visibleItems.length;

  return (
    <LegendProvider value={contextValue}>
      <div className={cn("legend-container flex flex-col gap-2", className)}>
        {title && (
          <h3 className={cn("mb-1 text-legend-foreground", titleClassName)}>
            {title}
          </h3>
        )}
        <div
          className={cn(
            "flex flex-col gap-2",
            scrollable && cn("overflow-y-auto pr-1", scrollMaxHeightClassName),
          )}
        >
          {visibleItems.map((item, index) => {
            const isHovered = hoveredIndex === index;
            const isFaded = hoveredIndex !== null && hoveredIndex !== index;
            const percentage = item.maxValue
              ? (item.value / item.maxValue) * 100
              : 0;

            const itemContext = {
              item,
              index,
              isHovered,
              isFaded,
              percentage,
            };

            // Clone the child element for each item
            if (isValidElement(children)) {
              return (
                <LegendItemProvider key={item.label} value={itemContext}>
                  {cloneElement(children)}
                </LegendItemProvider>
              );
            }

            return null;
          })}
        </div>
        {hiddenCount > 0 && (
          <p className="text-legend-muted-foreground text-[11px]">
            +{hiddenCount} more
          </p>
        )}
      </div>
    </LegendProvider>
  );
}

Legend.displayName = "Legend";
