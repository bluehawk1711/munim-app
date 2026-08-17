"use client"

import * as React from "react"
import { QueryProvider } from "@munim/query"
import { createApiClient } from "@munim/api-client"

/**
 * Web data-layer glue — the shared @munim/query provider resolving the
 * configured ApiClient against the NestJS backend (Phase 6 of the NestJS
 * migration). Same API-calling layer as desktop & mobile.
 *
 * Build-time env (Vercel dashboard → Project → Settings → Environment
 * Variables; also see .env.example):
 *   NEXT_PUBLIC_API_URL  — e.g. https://munim-api.example.com
 *   NEXT_PUBLIC_API_KEY  — the web platform key the server accepts (x-api-key)
 *
 * When unset (local dev without a backend), it falls back to the same origin
 * so `next dev` still boots. The backend must also list the web origin in its
 * CORS_ORIGINS for browser calls to succeed.
 */
export function WebQueryProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider
      getClient={() =>
        createApiClient({
          baseUrl:
            (process.env.NEXT_PUBLIC_API_URL ?? "").trim() ||
            (typeof window !== "undefined" ? window.location.origin : ""),
          apiKey: process.env.NEXT_PUBLIC_API_KEY ?? "",
        })
      }
    >
      {children}
    </QueryProvider>
  )
}
