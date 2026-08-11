"use client"

import * as React from "react"
import { themeNames, type ThemeName } from "@munim/theme"
import { ThemeSwatches } from "@munim/ui"
import { useSettings, useUpdateSettings } from "@/hooks/use-settings"

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
  const { themeName, setThemeName } = useAccentTheme()
  const { data: settings } = useSettings()
  const updateSettings = useUpdateSettings()
  // Theme last applied/written to the DB — lets the settings-refetch effect
  // no-op instead of re-applying stale data over a fresh local choice.
  const appliedRef = React.useRef<ThemeName | null>(null)
  // Set once the user picks a theme THIS session — the DB pull is then skipped
  // so a stale pre-change payload can't clobber the fresh local choice.
  const userChangedRef = React.useRef(false)

  // Pull the shared (DB) theme on load — syncs a pick made on another device.
  // Rule: the untouched default ("apple") never clobbers a local preference on
  // first load after this sync shipped; once ANY device writes a non-default
  // theme (or explicitly re-picks apple), the DB is authoritative everywhere.
  React.useEffect(() => {
    const dbTheme = settings?.theme
    if (!dbTheme || !themeNames.includes(dbTheme as ThemeName)) return
    if (userChangedRef.current) return
    const t = dbTheme as ThemeName
    if (t === "apple" && window.localStorage.getItem(STORAGE_KEY)) return
    if (appliedRef.current !== t) {
      appliedRef.current = t
      setThemeName(t)
    }
  }, [settings?.theme, setThemeName])

  const setThemeNameSynced = React.useCallback(
    (next: ThemeName) => {
      userChangedRef.current = true
      appliedRef.current = next
      setThemeName(next)
      updateSettings.mutate({ theme: next })
    },
    [setThemeName, updateSettings],
  )

  const contextValue = React.useMemo(
    () => ({ themeName, setThemeName: setThemeNameSynced }),
    [themeName, setThemeNameSynced],
  )
  return (
    <AccentThemeContext.Provider value={contextValue}>{children}</AccentThemeContext.Provider>
  )
}

export function useAccentThemeContext() {
  const ctx = React.useContext(AccentThemeContext)
  if (!ctx) throw new Error("useAccentThemeContext must be used within AccentThemeProvider")
  return ctx
}
