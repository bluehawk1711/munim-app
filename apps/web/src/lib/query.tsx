"use client"

import * as React from "react"
import { QueryProvider } from "@munim/query"
import { createApiClient } from "@munim/api-client"

/**
 * Web data-layer glue — the shared @munim/query provider resolving the
 * configured ApiClient. The web app currently serves its own Next.js `/api/*`
 * routes (Phase 6 of the NestJS migration is deferred), so the client points
 * at the same origin; when the API moves, only this resolver changes.
 *
 * The API key is baked in at build time via the shared `apiClientOptions`
 * seam (the api-client sends `x-api-key`); web routes ignore it.
 */
export function WebQueryProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider
      getClient={() =>
        createApiClient({
          baseUrl:
            typeof window !== "undefined" ? window.location.origin : "",
          apiKey: "",
        })
      }
    >
      {children}
    </QueryProvider>
  )
}
