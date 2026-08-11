import { useCallback, useEffect, useRef, useState } from "react";
import { getSettings, updateSettings } from "@munim/core";
import { themeNames, type ThemeName } from "@munim/theme";
import { ThemeSwatches } from "@munim/ui";
import { getCore } from "@/lib/core";

export { ThemeSwatches };

const STORAGE_KEY = "munim-desktop-accent-theme";

function getStoredTheme(): ThemeName {
  const stored = localStorage.getItem(STORAGE_KEY) as ThemeName | null;
  return stored && themeNames.includes(stored) ? stored : "apple";
}

/**
 * Desktop accent-theme manager. The ThemeProvider owns light/dark (the
 * `.dark` class); this hook owns `data-theme` on <html>, which selects one of
 * the token blocks from @munim/theme/tokens.css.
 *
 * Persisted locally (instant paint) AND mirrored to the shared settings row in
 * Neon — the same row web & mobile read, so a theme picked on any platform
 * syncs to the others. The untouched default ("apple") never clobbers an
 * existing local preference on first load after sync shipped; once any device
 * writes a non-default theme, the DB is authoritative everywhere.
 */
export function useAccentTheme() {
  const [themeName, setThemeNameState] = useState<ThemeName>(() => getStoredTheme());
  // Set once the user picks a theme THIS session — the DB pull is then skipped
  // so a stale pre-change payload can't clobber the fresh local choice.
  const userChangedRef = useRef(false);

  useEffect(() => {
    document.documentElement.dataset.theme = themeName;
  }, [themeName]);

  // Pull the shared (DB) theme on mount.
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const row = await getSettings(getCore());
        if (!active || userChangedRef.current) return;
        const dbTheme = row.theme as ThemeName;
        if (!dbTheme || !themeNames.includes(dbTheme)) return;
        if (dbTheme === "apple" && localStorage.getItem(STORAGE_KEY)) return;
        localStorage.setItem(STORAGE_KEY, dbTheme);
        setThemeNameState(dbTheme);
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

  return { themeName, setThemeName };
}
