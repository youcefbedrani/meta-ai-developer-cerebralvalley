import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { ConfigError, getIntegrationEnv } from "@/lib/env";

/*
 * Social tokens are stored encrypted (AES-256-GCM) with a key derived from SOCIAL_TOKEN_SECRET, and the
 * public video links Facebook/Instagram fetch are signed (HMAC) and expire.
 */

function secret(): string {
  const s = getIntegrationEnv().SOCIAL_TOKEN_SECRET;
  if (!s || s.length < 32) throw new ConfigError("linkedin", ["SOCIAL_TOKEN_SECRET (at least 32 random characters, e.g. openssl rand -hex 32)"]);
  return s;
}

const key = (purpose: string) => createHash("sha256").update(`${purpose}:${secret()}`).digest();

export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key("token"), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function decryptToken(stored: string): string {
  const [v, iv, tag, data] = stored.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Unknown token format");
  const decipher = createDecipheriv("aes-256-gcm", key("token"), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

export function sign(value: string): string {
  return createHmac("sha256", key("sign")).update(value).digest("base64url");
}

export function verifySignature(value: string, signature: string): boolean {
  const expected = Buffer.from(sign(value));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
