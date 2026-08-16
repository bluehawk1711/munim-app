"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSyncExternalStore } from "react";
import { CheckCircle2, InfoIcon, OctagonXIcon, TriangleAlertIcon, XIcon, } from "lucide-react";
import { cn } from "../lib/utils.js";
let nextId = 1;
let toasts = [];
const listeners = new Set();
function emit() {
    listeners.forEach((l) => l());
}
function subscribe(cb) {
    listeners.add(cb);
    return () => {
        listeners.delete(cb);
    };
}
function getSnapshot() {
    return toasts;
}
export function dismissToast(id) {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
}
function push(type, title, opts) {
    const id = nextId++;
    toasts = [
        ...toasts,
        {
            id,
            type,
            title,
            description: opts?.description,
            duration: opts?.duration ?? 4000,
        },
    ];
    emit();
    const item = toasts.find((t) => t.id === id);
    if (item && item.duration > 0) {
        setTimeout(() => dismissToast(id), item.duration);
    }
    return id;
}
export const toast = {
    success: (title, opts) => push("success", title, opts),
    error: (title, opts) => push("error", title, opts),
    info: (title, opts) => push("info", title, opts),
    warning: (title, opts) => push("warning", title, opts),
    dismiss: dismissToast,
};
const POSITION_CLASSES = {
    "top-right": "top-4 right-4 items-end",
    "top-left": "top-4 left-4 items-start",
    "top-center": "top-4 left-1/2 -translate-x-1/2 items-center",
    "bottom-right": "right-4 bottom-4 items-end",
    "bottom-left": "bottom-4 left-4 items-start",
    "bottom-center": "bottom-4 left-1/2 -translate-x-1/2 items-center",
};
const TYPE_META = {
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
};
export function Toaster({ position = "bottom-right", richColors = false, closeButton = false, className, }) {
    // Third arg (getServerSnapshot) is required by Next.js RSC — the store is
    // always empty on the server, matching the client's initial state.
    const items = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    return (_jsx("div", { role: "region", "aria-label": "Notifications", "aria-live": "polite", className: cn("pointer-events-none fixed z-[9999] flex w-full max-w-sm flex-col gap-2 px-4", POSITION_CLASSES[position], className), children: items.map((t) => {
            const meta = TYPE_META[t.type];
            const Icon = meta.icon;
            return (_jsxs("div", { role: "status", className: cn("bg-popover text-popover-foreground animate-in fade-in-0 zoom-in-95 flex w-full items-start gap-2.5 rounded-lg border p-3 shadow-lg", position.startsWith("bottom") && "slide-in-from-bottom-2", position.startsWith("top") && "slide-in-from-top-2", richColors && meta.richClass), children: [_jsx(Icon, { className: cn("mt-0.5 size-4 shrink-0", meta.iconClass), "aria-hidden": "true" }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "text-sm leading-snug font-medium", children: t.title }), t.description ? (_jsx("p", { className: "text-muted-foreground mt-0.5 text-xs leading-relaxed", children: t.description })) : null] }), closeButton ? (_jsx("button", { type: "button", onClick: () => dismissToast(t.id), "aria-label": "Dismiss notification", className: "text-muted-foreground hover:text-foreground -m-1 cursor-pointer rounded p-1 transition-colors", children: _jsx(XIcon, { className: "size-3.5" }) })) : null] }, t.id));
        }) }));
}
//# sourceMappingURL=sonner.js.map