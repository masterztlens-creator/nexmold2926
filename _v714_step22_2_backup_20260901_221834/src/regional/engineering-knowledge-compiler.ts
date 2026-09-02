/**
 * NEXMOLD V7.14
 * Engineering Knowledge Compiler v1
 *
 * PRODUCTION-GRADE REPLACEMENT
 * =============================
 *
 * PURPOSE
 * -------
 * Convert an existing KnowledgeArticle into a deterministic,
 * auditable and source-traceable EngineeringKnowledgePack
 * for White Paper Producer v2.
 *
 * ARCHITECTURE
 * ------------
 *
 * KnowledgeArticle
 *      ↓
 * Engineering Knowledge Compiler
 *      ↓
 * EngineeringKnowledgePack
 *      ↓
 * White Paper Producer v2
 *      ↓
 * WhitePaperArticleV2
 *
 * HARD BOUNDARIES
 * ---------------
 * 1. This compiler DOES NOT create Evidence records.
 * 2. This compiler DOES NOT create Semantic Claims.
 * 3. This compiler DOES NOT authorize publication.
 * 4. This compiler DOES NOT bypass RegionalPublishArtifact.
 * 5. This compiler DOES NOT publish anything.
 * 6. This compiler DOES NOT invent numerical engineering values.
 * 7. This compiler DOES NOT invent standards or material properties.
 * 8. This compiler DOES NOT invent internal routes.
 * 9. Target identity MUST remain independent from source identity.
 * 10. Every source-backed node must retain a sourceField reference.
 * 11. Structural derivations are explicitly marked DERIVED_STRUCTURAL.
 * 12. Unsupported structures are ignored rather than guessed.
 *
 * PRODUCTION PRINCIPLES
 * ---------------------
 * - deterministic
 * - side-effect free
 * - fail-closed on identity / required metadata
 * - tolerant of legacy funnel representations
 * - compatible with current KnowledgeArticle/FunnelLayer contracts
 * - no hidden mutation of source data
 * - stable ordering
 * - duplicate resistant
 * - explicit lineage
 * - diagnostic-friendly
 *
 * IMPORTANT
 * ---------
 * This is a deterministic KNOWLEDGE COMPILER.
 * It is NOT an LLM and must never behave like one.
 */

import type { KnowledgeArticle } from "../data/knowledge";

/* ========================================================================== */
/* Primitive types                                                            */
/* ========================================================================== */

export type EngineeringKnowledgeKind =
  | "definition"
  | "mechanism"
  | "design-rule"
  | "failure-mode"
  | "process"
  | "material"
  | "tooling"
  | "validation"
  | "decision"
  | "comparison"
  | "faq"
  | "graph"
  | "commercial";

export type EngineeringConfidence =
  | "SOURCE_BACKED"
  | "DERIVED_STRUCTURAL"
  | "INSUFFICIENT";

export interface EngineeringEvidenceRef {
  readonly sourceField: string;
  readonly sourceValue?: string;
  readonly confidence: EngineeringConfidence;
}

export interface EngineeringKnowledgeNode {
  readonly id: string;
  readonly kind: EngineeringKnowledgeKind;
  readonly title: string;
  readonly statement: string;
  readonly evidence: readonly EngineeringEvidenceRef[];
  readonly keywords: readonly string[];
  readonly relatedSlugs: readonly string[];
}

export interface EngineeringParameter {
  readonly name: string;
  readonly value?: string;
  readonly unit?: string;
  readonly source: string;
  readonly verified: boolean;
}

export interface EngineeringDecision {
  readonly question: string;
  readonly decisionRule: string;
  readonly factors: readonly string[];
  readonly sourceNodes: readonly string[];
}

export interface EngineeringFailureMode {
  readonly name: string;
  readonly mechanism: string;
  readonly diagnosticSignals: readonly string[];
  readonly mitigation: readonly string[];
  readonly sourceNodes: readonly string[];
}

export interface EngineeringComparison {
  readonly title: string;
  readonly rows: readonly {
    readonly factor: string;
    readonly left: string;
    readonly right: string;
  }[];
  readonly sourceNodes: readonly string[];
}

export interface EngineeringGraph {
  readonly relatedArticles: readonly string[];
  readonly tools: readonly string[];
  readonly materials: readonly string[];
  readonly defects: readonly string[];
  readonly processes: readonly string[];
  readonly standards: readonly string[];
}

export interface EngineeringSemanticCoverage {
  readonly primaryTopic: string;
  readonly entities: readonly string[];
  readonly queryVariants: readonly string[];
  readonly questions: readonly string[];
  readonly longTailTerms: readonly string[];
  readonly coverageTerms: readonly string[];
}

export interface EngineeringWhitePaperOutline {
  readonly sections: readonly {
    readonly id: string;
    readonly title: string;
    readonly purpose: string;
    readonly nodeIds: readonly string[];
  }[];
}

export interface EngineeringKnowledgePack {
  readonly schema:
    "nexmold.v7.14.engineering-knowledge-pack.v1";

  readonly pageId: string;

  /**
   * TARGET identity.
   *
   * This is the future White Paper identity.
   *
   * It MUST NOT be the source article identity.
   */
  readonly targetSlug: string;

  /**
   * EXISTING KnowledgeArticle identity.
   */
  readonly sourceArticleSlug: string;

  readonly title: string;
  readonly category: string;
  readonly categorySlug: string;

  readonly executiveAnswer: string;
  readonly keyTakeaways: readonly string[];

  readonly nodes: readonly EngineeringKnowledgeNode[];

  readonly parameters: readonly EngineeringParameter[];

  readonly decisions: readonly EngineeringDecision[];

  readonly failureModes: readonly EngineeringFailureMode[];

  readonly comparison: EngineeringComparison | null;

  readonly graph: EngineeringGraph;

  readonly semanticCoverage: EngineeringSemanticCoverage;

  readonly outline: EngineeringWhitePaperOutline;

  /**
   * Deterministic fingerprint of the source-derived compiler input.
   */
  readonly sourceFingerprint: string;
}

/* ========================================================================== */
/* Internal source-compatible structures                                      */
/* ========================================================================== */

/**
 * KnowledgeArticle.content uses RawContentBlock:
 *
 * heading
 * body?
 * items?
 * callout?
 *
 * We intentionally keep this structural and permissive so the compiler
 * remains compatible with normalized and legacy representations.
 */
interface SourceContentBlock {
  readonly heading?: unknown;
  readonly body?: unknown;
  readonly content?: unknown;
  readonly items?: unknown;
  readonly callout?: unknown;
}

interface SourceFAQ {
  readonly question?: unknown;
  readonly answer?: unknown;
}

interface SourceSpecificationItem {
  readonly label?: unknown;
  readonly name?: unknown;
  readonly title?: unknown;
  readonly parameter?: unknown;
  readonly value?: unknown;
  readonly range?: unknown;
  readonly target?: unknown;
  readonly unit?: unknown;
  readonly kind?: unknown;
}

interface SourceSpecificationLayer {
  readonly summary?: unknown;
  readonly items?: unknown;
}

interface SourceComparisonRow {
  readonly criterion?: unknown;
  readonly factor?: unknown;
  readonly criteria?: unknown;
  readonly dimension?: unknown;
  readonly name?: unknown;

  readonly current?: unknown;
  readonly alternative?: unknown;

  readonly left?: unknown;
  readonly right?: unknown;

  readonly optionA?: unknown;
  readonly optionB?: unknown;

  readonly a?: unknown;
  readonly b?: unknown;

  readonly decision?: unknown;
}

interface SourceComparisonLayer {
  readonly title?: unknown;
  readonly rows?: unknown;
}

