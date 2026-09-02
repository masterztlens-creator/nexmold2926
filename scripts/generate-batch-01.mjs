import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const OUT_DIR = path.join(ROOT, ".nexmold", "content-factory");
const OUT_FILE = path.join(OUT_DIR, "batch-01-keyword-manifest.json");

fs.mkdirSync(OUT_DIR, { recursive: true });

const candidates = [
  {
    id: "BL01",
    keyword: "injection molding wall thickness design",
    slug: "injection-molding-wall-thickness-design",
    cluster: "dfm",
    intent: "engineering",
    stage: "evaluate",
    priority: 100
  },
  {
    id: "BL02",
    keyword: "injection molding draft angle",
    slug: "injection-molding-draft-angle",
    cluster: "dfm",
    intent: "engineering",
    stage: "evaluate",
    priority: 99
  },
  {
    id: "BL03",
    keyword: "injection molding rib design",
    slug: "injection-molding-rib-design",
    cluster: "dfm",
    intent: "engineering",
    stage: "evaluate",
    priority: 98
  },
  {
    id: "BL04",
    keyword: "injection molding boss design",
    slug: "injection-molding-boss-design",
    cluster: "dfm",
    intent: "engineering",
    stage: "evaluate",
    priority: 97
  },
  {
    id: "BL05",
    keyword: "injection molding corner radius",
    slug: "injection-molding-corner-radius",
    cluster: "dfm",
    intent: "engineering",
    stage: "evaluate",
    priority: 96
  },
  {
    id: "BL06",
    keyword: "injection molding undercuts",
    slug: "injection-molding-undercuts-guide",
    cluster: "dfm",
    intent: "engineering",
    stage: "evaluate",
    priority: 95
  },
  {
    id: "BL07",
    keyword: "injection molding parting line design",
    slug: "injection-molding-parting-line-design",
    cluster: "dfm",
    intent: "engineering",
    stage: "evaluate",
    priority: 94
  },
  {
    id: "BL08",
    keyword: "injection molding gate location",
    slug: "injection-molding-gate-location",
    cluster: "dfm",
    intent: "engineering",
    stage: "evaluate",
    priority: 93
  },
  {
    id: "BL09",
    keyword: "injection mold venting design",
    slug: "injection-mold-venting-design",
    cluster: "dfm",
    intent: "engineering",
    stage: "evaluate",
    priority: 92
  },
  {
    id: "BL10",
    keyword: "injection molding sink marks causes solutions",
    slug: "injection-molding-sink-marks-causes-solutions",
    cluster: "defects",
    intent: "diagnostic",
    stage: "validate",
    priority: 91
  },
  {
    id: "BL11",
    keyword: "injection molding warpage causes solutions",
    slug: "injection-molding-warpage-causes-solutions",
    cluster: "defects",
    intent: "diagnostic",
    stage: "validate",
    priority: 90
  },
  {
    id: "BL12",
    keyword: "injection molding weld lines causes solutions",
    slug: "injection-molding-weld-lines-causes-solutions",
    cluster: "defects",
    intent: "diagnostic",
    stage: "validate",
    priority: 89
  },
  {
    id: "BL13",
    keyword: "injection mold steel selection",
    slug: "injection-mold-steel-selection-guide",
    cluster: "tooling",
    intent: "decision",
    stage: "evaluate",
    priority: 88
  },
  {
    id: "BL14",
    keyword: "S136 vs NAK80 mold steel",
    slug: "s136-vs-nak80-mold-steel",
    cluster: "tooling",
    intent: "decision",
    stage: "evaluate",
    priority: 87
  },
  {
    id: "BL15",
    keyword: "hot runner vs cold runner injection mold",
    slug: "hot-runner-vs-cold-runner-injection-mold",
    cluster: "tooling",
    intent: "decision",
    stage: "evaluate",
    priority: 86
  },
  {
    id: "BL16",
    keyword: "conformal cooling injection mold",
    slug: "conformal-cooling-injection-mold",
    cluster: "tooling",
    intent: "engineering",
    stage: "evaluate",
    priority: 85
  },
  {
    id: "BL17",
    keyword: "ABS injection molding design guide",
    slug: "abs-injection-molding-design-guide",
    cluster: "materials",
    intent: "engineering",
    stage: "evaluate",
    priority: 84
  },
  {
    id: "BL18",
    keyword: "PC injection molding design guide",
    slug: "pc-injection-molding-design-guide",
    cluster: "materials",
    intent: "engineering",
    stage: "evaluate",
    priority: 83
  },
  {
    id: "BL19",
    keyword: "injection molding cycle time optimization",
    slug: "injection-molding-cycle-time-optimization-guide",
    cluster: "production-quality",
    intent: "engineering",
    stage: "evaluate",
    priority: 82
  },
  {
    id: "BL20",
    keyword: "injection molding cavity balance",
    slug: "injection-molding-cavity-balance-guide",
    cluster: "production-quality",
    intent: "engineering",
    stage: "evaluate",
    priority: 81
  }
];

