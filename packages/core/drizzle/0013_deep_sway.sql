CREATE TABLE "order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"product_id" text,
	"product_name" text NOT NULL,
	"sku" text,
	"color" text,
	"size" text,
	"description" text,
	"quantity" double precision DEFAULT 1 NOT NULL,
	"price" double precision DEFAULT 0 NOT NULL,
	"total" double precision DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"order_number" text NOT NULL,
	"party_id" text,
	"customer_name" text,
	"customer_phone" text,
	"customer_address" text,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"date" timestamp with time zone DEFAULT now() NOT NULL,
	"subtotal" double precision DEFAULT 0 NOT NULL,
	"delivery_charge" double precision DEFAULT 0 NOT NULL,
	"discount" double precision DEFAULT 0 NOT NULL,
	"total" double precision DEFAULT 0 NOT NULL,
	"notes" text,
	"invoice_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "nag_unit" text DEFAULT 'gm' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "silver_rate_per_gram" double precision;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "povayi_rate" double precision;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "other_charges" double precision;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "rate_display_unit" text DEFAULT 'gm' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_party_idx" ON "orders" USING btree ("party_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_date_idx" ON "orders" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_number_idx" ON "orders" USING btree ("order_number");