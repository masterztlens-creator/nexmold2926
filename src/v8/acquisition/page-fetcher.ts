import { rawBytesFingerprint } from "../foundation/hash.js";
import type { FetchedPage, PageFetcher } from "./types.js";

export interface HttpPageFetcherOptions {
  readonly timeoutMs?: number;
  readonly maxBytes?: number;
}

export class HttpPageFetcher implements PageFetcher {
  private readonly timeoutMs: number;
  private readonly maxBytes: number;

  constructor(options: HttpPageFetcherOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 20_000;
    this.maxBytes = options.maxBytes ?? 5_000_000;
  }

  async fetch(url: string, options: { readonly signal?: AbortSignal } = {}): Promise<FetchedPage> {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("V8_ACQUISITION_UNSUPPORTED_URL");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const signal = options.signal ? AbortSignal.any([controller.signal, options.signal]) : controller.signal;
    try {
      const response = await fetch(parsed, { redirect: "follow", signal, headers: { accept: "text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.1" } });
      const contentLength = Number(response.headers.get("content-length") ?? "0");
      if (contentLength > this.maxBytes) throw new Error("V8_ACQUISITION_RESPONSE_TOO_LARGE");
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > this.maxBytes) throw new Error("V8_ACQUISITION_RESPONSE_TOO_LARGE");
      const mediaType = response.headers.get("content-type")?.split(";", 1)[0]?.trim() || "application/octet-stream";
      return {
        requestedUrl: parsed.toString(),
        finalUrl: response.url,
        redirectChain: response.url === parsed.toString() ? [parsed.toString()] : [parsed.toString(), response.url],
        status: response.status,
        mediaType,
        body: new TextDecoder().decode(bytes),
        bytes,
        fetchedAt: new Date().toISOString(),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  static contentHash(bytes: Uint8Array) {
    return rawBytesFingerprint(bytes);
  }
}
