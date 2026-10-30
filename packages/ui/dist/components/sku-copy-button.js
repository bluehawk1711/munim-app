"use client";
import { jsx as _jsx } from "react/jsx-runtime";
/**
 * SkuCopyButton — the shared "copy SKU" icon control (product list rows and
 * the product detail dialog, web + desktop). Shows a check + "Copied" for a
 * moment so the counter clerk gets feedback without a toast.
 */
import * as React from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "../lib/utils.js";
import { Button } from "./button.js";
import { Tooltip } from "./tooltip.js";
export function SkuCopyButton({ sku, className, label = "Copy SKU", }) {
    const [copied, setCopied] = React.useState(false);
    const timer = React.useRef(null);
    React.useEffect(() => () => {
        if (timer.current)
            clearTimeout(timer.current);
    }, []);
    if (!sku)
        return null;
    const value = sku;
    async function copy() {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            if (timer.current)
                clearTimeout(timer.current);
            timer.current = setTimeout(() => setCopied(false), 1500);
        }
        catch {
            // Clipboard blocked (permissions / insecure origin) — leave the icon as-is.
        }
    }
    return (_jsx(Tooltip, { label: copied ? "Copied" : label, children: _jsx(Button, { type: "button", variant: "ghost", size: "icon-sm", "aria-label": `${label}: ${sku}`, className: cn("text-muted-foreground h-7 w-7 hover:text-foreground", className), onClick: () => void copy(), children: copied ? (_jsx(Check, { className: "h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" })) : (_jsx(Copy, { className: "h-3.5 w-3.5" })) }) }));
}
//# sourceMappingURL=sku-copy-button.js.map