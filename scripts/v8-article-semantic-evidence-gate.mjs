
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const ARTICLE_ROOT = path.resolve(
  ROOT,
  ".nexmold",
  "v8",
  "articles",
  "plastic-injection-molding-wall-thickness",
);
const ARTICLE_PATH = path.join(ARTICLE_ROOT, "article.md");
const MANIFEST_PATH = path.join(ARTICLE_ROOT, "manifest.json");

const MIN_TOKEN_COVERAGE = 0.55;

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been",
  "being", "by", "can", "could", "for", "from", "has",
  "have", "in", "into", "is", "it", "its", "may", "might",
  "of", "on", "or", "should", "that", "the", "their",
  "there", "these", "this", "those", "to", "was", "were",
  "what", "when", "which", "with", "would",
]);

export class SemanticEvidenceGateError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.name = "SemanticEvidenceGateError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new SemanticEvidenceGateError(code, message);
}

function requireCondition(condition, code, message) {
  if (!condition) {
    fail(code, message);
  }
}

function readJson(filePath, label) {
  requireCondition(
    fs.existsSync(filePath),
    "REQUIRED_ARTIFACT_MISSING",
    `${label} does not exist: ${filePath}`,
  );

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(
      "INVALID_JSON",
      `${label} cannot be parsed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9.%+-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value) {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function numericTokens(value) {
  return normalizeText(value).match(/\b\d+(?:\.\d+)?%?\b/g) ?? [];
}

function unique(values) {
  return [...new Set(values)];
}

function requireNonEmptyString(value, code, message) {
  requireCondition(
    typeof value === "string" && value.trim().length > 0,
    code,
    message,
  );
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function buildEvidenceIndex(manifest) {
  const sources = manifest?.acquisition?.sources;

  requireCondition(
    Array.isArray(sources) && sources.length > 0,
    "SOURCE_INVENTORY_MISSING",
    "Manifest acquisition.sources is missing or empty.",
  );

  const evidenceIndex = new Map();
  const sourceUrls = new Map();

  for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex += 1) {
    const source = sources[sourceIndex];
    const sourceUrl =
      source?.finalUrl ??
      source?.url ??
      source?.requestedUrl ??
      source?.candidateUrl;

    requireNonEmptyString(
      sourceUrl,
      "SOURCE_URL_MISSING",
      `Source ${sourceIndex} has no URL.`,
    );

    requireCondition(
      isHttpUrl(sourceUrl),
      "SOURCE_URL_INVALID",
      `Source ${sourceIndex} has an invalid HTTP(S) URL.`,
    );

    const records = source?.evidenceRecords;

    requireCondition(
      Array.isArray(records),
      "EVIDENCE_RECORDS_MISSING",
      `Source ${sourceIndex} has no evidenceRecords array. The producer must persist the original Evidence payload.`,
    );

    const mappedIds = source?.evidenceIds;

    requireCondition(
      Array.isArray(mappedIds),
      "SOURCE_EVIDENCE_IDS_MISSING",
      `Source ${sourceIndex} has no evidenceIds array.`,
    );

    const localRecordIds = new Set();

    for (const record of records) {
      requireNonEmptyString(
        record?.evidenceId,
        "EVIDENCE_ID_MISSING",
        `Source ${sourceIndex} contains a record without evidenceId.`,
      );

      requireNonEmptyString(
        record?.excerpt,
        "EVIDENCE_EXCERPT_MISSING",
        `Evidence ${record?.evidenceId ?? "(unknown)"} has no excerpt.`,
      );

      requireCondition(
        record.excerpt.trim().length >= 30,
        "EVIDENCE_EXCERPT_TOO_SHORT",
        `Evidence ${record.evidenceId} has fewer than 30 characters.`,
      );

      requireNonEmptyString(
        record?.locator,
        "EVIDENCE_LOCATOR_MISSING",
        `Evidence ${record.evidenceId} has no source locator.`,
      );

      requireCondition(
        !localRecordIds.has(record.evidenceId),
        "DUPLICATE_EVIDENCE_RECORD",
        `Source ${sourceIndex} repeats Evidence ${record.evidenceId}.`,
      );
      localRecordIds.add(record.evidenceId);

      requireCondition(
        mappedIds.includes(record.evidenceId),
        "EVIDENCE_RECORD_MAPPING_MISMATCH",
        `Evidence ${record.evidenceId} is not listed in its source evidenceIds.`,
      );

      requireCondition(
        !evidenceIndex.has(record.evidenceId),
        "DUPLICATE_EVIDENCE_OWNERSHIP",
        `Evidence ${record.evidenceId} is owned by more than one source.`,
      );

      const excerptFingerprint = sha256(record.excerpt);

      if (record.excerptFingerprint !== undefined) {
        requireCondition(
          record.excerptFingerprint === excerptFingerprint,
          "EVIDENCE_EXCERPT_FINGERPRINT_MISMATCH",
          `Evidence ${record.evidenceId} excerpt fingerprint does not match.`,
        );
      }

      evidenceIndex.set(record.evidenceId, {
        ...record,
        sourceUrl,
        excerptFingerprint,
      });

      sourceUrls.set(record.evidenceId, sourceUrl);
    }

    for (const evidenceId of mappedIds) {
      requireCondition(
        localRecordIds.has(evidenceId),
        "MAPPED_EVIDENCE_PAYLOAD_MISSING",
        `Source mapping references ${evidenceId}, but its evidenceRecords payload is absent.`,
      );
    }
  }

  return { evidenceIndex, sourceUrls };
}

function auditAssertion(assertion, evidenceIndex) {
  const ordinal = assertion?.ordinal;

  requireCondition(
    Number.isInteger(ordinal) && ordinal >= 0,
    "ASSERTION_ORDINAL_INVALID",
    "An assertion has an invalid ordinal.",
  );

  requireNonEmptyString(
    assertion?.text,
    "ASSERTION_TEXT_MISSING",
    `Assertion ${ordinal} has no text.`,
  );

  if (assertion.kind !== "KNOWLEDGE") {
    return {
      ordinal,
      kind: assertion.kind,
      status: "NOT_APPLICABLE",
      evidenceCount: 0,
      tokenCoverage: null,
    };
  }

  const ids = assertion.evidenceIds;

  requireCondition(
    Array.isArray(ids) && ids.length > 0,
    "KNOWLEDGE_ASSERTION_UNSUPPORTED",
    `Knowledge assertion ${ordinal} has no Evidence IDs.`,
  );

  requireCondition(
    unique(ids).length === ids.length,
    "ASSERTION_DUPLICATE_EVIDENCE",
    `Knowledge assertion ${ordinal} repeats an Evidence ID.`,
  );

  const assertionTokens = unique(tokens(assertion.text));

  requireCondition(
    assertionTokens.length > 0,
    "ASSERTION_NOT_AUDITABLE",
    `Knowledge assertion ${ordinal} has no auditable content tokens.`,
  );

  const assertionNumbers = unique(numericTokens(assertion.text));
  const allEvidenceTokens = new Set();
  const allEvidenceNumbers = new Set();
  const evidenceDetails = [];

  for (const evidenceId of ids) {
    const evidence = evidenceIndex.get(evidenceId);

    requireCondition(
      evidence !== undefined,
      "UNRESOLVED_EVIDENCE_ID",
      `Knowledge assertion ${ordinal} references unknown Evidence ${evidenceId}.`,
    );

    const excerptTokens = tokens(evidence.excerpt);
    const excerptNumbers = numericTokens(evidence.excerpt);

    for (const token of excerptTokens) {
      allEvidenceTokens.add(token);
    }

    for (const number of excerptNumbers) {
      allEvidenceNumbers.add(number);
    }

    evidenceDetails.push({
      evidenceId,
      sourceUrl: evidence.sourceUrl,
      excerptFingerprint: evidence.excerptFingerprint,
      locator: evidence.locator,
    });
  }

  const matchedTokens = assertionTokens.filter((token) =>
    allEvidenceTokens.has(token),
  );

  const tokenCoverage =
    matchedTokens.length / assertionTokens.length;

  const unsupportedNumbers = assertionNumbers.filter(
    (number) => !allEvidenceNumbers.has(number),
  );

  requireCondition(
    unsupportedNumbers.length === 0,
    "UNSUPPORTED_NUMERIC_ASSERTION",
    `Knowledge assertion ${ordinal} contains numeric values absent from its linked evidence: ${unsupportedNumbers.join(", ")}.`,
  );

  requireCondition(
    tokenCoverage >= MIN_TOKEN_COVERAGE,
    "INSUFFICIENT_LEXICAL_COVERAGE",
    `Knowledge assertion ${ordinal} lexical coverage ${(tokenCoverage * 100).toFixed(1)}% is below ${(MIN_TOKEN_COVERAGE * 100).toFixed(0)}%.`,
  );

  return {
    ordinal,
    kind: assertion.kind,
    status: "LEXICAL_SCREEN_PASS",
    evidenceCount: ids.length,
    tokenCount: assertionTokens.length,
    matchedTokenCount: matchedTokens.length,
    tokenCoverage,
    evidence: evidenceDetails,
  };
}

export function auditSemanticEvidenceCoverage({
  articleContent,
  manifest,
}) {
  requireNonEmptyString(
    articleContent,
    "ARTICLE_CONTENT_MISSING",
    "Article content is empty.",
  );

  requireCondition(
    manifest !== null && typeof manifest === "object",
    "MANIFEST_INVALID",
    "Manifest must be an object.",
  );

  const expectedFingerprint = manifest?.artifact?.contentFingerprint;

  requireNonEmptyString(
    expectedFingerprint,
    "ARTICLE_FINGERPRINT_MISSING",
    "Manifest has no artifact.contentFingerprint.",
  );

  requireCondition(
    sha256(articleContent) === expectedFingerprint,
    "ARTICLE_FINGERPRINT_MISMATCH",
    "Article content does not match the Manifest fingerprint.",
  );

  const provenance = manifest?.runtime?.content?.provenance;

  requireCondition(
    Array.isArray(provenance) && provenance.length > 0,
    "ASSERTION_PROVENANCE_MISSING",
    "Manifest runtime.content.provenance is missing or empty.",
  );

  const { evidenceIndex } = buildEvidenceIndex(manifest);

  const results = provenance.map((assertion) =>
    auditAssertion(assertion, evidenceIndex),
  );

  const knowledgeAssertions = results.filter(
    (result) => result.kind === "KNOWLEDGE",
  );

  requireCondition(
    knowledgeAssertions.length > 0,
    "NO_KNOWLEDGE_ASSERTIONS",
    "No Knowledge assertions were found to audit.",
  );

  const failedAssertions = knowledgeAssertions.filter(
    (result) => result.status !== "LEXICAL_SCREEN_PASS",
  );

  requireCondition(
    failedAssertions.length === 0,
    "KNOWLEDGE_ASSERTION_COVERAGE_FAILED",
    `${failedAssertions.length} Knowledge assertions failed coverage screening.`,
  );

  return {
    status: "PASS",
    validationLevel: "DETERMINISTIC_LEXICAL_SCREENING",
    semanticEntailmentProven: false,
    assertionCount: provenance.length,
    knowledgeAssertionCount: knowledgeAssertions.length,
    evidenceRecordCount: evidenceIndex.size,
    minimumTokenCoverage: MIN_TOKEN_COVERAGE,
    results,
  };
}

function main() {
  const articleContent = fs.readFileSync(
    ARTICLE_PATH,
    "utf8",
  );

  const manifest = readJson(MANIFEST_PATH, "Article Manifest");

  const result = auditSemanticEvidenceCoverage({
    articleContent,
    manifest,
  });

  console.log("NEXMOLD V8 ARTICLE SEMANTIC EVIDENCE COVERAGE GATE");
  console.log(`Status: ${result.status}`);
  console.log(`Validation level: ${result.validationLevel}`);
  console.log(`Semantic entailment proven: ${result.semanticEntailmentProven}`);
  console.log(`Assertions audited: ${result.assertionCount}`);
  console.log(`Knowledge assertions: ${result.knowledgeAssertionCount}`);
  console.log(`Evidence records: ${result.evidenceRecordCount}`);
  console.log(
    `Minimum lexical coverage: ${(result.minimumTokenCoverage * 100).toFixed(0)}%`,
  );

  for (const assertion of result.results) {
    if (assertion.kind !== "KNOWLEDGE") continue;

    console.log(
      [
        `Assertion ${assertion.ordinal}`,
        `status=${assertion.status}`,
        `evidence=${assertion.evidenceCount}`,
        `coverage=${(assertion.tokenCoverage * 100).toFixed(1)}%`,
      ].join(" "),
    );
  }

  console.log("V8 ARTICLE SEMANTIC EVIDENCE COVERAGE GATE: PASS");
}

const currentFile = fileURLToPath(import.meta.url);

if (path.resolve(process.argv[1] ?? "") === currentFile) {
  try {
    main();
  } catch (error) {
    console.error("V8 ARTICLE SEMANTIC EVIDENCE COVERAGE GATE: FAIL");
    console.error(
      error instanceof Error ? error.stack ?? error.message : String(error),
    );
    process.exitCode = 1;
  }
}
