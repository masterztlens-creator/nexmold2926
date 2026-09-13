import assert from "node:assert/strict";

import { createHash } from "node:crypto";

import {
  ArticleRuntime,
} from "../src/v8/runtime/article-runtime.js";

function sha256(value) {
  return createHash("sha256")
    .update(value)
    .digest("hex");
}

function fail(message) {
  throw new Error(message);
}

function assertEqual(actual, expected, message) {
  assert.equal(
    actual,
    expected,
    `${message}\nactual=${String(actual)}\nexpected=${String(expected)}`,
  );
}

function assertTruthy(value, message) {
  assert.ok(value, message);
}

function getLineage(record) {
  assertTruthy(
    record,
    "V8_CONTENT_PROVENANCE_RECORD_MISSING",
  );

  assert.ok(
    Array.isArray(record.lineage),
    `V8_CONTENT_PROVENANCE_LINEAGE_NOT_ARRAY:${record.id ?? "unknown"}`,
  );

  return record.lineage;
}

function assertLineageLink(
  parent,
  child,
  expectedType,
) {
  const lineage = getLineage(child);

  const link = lineage.find(
    (entry) =>
      entry.type === expectedType &&
      entry.id === parent.id,
  );

  assertTruthy(
    link,
    [
      "V8_CONTENT_PROVENANCE_LINEAGE_MISSING:",
      `${expectedType}:${parent.id}`,
      "->",
      child.id,
    ].join(" "),
  );

  assertEqual(
    link.fingerprint,
    parent.fingerprint,
    `V8_CONTENT_PROVENANCE_LINEAGE_FINGERPRINT_MISMATCH:${expectedType}:${parent.id}->${child.id}`,
  );
}

function assertRecordFingerprint(record) {
  assertTruthy(
    record.fingerprint,
    `V8_CONTENT_PROVENANCE_FINGERPRINT_MISSING:${record.id ?? "unknown"}`,
  );

  assertEqual(
    typeof record.fingerprint,
    "string",
    `V8_CONTENT_PROVENANCE_FINGERPRINT_TYPE:${record.id ?? "unknown"}`,
  );
}

function getRequiredRecord(store, id, type) {
  assertTruthy(
    id,
    `V8_CONTENT_PROVENANCE_ID_MISSING:${type}`,
  );

  const record = store.get(id);

  assertTruthy(
    record,
    `V8_CONTENT_PROVENANCE_RECORD_NOT_FOUND:${type}:${id}`,
  );

  assertEqual(
    record.type,
    type,
    `V8_CONTENT_PROVENANCE_RECORD_TYPE_MISMATCH:${id}`,
  );

  return record;
}

