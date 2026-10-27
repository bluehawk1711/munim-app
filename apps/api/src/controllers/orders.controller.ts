import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  createOrder,
  deleteOrder,
  generateBillFromOrder,
  getOrder,
  listOrderPayments,
  listOrders,
  orderPaymentSchema,
  orderSchema,
  orderUpdateSchema,
  recordOrderPayment,
  serializeInvoice,
  serializeOrder,
  serializePayment,
  updateOrder,
  type DbClient,
  type OrderFilters,
  type OrderFormValues,
  type OrderPaymentValues,
  type OrderUpdateValues,
} from "@munim/core";
import { DRIZZLE } from "../db/drizzle.provider.js";
import { ZodValidationPipe } from "../common/validation.pipe.js";
import { CacheService } from "../common/cache.service.js";
import { CACHE_TTL, cacheKeys, invalidate } from "../common/cache.keys.js";

const ORDER_STATUSES = ["OPEN", "COMPLETED", "CANCELLED"] as const;

function statusParam(value: string | undefined): OrderFilters["status"] {
  return ORDER_STATUSES.find((s) => s === value) ?? undefined;
}

@Controller("orders")
export class OrdersController {
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
    const filters: OrderFilters = {
      search,
      status: statusParam(status),
      partyId,
      startDate,
      endDate,
      page: page ? Math.max(1, parseInt(page, 10) || 1) : undefined,
      pageSize: pageSize ? Math.max(1, Math.min(200, parseInt(pageSize, 10) || 20)) : undefined,
    };
    return this.cache.cacheAside(cacheKeys.ordersList(filters), CACHE_TTL.lists, async () => {
      const result = await listOrders(this.db, filters);
      return {
        orders: result.orders.map((o) => serializeOrder(o)),
        pagination: result.pagination,
      };
    });
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    const order = await this.cache.cacheAside(cacheKeys.order(id), CACHE_TTL.detail, () =>
      getOrder(this.db, id),
    );
    if (!order) throw new NotFoundException("Order not found");
    return serializeOrder(order);
  }

  @Post()
  async create(@Body(new ZodValidationPipe(orderSchema)) values: OrderFormValues) {
    const order = await createOrder(this.db, values);
    if (!order) throw new NotFoundException("Order not found after create");
    await invalidate(this.cache, ["orders"]);
    return serializeOrder(order);
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(orderUpdateSchema)) values: OrderUpdateValues,
  ) {
    const order = await updateOrder(this.db, id, values);
    await invalidate(this.cache, ["orders"]);
    return serializeOrder(order);
  }

  /** GET /api/orders/:id/payments — the order's payment trail (advances and
   *  part-payments: amount, method, note, date). Mirrors the invoice one. */
  @Get(":id/payments")
  async payments(@Param("id") id: string) {
    const rows = await this.cache.cacheAside(cacheKeys.orderPayments(id), CACHE_TTL.detail, () =>
      listOrderPayments(this.db, id),
    );
    return rows.map((p) => serializePayment(p));
  }

  /** POST /api/orders/:id/pay — an advance on an UNBILLED order. Blocked once
   *  billed: from then on the money belongs to the invoice. */
  @Post(":id/pay")
  async recordPayment(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(orderPaymentSchema)) values: OrderPaymentValues,
  ) {
    const order = await recordOrderPayment(this.db, id, values);
    await invalidate(this.cache, ["orders"]);
    return serializeOrder(order);
  }

  /** POST /api/orders/:id/bill — quoted lines → a real invoice. */
  @Post(":id/bill")
  async generateBill(@Param("id") id: string) {
    const { invoice, order } = await generateBillFromOrder(this.db, id);
    await invalidate(this.cache, ["orders", "invoices"]);
    return { invoice: serializeInvoice(invoice), order: serializeOrder(order) };
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    await deleteOrder(this.db, id);
    await invalidate(this.cache, ["orders"]);
    return { success: true };
  }
}
