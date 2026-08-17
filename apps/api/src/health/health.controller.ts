import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import { pingDatabase, type DbClient } from "@munim/core";
import { DRIZZLE } from "../db/drizzle.provider.js";
import { Public } from "../auth/api-key.guard.js";

@Controller()
export class HealthController {
  constructor(@Inject(DRIZZLE) private readonly db: DbClient) {}

  /** Liveness — the process is up and serving. */
  @Public()
  @Get("healthz")
  healthz(): { status: "ok" } {
    return { status: "ok" };
  }

  /** Readiness — the DB connection is usable. */
  @Public()
  @Get("readyz")
  async readyz(): Promise<{ status: "ok" }> {
    try {
      await pingDatabase(this.db);
      return { status: "ok" };
    } catch {
      throw new ServiceUnavailableException("Database unreachable");
    }
  }
}
