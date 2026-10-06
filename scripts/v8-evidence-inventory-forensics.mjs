import assert from "node:assert/strict";

import {
  InMemoryFoundationStore,
} from "../.v8-build/src/v8/foundation/store.js";

import {
  contentFingerprint,
} from "../.v8-build/src/v8/foundation/hash.js";

import {
  HttpPageFetcher,
} from "../.v8-build/src/v8/acquisition/page-fetcher.js";

import {
  runV8ArticleRuntime,
} from "../.v8-build/src/v8/runtime/article-runtime.js";


/*
 * ============================================================================
 * NEXMOLD V8 — EVIDENCE INVENTORY FORENSIC DIAGNOSTIC
 *
 * Purpose
 * -------
 * Diagnose Local-vs-GitHub divergence after REAL INTERNET acquisition without
 * modifying any production Runtime selection rule.
 *
 * This diagnostic is intentionally read-only with respect to V8 semantics.
 *
 * Required chain:
 *
 *   REAL INTERNET
 *        ↓
 *   SOURCE
 *        ↓
 *   SNAPSHOT
 *        ↓
 *   EVIDENCE INVENTORY
 *        ↓
 *   DIAGNOSTIC OBSERVATION
 *
 * This file does NOT:
 *
 *   - alter selectRuntimeEvidence()
 *   - alter scoreEvidence()
 *   - alter topic thresholds
 *   - alter fail-closed behavior
 *   - create synthetic Evidence
 *   - create synthetic Snapshot
 *   - use SearXNG
 *   - use Tavily
 *   - bypass HttpPageFetcher
 *   - replace the Runtime Evidence invariant
 *
 * The purpose is to answer one forensic question:
 *
 *   Why can Local and GitHub both report 184 Evidence records while only
 *   Local finds topic-relevant Evidence?
 *
 * The diagnostic therefore exposes the actual persisted Evidence payloads
 * produced by the same acquisition path.
 * ============================================================================
 */


/*
 * ============================================================================
 * Configuration
 * ============================================================================
 */

const CANDIDATE_URL =
  "https://www.protolabs.com/services/injection-molding/plastic-injection-molding/design-guidelines/";

const QUESTION =
  "How should plastic injection molding wall thickness be evaluated?";

const RESEARCH_SEEDS = Object.freeze([
  Object.freeze({
    url: CANDIDATE_URL,

    source:
      "DIRECT",

    reason:
      "Explicit Internet research entry point for V8 Evidence Inventory forensic comparison.",
  }),
]);

const TOPIC_TOKENS = Object.freeze([
  "plastic",
  "injection",
  "molding",
  "wall",
  "thickness",
]);

const TOPIC_PHRASES = Object.freeze([
  "plastic injection molding wall thickness",
  "injection molding wall thickness",
  "plastic injection molding",
  "injection molding wall",
  "molding wall thickness",
  "plastic injection",
  "injection molding",
  "molding wall",
  "wall thickness",
]);


/*
 * ============================================================================
 * Runtime infrastructure
 * ============================================================================
 */

const store =
  new InMemoryFoundationStore();

const pageFetcher =
  new HttpPageFetcher({
    timeoutMs: 20_000,
    maxBytes: 5_000_000,
  });


/*
 * ============================================================================
 * Diagnostic normalization
 *
 * This normalization is deliberately independent from the production
 * Runtime's semantic scoring implementation.
 *
 * It is NOT used to make Runtime decisions.
 *
 * Its only purpose is to make Local-vs-GitHub textual differences visible.
 * ============================================================================
 */

