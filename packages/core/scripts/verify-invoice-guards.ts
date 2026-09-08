/**
 * One-off verification of the 0-rupee-bill guards in createInvoice.
 * Expects: zero-price item → ZERO_PRICE_ITEM, zero total → ZERO_TOTAL.
 * Creates one real invoice with valid data, then deletes it.
 */
import { eq } from "drizzle-orm";
import { getDb } from "../src/db/client";
import * as schema from "../src/db/schema";
import { createInvoice, InvoiceError } from "../src/services/invoices";

async function expectError(name: string, run: () => Promise<unknown>, code: string) {
  try {
    await run();
    console.log(`${name}: FAILED — no error thrown`);
    process.exitCode = 1;
  } catch (e) {
    if (e instanceof InvoiceError && e.code === code) {
      console.log(`${name}: OK (${e.code} — ${e.message})`);
      return;
    }
    console.log(`${name}: FAILED — wrong error`, e);
    process.exitCode = 1;
  }
}

async function main() {
  const db = getDb();

  await expectError(
    "zero-price item",
    () =>
      createInvoice(db, {
        customerName: "ZZZ-Guard-Verify",
        items: [{ productName: "Test", quantity: 1, price: 0 }],
      }),
    "ZERO_PRICE_ITEM",
  );

  await expectError(
    "zero-qty item",
    () =>
      createInvoice(db, {
        customerName: "ZZZ-Guard-Verify",
        items: [{ productName: "Test", quantity: 0, price: 100 }],
      }),
    "BAD_QUANTITY",
  );

  await expectError(
    "zero total (discount exceeds subtotal)",
    () =>
      createInvoice(db, {
        customerName: "ZZZ-Guard-Verify",
        items: [{ productName: "Test", quantity: 1, price: 100 }],
        discount: 100,
      }),
    "ZERO_TOTAL",
  );

  // Delivery charge IS correctly added to the total.
  const inv = await createInvoice(db, {
    customerName: "ZZZ-Guard-Verify",
    items: [{ productName: "Test", quantity: 2, price: 100 }],
    discount: 50,
    deliveryCharge: 40,
  });
  console.log(
    `delivery math: subtotal 200 − 50 discount + 40 delivery → total ${inv.total} (expect 190): ${inv.total === 190 ? "OK" : "FAILED"}`,
  );
  if (inv.total !== 190) process.exitCode = 1;

  await db.delete(schema.invoices).where(eq(schema.invoices.id, inv.id));
  console.log("cleaned up verification invoice:", inv.invoiceNumber);
}

main().catch((e) => {
  console.error("VERIFY FAILED:", e);
  process.exit(1);
});
