import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import compress from "@fastify/compress";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import { Logger } from "@nestjs/common";
import { AppModule } from "./app.module.js";
import { getEnv } from "./config/env.js";

async function bootstrap(): Promise<void> {
  const env = getEnv();
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

  await app.register(helmet);
  await app.register(compress, { threshold: 1024 });
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } });

  // CORS is wide open — the API is public by design (auth is per-request via
  // x-api-key), so any origin may call it.
  app.enableCors({ origin: true, methods: ["GET", "POST", "PUT", "PATCH", "DELETE"] });

  // All data routes live under /api; health checks stay at the root so the
  // platform's health check (e.g. Render/Railway) can reach them.
  app.setGlobalPrefix("api", { exclude: ["healthz", "readyz"] });

  app.enableShutdownHooks();
  await app.listen(env.PORT, "0.0.0.0");

  Logger.log(
    `Munim API listening on http://0.0.0.0:${env.PORT} (${env.NODE_ENV}, CORS: all origins)`,
    "Bootstrap",
  );
}

void bootstrap();
