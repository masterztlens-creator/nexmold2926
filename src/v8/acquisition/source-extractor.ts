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

const TABLE_PATTERN =
  /<table(?:\s[^>]*)?>([\s\S]*?)<\/table>/gi;

const TABLE_ROW_PATTERN =
  /<tr(?:\s[^>]*)?>([\s\S]*?)<\/tr>/gi;

const TABLE_CELL_PATTERN =
  /<(?:th|td)(?:\s[^>]*)?>([\s\S]*?)<\/(?:th|td)>/gi;

const PARAMETER_VALUE_UNIT_PATTERNS: readonly RegExp[] = [
  /\b([A-Za-z][A-Za-z0-9 _\/().-]{1,80}?)\s*[:=]\s*(-?\d+(?:\.\d+)?)\s*(mm|cm|m|µm|μm|um|in|inch|inches|kg|g|mg|MPa|GPa|Pa|bar|psi|°C|°F|K|N|kN|J|kJ|W|kW|%|s|min|h)\b/gi,
  /\b([A-Za-z][A-Za-z0-9 _\/().-]{1,80}?)\s+(-?\d+(?:\.\d+)?)\s*(mm|cm|m|µm|μm|um|in|inch|inches|kg|g|mg|MPa|GPa|Pa|bar|psi|°C|°F|K|N|kN|J|kJ|W|kW|%|s|min|h)\b/gi,
];

const RANGE_PARAMETER_VALUE_UNIT_PATTERNS: readonly RegExp[] = [
  /\b([A-Za-z][A-Za-z0-9 _\/().-]{1,80}?)\s*[:=]\s*(-?\d+(?:\.\d+)?)\s*(mm|cm|m|µm|μm|um|in|inch|inches|kg|g|mg|MPa|GPa|Pa|bar|psi|°C|°F|K|N|kN|J|kJ|W|kW|%|s|min|h)\s*(?:-|–|—|to)\s*(-?\d+(?:\.\d+)?)\s*(mm|cm|m|µm|μm|um|in|inch|inches|kg|g|mg|MPa|GPa|Pa|bar|psi|°C|°F|K|N|kN|J|kJ|W|kW|%|s|min|h)?\b/gi,
  /\b([A-Za-z][A-Za-z0-9 _\/().-]{1,80}?)\s+(-?\d+(?:\.\d+)?)\s*(mm|cm|m|µm|μm|um|in|inch|inches|kg|g|mg|MPa|GPa|Pa|bar|psi|°C|°F|K|N|kN|J|kJ|W|kW|%|s|min|h)\s*(?:-|–|—|to)\s*(-?\d+(?:\.\d+)?)\s*(mm|cm|m|µm|μm|um|in|inch|inches|kg|g|mg|MPa|GPa|Pa|bar|psi|°C|°F|K|N|kN|J|kJ|W|kW|%|s|min|h)?\b/gi,
];

