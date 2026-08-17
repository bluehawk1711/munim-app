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

@Controller("reports")
export class ReportsController {
  constructor(@Inject(DRIZZLE) private readonly db: DbClient) {}

  @Get()
  async get(
    @Query(new ZodValidationPipe(reportQuerySchema)) query: ReportQueryValues,
    @Query("format") format?: string,
  ) {
    const report = await getReport(this.db, query.type, query.startDate, query.endDate);
    if (format === "csv") {
      return reportToCsv(report);
    }
    return report;
  }
}
