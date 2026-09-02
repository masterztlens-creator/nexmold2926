/**
 * NEXMOLD V6.2 Engineering Ontology
 * Stable entity IDs, aliases, weights and typed engineering relations.
 */

export type EngineeringEntityKind =
  | "defect"
  | "dfm"
  | "material"
  | "process"
  | "component"
  | "failure-mode";

export type EngineeringRelation =
  | "related"
  | "parent"
  | "child"
  | "mitigated-by"
  | "caused-by"
  | "material-for"
  | "process-for";

export interface EngineeringRelationEdge {
  readonly targetId: string;
  readonly relationship: EngineeringRelation;
  readonly weight: number;
}

export interface EngineeringEntity {
  readonly id: string;
  readonly kind: EngineeringEntityKind;
  readonly canonical: string;
  readonly aliases: readonly string[];
  readonly engineeringWeight: number;
  readonly commercialWeight: number;
  readonly relatedEntityIds: readonly string[];
  readonly relations: readonly EngineeringRelationEdge[];
}

const E = (
  id: string,
  kind: EngineeringEntityKind,
  canonical: string,
  aliases: readonly string[],
  engineeringWeight: number,
  commercialWeight: number,
  relations: readonly EngineeringRelationEdge[] = [],
): EngineeringEntity => ({
  id,
  kind,
  canonical,
  aliases,
  engineeringWeight,
  commercialWeight,
  relations,
  relatedEntityIds: relations.map((r) => r.targetId),
});

/**
 * Keep this catalog deterministic and reviewable. It is intentionally not inferred
 * from article text: ontology is the semantic authority, articles are evidence.
 */
export const ENGINEERING_ENTITIES: readonly EngineeringEntity[] = [
  E("defect.weld-line", "defect", "weld line", ["weld lines", "weldline", "knit line", "knit lines"], .95, .75, [
    { targetId: "dfm.gate-location", relationship: "mitigated-by", weight: 1 },
    { targetId: "dfm.wall-thickness", relationship: "mitigated-by", weight: .8 },
    { targetId: "process.injection-speed", relationship: "mitigated-by", weight: .75 },
  ]),
  E("defect.sink-mark", "defect", "sink mark", ["sink marks", "sink"], .95, .8, [
    { targetId: "dfm.wall-thickness", relationship: "caused-by", weight: 1 },
    { targetId: "dfm.rib-design", relationship: "mitigated-by", weight: .9 },
    { targetId: "process.pack-pressure", relationship: "mitigated-by", weight: .8 },
  ]),
  E("defect.warpage", "defect", "warpage", ["warpage", "warping", "warp"], 1, .9, [
    { targetId: "dfm.wall-thickness", relationship: "mitigated-by", weight: 1 },
    { targetId: "process.cooling", relationship: "caused-by", weight: .9 },
    { targetId: "material.pp", relationship: "material-for", weight: .6 },
  ]),
  E("defect.flash", "defect", "mold flash", ["flash", "flashing"], .9, .85, [
    { targetId: "dfm.parting-line", relationship: "mitigated-by", weight: .9 },
    { targetId: "process.clamping", relationship: "caused-by", weight: .8 },
  ]),
  E("defect.short-shot", "defect", "short shot", ["short shots", "short-shot", "incomplete fill"], .95, .8, [
    { targetId: "process.injection-speed", relationship: "mitigated-by", weight: .8 },
    { targetId: "dfm.gate-location", relationship: "mitigated-by", weight: .8 },
  ]),
  E("defect.voids", "defect", "voids", ["void", "internal void", "air void"], .9, .75, [
    { targetId: "dfm.wall-thickness", relationship: "caused-by", weight: .9 },
    { targetId: "process.pack-pressure", relationship: "mitigated-by", weight: .8 },
  ]),

  E("dfm.wall-thickness", "dfm", "wall thickness", ["wall thickness", "wall thickness design", "nominal wall"], 1, .95, [
    { targetId: "defect.sink-mark", relationship: "related", weight: 1 },
    { targetId: "defect.warpage", relationship: "related", weight: .9 },
    { targetId: "defect.voids", relationship: "related", weight: .8 },
  ].map((r) => ({ ...r, relationship: r.relationship === "mitigates" ? "related" : r.relationship } as EngineeringRelationEdge))),
  E("dfm.gate-location", "dfm", "gate location", ["gate location", "gate placement", "gate position"], .95, .9, [
    { targetId: "defect.weld-line", relationship: "mitigated-by", weight: .95 },
    { targetId: "defect.short-shot", relationship: "mitigated-by", weight: .8 },
  ]),
  E("dfm.rib-design", "dfm", "rib design", ["ribs", "rib thickness", "rib design"], .85, .8, [
    { targetId: "defect.sink-mark", relationship: "mitigated-by", weight: .9 },
  ]),
  E("dfm.draft-angle", "dfm", "draft angle", ["draft", "draft angles", "draft angle design"], .85, .75),
  E("dfm.parting-line", "dfm", "parting line", ["parting line", "parting-line"], .9, .8, [
    { targetId: "defect.flash", relationship: "mitigated-by", weight: .9 },
  ]),
  E("dfm.undercut", "dfm", "undercut", ["undercuts", "part undercut"], .85, .85),

  E("material.abs", "material", "ABS", ["abs", "acrylonitrile butadiene styrene"], .9, .9),
  E("material.pc", "material", "polycarbonate", ["pc", "polycarbonate resin"], .9, .9),
  E("material.pp", "material", "polypropylene", ["pp", "polypropylene resin"], .9, .9, [
    { targetId: "defect.warpage", relationship: "material-for", weight: .7 },
  ]),
  E("material.pa", "material", "nylon", ["pa", "polyamide", "nylon resin"], .85, .85),
  E("material.pom", "material", "POM", ["pom", "acetal", "polyoxymethylene"], .85, .85),
  E("material.peek", "material", "PEEK", ["peek", "polyether ether ketone"], .95, .9),
  E("material.pet", "material", "PET", ["pet", "polyethylene terephthalate"], .8, .8),
  E("material.pbt", "material", "PBT", ["pbt", "polybutylene terephthalate"], .8, .8),

  E("process.injection-molding", "process", "injection molding", ["injection molding", "plastic injection molding", "injection moulding"], 1, 1, [
    { targetId: "component.injection-mold", relationship: "process-for", weight: 1 },
  ]),
  E("process.scientific-molding", "process", "scientific molding", ["scientific injection molding", "scientific molding"], .95, .95),
  E("process.injection-speed", "process", "injection speed", ["fill speed", "injection velocity", "injection rate"], .8, .8),
  E("process.pack-pressure", "process", "pack pressure", ["packing pressure", "holding pressure", "pack pressure"], .85, .85),
  E("process.cooling", "process", "mold cooling", ["cooling", "cooling system", "cooling time"], .9, .9),
  E("process.clamping", "process", "clamping", ["clamp force", "clamping force", "tonnage"], .85, .9),

  E("component.injection-mold", "component", "injection mold", ["injection mould", "mold", "mould", "tooling"], 1, 1),
  E("component.hot-runner", "component", "hot runner", ["hot runner system", "hot-runner"], .9, .9),
  E("component.cold-runner", "component", "cold runner", ["cold runner system", "cold-runner"], .8, .8),
  E("component.gate", "component", "gate", ["injection gate", "mold gate"], .85, .85),
  E("component.ejector", "component", "ejection system", ["ejector", "ejector system", "ejection"], .85, .85),
  E("component.cooling-channel", "component", "cooling channel", ["cooling channels", "conformal cooling"], .9, .9),

  E("failure-mode.differential-shrinkage", "failure-mode", "differential shrinkage", ["uneven shrinkage", "differential cooling shrinkage"], .95, .9, [
    { targetId: "defect.warpage", relationship: "caused-by", weight: 1 },
    { targetId: "dfm.wall-thickness", relationship: "caused-by", weight: .8 },
  ]),
  E("failure-mode.poor-venting", "failure-mode", "poor venting", ["poor venting", "insufficient venting", "venting issue"], .85, .8, [
    { targetId: "defect.short-shot", relationship: "caused-by", weight: .7 },
  ]),
];

