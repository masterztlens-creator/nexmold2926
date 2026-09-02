import fs from 'node:fs';
import path from 'node:path';
import { runRuntimePublicationGate } from '../src/regional/v714-runtime-publication-gate.ts';

const root = process.cwd();
const dir = path.join(root, '.nexmold', 'content-factory', 'batch-01-v3');
const report = JSON.parse(fs.readFileSync(path.join(dir, 'production-report.json'), 'utf8'));
const bySlug = new Map(report.results.map((x) => [String(x.slug ?? x.targetSlug ?? ''), x]));
const files = fs.readdirSync(dir).filter((x) => x.endsWith('.json') && x !== 'production-report.json');
let passed = 0;
for (const file of files) {
  const slug = file.slice(0, -5);
  const metadata = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const result = runRuntimePublicationGate(metadata, bySlug.get(slug) ?? null, slug);
  if (!result.ok) throw new Error(`${slug}: ${result.reason}`);
  passed += 1;
}
if (passed !== 20) throw new Error(`Expected 20 authorized artifacts, got ${passed}`);
console.log(`V714_RUNTIME_GATE_AUTHORIZED=${passed}`);
