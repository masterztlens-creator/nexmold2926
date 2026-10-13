
import { rawBytesFingerprint } from "../foundation/hash.js";
import { evaluateSourceUrl } from "./source-policy.js";
import { normalizeSourceUrl } from "./url-normalizer.js";
import type { FetchedPage, PageFetcher } from "./types.js";

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const DEFAULT_MAX_REDIRECTS = 10;
const DEFAULT_CHARSET = "utf-8";

interface ParsedContentType {
  readonly mediaType: string;
  readonly charset: string;
}

function parseContentType(value: string | null): ParsedContentType {
  if (!value?.trim()) {
    return {
      mediaType: "application/octet-stream",
      charset: DEFAULT_CHARSET,
    };
  }

  const parts = value.split(";");
  const mediaType = parts[0]?.trim().toLowerCase();

  let charset = DEFAULT_CHARSET;

  for (const part of parts.slice(1)) {
    const match = /^\s*charset\s*=\s*(?:"([^"]+)"|'([^']+)'|([^;\s]+))\s*$/i.exec(
      part,
    );

    if (!match) {
      continue;
    }

    const declaredCharset = match[1] ?? match[2] ?? match[3];

    if (declaredCharset) {
      charset = declaredCharset.trim();
      break;
    }
  }

  return {
    mediaType: mediaType || "application/octet-stream",
    charset,
  };
}

function decodeResponseBody(
  bytes: Uint8Array,
  charset: string,
): string {
  let decoder: TextDecoder;

  try {
    decoder = new TextDecoder(charset, {
      fatal: true,
    });
  } catch {
    throw new Error("V8_ACQUISITION_UNSUPPORTED_CHARSET");
  }

  try {
    return decoder.decode(bytes);
  } catch {
    throw new Error("V8_ACQUISITION_INVALID_RESPONSE_ENCODING");
  }
}

export interface HttpPageFetcherOptions {
  readonly timeoutMs?: number;
  readonly maxBytes?: number;
  readonly maxRedirects?: number;
}

export class HttpPageFetcher implements PageFetcher {
  private readonly timeoutMs: number;
  private readonly maxBytes: number;
  private readonly maxRedirects: number;

  constructor(options: HttpPageFetcherOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 20_000;
    this.maxBytes = options.maxBytes ?? 5_000_000;
    this.maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  }

  async fetch(
    url: string,
    options: { readonly signal?: AbortSignal } = {},
  ): Promise<FetchedPage> {
    const policy = evaluateSourceUrl(url);

    if (policy.status !== "ELIGIBLE" || !policy.normalizedUrl) {
      throw new Error(
        policy.reason ?? "V8_ACQUISITION_SOURCE_POLICY_UNKNOWN",
      );
    }

    const requestedUrl = policy.normalizedUrl;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    const signal = options.signal
      ? AbortSignal.any([controller.signal, options.signal])
      : controller.signal;

    const redirectChain: string[] = [requestedUrl];
    const visited = new Set<string>([requestedUrl]);

    let currentUrl = requestedUrl;
    let redirectCount = 0;

    try {
      while (true) {
        const response = await fetch(currentUrl, {
          redirect: "manual",
          signal,
          headers: {
            accept:
              "text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.1",
          },
        });

        if (REDIRECT_STATUSES.has(response.status)) {
          if (redirectCount >= this.maxRedirects) {
            throw new Error("V8_ACQUISITION_TOO_MANY_REDIRECTS");
          }

          const location = response.headers.get("location");

          if (!location) {
            throw new Error("V8_ACQUISITION_REDIRECT_PROVENANCE_UNKNOWN");
          }

          let nextUrl: string;

          try {
            nextUrl = normalizeSourceUrl(
              new URL(location, currentUrl).toString(),
            );
          } catch (error) {
            throw new Error(
              error instanceof Error
                ? error.message
                : "V8_ACQUISITION_REDIRECT_PROVENANCE_UNKNOWN",
            );
          }

          /*
           * Every redirect target is a new acquisition boundary.
           *
           * A URL being reachable through an otherwise eligible public source
           * does not make the redirect target eligible. Re-evaluate the
           * normalized target before any network request is made.
           */
          const nextPolicy = evaluateSourceUrl(nextUrl);

          if (
            nextPolicy.status !== "ELIGIBLE" ||
            !nextPolicy.normalizedUrl
          ) {
            throw new Error(
              nextPolicy.reason ??
                "V8_ACQUISITION_REDIRECT_TARGET_POLICY_UNKNOWN",
            );
          }

          nextUrl = nextPolicy.normalizedUrl;

          if (visited.has(nextUrl)) {
            throw new Error("V8_ACQUISITION_REDIRECT_LOOP");
          }

          visited.add(nextUrl);
          redirectChain.push(nextUrl);
          currentUrl = nextUrl;
          redirectCount += 1;
          continue;
        }

        if (!response.ok) {
          throw new Error(`V8_ACQUISITION_HTTP_STATUS_${response.status}`);
        }

        const contentLength = Number(
          response.headers.get("content-length") ?? "0",
        );

        if (
          Number.isFinite(contentLength) &&
          contentLength > this.maxBytes
        ) {
          throw new Error("V8_ACQUISITION_RESPONSE_TOO_LARGE");
        }

        const bytes = new Uint8Array(await response.arrayBuffer());

        if (bytes.byteLength > this.maxBytes) {
          throw new Error("V8_ACQUISITION_RESPONSE_TOO_LARGE");
        }

        const contentType = parseContentType(
          response.headers.get("content-type"),
        );

        const body = decodeResponseBody(bytes, contentType.charset);

        return {
          requestedUrl,
          finalUrl: currentUrl,
          redirectChain,
          status: response.status,
          mediaType: contentType.mediaType,
          body,
          bytes,
          fetchedAt: new Date().toISOString(),
        };
      }
    } finally {
      clearTimeout(timer);
    }
  }

  static contentHash(bytes: Uint8Array) {
    return rawBytesFingerprint(bytes);
  }
}
