/**
 * preview-bills — renders two dummy bills (one GOLD, one SILVER) locally so
 * you can see how a bill looks before printing real ones.
 *
 * Pure in-memory: NO database access, nothing seeded (AGENTS.md §7 safe).
 * Uses the SAME core pipeline the apps use — `buildBillDocument` +
 * `generateBillPDF` (the real Classic Jewellery / E-commerce templates that
 * web & desktop print) + `renderBillHtml` / `renderBillText` (what mobile
 * prints/copies). jsPDF's Node build saves `Bill_<no>.pdf` into the cwd
 * (packages/core when run via pnpm), so each render is renamed into
 * <repo>/bill-previews/ with a template-specific name.
 *
 * Run:  pnpm --filter @munim/core preview:bills
 * Out:  <repo>/bill-previews/
 *   gold-classic-jewellery.pdf   gold bill, Classic Jewellery (red) template
 *   gold-ecommerce.pdf           gold bill, Modern E-commerce template
 *   silver-classic-jewellery.pdf silver bill, Classic Jewellery (red)
 *   silver-ecommerce.pdf         silver bill, Modern E-commerce
 *   gold-mobile-print.html       gold bill, mobile print (expo-print) look
 *   silver-mobile-print.html     silver bill, mobile print look
 *   gold.txt / silver.txt        plain-text copy/share render
 */
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  mergeBillTemplateSettings,
  renderBillText,
} from "../src/billing/billDocument";
import type { BillDocument, BillTemplateSettings } from "../src/billing/billDocument";
import { renderBillHtml } from "../src/billing/billHtml";
import { buildSampleBill } from "../src/billing/sampleBill";
import { generateBillPDF } from "../src/billing/generateBillPdf";

const cwd = process.cwd();
const outDir = join(cwd, "..", "..", "bill-previews");

/** GOLD bill — 22K items, per-bill gold rate, material returned, PARTIAL. */
const goldBill = buildSampleBill("gold");
/** SILVER bill — per-bill silver rate (₹/10g shop entry = 80.25/g), PAID. */
const silverBill = buildSampleBill("silver");

const classic: BillTemplateSettings = mergeBillTemplateSettings({
  template: "jewellery",
  classicColor: "red",
});
const ecommerce: BillTemplateSettings = mergeBillTemplateSettings({
  template: "ecommerce",
});

function renderPdf(bill: BillDocument, settings: BillTemplateSettings, outName: string): void {
  const savedPath = join(cwd, `Bill_${bill.billNo}.pdf`);
  rmSync(savedPath, { force: true });
  generateBillPDF(bill, settings);
  if (!existsSync(savedPath)) throw new Error(`jsPDF did not write ${savedPath}`);
  renameSync(savedPath, join(outDir, outName));
  console.log(`  ${join(outDir, outName)}`);
}

mkdirSync(outDir, { recursive: true });

console.log("Rendering bill previews to", outDir);
renderPdf(goldBill, classic, "gold-classic-jewellery.pdf");
renderPdf(goldBill, ecommerce, "gold-ecommerce.pdf");
renderPdf(silverBill, classic, "silver-classic-jewellery.pdf");
renderPdf(silverBill, ecommerce, "silver-ecommerce.pdf");

writeFileSync(join(outDir, "gold-mobile-print.html"), renderBillHtml(goldBill));
writeFileSync(join(outDir, "silver-mobile-print.html"), renderBillHtml(silverBill));
writeFileSync(join(outDir, "gold.txt"), renderBillText(goldBill));
writeFileSync(join(outDir, "silver.txt"), renderBillText(silverBill));
console.log(`  ${join(outDir, "gold-mobile-print.html")}`);
console.log(`  ${join(outDir, "silver-mobile-print.html")}`);
console.log(`  ${join(outDir, "gold.txt")}`);
console.log(`  ${join(outDir, "silver.txt")}`);
console.log("Done.");
