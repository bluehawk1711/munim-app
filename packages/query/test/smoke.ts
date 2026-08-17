/**
 * Light smoke — verifies the shared hook surface + query keys compile and hang
 * together. Real behavior is exercised through the apps' typecheck/build and
 * the live-DB e2e (the hooks just call the already-tested api-client).
 */
import {
  QueryProvider,
  useApiClient,
  useDashboard,
  useProducts,
  useInvoices,
  useSales,
  useParties,
  usePartyBalances,
  useAdvances,
  usePayments,
  useCatalog,
  useJobLetters,
  useReport,
  useSettings,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useAdjustStock,
  useBackfillBarcodes,
  useCreateInvoice,
  useDeleteInvoice,
  useRecordInvoicePayment,
  useCreateSale,
  useUndoSale,
  useCreateParty,
  useUpdateParty,
  useDeleteParty,
  useCreateAdvance,
  useSettleAdvance,
  useDeleteAdvance,
  useRecordPartyPayment,
  useCreateCatalogItem,
  useUpdateCatalogItem,
  useDeleteCatalogItem,
  useSaveJobLetter,
  useDeleteJobLetter,
  useUpdateSettings,
  useProductMeta,
  useProductByBarcode,
  useProductMovements,
  useInvoice,
  useParty,
  qk,
} from "../src/index.js";

let passed = 0;
function check(name: string, ok: boolean) {
  if (!ok) {
    console.error(`FAIL ${name}`);
    process.exit(1);
  }
  passed++;
  console.log(`PASS ${name}`);
}

check("QueryProvider exported", typeof QueryProvider === "function");
check("useApiClient exported", typeof useApiClient === "function");

// Every hook is exported.
const hooks = [
  useDashboard, useProducts, useProductMeta, useProductByBarcode,
  useProductMovements, useCreateProduct, useUpdateProduct, useDeleteProduct,
  useAdjustStock, useBackfillBarcodes, useInvoices, useInvoice,
  useCreateInvoice, useDeleteInvoice, useRecordInvoicePayment, useSales,
  useCreateSale, useUndoSale, useParties, usePartyBalances, useParty,
  useCreateParty, useUpdateParty, useDeleteParty, useAdvances,
  useCreateAdvance, useSettleAdvance, useDeleteAdvance, usePayments,
  useRecordPartyPayment, useCatalog, useCreateCatalogItem,
  useUpdateCatalogItem, useDeleteCatalogItem, useJobLetters,
  useSaveJobLetter, useDeleteJobLetter, useReport, useSettings,
  useUpdateSettings,
];
check(`all ${hooks.length} hooks exported`, hooks.every((h) => typeof h === "function"));

// Query keys are stable, namespaced and JSON-serializable (cache contract).
check("dashboard key", JSON.stringify(qk.dashboard) === '["dashboard"]');
check(
  "products list key is filter-stable",
  JSON.stringify(qk.products.list({ search: "x", page: 1 })) ===
    '["products","list",{"search":"x","page":1}]',
);
check(
  "parties balances key",
  JSON.stringify(qk.parties.balances) === '["parties","balances"]',
);
check("settings key", JSON.stringify(qk.settings) === '["settings"]');
check("catalog list key", JSON.stringify(qk.catalog.list("color")) === '["catalog","color"]');
check("advances list key", JSON.stringify(qk.advances.list()) === '["advances","all"]');

console.log(`\nQUERY SMOKE OK (${passed} checks)`);
