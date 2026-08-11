/**
 * @munim/theme tokens — THE single source of truth for every Munim app.
 *
 * Edit this file, then run `pnpm --filter @munim/theme build` and every app
 * picks up the change:
 *   - web + desktop  consume `dist/tokens.css` (CSS custom properties, one
 *                    `[data-theme="…"]` block per theme)
 *   - mobile         consumes `mobileColorsFor(mode, themeName)`
 *
 * Five themes ship out of the box. "apple" is the default (warm silver/gold);
 * the others are curated alternatives (cool ocean blues, forest greens,
 * rose pinks, midnight indigo). All values are hex so every platform can use
 * them — the mobile color parser rejects oklch.
 */

export const radius = "0.75rem";

export interface ThemeTokens {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
  /** Positive status (paid, stock-in, etc.) — shared so all apps can use it. */
  success: string;
  /** Pending/partial status. */
  warning: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  sidebar: string;
  sidebarForeground: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  sidebarBorder: string;
  sidebarRing: string;
}

export type ThemeMode = "light" | "dark";

export interface Theme {
  light: ThemeTokens;
  dark: ThemeTokens;
}

export type ThemeName = "apple" | "ocean" | "forest" | "rose" | "midnight";

export const themeNames: ThemeName[] = ["apple", "ocean", "forest", "rose", "midnight"];

export const themeLabels: Record<ThemeName, string> = {
  apple: "Apple Gold",
  ocean: "Ocean Blue",
  forest: "Forest Green",
  rose: "Rose Blush",
  midnight: "Midnight Indigo",
};

/** Two-tone swatch used by the theme pickers (primary + accent). */
export const themeSwatches: Record<ThemeName, [string, string]> = {
  apple: ["#846324", "#f7e9d6"],
  ocean: ["#1d5bd6", "#e3ecfb"],
  forest: ["#177245", "#e0f0e6"],
  rose: ["#b8436f", "#fbe3ec"],
  midnight: ["#4f46e5", "#e7e8fb"],
};

/** Back-compat alias — the default theme. */
export const theme: Theme = {
  light: {
    background: "#fcfbf8",
    foreground: "#0c0b09",
    card: "#ffffff",
    cardForeground: "#0c0b09",
    popover: "#ffffff",
    popoverForeground: "#0c0b09",
    primary: "#846324",
    primaryForeground: "#f9f8f7",
    secondary: "#f3f0eb",
    secondaryForeground: "#24211d",
    muted: "#f5f2ee",
    mutedForeground: "#7f7971",
    accent: "#f7e9d6",
    accentForeground: "#4a371b",
    destructive: "#e7000b",
    destructiveForeground: "#fafafa",
    border: "#e6e2dd",
    input: "#e6e2dd",
    ring: "#846324",
    success: "#059669",
    warning: "#d97706",
    chart1: "#9c7a3d",
    chart2: "#387e82",
    chart3: "#ca933e",
    chart4: "#d37040",
    chart5: "#d6455a",
    sidebar: "#fbfaf9",
    sidebarForeground: "#13110f",
    sidebarPrimary: "#846324",
    sidebarPrimaryForeground: "#f9f8f7",
    sidebarAccent: "#f7e9d6",
    sidebarAccentForeground: "#4a371b",
    sidebarBorder: "#e6e2dd",
    sidebarRing: "#846324",
  },
  dark: {
    background: "#080705",
    foreground: "#edebe7",
    card: "#13110e",
    cardForeground: "#edebe7",
    popover: "#13110e",
    popoverForeground: "#edebe7",
    primary: "#b69255",
    primaryForeground: "#0c0b09",
    secondary: "#24211d",
    secondaryForeground: "#edebe7",
    muted: "#23211e",
    mutedForeground: "#a29e98",
    accent: "#372c1d",
    accentForeground: "#f2daba",
    destructive: "#ff6467",
    destructiveForeground: "#fafafa",
    border: "#2b2825",
    input: "#2b2825",
    ring: "#b69255",
    success: "#34d399",
    warning: "#fbbf24",
    chart1: "#b69255",
    chart2: "#4e9397",
    chart3: "#d79f4c",
    chart4: "#e57f4f",
    chart5: "#e45366",
    sidebar: "#0e0d0b",
    sidebarForeground: "#edebe7",
    sidebarPrimary: "#b69255",
    sidebarPrimaryForeground: "#0c0b09",
    sidebarAccent: "#2f281e",
    sidebarAccentForeground: "#f2daba",
    sidebarBorder: "#24211d",
    sidebarRing: "#b69255",
  },
};

/* ──────────────────────────────────────────────────────────────────────
 * FULL THEME SET
 * "apple" is the default above; the four alternatives below keep the same
 * token shape so the CSS generator and the mobile palette mapper work
 * unchanged. Every theme is a coherent light+dark pair.
 * ────────────────────────────────────────────────────────────────────── */

