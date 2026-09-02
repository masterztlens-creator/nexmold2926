#!/usr/bin/env node

/**
 * NEXMOLD V7.14
 * Batch-01 Semantic Source Resolution
 *
 * Purpose:
 *   Resolve Batch-01 keyword candidates to the existing
 *   canonical KnowledgeArticle source.
 *
 * IMPORTANT:
 *   - Does NOT modify src/data/knowledge.ts
 *   - Does NOT modify existing pages
 *   - Does NOT publish
 *   - Does NOT alter V7.14 Producer / Compiler / Firewall
 *   - Semantic collision candidates remain BLOCKED
 *
 * Output:
 *   .nexmold/content-factory/batch-01-source-resolution.json
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const MANIFEST_FILE = path.join(
  ROOT,
  ".nexmold",
  "content-factory",
  "batch-01-keyword-manifest.json",
);

const KNOWLEDGE_FILE = path.join(
  ROOT,
  "src",
  "data",
  "knowledge.ts",
);

const OUTPUT_FILE = path.join(
  ROOT,
  ".nexmold",
  "content-factory",
  "batch-01-source-resolution.json",
);

function fatal(message) {
  console.error(`[NEXMOLD][V7.14][FATAL] ${message}`);
  process.exitCode = 1;
}

if (!fs.existsSync(MANIFEST_FILE)) {
  fatal(`Manifest not found: ${MANIFEST_FILE}`);
  process.exit();
}

if (!fs.existsSync(KNOWLEDGE_FILE)) {
  fatal(`Knowledge source not found: ${KNOWLEDGE_FILE}`);
  process.exit();
}

const manifest = JSON.parse(
  fs.readFileSync(MANIFEST_FILE, "utf8"),
);

if (
  !manifest ||
  manifest.schema !==
    "nexmold.v7.14.long-tail-keyword-manifest.v1"
) {
  fatal("Invalid Batch-01 manifest schema.");
  process.exit();
}

if (!Array.isArray(manifest.candidates)) {
  fatal("Manifest candidates must be an array.");
  process.exit();
}

const knowledgeSource = fs.readFileSync(
  KNOWLEDGE_FILE,
  "utf8",
);

const slugMatches = [
  ...knowledgeSource.matchAll(
    /"slug"\s*:\s*"([^"]+)"/g,
  ),
];

const knowledgeSlugs = new Set(
  slugMatches.map(
    (match) => match[1],
  ),
);

/**
 * Explicit semantic resolution.
 *
 * These mappings are based on the existing 71-article
 * KnowledgeArticle database already verified in
 * src/data/knowledge.ts.
 */
const SOURCE_MAP = {
  BL01: "plastic-wall-thickness-design",
  BL02: "draft-angle-injection-molding",
  BL03: "rib-boss-gusset-design",
  BL04: "rib-boss-gusset-design",
  BL05: "plastic-corner-radii",
  BL06: "injection-molding-undercuts",
  BL07: "parting-line-design",
  BL08: "gate-location-best-practices",
  BL09: "injection-mold-venting",
  BL10: "sink-marks-causes-solutions",
  BL11: "injection-molding-warpage",
  BL12: "weld-lines-knit-lines",
  BL13: "injection-mold-steel-selection",
  BL14: "s136-vs-nak80-vs-718h",
  BL15: "hot-runner-vs-cold-runner",
  BL16: "conformal-cooling",
  BL17: "abs-injection-molding",
  BL18: "pc-injection-molding",
  BL19: "injection-molding-cycle-optimization",
  BL20: "multi-cavity-mold-cavity-balance",
};

const BLOCKED_STATUSES = new Set([
  "REVIEW_SEMANTIC_COLLISION",
]);

const results = [];

const summary = {
  candidates: manifest.candidates.length,
  resolved: 0,
  blockedSemanticCollision: 0,
  sourceMissing: 0,
  sourceNotInKnowledge: 0,
  unresolved: 0,
};

