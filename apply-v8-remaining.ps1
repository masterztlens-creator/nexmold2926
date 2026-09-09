$ErrorActionPreference = "Stop"
$ProjectRoot = "E:\NEXMOLD"
$ExpectedBaseSha = "182bdedc8361c6569680d5ead0fc81dcedf9f31e"
if (-not (Test-Path -LiteralPath $ProjectRoot -PathType Container)) { throw "Project root not found: $ProjectRoot" }
Set-Location -LiteralPath $ProjectRoot
if (-not (Get-Command git.exe -ErrorAction SilentlyContinue)) { throw "git.exe not found" }
$head = (git.exe rev-parse HEAD).Trim()
if ($head -ne $ExpectedBaseSha) { throw "BASE_SHA_MISMATCH: expected $ExpectedBaseSha but found $head. Stop; do not overwrite." }
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $ProjectRoot ".nexmold\v8-remaining-backup-$stamp"
New-Item -ItemType Directory -Force -Path $backup | Out-Null
function Write-Utf8NoBom {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(Mandatory = $true)][string]$Content
  )
  $dir = Split-Path -Parent $FilePath
  if ($dir) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $utf8 = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($FilePath, $Content, $utf8)
}
$files = @(
  "src/v8/intelligence/shared.ts"
  "src/v8/intelligence/pipeline.ts"
  "src/v8/intelligence/web-discovery/types.ts"
  "src/v8/intelligence/web-discovery/candidate-normalizer.ts"
  "src/v8/intelligence/web-discovery/discovery.ts"
  "src/v8/intelligence/web-discovery/index.ts"
  "src/v8/intelligence/serp/types.ts"
  "src/v8/intelligence/serp/normalizer.ts"
  "src/v8/intelligence/serp/provider.ts"
  "src/v8/intelligence/serp/index.ts"
  "src/v8/intelligence/search-intent/intent.ts"
  "src/v8/intelligence/search-intent/index.ts"
  "src/v8/intelligence/keyword-universe/universe.ts"
  "src/v8/intelligence/keyword-universe/index.ts"
  "src/v8/intelligence/industry-niche/niche.ts"
  "src/v8/intelligence/industry-niche/index.ts"
  "src/v8/intelligence/competitor-gap/gap.ts"
  "src/v8/intelligence/competitor-gap/index.ts"
  "src/v8/intelligence/opportunity/score.ts"
  "src/v8/intelligence/opportunity/index.ts"
  "src/v8/intelligence/research-planner/planner.ts"
  "src/v8/intelligence/research-planner/index.ts"
  "src/v8/intelligence/evidence-expansion/expansion.ts"
  "src/v8/intelligence/evidence-expansion/index.ts"
  "src/v8/intelligence/content-compiler/compiler.ts"
  "src/v8/intelligence/content-compiler/index.ts"
  "src/v8/intelligence/seo/compiler.ts"
  "src/v8/intelligence/seo/index.ts"
  "src/v8/intelligence/geo/compiler.ts"
  "src/v8/intelligence/geo/index.ts"
  "src/v8/intelligence/authority-graph/graph.ts"
  "src/v8/intelligence/authority-graph/index.ts"
  "src/v8/intelligence/internal-links/links.ts"
  "src/v8/intelligence/internal-links/index.ts"
  "src/v8/intelligence/novelty/novelty.ts"
  "src/v8/intelligence/novelty/index.ts"
  "src/v8/intelligence/cannibalization/collision.ts"
  "src/v8/intelligence/cannibalization/index.ts"
  "src/v8/intelligence/quality-firewall/firewall.ts"
  "src/v8/intelligence/quality-firewall/index.ts"
  "src/v8/intelligence/publication/orchestrator.ts"
  "src/v8/intelligence/publication/index.ts"
  "src/v8/intelligence/performance/intelligence.ts"
  "src/v8/intelligence/performance/index.ts"
  "src/v8/intelligence/conversion/intelligence.ts"
  "src/v8/intelligence/conversion/index.ts"
  "src/v8/intelligence/growth-loop/loop.ts"
  "src/v8/intelligence/growth-loop/index.ts"
  "src/v8/intelligence/index.ts"
  "src/v8/index.ts"
  "tests/v8/intelligence/full-stack.test.mjs"
  "V8-REMAINING-MANIFEST.md"
)
$payloadRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $payloadRoot) { $payloadRoot = (Get-Location).Path }
foreach ($rel in $files) {
  $src = Join-Path $payloadRoot $rel
  if (-not (Test-Path -LiteralPath $src -PathType Leaf)) { throw "PACKAGE_FILE_MISSING: $rel" }
  $dst = Join-Path $ProjectRoot $rel
  if (Test-Path -LiteralPath $dst -PathType Leaf) {
    $backupPath = Join-Path $backup $rel
    $backupDir = Split-Path -Parent $backupPath
    New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
    Copy-Item -LiteralPath $dst -Destination $backupPath -Force
  }
  $content = [System.IO.File]::ReadAllText($src)
  Write-Utf8NoBom -FilePath $dst -Content $content
}
# Self-parse this script before validation completes.
$tokens = $null; $errors = $null
[System.Management.Automation.Language.Parser]::ParseFile($MyInvocation.MyCommand.Path, [ref]$tokens, [ref]$errors) | Out-Null
if ($errors.Count -gt 0) { throw "POWERSHELL_PARSE_FAILED: $($errors[0].Message)" }
foreach ($rel in $files) { if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot $rel) -PathType Leaf)) { throw "WRITE_VERIFY_FAILED: $rel" } }
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw "npm.cmd not found" }
& npm.cmd run v8:compile
if ($LASTEXITCODE -ne 0) { throw "v8:compile failed" }
& npm.cmd run v8:test
if ($LASTEXITCODE -ne 0) { throw "v8:test failed" }
git.exe status --short
git.exe diff --stat
Write-Host ""
Write-Host "NEXMOLD V8 REMAINING PACKAGE APPLIED SUCCESSFULLY."
Write-Host "Backup: $backup"
