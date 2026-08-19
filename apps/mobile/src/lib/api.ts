/**
 * Mobile API client — the app now talks to the shared NestJS API (not Neon
 * directly). Mirrors the desktop's lib/api.ts + lib/env.ts: the base URL is
 * saved by onboarding/Settings, the API key is a saved override with an
 * EXPO_PUBLIC_API_KEY build-time fallback. Storage is AsyncStorage (device
 * only), using the SAME keys as desktop/web (munim.databaseUrl / munim.apiKey)
 * so the reset flow behaves identically everywhere.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {createApiClient, type ApiClient} from '@munim/api-client';

const URL_KEY = 'munim.databaseUrl';
const KEY_KEY = 'munim.apiKey';

/** Build-time fallback key (EXPO_PUBLIC_API_KEY, inlined by Expo). */
export function buildKey(): string {
  return String(process.env.EXPO_PUBLIC_API_KEY ?? '').trim();
}

/** Build-time fallback URL (EXPO_PUBLIC_API_URL, inlined by Expo). */
export function buildUrl(): string {
  return String(process.env.EXPO_PUBLIC_API_URL ?? '').trim();
}

let client: ApiClient | null = null;
let clientKey = '';

let loaded = false;
let url: string | null = null;
let key: string | null = null;
let loadPromise: Promise<void> | null = null;

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        url = await AsyncStorage.getItem(URL_KEY);
        key = await AsyncStorage.getItem(KEY_KEY);
      } finally {
        loaded = true;
      }
    })();
  }
  await loadPromise;
}

export async function getSavedApiUrl(): Promise<string | null> {
  await ensureLoaded();
  return url && url.trim() ? url.trim() : null;
}

export async function getSavedApiKey(): Promise<string | null> {
  await ensureLoaded();
  return key && key.trim() ? key.trim() : null;
}

export async function saveApiUrl(nextUrl: string): Promise<void> {
  await ensureLoaded();
  url = nextUrl.trim();
  await AsyncStorage.setItem(URL_KEY, url);
  resetApi();
}

export async function saveApiKey(nextKey: string): Promise<void> {
  await ensureLoaded();
  key = nextKey.trim();
  await AsyncStorage.setItem(KEY_KEY, key);
  resetApi();
}

/** Drop the cached client — call after changing the URL/key. */
export function resetApi(): void {
  client = null;
  clientKey = '';
}

/**
 * Resolves the active API key: saved override, then the build-time key.
 * Returns '' when neither is set (screens then fail with a clear message).
 */
export async function getActiveApiKey(): Promise<string> {
  return (await getSavedApiKey()) || buildKey();
}

/**
 * Lazily builds the shared typed API client. The client is rebuilt whenever
 * the base URL or key changes. Throws when no URL is configured yet.
 */
export async function getApi(): Promise<ApiClient> {
  // Saved URL wins (onboarding/Settings); the build-time EXPO_PUBLIC_API_URL
  // is the fallback so an app installed from a GitHub-built APK works without
  // any setup when the URL is baked in.
  const baseUrl = (await getSavedApiUrl()) ?? buildUrl();
  if (!baseUrl) {
    throw new Error(
      'No server URL configured. Set it in onboarding or Settings.',
    );
  }
  const apiKey = await getActiveApiKey();
  const k = `${baseUrl}|${apiKey}`;
  if (!client || clientKey !== k) {
    // RN's global fetch has no CORS (native) — no plugin needed like desktop.
    client = createApiClient({baseUrl, apiKey});
    clientKey = k;
  }
  return client;
}

/**
 * Connection test for Settings + onboarding — builds a throwaway client for
 * the given URL/key and pings GET /readyz. Throws on failure (503 DB down,
 * bad key, unreachable host); resolves when the API is ready.
 */
export async function pingApiUrl(baseUrl: string, apiKey?: string): Promise<void> {
  const keyValue = (apiKey ?? '').trim() || buildKey();
  if (!keyValue) {
    throw new Error(
      'No API key — set EXPO_PUBLIC_API_KEY at build time or save one in Settings.',
    );
  }
  const probe = createApiClient({baseUrl: baseUrl.trim(), apiKey: keyValue});
  await probe.health.ready();
}

/** Remove the saved URL + key (reset flow) and drop the cached client. */
export async function clearApiConfig(): Promise<void> {
  await ensureLoaded();
  await AsyncStorage.multiRemove([URL_KEY, KEY_KEY]);
  url = null;
  key = null;
  resetApi();
}

/** Masked host of the API URL for display, e.g. "api.munim.app". */
export function maskApiUrl(apiUrl: string): string {
  try {
    return new URL(apiUrl).host;
  } catch {
    return apiUrl.slice(0, 32);
  }
}
