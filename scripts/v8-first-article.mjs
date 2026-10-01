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
 * ============================================================
 * V8-OWNED BOOTSTRAP AUTHORITY CORPUS
 * ============================================================
 *
 * These URLs are discovery entry points only.
 *
 * They are NOT:
 *
 *   - article content
 *   - Evidence
 *   - Claims
 *   - Knowledge
 *   - hard-coded article facts
 *
 * Every usable fact must still travel through:
 *
 *   Internet
 *      ↓
 *   Fetch
 *      ↓
 *   Snapshot
 *      ↓
 *   Evidence
 *      ↓
 *   Claim
 *      ↓
 *   Knowledge
 *      ↓
 *   Decision
 *      ↓
 *   Content
 *
 * The bootstrap corpus exists only to give V8 an initial set of
 * public Internet entry points from which autonomous discovery
 * can begin.
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
      "standard",
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
      "standard",
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
      "standard",
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
      "standard",
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
      "standard",
    ]),

    authority:
      "AUTHORITATIVE_STANDARD",
  }),

  Object.freeze({
    id: "protolabs:wall-thickness",

    url:
      "https://www.protolabs.com/resources/design-tips/improving-part-design-with-uniform-wall-thickness/",

    title:
      "Injection Molding Wall Thickness Guidelines",

    terms: Object.freeze([
      "plastic",
      "plastics",
      "injection",
      "molding",
      "moulding",
      "wall",
      "thickness",
      "uniform",
      "sink",
      "warp",
      "material",
      "design",
    ]),

    authority:
      "ENGINEERING_GUIDANCE",
  }),

  Object.freeze({
    id: "protolabs:design-guidelines",

    url:
      "https://www.protolabs.com/services/injection-molding/plastic-injection-molding/design-guidelines/",

    title:
      "Plastic Injection Molding Design Guidelines",

    terms: Object.freeze([
      "plastic",
      "plastics",
      "injection",
      "molding",
      "moulding",
      "wall",
      "thickness",
      "material",
      "design",
      "draft",
      "ribs",
      "moldability",
    ]),

    authority:
      "ENGINEERING_GUIDANCE",
  }),

  Object.freeze({
    id: "protolabs:injection-molding-basics",

    url:
      "https://www.protolabs.com/resources/design-tips/injection-molding-basics/",

    title:
      "Injection Molding Basics: An Intro to Designing Plastic Parts",

    terms: Object.freeze([
      "plastic",
      "plastics",
      "injection",
      "molding",
      "moulding",
      "wall",
      "thickness",
      "sink",
      "warp",
      "ribs",
      "design",
      "material",
    ]),

    authority:
      "ENGINEERING_GUIDANCE",
  }),
]);


/*
 * ============================================================
 * FAILURE / ASSERTION HELPERS
 * ============================================================
 */

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
 * ============================================================
 * TOPIC RELEVANCE
 * ============================================================
 *
 * DiscoveryCandidate validity is deliberately not equivalent
 * to ResearchSeed relevance.
 *
 * The pipeline is:
 *
 *   Candidate
 *      ↓
 *   Topic relevance
 *      ↓
 *   Research Seed
 *      ↓
 *   Fetch
 *      ↓
 *   Evidence
 *
 * This prevents URLs such as:
 *
 *   /login/
 *   /account/
 *   /standards/
 *   /obp/ui/
 *   /es/
 *   /fr/
 *
 * from consuming the limited ResearchSeed budget merely because
 * they are valid public HTTPS URLs.
 */


/**
 * Normalize text for deterministic relevance evaluation.
 *
 * This function deliberately does not perform semantic inference.
 * It only creates a stable lexical representation.
 */
