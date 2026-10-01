import fs from "node:fs";
import path from "node:path";

import {
  HttpPageFetcher,
} from "../.v8-build/src/v8/acquisition/page-fetcher.js";

import {
  observeInternetFirstHop,
} from "../.v8-build/src/v8/intelligence/web-discovery/first-hop-observer.js";

import {
  runV8ArticleRuntime,
} from "../.v8-build/src/v8/runtime/article-runtime.js";

import {
  contentFingerprint,
} from "../.v8-build/src/v8/foundation/hash.js";

const ARTICLE_TITLE =
  "Plastic Injection Molding Wall Thickness";

const PRIMARY_KEYWORD =
  "plastic injection molding wall thickness";

const ARTICLE_SLUG =
  "plastic-injection-molding-wall-thickness";

const ARTICLE_DESCRIPTION =
  "Evidence-backed engineering guidance for plastic injection molding wall thickness.";

const ARTICLE_ROOT = path.resolve(
  ".nexmold",
  "v8",
  "articles",
  ARTICLE_SLUG,
);

const ARTICLE_PATH = path.join(
  ARTICLE_ROOT,
  "article.md",
);

const MANIFEST_PATH = path.join(
  ARTICLE_ROOT,
  "manifest.json",
);

const ACTOR = Object.freeze({
  id: "v8:first-article",
  role: "SYSTEM",
});

const QUERY =
  process.argv
    .slice(2)
    .join(" ")
    .trim() ||
  PRIMARY_KEYWORD;

/*
 * V8-owned bootstrap authority corpus.
 *
 * This corpus is an entry-point authority registry only.
 * It is NOT article content.
 * It is NOT Evidence.
 * It is NOT a fixture.
 *
 * The actual article must be produced only from pages successfully
 * fetched from the Internet during this execution.
 */
const BOOTSTRAP_CORPUS = Object.freeze([
  Object.freeze({
    id: "iso:294-1",
    url:
      "https://www.iso.org/standard/67036.html",
    title:
      "ISO 294-1 Plastics Injection Moulding of Test Specimens",
    terms: Object.freeze([
      "plastics",
      "plastic",
      "injection",
      "moulding",
      "molding",
      "thermoplastic",
      "test specimens",
      "standards",
      "wall thickness",
    ]),
    authority:
      "AUTHORITATIVE_STANDARD",
  }),

  Object.freeze({
    id: "iso:294-3",
    url:
      "https://www.iso.org/standard/76649.html",
    title:
      "ISO 294-3 Plastics Injection Moulding of Test Specimens",
    terms: Object.freeze([
      "plastics",
      "plastic",
      "injection",
      "moulding",
      "molding",
      "small plates",
      "test specimens",
      "standards",
      "wall thickness",
    ]),
    authority:
      "AUTHORITATIVE_STANDARD",
  }),

  Object.freeze({
    id: "iso:294-4",
    url:
      "https://www.iso.org/standard/70413.html",
    title:
      "ISO 294-4 Plastics Injection Moulding Shrinkage",
    terms: Object.freeze([
      "plastics",
      "plastic",
      "injection",
      "moulding",
      "molding",
      "shrinkage",
      "test specimens",
      "standards",
      "wall thickness",
    ]),
    authority:
      "AUTHORITATIVE_STANDARD",
  }),

  Object.freeze({
    id: "iso:294-5",
    url:
      "https://www.iso.org/standard/85835.html",
    title:
      "ISO 294-5 Plastics Injection Moulding Anisotropy",
    terms: Object.freeze([
      "plastics",
      "plastic",
      "injection",
      "moulding",
      "molding",
      "anisotropy",
      "flow direction",
      "test specimens",
      "standards",
      "wall thickness",
    ]),
    authority:
      "AUTHORITATIVE_STANDARD",
  }),

  Object.freeze({
    id: "iso:20430",
    url:
      "https://committee.iso.org/standard/68000.html",
    title:
      "ISO 20430 Injection Moulding Machine Safety Requirements",
    terms: Object.freeze([
      "plastics",
      "plastic",
      "injection",
      "moulding",
      "molding",
      "machine",
      "safety",
      "standards",
      "wall thickness",
    ]),
    authority:
      "AUTHORITATIVE_STANDARD",
  }),
]);

function fail(
  message,
) {
  throw new Error(
    `V8_FIRST_ARTICLE_FAILED:${message}`,
  );
}

function requireCondition(
  condition,
  message,
) {
  if (!condition) {
    fail(message);
  }
}

function writeUtf8(
  filePath,
  content,
) {
  fs.mkdirSync(
    path.dirname(filePath),
    {
      recursive: true,
    },
  );

  fs.writeFileSync(
    filePath,
    content,
    "utf8",
  );
}

