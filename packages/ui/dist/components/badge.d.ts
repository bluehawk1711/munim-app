import * as React from "react";
import type { VariantProps } from "class-variance-authority";
import { badgeVariants } from "./badge-variants.js";
declare function Badge({ className, variant, asChild, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & {
    asChild?: boolean;
}): React.JSX.Element;
export { Badge };
//# sourceMappingURL=badge.d.ts.map