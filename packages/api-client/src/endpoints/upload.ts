import type { HttpClient } from "../http.js";

/** POST /api/upload result — Cloudinary URL + publicId (server-side secret). */
export type UploadResult = {
  url: string;
  publicId: string;
};

/**
 * React Native file objects — expo-image-picker assets are `{uri, name, type}`,
 * which RN's FormData serializes as a multipart file part (no DOM Blob).
 * Desktop/web pass a real Blob/File. One union type covers both platforms.
 */
export type UploadableFile =
  | Blob
  | {
      uri: string;
      name: string;
      type: string;
    };

export function upload(http: HttpClient) {
  return {
    /**
     * POST /api/upload — multipart form with a "file" field. The server
     * proxies the image to Cloudinary (signed upload) so the client never
     * touches Cloudinary secrets.
     */
    image(file: UploadableFile, filename?: string): Promise<UploadResult> {
      const form = new FormData();
      const name =
        filename ??
        (typeof file === "object" && "name" in file && typeof file.name === "string"
          ? file.name
          : "upload.jpg");
      form.append("file", file as Blob, name);
      return http.upload("/api/upload", form);
    },
  };
}

export type UploadEndpoints = ReturnType<typeof upload>;
