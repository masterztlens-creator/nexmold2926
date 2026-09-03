import { immutable, invariant } from "../constitution/invariants.js";
import type { FoundationStore, LineageLink } from "../foundation/types.js";
import { createPublicationArtifact } from "./artifact.js";
import type { PublicationInput } from "./types.js";

export class PublicationGate {
  constructor(private readonly store: FoundationStore) {}

  publish(i: PublicationInput) {
    const e = this.store.get("ELIGIBILITY", i.eligibility.aggregateId, i.eligibility.version);
    invariant(
      e !== null && e.fingerprint === i.eligibility.fingerprint && e.state === "APPROVED",
      "V8_PUBLICATION_STALE_ELIGIBILITY",
      "Eligibility record is stale or not approved.",
    );

    const policy = this.store.get("POLICY", i.policyId);
    invariant(
      policy !== null && policy.state === "APPROVED",
      "V8_PUBLICATION_POLICY_NOT_APPROVED",
      "Publication requires an APPROVED policy.",
    );

    const expectedEligibilityLineage = e.lineage;
    const suppliedEligibilityLineage = i.lineage.filter((l) => l.type !== "ELIGIBILITY");
    invariant(
      sameLineage(suppliedEligibilityLineage, expectedEligibilityLineage),
      "V8_PUBLICATION_LINEAGE_MISMATCH",
      "Publication lineage must exactly match the approved eligibility lineage.",
    );

    const policyLineage: LineageLink = {
      type: "POLICY",
      id: policy.aggregateId,
      version: policy.version,
      fingerprint: policy.fingerprint,
    };

    const canonicalInput: PublicationInput = immutable({
      ...i,
      subjectId: i.subjectId.trim(),
      title: i.title.trim(),
      body: i.body.trim(),
      lineage: [...expectedEligibilityLineage, policyLineage],
    });

    return immutable(createPublicationArtifact(canonicalInput));
  }
}

function sameLineage(a: readonly LineageLink[], b: readonly LineageLink[]) {
  if (a.length !== b.length) return false;
  return a.every((left, index) => {
    const right = b[index];
    return right !== undefined
      && left.type === right.type
      && left.id === right.id
      && left.version === right.version
      && left.fingerprint === right.fingerprint;
  });
}
