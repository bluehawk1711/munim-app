CREATE TABLE "articles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "articles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "article_id" text;--> statement-breakpoint
CREATE INDEX "articles_name_idx" ON "articles" USING btree ("name");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "products_article_idx" ON "products" USING btree ("article_id");