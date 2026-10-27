/**
 * Payment methods — the presets every app's payment UI shows, plus helpers
 * for the "Custom…" free-text case.
 *
 * `payments.method` stays free text in the DB (legacy rows keep old values
 * like "online"), so these presets are a UI concern: they map a stable id to
 * a label and know how to round-trip a custom value through the picker.
 */

export const PAYMENT_METHOD_PRESETS = [
  { id: "cash", label: "Cash" },
  { id: "upi", label: "UPI" },
  { id: "card", label: "Card" },
  { id: "cheque", label: "Cheque" },
  { id: "bank", label: "Bank transfer" },
] as const;

export type PaymentMethodId = (typeof PAYMENT_METHOD_PRESETS)[number]["id"];

/** Sentinel used by pickers — not stored; the custom text is stored instead. */
export const CUSTOM_PAYMENT_METHOD = "custom" as const;

/** Human label for any stored method value (custom values print as-is). */
export function paymentMethodLabel(method: string | null | undefined): string {
  const raw = (method ?? "").trim();
  if (!raw) return "Cash";
  const preset = PAYMENT_METHOD_PRESETS.find((p) => p.id === raw.toLowerCase());
  if (preset) return preset.label;
  // Legacy value from the old Cash/Online toggle.
  if (raw.toLowerCase() === "online") return "Online";
  // Custom — show the operator's own text (first letter uppercase).
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function isPresetPaymentMethod(method: string | null | undefined): method is PaymentMethodId {
  const value = (method ?? "").trim().toLowerCase();
  return PAYMENT_METHOD_PRESETS.some((p) => p.id === value);
}
