#!/usr/bin/env node

/**
 * NEXMOLD V7.14 — Article Factory
 *
 * Production path:
 * Manifest -> Source Resolution -> Collision Gate ->
 * compileRegionalPage() -> RegionalPublishArtifact ->
 * Publication Authorization Gate -> produceV714Article() ->
 * V714ArticleContract -> renderV714ArticleMarkdown() ->
 * immutable factory output.
 *
 * Safety:
 * - Never modifies public site content.
 * - Never modifies historical batch-01 output.
 * - Never overwrites an existing output file.
 * - New production is isolated in batch-01-v3.
 * - Automatic publication is disabled.
 * - Target slug is path-safe.
 * - Output files use OS-level exclusive creation.
 * - Failed writes only clean up files created by this process.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import { getArticleBySlug } from "../src/data/knowledge.ts";
import { compileRegionalPage } from "../src/regional/regionalCompiler.ts";
import { produceV714Article, compileExpertArticleContract } from "../src/regional/article-producer.ts";
import { renderV714ArticleMarkdown } from "../src/regional/article-renderer.ts";
import { evaluateExpertQuality } from "../src/regional/expert-quality-gate.ts";

const ROOT = process.cwd();

const FACTORY_ROOT = path.join(
  ROOT,
  ".nexmold",
  "content-factory",
);

const BATCH = "batch-01-v3";

const FACTORY_DIR = path.join(
  FACTORY_ROOT,
  BATCH,
);

const MANIFEST_FILE = path.join(
  FACTORY_ROOT,
  "batch-01-keyword-manifest.json",
);

const SOURCE_RESOLUTION_FILE = path.join(
  FACTORY_ROOT,
  "batch-01-source-resolution.json",
);

const REPORT_FILE = path.join(
  FACTORY_DIR,
  "production-report.json",
);

const ROUTE_PREFIX = "/industries/v714/";
const CANONICAL_ORIGIN = "https://www.nexmold.com";
const PRODUCER_VERSION = "v714-article-producer";

fs.mkdirSync(
  FACTORY_DIR,
  {
    recursive: true,
  },
);

function fail(message) {
  console.error(
    "[NEXMOLD][V7.14][FATAL] " + String(message),
  );

  process.exit(1);
}

function requireFile(file, label) {
  if (!fs.existsSync(file)) {
    fail(
      String(label) + " not found: " + String(file),
    );
  }
}

function errorText(error) {
  return error instanceof Error
    ? error.message
    : String(error);
}

/**
 * Target slug must be exactly one safe path segment.
 *
 * Examples accepted:
 *   plastic-injection-molding
 *   abs-injection-molding
 *   tooling
 *
 * Examples rejected:
 *   ../foo
 *   ..\foo
 *   foo/bar
 *   /foo
 *   .
 *   ..
 *   foo..
 *   foo bar
 *   foo_
 */
function assertSafeTargetSlug(targetSlug) {
  if (
    typeof targetSlug !== "string" ||
    targetSlug.length === 0
  ) {
    throw new Error(
      "V714_TARGET_SLUG_EMPTY",
    );
  }

  if (
    targetSlug === "." ||
    targetSlug === ".."
  ) {
    throw new Error(
      "V714_TARGET_SLUG_DOT_SEGMENT",
    );
  }

  if (
    targetSlug.includes("/") ||
    targetSlug.includes("\\")
  ) {
    throw new Error(
      "V714_TARGET_SLUG_PATH_SEPARATOR",
    );
  }

  if (
    targetSlug.includes("..")
  ) {
    throw new Error(
      "V714_TARGET_SLUG_PATH_TRAVERSAL",
    );
  }

  if (
    path.isAbsolute(targetSlug)
  ) {
    throw new Error(
      "V714_TARGET_SLUG_ABSOLUTE_PATH",
    );
  }

  if (
    /[\u0000-\u001F\u007F]/.test(targetSlug)
  ) {
    throw new Error(
      "V714_TARGET_SLUG_CONTROL_CHARACTER",
    );
  }

  if (
    targetSlug.trim() !== targetSlug
  ) {
    throw new Error(
      "V714_TARGET_SLUG_WHITESPACE",
    );
  }

  if (
    !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(
      targetSlug,
    )
  ) {
    throw new Error(
      "V714_TARGET_SLUG_INVALID_FORMAT",
    );
  }

  const factoryDir = path.resolve(
    FACTORY_DIR,
  );

  const candidatePath = path.resolve(
    FACTORY_DIR,
    targetSlug,
  );

  const relativePath = path.relative(
    factoryDir,
    candidatePath,
  );

  if (
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(
      "V714_TARGET_SLUG_FACTORY_ESCAPE",
    );
  }
}

