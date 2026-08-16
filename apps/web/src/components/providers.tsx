"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AccentThemeProvider } from "@/components/app/theme-picker"

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  )

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
      {/* QueryClientProvider wraps the app for react-query data hooks;
          AccentThemeProvider is now purely local (per-device theme/mode). */}
      <QueryClientProvider client={queryClient}>
        <AccentThemeProvider>{children}</AccentThemeProvider>
      </QueryClientProvider>
    </NextThemesProvider>
  )
}
