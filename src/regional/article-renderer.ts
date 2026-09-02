/**
 * NEXMOLD V7.14 — Article Markdown Renderer
 *
 * Rendering only.
 *
 * This module cannot grant publication permission.
 * It accepts an already-produced V7.14 article contract.
 *
 * Publication authority remains upstream:
 *
 * Evidence
 *   ↓
 * Semantic
 *   ↓
 * Eligibility / Firewall
 *   ↓
 * RegionalPublishArtifact
 *   ↓
 * V714ArticleContract
 *   ↓
 * Renderer
 */

import type {
  V714ArticleContract,
} from "./article-contract.ts";

function escapeYaml(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, " ");
}

function escapeMarkdown(value: string): string {
  return value.trim();
}

/**
 * Render an already-authorized V7.14 article.
 *
 * IMPORTANT:
 * This function performs no:
 * - evidence discovery
 * - claim inference
 * - eligibility decision
 * - firewall bypass
 * - publication authorization
 */
export function renderV714ArticleMarkdown(
  article: V714ArticleContract,
): string {
  const frontmatter = [
    "---",
    `title: "${escapeYaml(article.title)}"`,
    `description: "${escapeYaml(article.description)}"`,
    `pageId: "${escapeYaml(String(article.lineage.pageId))}"`,
    `articleId: "${escapeYaml(String(article.articleId))}"`,
    `slug: "${escapeYaml(article.slug)}"`,
    `category: "${escapeYaml(article.category)}"`,
    `categorySlug: "${escapeYaml(article.categorySlug)}"`,
    `locale: "${escapeYaml(String(article.lineage.locale))}"`,
    `region: "${escapeYaml(String(article.lineage.region))}"`,
    `canonicalUrl: "${escapeYaml(String(article.lineage.canonicalUrl))}"`,
    `sourceArtifactHash: "${escapeYaml(String(article.lineage.sourceArtifactHash))}"`,
    `schema: "${escapeYaml(article.schema)}"`,
    "---",
  ].join("\n");

  const sections: string[] = [];

  if (article.directAnswer.trim()) {
    sections.push(
      [
        "## Direct Engineering Answer",
        "",
        escapeMarkdown(article.directAnswer),
      ].join("\n"),
    );
  }

  if (article.keyTakeaways.length > 0) {
    sections.push(
      [
        "## Key Takeaways",
        "",
        ...article.keyTakeaways.map(
          (item) => `- ${escapeMarkdown(item)}`,
        ),
      ].join("\n"),
    );
  }

  for (const block of article.content) {
    const heading = block.heading?.trim();

    if (heading) {
      sections.push(
        [
          `## ${escapeMarkdown(heading)}`,
          "",
          escapeMarkdown(block.content),
        ].join("\n"),
      );
    } else {
      sections.push(
        escapeMarkdown(block.content),
      );
    }
  }

  if (article.faq.length > 0) {
    const faqSection = [
      "## Frequently Asked Questions",
      "",
      ...article.faq.flatMap((item) => [
        `### ${escapeMarkdown(item.question)}`,
        "",
        escapeMarkdown(item.answer),
        "",
      ]),
    ].join("\n");

    sections.push(faqSection.trim());
  }

  if (article.seoKeywords.length > 0) {
    sections.push(
      [
        "## SEO Keywords",
        "",
        article.seoKeywords
          .map((keyword) => `- ${escapeMarkdown(keyword)}`)
          .join("\n"),
      ].join("\n"),
    );
  }

  return `${frontmatter}\n\n${sections.join("\n\n")}\n`;
}
