
import test from "node:test";
import assert from "node:assert/strict";

import {
  InMemoryFoundationStore,
} from "../../../../.v8-build/src/v8/foundation/store.js";

import {
  runMarketAcquisition,
} from "../../../../.v8-build/src/v8/intelligence/market/research-acquisition.js";

/**
 * V8 Phase 2 — Market Research Acquisition Regression Tests
 *
 * Invariants:
 * 1. Each distinct candidate retains its originating research action.
 * 2. Canonically equivalent URLs are acquired at most once.
 * 3. The first action discovering a canonical URL owns its provenance.
 * 4. Every successful acquisition retains the fetched page and ingest result.
 * 5. Failed searches must not fabricate acquisitions.
 */

function createPage(url) {
  const body = [
    "<!doctype html>",
    "<html>",
    "<head>",
    "<title>Injection Molding Engineering Guidance</title>",
    '<meta name="description" content="Engineering guidance for injection molding.">',
    "</head>",
    "<body>",
    "<h1>Injection Molding Engineering Guidance</h1>",
    "<p>Wall thickness should be evaluated against material, geometry,",
    "flow length, and manufacturing constraints.</p>",
    "</body>",
    "</html>",
  ].join("");

  return {
    requestedUrl: url,
    finalUrl: url,
    redirectChain: [url],
    status: 200,
    mediaType: "text/html",
    body,
    bytes: new TextEncoder().encode(body),
    fetchedAt: "2026-10-10T00:00:00.000Z",
  };
}

function createPlan(queries) {
  return {
    demandId: "market-demand:phase2:regression",
    queries,
    stopConditions: [
      "no usable search results",
      "conflicting evidence unresolved",
      "abort signal",
    ],
  };
}

function createSearchProvider(resultsByQuery, calls = []) {
  return {
    name: "v8-market-acquisition-regression",

    async search(query) {
      calls.push(query);

      if (resultsByQuery[query] instanceof Error) {
        throw resultsByQuery[query];
      }

      return resultsByQuery[query] ?? [];
    },
  };
}

function createPageFetcher(pagesByUrl, calls = []) {
  return {
    async fetch(url) {
      calls.push(url);

      const page = pagesByUrl[url];

      if (!page) {
        throw new Error(`UNEXPECTED_FETCH_URL:${url}`);
      }

      return page;
    },
  };
}

test(
  "V8-2A preserves distinct research action provenance across candidate URLs",
  async () => {
    const firstUrl =
      "https://example.com/engineering/wall-thickness";

    const secondUrl =
      "https://example.org/guides/material-selection";

    const store = new InMemoryFoundationStore();
    const fetchCalls = [];

    const plan = createPlan([
      {
        actionId: "action:wall-thickness",
        query: "injection molding wall thickness",
        reason: "Resolve wall thickness guidance",
        priority: "HIGH",
      },
      {
        actionId: "action:material-selection",
        query: "injection molding material selection",
        reason: "Resolve material selection guidance",
        priority: "HIGH",
      },
    ]);

    const searchProvider = createSearchProvider({
      "injection molding wall thickness": [
        {
          url: firstUrl,
          title: "Wall Thickness Guidance",
        },
      ],
      "injection molding material selection": [
        {
          url: secondUrl,
          title: "Material Selection Guidance",
        },
      ],
    });

    const pageFetcher = createPageFetcher(
      {
        [firstUrl]: createPage(firstUrl),
        [secondUrl]: createPage(secondUrl),
      },
      fetchCalls,
    );

    const result = await runMarketAcquisition(
      plan,
      searchProvider,
      pageFetcher,
      store,
      {
        actorId: "v8-phase2-regression",
        maxCandidates: 10,
      },
    );

    assert.equal(result.searchErrors.length, 0);
    assert.equal(result.fetchErrors.length, 0);
    assert.equal(result.discovery.accepted, 2);
    assert.equal(result.acquisitions.length, 2);

    const byUrl = new Map(
      result.acquisitions.map((record) => [
        record.candidateUrl,
        record,
      ]),
    );

    assert.equal(
      byUrl.get(firstUrl)?.actionId,
      "action:wall-thickness",
    );

    assert.equal(
      byUrl.get(secondUrl)?.actionId,
      "action:material-selection",
    );

    assert.deepEqual(
      new Set(fetchCalls),
      new Set([firstUrl, secondUrl]),
    );

    for (const record of result.acquisitions) {
      assert.ok(record.page);
      assert.ok(record.acquisition);
      assert.equal(record.page.status, 200);
    }

    store.verifyChain();
  },
);

