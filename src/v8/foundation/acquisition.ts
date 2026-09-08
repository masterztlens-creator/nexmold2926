import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { invariant } from "../constitution/invariants.js";

export interface AcquiredDocument {
  requestedUrl: string;
  finalUrl: string;
  redirectChain: readonly string[];
  status: number;
  mediaType: string;
  retrievedAt: string;
  byteLength: number;
  documentHash: string;
  bytes: Uint8Array;
}

export interface AcquisitionOptions {
  maxRedirects?: number;
  timeoutMs?: number;
  userAgent?: string;
}

export async function acquireHttpDocument(
  url: string,
  options: AcquisitionOptions = {},
): Promise<Readonly<AcquiredDocument>> {
  invariant(/^https?:\/\//i.test(url), "V8_ACQUIRE_URL_INVALID", "Only HTTP(S) sources may be acquired.");
  const maxRedirects = options.maxRedirects ?? 8;
  const timeoutMs = options.timeoutMs ?? 30000;
  const headers = { "user-agent": options.userAgent ?? "NEXMOLD-V8-SearchOS/1.0" };
  const chain: string[] = [url];
  let current = url;
  let response: Response | undefined;

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      response = await fetch(current, { redirect: "manual", headers, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      invariant(Boolean(location), "V8_ACQUIRE_REDIRECT_WITHOUT_LOCATION", "Redirect response has no Location header.");
      current = new URL(location!, current).toString();
      chain.push(current);
      continue;
    }
    break;
  }

  invariant(Boolean(response), "V8_ACQUIRE_NO_RESPONSE", "No HTTP response received.");
  invariant(!(response!.status >= 300 && response!.status < 400), "V8_ACQUIRE_REDIRECT_LIMIT", "Redirect limit exceeded.");

  const bytes = new Uint8Array(await response!.arrayBuffer());
  const documentHash = createHash("sha256")
  .update(Buffer.from(bytes))
  .digest("hex");

  return Object.freeze({
    requestedUrl: url,
    finalUrl: response!.url || current,
    redirectChain: Object.freeze([...chain]),
    status: response!.status,
    mediaType: (response!.headers.get("content-type") ?? "application/octet-stream").split(";")[0].trim().toLowerCase(),
    retrievedAt: new Date().toISOString(),
    byteLength: bytes.byteLength,
    documentHash,
    bytes,
  });
}

export function persistRawSnapshot(bytes: Uint8Array, documentHash: string, root = ".nexmold/v8/raw-snapshots"): string {
  invariant(/^[a-f0-9]{64}$/i.test(documentHash), "V8_SNAPSHOT_HASH_INVALID", "Snapshot hash must be SHA-256.");
  const dir = join(root, documentHash.slice(0, 2));
  mkdirSync(dir, { recursive: true });
  const path = join(dir, documentHash);
  writeFileSync(path, bytes);
  return path.replaceAll("\\", "/");
}