const NUMERIC_RANGE_PATTERN =
  /(-?\d+(?:\.\d+)?)\s*(mm|cm|m|µm|μm|um|in|inch|inches|kg|g|mg|MPa|GPa|Pa|bar|psi|°C|°F|K|N|kN|J|kJ|W|kW|%|s|min|h)\s*(?:-|–|—|to)\s*(-?\d+(?:\.\d+)?)\s*(mm|cm|m|µm|μm|um|in|inch|inches|kg|g|mg|MPa|GPa|Pa|bar|psi|°C|°F|K|N|kN|J|kJ|W|kW|%|s|min|h)?/i;

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
  const normalized = unit
    .trim()
    .replace(/[.,;:]+$/, "");

  if (normalized === "μm") return "µm";
  if (normalized === "um") return "µm";
  if (
    normalized === "inch" ||
    normalized === "inches"
  ) {
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

function isUiRoleOrMarker(attributes: string): boolean {
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

function firstElementTagName(
  html: string,
): string | undefined {
  const withoutLeadingComments = html.replace(
    /^\s*(?:<!--[\s\S]*?-->\s*)*/,
    "",
  );

  const match = withoutLeadingComments.match(
    /^<([A-Za-z][A-Za-z0-9:-]*)(?:\s[^>]*)?>/,
  );

  return match?.[1]?.toLowerCase();
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

  if (!/^<div\s*>$/i.test(openingTag.trim())) {
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
    openingIndex + openingTag.length,
    subtreeEnd,
  );

  const headingMatch = subtree.match(
    /<h([1-6])(?:\s[^>]*)?>([\s\S]*?)<\/h\1>/i,
  );

  if (!headingMatch) {
    return false;
  }

  const headingText = normalizeText(
    headingMatch[2] ?? "",
  );

  if (!/^Jump to Section$/i.test(headingText)) {
    return false;
  }

  const firstTag = firstElementTagName(subtree);

  if (!firstTag || !/^h[1-6]$/i.test(firstTag)) {
    return false;
  }

  const anchorMatches = subtree.match(
    /<a(?:\s[^>]*)?>[\s\S]*?<\/a>/gi,
  );

  if (!anchorMatches || anchorMatches.length < 2) {
    return false;
  }

  const anchoredLinks = anchorMatches.filter(
    (anchor) =>
      /\b(?:href|data-anchor)\s*=\s*["'][^"']*#/i.test(
        anchor,
      ),
  );

  if (anchoredLinks.length < 2) {
    return false;
  }

  return true;
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

    if (
      !tagName ||
      !shouldRemove(
        openingTag,
        match.index,
        tagName,
      )
    ) {
      continue;
    }

    output.push(html.slice(cursor, match.index));

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
        .replace(
          /\/?>$/i,
          "",
        );

      if (isUiRoleOrMarker(attributes)) {
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

  HTML_HEADING_PATTERN.lastIndex = 0;

  while (
    (match =
      HTML_HEADING_PATTERN.exec(
        html,
      )) !== null
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

function normalizeRangeUnit(
  firstUnit: string,
  secondUnit?: string,
): string {
  const first = normalizeUnit(firstUnit);
  const second =
    secondUnit === undefined
      ? undefined
      : normalizeUnit(secondUnit);

  if (
    second !== undefined &&
    second !== first
  ) {
    return `${first}-${second}`;
  }

  return first;
}

function rangeValue(
  firstValue: string,
  firstUnit: string,
  secondValue: string,
  secondUnit?: string,
): string {
  const normalizedFirstUnit =
    normalizeUnit(firstUnit);

  const normalizedSecondUnit =
    secondUnit === undefined
      ? normalizedFirstUnit
      : normalizeUnit(secondUnit);

  const suffix =
    normalizedSecondUnit ===
    normalizedFirstUnit
      ? normalizedFirstUnit
      : `${normalizedFirstUnit}/${normalizedSecondUnit}`;

  return `${firstValue}-${secondValue} ${suffix}`;
}

function extractRangeFromText(
  text: string,
): {
  readonly value: string;
  readonly unit: string;
} | undefined {
  const match =
    NUMERIC_RANGE_PATTERN.exec(text);

  NUMERIC_RANGE_PATTERN.lastIndex = 0;

  if (!match) return undefined;

  const firstValue =
    match[1]?.trim();

  const firstUnit =
    match[2]?.trim();

  const secondValue =
    match[3]?.trim();

  const secondUnit =
    match[4]?.trim() ||
    firstUnit;

  if (
    !firstValue ||
    !firstUnit ||
    !secondValue ||
    !secondUnit
  ) {
    return undefined;
  }

  return {
    value: rangeValue(
      firstValue,
      firstUnit,
      secondValue,
      secondUnit,
    ),
    unit: normalizeRangeUnit(
      firstUnit,
      secondUnit,
    ),
  };
}

function parseTableCells(
  rowHtml: string,
): readonly string[] {
  const cells: string[] = [];

  TABLE_CELL_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;

  while (
    (match =
      TABLE_CELL_PATTERN.exec(
        rowHtml,
      )) !== null
  ) {
    const value = normalizeText(
      match[1] ?? "",
    );

    if (value) {
      cells.push(value);
    }
  }

  TABLE_CELL_PATTERN.lastIndex = 0;

  return cells;
}

function plausibleTableName(
  section: string | undefined,
  headerCells: readonly string[],
): string | undefined {
  const header = headerCells
    .filter(Boolean)
    .join(" | ");

  if (!header) {
    return section;
  }

  if (section) {
    return `${section} — ${header}`.slice(
      0,
      500,
    );
  }

  return header.slice(
    0,
    500,
  );
}

function findTableSection(
  content: string,
  tableIndex: number,
  sections: readonly {
    readonly index: number;
    readonly section: string;
  }[],
): string | undefined {
  return sectionForIndex(
    sections,
    tableIndex,
  );
}

function buildTableEvidence(
  html: string,
): readonly ExtractedEvidenceCandidate[] {
  const content =
    selectSemanticContent(html);

  const sections =
    buildSectionMap(content);

  const candidates: ExtractedEvidenceCandidate[] =
    [];

  TABLE_PATTERN.lastIndex = 0;

  let tableMatch: RegExpExecArray | null;

  while (
    (tableMatch =
      TABLE_PATTERN.exec(
        content,
      )) !== null
  ) {
    const tableIndex =
      tableMatch.index;

    const tableHtml =
      tableMatch[1] ?? "";

    const tableSection =
      findTableSection(
        content,
        tableIndex,
        sections,
      );

    const rows: {
      readonly index: number;
      readonly cells: readonly string[];
    }[] = [];

    TABLE_ROW_PATTERN.lastIndex = 0;

    let rowMatch: RegExpExecArray | null;

    while (
      (rowMatch =
        TABLE_ROW_PATTERN.exec(
          tableHtml,
        )) !== null
    ) {
      const cells =
        parseTableCells(
          rowMatch[1] ?? "",
        );

      if (cells.length === 0) {
        continue;
      }

      rows.push({
        index: rowMatch.index,
        cells,
      });
    }

    TABLE_ROW_PATTERN.lastIndex = 0;

    if (rows.length === 0) {
      continue;
    }

    const headerCells =
      rows[0]?.cells ?? [];

    const tableName =
      plausibleTableName(
        tableSection,
        headerCells,
      );

    for (
      let rowIndex = 1;
      rowIndex < rows.length;
      rowIndex += 1
    ) {
      const row =
        rows[rowIndex];

      if (!row) continue;

      const cells =
        row.cells;

      if (cells.length === 0) {
        continue;
      }

      const rowText =
        cells.join(" | ");

      const range =
        extractRangeFromText(
          rowText,
        );

      if (!range) {
        continue;
      }

      const material =
        cells[0]?.trim();

      const parameter =
        headerCells.length >= 2
          ? headerCells[
              headerCells.length - 1
            ]
          : tableSection;

      if (
        !material ||
        !parameter
      ) {
        continue;
      }

      const normalizedParameter =
        normalizeParameter(
          parameter,
        );

      if (
        !isPlausibleParameter(
          normalizedParameter,
        )
      ) {
        continue;
      }

      const excerpt =
        normalizeText(
          [
            tableSection,
            headerCells.join(
              " | ",
            ),
            rowText,
          ]
            .filter(Boolean)
            .join(" — "),
        );

      if (!excerpt) {
        continue;
      }

      candidates.push({
        locator:
          `document:table:${tableIndex}:row:${rowIndex}`,
        excerpt:
          excerpt.slice(
            0,
            MAX_EXCERPT_LENGTH,
          ),
        ...(tableSection
          ? {
              section:
                tableSection,
            }
          : {}),
        ...(tableName
          ? {
              table:
                tableName,
            }
          : {}),
        row: material,
        parameter:
          normalizedParameter,
        value:
          range.value,
        unit:
          range.unit,
        extractionConfidence:
          "HIGH",
      });
    }

    /*
     * Some production pages encode a table with a single row
     * containing both the header and values, or expose numeric
     * ranges without a conventional <tr>/<td> structure.
     *
     * Do not manufacture semantics from arbitrary prose. The
     * fallback below only emits a candidate when:
     *
     *   1. the table has an explicit section;
     *   2. the table text contains an engineering range;
     *   3. a plausible material/row label is present.
     */
    if (
      candidates.every(
        (candidate) =>
          !candidate.locator.startsWith(
            `document:table:${tableIndex}:`,
          ),
      )
    ) {
      const tableText =
        normalizeText(
          tableHtml,
        );

      const range =
        extractRangeFromText(
          tableText,
        );

      if (
        range &&
        tableSection &&
        headerCells.length >= 2
      ) {
        const materialCandidate =
          headerCells[0];

        const parameterCandidate =
          headerCells[
            headerCells.length - 1
          ];

        if (
          materialCandidate &&
          parameterCandidate &&
          isPlausibleParameter(
            parameterCandidate,
          )
        ) {
          candidates.push({
            locator:
              `document:table:${tableIndex}:range`,
            excerpt:
              tableText.slice(
                0,
                MAX_EXCERPT_LENGTH,
              ),
            section:
              tableSection,
            table:
              plausibleTableName(
                tableSection,
                headerCells,
              ),
            row:
              materialCandidate,
            parameter:
              normalizeParameter(
                parameterCandidate,
              ),
            value:
              range.value,
            unit:
              range.unit,
            extractionConfidence:
              "MEDIUM",
          });
        }
      }
    }
  }

  TABLE_PATTERN.lastIndex = 0;

  return candidates;
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
    const pattern of RANGE_PARAMETER_VALUE_UNIT_PATTERNS
  ) {
    pattern.lastIndex = 0;

    let match: RegExpExecArray | null;

    while (
      (match =
        pattern.exec(
          content,
        )) !== null
    ) {
      const parameter =
        normalizeParameter(
          match[1] ?? "",
        );

      const firstValue =
        (match[2] ?? "").trim();

      const firstUnit =
        normalizeUnit(
          match[3] ?? "",
        );

      const secondValue =
        (match[4] ?? "").trim();

      const secondUnit =
        normalizeUnit(
          match[5] ??
            match[3] ??
            "",
        );

      if (
        !isPlausibleParameter(
          parameter,
        )
      ) {
        continue;
      }

      if (
        !firstValue ||
        !firstUnit ||
        !secondValue
      ) {
        continue;
      }

      const rawExcerpt =
        normalizeText(
          match[0] ?? "",
        );

      if (!rawExcerpt) {
        continue;
      }

      const section =
        sectionForIndex(
          sections,
          match.index,
        );

      candidates.push({
        locator:
          `document:parameter:${parameter.toLowerCase()}:range`,
        excerpt:
          rawExcerpt.slice(
            0,
            MAX_EXCERPT_LENGTH,
          ),
        ...(section
          ? { section }
          : {}),
        parameter,
        value:
          rangeValue(
            firstValue,
            firstUnit,
            secondValue,
            secondUnit,
          ),
        unit:
          normalizeRangeUnit(
            firstUnit,
            secondUnit,
          ),
        extractionConfidence:
          "HIGH",
      });
    }

    pattern.lastIndex = 0;
  }

  for (
    const pattern of PARAMETER_VALUE_UNIT_PATTERNS
  ) {
    pattern.lastIndex = 0;

    let match: RegExpExecArray | null;

    while (
      (match =
        pattern.exec(
          content,
        )) !== null
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
        !isPlausibleParameter(
          parameter,
        )
      ) {
        continue;
      }

      if (
        !value ||
        !unit
      ) {
        continue;
      }

      const rawExcerpt =
        normalizeText(
          match[0] ?? "",
        );

      if (!rawExcerpt) {
        continue;
      }

      /*
       * If this match is actually the first half of a numeric
       * range, the range extractor above is authoritative. Do not
       * emit a misleading single-value Evidence record.
       */
      const trailingText =
        content.slice(
          match.index,
          match.index +
            Math.min(
              200,
              (match[0] ?? "").length +
                100,
            ),
        );

      if (
        NUMERIC_RANGE_PATTERN.test(
          trailingText,
        )
      ) {
        NUMERIC_RANGE_PATTERN.lastIndex = 0;
        continue;
      }

      NUMERIC_RANGE_PATTERN.lastIndex = 0;

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
      HTML_BLOCK_PATTERN.exec(
        content,
      )) !== null
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

  for (
    const candidate of candidates
  ) {
    const key = [
      candidate.locator,
      candidate.excerpt,
      candidate.section ?? "",
      candidate.table ?? "",
      candidate.row ?? "",
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

  for (
    const pattern of patterns
  ) {
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
    ...buildTableEvidence(html),
    ...buildBlockEvidence(html),
  ]);
}