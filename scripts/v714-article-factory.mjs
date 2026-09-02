#!/usr/bin/env node
/**
 * NEXMOLD V7.14 — production article factory contract execution.
 *
 * This is deliberately a gate, not a hidden content generator:
 *   KnowledgeArticle
 *      -> Producer
 *      -> Regional Compiler
 *      -> Artifact
 *      -> Publication Gate
 *      -> Article Producer
 *      -> Markdown Renderer
 *
 * A real production evidence source must supply the regional artifact input.
 * The factory therefore uses an explicit deterministic smoke fixture to prove
 * the whole executable chain without inventing site evidence.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const EPOCH = process.env.NEXMOLD_BUILD_EPOCH || "manual";
const OUT_DIR = path.resolve(ROOT, ".nexmold", "releases", EPOCH, "article-factory");
const TARGET_SLUG = process.env.NEXMOLD_V714_ARTICLE_TARGET || "injection-molding-draft-angle";
const SOURCE_SLUG = process.env.NEXMOLD_V714_ARTICLE_SOURCE || "what-is-injection-molding";

function fail(message) {
  throw new Error(`[V714_ARTICLE_FACTORY] ${message}`);
}
function assert(condition, message) {
  if (!condition) fail(message);
}
function sha256(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function importTs(relativePath) {
  const url = pathToFileURL(path.resolve(ROOT, relativePath)).href;
  return import(`${url}?v714_factory=${encodeURIComponent(EPOCH)}`);
}

function findKnowledgeArticle(module) {
  for (const value of Object.values(module)) {
    if (!Array.isArray(value)) continue;
    const article = value.find(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof item.slug === "string" &&
        item.slug === SOURCE_SLUG,
    );
    if (article) return article;
  }
  return null;
}

function fixture() {
  const pageId = TARGET_SLUG;
  const locale = "en-US";
  const region = "US";
  const claimId = "claim:v714:article-factory";
  const evidenceId = "evidence:v714:article-factory";
  const canonicalUrl = `https://nxmold.com/industries/v714/${TARGET_SLUG}/`;

  return {
    compileInput: {
      pageId,
      locale,
      region,
      applicability: "APPLICABLE",
      compliance: "VERIFIED",
      evidence: {
        completeness: "COMPLETE",
        evidence: [{
          id: evidenceId,
          sourceType: "v714-factory-fixture",
          sourceLocator: "v714://article-factory/fixture/evidence-001",
          contentHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        }],
        semanticClaims: [{
          id: claimId,
          claimKey: "v714.article.factory.fixture",
        }],
      },
      semantic: {
        pageId,
        locale,
        region,
        semanticClaimIds: [claimId],
      },
    },
    bindings: [{
      claim: {
        id: claimId,
        claimKey: "v714.article.factory.fixture",
      },
      evidenceIds: [evidenceId],
    }],
    canonicalUrl,
    hreflangSet: [locale],
    canonicalByLocale: new Map([[locale, canonicalUrl]]),
  };
}

async function main() {
  const [producerMod, articleProducerMod, rendererMod, knowledgeMod] = await Promise.all([
    importTs("src/regional/Producer.ts"),
    importTs("src/regional/article-producer.ts"),
    importTs("src/regional/article-renderer.ts"),
    importTs("src/data/knowledge.ts"),
  ]);

  assert(typeof producerMod.runV714Producer === "function", "runV714Producer export missing");
  assert(typeof articleProducerMod.produceV714WhitePaperV2 === "function", "produceV714WhitePaperV2 export missing");
  assert(typeof rendererMod.renderV714ArticleMarkdown === "function", "renderV714ArticleMarkdown export missing");

  const source = findKnowledgeArticle(knowledgeMod);
  assert(source, `KnowledgeArticle source not found: ${SOURCE_SLUG}`);
  assert(source.slug !== TARGET_SLUG, "Factory source and target slug must differ");

  const productionInput = fixture();
  const result = producerMod.runV714Producer(productionInput);

  assert(result.published === true, `regional production chain blocked: ${(result.reasonCodes ?? []).join(", ")}`);
  assert(result.result?.artifact, "RegionalPublishArtifact missing");
  assert(result.result?.route, "RegionalRouteProjection missing");
  assert(result.result?.hreflang, "HreflangProjection missing");

  const article = articleProducerMod.produceV714WhitePaperV2({
    artifact: result.result.artifact,
    sourceArticle: source,
    targetSlug: TARGET_SLUG,
    sourceArticleSlug: SOURCE_SLUG,
  });

  const markdown = rendererMod.renderV714ArticleMarkdown(article);
  assert(markdown.includes('schema: "nexmold.v7.14.article-contract.v2"'), "rendered schema missing");
  assert(markdown.includes(`sourceArtifactHash: "${result.result.artifact.pageContentHash}"`), "artifact lineage hash missing");

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const markdownPath = path.join(OUT_DIR, `${TARGET_SLUG}.md`);
  fs.writeFileSync(markdownPath, markdown, "utf8");

  const manifest = {
    schema: "nexmold.v7.14.article-factory-manifest.v1",
    epoch: EPOCH,
    targetSlug: TARGET_SLUG,
    sourceSlug: SOURCE_SLUG,
    sourceOfTruth: "src/data/knowledge.ts",
    artifactContractVersion: result.result.artifact.contractVersion,
    artifactHash: result.result.artifact.pageContentHash,
    articleSchema: article.schema,
    renderedBytes: Buffer.byteLength(markdown, "utf8"),
    renderedSha256: sha256(markdown),
    output: path.relative(ROOT, markdownPath).replaceAll(path.sep, "/"),
    chain: [
      "KnowledgeArticle",
      "Producer",
      "RegionalCompiler",
      "RegionalPublishArtifact",
      "PublicationGate",
      "ArticleProducer",
      "ArticleRenderer",
    ],
  };

  writeJson(path.join(OUT_DIR, "manifest.json"), manifest);
  console.log(`[NEXMOLD][V7.14] ARTICLE FACTORY PASS — ${manifest.chain.join(" -> ")}`);
  console.log(`[NEXMOLD][V7.14] Article: ${manifest.output}`);
  console.log(`[NEXMOLD][V7.14] Artifact hash: ${manifest.artifactHash}`);
}

main().catch((error) => {
  console.error(`[NEXMOLD][V7.14][ARTICLE_FACTORY] FAIL — ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
