"use client"

import * as React from "react"
import { useTheme as useNextTheme } from "next-themes"
import { AnimatedThemeToggle } from "@munim/ui"
import { useAccentThemeContext } from "@/components/app/theme-picker"

export function ThemeToggle() {
  const { resolvedTheme } = useNextTheme()
  const { setMode } = useAccentThemeContext()
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  // The Skiper26 animated toggle — polygon wipe from top-left with blur.
  // Fully controlled: next-themes resolves the current mode, `setMode`
  // flips it and mirrors it to the shared settings row (cross-device sync).
  const isDark = mounted && resolvedTheme === "dark"

  return (
    <AnimatedThemeToggle
      isDark={!!isDark}
      onToggle={() => setMode(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    />
  )
}
