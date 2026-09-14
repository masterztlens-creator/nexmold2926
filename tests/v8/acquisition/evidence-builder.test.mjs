import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEvidencePayloads,
  evidenceAggregateId,
} from "../../../.v8-build/src/v8/acquisition/evidence-builder.js";

const sourceId =
  "source:https://example.com/material-data";

const snapshotId =
  "snapshot:example-material-data:v1";

const snapshot = {
  sourceId,
  capturedAt: "2026-09-14T00:00:00.000Z",
  locator: "https://example.com/material-data",
  contentHash:
    "snapshot-content-hash-001",
  metadataOnly: false,
  requestedUrl:
    "https://example.com/material-data",
  finalUrl:
    "https://example.com/material-data",
  redirectChain: [],
  mediaType:
    "text/html",
  byteLength: 1024,
  payload:
    "Material manufacturer: Example Materials. Grade: EX-100. Test method: ISO 527. Test condition: 23 C / 50% RH. Flow direction: machine direction.",
};

function candidate(overrides = {}) {
  return {
    locator:
      "https://example.com/material-data#table-1-row-2",
    excerpt:
      "Example Materials EX-100 tensile strength measured according to ISO 527 at 23 C / 50% RH in machine direction.",
    page: 12,
    printedPage: "10",
    section:
      "Mechanical Properties",
    table:
      "Table 1",
    row:
      "EX-100",
    parameter:
      "Tensile Strength",
    value:
      65,
    unit:
      "MPa",
    materialManufacturer:
      "Example Materials",
    materialGrade:
      "EX-100",
    testMethod:
      "ISO 527",
    testCondition:
      "23 C / 50% RH",
    flowDirection:
      "machine direction",
    extractionConfidence:
      "HIGH",
    ...overrides,
  };
}

test(
  "Evidence semantic fields are preserved losslessly",
  () => {
    const [payload] =
      buildEvidencePayloads(
        sourceId,
        snapshotId,
        snapshot,
        [candidate()],
      );

    assert.equal(
      payload.page,
      12,
    );

    assert.equal(
      payload.printedPage,
      "10",
    );

    assert.equal(
      payload.section,
      "Mechanical Properties",
    );

    assert.equal(
      payload.table,
      "Table 1",
    );

    assert.equal(
      payload.row,
      "EX-100",
    );

    assert.equal(
      payload.parameter,
      "Tensile Strength",
    );

    assert.equal(
      payload.value,
      65,
    );

    assert.equal(
      payload.unit,
      "MPa",
    );

    assert.equal(
      payload.materialManufacturer,
      "Example Materials",
    );

    assert.equal(
      payload.materialGrade,
      "EX-100",
    );

    assert.equal(
      payload.testMethod,
      "ISO 527",
    );

    assert.equal(
      payload.testCondition,
      "23 C / 50% RH",
    );

    assert.equal(
      payload.flowDirection,
      "machine direction",
    );

    assert.equal(
      payload.extractionConfidence,
      "HIGH",
    );
  },
);

test(
  "Changing material grade changes Evidence identity",
  () => {
    const first =
      evidenceAggregateId(
        sourceId,
        snapshotId,
        candidate(),
        snapshot.contentHash,
      );

    const second =
      evidenceAggregateId(
        sourceId,
        snapshotId,
        candidate({
          materialGrade: "EX-200",
        }),
        snapshot.contentHash,
      );

    assert.notEqual(
      first,
      second,
    );
  },
);

test(
  "Changing test method changes Evidence identity",
  () => {
    const first =
      evidenceAggregateId(
        sourceId,
        snapshotId,
        candidate(),
        snapshot.contentHash,
      );

    const second =
      evidenceAggregateId(
        sourceId,
        snapshotId,
        candidate({
          testMethod: "ASTM D638",
        }),
        snapshot.contentHash,
      );

    assert.notEqual(
      first,
      second,
    );
  },
);

test(
  "Changing test condition changes Evidence identity",
  () => {
    const first =
      evidenceAggregateId(
        sourceId,
        snapshotId,
        candidate(),
        snapshot.contentHash,
      );

    const second =
      evidenceAggregateId(
        sourceId,
        snapshotId,
        candidate({
          testCondition: "80 C / dry",
        }),
        snapshot.contentHash,
      );

    assert.notEqual(
      first,
      second,
    );
  },
);

test(
  "Changing flow direction changes Evidence identity",
  () => {
    const first =
      evidenceAggregateId(
        sourceId,
        snapshotId,
        candidate(),
        snapshot.contentHash,
      );

    const second =
      evidenceAggregateId(
        sourceId,
        snapshotId,
        candidate({
          flowDirection: "transverse direction",
        }),
        snapshot.contentHash,
      );

    assert.notEqual(
      first,
      second,
    );
  },
);

test(
  "Changing page/table/row provenance changes Evidence identity",
  () => {
    const first =
      evidenceAggregateId(
        sourceId,
        snapshotId,
        candidate(),
        snapshot.contentHash,
      );

    const second =
      evidenceAggregateId(
        sourceId,
        snapshotId,
        candidate({
          page: 13,
          table: "Table 2",
          row: "EX-100-A",
        }),
        snapshot.contentHash,
      );

    assert.notEqual(
      first,
      second,
    );
  },
);

test(
  "Changing Snapshot content hash changes Evidence identity",
  () => {
    const first =
      evidenceAggregateId(
        sourceId,
        snapshotId,
        candidate(),
        "snapshot-content-hash-001",
      );

    const second =
      evidenceAggregateId(
        sourceId,
        snapshotId,
        candidate(),
        "snapshot-content-hash-002",
      );

    assert.notEqual(
      first,
      second,
    );
  },
);

test(
  "Evidence payload hash changes with semantic source metadata",
  () => {
    const [first] =
      buildEvidencePayloads(
        sourceId,
        snapshotId,
        snapshot,
        [candidate()],
      );

    const [second] =
      buildEvidencePayloads(
        sourceId,
        snapshotId,
        snapshot,
        [
          candidate({
            materialManufacturer:
              "Another Manufacturer",
          }),
        ],
      );

    assert.notEqual(
      first.evidenceHash,
      second.evidenceHash,
    );
  },
);