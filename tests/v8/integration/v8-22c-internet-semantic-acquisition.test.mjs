import test from "node:test";
import assert from "node:assert/strict";

import {
  FoundationService,
  InMemoryFoundationStore,
} from "../../../.v8-build/src/v8/foundation/index.js";

import {
  acquireInternetPage,
  evidenceAggregateId,
} from "../../../.v8-build/src/v8/acquisition/index.js";

const INGESTOR = {
  id: "v8-22c-internet-ingestor",
  role: "INGESTOR",
};

const AUDITOR = {
  id: "v8-22c-auditor",
  role: "AUDITOR",
};

const FIXTURE_URL = "https://example.com/v8-22c-fixture";

const FIXTURE_HTML = `
<!doctype html>
<html>
  <head>
    <title>V8-22C semantic acquisition fixture</title>
    <script>
      const navigationNoise = "Navigation strength 999 mm";
    </script>
    <style>
      .noise { width: 999px; }
    </style>
  </head>

  <body>
    <header>
      <nav>
        Navigation thickness: 999 mm
      </nav>
    </header>

    <main>
      <article>
        <h1>Injection molding wall thickness</h1>

        <p>
          Recommended wall thickness is 2.5 mm for the tested application.
        </p>

        <section>
          <h2>Design requirement</h2>
          <p>
            Nominal wall thickness: 2.5 mm
          </p>
          <p>
            Processing temperature: 220 °C
          </p>
        </section>

        <aside class="related-content">
          Related content wall thickness: 999 mm
        </aside>

        <p>
          The principal design requirement remains 2.5 mm.
        </p>
      </article>
    </main>

    <aside class="sidebar">
      Sidebar wall thickness: 888 mm
    </aside>

    <div class="cookie-banner">
      Cookie consent wall thickness: 777 mm
    </div>

    <footer>
      Footer wall thickness: 666 mm
    </footer>
  </body>
</html>
`;

