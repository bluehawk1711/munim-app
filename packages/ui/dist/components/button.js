import { jsx as _jsx } from "react/jsx-runtime";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "../lib/utils.js";
import { buttonVariants } from "./button-variants.js";
function Button({ className, variant, size, asChild = false, ...props }) {
    const Comp = asChild ? Slot : "button";
    return (_jsx(Comp, { "data-slot": "button", className: cn(buttonVariants({ variant, size, className })), ...props }));
}
export { Button };
//# sourceMappingURL=button.js.map