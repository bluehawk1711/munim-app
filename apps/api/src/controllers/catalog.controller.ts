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
  constructor(@Inject(DRIZZLE) private readonly db: DbClient) {}

  @Get(":kind")
  async list(@Param("kind") kind: string) {
    return listCatalogItems(this.db, parseKind(kind));
  }

  @Post(":kind")
  async create(
    @Param("kind") kind: string,
    @Body(new ZodValidationPipe(createSchema)) body: { name: string },
  ) {
    return createCatalogItem(this.db, parseKind(kind), body.name);
  }

  @Patch(":kind/:id")
  async rename(
    @Param("kind") kind: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(renameSchema)) body: { name: string },
  ) {
    return renameCatalogItem(this.db, parseKind(kind), id, body.name);
  }

  @Delete(":kind/:id")
  async remove(@Param("kind") kind: string, @Param("id") id: string) {
    return deleteCatalogItem(this.db, parseKind(kind), id);
  }
}
