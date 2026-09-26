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
      <body>
        <header>
          Global navigation.
        </header>

        <main>
          <h1>Injection Molding</h1>
          <p>
            Injection molding is a manufacturing process.
          </p>
          <p>
            Wall thickness: 2 mm.
          </p>
        </main>

        <footer>
          Footer navigation.
        </footer>
      </body>
    </html>
  `;

  const result = extractTextEvidence(html);

  assert.ok(
    result.some((candidate) =>
      /Injection molding is a manufacturing process/i.test(
        candidate.excerpt,
      ),
    ),
  );

  assert.ok(
    result.some((candidate) =>
      /Wall thickness: 2 mm/i.test(candidate.excerpt),
    ),
  );

  assert.ok(
    result.every(
      (candidate) =>
        !/Global navigation|Footer navigation/i.test(
          candidate.excerpt,
        ),
    ),
  );
});

test("V8-22B supports article-only documents without a main element", () => {
  const html = `
    <html>
      <body>
        <nav>
          Navigation.
        </nav>

        <article>
          <h1>Injection Molding</h1>
          <p>
            Injection molding produces plastic parts.
          </p>
          <p>
            Wall thickness: 2 mm.
          </p>
        </article>

        <footer>
          Footer.
        </footer>
      </body>
    </html>
  `;

  const result = extractTextEvidence(html);

  assert.ok(
    result.some((candidate) =>
      /Injection molding produces plastic parts/i.test(
        candidate.excerpt,
      ),
    ),
  );

  assert.ok(
    result.some((candidate) =>
      /Wall thickness: 2 mm/i.test(candidate.excerpt),
    ),
  );

  assert.ok(
    result.every(
      (candidate) =>
        !/Navigation|Footer/i.test(candidate.excerpt),
    ),
  );
});

test("V8-22B excludes cookie, consent, modal and sidebar UI blocks", () => {
  const html = `
    <body>
      <main>
        <h1>Injection Molding</h1>

        <p>
          Real manufacturing content.
        </p>

        <div class="cookie-banner">
          Accept cookies.
        </div>

        <div class="consent-modal">
          Privacy consent.
        </div>

        <div class="modal">
          Modal content.
        </div>

        <div class="sidebar">
          Related content.
        </div>
      </main>
    </body>
  `;

  const result = extractTextEvidence(html);

  assert.ok(
    result.some((candidate) =>
      /Real manufacturing content/i.test(
        candidate.excerpt,
      ),
    ),
  );

  assert.ok(
    result.every(
      (candidate) =>
        !/Accept cookies|Privacy consent|Modal content|Related content/i.test(
          candidate.excerpt,
        ),
    ),
  );
});

test("V8-22B excludes semantic UI elements from structured evidence", () => {
  const html = `
    <body>
      <main>
        <h1>Injection Molding</h1>

        <p>
          Wall thickness: 2 mm.
        </p>

        <nav>
          Clamp force: 500 kN.
        </nav>

        <aside>
          Mold temperature: 80 °C.
        </aside>

        <footer>
          Cycle time: 30 s.
        </footer>
      </main>
    </body>
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
    result.every(
      (candidate) =>
        !/Clamp force|Mold temperature|Cycle time/i.test(
          candidate.excerpt,
        ),
    ),
  );
});

