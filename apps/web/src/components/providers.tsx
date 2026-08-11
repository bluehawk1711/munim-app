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

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      {/* QueryClientProvider must wrap AccentThemeProvider — the accent theme
          hook reads/writes the shared settings row via react-query. */}
      <QueryClientProvider client={queryClient}>
        <AccentThemeProvider>{children}</AccentThemeProvider>
      </QueryClientProvider>
    </NextThemesProvider>
  )
}
