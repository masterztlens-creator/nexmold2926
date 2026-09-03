import { immutable, invariant } from "../constitution/invariants.js";
import type { EvidencePayload, FoundationRecord, FoundationStore, SnapshotPayload } from "../foundation/types.js";

export interface EvidenceGateResult {
  readonly passed: boolean;
  readonly evidenceIds: readonly string[];
  readonly reasons: readonly string[];
}

export class EvidenceGate {
  constructor(private readonly store: FoundationStore) {}

  check(ids: readonly string[]): EvidenceGateResult {
    const reasons: string[] = [];
    const unique = [...new Set(ids)];

    if (!ids.length) reasons.push("At least one evidence reference is required.");
    if (unique.length !== ids.length) reasons.push("Evidence references must be unique.");

    const records = ids.map((id) => this.store.get<EvidencePayload>("EVIDENCE", id));
    if (records.some((r) => r === null)) reasons.push("Every evidence reference must exist.");

    for (const r of records.filter(
      (x): x is FoundationRecord<EvidencePayload> => x !== null,
    )) {
      if (r.state !== "AUDITED") {
        reasons.push(`Evidence ${r.aggregateId} must be AUDITED.`);
        continue;
      }

      const snapshotLink = r.lineage.find(
        (l) => l.type === "SNAPSHOT" && l.id === r.payload.snapshotId,
      );
      if (!snapshotLink) {
        reasons.push(`Evidence ${r.aggregateId} has no exact snapshot lineage.`);
        continue;
      }

      const snapshot = this.store.get<SnapshotPayload>(
        "SNAPSHOT",
        snapshotLink.id,
        snapshotLink.version,
      );

      if (!snapshot || snapshot.fingerprint !== snapshotLink.fingerprint) {
        reasons.push(`Evidence ${r.aggregateId} has stale snapshot lineage.`);
        continue;
      }

      if (snapshot.state !== "SEALED") {
        reasons.push(`Evidence ${r.aggregateId} references a snapshot that is not SEALED.`);
      }

      if (snapshot.payload.sourceId !== r.payload.sourceId) {
        reasons.push(`Evidence ${r.aggregateId} source does not match its snapshot.`);
      }

      const sameRecord = this.store.get<EvidencePayload>(
        "EVIDENCE",
        r.aggregateId,
        r.version,
      );
      if (!sameRecord || sameRecord.fingerprint !== r.fingerprint) {
        reasons.push(`Evidence ${r.aggregateId} has an invalid immutable fingerprint.`);
      }
    }

    return immutable({
      passed: reasons.length === 0,
      evidenceIds: [...ids],
      reasons,
    });
  }

  assert(ids: readonly string[]) {
    const result = this.check(ids);
    invariant(result.passed, "V8_EVIDENCE_GATE_FAILED", result.reasons.join(" "));
    return result;
  }
}
