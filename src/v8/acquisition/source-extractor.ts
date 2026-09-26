import type { ExtractedEvidenceCandidate } from "./types.js";

const MAX_EXCERPT_LENGTH = 2_000;

const HTML_HEADING_PATTERN =
  /<h([1-6])(?:\s[^>]*)?>([\s\S]*?)<\/h\1>/gi;

const HTML_BLOCK_PATTERN =
  /<(?:p|li|dt|dd|td|th|section|article|blockquote)(?:\s[^>]*)?>([\s\S]*?)<\/(?:p|li|dt|dd|td|th|section|article|blockquote)>/gi;

const MAIN_CONTENT_PATTERN =
  /<main(?:\s[^>]*)?>([\s\S]*?)<\/main>/gi;

const ARTICLE_CONTENT_PATTERN =
  /<article(?:\s[^>]*)?>([\s\S]*?)<\/article>/gi;

const BODY_CONTENT_PATTERN =
  /<body(?:\s[^>]*)?>([\s\S]*?)<\/body>/gi;

const SEMANTIC_UI_OPEN_PATTERN =
  /<(header|nav|footer|aside|dialog|template)(?:\s[^>]*)?>/gi;

const ROLE_UI_OPEN_PATTERN =
  /<(div|section|aside|header|footer|nav)(?:\s[^>]*)?>/gi;

const PARAMETER_VALUE_UNIT_PATTERNS: readonly RegExp[] = [
  /\b([A-Za-z][A-Za-z0-9 _\/().-]{1,80}?)\s*[:=]\s*(-?\d+(?:\.\d+)?)\s*(mm|cm|m|µm|μm|um|in|inch|inches|kg|g|mg|MPa|GPa|Pa|bar|psi|°C|°F|K|N|kN|J|kJ|W|kW|%|s|min|h)\b/gi,
  /\b([A-Za-z][A-Za-z0-9 _\/().-]{1,80}?)\s+(-?\d+(?:\.\d+)?)\s*(mm|cm|m|µm|μm|um|in|inch|inches|kg|g|mg|MPa|GPa|Pa|bar|psi|°C|°F|K|N|kN|J|kJ|W|kW|%|s|min|h)\b/gi,
];

function decodeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<template[\s\S]*?<\/template>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, code: string) => {
      const numericCode = Number(code);

      if (
        !Number.isInteger(numericCode) ||
        numericCode < 0 ||
        numericCode > 0x10ffff
      ) {
        return " ";
      }

      return String.fromCodePoint(numericCode);
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => {
      const numericCode = Number.parseInt(code, 16);

      if (
        !Number.isInteger(numericCode) ||
        numericCode < 0 ||
        numericCode > 0x10ffff
      ) {
        return " ";
      }

      return String.fromCodePoint(numericCode);
    })
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(value: string): string {
  return decodeHtml(value)
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUnit(unit: string): string {
  const normalized = unit.trim();

  if (normalized === "μm") return "µm";
  if (normalized === "um") return "µm";
  if (normalized === "inch" || normalized === "inches") return "in";

  return normalized;
}

function normalizeParameter(parameter: string): string {
  return parameter
    .replace(/\s+/g, " ")
    .replace(/[:=]\s*$/, "")
    .trim();
}

function isPlausibleParameter(parameter: string): boolean {
  const normalized = parameter.trim();

  if (normalized.length < 2 || normalized.length > 80) return false;
  if (!/[A-Za-z]/.test(normalized)) return false;

  if (
    /^(?:the|a|an|is|was|are|were|has|have|with|from|for|and|or)$/i.test(
      normalized,
    )
  ) {
    return false;
  }

  return true;
}

function extractFirstMatchingRegion(
  html: string,
  pattern: RegExp,
): string | undefined {
  pattern.lastIndex = 0;

  const match = pattern.exec(html);

  pattern.lastIndex = 0;

  const content = match?.[1];

  if (!content) return undefined;

  return content;
}

function extractAllMatchingRegions(
  html: string,
  pattern: RegExp,
): readonly string[] {
  const regions: string[] = [];

  pattern.lastIndex = 0;

  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const content = match[1];

    if (content) {
      regions.push(content);
    }
  }

  pattern.lastIndex = 0;

  return regions;
}

function isSelfClosingTag(openingTag: string): boolean {
  return /\/\s*>$/.test(openingTag);
}

function isUiRoleOrMarker(
  attributes: string,
): boolean {
  return (
    /\brole\s*=\s*["'](?:banner|navigation|contentinfo|complementary|dialog)["']/i.test(
      attributes,
    ) ||
    /(?:id|class)\s*=\s*["'][^"']*(?:cookie|cookies|consent|gdpr|privacy-banner|privacy-consent|cookie-banner|cookie-consent|modal|popup|overlay|sidebar|side-bar|related-content|related-posts|advertisement|advert|promo|promotional|newsletter|subscribe|breadcrumb|breadcrumbs|hero2-lower|jump-navigation|connect-to-footer)[^"']*["']/i.test(
      attributes,
    )
  );
}

