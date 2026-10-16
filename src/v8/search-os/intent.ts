
import type {
  SearchIntent,
  SearchIntentKind,
  QueryCandidate,
} from "./contracts.js";

/**
 * Rules are ordered from explicit task intent to broad topic detection.
 *
 * IMPORTANT:
 * Generic engineering vocabulary such as "injection", "mold",
 * "shrinkage", and "warpage" must never preempt a more specific
 * comparison, calculation, troubleshooting, reference, or commercial
 * signal.
 *
 * This classifier returns one primary intent because SearchIntent
 * currently models a single `kind`. It does not represent multiple
 * simultaneous intents.
 */
const RULES: readonly [RegExp, SearchIntentKind][] = [
  [
    /\b(vs\.?|versus|compare|comparison|compared with|difference between|differences between|better than|alternatives to|pros and cons)\b/i,
    "ENGINEERING_COMPARISON",
  ],
  [
    /\b(calculator|calculate|calculation|formula|equation|convert|conversion|compute|compute the)\b/i,
    "ENGINEERING_CALCULATION",
  ],
  [
    /\b(troubleshoot(?:ing)?|diagnos(?:e|is|tic)|root cause|failure analysis|defect analysis|defects?|problems?|fix(?:ing)?|sink marks?|flash(?:ing)?|short shots?|weld lines?|warpage issues?)\b/i,
    "ENGINEERING_TROUBLESHOOTING",
  ],
  [
    /\b(spec(?:ification)?s?|standards?|datasheets?|material properties|grade comparison|tolerances?|design limits|technical requirements)\b/i,
    "ENGINEERING_REFERENCE",
  ],
  [
    /\b(price|pricing|cost|quote|quotation|rfq|request for quote|manufacturer|manufacturers|supplier|suppliers|factory|factories|contract manufacturing|custom manufacturing|molding services?|moulding services?|injection molding services?|injection moulding services?)\b/i,
    "COMMERCIAL_EVALUATION",
  ],
  [
    /\b(how to|how do i|how can i|design guide|design guidelines|step[- ]by[- ]step|best practices|process parameters|setup instructions|design|dimension|dfm)\b/i,
    "ENGINEERING_HOW_TO",
  ],
  [
    /\b(mold|mould|injection molding|injection moulding|plastic injection|shrinkage|warpage|gate design|runner design|cooling channel|wall thickness|draft angle|part design)\b/i,
    "ENGINEERING_HOW_TO",
  ],
];

export function classifyIntent(
  query: QueryCandidate,
): Readonly<SearchIntent> {
  const normalizedQuery = query.normalizedQuery
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

  if (!normalizedQuery) {
    throw new Error("V8_SEARCH_INTENT_QUERY_EMPTY");
  }

  const hit = RULES.find(([pattern]) =>
    pattern.test(normalizedQuery),
  );

  const kind: SearchIntentKind =
    hit?.[1] ?? "NON_ENGINEERING";

  const confidence = hit
    ? kind === "ENGINEERING_HOW_TO" &&
      !/\b(how to|how do i|how can i|design guide|design guidelines|step[- ]by[- ]step|best practices|process parameters|setup instructions|design|dimension|dfm)\b/i.test(
        normalizedQuery,
      )
      ? 0.55
      : 0.82
    : 0.35;

  const requiredEntities = Object.freeze(
    [
      ...new Set(
        normalizedQuery
          .replace(/[^\p{L}\p{N}\s.+#/-]/gu, " ")
          .split(/\s+/)
          .map((term) => term.trim())
          .filter((term) => term.length >= 2),
      ),
    ].slice(0, 12),
  );

  return Object.freeze({
    queryId: query.id,
    kind,
    confidence,
    engineeringProblem:
      kind === "NON_ENGINEERING" ||
      kind === "NAVIGATIONAL"
        ? undefined
        : normalizedQuery,
    requiredEntities,
  });
}
