/**
 * NEXMOLD V7.14 — Deterministic Markdown Renderer
 * Source Markdown is preserved; renderer does not reinterpret table/list content.
 */
import type { V714ArticleContract } from "./article-contract.ts";

function yaml(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, " ");
}
function normalize(value: string): string {
  return String(value ?? "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
}
function assertNoCharacterSplit(markdown: string): void {
  let fence = false, run = 0;
  for (const line of normalize(markdown).split("\n")) {
    if (/^\s*```/.test(line)) { fence = !fence; run = 0; continue; }
    if (fence) continue;
    const t = line.trim();
    if (t.length === 1 && /[A-Za-z0-9#•—–.,:;!?()/'"%+\-]/.test(t)) run++;
    else run = 0;
    if (run >= 8) throw new Error("V714_RENDER_CHARACTER_SPLIT_DETECTED");
  }
}
function assertUniqueH2(markdown: string): void {
  const seen = new Set<string>();
  for (const line of normalize(markdown).split("\n")) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (!m) continue;
    const key = m[1].trim().toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) throw new Error(`V714_RENDER_DUPLICATE_H2:${m[1]}`);
    seen.add(key);
  }
}
function assertTables(markdown: string): void {
  const lines = normalize(markdown).split("\n");
  for (let i = 0; i + 1 < lines.length; i++) {
    if (!lines[i].includes("|") || !/^\s*\|?(?:\s*:?-{3,}:?\s*\|)+/.test(lines[i + 1])) continue;
    const header = lines[i].split("|").length;
    const separator = lines[i + 1].split("|").length;
    if (header !== separator) throw new Error("V714_RENDER_TABLE_COLUMN_MISMATCH");
  }
}
function assertChecklist(markdown: string): void {
  for (const line of normalize(markdown).split("\n")) {
    if (/^\s*[-*+]\s*\[[ xX]\]\s*$/.test(line)) throw new Error("V714_RENDER_EMPTY_CHECKLIST_ITEM");
  }
}
export function renderV714ArticleMarkdown(article: V714ArticleContract): string {
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
    "---",
  ].join("\n");

  const sections: string[] = [];
  if (normalize(article.directAnswer)) sections.push(`## Direct Engineering Answer\n\n${normalize(article.directAnswer)}`);
  if (article.keyTakeaways.length) sections.push(`## Key Takeaways\n\n${article.keyTakeaways.map(x => `- ${normalize(x)}`).join("\n")}`);

  for (const block of article.content) {
    const body = normalize(block.content);
    if (!body) continue;
    sections.push(block.heading?.trim()
      ? `## ${normalize(block.heading)}\n\n${body}`
      : body);
  }

  if (article.faq.length) {
    sections.push([
      "## Frequently Asked Questions", "",
      ...article.faq.flatMap(f => [`### ${normalize(f.question)}`, "", normalize(f.answer), ""]),
    ].join("\n").trim());
  }

  const markdown = `${frontmatter}\n\n${sections.join("\n\n")}\n`;
  assertNoCharacterSplit(markdown);
  assertUniqueH2(markdown);
  assertTables(markdown);
  assertChecklist(markdown);
  return markdown;
}
