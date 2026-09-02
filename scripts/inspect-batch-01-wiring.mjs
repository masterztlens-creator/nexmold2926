import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const manifestPath = path.join(
  ROOT,
  ".nexmold",
  "content-factory",
  "batch-01-keyword-manifest.json"
);

const manifest = JSON.parse(
  fs.readFileSync(manifestPath, "utf8")
);

const files = {
  types: path.join(ROOT, "src", "regional", "types.ts"),
  producer: path.join(ROOT, "src", "regional", "article-producer.ts"),
  contract: path.join(ROOT, "src", "regional", "article-contract.ts"),
  compiler: path.join(ROOT, "src", "regional", "regionalCompiler.ts"),
  renderer: path.join(ROOT, "src", "regional", "article-renderer.ts"),
};

console.log("=======================================================");
console.log("[NEXMOLD][V7.14] LONG-TAIL FACTORY — BATCH 01");
console.log("               INPUT / OUTPUT WIRING CHECK");
console.log("=======================================================");

for (const [name, file] of Object.entries(files)) {
  if (!fs.existsSync(file)) {
    console.error(`[FAIL] Missing ${name}: ${file}`);
    process.exit(1);
  }

  console.log(`[OK] ${name}: ${path.relative(ROOT, file)}`);
}

console.log("");
console.log("[MANIFEST]");
console.log(`  Schema           : ${manifest.schema}`);
console.log(`  Batch            : ${manifest.batch}`);
console.log(`  Total candidates : ${manifest.summary.totalCandidates}`);
console.log(`  Clean candidates : ${manifest.summary.cleanCandidates}`);
console.log(`  Semantic review  : ${manifest.summary.semanticReview}`);
console.log(`  Slug collisions  : ${manifest.summary.slugCollisions}`);

console.log("");
console.log("[PRODUCTION POLICY]");
console.log(`  Modify existing  : ${manifest.policy.modifyExistingContent}`);
console.log(`  Auto publish     : ${manifest.policy.publishAutomatically}`);
console.log(`  Evidence required: ${manifest.policy.evidenceRequired}`);
console.log(`  Semantic review  : ${manifest.policy.semanticCollisionReviewRequired}`);
console.log(`  V7.14 gate       : ${manifest.policy.v714PublicationGateRequired}`);

console.log("");
console.log("[ELIGIBLE BATCH INPUTS]");
console.log("-------------------------------------------------------");

const clean = manifest.candidates
  .filter(item => item.status === "CANDIDATE")
  .sort((a, b) => b.priority - a.priority);

for (const item of clean) {
  console.log(
    `${item.id.padEnd(6)} ` +
    `${item.keyword.padEnd(58)} ` +
    `[${item.cluster}]`
  );
}

console.log("");
console.log("[PRODUCTION CHAIN TOKENS]");
console.log("-------------------------------------------------------");

const tokenChecks = [
  ["types", "RegionalCompileInput"],
  ["types", "RegionalPublishArtifact"],
  ["producer", "V714ArticleSource"],
  ["producer", "produceV714Article"],
  ["contract", "V714ArticleContract"],
  ["contract", "evidenceIds"],
  ["contract", "semanticClaimIds"],
  ["compiler", "evaluateRegionalEligibility"],
  ["compiler", "runEpistemicFirewall"],
  ["compiler", "createRegionalPublishArtifact"],
  ["compiler", "runPublicationGate"],
  ["compiler", "projectRegionalRoute"],
  ["renderer", "renderV714ArticleMarkdown"],
];

let failures = 0;

for (const [fileKey, token] of tokenChecks) {
  const text = fs.readFileSync(files[fileKey], "utf8");

  if (text.includes(token)) {
    console.log(`[OK] ${fileKey.padEnd(10)} -> ${token}`);
  } else {
    console.log(`[FAIL] ${fileKey.padEnd(10)} -> ${token}`);
    failures++;
  }
}

console.log("");
console.log("=======================================================");

if (failures > 0) {
  console.log(`[BLOCKED] ${failures} production-chain checks failed.`);
  console.log("NO ARTICLE GENERATED.");
  console.log("NO SITE CONTENT MODIFIED.");
  process.exit(1);
}

console.log("[READY] BATCH-01 INPUT WIRING IS PRESENT.");
console.log("NO ARTICLE GENERATED.");
console.log("NO SITE CONTENT MODIFIED.");
console.log("NEXT: BUILD THE EVIDENCE/CLAIM INPUT FOR BL01.");
console.log("=======================================================");
