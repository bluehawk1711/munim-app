ALTER TABLE "invoice_items" ADD COLUMN "pricing" json;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "labour_type" text DEFAULT 'PERCENT' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "labour_value" double precision;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "price_mode" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "default_labour_type" text DEFAULT 'PERCENT' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "default_labour_value" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "silver_rate_per_gram" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
/* Data migration — HAND-ADDED (drizzle-kit cannot express data copies; see AGENTS.md):
   carry the legacy %-based making charge + price mode into the new, generalized
   labour/price-mode columns before 0012 drops the old ones. */
UPDATE "products" SET "labour_value" = "gold_making_charge_percent", "labour_type" = 'PERCENT' WHERE "gold_making_charge_percent" IS NOT NULL;--> statement-breakpoint
UPDATE "products" SET "price_mode" = "gold_price_mode";--> statement-breakpoint
UPDATE "settings" SET "default_labour_value" = "gold_making_charge_percent";