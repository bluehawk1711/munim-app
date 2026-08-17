/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** NestJS API base URL (e.g. https://api.munim.app). */
  readonly VITE_API_URL?: string;
  /** Per-platform API key baked at build time (GitHub secret). */
  readonly VITE_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
