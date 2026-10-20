
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);

const ARTICLE_DIRECTORY = path.resolve(
  ".nexmold/v8/articles/plastic-injection-molding-wall-thickness",
);

const ARTICLE_PATH = path.join(ARTICLE_DIRECTORY, "article.md");
const MANIFEST_PATH = path.join(ARTICLE_DIRECTORY, "manifest.json");

const MINIMUM_H2_HEADINGS = 3;
const MINIMUM_KNOWLEDGE_ASSERTIONS = 4;
const MAXIMUM_ASSERTION_CHARACTERS = 500;
const MAXIMUM_ASSERTION_WORDS = 80;

const INTERNAL_SCAFFOLD_LABELS = new Set([
  "Problem",
  "Decision",
  "Verified knowledge",
  "Context",
  "Constraints",
  "Purpose",
]);

function fail(code, detail) {
  throw new Error(
    `V8_ARTICLE_PUBLICATION_QUALITY_GATE_FAILED:${code}: ${detail}`,
  );
}

function isRecord(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function normalizeLine(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .trim();
}

function wordCount(value) {
  return value.trim().match(/\S+/g)?.length ?? 0;
}

function assertNonEmptyIdArray(value, code, label) {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some(
      (id) =>
        typeof id !== "string" ||
        id.trim().length === 0,
    )
  ) {
    fail(
      code,
      `${label} must be a non-empty array of non-empty string IDs.`,
    );
  }
}

function assertUniqueIds(ids, code, label) {
  if (new Set(ids).size !== ids.length) {
    fail(code, `${label} contains duplicate IDs.`);
  }
}

