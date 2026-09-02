# NEXMOLD V7.14 — Complete Production Wiring

Target: `E:\nexmold`

This patch overlays only the V7.14 control-plane files and regional contract files. It does **not** modify Astro pages, layouts, components, or CSS.

## Install

From PowerShell:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\install-v714.ps1
```

The installer creates a timestamped pre-V7.14 backup under `.nexmold\pre-v714-*` for the affected files only.

## Verify

```powershell
cd E:\nexmold
npm run v714:audit
npm run v714:adversarial
npm run build
```

## What is wired

- Runtime fail-closed gate
- Sitemap/config gate
- Release preflight
- Route ownership/conflict gate
- V7.14 Evidence → Claim → Firewall → Publication core gate
- Regional publish-artifact factory
- Regional release preflight contract
- Static artifact manifest + SHA-256 hashing
- Forbidden secret artifact detection
- HTML integrity and smoke-route checks
- Optional expected route-set equality
- Optional remote health check
- Last-Known-Good advancement only after mandatory gates pass
- Adversarial bypass harness

## Known route warning

The current project may contain a static route such as `/services/custom-injection-molding` alongside `/services/[slug]`. Astro can report this as a priority/shadowing warning. V7.14 records it as a warning because the final static artifact has a single route owner; duplicate static ownership remains a hard failure.
