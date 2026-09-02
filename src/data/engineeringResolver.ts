/**
 * NEXMOLD V6.2 Engineering Resolver
 * Deterministic lexical candidate discovery + semantic tie handling.
 */
import { buildOntologyIndex, type EngineeringEntity, type OntologyIndex } from "./engineeringOntology";

export type ResolutionStatus = "resolved" | "ambiguous" | "unresolved";

export interface ResolvedEngineeringContext {
  readonly query: string;
  readonly primaryEntity: EngineeringEntity | null;
  readonly candidates: readonly { entity: EngineeringEntity; score: number }[];
  readonly status: ResolutionStatus;
  readonly industrySlug?: string;
  readonly subsystemSlug?: string;
}

const normalize = (value: string): string => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
const tokens = (value: string): Set<string> => new Set(normalize(value).split(" ").filter((x) => x.length > 1));

function similarity(query: string, entity: EngineeringEntity): number {
  const q = normalize(query);
  const exact = [entity.canonical, ...entity.aliases].some((x) => normalize(x) === q);
  if (exact) return 1;

  const qt = tokens(q);
  if (!qt.size) return 0;

  let best = 0;
  for (const phrase of [entity.canonical, ...entity.aliases]) {
    const pt = tokens(phrase);
    if (!pt.size) continue;
    // 核心修复：只看实体词组有多少被包含在了 Query 中，而不惩罚 Query (也就是痛点描述) 句子太长
    const overlap = [...pt].filter((t) => qt.has(t)).length;
    best = Math.max(best, overlap / pt.size);
  }
  return best;
}

export function resolveEngineeringPain(
  query: string,
  context: { industrySlug?: string; subsystemSlug?: string } = {},
  ontology: OntologyIndex = buildOntologyIndex(),
): ResolvedEngineeringContext {
  const normalized = normalize(query);
  if (!normalized) return { query, primaryEntity: null, candidates: [], status: "unresolved", ...context };

  const direct = [ontology.byCanonical.get(normalized), ontology.byAlias.get(normalized)].flatMap((x) => x ?? []);
  const pool = direct.length ? [...new Map(direct.map((e) => [e.id, e])).values()] : [...ontology.byId.values()];
  const candidates = pool
    .map((entity) => ({ entity, score: similarity(query, entity) }))
    .filter((x) => x.score >= (direct.length ? 0.99 : 0.34))
    .sort((a, b) => b.score - a.score || b.entity.commercialWeight - a.entity.commercialWeight);

  if (!candidates.length) return { query, primaryEntity: null, candidates: [], status: "unresolved", ...context };
  const top = candidates[0];
  const second = candidates[1];
  const ambiguous = !!second && top.score < 0.99 && top.score - second.score < 0.08;

  return {
    query,
    primaryEntity: top.entity,
    candidates: candidates.slice(0, 8),
    status: ambiguous ? "ambiguous" : "resolved",
    ...context,
  };
}
