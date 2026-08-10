/**
 * Mobile theme runtime.
 *
 * React Native has no CSS variables, so screens import `colors` and read it
 * wherever they need a token. To support dark mode without rewriting every
 * screen, `colors` is a Proxy that resolves each property against the CURRENT
 * mode's palette at access time. The `ThemeProvider` owns the mode (stored
 * override in AsyncStorage, otherwise the system preference) and swaps the
 * module-level palette before its children render — so inline `colors.*`
 * usages and `useThemeStyles()` both pick up the new values automatically.
 */
import React, {createContext, useContext, useEffect, useMemo, useState} from 'react';
import {useColorScheme} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {mobileColorsFor, type MobileColors, type ThemeMode} from '@munim/theme';

const STORAGE_KEY = 'munim.themeMode';

// Module-level palette backing the `colors` proxy. Reassigned on mode change.
let currentColors: MobileColors = mobileColorsFor('light');

/**
 * Dynamic color token object. Every property access reads the palette of the
 * mode that is currently active, so the same imported `colors` works in both
 * light and dark without re-importing.
 */
export const colors: MobileColors = new Proxy(currentColors, {
  get: (_target, prop) => currentColors[prop as keyof MobileColors],
});
// NOTE: only `get` is trapped. Never spread `colors` ({...colors}) or call
// Object.keys(colors) — those traps would read the original target (light
// palette) instead of the current mode. Access properties directly.

type ThemeContextValue = {
  mode: ThemeMode;
  /** Per-mode palette object — a NEW identity per mode, so consumers can use
   *  it as a useMemo key to rebuild mode-dependent styles. */
  colors: MobileColors;
  /** Persists an explicit override ('light' | 'dark'). */
  setMode: (mode: ThemeMode) => void;
  /** Switches to the opposite mode and persists it. */
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'light',
  colors,
  setMode: () => {},
  toggle: () => {},
});

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/**
 * Builds a StyleSheet (or any style factory) for the active mode. Returns a
 * stable object per mode, recomputed whenever the palette changes.
 */
export function useThemeStyles<T>(factory: (c: MobileColors) => T): T {
  const {colors: palette} = useTheme();
  return useMemo(() => factory(palette), [palette, factory]);
}

export function ThemeProvider({children}: {children: React.ReactNode}) {
  const system = useColorScheme();
  // null = not chosen yet → follow the system preference.
  const [preference, setPreference] = useState<ThemeMode | null>(null);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY).then(stored => {
      if (active && (stored === 'light' || stored === 'dark')) {
        setPreference(stored);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const mode: ThemeMode = preference ?? (system === 'dark' ? 'dark' : 'light');
  const palette = useMemo(() => mobileColorsFor(mode), [mode]);

  // Sync the module-level palette DURING render so every child that reads the
  // shared `colors` proxy in this pass sees the same values as the context.
  currentColors = palette;

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      colors: palette,
      setMode: (next) => {
        setPreference(next);
        AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      },
      toggle: () => {
        const next: ThemeMode = mode === 'dark' ? 'light' : 'dark';
        setPreference(next);
        AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      },
    }),
    [mode, palette],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
