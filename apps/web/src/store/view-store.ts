"use client"

import { create } from "zustand"
import type { StockStatus } from "@/lib/types"

export type ViewKey =
  | "dashboard"
  | "products"
  | "sales"
  | "invoices"
  | "billing"
  | "job-letter"
  | "parties"
  | "advances"
  | "reports"
  | "catalog"
  | "settings"

type AppState = {
  activeView: ViewKey
  globalSearch: string
  searchNonce: number
  sellDialogOpen: boolean
  // Cross-view product filters (e.g. set by the Catalog shortcuts).
  productColorFilter: string
  productSizeFilter: string
  productCategoryFilter: string
  productStatusFilter: StockStatus | "all"
  setView: (view: ViewKey) => void
  setGlobalSearch: (value: string) => void
  setSellDialogOpen: (open: boolean) => void
  setProductColorFilter: (value: string) => void
  setProductSizeFilter: (value: string) => void
  setProductCategoryFilter: (value: string) => void
  setProductStatusFilter: (value: StockStatus | "all") => void
}

/** All valid view keys — used to validate the `?view=` URL param. */
const VIEW_KEYS: ViewKey[] = [
  "dashboard",
  "products",
  "sales",
  "invoices",
  "billing",
  "job-letter",
  "parties",
  "advances",
  "reports",
  "catalog",
  "settings",
]

/** Read the active view from the URL (?view=...) so a refresh keeps the tab.
 * Falls back to the dashboard when absent or invalid. SSR-safe. */
function viewFromUrl(): ViewKey {
  if (typeof window === "undefined") return "dashboard"
  const param = new URLSearchParams(window.location.search).get("view")
  return param && (VIEW_KEYS as string[]).includes(param)
    ? (param as ViewKey)
    : "dashboard"
}

/** Keep the URL in sync with the active tab (pushState so back/forward
 * navigates between tabs) and back/forward in sync with the store. */
let popStateBound = false
function bindPopState() {
  if (popStateBound || typeof window === "undefined") return
  popStateBound = true
  window.addEventListener("popstate", () => {
    useAppStore.setState({ activeView: viewFromUrl() })
  })
}

export const useAppStore = create<AppState>((set) => ({
  activeView: viewFromUrl(),
  globalSearch: "",
  searchNonce: 0,
  sellDialogOpen: false,
  productColorFilter: "all",
  productSizeFilter: "all",
  productCategoryFilter: "all",
  productStatusFilter: "all",
  setView: (view) => {
    set({ activeView: view })
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href)
      if (url.searchParams.get("view") !== view) {
        url.searchParams.set("view", view)
        window.history.pushState({ view }, "", url)
      }
    }
  },
  setGlobalSearch: (value) =>
    set({ globalSearch: value, searchNonce: Date.now() }),
  setSellDialogOpen: (open) => set({ sellDialogOpen: open }),
  setProductColorFilter: (value) => set({ productColorFilter: value }),
  setProductSizeFilter: (value) => set({ productSizeFilter: value }),
  setProductCategoryFilter: (value) => set({ productCategoryFilter: value }),
  setProductStatusFilter: (value) => set({ productStatusFilter: value }),
}))

// The store must exist before the listener can dereference it — this call
// sits after `create` so the closure is always safe (it fires on popstate,
// well after module evaluation).
bindPopState()
