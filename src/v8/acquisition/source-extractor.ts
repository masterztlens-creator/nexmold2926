import type { ExtractedEvidenceCandidate } from "./types.js";

const MAX_EXCERPT_LENGTH = 2_000;

const HTML_HEADING_PATTERN =
  /<h([1-6])(?:\s[^>]*)?>([\s\S]*?)<\/h\1>/gi;

const HTML_BLOCK_PATTERN =
  /<(?:p|li|dt|dd|td|th|div|section|article|blockquote)(?:\s[^>]*)?>([\s\S]*?)<\/(?:p|li|dt|dd|td|th|div|section|article|blockquote)>/gi;

const PARAMETER_VALUE_UNIT_PATTERNS: readonly RegExp[] = [
  /\b([A-Za-z][A-Za-z0-9 _\/().-]{1,80}?)\s*[:=]\s*(-?\d+(?:\.\d+)?)\s*(mm|cm|m|µm|μm|um|in|inch|inches|kg|g|mg|MPa|GPa|Pa|bar|psi|°C|°F|K|N|kN|J|kJ|W|kW|%|s|min|h)\b/gi,
  /\b([A-Za-z][A-Za-z0-9 _\/().-]{1,80}?)\s+(-?\d+(?:\.\d+)?)\s*(mm|cm|m|µm|μm|um|in|inch|inches|kg|g|mg|MPa|GPa|Pa|bar|psi|°C|°F|K|N|kN|J|kJ|W|kW|%|s|min|h)\b/gi,
];

function decodeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
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

  if (normalized === "μm") {
    return "µm";
  }

  if (normalized === "um") {
    return "µm";
  }

  if (normalized === "inch" || normalized === "inches") {
    return "in";
  }

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

  if (normalized.length < 2 || normalized.length > 80) {
    return false;
  }

  if (!/[A-Za-z]/.test(normalized)) {
    return false;
  }

  if (/^(?:the|a|an|is|was|are|were|has|have|with|from|for|and|or)$/i.test(normalized)) {
    return false;
  }

  return true;
}

function buildSectionMap(html: string): readonly {
  readonly index: number;
  readonly section: string;
}[] {
  const sections: {
    index: number;
    section: string;
  }[] = [];

  let match: RegExpExecArray | null;

  while ((match = HTML_HEADING_PATTERN.exec(html)) !== null) {
    const section = normalizeText(match[2] ?? "");

    if (!section) {
      continue;
    }

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
    if (section.index > index) {
      break;
    }

    current = section.section;
  }

  return current;
}

function buildStructuredEvidence(
  html: string,
): readonly ExtractedEvidenceCandidate[] {
  const sections = buildSectionMap(html);

  const candidates: ExtractedEvidenceCandidate[] = [];

  for (const pattern of PARAMETER_VALUE_UNIT_PATTERNS) {
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(html)) !== null) {
      const parameter = normalizeParameter(match[1] ?? "");
      const value = (match[2] ?? "").trim();
      const unit = normalizeUnit(match[3] ?? "");

      if (!isPlausibleParameter(parameter)) {
        continue;
      }

      if (!value || !unit) {
        continue;
      }

      const rawExcerpt = normalizeText(match[0] ?? "");

      if (!rawExcerpt) {
        continue;
      }

      const section = sectionForIndex(
        sections,
        match.index,
      );

      candidates.push({
        locator: `document:parameter:${parameter.toLowerCase()}`,
        excerpt: rawExcerpt.slice(0, MAX_EXCERPT_LENGTH),
        ...(section
          ? {
              section,
            }
          : {}),
        parameter,
        value,
        unit,
        extractionConfidence: "HIGH",
      });
    }

    pattern.lastIndex = 0;
  }

  return candidates;
}

function buildBlockEvidence(
  html: string,
): readonly ExtractedEvidenceCandidate[] {
  const sections = buildSectionMap(html);

  const candidates: ExtractedEvidenceCandidate[] = [];

  let match: RegExpExecArray | null;

  while ((match = HTML_BLOCK_PATTERN.exec(html)) !== null) {
    const excerpt = normalizeText(match[1] ?? "");

    if (!excerpt) {
      continue;
    }

    const section = sectionForIndex(
      sections,
      match.index,
    );

    candidates.push({
      locator: `document:block:${match.index}`,
      excerpt: excerpt.slice(0, MAX_EXCERPT_LENGTH),
      ...(section
        ? {
            section,
          }
        : {}),
      extractionConfidence: "MEDIUM",
    });
  }

  HTML_BLOCK_PATTERN.lastIndex = 0;

  return candidates;
}

function deduplicateEvidence(
  candidates: readonly ExtractedEvidenceCandidate[],
): readonly ExtractedEvidenceCandidate[] {
  const seen = new Set<string>();
  const output: ExtractedEvidenceCandidate[] = [];

  for (const candidate of candidates) {
    const key = [
      candidate.locator,
      candidate.excerpt,
      candidate.section ?? "",
      candidate.parameter ?? "",
      candidate.value ?? "",
      candidate.unit ?? "",
    ].join("\u001f");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(candidate);
  }

  return output;
}

export function extractTextEvidence(
  html: string,
  locator = "document:text",
): readonly ExtractedEvidenceCandidate[] {
  const text = decodeHtml(html);

  if (!text) {
    return [];
  }

  return [
    {
      locator,
      excerpt: text.slice(0, MAX_EXCERPT_LENGTH),
      extractionConfidence: "MEDIUM",
    },
  ];
}

export function extractEvidenceByPattern(
  html: string,
  patterns: readonly RegExp[],
): readonly ExtractedEvidenceCandidate[] {
  const text = decodeHtml(html);
  const output: ExtractedEvidenceCandidate[] = [];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;

    const match = pattern.exec(text);

    if (match?.[0]) {
      output.push({
        locator: `document:pattern:${pattern.source}`,
        excerpt: match[0].slice(0, MAX_EXCERPT_LENGTH),
        extractionConfidence: "MEDIUM",
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