"use client"

/**
 * Self-contained toast system shared by web + desktop.
 *
 * WHY NOT sonner: sonner's `toast()` dispatches into a module-level store and
 * the <Toaster /> subscribes to that same store — so the two MUST resolve to
 * the same module instance. Under pnpm each workspace resolves its own copy
 * (peer react sets differ), and vite's dep-optimizer bundling has shipped
 * setups where the Toaster's subscription never sees the toasts, leaving
 * every `toast.error(...)` a silent no-op. Rather than fight module identity,
 * this file owns BOTH sides — a tiny module store + useSyncExternalStore — so
 * `toast()` and `<Toaster />` are literally the same module, always.
 *
 * API kept compatible with the sonner calls already in the apps:
 *   toast.success("Saved", { description: "INV-001" })
 *   toast.error("Failed", { description: err.message })
 *   toast.info("…")
 *   <Toaster position="top-right" richColors closeButton />
 */

import * as React from "react"
import { useSyncExternalStore } from "react"
import {
  CheckCircle2,
  InfoIcon,
  OctagonXIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react"

import { cn } from "../lib/utils.js"

export type ToastType = "success" | "error" | "info" | "warning"

export type ToastOptions = {
  /** Secondary line under the title (e.g. an error message or invoice no). */
  description?: string
  /** Milliseconds before auto-dismiss. Default 4000. */
  duration?: number
}

type ToastItem = {
  id: number
  type: ToastType
  title: string
  description?: string
  duration: number
}

let nextId = 1
let toasts: ToastItem[] = []
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

function getSnapshot(): ToastItem[] {
  return toasts
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

function push(type: ToastType, title: string, opts?: ToastOptions): number {
  const id = nextId++
  toasts = [
    ...toasts,
    {
      id,
      type,
      title,
      description: opts?.description,
      duration: opts?.duration ?? 4000,
    },
  ]
  emit()
  const item = toasts.find((t) => t.id === id)
  if (item && item.duration > 0) {
    setTimeout(() => dismissToast(id), item.duration)
  }
  return id
}

export const toast = {
  success: (title: string, opts?: ToastOptions) => push("success", title, opts),
  error: (title: string, opts?: ToastOptions) => push("error", title, opts),
  info: (title: string, opts?: ToastOptions) => push("info", title, opts),
  warning: (title: string, opts?: ToastOptions) => push("warning", title, opts),
  dismiss: dismissToast,
}

export type ToasterPosition =
  | "top-right"
  | "top-left"
  | "top-center"
  | "bottom-right"
  | "bottom-left"
  | "bottom-center"

const POSITION_CLASSES: Record<ToasterPosition, string> = {
  "top-right": "top-4 right-4 items-end",
  "top-left": "top-4 left-4 items-start",
  "top-center": "top-4 left-1/2 -translate-x-1/2 items-center",
  "bottom-right": "right-4 bottom-4 items-end",
  "bottom-left": "bottom-4 left-4 items-start",
  "bottom-center": "bottom-4 left-1/2 -translate-x-1/2 items-center",
}

const TYPE_META: Record<
  ToastType,
  { icon: React.ComponentType<{ className?: string }>; iconClass: string; richClass: string }
> = {
  success: {
    icon: CheckCircle2,
    iconClass: "text-emerald-500",
    richClass: "border-emerald-500/40 bg-emerald-500/10",
  },
  error: {
    icon: OctagonXIcon,
    iconClass: "text-red-500",
    richClass: "border-red-500/40 bg-red-500/10",
  },
  info: {
    icon: InfoIcon,
    iconClass: "text-sky-500",
    richClass: "border-sky-500/40 bg-sky-500/10",
  },
  warning: {
    icon: TriangleAlertIcon,
    iconClass: "text-amber-500",
    richClass: "border-amber-500/40 bg-amber-500/10",
  },
}

export function Toaster({
  position = "bottom-right",
  richColors = false,
  closeButton = false,
  className,
}: {
  position?: ToasterPosition
  richColors?: boolean
  closeButton?: boolean
  className?: string
}) {
  // Third arg (getServerSnapshot) is required by Next.js RSC — the store is
  // always empty on the server, matching the client's initial state.
  const items = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  return (
    <div
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      className={cn(
        "pointer-events-none fixed z-[9999] flex w-full max-w-sm flex-col gap-2 px-4",
        POSITION_CLASSES[position],
        className,
      )}
    >
      {items.map((t) => {
        const meta = TYPE_META[t.type]
        const Icon = meta.icon
        return (
          <div
            key={t.id}
            role="status"
            className={cn(
              "bg-popover text-popover-foreground animate-in fade-in-0 zoom-in-95 flex w-full items-start gap-2.5 rounded-lg border p-3 shadow-lg",
              position.startsWith("bottom") && "slide-in-from-bottom-2",
              position.startsWith("top") && "slide-in-from-top-2",
              richColors && meta.richClass,
            )}
          >
            <Icon className={cn("mt-0.5 size-4 shrink-0", meta.iconClass)} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-snug font-medium">{t.title}</p>
              {t.description ? (
                <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{t.description}</p>
              ) : null}
            </div>
            {closeButton ? (
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                aria-label="Dismiss notification"
                className="text-muted-foreground hover:text-foreground -m-1 cursor-pointer rounded p-1 transition-colors"
              >
                <XIcon className="size-3.5" />
              </button>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
