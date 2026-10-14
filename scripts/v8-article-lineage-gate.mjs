
import fs from "node:fs";
import path from "node:path";

const ARTICLE_SLUG =
  "plastic-injection-molding-wall-thickness";

const ARTICLE_ROOT = path.resolve(
  ".nexmold",
  "v8",
  "articles",
  ARTICLE_SLUG,
);

const MANIFEST_PATH = path.join(
  ARTICLE_ROOT,
  "manifest.json",
);

const ARTICLE_PATH = path.join(
  ARTICLE_ROOT,
  "article.md",
);

const ID_FIELDS = Object.freeze([
  "knowledgeIds",
  "claimIds",
  "evidenceIds",
]);

const FOUNDATION_FIELDS = Object.freeze({
  knowledgeIds: "knowledgeIds",
  claimIds: "claimIds",
  evidenceIds: "verifiedEvidenceIds",
});

export class ArticleLineageGateError extends Error {
  constructor(code, message) {
    super(`[${code}] ${message}`);
    this.name = "ArticleLineageGateError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new ArticleLineageGateError(code, message);
}

function requireObject(value, label) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    fail(
      "INVALID_OBJECT",
      `${label} must be a non-null object.`,
    );
  }

  return value;
}

function requireNonEmptyString(value, label) {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value !== value.trim()
  ) {
    fail(
      "INVALID_STRING",
      `${label} must be a non-empty, trimmed string.`,
    );
  }

  return value;
}

function requireUniqueIdArray(value, label) {
  if (!Array.isArray(value)) {
    fail(
      "INVALID_ID_ARRAY",
      `${label} must be an array.`,
    );
  }

  const seen = new Set();

  for (let index = 0; index < value.length; index += 1) {
    const id = requireNonEmptyString(
      value[index],
      `${label}[${index}]`,
    );

    if (seen.has(id)) {
      fail(
        "DUPLICATE_ID",
        `${label} contains duplicate ID "${id}".`,
      );
    }

    seen.add(id);
  }

  return seen;
}

function requireSubset(actual, allowed, label) {
  for (const id of actual) {
    if (!allowed.has(id)) {
      fail(
        "UNAUTHORIZED_LINEAGE_ID",
        `${label} references ID "${id}" outside its verified closure.`,
      );
    }
  }
}

function requireNonEmptySet(value, label) {
  const ids = requireUniqueIdArray(value, label);

  if (ids.size === 0) {
    fail(
      "EMPTY_VERIFIED_CLOSURE",
      `${label} must contain at least one verified ID.`,
    );
  }

  return ids;
}

/**
 * Validate the persisted source-to-Evidence ownership mapping.
 *
 * Every verified Evidence ID must appear exactly once in the
 * source mapping. An Evidence ID cannot be introduced by an
 * unrelated source or silently omitted from the manifest.
 */
function auditSourceEvidenceMapping(
  sources,
  verifiedEvidenceIds,
) {
  if (!Array.isArray(sources)) {
    fail(
      "MISSING_SOURCE_MAPPING",
      "acquisition.sources must be an array.",
    );
  }

  const mappedIds = [];
  const ownerByEvidenceId = new Map();

  for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex += 1) {
    const source = requireObject(
      sources[sourceIndex],
      `acquisition.sources[${sourceIndex}]`,
    );

    const sourceLabel =
      typeof source.url === "string" && source.url.trim()
        ? source.url
        : `source[${sourceIndex}]`;

    const evidenceIds = requireUniqueIdArray(
      source.evidenceIds,
      `${sourceLabel}.evidenceIds`,
    );

    for (const evidenceId of evidenceIds) {
      if (ownerByEvidenceId.has(evidenceId)) {
        fail(
          "DUPLICATE_EVIDENCE_OWNERSHIP",
          `Evidence "${evidenceId}" is mapped to more than one source.`,
        );
      }

      ownerByEvidenceId.set(evidenceId, sourceLabel);
      mappedIds.push(evidenceId);
    }
  }

  const expected = [...verifiedEvidenceIds].sort();
  const actual = [...mappedIds].sort();

  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(
      "SOURCE_EVIDENCE_CLOSURE_MISMATCH",
      [
        "Source-to-Evidence mapping does not exactly match",
        "the Runtime verified Evidence ID set.",
        `Expected=${JSON.stringify(expected)}`,
        `Actual=${JSON.stringify(actual)}`,
      ].join(" "),
    );
  }

  return {
    sourceCount: sources.length,
    mappedEvidenceCount: mappedIds.length,
  };
}

/**
 * Independent persisted-manifest lineage audit.
 *
 * This checks ID closure and structural provenance. It does not
 * claim to prove that a technical proposition is semantically
 * entailed by its source Evidence.
 */
