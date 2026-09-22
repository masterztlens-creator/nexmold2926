import { invariant } from "../constitution/invariants.js";
import type { Evidence } from "../domain/evidence.js";

const SEMANTIC_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "with",
]);

function normalizeTokens(value: string): readonly string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(
      (token) =>
        token.length > 1 && !SEMANTIC_STOP_WORDS.has(token),
    );
}

function hasMeaningfulTokenOverlap(
  excerpt: string,
  metadata: string,
): boolean {
  const excerptTokens = new Set(normalizeTokens(excerpt));
  const metadataTokens = normalizeTokens(metadata);

  return metadataTokens.some((token) => excerptTokens.has(token));
}

function assertMetadataGrounded(
  excerpt: string,
  metadata: string | undefined,
  code: string,
  message: string,
): void {
  if (metadata === undefined || metadata.trim().length === 0) {
    return;
  }

  invariant(
    hasMeaningfulTokenOverlap(excerpt, metadata),
    code,
    message,
  );
}

export function assertEvidenceReady(e: Evidence): void {
  invariant(
    e.excerpt.trim().length > 0,
    "V8_EVIDENCE_EXCERPT_REQUIRED",
    "Evidence requires raw excerpt.",
  );

  invariant(
    e.locator.trim().length > 0,
    "V8_EVIDENCE_LOCATOR_REQUIRED",
    "Evidence requires exact locator.",
  );

  invariant(
    e.verificationStatus !== "VERIFIED" ||
      Boolean(e.page || e.section || e.table || e.row),
    "V8_EVIDENCE_EXACT_LOCATOR_REQUIRED",
    "Verified Evidence requires a document locator.",
  );

  if (e.parameter !== undefined) {
    invariant(
      e.value !== undefined,
      "V8_EVIDENCE_VALUE_REQUIRED",
      "Parameter evidence requires a value.",
    );
  }

  invariant(
    e.verificationStatus !== "VERIFIED" ||
      Boolean(
        e.materialGrade ||
          e.testMethod ||
          e.testCondition ||
          e.parameter,
      ),
    "V8_EVIDENCE_CONTEXT_REQUIRED",
    "Verified engineering evidence requires applicability context.",
  );

  if (e.verificationStatus !== "VERIFIED") {
    return;
  }

  assertMetadataGrounded(
    e.excerpt,
    e.parameter,
    "V8_EVIDENCE_PARAMETER_NOT_GROUNDED",
    "Verified Evidence parameter must be grounded in the raw excerpt.",
  );

  assertMetadataGrounded(
    e.excerpt,
    e.materialGrade,
    "V8_EVIDENCE_MATERIAL_GRADE_NOT_GROUNDED",
    "Verified Evidence material grade must be grounded in the raw excerpt.",
  );

  assertMetadataGrounded(
    e.excerpt,
    e.materialManufacturer,
    "V8_EVIDENCE_MATERIAL_MANUFACTURER_NOT_GROUNDED",
    "Verified Evidence material manufacturer must be grounded in the raw excerpt.",
  );

  assertMetadataGrounded(
    e.excerpt,
    e.testMethod,
    "V8_EVIDENCE_TEST_METHOD_NOT_GROUNDED",
    "Verified Evidence test method must be grounded in the raw excerpt.",
  );

  assertMetadataGrounded(
    e.excerpt,
    e.testCondition,
    "V8_EVIDENCE_TEST_CONDITION_NOT_GROUNDED",
    "Verified Evidence test condition must be grounded in the raw excerpt.",
  );

  assertMetadataGrounded(
    e.excerpt,
    e.flowDirection,
    "V8_EVIDENCE_FLOW_DIRECTION_NOT_GROUNDED",
    "Verified Evidence flow direction must be grounded in the raw excerpt.",
  );
}