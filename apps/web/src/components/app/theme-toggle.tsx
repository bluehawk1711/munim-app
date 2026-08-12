"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme as useNextTheme } from "next-themes"
import { Button } from "@munim/ui"
import { useAccentThemeContext } from "@/components/app/theme-picker"


export function ThemeToggle() {
  const { resolvedTheme } = useNextTheme()
  const { setMode } = useAccentThemeContext()
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  const isDark = resolvedTheme === "dark"
  // When no explicit mode is stored, treat the resolved theme as the toggle target.
  const next: "light" | "dark" = isDark ? "light" : "dark"

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setMode(next)}
      className="h-9 w-9"
    >
      {mounted && isDark ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  )
}
