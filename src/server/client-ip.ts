import "server-only";
import { createHash } from "node:crypto";

/**
 * Hashed client identifier for rate limiting public endpoints.
 * Behind Caddy, the client IP is the first X-Forwarded-For entry.
 * Raw IPs are never stored.
 */
export function clientKey(request: Request): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

/**
 * Raw client IP, only for legal acceptance records (marketplace NDA and
 * transfer agreement), where the IP is part of the evidence. Nothing else
 * should store it.
 */
export function clientIp(request: Request): string | null {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;
}
