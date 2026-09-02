/**
 * NEXMOLD V7.14
 * Production Producer Adapter
 *
 * Purpose:
 *   Bridge an upstream production data source into the
 *   canonical V7.14 regional compiler.
 *
 * Canonical flow:
 *
 *   Production Input
 *       ->
 *   RegionalCompileInput
 *       +
 *   Claim / Evidence Binding
 *       ->
 *   compileRegionalPage()
 *       ->
 *   Eligibility
 *       ->
 *   Epistemic Firewall
 *       ->
 *   Regional Publish Artifact
 *       ->
 *   Publication Gate
 *       ->
 *   Route / Hreflang Projection
 *
 * FAIL CLOSED.
 *
 * Important:
 *   This module does NOT create a RegionalPublishArtifact.
 *   This module does NOT bypass the regional compiler.
 *   This module does NOT publish directly.
 *
 * The canonical compiler remains the only publication authority.
 */

import {
  compileRegionalPage,
  type V714RegionalCompilerInput,
} from "./regionalCompiler.ts";

import type {
  CanonicalUrl,
  RegionalCompileInput,
  RegionalCompileResult,
} from "./types.ts";

import type {
  V714ClaimEvidenceBinding,
} from "./epistemic-firewall.ts";

/**
 * ------------------------------------------------------------
 * Producer Input
 * ------------------------------------------------------------
 *
 * The producer receives already-resolved production facts.
 *
 * It is deliberately forbidden from inventing:
 *   - evidence
 *   - claims
 *   - eligibility
 *   - publication artifacts
 *
 * Those responsibilities remain downstream.
 */
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

/**
 * ------------------------------------------------------------
 * Producer Result
 * ------------------------------------------------------------
 *
 * Invalid producer input is blocked before entering the
 * canonical compiler.
 *
 * A blocked producer result intentionally carries no
 * RegionalCompileResult because the compiler has not evaluated
 * the supplied input yet.
 */
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

/**
 * ------------------------------------------------------------
 * Small Runtime Validators
 * ------------------------------------------------------------
 */

function isNonEmptyString(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}

function isObject(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null
  );
}

/**
 * ------------------------------------------------------------
 * Producer Input Boundary Validation
 * ------------------------------------------------------------
 *
 * This validation does NOT replace the regional eligibility
 * engine or epistemic firewall.
 *
 * It only prevents obviously malformed producer payloads
 * from entering the canonical compiler.
 */
function validateProducerInput(
  input: V714ProducerInput,
): string[] {
  const reasons: string[] = [];

  if (!isObject(input)) {
    reasons.push(
      "V714_PRODUCER_INPUT_INVALID",
    );

    return reasons;
  }

  if (!isObject(input.compileInput)) {
    reasons.push(
      "V714_PRODUCER_COMPILE_INPUT_INVALID",
    );

    return reasons;
  }

  if (
    !isNonEmptyString(
      input.compileInput.pageId,
    )
  ) {
    reasons.push(
      "V714_PRODUCER_PAGE_ID_INVALID",
    );
  }

  if (
    !isNonEmptyString(
      input.compileInput.locale,
    )
  ) {
    reasons.push(
      "V714_PRODUCER_LOCALE_INVALID",
    );
  }

  if (
    !isNonEmptyString(
      input.compileInput.region,
    )
  ) {
    reasons.push(
      "V714_PRODUCER_REGION_INVALID",
    );
  }

  if (!Array.isArray(input.bindings)) {
    reasons.push(
      "V714_PRODUCER_BINDINGS_INVALID",
    );
  }

  if (!isNonEmptyString(input.canonicalUrl)) {
    reasons.push(
      "V714_PRODUCER_CANONICAL_URL_INVALID",
    );
  }

  if (!Array.isArray(input.hreflangSet)) {
    reasons.push(
      "V714_PRODUCER_HREFLANG_SET_INVALID",
    );
  }

  if (
    !(input.canonicalByLocale instanceof Map) &&
    !isObject(input.canonicalByLocale)
  ) {
    reasons.push(
      "V714_PRODUCER_CANONICAL_MAP_INVALID",
    );
  }

  return reasons;
}

/**
 * ------------------------------------------------------------
 * Evidence Boundary Validation
 * ------------------------------------------------------------
 *
 * The producer must provide:
 *
 *   Evidence
 *     +
 *   Semantic Claims
 *     +
 *   Claim/Evidence bindings
 *
 * This function does not verify epistemic truth.
 *
 * That remains the responsibility of:
 *
 *   runEpistemicFirewall()
 */
