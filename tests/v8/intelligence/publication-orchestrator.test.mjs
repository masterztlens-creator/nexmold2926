
import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluatePublication,
} from "../../../.v8-build/src/v8/intelligence/publication/orchestrator.js";

function createDraft(overrides = {}) {
  return {
    title:
      "Plastic Injection Molding Wall Thickness Guide",
    slug:
      "plastic-injection-molding-wall-thickness",
    description:
      "Learn how material properties, cooling, flow behavior, and part requirements influence plastic injection molding wall thickness.",
    sections: [
      {
        heading:
          "Wall thickness design considerations",
        body:
          "Wall thickness selection depends on material properties, flow behavior, cooling requirements, and the structural needs of the finished component.",
      },
      {
        heading:
          "How should wall thickness be selected?",
        body:
          "Evaluate material recommendations, geometry, filling behavior, and application requirements before finalizing the design.",
      },
    ],
    claims: [
      "Wall thickness selection depends on material properties and part requirements.",
    ],
    evidence: [
      {
        sourceUrl:
          "https://example.com/engineering/wall-thickness",
        title:
          "Engineering wall thickness guidance",
        publisher:
          "Example Engineering",
        excerpt:
          "Wall thickness should be evaluated against material and part requirements.",
      },
    ],
    ...overrides,
  };
}

function createQualityReport(overrides = {}) {
  return {
    passed: true,
    findings: [],
    ...overrides,
  };
}

function evaluate(
  draft = createDraft(),
  quality = createQualityReport(),
  collisions = 0,
  noveltyScore = 1,
) {
  return evaluatePublication(
    draft,
    quality,
    collisions,
    noveltyScore,
  );
}

test(
  "publication orchestration accepts a valid SEO/GEO artifact",
  () => {
    const result = evaluate();

    assert.equal(result.eligible, true);
    assert.equal(
      result.slug,
      "plastic-injection-molding-wall-thickness",
    );
    assert.deepEqual(result.reasons, []);
    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result.reasons), true);
  },
);

test(
  "SEO BLOCK finding prevents publication",
  () => {
    const result = evaluate(
      createDraft({
        title: " ",
      }),
    );

    assert.equal(result.eligible, false);
    assert.ok(
      result.reasons.includes(
        "seo-quality:SEO_TITLE_EMPTY",
      ),
    );
  },
);

test(
  "GEO BLOCK finding prevents publication",
  () => {
    const result = evaluate(
      createDraft({
        claims: [],
      }),
    );

    assert.equal(result.eligible, false);
    assert.ok(
      result.reasons.includes(
        "geo-quality:GEO_FACTS_EMPTY",
      ),
    );
  },
);

test(
  "WARN-only SEO/GEO findings do not independently block publication",
  () => {
    const result = evaluate(
      createDraft({
        title: "Short",
        description: "Brief description.",
        sections: [
          {
            heading: "Short heading",
            body: "Short answer.",
          },
        ],
        claims: [
          "A documented engineering fact.",
        ],
        evidence: [
          {
            sourceUrl:
              "https://example.com/source",
            excerpt:
              "First evidence excerpt.",
          },
          {
            sourceUrl:
              "https://example.com/source",
            excerpt:
              "Second evidence excerpt.",
          },
        ],
      }),
    );

    assert.equal(result.eligible, true);
    assert.deepEqual(result.reasons, []);
  },
);

test(
  "SEO compiler or audit exceptions fail closed",
  () => {
    const result = evaluate(
      createDraft({
        sections: undefined,
      }),
    );

    assert.equal(result.eligible, false);
    assert.ok(
      result.reasons.includes(
        "seo-quality:audit-error",
      ),
    );
    assert.ok(
      result.reasons.includes(
        "geo-quality:audit-error",
      ),
    );
  },
);

test(
  "GEO compiler or audit exceptions fail closed",
  () => {
    const result = evaluate(
      createDraft({
        sections: undefined,
      }),
    );

    assert.equal(result.eligible, false);
    assert.ok(
      result.reasons.some(
        (reason) =>
          reason.startsWith("geo-quality:"),
      ),
    );
  },
);

test(
  "existing quality firewall still prevents publication",
  () => {
    const result = evaluate(
      createDraft(),
      createQualityReport({
        passed: false,
      }),
    );

    assert.equal(result.eligible, false);
    assert.ok(
      result.reasons.includes(
        "quality-firewall",
      ),
    );
  },
);

test(
  "semantic collisions still prevent publication",
  () => {
    const result = evaluate(
      createDraft(),
      createQualityReport(),
      1,
    );

    assert.equal(result.eligible, false);
    assert.ok(
      result.reasons.includes(
        "semantic-collision",
      ),
    );
  },
);

test(
  "invalid semantic collision counts fail closed",
  () => {
    for (const collisions of [
      -1,
      0.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]) {
      const result = evaluate(
        createDraft(),
        createQualityReport(),
        collisions,
      );

      assert.equal(result.eligible, false);
      assert.ok(
        result.reasons.includes(
          "invalid-semantic-collision-count",
        ),
      );
    }
  },
);

test(
  "low novelty still prevents publication",
  () => {
    const result = evaluate(
      createDraft(),
      createQualityReport(),
      0,
      0.34,
    );

    assert.equal(result.eligible, false);
    assert.ok(
      result.reasons.includes("low-novelty"),
    );
  },
);

test(
  "invalid novelty scores fail closed",
  () => {
    for (const noveltyScore of [
      -0.01,
      1.01,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]) {
      const result = evaluate(
        createDraft(),
        createQualityReport(),
        0,
        noveltyScore,
      );

      assert.equal(result.eligible, false);
      assert.ok(
        result.reasons.includes(
          "invalid-novelty-score",
        ),
      );
    }
  },
);

test(
  "missing evidence still prevents publication",
  () => {
    const result = evaluate(
      createDraft({
        evidence: [],
      }),
    );

    assert.equal(result.eligible, false);
    assert.ok(
      result.reasons.includes("missing-evidence"),
    );
    assert.ok(
      result.reasons.includes(
        "geo-quality:GEO_CITATIONS_EMPTY",
      ),
    );
  },
);

test(
  "multiple independent publication blockers are preserved without duplicates",
  () => {
    const result = evaluate(
      createDraft({
        title: " ",
        claims: [],
        evidence: [],
      }),
      createQualityReport({
        passed: false,
      }),
      2,
      0.1,
    );

    assert.equal(result.eligible, false);

    for (const reason of [
      "quality-firewall",
      "semantic-collision",
      "low-novelty",
      "missing-evidence",
      "seo-quality:SEO_TITLE_EMPTY",
      "geo-quality:GEO_FACTS_EMPTY",
      "geo-quality:GEO_CITATIONS_EMPTY",
    ]) {
      assert.ok(
        result.reasons.includes(reason),
        `Expected blocker: ${reason}`,
      );
    }

    assert.equal(
      new Set(result.reasons).size,
      result.reasons.length,
    );
  },
);
