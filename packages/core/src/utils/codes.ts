// Generates unique SKUs, invoice numbers and order numbers without hard-coding
// a DB driver. The caller passes an `exists` predicate so the same logic runs
// in every app.

function randomCode(length: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

/**
 * Format: 5 unambiguous characters (no `PRD-` prefix since 2026-09) — short
 * enough to type at the counter, scan-safe, and unique via the caller's
 * exists-predicate + the DB's unique constraint (32^5 ≈ 33.5M combinations).
 * Existing 6-char and `PRD-XXXXXX` SKUs stay valid forever (lookups accept
 * any format).
 */
export async function generateSku(exists: (sku: string) => Promise<boolean>): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode(5);
    if (!(await exists(code))) return code;
  }
  return `${randomCode(5)}${Date.now().toString(36).slice(-3).toUpperCase()}`;
}

/**
 * Format: `INV-4CHAR` (e.g. `INV-7K2M`) — the 4-char code is the searchable
 * part; use {@link stripCodePrefix} so typing the bare code finds the bill.
 * Legacy `INV-YYYYMMDD-XXXX` numbers remain valid forever.
 */
export async function generateInvoiceNumber(
  exists: (invoiceNumber: string) => Promise<boolean>,
): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const invoice = `INV-${randomCode(4)}`;
    if (!(await exists(invoice))) return invoice;
  }
  return `INV-${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

/**
 * Format: `ORD-4CHAR` (e.g. `ORD-7K2M`) — same 4-char code style as bills so
 * the counter can read either out loud without thinking.
 */
export async function generateOrderNumber(
  exists: (orderNumber: string) => Promise<boolean>,
): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const order = `ORD-${randomCode(4)}`;
    if (!(await exists(order))) return order;
  }
  return `ORD-${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

/**
 * Drops the fixed `INV-` / `ORD-` prefixes so searches match the bare code:
 * searching "7K2M" finds both ORD-7K2M and INV-7K2M, and searching the full
 * "INV-7K2M" also works. A prefix WITHOUT its trailing dash ("INV") is left
 * alone so it doesn't match every number in the table.
 */
export function stripCodePrefix(value: string): string {
  return value.replace(/^(?:INV|ORD)-/i, "");
}

/**
 * Prefix-insensitive, case-insensitive search match for bill/order numbers.
 * Empty/whitespace query matches everything (caller usually guards first).
 */
export function codeMatches(
  haystack: string | null | undefined,
  query: string,
): boolean {
  if (!haystack) return false;
  const needle = stripCodePrefix(query).trim().toLowerCase();
  if (!needle) return true;
  return stripCodePrefix(haystack).toLowerCase().includes(needle);
}
