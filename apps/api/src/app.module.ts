import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { ApiKeyGuard } from "./auth/api-key.guard.js";
import { GlobalExceptionFilter } from "./common/exception.filter.js";
import { drizzleProvider } from "./db/drizzle.provider.js";
import { CacheService } from "./common/cache.service.js";
import { HealthController } from "./health/health.controller.js";
import { ProductsController } from "./controllers/products.controller.js";
import { DashboardController } from "./controllers/dashboard.controller.js";
import { SettingsController } from "./controllers/settings.controller.js";
import { CatalogController } from "./controllers/catalog.controller.js";
import { InvoicesController } from "./controllers/invoices.controller.js";
import { SalesController } from "./controllers/sales.controller.js";
import { PartiesController } from "./controllers/parties.controller.js";
import { AdvancesController } from "./controllers/advances.controller.js";
import { JobLettersController } from "./controllers/job-letters.controller.js";
import { ReportsController } from "./controllers/reports.controller.js";
import { UploadController } from "./controllers/upload.controller.js";

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        // Per-IP limit; per-API-key protection is enforced at the controller
        // level where the key is known (see README/perf notes).
        ttl: 60_000,
        limit: 600,
      },
    ]),
  ],
  controllers: [
    HealthController,
    ProductsController,
    DashboardController,
    SettingsController,
    CatalogController,
    InvoicesController,
    SalesController,
    PartiesController,
    AdvancesController,
    JobLettersController,
    ReportsController,
    UploadController,
  ],
  providers: [
    drizzleProvider,
    CacheService,
    { provide: APP_GUARD, useClass: ApiKeyGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
