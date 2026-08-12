"use client"

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
 * Contract: the toggle drives the `light`/`dark` classes on <html> itself
 * (synchronously, so the View Transition captures the flip). Any host theme
 * system must use exactly those two class names — next-themes and the
 * desktop provider both do.
 *
 * Original concept: Skiper UI (@gurvinder-singh02) — https://gxuri.me
 * Inspired by https://github.com/rudrodip/theme-toggle-effect
 * https://developer.chrome.com/docs/web-platform/view-transitions/
 */

import * as React from "react";
import { cn } from "../lib/utils.js";

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

const STYLE_ID = "munim-animated-theme-transition";
const EXPO_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";

/** Polygon clip-path reveal from Skiper26, with `--expo-out` inlined so the
 * injected stylesheet has zero external dependencies. */
function createPolygonAnimation(
  start: AnimatedThemeToggleStart,
  blur: boolean,
): string {
  const clipPaths =
    start === "top-right"
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

function injectTransitionStyles(css: string) {
  if (typeof document === "undefined") return;
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = css;
}

export function AnimatedThemeToggle({
  isDark,
  onToggle,
  start = "top-left",
  blur = true,
  className,
  "aria-label": ariaLabel = "Toggle theme",
}: AnimatedThemeToggleProps) {
  const handleToggle = React.useCallback(() => {
    const animationCss = createPolygonAnimation(start, blur);
    injectTransitionStyles(animationCss);

    const prefersReduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const targetDark = !isDark;
    const run = () => {
      // Flip the class synchronously inside the transition callback so the
      // View Transition actually captures the change. Theme providers like
      // next-themes apply the class in a passive effect that runs AFTER the
      // transition's "new" snapshot is taken — without this, the wipe
      // animates the old page onto the old page. Idempotent for both apps
      // (both toggle `light`/`dark` on <html>); `onToggle` handles state,
      // persistence and the shared-DB sync.
      if (typeof document !== "undefined") {
        const root = document.documentElement;
        root.classList.remove("light", "dark");
        root.classList.add(targetDark ? "dark" : "light");
      }
      onToggle();
    };

    if (
      !prefersReduced &&
      typeof document !== "undefined" &&
      typeof document.startViewTransition === "function"
    ) {
      try {
        document.startViewTransition(run);
      } catch {
        // Transition unavailable (e.g. a transition already in flight) —
        // fall back to a plain toggle.
        run();
      }
    } else {
      run();
    }
  }, [isDark, onToggle, start, blur]);

  return (
    <button
      type="button"
      className={cn(
        "size-10 cursor-pointer rounded-full bg-black p-0 transition-all duration-300 active:scale-95",
        className,
      )}
      onClick={handleToggle}
      aria-label={ariaLabel}
    >
      <span className="sr-only">Toggle theme</span>
      <svg
        viewBox="0 0 240 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="block size-full"
      >
        <g
          style={{
            transformBox: "fill-box",
            transformOrigin: "center",
            transform: isDark ? "rotate(-180deg)" : "rotate(0deg)",
            transition: "transform 0.5s ease-in-out",
          }}
        >
          <path d="M120 67.5C149.25 67.5 172.5 90.75 172.5 120C172.5 149.25 149.25 172.5 120 172.5" fill="white" />
          <path d="M120 67.5C90.75 67.5 67.5 90.75 67.5 120C67.5 149.25 90.75 172.5 120 172.5" fill="black" />
        </g>
        <path
          style={{
            transformBox: "fill-box",
            transformOrigin: "center",
            transform: isDark ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.5s ease-in-out",
          }}
          d="M120 3.75C55.5 3.75 3.75 55.5 3.75 120C3.75 184.5 55.5 236.25 120 236.25C184.5 236.25 236.25 184.5 236.25 120C236.25 55.5 184.5 3.75 120 3.75ZM120 214.5V172.5C90.75 172.5 67.5 149.25 67.5 120C67.5 90.75 90.75 67.5 120 67.5V25.5C172.5 25.5 214.5 67.5 214.5 120C214.5 172.5 172.5 214.5 120 214.5Z"
          fill="white"
        />
      </svg>
    </button>
  );
}
