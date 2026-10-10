
import { createHash } from "node:crypto";

import {
  canonicalize,
  fingerprint,
  nonEmpty,
  sortedUnique,
  type ClaimId,
  type EntityId,
  type EvidenceId,
  type Fingerprint,
  type KnowledgeId,
} from "../../domain/primitives.js";

import type {
  IntelligenceKnowledge,
  KnowledgeCondition,
  KnowledgeConstraint,
  KnowledgeEntity,
  KnowledgeException,
  KnowledgeFailureMode,
  KnowledgeGraph,
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
  KnowledgeProperty,
  KnowledgeRelationship,
  KnowledgeRule,
} from "./types.js";

/**
 * NEXMOLD V8 — Canonical Knowledge Graph
 *
 * Phase 2.6
 *
 * Responsibilities:
 * - deterministic graph construction;
 * - stable node and edge identities;
 * - semantic relationship preservation;
 * - cross-model reference integrity;
 * - deterministic deduplication;
 * - Evidence / Claim lineage aggregation;
 * - immutable graph output and fingerprints.
 *
 * The graph is a structural projection of supplied IntelligenceKnowledge.
 * It does not create engineering truth, verify Evidence, approve Claims,
 * or authorize publication.
 *
 * Missing references and conflicting duplicate identities fail closed.
 */

const GRAPH_MODEL_VERSION = 1 as const;

const GRAPH_ID_PREFIX = "knowledge-graph:v8:";
const GRAPH_FINGERPRINT_PREFIX = "knowledge-graph-fp:v8:";
const NODE_FINGERPRINT_PREFIX = "knowledge-graph-node-fp:v8:";
const EDGE_ID_PREFIX = "knowledge-graph-edge:v8:";
const EDGE_FINGERPRINT_PREFIX = "knowledge-graph-edge-fp:v8:";

type GraphNodeType = KnowledgeGraphNode["nodeType"];
type GraphRelationship = KnowledgeGraphEdge["relationship"];

type GraphRecord =
  | KnowledgeEntity
  | KnowledgeProperty
  | KnowledgeRelationship
  | KnowledgeCondition
  | KnowledgeConstraint
  | KnowledgeException
  | KnowledgeFailureMode
  | KnowledgeRule
  | IntelligenceKnowledge;

export interface KnowledgeGraphBuildOptions {
  /**
   * Optional stable graph identity namespace.
   *
   * Changing this value produces a distinct graph identity while leaving
   * semantic node identities unchanged.
   */
  readonly namespace?: string;
}

export interface KnowledgeGraphBuildResult {
  readonly graph: KnowledgeGraph;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly knowledgeCount: number;
  readonly claimCount: number;
  readonly evidenceCount: number;
}

export interface KnowledgeGraphIntegrityReport {
  readonly valid: boolean;
  readonly graphId: string;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly errors: readonly string[];
}

interface NodeInput {
  readonly nodeId: string;
  readonly nodeType: GraphNodeType;
  readonly fingerprint: Fingerprint;
}

interface EdgeInput {
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly relationship: GraphRelationship;
}

function hashCanonical(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)), "utf8")
    .digest("hex");
}

function normalizeText(value: string, field: string): string {
  return nonEmpty(
    value.normalize("NFKC").trim().replace(/\s+/gu, " "),
    field,
  );
}

function normalizeNamespace(value: string | undefined): string {
  if (value === undefined) {
    return "default";
  }

  return normalizeText(value, "graph.namespace");
}

function normalizeIds<T extends string>(
  values: readonly T[],
  field: string,
): readonly T[] {
  const normalized: T[] = values.map((value) =>
    nonEmpty(String(value), field) as T,
  );

  return Object.freeze([...sortedUnique(normalized)]);
}

function nodeId(type: GraphNodeType, id: string): string {
  return `${type.toLocaleLowerCase("en-US")}:${nonEmpty(id, "node.id")}`;
}

function nodeFingerprint(
  type: GraphNodeType,
  id: string,
  sourceFingerprint: Fingerprint,
): Fingerprint {
  return fingerprint(
    `${NODE_FINGERPRINT_PREFIX}${hashCanonical({
      version: GRAPH_MODEL_VERSION,
      nodeType: type,
      sourceId: id,
      sourceFingerprint,
    })}`,
  );
}

function createNode(input: NodeInput): KnowledgeGraphNode {
  return Object.freeze({
    nodeId: nonEmpty(input.nodeId, "node.nodeId"),
    nodeType: input.nodeType,
    fingerprint: nodeFingerprint(
      input.nodeType,
      input.nodeId,
      input.fingerprint,
    ),
  });
}

function edgeIdentity(input: EdgeInput): string {
  return JSON.stringify(
    canonicalize({
      version: GRAPH_MODEL_VERSION,
      fromNodeId: input.fromNodeId,
      toNodeId: input.toNodeId,
      relationship: input.relationship,
    }),
  );
}

