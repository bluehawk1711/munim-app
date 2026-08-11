import { jsx as _jsx } from "react/jsx-runtime";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "../lib/utils.js";
import { badgeVariants } from "./badge-variants.js";
function Badge({ className, variant, asChild = false, ...props }) {
    const Comp = asChild ? Slot : "span";
    return (_jsx(Comp, { "data-slot": "badge", className: cn(badgeVariants({ variant }), className), ...props }));
}
export { Badge };
//# sourceMappingURL=badge.js.map