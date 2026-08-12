# @munim/theme — single source of truth for the Munim design system

Every color, radius, and visual token used by **web**, **desktop** and **mobile**
lives in exactly one file: [`src/tokens.ts`](src/tokens.ts).

## How to change the look of ALL apps

1. Edit `src/tokens.ts` (hex values, light + dark).
2. Rebuild: `pnpm --filter @munim/theme build`
3. Restart/reload the apps.

That's it — no other file needs touching.

## How each platform consumes it

| Platform | Mechanism |
|---|---|
| **Web** (`apps/web`) | `globals.css` does `@import "@munim/theme/tokens.css"` — generated CSS custom properties (`--background`, `--primary`, …) + `--radius`. Tailwind v4 maps them via `@theme inline`. |
| **Desktop** (`apps/desktop`) | Same `@import "@munim/theme/tokens.css"` in `src/index.css`. |
| **Mobile** (`apps/mobile`) | React Native can't read CSS variables and its color parser rejects `oklch()`, so it imports `mobileColors` from `@munim/theme` — a hex palette mapped from the shared light tokens. |

## Why hex?

The RN color parser (verified on RN 0.86.2) returns `null` for `oklch()` /
`oklab()` / `color()` strings. Hex works identically in CSS and RN, so hex is
the cross-platform format of the token file.

## Generated file

`dist/tokens.css` is produced by `scripts/generate-css.mjs` from the compiled
tokens — commit it, and remember to commit it again whenever you change
`tokens.ts` (or just rebuild the theme package before committing).

## Mobile palette

`src/mobile.ts` exposes `mobileColorsFor(mode, themeName)` which maps the
selected theme's light **or dark** tokens onto the shape the mobile screens
use (`bg`, `card`, `text`, `muted`, `border`, `primary`, `success`, `danger`,
`warning`, …) plus badge soft-tints and the input placeholder. Mobile supports
light AND dark across all 5 themes (see `docs/theme.md`); `mobileColors`
remains as the light-mode shorthand for back-compat.
