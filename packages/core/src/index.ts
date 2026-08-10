/**
 * @munim/core — the shared brain of the munim monorepo.
 *
 * Every app (web, desktop, mobile) imports from here. All database schema,
 * connection logic, and business rules live in this one package — there is
 * NO separate API server.
 */

/* DB */
export { createDb, getDb, pingDatabase, parseConnectionString, type DbClient } from "./db/client";
export * as schema from "./db/schema";
export type * from "./db/schema";

/* Drizzle operators re-exported so every app uses the SAME instance as core
 * (importing from their own node_modules created a duplicate-instance type
 * mismatch when @neondatabase/serverless was added as a peer). */
export { and, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";

/* Billing — shared bill/invoice generation (all 3 apps) */
export * from "./billing";

/* Utils */
export { numberToWords, amountInWords } from "./utils/numberToWords";
export { generateSku, generateInvoiceNumber } from "./utils/codes";
export { formatCurrency, formatNumber, formatDate, formatDateTime, monthLabel } from "./utils/format";
export { newId } from "./utils/id";
export { swatchColor } from "./utils/swatch";

/* Services */
export * from "./services/catalog";
export * from "./services/products";
export * from "./services/invoices";
export * from "./services/parties";
export * from "./services/advances";
export * from "./services/jobLetters";
export * from "./services/settings";
export * from "./services/dashboard";
export { logActivity } from "./services/activity";
