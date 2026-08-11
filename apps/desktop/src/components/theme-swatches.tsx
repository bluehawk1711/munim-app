import { useCallback, useEffect, useState } from "react";
import { themeNames, type ThemeName } from "@munim/theme";
import { ThemeSwatches } from "@munim/ui";

export { ThemeSwatches };

const STORAGE_KEY = "munim-desktop-accent-theme";

function getStoredTheme(): ThemeName {
  const stored = localStorage.getItem(STORAGE_KEY) as ThemeName | null;
  return stored && themeNames.includes(stored) ? stored : "apple";
}

/**
 * Desktop accent-theme manager. The ThemeProvider owns light/dark (the
 * `.dark` class); this hook owns `data-theme` on <html>, which selects one of
 * the token blocks from @munim/theme/tokens.css. Persisted locally.
 */
export function useAccentTheme() {
  const [themeName, setThemeNameState] = useState<ThemeName>(() => getStoredTheme());

  useEffect(() => {
    document.documentElement.dataset.theme = themeName;
  }, [themeName]);

  const setThemeName = useCallback((next: ThemeName) => {
    localStorage.setItem(STORAGE_KEY, next);
    setThemeNameState(next);
  }, []);

  return { themeName, setThemeName };
}
