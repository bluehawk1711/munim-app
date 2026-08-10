const STORAGE_KEY = "munim.databaseUrl";

/** Connection string saved by the user in Settings (overrides the build env). */
export function getSavedDatabaseUrl(): string | undefined {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved && saved.trim() ? saved.trim() : undefined;
}

/** Resolves the active connection string: saved override, then VITE_DATABASE_URL. */
export function getDatabaseUrl(): string | undefined {
  return getSavedDatabaseUrl() ?? import.meta.env.VITE_DATABASE_URL;
}

export function saveDatabaseUrl(url: string): void {
  localStorage.setItem(STORAGE_KEY, url.trim());
}
