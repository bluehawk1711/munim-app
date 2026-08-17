/**
 * Shared data-layer provider.
 *
 * `QueryProvider` wraps an app root with:
 *   1. a TanStack `QueryClient` (defaults: staleTime 30s, retry 1, no
 *      refetch-on-window-focus — mobile has no focus concept, desktop keeps it
 *      off to avoid surprise refetches), and
 *   2. a `getClient` resolver — the platform's configured ApiClient. This is
 *      the "API key via function param" seam: the shared hooks never read env
 *      vars or storage; each app supplies `() => getApi()` from its own
 *      `lib/api.ts` (which resolves the base URL + key + platform fetch).
 *
 * `getClient` may be async (mobile's `getApi()` reads AsyncStorage) — hooks
 * `await` it inside their `queryFn`.
 */
import { createContext, useContext, useState, type ReactNode } from "react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import type { ApiClient } from "@munim/api-client";

export type GetClient = () => ApiClient | Promise<ApiClient>;

const MISSING_PROVIDER = () => {
  throw new Error(
    "QueryProvider is missing — wrap the app root with <QueryProvider getClient={…}>",
  );
};

const ApiClientContext = createContext<GetClient>(MISSING_PROVIDER);

export type QueryProviderProps = {
  /** Resolves the configured ApiClient (base URL + key + fetch impl). */
  getClient: GetClient;
  children: ReactNode;
  /** Optional pre-built client (e.g. for tests); a default is created. */
  queryClient?: QueryClient;
};

export function QueryProvider({
  getClient,
  children,
  queryClient,
}: QueryProviderProps) {
  const [client] = useState(
    () =>
      queryClient ??
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <ApiClientContext.Provider value={getClient}>
        {children}
      </ApiClientContext.Provider>
    </QueryClientProvider>
  );
}

/** The configured ApiClient resolver — `await` it inside queryFns. */
export function useApiClient(): GetClient {
  return useContext(ApiClientContext);
}
