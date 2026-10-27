import { Controller, Get, Inject, Query } from "@nestjs/common";
import {
  getDashboard,
  getPartyBalances,
  type DashboardPeriod,
  type DbClient,
} from "@munim/core";
import { DRIZZLE } from "../db/drizzle.provider.js";
import { CacheService } from "../common/cache.service.js";
import { CACHE_TTL, cacheKeys } from "../common/cache.keys.js";

@Controller("dashboard")
export class DashboardController {
  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    @Inject(CacheService) private readonly cache: CacheService,
  ) {}

  /** GET /api/dashboard?from=&to= — `from`/`to` scope the period KPI tiles
   *  (dashboard chips: Today / This week / This month / Custom). Cached per
   *  period so switching chips doesn't refetch the all-time payload. */
  @Get()
  async get(@Query("from") from?: string, @Query("to") to?: string) {
    const period: DashboardPeriod = { from: from || undefined, to: to || undefined };
    return this.cache.cacheAside(cacheKeys.dashboard(period), CACHE_TTL.dashboard, async () => {
      // Both queries are independent — run them in parallel, exactly like the
      // web app's dashboard route did.
      const [data, balances] = await Promise.all([getDashboard(this.db, period), getPartyBalances(this.db)]);
    const receivables = balances.filter((b) => b.balance > 0.001).reduce((s, b) => s + b.balance, 0);
    const payables = balances.filter((b) => b.balance < -0.001).reduce((s, b) => s + Math.abs(b.balance), 0);

      return {
        ...data,
        receivables,
        payables,
        recentInvoices: data.recentInvoices.map((inv) => ({
          ...inv,
          items: inv.items ?? [],
          date: inv.date.toISOString(),
          createdAt: inv.createdAt.toISOString(),
        })),
        recentActivity: data.recentActivity.map((a) => ({
          ...a,
          createdAt: a.createdAt.toISOString(),
        })),
        recentAdvances: data.recentAdvances.map((a) => ({
          ...a,
          date: a.date.toISOString(),
          createdAt: a.createdAt.toISOString(),
        })),
      };
    });
  }
}
