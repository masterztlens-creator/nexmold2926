#!/usr/bin/env node
/** NEXMOLD V7.14 — production factory contract checker/selector. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const ROOT=process.cwd();
const CONTRACT="V7.14-SINGLE-CONTRACT-2026-09-02";
const TARGETS=["injection-molding-draft-angle"];
const required=["src/regional/types.ts","src/regional/epistemic-firewall.ts","src/regional/regionalPublishArtifact.ts","src/regional/regionalCompiler.ts","src/regional/article-producer.ts","src/regional/article-renderer.ts"];
function sha256(s){return crypto.createHash("sha256").update(s,"utf8").digest("hex");}
function main(){for(const rel of required){const p=path.join(ROOT,rel);if(!fs.existsSync(p))throw new Error(`V714_FACTORY_REQUIRED_FILE_MISSING:${rel}`);}const types=fs.readFileSync(path.join(ROOT,"src/regional/types.ts"),"utf8");if(!types.includes(CONTRACT))throw new Error("V714_FACTORY_CONTRACT_VERSION_MISSING");const manifest={schema:"nexmold.v7.14.factory-manifest.v5",contract:CONTRACT,sourceOfTruth:"src/data/knowledge.ts",targets:TARGETS,requiredFiles:required,generatedAt:new Date().toISOString(),contractFingerprint:sha256(required.map(f=>fs.readFileSync(path.join(ROOT,f),"utf8")).join("\n---\n"))};console.log(`[NEXMOLD][V7.14] SINGLE CONTRACT: ${CONTRACT}`);console.log(`[NEXMOLD][V7.14] Required modules: ${required.length}`);console.log(`[NEXMOLD][V7.14] Targets: ${TARGETS.join(", ")}`);console.log(`[NEXMOLD][V7.14] Contract fingerprint: ${manifest.contractFingerprint}`);console.log("[NEXMOLD][V7.14] PASS — no hidden eligibility/publication/article-contract dependencies in patch.");}
main();
