
import test from "node:test";
import assert from "node:assert/strict";

import {
  discoverCandidates,
  normalizeSerpResults,
  classifyIntent,
  buildKeywordUniverse,
  discoverNiches,
  analyzeCompetitorGap,
  scoreOpportunity,
  planResearch,
  rankEvidenceCandidates,
  compileIndustrialContent,
  compileSeo,
  compileGeo,
  buildAuthorityGraph,
  suggestInternalLinks,
  assessNovelty,
  detectCannibalization,
  validateContentQuality,
  evaluatePublication,
  createGrowthState,
  runGrowthLoop,
} from "../../../.v8-build/src/v8/intelligence/index.js";

test("V8 intelligence plane executes end-to-end", async () => {
  const discovered = discoverCandidates([
    { url: "https://example.com/a?utm_source=x" },
    { url: "https://example.com/a" },
    { url: "https://example.com/b", kind: "LINK" },
  ]);
  assert.equal(discovered.accepted, 2);

  const serp = normalizeSerpResults(
    { query: "plastic injection molding wall thickness" },
    "fixture",
    [{ url: "https://example.com/a", title: "Wall thickness guide", position: 1 }],
  );
  assert.equal(serp.results.length, 1);

  const intent = classifyIntent("custom injection molding manufacturer");
  assert.equal(intent.intent, "COMMERCIAL");

  const keywords = buildKeywordUniverse({
    seeds: ["plastic injection molding wall thickness"],
    modifiers: ["design", "guide", "manufacturer"],
    questions: ["how to choose wall thickness"],
  });
  assert.ok(keywords.length >= 4);

  const niches = discoverNiches("plastic injection molding", keywords.map(k => k.keyword));
  assert.ok(niches.length > 0);

  const gap = analyzeCompetitorGap(
    ["wall", "thickness", "draft", "shrinkage"],
    [{ url: "https://competitor.example", title: "Guide", headings: [], terms: ["wall", "thickness"] }],
  );
  assert.ok(gap.missingTopics.includes("draft"));

  const opportunity = scoreOpportunity(keywords[0], {
    demand: .8, relevance: .95, competition: .35, authorityGap: .7, conversionPotential: .8,
  });
  assert.ok(opportunity.score > .65);

  const plan = planResearch(opportunity);
  const rankedEvidence = rankEvidenceCandidates(plan.sourceQueries[0], [
    { url: "https://standards.example/a", title: "Engineering standard", publisher: "Standards Body", authority: .95, relevance: .8, query: plan.sourceQueries[0] },
    { url: "https://blog.example/a", title: "Blog", publisher: "Blog", authority: .3, relevance: .8, query: plan.sourceQueries[0] },
  ]);

  const draft = compileIndustrialContent({
    brief: plan.brief,
    evidence: rankedEvidence.map(c => ({ sourceUrl: c.url, title: c.title, publisher: c.publisher })),
    facts: ["Wall thickness should be selected with material, flow length, cooling, and structural requirements in scope."],
  });
  assert.ok(draft.sections.length >= 4);

  const seo = compileSeo(draft);
  const geo = compileGeo(draft);
  const graph = buildAuthorityGraph(draft.title, seo.keywords, geo.citationTargets);
  assert.ok(graph.nodes.length > 2);

  const links = suggestInternalLinks(draft, [
    { ...draft, slug: "related-guide", title: "wall thickness design guide", },
  ]);
  assert.ok(Array.isArray(links));

  const novelty = assessNovelty(draft, []);
  const collisions = detectCannibalization([draft, { ...draft, slug: "duplicate" }], .5);
  const quality = validateContentQuality(draft);
  const publication = evaluatePublication(draft, quality, collisions.length, novelty.noveltyScore);

  assert.equal(quality.passed, true);
  assert.equal(publication.eligible, false);

  const state = createGrowthState({
    cycleId: "test",
    keywords,
    opportunities: [opportunity],
    drafts: [draft],
  });
  const loop = runGrowthLoop(state);
  assert.ok(loop.nextOpportunities.length === 1);
});