/*
 * Current V8 Content contract:
 *
 * interface Content {
 *   id: ContentId;
 *   decisionId: DecisionId;
 *   title: string;
 *   body: string;
 * }
 *
 * The previous implementation expected Content.sections[],
 * which does not exist in the current V8 domain contract.
 *
 * Article Markdown is therefore materialized directly from
 * Content.title + Content.body.
 */
function createArticleMarkdown(
  content,
) {
  requireCondition(
    content !== null &&
      typeof content === "object",
    "runtime content is missing",
  );

  requireCondition(
    typeof content.title ===
      "string" &&
      content.title.trim().length > 0,
    "runtime content contains no title",
  );

  requireCondition(
    typeof content.body ===
      "string" &&
      content.body.trim().length > 0,
    "runtime content contains no article body",
  );

  return [
    `# ${content.title.trim()}`,
    "",
    ARTICLE_DESCRIPTION,
    "",
    content.body.trim(),
    "",
  ].join("\n");
}

function createManifest({
  query,
  firstHop,
  runtime,
  articleContent,
}) {
  const acquisition =
    runtime.acquisition;

  const sources =
    acquisition.acquisitions.map(
      (record) => ({
        candidateUrl:
          record.candidateUrl,

        requestedUrl:
          record.page.requestedUrl,

        finalUrl:
          record.page.finalUrl,

        sourceId:
          record.acquisition.sourceId,

        snapshotId:
          record.acquisition.snapshotId,

        evidenceIds:
          record.acquisition.evidence.map(
            (evidence) =>
              evidence.id ??
              null,
          ),
      }),
    );

  const base = {
    schema:
      "nexmold.v8.first-article-manifest.v2",

    generatedAt:
      new Date().toISOString(),

    generator:
      "NEXMOLD V8",

    execution:
      {
        mode:
          "LIVE_INTERNET",

        searchProvider:
          "NONE",

        discoveryProvider:
          "V8_SELF_OWNED_FIRST_HOP",

        acquisitionProvider:
          "SELF_OWNED_CRAWL",

        query,
      },

    article:
      {
        title:
          ARTICLE_TITLE,

        slug:
          ARTICLE_SLUG,

        primaryKeyword:
          PRIMARY_KEYWORD,

        description:
          ARTICLE_DESCRIPTION,

        artifact:
          "article.md",
      },

    discovery:
      {
        bootstrapMatches:
          firstHop.bootstrap.matched.length,

        bootstrapRejected:
          firstHop.bootstrap.rejected.length,

        pagesObserved:
          firstHop.pagesObserved,

        candidatesAccepted:
          firstHop.observation.accepted,

        candidatesRejected:
          firstHop.observation.rejected,

        fetchErrors:
          firstHop.fetchErrors.map(
            (failure) => ({
              url:
                failure.url,

              error:
                failure.error,
            }),
          ),

        candidates:
          firstHop.observation.candidates.map(
            (candidate) => ({
              url:
                candidate.url,

              normalizedUrl:
                candidate.normalizedUrl,

              kind:
                candidate.kind,

              sourceUrl:
                candidate.sourceUrl,

              title:
                candidate.title,

              discoveredAt:
                candidate.discoveredAt,
            }),
          ),
      },

    acquisition:
      {
        planQueries:
          acquisition.plan.sourceQueries,

        candidates:
          acquisition.discovery.candidates.length,

        successfulAcquisitions:
          acquisition.acquisitions.length,

        searchErrors:
          acquisition.searchErrors,

        fetchErrors:
          acquisition.fetchErrors,

        sources,
      },

    foundation:
      {
        verifiedEvidenceIds:
          runtime.verifiedEvidenceIds,

        claimIds:
          runtime.claimIds,

        knowledgeIds:
          runtime.knowledgeIds,

        scopeId:
          runtime.scopeId,

        contextId:
          runtime.contextId,

        problemId:
          runtime.problemId,

        decisionId:
          runtime.decisionId,
      },

    runtime:
      {
        fingerprint:
          runtime.fingerprint,

        content:
          {
            id:
              runtime.content.id,

            decisionId:
              runtime.content.decisionId,

            title:
              runtime.content.title,

            bodyLength:
              runtime.content.body.length,
          },
      },

    artifact:
      {
        path:
          path.relative(
            process.cwd(),
            ARTICLE_PATH,
          ),

        contentFingerprint:
          contentFingerprint(
            articleContent,
          ),
      },
  };

  return {
    ...base,

    manifestFingerprint:
      contentFingerprint(
        base,
      ),
  };
}

