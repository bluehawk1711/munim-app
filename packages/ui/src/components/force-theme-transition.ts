"use client"

import * as React from "react"

/**
 * "Force animation play" preference — shared by web + desktop.
 *
 * When the OS reports reduced motion (e.g. Windows "Animation effects" off),
 * the AnimatedThemeToggle deliberately skips the polygon wipe. This store lets
 * the user opt OUT of that from Settings: flip it on and the wipe plays on
 * this machine regardless of the OS preference.
 *
 * Device-local on purpose (localStorage): it overrides the OS animation
 * preference of THIS machine, so it is NOT mirrored to the shared DB settings
 * row like theme/mode are. Cross-tab sync via the `storage` event, matching
 * the desktop theme provider.
 */
const STORAGE_KEY = "munim.forceThemeTransition"

const listeners = new Set<() => void>()

function read(): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

function handleStorage(e: StorageEvent) {
  if (e.key === STORAGE_KEY) {
    listeners.forEach((l) => l())
  }
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange)
  if (listeners.size === 1 && typeof window !== "undefined") {
    // First subscriber — start listening for cross-tab changes.
    window.addEventListener("storage", handleStorage)
  }
  return () => {
    listeners.delete(onStoreChange)
    if (listeners.size === 0 && typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorage)
    }
  }
}

/** Current value — safe to read anywhere; SSR (no window) returns false. */
export function getForceThemeTransition(): boolean {
  return read()
}

/** Persist a new value and notify subscribers. */
export function setForceThemeTransition(value: boolean): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0")
  } catch {
    // Storage unavailable — nothing to persist.
  }
  listeners.forEach((l) => l())
}

/** Reactive hook for React components (Settings page + the toggle wrappers). */
export function useForceThemeTransition(): boolean {
  return React.useSyncExternalStore(subscribe, read, () => false)
}