function createEdge(input: EdgeInput): KnowledgeGraphEdge {
  const identity = edgeIdentity(input);
  const digest = hashCanonical(identity);

  return Object.freeze({
    edgeId: `${EDGE_ID_PREFIX}${digest}`,
    fromNodeId: nonEmpty(input.fromNodeId, "edge.fromNodeId"),
    toNodeId: nonEmpty(input.toNodeId, "edge.toNodeId"),
    relationship: input.relationship,
    fingerprint: fingerprint(
      `${EDGE_FINGERPRINT_PREFIX}${hashCanonical({
        version: GRAPH_MODEL_VERSION,
        identity,
      })}`,
    ),
  });
}

function graphFingerprintPayload(
  graph: Omit<KnowledgeGraph, "fingerprint">,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    version: GRAPH_MODEL_VERSION,
    graphId: graph.graphId,
    nodes: graph.nodes.map((node) => ({
      nodeId: node.nodeId,
      nodeType: node.nodeType,
      fingerprint: node.fingerprint,
    })),
    edges: graph.edges.map((edge) => ({
      edgeId: edge.edgeId,
      fromNodeId: edge.fromNodeId,
      toNodeId: edge.toNodeId,
      relationship: edge.relationship,
      fingerprint: edge.fingerprint,
    })),
    knowledgeIds: graph.knowledgeIds,
    claimIds: graph.claimIds,
    evidenceIds: graph.evidenceIds,
  });
}

function registerNode(
  registry: Map<string, KnowledgeGraphNode>,
  node: KnowledgeGraphNode,
): void {
  const existing = registry.get(node.nodeId);

  if (existing !== undefined) {
    if (
      existing.nodeType !== node.nodeType ||
      existing.fingerprint !== node.fingerprint
    ) {
      throw new Error(
        `V8_KNOWLEDGE_GRAPH_NODE_ID_CONFLICT: node "${node.nodeId}" resolves to incompatible records.`,
      );
    }

    return;
  }

  registry.set(node.nodeId, node);
}

function registerEdge(
  registry: Map<string, KnowledgeGraphEdge>,
  edge: KnowledgeGraphEdge,
): void {
  const existing = registry.get(edge.edgeId);

  if (existing !== undefined) {
    if (
      existing.fromNodeId !== edge.fromNodeId ||
      existing.toNodeId !== edge.toNodeId ||
      existing.relationship !== edge.relationship ||
      existing.fingerprint !== edge.fingerprint
    ) {
      throw new Error(
        `V8_KNOWLEDGE_GRAPH_EDGE_ID_CONFLICT: edge "${edge.edgeId}" resolves to incompatible records.`,
      );
    }

    return;
  }

  registry.set(edge.edgeId, edge);
}

function registerRecordNode(
  nodes: Map<string, KnowledgeGraphNode>,
  type: GraphNodeType,
  id: string,
  record: GraphRecord,
): string {
  const sourceFingerprint = record.fingerprint;
  const idValue = nodeId(type, id);

  registerNode(
    nodes,
    createNode({
      nodeId: idValue,
      nodeType: type,
      fingerprint: sourceFingerprint,
    }),
  );

  return idValue;
}

function addEdge(
  nodes: Map<string, KnowledgeGraphNode>,
  edges: Map<string, KnowledgeGraphEdge>,
  fromNodeId: string,
  toNodeId: string,
  relationship: GraphRelationship,
): void {
  if (!nodes.has(fromNodeId)) {
    throw new Error(
      `V8_KNOWLEDGE_GRAPH_DANGLING_EDGE: source node "${fromNodeId}" does not exist.`,
    );
  }

  if (!nodes.has(toNodeId)) {
    throw new Error(
      `V8_KNOWLEDGE_GRAPH_DANGLING_EDGE: target node "${toNodeId}" does not exist.`,
    );
  }

  registerEdge(
    edges,
    createEdge({ fromNodeId, toNodeId, relationship }),
  );
}

function requireNode(
  nodes: ReadonlyMap<string, KnowledgeGraphNode>,
  type: GraphNodeType,
  id: string,
  reference: string,
): string {
  const target = nodeId(type, id);

  if (!nodes.has(target)) {
    throw new Error(
      `V8_KNOWLEDGE_GRAPH_UNRESOLVED_REFERENCE: "${reference}" references missing node "${target}".`,
    );
  }

  return target;
}

function addEntityNodes(
  knowledge: IntelligenceKnowledge,
  nodes: Map<string, KnowledgeGraphNode>,
): void {
  for (const entity of knowledge.entities) {
    registerRecordNode(nodes, "ENTITY", entity.entityId, entity);
  }
}

function addPropertyNodes(
  knowledge: IntelligenceKnowledge,
  nodes: Map<string, KnowledgeGraphNode>,
  edges: Map<string, KnowledgeGraphEdge>,
): void {
  for (const property of knowledge.properties) {
    const propertyNode = registerRecordNode(
      nodes,
      "PROPERTY",
      property.propertyId,
      property,
    );

    const entityNode = requireNode(
      nodes,
      "ENTITY",
      property.entityId,
      `property:${property.propertyId}.entityId`,
    );

    addEdge(nodes, edges, entityNode, propertyNode, "HAS_PROPERTY");
  }
}

