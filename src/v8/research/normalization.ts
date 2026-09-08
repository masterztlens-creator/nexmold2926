import { createHash } from "node:crypto";
import type { AcquiredDocument } from "../foundation/acquisition.js";
import type { NormalizedDocument } from "./types.js";
function decode(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", {
    fatal: false,
  }).decode(bytes);
}
function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'");
}
function stripHtml(input: string): {
  title: string;
  text: string;
} {
  const titleMatch = input.match(
    /<title[^>]*>([\s\S]*?)<\/title>/i,
  );
  const title = titleMatch
    ? decodeEntities(titleMatch[1].replace(/\s+/g, " ").trim())
    : "";
  const withoutNoise = input
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ");
  const text = decodeEntities(
    withoutNoise
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
  return {
    title,
    text,
  };
}
export function normalizeAcquiredDocument(
  document: AcquiredDocument,
): NormalizedDocument {
  const raw = decode(document.bytes);
  const parsed = stripHtml(raw);
  const contentHash = createHash("sha256")
    .update(parsed.text, "utf8")
    .digest("hex");
  return Object.freeze({
    requestedUrl: document.requestedUrl,
    finalUrl: document.finalUrl,
    canonicalUrl: document.finalUrl,
    title: parsed.title,
    text: parsed.text,
    contentHash,
    normalizedAt: new Date().toISOString(),
  });
}