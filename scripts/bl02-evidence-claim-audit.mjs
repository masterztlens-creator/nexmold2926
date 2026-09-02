#!/usr/bin/env node

/**
 * NEXMOLD V7.14
 * BL02 — Evidence -> Claim Automatic Auditor
 *
 * Pipeline:
 *
 *   BL01 Sources
 *        ↓
 *   Evidence Extraction
 *        ↓
 *   Claim Extraction
 *        ↓
 *   Evidence ↔ Claim Matching
 *        ↓
 *   Conflict Detection
 *        ↓
 *   Classification
 *        ↓
 *   Immutable Audit Artifact
 *
 * Classification:
 *
 *   SUPPORTED
 *   CONDITIONAL
 *   UNSUPPORTED
 *   CONFLICTING
 *
 * IMPORTANT:
 *
 *   1. READ ONLY against source content.
 *   2. Does NOT generate article content.
 *   3. Does NOT modify source files.
 *   4. Does NOT publish anything.
 *   5. Ontology evidence can provide contextual support,
 *      but MUST NOT substitute for numeric engineering evidence.
 *
 * Output:
 *
 *   .nexmold/v714/bl02-evidence-claim-audit.json
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";

import {
  dirname,
  relative,
  resolve,
} from "node:path";

import { createHash } from "node:crypto";


/* =========================================================
 * ROOT
 * ========================================================= */

const ROOT = resolve(
  process.env.NEXMOLD_ROOT ?? process.cwd()
);


/* =========================================================
 * OUTPUT
 * ========================================================= */

const OUTPUT_DIR = resolve(
  ROOT,
  ".nexmold",
  "v714"
);

const OUTPUT_FILE = resolve(
  OUTPUT_DIR,
  "bl02-evidence-claim-audit.json"
);


/* =========================================================
 * BL01 SOURCE CONTRACT
 * ========================================================= */

const TARGETS = Object.freeze([
  {
    id: "SOURCE_A",
    path: "src/pages/resources/design-guides/wall-thickness.astro",
    type: "article",
  },

  {
    id: "SOURCE_B",
    path: "src/data/knowledge.ts",
    type: "knowledge",
  },

  {
    id: "SOURCE_C",
    path: "src/data/servicesData.ts",
    type: "services",
  },

  {
    id: "SOURCE_D",
    path: "src/data/engineeringOntology.ts",
    type: "ontology",
  },

  {
    id: "SOURCE_E",
    path: "src/data/materials.json",
    type: "materials",
  },
]);


/* =========================================================
 * CLASSIFICATION CONTRACT
 * ========================================================= */

const CLASSIFICATIONS = Object.freeze([
  "SUPPORTED",
  "CONDITIONAL",
  "UNSUPPORTED",
  "CONFLICTING",
]);


/* =========================================================
 * ENGINEERING TERMS
 * ========================================================= */

const ENGINEERING_TERMS = Object.freeze([
  "wall thickness",
  "nominal wall",
  "rib",
  "rib-to-wall",
  "rib thickness",
  "sink mark",
  "sink marks",
  "warpage",
  "warping",
  "void",
  "voids",
  "shrink",
  "shrinkage",
  "draft angle",
  "corner radius",
  "stress concentration",
  "cooling",
  "differential cooling",
  "differential shrinkage",
  "mold",
  "ejection",
  "flow",
  "flow front",
  "venting",
  "pack pressure",
  "injection speed",
  "gate location",
]);


/* =========================================================
 * NORMATIVE TERMS
 * ========================================================= */

const NORMATIVE_TERMS = Object.freeze([
  "recommended",
  "should",
  "must",
  "avoid",
  "required",
  "minimum",
  "maximum",
  "never",
  "equal to",
  "below",
  "at least",
  "ranges between",
  "recommended min",
  "recommended max",
]);


/* =========================================================
 * NUMERIC PATTERNS
 * ========================================================= */

const NUMERIC_PATTERNS = Object.freeze([
  /*
   * Single engineering dimension:
   *
   * 1.5 mm
   * 3.0mm
   * 0.060 in
   */
  /\b\d+(?:\.\d+)?\s*(?:mm|cm|in|inch|inches)\b/gi,

  /*
   * Percent:
   *
   * 50%
   * 60 %
   */
  /\b\d+(?:\.\d+)?\s*%\b/gi,

  /*
   * Angles:
   *
   * 0.5°
   * 1.5 deg
   */
  /\b\d+(?:\.\d+)?\s*(?:°|deg|degree|degrees)\b/gi,

  /*
   * Engineering units:
   *
   * 25 MPa
   * 2 GPa
   * 80 °C
   */
  /\b\d+(?:\.\d+)?\s*(?:MPa|GPa|°C|C)\b/gi,

  /*
   * Ranges:
   *
   * 1.5 - 3.0 mm
   * 1.5 to 3.0 mm
   * 50% - 60%
   */
  /\b\d+(?:\.\d+)?\s*(?:to|-)\s*\d+(?:\.\d+)?\s*(?:mm|cm|in|inch|inches|%)\b/gi,
]);


