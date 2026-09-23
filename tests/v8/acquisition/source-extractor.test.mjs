import assert from "node:assert/strict";
import test from "node:test";

import {
  extractEvidenceByPattern,
  extractStructuredEvidence,
  extractTextEvidence,
} from "../../../.v8-build/src/v8/acquisition/source-extractor.js";


test("V8-22B extracts semantic main content and excludes navigation chrome", () => {
  const html = `
    <html>
      <head>
        <title>Engineering Guide</title>
      </head>

      <body>
        <header>
          NEXMOLD GLOBAL NAVIGATION
        </header>

        <nav>
          HOME SERVICES INDUSTRIES CONTACT
        </nav>

        <main>
          <h1>Injection Molding Wall Thickness</h1>
          <p>Wall thickness should be uniform for reliable molding.</p>
        </main>

        <footer>
          COPYRIGHT COOKIE POLICY PRIVACY
        </footer>
      </body>
    </html>
  `;

  const result = extractTextEvidence(html);

  assert.equal(result.length, 1);
  assert.match(
    result[0].excerpt,
    /Injection Molding Wall Thickness/,
  );
  assert.match(
    result[0].excerpt,
    /Wall thickness should be uniform/,
  );
  assert.doesNotMatch(
    result[0].excerpt,
    /NEXMOLD GLOBAL NAVIGATION/,
  );
  assert.doesNotMatch(
    result[0].excerpt,
    /HOME SERVICES INDUSTRIES CONTACT/,
  );
  assert.doesNotMatch(
    result[0].excerpt,
    /COOKIE POLICY/,
  );
});


test("V8-22B supports article-only documents without a main element", () => {
  const html = `
    <body>
      <header>Site Header</header>

      <article>
        <h1>Draft Angle Guidance</h1>
        <p>A suitable draft angle supports reliable part ejection.</p>
      </article>

      <aside>RELATED ARTICLES</aside>
      <footer>FOOTER CONTENT</footer>
    </body>
  `;

  const result = extractTextEvidence(html);

  assert.equal(result.length, 1);
  assert.match(
    result[0].excerpt,
    /Draft Angle Guidance/,
  );
  assert.match(
    result[0].excerpt,
    /reliable part ejection/,
  );
  assert.doesNotMatch(
    result[0].excerpt,
    /Site Header/,
  );
  assert.doesNotMatch(
    result[0].excerpt,
    /RELATED ARTICLES/,
  );
  assert.doesNotMatch(
    result[0].excerpt,
    /FOOTER CONTENT/,
  );
});


test("V8-22B excludes cookie, consent, modal and sidebar UI blocks", () => {
  const html = `
    <body>
      <div class="cookie-banner">
        We use cookies to improve your experience.
      </div>

      <div id="consent-modal">
        Accept all cookies.
      </div>

      <div class="sidebar">
        Related engineering articles.
      </div>

      <main>
        <h1>Injection Molding</h1>
        <p>Cooling time depends on material and wall thickness.</p>
      </main>
    </body>
  `;

  const result = extractTextEvidence(html);

  assert.equal(result.length, 1);
  assert.match(
    result[0].excerpt,
    /Cooling time depends on material/,
  );
  assert.doesNotMatch(
    result[0].excerpt,
    /We use cookies/,
  );
  assert.doesNotMatch(
    result[0].excerpt,
    /Accept all cookies/,
  );
  assert.doesNotMatch(
    result[0].excerpt,
    /Related engineering articles/,
  );
});


test("V8-22B excludes semantic UI elements from structured evidence", () => {
  const html = `
    <body>
      <nav>
        Wall thickness: 999 mm
      </nav>

      <header>
        Draft angle: 999 deg
      </header>

      <main>
        <h1>DFM Guidance</h1>
        <p>Wall thickness: 2 mm.</p>
        <p>Draft angle: 1 mm.</p>
      </main>

      <footer>
        Cooling time: 999 s
      </footer>
    </body>
  `;

  const result = extractStructuredEvidence(html);

  assert.ok(result.length >= 2);

  const excerpts = result.map(
    (candidate) => candidate.excerpt,
  );

  assert.ok(
    excerpts.some(
      (excerpt) => /Wall thickness/i.test(excerpt),
    ),
  );

  assert.ok(
    excerpts.some(
      (excerpt) => /Draft angle/i.test(excerpt),
    ),
  );

  assert.ok(
    excerpts.every(
      (excerpt) => !/999/.test(excerpt),
    ),
  );
});