function collectFiles(dir) {
  if (!fs.existsSync(dir)) return [];

  const out = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.name === "node_modules" ||
      entry.name === "dist" ||
      entry.name === ".astro" ||
      entry.name === ".git"
    ) continue;

    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      out.push(...collectFiles(full));
    } else {
      out.push(full);
    }
  }

  return out;
}

const files = collectFiles(path.join(ROOT, "src"));

const textFiles = files.filter(file =>
  /\.(astro|ts|tsx|js|mjs|json|md|mdx)$/i.test(file)
);

const existingText = textFiles.map(file => {
  let text = "";

  try {
    text = fs.readFileSync(file, "utf8").toLowerCase();
  } catch {
    return { file, text: "" };
  }

  return { file, text };
});

const routeCandidates = candidates.map(candidate => {
  const slug = candidate.slug.toLowerCase();
  const keyword = candidate.keyword.toLowerCase();

  const slugHits = existingText
    .filter(item =>
      item.text.includes(`/${slug}`) ||
      item.text.includes(`"${slug}"`) ||
      item.text.includes(`'${slug}'`)
    )
    .map(item => path.relative(ROOT, item.file));

  const keywordHits = existingText
    .filter(item => item.text.includes(keyword))
    .map(item => path.relative(ROOT, item.file));

  return {
    ...candidate,
    status:
      slugHits.length > 0
        ? "BLOCKED_SLUG_COLLISION"
        : keywordHits.length > 0
          ? "REVIEW_SEMANTIC_COLLISION"
          : "CANDIDATE",
    slugHits,
    keywordHits,
    evidenceStatus: "NOT_YET_COMPILED",
    publicationStatus: "NOT_YET_ELIGIBLE"
  };
});

const manifest = {
  schema: "nexmold.v7.14.long-tail-keyword-manifest.v1",
  batch: "BATCH-01",
  generatedAt: new Date().toISOString(),
  policy: {
    modifyExistingContent: false,
    publishAutomatically: false,
    evidenceRequired: true,
    semanticCollisionReviewRequired: true,
    v714PublicationGateRequired: true
  },
  summary: {
    totalCandidates: routeCandidates.length,
    slugCollisions: routeCandidates.filter(x =>
      x.status === "BLOCKED_SLUG_COLLISION"
    ).length,
    semanticReview: routeCandidates.filter(x =>
      x.status === "REVIEW_SEMANTIC_COLLISION"
    ).length,
    cleanCandidates: routeCandidates.filter(x =>
      x.status === "CANDIDATE"
    ).length
  },
  candidates: routeCandidates
};

fs.writeFileSync(
  OUT_FILE,
  JSON.stringify(manifest, null, 2),
  "utf8"
);

console.log("=======================================================");
console.log("[NEXMOLD][V7.14] LONG-TAIL FACTORY — BATCH 01");
console.log("=======================================================");
console.log(`Manifest : ${OUT_FILE}`);
console.log(`Candidates: ${manifest.summary.totalCandidates}`);
console.log(`Slug collision: ${manifest.summary.slugCollisions}`);
console.log(`Semantic review: ${manifest.summary.semanticReview}`);
console.log(`Clean candidates: ${manifest.summary.cleanCandidates}`);
console.log("");
console.log("NO EXISTING SITE CONTENT WAS MODIFIED.");
console.log("NO ARTICLE WAS PUBLISHED.");
console.log("NEXT STAGE: EVIDENCE -> CLAIM -> FIREWALL -> ARTICLE.");
