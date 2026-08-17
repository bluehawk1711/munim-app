"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { WebQueryProvider } from "@/lib/query"
import { AccentThemeProvider } from "@/components/app/theme-picker"

export function Providers({ children }: { children: React.ReactNode }) {
  // mode === null ("follow system") is the untouched default, so first paint
  // must match the OS preference — defaultTheme="system" lets the next-themes
  // inline script resolve it pre-hydration (no light flash on dark machines).
  // An explicit stored mode is applied on mount by useAccentTheme.
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {/* Shared @munim/query provider — one API-calling + caching layer across
          web, desktop & mobile (docs/state-management.md). AccentThemeProvider
          stays purely local (per-device theme/mode). */}
      <WebQueryProvider>
        <AccentThemeProvider>{children}</AccentThemeProvider>
      </WebQueryProvider>
    </NextThemesProvider>
  )
}