function normalizeDiagnosticText(
  value,
) {
  return String(
    value ?? "",
  )
    .normalize("NFKC")
    .replace(
      /&nbsp;/giu,
      " ",
    )
    .replace(
      /&amp;/giu,
      "&",
    )
    .replace(
      /&lt;/giu,
      "<",
    )
    .replace(
      /&gt;/giu,
      ">",
    )
    .replace(
      /&quot;/giu,
      '"',
    )
    .replace(
      /&#39;/giu,
      "'",
    )
    .replace(
      /&#(\d+);/gu,
      (
        _match,
        code,
      ) => {
        const numericCode =
          Number(code);

        if (
          !Number.isInteger(
            numericCode,
          ) ||
          numericCode < 0 ||
          numericCode > 0x10ffff
        ) {
          return " ";
        }

        return String.fromCodePoint(
          numericCode,
        );
      },
    )
    .replace(
      /&#x([0-9a-f]+);/giu,
      (
        _match,
        code,
      ) => {
        const numericCode =
          Number.parseInt(
            code,
            16,
          );

        if (
          !Number.isInteger(
            numericCode,
          ) ||
          numericCode < 0 ||
          numericCode > 0x10ffff
        ) {
          return " ";
        }

        return String.fromCodePoint(
          numericCode,
        );
      },
    )
    .replace(
      /[–—−]/gu,
      "-",
    )
    .replace(
      /\s+/gu,
      " ",
    )
    .trim()
    .toLocaleLowerCase(
      "en-US",
    );
}


/*
 * ============================================================================
 * Evidence searchable projection
 *
 * This is diagnostic-only.
 *
 * It mirrors the fields that are relevant to the Runtime's Evidence search
 * surface but intentionally does not call or modify Runtime internals.
 * ============================================================================
 */

function evidenceDiagnosticText(
  payload,
) {
  return normalizeDiagnosticText(
    [
      payload.section,
      payload.table,
      payload.parameter,
      payload.row,
      payload.excerpt,
      payload.locator,
    ]
      .filter(
        (value) =>
          value !== undefined &&
          value !== null &&
          String(value).trim().length > 0,
      )
      .join(" "),
  );
}


/*
 * ============================================================================
 * Topic phrase/token diagnostics
 * ============================================================================
 */

function phraseMatches(
  normalizedText,
) {
  return TOPIC_PHRASES.filter(
    (phrase) =>
      normalizedText.includes(
        phrase,
      ),
  );
}


function tokenMatches(
  normalizedText,
) {
  return TOPIC_TOKENS.filter(
    (token) =>
      normalizedText.includes(
        token,
      ),
  );
}


/*
 * ============================================================================
 * Diagnostic lexical score
 *
 * IMPORTANT:
 *
 * This is NOT the Runtime score.
 *
 * It exists solely to sort forensic output so that the strongest textual
 * candidates appear first.
 *
 * No production decision consumes this value.
 * ============================================================================
 */

function diagnosticScore(
  normalizedText,
  phrases,
  tokens,
) {
  let score = 0;

  for (
    const phrase of phrases
  ) {
    score +=
      phrase.split(" ").length * 20;
  }

  score +=
    tokens.length * 5;

  if (
    normalizedText.includes(
      "wall thickness",
    )
  ) {
    score += 50;
  }

  if (
    normalizedText.includes(
      "injection molding",
    )
  ) {
    score += 40;
  }

  if (
    normalizedText.includes(
      "plastic injection molding",
    )
  ) {
    score += 60;
  }

  return score;
}


/*
 * ============================================================================
 * Latest Foundation record resolution
 *
 * auditTrail() contains immutable historical versions.
 *
 * The diagnostic must inspect the latest version of every aggregate rather
 * than counting historical versions as independent current Evidence records.
 * ============================================================================
 */

function latestRecordsByAggregate(
  aggregateType,
) {
  const latest =
    new Map();

  for (
    const record of
      store
        .auditTrail()
        .filter(
          (item) =>
            item.aggregateType ===
            aggregateType,
        )
  ) {
    const existing =
      latest.get(
        record.aggregateId,
      );

    if (
      existing === undefined ||
      record.version >
        existing.version
    ) {
      latest.set(
        record.aggregateId,
        record,
      );
    }
  }

  return latest;
}