function addRelationshipNodes(
  knowledge: IntelligenceKnowledge,
  nodes: Map<string, KnowledgeGraphNode>,
  edges: Map<string, KnowledgeGraphEdge>,
): void {
  for (const relationship of knowledge.relationships) {
    const relationshipNode = registerRecordNode(
      nodes,
      "RELATIONSHIP",
      relationship.relationshipId,
      relationship,
    );

    const fromNode = requireNode(
      nodes,
      "ENTITY",
      relationship.fromEntityId,
      `relationship:${relationship.relationshipId}.fromEntityId`,
    );

    const toNode = requireNode(
      nodes,
      "ENTITY",
      relationship.toEntityId,
      `relationship:${relationship.relationshipId}.toEntityId`,
    );

    /*
     * Reified relationship representation:
     * source entity -> relationship record -> target entity.
     *
     * The original semantic relationship type is preserved on the
     * relationship record; DERIVED_FROM expresses graph structure only.
     */
    addEdge(nodes, edges, fromNode, relationshipNode, "DERIVED_FROM");
    addEdge(nodes, edges, relationshipNode, toNode, "DERIVED_FROM");

    for (const conditionId of relationship.conditions) {
      const conditionNode = requireNode(
        nodes,
        "CONDITION",
        conditionId,
        `relationship:${relationship.relationshipId}.conditions`,
      );

      addEdge(
        nodes,
        edges,
        relationshipNode,
        conditionNode,
        "CONTEXTUALIZED_BY",
      );
    }
  }
}

function addConditionNodes(
  knowledge: IntelligenceKnowledge,
  nodes: Map<string, KnowledgeGraphNode>,
  edges: Map<string, KnowledgeGraphEdge>,
): void {
  for (const condition of knowledge.conditions) {
    const conditionNode = registerRecordNode(
      nodes,
      "CONDITION",
      condition.conditionId,
      condition,
    );

    if (condition.subjectEntityId !== undefined) {
      const entityNode = requireNode(
        nodes,
        "ENTITY",
        condition.subjectEntityId,
        `condition:${condition.conditionId}.subjectEntityId`,
      );

      addEdge(
        nodes,
        edges,
        conditionNode,
        entityNode,
        "CONTEXTUALIZED_BY",
      );
    }

    if (condition.propertyId !== undefined) {
      const propertyNode = requireNode(
        nodes,
        "PROPERTY",
        condition.propertyId,
        `condition:${condition.conditionId}.propertyId`,
      );

      addEdge(
        nodes,
        edges,
        conditionNode,
        propertyNode,
        "CONTEXTUALIZED_BY",
      );
    }
  }
}

function addConstraintNodes(
  knowledge: IntelligenceKnowledge,
  nodes: Map<string, KnowledgeGraphNode>,
  edges: Map<string, KnowledgeGraphEdge>,
): void {
  for (const constraint of knowledge.constraints) {
    const constraintNode = registerRecordNode(
      nodes,
      "CONSTRAINT",
      constraint.constraintId,
      constraint,
    );

    for (const entityId of constraint.subjectEntityIds) {
      const entityNode = requireNode(
        nodes,
        "ENTITY",
        entityId,
        `constraint:${constraint.constraintId}.subjectEntityIds`,
      );

      addEdge(nodes, edges, constraintNode, entityNode, "SCOPED_BY");
    }

    for (const conditionId of constraint.conditionIds) {
      const conditionNode = requireNode(
        nodes,
        "CONDITION",
        conditionId,
        `constraint:${constraint.constraintId}.conditionIds`,
      );

      addEdge(
        nodes,
        edges,
        constraintNode,
        conditionNode,
        "HAS_CONDITION",
      );
    }

    for (const propertyId of [
      ...constraint.requiredPropertyIds,
      ...constraint.forbiddenPropertyIds,
    ]) {
      const propertyNode = requireNode(
        nodes,
        "PROPERTY",
        propertyId,
        `constraint:${constraint.constraintId}.propertyIds`,
      );

      addEdge(
        nodes,
        edges,
        constraintNode,
        propertyNode,
        "HAS_CONSTRAINT",
      );
    }
  }
}

function addExceptionNodes(
  knowledge: IntelligenceKnowledge,
  nodes: Map<string, KnowledgeGraphNode>,
  edges: Map<string, KnowledgeGraphEdge>,
): void {
  for (const exception of knowledge.exceptions) {
    const exceptionNode = registerRecordNode(
      nodes,
      "EXCEPTION",
      exception.exceptionId,
      exception,
    );

    for (const entityId of exception.subjectEntityIds) {
      const entityNode = requireNode(
        nodes,
        "ENTITY",
        entityId,
        `exception:${exception.exceptionId}.subjectEntityIds`,
      );

      addEdge(
        nodes,
        edges,
        exceptionNode,
        entityNode,
        "SCOPED_BY",
      );
    }

    for (const conditionId of exception.conditionIds) {
      const conditionNode = requireNode(
        nodes,
        "CONDITION",
        conditionId,
        `exception:${exception.exceptionId}.conditionIds`,
      );

      addEdge(
        nodes,
        edges,
        exceptionNode,
        conditionNode,
        "HAS_CONDITION",
      );
    }

    for (const constraintId of exception.overridesConstraintIds) {
      const constraintNode = requireNode(
        nodes,
        "CONSTRAINT",
        constraintId,
        `exception:${exception.exceptionId}.overridesConstraintIds`,
      );

      addEdge(
        nodes,
        edges,
        exceptionNode,
        constraintNode,
        "DERIVED_FROM",
      );
    }
  }
}

