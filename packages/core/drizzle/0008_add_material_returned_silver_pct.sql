ALTER TABLE "invoices" ADD COLUMN "material_returned_weight" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "material_returned_value" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "silver_percentage" double precision DEFAULT 100 NOT NULL;