// Generates unique SKUs and invoice numbers without hard-coding a DB driver.
// The caller passes an `exists` predicate so the same logic runs in every app.

function randomCode(length: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

/**
 * Format: 6 unambiguous characters (no `PRD-` prefix since 2026-09) — short
 * enough to type at the counter, scan-safe, and unique via the caller's
 * exists-predicate + the DB's unique constraint (32^6 ≈ 1.07B combinations).
 * Existing `PRD-XXXXXX` SKUs stay valid forever (lookups accept any format).
 */
export async function generateSku(exists: (sku: string) => Promise<boolean>): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode(6);
    if (!(await exists(code))) return code;
  }
  return `${randomCode(5)}${Date.now().toString(36).slice(-3).toUpperCase()}`;
}

/** Format: INV-YYYYMMDD-XXXX */
export async function generateInvoiceNumber(
  exists: (invoiceNumber: string) => Promise<boolean>,
): Promise<string> {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  for (let attempt = 0; attempt < 10; attempt++) {
    const seq = Math.floor(1000 + Math.random() * 9000).toString();
    const invoice = `INV-${datePart}-${seq}`;
    if (!(await exists(invoice))) return invoice;
  }
  return `INV-${datePart}-${Date.now().toString().slice(-6)}`;
}
