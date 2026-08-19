/**
 * Mobile app setup config (API base URL + API key) — set during onboarding.
 *
 * The app talks to the shared NestJS API; the connection is configured once in
 * onboarding and can be changed/cleared from Settings or the login screen's
 * "Connection settings" link. Storage is per-device (AsyncStorage), never the
 * shared database — the SAME keys as web/desktop (munim.databaseUrl /
 * munim.apiKey) so the reset flow works identically on every platform.
 */
import {
  clearApiConfig,
  getSavedApiKey,
  getSavedApiUrl,
  saveApiKey,
  saveApiUrl,
  buildKey,
  buildUrl,
} from './api';

export type AppSetupConfig = {
  /** API base URL, e.g. https://api.munim.app */
  apiUrl: string;
  /** API key (may be empty when EXPO_PUBLIC_API_KEY is baked in). */
  apiKey: string;
};

/** Read the saved app setup — null until onboarding has been completed.
 *  Falls back to the build-time EXPO_PUBLIC_* values when available so an
 *  APK built with baked env vars works without an onboarding step. */
export async function getSavedAppSetup(): Promise<AppSetupConfig | null> {
  const apiUrl = (await getSavedApiUrl()) || buildUrl();
  if (!apiUrl) return null;
  return {apiUrl, apiKey: (await getSavedApiKey()) || buildKey()};
}

/** Persist the app setup (used by the onboarding screen). */
export async function saveAppSetup(cfg: {
  apiUrl: string;
  apiKey: string;
}): Promise<void> {
  await saveApiUrl(cfg.apiUrl);
  if (cfg.apiKey.trim()) {
    await saveApiKey(cfg.apiKey);
  }
}

/** Remove the saved API URL + key (reset flow → back to onboarding). */
export async function clearAppSetup(): Promise<void> {
  await clearApiConfig();
}