async function withInternetFixture(fn) {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input) => {
    const requestedUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    assert.equal(
      requestedUrl,
      FIXTURE_URL,
      "V8-22C fixture must use the eligible public HTTPS URL",
    );

    return new Response(FIXTURE_HTML, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
      },
    });
  };

  try {
    return await fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test(
  "V8-22C: Internet acquisition applies semantic extraction before Evidence persistence",
  async () => {
    await withInternetFixture(async () => {
      const store =
        new InMemoryFoundationStore();

      const acquired =
        await acquireInternetPage(
          FIXTURE_URL,
          store,
          {
            actorId: INGESTOR.id,
          },
        );

      assert.ok(acquired.sourceId);
      assert.ok(acquired.snapshotId);

      const snapshotRecord =
        store.get(
          "SNAPSHOT",
          acquired.snapshotId,
        );

      assert.ok(snapshotRecord);

      assert.equal(
        snapshotRecord.state,
        "SEALED",
      );

      assert.ok(
        acquired.evidence.length > 0,
        "Semantic extraction must produce Evidence candidates",
      );

      const evidenceRecords =
        acquired.evidence.map(
          (payload) => {
            const id =
              evidenceAggregateId(
                acquired.sourceId,
                acquired.snapshotId,
                {
                  locator: payload.locator,
                  excerpt: payload.excerpt,

                  page: payload.page,
                  printedPage:
                    payload.printedPage,

                  section: payload.section,
                  table: payload.table,
                  row: payload.row,

                  parameter:
                    payload.parameter,
                  value: payload.value,
                  unit: payload.unit,

                  materialManufacturer:
                    payload.materialManufacturer,
                  materialGrade:
                    payload.materialGrade,

                  testMethod:
                    payload.testMethod,
                  testCondition:
                    payload.testCondition,
                  flowDirection:
                    payload.flowDirection,

                  extractionConfidence:
                    payload.extractionConfidence ??
                    "LOW",
                },
                acquired.snapshot.contentHash,
              );

            const record =
              store.get(
                "EVIDENCE",
                id,
              );

            assert.ok(
              record,
              `Evidence record missing for ${id}`,
            );

            return record;
          },
        );

      const combinedEvidence =
        evidenceRecords
          .map(
            (record) =>
              `${record.payload.excerpt} ${
                record.payload.parameter ?? ""
              } ${
                record.payload.value ?? ""
              } ${
                record.payload.unit ?? ""
              }`,
          )
          .join("\n");

      assert.match(
        combinedEvidence,
        /2\.5/,
        "Main/article evidence must survive semantic extraction",
      );

      assert.match(
        combinedEvidence,
        /220/,
        "Structured parameter evidence must survive semantic extraction",
      );

      assert.match(
        combinedEvidence,
        /°C/,
        "Structured unit must survive semantic extraction",
      );

      assert.doesNotMatch(
        combinedEvidence,
        /999\s*mm/,
        "Navigation/related-content noise must not enter Evidence",
      );

      assert.doesNotMatch(
        combinedEvidence,
        /888\s*mm/,
        "Sidebar noise must not enter Evidence",
      );

      assert.doesNotMatch(
        combinedEvidence,
        /777\s*mm/,
        "Cookie-banner noise must not enter Evidence",
      );

      assert.doesNotMatch(
        combinedEvidence,
        /666\s*mm/,
        "Footer noise must not enter Evidence",
      );

      for (const record of evidenceRecords) {
        assert.ok(
          record.lineage.some(
            (item) =>
              item.type === "SNAPSHOT" &&
              item.id ===
                acquired.snapshotId &&
              item.version ===
                snapshotRecord.version &&
              item.fingerprint ===
                snapshotRecord.fingerprint,
          ),
          "Evidence must bind the exact sealed Snapshot version and fingerprint",
        );
      }

      const service =
        new FoundationService(store);

      for (const record of evidenceRecords) {
        const verified =
          service.verifyEvidence(
            record.aggregateId,
            AUDITOR,
          );

        assert.equal(
          verified.state,
          "VERIFIED",
        );
      }

      store.verifyChain();
    });
  },
);

test(
  "V8-22C: repeated Internet acquisition remains deterministic",
  async () => {
    await withInternetFixture(async () => {
      const firstStore =
        new InMemoryFoundationStore();

      const secondStore =
        new InMemoryFoundationStore();

      const first =
        await acquireInternetPage(
          FIXTURE_URL,
          firstStore,
          {
            actorId: INGESTOR.id,
          },
        );

      const second =
        await acquireInternetPage(
          FIXTURE_URL,
          secondStore,
          {
            actorId: INGESTOR.id,
          },
        );

      assert.equal(
        first.sourceId,
        second.sourceId,
      );

      assert.equal(
        first.snapshotId,
        second.snapshotId,
      );

      assert.equal(
        first.snapshot.contentHash,
        second.snapshot.contentHash,
      );

      assert.deepEqual(
        first.evidence,
        second.evidence,
        "Repeated extraction must produce identical Evidence payloads",
      );

      const firstEvidence =
        first.evidence.map(
          (payload) =>
            evidenceAggregateId(
              first.sourceId,
              first.snapshotId,
              {
                locator:
                  payload.locator,
                excerpt:
                  payload.excerpt,

                page: payload.page,
                printedPage:
                  payload.printedPage,

                section:
                  payload.section,
                table:
                  payload.table,
                row:
                  payload.row,

                parameter:
                  payload.parameter,
                value:
                  payload.value,
                unit:
                  payload.unit,

                materialManufacturer:
                  payload.materialManufacturer,
                materialGrade:
                  payload.materialGrade,

                testMethod:
                  payload.testMethod,
                testCondition:
                  payload.testCondition,
                flowDirection:
                  payload.flowDirection,

                extractionConfidence:
                  payload.extractionConfidence ??
                  "LOW",
              },
              first.snapshot.contentHash,
            ),
        );

      const secondEvidence =
        second.evidence.map(
          (payload) =>
            evidenceAggregateId(
              second.sourceId,
              second.snapshotId,
              {
                locator:
                  payload.locator,
                excerpt:
                  payload.excerpt,

                page: payload.page,
                printedPage:
                  payload.printedPage,

                section:
                  payload.section,
                table:
                  payload.table,
                row:
                  payload.row,

                parameter:
                  payload.parameter,
                value:
                  payload.value,
                unit:
                  payload.unit,

                materialManufacturer:
                  payload.materialManufacturer,
                materialGrade:
                  payload.materialGrade,

                testMethod:
                  payload.testMethod,
                testCondition:
                  payload.testCondition,
                flowDirection:
                  payload.flowDirection,

                extractionConfidence:
                  payload.extractionConfidence ??
                  "LOW",
              },
              second.snapshot.contentHash,
            ),
        );

      assert.deepEqual(
        firstEvidence,
        secondEvidence,
        "Repeated acquisition must produce identical Evidence identities",
      );

      firstStore.verifyChain();
      secondStore.verifyChain();
    });
  },
);