function assertFactoryOutputPath(file) {
  const factoryDir = path.resolve(
    FACTORY_DIR,
  );

  const resolvedFile = path.resolve(
    file,
  );

  const relativePath = path.relative(
    factoryDir,
    resolvedFile,
  );

  if (
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(
      "V714_FACTORY_OUTPUT_PATH_ESCAPE: " +
        String(file),
    );
  }
}

/**
 * Atomic writer for replaceable control artifacts.
 *
 * Article markdown and article metadata MUST NOT use this function.
 */
function writeAtomic(file, content) {
  const directory = path.dirname(file);

  fs.mkdirSync(
    directory,
    {
      recursive: true,
    },
  );

  const tempFile = path.join(
    directory,
    "." +
      path.basename(file) +
      ".tmp-" +
      String(process.pid) +
      "-" +
      String(Date.now()) +
      "-" +
      Math.random()
        .toString(36)
        .slice(2),
  );

  try {
    fs.writeFileSync(
      tempFile,
      content,
      {
        encoding: "utf8",
        flag: "wx",
      },
    );

    /*
     * Windows does not allow renameSync(source, existingTarget).
     * The production report is a replaceable control artifact, not
     * an immutable article output, so replace the existing target
     * only after the complete temporary file has been written.
     *
     * This preserves the important invariant: a partial report is
     * never written to the final pathname.
     */
    if (process.platform === "win32" && fs.existsSync(file)) {
      fs.unlinkSync(file);
    }

    fs.renameSync(
      tempFile,
      file,
    );
  } catch (error) {
    if (fs.existsSync(tempFile)) {
      try {
        fs.unlinkSync(tempFile);
      } catch {}
    }

    throw error;
  }
}

/**
 * Immutable output writer.
 *
 * "wx" means:
 *   - create only when the file does not exist
 *   - fail when the file already exists
 *
 * This closes the TOCTOU window that exists with:
 *
 *   existsSync()
 *   then write/rename
 */
function writeNew(file, content) {
  assertFactoryOutputPath(file);

  const directory = path.dirname(file);

  fs.mkdirSync(
    directory,
    {
      recursive: true,
    },
  );

  let fileDescriptor = null;
  let createdByThisCall = false;

  try {
    fileDescriptor = fs.openSync(
      file,
      "wx",
    );

    createdByThisCall = true;

    fs.writeFileSync(
      fileDescriptor,
      content,
      "utf8",
    );

    fs.fsyncSync(
      fileDescriptor,
    );
  } catch (error) {
    if (
      fileDescriptor !== null
    ) {
      try {
        fs.closeSync(
          fileDescriptor,
        );
      } catch {}

      fileDescriptor = null;
    }

    if (
      createdByThisCall &&
      fs.existsSync(file)
    ) {
      try {
        fs.unlinkSync(file);
      } catch {}
    }

    throw error;
  } finally {
    if (
      fileDescriptor !== null
    ) {
      try {
        fs.closeSync(
          fileDescriptor,
        );
      } catch {}
    }
  }
}

function loadJson(file, label) {
  requireFile(
    file,
    label,
  );

  try {
    return JSON.parse(
      fs.readFileSync(
        file,
        "utf8",
      ),
    );
  } catch (error) {
    fail(
      String(label) +
        " is invalid JSON: " +
        errorText(error),
    );
  }
}

function stableSerialize(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return "[" + value.map(stableSerialize).join(",") + "]";
  }

  return "{" + Object.keys(value)
    .sort()
    .map((key) => JSON.stringify(key) + ":" + stableSerialize(value[key]))
    .join(",") + "}";
}

function generateSourceContentHash(sourceData) {
  const payload = {
    title: sourceData.title ?? "",
    slug: sourceData.slug ?? "",
    category: sourceData.category ?? "",
    categorySlug: sourceData.categorySlug ?? "",
    description: sourceData.description ?? "",
    directAnswer: sourceData.directAnswer ?? "",
    keyTakeaways: sourceData.keyTakeaways ?? [],
    content: sourceData.content ?? [],
    faq: sourceData.faq ?? [],
    seoKeywords: sourceData.seoKeywords ?? [],
    relatedSlugs: sourceData.relatedSlugs ?? [],
  };

  return crypto
    .createHash("sha256")
    .update(stableSerialize(payload), "utf8")
    .digest("hex");
}

function toArticleSource(source) {
  // Keep the complete KnowledgeArticle intact. The expert compiler owns
  // structural extraction; Factory must never flatten or discard items.
  return source;
}

function loadEvidenceSnapshot(slug) {
  const file = path.join(FACTORY_ROOT, "evidence", `${String(slug)}.json`);
  if (!fs.existsSync(file)) return undefined;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : undefined;
  } catch (error) {
    console.warn(`[NEXMOLD][V7.14][EVIDENCE] Ignored invalid snapshot for ${slug}: ${errorText(error)}`);
    return undefined;
  }
}

