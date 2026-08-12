/**
 * Shared INR formatter for @munim/ui components — one copy instead of a
 * private formatter per component. No runtime deps on @munim/core.
 */
export function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}