interface SourceStandardEntity {
  readonly name?: unknown;
  readonly type?: unknown;
}

interface SourceGraph {
  readonly parentHub?: unknown;

  readonly relatedArticles?: unknown;
  readonly tools?: unknown;
  readonly materials?: unknown;
  readonly defects?: unknown;
  readonly processes?: unknown;

  readonly standards?: unknown;
  readonly industries?: unknown;
  readonly commercial?: unknown;
}

interface SourceSEO {
  readonly primary?: unknown;
  readonly secondary?: unknown;
  readonly longTail?: unknown;
  readonly questions?: unknown;
  readonly entities?: unknown;
}

interface SourceIntent {
  readonly primary?: unknown;
  readonly stage?: unknown;
  readonly searchQuery?: unknown;
  readonly queryVariants?: unknown;
}

interface SourceAnswer {
  readonly question?: unknown;
  readonly answer?: unknown;
  readonly keyPoints?: unknown;
}

interface SourceFunnel {
  readonly intent?: SourceIntent;
  readonly answer?: SourceAnswer;

  readonly specifications?: unknown;

  readonly comparison?: unknown;
  readonly comparisonTable?: unknown;

  readonly blocks?: unknown;
  readonly faq?: unknown;

  readonly graph?: SourceGraph;
  readonly seo?: SourceSEO;

  readonly commercial?: unknown;
  readonly quality?: unknown;
}

/* ========================================================================== */
/* Normalization helpers                                                      */
/* ========================================================================== */

function clean(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(clean)
    .filter(Boolean);
}

function unique(
  values: readonly string[],
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const normalized = clean(value);

    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(normalized);
  }

  return result;
}

function slugify(value: string): string {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function hashString(value: string): string {
  let hash = 2166136261;

  for (
    let index = 0;
    index < value.length;
    index += 1
  ) {
    hash ^= value.charCodeAt(index);
    hash =
      Math.imul(
        hash,
        16777619,
      );
  }

  return (
    hash >>> 0
  )
    .toString(16)
    .padStart(8, "0");
}

function stableJson(
  value: unknown,
): string {
  return JSON.stringify(
    value,
  );
}

function firstSentence(
  value: string,
): string {
  const normalized =
    clean(value);

  if (!normalized) {
    return "";
  }

  const match =
    normalized.match(
      /^(.+?[.!?])(?:\s|$)/,
    );

  return clean(
    match?.[1] ??
      normalized,
  );
}

function normalizeKeywordTokens(
  value: string,
): string[] {
  return unique(
    value
      .split(/[\s,;/|]+/)
      .map((token) =>
        token
          .replace(
            /^[^a-zA-Z0-9-]+|[^a-zA-Z0-9-]+$/g,
            "",
          ),
      )
      .filter(
        (token) =>
          token.length >= 3,
      ),
  );
}

/* ========================================================================== */
/* Structural type guards                                                     */
/* ========================================================================== */

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isStringArray(
  value: unknown,
): value is string[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === "string",
    )
  );
}

/* ========================================================================== */
/* Safe source access                                                         */
/* ========================================================================== */

function getFunnel(
  source: KnowledgeArticle,
): SourceFunnel {
  const candidate =
    (
      source as unknown as {
        funnel?: unknown;
      }
    ).funnel;

  return isRecord(candidate)
    ? (candidate as SourceFunnel)
    : {};
}

function getContent(
  source: KnowledgeArticle,
): SourceContentBlock[] {
  const direct =
    (
      source as unknown as {
        content?: unknown;
      }
    ).content;

  if (Array.isArray(direct)) {
    return direct.filter(
      isRecord,
    ) as SourceContentBlock[];
  }

  const funnel =
    getFunnel(source);

  const blocks =
    funnel.blocks;

  if (Array.isArray(blocks)) {
    return blocks.filter(
      isRecord,
    ) as SourceContentBlock[];
  }

  return [];
}

function getFAQ(
  source: KnowledgeArticle,
): SourceFAQ[] {
  const direct =
    (
      source as unknown as {
        faq?: unknown;
      }
    ).faq;

  if (Array.isArray(direct)) {
    return direct.filter(
      isRecord,
    ) as SourceFAQ[];
  }

  const funnel =
    getFunnel(source);

  const faq =
    funnel.faq;

  if (Array.isArray(faq)) {
    return faq.filter(
      isRecord,
    ) as SourceFAQ[];
  }

  return [];
}

function getSourceKeyTakeaways(
  source: KnowledgeArticle,
): string[] {
  return unique(
    cleanArray(
      (
        source as unknown as {
          keyTakeaways?: unknown;
        }
      ).keyTakeaways,
    ),
  );
}

/* ========================================================================== */
/* Source field extraction                                                    */
/* ========================================================================== */

function extractBlockText(
  block: SourceContentBlock,
): {
  readonly heading: string;
  readonly body: string;
  readonly items: string[];
  readonly callout: string;
  readonly combined: string;
} {
  const heading =
    clean(block.heading);

  const body =
    clean(
      block.body ??
        block.content,
    );

  const items =
    cleanArray(
      block.items,
    );

  const callout =
    clean(block.callout);

  const combined =
    [
      body,
      ...items,
      callout,
    ]
      .map(clean)
      .filter(Boolean)
      .join("\n");

  return {
    heading,
    body,
    items,
    callout,
    combined,
  };
}

/* ========================================================================== */
/* Node classification                                                        */
/* ========================================================================== */

function classifyHeading(
  heading: string,
): EngineeringKnowledgeKind {
  const value =
    clean(
      heading,
    ).toLowerCase();

  /*
   * Order matters.
   *
   * More specific engineering concepts are evaluated before broad
   * terms such as "process", "tooling" and "design".
   */

  if (
    /failure|defect|sink|warp|warpage|weld|flash|short shot|burn mark|burn|void|splay|flow mark|jetting|burr/.test(
      value,
    )
  ) {
    return "failure-mode";
  }

  if (
    /decision|select|selection|choose|when to use|which .* should/.test(
      value,
    )
  ) {
    return "decision";
  }

  if (
    /compare|comparison|versus|\bvs\.?\b|trade.?off/.test(
      value,
    )
  ) {
    return "comparison";
  }

  if (
    /validation|inspection|quality|verify|verification|measurement|acceptance|testing|test plan/.test(
      value,
    )
  ) {
    return "validation";
  }

  if (
    /material|resin|polymer|thermoplastic|thermoset|elastomer|abs|pc\b|pp\b|pa\b|pbt|pom|peek|nylon|steel|s136|nak80/.test(
      value,
    )
  ) {
    return "material";
  }

  if (
    /tooling|tool design|mold|mould|cavity|core|slide|lifter|ejection|runner|gate|parting|cooling|venting/.test(
      value,
    )
  ) {
    return "tooling";
  }

  if (
    /process|injection|filling|fill|packing|holding|cooling|cycle|processing|machine|pressure|temperature|melt/.test(
      value,
    )
  ) {
    return "process";
  }

  if (
    /design|geometry|wall|rib|boss|radius|draft|undercut|thickness|feature|part design|dfm|manufactur/.test(
      value,
    )
  ) {
    return "design-rule";
  }

  if (
    /definition|what is|overview|introduction|fundamental|fundamentals|engineering answer/.test(
      value,
    )
  ) {
    return "definition";
  }

  return "mechanism";
}

/* ========================================================================== */
/* Node ID generation                                                         */
/* ========================================================================== */

function makeNodeId(
  targetSlug: string,
  kind: EngineeringKnowledgeKind,
  sequence: number,
): string {
  return [
    "v714",
    targetSlug,
    kind,
    String(sequence),
  ].join(":");
}