/*
 * ============================================================================
 * Safe JSON serialization
 *
 * Foundation records contain branded primitive values but no circular
 * references. This replacer additionally makes undefined values explicit
 * enough for machine comparison without changing the source payload.
 * ============================================================================
 */

function cleanValue(
  value,
) {
  if (
    value === undefined
  ) {
    return null;
  }

  if (
    Array.isArray(value)
  ) {
    return value.map(
      cleanValue,
    );
  }

  if (
    value !== null &&
    typeof value === "object"
  ) {
    const output = {};

    for (
      const [
        key,
        child,
      ] of Object.entries(
        value,
      )
    ) {
      output[key] =
        cleanValue(
          child,
        );
    }

    return output;
  }

  return value;
}


/*
 * ============================================================================
 * Diagnostic Evidence projection
 * ============================================================================
 */

function buildEvidenceDiagnostic(
  record,
  index,
) {
  const payload =
    record.payload ?? {};

  const normalizedEvidenceText =
    evidenceDiagnosticText(
      payload,
    );

  const phrases =
    phraseMatches(
      normalizedEvidenceText,
    );

  const tokens =
    tokenMatches(
      normalizedEvidenceText,
    );

  const score =
    diagnosticScore(
      normalizedEvidenceText,
      phrases,
      tokens,
    );

  const topicMatched =
    phrases.length > 0 ||
    tokens.length > 0;

  return {
    evidenceIndex:
      index,

    evidenceId:
      record.aggregateId,

    evidenceRecordVersion:
      record.version,

    evidenceState:
      record.state,

    evidenceFingerprint:
      record.fingerprint,

    sourceId:
      payload.sourceId ??
      null,

    snapshotId:
      payload.snapshotId ??
      null,

    candidateUrl:
      payload.discoveryProvenance?.canonicalUrl ??
      payload.discoveryProvenance?.discoveredUrl ??
      null,

    requestedSeedUrl:
      payload.discoveryProvenance?.researchSeedUrl ??
      null,

    discoveryStatus:
      payload.discoveryProvenance?.status ??
      null,

    discoveryProvider:
      payload.discoveryProvenance?.provider ??
      null,

    locator:
      payload.locator ??
      null,

    section:
      payload.section ??
      null,

    table:
      payload.table ??
      null,

    parameter:
      payload.parameter ??
      null,

    row:
      payload.row ??
      null,

    excerpt:
      payload.excerpt ??
      null,

    value:
      payload.value ??
      null,

    unit:
      payload.unit ??
      null,

    verificationStatus:
      payload.verificationStatus ??
      null,

    extractionMethod:
      payload.extractionMethod ??
      null,

    extractionConfidence:
      payload.extractionConfidence ??
      null,

    normalizedEvidenceText,

    coreTopicMatched:
      topicMatched,

    phraseMatches:
      phrases,

    tokenMatches:
      tokens,

    diagnosticScore:
      score,
  };
}


/*
 * ============================================================================
 * Snapshot diagnostics
 * ============================================================================
 */

function buildSnapshotDiagnostic(
  snapshotRecord,
) {
  const payload =
    snapshotRecord.payload ?? {};

  const rawPayload =
    typeof payload.payload ===
      "string"
      ? payload.payload
      : "";

  return {
    snapshotId:
      snapshotRecord.aggregateId,

    version:
      snapshotRecord.version,

    state:
      snapshotRecord.state,

    fingerprint:
      snapshotRecord.fingerprint,

    sourceId:
      payload.sourceId ??
      null,

    capturedAt:
      payload.capturedAt ??
      null,

    locator:
      payload.locator ??
      null,

    requestedUrl:
      payload.requestedUrl ??
      null,

    finalUrl:
      payload.finalUrl ??
      null,

    redirectChain:
      payload.redirectChain ??
      [],

    mediaType:
      payload.mediaType ??
      null,

    metadataOnly:
      payload.metadataOnly ??
      null,

    byteLength:
      payload.byteLength ??
      null,

    declaredContentHash:
      payload.contentHash ??
      null,

    runtimePayloadByteLength:
      rawPayload.length,

    runtimePayloadFingerprint:
      rawPayload.length > 0
        ? contentFingerprint(
            rawPayload,
          )
        : null,
  };
}


