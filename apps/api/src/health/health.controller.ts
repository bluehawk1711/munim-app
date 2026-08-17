import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import { pingDatabase, type DbClient } from "@munim/core";
import { DRIZZLE } from "../db/drizzle.provider.js";
import { CacheService } from "../common/cache.service.js";
import { Public } from "../auth/api-key.guard.js";

@Controller()
export class HealthController {
  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    @Inject(CacheService) private readonly cache: CacheService,
  ) {}

  /** Liveness — the process is up and serving. */
  @Public()
  @Get("healthz")
  healthz(): { status: "ok" } {
    return { status: "ok" };
  }

  /** Readiness — the DB (and Upstash, when configured) are usable. */
  @Public()
  @Get("readyz")
  async readyz(): Promise<{ status: "ok" }> {
    try {
      await pingDatabase(this.db);
      if (this.cache.isRedis) {
        await this.cache.ping();
      }
      return { status: "ok" };
    } catch (err) {
      throw new ServiceUnavailableException((err as Error).message);
    }
  }
}