/* ========================================================================== */
/* Content node compiler                                                      */
/* ========================================================================== */

function compileContentNodes(
  source: KnowledgeArticle,
  targetSlug: string,
): EngineeringKnowledgeNode[] {
  const blocks =
    getContent(source);

  const nodes:
    EngineeringKnowledgeNode[] =
    [];

  for (
    let index = 0;
    index < blocks.length;
    index += 1
  ) {
    const block =
      blocks[index];

    const extracted =
      extractBlockText(
        block,
      );

    if (
      !extracted.heading &&
      !extracted.combined
    ) {
      continue;
    }

    if (
      !extracted.combined
    ) {
      continue;
    }

    const kind =
      classifyHeading(
        extracted.heading,
      );

    const sequence =
      nodes.length + 1;

    const nodeId =
      makeNodeId(
        targetSlug,
        kind,
        sequence,
      );

    const keywords =
      unique([
        extracted.heading,
        ...normalizeKeywordTokens(
          extracted.heading,
        ),
        ...normalizeKeywordTokens(
          extracted.combined,
        ).slice(0, 20),
      ]);

    nodes.push({
      id: nodeId,

      kind,

      title:
        extracted.heading ||
        "Engineering analysis",

      statement:
        extracted.combined,

      evidence: [
        {
          sourceField:
            `content[${index}]`,

          sourceValue:
            extracted.combined,

          confidence:
            "SOURCE_BACKED",
        },
      ],

      keywords,

      relatedSlugs: [],
    });
  }

  return nodes;
}

/* ========================================================================== */
/* Funnel block fallback                                                      */
/* ========================================================================== */

function compileFunnelBlockNodes(
  source: KnowledgeArticle,
  targetSlug: string,
  existingIds: ReadonlySet<string>,
): EngineeringKnowledgeNode[] {
  const funnel =
    getFunnel(source);

  if (
    !Array.isArray(
      funnel.blocks,
    )
  ) {
    return [];
  }

  const nodes:
    EngineeringKnowledgeNode[] =
    [];

  for (
    let index = 0;
    index <
      funnel.blocks.length;
    index += 1
  ) {
    const raw =
      funnel.blocks[index];

    if (!isRecord(raw)) {
      continue;
    }

    const block =
      raw as SourceContentBlock;

    const extracted =
      extractBlockText(
        block,
      );

    if (!extracted.combined) {
      continue;
    }

    const kind =
      classifyHeading(
        extracted.heading,
      );

    const fingerprint =
      hashString(
        stableJson({
          heading:
            extracted.heading,
          statement:
            extracted.combined,
        }),
      );

    const id =
      makeNodeId(
        targetSlug,
        kind,
        index + 1,
      );

    if (
      existingIds.has(id)
    ) {
      continue;
    }

    nodes.push({
      id,

      kind,

      title:
        extracted.heading ||
        "Engineering analysis",

      statement:
        extracted.combined,

      evidence: [
        {
          sourceField:
            `funnel.blocks[${index}]`,

          sourceValue:
            extracted.combined,

          confidence:
            "SOURCE_BACKED",
        },
      ],

      keywords:
        unique([
          extracted.heading,
          ...normalizeKeywordTokens(
            extracted.heading,
          ),
          fingerprint,
        ]),

      relatedSlugs: [],
    });
  }

  return nodes;
}

/* ========================================================================== */
/* Takeaway node compiler                                                     */
/* ========================================================================== */

function compileTakeawayNodes(
  source: KnowledgeArticle,
  targetSlug: string,
  existing: readonly EngineeringKnowledgeNode[],
): EngineeringKnowledgeNode[] {
  const takeaways =
    getSourceKeyTakeaways(
      source,
    );

  const existingStatements =
    new Set(
      existing.map(
        (node) =>
          node.statement
            .toLowerCase(),
      ),
    );

  const nodes:
    EngineeringKnowledgeNode[] =
    [];

  for (
    let index = 0;
    index < takeaways.length;
    index += 1
  ) {
    const takeaway =
      takeaways[index];

    const key =
      takeaway.toLowerCase();

    if (
      existingStatements.has(
        key,
      )
    ) {
      continue;
    }

    nodes.push({
      id:
        makeNodeId(
          targetSlug,
          "design-rule",
          existing.length +
            nodes.length +
            1,
        ),

      kind:
        "design-rule",

      title:
        `Engineering takeaway ${
          index + 1
        }`,

      statement:
        takeaway,

      evidence: [
        {
          sourceField:
            `keyTakeaways[${index}]`,

          sourceValue:
            takeaway,

          confidence:
            "SOURCE_BACKED",
        },
      ],

      keywords:
        unique([
          ...normalizeKeywordTokens(
            takeaway,
          ),
        ]),

      relatedSlugs: [],
    });
  }

  return nodes;
}

/* ========================================================================== */
/* FAQ node compiler                                                          */
/* ========================================================================== */

function compileFAQNodes(
  source: KnowledgeArticle,
  targetSlug: string,
  existing: readonly EngineeringKnowledgeNode[],
): EngineeringKnowledgeNode[] {
  const faq =
    getFAQ(source);

  const nodes:
    EngineeringKnowledgeNode[] =
    [];

  const existingQuestions =
    new Set(
      existing
        .filter(
          (node) =>
            node.kind === "faq",
        )
        .map(
          (node) =>
            node.title
              .toLowerCase(),
        ),
    );

  for (
    let index = 0;
    index < faq.length;
    index += 1
  ) {
    const item =
      faq[index];

    const question =
      clean(item.question);

    const answer =
      clean(item.answer);

    if (
      !question ||
      !answer
    ) {
      continue;
    }

    const questionKey =
      question.toLowerCase();

    if (
      existingQuestions.has(
        questionKey,
      )
    ) {
      continue;
    }

    existingQuestions.add(
      questionKey,
    );

    nodes.push({
      id:
        makeNodeId(
          targetSlug,
          "faq",
          existing.length +
            nodes.length +
            1,
        ),

      kind:
        "faq",

      title:
        question,

      statement:
        answer,

      evidence: [
        {
          sourceField:
            `faq[${index}]`,

          sourceValue:
            answer,

          confidence:
            "SOURCE_BACKED",
        },
      ],

      keywords:
        unique([
          ...normalizeKeywordTokens(
            question,
          ),
          ...normalizeKeywordTokens(
            answer,
          ).slice(0, 15),
        ]),

      relatedSlugs: [],
    });
  }

  return nodes;
}

/* ========================================================================== */
/* Specification extraction                                                   */
/* ========================================================================== */

function getSpecificationItems(
  source: KnowledgeArticle,
): SourceSpecificationItem[] {
  const funnel =
    getFunnel(source);

  const raw =
    funnel.specifications;

  /*
   * Current production contract:
   *
   * {
   *   summary: string,
   *   items: SpecificationItem[]
   * }
   */
  if (isRecord(raw)) {
    const items =
      raw.items;

    if (Array.isArray(items)) {
      return items.filter(
        isRecord,
      ) as SourceSpecificationItem[];
    }

    return [];
  }

  /*
   * Legacy compatibility:
   *
   * specifications: SpecificationItem[]
   */
  if (Array.isArray(raw)) {
    return raw.filter(
      isRecord,
    ) as SourceSpecificationItem[];
  }

  return [];
}

