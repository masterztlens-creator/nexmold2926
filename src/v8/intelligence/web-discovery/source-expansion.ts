import type {
  FetchedPage,
} from "../../acquisition/types.js";

import type {
  DiscoveryInput,
} from "./discovery.js";

interface ExtractedReference {
  readonly url: string;
  readonly kind: "LINK" | "REFERENCE" | "SITEMAP";
  readonly title?: string;
}

const UNSUPPORTED_SCHEMES =
  /^(?:javascript:|mailto:|tel:|sms:|data:|blob:|file:|about:)/i;

const HTML_MEDIA_TYPES = new Set([
  "text/html",
  "application/xhtml+xml",
]);

const SITEMAP_MEDIA_TYPES = new Set([
  "application/xml",
  "text/xml",
  "application/xml; charset=utf-8",
  "text/xml; charset=utf-8",
]);

function decodeHtmlEntities(
  value: string,
): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x2f;/gi, "/")
    .replace(/&#47;/gi, "/");
}

function normalizeWhitespace(
  value: string,
): string {
  return value
    .replace(/\s+/g, " ")
    .trim();
}

function safeResolveUrl(
  rawValue: string,
  baseUrl: string,
): string | null {
  const decoded = decodeHtmlEntities(
    rawValue.trim(),
  );

  if (
    !decoded ||
    UNSUPPORTED_SCHEMES.test(decoded)
  ) {
    return null;
  }

  try {
    const resolved = new URL(
      decoded,
      baseUrl,
    );

    if (
      resolved.protocol !== "http:" &&
      resolved.protocol !== "https:"
    ) {
      return null;
    }

    resolved.hash = "";

    return resolved.toString();
  } catch {
    return null;
  }
}

