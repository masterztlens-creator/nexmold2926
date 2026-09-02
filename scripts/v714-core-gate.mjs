import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * NEXMOLD V7.14
 * Core Publication Boundary
 *
 * Evidence -> Claim -> Firewall -> Publication Gate
 *
 * Fail closed.
 *
 * This module deliberately does NOT import TypeScript directly.
 * The current project has no tsx/ts-node runtime.
 *
 * Phase 1 therefore validates the existence and integrity of the
 * TypeScript contract layer and enforces the zero-public-artifact
 * boundary before Astro build.
 */

const CORE_VERSION = "V7.14-CORE";

function result(passed, phase, extra = {}) {
  return Object.freeze({
    orchestrator: CORE_VERSION,
    phase,
    passed,
    ...extra,
  });
}

function checkFile(root, relativePath) {
  const absolutePath = path.join(root, relativePath);

  if (!fs.existsSync(absolutePath)) {
    return {
      passed: false,
      path: relativePath,
      reason: "MISSING_CONTRACT",
    };
  }

  const stat = fs.statSync(absolutePath);

  if (!stat.isFile() || stat.size === 0) {
    return {
      passed: false,
      path: relativePath,
      reason: "EMPTY_CONTRACT",
    };
  }

  return {
    passed: true,
    path: relativePath,
  };
}

function scanPublicArtifacts(root) {
  const publicDir = path.join(root, "public");

  if (!fs.existsSync(publicDir)) {
    return {
      passed: true,
      count: 0,
      artifacts: [],
    };
  }

  const artifacts = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, {
      withFileTypes: true,
    })) {
      const absolute = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(absolute);
        continue;
      }

      const relative = path.relative(root, absolute);

      /*
       * This is intentionally a conservative compiler-artifact scan.
       * Normal website assets are not treated as V7.14 compiler output.
       */
      const lower = relative.toLowerCase();

      if (
        lower.includes("claim") ||
        lower.includes("evidence") ||
        lower.includes("regionalpublishartifact") ||
        lower.includes("publication-artifact") ||
        lower.includes("publish-artifact")
      ) {
        artifacts.push(relative);
      }
    }
  }

  walk(publicDir);

  return {
    passed: artifacts.length === 0,
    count: artifacts.length,
    artifacts,
  };
}

/**
 * V7.14 Core Gate
 *
 * Current Phase:
 *
 *   Contract Presence
 *          +
 *   Public Artifact Zero Boundary
 *
 * No producer is allowed to fabricate a Claim or Evidence object here.
 * Until a real producer is wired, publication remains closed.
 */
export function runV714CoreGate(context = {}) {
  const root =
    typeof context === "string"
      ? context
      : context?.projectRoot ?? context?.root ?? process.cwd();
  console.log(
    "[NEXMOLD][V7.14][CORE] Evidence -> Claim -> Firewall -> Publication Gate",
  );

  const contracts = [
    ["Evidence contract", "src/regional/types.ts"],
    ["Eligibility contract", "src/regional/eligibility.ts"],
    ["Epistemic Firewall", "src/regional/epistemic-firewall.ts"],
    ["Publication Gate", "src/regional/publication-gate.ts"],
  ];

  const contractResults = contracts.map(([name, relativePath]) => {
    const check = checkFile(root, relativePath);

    if (check.passed) {
      console.log(
        `[NEXMOLD][V7.14][CORE] ${name}: PRESENT`,
      );
    } else {
      console.error(
        `[NEXMOLD][V7.14][CORE][BLOCK] ${name}: ${check.reason}`,
      );
    }

    return {
      name,
      ...check,
    };
  });

  const contractsPassed = contractResults.every(
    (item) => item.passed,
  );

  if (!contractsPassed) {
    return result(false, "core-blocked", {
      reason: "V714_CORE_CONTRACT_INVALID",
      contracts: contractResults,
      publicArtifacts: {
        count: null,
        artifacts: [],
      },
    });
  }

  /*
   * Publication remains closed unless an actual producer exists.
   *
   * This is the deliberate Phase-1 invariant:
   *
   *     no verified producer
   *              =>
   *     no public artifact
   */
  const publicArtifacts = scanPublicArtifacts(root);

  if (!publicArtifacts.passed) {
    console.error(
      `[NEXMOLD][V7.14][CORE][BLOCK] Public Artifact count=${publicArtifacts.count}`,
    );

    for (const artifact of publicArtifacts.artifacts) {
      console.error(
        `[NEXMOLD][V7.14][CORE][BLOCK] ${artifact}`,
      );
    }

    return result(false, "publication-blocked", {
      reason: "V714_PUBLIC_ARTIFACT_NONZERO",
      contracts: contractResults,
      publicArtifacts,
    });
  }

  console.log(
    "[NEXMOLD][V7.14][CORE] Evidence contract: PASS",
  );
  console.log(
    "[NEXMOLD][V7.14][CORE] Claim boundary: CLOSED",
  );
  console.log(
    "[NEXMOLD][V7.14][CORE] Epistemic Firewall: PRESENT",
  );
  console.log(
    "[NEXMOLD][V7.14][CORE] Publication Gate: PRESENT",
  );
  console.log(
    "[NEXMOLD][V7.14][CORE] Public Artifact = 0",
  );
  console.log(
    "[NEXMOLD][V7.14][CORE] PASS",
  );

  return result(true, "core-pass", {
    reason: "V714_PUBLIC_BOUNDARY_CLOSED",
    contracts: contractResults,
    publicArtifacts,
  });
}

/*
 * Standalone execution.
 *
 * The orchestrator imports runV714CoreGate().
 */
if (process.argv[1]) {
  const invokedFile = path.resolve(process.argv[1]);
  const currentFile = path.resolve(
    fileURLToPath(import.meta.url),
  );

  if (invokedFile === currentFile) {
    const output = runV714CoreGate(process.cwd());

    console.log(
      JSON.stringify(output, null, 2),
    );

    if (!output.passed) {
      process.exitCode = 1;
    }
  }
}