function extractHeadings(article) {
  return article
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^##\s+\S/.test(line))
    .map((line) =>
      line
        .replace(/^##\s+/, "")
        .replace(/\s+#+\s*$/, "")
        .trim(),
    );
}

function extractProseLines(article, description) {
  const normalizedDescription = normalizeLine(description);

  return article
    .split("\n")
    .map(normalizeLine)
    .filter((line) => {
      if (!line) {
        return false;
      }

      if (/^#{1,6}\s+/.test(line)) {
        return false;
      }

      if (/^---+$/.test(line)) {
        return false;
      }

      if (
        normalizedDescription &&
        line === normalizedDescription
      ) {
        return false;
      }

      return true;
    });
}

function assertManifestShape(manifest) {
  if (!isRecord(manifest)) {
    fail("MANIFEST_INVALID", "Manifest must be an object.");
  }

  if (
    manifest.schema !==
    "nexmold.v8.first-article-manifest.v3"
  ) {
    fail(
      "MANIFEST_SCHEMA_INVALID",
      "Unexpected or missing manifest schema.",
    );
  }

  if (
    !isRecord(manifest.article) ||
    typeof manifest.article.title !== "string" ||
    !manifest.article.title.trim() ||
    typeof manifest.article.description !== "string"
  ) {
    fail(
      "MANIFEST_ARTICLE_METADATA_INVALID",
      "Article title or description is missing or invalid.",
    );
  }

  if (
    !isRecord(manifest.foundation) ||
    !Array.isArray(manifest.foundation.verifiedEvidenceIds) ||
    !Array.isArray(manifest.foundation.claimIds) ||
    !Array.isArray(manifest.foundation.knowledgeIds)
  ) {
    fail(
      "FOUNDATION_CLOSURE_INVALID",
      "Foundation evidence, claim, or knowledge closure is missing.",
    );
  }

  assertNonEmptyIdArray(
    manifest.foundation.verifiedEvidenceIds,
    "FOUNDATION_EVIDENCE_IDS_INVALID",
    "Foundation verified Evidence IDs",
  );

  assertNonEmptyIdArray(
    manifest.foundation.claimIds,
    "FOUNDATION_CLAIM_IDS_INVALID",
    "Foundation Claim IDs",
  );

  assertNonEmptyIdArray(
    manifest.foundation.knowledgeIds,
    "FOUNDATION_KNOWLEDGE_IDS_INVALID",
    "Foundation Knowledge IDs",
  );

  assertUniqueIds(
    manifest.foundation.verifiedEvidenceIds,
    "DUPLICATE_VERIFIED_EVIDENCE_IDS",
    "Foundation evidence closure",
  );

  assertUniqueIds(
    manifest.foundation.claimIds,
    "DUPLICATE_CLAIM_IDS",
    "Foundation claim closure",
  );

  assertUniqueIds(
    manifest.foundation.knowledgeIds,
    "DUPLICATE_KNOWLEDGE_IDS",
    "Foundation knowledge closure",
  );

  if (
    !isRecord(manifest.runtime) ||
    !isRecord(manifest.runtime.content) ||
    !Array.isArray(manifest.runtime.content.provenance)
  ) {
    fail(
      "PROVENANCE_MISSING",
      "Runtime content provenance is missing.",
    );
  }

  if (
    !Number.isSafeInteger(manifest.runtime.assertionCount) ||
    manifest.runtime.assertionCount < 1
  ) {
    fail(
      "ASSERTION_COUNT_INVALID",
      "Runtime assertion count must be a positive safe integer.",
    );
  }

  if (
    !Number.isSafeInteger(manifest.runtime.content.bodyLength) ||
    manifest.runtime.content.bodyLength < 1
  ) {
    fail(
      "RUNTIME_BODY_LENGTH_INVALID",
      "Runtime body length must be a positive safe integer.",
    );
  }
}

export function validateArticlePublication({
  article,
  manifest,
}) {
  if (typeof article !== "string" || !article.trim()) {
    fail("ARTICLE_EMPTY", "Article body is empty.");
  }

  assertManifestShape(manifest);

  const articleLines = article
    .replace(/\r\n?/g, "\n")
    .split("\n");

  const titleLine = articleLines
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  const expectedTitle = `# ${manifest.article.title.trim()}`;

  if (titleLine !== expectedTitle) {
    fail(
      "TITLE_MISMATCH",
      "The first non-empty Markdown line must match the manifest title.",
    );
  }

  if (manifest.runtime.content.title !== manifest.article.title) {
    fail(
      "RUNTIME_TITLE_MISMATCH",
      "Runtime title and manifest title differ.",
    );
  }

  const headings = extractHeadings(article);

  if (headings.length < MINIMUM_H2_HEADINGS) {
    fail(
      "INSUFFICIENT_ARTICLE_STRUCTURE",
      `Expected at least ${MINIMUM_H2_HEADINGS} H2 sections; found ${headings.length}.`,
    );
  }

  const normalizedHeadings = headings.map((heading) =>
    heading.toLocaleLowerCase("en"),
  );

  if (
    new Set(normalizedHeadings).size !==
    normalizedHeadings.length
  ) {
    fail(
      "DUPLICATE_SECTION_HEADINGS",
      "Article contains duplicate H2 section headings.",
    );
  }

  const proseLines = extractProseLines(
    article,
    manifest.article.description,
  );

  if (proseLines.length < MINIMUM_KNOWLEDGE_ASSERTIONS) {
    fail(
      "INSUFFICIENT_PROSE_ASSERTIONS",
      `Expected at least ${MINIMUM_KNOWLEDGE_ASSERTIONS} auditable prose assertions; found ${proseLines.length}.`,
    );
  }

  for (const line of proseLines) {
    if (INTERNAL_SCAFFOLD_LABELS.has(line)) {
      fail(
        "INTERNAL_SCAFFOLD_LEAK",
        `Internal workflow label was emitted as article prose: "${line}".`,
      );
    }

    if (
      /^(?:Problem|Decision|Verified knowledge|Context|Constraints)\s*:/i.test(
        line,
      )
    ) {
      fail(
        "INTERNAL_FIELD_LEAK",
        `Internal workflow field was emitted as article prose: "${line}".`,
      );
    }

    if (/^https?:\/\//i.test(line)) {
      fail(
        "RAW_SOURCE_URL_IN_BODY",
        "Raw source URLs must be handled through article references, not emitted as standalone prose.",
      );
    }
  }

  const provenance = manifest.runtime.content.provenance;

  if (provenance.length !== manifest.runtime.assertionCount) {
    fail(
      "PROVENANCE_COUNT_MISMATCH",
      "Provenance count differs from the runtime assertion count.",
    );
  }

  const verifiedEvidenceIds = new Set(
    manifest.foundation.verifiedEvidenceIds,
  );

  const knownClaimIds = new Set(
    manifest.foundation.claimIds,
  );

  const knownKnowledgeIds = new Set(
    manifest.foundation.knowledgeIds,
  );

  const provenanceByText = new Map();

  for (
    let index = 0;
    index < provenance.length;
    index += 1
  ) {
    const record = provenance[index];

    if (!isRecord(record)) {
      fail(
        "PROVENANCE_RECORD_INVALID",
        `Provenance record ${index} is not an object.`,
      );
    }

    if (record.ordinal !== index) {
      fail(
        "PROVENANCE_ORDINAL_INVALID",
        `Provenance record ${index} has an invalid ordinal.`,
      );
    }

    if (record.kind !== "KNOWLEDGE") {
      fail(
        "NON_KNOWLEDGE_ASSERTION_IN_ARTICLE",
        `Assertion ${index} has kind "${record.kind}", not KNOWLEDGE.`,
      );
    }

    const text = normalizeLine(record.text);

    if (!text) {
      fail(
        "PROVENANCE_TEXT_EMPTY",
        `Provenance record ${index} has no text.`,
      );
    }

    if (text.length > MAXIMUM_ASSERTION_CHARACTERS) {
      fail(
        "ASSERTION_TOO_LONG",
        `Assertion ${index} contains ${text.length} characters; maximum is ${MAXIMUM_ASSERTION_CHARACTERS}. Likely unsegmented source material.`,
      );
    }

    if (wordCount(text) > MAXIMUM_ASSERTION_WORDS) {
      fail(
        "ASSERTION_WORD_LIMIT_EXCEEDED",
        `Assertion ${index} exceeds ${MAXIMUM_ASSERTION_WORDS} words. It must be reviewed and represented as atomic, evidence-backed claims.`,
      );
    }

    if (
      typeof record.fingerprint !== "string" ||
      !record.fingerprint.trim()
    ) {
      fail(
        "PROVENANCE_FINGERPRINT_MISSING",
        `Provenance record ${index} has no fingerprint.`,
      );
    }

    assertNonEmptyIdArray(
      record.knowledgeIds,
      "PROVENANCE_KNOWLEDGE_IDS_INVALID",
      `Provenance record ${index} Knowledge IDs`,
    );

    assertNonEmptyIdArray(
      record.claimIds,
      "PROVENANCE_CLAIM_IDS_INVALID",
      `Provenance record ${index} Claim IDs`,
    );

    assertNonEmptyIdArray(
      record.evidenceIds,
      "PROVENANCE_EVIDENCE_IDS_INVALID",
      `Provenance record ${index} Evidence IDs`,
    );

    for (const id of record.knowledgeIds) {
      if (!knownKnowledgeIds.has(id)) {
        fail(
          "PROVENANCE_KNOWLEDGE_OUTSIDE_CLOSURE",
          `Assertion ${index} references unknown Knowledge ID "${id}".`,
        );
      }
    }

    for (const id of record.claimIds) {
      if (!knownClaimIds.has(id)) {
        fail(
          "PROVENANCE_CLAIM_OUTSIDE_CLOSURE",
          `Assertion ${index} references unknown Claim ID "${id}".`,
        );
      }
    }

    for (const id of record.evidenceIds) {
      if (!verifiedEvidenceIds.has(id)) {
        fail(
          "PROVENANCE_EVIDENCE_NOT_VERIFIED",
          `Assertion ${index} references Evidence ID "${id}" outside the verified evidence closure.`,
        );
      }
    }

    const normalizedKey = text.toLocaleLowerCase("en");

    if (provenanceByText.has(normalizedKey)) {
      fail(
        "DUPLICATE_PROSE_ASSERTION",
        `Duplicate Knowledge assertion detected at index ${index}.`,
      );
    }

    provenanceByText.set(normalizedKey, record);
  }

  const knowledgeProvenance = provenance.filter(
    (record) => record.kind === "KNOWLEDGE",
  );

  if (
    knowledgeProvenance.length <
    MINIMUM_KNOWLEDGE_ASSERTIONS
  ) {
    fail(
      "INSUFFICIENT_VERIFIED_KNOWLEDGE",
      `Expected at least ${MINIMUM_KNOWLEDGE_ASSERTIONS} independent Knowledge assertions; found ${knowledgeProvenance.length}.`,
    );
  }

  const proseKeys = proseLines.map((line) =>
    line.toLocaleLowerCase("en"),
  );

  if (proseKeys.length !== provenanceByText.size) {
    fail(
      "PROSE_PROVENANCE_COUNT_MISMATCH",
      `Article prose line count ${proseKeys.length} differs from unique provenance assertion count ${provenanceByText.size}.`,
    );
  }

  for (const [index, key] of proseKeys.entries()) {
    if (!provenanceByText.has(key)) {
      fail(
        "UNTRACED_ARTICLE_PROSE",
        `Article prose line ${index} has no exact Knowledge provenance match.`,
      );
    }
  }

  const uniqueEvidenceUsed = new Set(
    provenance.flatMap((record) => record.evidenceIds),
  );

  if (uniqueEvidenceUsed.size === 0) {
    fail(
      "NO_EVIDENCE_USED",
      "No verified Evidence is referenced by article assertions.",
    );
  }

  return Object.freeze({
    status: "PASS",
    title: manifest.article.title,
    headingCount: headings.length,
    proseAssertionCount: proseLines.length,
    verifiedEvidenceCount: uniqueEvidenceUsed.size,
    knowledgeAssertionCount: knowledgeProvenance.length,
  });
}

function main() {
  if (!fs.existsSync(ARTICLE_PATH)) {
    fail(
      "ARTICLE_FILE_MISSING",
      `Article file not found: ${path.relative(process.cwd(), ARTICLE_PATH)}`,
    );
  }

  if (!fs.existsSync(MANIFEST_PATH)) {
    fail(
      "MANIFEST_FILE_MISSING",
      `Manifest file not found: ${path.relative(process.cwd(), MANIFEST_PATH)}`,
    );
  }

  const article = fs.readFileSync(ARTICLE_PATH, "utf8");

  let manifest;

  try {
    manifest = JSON.parse(
      fs.readFileSync(MANIFEST_PATH, "utf8"),
    );
  } catch (error) {
    fail(
      "MANIFEST_JSON_INVALID",
      error instanceof Error
        ? error.message
        : String(error),
    );
  }

  const result = validateArticlePublication({
    article,
    manifest,
  });

  console.log(
    "[V8-ARTICLE-PUBLICATION-QUALITY-GATE] PASS",
  );
  console.log(`Title: ${result.title}`);
  console.log(`H2 sections: ${result.headingCount}`);
  console.log(
    `Knowledge assertions: ${result.knowledgeAssertionCount}`,
  );
  console.log(
    `Verified Evidence referenced: ${result.verifiedEvidenceCount}`,
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(SCRIPT_PATH)
) {
  try {
    main();
  } catch (error) {
    console.error(
      "[V8-ARTICLE-PUBLICATION-QUALITY-GATE] FAIL",
    );
    console.error(
      error instanceof Error
        ? error.message
        : String(error),
    );
    process.exitCode = 1;
  }
}
