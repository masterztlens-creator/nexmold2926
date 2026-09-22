import { immutable, invariant } from "../../constitution/invariants.js";
import type {
  ClaimPayload,
  EvidencePayload,
  FoundationStore,
  KnowledgePayload,
} from "../../foundation/types.js";
import type {
  ArticlePlan,
  ArticleSectionBinding,
} from "../article-intelligence/types.js";
import {
  slugify,
  type ContentBrief,
  type ContentDraft,
  type EvidenceRef,
} from "../shared.js";

export interface CompilerInput {
  readonly brief: ContentBrief;
  readonly evidence: readonly EvidenceRef[];
  readonly facts?: readonly string[];
}

export interface EvidenceBoundCompilerInput {
  readonly plan: ArticlePlan;
  readonly title: string;
  readonly primaryKeyword: string;
  readonly description?: string;
}

export interface EvidenceBoundContentSection {
  readonly sectionId: string;
  readonly heading: string;
  readonly body: string;
  readonly knowledgeIds: readonly string[];
  readonly claimIds: readonly string[];
  readonly evidenceIds: readonly string[];
}

export interface EvidenceBoundContentDraft extends ContentDraft {
  readonly sections: readonly EvidenceBoundContentSection[];
}

interface ResolvedSection {
  readonly knowledgeIds: readonly string[];
  readonly claimIds: readonly string[];
  readonly evidenceIds: readonly string[];
}

function uniqueSorted(
  values: readonly string[],
): readonly string[] {
  return immutable(
    [...new Set(values)].sort(),
  );
}

/**
 * Legacy Intelligence Plane compiler.
 *
 * This function remains intentionally compatible with the existing
 * GrowthPipeline/full-stack contract. It is not the formal V8 Truth ->
 * Content compiler and does not replace EvidenceBoundContentCompiler.
 */
export function compileIndustrialContent(
  input: CompilerInput,
): ContentDraft {
  const sections = input.brief.outline.map(
    (heading, index) => ({
      heading,
      body:
        index === 0
          ? `${input.brief.primaryKeyword} is addressed here with defined scope and terminology.`
          : `This section presents engineering considerations for ${input.brief.primaryKeyword}, with explicit conditions, trade-offs, and evidence where applicable.`,
    }),
  );

  return Object.freeze({
    title: input.brief.title,
    slug: slugify(
      input.brief.primaryKeyword,
    ),
    description: `Engineering guidance for ${input.brief.primaryKeyword}.`,
    sections: Object.freeze(
      sections,
    ),
    claims: Object.freeze(
      input.facts ?? [],
    ),
    evidence: Object.freeze(
      input.evidence,
    ),
  });
}

function toEvidenceRef(
  evidence: EvidencePayload,
): EvidenceRef {
  return immutable({
    sourceUrl: evidence.locator,
    retrievedAt: evidence.capturedAt,
    excerpt: evidence.excerpt,
    ...(evidence.section
      ? {
          title: evidence.section,
        }
      : {}),
  });
}

export class EvidenceBoundContentCompiler {
  constructor(
    private readonly store: FoundationStore,
  ) {}

  compile(
    input: EvidenceBoundCompilerInput,
  ): EvidenceBoundContentDraft {
    const title =
      input.title.trim();

    const primaryKeyword =
      input.primaryKeyword.trim();

    invariant(
      title.length > 0,
      "V8_INTELLIGENCE_COMPILER_EMPTY_TITLE",
      "Content title cannot be empty.",
    );

    invariant(
      primaryKeyword.length > 0,
      "V8_INTELLIGENCE_COMPILER_EMPTY_KEYWORD",
      "Primary keyword cannot be empty.",
    );

    invariant(
      input.plan.sections.length > 0,
      "V8_INTELLIGENCE_COMPILER_NO_SECTIONS",
      "Article plan requires at least one section.",
    );

    const allClaimIds =
      new Set<string>();

    const allEvidenceIds =
      new Set<string>();

    const sections =
      input.plan.sections.map(
        (section) => {
          const resolved =
            this.resolveSection(
              section,
            );

          for (
            const claimId of
            resolved.claimIds
          ) {
            allClaimIds.add(
              claimId,
            );
          }

          for (
            const evidenceId of
            resolved.evidenceIds
          ) {
            allEvidenceIds.add(
              evidenceId,
            );
          }

          return immutable({
            sectionId:
              section.sectionId,
            heading:
              section.heading,
            body:
              this.renderSection(
                resolved,
              ),
            knowledgeIds:
              resolved.knowledgeIds,
            claimIds:
              resolved.claimIds,
            evidenceIds:
              resolved.evidenceIds,
          });
        },
      );

    const claims =
      immutable(
        [...allClaimIds]
          .sort()
          .map((claimId) => {
            const record =
              this.store.get<ClaimPayload>(
                "CLAIM",
                claimId,
              );

            invariant(
              record !== null &&
                record.state ===
                  "VERIFIED",
              "V8_INTELLIGENCE_COMPILER_CLAIM_NOT_VERIFIED",
              `Claim ${claimId} must be verified.`,
            );

            return record.payload.statement;
          }),
      );

    const evidence =
      immutable(
        [...allEvidenceIds]
          .sort()
          .map((evidenceId) => {
            const record =
              this.store.get<EvidencePayload>(
                "EVIDENCE",
                evidenceId,
              );

            invariant(
              record !== null &&
                record.state ===
                  "VERIFIED",
              "V8_INTELLIGENCE_COMPILER_EVIDENCE_NOT_VERIFIED",
              `Evidence ${evidenceId} must be verified.`,
            );

            invariant(
              record.payload
                  .verificationStatus ===
                "VERIFIED",
              "V8_INTELLIGENCE_COMPILER_EVIDENCE_STATUS_NOT_VERIFIED",
              `Evidence ${evidenceId} verification status must be VERIFIED.`,
            );

            return toEvidenceRef(
              record.payload,
            );
          }),
      );

    return immutable({
      title,
      slug: slugify(
        primaryKeyword,
      ),
      description:
        input.description?.trim() ||
        `Evidence-backed engineering guidance for ${primaryKeyword}.`,
      sections,
      claims,
      evidence,
    });
  }

