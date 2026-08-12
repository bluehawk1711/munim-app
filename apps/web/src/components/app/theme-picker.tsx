"use client"

import * as React from "react"
import { useTheme as useNextTheme } from "next-themes"
import { themeNames, type ThemeName } from "@munim/theme"
import { ThemeSelect, ThemeSwatches } from "@munim/ui"
import { useSettings, useUpdateSettings } from "@/hooks/use-settings"

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
 * theme) AND the persisted light/dark preference. Both are persisted locally
 * (instant paint) and mirrored to the shared settings row in Neon, so a theme
 * or mode picked on any platform syncs to the others.
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
  const { themeName, setThemeName, mode, setMode } = useAccentTheme()
  const { data: settings } = useSettings()
  const updateSettings = useUpdateSettings()
  // Values last applied/written to the DB — lets the settings-refetch effect
  // no-op instead of re-applying stale data over a fresh local choice.
  const appliedRef = React.useRef<{ theme: ThemeName | null; mode: ThemeMode | null }>({
    theme: null,
    mode: null,
  })
  // Set once the user picks a theme/mode THIS session — the DB pull is then
  // skipped so a stale pre-change payload can't clobber the fresh local choice.
  const userChangedRef = React.useRef(false)

  // Pull the shared (DB) theme + mode on load — syncs a pick made on another
  // device. Rule: the untouched defaults ("apple" / null) never clobber a local
  // preference on first load after this sync shipped; once ANY device writes a
  // non-default value, the DB is authoritative everywhere.
  React.useEffect(() => {
    const dbTheme = settings?.theme
    if (dbTheme && themeNames.includes(dbTheme as ThemeName)) {
      if (!userChangedRef.current) {
        const t = dbTheme as ThemeName
        if (t === "apple" && window.localStorage.getItem(STORAGE_KEY)) return
        if (appliedRef.current.theme !== t) {
          appliedRef.current.theme = t
          setThemeName(t)
        }
      }
    }
    const dbMode = settings?.mode
    if (isThemeMode(dbMode)) {
      if (!userChangedRef.current) {
        if (dbMode === "system" && window.localStorage.getItem(MODE_KEY)) return
        if (appliedRef.current.mode !== dbMode) {
          appliedRef.current.mode = dbMode
          setMode(dbMode)
        }
      }
    }
  }, [settings?.theme, settings?.mode, setThemeName, setMode])

  const setThemeNameSynced = React.useCallback(
    (next: ThemeName) => {
      userChangedRef.current = true
      appliedRef.current.theme = next
      setThemeName(next)
      updateSettings.mutate({ theme: next })
    },
    [setThemeName, updateSettings],
  )

  const setModeSynced = React.useCallback(
    (next: ThemeMode) => {
      userChangedRef.current = true
      appliedRef.current.mode = next
      setMode(next)
      updateSettings.mutate({ mode: next })
    },
    [setMode, updateSettings],
  )

  const contextValue = React.useMemo(
    () => ({ themeName, setThemeName: setThemeNameSynced, mode, setMode: setModeSynced }),
    [themeName, setThemeNameSynced, mode, setModeSynced],
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
