ALTER TABLE "products" ADD COLUMN "weight" double precision;--> statement-breakpoint
CREATE INDEX "products_barcode_idx" ON "products" USING btree ("barcode");