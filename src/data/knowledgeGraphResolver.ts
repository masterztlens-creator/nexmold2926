/**
 * NEXMOLD V6.2 Knowledge Graph Resolver
 * Depth-limited BFS + per-article-set reverse index.
 * No mutable global article cache: indexes are isolated by article-array identity.
 */
import type { KnowledgeArticle } from "./knowledge";
import { buildOntologyIndex, type EngineeringEntity, type EngineeringEntityKind, type EngineeringRelation } from "./engineeringOntology";
import type { ResolvedEngineeringContext } from "./engineeringResolver";

export interface EntityRelationEvidence {
  readonly sourceEntityId: string;
  readonly targetEntityId: string;
  readonly relationship: EngineeringRelation;
  readonly depth: number;
  readonly weight: number;
}

export interface ArticleEvidence {
  readonly sourceEntityId: string;
  readonly articleSlug: string;
  readonly matchType: "entity" | "canonical" | "alias" | "keyword";
  readonly weight: number;
}

export interface KnowledgeGraphContext {
  readonly primaryEntity: EngineeringEntity;
  readonly relatedEntities: readonly EngineeringEntity[];
  readonly defects: readonly EngineeringEntity[];
  readonly dfm: readonly EngineeringEntity[];
  readonly materials: readonly EngineeringEntity[];
  readonly processes: readonly EngineeringEntity[];
  readonly components: readonly EngineeringEntity[];
  readonly failureModes: readonly EngineeringEntity[];
  readonly knowledgeArticles: readonly KnowledgeArticle[];
  readonly graphDepth: number;
  readonly entityCoverage: number;
  readonly entityEvidence: readonly EntityRelationEvidence[];
  readonly articleEvidence: readonly ArticleEvidence[];
}

type ArticleEntityIndex = ReadonlyMap<string, readonly KnowledgeArticle[]>;
const articleIndexCache = new WeakMap<readonly KnowledgeArticle[], ArticleEntityIndex>();
const normalize = (value: string): string => value.trim().toLowerCase();

function articleTerms(article: KnowledgeArticle): string[] {
  const funnelEntities = article.funnel?.seo?.entities ?? [];
  const seoEntities = article.seo?.entities ?? [];
  return [...new Set([...funnelEntities, ...seoEntities, ...(article.seoKeywords ?? [])].map(normalize).filter(Boolean))];
}

export function buildArticleEntityIndex(articles: readonly KnowledgeArticle[]): ArticleEntityIndex {
  const cached = articleIndexCache.get(articles);
  if (cached) return cached;
  const ontology = buildOntologyIndex();
  const index = new Map<string, KnowledgeArticle[]>();

  for (const article of articles) {
    const terms = articleTerms(article);
    const entityIds = new Set<string>();
    for (const term of terms) {
      for (const entity of ontology.byCanonical.get(term) ?? []) entityIds.add(entity.id);
      for (const entity of ontology.byAlias.get(term) ?? []) entityIds.add(entity.id);
    }
    for (const id of entityIds) {
      const bucket = index.get(id) ?? [];
      bucket.push(article);
      index.set(id, bucket);
    }
  }
  const frozen = new Map<string, readonly KnowledgeArticle[]>([...index.entries()].map(([k, v]) => [k, Object.freeze([...v])]));
  articleIndexCache.set(articles, frozen);
  return frozen;
}

export const MAX_GRAPH_DEPTH = 2 as const;

export function resolveKnowledgeGraph(
  resolvedContext: ResolvedEngineeringContext,
  articles: readonly KnowledgeArticle[],
  maxDepth: number = MAX_GRAPH_DEPTH,
): KnowledgeGraphContext | null {
  if (!resolvedContext.primaryEntity || resolvedContext.status === "unresolved") return null;
  
  const ontology = buildOntologyIndex();
  const articleIndex = buildArticleEntityIndex(articles);
  const primaryEntity = resolvedContext.primaryEntity;
  const visited = new Set<string>();
  const entityEvidence: EntityRelationEvidence[] = [];
  const articleEvidence: ArticleEvidence[] = [];
  const articleSet = new Map<string, KnowledgeArticle>();
  
  // ==========================================
  // 核心修复：多节点并发图谱展开
  // 将所有高相关度实体同时作为起点投入遍历队列
  // ==========================================
  const queue: Array<{ id: string; depth: number }> = resolvedContext.candidates
    .filter(c => c.score >= 0.5)
    .map(c => ({ id: c.entity.id, depth: 0 }));

  // 保底机制：如果全都没过 0.5，至少把 primaryEntity 扔进去
  if (queue.length === 0) {
    queue.push({ id: primaryEntity.id, depth: 0 });
  }

  let maxDepthReached = 0;

  while (queue.length) {
    const current = queue.shift()!;
    if (visited.has(current.id) || current.depth > maxDepth) continue;
    visited.add(current.id);
    maxDepthReached = Math.max(maxDepthReached, current.depth);
    const entity = ontology.byId.get(current.id);
    if (!entity) continue;

    for (const edge of entity.relations) {
      if (current.depth < maxDepth) {
        entityEvidence.push({ 
          sourceEntityId: entity.id, 
          targetEntityId: edge.targetId, 
          relationship: edge.relationship, 
          depth: current.depth + 1, 
          weight: edge.weight / (current.depth + 1) 
        });
        if (!visited.has(edge.targetId)) {
          queue.push({ id: edge.targetId, depth: current.depth + 1 });
        }
      }
    }

    for (const article of articleIndex.get(entity.id) ?? []) {
      articleSet.set(article.slug, article);
      articleEvidence.push({ 
        sourceEntityId: entity.id, 
        articleSlug: article.slug, 
        matchType: "entity", 
        weight: entity.engineeringWeight * entity.commercialWeight 
      });
    }
  }

  const categorized: Record<EngineeringEntityKind, EngineeringEntity[]> = {
    defect: [], dfm: [], material: [], process: [], component: [], "failure-mode": [],
  };
  
  for (const id of visited) {
    if (id === primaryEntity.id) continue;
    const entity = ontology.byId.get(id);
    if (entity) categorized[entity.kind].push(entity);
  }

  return {
    primaryEntity,
    relatedEntities: Object.values(categorized).flat(),
    defects: categorized.defect,
    dfm: categorized.dfm,
    materials: categorized.material,
    processes: categorized.process,
    components: categorized.component,
    failureModes: categorized["failure-mode"],
    knowledgeArticles: [...articleSet.values()],
    graphDepth: maxDepthReached,
    entityCoverage: visited.size,
    entityEvidence,
    articleEvidence,
  };
}