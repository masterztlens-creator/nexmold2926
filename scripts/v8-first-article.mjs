import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  FoundationService,
  InMemoryFoundationStore,
  createSource,
  createScope,
  createContext,
  createProblem,
  createDecision,
  contentFingerprint,
} from "../.v8-build/src/v8/index.js";

import {
  TruthProducer,
} from "../.v8-build/src/v8/intelligence/truth-producer/index.js";

import {
  ArticleIntelligencePlanner,
} from "../.v8-build/src/v8/intelligence/article-intelligence/index.js";

import {
  EvidenceBoundContentCompiler,
} from "../.v8-build/src/v8/intelligence/content-compiler/index.js";

const BUILD_TIMESTAMP =
  "2026-10-01T00:00:00.000Z";

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
  id: "v8-first-article",
  role: "SYSTEM",
});

const AUDITOR = Object.freeze({
  id: "v8-first-article-auditor",
  role: "AUDITOR",
});

const SOURCE_CONTENT =
  "Wall thickness should be selected with material, flow, cooling, and structural requirements in mind.";

const SOURCE_URL =
  "https://example.test/v8-first-article/wall-thickness";

const SOURCE_ID =
  "source:v8:first-article:wall-thickness";

const EVIDENCE_ID =
  "evidence:v8:first-article:wall-thickness";

const SCOPE_ID =
  "scope:v8:first-article:wall-thickness";

const CONTEXT_ID =
  "context:v8:first-article:wall-thickness";

const PROBLEM_ID =
  "problem:v8:first-article:wall-thickness";

const DECISION_ID =
  "decision:v8:first-article:wall-thickness";

const SECTION_ID =
  "definition-and-scope";