function buildCompilerInput(
  targetSlug,
  source,
) {
  const evidenceId =
    "knowledge:" +
    String(source.slug);

  const claimId =
    "claim:v714:whitepaper:" +
    String(targetSlug);

  const canonicalUrl =
    CANONICAL_ORIGIN +
    ROUTE_PREFIX +
    String(targetSlug) +
    "/";

  return {
    compileInput: {
      pageId:
        "v714:whitepaper:" +
        String(targetSlug),

      locale:
        "en-US",

      region:
        "US",

      applicability:
        "APPLICABLE",

      compliance:
        "VERIFIED",

      semantic: {
        pageId:
          "v714:whitepaper:" +
          String(targetSlug),

        locale:
          "en-US",

        region:
          "US",

        semanticClaimIds: [
          claimId,
        ],
      },

      evidence: {
        evidence: [
          {
            id:
              evidenceId,

            sourceType:
              "knowledge-base",

            sourceLocator:
              "src/data/knowledge.ts#" +
              String(source.slug),

            contentHash:
              generateSourceContentHash(source),
          },
        ],

        semanticClaims: [
          {
            id:
              claimId,

            claimKey:
              "v714.whitepaper." +
              String(targetSlug),
          },
        ],

        completeness:
          "COMPLETE",
      },
    },

    bindings: [
      {
        claim: {
          id:
            claimId,

          claimKey:
            "v714.whitepaper." +
            String(targetSlug),
        },

        evidenceIds: [
          evidenceId,
        ],
      },
    ],

    canonicalUrl,

    hreflangSet: [
      "en-US",
    ],

    canonicalByLocale:
      new Map([
        [
          "en-US",
          canonicalUrl,
        ],
      ]),
  };
}

function assertArtifact(
  artifact,
  targetSlug,
) {
  if (
    !artifact ||
    typeof artifact !== "object"
  ) {
    throw new Error(
      "V714_REGIONAL_ARTIFACT_MISSING",
    );
  }

  if (
    !artifact.pageContentHash
  ) {
    throw new Error(
      "V714_ARTIFACT_HASH_MISSING",
    );
  }

  if (
    !artifact.canonicalUrl
  ) {
    throw new Error(
      "V714_ARTIFACT_CANONICAL_URL_MISSING",
    );
  }

  const expectedRoute =
    ROUTE_PREFIX +
    String(targetSlug) +
    "/";

  const expectedCanonicalUrl =
    CANONICAL_ORIGIN +
    expectedRoute;

  if (
    artifact.canonicalUrl !==
    expectedCanonicalUrl
  ) {
    throw new Error(
      "V714_ARTIFACT_CANONICAL_URL_MISMATCH",
    );
  }

  if (
    !artifact.canonicalUrl.endsWith(
      expectedRoute,
    )
  ) {
    throw new Error(
      "V714_ARTIFACT_ROUTE_MISMATCH",
    );
  }
}

/**
 * Publication Authorization Gate.
 *
 * This is intentionally independent from the artifact existence check.
 *
 * Required:
 *   1. compileResult.published === true
 *   2. result exists
 *   3. eligibility exists
 *   4. publicationAuthorization exists
 *   5. firewall exists
 *   6. eligibility explicitly approves
 *   7. firewall explicitly approves
 */
function assertPublicationAuthorization(
  compileResult,
) {
  if (
    !compileResult ||
    typeof compileResult !== "object"
  ) {
    throw new Error(
      "V714_PUBLICATION_RESULT_MISSING",
    );
  }

  if (
    compileResult.published !== true
  ) {
    throw new Error(
      "V714_PUBLICATION_NOT_MARKED_PUBLISHED",
    );
  }

  if (
    !compileResult.result ||
    typeof compileResult.result !== "object"
  ) {
    throw new Error(
      "V714_PUBLICATION_RESULT_PAYLOAD_MISSING",
    );
  }

  const eligibility =
    compileResult.result.eligibility;

  if (
    !eligibility ||
    typeof eligibility !== "object"
  ) {
    throw new Error(
      "V714_PUBLICATION_ELIGIBILITY_MISSING",
    );
  }

  const publicationAuthorization =
    compileResult.result
      .publicationAuthorization;

  if (
    !publicationAuthorization ||
    typeof publicationAuthorization !==
      "object"
  ) {
    throw new Error(
      "V714_PUBLICATION_AUTHORIZATION_MISSING",
    );
  }

  const firewall =
    publicationAuthorization.firewall;

  if (
    !firewall ||
    typeof firewall !== "object"
  ) {
    throw new Error(
      "V714_PUBLICATION_FIREWALL_MISSING",
    );
  }

  const eligibilityApproved =
    eligibility.approved === true ||
    eligibility.eligible === true ||
    eligibility.status === "ELIGIBLE" ||
    eligibility.status === "APPROVED";

  if (
    !eligibilityApproved
  ) {
    throw new Error(
      "V714_PUBLICATION_ELIGIBILITY_NOT_APPROVED",
    );
  }

  const firewallApproved =
    firewall.ok === true ||
    firewall.approved === true ||
    firewall.allowed === true ||
    firewall.authorized === true ||
    firewall.status === "APPROVED" ||
    firewall.status === "ALLOWED";

  if (
    !firewallApproved
  ) {
    throw new Error(
      "V714_PUBLICATION_FIREWALL_NOT_APPROVED",
    );
  }

  return {
    eligibility,
    firewall,
  };
}