/*
 * ============================================================================
 * Runtime input
 *
 * This intentionally mirrors the V8 Evidence Trace Gate configuration at
 * SHA ed6fc88.
 * ============================================================================
 */

const opportunity = {
  keyword: {
    keyword:
      "plastic injection molding wall thickness",

    normalized:
      "plastic injection molding wall thickness",

    source:
      "SEED",

    intent:
      "INFORMATIONAL",

    terms: [
      "wall thickness",
      "injection molding",
    ],
  },

  score:
    0.9,

  demand:
    0.8,

  relevance:
    1,

  competition:
    0.3,

  authorityGap:
    0.7,

  conversionPotential:
    0.6,

  reasons: [
    "V8 evidence inventory forensic diagnostic",
  ],
};


/*
 * ============================================================================
 * Execute REAL INTERNET Runtime
 *
 * Runtime is allowed to fail.
 *
 * A Runtime Evidence-selection failure is the exact condition this diagnostic
 * is designed to inspect.
 *
 * The Foundation Store remains available because the caller owns the Store
 * instance and the diagnostic reads it after Runtime termination.
 * ============================================================================
 */

let runtimeError = null;

try {
  await runV8ArticleRuntime({
    opportunity,

    searchProvider:
      undefined,

    pageFetcher,

    store,

    actor: {
      id:
        "v8-evidence-inventory-forensics",

      role:
        "SYSTEM",
    },

    acquisition: {
      maxQueries:
        1,

      maxCandidates:
        1,

      maxPages:
        1,

      maxDepth:
        0,

      sameHostOnly:
        true,

      researchSeeds:
        RESEARCH_SEEDS,

      actorId:
        "v8-evidence-inventory-forensics",
    },

    scope: {
      id:
        "scope:v8:evidence-inventory-forensics",

      geography:
        "GLOBAL",

      industries: [
        "PLASTIC_INJECTION_MOLDING",
      ],

      languages: [
        "en",
      ],
    },

    context: {
      id:
        "context:v8:evidence-inventory-forensics",

      purpose:
        "Diagnose Local-vs-GitHub real Internet Evidence inventory divergence.",

      variables: {
        sourceMode:
          "REAL_INTERNET",

        evidencePolicy:
          "VERIFIED_ONLY",

        diagnosticMode:
          "READ_ONLY",

        runtimeDecisionPolicy:
          "UNCHANGED",
      },
    },

    problem: {
      id:
        "problem:v8:evidence-inventory-forensics",

      question:
        QUESTION,

      constraints: [
        "Use real Internet-acquired sources only.",
        "Do not modify Runtime Evidence selection rules.",
        "Do not create synthetic Evidence.",
        "Persisted Evidence inventory is authoritative for this diagnostic.",
      ],
    },

    title:
      "V8 Evidence Inventory Forensic Diagnostic",
  });
} catch (
  error
) {
  runtimeError =
    error instanceof Error
      ? {
          name:
            error.name,

          code:
            typeof error.code ===
              "string"
              ? error.code
              : null,

          message:
            error.message,

          stack:
            error.stack ??
            null,
        }
      : {
          name:
            "UNKNOWN_ERROR",

          code:
            null,

          message:
            String(error),

          stack:
            null,
        };
}


/*
 * ============================================================================
 * Resolve latest records
 * ============================================================================
 */

const latestSourceRecords =
  latestRecordsByAggregate(
    "SOURCE",
  );

const latestSnapshotRecords =
  latestRecordsByAggregate(
    "SNAPSHOT",
  );

const latestEvidenceRecords =
  latestRecordsByAggregate(
    "EVIDENCE",
  );