/* =========================================================
 * HELPERS
 * ========================================================= */

function fail(message) {
  console.error(`[BL02][FAIL] ${message}`);
  process.exitCode = 1;
}


function sha256(text) {
  return createHash("sha256")
    .update(text, "utf8")
    .digest("hex");
}


/**
 * Normalize text for semantic-ish comparison.
 *
 * This is intentionally conservative.
 * It is NOT a language model and does not infer meaning.
 */
function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[“”"']/g, "")
    .replace(/[–—−]/g, "-")
    .replace(/[^a-z0-9%°. -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


function lineHasEngineeringTerm(text) {
  const normalized = normalizeText(text);

  return ENGINEERING_TERMS.some(
    (term) =>
      normalized.includes(
        normalizeText(term)
      )
  );
}


function lineHasNormativeTerm(text) {
  const normalized = normalizeText(text);

  return NORMATIVE_TERMS.some(
    (term) =>
      normalized.includes(
        normalizeText(term)
      )
  );
}


/* =========================================================
 * NUMERIC EXTRACTION
 * ========================================================= */

function extractNumericValues(text) {
  const values = [];

  for (const pattern of NUMERIC_PATTERNS) {
    const matches = text.match(pattern);

    if (!matches) {
      continue;
    }

    for (const match of matches) {
      values.push(match.trim());
    }
  }

  return [
    ...new Set(values),
  ];
}


/* =========================================================
 * CONCEPT EXTRACTION
 * ========================================================= */

function extractConcepts(text) {
  const normalized = normalizeText(text);

  return ENGINEERING_TERMS.filter(
    (term) =>
      normalized.includes(
        normalizeText(term)
      )
  );
}


/* =========================================================
 * FILE READER
 * ========================================================= */

function readTarget(target) {
  const absolutePath = resolve(
    ROOT,
    target.path
  );

  if (!existsSync(absolutePath)) {
    throw new Error(
      `Missing BL01 source: ${target.path}`
    );
  }

  const content = readFileSync(
    absolutePath,
    "utf8"
  );

  return {
    ...target,

    absolutePath,

    relativePath: relative(
      ROOT,
      absolutePath
    ),

    content,

    sha256: sha256(content),

    lines: content.split(/\r?\n/),
  };
}


/* =========================================================
 * EVIDENCE RECORD
 * ========================================================= */

function makeEvidence(
  source,
  lineNumber,
  text,
  kind
) {
  return {
    id: `${source.id}:L${lineNumber}`,

    sourceId: source.id,

    sourcePath: source.relativePath,

    sourceType: source.type,

    line: lineNumber,

    kind,

    text: text.trim(),

    normalized: normalizeText(text),

    numericValues:
      extractNumericValues(text),

    concepts:
      extractConcepts(text),
  };
}


/* =========================================================
 * EVIDENCE EXTRACTION
 * ========================================================= */

function extractEvidence(source) {
  const evidence = [];

  for (
    let index = 0;
    index < source.lines.length;
    index += 1
  ) {
    const lineNumber = index + 1;

    const text =
      source.lines[index];

    if (
      !text ||
      !text.trim()
    ) {
      continue;
    }

    const numericValues =
      extractNumericValues(text);

    const hasNumber =
      numericValues.length > 0;

    const hasEngineering =
      lineHasEngineeringTerm(text);

    const hasNormative =
      lineHasNormativeTerm(text);


    /*
     * Highest-value evidence:
     *
     * numeric + engineering concept
     */
    if (
      hasNumber &&
      hasEngineering
    ) {
      evidence.push(
        makeEvidence(
          source,
          lineNumber,
          text,
          hasNormative
            ? "NUMERIC_NORMATIVE"
            : "NUMERIC_ENGINEERING"
        )
      );

      continue;
    }


    /*
     * Engineering relationship evidence.
     */
    if (hasEngineering) {
      evidence.push(
        makeEvidence(
          source,
          lineNumber,
          text,
          "ENGINEERING_RELATION"
        )
      );
    }
  }

  return evidence;
}


/* =========================================================
 * CLAIM EXTRACTION
 * ========================================================= */

function extractClaims(source, sourceIndex) {
  const claims = [];

  const claimIdOffset =
    sourceIndex * 10000;

  for (
    let index = 0;
    index < source.lines.length;
    index += 1
  ) {
    const lineNumber = index + 1;

    const text =
      source.lines[index];

    if (
      !text ||
      !text.trim()
    ) {
      continue;
    }

    const numericValues =
      extractNumericValues(text);

    const concepts =
      extractConcepts(text);

    const hasNumericClaim =
      numericValues.length > 0 &&
      concepts.length > 0;

    const hasNormativeClaim =
      concepts.length > 0 &&
      lineHasNormativeTerm(text);


    if (
      !hasNumericClaim &&
      !hasNormativeClaim
    ) {
      continue;
    }


    const claimType =
      hasNumericClaim
        ? "NUMERIC_ENGINEERING_CLAIM"
        : "ENGINEERING_CLAIM";


    claims.push({
      id:
        `CLAIM-${String(
    claimIdOffset +
    claims.length +
    1
  ).padStart(6, "0")}`,

      sourceId:
        source.id,

      sourcePath:
        source.relativePath,

      sourceType:
        source.type,

      line:
        lineNumber,

      text:
        text.trim(),

      normalized:
        normalizeText(text),

      numericValues,

      concepts,

      claimType,
    });
  }

  return claims;
}


/* =========================================================
 * SET INTERSECTION
 * ========================================================= */

function numericIntersection(
  left,
  right
) {
  const rightSet =
    new Set(right);

  return left.filter(
    (value) =>
      rightSet.has(value)
  );
}


function conceptIntersection(
  left,
  right
) {
  const rightSet =
    new Set(right);

  return left.filter(
    (value) =>
      rightSet.has(value)
  );
}


/* =========================================================
 * EVIDENCE INDEPENDENCE
 * ========================================================= */

/**
 * Evidence from the same source file should not be treated
 * as independent corroboration.
 *
 * Example:
 *
 * SOURCE_A line 57
 * SOURCE_A line 80
 *
 * are not independent sources.
 */
function isIndependentEvidence(
  claim,
  evidence
) {
  return (
    evidence.sourceId !==
    claim.sourceId
  );
}


/* =========================================================
 * CLAIM CLASSIFICATION
 * ========================================================= */

function classifyClaim(
  claim,
  allEvidence
) {
  const candidates =
    allEvidence.filter(
      (evidence) =>
        isIndependentEvidence(
          claim,
          evidence
        )
    );


  const exactNumeric = [];

  const conceptSupport = [];

  const ontologyOnly = [];


  for (
    const evidence of candidates
  ) {
    const numericMatch =
      numericIntersection(
        claim.numericValues,
        evidence.numericValues
      );

    const conceptMatch =
      conceptIntersection(
        claim.concepts,
        evidence.concepts
      );


    /*
     * Numeric + concept match.
     *
     * This is the strongest automatic
     * corroboration available to BL02.
     */
    if (
      numericMatch.length > 0 &&
      conceptMatch.length > 0
    ) {
      exactNumeric.push({
        evidenceId:
          evidence.id,

        sourceId:
          evidence.sourceId,

        sourcePath:
          evidence.sourcePath,

        sourceType:
          evidence.sourceType,

        line:
          evidence.line,

        text:
          evidence.text,

        kind:
          evidence.kind,

        numericMatch,

        conceptMatch,
      });

      continue;
    }


    /*
     * Conceptual support.
     */
    if (
      conceptMatch.length > 0
    ) {
      const record = {
        evidenceId:
          evidence.id,

        sourceId:
          evidence.sourceId,

        sourcePath:
          evidence.sourcePath,

        sourceType:
          evidence.sourceType,

        line:
          evidence.line,

        text:
          evidence.text,

        kind:
          evidence.kind,

        conceptMatch,
      };


      /*
       * Ontology is explicitly separated.
       *
       * It cannot establish numeric limits.
       */
      if (
        evidence.sourceId ===
        "SOURCE_D"
      ) {
        ontologyOnly.push(
          record
        );
      } else {
        conceptSupport.push(
          record
        );
      }
    }
  }


  /* =======================================================
   * NUMERIC CLAIM
   * ======================================================= */

  if (
    claim.numericValues.length > 0
  ) {
    /*
     * Numeric + concept independently corroborated.
     */
    if (
      exactNumeric.length > 0
    ) {
      return {
        classification:
          "SUPPORTED",

        rationale:
          "An independent BL01 source contains matching numeric evidence and an overlapping engineering concept.",

        supportingEvidence:
          exactNumeric,

        contextualEvidence:
          conceptSupport,

        ontologyEvidence:
          ontologyOnly,
      };
    }


    /*
     * Engineering concept exists elsewhere,
     * but the numeric limit does not.
     */
    if (
      conceptSupport.length > 0 ||
      ontologyOnly.length > 0
    ) {
      return {
        classification:
          "CONDITIONAL",

        rationale:
          "The engineering concept is represented by independent BL01 evidence, but the specific numeric assertion lacks independent numeric corroboration.",

        supportingEvidence:
          [],

        contextualEvidence:
          conceptSupport,

        ontologyEvidence:
          ontologyOnly,
      };
    }


    /*
     * No evidence.
     */
    return {
      classification:
        "UNSUPPORTED",

      rationale:
        "No independent BL01 evidence supports the specific numeric engineering assertion.",

      supportingEvidence:
        [],

      contextualEvidence:
        [],

      ontologyEvidence:
        [],
    };
  }


  /* =======================================================
   * NON-NUMERIC ENGINEERING CLAIM
   * ======================================================= */

  if (
    conceptSupport.length > 0
  ) {
    return {
      classification:
        "SUPPORTED",

      rationale:
        "The engineering concept is independently represented by another non-ontology BL01 source.",

      supportingEvidence:
        conceptSupport,

      contextualEvidence:
        [],

      ontologyEvidence:
        ontologyOnly,
    };
  }


  /*
   * Ontology-only support.
   */
  if (
    ontologyOnly.length > 0
  ) {
    return {
      classification:
        "CONDITIONAL",

      rationale:
        "Only ontology relationship evidence is available. Ontology establishes semantic relationships but does not establish engineering numeric limits.",

      supportingEvidence:
        [],

      contextualEvidence:
        [],

      ontologyEvidence:
        ontologyOnly,
    };
  }


  /*
   * No support.
   */
  return {
    classification:
      "UNSUPPORTED",

    rationale:
      "No independent BL01 evidence was found for this engineering claim.",

    supportingEvidence:
      [],

    contextualEvidence:
      [],

    ontologyEvidence:
      [],
  };
}


/* =========================================================
 * CONFLICT DETECTION — BL02.1
 * =========================================================
 *
 * BL02.1 principles:
 *
 * 1. Shared concept alone does NOT constitute conflict.
 * 2. Numeric assertions must belong to the same engineering
 *    dimension before they can conflict.
 * 3. Different material/process contexts are not automatically
 *    conflicting.
 * 4. Duplicate claims are deduplicated.
 * 5. Equivalent numeric representations are normalized.
 * 6. BL02 remains READ ONLY.
 *
 * Engineering dimensions currently recognized:
 *
 *   WALL_THICKNESS
 *   RIB_THICKNESS
 *   DIMENSIONAL_TOLERANCE
 *   MOLD_TEMPERATURE
 *   MELT_TEMPERATURE
 *   COOLING_TIME
 *   CYCLE_TIME
 *   DRAFT_ANGLE
 *   CORNER_RADIUS
 *   OTHER_NUMERIC
 */


/* =========================================================
 * NORMALIZE CLAIM TEXT FOR DEDUPLICATION
 * ========================================================= */

function normalizeClaimForDedup(
  claim
) {
  return String(
    claim.text || ""
  )
    .toLowerCase()
    .replace(
      /<[^>]+>/g,
      " "
    )
    .replace(
      /["'`]/g,
      ""
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


/* =========================================================
 * ENGINEERING DIMENSION
 * ========================================================= */

function detectEngineeringDimension(
  claim
) {
  const text =
    normalizeClaimForDedup(
      claim
    );


  /*
   * Dimensional tolerance / molding accuracy.
   *
   * IMPORTANT:
   *
   * This must be evaluated BEFORE generic
   * "mold" matching.
   */
  if (
    /±\s*\d/.test(text) ||
    /tolerance/.test(text) ||
    /accuracy/.test(text) ||
    /precision/.test(text)
  ) {
    return "DIMENSIONAL_TOLERANCE";
  }


  if (
    /wall thickness/.test(text) ||
    /nominal wall/.test(text) ||
    /main wall/.test(text)
  ) {
    return "WALL_THICKNESS";
  }


  if (
    /rib thickness/.test(text) ||
    /rib.*thickness/.test(text)
  ) {
    return "RIB_THICKNESS";
  }


  if (
    /mold temperature/.test(text) ||
    /mould temperature/.test(text) ||
    /heated mold/.test(text) ||
    /heated mould/.test(text) ||
    /mold temperatures/.test(text) ||
    /mould temperatures/.test(text)
  ) {
    return "MOLD_TEMPERATURE";
  }


  if (
    /melt temperature/.test(text) ||
    /barrel temperature/.test(text) ||
    /processing temperature/.test(text)
  ) {
    return "MELT_TEMPERATURE";
  }


  if (
    /cooling time/.test(text)
  ) {
    return "COOLING_TIME";
  }


  if (
    /cycle time/.test(text)
  ) {
    return "CYCLE_TIME";
  }


  if (
    /draft angle/.test(text) ||
    /draft/.test(text)
  ) {
    return "DRAFT_ANGLE";
  }


  if (
    /corner radius/.test(text) ||
    /internal radius/.test(text) ||
    /fillet radius/.test(text)
  ) {
    return "CORNER_RADIUS";
  }


  return "OTHER_NUMERIC";
}


/* =========================================================
 * CONTEXT DETECTION
 * ========================================================= */

function detectEngineeringContext(
  claim
) {
  const text =
    normalizeClaimForDedup(
      claim
    );


  const contexts = [];


  /*
   * Material/process context.
   *
   * We intentionally use conservative detection.
   * Unknown context remains UNKNOWN.
   */

  const materialPatterns = [
    [
      /\babs\b/,
      "ABS",
    ],

    [
      /\bpc\b/,
      "PC",
    ],

    [
      /\bpa6\b/,
      "PA6",
    ],

    [
      /\bpa66\b/,
      "PA66",
    ],

    [
      /\bpp\b/,
      "PP",
    ],

    [
      /\bpe\b/,
      "PE",
    ],

    [
      /\bpeek\b/,
      "PEEK",
    ],

    [
      /\bpom\b/,
      "POM",
    ],

    [
      /\btpu\b/,
      "TPU",
    ],

    [
      /\bsilicone\b/,
      "SILICONE",
    ],

    [
      /\blsr\b/,
      "LSR",
    ],
  ];


  for (
    const [
      pattern,
      value,
    ]
      of materialPatterns
  ) {
    if (
      pattern.test(text)
    ) {
      contexts.push(
        `MATERIAL:${value}`
      );
    }
  }


  if (
    /liquid injection molding/.test(
      text
    )
  ) {
    contexts.push(
      "PROCESS:LIQUID_INJECTION_MOLDING"
    );
  }


  if (
    /injection molding/.test(
      text
    ) ||
    /injection moulding/.test(
      text
    )
  ) {
    contexts.push(
      "PROCESS:INJECTION_MOLDING"
    );
  }


  if (
    /cold runner/.test(text)
  ) {
    contexts.push(
      "PROCESS:COLD_RUNNER"
    );
  }


  if (
    /hot runner/.test(text)
  ) {
    contexts.push(
      "PROCESS:HOT_RUNNER"
    );
  }


  if (
    contexts.length === 0
  ) {
    contexts.push(
      "CONTEXT:UNKNOWN"
    );
  }


  return [
    ...new Set(
      contexts
    ),
  ];
}


/* =========================================================
 * NUMERIC NORMALIZATION
 * ========================================================= */

/**
 * Convert textual numeric assertions into comparable
 * numeric tokens.
 *
 * This is intentionally conservative.
 *
 * We do NOT attempt to infer engineering meaning from
 * bare numbers.
 */

function normalizeNumericValue(
  value
) {
  const text =
    String(value || "")
      .toLowerCase()
      .replace(
        /,/g,
        ""
      )
      .trim();


  const match =
    text.match(
      /(-?\d+(?:\.\d+)?)/
    );


  if (!match) {
    return null;
  }


  const number =
    Number(
      match[1]
    );


  if (
    !Number.isFinite(
      number
    )
  ) {
    return null;
  }


  let unit =
    "UNKNOWN";


  if (
    /mm/.test(text)
  ) {
    unit = "MM";
  } else if (
    /inch|in\b/.test(text)
  ) {
    unit = "IN";
  } else if (
    /°c|celsius/.test(text)
  ) {
    unit = "C";
  } else if (
    /degree|degrees|°/.test(text)
  ) {
    unit = "DEGREE";
  } else if (
    /%/.test(text)
  ) {
    unit = "PERCENT";
  }


  return {
    number,
    unit,
  };
}


/* =========================================================
 * NUMERIC SIGNATURE
 * ========================================================= */

function numericSignature(
  claim
) {
  return (
    claim.numericValues || []
  )
    .map(
      normalizeNumericValue
    )
    .filter(Boolean)
    .map(
      (item) =>
        `${item.number}:${item.unit}`
    )
    .sort()
    .join("|");
}


/* =========================================================
 * CLAIM DUPLICATE CHECK
 * ========================================================= */

function isDuplicateClaim(
  left,
  right
) {
  const leftText =
    normalizeClaimForDedup(
      left
    );

  const rightText =
    normalizeClaimForDedup(
      right
    );


  /*
   * Exact normalized text duplicate.
   */
  if (
    leftText ===
    rightText
  ) {
    return true;
  }


  /*
   * Same normalized numeric signature +
   * same engineering dimension +
   * same contextual class.
   *
   * This catches formatting duplicates without
   * collapsing genuinely different assertions.
   */
  const leftDimension =
    detectEngineeringDimension(
      left
    );

  const rightDimension =
    detectEngineeringDimension(
      right
    );


  if (
    leftDimension !==
    rightDimension
  ) {
    return false;
  }


  const leftNumeric =
    numericSignature(
      left
    );

  const rightNumeric =
    numericSignature(
      right
    );


  if (
    leftNumeric.length === 0 ||
    rightNumeric.length === 0
  ) {
    return false;
  }


  if (
    leftNumeric !==
    rightNumeric
  ) {
    return false;
  }


  const leftContext =
    detectEngineeringContext(
      left
    ).join("|");

  const rightContext =
    detectEngineeringContext(
      right
    ).join("|");


  return (
    leftContext ===
    rightContext
  );
}


/* =========================================================
 * SAME ENGINEERING CONTEXT
 * ========================================================= */

function sameEngineeringContext(
  left,
  right
) {
  const leftContext =
    detectEngineeringContext(
      left
    );

  const rightContext =
    detectEngineeringContext(
      right
    );


  /*
   * Unknown context must not be treated as a
   * contradiction by itself.
   *
   * If either side is unknown, the detector remains
   * conservative and allows review only when the
   * engineering dimension is identical.
   */
  const leftKnown =
    leftContext.filter(
      (item) =>
        item !==
        "CONTEXT:UNKNOWN"
    );

  const rightKnown =
    rightContext.filter(
      (item) =>
        item !==
        "CONTEXT:UNKNOWN"
    );


  if (
    leftKnown.length === 0 ||
    rightKnown.length === 0
  ) {
    return true;
  }


  return leftKnown.some(
    (item) =>
      rightKnown.includes(
        item
      )
  );
}


/* =========================================================
 * SAME ENGINEERING DIMENSION
 * ========================================================= */

function sameEngineeringDimension(
  left,
  right
) {
  return (
    detectEngineeringDimension(
      left
    ) ===
    detectEngineeringDimension(
      right
    )
  );
}


/* =========================================================
 * CONFLICT DETECTION
 * ========================================================= */

function detectConflicts(
  claims
) {
  const conflicts = [];


  const numericClaims =
    claims.filter(
      (claim) =>
        claim.numericValues &&
        claim.numericValues.length > 0
    );


  /*
   * -------------------------------------------------------
   * CLAIM DEDUPLICATION
   * -------------------------------------------------------
   *
   * Duplicate claims are NOT conflicts.
   *
   * We intentionally do not remove the original claims
   * from the report. Instead, duplicate relationships are
   * simply excluded from conflict generation.
   */

  for (
    let i = 0;
    i < numericClaims.length;
    i += 1
  ) {
    for (
      let j = i + 1;
      j < numericClaims.length;
      j += 1
    ) {
      const left =
        numericClaims[i];

      const right =
        numericClaims[j];


      /*
       * Same physical line.
       */
      if (
        left.sourceId ===
          right.sourceId &&
        left.line ===
          right.line
      ) {
        continue;
      }

      /*
 * -------------------------------------------------------
 * SOURCE-LEVEL INDEPENDENCE FIREWALL
 * -------------------------------------------------------
 *
 * Claims from the same source cannot provide
 * independent corroboration or independent conflict.
 *
 * Same source + different lines are still one source.
 */
if (
  left.sourceId ===
  right.sourceId
) {
  continue;
}


      /*
       * Exact / semantic duplicate.
       */
      if (
        isDuplicateClaim(
          left,
          right
        )
      ) {
        continue;
      }


      /*
       * ---------------------------------------------------
       * ENGINEERING DIMENSION FILTER
       * ---------------------------------------------------
       *
       * This is the critical BL02.1 change.
       *
       * "mold" is not a sufficient engineering dimension.
       */
      if (
        !sameEngineeringDimension(
          left,
          right
        )
      ) {
        continue;
      }


      /*
       * ---------------------------------------------------
       * CONTEXT FILTER
       * ---------------------------------------------------
       */
      if (
        !sameEngineeringContext(
          left,
          right
        )
      ) {
        continue;
      }


      /*
       * ---------------------------------------------------
       * CONCEPT FILTER
       * ---------------------------------------------------
       *
       * Retain concept overlap as an additional safety
       * condition, but no longer use it by itself.
       */
      const sameConcept =
        conceptIntersection(
          left.concepts,
          right.concepts
        );


      if (
        sameConcept.length === 0
      ) {
        continue;
      }


      /*
       * ---------------------------------------------------
       * NUMERIC COMPARISON
       * ---------------------------------------------------
       *
       * Exact textual overlap is NOT required.
       *
       * We have already eliminated duplicates.
       *
       * Therefore a remaining pair with:
       *
       *   same dimension
       *   same context
       *   same concept
       *   different numeric assertion
       *
       * becomes a genuine REVIEW candidate.
       */
      const leftSignature =
        numericSignature(
          left
        );

      const rightSignature =
        numericSignature(
          right
        );


      if (
        leftSignature.length === 0 ||
        rightSignature.length === 0
      ) {
        continue;
      }


      if (
        leftSignature ===
        rightSignature
      ) {
        continue;
      }


      conflicts.push({
        conflictId:
          `CONFLICT-${String(
            conflicts.length + 1
          ).padStart(4, "0")}`,

        leftClaimId:
          left.id,

        rightClaimId:
          right.id,

        leftSourceId:
          left.sourceId,

        rightSourceId:
          right.sourceId,

        leftLine:
          left.line,

        rightLine:
          right.line,

        engineeringDimension:
          detectEngineeringDimension(
            left
          ),

        leftContext:
          detectEngineeringContext(
            left
          ),

        rightContext:
          detectEngineeringContext(
            right
          ),

        concepts:
          sameConcept,

        leftValues:
          left.numericValues,

        rightValues:
          right.numericValues,

        leftNumericSignature:
          leftSignature,

        rightNumericSignature:
          rightSignature,

        leftText:
          left.text,

        rightText:
          right.text,

        status:
          "REQUIRES_REVIEW",

        reason:
          "Same engineering dimension and overlapping engineering context contain different numeric assertions. BL02.1 does not determine which assertion is authoritative.",
      });
    }
  }


  return conflicts;
}

function applyConflictClassification(
  results,
  conflicts
) {
  for (
    const conflict of conflicts
  ) {
    const left =
      results.find(
        (item) =>
          item.claimId ===
          conflict.leftClaimId
      );

    const right =
      results.find(
        (item) =>
          item.claimId ===
          conflict.rightClaimId
      );


    if (left) {
      left.classification =
        "CONFLICTING";

      left.rationale =
        "Potential conflicting numeric assertion detected for the same engineering concept. Human/source authority review is required.";
    }


    if (right) {
      right.classification =
        "CONFLICTING";

      right.rationale =
        "Potential conflicting numeric assertion detected for the same engineering concept. Human/source authority review is required.";
    }
  }
}


/* =========================================================
 * BUILD AUDIT REPORT
 * ========================================================= */

function buildReport(
  sources,
  evidence,
  claims,
  results,
  conflicts
) {
  applyConflictClassification(
    results,
    conflicts
  );


  const counts = {
    SUPPORTED: 0,
    CONDITIONAL: 0,
    UNSUPPORTED: 0,
    CONFLICTING: 0,
  };


  for (
    const result of results
  ) {
    if (
      CLASSIFICATIONS.includes(
        result.classification
      )
    ) {
      counts[
        result.classification
      ] += 1;
    }
  }


  return {
    schema:
      "nexmold.v7.14.bl02-evidence-claim-audit.v2",

    generatedAt:
      new Date().toISOString(),

    mode:
      "READ_ONLY",

    sourceCount:
      sources.length,

    evidenceCount:
      evidence.length,

    claimCount:
      claims.length,

    classificationCounts:
      counts,

    policy: {
      ontologyCannotSubstituteForNumericEvidence:
        true,

      sameSourceCannotProvideIndependentCorroboration:
        true,

      conflictRequiresHumanReview:
        true,

      articleGeneration:
        false,

      claimGeneration:
        false,

      sourceModification:
        false,

      publicationGate:
        false,
    },

    sources:
      sources.map(
        (source) => ({
          id:
            source.id,

          path:
            source.relativePath,

          type:
            source.type,

          sha256:
            source.sha256,
        })
      ),

    evidence,

    claims:
      results,

    conflicts,
  };
}


/* =========================================================
 * SUMMARY
 * ========================================================= */

function printSummary(
  report
) {
  console.log("");

  console.log(
    "======================================================="
  );

  console.log(
    "[NEXMOLD][V7.14] BL02 — EVIDENCE -> CLAIM AUDIT"
  );

  console.log(
    "======================================================="
  );

  console.log(
    `Sources       : ${report.sourceCount}`
  );

  console.log(
    `Evidence      : ${report.evidenceCount}`
  );

  console.log(
    `Claims        : ${report.claimCount}`
  );

  console.log("");

  console.log(
    `SUPPORTED     : ${report.classificationCounts.SUPPORTED}`
  );

  console.log(
    `CONDITIONAL   : ${report.classificationCounts.CONDITIONAL}`
  );

  console.log(
    `UNSUPPORTED   : ${report.classificationCounts.UNSUPPORTED}`
  );

  console.log(
    `CONFLICTING   : ${report.classificationCounts.CONFLICTING}`
  );

  console.log("");

  console.log(
    `Conflicts     : ${report.conflicts.length}`
  );

  console.log("");

  console.log(
    `[REPORT] ${OUTPUT_FILE}`
  );

  console.log("");
}


/* =========================================================
 * MAIN
 * ========================================================= */

function main() {
  console.log(
    "[BL02] Loading BL01 sources from current project..."
  );


  let sources;


  /* -------------------------------------------------------
   * LOAD SOURCES
   * ------------------------------------------------------- */

  try {
    sources =
      TARGETS.map(
        readTarget
      );
  } catch (error) {
    fail(
      error instanceof Error
        ? error.message
        : String(error)
    );

    return;
  }


  console.log(
    `[BL02] Loaded ${sources.length} source files.`
  );


  /* -------------------------------------------------------
   * EXTRACT EVIDENCE
   * ------------------------------------------------------- */

  const evidence =
    sources.flatMap(
      extractEvidence
    );


  console.log(
    `[BL02] Extracted ${evidence.length} evidence records.`
  );


  /* -------------------------------------------------------
   * EXTRACT CLAIMS
   * ------------------------------------------------------- */

  const claims =
    sources.flatMap(
      (source, sourceIndex) =>
        extractClaims(
          source,
          sourceIndex
        )
    );


  console.log(
    `[BL02] Extracted ${claims.length} claim candidates.`
  );


  /* -------------------------------------------------------
   * CLASSIFY CLAIMS
   * ------------------------------------------------------- */

  const results =
    claims.map(
      (claim) => {
        const classification =
          classifyClaim(
            claim,
            evidence
          );


        return {
          claimId:
            claim.id,

          sourceId:
            claim.sourceId,

          sourcePath:
            claim.sourcePath,

          sourceType:
            claim.sourceType,

          line:
            claim.line,

          text:
            claim.text,

          claimType:
            claim.claimType,

          numericValues:
            claim.numericValues,

          concepts:
            claim.concepts,

          classification:
            classification.classification,

          rationale:
            classification.rationale,

          supportingEvidence:
            classification.supportingEvidence,

          contextualEvidence:
            classification.contextualEvidence,

          ontologyEvidence:
            classification.ontologyEvidence,
        };
      }
    );


  /* -------------------------------------------------------
   * CONFLICT DETECTION
   * ------------------------------------------------------- */

  const conflicts =
    detectConflicts(
      claims
    );


  console.log(
    `[BL02] Detected ${conflicts.length} potential conflicts.`
  );


  /* -------------------------------------------------------
   * BUILD REPORT
   * ------------------------------------------------------- */

  const report =
    buildReport(
      sources,
      evidence,
      claims,
      results,
      conflicts
    );


  /* -------------------------------------------------------
   * OUTPUT DIRECTORY
   * ------------------------------------------------------- */

  mkdirSync(
    dirname(OUTPUT_FILE),
    {
      recursive: true,
    }
  );


  /* -------------------------------------------------------
   * WRITE AUDIT ARTIFACT
   * ------------------------------------------------------- */

  writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(
      report,
      null,
      2
    ),
    "utf8"
  );


  /* -------------------------------------------------------
   * SUMMARY
   * ------------------------------------------------------- */

  printSummary(
    report
  );


  /* -------------------------------------------------------
   * WARNINGS
   * ------------------------------------------------------- */

  if (
    report.classificationCounts.CONFLICTING >
    0
  ) {
    console.log(
      "[BL02][WARN] Conflicting claims require human/source-authority review."
    );
  }


  if (
    report.classificationCounts.UNSUPPORTED >
    0
  ) {
    console.log(
      "[BL02][WARN] Unsupported claims detected."
    );
  }


  console.log(
    "[BL02] READ ONLY — no source content modified."
  );

  console.log(
    "[BL02] No article generated."
  );

  console.log(
    "[BL02] No publication attempted."
  );
}


/* =========================================================
 * EXECUTE
 * ========================================================= */

main();
