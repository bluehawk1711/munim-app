import * as React from "react";
/**
 * Switch — dependency-free shadcn-style toggle.
 *
 * A native <button role="switch"> with a sliding thumb, so web + desktop
 * Settings get an on/off control without pulling in Radix. Visually matches
 * the shadcn switch (w-9 track, w-4 thumb) and the rest of the kit.
 */
declare function Switch({ checked, onCheckedChange, className, disabled, "aria-label": ariaLabel, }: {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    className?: string;
    disabled?: boolean;
    "aria-label"?: string;
}): React.JSX.Element;
export { Switch };
//# sourceMappingURL=switch.d.ts.map