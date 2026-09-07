import { createInvoice, InvoiceError } from "../src/services/invoices";
import { getDb } from "../src/db/client";

const db = getDb();
try {
  await createInvoice(db, { customerName: "T", items: [{ productName: "X", quantity: 1, price: 0 }] });
  console.log("NO ERROR THROWN");
} catch (e) {
  console.log("typeof:", typeof e);
  console.log("instanceof Error:", e instanceof Error);
  console.log("instanceof InvoiceError:", e instanceof InvoiceError);
  console.log("own keys:", Object.getOwnPropertyNames(e));
  console.log("e.code:", JSON.stringify((e as { code?: string }).code));
  console.log("msg:", (e as Error).message);
}
