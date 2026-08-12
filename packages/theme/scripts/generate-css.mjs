/**
 * Generates `dist/tokens.css` (CSS custom properties) from `src/tokens.ts`.
 * Run via `pnpm --filter @munim/theme build` AFTER `tsc` so it can import the
 * compiled JS. Web + desktop both `@import "@munim/theme/tokens.css"`.
 *
 * Output shape (one block per theme):
 *   :root, [data-theme="apple"]          → apple light
 *   .dark, [data-theme="apple"].dark     → apple dark
 *   [data-theme="ocean"]                 → ocean light
 *   [data-theme="ocean"].dark            → ocean dark
 *   …
 * Apps switch themes by setting `data-theme` on <html> (web) or the root
 * element (desktop); dark/light mode still toggles via the `.dark` class.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { themes, themeNames, radius } from "../dist/index.js";

/** cardForeground -> card-foreground, chart1 -> chart-1 */
function cssName(key) {
  return key
    .replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())
    .replace(/(\d)/, "-$1");
}

const defaultTheme = "apple";
const lines = [
  "/* AUTO-GENERATED from packages/theme/src/tokens.ts — do not edit.",
  "   Change tokens there, then run `pnpm --filter @munim/theme build`. */",
];

for (const name of themeNames) {
  const t = themes[name];
  if (!t) continue;
  const lightSel = name === defaultTheme ? ':root, [data-theme="apple"]' : `[data-theme="${name}"]`;
  const darkSel = name === defaultTheme ? '.dark, [data-theme="apple"].dark' : `[data-theme="${name}"].dark`;

  lines.push(`${lightSel} {`, `  --radius: ${radius};`);
  for (const [key, value] of Object.entries(t.light)) {
    lines.push(`  --${cssName(key)}: ${value};`);
  }
  lines.push("}", "");

  lines.push(`${darkSel} {`, `  --radius: ${radius};`);
  for (const [key, value] of Object.entries(t.dark)) {
    lines.push(`  --${cssName(key)}: ${value};`);
  }
  lines.push("}", "");
}

// ── Shared UI helpers (consumed by web + desktop, imported from tokens.css) ──

lines.push(
  `/* Left-to-right shimmer for loading skeletons (premium alternative to pulse) */`,
  `@keyframes munim-shimmer {`,
  `  0% { background-position: -200% 0; }`,
  `  100% { background-position: 200% 0; }`,
  `}`,
  `.skeleton-shimmer {`,
  `  background: linear-gradient(90deg, var(--border) 25%, var(--muted) 50%, var(--border) 75%);`,
  `  background-size: 200% 100%;`,
  `  animation: munim-shimmer 1.6s ease-in-out infinite;`,
  `}`,
  `.dark .skeleton-shimmer {`,
  `  background: linear-gradient(90deg, var(--secondary) 25%, var(--border) 50%, var(--secondary) 75%);`,
  `  background-size: 200% 100%;`,
  `}`,
  ``,
  `/* Thin themed scrollbars everywhere (incl. dialog contents) */`,
  `* {`,
  `  scrollbar-width: thin;`,
  `  scrollbar-color: var(--border) transparent;`,
  `}`,
  `*::-webkit-scrollbar { width: 8px; height: 8px; }`,
  `*::-webkit-scrollbar-track { background: transparent; }`,
  `*::-webkit-scrollbar-thumb { background: var(--border); border-radius: 9999px; }`,
  `*::-webkit-scrollbar-thumb:hover { background: var(--muted-foreground); }`,
  `*::-webkit-scrollbar-corner { background: transparent; }`,
  ``,
);

const outPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "dist",
  "tokens.css",
);
writeFileSync(outPath, lines.join("\n"), "utf8");
console.log(`theme: wrote ${outPath}`);
