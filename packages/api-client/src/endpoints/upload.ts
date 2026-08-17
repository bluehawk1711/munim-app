import type { HttpClient } from "../http.js";

/** POST /api/upload result — Cloudinary URL + publicId (server-side secret). */
export type UploadResult = {
  url: string;
  publicId: string;
};

export function upload(http: HttpClient) {
  return {
    /**
     * POST /api/upload — multipart form with a "file" field. The server
     * proxies the image to Cloudinary (signed upload) so the client never
     * touches Cloudinary secrets.
     */
    image(file: Blob, filename: string): Promise<UploadResult> {
      const form = new FormData();
      form.append("file", file, filename);
      return http.upload("/api/upload", form);
    },
  };
}

export type UploadEndpoints = ReturnType<typeof upload>;
