import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import {
  createInvoice,
  deleteInvoice,
  getInvoice,
  invoicePaymentSchema,
  invoiceSchema,
  listInvoices,
  recordInvoicePayment,
  serializeInvoice,
  type DbClient,
  type InvoiceFilters,
  type InvoiceFormValues,
  type InvoicePaymentValues,
} from "@munim/core";
import { DRIZZLE } from "../db/drizzle.provider.js";
import { ZodValidationPipe } from "../common/validation.pipe.js";
import { CacheService } from "../common/cache.service.js";
import { CACHE_TTL, cacheKeys, invalidate } from "../common/cache.keys.js";

const INVOICE_STATUSES = ["DRAFT", "UNPAID", "PARTIAL", "PAID"] as const;

function statusParam(value: string | undefined): InvoiceFilters["status"] {
  return INVOICE_STATUSES.find((s) => s === value) ?? undefined;
}

@Controller("invoices")
export class InvoicesController {
  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    @Inject(CacheService) private readonly cache: CacheService,
  ) {}

  @Get()
  async list(
    @Query("search") search?: string,
    @Query("status") status?: string,
    @Query("partyId") partyId?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const filters: InvoiceFilters = {
      search,
      status: statusParam(status),
      partyId,
      startDate,
      endDate,
      page: page ? Math.max(1, parseInt(page, 10) || 1) : undefined,
      pageSize: pageSize ? Math.max(1, Math.min(200, parseInt(pageSize, 10) || 20)) : undefined,
    };
    return this.cache.cacheAside(cacheKeys.invoicesList(filters), CACHE_TTL.lists, async () => {
      const result = await listInvoices(this.db, filters);
      return {
        invoices: result.invoices.map((i) => serializeInvoice(i)),
        pagination: result.pagination,
      };
    });
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    const invoice = await this.cache.cacheAside(cacheKeys.invoice(id), CACHE_TTL.detail, () =>
      getInvoice(this.db, id),
    );
    if (!invoice) throw new NotFoundException("Invoice not found");
    return serializeInvoice(invoice);
  }

  @Post()
  async create(@Body(new ZodValidationPipe(invoiceSchema)) values: InvoiceFormValues) {
    const invoice = await createInvoice(this.db, values);
    if (!invoice) throw new NotFoundException("Invoice not found after create");
    await invalidate(this.cache, ["invoices"]);
    return serializeInvoice(invoice);
  }

  @Post(":id/payment")
  async recordPayment(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(invoicePaymentSchema)) values: InvoicePaymentValues,
  ) {
    const invoice = await recordInvoicePayment(this.db, id, values);
    if (!invoice) throw new NotFoundException("Invoice not found");
    await invalidate(this.cache, ["invoices"]);
    return serializeInvoice(invoice);
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    await deleteInvoice(this.db, id);
    await invalidate(this.cache, ["invoices"]);
    return { success: true };
  }
}
