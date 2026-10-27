import { Body, Controller, Delete, Get, Inject, Param, Patch, Post } from "@nestjs/common";
import { z } from "zod";
import {
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

/**
 * Articles — product classification like a category plus code/description.
 * `GET /api/articles/analytics` powers the Articles page analytics section
 * (stock, sold units/weight, revenue, last sale, 6-month trend).
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
  async analytics() {
    return this.cache.cacheAside(cacheKeys.articlesAnalytics, CACHE_TTL.reports, () =>
      getArticlesAnalytics(this.db),
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