test("V8-22B removes script, style, noscript, template and SVG payloads", () => {
  const html = `
    <body>
      <script>
        Wall thickness: 999 mm
      </script>

      <style>
        .x { content: "Wall thickness: 999 mm"; }
      </style>

      <noscript>
        Wall thickness: 999 mm
      </noscript>

      <template>
        Wall thickness: 999 mm
      </template>

      <svg>
        <text>Wall thickness: 999 mm</text>
      </svg>

      <main>
        <p>Wall thickness should be 2 mm.</p>
      </main>
    </body>
  `;

  const result = extractTextEvidence(html);

  assert.equal(result.length, 1);
  assert.match(
    result[0].excerpt,
    /Wall thickness should be 2 mm/,
  );
  assert.doesNotMatch(
    result[0].excerpt,
    /999/,
  );
});


test("V8-22B preserves HTML entity decoding inside semantic content", () => {
  const html = `
    <main>
      <p>
        Wall thickness &gt; 1&nbsp;mm &amp; uniform.
      </p>
    </main>
  `;

  const result = extractTextEvidence(html);

  assert.equal(result.length, 1);
  assert.match(
    result[0].excerpt,
    /Wall thickness > 1 mm & uniform/,
  );
});


test("V8-22B structured extraction remains parameter/value/unit aware", () => {
  const html = `
    <main>
      <h1>Wall Thickness</h1>
      <p>Wall thickness: 2 mm.</p>
      <p>Clamp force 50 kN.</p>
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
        candidate.parameter?.toLowerCase() === "clamp force" &&
        candidate.value === "50" &&
        candidate.unit === "kN",
    ),
  );
});


test("V8-22B section attribution remains deterministic", () => {
  const html = `
    <main>
      <h1>Injection Molding</h1>
      <p>Wall thickness: 2 mm.</p>

      <h2>Draft Angle</h2>
      <p>Draft angle: 1 mm.</p>
    </main>
  `;

  const result = extractStructuredEvidence(html);

  const wallThickness = result.find(
    (candidate) =>
      candidate.parameter?.toLowerCase() === "wall thickness",
  );

  const draftAngle = result.find(
    (candidate) =>
      candidate.parameter?.toLowerCase() === "draft angle",
  );

  assert.equal(
    wallThickness?.section,
    "Injection Molding",
  );

  assert.equal(
    draftAngle?.section,
    "Draft Angle",
  );
});


test("V8-22B fails closed for script-only or empty documents", () => {
  assert.deepEqual(
    extractTextEvidence(
      "<html><script>alert('x')</script></html>",
    ),
    [],
  );

  assert.deepEqual(
    extractTextEvidence(
      "<html><style>.x{display:none}</style></html>",
    ),
    [],
  );

  assert.deepEqual(
    extractTextEvidence(""),
    [],
  );
});


test("V8-22B pattern extraction uses semantic content only", () => {
  const html = `
    <nav>
      target: polluted-navigation
    </nav>

    <main>
      <p>target: authoritative-main-content</p>
    </main>

    <footer>
      target: polluted-footer
    </footer>
  `;

  const result = extractEvidenceByPattern(
    html,
    [/target:\s*[a-z-]+/gi],
  );

  assert.equal(result.length, 1);
  assert.equal(
    result[0].excerpt,
    "target: authoritative-main-content",
  );
});


test("V8-22B extraction output is deterministic", () => {
  const html = `
    <header>HEADER</header>
    <main>
      <h1>DFM</h1>
      <p>Wall thickness: 2 mm.</p>
      <p>Draft angle: 1 mm.</p>
    </main>
    <footer>FOOTER</footer>
  `;

  const first = extractStructuredEvidence(html);
  const second = extractStructuredEvidence(html);

  assert.deepEqual(first, second);
});