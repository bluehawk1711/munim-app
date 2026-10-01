import { Body, Controller, Get, Inject, Post, Put } from "@nestjs/common";
import {
  backfillGoldKarats,
  goldRatesSchema,
  listGoldRates,
  saveGoldRates,
  type DbClient,
  type GoldRatesValues,
} from "@munim/core";
import { DRIZZLE } from "../db/drizzle.provider.js";
import { ZodValidationPipe } from "../common/validation.pipe.js";
import { CacheService } from "../common/cache.service.js";
import { CACHE_TTL, cacheKeys, invalidate } from "../common/cache.keys.js";

/**
 * Gold rate table (dynamic karat pricing) — the manual ₹/gram rates the shop
 * quotes for karats 0–24. `PUT` saves the whole table in one call: a row with
 * `isCustom: false` resets that karat to its derived rate.
 */
@Controller("gold-rates")
export class GoldRatesController {
  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    @Inject(CacheService) private readonly cache: CacheService,
  ) {}

  @Get()
  async list() {
    return this.cache.cacheAside(cacheKeys.goldRates, CACHE_TTL.static, () => listGoldRates(this.db));
  }

  @Put()
  async save(@Body(new ZodValidationPipe(goldRatesSchema)) body: GoldRatesValues) {
    const result = await saveGoldRates(this.db, body.rates);
    // Product prices are derived from the table — clear the derived caches.
    await invalidate(this.cache, ["goldRates"]);
    return result;
  }

  /** Fills `products.goldKarat` from the free-text purity stamp ("22K" / "916"). */
  @Post("backfill-karats")
  async backfill() {
    const result = await backfillGoldKarats(this.db);
    await invalidate(this.cache, ["goldRates"]);
    return result;
  }
}