function findMatchingElementEnd(
  html: string,
  startIndex: number,
  tagName: string,
): number {
  const tagPattern = new RegExp(
    `<\\/?${tagName}(?:\\s[^>]*)?>`,
    "gi",
  );

  tagPattern.lastIndex = startIndex;

  let depth = 1;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(html)) !== null) {
    const token = match[0];

    if (/^<\//.test(token)) {
      depth -= 1;

      if (depth === 0) {
        return match.index + token.length;
      }

      continue;
    }

    if (!isSelfClosingTag(token)) {
      depth += 1;
    }
  }

  return html.length;
}

function isJumpToSectionUiBlock(
  html: string,
  openingIndex: number,
  openingTag: string,
  tagName: string,
): boolean {
  if (tagName.toLowerCase() !== "div") {
    return false;
  }

  const subtreeEnd = findMatchingElementEnd(
    html,
    openingIndex + openingTag.length,
    tagName,
  );

  if (subtreeEnd <= openingIndex) {
    return false;
  }

  const subtree = html.slice(
    openingIndex,
    subtreeEnd,
  );

  const hasJumpHeading =
    /<h[1-6](?:\s[^>]*)?>[\s\S]*?Jump\s+to\s+Section[\s\S]*?<\/h[1-6]>/i.test(
      subtree,
    );

  if (!hasJumpHeading) {
    return false;
  }

  const anchorCount =
    (subtree.match(/<a(?:\s[^>]*)?>/gi) ?? []).length;

  const hasAnchorTargets =
    /(?:data-anchor|href)\s*=\s*["'][^"']*#[^"']+["']/i.test(
      subtree,
    );

  return anchorCount >= 2 && hasAnchorTargets;
}

function removeUiSubtrees(
  html: string,
  openingPattern: RegExp,
  shouldRemove: (
    openingTag: string,
    openingIndex: number,
    tagName: string,
  ) => boolean,
): string {
  const output: string[] = [];

  let cursor = 0;

  openingPattern.lastIndex = 0;

  let match: RegExpExecArray | null;

  while ((match = openingPattern.exec(html)) !== null) {
    const openingTag = match[0];
    const tagName = match[1];

    if (!tagName) {
      continue;
    }

    if (
      !shouldRemove(
        openingTag,
        match.index,
        tagName,
      )
    ) {
      continue;
    }

    output.push(
      html.slice(cursor, match.index),
    );

    const subtreeEnd = findMatchingElementEnd(
      html,
      match.index + openingTag.length,
      tagName,
    );

    cursor = subtreeEnd;

    openingPattern.lastIndex = subtreeEnd;
  }

  output.push(html.slice(cursor));

  openingPattern.lastIndex = 0;

  return output.join("");
}

function removeSemanticUiSubtrees(
  html: string,
): string {
  return removeUiSubtrees(
    html,
    SEMANTIC_UI_OPEN_PATTERN,
    () => true,
  );
}

function removeRoleUiSubtrees(
  html: string,
): string {
  return removeUiSubtrees(
    html,
    ROLE_UI_OPEN_PATTERN,
    (
      openingTag,
      openingIndex,
      tagName,
    ) => {
      const attributes = openingTag
        .replace(
          /^<[^ \t\r\n\f>]+/i,
          "",
        )
        .replace(/\/?>$/i, "");

      if (
        isUiRoleOrMarker(attributes)
      ) {
        return true;
      }

      return isJumpToSectionUiBlock(
        html,
        openingIndex,
        openingTag,
        tagName,
      );
    },
  );
}

function removeNonContentBlocks(
  html: string,
): string {
  const withoutSemanticUi =
    removeSemanticUiSubtrees(html);

  return removeRoleUiSubtrees(
    withoutSemanticUi,
  );
}

function selectSemanticContent(
  html: string,
): string {
  const sanitized = html
    .replace(
      /<script[\s\S]*?<\/script>/gi,
      " ",
    )
    .replace(
      /<style[\s\S]*?<\/style>/gi,
      " ",
    )
    .replace(
      /<noscript[\s\S]*?<\/noscript>/gi,
      " ",
    )
    .replace(
      /<template[\s\S]*?<\/template>/gi,
      " ",
    )
    .replace(
      /<svg[\s\S]*?<\/svg>/gi,
      " ",
    );

  const mainRegions =
    extractAllMatchingRegions(
      sanitized,
      MAIN_CONTENT_PATTERN,
    );

  if (mainRegions.length > 0) {
    return removeNonContentBlocks(
      mainRegions.join("\n"),
    );
  }

  const articleRegions =
    extractAllMatchingRegions(
      sanitized,
      ARTICLE_CONTENT_PATTERN,
    );

  if (articleRegions.length > 0) {
    return removeNonContentBlocks(
      articleRegions.join("\n"),
    );
  }

  const bodyRegion =
    extractFirstMatchingRegion(
      sanitized,
      BODY_CONTENT_PATTERN,
    );

  if (bodyRegion) {
    return removeNonContentBlocks(
      bodyRegion,
    );
  }

  return removeNonContentBlocks(
    sanitized,
  );
}