/*
 * ============================================================================
 * Hard diagnostic invariants
 *
 * These invariants do not change Runtime semantics.
 * They merely guarantee that the diagnostic actually observed an acquisition
 * inventory instead of silently producing an empty report.
 * ============================================================================
 */

assert.ok(
  latestSourceRecords.size > 0,
  "V8_FORENSIC_SOURCE_INVENTORY_EMPTY",
);

assert.ok(
  latestSnapshotRecords.size > 0,
  "V8_FORENSIC_SNAPSHOT_INVENTORY_EMPTY",
);

assert.ok(
  latestEvidenceRecords.size > 0,
  "V8_FORENSIC_EVIDENCE_INVENTORY_EMPTY",
);


/*
 * ============================================================================
 * Snapshot inventory
 * ============================================================================
 */

const snapshots =
  [
    ...latestSnapshotRecords.values(),
  ]
    .map(
      buildSnapshotDiagnostic,
    )
    .sort(
      (
        left,
        right,
      ) =>
        left.snapshotId.localeCompare(
          right.snapshotId,
        ),
    );


/*
 * ============================================================================
 * Evidence inventory
 *
 * Deterministic ordering:
 *
 *   1. Evidence aggregate ID
 *
 * This prevents local-vs-GitHub output from being affected by Map insertion
 * ordering.
 * ============================================================================
 */

const evidenceRecords =
  [
    ...latestEvidenceRecords.values(),
  ].sort(
    (
      left,
      right,
    ) =>
      left.aggregateId.localeCompare(
        right.aggregateId,
      ),
  );


const evidenceDiagnostics =
  evidenceRecords.map(
    (
      record,
      index,
    ) =>
      buildEvidenceDiagnostic(
        record,
        index,
      ),
  );


/*
 * ============================================================================
 * Topic candidates
 *
 * Only Evidence containing at least one diagnostic topic token or phrase is
 * surfaced in the candidate section.
 *
 * The complete inventory remains available through inventoryCount and the
 * deterministic allEvidence section.
 * ============================================================================
 */

const topicCandidates =
  evidenceDiagnostics
    .filter(
      (
        item,
      ) =>
        item.coreTopicMatched,
    )
    .sort(
      (
        left,
        right,
      ) => {
        if (
          right.diagnosticScore !==
          left.diagnosticScore
        ) {
          return (
            right.diagnosticScore -
            left.diagnosticScore
          );
        }

        return left.evidenceId.localeCompare(
          right.evidenceId,
        );
      },
    );


/*
 * ============================================================================
 * Exact wall-thickness candidates
 * ============================================================================
 */

const wallThicknessCandidates =
  evidenceDiagnostics
    .filter(
      (
        item,
      ) =>
        item.normalizedEvidenceText.includes(
          "wall thickness",
        ),
    )
    .sort(
      (
        left,
        right,
      ) =>
        left.evidenceId.localeCompare(
          right.evidenceId,
        ),
    );


/*
 * ============================================================================
 * Per-token inventory
 *
 * This is particularly useful when Local and GitHub both contain 184 Evidence
 * but the topic-bearing records differ.
 * ============================================================================
 */

const tokenInventory = {};

for (
  const token of
    TOPIC_TOKENS
) {
  tokenInventory[token] =
    evidenceDiagnostics.filter(
      (
        item,
      ) =>
        item.normalizedEvidenceText.includes(
          token,
        ),
    ).length;
}


/*
 * ============================================================================
 * Phrase inventory
 * ============================================================================
 */

const phraseInventory = {};

for (
  const phrase of
    TOPIC_PHRASES
) {
  phraseInventory[phrase] =
    evidenceDiagnostics.filter(
      (
        item,
      ) =>
        item.normalizedEvidenceText.includes(
          phrase,
        ),
    ).length;
}


/*
 * ============================================================================
 * Evidence fingerprint inventory
 *
 * This makes the Local-vs-GitHub comparison deterministic.
 * ============================================================================
 */

