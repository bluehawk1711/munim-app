/**
 * AnimatedThemeToggle — the Skiper UI 26 theme toggle (View Transition API),
 * promoted into the shared kit so web + desktop render the identical control.
 *
 * Configuration used across the apps: polygon wipe, starting from the
 * top-left corner, with the blur reveal. Fully controlled — the parent owns
 * the theme store (next-themes on web, the custom provider on desktop) and
 * passes `isDark` + `onToggle`. That keeps each app's persistence and the
 * shared-DB theme/mode sync in the app layer while the animation lives here.
 *
 * Contract: the toggle drives the `light`/`dark` classes on BOTH <html> and
 * <body> (synchronously, so the View Transition captures the flip). <html>
 * is required for the ::view-transition pseudo-elements and the
 * `[data-theme=x].dark` variable blocks; <body> covers any host CSS that
 * happens to be scoped under `body.dark`. Both apps' theme systems
 * (next-themes + the desktop provider) use exactly these two class names,
 * so the flip is idempotent for either host.
 *
 * Original concept: Skiper UI (@gurvinder-singh02) — https://gxuri.me
 * Inspired by https://github.com/rudrodip/theme-toggle-effect
 * https://developer.chrome.com/docs/web-platform/view-transitions/
 */
import * as React from "react";
export type AnimatedThemeToggleStart = "top-left" | "top-right";
export type AnimatedThemeToggleProps = {
    /** Current resolved dark state (light = false). */
    isDark: boolean;
    /** Flip light <-> dark. The parent persists + syncs the mode. */
    onToggle: () => void;
    /** Wipe origin — default "top-left" (polygon). */
    start?: AnimatedThemeToggleStart;
    /** Blur reveal — default on. */
    blur?: boolean;
    className?: string;
    "aria-label"?: string;
};
export declare function AnimatedThemeToggle({ isDark, onToggle, start, blur, className, "aria-label": ariaLabel, }: AnimatedThemeToggleProps): React.JSX.Element;
//# sourceMappingURL=animated-theme-toggle.d.ts.map