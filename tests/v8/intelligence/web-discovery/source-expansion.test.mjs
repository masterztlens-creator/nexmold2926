import assert from "node:assert/strict";
import test from "node:test";

import {
  expandSourceReferences,
} from "../../../../src/v8/intelligence/web-discovery/source-expansion.js";

function createFetchedPage({
  body,
  mediaType = "text/html",
  finalUrl = "https://example.com/original",
  requestedUrl = finalUrl,
  fetchedAt = "2026-09-28T03:00:00.000Z",
  status = 200,
} = {}) {
  return {
    requestedUrl,
    finalUrl,
    redirectChain: [requestedUrl, finalUrl],
    status,
    mediaType,
    body,
    bytes: new TextEncoder().encode(body),
    fetchedAt,
  };
}

function comparableReferences(result) {
  return result
    .map((item) => ({
      url: item.url,
      kind: item.kind,
      ...(item.title !== undefined
        ? { title: item.title }
        : {}),
      ...(item.sourceUrl !== undefined
        ? { sourceUrl: item.sourceUrl }
        : {}),
      ...(item.discoveredAt !== undefined
        ? { discoveredAt: item.discoveredAt }
        : {}),
    }))
    .sort((a, b) => {
      const left =
        `${a.kind}:${a.url}:${a.title ?? ""}`;
      const right =
        `${b.kind}:${b.url}:${b.title ?? ""}`;

      return left.localeCompare(right);
    });
}

test(
  "V8 source expansion extracts anchor links from HTML",
  () => {
    const page = createFetchedPage({
      body: `
        <html>
          <body>
            <a href="/engineering">Engineering</a>
            <a href="https://example.org/specs">Specifications</a>
          </body>
        </html>
      `,
    });

    const result =
      expandSourceReferences(page);

    assert.deepEqual(
      comparableReferences(result),
      [
        {
          url: "https://example.com/engineering",
          kind: "LINK",
          title: "Engineering",
          sourceUrl:
            "https://example.com/original",
          discoveredAt:
            "2026-09-28T03:00:00.000Z",
        },
        {
          url: "https://example.org/specs",
          kind: "LINK",
          title: "Specifications",
          sourceUrl:
            "https://example.com/original",
          discoveredAt:
            "2026-09-28T03:00:00.000Z",
        },
      ].sort((a, b) => {
        const left =
          `${a.kind}:${a.url}:${a.title ?? ""}`;
        const right =
          `${b.kind}:${b.url}:${b.title ?? ""}`;

        return left.localeCompare(right);
      }),
    );
  },
);

test(
  "V8 source expansion resolves relative links against final URL",
  () => {
    const page = createFetchedPage({
      finalUrl:
        "https://example.com/catalog/index.html",
      body: `
        <a href="../materials">Materials</a>
        <a href="./parts/widget">Widget</a>
        <a href="/standards">Standards</a>
      `,
    });

    const result =
      expandSourceReferences(page);

    const urls = result
      .filter((item) => item.kind === "LINK")
      .map((item) => item.url)
      .sort();

    assert.deepEqual(
      urls,
      [
        "https://example.com/materials",
        "https://example.com/catalog/parts/widget",
        "https://example.com/standards",
      ].sort(),
    );
  },
);

test(
  "V8 source expansion strips URL fragments",
  () => {
    const page = createFetchedPage({
      body: `
        <a href="/engineering#wall-thickness">
          Wall Thickness
        </a>
        <a href="/engineering#draft-angle">
          Draft Angle
        </a>
      `,
    });

    const result =
      expandSourceReferences(page);

    assert.deepEqual(
      result
        .filter((item) => item.kind === "LINK")
        .map((item) => item.url),
      [
        "https://example.com/engineering",
      ],
    );
  },
);