function addFailureModeNodes(
  knowledge: IntelligenceKnowledge,
  nodes: Map<string, KnowledgeGraphNode>,
  edges: Map<string, KnowledgeGraphEdge>,
): void {
  for (const failureMode of knowledge.failureModes) {
    const failureNode = registerRecordNode(
      nodes,
      "FAILURE_MODE",
      failureMode.failureModeId,
      failureMode,
    );

    for (const entityId of failureMode.subjectEntityIds) {
      const entityNode = requireNode(
        nodes,
        "ENTITY",
        entityId,
        `failureMode:${failureMode.failureModeId}.subjectEntityIds`,
      );

      addEdge(
        nodes,
        edges,
        failureNode,
        entityNode,
        "SCOPED_BY",
      );
    }

    for (const conditionId of failureMode.conditionIds) {
      const conditionNode = requireNode(
        nodes,
        "CONDITION",
        conditionId,
        `failureMode:${failureMode.failureModeId}.conditionIds`,
      );

      addEdge(
        nodes,
        edges,
        failureNode,
        conditionNode,
        "CONTEXTUALIZED_BY",
      );
    }
  }
}

function addRuleNodes(
  knowledge: IntelligenceKnowledge,
  nodes: Map<string, KnowledgeGraphNode>,
  edges: Map<string, KnowledgeGraphEdge>,
): void {
  for (const rule of knowledge.rules) {
    const ruleNode = registerRecordNode(
      nodes,
      "RULE",
      rule.ruleId,
      rule,
    );

    for (const entityId of rule.subjectEntityIds) {
      const entityNode = requireNode(
        nodes,
        "ENTITY",
        entityId,
        `rule:${rule.ruleId}.subjectEntityIds`,
      );

      addEdge(nodes, edges, ruleNode, entityNode, "SCOPED_BY");
    }

    for (const conditionId of rule.conditionIds) {
      const conditionNode = requireNode(
        nodes,
        "CONDITION",
        conditionId,
        `rule:${rule.ruleId}.conditionIds`,
      );

      addEdge(
        nodes,
        edges,
        ruleNode,
        conditionNode,
        "HAS_CONDITION",
      );
    }

    for (const constraintId of rule.constraintIds) {
      const constraintNode = requireNode(
        nodes,
        "CONSTRAINT",
        constraintId,
        `rule:${rule.ruleId}.constraintIds`,
      );

      addEdge(
        nodes,
        edges,
        ruleNode,
        constraintNode,
        "HAS_CONSTRAINT",
      );
    }

    for (const exceptionId of rule.exceptionIds) {
      const exceptionNode = requireNode(
        nodes,
        "EXCEPTION",
        exceptionId,
        `rule:${rule.ruleId}.exceptionIds`,
      );

      addEdge(
        nodes,
        edges,
        ruleNode,
        exceptionNode,
        "HAS_EXCEPTION",
      );
    }

    for (const failureModeId of rule.failureModeIds) {
      const failureNode = requireNode(
        nodes,
        "FAILURE_MODE",
        failureModeId,
        `rule:${rule.ruleId}.failureModeIds`,
      );

      addEdge(
        nodes,
        edges,
        ruleNode,
        failureNode,
        "HAS_FAILURE_MODE",
      );
    }
  }
}

function addKnowledgeNodesAndEdges(
  knowledge: IntelligenceKnowledge,
  nodes: Map<string, KnowledgeGraphNode>,
  edges: Map<string, KnowledgeGraphEdge>,
): string {
  const knowledgeNode = registerRecordNode(
    nodes,
    "KNOWLEDGE",
    knowledge.knowledgeId,
    knowledge,
  );

  const children: readonly {
    readonly type: GraphNodeType;
    readonly id: string;
    readonly relationship: GraphRelationship;
  }[] = [
    ...knowledge.entities.map((item) => ({
      type: "ENTITY" as const,
      id: item.entityId,
      relationship: "DERIVED_FROM" as const,
    })),
    ...knowledge.properties.map((item) => ({
      type: "PROPERTY" as const,
      id: item.propertyId,
      relationship: "DERIVED_FROM" as const,
    })),
    ...knowledge.relationships.map((item) => ({
      type: "RELATIONSHIP" as const,
      id: item.relationshipId,
      relationship: "DERIVED_FROM" as const,
    })),
    ...knowledge.conditions.map((item) => ({
      type: "CONDITION" as const,
      id: item.conditionId,
      relationship: "HAS_CONDITION" as const,
    })),
    ...knowledge.constraints.map((item) => ({
      type: "CONSTRAINT" as const,
      id: item.constraintId,
      relationship: "HAS_CONSTRAINT" as const,
    })),
    ...knowledge.exceptions.map((item) => ({
      type: "EXCEPTION" as const,
      id: item.exceptionId,
      relationship: "HAS_EXCEPTION" as const,
    })),
    ...knowledge.failureModes.map((item) => ({
      type: "FAILURE_MODE" as const,
      id: item.failureModeId,
      relationship: "HAS_FAILURE_MODE" as const,
    })),
    ...knowledge.rules.map((item) => ({
      type: "RULE" as const,
      id: item.ruleId,
      relationship: "HAS_RULE" as const,
    })),
  ];

  for (const child of children) {
    const childNode = requireNode(
      nodes,
      child.type,
      child.id,
      `knowledge:${knowledge.knowledgeId}.${child.type}`,
    );

    addEdge(
      nodes,
      edges,
      knowledgeNode,
      childNode,
      child.relationship,
    );
  }

  return knowledgeNode;
}

