/**
 * Light smoke — the store factory works without React (vanilla zustand state),
 * actions mutate state, and the instance is isolated per call.
 */
import { createAppStore } from "../src/index.js";

let passed = 0;
function check(name: string, ok: boolean) {
  if (!ok) {
    console.error(`FAIL ${name}`);
    process.exit(1);
  }
  passed++;
  console.log(`PASS ${name}`);
}

const store = createAppStore("home");

check("initial view", store.getState().activeView === "home");
check("initial search", store.getState().globalSearch === "");
check("initial filters are 'all'", store.getState().productColorFilter === "all");

store.getState().setActiveView("products");
check("setActiveView", store.getState().activeView === "products");

store.getState().setGlobalSearch("gold");
check("setGlobalSearch", store.getState().globalSearch === "gold");

const n0 = store.getState().searchNonce;
store.getState().bumpSearch();
check("bumpSearch increments", store.getState().searchNonce === n0 + 1);

store.getState().setSellDialogOpen(true);
check("setSellDialogOpen", store.getState().sellDialogOpen === true);

store.getState().setProductColorFilter("gold");
store.getState().setProductSizeFilter("S");
store.getState().setProductCategoryFilter("Jewellery");
store.getState().setProductStatusFilter("low_stock");
check(
  "filters set",
  store.getState().productColorFilter === "gold" &&
    store.getState().productSizeFilter === "S" &&
    store.getState().productCategoryFilter === "Jewellery" &&
    store.getState().productStatusFilter === "low_stock",
);

// Instances are isolated (each platform gets its own client state).
const other = createAppStore("dashboard");
check("isolated instances", other.getState().activeView === "dashboard");
other.getState().setActiveView("settings");
check("isolation holds", store.getState().activeView === "products");

console.log(`\nSTORE SMOKE OK (${passed} checks)`);
