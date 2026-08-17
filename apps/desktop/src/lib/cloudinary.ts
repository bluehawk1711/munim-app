/**
 * Desktop direct-Cloudinary upload — FALLBACK path for product images.
 *
 * Primary path: images upload through the shared API (`POST /api/upload`),
 * which signs with server-side Cloudinary credentials. This fallback is used
 * only when that endpoint is unavailable (e.g. the API is deployed without
 * Cloudinary configured) and the desktop build was made with an UNSIGNED
 * upload preset baked in via GitHub Actions secrets:
 *
 *   VITE_CLOUDINARY_CLOUD_NAME   — from your Cloudinary dashboard URL
 *   VITE_CLOUDINARY_UPLOAD_PRESET — an UNSIGNED preset (Settings → Upload →
 *   Upload presets → Add, set "unsigned"). NEVER bake the API secret into a
 *   client build — unsigned presets exist exactly for this.
 */

const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME ?? "";
const PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET ?? "";

/** True when this build carries the vars needed for a direct upload. */
export function isDirectUploadConfigured(): boolean {
  return Boolean(CLOUD && PRESET);
}

/**
 * Uploads an image straight to Cloudinary via the unsigned preset. Returns the
 * secure URL. Throws when not configured or the upload fails.
 */
export async function uploadImageDirect(file: Blob, filename?: string): Promise<string> {
  if (!isDirectUploadConfigured()) {
    throw new Error("Cloudinary direct upload is not configured in this build.");
  }
  const fd = new FormData();
  fd.append("file", file, filename ?? "upload.jpg");
  fd.append("upload_preset", PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    throw new Error(`Cloudinary upload failed (${res.status})`);
  }
  const body = (await res.json()) as { secure_url?: string; url?: string };
  const url = body.secure_url ?? body.url ?? "";
  if (!url) throw new Error("Cloudinary returned no URL");
  return url;
}
