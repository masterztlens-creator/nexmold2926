/** NEXMOLD V7.14 — production boundary adapter. */
import {
  compileRegionalPage,
  type V714RegionalCompilerInput,
} from "./regionalCompiler.ts";
import type {
  CanonicalUrl,
  RegionalCompileInput,
  RegionalCompileResult,
} from "./types.ts";
import type { V714ClaimEvidenceBinding } from "./epistemic-firewall.ts";

export interface V714ProducerInput {
  readonly compileInput: RegionalCompileInput;
  readonly bindings: readonly V714ClaimEvidenceBinding[];
  readonly canonicalUrl: CanonicalUrl;
  readonly hreflangSet: readonly RegionalCompileInput["locale"][];
  readonly canonicalByLocale: ReadonlyMap<
    RegionalCompileInput["locale"],
    CanonicalUrl
  >;
}

export interface V714ProducerBlocked {
  readonly published: false;
  readonly result: null;
  readonly reasonCodes: readonly string[];
}
export interface V714ProducerPublished {
  readonly published: true;
  readonly result: RegionalCompileResult;
}
export type V714ProducerResult =
  | V714ProducerPublished
  | V714ProducerBlocked;

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateProducerInput(input: V714ProducerInput): string[] {
  const reasons: string[] = [];
  if (!isRecord(input)) return ["V714_PRODUCER_INPUT_INVALID"];
  if (!isRecord(input.compileInput)) return ["V714_PRODUCER_COMPILE_INPUT_INVALID"];

  if (!nonEmptyString(input.compileInput.pageId)) reasons.push("V714_PRODUCER_PAGE_ID_INVALID");
  if (!nonEmptyString(input.compileInput.locale)) reasons.push("V714_PRODUCER_LOCALE_INVALID");
  if (!nonEmptyString(input.compileInput.region)) reasons.push("V714_PRODUCER_REGION_INVALID");
  if (!nonEmptyString(input.canonicalUrl)) reasons.push("V714_PRODUCER_CANONICAL_URL_INVALID");

  if (!Array.isArray(input.bindings)) reasons.push("V714_PRODUCER_BINDINGS_INVALID");
  if (!Array.isArray(input.hreflangSet) || input.hreflangSet.length === 0) {
    reasons.push("V714_PRODUCER_HREFLANG_SET_INVALID");
  }
  if (!(input.canonicalByLocale instanceof Map)) {
    reasons.push("V714_PRODUCER_CANONICAL_MAP_INVALID");
  }

  return reasons;
}

function validateEvidenceBoundary(input: V714ProducerInput): string[] {
  const reasons: string[] = [];
  const compileInput = input.compileInput;

  if (!isRecord(compileInput.evidence)) {
    reasons.push("V714_PRODUCER_EVIDENCE_INVALID");
    return reasons;
  }

  if (!Array.isArray(compileInput.evidence.evidence)) reasons.push("V714_PRODUCER_EVIDENCE_INVALID");
  if (!Array.isArray(compileInput.evidence.semanticClaims)) reasons.push("V714_PRODUCER_DECLARED_CLAIMS_INVALID");
  if (!Array.isArray(compileInput.semantic.semanticClaimIds)) reasons.push("V714_PRODUCER_SEMANTIC_CLAIMS_INVALID");

  if (Array.isArray(compileInput.evidence.evidence) && compileInput.evidence.evidence.length === 0) {
    reasons.push("V714_PRODUCER_EVIDENCE_ZERO");
  }
  if (Array.isArray(compileInput.evidence.semanticClaims) && compileInput.evidence.semanticClaims.length === 0) {
    reasons.push("V714_PRODUCER_DECLARED_CLAIMS_ZERO");
  }
  if (Array.isArray(compileInput.semantic.semanticClaimIds) && compileInput.semantic.semanticClaimIds.length === 0) {
    reasons.push("V714_PRODUCER_SEMANTIC_CLAIMS_ZERO");
  }

  if (Array.isArray(compileInput.evidence.semanticClaims) && Array.isArray(compileInput.semantic.semanticClaimIds)) {
    const declared = compileInput.evidence.semanticClaims.map((claim) => String(claim.id));
    const projected = compileInput.semantic.semanticClaimIds.map(String);
    if (declared.length !== projected.length || declared.some((id) => !projected.includes(id))) {
      reasons.push("V714_PRODUCER_SEMANTIC_CLAIM_DECLARATION_MISMATCH");
    }
  }

  if (!Array.isArray(input.bindings)) return [...new Set(reasons.concat("V714_PRODUCER_BINDINGS_INVALID"))];

  const evidenceIds = new Set(
    Array.isArray(compileInput.evidence.evidence)
      ? compileInput.evidence.evidence.map((evidence) => String(evidence.id))
      : [],
  );
  const boundClaims = new Set<string>();

  for (const binding of input.bindings) {
    const claimId = String(binding.claim.id);
    if (boundClaims.has(claimId)) reasons.push(`V714_PRODUCER_DUPLICATE_CLAIM_BINDING:${claimId}`);
    boundClaims.add(claimId);

    if (!Array.isArray(binding.evidenceIds) || binding.evidenceIds.length === 0) {
      reasons.push(`V714_PRODUCER_BINDING_WITHOUT_EVIDENCE:${claimId}`);
      continue;
    }
    for (const evidenceId of binding.evidenceIds) {
      if (!evidenceIds.has(String(evidenceId))) {
        reasons.push(`V714_PRODUCER_EVIDENCE_UNRESOLVED:${String(evidenceId)}`);
      }
    }
  }

  if (Array.isArray(compileInput.semantic.semanticClaimIds)) {
    for (const claimId of compileInput.semantic.semanticClaimIds) {
      if (!boundClaims.has(String(claimId))) {
        reasons.push(`V714_PRODUCER_CLAIM_UNBOUND:${String(claimId)}`);
      }
    }
  }

  return [...new Set(reasons)];
}

export function produceRegionalPage(
  input: V714ProducerInput,
): V714ProducerResult {
  const inputReasons = validateProducerInput(input);
  if (inputReasons.length) {
    return { published: false, result: null, reasonCodes: inputReasons };
  }

  const evidenceReasons = validateEvidenceBoundary(input);
  if (evidenceReasons.length) {
    return { published: false, result: null, reasonCodes: evidenceReasons };
  }

  const compilerInput: V714RegionalCompilerInput = {
    compileInput: input.compileInput,
    bindings: input.bindings,
    canonicalUrl: input.canonicalUrl,
    hreflangSet: input.hreflangSet,
    canonicalByLocale: input.canonicalByLocale,
  };

  const result = compileRegionalPage(compilerInput);

  if (!result.published) {
    return {
      published: false,
      result: null,
      reasonCodes: result.reasonCodes,
    };
  }

  return { published: true, result: result.result };
}

export const runV714Producer = produceRegionalPage;
