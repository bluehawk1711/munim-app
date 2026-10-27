import type { ArticleDto, ArticleInput, ArticlesAnalytics } from "@munim/core";
import type { HttpClient } from "../http.js";

/**
 * Articles — CRUD + analytics at /api/articles (mirrors core's articles
 * service). Shared by web, desktop and mobile.
 */
export function articles(http: HttpClient) {
  return {
    /** GET /api/articles — every article with its product count. */
    list(): Promise<ArticleDto[]> {
      return http.get("/api/articles");
    },
    /** GET /api/articles/analytics — per-article stock/sales/trend rows. */
    analytics(): Promise<ArticlesAnalytics> {
      return http.get("/api/articles/analytics");
    },
    /** POST /api/articles — duplicate-guarded create. */
    create(input: ArticleInput): Promise<ArticleDto> {
      return http.post("/api/articles", input);
    },
    /** PATCH /api/articles/:id — rename / edit code + description. */
    update(id: string, input: ArticleInput): Promise<ArticleDto> {
      return http.patch(`/api/articles/${id}`, input);
    },
    /** DELETE /api/articles/:id — blocked while products use it. */
    remove(id: string): Promise<{ success: boolean }> {
      return http.del(`/api/articles/${id}`);
    },
  };
}

export type ArticlesEndpoints = ReturnType<typeof articles>;
