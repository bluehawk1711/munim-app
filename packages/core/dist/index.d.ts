/**
 * @munim/core — the shared brain of the munim monorepo.
 *
 * Every app (web, desktop, mobile) imports from here. All database schema,
 * connection logic, and business rules live in this one package — there is
 * NO separate API server.
 */
export { createDb, getDb, pingDatabase, parseConnectionString, type DbClient } from "./db/client.js";
export * as schema from "./db/schema.js";
export type * from "./db/schema.js";
export { and, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
export * from "./billing/index.js";
export * from "./security/index.js";
export { numberToWords, amountInWords } from "./utils/numberToWords.js";
export { generateSku, generateInvoiceNumber } from "./utils/codes.js";
export { normalizeBarcode, isEan13, ean13CheckDigit, generateEan13, barcodeSvg, ean13Svg, code39Svg, type BarcodeSvgOptions, } from "./utils/barcode.js";
export { formatCurrency, formatNumber, formatDate, formatDateTime, monthLabel, formatWeight } from "./utils/format.js";
export { newId } from "./utils/id.js";
export { swatchColor } from "./utils/swatch.js";
export { uploadImageToCloudinary, uploadImageToCloudinarySigned, type CloudinaryCredentials, type CloudinaryUploadFile, } from "./utils/cloudinary.js";
export * from "./validators/index.js";
export * from "./serialize/index.js";
export * from "./services/catalog.js";
export * from "./services/products.js";
export * from "./services/invoices.js";
export * from "./services/parties.js";
export * from "./services/advances.js";
export * from "./services/jobLetters.js";
export * from "./services/settings.js";
export * from "./services/dashboard.js";
export { logActivity } from "./services/activity.js";
//# sourceMappingURL=index.d.ts.map