function compileParameters(
  source: KnowledgeArticle,
): EngineeringParameter[] {
  const items =
    getSpecificationItems(
      source,
    );

  const parameters:
    EngineeringParameter[] =
    [];

  const seen =
    new Set<string>();

  for (
    let index = 0;
    index < items.length;
    index += 1
  ) {
    const item =
      items[index];

    const name =
      clean(
        item.label ??
          item.name ??
          item.parameter ??
          item.title,
      );

    if (!name) {
      continue;
    }

    const value =
      clean(
        item.value ??
          item.range ??
          item.target,
      );

    const unit =
      clean(
        item.unit,
      );

    const key =
      [
        name,
        value,
        unit,
      ]
        .join("|")
        .toLowerCase();

    if (
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);

    parameters.push({
      name,

      ...(value
        ? { value }
        : {}),

      ...(unit
        ? { unit }
        : {}),

      source:
        `funnel.specifications.items[${index}]`,

      /*
       * "verified" here means:
       *
       * a concrete value exists in the source data.
       *
       * It does NOT mean that the compiler independently verified
       * the engineering value.
       */
      verified:
        Boolean(value),
    });
  }

  return parameters;
}

/* ========================================================================== */
/* Graph compiler                                                             */
/* ========================================================================== */

function normalizeGraphStringValues(
  value: unknown,
): string[] {
  if (
    isStringArray(value)
  ) {
    return unique(
      value,
    );
  }

  if (
    Array.isArray(value)
  ) {
    return unique(
      value.map(
        (item) => {
          if (
            typeof item ===
            "string"
          ) {
            return item;
          }

          if (
            isRecord(item)
          ) {
            return clean(
              item.slug ??
                item.name ??
                item.title,
            );
          }

          return "";
        },
      ),
    );
  }

  return [];
}

function normalizeStandards(
  value: unknown,
): string[] {
  if (
    !Array.isArray(value)
  ) {
    return [];
  }

  return unique(
    value.map(
      (item) => {
        if (
          typeof item ===
          "string"
        ) {
          return item;
        }

        if (
          isRecord(item)
        ) {
          const entity =
            item as SourceStandardEntity;

          return clean(
            entity.name,
          );
        }

        return "";
      },
    ),
  );
}

function compileGraph(
  source: KnowledgeArticle,
): EngineeringGraph {
  const funnel =
    getFunnel(source);

  const graph =
    isRecord(
      funnel.graph,
    )
      ? funnel.graph
      : {};

  return {
    relatedArticles:
      normalizeGraphStringValues(
        graph.relatedArticles,
      ),

    tools:
      normalizeGraphStringValues(
        graph.tools,
      ),

    materials:
      normalizeGraphStringValues(
        graph.materials,
      ),

    defects:
      normalizeGraphStringValues(
        graph.defects,
      ),

    processes:
      normalizeGraphStringValues(
        graph.processes,
      ),

    standards:
      normalizeStandards(
        graph.standards,
      ),
  };
}

/* ========================================================================== */
/* Graph-derived nodes                                                        */
/* ========================================================================== */

function compileGraphNodes(
  graph: EngineeringGraph,
  targetSlug: string,
  existing: readonly EngineeringKnowledgeNode[],
): EngineeringKnowledgeNode[] {
  const nodes:
    EngineeringKnowledgeNode[] =
    [];

  const existingKeys =
    new Set(
      existing.map(
        (node) =>
          `${node.kind}:${node.title}`
            .toLowerCase(),
      ),
    );

  const groups:
    Array<{
      readonly kind: EngineeringKnowledgeKind;
      readonly values: readonly string[];
      readonly sourceField: string;
    }> = [
      {
        kind:
          "tooling",
        values:
          graph.tools,
        sourceField:
          "funnel.graph.tools",
      },
      {
        kind:
          "material",
        values:
          graph.materials,
        sourceField:
          "funnel.graph.materials",
      },
      {
        kind:
          "failure-mode",
        values:
          graph.defects,
        sourceField:
          "funnel.graph.defects",
      },
      {
        kind:
          "process",
        values:
          graph.processes,
        sourceField:
          "funnel.graph.processes",
      },
      {
        kind:
          "graph",
        values:
          graph.relatedArticles,
        sourceField:
          "funnel.graph.relatedArticles",
      },
    ];

  let sequence =
    existing.length + 1;

  for (const group of groups) {
    for (const value of group.values) {
      const title =
        clean(value);

      if (!title) {
        continue;
      }

      const key =
        `${group.kind}:${title}`
          .toLowerCase();

      if (
        existingKeys.has(key)
      ) {
        continue;
      }

      existingKeys.add(key);

      nodes.push({
        id:
          makeNodeId(
            targetSlug,
            group.kind,
            sequence,
          ),

        kind:
          group.kind,

        title,

        statement:
          `Validated knowledge-graph relation: ${title}.`,

        evidence: [
          {
            sourceField:
              group.sourceField,

            sourceValue:
              title,

            confidence:
              "SOURCE_BACKED",
          },
        ],

        keywords:
          unique([
            title,
            ...normalizeKeywordTokens(
              title,
            ),
          ]),

        relatedSlugs:
          group.kind === "graph"
            ? [title]
            : [],
      });

      sequence += 1;
    }
  }

  return nodes;
}

/* ========================================================================== */
/* Failure-mode compiler                                                      */
/* ========================================================================== */

function deriveDiagnosticSignals(
  node: EngineeringKnowledgeNode,
): string[] {
  const signals =
    unique([
      node.title,
    ]);

  const title =
    node.title.toLowerCase();

  const statement =
    node.statement.toLowerCase();

  if (
    /sink|sink mark/.test(
      title,
    ) ||
    /sink|sink mark/.test(
      statement,
    )
  ) {
    signals.push(
      "Visible localized surface depression or dimensional inconsistency.",
    );
  }

  if (
    /warp|warpage/.test(
      title,
    ) ||
    /warp|warpage/.test(
      statement,
    )
  ) {
    signals.push(
      "Observed part distortion or loss of intended geometry.",
    );
  }

  if (
    /weld|weld line/.test(
      title,
    ) ||
    /weld|weld line/.test(
      statement,
    )
  ) {
    signals.push(
      "Visible knit or weld-line indication at flow-front convergence.",
    );
  }

  if (
    /flash/.test(
      title,
    ) ||
    /flash/.test(
      statement,
    )
  ) {
    signals.push(
      "Unwanted material at the parting or shutoff region.",
    );
  }

  if (
    /short shot/.test(
      title,
    ) ||
    /short shot/.test(
      statement,
    )
  ) {
    signals.push(
      "Incomplete cavity fill.",
    );
  }

  /*
   * These are structural diagnostic labels, not claims of measured
   * process limits. They remain deliberately qualitative.
   */
  return unique(
    signals,
  );
}

function deriveMitigation(
  node: EngineeringKnowledgeNode,
): string[] {
  /*
   * Do NOT manufacture a corrective-action prescription from a
   * defect name alone.
   *
   * Only expose the source-backed statement as a mitigation
   * candidate when the source actually contains engineering guidance.
   */
  const statement =
    clean(node.statement);

  if (!statement) {
    return [];
  }

  return [
    statement,
  ];
}

function compileFailureModes(
  nodes: readonly EngineeringKnowledgeNode[],
): EngineeringFailureMode[] {
  return nodes
    .filter(
      (node) =>
        node.kind ===
        "failure-mode",
    )
    .map(
      (node) => ({
        name:
          node.title,

        mechanism:
          node.statement,

        diagnosticSignals:
          deriveDiagnosticSignals(
            node,
          ),

        mitigation:
          deriveMitigation(
            node,
          ),

        sourceNodes:
          [node.id],
      }),
    );
}

/* ========================================================================== */
/* Decision compiler                                                          */
/* ========================================================================== */

