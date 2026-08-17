import { useMutation } from "@tanstack/react-query";
import type { UploadableFile } from "@munim/api-client";
import { useApiClient } from "./provider.js";

/**
 * POST /api/upload — proxies an image to Cloudinary (server-side secret).
 * Returns `{ url, publicId }`; no cache to invalidate (the URL is used
 * directly by the product form).
 */
export function useUploadImage() {
  const getClient = useApiClient();
  return useMutation({
    mutationFn: async (file: UploadableFile) => {
      const api = await getClient();
      return api.upload.image(file);
    },
  });
}
