CREATE TABLE "gold_rates" (
	"id" text PRIMARY KEY NOT NULL,
	"karat" integer NOT NULL,
	"rate_per_gram" double precision DEFAULT 0 NOT NULL,
	"is_custom" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "gold_karat" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "gold_making_charge_percent" double precision;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "gold_price_mode" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "gold_making_charge_percent" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "gold_rates_karat_idx" ON "gold_rates" USING btree ("karat");