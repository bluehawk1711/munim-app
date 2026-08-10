"use client"

import { create } from "zustand"
import type { StockStatus } from "@/lib/types"

export type ViewKey = "dashboard" | "products" | "sales" | "reports" | "catalog"

type AppState = {
  activeView: ViewKey
  globalSearch: string
  searchNonce: number
  sellDialogOpen: boolean
  // Cross-view product filters (e.g. set by the Catalog shortcuts).
  productColorFilter: string
  productSizeFilter: string
  productStatusFilter: StockStatus | "all"
  setView: (view: ViewKey) => void
  setGlobalSearch: (value: string) => void
  setSellDialogOpen: (open: boolean) => void
  setProductColorFilter: (value: string) => void
  setProductSizeFilter: (value: string) => void
  setProductStatusFilter: (value: StockStatus | "all") => void
}

export const useAppStore = create<AppState>((set) => ({
  activeView: "dashboard",
  globalSearch: "",
  searchNonce: 0,
  sellDialogOpen: false,
  productColorFilter: "all",
  productSizeFilter: "all",
  productStatusFilter: "all",
  setView: (view) => set({ activeView: view }),
  setGlobalSearch: (value) =>
    set({ globalSearch: value, searchNonce: Date.now() }),
  setSellDialogOpen: (open) => set({ sellDialogOpen: open }),
  setProductColorFilter: (value) => set({ productColorFilter: value }),
  setProductSizeFilter: (value) => set({ productSizeFilter: value }),
  setProductStatusFilter: (value) => set({ productStatusFilter: value }),
}))
