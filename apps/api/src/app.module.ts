import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ApiKeyGuard } from "./auth/api-key.guard.js";
import { GlobalExceptionFilter } from "./common/exception.filter.js";
import { drizzleProvider } from "./db/drizzle.provider.js";
import { CacheService } from "./common/cache.service.js";
import { HealthController } from "./health/health.controller.js";
import { ProductsController } from "./controllers/products.controller.js";
import { DashboardController } from "./controllers/dashboard.controller.js";
import { SettingsController } from "./controllers/settings.controller.js";
import { CatalogController } from "./controllers/catalog.controller.js";
import { ArticlesController } from "./controllers/articles.controller.js";
import { GoldRatesController } from "./controllers/gold-rates.controller.js";
import { InvoicesController } from "./controllers/invoices.controller.js";
import { OrdersController } from "./controllers/orders.controller.js";
import { SalesController } from "./controllers/sales.controller.js";
import { PartiesController } from "./controllers/parties.controller.js";
import { AdvancesController } from "./controllers/advances.controller.js";
import { JobLettersController } from "./controllers/job-letters.controller.js";
import { ReportsController } from "./controllers/reports.controller.js";
import { UploadController } from "./controllers/upload.controller.js";

@Module({
  imports: [
    // NOTE: NO rate limiting (throttler) on purpose. A Munim shop is ONE
    // network — every counter staff member, tablet and the billing desktop
    // share the shop's single public IP, so a per-IP request limit would
    // throttle the WHOLE shop (600 req/min is a few busy billing seconds
    // across a handful of devices). Abuse protection comes from the
    // per-platform API-key guard below instead of request throttling.
  ],
  controllers: [
    HealthController,
    ProductsController,
    DashboardController,
    SettingsController,
    CatalogController,
    ArticlesController,
    GoldRatesController,
    InvoicesController,
    OrdersController,
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
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