function assertArticle(
  article,
  targetSlug,
) {
  if (
    !article ||
    typeof article !== "object"
  ) {
    throw new Error(
      "V714_ARTICLE_CONTRACT_MISSING",
    );
  }

  if (
    article.slug !== targetSlug
  ) {
    throw new Error(
      "V714_TARGET_SLUG_MISMATCH",
    );
  }

  if (
    !article.articleId
  ) {
    throw new Error(
      "V714_ARTICLE_ID_MISSING",
    );
  }

  if (
    !article.lineage ||
    typeof article.lineage !== "object"
  ) {
    throw new Error(
      "V714_ARTICLE_LINEAGE_MISSING",
    );
  }

  if (
    !Array.isArray(
      article.lineage.evidenceIds,
    )
  ) {
    throw new Error(
      "V714_ARTICLE_LINEAGE_EVIDENCE_IDS_MISSING",
    );
  }

  if (
    !Array.isArray(
      article.lineage.semanticClaimIds,
    )
  ) {
    throw new Error(
      "V714_ARTICLE_LINEAGE_SEMANTIC_CLAIMS_MISSING",
    );
  }
}

function assertMarkdown(
  markdown,
  article,
  artifact,
) {
  if (
    typeof markdown !== "string" ||
    markdown.trim().length === 0
  ) {
    throw new Error(
      "V714_RENDERED_MARKDOWN_EMPTY",
    );
  }

  const required = [
    'slug: "' +
      String(article.slug) +
      '"',

    'canonicalUrl: "' +
      String(
        artifact.canonicalUrl,
      ) +
      '"',

    'sourceArtifactHash: "' +
      String(
        artifact.pageContentHash,
      ) +
      '"',
  ];

  const missing =
    required.filter(
      (token) =>
        !markdown.includes(token),
    );

  if (
    missing.length > 0
  ) {
    throw new Error(
      "V714_RENDERED_ARTIFACT_IDENTITY_MISMATCH: missing " +
        missing.join(", "),
    );
  }
}

