"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
import { Moon, Sun } from "lucide-react";
import { cn } from "../lib/utils.js";
const STYLE_ID = "munim-animated-theme-transition";
const EXPO_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
/** Polygon clip-path reveal from Skiper26, with `--expo-out` inlined so the
 * injected stylesheet has zero external dependencies. */
function createPolygonAnimation(start, blur) {
    const clipPaths = start === "top-right"
        ? {
            darkFrom: "polygon(150% -71%, 250% 71%, 250% 71%, 150% -71%)",
            darkTo: "polygon(150% -71%, 250% 71%, 50% 171%, -71% 50%)",
            lightFrom: "polygon(-71% 50%, 50% 171%, 50% 171%, -71% 50%)",
            lightTo: "polygon(-71% 50%, 50% 171%, 250% 71%, 150% -71%)",
        }
        : {
            darkFrom: "polygon(50% -71%, -50% 71%, -50% 71%, 50% -71%)",
            darkTo: "polygon(50% -71%, -50% 71%, 50% 171%, 171% 50%)",
            lightFrom: "polygon(171% 50%, 50% 171%, 50% 171%, 171% 50%)",
            lightTo: "polygon(171% 50%, 50% 171%, -50% 71%, 50% -71%)",
        };
    const suffix = `${start}${blur ? "-blur" : ""}`;
    return `
      ::view-transition-group(root) {
        animation-duration: 0.7s;
        animation-timing-function: ${EXPO_OUT};
      }

      ::view-transition-new(root) {
        animation-name: reveal-light-${suffix};
        ${blur ? "filter: blur(2px);" : ""}
      }

      ::view-transition-old(root),
      .dark::view-transition-old(root) {
        animation: none;
        z-index: -1;
      }

      .dark::view-transition-new(root) {
        animation-name: reveal-dark-${suffix};
        ${blur ? "filter: blur(2px);" : ""}
      }

      @keyframes reveal-dark-${suffix} {
        from {
          clip-path: ${clipPaths.darkFrom};
          ${blur ? "filter: blur(8px);" : ""}
        }
        ${blur ? "50% { filter: blur(4px); }" : ""}
        to {
          clip-path: ${clipPaths.darkTo};
          ${blur ? "filter: blur(0px);" : ""}
        }
      }

      @keyframes reveal-light-${suffix} {
        from {
          clip-path: ${clipPaths.lightFrom};
          ${blur ? "filter: blur(8px);" : ""}
        }
        ${blur ? "50% { filter: blur(4px); }" : ""}
        to {
          clip-path: ${clipPaths.lightTo};
          ${blur ? "filter: blur(0px);" : ""}
        }
      }

      @media (prefers-reduced-motion: reduce) {
        ::view-transition-group(root),
        ::view-transition-new(root),
        ::view-transition-old(root) {
          animation: none !important;
        }
      }
    `;
}
function injectTransitionStyles(css) {
    if (typeof document === "undefined")
        return;
    let el = document.getElementById(STYLE_ID);
    if (!el) {
        el = document.createElement("style");
        el.id = STYLE_ID;
        document.head.appendChild(el);
    }
    el.textContent = css;
}
export function AnimatedThemeToggle({ isDark, onToggle, start = "top-left", blur = true, className, "aria-label": ariaLabel = "Toggle theme", }) {
    const handleToggle = React.useCallback(() => {
        const animationCss = createPolygonAnimation(start, blur);
        injectTransitionStyles(animationCss);
        // Respect the OS/browser "reduce motion" preference: when animations are
        // disabled (e.g. Windows "Animation effects" off) the wipe is skipped and
        // the theme flips instantly instead. The wipe plays only when the OS
        // allows animations.
        const prefersReduced = typeof window.matchMedia === "function" &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const targetDark = !isDark;
        const run = () => {
            // Flip the class synchronously inside the transition callback so the
            // View Transition actually captures the change. Theme providers like
            // next-themes apply the class in a passive effect that runs AFTER the
            // transition's "new" snapshot is taken — without this, the wipe
            // animates the old page onto the old page. Applied to BOTH <html> and
            // <body> so dark mode sticks no matter which element the host CSS is
            // scoped under; idempotent for both apps. `onToggle` handles state,
            // persistence and the shared-DB sync.
            if (typeof document !== "undefined") {
                const flip = (el) => {
                    if (!el)
                        return;
                    el.classList.remove("light", "dark");
                    el.classList.add(targetDark ? "dark" : "light");
                };
                flip(document.documentElement);
                flip(document.body);
            }
            onToggle();
        };
        if (!prefersReduced &&
            typeof document !== "undefined" &&
            typeof document.startViewTransition === "function") {
            try {
                document.startViewTransition(run);
            }
            catch {
                // Transition unavailable (e.g. a transition already in flight) —
                // fall back to a plain toggle.
                run();
            }
        }
        else {
            run();
        }
    }, [isDark, onToggle, start, blur]);
    return (_jsxs("button", { type: "button", className: cn(
        // Themed circle (not solid black) so it stays visible on dark surfaces:
        // subtle border + tinted fill in both modes, gentle hover lift, press pop.
        "relative size-10 cursor-pointer rounded-full border border-black/10 bg-white/90 p-0 text-zinc-800 shadow-sm backdrop-blur transition-all duration-300 hover:bg-white hover:shadow-md active:scale-95 dark:border-white/15 dark:bg-zinc-800/90 dark:text-zinc-100 dark:hover:bg-zinc-800", className), onClick: handleToggle, "aria-label": ariaLabel, children: [_jsx("span", { className: "sr-only", children: "Toggle theme" }), _jsxs("span", { className: "relative block size-full", children: [_jsx(Sun, { size: 20, "aria-hidden": "true", className: "absolute inset-0 m-auto text-amber-500 transition-all duration-500 ease-in-out motion-reduce:transform-none motion-reduce:transition-none", style: {
                            opacity: isDark ? 0 : 1,
                            transform: isDark ? "rotate(90deg) scale(0.4)" : "rotate(0deg) scale(1)",
                        } }), _jsx(Moon, { size: 20, "aria-hidden": "true", className: "absolute inset-0 m-auto transition-all duration-500 ease-in-out motion-reduce:transform-none motion-reduce:transition-none", style: {
                            opacity: isDark ? 1 : 0,
                            transform: isDark ? "rotate(0deg) scale(1)" : "rotate(-90deg) scale(0.4)",
                        } })] })] }));
}
//# sourceMappingURL=animated-theme-toggle.js.map