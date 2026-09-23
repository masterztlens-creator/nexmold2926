import assert from "node:assert/strict";
import test from "node:test";

import {
  extractEvidenceByPattern,
  extractStructuredEvidence,
  extractTextEvidence,
} from "../../../.v8-build/src/v8/acquisition/source-extractor.js";

test("V8-22B-S2 excludes nested sidebar descendants without truncating main content", () => {
  const html = `
    <body>
      <div class="sidebar">
        <div class="sidebar-inner">
          Related article: polluted content.
        </div>

        <div class="sidebar-actions">
          Subscribe for updates.
        </div>
      </div>

      <main>
        <h1>Injection Molding Design</h1>
        <p>Wall thickness: 2 mm.</p>
        <p>Draft angle: 1 mm.</p>
      </main>
    </body>
  `;

  const result = extractTextEvidence(html);

  assert.equal(result.length, 1);

  assert.match(
    result[0].excerpt,
    /Injection Molding Design/,
  );

  assert.match(
    result[0].excerpt,
    /Wall thickness: 2 mm/,
  );

  assert.match(
    result[0].excerpt,
    /Draft angle: 1 mm/,
  );

  assert.doesNotMatch(
    result[0].excerpt,
    /Related article: polluted content/,
  );

  assert.doesNotMatch(
    result[0].excerpt,
    /Subscribe for updates/,
  );
});

test("V8-22B-S2 excludes nested cookie descendants without leaking trailing UI content", () => {
  const html = `
    <body>
      <div class="cookie-banner">
        <div class="cookie-inner">
          We use cookies.
        </div>

        <div class="cookie-actions">
          Accept all cookies.
        </div>
      </div>

      <main>
        <h1>Cooling Guidance</h1>
        <p>Cooling time: 30 s.</p>
      </main>
    </body>
  `;

  const result = extractTextEvidence(html);

  assert.equal(result.length, 1);

  assert.match(
    result[0].excerpt,
    /Cooling Guidance/,
  );

  assert.match(
    result[0].excerpt,
    /Cooling time: 30 s/,
  );

  assert.doesNotMatch(
    result[0].excerpt,
    /We use cookies/,
  );

  assert.doesNotMatch(
    result[0].excerpt,
    /Accept all cookies/,
  );
});

test("V8-22B-S2 preserves content before and after nested related-content blocks", () => {
  const html = `
    <main>
      <article>
        <h1>Draft Angle Guidance</h1>

        <p>Before related content: Draft angle: 1 mm.</p>

        <div class="related-content">
          <div class="related-inner">
            Related article A.
          </div>

          <div class="related-actions">
            Read more articles.
          </div>
        </div>

        <p>After related content: Wall thickness: 2 mm.</p>
      </article>
    </main>
  `;

  const result = extractTextEvidence(html);

  assert.equal(result.length, 1);

  assert.match(
    result[0].excerpt,
    /Before related content: Draft angle: 1 mm/,
  );

  assert.match(
    result[0].excerpt,
    /After related content: Wall thickness: 2 mm/,
  );

  assert.doesNotMatch(
    result[0].excerpt,
    /Related article A/,
  );

  assert.doesNotMatch(
    result[0].excerpt,
    /Read more articles/,
  );
});

test("V8-22B-S2 excludes nested newsletter blocks inside article content", () => {
  const html = `
    <article>
      <h1>Injection Molding Process</h1>

      <p>Injection pressure: 80 MPa.</p>

      <section class="newsletter">
        <div class="newsletter-inner">
          Get our manufacturing newsletter.
        </div>

        <div class="newsletter-form">
          Enter your email address.
        </div>
      </section>

      <p>Clamp force: 50 kN.</p>
    </article>
  `;

  const result = extractTextEvidence(html);

  assert.equal(result.length, 1);

  assert.match(
    result[0].excerpt,
    /Injection pressure: 80 MPa/,
  );

  assert.match(
    result[0].excerpt,
    /Clamp force: 50 kN/,
  );

  assert.doesNotMatch(
    result[0].excerpt,
    /manufacturing newsletter/,
  );

  assert.doesNotMatch(
    result[0].excerpt,
    /Enter your email address/,
  );
});

