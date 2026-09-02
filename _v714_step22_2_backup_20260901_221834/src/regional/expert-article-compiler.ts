/**
 * NEXMOLD V7.14 — Expert Article Compiler v1
 *
 * Evidence assimilation boundary:
 * KnowledgeArticle / EngineeringKnowledgePack / optional public snapshots
 *   -> ExpertArticleContract
 *
 * This module is deterministic. It never invents engineering values.
 */
import type { KnowledgeArticle } from "../data/knowledge";
import {
  compileEngineeringKnowledgeFromArticle,
  type EngineeringKnowledgePack,
  type EngineeringKnowledgeNode,
} from "./engineering-knowledge-compiler";
import type {
  ExpertArticleContract,
  ExpertClaim,
  ExpertDecision,
  ExpertEvidence,
  ExpertFact,
  ExpertMechanism,
  ExpertSource,
  ExpertValidation,
} from "./expert-article-contract";
import type { RegionalPublishArtifact } from "./types";

export interface PublicEvidenceSnapshot {
  readonly schema?: string;
  readonly sources?: readonly {
    readonly id: string;
    readonly url: string;
    readonly title?: string;
    readonly domain?: string;
    readonly tier?: number;
    readonly retrievedAt?: string;
    readonly publishedAt?: string;
    readonly contentHash?: string;
    readonly text?: string;
  }[];
}

function clean(value: unknown): string {
  return typeof value === "string"
    ? value.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim()
    : "";
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map(clean).filter(Boolean))];
}

function hash(value: unknown): string {
  // Stable non-cryptographic identity for compiler-internal IDs.
  // Publication/source integrity hashes remain owned by the Factory/artifact.
  const input = JSON.stringify(value);
  let h1 = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h1 ^= input.charCodeAt(i);
    h1 = Math.imul(h1, 16777619);
  }
  return (h1 >>> 0).toString(16).padStart(8, "0");
}

function sentenceCandidates(text: string): string[] {
  return clean(text)
    .split(/(?<=[.!?])\s+/)
    .map(clean)
    .filter((s) => s.length >= 35 && s.length <= 700);
}

function extractNumericFacts(source: PublicEvidenceSnapshot["sources"]): {
  source: ExpertSource;
  evidence: ExpertEvidence[];
  facts: ExpertFact[];
}[] {
  const output: { source: ExpertSource; evidence: ExpertEvidence[]; facts: ExpertFact[] }[] = [];
  for (const raw of source ?? []) {
    const url = clean(raw.url);
    const id = clean(raw.id);
    const text = clean(raw.text);
    if (!url || !id || !text) continue;
    const domain = clean(raw.domain) || (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } })();
    const tier = [1, 2, 3, 4].includes(Number(raw.tier)) ? Number(raw.tier) as 1|2|3|4 : 4;
    const sourceRecord: ExpertSource = {
      id, url, title: clean(raw.title) || domain, domain, tier,
      retrievedAt: clean(raw.retrievedAt) || new Date(0).toISOString(),
      ...(clean(raw.publishedAt) ? { publishedAt: clean(raw.publishedAt) } : {}),
      contentHash: clean(raw.contentHash) || hash(text),
    };
    const evidence: ExpertEvidence[] = [];
    const facts: ExpertFact[] = [];
    const numeric = /(?:\d+(?:\.\d+)?\s*(?:mm|cm|in|°C|MPa|GPa|s|sec|%|g\/cm³|g\/cm3|bar|MPa|kN|kg))|(?:\d+(?:\.\d+)?\s*(?:to|-|–)\s*\d+(?:\.\d+)?\s*(?:mm|°C|MPa|%))/i;
    const sentences = sentenceCandidates(text).filter((s) => numeric.test(s)).slice(0, 20);
    sentences.forEach((statement, index) => {
      const evidenceId = `${id}:evidence:${index + 1}`;
      const factId = `${id}:fact:${index + 1}`;
      evidence.push({ id: evidenceId, sourceId: id, locator: `text:sentence:${index + 1}`, quote: statement, topicTerms: unique(statement.toLowerCase().split(/[^a-z0-9]+/).filter((x) => x.length > 3).slice(0, 16)) });
      facts.push({ id: factId, statement, evidenceIds: [evidenceId], conditions: [] });
    });
    output.push({ source: sourceRecord, evidence, facts });
  }
  return output;
}

function localSource(source: KnowledgeArticle): ExpertSource {
  return {
    id: `knowledge:${source.slug}`,
    url: `local://src/data/knowledge.ts#${source.slug}`,
    title: source.title,
    domain: "nexmold-local",
    tier: 3,
    retrievedAt: source.lastUpdated || new Date(0).toISOString(),
    contentHash: hash({ title: source.title, slug: source.slug, content: source.content, faq: source.faq, seoKeywords: source.seoKeywords }),
  };
}

function buildMechanisms(pack: EngineeringKnowledgePack, evidenceByNode: Map<string, string[]>): ExpertMechanism[] {
  const mechanisms: ExpertMechanism[] = [];
  for (const node of pack.nodes) {
    if (!["mechanism", "failure-mode", "process", "design-rule", "material", "tooling"].includes(node.kind)) continue;
    const evidenceIds = evidenceByNode.get(node.id) ?? [];
    mechanisms.push({
      id: `${node.id}:mechanism`,
      name: node.title,
      steps: [{ id: `${node.id}:step:1`, cause: node.title, effect: node.statement, evidenceIds }],
    });
  }
  return mechanisms;
}