function existingOutputState(
  outputFile,
  metadataFile,
  targetSlug,
  artifact,
) {
  assertFactoryOutputPath(
    outputFile,
  );

  assertFactoryOutputPath(
    metadataFile,
  );

  const markdownExists =
    fs.existsSync(
      outputFile,
    );

  const metadataExists =
    fs.existsSync(
      metadataFile,
    );

  if (
    !markdownExists &&
    !metadataExists
  ) {
    return {
      state: "NONE",
    };
  }

  if (
    !markdownExists ||
    !metadataExists
  ) {
    return {
      state: "BLOCKED",
      reason:
        "V714_EXISTING_OUTPUT_PAIR_INCOMPLETE",
    };
  }

  let metadata;

  try {
    metadata =
      JSON.parse(
        fs.readFileSync(
          metadataFile,
          "utf8",
        ),
      );
  } catch (error) {
    return {
      state: "BLOCKED",
      reason:
        "V714_EXISTING_METADATA_INVALID: " +
        errorText(error),
    };
  }

  const expectedRoute =
    ROUTE_PREFIX +
    String(targetSlug) +
    "/";

  if (
    metadata.targetSlug !==
      targetSlug ||
    metadata.route !==
      expectedRoute ||
    metadata.sourceArtifactHash !==
      artifact.pageContentHash
  ) {
    return {
      state: "BLOCKED",
      reason:
        "V714_EXISTING_OUTPUT_ARTIFACT_MISMATCH",
    };
  }

  const authorization =
    metadata.publicationAuthorization;

  if (
    !authorization ||
    typeof authorization !==
      "object"
  ) {
    return {
      state: "BLOCKED",
      reason:
        "V714_EXISTING_RUNTIME_AUTHORIZATION_MISSING",
    };
  }

  const eligibility =
    authorization.eligibility;

  const firewall =
    authorization.firewall;

  if (
    !eligibility ||
    typeof eligibility !== "object"
  ) {
    return {
      state: "BLOCKED",
      reason:
        "V714_EXISTING_ELIGIBILITY_MISSING",
    };
  }

  if (
    !firewall ||
    typeof firewall !== "object"
  ) {
    return {
      state: "BLOCKED",
      reason:
        "V714_EXISTING_FIREWALL_MISSING",
    };
  }

  const eligibilityApproved =
    eligibility.approved === true ||
    eligibility.eligible === true ||
    eligibility.status === "ELIGIBLE" ||
    eligibility.status === "APPROVED";

  if (
    !eligibilityApproved
  ) {
    return {
      state: "BLOCKED",
      reason:
        "V714_EXISTING_ELIGIBILITY_NOT_APPROVED",
    };
  }

  const firewallApproved =
    firewall.ok === true ||
    firewall.approved === true ||
    firewall.allowed === true ||
    firewall.authorized === true ||
    firewall.status === "APPROVED" ||
    firewall.status === "ALLOWED";

  if (
    !firewallApproved
  ) {
    return {
      state: "BLOCKED",
      reason:
        "V714_EXISTING_FIREWALL_NOT_APPROVED",
    };
  }

  const markdown =
    fs.readFileSync(
      outputFile,
      "utf8",
    );

  const requiredMarkdownIdentity = [
    'slug: "' +
      String(targetSlug) +
      '"',

    'canonicalUrl: "' +
      String(
        artifact.canonicalUrl,
      ) +
      '"',

    'sourceArtifactHash: "' +
      String(
        artifact.pageContentHash,
      ) +
      '"',
  ];

  const missingMarkdownIdentity =
    requiredMarkdownIdentity.filter(
      (token) =>
        !markdown.includes(token),
    );

  if (
    missingMarkdownIdentity.length > 0
  ) {
    return {
      state: "BLOCKED",
      reason:
        "V714_EXISTING_OUTPUT_MARKDOWN_IDENTITY_MISMATCH: missing " +
        missingMarkdownIdentity.join(", "),
    };
  }

  if (
    metadata.articleContract?.lineage
      ?.sourceArtifactHash !==
      artifact.pageContentHash ||
    metadata.articleContract?.lineage
      ?.canonicalUrl !==
      artifact.canonicalUrl ||
    metadata.articleContract?.slug !==
      targetSlug
  ) {
    return {
      state: "BLOCKED",
      reason:
        "V714_EXISTING_ARTICLE_CONTRACT_IDENTITY_MISMATCH",
    };
  }

  return {
    state: "VALID",
  };
}

const manifest =
  loadJson(
    MANIFEST_FILE,
    "Batch-01 manifest",
  );

const sourceResolution =
  loadJson(
    SOURCE_RESOLUTION_FILE,
    "Batch-01 source resolution",
  );

if (
  manifest.schema !==
  "nexmold.v7.14.long-tail-keyword-manifest.v1"
) {
  fail(
    "Invalid V7.14 manifest schema.",
  );
}

if (
  !Array.isArray(
    manifest.candidates,
  )
) {
  fail(
    "manifest.candidates must be an array.",
  );
}

if (
  sourceResolution.schema !==
  "nexmold.v7.14.batch-01-source-resolution.v1"
) {
  fail(
    "Invalid V7.14 source-resolution schema.",
  );
}

if (
  !Array.isArray(
    sourceResolution.results,
  )
) {
  fail(
    "sourceResolution.results must be an array.",
  );
}

const resolutionById =
  new Map();

for (
  const item
  of sourceResolution.results
) {
  const id =
    String(
      item.id ?? "",
    );

  if (!id) {
    fail(
      "Source resolution contains an empty candidate ID.",
    );
  }

  if (
    resolutionById.has(id)
  ) {
    fail(
      "Duplicate source resolution ID: " +
        id,
    );
  }

  resolutionById.set(
    id,
    item,
  );
}

for (
  const candidate
  of manifest.candidates
) {
  const id =
    String(
      candidate.id ?? "",
    );

  if (
    !resolutionById.has(id)
  ) {
    fail(
      "Missing source resolution for candidate " +
        id,
    );
  }
}

const report = {
  schema:
    "nexmold.v7.14.white-paper-factory-report.v5",

  batch:
    manifest.batch,

  factoryRun:
    BATCH,

  generatedAt:
    new Date().toISOString(),

  policy: {
    producerVersion:
      PRODUCER_VERSION,

    modifyExistingContent:
      false,

    overwriteExistingOutput:
      false,

    historicalBatch01Modified:
      false,

    publishAutomatically:
      false,

    routePrefix:
      ROUTE_PREFIX,

    compilerRequired:
      true,

    producerRequired:
      true,

    rendererRequired:
      true,

    sourceContentCopy:
      false,

    exclusiveOutputCreation:
      true,

    targetSlugPathValidation:
      true,

    publicationAuthorizationGate:
      true,

    automaticPublication:
      false,
  },

  summary: {
    candidates:
      manifest.candidates.length,

    sourceResolved:
      0,

    sourceMissing:
      0,

    blockedByCollision:
      0,

    topicUnsupported:
      0,

    producerBlocked:
      0,

    publishedArtifacts:
      0,

    whitePapersProduced:
      0,

    whitePapersAvailable:
      0,

    whitePapersReused:
      0,

    markdownRendered:
      0,

    existingOutputsValid:
      0,

    productionFailures:
      0,
  },

  results: [],
};

