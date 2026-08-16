/**
 * Mobile app setup config (Neon DB URL + Cloudinary credentials) — set during
 * onboarding. Mirrors the web/desktop gate storage (packages/ui pin-gate.tsx)
 * with the SAME AsyncStorage/localStorage keys so the reset flow works
 * identically on every platform:
 *
 *   - `munim.databaseUrl` AsyncStorage — Neon connection string
 *   - `munim.cloudinary`  AsyncStorage — Cloudinary credentials JSON
 *
 * Storage is per-device, never the shared database.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const DATABASE_URL_KEY = 'munim.databaseUrl';
const CLOUDINARY_KEY = 'munim.cloudinary';

export type AppCloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

export type AppSetupConfig = {
  databaseUrl: string;
  cloudinary: AppCloudinaryConfig | null;
};

async function getStored(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function setStored(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // Storage unavailable — onboarding still completes for this session.
  }
}

async function removeStored(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Ignore.
  }
}

/** Read the saved app setup — null until onboarding has been completed. */
export async function getSavedAppSetup(): Promise<AppSetupConfig | null> {
  const databaseUrl = await getStored(DATABASE_URL_KEY);
  if (!databaseUrl || !databaseUrl.trim()) return null;
  let cloudinary: AppCloudinaryConfig | null = null;
  try {
    const raw = await getStored(CLOUDINARY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppCloudinaryConfig>;
      if (parsed.cloudName && parsed.apiKey && parsed.apiSecret) {
        cloudinary = {
          cloudName: parsed.cloudName,
          apiKey: parsed.apiKey,
          apiSecret: parsed.apiSecret,
        };
      }
    }
  } catch {
    cloudinary = null;
  }
  return {databaseUrl: databaseUrl.trim(), cloudinary};
}

/** Persist the app setup (used by the onboarding screen). */
export async function saveAppSetup(cfg: {
  databaseUrl: string;
  cloudinary: AppCloudinaryConfig | null;
}): Promise<void> {
  await setStored(DATABASE_URL_KEY, cfg.databaseUrl.trim());
  if (cfg.cloudinary) {
    await setStored(CLOUDINARY_KEY, JSON.stringify(cfg.cloudinary));
  } else {
    await removeStored(CLOUDINARY_KEY);
  }
}

/** Remove the saved DB URL + Cloudinary credentials (reset flow). */
export async function clearAppSetup(): Promise<void> {
  await removeStored(DATABASE_URL_KEY);
  await removeStored(CLOUDINARY_KEY);
}

/** Masked host of a connection string, e.g. "ep-…neon.tech". */
export function maskDatabaseHost(databaseUrl: string): string {
  const m = databaseUrl.match(/@([^/]+)/);
  return m?.[1] ?? databaseUrl.slice(0, 24);
}