function fail(message) {
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

function createArticleMarkdown(
  draft,
) {
  const sections = draft.sections
    .map(
      (section) =>
        [
          `## ${section.heading}`,
          "",
          section.body.trim(),
          "",
        ].join("\n"),
    )
    .join("\n");

  return [
    `# ${draft.title}`,
    "",
    draft.description.trim(),
    "",
    sections.trim(),
    "",
  ].join("\n");
}

function createManifest({
  source,
  snapshot,
  evidence,
  truth,
  scope,
  context,
  problem,
  decision,
  plan,
  draft,
  articleContent,
}) {
  const base = {
    schema:
      "nexmold.v8.first-article-manifest.v1",

    generatedAt:
      BUILD_TIMESTAMP,

    generator:
      "NEXMOLD V8",

    article: {
      title:
        draft.title,

      slug:
        draft.slug,

      primaryKeyword:
        PRIMARY_KEYWORD,

      description:
        draft.description,

      artifact:
        "article.md",
    },

    foundation: {
      sourceId:
        source.id,

      snapshotId:
        snapshot.aggregateId,

      evidenceIds:
        [evidence.aggregateId],

      claimIds:
        [...truth.claims].sort(),

      knowledgeIds:
        [...truth.knowledge].sort(),

      scopeId:
        scope.id,

      contextId:
        context.id,

      problemId:
        problem.id,

      decisionId:
        decision.id,
    },

    plan: {
      decisionId:
        plan.decisionId,

      scopeId:
        plan.scopeId,

      contextId:
        plan.contextId,

      sections:
        plan.sections.map(
          (section) => ({
            sectionId:
              section.sectionId,

            heading:
              section.heading,

            knowledgeIds:
              [...section.knowledgeIds],

            claimIds:
              [...section.claimIds],

            evidenceIds:
              [...section.evidenceIds],
          }),
        ),
    },

    compiler: {
      sectionCount:
        draft.sections.length,

      claimCount:
        draft.claims.length,

      evidenceCount:
        draft.evidence.length,
    },

    artifact: {
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

    rejectedCandidates:
      [...truth.rejectedCandidates],
  };

  return {
    ...base,
    manifestFingerprint:
      contentFingerprint(base),
  };
}

function assertArticleClosure({
  store,
  source,
  snapshot,
  evidence,
  truth,
  scope,
  context,
  problem,
  decision,
  plan,
  draft,
}) {
  requireCondition(
    source.id === SOURCE_ID,
    "source identity mismatch",
  );

  requireCondition(
    snapshot.payload.sourceId ===
      source.id,
    "snapshot source lineage mismatch",
  );

  requireCondition(
    snapshot.state ===
      "SEALED",
    "snapshot is not sealed",
  );

  requireCondition(
    evidence.payload.sourceId ===
      source.id,
    "evidence source lineage mismatch",
  );

  requireCondition(
    evidence.payload.snapshotId ===
      snapshot.aggregateId,
    "evidence snapshot lineage mismatch",
  );

  requireCondition(
    evidence.state ===
      "VERIFIED",
    "evidence is not verified",
  );

  requireCondition(
    evidence.payload.verificationStatus ===
      "VERIFIED",
    "evidence verificationStatus is not VERIFIED",
  );

  requireCondition(
    truth.claims.length === 1,
    `expected exactly one Claim, received ${truth.claims.length}`,
  );

  requireCondition(
    truth.knowledge.length === 1,
    `expected exactly one Knowledge, received ${truth.knowledge.length}`,
  );

  requireCondition(
    truth.rejectedCandidates.length === 0,
    `TruthProducer rejected ${truth.rejectedCandidates.length} candidate(s)`,
  );

  requireCondition(
    scope.id === SCOPE_ID,
    "scope identity mismatch",
  );

  requireCondition(
    context.scopeId ===
      scope.id,
    "context scope lineage mismatch",
  );

  requireCondition(
    problem.contextId ===
      context.id,
    "problem context lineage mismatch",
  );

  requireCondition(
    decision.payload.problemId ===
      problem.id,
    "decision problem lineage mismatch",
  );

  requireCondition(
    decision.payload.knowledgeIds.includes(
      truth.knowledge[0],
    ),
    "decision does not contain produced Knowledge",
  );

  requireCondition(
    plan.sections.length === 1,
    "article plan must contain exactly one section",
  );

  requireCondition(
    plan.sections[0].knowledgeIds.includes(
      truth.knowledge[0],
    ),
    "article plan does not contain produced Knowledge",
  );

  requireCondition(
    plan.sections[0].claimIds.includes(
      truth.claims[0],
    ),
    "article plan does not contain produced Claim",
  );

  requireCondition(
    plan.sections[0].evidenceIds.includes(
      evidence.aggregateId,
    ),
    "article plan does not contain produced Evidence",
  );

  requireCondition(
    draft.sections.length === 1,
    "compiled article must contain exactly one section",
  );

  requireCondition(
    draft.sections[0].knowledgeIds.includes(
      truth.knowledge[0],
    ),
    "compiled article lost Knowledge lineage",
  );

  requireCondition(
    draft.sections[0].claimIds.includes(
      truth.claims[0],
    ),
    "compiled article lost Claim lineage",
  );

  requireCondition(
    draft.sections[0].evidenceIds.includes(
      evidence.aggregateId,
    ),
    "compiled article lost Evidence lineage",
  );

  requireCondition(
    draft.sections[0].body.includes(
      SOURCE_CONTENT,
    ),
    "compiled article does not contain the source evidence excerpt",
  );

  store.verifyChain();
}

function main() {
  console.log(
    "==============================================",
  );

  console.log(
    "NEXMOLD V8 FIRST ARTICLE RUNNER",
  );

  console.log(
    "==============================================",
  );

  console.log(
    `Timestamp: ${BUILD_TIMESTAMP}`,
  );

  console.log(
    `Article: ${ARTICLE_TITLE}`,
  );

  console.log(
    `Slug: ${ARTICLE_SLUG}`,
  );

  console.log("");

  const store =
    new InMemoryFoundationStore();

  const service =
    new FoundationService(store);

  /*
   * ------------------------------------------------------------
   * 1. SOURCE
   * ------------------------------------------------------------
   */

  const source =
    createSource({
      id:
        SOURCE_ID,

      kind:
        "PUBLIC_WEB",

      locator:
        SOURCE_URL,

      access:
        "PAYLOAD_ALLOWED",

      title:
        "V8 First Article Controlled Evidence Source",

      version:
        "1",

      publisher:
        "NEXMOLD V8 First Article Harness",

      authority:
        "ENGINEERING_REFERENCE",

      canonicalUrl:
        SOURCE_URL,

      retrievedAt:
        BUILD_TIMESTAMP,

      documentHash:
        contentFingerprint(
          SOURCE_CONTENT,
        ),
    });

  service.registerSource(
    source,
    ACTOR,
    "V8 first article source registration",
  );

  console.log(
    "1/10 Source: PASS",
  );

  /*
   * ------------------------------------------------------------
   * 2. SNAPSHOT
   * ------------------------------------------------------------
   */

  const snapshot =
    service.captureSnapshot(
      {
        source,

        capturedAt:
          BUILD_TIMESTAMP,

        locator:
          source.locator,

        content:
          SOURCE_CONTENT,

        metadataOnly:
          false,

        requestedUrl:
          SOURCE_URL,

        finalUrl:
          SOURCE_URL,

        redirectChain:
          [SOURCE_URL],

        mediaType:
          "text/plain",
      },

      ACTOR,

      "V8 first article source snapshot",
    );

  service.sealSnapshot(
    snapshot.aggregateId,
    ACTOR,
    "V8 first article seal snapshot",
  );

  const sealedSnapshot =
    store.get(
      "SNAPSHOT",
      snapshot.aggregateId,
    );

  requireCondition(
    sealedSnapshot !== null,
    "sealed snapshot could not be read back",
  );

  requireCondition(
    sealedSnapshot.state ===
      "SEALED",
    "snapshot sealing failed",
  );

  console.log(
    "2/10 Snapshot: PASS",
  );

  /*
   * ------------------------------------------------------------
   * 3. EVIDENCE
   * ------------------------------------------------------------
   */

  const evidence =
    service.ingestEvidence(
      {
        id:
          EVIDENCE_ID,

        sourceId:
          source.id,

        locator:
          "v8-first-article:p1",

        excerpt:
          SOURCE_CONTENT,

        ingestion:
          "INGESTED",

        capturedAt:
          sealedSnapshot.recordedAt,

        snapshotId:
          sealedSnapshot.aggregateId,

        section:
          "Engineering considerations",
      },

      ACTOR,

      "V8 first article evidence ingestion",
    );

  service.verifyEvidence(
    evidence.aggregateId,
    AUDITOR,
    "V8 first article evidence verification",
  );

  const verifiedEvidence =
    store.get(
      "EVIDENCE",
      evidence.aggregateId,
    );

  requireCondition(
    verifiedEvidence !== null,
    "verified evidence could not be read back",
  );

  requireCondition(
    verifiedEvidence.state ===
      "VERIFIED",
    "evidence verification failed",
  );

  requireCondition(
    verifiedEvidence.payload
      .verificationStatus ===
      "VERIFIED",
    "evidence verification status failed",
  );

  console.log(
    "3/10 Evidence: PASS",
  );

  /*
   * ------------------------------------------------------------
   * 4. TRUTH PRODUCER
   * ------------------------------------------------------------
   *
   * The interpreter is deliberately deterministic.
   *
   * It does not invent unsupported facts.
   * It converts the verified evidence excerpt into one
   * evidence-bound ClaimCandidate.
   *
   * The formal TruthProducer then persists:
   *
   * Evidence -> Claim -> Knowledge
   */

  const interpreter =
    Object.freeze({
      interpret(input) {
        requireCondition(
          input.length === 1,
          `expected one Evidence input, received ${input.length}`,
        );

        const item =
          input[0];

        requireCondition(
          item.verificationStatus ===
            "VERIFIED",
          "TruthProducer received non-verified Evidence",
        );

        requireCondition(
          item.excerpt.trim() ===
            SOURCE_CONTENT,
          "TruthProducer received unexpected Evidence content",
        );

        return [
          {
            statement:
              "Wall thickness selection depends on material, flow, cooling, and structural requirements.",

            evidenceIds:
              [item.snapshotId
                ? EVIDENCE_ID
                : EVIDENCE_ID],

            epistemicLevel:
              "ENGINEERING_INFERENCE",

            confidence:
              "HIGH",
          },
        ];
      },
    });

  const truthProducer =
    new TruthProducer(
      service,
      interpreter,
    );

  const truth =
    truthProducer.produce({
      evidence:
        [verifiedEvidence.payload],

      actor:
        AUDITOR,
    });

  requireCondition(
    truth.claims.length === 1,
    "TruthProducer did not produce exactly one Claim",
  );

  requireCondition(
    truth.knowledge.length === 1,
    "TruthProducer did not produce exactly one Knowledge",
  );

  requireCondition(
    truth.rejectedCandidates.length === 0,
    "TruthProducer rejected a ClaimCandidate",
  );

  console.log(
    "4/10 TruthProducer: PASS",
  );

  console.log(
    `    Claim: ${truth.claims[0]}`,
  );

  console.log(
    `    Knowledge: ${truth.knowledge[0]}`,
  );

  /*
   * ------------------------------------------------------------
   * 5. SCOPE
   * ------------------------------------------------------------
   */

  const scope =
    createScope({
      id:
        SCOPE_ID,

      geography:
        "GLOBAL",

      industries:
        [
          "PLASTIC_INJECTION_MOLDING",
        ],

      languages:
        ["en"],
    });

  service.registerScope(
    scope,
    ACTOR,
    "V8 first article scope registration",
  );

  console.log(
    "5/10 Scope: PASS",
  );

  /*
   * ------------------------------------------------------------
   * 6. CONTEXT
   * ------------------------------------------------------------
   */

  const context =
    createContext({
      id:
        CONTEXT_ID,

      scopeId:
        scope.id,

      purpose:
        "Generate the first V8 evidence-bound article for plastic injection molding wall thickness.",

      variables:
        {},
    });

  service.registerContext(
    context,
    ACTOR,
    "V8 first article context registration",
  );

  console.log(
    "6/10 Context: PASS",
  );

  /*
   * ------------------------------------------------------------
   * 7. PROBLEM + DECISION
   * ------------------------------------------------------------
   */

  const problem =
    createProblem({
      id:
        PROBLEM_ID,

      contextId:
        context.id,

      question:
        "What evidence-backed information can V8 state about plastic injection molding wall thickness?",

      constraints:
        [
          "VERIFIED evidence only",
          "No unsupported factual injection",
          "Content must remain within the approved scope",
        ],
    });

  service.registerProblem(
    problem,
    ACTOR,
    "V8 first article problem registration",
  );

  const decision =
    createDecision({
      id:
        DECISION_ID,

      problemId:
        problem.id,

      knowledgeIds:
        [...truth.knowledge],

      outcome:
        "State only evidence-backed wall-thickness guidance within the approved scope.",

      status:
        "APPROVED",
    });

  service.createDecision(
    decision,
    scope.id,
    context.id,
    ACTOR,
    "V8 first article approved decision",
  );

  const persistedDecision =
    store.get(
      "DECISION",
      decision.id,
    );

  requireCondition(
    persistedDecision !== null,
    "approved Decision could not be read back",
  );

  requireCondition(
    persistedDecision.state ===
      "APPROVED",
    "Decision is not APPROVED",
  );

  console.log(
    "7/10 Decision: PASS",
  );

  /*
   * ------------------------------------------------------------
   * 8. ARTICLE INTELLIGENCE PLANNER
   * ------------------------------------------------------------
   */

  const planner =
    new ArticleIntelligencePlanner(
      store,
    );

  const plan =
    planner.plan({
      decisionId:
        decision.id,

      scopeId:
        scope.id,

      contextId:
        context.id,

      sections:
        [
          {
            sectionId:
              SECTION_ID,

            heading:
              "Definition and engineering scope",

            knowledgeIds:
              [...truth.knowledge],
          },
        ],
    });

  requireCondition(
    plan.sections.length === 1,
    "Article Planner produced an unexpected section count",
  );

  console.log(
    "8/10 Article Planner: PASS",
  );

  /*
   * ------------------------------------------------------------
   * 9. EVIDENCE-BOUND CONTENT COMPILER
   * ------------------------------------------------------------
   */

  const compiler =
    new EvidenceBoundContentCompiler(
      store,
    );

  const draft =
    compiler.compile({
      plan,

      title:
        ARTICLE_TITLE,

      primaryKeyword:
        PRIMARY_KEYWORD,

      description:
        ARTICLE_DESCRIPTION,
    });

  requireCondition(
    draft.title ===
      ARTICLE_TITLE,
    "compiled article title mismatch",
  );

  requireCondition(
    draft.slug ===
      ARTICLE_SLUG,
    "compiled article slug mismatch",
  );

  requireCondition(
    draft.sections.length === 1,
    "compiled article section count mismatch",
  );

  console.log(
    "9/10 Content Compiler: PASS",
  );

  /*
   * ------------------------------------------------------------
   * 10. FINAL CLOSURE + ARTIFACT
   * ------------------------------------------------------------
   */

  assertArticleClosure({
    store,
    source,
    snapshot:
      sealedSnapshot,
    evidence:
      verifiedEvidence,
    truth,
    scope,
    context,
    problem,
    decision:
      persistedDecision,
    plan,
    draft,
  });

  const articleContent =
    createArticleMarkdown(
      draft,
    );

  const manifest =
    createManifest({
      source,
      snapshot:
        sealedSnapshot,
      evidence:
        verifiedEvidence,
      truth,
      scope,
      context,
      problem,
      decision:
        persistedDecision,
      plan,
      draft,
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
    "persisted article content mismatch",
  );

  requireCondition(
    persistedManifest
      .artifact
      .contentFingerprint ===
      contentFingerprint(
        persistedArticle,
      ),
    "article artifact fingerprint mismatch",
  );

  requireCondition(
    persistedManifest
      .foundation
      .sourceId ===
      source.id,
    "manifest source lineage mismatch",
  );

  requireCondition(
    persistedManifest
      .foundation
      .decisionId ===
      decision.id,
    "manifest decision lineage mismatch",
  );

  requireCondition(
    persistedManifest
      .foundation
      .knowledgeIds
      .length === 1,
    "manifest Knowledge lineage mismatch",
  );

  requireCondition(
    persistedManifest
      .foundation
      .claimIds
      .length === 1,
    "manifest Claim lineage mismatch",
  );

  requireCondition(
    persistedManifest
      .foundation
      .evidenceIds
      .length === 1,
    "manifest Evidence lineage mismatch",
  );

  console.log(
    "10/10 First Article Artifact: PASS",
  );

  console.log("");
  console.log(
    "==============================================",
  );

  console.log(
    "NEXMOLD V8 FIRST ARTICLE: PASS",
  );

  console.log(
    "==============================================",
  );

  console.log("");

  console.log(
    `Article: ${ARTICLE_PATH}`,
  );

  console.log(
    `Manifest: ${MANIFEST_PATH}`,
  );

  console.log(
    `Source: ${source.id}`,
  );

  console.log(
    `Evidence: ${evidence.aggregateId}`,
  );

  console.log(
    `Claim: ${truth.claims[0]}`,
  );

  console.log(
    `Knowledge: ${truth.knowledge[0]}`,
  );

  console.log(
    `Decision: ${decision.id}`,
  );

  console.log(
    `Article fingerprint: ${manifest.artifact.contentFingerprint}`,
  );

  console.log(
    `Manifest fingerprint: ${manifest.manifestFingerprint}`,
  );

  console.log("");
}

try {
  main();
} catch (error) {
  console.error("");
  console.error(
    "==============================================",
  );
  console.error(
    "NEXMOLD V8 FIRST ARTICLE: FAIL",
  );
  console.error(
    "==============================================",
  );
  console.error("");
  console.error(
    error instanceof Error
      ? error.stack ?? error.message
      : String(error),
  );
  process.exitCode = 1;
}

