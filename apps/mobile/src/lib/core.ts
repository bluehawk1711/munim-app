import AsyncStorage from '@react-native-async-storage/async-storage';
import {createDb, type DbClient} from '@munim/core';

const STORAGE_KEY = 'munim.databaseUrl';

let client: DbClient | null = null;

export async function getSavedDatabaseUrl(): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_KEY);
}

export async function saveDatabaseUrl(url: string): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, url.trim());
  client = null;
}

/** Returns the shared Drizzle client (fetch → Neon). Recreated after settings change. */
export async function getCore(): Promise<DbClient> {
  if (client) {
    return client;
  }
  const databaseUrl = await getSavedDatabaseUrl();
  if (!databaseUrl) {
    throw new Error('No database URL set. Open Settings and paste your Neon connection string.');
  }
  client = createDb({databaseUrl});
  return client;
}
