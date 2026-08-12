import { AnimatedThemeToggle, useForceThemeTransition } from "@munim/ui";
import { useTheme } from "@/components/theme-provider";
import { useAccentTheme } from "@/components/theme-swatches";

export function ModeToggle() {
  const { theme } = useTheme();
  const { setMode } = useAccentTheme();
  const forceTransition = useForceThemeTransition();

  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <AnimatedThemeToggle
      isDark={isDark}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      // The shared component flips the `light`/`dark` class synchronously
      // inside the View Transition; `setMode` keeps state + localStorage + the
      // shared-DB sync.
      onToggle={() => setMode(isDark ? "light" : "dark")}
      forceTransition={forceTransition}
    />
  );
}
