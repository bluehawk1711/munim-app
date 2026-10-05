ALTER TABLE "invoice_items" ADD COLUMN "weight" double precision;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN "weight_unit" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "gold_rate" double precision;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "weight" double precision;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "weight_unit" text;