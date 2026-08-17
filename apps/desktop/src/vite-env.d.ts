/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** NestJS API base URL (e.g. https://api.munim.app). */
  readonly VITE_API_URL?: string;
  /** Per-platform API key baked at build time (GitHub secret). */
  readonly VITE_API_KEY?: string;
  /** Cloudinary cloud name for the direct-upload fallback (unsigned preset). */
  readonly VITE_CLOUDINARY_CLOUD_NAME?: string;
  /** Cloudinary UNSIGNED upload preset for the direct-upload fallback. */
  readonly VITE_CLOUDINARY_UPLOAD_PRESET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
