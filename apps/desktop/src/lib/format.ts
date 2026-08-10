import { formatCurrency, formatDate, formatDateTime } from "@munim/core";

/** INR shorthand used across the desktop app. */
export function money(value: number): string {
  return formatCurrency(value, "INR");
}

export { formatCurrency, formatDate, formatDateTime };
