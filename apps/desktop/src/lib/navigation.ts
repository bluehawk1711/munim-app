import { useEffect, useState } from "react";

/** Client-side navigation (pushState) so route changes animate without a full reload.
 *  Accepts a path with a query string (`/billing?edit=abc`) — the query is part
 *  of the identity, so navigating to the same path with a different `?edit=`
 *  still counts as a change. */
export function navigate(path: string): void {
  const target = new URL(path, window.location.origin);
  if (target.pathname === window.location.pathname && target.search === window.location.search) return;
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

/** Subscribe to the current pathname (pushState + back/forward). */
export function useCurrentPath(): string {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return path;
}

/** Subscribe to the current SEARCH string (`?edit=<id>`, `?section=…`) so a
 *  page can react to query-only navigation — `useCurrentPath` doesn't fire for
 *  those, since the pathname is unchanged. */
export function useUrlSearch(): string {
  const [search, setSearch] = useState(() => window.location.search);
  useEffect(() => {
    const onPop = () => setSearch(window.location.search);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return search;
}