for (const candidate of manifest.candidates) {
  const id = String(candidate.id);
  const sourceArticleSlug =
    SOURCE_MAP[id] ?? null;

  const result = {
    id,
    keyword: candidate.keyword,
    targetSlug: candidate.slug,
    manifestStatus: candidate.status,
    sourceArticleSlug,
    resolutionStatus: "UNRESOLVED",
  };

  if (
    BLOCKED_STATUSES.has(
      String(candidate.status),
    )
  ) {
    result.resolutionStatus =
      "BLOCKED_SEMANTIC_COLLISION";

    result.reasonCodes = [
      "V714_SEMANTIC_COLLISION_REVIEW_REQUIRED",
    ];

    summary.blockedSemanticCollision += 1;
    results.push(result);
    continue;
  }

  if (!sourceArticleSlug) {
    result.resolutionStatus =
      "SOURCE_MAPPING_MISSING";

    result.reasonCodes = [
      "V714_SOURCE_MAPPING_MISSING",
    ];

    summary.sourceMissing += 1;
    summary.unresolved += 1;
    results.push(result);
    continue;
  }

  if (!knowledgeSlugs.has(sourceArticleSlug)) {
    result.resolutionStatus =
      "SOURCE_NOT_IN_KNOWLEDGE";

    result.reasonCodes = [
      "V714_SOURCE_ARTICLE_NOT_IN_KNOWLEDGE",
    ];

    summary.sourceNotInKnowledge += 1;
    summary.unresolved += 1;
    results.push(result);
    continue;
  }

  result.resolutionStatus =
    "RESOLVED_EXISTING_KNOWLEDGE_ARTICLE";

  result.reasonCodes = [
    "V714_EXISTING_KNOWLEDGE_SOURCE_RESOLVED",
  ];

  summary.resolved += 1;

  results.push(result);
}

if (summary.unresolved > 0) {
  console.error("");
  console.error(
    "[NEXMOLD][V7.14] SOURCE RESOLUTION FAILED CLOSED.",
  );
  console.error(
    `Unresolved sources: ${summary.unresolved}`,
  );
  console.error("");
  process.exitCode = 1;
}

const output = {
  schema:
    "nexmold.v7.14.batch-01-source-resolution.v1",

  generatedAt:
    new Date().toISOString(),

  sourceManifest:
    path.relative(
      ROOT,
      MANIFEST_FILE,
    ),

  sourceKnowledge:
    path.relative(
      ROOT,
      KNOWLEDGE_FILE,
    ),

  policy: {
    modifyKnowledgeSource: false,
    modifyExistingContent: false,
    publishAutomatically: false,
    semanticCollisionReviewRequired: true,
    v714CompilerRequired: true,
  },

  knowledgeArticleCount:
    knowledgeSlugs.size,

  summary,

  results,
};

fs.writeFileSync(
  OUTPUT_FILE,
  JSON.stringify(
    output,
    null,
    2,
  ),
  "utf8",
);

console.log("");
console.log("=======================================================");
console.log(
  "[NEXMOLD][V7.14] BATCH-01 SOURCE RESOLUTION",
);
console.log("=======================================================");
console.log(
  `Knowledge articles    : ${knowledgeSlugs.size}`,
);
console.log(
  `Batch candidates      : ${summary.candidates}`,
);
console.log(
  `Resolved existing     : ${summary.resolved}`,
);
console.log(
  `Semantic collision    : ${summary.blockedSemanticCollision}`,
);
console.log(
  `Source missing        : ${summary.sourceMissing}`,
);
console.log(
  `Source not in KB      : ${summary.sourceNotInKnowledge}`,
);
console.log(
  `Unresolved            : ${summary.unresolved}`,
);
console.log("-------------------------------------------------------");
console.log(
  `Output                : ${OUTPUT_FILE}`,
);
console.log("-------------------------------------------------------");
console.log(
  "Existing knowledge content was NOT modified.",
);
console.log(
  "Existing pages were NOT modified.",
);
console.log(
  "Automatic publication is DISABLED.",
);
console.log("=======================================================");
console.log("");