export const themes: Record<ThemeName, Theme> = {
  apple: theme,

  ocean: {
    light: {
      background: "#f7f9fc",
      foreground: "#0f1b2d",
      card: "#ffffff",
      cardForeground: "#0f1b2d",
      popover: "#ffffff",
      popoverForeground: "#0f1b2d",
      primary: "#1d5bd6",
      primaryForeground: "#ffffff",
      secondary: "#eef2f8",
      secondaryForeground: "#1c2a44",
      muted: "#eef2f8",
      mutedForeground: "#5f6f87",
      accent: "#e3ecfb",
      accentForeground: "#173a75",
      destructive: "#d92d20",
      destructiveForeground: "#ffffff",
      border: "#dde6f2",
      input: "#dde6f2",
      ring: "#1d5bd6",
      success: "#0e9f6e",
      warning: "#d97706",
      chart1: "#1d5bd6",
      chart2: "#0e9f6e",
      chart3: "#0891b2",
      chart4: "#7c5cf0",
      chart5: "#e4578f",
      sidebar: "#f2f6fc",
      sidebarForeground: "#0f1b2d",
      sidebarPrimary: "#1d5bd6",
      sidebarPrimaryForeground: "#ffffff",
      sidebarAccent: "#e3ecfb",
      sidebarAccentForeground: "#173a75",
      sidebarBorder: "#dde6f2",
      sidebarRing: "#1d5bd6",
    },
    dark: {
      background: "#0a101d",
      foreground: "#e6eef9",
      card: "#111a2c",
      cardForeground: "#e6eef9",
      popover: "#111a2c",
      popoverForeground: "#e6eef9",
      primary: "#6da3ff",
      primaryForeground: "#0a1630",
      secondary: "#1b2b47",
      secondaryForeground: "#e6eef9",
      muted: "#182640",
      mutedForeground: "#93a5c0",
      accent: "#1e3257",
      accentForeground: "#bcd4ff",
      destructive: "#ff6b6b",
      destructiveForeground: "#ffffff",
      border: "#24365a",
      input: "#24365a",
      ring: "#6da3ff",
      success: "#34d399",
      warning: "#fbbf24",
      chart1: "#6da3ff",
      chart2: "#34d399",
      chart3: "#22d3ee",
      chart4: "#a78bfa",
      chart5: "#f472b6",
      sidebar: "#0d1626",
      sidebarForeground: "#e6eef9",
      sidebarPrimary: "#6da3ff",
      sidebarPrimaryForeground: "#0a1630",
      sidebarAccent: "#1c3050",
      sidebarAccentForeground: "#bcd4ff",
      sidebarBorder: "#24365a",
      sidebarRing: "#6da3ff",
    },
  },

  forest: {
    light: {
      background: "#f8faf7",
      foreground: "#14251c",
      card: "#ffffff",
      cardForeground: "#14251c",
      popover: "#ffffff",
      popoverForeground: "#14251c",
      primary: "#177245",
      primaryForeground: "#ffffff",
      secondary: "#eef4ef",
      secondaryForeground: "#1d3a2a",
      muted: "#eef4ef",
      mutedForeground: "#5f7669",
      accent: "#e0f0e6",
      accentForeground: "#14532d",
      destructive: "#c0392b",
      destructiveForeground: "#ffffff",
      border: "#dde8e0",
      input: "#dde8e0",
      ring: "#177245",
      success: "#0e9f6e",
      warning: "#b45309",
      chart1: "#177245",
      chart2: "#0e9f6e",
      chart3: "#84cc16",
      chart4: "#ca8a04",
      chart5: "#e4578f",
      sidebar: "#f2f7f3",
      sidebarForeground: "#14251c",
      sidebarPrimary: "#177245",
      sidebarPrimaryForeground: "#ffffff",
      sidebarAccent: "#e0f0e6",
      sidebarAccentForeground: "#14532d",
      sidebarBorder: "#dde8e0",
      sidebarRing: "#177245",
    },
    dark: {
      background: "#0a140e",
      foreground: "#e4efe7",
      card: "#111f16",
      cardForeground: "#e4efe7",
      popover: "#111f16",
      popoverForeground: "#e4efe7",
      primary: "#57c98a",
      primaryForeground: "#082415",
      secondary: "#1b2f22",
      secondaryForeground: "#e4efe7",
      muted: "#182a1e",
      mutedForeground: "#8fa799",
      accent: "#1e3a29",
      accentForeground: "#a7f3d0",
      destructive: "#f87171",
      destructiveForeground: "#ffffff",
      border: "#243a2c",
      input: "#243a2c",
      ring: "#57c98a",
      success: "#34d399",
      warning: "#fbbf24",
      chart1: "#57c98a",
      chart2: "#34d399",
      chart3: "#a3e635",
      chart4: "#fbbf24",
      chart5: "#f472b6",
      sidebar: "#0e1a12",
      sidebarForeground: "#e4efe7",
      sidebarPrimary: "#57c98a",
      sidebarPrimaryForeground: "#082415",
      sidebarAccent: "#1b3325",
      sidebarAccentForeground: "#a7f3d0",
      sidebarBorder: "#243a2c",
      sidebarRing: "#57c98a",
    },
  },

  rose: {
    light: {
      background: "#fdfaf9",
      foreground: "#2b1a1f",
      card: "#ffffff",
      cardForeground: "#2b1a1f",
      popover: "#ffffff",
      popoverForeground: "#2b1a1f",
      primary: "#b8436f",
      primaryForeground: "#ffffff",
      secondary: "#f7eef2",
      secondaryForeground: "#4a2b37",
      muted: "#f7eef2",
      mutedForeground: "#8a6f7a",
      accent: "#fbe3ec",
      accentForeground: "#831843",
      destructive: "#d92d4b",
      destructiveForeground: "#ffffff",
      border: "#eedbe4",
      input: "#eedbe4",
      ring: "#b8436f",
      success: "#0e9f6e",
      warning: "#b45309",
      chart1: "#b8436f",
      chart2: "#d96f92",
      chart3: "#e8a93c",
      chart4: "#9a7ae0",
      chart5: "#3aa0a0",
      sidebar: "#faf4f6",
      sidebarForeground: "#2b1a1f",
      sidebarPrimary: "#b8436f",
      sidebarPrimaryForeground: "#ffffff",
      sidebarAccent: "#fbe3ec",
      sidebarAccentForeground: "#831843",
      sidebarBorder: "#eedbe4",
      sidebarRing: "#b8436f",
    },
    dark: {
      background: "#150d10",
      foreground: "#f7e9ee",
      card: "#1f1419",
      cardForeground: "#f7e9ee",
      popover: "#1f1419",
      popoverForeground: "#f7e9ee",
      primary: "#f07ba8",
      primaryForeground: "#2a0f1c",
      secondary: "#2e1d25",
      secondaryForeground: "#f7e9ee",
      muted: "#2a1a21",
      mutedForeground: "#b396a2",
      accent: "#3a2130",
      accentForeground: "#fbc7d9",
      destructive: "#ff6b81",
      destructiveForeground: "#ffffff",
      border: "#3d2833",
      input: "#3d2833",
      ring: "#f07ba8",
      success: "#34d399",
      warning: "#fbbf24",
      chart1: "#f07ba8",
      chart2: "#f98fb4",
      chart3: "#f5c95a",
      chart4: "#b9a3f5",
      chart5: "#55c7c7",
      sidebar: "#191013",
      sidebarForeground: "#f7e9ee",
      sidebarPrimary: "#f07ba8",
      sidebarPrimaryForeground: "#2a0f1c",
      sidebarAccent: "#361d2b",
      sidebarAccentForeground: "#fbc7d9",
      sidebarBorder: "#3d2833",
      sidebarRing: "#f07ba8",
    },
  },

  midnight: {
    light: {
      background: "#f7f7fa",
      foreground: "#1b1b2f",
      card: "#ffffff",
      cardForeground: "#1b1b2f",
      popover: "#ffffff",
      popoverForeground: "#1b1b2f",
      primary: "#4f46e5",
      primaryForeground: "#ffffff",
      secondary: "#eff0f8",
      secondaryForeground: "#2d2d4a",
      muted: "#efeff7",
      mutedForeground: "#63637f",
      accent: "#e7e8fb",
      accentForeground: "#3730a3",
      destructive: "#d92d4b",
      destructiveForeground: "#ffffff",
      border: "#e2e3f0",
      input: "#e2e3f0",
      ring: "#4f46e5",
      success: "#0e9f6e",
      warning: "#b45309",
      chart1: "#4f46e5",
      chart2: "#7c3aed",
      chart3: "#0891b2",
      chart4: "#d97706",
      chart5: "#e4578f",
      sidebar: "#f1f1f8",
      sidebarForeground: "#1b1b2f",
      sidebarPrimary: "#4f46e5",
      sidebarPrimaryForeground: "#ffffff",
      sidebarAccent: "#e7e8fb",
      sidebarAccentForeground: "#3730a3",
      sidebarBorder: "#e2e3f0",
      sidebarRing: "#4f46e5",
    },
    dark: {
      background: "#0b0b16",
      foreground: "#e8e8f4",
      card: "#141428",
      cardForeground: "#e8e8f4",
      popover: "#141428",
      popoverForeground: "#e8e8f4",
      primary: "#818cf8",
      primaryForeground: "#14142e",
      secondary: "#232342",
      secondaryForeground: "#e8e8f4",
      muted: "#1f1f3a",
      mutedForeground: "#9a9ac2",
      accent: "#2b2b54",
      accentForeground: "#c7cdfb",
      destructive: "#ff6b81",
      destructiveForeground: "#ffffff",
      border: "#30305a",
      input: "#30305a",
      ring: "#818cf8",
      success: "#34d399",
      warning: "#fbbf24",
      chart1: "#818cf8",
      chart2: "#a78bfa",
      chart3: "#22d3ee",
      chart4: "#f59e0b",
      chart5: "#f472b6",
      sidebar: "#101021",
      sidebarForeground: "#e8e8f4",
      sidebarPrimary: "#818cf8",
      sidebarPrimaryForeground: "#14142e",
      sidebarAccent: "#262649",
      sidebarAccentForeground: "#c7cdfb",
      sidebarBorder: "#30305a",
      sidebarRing: "#818cf8",
    },
  },
};
