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

@Controller()
export class AdvancesController {
  constructor(@Inject(DRIZZLE) private readonly db: DbClient) {}

  /* ── Advances ─────────────────────────────────────────────── */

  @Get("advances")
  async list(@Query("partyId") partyId?: string) {
    const advances = await listAdvances(this.db, partyId);
    return advances.map((a) => serializeAdvance(a));
  }

  @Post("advances")
  async create(@Body(new ZodValidationPipe(advanceSchema)) values: AdvanceFormValues) {
    const advance = await createAdvance(this.db, values);
    if (!advance) throw new Error("Advance creation returned no row");
    return serializeAdvance(advance);
  }

  @Post("advances/:id/settle")
  async settle(@Param("id") id: string) {
    const advance = await settleAdvance(this.db, id);
    return serializeAdvance(advance);
  }

  @Delete("advances/:id")
  async remove(@Param("id") id: string) {
    await deleteAdvance(this.db, id);
    return { success: true };
  }

  /* ── Payments (money in/out against a party) ──────────────── */

  @Get("payments")
  async listPaymentsRoute(@Query("partyId") partyId?: string) {
    const payments = await listPayments(this.db, partyId);
    return payments.map((p) => serializePayment(p));
  }

  @Post("payments")
  async createPayment(@Body(new ZodValidationPipe(paymentSchema)) values: PaymentFormValues) {
    const payment = await recordPayment(this.db, values);
    if (!payment) throw new Error("Payment creation returned no row");
    return serializePayment(payment);
  }
}