// Validate ontology at module load; fail fast on accidental dangling edges.
const entityIds = new Set(ENGINEERING_ENTITIES.map((e) => e.id));
for (const entity of ENGINEERING_ENTITIES) {
  for (const edge of entity.relations) {
    if (!entityIds.has(edge.targetId)) {
      throw new Error(`[NEXMOLD Ontology Fatal] Dangling relation: ${entity.id} -> ${edge.targetId}`);
    }
    if (edge.weight < 0 || edge.weight > 1) {
      throw new Error(`[NEXMOLD Ontology Fatal] Invalid edge weight: ${entity.id} -> ${edge.targetId}`);
    }
  }
}

export interface OntologyIndex {
  readonly byId: ReadonlyMap<string, EngineeringEntity>;
  readonly byCanonical: ReadonlyMap<string, readonly EngineeringEntity[]>;
  readonly byAlias: ReadonlyMap<string, readonly EngineeringEntity[]>;
}

const normalize = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, " ");

function createIndex(entities: readonly EngineeringEntity[]): OntologyIndex {
  const byId = new Map<string, EngineeringEntity>();
  const byCanonical = new Map<string, EngineeringEntity[]>();
  const byAlias = new Map<string, EngineeringEntity[]>();
  for (const entity of entities) {
    byId.set(entity.id, entity);
    const canonical = normalize(entity.canonical);
    const list = byCanonical.get(canonical) ?? [];
    list.push(entity);
    byCanonical.set(canonical, list);
    for (const alias of entity.aliases) {
      const key = normalize(alias);
      const aliases = byAlias.get(key) ?? [];
      aliases.push(entity);
      byAlias.set(key, aliases);
    }
  }
  return { byId, byCanonical, byAlias };
}

export const ontologyIndex: OntologyIndex = createIndex(ENGINEERING_ENTITIES);
export function buildOntologyIndex(): OntologyIndex { return ontologyIndex; }
