"use client"

import * as React from "react"
import { themeNames, type ThemeName } from "@munim/theme"
import { ThemeSwatches } from "@munim/ui"

export { ThemeSwatches }

const STORAGE_KEY = "munim.theme"

function getStoredTheme(): ThemeName {
  if (typeof window === "undefined") return "apple"
  const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeName | null
  return stored && themeNames.includes(stored) ? stored : "apple"
}

/**
 * Web accent-theme manager. next-themes owns light/dark (the `.dark` class);
 * this hook owns the `data-theme` attribute on <html>, which selects one of
 * the token blocks from @munim/theme/tokens.css. Persisted per browser.
 */
function useAccentTheme() {
  // Lazy-init from storage; SSR returns "apple" so server and client first
  // paint match, then the effect applies the real stored theme to <html>.
  const [themeName, setThemeNameState] = React.useState<ThemeName>(() => {
    if (typeof window === "undefined") return "apple"
    return getStoredTheme()
  })

  // Apply the stored theme to <html> on mount (client hydration).
  React.useEffect(() => {
    window.document.documentElement.dataset.theme = themeName
    window.localStorage.setItem(STORAGE_KEY, themeName)
  }, [themeName])

  const setThemeName = React.useCallback((next: ThemeName) => {
    setThemeNameState(next)
    window.document.documentElement.dataset.theme = next
    window.localStorage.setItem(STORAGE_KEY, next)
  }, [])

  return { themeName, setThemeName }
}

/** Shared hook so Settings and the topbar stay in sync without prop drilling. */
const AccentThemeContext = React.createContext<{
  themeName: ThemeName
  setThemeName: (t: ThemeName) => void
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
