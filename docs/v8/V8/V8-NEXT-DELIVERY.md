# NEXMOLD V8 Next Delivery

## Baseline

V8 Next is based on the verified LKG:

- Tag: `v8-lkg`
- Commit: `d0ae7038c90f4a79c228eaa2ba0ac6a98752fb0a`
- Package: `nexmold-v8-full`
- Node engine: `>=22.12.0`
- TypeScript: `6.0.3`
- Lockfile: npm lockfile v3

## Objective

V8 Next adds operational hardening without changing the already verified
V8 domain architecture.

The operational layer provides:

1. Runtime contract
2. Artifact manifest
3. Source integrity manifest
4. Build fingerprint
5. Dependency boundary
6. Production snapshot contract
7. LKG contract
8. Operational invariants

## Gate Chain

```text
V8 Final
   |
   v
Operational
   |
   v
Integrity
   |
   v
Reproducibility
   |
   v
Artifact
   |
   v
V8 Next PASS