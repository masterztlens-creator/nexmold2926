/**
 * NEXMOLD V7.14 — Source-Preserving Article Producer
 *
 * Source content is authoritative. Expert synthesis is additive and may never
 * replace or silently discard KnowledgeArticle.content.
 */
import type { KnowledgeArticle } from "../data/knowledge.ts";
import type { RegionalPublishArtifact } from "./types.ts";
import type { V714ArticleContract } from "./article-contract.ts";
import { compileExpertArticleContract, type PublicEvidenceSnapshot } from "./expert-article-compiler.ts";

export interface V714ArticleSource extends KnowledgeArticle {}
export { compileExpertArticleContract };

export interface ProduceV714WhitePaperInput {
  readonly artifact: RegionalPublishArtifact;
  readonly sourceArticle: V714ArticleSource;
  readonly targetSlug: string;
  readonly sourceArticleSlug: string;
  readonly keyword?: string;
  readonly keywordCluster?: readonly string[];
  readonly evidenceSnapshot?: PublicEvidenceSnapshot;
}

type ContentBlock = { heading?: string; content: string; type?: string };

function text(value: unknown): string {
  return typeof value === "string" ? value.replace(/\r\n?/g, "\n").trim() : "";
}
function normalizeBlock(value: unknown): ContentBlock | null {
  if (typeof value === "string") {
    const content = text(value);
    return content ? { content, type: "source" } : null;
  }
  if (!value || typeof value !== "object") return null;
  const x = value as Record<string, unknown>;
  const content = text(x.content ?? x.body ?? x.text);
  if (!content) return null;
  const heading = text(x.heading ?? x.title);
  const type = text(x.type) || "source";
  return heading ? { heading, content, type } : { content, type };
}
function sourceContent(source: KnowledgeArticle): ContentBlock[] {
  const raw = (source as unknown as Record<string, unknown>).content;
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeBlock).filter((x): x is ContentBlock => Boolean(x));
}
function normalizedHeading(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}
function mergeBlocks(blocks: readonly ContentBlock[]): ContentBlock[] {
  const out: ContentBlock[] = [];
  const byHeading = new Map<string, number>();
  for (const block of blocks) {
    const heading = text(block.heading);
    if (!heading) { out.push({ ...block }); continue; }
    const key = normalizedHeading(heading);
    const existing = byHeading.get(key);
    if (existing === undefined) {
      byHeading.set(key, out.length);
      out.push({ ...block });
    } else if (!out[existing].content.includes(block.content)) {
      out[existing] = { ...out[existing], content: `${out[existing].content}\n\n${block.content}` };
    }
  }
  return out;
}
function bullets(values: readonly string[]): string {
  return values.map(text).filter(Boolean).map(x => `- ${x}`).join("\n");
}
function expertBlocks(contract: ReturnType<typeof compileExpertArticleContract>): ContentBlock[] {
  const section = (heading: string, content: string): ContentBlock | null => {
    const body = text(content);
    return body ? { heading, content: body, type: "expert-synthesis" } : null;
  };
  return [
    section("Engineering Facts", contract.facts.map(f => f.statement).filter(Boolean).join("\n\n")),
    section("Engineering Mechanisms", contract.mechanisms.map(m =>
      `### ${m.name}\n\n${m.steps.map(s => `**Cause:** ${s.cause}\n\n**Effect:** ${s.effect}`).join("\n\n")}`
    ).join("\n\n")),
    section("Decision Framework", contract.decisions.map(d =>
      `### ${d.question}\n\n${d.options.map(o =>
        `**Decision rule:** ${o.option}${o.conditions.length ? `\n\n**Factors:** ${o.conditions.join(", ")}` : ""}`
      ).join("\n\n")}`
    ).join("\n\n")),
    section("Failure Modes and Mechanisms", contract.mechanisms
      .filter(m => /failure|defect|sink|warp|weld|flash|short shot|vent/i.test(m.name))
      .map(m => `### ${m.name}\n\n${m.steps.map(s => `${s.cause} → ${s.effect}`).join("\n")}`).join("\n\n")),
    section("Validation", contract.validations.map(v =>
      `### ${v.method}\n\n**Observable:** ${v.observable}\n\n**Acceptance basis:** ${v.acceptanceBasis}`
    ).join("\n\n")),
    section("Source-Backed Claims", contract.claims.filter(c => c.evidenceIds.length)
      .map(c => `- ${c.statement} [${c.evidenceIds.join(", ")}]`).join("\n")),
    section("Evidence Lineage", contract.sources.map(s =>
      `- ${s.title} — ${s.url} — Tier ${s.tier}`).join("\n")),
    section("Engineering Parameters", bullets(contract.facts.filter(f => /\d/.test(f.statement)).map(f => f.statement))),
  ].filter((x): x is ContentBlock => Boolean(x));
}
function assertArtifact(artifact: RegionalPublishArtifact): void {
  if (!artifact) throw new Error("V714_WHITE_PAPER_ARTIFACT_REQUIRED");
  const e = artifact.seoEligibility;
  if (e.status !== "ELIGIBLE" || e.applicability !== "APPLICABLE" || e.compliance !== "VERIFIED") {
    throw new Error("V714_WHITE_PAPER_ARTIFACT_NOT_AUTHORIZED");
  }
  if (e.evidence.completeness !== "COMPLETE") throw new Error("V714_WHITE_PAPER_EVIDENCE_INCOMPLETE");
  if (!artifact.evidence.evidence.length) throw new Error("V714_WHITE_PAPER_EVIDENCE_EMPTY");
  if (!artifact.evidence.semanticClaims.length) throw new Error("V714_WHITE_PAPER_SEMANTIC_CLAIMS_EMPTY");
  if (artifact.bindings.length !== artifact.evidence.semanticClaims.length) {
    throw new Error("V714_WHITE_PAPER_BINDING_CARDINALITY_MISMATCH");
  }
}
export function produceV714WhitePaperV2(input: ProduceV714WhitePaperInput): V714ArticleContract {
  if (!input) throw new Error("V714_WHITE_PAPER_INPUT_REQUIRED");
  assertArtifact(input.artifact);
  if (!text(input.sourceArticleSlug) || !text(input.targetSlug) || input.sourceArticleSlug === input.targetSlug) {
    throw new Error("V714_WHITE_PAPER_TARGET_SOURCE_IDENTITY_INVALID");
  }

  const expert = compileExpertArticleContract(
    input.sourceArticle, input.artifact, input.targetSlug, input.evidenceSnapshot,
  );
  const source = input.sourceArticle;
  const sourceBlocks = sourceContent(source);
  const additive = expertBlocks(expert);
  const content = mergeBlocks([...sourceBlocks, ...additive]);

  const faq = Array.isArray(source.faq)
    ? source.faq.map(f => ({ question: text(f.question), answer: text(f.answer) }))
      .filter(f => f.question && f.answer)
    : [];
  const directAnswer = text(source.directAnswer) || text(source.description);
  if (!directAnswer) throw new Error("V714_WHITE_PAPER_DIRECT_ANSWER_EMPTY");

  const sourceKeywords = Array.isArray(source.seoKeywords) ? source.seoKeywords : [];
  const seoKeywords = [...new Set([
    ...sourceKeywords.map(text),
    ...(input.keyword ? [text(input.keyword)] : []),
    ...(input.keywordCluster ?? []).map(text),
  ].filter(Boolean))];

  return {
    schema: "nexmold.v7.14.article-contract.v1",
    articleId: input.artifact.pageId,
    title: source.title,
    slug: input.targetSlug,
    category: source.category,
    categorySlug: source.categorySlug,
    description: source.description,
    directAnswer,
    keyTakeaways: source.keyTakeaways,
    content,
    faq,
    seoKeywords,
    lineage: {
      pageId: input.artifact.pageId,
      locale: input.artifact.locale,
      region: input.artifact.region,
      canonicalUrl: input.artifact.canonicalUrl,
      evidenceIds: input.artifact.evidence.evidence.map(e => String(e.id)),
      semanticClaimIds: input.artifact.evidence.semanticClaims.map(c => String(c.id)),
      sourceArtifactHash: input.artifact.pageContentHash,
    },
    sourceArtifact: input.artifact,
  };
}
export function produceV714Article(
  artifact: RegionalPublishArtifact, source: V714ArticleSource,
  targetSlug?: string, evidenceSnapshot?: PublicEvidenceSnapshot,
): V714ArticleContract {
  return produceV714WhitePaperV2({
    artifact, sourceArticle: source,
    targetSlug: text(targetSlug) || `v714-${source.slug}`,
    sourceArticleSlug: source.slug, evidenceSnapshot,
  });
}
export function isWhitePaperArticleV2(value: unknown): value is V714ArticleContract {
  if (!value || typeof value !== "object") return false;
  const c = value as Partial<V714ArticleContract>;
  return c.schema === "nexmold.v7.14.article-contract.v1"
    && typeof c.articleId === "string" && typeof c.slug === "string"
    && Array.isArray(c.content) && Array.isArray(c.lineage?.evidenceIds);
}
