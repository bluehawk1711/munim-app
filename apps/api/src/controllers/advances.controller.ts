import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import {
  advanceSchema,
  createAdvance,
  deleteAdvance,
  listAdvances,
  listPayments,
  paymentSchema,
  recordPayment,
  serializeAdvance,
  serializePayment,
  settleAdvance,
  type AdvanceFormValues,
  type DbClient,
  type PaymentFormValues,
} from "@munim/core";
import { DRIZZLE } from "../db/drizzle.provider.js";
import { ZodValidationPipe } from "../common/validation.pipe.js";
import { CacheService } from "../common/cache.service.js";
import { CACHE_TTL, cacheKeys, invalidate } from "../common/cache.keys.js";

@Controller()
export class AdvancesController {
  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    @Inject(CacheService) private readonly cache: CacheService,
  ) {}

  /* ── Advances ─────────────────────────────────────────────── */

  @Get("advances")
  async list(@Query("partyId") partyId?: string) {
    return this.cache.cacheAside(cacheKeys.advancesList(partyId), CACHE_TTL.lists, async () => {
      const advances = await listAdvances(this.db, partyId);
      return advances.map((a) => serializeAdvance(a));
    });
  }

  @Post("advances")
  async create(@Body(new ZodValidationPipe(advanceSchema)) values: AdvanceFormValues) {
    const advance = await createAdvance(this.db, values);
    if (!advance) throw new Error("Advance creation returned no row");
    await invalidate(this.cache, ["money"]);
    return serializeAdvance(advance);
  }

  @Post("advances/:id/settle")
  async settle(@Param("id") id: string) {
    const advance = await settleAdvance(this.db, id);
    await invalidate(this.cache, ["money"]);
    return serializeAdvance(advance);
  }

  @Delete("advances/:id")
  async remove(@Param("id") id: string) {
    await deleteAdvance(this.db, id);
    await invalidate(this.cache, ["money"]);
    return { success: true };
  }

  /* ── Payments (money in/out against a party) ──────────────── */

  @Get("payments")
  async listPaymentsRoute(@Query("partyId") partyId?: string) {
    return this.cache.cacheAside(cacheKeys.paymentsList(partyId), CACHE_TTL.lists, async () => {
      const payments = await listPayments(this.db, partyId);
      return payments.map((p) => serializePayment(p));
    });
  }

  @Post("payments")
  async createPayment(@Body(new ZodValidationPipe(paymentSchema)) values: PaymentFormValues) {
    const payment = await recordPayment(this.db, values);
    if (!payment) throw new Error("Payment creation returned no row");
    await invalidate(this.cache, ["money"]);
    return serializePayment(payment);
  }
}
