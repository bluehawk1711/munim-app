import { Controller, Get, Inject, Query } from "@nestjs/common";
import {
  getReport,
  reportQuerySchema,
  reportToCsv,
  type DbClient,
  type ReportQueryValues,
} from "@munim/core";
import { DRIZZLE } from "../db/drizzle.provider.js";
import { ZodValidationPipe } from "../common/validation.pipe.js";
import { CacheService } from "../common/cache.service.js";
import { CACHE_TTL, cacheKeys } from "../common/cache.keys.js";

@Controller("reports")
export class ReportsController {
  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    @Inject(CacheService) private readonly cache: CacheService,
  ) {}

  @Get()
  async get(
    @Query(new ZodValidationPipe(reportQuerySchema)) query: ReportQueryValues,
    @Query("format") format?: string,
  ) {
    // Cache the raw report; CSV is a pure transform applied per request.
    const report = await this.cache.cacheAside(
      cacheKeys.report({ type: query.type, startDate: query.startDate, endDate: query.endDate }),
      CACHE_TTL.reports,
      () => getReport(this.db, query.type, query.startDate, query.endDate),
    );
    if (format === "csv") {
      return reportToCsv(report);
    }
    return report;
  }
}
