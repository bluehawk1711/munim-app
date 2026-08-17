import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { eq, schema as coreSchema } from "@munim/core";
import {
  createParty,
  deleteParty,
  getPartyBalances,
  getPartyLedger,
  getPayables,
  getReceivables,
  listParties,
  partySchema,
  partyUpdateSchema,
  serializeParty,
  updateParty,
  type DbClient,
  type PartyFormValues,
  type PartyUpdateValues,
} from "@munim/core";
import { DRIZZLE } from "../db/drizzle.provider.js";
import { ZodValidationPipe } from "../common/validation.pipe.js";
import { CacheService } from "../common/cache.service.js";
import { CACHE_TTL, cacheKeys, invalidate } from "../common/cache.keys.js";

@Controller("parties")
export class PartiesController {
  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    @Inject(CacheService) private readonly cache: CacheService,
  ) {}

  @Get()
  async list(
    @Query("type") type?: string,
    @Query("search") search?: string,
    @Query("balances") balances?: string,
  ) {
    if (balances === "true") {
      return this.cache.cacheAside(cacheKeys.partiesBalances, CACHE_TTL.lists, async () => {
        const [all, receivables, payables] = await Promise.all([
          getPartyBalances(this.db),
          getReceivables(this.db),
          getPayables(this.db),
        ]);
        return {
          balances: all.map((p) => serializeParty(p)),
          receivables: receivables.map((p) => serializeParty(p)),
          payables: payables.map((p) => serializeParty(p)),
        };
      });
    }
    return this.cache.cacheAside(cacheKeys.partiesList({ type, search }), CACHE_TTL.lists, async () => {
      const parties = await listParties(this.db, type, search);
      return parties.map((p) => serializeParty(p));
    });
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    return this.cache.cacheAside(cacheKeys.party(id), CACHE_TTL.lists, async () => {
      const party = await this.db.query.parties.findFirst({
        where: eq(coreSchema.parties.id, id),
      });
      if (!party) throw new NotFoundException("Party not found");
      const ledger = await getPartyLedger(this.db, id);
      return {
        party: serializeParty(party),
        ledger: {
          ...ledger,
          lines: ledger.lines.map((l) => ({ ...l, date: l.date.toISOString() })),
        },
      };
    });
  }

  @Post()
  async create(@Body(new ZodValidationPipe(partySchema)) values: PartyFormValues) {
    const party = await createParty(this.db, values);
    await invalidate(this.cache, ["parties"]);
    return serializeParty(party);
  }

  @Put(":id")
  async update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(partyUpdateSchema)) values: PartyUpdateValues,
  ) {
    const party = await updateParty(this.db, id, values);
    await invalidate(this.cache, ["parties"]);
    return serializeParty(party);
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    await deleteParty(this.db, id);
    await invalidate(this.cache, ["parties"]);
    return { success: true };
  }
}
