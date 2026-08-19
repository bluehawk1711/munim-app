import { Injectable, Logger } from "@nestjs/common";
import { Redis } from "@upstash/redis";
import { getEnv } from "../config/env.js";

/**
 * Key namespace prefix. All keys live under `munim:` so a shared Upstash
 * instance can host other apps without collisions.
 */
const NAMESPACE = "munim";

interface MemoryEntry {
  value: string;
  expiresAt: number; // epoch ms; 0 = no expiry
}

/**
 * Cache-aside wrapper around Upstash Redis (REST).
 *
 * - When `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are set, reads
 *   and writes go to Redis (shared across API replicas).
 * - Otherwise an in-process TTL map is used — fine for local dev and the
 *   single-instance smoke/e2e tests, wrong for multi-replica production.
 *
 * Reads are **fail-open**: if Redis is unreachable we log once per minute and
 * fall through to the loader rather than erroring the request. Writes
 * (invalidation) are best-effort for the same reason.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly redis: Redis | null;
  private readonly memory = new Map<string, MemoryEntry>();
  private lastRedisWarn = 0;

  constructor() {
    const env = getEnv();
    if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
      this.redis = new Redis({
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN,
      });
      this.logger.log("Cache: Upstash Redis enabled");
    } else {
      this.redis = null;
      this.logger.warn(
        "Cache: UPSTASH_REDIS_REST_URL/TOKEN not set — using in-memory TTL cache (single-instance only)",
      );
    }
  }

  /** True when the backing store is real Redis (not the in-memory fallback). */
  get isRedis(): boolean {
    return this.redis !== null;
  }

  private ns(key: string): string {
    return `${NAMESPACE}:${key}`;
  }

  private warnOnce(message: string): void {
    const now = Date.now();
    if (now - this.lastRedisWarn > 60_000) {
      this.lastRedisWarn = now;
      this.logger.warn(message);
    }
  }

  /**
   * Cache-aside read: returns the cached value, or runs `loader`, stores the
   * result for `ttlSeconds`, and returns it. `null`/`undefined` results are
   * never cached (a Redis miss is indistinguishable from a stored null).
   * Fail-open: any Redis error falls through to `loader`.
   */
  async cacheAside<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const value = await loader();
    if (value !== null && value !== undefined) {
      await this.set(key, value, ttlSeconds).catch(() => {
        this.warnOnce(`Cache: set failed for ${key} — continuing without cache`);
      });
    }
    return value;
  }

  async get<T>(key: string): Promise<T | null> {
    const full = this.ns(key);
    if (this.redis) {
      try {
        // The Upstash SDK auto-serializes/deserializes — passing values to
        // `set` as-is and reading them back here. Manual JSON.parse on the
        // returned value would double-decode ("[object Object]" errors).
        return await this.redis.get<T>(full);
      } catch (err) {
        this.warnOnce(`Cache: get failed for ${key} — ${(err as Error).message}`);
        return null;
      }
    }
    const entry = this.memory.get(full);
    if (!entry) return null;
    if (entry.expiresAt !== 0 && entry.expiresAt <= Date.now()) {
      this.memory.delete(full);
      return null;
    }
    return JSON.parse(entry.value) as T;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const full = this.ns(key);
    if (this.redis) {
      await this.redis.set(full, value, { ex: ttlSeconds });
      return;
    }
    this.memory.set(full, {
      value: JSON.stringify(value),
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    const full = keys.map((k) => this.ns(k));
    if (this.redis) {
      try {
        await this.redis.del(...full);
      } catch (err) {
        this.warnOnce(`Cache: del failed — ${(err as Error).message}`);
      }
      return;
    }
    for (const k of full) this.memory.delete(k);
  }

  /** Delete every key under a logical prefix, e.g. `products` → munim:products:*. */
  async delByPrefix(prefix: string): Promise<number> {
    const nsPrefix = `${NAMESPACE}:${prefix}`;
    if (this.redis) {
      try {
        const keys = await this.scanKeys(`${nsPrefix}*`);
        if (keys.length > 0) await this.redis.del(...keys);
        return keys.length;
      } catch (err) {
        this.warnOnce(`Cache: prefix del failed for ${prefix} — ${(err as Error).message}`);
        return 0;
      }
    }
    let removed = 0;
    for (const key of this.memory.keys()) {
      if (key.startsWith(nsPrefix)) {
        this.memory.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  /** Liveness/readiness probe. Memory fallback always answers PONG. */
  async ping(): Promise<"PONG"> {
    if (this.redis) {
      try {
        await this.redis.ping();
      } catch (err) {
        throw new Error(`Upstash Redis unreachable: ${(err as Error).message}`);
      }
    }
    return "PONG";
  }

  private async scanKeys(pattern: string): Promise<string[]> {
    const found: string[] = [];
    let cursor: string | number = 0;
    do {
      const [next, keys]: [string, string[]] = await this.redis!.scan(cursor, {
        match: pattern,
        count: 200,
      });
      found.push(...keys);
      cursor = next;
    } while (cursor !== "0");
    return found;
  }
}