test("V8-22B removes script, style, noscript, template and SVG payloads", () => {
  const html = `
    <body>
      <main>
        <h1>Injection Molding</h1>

        <script>
          Wall thickness: 999 mm.
        </script>

        <style>
          .fake { content: "Clamp force: 999 kN"; }
        </style>

        <noscript>
          Mold temperature: 999 °C.
        </noscript>

        <template>
          Cycle time: 999 s.
        </template>

        <svg>
          <text>Fake value: 999 mm</text>
        </svg>

        <p>
          Wall thickness: 2 mm.
        </p>
      </main>
    </body>
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
    result.every(
      (candidate) =>
        !/999 mm|999 kN|999 °C|999 s/i.test(
          candidate.excerpt,
        ),
    ),
  );
});

test("V8-22B preserves HTML entity decoding inside semantic content", () => {
  const html = `
    <body>
      <main>
        <p>
          Material &amp; Process.
        </p>

        <p>
          Wall thickness: 2&nbsp;mm.
        </p>
      </main>
    </body>
  `;

  const result = extractTextEvidence(html);

  assert.ok(
    result.some((candidate) =>
      /Material & Process/i.test(candidate.excerpt),
    ),
  );

  assert.ok(
    result.some((candidate) =>
      /Wall thickness: 2 mm/i.test(candidate.excerpt),
    ),
  );
});

test("V8-22B structured extraction remains parameter/value/unit aware", () => {
  const html = `
    <body>
      <main>
        <h1>Injection Molding</h1>

        <p>
          Wall thickness: 2 mm.
        </p>

        <p>
          Material temperature: 220 °C.
        </p>

        <p>
          Clamp force: 50 kN.
        </p>
      </main>
    </body>
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
        candidate.parameter?.toLowerCase() ===
          "material temperature" &&
        candidate.value === "220" &&
        candidate.unit === "°C",
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
    <body>
      <main>
        <h1>Injection Molding</h1>

        <p>
          Wall thickness: 2 mm.
        </p>

        <h2>Material Selection</h2>

        <p>
          Material temperature: 220 °C.
        </p>

        <h2>Machine Requirements</h2>

        <p>
          Clamp force: 50 kN.
        </p>
      </main>
    </body>
  `;

  const result = extractStructuredEvidence(html);

  const wallThickness = result.find(
    (candidate) =>
      candidate.parameter?.toLowerCase() === "wall thickness",
  );

  const materialTemperature = result.find(
    (candidate) =>
      candidate.parameter?.toLowerCase() ===
      "material temperature",
  );

  const clampForce = result.find(
    (candidate) =>
      candidate.parameter?.toLowerCase() === "clamp force",
  );

  assert.equal(
    wallThickness?.section,
    "Injection Molding",
  );

  assert.equal(
    materialTemperature?.section,
    "Material Selection",
  );

  assert.equal(
    clampForce?.section,
    "Machine Requirements",
  );
});

test("V8-22B fails closed for script-only or empty documents", () => {
  const scriptOnly = `
    <html>
      <body>
        <script>
          Wall thickness: 2 mm.
        </script>
      </body>
    </html>
  `;

  const empty = `
    <html>
      <body></body>
    </html>
  `;

  assert.deepEqual(
    extractTextEvidence(scriptOnly),
    [],
  );

  assert.deepEqual(
    extractStructuredEvidence(scriptOnly),
    [],
  );

  assert.deepEqual(
    extractTextEvidence(empty),
    [],
  );

  assert.deepEqual(
    extractStructuredEvidence(empty),
    [],
  );
});

test("V8-22B pattern extraction uses semantic content only", () => {
  const html = `
    <body>
      <header>
        Wall thickness: 999 mm.
      </header>

      <main>
        <p>
          Wall thickness: 2 mm.
        </p>
      </main>

      <footer>
        Clamp force: 999 kN.
      </footer>
    </body>
  `;

  const result = extractEvidenceByPattern(
    html,
    [
      /([A-Za-z][A-Za-z ]+):\s*(-?\d+(?:\.\d+)?)\s*(mm|kN)/gi,
    ],
  );

  assert.ok(
    result.some((candidate) =>
      /Wall thickness: 2 mm/i.test(candidate.excerpt),
    ),
  );

  assert.ok(
    result.every(
      (candidate) =>
        !/999 mm|999 kN/i.test(candidate.excerpt),
    ),
  );
});

test("V8-22B extraction output is deterministic", () => {
  const html = `
    <body>
      <main>
        <h1>Injection Molding</h1>

        <p>
          Wall thickness: 2 mm.
        </p>

        <p>
          Material temperature: 220 °C.
        </p>
      </main>
    </body>
  `;

  const first = extractStructuredEvidence(html);
  const second = extractStructuredEvidence(html);

  assert.deepEqual(second, first);
});

test("V8-22B-S2 excludes nested sidebar descendants without truncating main content", () => {
  const html = `
    <body>
      <main>
        <p>
          Before sidebar content.
        </p>

        <div class="sidebar">
          <div>
            Fake sidebar value: 999 mm.
          </div>
        </div>

        <p>
          After sidebar content.
        </p>
      </main>
    </body>
  `;

  const result = extractTextEvidence(html);

  assert.ok(
    result.some((candidate) =>
      /Before sidebar content/i.test(candidate.excerpt),
    ),
  );

  assert.ok(
    result.some((candidate) =>
      /After sidebar content/i.test(candidate.excerpt),
    ),
  );

  assert.ok(
    result.every(
      (candidate) =>
        !/Fake sidebar value/i.test(candidate.excerpt),
    ),
  );
});

test("V8-22B-S2 excludes nested cookie descendants without leaking trailing UI content", () => {
  const html = `
    <body>
      <main>
        <p>
          Before cookie.
        </p>

        <section class="cookie-banner">
          <div>
            Cookie title.
          </div>

          <div>
            Cookie value: 999 mm.
          </div>
        </section>

        <p>
          After cookie.
        </p>
      </main>
    </body>
  `;

  const result = extractTextEvidence(html);

  assert.ok(
    result.some((candidate) =>
      /Before cookie/i.test(candidate.excerpt),
    ),
  );

  assert.ok(
    result.some((candidate) =>
      /After cookie/i.test(candidate.excerpt),
    ),
  );

  assert.ok(
    result.every(
      (candidate) =>
        !/Cookie title|Cookie value/i.test(
          candidate.excerpt,
        ),
    ),
  );
});

test("V8-22B-S2 preserves content before and after nested related-content blocks", () => {
  const html = `
    <body>
      <main>
        <p>
          Primary content before related block.
        </p>

        <div class="related-content">
          <article>
            Related content value: 999 mm.
          </article>
        </div>

        <p>
          Primary content after related block.
        </p>
      </main>
    </body>
  `;

  const result = extractTextEvidence(html);

  assert.ok(
    result.some((candidate) =>
      /Primary content before related block/i.test(
        candidate.excerpt,
      ),
    ),
  );

  assert.ok(
    result.some((candidate) =>
      /Primary content after related block/i.test(
        candidate.excerpt,
      ),
    ),
  );

  assert.ok(
    result.every(
      (candidate) =>
        !/Related content value/i.test(
          candidate.excerpt,
        ),
    ),
  );
});

test("V8-22B-S2 excludes nested newsletter blocks inside article content", () => {
  const html = `
    <body>
      <main>
        <article>
          <p>
            Primary article content.
          </p>

          <div class="newsletter">
            <div>
              Subscribe for updates.
            </div>
          </div>

          <p>
            More primary article content.
          </p>
        </article>
      </main>
    </body>
  `;

  const result = extractTextEvidence(html);

  assert.ok(
    result.some((candidate) =>
      /Primary article content/i.test(
        candidate.excerpt,
      ),
    ),
  );

  assert.ok(
    result.some((candidate) =>
      /More primary article content/i.test(
        candidate.excerpt,
      ),
    ),
  );

  assert.ok(
    result.every(
      (candidate) =>
        !/Subscribe for updates/i.test(
          candidate.excerpt,
        ),
    ),
  );
});

test("V8-22B-S2 excludes nested complementary UI blocks", () => {
  const html = `
    <body>
      <main>
        <p>
          Primary content.
        </p>

        <div role="complementary">
          <div>
            Complementary value: 999 mm.
          </div>
        </div>

        <p>
          More primary content.
        </p>
      </main>
    </body>
  `;

  const result = extractTextEvidence(html);

  assert.ok(
    result.some((candidate) =>
      /Primary content/i.test(candidate.excerpt),
    ),
  );

  assert.ok(
    result.some((candidate) =>
      /More primary content/i.test(candidate.excerpt),
    ),
  );

  assert.ok(
    result.every(
      (candidate) =>
        !/Complementary value/i.test(
          candidate.excerpt,
        ),
    ),
  );
});

test("V8-22B-S2 structured extraction cannot promote nested UI values into evidence", () => {
  const html = `
    <body>
      <main>
        <p>
          Wall thickness: 2 mm.
        </p>

        <div class="sidebar">
          <p>
            Fake thickness: 999 mm.
          </p>
        </div>
      </main>
    </body>
  `;

  const result = extractStructuredEvidence(html);

  assert.ok(
    result.some(
      (candidate) =>
        candidate.parameter?.toLowerCase() ===
          "wall thickness" &&
        candidate.value === "2" &&
        candidate.unit === "mm",
    ),
  );

  assert.ok(
    result.every(
      (candidate) =>
        !/Fake thickness/i.test(candidate.excerpt),
    ),
  );
});

test("V8-22B-S2 text and structured extraction share the same semantic boundary", () => {
  const html = `
    <body>
      <main>
        <p>
          Wall thickness: 2 mm.
        </p>

        <div class="sidebar">
          <p>
            Fake thickness: 999 mm.
          </p>
        </div>
      </main>
    </body>
  `;

  const text = extractTextEvidence(html);
  const structured = extractStructuredEvidence(html);

  assert.ok(
    text.every(
      (candidate) =>
        !/Fake thickness/i.test(candidate.excerpt),
    ),
  );

  assert.ok(
    structured.every(
      (candidate) =>
        !/Fake thickness/i.test(candidate.excerpt),
    ),
  );
});

test("V8-22B-S2 nested UI blocks cannot contaminate pattern extraction", () => {
  const html = `
    <body>
      <main>
        <p>
          Wall thickness: 2 mm.
        </p>

        <div class="related-posts">
          <p>
            Fake thickness: 999 mm.
          </p>
        </div>
      </main>
    </body>
  `;

  const result = extractEvidenceByPattern(
    html,
    [
      /([A-Za-z][A-Za-z ]+):\s*(-?\d+(?:\.\d+)?)\s*(mm|kN)/gi,
    ],
  );

  assert.ok(
    result.some((candidate) =>
      /Wall thickness: 2 mm/i.test(candidate.excerpt),
    ),
  );

  assert.ok(
    result.every(
      (candidate) =>
        !/Fake thickness/i.test(candidate.excerpt),
    ),
  );
});

test("V8-22B-S2 article boundary excludes nested UI but preserves article facts", () => {
  const html = `
    <body>
      <article>
        <h1>Injection Molding</h1>

        <p>
          Wall thickness: 2 mm.
        </p>

        <aside>
          Fake thickness: 999 mm.
        </aside>

        <p>
          Material temperature: 220 °C.
        </p>
      </article>
    </body>
  `;

  const result = extractStructuredEvidence(html);

  assert.ok(
    result.some(
      (candidate) =>
        candidate.parameter?.toLowerCase() ===
          "wall thickness" &&
        candidate.value === "2" &&
        candidate.unit === "mm",
    ),
  );

  assert.ok(
    result.some(
      (candidate) =>
        candidate.parameter?.toLowerCase() ===
          "material temperature" &&
        candidate.value === "220" &&
        candidate.unit === "°C",
    ),
  );

  assert.ok(
    result.every(
      (candidate) =>
        !/Fake thickness/i.test(candidate.excerpt),
    ),
  );
});

test("V8-22B-S2 does not truncate real content after a nested UI block", () => {
  const html = `
    <body>
      <main>
        <p>
          First authoritative fact.
        </p>

        <div class="modal">
          Fake modal fact: 999 mm.
        </div>

        <p>
          Second authoritative fact.
        </p>
      </main>
    </body>
  `;

  const result = extractTextEvidence(html);

  assert.ok(
    result.some((candidate) =>
      /First authoritative fact/i.test(
        candidate.excerpt,
      ),
    ),
  );

  assert.ok(
    result.some((candidate) =>
      /Second authoritative fact/i.test(
        candidate.excerpt,
      ),
    ),
  );

  assert.ok(
    result.every(
      (candidate) =>
        !/Fake modal fact/i.test(candidate.excerpt),
    ),
  );
});

test("V8-22B-S2 repeated adversarial extraction is deterministic", () => {
  const html = `
    <body>
      <main>
        <h1>Injection Molding</h1>

        <p>
          Wall thickness: 2 mm.
        </p>

        <div class="sidebar">
          <p>
            Fake value: 999 mm.
          </p>
        </div>

        <h2>Materials</h2>

        <p>
          Material temperature: 220 °C.
        </p>
      </main>
    </body>
  `;

  const first = extractStructuredEvidence(html);
  const second = extractStructuredEvidence(html);
  const third = extractStructuredEvidence(html);

  assert.deepEqual(second, first);
  assert.deepEqual(third, first);
});

test("V8-22B-S3 rejects commercial CTA blocks and preserves authoritative section attribution", () => {
  const html = `
    <body>
      <header>
        Global navigation.
      </header>

      <main>
        <h1>Custom Plastic Injection Molding</h1>

        <div>
          Upload a Part View Materials
        </div>

        <div>
          Certification + Compliance ISO 9001:2015 | ISO 13485:2016
        </div>

        <h2>Jump to Section</h2>

        <div>
          Capabilities Materials Surface Finishes Quality Inspections
        </div>

        <h2>About Plastic Injection Molding</h2>

        <p>
          Injection molding is a manufacturing process that fills a mold
          cavity with plastic resin to form a finished part.
        </p>

        <p>
          Wall thickness: 2 mm.
        </p>

        <div>
          Get an online quote and injection molding design analysis today.
        </div>

        <div>
          Get a Quote
        </div>

        <h2>Thermoplastic Material Selection for Injection Molding</h2>

        <p>
          Material temperature: 220 °C.
        </p>

        <p>
          Clamp force: 50 kN.
        </p>
      </main>

      <footer>
        Privacy Policy Cookie Policy.
      </footer>
    </body>
  `;

  const result = extractStructuredEvidence(html);

  const authoritative = result.filter(
    (candidate) =>
      candidate.parameter !== undefined,
  );

  assert.ok(
    authoritative.some(
      (candidate) =>
        candidate.parameter?.toLowerCase() === "wall thickness" &&
        candidate.value === "2" &&
        candidate.unit === "mm",
    ),
  );

  assert.ok(
    authoritative.some(
      (candidate) =>
        candidate.parameter?.toLowerCase() ===
          "material temperature" &&
        candidate.value === "220" &&
        candidate.unit === "°C",
    ),
  );

  assert.ok(
    authoritative.some(
      (candidate) =>
        candidate.parameter?.toLowerCase() === "clamp force" &&
        candidate.value === "50" &&
        candidate.unit === "kN",
    ),
  );

  assert.ok(
    authoritative.every(
      (candidate) =>
        candidate.section !== "Jump to Section",
    ),
  );

  assert.ok(
    result.every(
      (candidate) =>
        !/Upload a Part View Materials/i.test(
          candidate.excerpt,
        ),
    ),
  );

  assert.ok(
    result.every(
      (candidate) =>
        !/Certification \+ Compliance/i.test(
          candidate.excerpt,
        ),
    ),
  );

  assert.ok(
    result.every(
      (candidate) =>
        !/Get an online quote/i.test(
          candidate.excerpt,
        ),
    ),
  );

  assert.ok(
    result.every(
      (candidate) =>
        !/^Get a Quote$/i.test(
          candidate.excerpt.trim(),
        ),
    ),
  );

  assert.ok(
    result.every(
      (candidate) =>
        !/Capabilities Materials Surface Finishes Quality Inspections/i.test(
          candidate.excerpt,
        ),
    ),
  );
});

test("V8-22B-S4 excludes hero compliance, jump navigation and footer CTA UI", () => {
  const html = `
    <body>
      <main>
        <div class="hero2 default">
          <div class="hero2-content">
            <h1 class="hero2-title">
              Custom Plastic Injection Molding
            </h1>

            <div class="hero2-sub-content">
              <p>
                Get custom plastic parts within days.
                Request an online quote.
              </p>
            </div>

            <div class="hero2-buttons">
              <a
                class="btn btn-default"
                href="/ecom/get-a-quote/"
              >
                Upload a Part
              </a>

              <a
                class="btn btn-tertiary blue"
                href="/materials/injection-molding/"
              >
                View Materials
              </a>
            </div>
          </div>

          <div class="row">
            <div class="col-md-6 column hero2-lower">
              <div>
                <p>
                  <a href="/iso/">
                    <strong>Certification + Compliance</strong>
                  </a>
                  <br />
                  ISO 9001:2015 | ISO 13485:2016 |
                  AS9100D | CTQ Inspections | ITAR
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="jump-navigation">
          <h5>Jump to Section</h5>

          <p>
            <span>→</span>
            <a href="#capabilities">Capabilities</a>
            <br />

            <span>→</span>
            <a href="#materials">Materials</a>
            <br />

            <span>→</span>
            <a href="#surface-finishes">Surface Finishes</a>
            <br />

            <span>→</span>
            <a href="#quality-inspections">
              Quality Inspections
            </a>
          </p>
        </div>

        <h2>About Plastic Injection Molding</h2>

        <p>
          Injection molding is a manufacturing process that fills
          a mold cavity with plastic resin to form a finished part.
        </p>

        <p>
          Wall thickness: 2 mm.
        </p>

        <h2>
          Thermoplastic Material Selection for Injection Molding
        </h2>

        <p>
          Material temperature: 220 °C.
        </p>

        <p>
          Clamp force: 50 kN.
        </p>

        <div class="hero-container black connect-to-footer center">
          <div class="bg-cover">
            <img src="/media/process.jpg" alt="" />
          </div>

          <div class="container rte">
            <div class="hero-content">
              <div class="rich-text white">
                <p>
                  Get an online quote and injection molding
                  design analysis today.
                </p>
              </div>

              <div>
                <a
                  class="btn btn-default"
                  href="/ecom/get-a-quote/"
                >
                  Get a Quote
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>
    </body>
  `;

  const result = extractStructuredEvidence(html);

  const authoritative = result.filter(
    (candidate) =>
      candidate.parameter !== undefined,
  );

  assert.ok(
    authoritative.some(
      (candidate) =>
        candidate.parameter?.toLowerCase() === "wall thickness" &&
        candidate.value === "2" &&
        candidate.unit === "mm",
    ),
  );

  assert.ok(
    authoritative.some(
      (candidate) =>
        candidate.parameter?.toLowerCase() ===
          "material temperature" &&
        candidate.value === "220" &&
        candidate.unit === "°C",
    ),
  );

  assert.ok(
    authoritative.some(
      (candidate) =>
        candidate.parameter?.toLowerCase() === "clamp force" &&
        candidate.value === "50" &&
        candidate.unit === "kN",
    ),
  );

  assert.ok(
    result.every(
      (candidate) =>
        !/Certification \+ Compliance/i.test(
          candidate.excerpt,
        ),
    ),
  );

  assert.ok(
    result.every(
      (candidate) =>
        !/Jump to Section/i.test(
          candidate.excerpt,
        ),
    ),
  );

  assert.ok(
    result.every(
      (candidate) =>
        !/Capabilities Materials Surface Finishes/i.test(
          candidate.excerpt,
        ),
    ),
  );

  assert.ok(
    result.every(
      (candidate) =>
        !/Get an online quote and injection molding/i.test(
          candidate.excerpt,
        ),
    ),
  );

  assert.ok(
    result.every(
      (candidate) =>
        !/^Get a Quote$/i.test(
          candidate.excerpt.trim(),
        ),
    ),
  );

  assert.ok(
    result.every(
      (candidate) =>
        candidate.section !== "Jump to Section",
    ),
  );

  assert.ok(
    result.some(
      (candidate) =>
        /Wall thickness: 2 mm/i.test(
          candidate.excerpt,
        ),
    ),
  );

  assert.ok(
    result.some(
      (candidate) =>
        /Material temperature: 220 °C/i.test(
          candidate.excerpt,
        ),
    ),
  );

  assert.ok(
    result.some(
      (candidate) =>
        /Clamp force: 50 kN/i.test(
          candidate.excerpt,
        ),
    ),
  );
});