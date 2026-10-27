ALTER TABLE "products" ADD COLUMN "sub_category_id" text;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_sub_category_id_categories_id_fk" FOREIGN KEY ("sub_category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "products_subcategory_idx" ON "products" USING btree ("sub_category_id");