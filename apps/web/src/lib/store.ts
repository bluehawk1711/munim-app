"use client"

import { createAppStore } from "@munim/store"

/**
 * The web's client-state store instance — one shared-store shape (from
 * @munim/store) for the active view, global search, sell dialog and product
 * filters. Server data lives in @munim/query.
 */
export const useAppStore = createAppStore("dashboard")

/**
 * Keep the active view in the URL (?view=...) so a refresh stays on the tab,
 * and back/forward navigates between tabs (web-specific — desktop uses hash
 * routing, mobile uses a tab bar). SSR-safe.
 */
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

function viewFromUrl(): ViewKey {
  if (typeof window === "undefined") return "dashboard"
  const param = new URLSearchParams(window.location.search).get("view")
  return param && (VIEW_KEYS as string[]).includes(param)
    ? (param as ViewKey)
    : "dashboard"
}

let bound = false
function bindUrlSync() {
  if (bound || typeof window === "undefined") return
  bound = true
  window.addEventListener("popstate", () => {
    useAppStore.setState({ activeView: viewFromUrl() })
  })
}
bindUrlSync()