  private resolveSection(
    section: ArticleSectionBinding,
  ): ResolvedSection {
    invariant(
      section.sectionId.trim()
        .length > 0,
      "V8_INTELLIGENCE_COMPILER_SECTION_ID_EMPTY",
      "Article section id cannot be empty.",
    );

    invariant(
      section.heading.trim()
        .length > 0,
      "V8_INTELLIGENCE_COMPILER_SECTION_HEADING_EMPTY",
      "Article section heading cannot be empty.",
    );

    invariant(
      section.knowledgeIds.length > 0,
      "V8_INTELLIGENCE_COMPILER_SECTION_NO_KNOWLEDGE",
      `Section ${section.sectionId} has no knowledge.`,
    );

    invariant(
      section.claimIds.length > 0,
      "V8_INTELLIGENCE_COMPILER_SECTION_NO_CLAIMS",
      `Section ${section.sectionId} has no claims.`,
    );

    invariant(
      section.evidenceIds.length > 0,
      "V8_INTELLIGENCE_COMPILER_SECTION_NO_EVIDENCE",
      `Section ${section.sectionId} has no evidence.`,
    );

    const knowledgeIds =
      uniqueSorted(
        section.knowledgeIds,
      );

    const declaredClaimIds =
      new Set(
        section.claimIds,
      );

    const declaredEvidenceIds =
      new Set(
        section.evidenceIds,
      );

    const resolvedClaimIds =
      new Set<string>();

    const resolvedEvidenceIds =
      new Set<string>();

    for (
      const knowledgeId of
      knowledgeIds
    ) {
      const knowledge =
        this.store.get<KnowledgePayload>(
          "KNOWLEDGE",
          knowledgeId,
        );

      invariant(
        knowledge !== null,
        "V8_INTELLIGENCE_COMPILER_KNOWLEDGE_NOT_FOUND",
        `Knowledge ${knowledgeId} was not found.`,
      );

      invariant(
        knowledge.state ===
          "VERIFIED",
        "V8_INTELLIGENCE_COMPILER_KNOWLEDGE_NOT_VERIFIED",
        `Knowledge ${knowledgeId} must be verified.`,
      );

      invariant(
        knowledge.payload.claimIds
          .length > 0,
        "V8_INTELLIGENCE_COMPILER_KNOWLEDGE_NO_CLAIMS",
        `Knowledge ${knowledgeId} has no claims.`,
      );

      for (
        const claimId of
        knowledge.payload.claimIds
      ) {
        invariant(
          declaredClaimIds.has(
            claimId,
          ),
          "V8_INTELLIGENCE_COMPILER_CLAIM_CLOSURE_BROKEN",
          `Section ${section.sectionId} does not bind claim ${claimId} declared by knowledge ${knowledgeId}.`,
        );

        const claim =
          this.store.get<ClaimPayload>(
            "CLAIM",
            claimId,
          );

        invariant(
          claim !== null,
          "V8_INTELLIGENCE_COMPILER_CLAIM_NOT_FOUND",
          `Claim ${claimId} was not found.`,
        );

        invariant(
          claim.state ===
            "VERIFIED",
          "V8_INTELLIGENCE_COMPILER_CLAIM_NOT_VERIFIED",
          `Claim ${claimId} must be verified.`,
        );

        invariant(
          claim.payload.evidenceIds
            .length > 0,
          "V8_INTELLIGENCE_COMPILER_CLAIM_NO_EVIDENCE",
          `Claim ${claimId} has no evidence.`,
        );

        resolvedClaimIds.add(
          claimId,
        );

        for (
          const evidenceId of
          claim.payload.evidenceIds
        ) {
          invariant(
            declaredEvidenceIds.has(
              evidenceId,
            ),
            "V8_INTELLIGENCE_COMPILER_EVIDENCE_CLOSURE_BROKEN",
            `Section ${section.sectionId} does not bind evidence ${evidenceId} declared by claim ${claimId}.`,
          );

          const evidence =
            this.store.get<EvidencePayload>(
              "EVIDENCE",
              evidenceId,
            );

          invariant(
            evidence !== null,
            "V8_INTELLIGENCE_COMPILER_EVIDENCE_NOT_FOUND",
            `Evidence ${evidenceId} was not found.`,
          );

          invariant(
            evidence.state ===
              "VERIFIED",
            "V8_INTELLIGENCE_COMPILER_EVIDENCE_NOT_VERIFIED",
            `Evidence ${evidenceId} must be verified.`,
          );

          invariant(
            evidence.payload
                .verificationStatus ===
              "VERIFIED",
            "V8_INTELLIGENCE_COMPILER_EVIDENCE_STATUS_NOT_VERIFIED",
            `Evidence ${evidenceId} verification status must be VERIFIED.`,
          );

          resolvedEvidenceIds.add(
            evidenceId,
          );
        }
      }
    }

    for (
      const claimId of
      section.claimIds
    ) {
      invariant(
        resolvedClaimIds.has(
          claimId,
        ),
        "V8_INTELLIGENCE_COMPILER_UNRELATED_CLAIM",
        `Claim ${claimId} is not derived from section knowledge.`,
      );
    }

    for (
      const evidenceId of
      section.evidenceIds
    ) {
      invariant(
        resolvedEvidenceIds.has(
          evidenceId,
        ),
        "V8_INTELLIGENCE_COMPILER_UNRELATED_EVIDENCE",
        `Evidence ${evidenceId} is not derived from section claims.`,
      );
    }

    return {
      knowledgeIds,
      claimIds:
        uniqueSorted(
          [...resolvedClaimIds],
        ),
      evidenceIds:
        uniqueSorted(
          [...resolvedEvidenceIds],
        ),
    };
  }