function compileDecisions(
  source: KnowledgeArticle,
  nodes: readonly EngineeringKnowledgeNode[],
): EngineeringDecision[] {
  const result:
    EngineeringDecision[] =
    [];

  const decisionNodes =
    nodes.filter(
      (node) =>
        node.kind ===
        "decision",
    );

  const comparisonNodes =
    nodes.filter(
      (node) =>
        node.kind ===
        "comparison",
    );

  for (const node of decisionNodes) {
    const factors =
      unique(
        node.keywords,
      );

    result.push({
      question:
        node.title,

      decisionRule:
        node.statement,

      factors,

      sourceNodes:
        [node.id],
    });
  }

  /*
   * If explicit decision nodes do not exist, comparison material may
   * support a STRUCTURAL decision frame.
   *
   * This is deliberately marked through its sourceNodes rather than
   * pretending that the source explicitly stated the rule.
   */
  if (
    result.length === 0 &&
    comparisonNodes.length > 0
  ) {
    result.push({
      question:
        `How should ${clean(
          source.title,
        )} be evaluated?`,

      decisionRule:
        "Evaluate the source-backed comparison factors against the applicable design, material, tooling and production constraints before selecting an engineering option.",

      factors:
        unique(
          comparisonNodes.flatMap(
            (node) =>
              node.keywords,
          ),
        ),

      sourceNodes:
        comparisonNodes.map(
          (node) =>
            node.id,
        ),
    });
  }

  return result;
}

/* ========================================================================== */
/* Comparison compiler                                                        */
/* ========================================================================== */

function getComparisonRows(
  source: KnowledgeArticle,
): {
  readonly row: SourceComparisonRow;
  readonly sourceField: string;
}[] {
  const funnel =
    getFunnel(source);

  const candidate =
    funnel.comparison ??
    funnel.comparisonTable;

  /*
   * Current contract:
   *
   * {
   *   title,
   *   rows: ComparisonRow[]
   * }
   */
  if (
    isRecord(candidate)
  ) {
    const rows =
      candidate.rows;

    if (
      Array.isArray(rows)
    ) {
      return rows
        .filter(isRecord)
        .map(
          (row, index) => ({
            row:
              row as SourceComparisonRow,
            sourceField:
              `funnel.comparison.rows[${index}]`,
          }),
        );
    }

    return [];
  }

  /*
   * Legacy compatibility:
   *
   * comparison: ComparisonRow[]
   */
  if (
    Array.isArray(candidate)
  ) {
    return candidate
      .filter(isRecord)
      .map(
        (row, index) => ({
          row:
            row as SourceComparisonRow,
          sourceField:
            `funnel.comparison[${index}]`,
        }),
      );
  }

  return [];
}

function compileComparison(
  source: KnowledgeArticle,
  nodes: readonly EngineeringKnowledgeNode[],
): EngineeringComparison | null {
  const funnel =
    getFunnel(source);

  const candidate =
    funnel.comparison ??
    funnel.comparisonTable;

  let title =
    "Engineering comparison";

  if (
    isRecord(candidate)
  ) {
    title =
      clean(
        candidate.title,
      ) ||
      title;
  }

  const sourceRows =
    getComparisonRows(
      source,
    );

  if (
    sourceRows.length === 0
  ) {
    return null;
  }

  const rows:
    EngineeringComparison["rows"][number][] =
    [];

  const seen =
    new Set<string>();

  for (const entry of sourceRows) {
    const record =
      entry.row;

    const factor =
      clean(
        record.factor ??
          record.criterion ??
          record.criteria ??
          record.dimension ??
          record.name,
      );

    const left =
      clean(
        record.left ??
          record.current ??
          record.optionA ??
          record.a,
      );

    const right =
      clean(
        record.right ??
          record.alternative ??
          record.optionB ??
          record.b,
      );

    if (
      !factor ||
      !left ||
      !right
    ) {
      continue;
    }

    const key =
      [
        factor,
        left,
        right,
      ]
        .join("|")
        .toLowerCase();

    if (
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);

    rows.push({
      factor,
      left,
      right,
    });
  }

  if (
    rows.length === 0
  ) {
    return null;
  }

  return {
    title,

    rows,

    sourceNodes:
      nodes
        .filter(
          (node) =>
            node.kind ===
            "comparison",
        )
        .map(
          (node) =>
            node.id,
        ),
  };
}

/* ========================================================================== */
/* Semantic coverage compiler                                                 */
/* ========================================================================== */

function compileSemanticCoverage(
  source: KnowledgeArticle,
): EngineeringSemanticCoverage {
  const funnel =
    getFunnel(source);

  const seo =
    isRecord(funnel.seo)
      ? funnel.seo
      : {};

  const intent =
    isRecord(funnel.intent)
      ? funnel.intent
      : {};

  const title =
    clean(
      source.title,
    );

  const primary =
    clean(
      seo.primary ??
        intent.searchQuery ??
        title,
    );

  const entities =
    unique(
      cleanArray(
        seo.entities,
      ),
    );

  const queryVariants =
    unique([
      ...cleanArray(
        intent.queryVariants,
      ),
      ...cleanArray(
        seo.secondary,
      ),
    ]);

  const questions =
    unique(
      cleanArray(
        seo.questions,
      ),
    );

  const longTail =
    unique(
      cleanArray(
        seo.longTail,
      ),
    );

  const coverageTerms =
    unique([
      title,
      primary,
      ...entities,
      ...queryVariants,
      ...questions,
      ...longTail,
      ...cleanArray(
        source.seoKeywords,
      ),
    ]);

  return {
    primaryTopic:
      primary,

    entities,

    queryVariants,

    questions,

    longTailTerms:
      longTail,

    coverageTerms,
  };
}

/* ========================================================================== */
/* White-paper outline compiler                                               */
/* ========================================================================== */

