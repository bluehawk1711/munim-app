import { Body, Controller, Get, Inject, Put } from "@nestjs/common";
import {
  getSettings,
  settingsSchema,
  updateSettings,
  type DbClient,
  type SettingsFormValues,
} from "@munim/core";
import { DRIZZLE } from "../db/drizzle.provider.js";
import { ZodValidationPipe } from "../common/validation.pipe.js";
import { CacheService } from "../common/cache.service.js";
import { CACHE_TTL, cacheKeys, invalidate } from "../common/cache.keys.js";

@Controller("settings")
export class SettingsController {
  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    @Inject(CacheService) private readonly cache: CacheService,
  ) {}

  @Get()
  async get() {
    return this.cache.cacheAside(cacheKeys.settings, CACHE_TTL.static, () => getSettings(this.db));
  }

  @Put()
  async update(@Body(new ZodValidationPipe(settingsSchema)) values: SettingsFormValues) {
    const result = await updateSettings(this.db, values);
    await invalidate(this.cache, ["settings"]);
    return result;
  }
}