test(
  "V8-2B canonical duplicate URLs keep deterministic first-action ownership",
  async () => {
    const canonicalUrl =
      "https://example.com/engineering/wall-thickness";

    const duplicateUrl =
      "https://EXAMPLE.com/engineering/wall-thickness/?utm_source=research#details";

    const otherUrl =
      "https://example.org/guides/material-selection";

    const store = new InMemoryFoundationStore();
    const fetchCalls = [];

    const plan = createPlan([
      {
        actionId: "action:first-owner",
        query: "wall thickness query",
        reason: "First discovery",
        priority: "HIGH",
      },
      {
        actionId: "action:duplicate-owner",
        query: "duplicate wall thickness query",
        reason: "Duplicate discovery",
        priority: "MEDIUM",
      },
      {
        actionId: "action:other-page",
        query: "material selection query",
        reason: "Independent discovery",
        priority: "MEDIUM",
      },
    ]);

    const searchProvider = createSearchProvider({
      "wall thickness query": [
        {
          url: canonicalUrl,
          title: "Wall Thickness",
        },
      ],
      "duplicate wall thickness query": [
        {
          url: duplicateUrl,
          title: "Wall Thickness Duplicate",
        },
      ],
      "material selection query": [
        {
          url: otherUrl,
          title: "Material Selection",
        },
      ],
    });

    const pageFetcher = createPageFetcher(
      {
        [canonicalUrl]: createPage(canonicalUrl),
        [otherUrl]: createPage(otherUrl),
      },
      fetchCalls,
    );

    const result = await runMarketAcquisition(
      plan,
      searchProvider,
      pageFetcher,
      store,
      {
        actorId: "v8-phase2-regression",
        maxCandidates: 10,
      },
    );

    assert.equal(result.searchErrors.length, 0);
    assert.equal(result.fetchErrors.length, 0);

    // The normalized duplicate must not create another acquisition.
    assert.equal(result.discovery.accepted, 2);
    assert.equal(result.acquisitions.length, 2);

    const firstRecord = result.acquisitions.find(
      (record) =>
        record.page.finalUrl === canonicalUrl,
    );

    assert.ok(firstRecord);

    // The earliest action to discover the canonical URL owns it.
    assert.equal(
      firstRecord.actionId,
      "action:first-owner",
    );

    const otherRecord = result.acquisitions.find(
      (record) =>
        record.page.finalUrl === otherUrl,
    );

    assert.ok(otherRecord);
    assert.equal(
      otherRecord.actionId,
      "action:other-page",
    );

    assert.equal(
      fetchCalls.filter(
        (url) =>
          url === canonicalUrl ||
          url === duplicateUrl,
      ).length,
      1,
    );

    store.verifyChain();
  },
);

test(
  "V8-2C search failures do not fabricate provenance or acquisitions",
  async () => {
    const store = new InMemoryFoundationStore();
    const fetchCalls = [];

    const plan = createPlan([
      {
        actionId: "action:failed-search",
        query: "unavailable search query",
        reason: "Test fail-closed behavior",
        priority: "HIGH",
      },
    ]);

    const searchProvider = createSearchProvider({
      "unavailable search query": new Error(
        "SEARCH_PROVIDER_UNAVAILABLE",
      ),
    });

    const pageFetcher = createPageFetcher({}, fetchCalls);

    const result = await runMarketAcquisition(
      plan,
      searchProvider,
      pageFetcher,
      store,
      {
        actorId: "v8-phase2-regression",
        maxCandidates: 10,
      },
    );

    assert.equal(result.searchErrors.length, 1);
    assert.equal(
      result.searchErrors[0].error,
      "SEARCH_PROVIDER_UNAVAILABLE",
    );

    assert.equal(result.discovery.accepted, 0);
    assert.equal(result.acquisitions.length, 0);
    assert.equal(result.fetchErrors.length, 0);
    assert.equal(fetchCalls.length, 0);
    assert.equal(store.auditTrail().length, 0);

    store.verifyChain();
  },
);