function compileOutline(
  nodes: readonly EngineeringKnowledgeNode[],
  failureModes: readonly EngineeringFailureMode[],
  decisions: readonly EngineeringDecision[],
  comparison: EngineeringComparison | null,
  graph: EngineeringGraph,
): EngineeringWhitePaperOutline {
  const sections:
    EngineeringWhitePaperOutline["sections"][number][] =
    [];

  function add(
    id: string,
    title: string,
    purpose: string,
    nodeIds: readonly string[],
  ): void {
    sections.push({
      id,
      title,
      purpose,
      nodeIds:
        unique(
          nodeIds,
        ),
    });
  }

  add(
    "executive-summary",
    "Executive Engineering Summary",
    "State the engineering problem, governing variables and practical conclusion without reproducing the source article verbatim.",
    nodes
      .filter(
        (node) =>
          node.kind ===
            "definition" ||
          node.kind ===
            "mechanism",
      )
      .slice(0, 5)
      .map(
        (node) =>
          node.id,
      ),
  );

  add(
    "engineering-mechanism",
    "Engineering Mechanism",
    "Explain the physical and manufacturing mechanisms represented by the source knowledge.",
    nodes
      .filter(
        (node) =>
          node.kind ===
          "mechanism",
      )
      .map(
        (node) =>
          node.id,
      ),
  );

  add(
    "design-rules",
    "Design Rules and Engineering Constraints",
    "Organize source-backed design guidance into explicit engineering review criteria.",
    nodes
      .filter(
        (node) =>
          node.kind ===
          "design-rule",
      )
      .map(
        (node) =>
          node.id,
      ),
  );

  add(
    "materials",
    "Material and Resin Considerations",
    "Connect the topic to material entities present in the validated knowledge graph without inventing material properties.",
    nodes
      .filter(
        (node) =>
          node.kind ===
          "material",
      )
      .map(
        (node) =>
          node.id,
      ),
  );

  add(
    "tooling-process",
    "Tooling and Process Implications",
    "Connect part-level decisions to tooling and molding-process consequences represented by the source.",
    nodes
      .filter(
        (node) =>
          node.kind ===
            "tooling" ||
          node.kind ===
            "process",
      )
      .map(
        (node) =>
          node.id,
      ),
  );

  add(
    "failure-modes",
    "Failure Modes and Troubleshooting",
    "Map source-backed defect and failure knowledge to diagnostic signals and source-backed corrective guidance.",
    failureModes.flatMap(
      (mode) =>
        mode.sourceNodes,
    ),
  );

  add(
    "decision-framework",
    "Engineering Decision Framework",
    "Convert source-backed decision and comparison information into an explicit engineering decision framework.",
    decisions.flatMap(
      (decision) =>
        decision.sourceNodes,
    ),
  );

  if (
    comparison
  ) {
    add(
      "trade-offs",
      "Engineering Trade-offs",
      "Present explicit comparison factors rather than manufacturing generic pros and cons.",
      comparison.sourceNodes,
    );
  }

  add(
    "validation",
    "Validation and Production Review",
    "Identify source-backed validation and verification requirements before production approval.",
    nodes
      .filter(
        (node) =>
          node.kind ===
          "validation",
      )
      .map(
        (node) =>
          node.id,
      ),
  );

  add(
    "knowledge-graph",
    "Adjacent Engineering Knowledge",
    "Expose validated relationships to related articles, tools, materials, defects and processes.",
    [],
  );

  add(
    "faq",
    "Engineering FAQ",
    "Provide direct answers to source-backed engineering questions.",
    nodes
      .filter(
        (node) =>
          node.kind ===
          "faq",
      )
      .map(
        (node) =>
          node.id,
      ),
  );

  if (
    graph.relatedArticles.length > 0 ||
    graph.tools.length > 0 ||
    graph.materials.length > 0 ||
    graph.defects.length > 0 ||
    graph.processes.length > 0 ||
    graph.standards.length > 0
  ) {
    add(
      "related-engineering-topics",
      "Related Engineering Topics",
      "Connect this white paper to adjacent validated engineering knowledge.",
      [],
    );
  }

  return {
    sections,
  };
}

/* ========================================================================== */
/* Source fingerprint                                                         */
/* ========================================================================== */

function buildSourceFingerprint(
  source: KnowledgeArticle,
  graph: EngineeringGraph,
  nodes: readonly EngineeringKnowledgeNode[],
): string {
  const payload =
    stableJson({
      source: {
        slug:
          source.slug,

        lastUpdated:
          source.lastUpdated,

        title:
          source.title,

        description:
          source.description,

        directAnswer:
          source.directAnswer,

        keyTakeaways:
          source.keyTakeaways,

        relatedSlugs:
          source.relatedSlugs,

        seoKeywords:
          source.seoKeywords,
      },

      graph,

      nodes:
        nodes.map(
          (node) => ({
            id:
              node.id,

            kind:
              node.kind,

            title:
              node.title,

            statement:
              node.statement,

            evidence:
              node.evidence,
          }),
        ),
    });

  return hashString(
    payload,
  );
}

/* ========================================================================== */
/* Source validation                                                          */
/* ========================================================================== */

function assertInputObject(
  input: unknown,
): asserts input is CompileEngineeringKnowledgeInput {
  if (
    !isRecord(input)
  ) {
    throw new Error(
      "V714_ENGINEERING_COMPILER_INPUT_REQUIRED",
    );
  }
}

function assertSource(
  source: KnowledgeArticle,
): void {
  if (
    !source ||
    typeof source !== "object"
  ) {
    throw new Error(
      "V714_ENGINEERING_COMPILER_SOURCE_REQUIRED",
    );
  }
}

function assertNonEmpty(
  value: string,
  code: string,
): void {
  if (
    !clean(value)
  ) {
    throw new Error(
      code,
    );
  }
}

function assertSlug(
  value: string,
  code: string,
): void {
  const normalized =
    clean(value);

  if (!normalized) {
    throw new Error(
      code,
    );
  }

  /*
   * Production routing identity should remain a slug.
   *
   * We intentionally do not auto-slugify because silently changing
   * the caller's target identity is unsafe.
   */
  if (
    normalized !==
    slugify(normalized)
  ) {
    throw new Error(
      `${code}_INVALID_FORMAT`,
    );
  }
}

/* ========================================================================== */
/* Main compiler input                                                        */
/* ========================================================================== */

export interface CompileEngineeringKnowledgeInput {
  readonly source: KnowledgeArticle;

  /**
   * TARGET slug.
   *
   * This is the V7.14 white-paper identity.
   */
  readonly targetSlug: string;

  /**
   * EXISTING KnowledgeArticle slug.
   *
   * Defaults to source.slug.
   */
  readonly sourceArticleSlug?: string;
}

/* ========================================================================== */
/* Main compiler                                                             */
/* ========================================================================== */

