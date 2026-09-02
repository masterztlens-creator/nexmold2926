/**
 * NEXMOLD V7.14 — Article Production Contract
 *
 * Boundary:
 *
 * RegionalPublishArtifact
 *        ↓
 * V714ArticleContract
 *
 * This contract carries publication-authorized identity and lineage
 * into the article production layer.
 *
 * It does NOT:
 * - discover evidence
 * - infer claims
 * - decide eligibility
 * - bypass the firewall
 * - publish directly
 */

import type {
  ContentHash,
  RegionalPublishArtifact,
} from "./types.ts";

export interface V714ArticleLineage {
  readonly pageId: RegionalPublishArtifact["pageId"];
  readonly locale: RegionalPublishArtifact["locale"];
  readonly region: RegionalPublishArtifact["region"];

  readonly canonicalUrl: RegionalPublishArtifact["canonicalUrl"];

  readonly evidenceIds: readonly string[];
  readonly semanticClaimIds: readonly string[];

  readonly sourceArtifactHash: ContentHash;
}

export interface V714ArticleContract {
  readonly schema: "nexmold.v7.14.article-contract.v1";

  readonly articleId: RegionalPublishArtifact["pageId"];

  readonly title: string;
  readonly slug: string;

  readonly category: string;
  readonly categorySlug: string;

  readonly description: string;
  readonly directAnswer: string;

  readonly keyTakeaways: readonly string[];

  readonly content: readonly {
    readonly heading?: string;
    readonly content: string;
    readonly type?: string;
  }[];

  readonly faq: readonly {
    readonly question: string;
    readonly answer: string;
  }[];

  readonly seoKeywords: readonly string[];

  readonly lineage: V714ArticleLineage;

  readonly sourceArtifact: RegionalPublishArtifact;
}