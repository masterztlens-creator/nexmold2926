export interface OntologyEntity {
  id: string;
  type: "MATERIAL" | "GRADE" | "PROCESS" | "GEOMETRY" | "DEFECT" | "STANDARD" | "INDUSTRY" | "APPLICATION" | "QUERY";
  label: string;
  parentId?: string;
}

export function resolveEntityChain(entities: readonly OntologyEntity[], id: string): readonly OntologyEntity[] {
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  const chain: OntologyEntity[] = [];
  let current = byId.get(id);
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.push(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return Object.freeze(chain);
}