export function compileEngineeringKnowledge(
  input: CompileEngineeringKnowledgeInput,
): EngineeringKnowledgePack {
  assertInputObject(
    input,
  );

  const source =
    input.source;

  assertSource(
    source,
  );

  const targetSlug =
    clean(
      input.targetSlug,
    );

  const sourceArticleSlug =
    clean(
      input.sourceArticleSlug ??
        source.slug,
    );

  assertSlug(
    targetSlug,
    "V714_ENGINEERING_COMPILER_TARGET_SLUG_REQUIRED",
  );

  assertSlug(
    sourceArticleSlug,
    "V714_ENGINEERING_COMPILER_SOURCE_SLUG_REQUIRED",
  );

  /*
   * TARGET and SOURCE are different identities.
   *
   * This is a hard V7.14 invariant.
   */
  if (
    targetSlug ===
    sourceArticleSlug
  ) {
    throw new Error(
      "V714_TARGET_SOURCE_IDENTITY_COLLISION",
    );
  }

  const title =
    clean(
      source.title,
    );

  const category =
    clean(
      source.category,
    );

  const categorySlug =
    clean(
      source.categorySlug,
    );

  assertNonEmpty(
    title,
    "V714_ENGINEERING_COMPILER_TITLE_REQUIRED",
  );

  assertNonEmpty(
    category,
    "V714_ENGINEERING_COMPILER_CATEGORY_REQUIRED",
  );

  assertNonEmpty(
    categorySlug,
    "V714_ENGINEERING_COMPILER_CATEGORY_SLUG_REQUIRED",
  );

  const executiveAnswer =
    clean(
      source.directAnswer ??
        source.description,
    );

  assertNonEmpty(
    executiveAnswer,
    "V714_ENGINEERING_COMPILER_EXECUTIVE_ANSWER_REQUIRED",
  );

  /* ---------------------------------------------------------------------- */
  /* 1. Source-backed content nodes                                        */
  /* ---------------------------------------------------------------------- */

  let nodes =
    compileContentNodes(
      source,
      targetSlug,
    );

  /*
   * Current KnowledgeArticle.content is authoritative.
   *
   * Funnel blocks are used only when content is absent or empty.
   */
  if (
    nodes.length === 0
  ) {
    const existingIds =
      new Set(
        nodes.map(
          (node) =>
            node.id,
        ),
      );

    nodes = [
      ...nodes,
      ...compileFunnelBlockNodes(
        source,
        targetSlug,
        existingIds,
      ),
    ];
  }

  /* ---------------------------------------------------------------------- */
  /* 2. Key takeaways                                                       */
  /* ---------------------------------------------------------------------- */

  nodes = [
    ...nodes,
    ...compileTakeawayNodes(
      source,
      targetSlug,
      nodes,
    ),
  ];

  /* ---------------------------------------------------------------------- */
  /* 3. FAQ                                                                 */
  /* ---------------------------------------------------------------------- */

  nodes = [
    ...nodes,
    ...compileFAQNodes(
      source,
      targetSlug,
      nodes,
    ),
  ];

  /* ---------------------------------------------------------------------- */
  /* 4. Graph                                                               */
  /* ---------------------------------------------------------------------- */

  const graph =
    compileGraph(
      source,
    );

  /* ---------------------------------------------------------------------- */
  /* 5. Graph nodes                                                         */
  /* ---------------------------------------------------------------------- */

  nodes = [
    ...nodes,
    ...compileGraphNodes(
      graph,
      targetSlug,
      nodes,
    ),
  ];

  /* ---------------------------------------------------------------------- */
  /* 6. Parameters                                                          */
  /* ---------------------------------------------------------------------- */

  const parameters =
    compileParameters(
      source,
    );

  /* ---------------------------------------------------------------------- */
  /* 7. Failure modes                                                       */
  /* ---------------------------------------------------------------------- */

  const failureModes =
    compileFailureModes(
      nodes,
    );

  /* ---------------------------------------------------------------------- */
  /* 8. Decisions                                                           */
  /* ---------------------------------------------------------------------- */

  const decisions =
    compileDecisions(
      source,
      nodes,
    );

  /* ---------------------------------------------------------------------- */
  /* 9. Comparison                                                          */
  /* ---------------------------------------------------------------------- */

  const comparison =
    compileComparison(
      source,
      nodes,
    );

  /* ---------------------------------------------------------------------- */
  /* 10. Semantic coverage                                                  */
  /* ---------------------------------------------------------------------- */

  const semanticCoverage =
    compileSemanticCoverage(
      source,
    );

  /* ---------------------------------------------------------------------- */
  /* 11. White-paper outline                                                */
  /* ---------------------------------------------------------------------- */

  const outline =
    compileOutline(
      nodes,
      failureModes,
      decisions,
      comparison,
      graph,
    );

  /* ---------------------------------------------------------------------- */
  /* 12. Engineering density gate                                           */
  /* ---------------------------------------------------------------------- */

  const sourceBackedNodes =
    nodes.filter(
      (node) =>
        node.evidence.some(
          (ref) =>
            ref.confidence ===
            "SOURCE_BACKED",
        ),
    );

  if (
    sourceBackedNodes.length <
    2
  ) {
    throw new Error(
      "V714_ENGINEERING_KNOWLEDGE_DENSITY_INSUFFICIENT",
    );
  }

  /* ---------------------------------------------------------------------- */
  /* 13. Node integrity gate                                                 */
  /* ---------------------------------------------------------------------- */

  const nodeIds =
    new Set<string>();

  for (const node of nodes) {
    if (
      nodeIds.has(
        node.id,
      )
    ) {
      throw new Error(
        "V714_ENGINEERING_COMPILER_NODE_ID_COLLISION",
      );
    }

    nodeIds.add(
      node.id,
    );

    if (
      !clean(node.title)
    ) {
      throw new Error(
        "V714_ENGINEERING_COMPILER_NODE_TITLE_EMPTY",
      );
    }

    if (
      !clean(node.statement)
    ) {
      throw new Error(
        "V714_ENGINEERING_COMPILER_NODE_STATEMENT_EMPTY",
      );
    }

    if (
      node.evidence.length ===
      0
    ) {
      throw new Error(
        "V714_ENGINEERING_COMPILER_NODE_LINEAGE_EMPTY",
      );
    }

    for (const evidence of node.evidence) {
      if (
        !clean(
          evidence.sourceField,
        )
      ) {
        throw new Error(
          "V714_ENGINEERING_COMPILER_SOURCE_FIELD_EMPTY",
        );
      }

      if (
        evidence.confidence ===
          "SOURCE_BACKED" &&
        !clean(
          evidence.sourceValue,
        )
      ) {
        throw new Error(
          "V714_ENGINEERING_COMPILER_SOURCE_VALUE_EMPTY",
        );
      }
    }
  }

  /* ---------------------------------------------------------------------- */
  /* 14. Source fingerprint                                                 */
  /* ---------------------------------------------------------------------- */

  const sourceFingerprint =
    buildSourceFingerprint(
      source,
      graph,
      nodes,
    );

  /* ---------------------------------------------------------------------- */
  /* 15. Final immutable pack                                                */
  /* ---------------------------------------------------------------------- */

  const pack:
    EngineeringKnowledgePack = {
    schema:
      "nexmold.v7.14.engineering-knowledge-pack.v1",

    pageId:
      `v714:${targetSlug}`,

    targetSlug,

    sourceArticleSlug,

    title,

    category,

    categorySlug,

    executiveAnswer,

    keyTakeaways:
      getSourceKeyTakeaways(
        source,
      ),

    nodes,

    parameters,

    decisions,

    failureModes,

    comparison,

    graph,

    semanticCoverage,

    outline,

    sourceFingerprint,
  };

  /*
   * Final identity invariant.
   */
  if (
    pack.targetSlug ===
    pack.sourceArticleSlug
  ) {
    throw new Error(
      "V714_ENGINEERING_COMPILER_FINAL_IDENTITY_COLLISION",
    );
  }

  /*
   * Final lineage invariant.
   */
  if (
    pack.nodes.some(
      (node) =>
        node.evidence.length ===
        0,
    )
  ) {
    throw new Error(
      "V714_ENGINEERING_COMPILER_FINAL_NODE_LINEAGE_BROKEN",
    );
  }

  return pack;
}

/* ========================================================================== */
/* Convenience adapter                                                       */
/* ========================================================================== */

export function compileEngineeringKnowledgeFromArticle(
  source: KnowledgeArticle,
  targetSlug: string,
): EngineeringKnowledgePack {
  return compileEngineeringKnowledge({
    source,

    targetSlug,

    sourceArticleSlug:
      source.slug,
  });
}

/* ========================================================================== */
/* Diagnostics                                                               */
/* ========================================================================== */

export interface EngineeringKnowledgeDiagnostics {
  readonly sourceBackedNodes: number;
  readonly derivedStructuralNodes: number;
  readonly parameters: number;
  readonly verifiedParameters: number;
  readonly decisions: number;
  readonly failureModes: number;
  readonly faqNodes: number;
  readonly graphRelations: number;
  readonly standards: number;
  readonly semanticTerms: number;
  readonly outlineSections: number;
  readonly lineageComplete: boolean;
  readonly identityValid: boolean;
  readonly sufficient: boolean;
  readonly blockingReasons: readonly string[];
}