test("V8-22B-S2 excludes nested complementary UI blocks", () => {
  const html = `
    <body>
      <div role="complementary">
        <div>
          Recommended product: polluted-product.
        </div>

        <div>
          Advertisement: polluted-ad.
        </div>
      </div>

      <main>
        <h1>Material Selection</h1>
        <p>Material temperature: 220 °C.</p>
      </main>
    </body>
  `;

  const result = extractTextEvidence(html);

  assert.equal(result.length, 1);

  assert.match(
    result[0].excerpt,
    /Material Selection/,
  );

  assert.match(
    result[0].excerpt,
    /Material temperature: 220 °C/,
  );

  assert.doesNotMatch(
    result[0].excerpt,
    /Recommended product/,
  );

  assert.doesNotMatch(
    result[0].excerpt,
    /Advertisement/,
  );
});

test("V8-22B-S2 structured extraction cannot promote nested UI values into evidence", () => {
  const html = `
    <body>
      <div class="related-content">
        <div class="related-inner">
          Wall thickness: 999 mm.
        </div>

        <div class="related-actions">
          Clamp force: 999 kN.
        </div>
      </div>

      <main>
        <h1>Engineering Parameters</h1>
        <p>Wall thickness: 2 mm.</p>
        <p>Clamp force: 50 kN.</p>
      </main>
    </body>
  `;

  const result = extractStructuredEvidence(html);

  assert.ok(result.length >= 2);

  const parameterCandidates = result.filter(
    (candidate) =>
      candidate.parameter !== undefined,
  );

  assert.ok(
    parameterCandidates.some(
      (candidate) =>
        candidate.parameter?.toLowerCase() === "wall thickness" &&
        candidate.value === "2" &&
        candidate.unit === "mm",
    ),
  );

  assert.ok(
    parameterCandidates.some(
      (candidate) =>
        candidate.parameter?.toLowerCase() === "clamp force" &&
        candidate.value === "50" &&
        candidate.unit === "kN",
    ),
  );

  assert.ok(
    parameterCandidates.every(
      (candidate) =>
        candidate.value !== "999",
    ),
  );
});

test("V8-22B-S2 text and structured extraction share the same semantic boundary", () => {
  const html = `
    <body>
      <header>
        Header pollution.
      </header>

      <div class="sidebar">
        <div>
          Sidebar pollution.
        </div>
      </div>

      <main>
        <h1>Production Guidance</h1>
        <p>Wall thickness: 2 mm.</p>
        <p>Draft angle: 1 mm.</p>
      </main>

      <footer>
        Footer pollution.
      </footer>
    </body>
  `;

  const textResult = extractTextEvidence(html);
  const structuredResult = extractStructuredEvidence(html);

  assert.equal(textResult.length, 1);

  assert.match(
    textResult[0].excerpt,
    /Production Guidance/,
  );

  assert.doesNotMatch(
    textResult[0].excerpt,
    /Header pollution/,
  );

  assert.doesNotMatch(
    textResult[0].excerpt,
    /Sidebar pollution/,
  );

  assert.doesNotMatch(
    textResult[0].excerpt,
    /Footer pollution/,
  );

  const structuredExcerpts = structuredResult.map(
    (candidate) => candidate.excerpt,
  );

  assert.ok(
    structuredExcerpts.some(
      (excerpt) => /Wall thickness: 2 mm/.test(excerpt),
    ),
  );

  assert.ok(
    structuredExcerpts.some(
      (excerpt) => /Draft angle: 1 mm/.test(excerpt),
    ),
  );

  assert.ok(
    structuredExcerpts.every(
      (excerpt) =>
        !/pollution/i.test(excerpt),
    ),
  );
});

