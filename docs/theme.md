# Theme — one place to restyle every Munim app

All visual tokens live in **`packages/theme/src/tokens.ts`** — the single
source of truth for the **web**, **desktop** and **mobile** apps.

## Change the look of ALL apps in 3 steps

1. Edit `packages/theme/src/tokens.ts` (hex values, light + dark palettes,
   `radius`).
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
| Mobile | `apps/mobile/src/components/ui.tsx` | `import { mobileColors } from "@munim/theme"` — a hex palette mapped from the shared light tokens (RN can't read CSS variables) |

## Token anatomy

- `theme.light` / `theme.dark` — semantic colors (background, foreground,
  card, primary, secondary, muted, accent, destructive, border, ring,
  success, warning, chart-1…5, sidebar…).
- `radius` — shared border radius (`0.75rem`); apps derive `sm/md/lg/xl`
  from it.
- `mobileColors` — the exact object shape the mobile screens already use
  (`bg`, `card`, `text`, `muted`, `border`, `primary`, `success`, `danger`,
  `warning`, plus soft-tints and `onPrimary`), derived from the light tokens.

## Why hex?

The React Native color parser (verified on RN 0.86.2) returns `null` for
`oklch()` / `oklab()` / `color()` strings. Hex is parsed identically by CSS
and RN, so hex is the canonical format of the token file. The original
Apple-neutral palette was converted from oklch to hex (values are
bit-identical to what the apps rendered before).

## Dark mode

- Web + desktop toggle `.dark` on the root element; `tokens.css` supplies
  both `:root` and `.dark` variable sets.
- Mobile is light-only today and consumes the light palette via
  `mobileColors`. The `theme.dark` set is available for a future dark-mode
  pass (would need `mobileColors` to become scheme-aware).

## Reminders

- Commit `packages/theme/dist/tokens.css` whenever `tokens.ts` changes
  (it is generated, but checked in so apps can build without a preceding
  theme build).
- Don't hardcode palette colors in app code — import the token instead.