  private renderSection(
    resolved: ResolvedSection,
  ): string {
    const knowledgeLines =
      resolved.knowledgeIds
        .map((knowledgeId) => {
          const knowledge =
            this.store.get<KnowledgePayload>(
              "KNOWLEDGE",
              knowledgeId,
            );

          invariant(
            knowledge !== null,
            "V8_INTELLIGENCE_COMPILER_KNOWLEDGE_NOT_FOUND",
            `Knowledge ${knowledgeId} was not found.`,
          );

          return `- ${knowledge.payload.proposition.trim()}`;
        })
        .join("\n");

    const claimLines =
      resolved.claimIds
        .map((claimId) => {
          const claim =
            this.store.get<ClaimPayload>(
              "CLAIM",
              claimId,
            );

          invariant(
            claim !== null,
            "V8_INTELLIGENCE_COMPILER_CLAIM_NOT_FOUND",
            `Claim ${claimId} was not found.`,
          );

          const qualifiers = [
            ...(claim.payload
              .conditions ?? []),
            ...(claim.payload
              .units ?? []),
            ...(claim.payload.scope
              ? [
                  `scope: ${claim.payload.scope}`,
                ]
              : []),
          ];

          if (
            qualifiers.length === 0
          ) {
            return `- ${claim.payload.statement.trim()}`;
          }

          return `- ${claim.payload.statement.trim()} (${qualifiers.join("; ")}).`;
        })
        .join("\n");

    const evidenceLines =
      resolved.evidenceIds
        .map((evidenceId) => {
          const evidence =
            this.store.get<EvidencePayload>(
              "EVIDENCE",
              evidenceId,
            );

          invariant(
            evidence !== null,
            "V8_INTELLIGENCE_COMPILER_EVIDENCE_NOT_FOUND",
            `Evidence ${evidenceId} was not found.`,
          );

          const location =
            [
              evidence.payload.section,
              evidence.payload
                .page !== undefined
                ? `page ${evidence.payload.page}`
                : undefined,
              evidence.payload.table,
              evidence.payload.row,
            ]
              .filter(
                (
                  value,
                ): value is string =>
                  Boolean(value),
              )
              .join(", ");

          return location.length > 0
            ? `- ${evidence.payload.excerpt.trim()} [${location}]`
            : `- ${evidence.payload.excerpt.trim()}`;
        })
        .join("\n");

    return [
      "Verified knowledge",
      knowledgeLines,
      "",
      "Evidence-backed claims",
      claimLines,
      "",
      "Source evidence",
      evidenceLines,
    ].join("\n");
  }
}