NEXMOLD V7.14 — STEP A + Expert Evidence Engine patch

Included:
1. scripts/v714-article-factory.mjs
   - stable SHA-256 source-content hash
   - preserves block.items as Markdown bullets
2. src/regional/article-producer.ts
   - removes string spread in compatibility content projection
3. src/regional/expert-article-contract.ts
   - Fact / Claim / Evidence / Mechanism / Decision / Validation contract
4. scripts/v714-evidence-crawler.mjs
   - conservative public-source discovery and evidence snapshotter
   - source authority tiers, content hashing, rate limiting, HTML-only fetch
5. package.json
   - adds npm run v714:evidence

Validation performed in the audit container:
- node --check scripts/v714-article-factory.mjs: PASS
- node --check scripts/v714-evidence-crawler.mjs: PASS
- P0 regression simulation: PASS

Important:
- The audit container has no npm dependency tree, so a full Astro build was not rerun here.
- The crawler requires outbound DNS/network access on the production machine. It failed only in the isolated audit container with EAI_AGAIN; this is an environment limitation, not a code syntax failure.
