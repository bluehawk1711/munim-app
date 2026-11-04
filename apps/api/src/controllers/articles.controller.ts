import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { z } from "zod";
import {
  ARTICLE_ANALYTICS_PRESETS,
  createArticle,
  deleteArticle,
  getArticlesAnalytics,
  listArticles,
  updateArticle,
  type DbClient,
} from "@munim/core";
import { DRIZZLE } from "../db/drizzle.provider.js";
import { ZodValidationPipe } from "../common/validation.pipe.js";
import { CacheService } from "../common/cache.service.js";
import { CACHE_TTL, cacheKeys, invalidate } from "../common/cache.keys.js";

const nameSchema = z
  .string()
  .min(1, "Name is required")
  .max(40, "Name must be 40 characters or less")
  .transform((s) => s.trim());

const codeSchema = z.string().max(20).optional().or(z.literal(""));
const descriptionSchema = z.string().max(200).optional().or(z.literal(""));

const articleSchema = z.object({
  name: nameSchema,
  code: codeSchema,
  description: descriptionSchema,
});

const analyticsQuerySchema = z.object({
  preset: z.enum(ARTICLE_ANALYTICS_PRESETS).optional(),
  /** Inclusive `YYYY-MM-DD` bounds — required when `preset=custom`. */
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/**
 * Articles — product classification like a category plus code/description.
 * `GET /api/articles/analytics?preset=` powers the Articles page analytics
 * section (stock, sold units/weight, revenue, last sale, bucketed trend).
 */
@Controller("articles")
export class ArticlesController {
  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    @Inject(CacheService) private readonly cache: CacheService,
  ) {}

  @Get()
  async list() {
    return this.cache.cacheAside(cacheKeys.articlesList, CACHE_TTL.static, () =>
      listArticles(this.db),
    );
  }

  @Get("analytics")
  async analytics(
    @Query(new ZodValidationPipe(analyticsQuerySchema))
    query: z.infer<typeof analyticsQuerySchema>,
  ) {
    const preset = query.preset ?? "6m";
    // Custom windows are cached per exact range; presets keep one entry each.
    const cacheFilters = { preset, from: preset === "custom" ? query.from : undefined, to: preset === "custom" ? query.to : undefined };
    return this.cache.cacheAside(
      cacheKeys.articlesAnalytics(cacheFilters),
      CACHE_TTL.reports,
      () => getArticlesAnalytics(this.db, { preset, from: query.from, to: query.to }),
    );
  }

  @Post()
  async create(@Body(new ZodValidationPipe(articleSchema)) body: z.infer<typeof articleSchema>) {
    const article = await createArticle(this.db, body);
    await invalidate(this.cache, ["articles"]);
    return article;
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(articleSchema)) body: z.infer<typeof articleSchema>,
  ) {
    const article = await updateArticle(this.db, id, body);
    await invalidate(this.cache, ["articles"]);
    return article;
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    const result = await deleteArticle(this.db, id);
    await invalidate(this.cache, ["articles"]);
    return result;
  }
}