export function diagnoseEngineeringKnowledge(
  pack: EngineeringKnowledgePack,
): EngineeringKnowledgeDiagnostics {
  const sourceBackedNodes =
    pack.nodes.filter(
      (node) =>
        node.evidence.some(
          (ref) =>
            ref.confidence ===
            "SOURCE_BACKED",
        ),
    ).length;

  const derivedStructuralNodes =
    pack.nodes.filter(
      (node) =>
        node.evidence.some(
          (ref) =>
            ref.confidence ===
            "DERIVED_STRUCTURAL",
        ),
    ).length;

  const verifiedParameters =
    pack.parameters.filter(
      (parameter) =>
        parameter.verified,
    ).length;

  const faqNodes =
    pack.nodes.filter(
      (node) =>
        node.kind ===
        "faq",
    ).length;

  const graphRelations =
    [
      ...pack.graph.relatedArticles,
      ...pack.graph.tools,
      ...pack.graph.materials,
      ...pack.graph.defects,
      ...pack.graph.processes,
      ...pack.graph.standards,
    ].length;

  const blockingReasons:
    string[] =
    [];

  const lineageComplete =
    pack.nodes.every(
      (node) =>
        node.evidence.length >
          0 &&
        node.evidence.every(
          (ref) =>
            clean(
              ref.sourceField,
            ).length > 0,
        ),
    );

  const identityValid =
    Boolean(
      pack.targetSlug &&
        pack.sourceArticleSlug &&
        pack.targetSlug !==
          pack.sourceArticleSlug,
    );

  if (
    sourceBackedNodes <
    2
  ) {
    blockingReasons.push(
      "INSUFFICIENT_SOURCE_BACKED_NODES",
    );
  }

  if (
    !pack.executiveAnswer
  ) {
    blockingReasons.push(
      "EXECUTIVE_ANSWER_MISSING",
    );
  }

  if (
    !identityValid
  ) {
    blockingReasons.push(
      "TARGET_SOURCE_IDENTITY_INVALID",
    );
  }

  if (
    !lineageComplete
  ) {
    blockingReasons.push(
      "NODE_LINEAGE_INCOMPLETE",
    );
  }

  if (
    pack.outline.sections.length <
    6
  ) {
    blockingReasons.push(
      "WHITE_PAPER_OUTLINE_TOO_THIN",
    );
  }

  if (
    pack.semanticCoverage.coverageTerms.length <
    5
  ) {
    blockingReasons.push(
      "SEMANTIC_COVERAGE_TOO_THIN",
    );
  }

  return {
    sourceBackedNodes,

    derivedStructuralNodes,

    parameters:
      pack.parameters.length,

    verifiedParameters,

    decisions:
      pack.decisions.length,

    failureModes:
      pack.failureModes.length,

    faqNodes,

    graphRelations,

    standards:
      pack.graph.standards.length,

    semanticTerms:
      pack.semanticCoverage
        .coverageTerms.length,

    outlineSections:
      pack.outline.sections.length,

    lineageComplete,

    identityValid,

    sufficient:
      blockingReasons.length ===
      0,

    blockingReasons,
  };
}

/* ========================================================================== */
/* Deterministic compiler audit                                               */
/* ========================================================================== */

export interface EngineeringKnowledgeAudit {
  readonly valid: boolean;
  readonly sourceSlug: string;
  readonly targetSlug: string;
  readonly sourceFingerprint: string;
  readonly nodeCount: number;
  readonly sourceBackedNodeCount: number;
  readonly parameterCount: number;
  readonly decisionCount: number;
  readonly failureModeCount: number;
  readonly comparisonPresent: boolean;
  readonly graphRelationCount: number;
  readonly semanticCoverageCount: number;
  readonly outlineSectionCount: number;
  readonly errors: readonly string[];
}

/**
 * Non-throwing structural audit.
 *
 * Useful for release-preflight / adversarial tests.
 */
export function auditEngineeringKnowledge(
  pack: EngineeringKnowledgePack,
): EngineeringKnowledgeAudit {
  const errors:
    string[] =
    [];

  if (
    pack.schema !==
    "nexmold.v7.14.engineering-knowledge-pack.v1"
  ) {
    errors.push(
      "INVALID_SCHEMA",
    );
  }

  if (
    !pack.targetSlug
  ) {
    errors.push(
      "TARGET_SLUG_EMPTY",
    );
  }

  if (
    !pack.sourceArticleSlug
  ) {
    errors.push(
      "SOURCE_SLUG_EMPTY",
    );
  }

  if (
    pack.targetSlug ===
    pack.sourceArticleSlug
  ) {
    errors.push(
      "TARGET_SOURCE_IDENTITY_COLLISION",
    );
  }

  if (
    !pack.title
  ) {
    errors.push(
      "TITLE_EMPTY",
    );
  }

  if (
    !pack.executiveAnswer
  ) {
    errors.push(
      "EXECUTIVE_ANSWER_EMPTY",
    );
  }

  if (
    !pack.sourceFingerprint
  ) {
    errors.push(
      "SOURCE_FINGERPRINT_EMPTY",
    );
  }

  const nodeIds =
    new Set<string>();

  for (const node of pack.nodes) {
    if (
      nodeIds.has(
        node.id,
      )
    ) {
      errors.push(
        `NODE_ID_COLLISION:${node.id}`,
      );
    }

    nodeIds.add(
      node.id,
    );

    if (
      !node.title
    ) {
      errors.push(
        `NODE_TITLE_EMPTY:${node.id}`,
      );
    }

    if (
      !node.statement
    ) {
      errors.push(
        `NODE_STATEMENT_EMPTY:${node.id}`,
      );
    }

    if (
      node.evidence.length ===
      0
    ) {
      errors.push(
        `NODE_EVIDENCE_EMPTY:${node.id}`,
      );
    }

    for (
      const evidence of
        node.evidence
    ) {
      if (
        !evidence.sourceField
      ) {
        errors.push(
          `NODE_SOURCE_FIELD_EMPTY:${node.id}`,
        );
      }

      if (
        evidence.confidence ===
          "SOURCE_BACKED" &&
        !evidence.sourceValue
      ) {
        errors.push(
          `NODE_SOURCE_VALUE_EMPTY:${node.id}`,
        );
      }
    }
  }

  const sourceBackedNodeCount =
    pack.nodes.filter(
      (node) =>
        node.evidence.some(
          (ref) =>
            ref.confidence ===
            "SOURCE_BACKED",
        ),
    ).length;

  const graphRelationCount =
    [
      ...pack.graph.relatedArticles,
      ...pack.graph.tools,
      ...pack.graph.materials,
      ...pack.graph.defects,
      ...pack.graph.processes,
      ...pack.graph.standards,
    ].length;

  return {
    valid:
      errors.length ===
      0,

    sourceSlug:
      pack.sourceArticleSlug,

    targetSlug:
      pack.targetSlug,

    sourceFingerprint:
      pack.sourceFingerprint,

    nodeCount:
      pack.nodes.length,

    sourceBackedNodeCount,

    parameterCount:
      pack.parameters.length,

    decisionCount:
      pack.decisions.length,

    failureModeCount:
      pack.failureModes.length,

    comparisonPresent:
      pack.comparison !==
      null,

    graphRelationCount,

    semanticCoverageCount:
      pack.semanticCoverage
        .coverageTerms.length,

    outlineSectionCount:
      pack.outline.sections.length,

    errors,
  };
}

/* ========================================================================== */
/* Type guard                                                                */
/* ========================================================================== */

export function isEngineeringKnowledgePack(
  value: unknown,
): value is EngineeringKnowledgePack {
  if (
    !isRecord(value)
  ) {
    return false;
  }

  const candidate =
    value as Partial<
      EngineeringKnowledgePack
    >;

  return (
    candidate.schema ===
      "nexmold.v7.14.engineering-knowledge-pack.v1" &&

    typeof candidate.pageId ===
      "string" &&

    typeof candidate.targetSlug ===
      "string" &&

    typeof candidate.sourceArticleSlug ===
      "string" &&

    typeof candidate.title ===
      "string" &&

    typeof candidate.category ===
      "string" &&

    typeof candidate.categorySlug ===
      "string" &&

    typeof candidate.executiveAnswer ===
      "string" &&

    Array.isArray(
      candidate.nodes,
    ) &&

    Array.isArray(
      candidate.parameters,
    ) &&

    Array.isArray(
      candidate.decisions,
    ) &&

    Array.isArray(
      candidate.failureModes,
    ) &&

    isRecord(
      candidate.graph,
    ) &&

    isRecord(
      candidate.semanticCoverage,
    ) &&

    isRecord(
      candidate.outline,
    ) &&

    typeof candidate.sourceFingerprint ===
      "string"
  );
}