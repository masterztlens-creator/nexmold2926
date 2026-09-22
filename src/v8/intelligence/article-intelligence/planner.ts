import { immutable, invariant } from "../../constitution/invariants.js";
import { ApplicabilityEngine } from "../../applicability/engine.js";
import { DecisionValidator } from "../../decision-validation/validator.js";
import type {
  ClaimPayload,
  EvidencePayload,
  FoundationStore,
  KnowledgePayload,
} from "../../foundation/types.js";
import type {
  ArticlePlan,
  ArticlePlanBuilder,
  ArticlePlanInput,
  ArticleSectionBinding,
} from "./types.js";

function uniqueSorted(values: readonly string[]): readonly string[] {
  return immutable([...new Set(values)].sort());
}

export class ArticleIntelligencePlanner implements ArticlePlanBuilder {
  constructor(private readonly store: FoundationStore) {}

  plan(input: ArticlePlanInput): ArticlePlan {
    invariant(
      input.sections.length > 0,
      "V8_ARTICLE_PLAN_NO_SECTIONS",
      "Article plan requires at least one section.",
    );

    new DecisionValidator(this.store).assert({
      decisionId: input.decisionId,
      scopeId: input.scopeId,
      contextId: input.contextId,
    });

    const decision = this.store.get<{
      readonly problemId: string;
      readonly knowledgeIds: readonly string[];
      readonly outcome: string;
      readonly status: "APPROVED";
      readonly fingerprint: string;
    }>("DECISION", input.decisionId);

    invariant(
      decision !== null,
      "V8_ARTICLE_PLAN_DECISION_NOT_FOUND",
      "Approved decision was not found.",
    );

    const decisionKnowledgeIds = new Set(
      decision.payload.knowledgeIds,
    );

    const applicability =
      new ApplicabilityEngine(this.store);

    const sections: ArticleSectionBinding[] =
      input.sections.map((section) => {
        invariant(
          section.sectionId.trim().length > 0,
          "V8_ARTICLE_SECTION_ID_EMPTY",
          "Article section id cannot be empty.",
        );

        invariant(
          section.heading.trim().length > 0,
          "V8_ARTICLE_SECTION_HEADING_EMPTY",
          "Article section heading cannot be empty.",
        );

        invariant(
          section.knowledgeIds.length > 0,
          "V8_ARTICLE_SECTION_NO_KNOWLEDGE",
          "Article section requires at least one knowledge reference.",
        );

        const knowledgeIds =
          uniqueSorted(section.knowledgeIds);

        for (const knowledgeId of knowledgeIds) {
          invariant(
            decisionKnowledgeIds.has(knowledgeId),
            "V8_ARTICLE_SECTION_KNOWLEDGE_OUTSIDE_DECISION",
            `Section knowledge ${knowledgeId} is outside the approved decision.`,
          );

          applicability.assert({
            knowledgeId,
            scopeId: input.scopeId,
            contextId: input.contextId,
          });
        }

        const claimIds = new Set<string>();
        const evidenceIds = new Set<string>();

        for (const knowledgeId of knowledgeIds) {
          const knowledge =
            this.store.get<KnowledgePayload>(
              "KNOWLEDGE",
              knowledgeId,
            );

          invariant(
            knowledge !== null,
            "V8_ARTICLE_PLAN_KNOWLEDGE_NOT_FOUND",
            `Knowledge ${knowledgeId} was not found.`,
          );

          invariant(
            knowledge.state === "VERIFIED",
            "V8_ARTICLE_PLAN_KNOWLEDGE_NOT_VERIFIED",
            `Knowledge ${knowledgeId} is not verified.`,
          );

          for (const claimId of knowledge.payload.claimIds) {
            const claim =
              this.store.get<ClaimPayload>(
                "CLAIM",
                claimId,
              );

            invariant(
              claim !== null,
              "V8_ARTICLE_PLAN_CLAIM_NOT_FOUND",
              `Claim ${claimId} was not found.`,
            );

            invariant(
              claim.state === "VERIFIED",
              "V8_ARTICLE_PLAN_CLAIM_NOT_VERIFIED",
              `Claim ${claimId} is not verified.`,
            );

            claimIds.add(claimId);

            for (const evidenceId of claim.payload.evidenceIds) {
              const evidence =
                this.store.get<EvidencePayload>(
                  "EVIDENCE",
                  evidenceId,
                );

              invariant(
                evidence !== null,
                "V8_ARTICLE_PLAN_EVIDENCE_NOT_FOUND",
                `Evidence ${evidenceId} was not found.`,
              );

              invariant(
                evidence.state === "VERIFIED",
                "V8_ARTICLE_PLAN_EVIDENCE_NOT_VERIFIED",
                `Evidence ${evidenceId} is not verified.`,
              );

              evidenceIds.add(evidenceId);
            }
          }
        }

        invariant(
          claimIds.size > 0,
          "V8_ARTICLE_SECTION_NO_CLAIMS",
          "Article section must resolve to at least one verified claim.",
        );

        invariant(
          evidenceIds.size > 0,
          "V8_ARTICLE_SECTION_NO_EVIDENCE",
          "Article section must resolve to at least one verified evidence record.",
        );

        return immutable({
          sectionId: section.sectionId.trim(),
          heading: section.heading.trim(),
          knowledgeIds,
          claimIds: uniqueSorted([
            ...claimIds,
          ]),
          evidenceIds: uniqueSorted([
            ...evidenceIds,
          ]),
        });
      });

    return immutable({
      decisionId: input.decisionId,
      scopeId: input.scopeId,
      contextId: input.contextId,
      sections: immutable(sections),
    });
  }
}