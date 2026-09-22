import test from "node:test";
import assert from "node:assert/strict";

import {
  assertEvidenceReady,
} from "../../../.v8-build/src/v8/foundation/evidence-gate.js";

function createVerifiedEvidence(overrides = {}) {
  return {
    id: "v8-audit-01-evidence",
    sourceId: "https://example.com/source",
    locator: "document:section:engineering",
    excerpt:
      "Leading injection molding manufacturer with global services.",
    ingestion: "INGESTED",
    capturedAt: "2026-09-22T00:00:00.000Z",
    verificationStatus: "VERIFIED",
    section: "Engineering",
    ...overrides,
  };
}

test(
  "V8-AUDIT-01 E1: genuine engineering parameter evidence remains eligible",
  () => {
    assert.doesNotThrow(() => {
      assertEvidenceReady(
        createVerifiedEvidence({
          locator: "document:parameter:draft-angle",
          excerpt: "Draft angle: 1.5°",
          section: "Draft Angle",
          parameter: "Draft angle",
          value: 1.5,
          unit: "°",
        }),
      );
    });
  },
);

test(
  "V8-AUDIT-01 E2: genuine material-grade evidence remains eligible",
  () => {
    assert.doesNotThrow(() => {
      assertEvidenceReady(
        createVerifiedEvidence({
          locator: "document:material:grade",
          excerpt: "Material grade: SABIC CYCOLAC MG94 ABS.",
          section: "Material Selection",
          materialManufacturer: "SABIC",
          materialGrade: "CYCOLAC MG94",
        }),
      );
    });
  },
);

test(
  "V8-AUDIT-01 E3: test method and condition evidence remains eligible",
  () => {
    assert.doesNotThrow(() => {
      assertEvidenceReady(
        createVerifiedEvidence({
          locator: "document:test:impact-strength",
          excerpt:
            "Impact strength tested according to ISO 180 at 23 °C.",
          section: "Test Results",
          testMethod: "ISO 180",
          testCondition: "23 °C",
        }),
      );
    });
  },
);

test(
  "V8-AUDIT-01 E4: marketing prose with engineering-shaped metadata must be rejected",
  () => {
    assert.throws(
      () => {
        assertEvidenceReady(
          createVerifiedEvidence({
            locator: "document:section:about-us",
            excerpt:
              "Leading injection molding manufacturer with global services.",
            section: "About Us",
            parameter: "Company Size",
            value: 500,
            unit: "employees",
          }),
        );
      },
      /V8_EVIDENCE_/,
      "Generic marketing prose must not become VERIFIED engineering evidence merely because metadata fields are populated.",
    );
  },
);

test(
  "V8-AUDIT-01 E5: navigation and company prose must be rejected",
  () => {
    assert.throws(
      () => {
        assertEvidenceReady(
          createVerifiedEvidence({
            locator: "document:section:about-us",
            excerpt:
              "About us. Services. Contact our global sales team.",
            section: "About Us",
          }),
        );
      },
      /V8_EVIDENCE_/,
      "Navigation and company-introduction prose must not qualify as VERIFIED engineering evidence.",
    );
  },
);

test(
  "V8-AUDIT-01 E6: unrelated marketing prose with parameter metadata must be rejected",
  () => {
    assert.throws(
      () => {
        assertEvidenceReady(
          createVerifiedEvidence({
            locator: "document:section:company-profile",
            excerpt:
              "We provide reliable global manufacturing services and fast customer support.",
            section: "Company Profile",
            parameter: "Lead Time",
            value: 7,
            unit: "days",
          }),
        );
      },
      /V8_EVIDENCE_/,
      "A parameter/value/unit tuple must not make unrelated marketing prose engineering evidence.",
    );
  },
);

test(
  "V8-AUDIT-01 E7: contextual engineering evidence remains eligible",
  () => {
    assert.doesNotThrow(() => {
      assertEvidenceReady(
        createVerifiedEvidence({
          locator:
            "document:section:injection-molding-draft-angle",
          excerpt:
            "A draft angle of approximately 1° to 2° is commonly used to facilitate part ejection from the mold.",
          section: "Draft Angle",
          parameter: "Draft angle",
          value: 1,
          unit: "°",
          testCondition: "Injection molding part ejection",
        }),
      );
    });
  },
);