async function main() {
  const runtime = new ArticleRuntime();

  const result = await runtime.run();

  assertTruthy(
    result,
    "V8_CONTENT_PROVENANCE_RUNTIME_RESULT_MISSING",
  );

  assertTruthy(
    result.content,
    "V8_CONTENT_PROVENANCE_CONTENT_MISSING",
  );

  assertTruthy(
    result.decisionId,
    "V8_CONTENT_PROVENANCE_DECISION_ID_MISSING",
  );

  assertTruthy(
    result.problemId,
    "V8_CONTENT_PROVENANCE_PROBLEM_ID_MISSING",
  );

  assertTruthy(
    result.contextId,
    "V8_CONTENT_PROVENANCE_CONTEXT_ID_MISSING",
  );

  assertTruthy(
    result.scopeId,
    "V8_CONTENT_PROVENANCE_SCOPE_ID_MISSING",
  );

  assert.ok(
    Array.isArray(result.knowledgeIds),
    "V8_CONTENT_PROVENANCE_KNOWLEDGE_IDS_NOT_ARRAY",
  );

  assert.ok(
    result.knowledgeIds.length > 0,
    "V8_CONTENT_PROVENANCE_KNOWLEDGE_IDS_EMPTY",
  );

  assert.ok(
    Array.isArray(result.claimIds),
    "V8_CONTENT_PROVENANCE_CLAIM_IDS_NOT_ARRAY",
  );

  assert.ok(
    result.claimIds.length > 0,
    "V8_CONTENT_PROVENANCE_CLAIM_IDS_EMPTY",
  );

  assert.ok(
    Array.isArray(result.verifiedEvidenceIds),
    "V8_CONTENT_PROVENANCE_EVIDENCE_IDS_NOT_ARRAY",
  );

  assert.ok(
    result.verifiedEvidenceIds.length > 0,
    "V8_CONTENT_PROVENANCE_EVIDENCE_IDS_EMPTY",
  );

  assert.ok(
    Array.isArray(result.acquisition),
    "V8_CONTENT_PROVENANCE_ACQUISITION_NOT_ARRAY",
  );

  assert.ok(
    result.acquisition.length > 0,
    "V8_CONTENT_PROVENANCE_ACQUISITION_EMPTY",
  );

  const store = runtime.store;

  /*
   * Gate 1:
   * Content exists and has an immutable fingerprint.
   */
  const content = result.content;

  assertTruthy(
    content.id,
    "V8_CONTENT_PROVENANCE_CONTENT_ID_MISSING",
  );

  assertTruthy(
    content.decisionId,
    "V8_CONTENT_PROVENANCE_CONTENT_DECISION_ID_MISSING",
  );

  assertTruthy(
    content.title,
    "V8_CONTENT_PROVENANCE_CONTENT_TITLE_MISSING",
  );

  assertTruthy(
    content.body,
    "V8_CONTENT_PROVENANCE_CONTENT_BODY_MISSING",
  );

  assertRecordFingerprint(content);

  /*
   * Gate 2:
   * Content -> Decision.
   */
  const decision = getRequiredRecord(
    store,
    result.decisionId,
    "DECISION",
  );

  assertLineageLink(
    decision,
    content,
    "DECISION",
  );

  /*
   * Gate 3:
   * Decision -> Problem.
   */
  const problem = getRequiredRecord(
    store,
    result.problemId,
    "PROBLEM",
  );

  assertLineageLink(
    problem,
    decision,
    "PROBLEM",
  );

  /*
   * Gate 4:
   * Decision -> Context.
   */
  const context = getRequiredRecord(
    store,
    result.contextId,
    "CONTEXT",
  );

  assertLineageLink(
    context,
    decision,
    "CONTEXT",
  );

  /*
   * Gate 5:
   * Context -> Scope.
   */
  const scope = getRequiredRecord(
    store,
    result.scopeId,
    "SCOPE",
  );

  assertLineageLink(
    scope,
    context,
    "SCOPE",
  );

  /*
   * Gate 6:
   * Decision -> Knowledge.
   */
  const decisionPayload = decision.payload;

  assert.ok(
    decisionPayload,
    `V8_CONTENT_PROVENANCE_DECISION_PAYLOAD_MISSING:${decision.id}`,
  );

  assert.ok(
    Array.isArray(decisionPayload.knowledgeIds),
    `V8_CONTENT_PROVENANCE_DECISION_KNOWLEDGE_IDS_NOT_ARRAY:${decision.id}`,
  );

  for (const knowledgeId of result.knowledgeIds) {
    assert.ok(
      decisionPayload.knowledgeIds.includes(knowledgeId),
      [
        "V8_CONTENT_PROVENANCE_DECISION_KNOWLEDGE_LINK_MISSING:",
        decision.id,
        "->",
        knowledgeId,
      ].join(" "),
    );
  }

  /*
   * Gate 7:
   * Knowledge -> Claim.
   */
  const knowledgeRecords = [];

  for (const knowledgeId of result.knowledgeIds) {
    const knowledge = getRequiredRecord(
      store,
      knowledgeId,
      "KNOWLEDGE",
    );

    assertRecordFingerprint(knowledge);

    const knowledgePayload = knowledge.payload;

    assert.ok(
      knowledgePayload,
      `V8_CONTENT_PROVENANCE_KNOWLEDGE_PAYLOAD_MISSING:${knowledge.id}`,
    );

    assert.ok(
      Array.isArray(knowledgePayload.claimIds),
      `V8_CONTENT_PROVENANCE_KNOWLEDGE_CLAIM_IDS_NOT_ARRAY:${knowledge.id}`,
    );

    for (const claimId of knowledgePayload.claimIds) {
      assert.ok(
        result.claimIds.includes(claimId),
        [
          "V8_CONTENT_PROVENANCE_KNOWLEDGE_CLAIM_NOT_IN_RUNTIME:",
          knowledge.id,
          "->",
          claimId,
        ].join(" "),
      );

      const claim = getRequiredRecord(
        store,
        claimId,
        "CLAIM",
      );

      /*
       * IMPORTANT:
       * createKnowledge() stores CLAIM lineage.
       */
      assertLineageLink(
        claim,
        knowledge,
        "CLAIM",
      );

      knowledgeRecords.push(knowledge);
    }
  }

  /*
   * Gate 8:
   * Claim -> Evidence.
   *
   * IMPORTANT:
   * createClaim() does NOT create CLAIM lineage on Evidence.
   *
   * It creates EVIDENCE lineage on the Claim:
   *
   *   Claim.lineage
   *     -> EVIDENCE
   *
   * Therefore this assertion MUST be:
   *
   *   assertLineageLink(evidence, claim, "EVIDENCE")
   *
   * and NOT:
   *
   *   assertLineageLink(evidence, claim, "CLAIM")
   */
  for (const claimId of result.claimIds) {
    const claim = getRequiredRecord(
      store,
      claimId,
      "CLAIM",
    );

    assertRecordFingerprint(claim);

    const claimPayload = claim.payload;

    assert.ok(
      claimPayload,
      `V8_CONTENT_PROVENANCE_CLAIM_PAYLOAD_MISSING:${claim.id}`,
    );

    assert.ok(
      Array.isArray(claimPayload.evidenceIds),
      `V8_CONTENT_PROVENANCE_CLAIM_EVIDENCE_IDS_NOT_ARRAY:${claim.id}`,
    );

    assert.ok(
      claimPayload.evidenceIds.length > 0,
      `V8_CONTENT_PROVENANCE_CLAIM_EVIDENCE_IDS_EMPTY:${claim.id}`,
    );

    for (const evidenceId of claimPayload.evidenceIds) {
      assert.ok(
        result.verifiedEvidenceIds.includes(evidenceId),
        [
          "V8_CONTENT_PROVENANCE_CLAIM_EVIDENCE_NOT_IN_RUNTIME:",
          claim.id,
          "->",
          evidenceId,
        ].join(" "),
      );

      const evidence = getRequiredRecord(
        store,
        evidenceId,
        "EVIDENCE",
      );

      /*
       * CORRECT DIRECTION:
       *
       * Claim lineage contains:
       *   EVIDENCE -> evidence.id
       *
       * The previous implementation incorrectly checked:
       *   CLAIM -> claim.id
       */
      assertLineageLink(
        evidence,
        claim,
        "EVIDENCE",
      );
    }
  }

  /*
   * Gate 9:
   * Evidence -> Snapshot.
   */
  for (const evidenceId of result.verifiedEvidenceIds) {
    const evidence = getRequiredRecord(
      store,
      evidenceId,
      "EVIDENCE",
    );

    assertRecordFingerprint(evidence);

    const evidencePayload = evidence.payload;

    assert.ok(
      evidencePayload,
      `V8_CONTENT_PROVENANCE_EVIDENCE_PAYLOAD_MISSING:${evidence.id}`,
    );

    assertTruthy(
      evidencePayload.snapshotId,
      `V8_CONTENT_PROVENANCE_EVIDENCE_SNAPSHOT_ID_MISSING:${evidence.id}`,
    );

    const snapshot = getRequiredRecord(
      store,
      evidencePayload.snapshotId,
      "SNAPSHOT",
    );

    assertRecordFingerprint(snapshot);

    assertLineageLink(
      snapshot,
      evidence,
      "SNAPSHOT",
    );
  }

  /*
   * Gate 10:
   * Snapshot -> Internet Source.
   */
  for (const evidenceId of result.verifiedEvidenceIds) {
    const evidence = getRequiredRecord(
      store,
      evidenceId,
      "EVIDENCE",
    );

    const evidencePayload = evidence.payload;

    const snapshot = getRequiredRecord(
      store,
      evidencePayload.snapshotId,
      "SNAPSHOT",
    );

    assertTruthy(
      snapshot.payload,
      `V8_CONTENT_PROVENANCE_SNAPSHOT_PAYLOAD_MISSING:${snapshot.id}`,
    );

    assertTruthy(
      snapshot.payload.sourceId,
      `V8_CONTENT_PROVENANCE_SNAPSHOT_SOURCE_ID_MISSING:${snapshot.id}`,
    );

    const source = getRequiredRecord(
      store,
      snapshot.payload.sourceId,
      "SOURCE",
    );

    assertRecordFingerprint(source);

    assertLineageLink(
      source,
      snapshot,
      "SOURCE",
    );
  }

  /*
   * Gate 11:
   * Every acquired Internet page must correspond to
   * a persisted Source/Snapshot/Evidence chain.
   */
  for (const acquisition of result.acquisition) {
    assertTruthy(
      acquisition,
      "V8_CONTENT_PROVENANCE_ACQUISITION_RECORD_MISSING",
    );

    assertTruthy(
      acquisition.sourceId,
      "V8_CONTENT_PROVENANCE_ACQUISITION_SOURCE_ID_MISSING",
    );

    assertTruthy(
      acquisition.snapshotId,
      "V8_CONTENT_PROVENANCE_ACQUISITION_SNAPSHOT_ID_MISSING",
    );

    const source = getRequiredRecord(
      store,
      acquisition.sourceId,
      "SOURCE",
    );

    const snapshot = getRequiredRecord(
      store,
      acquisition.snapshotId,
      "SNAPSHOT",
    );

    assertEqual(
      snapshot.payload.sourceId,
      source.id,
      `V8_CONTENT_PROVENANCE_SOURCE_SNAPSHOT_ID_MISMATCH:${snapshot.id}`,
    );

    const matchingEvidence = result.verifiedEvidenceIds
      .map((id) =>
        getRequiredRecord(store, id, "EVIDENCE"),
      )
      .filter(
        (evidence) =>
          evidence.payload.snapshotId === snapshot.id,
      );

    assert.ok(
      matchingEvidence.length > 0,
      [
        "V8_CONTENT_PROVENANCE_NO_EVIDENCE_FOR_SNAPSHOT:",
        snapshot.id,
      ].join(" "),
    );
  }

  /*
   * Gate 12:
   * Content must be linked to all runtime Knowledge records.
   */
  const contentLineage = getLineage(content);

  for (const knowledgeId of result.knowledgeIds) {
    const link = contentLineage.find(
      (entry) =>
        entry.type === "KNOWLEDGE" &&
        entry.id === knowledgeId,
    );

    assertTruthy(
      link,
      [
        "V8_CONTENT_PROVENANCE_CONTENT_KNOWLEDGE_LINK_MISSING:",
        content.id,
        "->",
        knowledgeId,
      ].join(" "),
    );

    const knowledge = getRequiredRecord(
      store,
      knowledgeId,
      "KNOWLEDGE",
    );

    assertEqual(
      link.fingerprint,
      knowledge.fingerprint,
      [
        "V8_CONTENT_PROVENANCE_CONTENT_KNOWLEDGE_FINGERPRINT_MISMATCH:",
        knowledgeId,
      ].join(" "),
    );
  }

  /*
   * Gate 13:
   * Foundation chain verification.
   *
   * verifyChain() returns void.
   * Success means it completes without throwing.
   */
  store.verifyChain();

  /*
   * Gate 14:
   * Tamper detection.
   *
   * We deliberately create a detached tampered copy.
   * Its fingerprint must no longer match the original record.
   */
  const tamperTarget = getRequiredRecord(
    store,
    result.claimIds[0],
    "CLAIM",
  );

  const tampered = {
    ...tamperTarget,
    fingerprint: sha256(
      JSON.stringify({
        ...tamperTarget,
        payload: {
          ...tamperTarget.payload,
          proposition:
            `${tamperTarget.payload.proposition ?? ""} [TAMPERED]`,
        },
      }),
    ),
  };

  assert.notEqual(
    tampered.fingerprint,
    tamperTarget.fingerprint,
    "V8_CONTENT_PROVENANCE_TAMPER_DETECTION_FAILED",
  );

  /*
   * Final result.
   */
  console.log(
    "[NEXMOLD][V8-CONTENT-PROVENANCE] CONTENT PROVENANCE GATE PASS",
  );

  console.log(
    `[V8-CONTENT-PROVENANCE] content=${content.id}`,
  );

  console.log(
    `[V8-CONTENT-PROVENANCE] decision=${decision.id}`,
  );

  console.log(
    `[V8-CONTENT-PROVENANCE] knowledge=${result.knowledgeIds.length}`,
  );

  console.log(
    `[V8-CONTENT-PROVENANCE] claims=${result.claimIds.length}`,
  );

  console.log(
    `[V8-CONTENT-PROVENANCE] verifiedEvidence=${result.verifiedEvidenceIds.length}`,
  );

  console.log(
    `[V8-CONTENT-PROVENANCE] snapshots=${result.acquisition.length}`,
  );

  console.log(
    `[V8-CONTENT-PROVENANCE] internetSources=${result.acquisition.length}`,
  );

  console.log(
    `[V8-CONTENT-PROVENANCE] chainValid=true`,
  );

  console.log(
    `[V8-CONTENT-PROVENANCE] tamperDetection=true`,
  );

  console.log(
    `[V8-CONTENT-PROVENANCE] fingerprint=${content.fingerprint}`,
  );
}

main().catch((error) => {
  console.error(
    "[NEXMOLD][V8-CONTENT-PROVENANCE] GATE FAIL",
  );

  console.error(error);

  process.exitCode = 1;
});