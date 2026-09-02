/** NEXMOLD V7.14 — source-preserving article producer. */
import type { KnowledgeArticle } from "../data/knowledge.ts";
import type {
  RegionalPublishArtifact,
  V714ArticleContract,
  V714ArticleContentBlock,
} from "./types.ts";
import { validateRegionalPublishArtifactRuntime } from "./publication-gate.ts";

export type V714ArticleSource = KnowledgeArticle;

export interface ProduceV714WhitePaperInput {
  readonly artifact: RegionalPublishArtifact;
  readonly sourceArticle: V714ArticleSource;
  readonly targetSlug: string;
  readonly sourceArticleSlug: string;
  readonly keyword?: string;
  readonly keywordCluster?: readonly string[];
}

function text(value: unknown): string {
  return typeof value === "string"
    ? value.replace(/\r\n?/g, "\n").trim()
    : "";
}

function block(value: unknown): V714ArticleContentBlock | null {
  if (typeof value === "string") {
    const content = text(value);
    return content ? { content, type: "source" } : null;
  }

  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const heading = text(record.heading ?? record.title);
  const body = text(record.content ?? record.body ?? record.text);
  const items = Array.isArray(record.items)
    ? record.items.map(text).filter(Boolean)
    : [];
  const callout = text(record.callout);

  const parts: string[] = [];
  if (body) parts.push(body);
  if (items.length) parts.push(items.map((item) => `- ${item}`).join("\n"));
  if (callout) parts.push(`> ${callout}`);

  const content = parts.join("\n\n").trim();
  if (!content) return null;

  return heading
    ? { heading, content, type: text(record.type) || "source" }
    : { content, type: text(record.type) || "source" };
}

function sourceBlocks(source: KnowledgeArticle): V714ArticleContentBlock[] {
  const raw = (source as unknown as Record<string, unknown>).content;
  return Array.isArray(raw)
    ? raw.map(block).filter((value): value is V714ArticleContentBlock => Boolean(value))
    : [];
}

function assertArtifact(artifact: RegionalPublishArtifact): void {
  if (!validateRegionalPublishArtifactRuntime(artifact)) {
    throw new Error("V714_ARTICLE_ARTIFACT_RUNTIME_INVALID");
  }
  if (
    artifact.seoEligibility.status !== "ELIGIBLE" ||
    artifact.seoEligibility.applicability !== "APPLICABLE" ||
    artifact.seoEligibility.compliance !== "VERIFIED" ||
    artifact.evidence.completeness !== "COMPLETE"
  ) {
    throw new Error("V714_ARTICLE_ARTIFACT_NOT_AUTHORIZED");
  }
}

export function produceV714WhitePaperV2(
  input: ProduceV714WhitePaperInput,
): V714ArticleContract {
  assertArtifact(input.artifact);

  if (
    !text(input.targetSlug) ||
    !text(input.sourceArticleSlug) ||
    input.targetSlug === input.sourceArticleSlug
  ) {
    throw new Error("V714_ARTICLE_TARGET_SOURCE_IDENTITY_INVALID");
  }

  const source = input.sourceArticle;
  if (!source || text(source.slug) !== text(input.sourceArticleSlug)) {
    throw new Error("V714_ARTICLE_SOURCE_IDENTITY_INVALID");
  }

  const directAnswer =
    text((source as any).directAnswer) ||
    text((source as any).description);

  if (!directAnswer) throw new Error("V714_ARTICLE_DIRECT_ANSWER_EMPTY");

  const faq = Array.isArray((source as any).faq)
    ? (source as any).faq
        .map((item: any) => ({
          question: text(item?.question),
          answer: text(item?.answer),
        }))
        .filter((item: any) => item.question && item.answer)
    : [];

  const keywords = [
    ...new Set(
      [
        ...(Array.isArray((source as any).seoKeywords)
          ? (source as any).seoKeywords
          : []
        ).map(text),
        input.keyword ? text(input.keyword) : "",
        ...(input.keywordCluster ?? []).map(text),
      ].filter(Boolean),
    ),
  ];

  return Object.freeze({
    schema: "nexmold.v7.14.article-contract.v2",
    articleId: input.artifact.pageId,
    title: text((source as any).title),
    slug: input.targetSlug,
    category: text((source as any).category),
    categorySlug: text((source as any).categorySlug),
    description: text((source as any).description),
    directAnswer,
    keyTakeaways: Array.isArray((source as any).keyTakeaways)
      ? (source as any).keyTakeaways.map(text).filter(Boolean)
      : [],
    content: sourceBlocks(source),
    faq,
    seoKeywords: keywords,
    lineage: Object.freeze({
      pageId: input.artifact.pageId,
      locale: input.artifact.locale,
      region: input.artifact.region,
      canonicalUrl: input.artifact.canonicalUrl,
      evidenceIds: input.artifact.evidence.evidence.map((evidence) => String(evidence.id)),
      semanticClaimIds: input.artifact.evidence.semanticClaims.map((claim) => String(claim.id)),
      sourceArtifactHash: input.artifact.pageContentHash,
    }),
    sourceArtifact: input.artifact,
  });
}

export function produceV714Article(
  artifact: RegionalPublishArtifact,
  source: V714ArticleSource,
  targetSlug?: string,
): V714ArticleContract {
  return produceV714WhitePaperV2({
    artifact,
    sourceArticle: source,
    targetSlug: text(targetSlug) || `v714-${source.slug}`,
    sourceArticleSlug: source.slug,
  });
}

export function isWhitePaperArticleV2(
  value: unknown,
): value is V714ArticleContract {
  if (!value || typeof value !== "object") return false;
  const article = value as Partial<V714ArticleContract>;
  return (
    article.schema === "nexmold.v7.14.article-contract.v2" &&
    typeof article.articleId === "string" &&
    typeof article.slug === "string" &&
    Array.isArray(article.content) &&
    Array.isArray(article.faq) &&
    Boolean(article.sourceArtifact) &&
    Boolean(article.lineage)
  );
}
