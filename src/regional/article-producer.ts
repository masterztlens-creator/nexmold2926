/**
 * NEXMOLD V7.14 — Contract-only White Paper Producer
 *
 * HARD RULE: this module does not synthesize engineering knowledge.
 * It consumes ExpertArticleContract and performs projection only.
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

function assertAuthorizedArtifact(artifact: RegionalPublishArtifact): void {
  if (!artifact) throw new Error("V714_WHITE_PAPER_ARTIFACT_REQUIRED");
  const eligibility = artifact.seoEligibility;
  if (eligibility?.status !== "ELIGIBLE" || eligibility.applicability !== "APPLICABLE" || eligibility.compliance !== "VERIFIED") throw new Error("V714_WHITE_PAPER_ARTIFACT_NOT_AUTHORIZED");
  if (eligibility.evidence?.completeness !== "COMPLETE") throw new Error("V714_WHITE_PAPER_EVIDENCE_INCOMPLETE");
  if (!Array.isArray(eligibility.evidence.evidence) || !eligibility.evidence.evidence.length) throw new Error("V714_WHITE_PAPER_EVIDENCE_EMPTY");
  if (!Array.isArray(eligibility.evidence.semanticClaims) || !eligibility.evidence.semanticClaims.length) throw new Error("V714_WHITE_PAPER_SEMANTIC_CLAIMS_EMPTY");
}

function text(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
function bullets(values: readonly string[]): string { return values.filter(Boolean).map((x) => `- ${x}`).join("\n"); }
function table(columns: readonly string[], rows: readonly (readonly string[])[]): string {
  if (!columns.length || !rows.length) return "";
  return [`| ${columns.join(" | ")} |`, `| ${columns.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");
}

function section(heading: string, content: string): { heading: string; content: string; type: string } | null {
  const body = text(content);
  return body ? { heading, content: body, type: "expert-contract" } : null;
}

export function produceV714WhitePaperV2(input: ProduceV714WhitePaperInput): V714ArticleContract {
  if (!input) throw new Error("V714_WHITE_PAPER_INPUT_REQUIRED");
  assertAuthorizedArtifact(input.artifact);
  if (!text(input.sourceArticleSlug) || !text(input.targetSlug) || input.sourceArticleSlug === input.targetSlug) throw new Error("V714_WHITE_PAPER_TARGET_SOURCE_IDENTITY_INVALID");

  const contract = compileExpertArticleContract(input.sourceArticle, input.artifact, input.targetSlug, input.evidenceSnapshot);
  const source = input.sourceArticle;
  const claimIds = contract.claims.map((c) => c.id);
  const evidenceIds = contract.evidence.map((e) => e.id);
  const sections: { heading: string; content: string; type: string }[] = [];

  sections.push(...[
    section("Engineering Facts", contract.facts.map((f) => f.statement).join("\n\n")),
    section("Engineering Mechanisms", contract.mechanisms.map((m) => `### ${m.name}\n\n${m.steps.map((s) => `**Cause:** ${s.cause}\n\n**Effect:** ${s.effect}`).join("\n\n")}`).join("\n\n")),
    section("Engineering Parameters", bullets(contract.facts.filter((f) => /\d/.test(f.statement)).map((f) => f.statement))),
    section("Decision Framework", contract.decisions.map((d) => `### ${d.question}\n\n${d.options.map((o) => `**Decision rule:** ${o.option}${o.conditions.length ? `\n\n**Factors:** ${o.conditions.join(", ")}` : ""}`).join("\n\n")}`).join("\n\n")),
    section("Failure Modes and Mechanisms", contract.mechanisms.filter((m) => /failure|defect|sink|warp|weld|flash|short shot|vent/i.test(m.name)).map((m) => `### ${m.name}\n\n${m.steps.map((s) => `${s.cause} → ${s.effect}`).join("\n")}`).join("\n\n")),
    section("Validation", contract.validations.map((v) => `### ${v.method}\n\n**Observable:** ${v.observable}\n\n**Acceptance basis:** ${v.acceptanceBasis}`).join("\n\n")),
    section("Source-Backed Claims", contract.claims.filter((c) => c.evidenceIds.length).map((c) => `- ${c.statement} [${c.evidenceIds.join(", ")}]`).join("\n")),
    section("Engineering Trade-offs", contract.decisions.flatMap((d) => d.options).map((o) => `**${o.option}**${o.advantages.length ? ` — advantages: ${o.advantages.join("; ")}` : ""}${o.risks.length ? ` — risks: ${o.risks.join("; ")}` : ""}`).join("\n\n")),
    section("Evidence Lineage", contract.sources.map((s) => `- ${s.title} — ${s.url} — Tier ${s.tier}`).join("\n")),
  ].filter((x): x is { heading: string; content: string; type: string } => Boolean(x)));

  const faq = source.faq.map((f) => ({ question: f.question, answer: f.answer }));
  const related = source.relatedSlugs.map((slug) => ({ title: slug, slug, relationship: "related engineering topic" }));
  const content = sections.map((s) => ({ heading: s.heading, content: s.content, type: s.type }));
  const directAnswer = text(source.directAnswer) || text(source.description);
  if (!directAnswer) throw new Error("V714_WHITE_PAPER_DIRECT_ANSWER_EMPTY");

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
    seoKeywords: [...source.seoKeywords, ...(input.keyword ? [input.keyword] : []), ...(input.keywordCluster ?? [])].filter((v, i, a) => Boolean(v) && a.indexOf(v) === i),
    lineage: {
      pageId: input.artifact.pageId,
      locale: input.artifact.locale,
      region: input.artifact.region,
      canonicalUrl: input.artifact.canonicalUrl,
      evidenceIds,
      semanticClaimIds: claimIds,
      sourceArtifactHash: input.artifact.pageContentHash,
    },
    sourceArtifact: input.artifact,
  };
}

export function produceV714Article(artifact: RegionalPublishArtifact, source: V714ArticleSource, targetSlug?: string, evidenceSnapshot?: PublicEvidenceSnapshot): V714ArticleContract {
  const resolved = text(targetSlug) || `v714-${source.slug}`;
  return produceV714WhitePaperV2({ artifact, sourceArticle: source, targetSlug: resolved, sourceArticleSlug: source.slug, evidenceSnapshot });
}

export function isWhitePaperArticleV2(value: unknown): value is V714ArticleContract {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<V714ArticleContract>;
  return candidate.schema === "nexmold.v7.14.article-contract.v1" && typeof candidate.articleId === "string" && typeof candidate.slug === "string" && Array.isArray(candidate.content) && Array.isArray(candidate.lineage?.evidenceIds);
}
