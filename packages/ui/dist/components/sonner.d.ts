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
import * as React from "react";
export type ToastType = "success" | "error" | "info" | "warning";
export type ToastOptions = {
    /** Secondary line under the title (e.g. an error message or invoice no). */
    description?: string;
    /** Milliseconds before auto-dismiss. Default 4000. */
    duration?: number;
};
export declare function dismissToast(id: number): void;
export declare const toast: {
    success: (title: string, opts?: ToastOptions) => number;
    error: (title: string, opts?: ToastOptions) => number;
    info: (title: string, opts?: ToastOptions) => number;
    warning: (title: string, opts?: ToastOptions) => number;
    dismiss: typeof dismissToast;
};
export type ToasterPosition = "top-right" | "top-left" | "top-center" | "bottom-right" | "bottom-left" | "bottom-center";
export declare function Toaster({ position, richColors, closeButton, className, }: {
    position?: ToasterPosition;
    richColors?: boolean;
    closeButton?: boolean;
    className?: string;
}): React.JSX.Element;
//# sourceMappingURL=sonner.d.ts.map