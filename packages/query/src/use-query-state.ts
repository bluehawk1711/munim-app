import type { UseQueryResult } from "@tanstack/react-query";

/**
 * Adapter that maps a TanStack Query result to the compact
 * `{ data, error, loading, refetching, reload }` shape the existing
 * desktop/mobile UIs already render with (error as a string,
 * `loading`/`refetching`/`reload` names).
 *
 * This is a *presentational* mapping only — the query itself is the shared
 * `@munim/query` hook, so caching + invalidation still apply. Screens that
 * want the full TanStack API (refetch promises, etc.) can consume the hook
 * result directly instead.
 */
export function useQueryState<TData>(
  query: UseQueryResult<TData, Error>,
): {
  data: TData | undefined;
  error: string | null;
  loading: boolean;
  refetching: boolean;
  reload: () => void;
} {
  return {
    data: query.data,
    error: query.error ? (query.error.message || String(query.error)) : null,
    loading: query.isLoading,
    refetching: query.isFetching,
    reload: () => {
      void query.refetch();
    },
  };
}