function normalizeResearchText(
  value,
) {
  return String(
    value ?? "",
  )
    .toLowerCase()
    .replace(
      /https?:\/\//g,
      " ",
    )
    .replace(
      /[^a-z0-9]+/g,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}


/**
 * Create deterministic topic tokens from the query.
 *
 * "molding" and "moulding" are treated as equivalent domain
 * spellings because both are legitimate English variants in
 * injection-molding engineering sources.
 */
function createResearchTopicTokens(
  query,
) {
  const normalized =
    normalizeResearchText(
      query,
    );

  const rawTokens =
    normalized
      .split(" ")
      .filter(
        (token) =>
          token.length >= 3,
      );

  const aliases =
    new Set(
      rawTokens,
    );

  if (
    aliases.has(
      "molding",
    ) ||
    aliases.has(
      "moulding",
    )
  ) {
    aliases.add(
      "molding",
    );

    aliases.add(
      "moulding",
    );
  }

  return Object.freeze(
    [
      ...aliases,
    ],
  );
}


const RESEARCH_BLOCKED_PATH_TOKENS =
  Object.freeze([
    "login",
    "signin",
    "sign-in",
    "account",
    "register",
    "signup",
    "sign-up",
    "password",
    "session",
    "oauth",
    "authorize",
    "authorization",
    "checkout",
    "cart",
    "search",
  ]);


const RESEARCH_NAVIGATION_PATH_TOKENS =
  Object.freeze([
    "home",
    "standards",
    "standard",
    "obp",
    "ui",
    "contents",
    "sites",
    "committee",
  ]);


const RESEARCH_LANGUAGE_PATH_TOKENS =
  Object.freeze([
    "es",
    "fr",
    "de",
    "it",
    "pt",
    "ru",
    "ja",
    "zh",
    "ko",
    "nl",
    "pl",
    "sv",
    "da",
    "fi",
    "no",
    "tr",
    "cs",
  ]);


/**
 * Returns URL/path tokens without allowing query parameters to
 * dominate topic matching.
 */
function getCandidatePathText(
  candidate,
) {
  return normalizeResearchText(
    candidate?.url ??
      candidate?.normalizedUrl ??
      "",
  );
}


/**
 * Returns true when the candidate clearly represents a
 * navigation/authentication endpoint rather than an engineering
 * document.
 */
function isBlockedResearchCandidate(
  candidate,
) {
  const normalized =
    getCandidatePathText(
      candidate,
    );

  return RESEARCH_BLOCKED_PATH_TOKENS.some(
    (token) =>
      normalized.includes(
        ` ${token} `,
      ) ||
      normalized.endsWith(
        ` ${token}`,
      ) ||
      normalized.includes(
        `/${token}/`,
      ),
  );
}


/**
 * Score a candidate using only deterministic lexical signals.
 *
 * The score is intentionally transparent:
 *
 *   title token                +10
 *   URL token                   +3
 *   exact wall+thickness      +100
 *   title wall+thickness       +150
 *   seed candidate              +20
 *   title exists                 +2
 *
 * Negative signals exist to prevent navigation endpoints from
 * becoming Research Seeds.
 */
function scoreResearchCandidate(
  candidate,
  topicTokens,
) {
  const title =
    normalizeResearchText(
      candidate?.title ??
        "",
    );

  const url =
    getCandidatePathText(
      candidate,
    );

  const sourceUrl =
    normalizeResearchText(
      candidate?.sourceUrl ??
        "",
    );

  const combined =
    [
      title,
      url,
      sourceUrl,
    ]
      .filter(
        Boolean,
      )
      .join(" ");

  let score = 0;

  let matchedTitleTokens = 0;

  for (
    const token of
      topicTokens
  ) {
    if (
      title.includes(
        token,
      )
    ) {
      score += 10;
      matchedTitleTokens += 1;
    }

    if (
      url.includes(
        token,
      )
    ) {
      score += 3;
    }
  }

  if (
    title.length > 0
  ) {
    score += 2;
  }

  if (
    candidate?.kind ===
    "SEED"
  ) {
    score += 20;
  }

  const hasWall =
    combined.includes(
      "wall",
    );

  const hasThickness =
    combined.includes(
      "thickness",
    );

  const titleHasWall =
    title.includes(
      "wall",
    );

  const titleHasThickness =
    title.includes(
      "thickness",
    );

  if (
    hasWall &&
    hasThickness
  ) {
    score += 100;
  }

  if (
    titleHasWall &&
    titleHasThickness
  ) {
    score += 150;
  }

  if (
    matchedTitleTokens >=
    3
  ) {
    score += 25;
  }

  if (
    isBlockedResearchCandidate(
      candidate,
    )
  ) {
    score -= 1000;
  }

  for (
    const token of
      RESEARCH_NAVIGATION_PATH_TOKENS
  ) {
    if (
      url.includes(
        `/${token}/`,
      ) ||
      url.endsWith(
        `/${token}`,
      )
    ) {
      score -= 100;
    }
  }

  for (
    const token of
      RESEARCH_LANGUAGE_PATH_TOKENS
  ) {
    if (
      url.includes(
        `/${token}/`,
      )
    ) {
      score -= 30;
    }
  }

  return score;
}


/**
 * Select Research Seeds from live discovery candidates.
 *
 * This is deliberately separate from discovery itself.
 *
 * Discovery may observe many valid URLs.
 * Research selection chooses only those that are relevant enough
 * to justify Internet acquisition budget.
 */
function selectResearchSeeds(
  candidates,
  query,
  limit = 8,
) {
  const topicTokens =
    createResearchTopicTokens(
      query,
    );

  const ranked =
    candidates
      .map(
        (
          candidate,
          index,
        ) => ({
          candidate,
          index,
          score:
            scoreResearchCandidate(
              candidate,
              topicTokens,
            ),
        }),
      )
      .filter(
        ({
          score,
        }) =>
          score > 0,
      )
      .sort(
        (
          left,
          right,
        ) => {
          if (
            right.score !==
            left.score
          ) {
            return (
              right.score -
              left.score
            );
          }

          if (
            left.index !==
            right.index
          ) {
            return (
              left.index -
              right.index
            );
          }

          return (
            left.candidate.normalizedUrl.localeCompare(
              right.candidate.normalizedUrl,
            )
          );
        },
      );

  return ranked
    .slice(
      0,
      limit,
    )
    .map(
      ({
        candidate,
      }) => ({
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
            ? "V8-owned authority bootstrap source selected by deterministic topic relevance."
            : `Discovered by V8 first-hop observation from ${candidate.sourceUrl ?? "Internet source"} and selected by deterministic topic relevance.`,

        relevanceScore:
          scoreResearchCandidate(
            candidate,
            topicTokens,
          ),

        candidateKind:
          candidate.kind,

        title:
          candidate.title,
      }),
    );
}


/**
 * Require at least one candidate with strong direct topic
 * relevance. This prevents an irrelevant authority corpus from
 * being accepted merely because it is technically fetchable.
 */
function requireTopicRelevantResearchSeed(
  researchSeeds,
) {
  const strongSeed =
    researchSeeds.find(
      (seed) =>
        seed.relevanceScore >=
        100,
    );

  requireCondition(
    strongSeed !==
      undefined,
    "V8 research discovery produced no strongly topic-relevant ResearchSeed",
  );
}


/*
 * ============================================================
 * ARTICLE MARKDOWN MATERIALIZATION
 * ============================================================
 *
 * Current V8 Content contract:
 *
 * interface Content {
 *   id: ContentId;
 *   decisionId: DecisionId;
 *   title: string;
 *   body: string;
 * }
 *
 * The current contract does not expose Content.sections[].
 *
 * Therefore the persisted Markdown artifact is constructed from
 * Content.title + Content.body.
 */

function createArticleMarkdown(
  content,
) {
  requireCondition(
    content !== null &&
      typeof content ===
        "object",
    "runtime content is missing",
  );

  requireCondition(
    typeof content.title ===
      "string" &&
      content.title.trim().length >
        0,
    "runtime content contains no title",
  );

  requireCondition(
    typeof content.body ===
      "string" &&
      content.body.trim().length >
        0,
    "runtime content contains no article body",
  );

  return [
    `# ${content.title.trim()}`,
    "",
    ARTICLE_DESCRIPTION,
    "",
    content.body.trim(),
    "",
  ].join(
    "\n",
  );
}


/*
 * ============================================================
 * MANIFEST
 * ============================================================
 */

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
      (
        record,
        index,
      ) => ({
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

        /*
         * EvidencePayload itself does not own the canonical
         * Foundation Evidence ID.
         *
         * Runtime derives and verifies those IDs and exposes
         * them through verifiedEvidenceIds.
         *
         * Therefore the manifest must not read:
         *
         *   evidence.id
         *
         * from an EvidencePayload.
         */
        evidenceIds:
          [
            runtime.verifiedEvidenceIds[
              index
            ] ??
              null,
          ],
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
            (
              failure,
            ) => ({
              url:
                failure.url,

              error:
                failure.error,
            }),
          ),

        candidates:
          firstHop.observation.candidates.map(
            (
              candidate,
            ) => ({
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


/*
 * ============================================================
 * MAIN
 * ============================================================
 */

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

  console.log(
    "",
  );


  /*
   * ----------------------------------------------------------
   * 1. LIVE FIRST-HOP INTERNET DISCOVERY
   * ----------------------------------------------------------
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
    firstHop.pagesObserved >
      0,
    "no Internet page was successfully observed",
  );

  requireCondition(
    firstHop.observation.candidates.length >
      0,
    "Internet observation produced no discovery candidates",
  );


  /*
   * ----------------------------------------------------------
   * 2. CANDIDATE → TOPIC RELEVANCE → RESEARCH SEED
   * ----------------------------------------------------------
   *
   * This is the critical repair.
   *
   * We do NOT do:
   *
   *   candidates.slice(0, 8)
   *
   * anymore.
   *
   * Instead:
   *
   *   candidates
   *      ↓
   *   deterministic relevance ranking
   *      ↓
   *   navigation rejection
   *      ↓
   *   topic relevance gate
   *      ↓
   *   ResearchSeed
   */

  const researchSeeds =
    selectResearchSeeds(
      firstHop.observation.candidates,
      QUERY,
      8,
    );

  requireCondition(
    researchSeeds.length >=
      2,
    "V8 research discovery produced fewer than two topic-relevant research seeds",
  );

  requireTopicRelevantResearchSeed(
    researchSeeds,
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

    console.log(
      `      relevance=${seed.relevanceScore}`,
    );

    if (
      seed.title
    ) {
      console.log(
        `      title=${seed.title}`,
      );
    }
  }


  /*
   * ----------------------------------------------------------
   * 3. ARTICLE RUNTIME
   * ----------------------------------------------------------
   *
   * No external SearchProvider.
   *
   * The only research inputs are the ResearchSeeds produced by
   * V8-owned Internet Discovery.
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
   * ----------------------------------------------------------
   * 4. HARD RUNTIME CLOSURE
   * ----------------------------------------------------------
   *
   * Runtime relevance remains fail-closed.
   *
   * We do NOT bypass:
   *
   *   V8_ARTICLE_RUNTIME_NO_TOPIC_RELEVANT_EVIDENCE
   *
   * If Discovery still selects irrelevant documents, Runtime must
   * fail rather than generate unsupported article content.
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
      runtime.content.title.trim().length >
        0,
    "Article Runtime produced Content without a title",
  );

  requireCondition(
    typeof runtime.content.body ===
      "string" &&
      runtime.content.body.trim().length >
        0,
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
   * ----------------------------------------------------------
   * 5. ARTICLE ARTIFACT
   * ----------------------------------------------------------
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
      .successfulAcquisitions >
      0,
    "manifest records zero successful acquisitions",
  );


  requireCondition(
    persistedManifest.foundation
      .verifiedEvidenceIds.length >
      0,
    "manifest records no verified Evidence IDs",
  );


  requireCondition(
    persistedManifest.foundation
      .verifiedEvidenceIds.length ===
      runtime.verifiedEvidenceIds.length,
    "manifest Evidence closure differs from Runtime Evidence closure",
  );


  requireCondition(
    persistedManifest.foundation
      .verifiedEvidenceIds.every(
        (
          evidenceId,
          index,
        ) =>
          evidenceId ===
          runtime.verifiedEvidenceIds[
            index
          ],
      ),
    "manifest Evidence IDs are not identical to Runtime verifiedEvidenceIds",
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

  console.log(
    "",
  );


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
  (
    error,
  ) => {
    console.error(
      "",
    );

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

    process.exitCode =
      1;
  },
);