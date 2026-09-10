import assert from "node:assert/strict";
import test from "node:test";

import {
  createObservation,
} from "../../../.v8-build/src/v8/domain/observation.js";

import {
  InMemoryFoundationStore,
} from "../../../.v8-build/src/v8/foundation/store.js";

test(
  "V8-21 Observation Domain Contract PASS",
  () => {
    const observation = createObservation({
      kind: "MEASUREMENT",
      subject: "production-cycle-time",
      value: "18.4",
      unit: "seconds",
      observedAt: "2026-09-10T04:00:00.000Z",
      contextId: "context:production",
      sourceId: "source:factory-system",
    });

    assert.equal(
      observation.kind,
      "MEASUREMENT",
    );

    assert.equal(
      observation.subject,
      "production-cycle-time",
    );

    assert.equal(
      observation.value,
      "18.4",
    );

    assert.equal(
      observation.unit,
      "seconds",
    );

    assert.equal(
      observation.contextId,
      "context:production",
    );

    assert.equal(
      observation.sourceId,
      "source:factory-system",
    );

    assert.ok(
      observation.id.length > 0,
    );

    const same = createObservation({
      kind: "MEASUREMENT",
      subject: "production-cycle-time",
      value: "18.4",
      unit: "seconds",
      observedAt: "2026-09-10T04:00:00.000Z",
      contextId: "context:production",
      sourceId: "source:factory-system",
    });

    assert.equal(
      same.id,
      observation.id,
    );

    assert.throws(
      () =>
        createObservation({
          kind: "MEASUREMENT",
          subject: "",
          value: "18.4",
          observedAt: "2026-09-10T04:00:00.000Z",
        }),
      /V8_EMPTY_ID/,
    );

    assert.throws(
      () =>
        createObservation({
          kind: "MEASUREMENT",
          subject: "production-cycle-time",
          value: "",
          observedAt: "2026-09-10T04:00:00.000Z",
        }),
      /V8_EMPTY_ID/,
    );

    assert.throws(
      () =>
        createObservation({
          kind: "MEASUREMENT",
          subject: "production-cycle-time",
          value: "18.4",
          observedAt: "",
        }),
      /V8_EMPTY_ID/,
    );

    const store =
      new InMemoryFoundationStore();

    const record = store.append({
      aggregateType: "OBSERVATION",
      aggregateId: observation.id,
      version: 1,
      state: "REGISTERED",
      payload: observation,
      lineage: [],
      actor: {
        id: "v8-21-test",
        role: "SYSTEM",
      },
      reason: "observation domain contract",
    });

    assert.equal(
      record.aggregateType,
      "OBSERVATION",
    );

    assert.equal(
      record.aggregateId,
      observation.id,
    );

    assert.equal(
      record.state,
      "REGISTERED",
    );

    assert.deepEqual(
      store.get(
        "OBSERVATION",
        observation.id,
      ),
      record,
    );

    assert.equal(
      store.verifyChain().valid,
      true,
    );

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        observation,
        "fingerprint",
      ),
      false,
    );
  },
);