test("V8-22B-S2 nested UI blocks cannot contaminate pattern extraction", () => {
  const html = `
    <main>
      <p>target: first-authoritative-fact</p>

      <div class="related-content">
        <div class="related-inner">
          target: polluted-related-content
        </div>

        <div class="related-actions">
          target: polluted-action
        </div>
      </div>

      <p>target: second-authoritative-fact</p>
    </main>
  `;

  const result = extractEvidenceByPattern(
    html,
    [/target:\s*[a-z-]+/gi],
  );

  assert.equal(result.length, 1);

  assert.equal(
    result[0].excerpt,
    "target: first-authoritative-fact",
  );
});

test("V8-22B-S2 article boundary excludes nested UI but preserves article facts", () => {
  const html = `
    <body>
      <article>
        <h1>Injection Molding Wall Thickness</h1>

        <p>Recommended wall thickness is 2 mm.</p>

        <aside>
          <div>
            Related article: wall thickness calculator.
          </div>

          <div>
            Advertisement: 999 mm solution.
          </div>
        </aside>

        <p>Uniform thickness reduces molding defects.</p>
      </article>
    </body>
  `;

  const result = extractTextEvidence(html);

  assert.equal(result.length, 1);

  assert.match(
    result[0].excerpt,
    /Recommended wall thickness is 2 mm/,
  );

  assert.match(
    result[0].excerpt,
    /Uniform thickness reduces molding defects/,
  );

  assert.doesNotMatch(
    result[0].excerpt,
    /wall thickness calculator/,
  );

  assert.doesNotMatch(
    result[0].excerpt,
    /999 mm solution/,
  );
});

test("V8-22B-S2 does not truncate real content after a nested UI block", () => {
  const html = `
    <main>
      <h1>Injection Molding Design Rules</h1>

      <p>First fact: Wall thickness: 2 mm.</p>

      <div class="promo">
        <div class="promo-inner">
          Promotional content.
        </div>

        <div class="promo-actions">
          Request a brochure.
        </div>
      </div>

      <section>
        <h2>Draft Angle</h2>
        <p>Second fact: Draft angle: 1 mm.</p>
      </section>
    </main>
  `;

  const result = extractStructuredEvidence(html);

  assert.ok(
    result.some(
      (candidate) =>
        candidate.parameter?.toLowerCase() === "wall thickness" &&
        candidate.value === "2" &&
        candidate.unit === "mm",
    ),
  );

  assert.ok(
    result.some(
      (candidate) =>
        candidate.parameter?.toLowerCase() === "draft angle" &&
        candidate.value === "1" &&
        candidate.unit === "mm",
    ),
  );

  assert.ok(
    result.every(
      (candidate) =>
        !/Promotional content|Request a brochure/i.test(
          candidate.excerpt,
        ),
    ),
  );
});

test("V8-22B-S2 repeated adversarial extraction is deterministic", () => {
  const html = `
    <body>
      <header>
        <div class="header-inner">
          Header pollution.
        </div>
      </header>

      <main>
        <h1>DFM Guidance</h1>

        <p>Wall thickness: 2 mm.</p>

        <div class="sidebar">
          <div class="sidebar-inner">
            Sidebar pollution.
          </div>

          <div class="sidebar-actions">
            Subscribe.
          </div>
        </div>

        <p>Draft angle: 1 mm.</p>
      </main>

      <footer>
        <div>
          Footer pollution.
        </div>
      </footer>
    </body>
  `;

  const firstText = extractTextEvidence(html);
  const secondText = extractTextEvidence(html);

  const firstStructured = extractStructuredEvidence(html);
  const secondStructured = extractStructuredEvidence(html);

  assert.deepEqual(firstText, secondText);
  assert.deepEqual(firstStructured, secondStructured);
});