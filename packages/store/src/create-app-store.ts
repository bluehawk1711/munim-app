/**
 * Shared CLIENT-state store — the Zustand half of Munim's state layer
 * (server state lives in @munim/query / TanStack Query). This store never
 * fetches; it holds ephemeral UI state that multiple screens read/write:
 *
 *   - activeView            — the current view/tab (web views, mobile tabs…)
 *   - globalSearch          — the header search box (shared across views)
 *   - searchNonce           — bump to force a re-query after a search action
 *   - sellDialogOpen        — the quick-sell dialog (web/desktop header)
 *   - product{Color,Size,Category,Status}Filter — cross-view product filters
 *
 * Each platform creates its OWN instance (client state is per-device) via
 * `createAppStore(initialView)` — the shape + actions are shared, the instance
 * is local. See docs/state-management.md.
 */
import { create } from "zustand";

export type AppClientState = {
  activeView: string;
  globalSearch: string;
  /** Bumped by the header search to force consumers to refetch. */
  searchNonce: number;
  sellDialogOpen: boolean;
  productColorFilter: string;
  productSizeFilter: string;
  productCategoryFilter: string;
  productStatusFilter: string;
  setActiveView: (view: string) => void;
  setGlobalSearch: (value: string) => void;
  bumpSearch: () => void;
  setSellDialogOpen: (open: boolean) => void;
  setProductColorFilter: (value: string) => void;
  setProductSizeFilter: (value: string) => void;
  setProductCategoryFilter: (value: string) => void;
  setProductStatusFilter: (value: string) => void;
};

/**
 * Creates the platform's client-state store hook.
 *
 * @param initialView the initial active view/tab key (e.g. "dashboard",
 *   "home").
 */
export function createAppStore(initialView = "dashboard") {
  return create<AppClientState>()((set) => ({
    activeView: initialView,
    globalSearch: "",
    searchNonce: 0,
    sellDialogOpen: false,
    productColorFilter: "all",
    productSizeFilter: "all",
    productCategoryFilter: "all",
    productStatusFilter: "all",
    setActiveView: (view) => set({ activeView: view }),
    setGlobalSearch: (value) => set({ globalSearch: value }),
    bumpSearch: () => set((s) => ({ searchNonce: s.searchNonce + 1 })),
    setSellDialogOpen: (open) => set({ sellDialogOpen: open }),
    setProductColorFilter: (value) => set({ productColorFilter: value }),
    setProductSizeFilter: (value) => set({ productSizeFilter: value }),
    setProductCategoryFilter: (value) => set({ productCategoryFilter: value }),
    setProductStatusFilter: (value) => set({ productStatusFilter: value }),
  }));
}

/** The store hook type returned by `createAppStore`. */
export type AppStore = ReturnType<typeof createAppStore>;
