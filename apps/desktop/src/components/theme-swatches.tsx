import { useCallback, useEffect, useRef, useState } from "react";
import { getSettings, updateSettings } from "@munim/core";
import { themeNames, type ThemeName } from "@munim/theme";
import { ThemeSelect, ThemeSwatches } from "@munim/ui";
import { useTheme } from "@/components/theme-provider";
import { getCore } from "@/lib/core";

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
 * persisted light/dark preference. Both are persisted locally (instant paint)
 * and mirrored to the shared settings row in Neon — the same row web & mobile
 * read, so a theme or mode picked on any platform syncs to the others.
 */
export function useAccentTheme() {
  const { setTheme: setNextTheme } = useTheme();
  const [themeName, setThemeNameState] = useState<ThemeName>(() => getStoredTheme());
  // null = follow the system preference (or nothing stored yet).
  const [mode, setModeState] = useState<ThemeMode | null>(() => getStoredMode());
  // Set once the user picks a theme/mode THIS session — the DB pull is then
  // skipped so a stale pre-change payload can't clobber the fresh local choice.
  const userChangedRef = useRef(false);

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

  // Pull the shared (DB) theme + mode on mount.
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const row = await getSettings(getCore());
        if (!active || userChangedRef.current) return;
        const dbTheme = row.theme as ThemeName;
        if (dbTheme && themeNames.includes(dbTheme)) {
          if (dbTheme === "apple" && localStorage.getItem(STORAGE_KEY)) return;
          localStorage.setItem(STORAGE_KEY, dbTheme);
          setThemeNameState(dbTheme);
        }
        const dbMode = row.mode as ThemeMode | null;
        if (isThemeMode(dbMode)) {
          if (dbMode === "system" && localStorage.getItem(MODE_KEY)) return;
          localStorage.setItem(MODE_KEY, dbMode);
          setModeState(dbMode);
        }
      } catch {
        // DB not configured (or unreachable) — theme stays local-only.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const setThemeName = useCallback((next: ThemeName) => {
    userChangedRef.current = true;
    localStorage.setItem(STORAGE_KEY, next);
    setThemeNameState(next);
    // Mirror to the shared settings row — syncs to web & mobile. Fire-and-forget
    // with a local-first catch: theming must never block on the DB.
    try {
      void updateSettings(getCore(), { theme: next }).catch(() => {});
    } catch {
      // DB not configured — local-only.
    }
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    userChangedRef.current = true;
    localStorage.setItem(MODE_KEY, next);
    setModeState(next);
    try {
      void updateSettings(getCore(), { mode: next }).catch(() => {});
    } catch {
      // DB not configured — local-only.
    }
  }, []);

  return { themeName, setThemeName, mode, setMode };
}
