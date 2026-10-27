"use client"

/**
 * Web article hooks — thin re-exports of the shared @munim/query hooks
 * (articles live behind /api/articles on all three apps).
 */
import {
  useArticles,
  useArticlesAnalytics,
  useCreateArticle,
  useUpdateArticle,
  useDeleteArticle,
} from "@munim/query"

export {
  useArticles,
  useArticlesAnalytics,
  useCreateArticle,
  useUpdateArticle,
  useDeleteArticle,
}
export type { ArticleDto, ArticleInput, ArticlesAnalytics } from "@munim/core"