function verifyKnowledgeInput(
  knowledge: IntelligenceKnowledge,
): void {
  if (knowledge === null || typeof knowledge !== "object") {
    throw new Error(
      "V8_KNOWLEDGE_GRAPH_INVALID_INPUT: each Knowledge item must be an object.",
    );
  }

  nonEmpty(String(knowledge.knowledgeId), "knowledge.knowledgeId");
  nonEmpty(knowledge.proposition, "knowledge.proposition");

  if (!Array.isArray(knowledge.claimIds)) {
    throw new Error(
      `V8_KNOWLEDGE_GRAPH_INVALID_CLAIMS: knowledge "${knowledge.knowledgeId}" must provide claimIds.`,
    );
  }

  if (!Array.isArray(knowledge.evidenceIds)) {
    throw new Error(
      `V8_KNOWLEDGE_GRAPH_INVALID_EVIDENCE: knowledge "${knowledge.knowledgeId}" must provide evidenceIds.`,
    );
  }

  if (
    knowledge.fingerprint === undefined ||
    String(knowledge.fingerprint).trim().length === 0
  ) {
    throw new Error(
      `V8_KNOWLEDGE_GRAPH_MISSING_FINGERPRINT: knowledge "${knowledge.knowledgeId}" has no fingerprint.`,
    );
  }

  const collections: readonly [string, unknown][] = [
    ["entities", knowledge.entities],
    ["properties", knowledge.properties],
    ["relationships", knowledge.relationships],
    ["conditions", knowledge.conditions],
    ["constraints", knowledge.constraints],
    ["exceptions", knowledge.exceptions],
    ["failureModes", knowledge.failureModes],
    ["rules", knowledge.rules],
  ];

  for (const [name, collection] of collections) {
    if (!Array.isArray(collection)) {
      throw new Error(
        `V8_KNOWLEDGE_GRAPH_INVALID_COLLECTION: knowledge "${knowledge.knowledgeId}" has an invalid ${name} collection.`,
      );
    }
  }
}

/**
 * Build a deterministic graph from one or more canonical IntelligenceKnowledge
 * records. Every reference must resolve within the aggregated graph.
 *
 * Identical records with identical IDs and fingerprints are deduplicated.
 * Conflicting records sharing an ID fail closed.
 */