function buildDecisionContracts(pack: EngineeringKnowledgePack, claimIdsByNode: Map<string, string[]>): ExpertDecision[] {
  return pack.decisions.map((d, i) => ({
    id: `decision:${i + 1}`,
    question: d.question,
    decisionFactors: d.factors,
    options: [{
      option: d.decisionRule,
      advantages: [],
      risks: [],
      conditions: d.factors,
      supportingClaimIds: unique(d.sourceNodes.flatMap((n) => claimIdsByNode.get(n) ?? [])),
    }],
  }));
}

export function compileExpertArticleContract(
  source: KnowledgeArticle,
  artifact: RegionalPublishArtifact,
  targetSlug: string,
  snapshot?: PublicEvidenceSnapshot,
): ExpertArticleContract {
  if (!source || !artifact || !targetSlug || targetSlug === source.slug) throw new Error("V714_EXPERT_CONTRACT_IDENTITY_INVALID");
  const pack = compileEngineeringKnowledgeFromArticle(source, targetSlug);
  const local = localSource(source);
  const external = extractNumericFacts(snapshot?.sources);
  const sources: ExpertSource[] = [local, ...external.map((x) => x.source)];
  const evidence: ExpertEvidence[] = [];
  const facts: ExpertFact[] = [];
  const evidenceByNode = new Map<string, string[]>();
  const claimIdsByNode = new Map<string, string[]>();

  for (const node of pack.nodes) {
    const ids: string[] = [];
    for (const ref of node.evidence) {
      const id = `${local.id}:node:${hash(ref.sourceField).slice(0, 12)}`;
      ids.push(id);
      evidence.push({ id, sourceId: local.id, locator: ref.sourceField, quote: clean(ref.sourceValue) || node.statement, topicTerms: node.keywords });
    }
    evidenceByNode.set(node.id, unique(ids));
    const factId = `${node.id}:fact`;
    facts.push({ id: factId, statement: node.statement, evidenceIds: unique(ids), conditions: [] });
    claimIdsByNode.set(node.id, [`claim:${hash(node.statement).slice(0, 20)}`]);
  }
  for (const group of external) { evidence.push(...group.evidence); facts.push(...group.facts); }

  const claims: ExpertClaim[] = pack.nodes.map((node) => {
    const ids = evidenceByNode.get(node.id) ?? [];
    const factId = `${node.id}:fact`;
    return {
      id: claimIdsByNode.get(node.id)![0], statement: node.statement,
      status: ids.length ? "SUPPORTED" : "UNSUPPORTED", factIds: [factId], evidenceIds: ids,
      confidence: ids.length ? 0.85 : 0,
      conditions: [], limitations: [],
    };
  });

  for (const group of external) {
    for (const fact of group.facts) {
      claims.push({
        id: `claim:${hash(fact.id).slice(0, 20)}`,
        statement: fact.statement,
        status: "SUPPORTED",
        factIds: [fact.id],
        evidenceIds: fact.evidenceIds,
        confidence: group.source.tier <= 2 ? 0.95 : group.source.tier === 3 ? 0.85 : 0.65,
        conditions: [],
        limitations: ["Extracted deterministically from a source sentence containing an engineering numeric expression; verify context before design release."],
      });
    }
  }

  const externalMechanisms: ExpertMechanism[] = external.flatMap((group) => group.facts
    .filter((fact) => /\b(because|due to|causes?|leads? to|results? in|therefore|consequently)\b/i.test(fact.statement))
    .map((fact) => ({
      id: `mechanism:${hash(fact.id).slice(0, 20)}`,
      name: group.source.title,
      steps: [{ id: `${fact.id}:step:1`, cause: fact.statement.split(/\b(?:because|due to)\b/i)[0].trim(), effect: fact.statement, evidenceIds: fact.evidenceIds }],
    })));

  const validations: ExpertValidation[] = [];
  for (const node of pack.nodes.filter((n) => n.kind === "validation")) {
    validations.push({ id: `validation:${hash(node.id).slice(0, 20)}`, method: node.title, observable: node.statement, acceptanceBasis: node.statement, claimIds: claimIdsByNode.get(node.id) ?? [] });
  }
  if (validations.length === 0) {
    for (const claim of claims.slice(0, 3)) validations.push({ id: `validation:${hash(claim.id).slice(0, 20)}`, method: "Design / process verification", observable: claim.statement, acceptanceBasis: "Verify the applicable drawing, process specification or inspection requirement before release.", claimIds: [claim.id] });
  }

  const mechanisms = [...buildMechanisms(pack, evidenceByNode), ...externalMechanisms];
  const decisions = buildDecisionContracts(pack, claimIdsByNode);
  const unsupportedClaimCount = claims.filter((c) => c.status === "UNSUPPORTED").length;
  const conflictCount = claims.filter((c) => c.status === "CONFLICTING").length;
  const coverage = claims.length ? claims.filter((c) => c.evidenceIds.length).length / claims.length : 0;
  const tier12 = evidence.length ? evidence.filter((e) => sources.find((s) => s.id === e.sourceId)?.tier && (sources.find((s) => s.id === e.sourceId)!.tier <= 2)).length / evidence.length : 0;

  return {
    schema: "nexmold.v7.14.expert-article-contract.v1",
    articleId: artifact.pageId,
    targetSlug,
    title: source.title,
    intent: String(source.intent),
    sources, evidence, facts, claims, mechanisms, decisions, validations,
    quality: { evidenceCoverage: coverage, tier1or2Coverage: tier12, unsupportedClaimCount, conflictCount },
  };
}