for (
  const candidate
  of manifest.candidates
) {
  const id =
    String(
      candidate.id ?? "",
    );

  const targetSlug =
    String(
      candidate.slug ?? "",
    );

  const result = {
    id,

    keyword:
      candidate.keyword,

    slug:
      targetSlug,

    targetSlug,

    sourceArticleSlug:
      null,

    producerVersion:
      PRODUCER_VERSION,

    route:
      ROUTE_PREFIX +
      targetSlug +
      "/",

    status:
      "PENDING",
  };

  try {
    assertSafeTargetSlug(
      targetSlug,
    );
  } catch (error) {
    result.status =
      "TARGET_SLUG_SECURITY_BLOCKED";

    result.reasonCodes = [
      errorText(error),
    ];

    report.summary.producerBlocked +=
      1;

    report.results.push(
      result,
    );

    continue;
  }

  if (
    String(candidate.status) !==
    "CANDIDATE"
  ) {
    result.status =
      "BLOCKED_BY_MANIFEST";

    result.reasonCodes = [
      "BATCH01_" +
        String(candidate.status),
    ];

    report.summary.blockedByCollision +=
      1;

    report.results.push(
      result,
    );

    continue;
  }

  const resolution =
    resolutionById.get(id);

  if (
    !resolution ||
    resolution.resolutionStatus !==
      "RESOLVED_EXISTING_KNOWLEDGE_ARTICLE"
  ) {
    result.status =
      "SOURCE_RESOLUTION_BLOCKED";

    result.reasonCodes =
      Array.isArray(
        resolution?.reasonCodes,
      )
        ? [
            ...resolution.reasonCodes,
          ]
        : [
            "V714_SOURCE_RESOLUTION_BLOCKED",
          ];

    if (
      resolution?.resolutionStatus ===
      "BLOCKED_SEMANTIC_COLLISION"
    ) {
      report.summary.blockedByCollision +=
        1;
    } else {
      report.summary.sourceMissing +=
        1;
    }

    report.results.push(
      result,
    );

    continue;
  }

  const sourceArticleSlug =
    String(
      resolution.sourceArticleSlug ?? "",
    );

  result.sourceArticleSlug =
    sourceArticleSlug;

  if (
    !sourceArticleSlug
  ) {
    result.status =
      "SOURCE_ARTICLE_MISSING";

    result.reasonCodes = [
      "V714_SOURCE_ARTICLE_SLUG_MISSING",
    ];

    report.summary.sourceMissing +=
      1;

    report.results.push(
      result,
    );

    continue;
  }

  const source =
    getArticleBySlug(
      sourceArticleSlug,
    );

  if (!source) {
    result.status =
      "SOURCE_ARTICLE_MISSING";

    result.reasonCodes = [
      "V714_SOURCE_ARTICLE_MISSING",
    ];

    report.summary.sourceMissing +=
      1;

    report.results.push(
      result,
    );

    continue;
  }

  report.summary.sourceResolved +=
    1;

  let compileResult;

  try {
    compileResult =
      compileRegionalPage(
        buildCompilerInput(
          targetSlug,
          source,
        ),
      );
  } catch (error) {
    result.status =
      "REGIONAL_COMPILER_EXCEPTION";

    result.reasonCodes = [
      errorText(error),
    ];

    report.summary.producerBlocked +=
      1;

    report.results.push(
      result,
    );

    continue;
  }

  let publicationAuthorization;

  try {
    publicationAuthorization =
      assertPublicationAuthorization(
        compileResult,
      );
  } catch (error) {
    result.status =
      "PUBLICATION_AUTHORIZATION_BLOCKED";

    result.reasonCodes = [
      errorText(error),
    ];

    report.summary.producerBlocked +=
      1;

    report.results.push(
      result,
    );

    continue;
  }

  if (
    !compileResult.result?.artifact
  ) {
    result.status =
      "V714_PUBLICATION_BLOCKED";

    result.reasonCodes = [
      "V714_REGIONAL_ARTIFACT_MISSING",
    ];

    report.summary.producerBlocked +=
      1;

    report.results.push(
      result,
    );

    continue;
  }

  const artifact =
    compileResult.result.artifact;

  try {
    assertArtifact(
      artifact,
      targetSlug,
    );
  } catch (error) {
    result.status =
      "REGIONAL_ARTIFACT_INVALID";

    result.reasonCodes = [
      errorText(error),
    ];

    report.summary.producerBlocked +=
      1;

    report.results.push(
      result,
    );

    continue;
  }

  report.summary.publishedArtifacts +=
    1;

  let article;

  try {
    const evidenceSnapshot = loadEvidenceSnapshot(source.slug);

    article =
      produceV714Article(
        artifact,
        toArticleSource(source),
        targetSlug,
        evidenceSnapshot,
      );

    assertArticle(
      article,
      targetSlug,
    );

    const expertContract = compileExpertArticleContract(
      source,
      artifact,
      targetSlug,
      loadEvidenceSnapshot(source.slug),
    );
    const expertQuality = evaluateExpertQuality(expertContract, 1);
    result.expertQuality = expertQuality;
  } catch (error) {
    result.status =
      "ARTICLE_PRODUCTION_FAILED";

    result.reasonCodes = [
      errorText(error),
    ];

    report.summary.producerBlocked +=
      1;

    report.results.push(
      result,
    );

    continue;
  }

  let markdown;

  try {
    markdown =
      renderV714ArticleMarkdown(
        article,
      );

    assertMarkdown(
      markdown,
      article,
      artifact,
    );
  } catch (error) {
    result.status =
      "MARKDOWN_RENDER_FAILED";

    result.reasonCodes = [
      errorText(error),
    ];

    report.summary.producerBlocked +=
      1;

    report.results.push(
      result,
    );

    continue;
  }

  report.summary.markdownRendered +=
    1;

  const outputFile =
    path.join(
      FACTORY_DIR,
      targetSlug + ".md",
    );

  const metadataFile =
    path.join(
      FACTORY_DIR,
      targetSlug + ".json",
    );

  try {
    assertFactoryOutputPath(
      outputFile,
    );

    assertFactoryOutputPath(
      metadataFile,
    );
  } catch (error) {
    result.status =
      "OUTPUT_PATH_SECURITY_BLOCKED";

    result.reasonCodes = [
      errorText(error),
    ];

    report.summary.producerBlocked +=
      1;

    report.results.push(
      result,
    );

    continue;
  }

  const existing =
    existingOutputState(
      outputFile,
      metadataFile,
      targetSlug,
      artifact,
    );

  if (
    existing.state ===
    "VALID"
  ) {
    result.status =
      "EXISTING_OUTPUT_VALID";

    result.output =
      path.relative(
        ROOT,
        outputFile,
      );

    result.metadata =
      path.relative(
        ROOT,
        metadataFile,
      );

    result.pageContentHash =
      artifact.pageContentHash;

    result.canonicalUrl =
      artifact.canonicalUrl;

    result.articleId =
      article.articleId;

    result.evidenceIds =
      Array.isArray(
        article.lineage?.evidenceIds,
      )
        ? [
            ...article.lineage.evidenceIds,
          ]
        : [];

    result.semanticClaimIds =
      Array.isArray(
        article.lineage?.semanticClaimIds,
      )
        ? [
            ...article.lineage.semanticClaimIds,
          ]
        : [];

    report.summary.existingOutputsValid +=
      1;

    report.summary.whitePapersReused +=
      1;

    report.summary.whitePapersAvailable +=
      1;

    report.results.push(
      result,
    );

    continue;
  }

  if (
    existing.state ===
    "BLOCKED"
  ) {
    result.status =
      "OUTPUT_INTEGRITY_BLOCKED";

    result.reasonCodes = [
      existing.reason,
    ];

    report.summary.producerBlocked +=
      1;

    report.results.push(
      result,
    );

    continue;
  }

  const metadata =
    JSON.stringify(
      {
        schema:
          "nexmold.v7.14.article-contract.v2",

        producerVersion:
          PRODUCER_VERSION,

        factoryRun:
          BATCH,

        articleId:
          article.articleId,

        targetSlug:
          article.slug,

        route:
          ROUTE_PREFIX +
          article.slug +
          "/",

        sourceArticleSlug,

        sourceArticle: {
          slug:
            source.slug,

          title:
            source.title,
        },

        sourceArtifactHash:
          artifact.pageContentHash,

        canonicalUrl:
          artifact.canonicalUrl,

        expertQuality,

        expertContractSummary: {
          schema: expertContract.schema,
          sources: expertContract.sources.length,
          evidence: expertContract.evidence.length,
          facts: expertContract.facts.length,
          claims: expertContract.claims.length,
          mechanisms: expertContract.mechanisms.length,
          decisions: expertContract.decisions.length,
          validations: expertContract.validations.length,
          quality: expertContract.quality,
        },

        publicationAuthorization: {
          eligibility:
            publicationAuthorization.eligibility,

          firewall:
            publicationAuthorization.firewall,
        },

        artifact,

        articleContract:
          article,

        production: {
          whitePaper:
            true,

          publishedArtifact:
            true,

          automaticPublication:
            false,

          existingSiteContentModified:
            false,

          historicalBatch01Modified:
            false,

          publicDirectoryModified:
            false,

          overwriteExistingOutput:
            false,

          exclusiveOutputCreation:
            true,
        },
      },
      null,
      2,
    );

  let metadataCreated =
    false;

  let markdownCreated =
    false;

  try {
    writeNew(
      metadataFile,
      metadata,
    );

    metadataCreated =
      true;

    writeNew(
      outputFile,
      markdown,
    );

    markdownCreated =
      true;
  } catch (error) {
    if (
      markdownCreated &&
      fs.existsSync(
        outputFile,
      )
    ) {
      try {
        fs.unlinkSync(
          outputFile,
        );
      } catch {}
    }

    if (
      metadataCreated &&
      fs.existsSync(
        metadataFile,
      )
    ) {
      try {
        fs.unlinkSync(
          metadataFile,
        );
      } catch {}
    }

    result.status =
      "OUTPUT_WRITE_FAILED";

    result.reasonCodes = [
      errorText(error),
    ];

    report.summary.productionFailures +=
      1;

    report.results.push(
      result,
    );

    continue;
  }

  report.summary.whitePapersProduced +=
    1;

  report.summary.whitePapersAvailable +=
    1;

  result.status =
    "PRODUCED";

  result.output =
    path.relative(
      ROOT,
      outputFile,
    );

  result.metadata =
    path.relative(
      ROOT,
      metadataFile,
    );

  result.pageContentHash =
    artifact.pageContentHash;

  result.canonicalUrl =
    artifact.canonicalUrl;

  result.articleId =
    article.articleId;

  result.evidenceIds =
    Array.isArray(
      article.lineage?.evidenceIds,
    )
      ? [
          ...article.lineage.evidenceIds,
        ]
      : [];

  result.semanticClaimIds =
    Array.isArray(
      article.lineage?.semanticClaimIds,
    )
      ? [
          ...article.lineage.semanticClaimIds,
        ]
      : [];

  report.results.push(
    result,
  );
}

