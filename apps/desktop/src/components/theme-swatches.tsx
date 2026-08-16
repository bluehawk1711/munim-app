import { useCallback, useEffect, useState } from "react";
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
export function useAccentTheme() {
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