test(
  "V8 source expansion rejects unsupported URL schemes",
  () => {
    const page = createFetchedPage({
      body: `
        <a href="javascript:void(0)">JavaScript</a>
        <a href="mailto:test@example.com">Mail</a>
        <a href="tel:+861234567890">Telephone</a>
        <a href="data:text/plain,test">Data</a>
        <a href="blob:https://example.com/id">Blob</a>
        <a href="file:///tmp/example">File</a>
        <a href="/valid">Valid</a>
      `,
    });

    const result =
      expandSourceReferences(page);

    assert.deepEqual(
      result.map((item) => item.url),
      [
        "https://example.com/valid",
      ],
    );
  },
);

test(
  "V8 source expansion extracts canonical and reference links",
  () => {
    const page = createFetchedPage({
      body: `
        <head>
          <link
            rel="canonical"
            href="/canonical"
          />
          <link
            rel="alternate"
            href="/alternate"
          />
          <link
            rel="author"
            href="/author"
          />
          <link
            rel="source"
            href="/source"
          />
          <link
            rel="cite"
            href="/citation"
          />
        </head>
      `,
    });

    const result =
      expandSourceReferences(page);

    assert.deepEqual(
      result
        .filter(
          (item) =>
            item.kind === "REFERENCE",
        )
        .map((item) => item.url)
        .sort(),
      [
        "https://example.com/alternate",
        "https://example.com/author",
        "https://example.com/canonical",
        "https://example.com/citation",
        "https://example.com/source",
      ].sort(),
    );
  },
);

test(
  "V8 source expansion extracts Open Graph canonical reference",
  () => {
    const page = createFetchedPage({
      body: `
        <meta
          property="og:url"
          content="https://example.com/article"
        />
      `,
    });

    const result =
      expandSourceReferences(page);

    assert.deepEqual(
      result.filter(
        (item) =>
          item.kind === "REFERENCE",
      ),
      [
        {
          url:
            "https://example.com/article",
          kind: "REFERENCE",
          sourceUrl:
            "https://example.com/original",
          discoveredAt:
            "2026-09-28T03:00:00.000Z",
        },
      ],
    );
  },
);

test(
  "V8 source expansion extracts sitemap references from HTML",
  () => {
    const page = createFetchedPage({
      body: `
        <html>
          <head>
            <link
              rel="sitemap"
              href="/sitemap.xml"
            />
          </head>
          <body>
            <a href="/sitemap.xml">
              Sitemap
            </a>
          </body>
        </html>
      `,
    });

    const result =
      expandSourceReferences(page);

    assert.deepEqual(
      result
        .map((item) => ({
          url: item.url,
          kind: item.kind,
        }))
        .sort((a, b) =>
          `${a.kind}:${a.url}`.localeCompare(
            `${b.kind}:${b.url}`,
          ),
        ),
      [
        {
          url:
            "https://example.com/sitemap.xml",
          kind: "LINK",
        },
        {
          url:
            "https://example.com/sitemap.xml",
          kind: "SITEMAP",
        },
      ].sort((a, b) =>
        `${a.kind}:${a.url}`.localeCompare(
          `${b.kind}:${b.url}`,
        ),
      ),
    );
  },
);

test(
  "V8 source expansion extracts sitemap locations from XML",
  () => {
    const page = createFetchedPage({
      mediaType: "application/xml",
      finalUrl:
        "https://example.com/sitemap.xml",
      body: `
        <?xml version="1.0" encoding="UTF-8"?>
        <urlset>
          <url>
            <loc>https://example.com/page-a</loc>
          </url>
          <url>
            <loc>https://example.com/page-b</loc>
          </url>
        </urlset>
      `,
    });

    const result =
      expandSourceReferences(page);

    assert.deepEqual(
      result.map((item) => ({
        url: item.url,
        kind: item.kind,
      })),
      [
        {
          url:
            "https://example.com/page-a",
          kind: "SITEMAP",
        },
        {
          url:
            "https://example.com/page-b",
          kind: "SITEMAP",
        },
      ],
    );
  },
);

