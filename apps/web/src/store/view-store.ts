"use client"

import { createAppStore } from "@munim/store"

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

/**
 * The web's client-state store instance — shared shape + actions from
 * `@munim/store` (server state lives in `@munim/query`). The web layers its
 * URL-sync on top: every `setActiveView` (aka the old `setView`) also pushes
 * `?view=` via pushState so back/forward navigates between tabs.
 */
export const useAppStore = createAppStore(viewFromUrl())

// Keep the URL in sync with the active tab (pushState so back/forward
// navigates between tabs) and back/forward in sync with the store.
let urlSyncBound = false
function bindUrlSync() {
  if (urlSyncBound || typeof window === "undefined") return
  urlSyncBound = true

  // Store → URL: any activeView change writes ?view=.
  useAppStore.subscribe((state, prev) => {
    if (state.activeView === prev.activeView) return
    const url = new URL(window.location.href)
    if (url.searchParams.get("view") !== state.activeView) {
      url.searchParams.set("view", state.activeView)
      window.history.pushState({ view: state.activeView }, "", url)
    }
  })

  // URL → store: back/forward restores the tab.
  window.addEventListener("popstate", () => {
    useAppStore.setState({ activeView: viewFromUrl() })
  })
}
bindUrlSync()
