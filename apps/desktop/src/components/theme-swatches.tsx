import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { themeNames, type ThemeName } from "@munim/theme";
import { ThemeSelect, ThemeSwatches } from "@munim/ui";
import { useTheme } from "@/components/theme-provider";

export { ThemeSwatches, ThemeSelect };

const STORAGE_KEY = "munim-desktop-accent-theme";
const MODE_KEY = "munim-desktop-theme-mode";

export type ThemeMode = "light" | "dark" | "system";

function isThemeMode(value: string | null | undefined): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

function getStoredTheme(): ThemeName {
  const stored = localStorage.getItem(STORAGE_KEY) as ThemeName | null;
  return stored && themeNames.includes(stored) ? stored : "apple";
}

function getStoredMode(): ThemeMode | null {
  const stored = localStorage.getItem(MODE_KEY);
  return isThemeMode(stored) ? stored : null;
}

/**
 * Desktop accent-theme + mode manager. The ThemeProvider owns light/dark (the
 * `.dark` class); this hook owns `data-theme` on <html> (accent theme) AND the
 * persisted light/dark preference. Everything is persisted LOCALLY
 * (instant paint, per-device) — themes never sync through the shared database,
 * so each platform keeps its own look.
 */
export function useAccentThemeState() {
  const { setTheme: setNextTheme } = useTheme();
  const [themeName, setThemeNameState] = useState<ThemeName>(() => getStoredTheme());
  // null = follow the system preference (or nothing stored yet).
  const [mode, setModeState] = useState<ThemeMode | null>(() => getStoredMode());

  useEffect(() => {
    document.documentElement.dataset.theme = themeName;
  }, [themeName]);

  useEffect(() => {
    if (mode === null) {
      setNextTheme("system");
      return;
    }
    localStorage.setItem(MODE_KEY, mode);
    setNextTheme(mode);
  }, [mode, setNextTheme]);

  const setThemeName = useCallback((next: ThemeName) => {
    localStorage.setItem(STORAGE_KEY, next);
    setThemeNameState(next);
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    localStorage.setItem(MODE_KEY, next);
    setModeState(next);
  }, []);

  return { themeName, setThemeName, mode, setMode };
}

type AccentThemeContextValue = ReturnType<typeof useAccentThemeState>;

const AccentThemeContext = createContext<AccentThemeContextValue | null>(null);

/**
 * Owns the accent-theme + mode state for the WHOLE app. Mounted at the root
 * (inside ThemeProvider) so `data-theme` is applied on first paint — not just
 * when the Settings page happens to be open (that was the "always amber on
 * startup" bug: nothing wrote `data-theme` until Settings mounted).
 */
export function AccentThemeProvider({ children }: { children: ReactNode }) {
  const value = useAccentThemeState();
  return <AccentThemeContext.Provider value={value}>{children}</AccentThemeContext.Provider>;
}

/** Consume the shared accent-theme state (Settings swatches, mode toggle). */
export function useAccentThemeContext(): AccentThemeContextValue {
  const ctx = useContext(AccentThemeContext);
  if (!ctx) throw new Error("useAccentThemeContext must be used within AccentThemeProvider");
  return ctx;
}