function validateEvidenceBoundary(
  input: V714ProducerInput,
): string[] {
  const reasons: string[] = [];
  const compileInput = input.compileInput;

  /**
   * RegionalCompileInput.evidence is a snapshot object:
   *
   *   evidence: {
   *     evidence: EvidenceRef[]
   *     ...
   *   }
   */
  if (
    !isObject(compileInput.evidence) ||
    !Array.isArray(compileInput.evidence.evidence)
  ) {
    reasons.push(
      "V714_PRODUCER_EVIDENCE_INVALID",
    );
  }

  if (
    !Array.isArray(
      compileInput.semantic.semanticClaimIds,
    )
  ) {
    reasons.push(
      "V714_PRODUCER_SEMANTIC_CLAIMS_INVALID",
    );
  }

  if (!Array.isArray(input.bindings)) {
    reasons.push(
      "V714_PRODUCER_BINDINGS_INVALID",
    );

    return reasons;
  }

  /**
   * No evidence means no publication.
   */
  if (
    isObject(compileInput.evidence) &&
    Array.isArray(compileInput.evidence.evidence) &&
    compileInput.evidence.evidence.length === 0
  ) {
    reasons.push(
      "V714_PRODUCER_EVIDENCE_ZERO",
    );
  }

  /**
   * No semantic claims means no publication.
   */
  if (
    Array.isArray(
      compileInput.semantic.semanticClaimIds,
    ) &&
    compileInput.semantic.semanticClaimIds.length === 0
  ) {
    reasons.push(
      "V714_PRODUCER_CLAIM_ZERO",
    );
  }

 

  /**
   * Every declared semantic claim must have at least one
   * explicit binding.
   */
  if (
    Array.isArray(
      compileInput.semantic.semanticClaimIds,
    )
  ) {
    const boundClaimIds = new Set(
      input.bindings.map(
        (binding) =>
          String(binding.claim.id),
      ),
    );

    for (
      const claimId
      of compileInput.semantic.semanticClaimIds
    ) {
      if (
        !boundClaimIds.has(
          String(claimId),
        )
      ) {
        reasons.push(
          `V714_PRODUCER_CLAIM_UNBOUND:${String(claimId)}`,
        );
      }
    }
  }

  /**
   * Every binding must reference at least one evidence ID.
   */
  for (const binding of input.bindings) {
    if (
      !Array.isArray(binding.evidenceIds) ||
      binding.evidenceIds.length === 0
    ) {
      reasons.push(
        `V714_PRODUCER_BINDING_WITHOUT_EVIDENCE:${String(binding.claim.id)}`,
      );
    }
  }

  /**
   * Every binding evidence ID must exist in the supplied
   * evidence snapshot.
   */
  if (
    isObject(compileInput.evidence) &&
    Array.isArray(compileInput.evidence.evidence)
  ) {
    const evidenceIds = new Set(
      compileInput.evidence.evidence.map(
        (evidence) =>
          String(evidence.id),
      ),
    );

    for (const binding of input.bindings) {
      for (const evidenceId of binding.evidenceIds) {
        if (!evidenceIds.has(String(evidenceId))) {
          reasons.push(
            `V714_PRODUCER_EVIDENCE_UNRESOLVED:${String(evidenceId)}`,
          );
        }
      }
    }
  }

  return [...new Set(reasons)];
}
/**
 * ------------------------------------------------------------
 * Producer
 * ------------------------------------------------------------
 *
 * This is the production entry point.
 *
 * It performs only boundary validation and then delegates
 * completely to compileRegionalPage().
 *
 * It cannot:
 *
 *   - create a publication artifact
 *   - approve a blocked page
 *   - bypass the firewall
 *   - bypass the publication gate
 *   - project a route independently
 */
export function produceRegionalPage(
  input: V714ProducerInput,
): V714ProducerResult {
  const inputReasons =
    validateProducerInput(input);

  if (inputReasons.length > 0) {
    return {
      published: false,
      result: null,
      reasonCodes: inputReasons,
    };
  }

  const evidenceReasons =
    validateEvidenceBoundary(input);

  if (evidenceReasons.length > 0) {
    return {
      published: false,
      result: null,
      reasonCodes: evidenceReasons,
    };
  }

  /**
   * ----------------------------------------------------------
   * Canonical Compiler Boundary
   * ----------------------------------------------------------
   *
   * From this point onward the producer has NO publication
   * authority.
   *
   * All decisions are delegated to the canonical compiler.
   */
  const compilerInput: V714RegionalCompilerInput = {
    compileInput: input.compileInput,
    bindings: input.bindings,
    canonicalUrl: input.canonicalUrl,
    hreflangSet: input.hreflangSet,
    canonicalByLocale:
      input.canonicalByLocale,
  };

  const result =
    compileRegionalPage(
      compilerInput,
    );

  /**
   * ----------------------------------------------------------
   * Compiler Block
   * ----------------------------------------------------------
   */
  if (!result.published) {
    return {
      published: false,
      result: null,
      reasonCodes: result.reasonCodes,
    };
  }

  /**
   * ----------------------------------------------------------
   * Compiler Publication
   * ----------------------------------------------------------
   *
   * Only the canonical compiler can return a published
   * RegionalCompileResult.
   */
  return {
    published: true,
    result: result.result,
  };
}

/**
 * ------------------------------------------------------------
 * Named Production Boundary
 * ------------------------------------------------------------
 *
 * This is the explicit V7.14 producer entry point.
 *
 * Keeping the alias makes future build-orchestrator wiring
 * unambiguous without duplicating production logic.
 */
export const runV714Producer =
  produceRegionalPage;


