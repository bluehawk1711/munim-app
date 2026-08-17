/**
 * Desktop client-state store — one shared-store instance (Zustand) for
 * cross-view UI state (active view, filters, sell dialog). Server data lives
 * in @munim/query.
 */
import { createAppStore } from "@munim/store";

export const useAppStore = createAppStore("dashboard");
