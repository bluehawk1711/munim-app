# Theme — one place to restyle every Munim app

All visual tokens live in **`packages/theme/src/tokens.ts`** — the single
source of truth for the **web**, **desktop** and **mobile** apps.

## The five themes

Munim ships **5 curated color themes**, each with a coherent light + dark pair:

| Name | Light primary | Dark primary | Vibe |
|---|---|---|---|
| `apple` (default) | `#846324` gold | `#b69255` | Warm silver/gold — the original Apple-neutral look |
| `ocean` | `#1d5bd6` | `#6da3ff` | Cool, calm blues |
| `forest` | `#177245` | `#57c98a` | Natural greens |
| `rose` | `#b8436f` | `#f07ba8` | Warm blush pinks |
| `midnight` | `#4f46e5` | `#818cf8` | Deep indigo |

- `themeNames` — the ordered list of names; `themeLabels` — display names;
  `themeSwatches` — the two-tone (primary + accent) swatch used by every
  platform's picker.
- `theme` remains the back-compat alias for the default (`apple`) theme, so
  existing imports keep working.
- `themes` is the full `Record<ThemeName, { light, dark }>`.

## Change the look of ALL apps in 3 steps

1. Edit `packages/theme/src/tokens.ts` (hex values, light + dark palettes,
   `radius`, or add a whole new theme to `themes` + `themeNames`).
2. Rebuild the package: `pnpm --filter @munim/theme build`
   (this regenerates `packages/theme/dist/tokens.css`).
3. Reload the apps.

No other file needs to change. (In CI, `turbo run build` rebuilds the theme
package first because every app's `build`/`typecheck` task `dependsOn ^build`.)

## How each platform consumes the tokens

| Platform | File | Mechanism |
|---|---|---|
| Web | `apps/web/src/app/globals.css` | `@import "@munim/theme/tokens.css"` — CSS custom properties (`--background`, `--primary`, …) + `--radius`; Tailwind v4 maps them via `@theme inline` |
| Desktop | `apps/desktop/src/index.css` | Same `@import "@munim/theme/tokens.css"` |
| Mobile | `apps/mobile/src/theme.tsx` + `apps/mobile/src/components/ui.tsx` | `ui.tsx` re-exports a dynamic `colors` proxy (from `src/theme.tsx`, backed by `@munim/theme`'s `mobileColorsFor(mode, themeName)`) — the active (theme, mode) hex palette (RN can't read CSS variables) |

## Token anatomy

- `themes[name].light` / `.dark` — semantic colors (background, foreground,
  card, primary, secondary, muted, accent, destructive, border, ring,
  success, warning, chart-1…5, sidebar…).
- `radius` — shared border radius (`0.75rem`); apps derive `sm/md/lg/xl`
  from it.
- `mobileColorsFor(mode, themeName = "apple")` — maps the selected theme's
  light/dark tokens onto the exact object shape the mobile screens use (`bg`,
  `card`, `text`, `muted`, `border`, `primary`, `success`, `danger`,
  `warning`, plus soft-tints and `onPrimary`). `mobileColors` is the
  light-mode shorthand (back-compat).

## How theme switching works

### Web (`apps/web/src/components/app/theme-picker.tsx`)

- `next-themes` keeps owning **light/dark** (the `.dark` class on `<html>`).
- A separate `useAccentTheme()` / `AccentThemeProvider` owns the **color
  theme**: it writes `document.documentElement.dataset.theme = "<name>"` and
  persists it in `localStorage` (`munim.theme`).
- `tokens.css` emits one `[data-theme="…"]` block per theme (plus the
  default under `:root` / `.dark`), so setting the attribute swaps every CSS
  variable instantly.
- Pickers: a **Palette dropdown** in the topbar and an **Appearance card** in
  Settings, both using the shared `ThemeSwatches` component (Apple-style
  two-tone circles with a springy check).

### Desktop (`apps/desktop/src/components/theme-swatches.tsx`)

- The custom `ThemeProvider` keeps owning light/dark (the `.dark` class).
- `useAccentTheme()` writes `document.documentElement.dataset.theme` and
  persists in `localStorage` (`munim-desktop-accent-theme`).
- Pickers: **Palette dropdown** in the app-shell topbar and an **Appearance
  card** in Settings — same `ThemeSwatches` UI.

### Mobile (`apps/mobile/src/theme.tsx` + Settings screen)

- `ThemeProvider` owns **both** the accent theme and the mode, persisted in
  AsyncStorage (`munim.accentTheme` / `munim.themeMode`).
- `colors` is still a Proxy, but it now resolves against the active
  (theme, mode) palette — so no screen code changes were needed.
- Picker: a **Color theme** card in Settings with a swatch row (tap → haptic
  tick + instant palette swap).

## Why hex?

The React Native color parser (verified on RN 0.86.2) returns `null` for
`oklch()` / `oklab()` / `color()` strings. Hex is parsed identically by CSS
and RN, so hex is the canonical format of the token file.

## Dark mode

- Web + desktop toggle `.dark` on the root element; `tokens.css` supplies
  `:root`/`.dark` (apple) plus `[data-theme="…"]` / `[data-theme="…"].dark`
  variable sets for every theme.
- Mobile supports light AND dark across all themes. `apps/mobile/src/theme.tsx`
  owns the mode (system default, persisted override) and swaps the palette
  (`mobileColorsFor(mode, themeName)`) before children render. Screens read
  the shared `colors` proxy, so no per-screen theme code is needed — a Dark
  Mode switch and a Color theme picker live in the Settings screen.

## Adding a new theme

1. Add `light` + `dark` `ThemeTokens` objects to `themes` in
   `packages/theme/src/tokens.ts`.
2. Add the name to `themeNames` (drives pickers + CSS generation), plus
   entries in `themeLabels` and `themeSwatches`.
3. Rebuild (`pnpm --filter @munim/theme build`) — the CSS generator and the
   mobile mapper pick the new theme up automatically. No app code changes.

## Reminders

- Commit `packages/theme/dist/tokens.css` whenever `tokens.ts` changes
  (it is generated, but checked in so apps can build without a preceding
  theme build).
- Don't hardcode palette colors in app code — import the token instead.
