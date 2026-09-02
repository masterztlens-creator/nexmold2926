/** NEXMOLD V7.14 — deterministic Markdown renderer. */
import type { V714ArticleContract } from "./types.ts";

function yaml(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, " ");
}

function norm(value: string): string {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .trim();
}

function validateMarkdown(markdown: string): void {
  const lines = norm(markdown).split("\n");
  let fenced = false;
  const h2 = new Set<string>();

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (/^\s*```/.test(line)) {
      fenced = !fenced;
      continue;
    }

    if (fenced) continue;

    if (/^\s*[-*+]\s*\[[ xX]\]\s*$/.test(line)) {
      throw new Error("V714_RENDER_EMPTY_CHECKLIST_ITEM");
    }

    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      const key = heading[1].toLowerCase().replace(/\s+/g, " ").trim();
      if (h2.has(key)) throw new Error(`V714_RENDER_DUPLICATE_H2:${heading[1]}`);
      h2.add(key);
    }
  }

  if ((lines.join("\n").match(/```/g) ?? []).length % 2 !== 0) {
    throw new Error("V714_RENDER_UNCLOSED_CODE_FENCE");
  }

  if (!/^---\n/.test(markdown)) throw new Error("V714_RENDER_FRONTMATTER_MISSING");
  if (!/\n---\n/.test(markdown)) throw new Error("V714_RENDER_FRONTMATTER_UNCLOSED");
}

function assertArticle(article: V714ArticleContract): void {
  if (article.schema !== "nexmold.v7.14.article-contract.v2") {
    throw new Error("V714_RENDER_ARTICLE_SCHEMA_INVALID");
  }
  for (const field of [
    article.title,
    article.slug,
    article.description,
    article.directAnswer,
    article.lineage.canonicalUrl,
    article.lineage.sourceArtifactHash,
  ]) {
    if (!norm(field)) throw new Error("V714_RENDER_REQUIRED_FIELD_EMPTY");
  }
  if (!/^[a-f0-9]{64}$/i.test(article.lineage.sourceArtifactHash)) {
    throw new Error("V714_RENDER_ARTIFACT_HASH_INVALID");
  }
}

export function renderV714ArticleMarkdown(
  article: V714ArticleContract,
): string {
  assertArticle(article);

  const frontmatter = [
    "---",
    `title: "${yaml(article.title)}"`,
    `description: "${yaml(article.description)}"`,
    `pageId: "${yaml(String(article.lineage.pageId))}"`,
    `articleId: "${yaml(String(article.articleId))}"`,
    `slug: "${yaml(article.slug)}"`,
    `category: "${yaml(article.category)}"`,
    `categorySlug: "${yaml(article.categorySlug)}"`,
    `locale: "${yaml(String(article.lineage.locale))}"`,
    `region: "${yaml(String(article.lineage.region))}"`,
    `canonicalUrl: "${yaml(String(article.lineage.canonicalUrl))}"`,
    `sourceArtifactHash: "${yaml(String(article.lineage.sourceArtifactHash))}"`,
    `schema: "${yaml(article.schema)}"`,
    `artifactContractVersion: "${yaml(article.sourceArtifact.contractVersion)}"`,
    "---",
  ].join("\n");

  const sections: string[] = [];

  if (norm(article.directAnswer)) {
    sections.push(`## Direct Engineering Answer\n\n${norm(article.directAnswer)}`);
  }

  if (article.keyTakeaways.length) {
    sections.push(
      `## Key Takeaways\n\n${article.keyTakeaways
        .map((item) => `- ${norm(item)}`)
        .join("\n")}`,
    );
  }

  for (const block of article.content) {
    const body = norm(block.content);
    if (!body) continue;
    sections.push(
      block.heading?.trim()
        ? `## ${norm(block.heading)}\n\n${body}`
        : body,
    );
  }

  if (article.faq.length) {
    sections.push(
      [
        "## Frequently Asked Questions",
        "",
        ...article.faq.flatMap((item) => [
          `### ${norm(item.question)}`,
          "",
          norm(item.answer),
          "",
        ]),
      ]
        .join("\n")
        .trim(),
    );
  }

  const markdown = `${frontmatter}\n\n${sections.join("\n\n")}\n`;
  validateMarkdown(markdown);
  return markdown;
}