test(
  "V8 source expansion deduplicates identical references by kind and URL",
  () => {
    const page = createFetchedPage({
      body: `
        <head>
          <link
            rel="canonical"
            href="/canonical"
          />
        </head>

        <body>
          <a href="/same">First</a>
          <a href="/same">Second</a>
          <a href="/same#fragment">
            Fragment
          </a>
        </body>
      `,
    });

    const result =
      expandSourceReferences(page);

    assert.deepEqual(
      result.map((item) => ({
        url: item.url,
        kind: item.kind,
        ...(item.title !== undefined
          ? {
              title: item.title,
            }
          : {}),
      })),
      [
        {
          url:
            "https://example.com/same",
          kind: "LINK",
          title: "First",
        },
        {
          url:
            "https://example.com/canonical",
          kind: "REFERENCE",
        },
      ],
    );
  },
);

test(
  "V8 source expansion preserves source URL and fetch timestamp",
  () => {
    const page = createFetchedPage({
      finalUrl:
        "https://example.com/final",
      fetchedAt:
        "2026-09-28T04:15:30.000Z",
      body: `
        <a href="/target">Target</a>
      `,
    });

    const result =
      expandSourceReferences(page);

    assert.equal(
      result.length,
      1,
    );

    assert.deepEqual(
      result[0],
      {
        url:
          "https://example.com/target",
        kind: "LINK",
        sourceUrl:
          "https://example.com/final",
        title: "Target",
        discoveredAt:
          "2026-09-28T04:15:30.000Z",
      },
    );
  },
);

test(
  "V8 source expansion returns empty output for empty bodies",
  () => {
    const page = createFetchedPage({
      body: "   ",
    });

    const result =
      expandSourceReferences(page);

    assert.deepEqual(
      result,
      [],
    );
  },
);

test(
  "V8 source expansion ignores non-HTML non-sitemap documents",
  () => {
    const page = createFetchedPage({
      mediaType:
        "application/pdf",
      body: `
        <a href="/should-not-expand">
          Should Not Expand
        </a>
      `,
    });

    const result =
      expandSourceReferences(page);

    assert.deepEqual(
      result,
      [],
    );
  },
);

test(
  "V8 source expansion handles XHTML media type",
  () => {
    const page = createFetchedPage({
      mediaType:
        "application/xhtml+xml",
      body: `
        <html>
          <body>
            <a href="/xhtml">
              XHTML
            </a>
          </body>
        </html>
      `,
    });

    const result =
      expandSourceReferences(page);

    assert.deepEqual(
      result.map((item) => ({
        url: item.url,
        kind: item.kind,
      })),
      [
        {
          url:
            "https://example.com/xhtml",
          kind: "LINK",
        },
      ],
    );
  },
);

test(
  "V8 source expansion handles XML media type with charset",
  () => {
    const page = createFetchedPage({
      mediaType:
        "application/xml; charset=utf-8",
      finalUrl:
        "https://example.com/sitemap.xml",
      body: `
        <urlset>
          <url>
            <loc>
              https://example.com/with-charset
            </loc>
          </url>
        </urlset>
      `,
    });

    const result =
      expandSourceReferences(page);

    assert.deepEqual(
      result.map((item) => ({
        url: item.url,
        kind: item.kind,
      })),
      [
        {
          url:
            "https://example.com/with-charset",
          kind: "SITEMAP",
        },
      ],
    );
  },
);

test(
  "V8 source expansion decodes HTML URL entities",
  () => {
    const page = createFetchedPage({
      body: `
        <a
          href="/search?q=plastic&amp;page=2"
        >
          Search
        </a>
      `,
    });

    const result =
      expandSourceReferences(page);

    assert.deepEqual(
      result.map((item) => item.url),
      [
        "https://example.com/search?q=plastic&page=2",
      ],
    );
  },
);