import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { getIntegrationEnv } from "@/lib/env";

/**
 * Local file storage for user uploads (interview audio). Keys are generated here, never taken from users,
 * so a key can't point outside the upload directory. Production mounts a volume at UPLOAD_DIR.
 */
const root = () => path.resolve(getIntegrationEnv().UPLOAD_DIR || ".data/uploads");
const KEY_RE = /^[a-z]+\/[0-9a-f-]{36}\.[a-z0-9]{2,4}$/;

function fileFor(key: string): string {
  if (!KEY_RE.test(key)) throw new Error("Invalid storage key");
  return path.join(root(), key);
}

export async function saveUpload(folder: "audio" | "images", ext: string, data: Buffer): Promise<string> {
  const key = `${folder}/${randomUUID()}.${ext}`;
  const file = fileFor(key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, data);
  return key;
}

export async function uploadSize(key: string): Promise<number | null> {
  try {
    return (await stat(fileFor(key))).size;
  } catch {
    return null;
  }
}

export async function readUpload(key: string): Promise<Buffer> {
  return readFile(fileFor(key));
}

export async function deleteUpload(key: string): Promise<void> {
  await rm(fileFor(key), { force: true });
}
