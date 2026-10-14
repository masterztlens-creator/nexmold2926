
import type {
  ClaimEpistemicLevel,
  EvidencePayload,
} from "../../index.js";

export type TruthConfidence =
  | "HIGH"
  | "MEDIUM"
  | "LOW";

export interface ClaimCandidate {
  readonly statement: string;
  readonly evidenceIds: readonly string[];

  readonly epistemicLevel:
    | ClaimEpistemicLevel;

  readonly confidence:
    | TruthConfidence;

  readonly scope?: string;
  readonly conditions?: readonly string[];
  readonly units?: readonly string[];
  readonly isUniversal?: boolean;
}

export interface ClaimInterpreter {
  interpret(
    evidence: readonly EvidencePayload[],
  ): readonly ClaimCandidate[];
}

/**
 * A semantic verification decision is independent of the state of the
 * Evidence records supporting the candidate.
 *
 * VERIFIED means that the verifier explicitly assessed the candidate's
 * statement against the supplied Evidence and accepted that exact statement
 * with that exact Evidence identity set.
 *
 * REQUIRES_REVIEW and REJECTED are both fail-closed outcomes for automated
 * Claim and Knowledge creation.
 */
export type ClaimSemanticVerificationVerdict =
  | "VERIFIED"
  | "REQUIRES_REVIEW"
  | "REJECTED";

export interface ClaimSemanticVerification {
  readonly verdict:
    ClaimSemanticVerificationVerdict;

  /**
   * The exact statement assessed by the verifier.
   *
   * The producer requires this to equal the normalized candidate statement.
   * A verifier may not silently verify a different statement.
   */
  readonly verifiedStatement: string;

  /**
   * The exact Evidence IDs assessed by the verifier.
   *
   * The producer requires this set to match the candidate's Evidence IDs.
   */
  readonly evidenceIds: readonly string[];

  /**
   * Machine-readable or human-readable audit reasons.
   *
   * A non-VERIFIED verdict must provide at least one non-empty reason.
   */
  readonly reasons: readonly string[];
}

/**
 * Implementations must assess whether the candidate statement is supported
 * by the supplied Evidence, including its scope, conditions, units, and
 * epistemic level.
 *
 * Evidence state verification alone is not semantic Claim verification.
 */
export interface ClaimSemanticVerifier {
  verify(
    candidate: ClaimCandidate,
    evidence: readonly EvidencePayload[],
  ): ClaimSemanticVerification;
}

export interface TruthProducerInput {
  readonly evidence: readonly EvidencePayload[];
  readonly actor: {
    readonly id: string;
    readonly role: string;
  };
}

export interface TruthProducerResult {
  readonly claims: readonly string[];
  readonly knowledge: readonly string[];
  readonly rejectedCandidates: readonly {
    readonly statement: string;
    readonly reason: string;
  }[];
}
