#!/usr/bin/env node

/**
 * NEXMOLD V7.14
 * NEW ARTICLE PILOT
 *
 * Independent article generation.
 *
 * IMPORTANT:
 * - Does NOT read src/data/knowledge.ts
 * - Does NOT modify existing pages
 * - Does NOT modify Batch-01
 * - Does NOT publish
 *
 * Output:
 * .nexmold/content-factory/new-article/
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const OUT_DIR = path.join(
  ROOT,
  ".nexmold",
  "content-factory",
  "new-article",
);

const SLUG =
  "injection-molding-ejection-system-design";

const ARTICLE_ID =
  `v714:${SLUG}`;

const PAGE_ID =
  ARTICLE_ID;

const CANONICAL_URL =
  `https://www.nexmold.com/knowledge/${SLUG}/`;

const article = {
  schema:
    "nexmold.v7.14.new-article-pilot.v1",

  pageId: PAGE_ID,

  articleId: ARTICLE_ID,

  title:
    "Injection Molding Ejection System Design: DFM Guidelines",

  slug: SLUG,

  category:
    "DFM & Tolerances",

  categorySlug:
    "dfm-tolerances",

  locale:
    "en-US",

  region:
    "US",

  canonicalUrl:
    CANONICAL_URL,

  description:
    "Injection molding ejection system design should provide reliable part release without damaging cosmetic surfaces, distorting critical features, or creating unnecessary tooling complexity.",

  directAnswer:
    "A reliable injection molding ejection system distributes release forces across suitable part areas, maintains adequate draft and stiffness, and keeps ejector features away from critical cosmetic and dimensional surfaces.",

  keyTakeaways: [
    "Place ejector features on structurally suitable areas that can tolerate release forces.",
    "Use sufficient draft and avoid relying on ejectors to compensate for poor mold-release geometry.",
    "Distribute ejection forces to reduce part distortion and local stress.",
    "Protect cosmetic surfaces and critical dimensions from visible or functionally harmful ejector marks.",
    "Validate ejection behavior with the production-intent resin, mold and process conditions.",
  ],

  content: [
    {
      heading:
        "Engineering Answer",

      content:
        "Ejection is a tooling and part-design interaction. The part must be able to release from the core without excessive friction, vacuum effects, mechanical interference or concentrated ejection loads. Ejector locations should therefore be selected together with draft, wall thickness, ribs, bosses, texture, parting-line strategy and cosmetic requirements.",
    },

    {
      heading:
        "Ejector Location Strategy",

      content:
        "Ejectors should normally act on areas with sufficient structural stiffness and adequate contact area. Broad, stable regions are generally preferable to thin unsupported walls or cosmetic faces. Ribs, bosses and other reinforced regions can provide useful ejection locations when their geometry can accept the required ejector feature without creating sink, read-through or dimensional problems.",
    },

    {
      heading:
        "Draft and Release",

      content:
        "Ejector design cannot compensate for inadequate draft in every application. Increasing draft, controlling surface texture and reducing unnecessary core-side friction can materially improve release behavior. The required draft depends on resin, texture, geometry, shrinkage, tooling condition and cosmetic requirements.",
    },

    {
      heading:
        "Ejection Force Distribution",

      content:
        "Ejection force should be distributed so that the part does not deform excessively during release. Long or flexible parts may require multiple ejectors or a coordinated ejection strategy. Uneven force distribution can produce bending, distortion, whitening or local damage even when the mold opens correctly.",
    },

    {
      heading:
        "Cosmetic and Functional Surfaces",

      content:
        "Ejector marks should be kept away from surfaces where visible marks, dimensional changes or functional interference are unacceptable. Cosmetic requirements should be identified before tooling design so that the ejection strategy can be coordinated with part orientation, texture and gate location.",
    },

    {
      heading:
        "Production Validation",

      content:
        "Final ejection performance should be validated using production-intent tooling, the specified resin, representative process conditions and the defined inspection method. Validation should confirm reliable release, acceptable ejector marks, dimensional stability, cosmetic quality and repeatable mold cycling.",
    },

    {
      heading:
        "DFM Decision Path",

      content:
        "Review draft and release direction first. Then identify suitable structural ejection regions, check cosmetic and dimensional constraints, evaluate force distribution and confirm that ejector features do not create unacceptable sink or read-through. Resolve conflicts before steel is cut.",
    },
  ],

  faq: [
    {
      question:
        "What is the main purpose of an injection molding ejection system?",

      answer:
        "The ejection system removes the molded part from the mold while minimizing deformation, surface damage, dimensional change and tooling-cycle instability.",
    },

    {
      question:
        "Where should ejectors normally be located?",

      answer:
        "Ejectors should generally be placed on structurally suitable regions that can tolerate release forces and where ejector marks will not compromise critical cosmetic or functional requirements.",
    },

    {
      question:
        "Can ejectors compensate for insufficient draft?",

      answer:
        "Not reliably. Ejector force may help release a part, but inadequate draft can increase friction and release loads and may lead to deformation or surface damage.",
    },

    {
      question:
        "How can ejector marks be minimized?",

      answer:
        "Use appropriate ejector locations and sizes, distribute release forces, avoid critical cosmetic surfaces and coordinate ejection with draft, texture, wall structure and part orientation.",
    },

    {
      question:
        "How should an ejection system be validated?",

      answer:
        "Validation should use production-intent tooling, the specified resin and representative molding conditions, with inspection covering release behavior, ejector marks, dimensions and cosmetic requirements.",
    },
  ],

  seoKeywords: [
    "injection molding ejection system design",
    "injection molding ejector design",
    "plastic part ejection design",
    "injection mold ejector placement",
    "injection molding DFM",
    "ejection system DFM guidelines",
    "injection molding ejector marks",
    "injection mold release design",
    "plastic injection molding",
    "injection mold design",
  ],
};

function ensureDirectory() {
  fs.mkdirSync(OUT_DIR, {
    recursive: true,
  });
}

function yaml(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, " ");
}

function renderMarkdown() {
  const lines = [
    "---",
    `title: "${yaml(article.title)}"`,
    `description: "${yaml(article.description)}"`,
    `pageId: "${yaml(article.pageId)}"`,
    `articleId: "${yaml(article.articleId)}"`,
    `slug: "${yaml(article.slug)}"`,
    `category: "${yaml(article.category)}"`,
    `categorySlug: "${yaml(article.categorySlug)}"`,
    `locale: "${yaml(article.locale)}"`,
    `region: "${yaml(article.region)}"`,
    `canonicalUrl: "${yaml(article.canonicalUrl)}"`,
    `schema: "${yaml(article.schema)}"`,
    "---",
    "",
    "## Direct Engineering Answer",
    "",
    article.directAnswer,
    "",
    "## Key Takeaways",
    "",
    ...article.keyTakeaways.map(
      (item) => `- ${item}`,
    ),
    "",
  ];

  for (const block of article.content) {
    lines.push(
      `## ${block.heading}`,
      "",
      block.content,
      "",
    );
  }

  lines.push(
    "## Frequently Asked Questions",
    "",
  );

  for (const item of article.faq) {
    lines.push(
      `### ${item.question}`,
      "",
      item.answer,
      "",
    );
  }

  lines.push(
    "## SEO Keywords",
    "",
    ...article.seoKeywords.map(
      (item) => `- ${item}`,
    ),
    "",
  );

  return lines.join("\n");
}

function main() {
  ensureDirectory();

  const markdownPath =
    path.join(
      OUT_DIR,
      `${SLUG}.md`,
    );

  const metadataPath =
    path.join(
      OUT_DIR,
      `${SLUG}.json`,
    );

  const markdown =
    renderMarkdown();

  /*
   * Explicit UTF-8 without BOM.
   */
  const utf8 =
    new TextEncoder();

  fs.writeFileSync(
    markdownPath,
    Buffer.from(
      utf8.encode(markdown),
    ),
  );

  const metadata = {
    schema:
      "nexmold.v7.14.new-article-pilot-artifact.v1",

    pageId:
      article.pageId,

    articleId:
      article.articleId,

    title:
      article.title,

    slug:
      article.slug,

    locale:
      article.locale,

    region:
      article.region,

    canonicalUrl:
      article.canonicalUrl,

    production: {
      pilot: true,
      published: false,
      automaticPublication: false,
      existingContentModified: false,
    },

    source: {
      type:
        "new-v714-article-input",

      existingKnowledgeSourceUsed:
        false,
    },

    output: {
      markdown:
        path.relative(
          ROOT,
          markdownPath,
        ),

      metadata:
        path.relative(
          ROOT,
          metadataPath,
        ),
    },
  };

  fs.writeFileSync(
    metadataPath,
    JSON.stringify(
      metadata,
      null,
      2,
    ),
    "utf8",
  );

  console.log("");
  console.log(
    "=======================================================",
  );
  console.log(
    "[NEXMOLD][V7.14] NEW ARTICLE PILOT",
  );
  console.log(
    "=======================================================",
  );
  console.log(
    `Title       : ${article.title}`,
  );
  console.log(
    `Slug        : ${article.slug}`,
  );
  console.log(
    `Markdown    : ${path.relative(ROOT, markdownPath)}`,
  );
  console.log(
    `Metadata    : ${path.relative(ROOT, metadataPath)}`,
  );
  console.log(
    "Existing KB  : NOT USED",
  );
  console.log(
    "Existing site: NOT MODIFIED",
  );
  console.log(
    "Publication  : DISABLED",
  );
  console.log(
    "=======================================================",
  );
  console.log("");
}

main();
