import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
} from "@nestjs/common";
import {
  deleteJobLetter,
  jobLetterSchema,
  listJobLetters,
  saveJobLetter,
  serializeJobLetter,
  type DbClient,
  type JobLetterFormValues,
} from "@munim/core";
import { DRIZZLE } from "../db/drizzle.provider.js";
import { ZodValidationPipe } from "../common/validation.pipe.js";
import { CacheService } from "../common/cache.service.js";
import { CACHE_TTL, cacheKeys, invalidate } from "../common/cache.keys.js";

@Controller("job-letters")
export class JobLettersController {
  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    @Inject(CacheService) private readonly cache: CacheService,
  ) {}

  @Get()
  async list() {
    return this.cache.cacheAside(cacheKeys.jobLetters, CACHE_TTL.lists, async () => {
      const letters = await listJobLetters(this.db);
      return letters.map((l) => serializeJobLetter(l));
    });
  }

  @Post()
  async create(@Body(new ZodValidationPipe(jobLetterSchema)) values: JobLetterFormValues) {
    const letter = await saveJobLetter(this.db, values);
    await invalidate(this.cache, ["jobLetters"]);
    return serializeJobLetter(letter);
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    await deleteJobLetter(this.db, id);
    await invalidate(this.cache, ["jobLetters"]);
    return { success: true };
  }
}