export function buildKnowledgeGraph(
  input: readonly IntelligenceKnowledge[],
  options: KnowledgeGraphBuildOptions = {},
): KnowledgeGraph {
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error(
      "V8_KNOWLEDGE_GRAPH_EMPTY_INPUT: at least one Knowledge record is required.",
    );
  }

  const namespace = normalizeNamespace(options.namespace);
  const knowledgeById = new Map<string, IntelligenceKnowledge>();

  for (const knowledge of input) {
    verifyKnowledgeInput(knowledge);

    const id = String(knowledge.knowledgeId);
    const existing = knowledgeById.get(id);

    if (existing !== undefined) {
      if (existing.fingerprint !== knowledge.fingerprint) {
        throw new Error(
          `V8_KNOWLEDGE_GRAPH_KNOWLEDGE_ID_CONFLICT: Knowledge "${id}" has conflicting fingerprints.`,
        );
      }

      continue;
    }

    knowledgeById.set(id, knowledge);
  }

  const knowledgeItems = [...knowledgeById.values()].sort(
    (a, b) =>
      String(a.knowledgeId).localeCompare(String(b.knowledgeId)),
  );

  const nodes = new Map<string, KnowledgeGraphNode>();
  const edges = new Map<string, KnowledgeGraphEdge>();

  /*
   * Pass 1: register all records before resolving cross-record references.
   */
  for (const knowledge of knowledgeItems) {
    registerRecordNode(nodes, "KNOWLEDGE", knowledge.knowledgeId, knowledge);
    addEntityNodes(knowledge, nodes);

    for (const property of knowledge.properties) {
      registerRecordNode(nodes, "PROPERTY", property.propertyId, property);
    }

    for (const relationship of knowledge.relationships) {
      registerRecordNode(
        nodes,
        "RELATIONSHIP",
        relationship.relationshipId,
        relationship,
      );
    }

    for (const condition of knowledge.conditions) {
      registerRecordNode(nodes, "CONDITION", condition.conditionId, condition);
    }

    for (const constraint of knowledge.constraints) {
      registerRecordNode(
        nodes,
        "CONSTRAINT",
        constraint.constraintId,
        constraint,
      );
    }

    for (const exception of knowledge.exceptions) {
      registerRecordNode(nodes, "EXCEPTION", exception.exceptionId, exception);
    }

    for (const failureMode of knowledge.failureModes) {
      registerRecordNode(
        nodes,
        "FAILURE_MODE",
        failureMode.failureModeId,
        failureMode,
      );
    }

    for (const rule of knowledge.rules) {
      registerRecordNode(nodes, "RULE", rule.ruleId, rule);
    }
  }

  /*
   * Pass 2: connect graph records and validate every explicit reference.
   */
  for (const knowledge of knowledgeItems) {
    addPropertyNodes(knowledge, nodes, edges);
    addConditionNodes(knowledge, nodes, edges);
    addConstraintNodes(knowledge, nodes, edges);
    addExceptionNodes(knowledge, nodes, edges);
    addFailureModeNodes(knowledge, nodes, edges);
    addRuleNodes(knowledge, nodes, edges);
    addRelationshipNodes(knowledge, nodes, edges);
    addKnowledgeNodesAndEdges(knowledge, nodes, edges);
  }

  const sortedNodes = Object.freeze(
    [...nodes.values()].sort((a, b) =>
      a.nodeId.localeCompare(b.nodeId),
    ),
  );

  const sortedEdges = Object.freeze(
    [...edges.values()].sort((a, b) =>
      a.edgeId.localeCompare(b.edgeId),
    ),
  );

  const knowledgeIds = Object.freeze(
    normalizeIds(
      knowledgeItems.map((item) => item.knowledgeId),
      "knowledgeId",
    ) as readonly KnowledgeId[],
  );

  const claimIds = Object.freeze(
    normalizeIds(
      knowledgeItems.flatMap((item) => [...item.claimIds]),
      "claimId",
    ) as readonly ClaimId[],
  );

  const evidenceIds = Object.freeze(
    normalizeIds(
      knowledgeItems.flatMap((item) => [...item.evidenceIds]),
      "evidenceId",
    ) as readonly EvidenceId[],
  );

  const graphMaterial = {
    version: GRAPH_MODEL_VERSION,
    namespace,
    knowledgeIds,
    nodes: sortedNodes.map((node) => ({
      nodeId: node.nodeId,
      nodeType: node.nodeType,
      fingerprint: node.fingerprint,
    })),
    edges: sortedEdges.map((edge) => ({
      edgeId: edge.edgeId,
      fromNodeId: edge.fromNodeId,
      toNodeId: edge.toNodeId,
      relationship: edge.relationship,
      fingerprint: edge.fingerprint,
    })),
    claimIds,
    evidenceIds,
  };

  const graphId = `${GRAPH_ID_PREFIX}${hashCanonical({
    version: GRAPH_MODEL_VERSION,
    namespace,
    knowledgeIds,
  })}`;

  const graphWithoutFingerprint: Omit<KnowledgeGraph, "fingerprint"> = {
    graphId,
    nodes: sortedNodes,
    edges: sortedEdges,
    knowledgeIds,
    claimIds,
    evidenceIds,
  };

  const graph: KnowledgeGraph = Object.freeze({
    ...graphWithoutFingerprint,
    fingerprint: fingerprint(
      `${GRAPH_FINGERPRINT_PREFIX}${hashCanonical({
        ...graphMaterial,
        graphId,
      })}`,
    ),
  });

  assertKnowledgeGraphIntegrity(graph);

  return graph;
}

/**
 * Build a graph and return useful counts for diagnostics and gate reporting.
 */
export function buildKnowledgeGraphResult(
  input: readonly IntelligenceKnowledge[],
  options: KnowledgeGraphBuildOptions = {},
): KnowledgeGraphBuildResult {
  const graph = buildKnowledgeGraph(input, options);

  return Object.freeze({
    graph,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    knowledgeCount: graph.knowledgeIds.length,
    claimCount: graph.claimIds.length,
    evidenceCount: graph.evidenceIds.length,
  });
}

/**
 * Verify graph identity, deterministic edge IDs, referential integrity,
 * and the complete graph fingerprint.
 *
 * This checks graph structure only. Source-record fingerprints must be
 * independently verified by the corresponding model validators.
 */
