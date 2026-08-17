/**
 * Desktop data-layer glue — the app root wraps with QueryProvider and passes
 * its configured ApiClient via `getClient: () => getApi()`. The API key/URL
 * resolution stays in lib/api.ts (Tauri fetch + saved URL/key); the shared
 * @munim/query hooks never touch it directly.
 */
import type { ReactNode } from "react";
import { QueryProvider } from "@munim/query";
import { getApi } from "./api";

export function DesktopQueryProvider({ children }: { children: ReactNode }) {
  return <QueryProvider getClient={() => getApi()}>{children}</QueryProvider>;
}
