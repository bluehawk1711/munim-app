import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { timingSafeEqual } from "node:crypto";
import { getAllowedApiKeys, getEnv } from "../config/env.js";

export const IS_PUBLIC_KEY = "isPublic";
/** Marks a route as reachable without an API key (e.g. health checks). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Constant-time string comparison (avoids length-based timing leaks). */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Global guard: every request must send its per-platform key in the
 * `x-api-key` header, matching one of the three keys from env
 * (API_KEY_WEB / API_KEY_DESKTOP / API_KEY_MOBILE). Keys are injected into
 * each client at build time via GitHub Actions secrets.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  // Explicit @Inject — tsx/esbuild dev doesn't emit decorator metadata, so
  // implicit constructor injection would leave `reflector` undefined.
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
    const key = request.headers["x-api-key"] ?? "";

    if (!key) {
      throw new UnauthorizedException("Missing x-api-key header");
    }

    const allowed = getAllowedApiKeys(getEnv());
    if (allowed.length === 0) {
      throw new UnauthorizedException("No API keys configured on the server");
    }
    if (!allowed.some((candidate) => safeEqual(candidate, key))) {
      throw new UnauthorizedException("Invalid API key");
    }
    return true;
  }
}
