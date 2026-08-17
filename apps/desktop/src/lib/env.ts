/**
 * Desktop app connection config.
 *
 * The app talks to the shared NestJS API (not to Neon directly). The base URL
 * is user-configurable (saved by onboarding / Settings); the API key is baked
 * at build time via VITE_API_KEY, with a Settings override for local dev.
 *
 * The saved-URL key (`munim.databaseUrl`) is shared with the PinGate
 * onboarding screen, which writes it when the first-run flow completes.
 */

const CONNECTION_KEY = "munim.databaseUrl";
const API_KEY_STORAGE = "munim.apiKey";

/** Connection URL saved by the user (onboarding / Settings), if any. */
export function getSavedApiUrl(): string | undefined {
  const saved = localStorage.getItem(CONNECTION_KEY);
  return saved && saved.trim() ? saved.trim() : undefined;
}

/** Resolves the active API base URL: saved override, then VITE_API_URL. */
export function getApiBaseUrl(): string | undefined {
  return getSavedApiUrl() ?? import.meta.env.VITE_API_URL;
}

export function saveApiUrl(url: string): void {
  localStorage.setItem(CONNECTION_KEY, url.trim());
}

/** API key saved in Settings (overrides the build-time key). */
export function getSavedApiKey(): string | undefined {
  const saved = localStorage.getItem(API_KEY_STORAGE);
  return saved && saved.trim() ? saved.trim() : undefined;
}

/** Resolves the active API key: saved override, then the build-time key. */
export function getApiKey(): string {
  return getSavedApiKey() ?? import.meta.env.VITE_API_KEY ?? "";
}

export function saveApiKey(key: string): void {
  localStorage.setItem(API_KEY_STORAGE, key.trim());
}
