import "server-only";
import { Readability } from "@mozilla/readability";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { parseHTML } from "linkedom";
import type { PageReader } from "./types";

const MAX_BYTES = 2_000_000;
const MAX_TEXT = 12_000;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 15_000;

/** True for loopback, private, link-local, CGNAT, multicast and other non-public addresses. */
export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  const v6 = ip.toLowerCase();
  if (v6 === "::" || v6 === "::1") return true;
  if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7));
  return v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe8") || v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb") || v6.startsWith("ff");
}

/** Rejects non-http(s) URLs and hosts that resolve to non-public addresses (SSRF protection). */
export async function assertPublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only http(s) URLs are allowed");
  if (url.username || url.password) throw new Error("Credentials in URLs are not allowed");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) throw new Error("Private host");
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) throw new Error("Host resolves to a private address");
  return url;
}

async function readBody(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/** Fetches a public web page and extracts readable text. Page content is untrusted data. */
export class FetchReader implements PageReader {
  async read(raw: string) {
    try {
      let url = await assertPublicUrl(raw);
      let res: Response | null = null;
      for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        res = await fetch(url, {
          redirect: "manual",
          signal: AbortSignal.timeout(TIMEOUT_MS),
          headers: { "user-agent": "Mozilla/5.0 (compatible; StartumResearchBot/1.0)", accept: "text/html,text/plain;q=0.9" },
        });
        const location = res.headers.get("location");
        if (res.status >= 300 && res.status < 400 && location) {
          url = await assertPublicUrl(new URL(location, url).toString());
          continue;
        }
        break;
      }
      if (!res || !res.ok) return null;
      const type = res.headers.get("content-type") ?? "";
      const body = await readBody(res);
      if (type.includes("text/plain")) return { title: null, text: body.slice(0, MAX_TEXT) };
      if (!type.includes("html")) return null;
      const { document } = parseHTML(body);
      const article = new Readability(document as unknown as Document).parse();
      const text = (article?.textContent ?? document.body?.textContent ?? "").replace(/\s+/g, " ").trim();
      return text ? { title: article?.title ?? null, text: text.slice(0, MAX_TEXT) } : null;
    } catch {
      return null;
    }
  }
}
