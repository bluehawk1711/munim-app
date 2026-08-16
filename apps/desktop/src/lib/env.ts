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

const CLOUDINARY_KEY = "munim.cloudinary";

export type StoredCloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

/** Cloudinary credentials saved during onboarding (munim.cloudinary). */
export function getSavedCloudinary(): StoredCloudinaryConfig | undefined {
  try {
    const raw = localStorage.getItem(CLOUDINARY_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<StoredCloudinaryConfig>;
    if (parsed.cloudName && parsed.apiKey && parsed.apiSecret) {
      return {
        cloudName: parsed.cloudName,
        apiKey: parsed.apiKey,
        apiSecret: parsed.apiSecret,
      };
    }
    return undefined;
  } catch {
    return undefined;
  }
}
