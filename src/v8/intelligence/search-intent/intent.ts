
import { inferIntent, normalizeText, type SearchIntent } from "../shared.js";
export interface IntentObservation { readonly query: string; readonly intent: SearchIntent; readonly confidence: number; readonly signals: readonly string[]; }
export function classifyIntent(query: string): IntentObservation {
  const q = normalizeText(query); const intent = inferIntent(q); const signals: string[] = [];
  if (/\b(vs|versus|compare|comparison)\b/.test(q)) signals.push("comparison-marker");
  if (/\b(price|cost|quote|supplier|manufacturer|factory|custom)\b/.test(q)) signals.push("commercial-marker");
  if (/^(how|what|why|when|where|guide|tutorial)\b/.test(q)) signals.push("question-marker");
  const confidence = intent === "UNKNOWN" ? 0.35 : Math.min(0.98, 0.58 + signals.length * 0.15);
  return Object.freeze({ query, intent, confidence, signals: Object.freeze(signals) });
}
export function classifyMany(queries: readonly string[]): readonly IntentObservation[] { return Object.freeze(queries.map(classifyIntent)); }
