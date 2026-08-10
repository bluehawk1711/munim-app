/**
 * Generates `dist/tokens.css` (CSS custom properties) from `src/tokens.ts`.
 * Run via `pnpm --filter @munim/theme build` AFTER `tsc` so it can import the
 * compiled JS. Web + desktop both `@import "@munim/theme/tokens.css"`.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { theme, radius } from "../dist/index.js";

/** cardForeground -> card-foreground, chart1 -> chart-1 */
function cssName(key) {
  return key
    .replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())
    .replace(/(\d)/, "-$1");
}

const lines = [
  "/* AUTO-GENERATED from packages/theme/src/tokens.ts — do not edit.",
  "   Change tokens there, then run `pnpm --filter @munim/theme build`. */",
  ":root {",
  `  --radius: ${radius};`,
];
for (const [key, value] of Object.entries(theme.light)) {
  lines.push(`  --${cssName(key)}: ${value};`);
}
lines.push("}", "", ".dark {");
for (const [key, value] of Object.entries(theme.dark)) {
  lines.push(`  --${cssName(key)}: ${value};`);
}
lines.push("}", "");

const outPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "dist",
  "tokens.css",
);
writeFileSync(outPath, lines.join("\n"), "utf8");
console.log(`theme: wrote ${outPath}`);