const evidenceFingerprintInventory =
  evidenceDiagnostics.map(
    (
      item,
    ) => ({
      evidenceId:
        item.evidenceId,

      evidenceFingerprint:
        item.evidenceFingerprint,

      snapshotId:
        item.snapshotId,

      excerpt:
        item.excerpt,

      locator:
        item.locator,
    }),
  );


/*
 * ============================================================================
 * Final forensic report
 * ============================================================================
 */

const report = {
  diagnostic:
    "NEXMOLD_V8_EVIDENCE_INVENTORY_FORENSIC",

  diagnosticVersion:
    "1.0.0",

  sourceCommit:
    "ed6fc88a29e28b50b7a872326ea04f60ea261537",

  candidateUrl:
    CANDIDATE_URL,

  question:
    QUESTION,

  searchProvider:
    "NONE",

  acquisitionOwner:
    "V8",

  runtimeSelectionPolicy:
    "UNCHANGED",

  failClosedPolicy:
    "UNCHANGED",

  runtimeError,

  sourceCount:
    latestSourceRecords.size,

  snapshotCount:
    latestSnapshotRecords.size,

  evidenceInventoryCount:
    evidenceDiagnostics.length,

  topicCandidateCount:
    topicCandidates.length,

  wallThicknessCandidateCount:
    wallThicknessCandidates.length,

  tokenInventory,

  phraseInventory,

  snapshots,

  topicCandidates,

  wallThicknessCandidates,

  evidenceFingerprintInventory,

  /*
   * Full deterministic inventory is intentionally included.
   *
   * This is what makes Local-vs-GitHub comparison exact rather than based only
   * on the number "184".
   */
  allEvidence:
    evidenceDiagnostics,
};


/*
 * ============================================================================
 * Human-readable console output
 *
 * JSON is emitted first so CI logs can be machine-parsed.
 * ============================================================================
 */

console.log(
  JSON.stringify(
    cleanValue(report),
    null,
    2,
  ),
);


/*
 * ============================================================================
 * Explicit forensic summary
 * ============================================================================
 */

console.error(
  "",
);

console.error(
  "[NEXMOLD][V8-EVIDENCE-FORENSICS] SUMMARY",
);

console.error(
  `[V8-EVIDENCE-FORENSICS] sourceCount=${report.sourceCount}`,
);

console.error(
  `[V8-EVIDENCE-FORENSICS] snapshotCount=${report.snapshotCount}`,
);

console.error(
  `[V8-EVIDENCE-FORENSICS] evidenceInventory=${report.evidenceInventoryCount}`,
);

console.error(
  `[V8-EVIDENCE-FORENSICS] topicCandidates=${report.topicCandidateCount}`,
);

console.error(
  `[V8-EVIDENCE-FORENSICS] wallThicknessCandidates=${report.wallThicknessCandidateCount}`,
);

console.error(
  `[V8-EVIDENCE-FORENSICS] runtimeError=${
    report.runtimeError?.code ??
    report.runtimeError?.name ??
    "NONE"
  }`,
);

console.error(
  "[V8-EVIDENCE-FORENSICS] tokenInventory=" +
    JSON.stringify(
      report.tokenInventory,
    ),
);

console.error(
  "[V8-EVIDENCE-FORENSICS] phraseInventory=" +
    JSON.stringify(
      report.phraseInventory,
    ),
);


/*
 * ============================================================================
 * Diagnostic completion contract
 *
 * A Runtime Evidence-selection failure is EXPECTED for this diagnostic when
 * the underlying Local/GitHub divergence exists.
 *
 * Therefore this script only fails when acquisition/storage itself failed to
 * produce a valid Evidence inventory.
 *
 * It does NOT convert Runtime semantic failure into Runtime success.
 * ============================================================================
 */

console.error(
  "[NEXMOLD][V8-EVIDENCE-FORENSICS] DIAGNOSTIC COMPLETE",
);

console.error(
  "[NEXMOLD][V8-EVIDENCE-FORENSICS] Runtime production invariants were not modified.",
);