export function auditArticleManifest(manifest) {
  requireObject(manifest, "manifest");

  const foundation = requireObject(
    manifest.foundation,
    "manifest.foundation",
  );

  const runtime = requireObject(
    manifest.runtime,
    "manifest.runtime",
  );

  const content = requireObject(
    runtime.content,
    "manifest.runtime.content",
  );

  const acquisition = requireObject(
    manifest.acquisition,
    "manifest.acquisition",
  );

  const verifiedSets = {};

  for (const field of ID_FIELDS) {
    const foundationField = FOUNDATION_FIELDS[field];

    verifiedSets[field] = requireNonEmptySet(
      foundation[foundationField],
      `foundation.${foundationField}`,
    );
  }

  const verifiedEvidenceIds = verifiedSets.evidenceIds;

  const sourceAudit = auditSourceEvidenceMapping(
    acquisition.sources,
    verifiedEvidenceIds,
  );

  const provenance = content.provenance;

  if (!Array.isArray(provenance) || provenance.length === 0) {
    fail(
      "MISSING_CONTENT_PROVENANCE",
      "runtime.content.provenance must be a non-empty array.",
    );
  }

  const seenOrdinals = new Set();

  for (let index = 0; index < provenance.length; index += 1) {
    const assertion = requireObject(
      provenance[index],
      `runtime.content.provenance[${index}]`,
    );

    if (
      !Number.isInteger(assertion.ordinal) ||
      assertion.ordinal < 0 ||
      assertion.ordinal !== index
    ) {
      fail(
        "INVALID_PROVENANCE_ORDINAL",
        `Provenance ordinal at index ${index} must equal ${index}.`,
      );
    }

    if (seenOrdinals.has(assertion.ordinal)) {
      fail(
        "DUPLICATE_PROVENANCE_ORDINAL",
        `Provenance ordinal ${assertion.ordinal} occurs more than once.`,
      );
    }

    seenOrdinals.add(assertion.ordinal);

    requireNonEmptyString(
      assertion.text,
      `provenance[${index}].text`,
    );

    requireNonEmptyString(
      assertion.fingerprint,
      `provenance[${index}].fingerprint`,
    );

    const kind = requireNonEmptyString(
      assertion.kind,
      `provenance[${index}].kind`,
    );

    const assertionSets = {};

    for (const field of ID_FIELDS) {
      assertionSets[field] = requireUniqueIdArray(
        assertion[field],
        `provenance[${index}].${field}`,
      );

      requireSubset(
        assertionSets[field],
        verifiedSets[field],
        `provenance[${index}].${field}`,
      );
    }

    if (kind === "KNOWLEDGE") {
      for (const field of ID_FIELDS) {
        if (assertionSets[field].size === 0) {
          fail(
            "INCOMPLETE_KNOWLEDGE_LINEAGE",
            `Knowledge assertion ${index} has no ${field}.`,
          );
        }
      }

      for (const evidenceId of assertionSets.evidenceIds) {
        if (!verifiedEvidenceIds.has(evidenceId)) {
          fail(
            "UNVERIFIED_ASSERTION_EVIDENCE",
            `Assertion ${index} references unverified Evidence "${evidenceId}".`,
          );
        }
      }

      continue;
    }

    if (
      kind === "QUESTION" ||
      kind === "CONSTRAINT" ||
      kind === "CONTEXT" ||
      kind === "DECISION"
    ) {
      for (const field of ID_FIELDS) {
        if (assertionSets[field].size !== 0) {
          fail(
            "STRUCTURAL_LINEAGE_CONTAMINATION",
            `${kind} assertion ${index} must not bind ${field}.`,
          );
        }
      }

      continue;
    }

    fail(
      "UNKNOWN_PROVENANCE_KIND",
      `Unsupported provenance kind "${kind}" at assertion ${index}.`,
    );
  }

  const bodyLength = content.bodyLength;

  if (
    !Number.isInteger(bodyLength) ||
    bodyLength <= 0
  ) {
    fail(
      "INVALID_CONTENT_BODY_LENGTH",
      "runtime.content.bodyLength must be a positive integer.",
    );
  }

  return Object.freeze({
    status: "PASS",
    assertionCount: provenance.length,
    verifiedKnowledgeCount: verifiedSets.knowledgeIds.size,
    verifiedClaimCount: verifiedSets.claimIds.size,
    verifiedEvidenceCount: verifiedEvidenceIds.size,
    ...sourceAudit,
  });
}

function main() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    fail(
      "MANIFEST_NOT_FOUND",
      `Article manifest not found: ${MANIFEST_PATH}`,
    );
  }

  if (!fs.existsSync(ARTICLE_PATH)) {
    fail(
      "ARTICLE_NOT_FOUND",
      `Article artifact not found: ${ARTICLE_PATH}`,
    );
  }

  const manifest = JSON.parse(
    fs.readFileSync(MANIFEST_PATH, "utf8"),
  );

  const result = auditArticleManifest(manifest);

  console.log("==============================================");
  console.log("NEXMOLD V8 ARTICLE LINEAGE GATE");
  console.log("==============================================");
  console.log(`Article: ${ARTICLE_PATH}`);
  console.log(`Manifest: ${MANIFEST_PATH}`);
  console.log(`Assertions audited: ${result.assertionCount}`);
  console.log(`Verified Knowledge IDs: ${result.verifiedKnowledgeCount}`);
  console.log(`Verified Claim IDs: ${result.verifiedClaimCount}`);
  console.log(`Verified Evidence IDs: ${result.verifiedEvidenceCount}`);
  console.log(`Source mappings: ${result.sourceCount}`);
  console.log(`Mapped Evidence IDs: ${result.mappedEvidenceCount}`);
  console.log("V8 ARTICLE LINEAGE GATE: PASS");
}

const invokedPath = process.argv[1]
  ? path.resolve(process.argv[1])
  : "";

if (invokedPath === path.resolve(
  process.cwd(),
  "scripts",
  "v8-article-lineage-gate.mjs",
)) {
  try {
    main();
  } catch (error) {
    console.error("");
    console.error("==============================================");
    console.error("NEXMOLD V8 ARTICLE LINEAGE GATE: FAIL");
    console.error("==============================================");
    console.error(
      error instanceof Error
        ? error.stack ?? error.message
        : String(error),
    );
    process.exitCode = 1;
  }
}
