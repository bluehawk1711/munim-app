/**
 * Best-effort hex approximation for common color names; falls back to a
 * neutral tone so the swatch chip still renders something sensible.
 *
 * Shared by all three apps (web catalog view, desktop catalog page, mobile
 * catalog screen) — one implementation instead of three.
 */
export function swatchColor(name: string): string {
  const map: Record<string, string> = {
    black: "#18181b",
    white: "#fafafa",
    navy: "#1e3a5f",
    blue: "#2563eb",
    red: "#dc2626",
    green: "#16a34a",
    grey: "#6b7280",
    gray: "#6b7280",
    brown: "#92400e",
    olive: "#4d7c0f",
    silver: "#cbd5e1",
    teal: "#0d9488",
    amber: "#d97706",
    yellow: "#eab308",
    purple: "#7c3aed",
    pink: "#ec4899",
    orange: "#ea580c",
    gold: "#d4a017",
  };
  const key = name.toLowerCase();
  for (const [k, v] of Object.entries(map)) {
    if (key === k || key.includes(k)) return v;
  }
  // NOTE: must stay hex — React Native's color parser rejects oklch/hsl, and
  // this function is shared by the mobile catalog screen too.
  return "#b8b3ad";
}
