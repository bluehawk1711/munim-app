import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ArticleAnalyticsPreset,
  ArticleDto,
  ArticleInput,
  ArticlesAnalytics,
} from "@munim/core";
import { useApiClient } from "./provider.js";
import { qk } from "./keys.js";

export type { ArticleDto, ArticleInput, ArticlesAnalytics, ArticleAnalyticsPreset, ArticleAnalyticsPeriod } from "@munim/core";

/** GET /api/articles — every article with its product count. */
export function useArticles() {
  const getClient = useApiClient();
  return useQuery({
    queryKey: qk.articles.list,
    queryFn: async () => {
      const api = await getClient();
      return api.articles.list();
    },
  });
}

/** GET /api/articles/analytics?preset= — per-article stock/sales/trend rows
 *  for the selected window. The key includes the preset so switching the
 *  filter is cached per window, while `invalidateQueries(qk.articles.all)`
 *  still clears every window (key-prefix match). */
export function useArticlesAnalytics(preset?: ArticleAnalyticsPreset) {
  const getClient = useApiClient();
  return useQuery({
    queryKey: [...qk.articles.analytics, preset ?? "6m"],
    queryFn: async () => {
      const api = await getClient();
      return api.articles.analytics(preset);
    },
    placeholderData: (previous) => previous,
  });
}

/** Article writes change product display + analytics, so every mutation
 * refreshes the article queries AND the product queries (like catalog). */
function useInvalidateArticles() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: qk.articles.all });
    void qc.invalidateQueries({ queryKey: qk.products.all });
  };
}

/** POST /api/articles. */
export function useCreateArticle() {
  const getClient = useApiClient();
  const invalidate = useInvalidateArticles();
  return useMutation({
    mutationFn: async (input: ArticleInput): Promise<ArticleDto> => {
      const api = await getClient();
      return api.articles.create(input);
    },
    onSuccess: invalidate,
  });
}

/** PATCH /api/articles/:id. */
export function useUpdateArticle() {
  const getClient = useApiClient();
  const invalidate = useInvalidateArticles();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: ArticleInput }): Promise<ArticleDto> => {
      const api = await getClient();
      return api.articles.update(id, input);
    },
    onSuccess: invalidate,
  });
}

/** DELETE /api/articles/:id — blocked while products use it. */
export function useDeleteArticle() {
  const getClient = useApiClient();
  const invalidate = useInvalidateArticles();
  return useMutation({
    mutationFn: async (id: string) => {
      const api = await getClient();
      return api.articles.remove(id);
    },
    onSuccess: invalidate,
  });
}