async function main() {
  console.log(
    "==============================================",
  );

  console.log(
    "NEXMOLD V8 FIRST ARTICLE — LIVE INTERNET",
  );

  console.log(
    "==============================================",
  );

  console.log(
    `Query: ${QUERY}`,
  );

  console.log(
    `Article: ${ARTICLE_TITLE}`,
  );

  console.log(
    "Search provider: NONE",
  );

  console.log(
    "Discovery owner: V8",
  );

  console.log(
    "Acquisition owner: V8",
  );

  console.log("");

  /*
   * ------------------------------------------------------------
   * 1. LIVE FIRST-HOP INTERNET DISCOVERY
   * ------------------------------------------------------------
   */

  const fetcher =
    new HttpPageFetcher({
      timeoutMs:
        15000,

      maxBytes:
        5 * 1024 * 1024,
    });

  const firstHop =
    await observeInternetFirstHop(
      QUERY,
      BOOTSTRAP_CORPUS,
      fetcher,
      {
        limit:
          20,
      },
    );

  console.log(
    `1. Bootstrap matches: ${firstHop.bootstrap.matched.length}`,
  );

  console.log(
    `2. Pages observed: ${firstHop.pagesObserved}`,
  );

  console.log(
    `3. Candidates accepted: ${firstHop.observation.accepted}`,
  );

  console.log(
    `4. Candidates rejected: ${firstHop.observation.rejected}`,
  );

  console.log(
    `5. First-hop fetch errors: ${firstHop.fetchErrors.length}`,
  );

  requireCondition(
    firstHop.pagesObserved > 0,
    "no Internet page was successfully observed",
  );

  requireCondition(
    firstHop.observation.candidates.length > 0,
    "Internet observation produced no discovery candidates",
  );

  /*
   * ------------------------------------------------------------
   * 2. REAL INTERNET CANDIDATES → RESEARCH SEEDS
   * ------------------------------------------------------------
   *
   * The candidates are not converted into Evidence here.
   *
   * They become explicit research seeds for the existing
   * self-owned acquisition pipeline.
   *
   * Every URL therefore still has:
   *
   *   Internet observation
   *       ↓
   *   DiscoveryCandidate
   *       ↓
   *   ResearchSeed
   *       ↓
   *   HTTP Fetch
   *       ↓
   *   Snapshot
   *       ↓
   *   Evidence
   */

  const researchSeeds =
    firstHop.observation.candidates
      .slice(
        0,
        8,
      )
      .map(
        (candidate) => ({
          url:
            candidate.url,

          source:
            candidate.kind ===
              "SEED"
              ? "AUTHORITY"
              : "DIRECT",

          reason:
            candidate.kind ===
              "SEED"
              ? "V8-owned authority bootstrap source."
              : `Discovered by V8 first-hop observation from ${candidate.sourceUrl ?? "Internet source"}.`,
        }),
      );

  requireCondition(
    researchSeeds.length > 0,
    "no ResearchSeed could be created from live Internet discovery",
  );

  console.log(
    `6. Research seeds: ${researchSeeds.length}`,
  );

  for (
    const seed of
      researchSeeds
  ) {
    console.log(
      `    ${seed.source} ${seed.url}`,
    );
  }

  /*
   * ------------------------------------------------------------
   * 3. ARTICLE RUNTIME
   * ------------------------------------------------------------
   *
   * No SearchProvider is supplied.
   *
   * Therefore the runtime must use:
   *
   *   researchSeeds
   *       →
   *   SELF_OWNED_CRAWL
   *       →
   *   Foundation acquisition
   *       →
   *   Truth
   *       →
   *   Decision
   *       →
   *   Content
   */

  const runtime =
    await runV8ArticleRuntime({
      opportunity:
        {
          keyword:
            {
              keyword:
                PRIMARY_KEYWORD,

              normalized:
                PRIMARY_KEYWORD,

              source:
                "DISCOVERY",

              intent:
                "INFORMATIONAL",

              language:
                "en",

              market:
                "GLOBAL",

              terms:
                [
                  "plastic",
                  "injection",
                  "molding",
                  "wall",
                  "thickness",
                ],
            },

          score:
            1,

          demand:
            1,

          relevance:
            1,

          competition:
            0,

          authorityGap:
            1,

          conversionPotential:
            0.5,

          reasons:
            [
              "First V8 live Internet article research run.",
              "Engineering information request.",
            ],
        },

      searchProvider:
        undefined,

      pageFetcher:
        fetcher,

      actor:
        ACTOR,

      acquisition:
        {
          actorId:
            ACTOR.id,

          researchSeeds,

          maxCandidates:
            8,

          maxPages:
            8,

          maxDepth:
            1,

          sameHostOnly:
            false,
        },

      scope:
        {
          geography:
            "GLOBAL",

          industries:
            [
              "PLASTIC_INJECTION_MOLDING",
            ],

          languages:
            [
              "en",
            ],
        },

      context:
        {
          purpose:
            "Generate the first NEXMOLD V8 article from evidence acquired from the live Internet.",

          variables:
            {
              acquisitionMode:
                "LIVE_INTERNET",

              discoveryMode:
                "V8_SELF_OWNED",

              searchProvider:
                "NONE",
            },
        },

      problem:
        {
          question:
            "What evidence-backed engineering information can V8 state about plastic injection molding wall thickness?",

          constraints:
            [
              "VERIFIED evidence only",
              "No unsupported factual injection",
              "All article content must remain traceable to acquired Internet Evidence",
              "Unresolved contradictions must not be silently merged",
            ],
        },

      title:
        ARTICLE_TITLE,
    });

  /*
   * ------------------------------------------------------------
   * 4. HARD RUNTIME CLOSURE
   * ------------------------------------------------------------
   */

  requireCondition(
    runtime.acquisition.acquisitions.length >
      0,
    "Article Runtime produced no successful Internet acquisitions",
  );

  requireCondition(
    runtime.verifiedEvidenceIds.length >
      0,
    "Article Runtime produced no verified Evidence",
  );

  requireCondition(
    runtime.claimIds.length >
      0,
    "Article Runtime produced no Claims",
  );

  requireCondition(
    runtime.knowledgeIds.length >
      0,
    "Article Runtime produced no Knowledge",
  );

  requireCondition(
    runtime.decisionId.length >
      0,
    "Article Runtime produced no Decision",
  );

  requireCondition(
    runtime.content !== null &&
      typeof runtime.content ===
        "object",
    "Article Runtime produced no Content",
  );

  requireCondition(
    typeof runtime.content.title ===
      "string" &&
      runtime.content.title.trim().length > 0,
    "Article Runtime produced Content without a title",
  );

  requireCondition(
    typeof runtime.content.body ===
      "string" &&
      runtime.content.body.trim().length > 0,
    "Article Runtime produced Content without an article body",
  );

  console.log(
    `7. Successful acquisitions: ${runtime.acquisition.acquisitions.length}`,
  );

  console.log(
    `8. Verified Evidence: ${runtime.verifiedEvidenceIds.length}`,
  );

  console.log(
    `9. Claims: ${runtime.claimIds.length}`,
  );

  console.log(
    `10. Knowledge: ${runtime.knowledgeIds.length}`,
  );

  console.log(
    `11. Decision: ${runtime.decisionId}`,
  );

  console.log(
    `12. Article body length: ${runtime.content.body.length}`,
  );

  /*
   * ------------------------------------------------------------
   * 5. ARTICLE ARTIFACT
   * ------------------------------------------------------------
   */

  const articleContent =
    createArticleMarkdown(
      runtime.content,
    );

  const manifest =
    createManifest({
      query:
        QUERY,

      firstHop,

      runtime,

      articleContent,
    });

  writeUtf8(
    ARTICLE_PATH,
    articleContent,
  );

  writeUtf8(
    MANIFEST_PATH,
    `${JSON.stringify(
      manifest,
      null,
      2,
    )}\n`,
  );

  requireCondition(
    fs.existsSync(
      ARTICLE_PATH,
    ),
    "article.md was not written",
  );

  requireCondition(
    fs.existsSync(
      MANIFEST_PATH,
    ),
    "manifest.json was not written",
  );

  const persistedArticle =
    fs.readFileSync(
      ARTICLE_PATH,
      "utf8",
    );

  const persistedManifest =
    JSON.parse(
      fs.readFileSync(
        MANIFEST_PATH,
        "utf8",
      ),
    );

  requireCondition(
    persistedArticle ===
      articleContent,
    "persisted article differs from runtime artifact",
  );

  requireCondition(
    persistedManifest.artifact
      .contentFingerprint ===
      contentFingerprint(
        persistedArticle,
      ),
    "article content fingerprint mismatch",
  );

  requireCondition(
    persistedManifest.execution.mode ===
      "LIVE_INTERNET",
    "manifest does not identify a live Internet execution",
  );

  requireCondition(
    persistedManifest.execution.searchProvider ===
      "NONE",
    "article execution unexpectedly used a SearchProvider",
  );

  requireCondition(
    persistedManifest.acquisition
      .successfulAcquisitions > 0,
    "manifest records zero successful acquisitions",
  );

  console.log(
    "13. Article artifact: PASS",
  );

  console.log(
    `    ${ARTICLE_PATH}`,
  );

  console.log(
    `    ${MANIFEST_PATH}`,
  );

  console.log("");

  console.log(
    "==============================================",
  );

  console.log(
    "V8 FIRST ARTICLE LIVE INTERNET RUN: PASS",
  );

  console.log(
    "==============================================",
  );
}

main().catch(
  (error) => {
    console.error("");
    console.error(
      "==============================================",
    );
    console.error(
      "V8 FIRST ARTICLE LIVE INTERNET RUN: FAIL",
    );
    console.error(
      "==============================================",
    );
    console.error(
      error instanceof Error
        ? error.stack ??
            error.message
        : String(error),
    );
    process.exitCode = 1;
  },
);