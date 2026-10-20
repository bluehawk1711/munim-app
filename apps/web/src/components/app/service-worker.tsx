"use client"

import * as React from "react"

/**
 * Registers the offline app-shell service worker (public/sw.js).
 *
 * - Production only: the SW caches "/", which would serve a stale shell
 *   during `next dev`.
 * - Never runs during SSR (window/effects only) and any registration failure
 *   is swallowed — the app must keep working with no SW at all.
 */
export function ServiceWorkerRegistration() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return
    try {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Silent by design — offline shell is a progressive enhancement.
      })
    } catch {
      // Some sandboxed webviews throw on serviceWorker access itself.
    }
  }, [])

  return null
}