function buildSectionMap(
  html: string,
): readonly {
  readonly index: number;
  readonly section: string;
}[] {
  const sections: {
    index: number;
    section: string;
  }[] = [];

  let match: RegExpExecArray | null;

  while (
    (match =
      HTML_HEADING_PATTERN.exec(html)) !== null
  ) {
    const section = normalizeText(
      match[2] ?? "",
    );

    if (!section) continue;

    sections.push({
      index: match.index,
      section: section.slice(0, 500),
    });
  }

  HTML_HEADING_PATTERN.lastIndex = 0;

  return sections;
}

function sectionForIndex(
  sections: readonly {
    readonly index: number;
    readonly section: string;
  }[],
  index: number,
): string | undefined {
  let current: string | undefined;

  for (const section of sections) {
    if (section.index > index) break;

    current = section.section;
  }

  return current;
}

function buildStructuredEvidence(
  html: string,
): readonly ExtractedEvidenceCandidate[] {
  const content =
    selectSemanticContent(html);

  const sections =
    buildSectionMap(content);

  const candidates: ExtractedEvidenceCandidate[] =
    [];

  for (
    const pattern of PARAMETER_VALUE_UNIT_PATTERNS
  ) {
    pattern.lastIndex = 0;

    let match: RegExpExecArray | null;

    while (
      (match = pattern.exec(content)) !== null
    ) {
      const parameter =
        normalizeParameter(
          match[1] ?? "",
        );

      const value =
        (match[2] ?? "").trim();

      const unit =
        normalizeUnit(
          match[3] ?? "",
        );

      if (
        !isPlausibleParameter(parameter)
      ) {
        continue;
      }

      if (!value || !unit) continue;

      const rawExcerpt =
        normalizeText(
          match[0] ?? "",
        );

      if (!rawExcerpt) continue;

      const section =
        sectionForIndex(
          sections,
          match.index,
        );

      candidates.push({
        locator:
          `document:parameter:${parameter.toLowerCase()}`,
        excerpt:
          rawExcerpt.slice(
            0,
            MAX_EXCERPT_LENGTH,
          ),
        ...(section
          ? { section }
          : {}),
        parameter,
        value,
        unit,
        extractionConfidence:
          "HIGH",
      });
    }

    pattern.lastIndex = 0;
  }

  return candidates;
}

function buildBlockEvidence(
  html: string,
): readonly ExtractedEvidenceCandidate[] {
  const content =
    selectSemanticContent(html);

  const sections =
    buildSectionMap(content);

  const candidates: ExtractedEvidenceCandidate[] =
    [];

  HTML_BLOCK_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;

  while (
    (match =
      HTML_BLOCK_PATTERN.exec(content)) !== null
  ) {
    const excerpt =
      normalizeText(
        match[1] ?? "",
      );

    if (!excerpt) continue;

    const section =
      sectionForIndex(
        sections,
        match.index,
      );

    candidates.push({
      locator:
        `document:block:${match.index}`,
      excerpt:
        excerpt.slice(
          0,
          MAX_EXCERPT_LENGTH,
        ),
      ...(section
        ? { section }
        : {}),
      extractionConfidence:
        "MEDIUM",
    });
  }

  HTML_BLOCK_PATTERN.lastIndex = 0;

  return candidates;
}

function deduplicateEvidence(
  candidates: readonly ExtractedEvidenceCandidate[],
): readonly ExtractedEvidenceCandidate[] {
  const seen = new Set<string>();
  const output: ExtractedEvidenceCandidate[] =
    [];

  for (const candidate of candidates) {
    const key = [
      candidate.locator,
      candidate.excerpt,
      candidate.section ?? "",
      candidate.parameter ?? "",
      candidate.value ?? "",
      candidate.unit ?? "",
    ].join("\u001f");

    if (seen.has(key)) continue;

    seen.add(key);
    output.push(candidate);
  }

  return output;
}

export function extractTextEvidence(
  html: string,
  locator = "document:text",
): readonly ExtractedEvidenceCandidate[] {
  const content =
    selectSemanticContent(html);

  const text =
    decodeHtml(content);

  if (!text) return [];

  return [
    {
      locator,
      excerpt:
        text.slice(
          0,
          MAX_EXCERPT_LENGTH,
        ),
      extractionConfidence:
        "MEDIUM",
    },
  ];
}

export function extractEvidenceByPattern(
  html: string,
  patterns: readonly RegExp[],
): readonly ExtractedEvidenceCandidate[] {
  const content =
    selectSemanticContent(html);

  const text =
    decodeHtml(content);

  const output: ExtractedEvidenceCandidate[] =
    [];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;

    const match =
      pattern.exec(text);

    if (match?.[0]) {
      output.push({
        locator:
          `document:pattern:${pattern.source}`,
        excerpt:
          match[0].slice(
            0,
            MAX_EXCERPT_LENGTH,
          ),
        extractionConfidence:
          "MEDIUM",
      });
    }

    pattern.lastIndex = 0;
  }

  return output;
}

export function extractStructuredEvidence(
  html: string,
): readonly ExtractedEvidenceCandidate[] {
  return deduplicateEvidence([
    ...buildStructuredEvidence(html),
    ...buildBlockEvidence(html),
  ]);
}