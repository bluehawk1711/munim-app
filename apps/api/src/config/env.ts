import { z } from "zod";

/**
 * Validated environment for the Munim API.
 *
 * The three API keys are per-platform (web / desktop / mobile). Each client is
 * built with its own key injected via GitHub Actions secrets (e.g.
 * `VITE_API_KEY` in the desktop build, `EXPO_PUBLIC_API_KEY` in the mobile
 * build); the server accepts any of the three.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  API_KEY_WEB: z.string().min(8).default(""),
  API_KEY_DESKTOP: z.string().min(8).default(""),
  API_KEY_MOBILE: z.string().min(8).default(""),
  CORS_ORIGINS: z.string().default(""),
  /** Cloudinary (server-side signed uploads — secrets never reach clients). */
  CLOUDINARY_CLOUD_NAME: z.string().default(""),
  CLOUDINARY_API_KEY: z.string().default(""),
  CLOUDINARY_API_SECRET: z.string().default(""),
  /**
   * Upstash Redis (REST). Both must be set to enable caching; when absent the
   * API falls back to an in-process TTL cache (fine for single-instance dev,
   * not for multi-replica production — set these there).
   */
  UPSTASH_REDIS_REST_URL: z.string().default(""),
  UPSTASH_REDIS_REST_TOKEN: z.string().default(""),
});

export type ApiEnv = z.infer<typeof envSchema>;

let cached: ApiEnv | null = null;

/** Validated env singleton. Throws at boot if required vars are missing. */
export function getEnv(): ApiEnv {
  if (!cached) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      throw new Error(`Invalid API environment: ${issues}`);
    }
    cached = result.data;
  }
  return cached;
}

export function getAllowedApiKeys(env: ApiEnv): string[] {
  return [env.API_KEY_WEB, env.API_KEY_DESKTOP, env.API_KEY_MOBILE].filter((k) => k.length > 0);
}

export function getCorsOrigins(env: ApiEnv): string[] {
  return env.CORS_ORIGINS.split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function isCloudinaryConfigured(env: ApiEnv): boolean {
  return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}
