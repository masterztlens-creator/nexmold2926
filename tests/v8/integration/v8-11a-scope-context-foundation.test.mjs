import assert from "node:assert/strict";
import { FoundationService } from "../../../.v8-build/src/v8/foundation/service.js";
import { InMemoryFoundationStore } from "../../../.v8-build/src/v8/foundation/store.js";
import { createScope } from "../../../.v8-build/src/v8/domain/scope.js";
import { createContext } from "../../../.v8-build/src/v8/domain/context.js";
const actor = Object.freeze({
  id: "v8-11a-test",
  role: "SYSTEM",
});
const store = new InMemoryFoundationStore();
const foundation = new FoundationService(store);
const scope = createScope({
  geography: "EU",
  industries: ["Injection Molding"],
  languages: ["en"],
});
const scopeRecord = foundation.registerScope(
  scope,
  actor,
);
assert.equal(
  scopeRecord.aggregateType,
  "SCOPE",
);
assert.equal(
  scopeRecord.state,
  "REGISTERED",
);
assert.deepEqual(
  scopeRecord.payload,
  {
    geography: "EU",
    industries: ["Injection Molding"],
    languages: ["en"],
  },
);
assert.deepEqual(
  scopeRecord.lineage,
  [],
);
assert.throws(
  () => foundation.registerScope(scope, actor),
  /V8_FOUNDATION_SCOPE_EXISTS/,
);
const context = createContext({
  scopeId: scope.id,
  purpose: "industrial applicability",
  variables: {
    productType: "plastic enclosure",
    market: "EU",
  },
});
const contextRecord = foundation.registerContext(
  context,
  actor,
);
assert.equal(
  contextRecord.aggregateType,
  "CONTEXT",
);
assert.equal(
  contextRecord.state,
  "REGISTERED",
);
assert.deepEqual(
  contextRecord.payload,
  {
    scopeId: scope.id,
    purpose: "industrial applicability",
    variables: {
      market: "EU",
      productType: "plastic enclosure",
    },
  },
);
assert.equal(
  contextRecord.lineage.length,
  1,
);
assert.equal(
  contextRecord.lineage[0].type,
  "SCOPE",
);
assert.equal(
  contextRecord.lineage[0].id,
  scope.id,
);
assert.equal(
  contextRecord.lineage[0].fingerprint,
  scopeRecord.fingerprint,
);
assert.throws(
  () =>
    foundation.registerContext(
      createContext({
        scopeId: "scope:missing",
        purpose: "invalid",
        variables: {},
      }),
      actor,
    ),
  /V8_FOUNDATION_CONTEXT_SCOPE_NOT_REGISTERED/,
);
store.verifyChain();
console.log(
  "V8-11A Scope/Context Foundation PASS",
);