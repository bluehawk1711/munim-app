/**
 * Local module augmentation for `@fastify/multipart`.
 *
 * The plugin ships a `declare module "fastify"` in its own types file, but
 * under pnpm's isolated node_modules the file can't resolve `fastify` from its
 * directory (TS2307), so the augmentation is silently dropped. Re-declaring it
 * here (from src, where `fastify` resolves fine) restores `request.file()`.
 * The runtime plugin is still registered in main.ts.
 */
import type { Readable } from "node:stream";

declare module "fastify" {
  interface FastifyRequest {
    /** Stream-mode multipart file (registered via @fastify/multipart). */
    file: () => Promise<
      | {
          filename: string;
          encoding: string;
          mimetype: string;
          file: Readable;
        }
      | undefined
    >;
  }
}
