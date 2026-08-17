/**
 * @munim/store — shared CLIENT-state store (Zustand).
 *
 * Server state (fetched data) lives in @munim/query (TanStack Query). This
 * package holds only ephemeral UI state shared across screens: active view,
 * global search, cross-view product filters, sell dialog. See
 * docs/state-management.md.
 */
export { createAppStore } from "./create-app-store.js";
export type { AppClientState, AppStore } from "./create-app-store.js";
