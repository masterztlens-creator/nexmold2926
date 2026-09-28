import assert from "node:assert/strict";
import test from "node:test";

import {
  ResearchFrontier,
} from "../../../.v8-build/src/v8/research/frontier.js";

test(
  "ResearchFrontier preserves discovery provenance",
  () => {
    const frontier = new ResearchFrontier();

    frontier.enqueue([
      {
        url: "https://example.com/article",
        depth: 1,
        discoveredFrom: "https://example.com/",
        priority: 10,
        kind: "LINK",
        sourceUrl: "https://example.com/",
        title: "Engineering Article",
        discoveredAt:
          "2026-09-28T03:00:00.000Z",
      },
    ]);

    const item = frontier.next();

    assert.deepEqual(
      item,
      {
        url: "https://example.com/article",
        depth: 1,
        discoveredFrom: "https://example.com/",
        priority: 10,
        kind: "LINK",
        sourceUrl: "https://example.com/",
        title: "Engineering Article",
        discoveredAt:
          "2026-09-28T03:00:00.000Z",
      },
    );
  },
);

test(
  "ResearchFrontier preserves discovery kinds",
  () => {
    const frontier = new ResearchFrontier();

    frontier.enqueue([
      {
        url: "https://example.com/seed",
        depth: 0,
        priority: 10,
        kind: "SEED",
      },
      {
        url: "https://example.com/link",
        depth: 1,
        priority: 10,
        kind: "LINK",
        sourceUrl: "https://example.com/seed",
      },
      {
        url: "https://example.com/reference",
        depth: 1,
        priority: 10,
        kind: "REFERENCE",
        sourceUrl: "https://example.com/link",
      },
      {
        url: "https://example.com/sitemap.xml",
        depth: 1,
        priority: 10,
        kind: "SITEMAP",
      },
      {
        url: "https://example.com/search-result",
        depth: 1,
        priority: 10,
        kind: "SERP_RESULT",
      },
    ]);

    const kinds = [];

    let item;
    while ((item = frontier.next()) !== undefined) {
      kinds.push(item.kind);
    }

    assert.deepEqual(
      kinds.sort(),
      [
        "LINK",
        "REFERENCE",
        "SEED",
        "SITEMAP",
        "SERP_RESULT",
      ].sort(),
    );
  },
);

test(
  "ResearchFrontier deduplicates by URL without discarding the first provenance record",
  () => {
    const frontier = new ResearchFrontier();

    frontier.enqueue([
      {
        url: "https://example.com/article",
        depth: 1,
        priority: 5,
        kind: "LINK",
        sourceUrl: "https://example.com/start",
        title: "First discovery",
        discoveredAt:
          "2026-09-28T03:00:00.000Z",
      },
      {
        url: "https://example.com/article",
        depth: 2,
        priority: 100,
        kind: "REFERENCE",
        sourceUrl: "https://example.com/reference",
        title: "Second discovery",
        discoveredAt:
          "2026-09-28T04:00:00.000Z",
      },
    ]);

    assert.equal(frontier.size, 1);

    assert.deepEqual(
      frontier.next(),
      {
        url: "https://example.com/article",
        depth: 1,
        priority: 5,
        kind: "LINK",
        sourceUrl: "https://example.com/start",
        title: "First discovery",
        discoveredAt:
          "2026-09-28T03:00:00.000Z",
      },
    );

    assert.equal(frontier.size, 0);
  },
);

test(
  "ResearchFrontier keeps deterministic priority ordering",
  () => {
    const frontier = new ResearchFrontier();

    frontier.enqueue([
      {
        url: "https://example.com/z",
        depth: 1,
        priority: 5,
      },
      {
        url: "https://example.com/a",
        depth: 2,
        priority: 5,
      },
      {
        url: "https://example.com/b",
        depth: 1,
        priority: 10,
      },
      {
        url: "https://example.com/c",
        depth: 1,
        priority: 5,
      },
    ]);

    assert.equal(
      frontier.next()?.url,
      "https://example.com/b",
    );

    assert.equal(
      frontier.next()?.url,
      "https://example.com/c",
    );

    assert.equal(
      frontier.next()?.url,
      "https://example.com/z",
    );

    assert.equal(
      frontier.next()?.url,
      "https://example.com/a",
    );

    assert.equal(frontier.next(), undefined);
  },
);

test(
  "ResearchFrontier remains compatible with legacy frontier items",
  () => {
    const frontier = new ResearchFrontier();

    frontier.enqueue([
      {
        url: "https://example.com/legacy",
        depth: 0,
        priority: 1,
      },
    ]);

    assert.equal(frontier.size, 1);
    assert.equal(
      frontier.has(
        "https://example.com/legacy",
      ),
      true,
    );

    assert.deepEqual(
      frontier.next(),
      {
        url: "https://example.com/legacy",
        depth: 0,
        priority: 1,
      },
    );
  },
);