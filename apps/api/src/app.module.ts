import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { ApiKeyGuard } from "./auth/api-key.guard.js";
import { GlobalExceptionFilter } from "./common/exception.filter.js";
import { drizzleProvider } from "./db/drizzle.provider.js";
import { HealthController } from "./health/health.controller.js";
import { ProductsController } from "./controllers/products.controller.js";
import { DashboardController } from "./controllers/dashboard.controller.js";
import { SettingsController } from "./controllers/settings.controller.js";
import { CatalogController } from "./controllers/catalog.controller.js";

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
  ],
  providers: [
    drizzleProvider,
    { provide: APP_GUARD, useClass: ApiKeyGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