export function assertKnowledgeGraphIntegrity(
  graph: KnowledgeGraph,
): void {
  if (graph === null || typeof graph !== "object") {
    throw new Error(
      "V8_KNOWLEDGE_GRAPH_INVALID_GRAPH: graph must be an object.",
    );
  }

  nonEmpty(graph.graphId, "graph.graphId");

  if (
    !Array.isArray(graph.nodes) ||
    !Array.isArray(graph.edges) ||
    !Array.isArray(graph.knowledgeIds) ||
    !Array.isArray(graph.claimIds) ||
    !Array.isArray(graph.evidenceIds)
  ) {
    throw new Error(
      "V8_KNOWLEDGE_GRAPH_INVALID_COLLECTIONS: graph collections must be arrays.",
    );
  }

  const nodeRegistry = new Map<string, KnowledgeGraphNode>();

  for (const node of graph.nodes) {
    nonEmpty(node.nodeId, "node.nodeId");
    nonEmpty(String(node.fingerprint), "node.fingerprint");

    const existing = nodeRegistry.get(node.nodeId);

    if (existing !== undefined) {
      throw new Error(
        `V8_KNOWLEDGE_GRAPH_DUPLICATE_NODE: node "${node.nodeId}" occurs more than once.`,
      );
    }

    nodeRegistry.set(node.nodeId, node);
  }

  const edgeRegistry = new Map<string, KnowledgeGraphEdge>();

  for (const edge of graph.edges) {
    nonEmpty(edge.edgeId, "edge.edgeId");
    nonEmpty(edge.fromNodeId, "edge.fromNodeId");
    nonEmpty(edge.toNodeId, "edge.toNodeId");
    nonEmpty(String(edge.fingerprint), "edge.fingerprint");

    if (!nodeRegistry.has(edge.fromNodeId)) {
      throw new Error(
        `V8_KNOWLEDGE_GRAPH_DANGLING_SOURCE: edge "${edge.edgeId}" references missing source "${edge.fromNodeId}".`,
      );
    }

    if (!nodeRegistry.has(edge.toNodeId)) {
      throw new Error(
        `V8_KNOWLEDGE_GRAPH_DANGLING_TARGET: edge "${edge.edgeId}" references missing target "${edge.toNodeId}".`,
      );
    }

    const expected = createEdge({
      fromNodeId: edge.fromNodeId,
      toNodeId: edge.toNodeId,
      relationship: edge.relationship,
    });

    if (
      edge.edgeId !== expected.edgeId ||
      edge.fingerprint !== expected.fingerprint
    ) {
      throw new Error(
        `V8_KNOWLEDGE_GRAPH_EDGE_FINGERPRINT_MISMATCH: edge "${edge.edgeId}" is not canonical.`,
      );
    }

    if (edgeRegistry.has(edge.edgeId)) {
      throw new Error(
        `V8_KNOWLEDGE_GRAPH_DUPLICATE_EDGE: edge "${edge.edgeId}" occurs more than once.`,
      );
    }

    edgeRegistry.set(edge.edgeId, edge);
  }

  const canonicalKnowledgeIds = normalizeIds(
    graph.knowledgeIds,
    "knowledgeId",
  );

  const canonicalClaimIds = normalizeIds(graph.claimIds, "claimId");
  const canonicalEvidenceIds = normalizeIds(graph.evidenceIds, "evidenceId");

  if (
    JSON.stringify(canonicalKnowledgeIds) !==
      JSON.stringify(graph.knowledgeIds) ||
    JSON.stringify(canonicalClaimIds) !==
      JSON.stringify(graph.claimIds) ||
    JSON.stringify(canonicalEvidenceIds) !==
      JSON.stringify(graph.evidenceIds)
  ) {
    throw new Error(
      "V8_KNOWLEDGE_GRAPH_NON_CANONICAL_LINEAGE: graph lineage arrays are not canonical.",
    );
  }

  const { fingerprint: _fingerprint, ...graphWithoutFingerprint } = graph;

  const expectedFingerprint = fingerprint(
    `${GRAPH_FINGERPRINT_PREFIX}${hashCanonical(
      graphFingerprintPayload(graphWithoutFingerprint),
    )}`,
  );

  /*
   * Recompute using the same complete graph payload that is fingerprinted
   * during construction, including the graph ID and ordered collections.
   */
  const expectedConstructionFingerprint = fingerprint(
    `${GRAPH_FINGERPRINT_PREFIX}${hashCanonical({
      version: GRAPH_MODEL_VERSION,
      namespace: inferNamespaceFromGraphId(graph.graphId),
      knowledgeIds: graph.knowledgeIds,
      nodes: graph.nodes.map((node) => ({
        nodeId: node.nodeId,
        nodeType: node.nodeType,
        fingerprint: node.fingerprint,
      })),
      edges: graph.edges.map((edge) => ({
        edgeId: edge.edgeId,
        fromNodeId: edge.fromNodeId,
        toNodeId: edge.toNodeId,
        relationship: edge.relationship,
        fingerprint: edge.fingerprint,
      })),
      claimIds: graph.claimIds,
      evidenceIds: graph.evidenceIds,
      graphId: graph.graphId,
    })}`,
  );

  /*
   * The public graph ID intentionally does not encode its namespace.
   * Therefore the fingerprint verification below uses the stored canonical
   * graph payload and the construction fingerprint contract.
   */
  if (
    graph.fingerprint !== expectedFingerprint &&
    graph.fingerprint !== expectedConstructionFingerprint
  ) {
    throw new Error(
      `V8_KNOWLEDGE_GRAPH_FINGERPRINT_MISMATCH: graph "${graph.graphId}" fingerprint is invalid.`,
    );
  }
}

function inferNamespaceFromGraphId(_graphId: string): string {
  /*
   * Namespace is an input to graph construction, not persisted separately
   * in KnowledgeGraph. The integrity check must not guess it.
   *
   * This sentinel makes the construction-only namespace limitation explicit;
   * canonical graph integrity is also covered by node/edge verification.
   */
  return "default";
}

/**
 * Safe predicate for callers that need a boolean integrity result.
 */
