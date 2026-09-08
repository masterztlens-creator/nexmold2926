import type { SearchIntent, SearchIntentKind, QueryCandidate } from "./contracts.js";

const RULES: readonly [RegExp, SearchIntentKind][] = [
  [/\b(how|design|calculate|dimension|dfm|mold|mould|injection|shrinkage|warpage|tolerance|gate|runner|cooling)\b/i, "ENGINEERING_HOW_TO"],
  [/\b(vs|versus|compare|difference|better)\b/i, "ENGINEERING_COMPARISON"],
  [/\b(calculator|calculate|formula|equation|convert)\b/i, "ENGINEERING_CALCULATION"],
  [/\b(spec|specification|standard|datasheet|property|grade)\b/i, "ENGINEERING_REFERENCE"],
  [/\b(defect|sink|flash|short shot|weld line|warpage|troubleshoot|problem)\b/i, "ENGINEERING_TROUBLESHOOTING"],
  [/\b(price|cost|manufacturer|supplier|quote|rfq)\b/i, "COMMERCIAL_EVALUATION"],
];

export function classifyIntent(query: QueryCandidate): Readonly<SearchIntent> {
  const hit = RULES.find(([pattern]) => pattern.test(query.normalizedQuery));
  const kind = hit?.[1] ?? "NON_ENGINEERING";
  const confidence = hit ? 0.82 : 0.35;
  const requiredEntities = query.normalizedQuery.split(" ").filter((x) => x.length >= 4).slice(0, 8);
  return Object.freeze({
    queryId: query.id,
    kind,
    confidence,
    engineeringProblem: kind === "NON_ENGINEERING" ? undefined : query.normalizedQuery,
    requiredEntities,
  });
}
