import { immutable, invariant } from "../constitution/invariants.js";
import { contentFingerprint } from "../foundation/hash.js";
import { contentId, type Fingerprint } from "../domain/primitives.js";
import type { PublicationArtifact, PublicationInput } from "./types.js";

export function createPublicationArtifact(i: PublicationInput): Readonly<PublicationArtifact> {
  invariant(
    i.eligibility.aggregateType === "ELIGIBILITY" && i.eligibility.state === "APPROVED",
    "V8_PUBLICATION_ELIGIBILITY_REQUIRED",
    "Publication requires APPROVED eligibility.",
  );
  invariant(i.policyId.trim().length > 0, "V8_PUBLICATION_POLICY_REQUIRED", "Publication requires a policy.");
  const policyLink = i.lineage.find((l) => l.type === "POLICY" && l.id === i.policyId);
  invariant(
    policyLink !== undefined,
    "V8_PUBLICATION_POLICY_LINEAGE_REQUIRED",
    "Publication requires exact policy lineage.",
  );

  const fp = contentFingerprint({
    subjectId: i.subjectId.trim(),
    title: i.title.trim(),
    body: i.body.trim(),
    lineage: i.lineage,
    eligibility: i.eligibility.fingerprint,
    policyId: i.policyId,
    policyFingerprint: policyLink.fingerprint,
  });

  return immutable({
    id: contentId(`publication:${fp}`),
    subjectId: i.subjectId.trim(),
    title: i.title.trim(),
    body: i.body.trim(),
    contentFingerprint: fp,
    lineage: [...i.lineage, {
      type: "ELIGIBILITY",
      id: i.eligibility.aggregateId,
      version: i.eligibility.version,
      fingerprint: i.eligibility.fingerprint,
    }],
    eligibilityRecordId: i.eligibility.recordId,
    policyId: i.policyId,
    policyFingerprint: policyLink.fingerprint,
  });
}
