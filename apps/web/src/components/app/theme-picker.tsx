"use client"

import * as React from "react"
import { useTheme as useNextTheme } from "next-themes"
import { themeNames, type ThemeName } from "@munim/theme"
import { ThemeSelect, ThemeSwatches } from "@munim/ui"

export { ThemeSwatches, ThemeSelect }

const STORAGE_KEY = "munim.theme"
const MODE_KEY = "munim.themeMode"

export type ThemeMode = "light" | "dark" | "system"

function isThemeMode(value: string | null | undefined): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system"
}

function getStoredTheme(): ThemeName {
  if (typeof window === "undefined") return "apple"
  const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeName | null
  return stored && themeNames.includes(stored) ? stored : "apple"
}

function getStoredMode(): ThemeMode | null {
  if (typeof window === "undefined") return null
  const stored = window.localStorage.getItem(MODE_KEY)
  return isThemeMode(stored) ? stored : null
}

/**
 * Web accent-theme + mode manager. next-themes owns the `.dark` class (via
 * `setTheme`); this hook owns the `data-theme` attribute on <html> (accent
 * theme) AND the persisted light/dark preference. Everything is persisted
 * LOCALLY (instant paint, per-device) — themes never sync through the shared
 * database, so each platform keeps its own look.
 */
function useAccentTheme() {
  const { setTheme: setNextTheme } = useNextTheme()
  const [themeName, setThemeNameState] = React.useState<ThemeName>(() => {
    if (typeof window === "undefined") return "apple"
    return getStoredTheme()
  })
  // null = follow the system preference (or nothing stored yet).
  const [mode, setModeState] = React.useState<ThemeMode | null>(() => getStoredMode())

  // Apply the stored theme + mode on mount / change (client hydration).
  React.useEffect(() => {
    window.document.documentElement.dataset.theme = themeName
    window.localStorage.setItem(STORAGE_KEY, themeName)
  }, [themeName])

  React.useEffect(() => {
    if (mode === null) {
      setNextTheme("system")
      return
    }
    window.localStorage.setItem(MODE_KEY, mode)
    setNextTheme(mode)
  }, [mode, setNextTheme])

  const setThemeName = React.useCallback((next: ThemeName) => {
    setThemeNameState(next)
    window.document.documentElement.dataset.theme = next
    window.localStorage.setItem(STORAGE_KEY, next)
  }, [])

  const setMode = React.useCallback((next: ThemeMode) => {
    setModeState(next)
    window.localStorage.setItem(MODE_KEY, next)
    setNextTheme(next)
  }, [setNextTheme])

  return { themeName, setThemeName, mode, setMode }
}

/** Shared hook so Settings and the topbar stay in sync without prop drilling. */
const AccentThemeContext = React.createContext<{
  themeName: ThemeName
  setThemeName: (t: ThemeName) => void
  mode: ThemeMode | null
  setMode: (m: ThemeMode) => void
} | null>(null)

export function AccentThemeProvider({ children }: { children: React.ReactNode }) {
  const value = useAccentTheme()
  return <AccentThemeContext.Provider value={value}>{children}</AccentThemeContext.Provider>
}

export function useAccentThemeContext() {
  const ctx = React.useContext(AccentThemeContext)
  if (!ctx) throw new Error("useAccentThemeContext must be used within AccentThemeProvider")
  return ctx
}
