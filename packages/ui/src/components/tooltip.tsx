"use client"

/**
 * Tooltip — one small wrapper over Radix so icon-only buttons can carry a
 * label across web + desktop. Each tooltip owns its provider (there are only
 * a handful of icon buttons per screen), so apps never need extra wiring.
 */
import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "../lib/utils.js"

export function TooltipContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "bg-popover text-popover-foreground z-[10000] overflow-hidden rounded-md border px-2.5 py-1 text-xs font-medium shadow-md select-none",
          className
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  )
}

export function Tooltip({
  label,
  children,
  side = "top",
  align = "center",
  delayDuration = 250,
}: {
  label: React.ReactNode
  children: React.ReactElement
  side?: React.ComponentProps<typeof TooltipPrimitive.Content>["side"]
  align?: React.ComponentProps<typeof TooltipPrimitive.Content>["align"]
  delayDuration?: number
}) {
  if (!label) return children
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipContent side={side} align={align}>
          {label}
        </TooltipContent>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}
