/**
 * Mobile theme runtime.
 *
 * React Native has no CSS variables, so screens import `colors` and read it
 * wherever they need a token. To support dark mode AND multiple accent themes
 * without rewriting every screen, `colors` is a Proxy that resolves each
 * property against the CURRENT (theme, mode) palette at access time. The
 * `ThemeProvider` owns both — the accent theme (stored override in
 * AsyncStorage, default "apple") and the mode (stored override, otherwise the
 * system preference) — and swaps the module-level palette before its children
 * render, so inline `colors.*` usages and `useThemeStyles()` both pick up the
 * new values automatically.
 */
import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {useColorScheme} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {mobileColorsFor, type MobileColors, type ThemeMode, type ThemeName} from '@munim/theme';

const MODE_KEY = 'munim.themeMode';
const THEME_KEY = 'munim.accentTheme';

const THEME_NAMES: readonly string[] = ['apple', 'ocean', 'forest', 'rose', 'midnight'];

function isThemeName(value: string | null | undefined): value is ThemeName {
  if (value === null || value === undefined) return false;
  return THEME_NAMES.includes(value);
}

// Module-level palette backing the `colors` proxy. Reassigned on change.
let currentColors: MobileColors = mobileColorsFor('light', 'apple');

/**
 * Dynamic color token object. Every property access reads the palette of the
 * theme+mode that is currently active, so the same imported `colors` works in
 * both light and dark, across all themes, without re-importing.
 */
export const colors: MobileColors = new Proxy(currentColors, {
  get: (_target, prop) => currentColors[prop as keyof MobileColors],
});
// NOTE: only `get` is trapped. Never spread `colors` ({...colors}) or call
// Object.keys(colors) — those traps would read the original target (light
// palette) instead of the current theme+mode. Access properties directly.

type ThemeContextValue = {
  mode: ThemeMode;
  /** Active accent theme name ('apple' | 'ocean' | 'forest' | 'rose' | 'midnight'). */
  themeName: ThemeName;
  /** Per-palette object — a NEW identity per (theme, mode), so consumers can
   *  use it as a useMemo key to rebuild mode/theme-dependent styles. */
  colors: MobileColors;
  /** Persists an explicit light/dark override. */
  setMode: (mode: ThemeMode) => void;
  /** Switches to the opposite mode and persists it. */
  toggle: () => void;
  /** Persists an accent theme. */
  setThemeName: (theme: ThemeName) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'light',
  themeName: 'apple',
  colors,
  setMode: () => {},
  toggle: () => {},
  setThemeName: () => {},
});

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/**
 * Builds a StyleSheet (or any style factory) for the active theme+mode.
 * Returns a stable object per palette, recomputed whenever either changes.
 */
export function useThemeStyles<T>(factory: (c: MobileColors) => T): T {
  const {colors: palette} = useTheme();
  return useMemo(() => factory(palette), [palette, factory]);
}

export function ThemeProvider({children}: {children: React.ReactNode}) {
  const system = useColorScheme();
  // null = not chosen yet → follow the system preference.
  const [preference, setPreference] = useState<ThemeMode | null>(null);
  const [themeName, setThemeNameState] = useState<ThemeName>('apple');

  useEffect(() => {
    let active = true;
    (async () => {
      const [modeStored, themeStored] = await Promise.all([
        AsyncStorage.getItem(MODE_KEY),
        AsyncStorage.getItem(THEME_KEY),
      ]);
      if (!active) return;
      if (modeStored === 'light' || modeStored === 'dark') setPreference(modeStored);
      if (isThemeName(themeStored)) setThemeNameState(themeStored);
    })();
    return () => {
      active = false;
    };
  }, []);

  const mode: ThemeMode = preference ?? (system === 'dark' ? 'dark' : 'light');
  const palette = useMemo(() => mobileColorsFor(mode, themeName), [mode, themeName]);

  // Persist a mode choice locally only — per-device, never synced via the DB.
  const persistMode = useCallback((next: ThemeMode) => {
    AsyncStorage.setItem(MODE_KEY, next).catch(() => {});
  }, []);

  // Sync the module-level palette DURING render so every child that reads the
  // shared `colors` proxy in this pass sees the same values as the context.
  currentColors = palette;

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      themeName,
      colors: palette,
      setMode: (next) => {
        setPreference(next);
        persistMode(next);
      },
      toggle: () => {
        const next: ThemeMode = mode === 'dark' ? 'light' : 'dark';
        setPreference(next);
        persistMode(next);
      },
      setThemeName: (next) => {
        setThemeNameState(next);
        AsyncStorage.setItem(THEME_KEY, next).catch(() => {});
      },
    }),
    [mode, themeName, palette, persistMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
