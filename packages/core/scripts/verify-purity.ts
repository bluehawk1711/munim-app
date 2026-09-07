/**
 * One-off end-to-end verification of the `purity` field (migration 0004).
 * Creates a temp product, verifies persistence via the serializer DTO,
 * exercises edit-clear semantics, then deletes itself. Safe to re-run
 * (removes leftovers from previous runs first).
 */
import { and, eq, like } from "drizzle-orm";
import { getDb } from "../src/db/client";
import * as schema from "../src/db/schema";
import {
  createProduct,
  updateProduct,
  getProduct,
  deleteProduct,
} from "../src/services/products";

const TEMP_NAME = "ZZZ-Purity-Verify-Temp";

async function main() {
  const db = getDb();

  // Clean up leftovers from any previous failed run.
  const leftovers = await db
    .select({ id: schema.products.id })
    .from(schema.products)
    .where(like(schema.products.name, `${TEMP_NAME}%`));
  for (const row of leftovers) {
    await deleteProduct(db, row.id);
  }
  if (leftovers.length > 0) console.log(`cleaned ${leftovers.length} leftover temp product(s)`);

  // Real callers always send name/size (required fields) — match that shape.
  const created = await createProduct(db, {
    name: TEMP_NAME,
    size: "Free",
    purity: "22K",
    sellingPrice: 100,
  });
  console.log("create  → purity:", JSON.stringify(created.purity));

  const fetched = await getProduct(db, created.id);
  console.log("read    → purity:", JSON.stringify(fetched?.purity));

  // Edit semantics: purity set, then cleared; name/size resent as forms do.
  const updated = await updateProduct(db, created.id, {
    name: TEMP_NAME,
    size: "Free",
    purity: "916",
  });
  console.log("update  → purity:", JSON.stringify(updated?.purity));

  const cleared = await updateProduct(db, created.id, {
    name: TEMP_NAME,
    size: "Free",
    purity: "",
  });
  console.log("clear   → purity:", JSON.stringify(cleared?.purity));

  const kept = await updateProduct(db, created.id, {
    name: TEMP_NAME,
    size: "Free",
  });
  console.log("omit    → purity (should stay null):", JSON.stringify(kept?.purity));

  await deleteProduct(db, created.id);
  const gone = await getProduct(db, created.id);
  console.log("deleted temp product:", created.id, "| still readable:", gone !== null);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("VERIFY FAILED:", e);
    process.exit(1);
  });
