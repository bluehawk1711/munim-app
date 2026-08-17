import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { z } from "zod";
import {
  createCatalogItem,
  deleteCatalogItem,
  listCatalogItems,
  renameCatalogItem,
  type CatalogKind,
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

const createSchema = z.object({ name: nameSchema });
const renameSchema = z.object({ name: nameSchema });

const KINDS = ["color", "size", "category"] as const;

function parseKind(kind: string): CatalogKind {
  if ((KINDS as readonly string[]).includes(kind)) return kind as CatalogKind;
  throw new Error(`Unknown catalog kind: ${kind}`);
}

/**
 * One controller for colors, sizes AND categories — each is a "catalog kind"
 * backed by the same core service. Routes are /api/catalog/{color|size|category}
 * (the api-client maps the web app's /api/colors|sizes|categories onto these).
 */
@Controller("catalog")
export class CatalogController {
  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    @Inject(CacheService) private readonly cache: CacheService,
  ) {}

  @Get(":kind")
  async list(@Param("kind") kind: string) {
    const kindName = parseKind(kind);
    return this.cache.cacheAside(cacheKeys.catalogList(kind), CACHE_TTL.static, () =>
      listCatalogItems(this.db, kindName),
    );
  }

  @Post(":kind")
  async create(
    @Param("kind") kind: string,
    @Body(new ZodValidationPipe(createSchema)) body: { name: string },
  ) {
    const item = await createCatalogItem(this.db, parseKind(kind), body.name);
    await invalidate(this.cache, ["catalog"]);
    return item;
  }

  @Patch(":kind/:id")
  async rename(
    @Param("kind") kind: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(renameSchema)) body: { name: string },
  ) {
    const item = await renameCatalogItem(this.db, parseKind(kind), id, body.name);
    await invalidate(this.cache, ["catalog"]);
    return item;
  }

  @Delete(":kind/:id")
  async remove(@Param("kind") kind: string, @Param("id") id: string) {
    const result = await deleteCatalogItem(this.db, parseKind(kind), id);
    await invalidate(this.cache, ["catalog"]);
    return result;
  }
}