report.summary.productionFailures =
  report.results.filter(
    (item) =>
      ![
        "PRODUCED",
        "EXISTING_OUTPUT_VALID",
        "BLOCKED_BY_MANIFEST",
      ].includes(
        String(
          item.status,
        ),
      ),
  ).length;

try {
  writeAtomic(
    REPORT_FILE,
    JSON.stringify(
      report,
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    "[NEXMOLD][V7.14][FATAL] Unable to write production report: " +
      errorText(error),
  );

  process.exit(1);
}

console.log("");

console.log(
  "=======================================================",
);

console.log(
  "[NEXMOLD][V7.14] WHITE PAPER PRODUCER v6",
);

console.log(
  "=======================================================",
);

console.log(
  "Candidates               : " +
    String(report.summary.candidates),
);

console.log(
  "Source resolved          : " +
    String(report.summary.sourceResolved),
);

console.log(
  "Source missing           : " +
    String(report.summary.sourceMissing),
);

console.log(
  "Collision blocked        : " +
    String(report.summary.blockedByCollision),
);

console.log(
  "Topic unsupported        : " +
    String(report.summary.topicUnsupported),
);

console.log(
  "Producer blocked         : " +
    String(report.summary.producerBlocked),
);

console.log(
  "Regional artifacts       : " +
    String(report.summary.publishedArtifacts),
);

console.log(
  "White papers produced    : " +
    String(report.summary.whitePapersProduced),
);

console.log(
  "White papers available   : " +
    String(report.summary.whitePapersAvailable),
);

console.log(
  "White papers reused      : " +
    String(report.summary.whitePapersReused),
);

console.log(
  "Markdown rendered        : " +
    String(report.summary.markdownRendered),
);

console.log(
  "Existing outputs valid   : " +
    String(report.summary.existingOutputsValid),
);

console.log(
  "Production failures      : " +
    String(report.summary.productionFailures),
);

console.log(
  "-------------------------------------------------------",
);

console.log(
  "Output directory         : " +
    FACTORY_DIR,
);

console.log(
  "Public route             : /industries/v714/<slug>/",
);

console.log(
  "Source article content   : NOT COPIED",
);

console.log(
  "Existing site content    : NOT MODIFIED",
);

console.log(
  "Historical batch-01      : NOT MODIFIED",
);

console.log(
  "Existing output          : NOT OVERWRITTEN",
);

console.log(
  "Exclusive file creation : ENABLED",
);

console.log(
  "Slug path validation     : ENABLED",
);

console.log(
  "Publication Authorization: REQUIRED",
);

console.log(
  "Automatic publication    : DISABLED",
);

console.log(
  "=======================================================",
);

console.log("");

if (
  report.summary.productionFailures >
  0
) {
  console.error(
    "[NEXMOLD][V7.14][FAIL-CLOSED] Production wiring failed. Build blocked.",
  );

  process.exitCode = 1;
}