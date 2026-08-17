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

@Controller("settings")
export class SettingsController {
  constructor(@Inject(DRIZZLE) private readonly db: DbClient) {}

  @Get()
  async get() {
    return getSettings(this.db);
  }

  @Put()
  async update(@Body(new ZodValidationPipe(settingsSchema)) values: SettingsFormValues) {
    return updateSettings(this.db, values);
  }
}