function attribute(
  attributes: string,
  name: string,
): string | undefined {
  const escapedName =
    name.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );

  const pattern = new RegExp(
    `\\b${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "i",
  );

  const match = attributes.match(pattern);

  if (!match) {
    return undefined;
  }

  return (
    match[1] ??
    match[2] ??
    match[3]
  );
}

function tagAttributes(
  tag: string,
): string {
  return tag
    .replace(
      /^<\s*[a-z0-9:-]+/i,
      "",
    )
    .replace(
      /\/?>\s*$/i,
      "",
    );
}

function relTokens(
  value: string | undefined,
): ReadonlySet<string> {
  if (!value) {
    return new Set<string>();
  }

  return new Set(
    value
      .toLowerCase()
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean),
  );
}

function extractAnchorLinks(
  body: string,
  baseUrl: string,
): readonly ExtractedReference[] {
  const references: ExtractedReference[] = [];

  const anchorPattern =
    /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi;

  for (
    let match = anchorPattern.exec(body);
    match !== null;
    match = anchorPattern.exec(body)
  ) {
    const attributes =
      match[1] ?? "";

    const rawHref = attribute(
      attributes,
      "href",
    );

    if (!rawHref) {
      continue;
    }

    const url = safeResolveUrl(
      rawHref,
      baseUrl,
    );

    if (!url) {
      continue;
    }

    const rawText =
      match[2]
        ?.replace(/<[^>]+>/g, " ")
        ?? "";

    const title =
      normalizeWhitespace(
        rawText,
      ) || undefined;

    references.push({
      url,
      kind: "LINK",
      ...(title === undefined
        ? {}
        : { title }),
    });
  }

  return references;
}

function extractReferenceLinks(
  body: string,
  baseUrl: string,
): readonly ExtractedReference[] {
  const references: ExtractedReference[] = [];

  const linkPattern =
    /<link\b([^>]*)>/gi;

  for (
    let match = linkPattern.exec(body);
    match !== null;
    match = linkPattern.exec(body)
  ) {
    const attributes =
      match[1] ?? "";

    const rawHref = attribute(
      attributes,
      "href",
    );

    if (!rawHref) {
      continue;
    }

    const rel = relTokens(
      attribute(
        attributes,
        "rel",
      ),
    );

    if (
      rel.has("canonical") ||
      rel.has("alternate") ||
      rel.has("author") ||
      rel.has("source") ||
      rel.has("cite")
    ) {
      const url = safeResolveUrl(
        rawHref,
        baseUrl,
      );

      if (!url) {
        continue;
      }

      references.push({
        url,
        kind: "REFERENCE",
      });

      continue;
    }

    if (rel.has("sitemap")) {
      const url = safeResolveUrl(
        rawHref,
        baseUrl,
      );

      if (!url) {
        continue;
      }

      references.push({
        url,
        kind: "SITEMAP",
      });
    }
  }

  return references;
}

function extractOpenGraphReference(
  body: string,
  baseUrl: string,
): readonly ExtractedReference[] {
  const references: ExtractedReference[] = [];

  const metaPattern =
    /<meta\b([^>]*)>/gi;

  for (
    let match = metaPattern.exec(body);
    match !== null;
    match = metaPattern.exec(body)
  ) {
    const attributes =
      match[1] ?? "";

    const property =
      attribute(
        attributes,
        "property",
      ) ??
      attribute(
        attributes,
        "name",
      );

    if (
      !property ||
      property.toLowerCase() !== "og:url"
    ) {
      continue;
    }

    const rawContent = attribute(
      attributes,
      "content",
    );

    if (!rawContent) {
      continue;
    }

    const url = safeResolveUrl(
      rawContent,
      baseUrl,
    );

    if (!url) {
      continue;
    }

    references.push({
      url,
      kind: "REFERENCE",
    });
  }

  return references;
}

function extractSitemapLocations(
  body: string,
  baseUrl: string,
): readonly ExtractedReference[] {
  const references: ExtractedReference[] = [];

  const locationPattern =
    /<loc\b[^>]*>([\s\S]*?)<\/loc\s*>/gi;

  for (
    let match = locationPattern.exec(body);
    match !== null;
    match = locationPattern.exec(body)
  ) {
    const rawLocation =
      match[1]
        ?.replace(/<[^>]+>/g, " ")
        .trim();

    if (!rawLocation) {
      continue;
    }

    const url = safeResolveUrl(
      rawLocation,
      baseUrl,
    );

    if (!url) {
      continue;
    }

    references.push({
      url,
      kind: "SITEMAP",
    });
  }

  return references;
}

function isHtmlPage(
  mediaType: string,
): boolean {
  const normalized =
    mediaType
      .split(";", 1)[0]
      ?.trim()
      .toLowerCase();

  return (
    normalized !== undefined &&
    HTML_MEDIA_TYPES.has(normalized)
  );
}

function isSitemapDocument(
  mediaType: string,
): boolean {
  const normalized =
    mediaType
      .split(";", 1)[0]
      ?.trim()
      .toLowerCase();

  return (
    normalized !== undefined &&
    SITEMAP_MEDIA_TYPES.has(normalized)
  );
}

function deduplicateReferences(
  references: readonly ExtractedReference[],
): readonly ExtractedReference[] {
  const seen = new Set<string>();
  const output: ExtractedReference[] = [];

  for (const reference of references) {
    const key =
      `${reference.kind}\u001f${reference.url}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(reference);
  }

  return output;
}

export function expandSourceReferences(
  page: FetchedPage,
): readonly DiscoveryInput[] {
  const body =
    typeof page.body === "string"
      ? page.body
      : "";

  if (!body.trim()) {
    return Object.freeze([]);
  }

  const references: ExtractedReference[] = [];

  if (
    isSitemapDocument(
      page.mediaType,
    )
  ) {
    references.push(
      ...extractSitemapLocations(
        body,
        page.finalUrl,
      ),
    );
  } else if (
    isHtmlPage(
      page.mediaType,
    )
  ) {
    references.push(
      ...extractAnchorLinks(
        body,
        page.finalUrl,
      ),
    );

    references.push(
      ...extractReferenceLinks(
        body,
        page.finalUrl,
      ),
    );

    references.push(
      ...extractOpenGraphReference(
        body,
        page.finalUrl,
      ),
    );

    references.push(
      ...extractSitemapLocations(
        body,
        page.finalUrl,
      ),
    );
  }

  const unique =
    deduplicateReferences(
      references,
    );

  return Object.freeze(
    unique.map(
      (
        reference,
      ): DiscoveryInput => ({
        url: reference.url,
        kind: reference.kind,
        sourceUrl: page.finalUrl,
        ...(reference.title === undefined
          ? {}
          : {
              title: reference.title,
            }),
        discoveredAt: page.fetchedAt,
      }),
    ),
  );
}