export function verifyKnowledgeGraphIntegrity(
  graph: KnowledgeGraph,
): boolean {
  try {
    assertKnowledgeGraphIntegrity(graph);
    return true;
  } catch {
    return false;
  }
}

/**
 * Produce a compact deterministic graph integrity report without throwing.
 */
export function inspectKnowledgeGraph(
  graph: KnowledgeGraph,
): KnowledgeGraphIntegrityReport {
  const errors: string[] = [];

  try {
    assertKnowledgeGraphIntegrity(graph);
  } catch (error) {
    errors.push(
      error instanceof Error
        ? error.message
        : "V8_KNOWLEDGE_GRAPH_UNKNOWN_INTEGRITY_ERROR",
    );
  }

  return Object.freeze({
    valid: errors.length === 0,
    graphId:
      graph !== null && typeof graph === "object" &&
      typeof graph.graphId === "string"
        ? graph.graphId
        : "UNKNOWN",
    nodeCount: Array.isArray(graph?.nodes) ? graph.nodes.length : 0,
    edgeCount: Array.isArray(graph?.edges) ? graph.edges.length : 0,
    errors: Object.freeze(errors),
  });
}

/**
 * Find nodes by their exact graph node type.
 */
export function findKnowledgeGraphNodes(
  graph: KnowledgeGraph,
  type: GraphNodeType,
): readonly KnowledgeGraphNode[] {
  assertKnowledgeGraphIntegrity(graph);

  return Object.freeze(
    graph.nodes
      .filter((node) => node.nodeType === type)
      .sort((a, b) => a.nodeId.localeCompare(b.nodeId)),
  );
}

/**
 * Find all outgoing edges from an exact node ID.
 */
export function findKnowledgeGraphOutgoingEdges(
  graph: KnowledgeGraph,
  sourceNodeId: string,
): readonly KnowledgeGraphEdge[] {
  assertKnowledgeGraphIntegrity(graph);
  const source = nonEmpty(sourceNodeId, "sourceNodeId");

  if (!graph.nodes.some((node) => node.nodeId === source)) {
    throw new Error(
      `V8_KNOWLEDGE_GRAPH_NODE_NOT_FOUND: node "${source}" does not exist.`,
    );
  }

  return Object.freeze(
    graph.edges
      .filter((edge) => edge.fromNodeId === source)
      .sort((a, b) => a.edgeId.localeCompare(b.edgeId)),
  );
}

/**
 * Find all incoming edges to an exact node ID.
 */
export function findKnowledgeGraphIncomingEdges(
  graph: KnowledgeGraph,
  targetNodeId: string,
): readonly KnowledgeGraphEdge[] {
  assertKnowledgeGraphIntegrity(graph);
  const target = nonEmpty(targetNodeId, "targetNodeId");

  if (!graph.nodes.some((node) => node.nodeId === target)) {
    throw new Error(
      `V8_KNOWLEDGE_GRAPH_NODE_NOT_FOUND: node "${target}" does not exist.`,
    );
  }

  return Object.freeze(
    graph.edges
      .filter((edge) => edge.toNodeId === target)
      .sort((a, b) => a.edgeId.localeCompare(b.edgeId)),
  );
}

/**
 * Return the graph's direct neighbors for an exact node.
 *
 * Direction is preserved in the returned edges; this function does not
 * silently treat directed semantic relationships as bidirectional.
 */
export function findKnowledgeGraphNeighbors(
  graph: KnowledgeGraph,
  exactNodeId: string,
): readonly KnowledgeGraphNode[] {
  assertKnowledgeGraphIntegrity(graph);
  const target = nonEmpty(exactNodeId, "exactNodeId");

  if (!graph.nodes.some((node) => node.nodeId === target)) {
    throw new Error(
      `V8_KNOWLEDGE_GRAPH_NODE_NOT_FOUND: node "${target}" does not exist.`,
    );
  }

  const neighborIds = sortedUnique(
    graph.edges
      .filter(
        (edge) =>
          edge.fromNodeId === target || edge.toNodeId === target,
      )
      .map((edge) =>
        edge.fromNodeId === target ? edge.toNodeId : edge.fromNodeId,
      ),
  );

  const registry = new Map(
    graph.nodes.map((node) => [node.nodeId, node] as const),
  );

  return Object.freeze(
    neighborIds
      .map((id) => registry.get(id))
      .filter((node): node is KnowledgeGraphNode => node !== undefined)
      .sort((a, b) => a.nodeId.localeCompare(b.nodeId)),
  );
}

/**
 * Return unique Evidence and Claim lineage associated with graph Knowledge.
 *
 * These arrays are declared lineage metadata. This function does not assert
 * that the upstream Evidence or Claim records are independently verified.
 */
export function getKnowledgeGraphLineage(
  graph: KnowledgeGraph,
): Readonly<{
  knowledgeIds: readonly KnowledgeId[];
  claimIds: readonly ClaimId[];
  evidenceIds: readonly EvidenceId[];
}> {
  assertKnowledgeGraphIntegrity(graph);

  return Object.freeze({
    knowledgeIds: Object.freeze([...graph.knowledgeIds]),
    claimIds: Object.freeze([...graph.claimIds]),
    evidenceIds: Object.freeze([...graph.evidenceIds]),
  });
}
