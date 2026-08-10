import { generateSku as coreSku, generateInvoiceNumber as coreInvoice, eq, schema } from "@munim/core";
import { db } from "./db";

export async function generateSku(): Promise<string> {
  return coreSku(async (sku) => {
    const rows = await db.select({ id: schema.products.id }).from(schema.products).where(eq(schema.products.sku, sku));
    return rows.length > 0;
  });
}

export async function generateInvoiceNumber(): Promise<string> {
  return coreInvoice(async (invoiceNumber) => {
    const rows = await db.select({ id: schema.invoices.id }).from(schema.invoices).where(eq(schema.invoices.invoiceNumber, invoiceNumber));
    return rows.length > 0;
  });
}
