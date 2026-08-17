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
  createSale,
  deleteInvoice,
  listInvoices,
  saleSchema,
  serializeSale,
  type DbClient,
  type SaleFormValues,
} from "@munim/core";
import { DRIZZLE } from "../db/drizzle.provider.js";
import { ZodValidationPipe } from "../common/validation.pipe.js";
import { CacheService } from "../common/cache.service.js";
import { CACHE_TTL, cacheKeys, invalidate } from "../common/cache.keys.js";

const INVOICE_STATUSES = ["DRAFT", "UNPAID", "PARTIAL", "PAID"] as const;

function statusParam(value: string | undefined): "DRAFT" | "UNPAID" | "PARTIAL" | "PAID" | undefined {
  return INVOICE_STATUSES.find((s) => s === value);
}

@Controller("sales")
export class SalesController {
  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    @Inject(CacheService) private readonly cache: CacheService,
  ) {}

  /** Sales list = flattened invoices (same shape as the web /api/sales). */
  @Get()
  async list(
    @Query("search") search?: string,
    @Query("status") status?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    const filters = { search, status: statusParam(status), startDate, endDate };
    return this.cache.cacheAside(cacheKeys.salesList(filters), CACHE_TTL.lists, async () => {
      const { invoices } = await listInvoices(this.db, {
        search,
        status: statusParam(status),
        startDate,
        endDate,
        pageSize: 500,
      });
      return invoices.map((i) => serializeSale(i));
    });
  }

  @Post()
  async create(@Body(new ZodValidationPipe(saleSchema)) values: SaleFormValues) {
    const invoice = await createSale(this.db, {
      productId: values.productId,
      quantity: values.quantity,
      paid: true,
      paymentMethod: "cash",
    });
    if (!invoice) throw new Error("Sale creation returned no invoice");
    await invalidate(this.cache, ["invoices"]);
    return serializeSale(invoice);
  }

  /** Undo a sale — restores stock (deleteInvoice with stock restore). */
  @Delete(":id")
  async remove(@Param("id") id: string) {
    await deleteInvoice(this.db, id);
    await invalidate(this.cache, ["invoices"]);
    return { success: true };
  }
}
