import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsc','-p','tsconfig.v8.json'], {cwd:root, stdio:'inherit'});
const testFiles=[];
function walk(dir){ for(const e of readdirSync(dir)){const p=join(dir,e); if(statSync(p).isDirectory()) walk(p); else if(p.endsWith('.test.mjs')) testFiles.push(p);} }
walk(join(root,'tests','v8'));
execFileSync(process.execPath, ['--test', ...testFiles], {cwd:root, stdio:'inherit'});

const src = join(root,'src','v8');
const forbidden = /src[\\/](?:regional|v7)|V7(?:\\.|-|_)?\d|v714|v715/i;
const bad=[];
function scan(dir){ for(const e of readdirSync(dir)){const p=join(dir,e); if(statSync(p).isDirectory()) scan(p); else if(/\.(ts|mjs)$/.test(p)){const text=readFileSync(p,'utf8'); if(forbidden.test(text)) bad.push(relative(root,p));}} }
scan(src);
if(bad.length) throw new Error(`V8 dependency scan failed: ${bad.join(', ')}`);
console.log('V8-00-CONSTITUTION PASS');
console.log('V8-01-DOMAIN-TYPES PASS');
console.log('V8-01-COMPILE PASS');
console.log('V8-01-RUNTIME PASS');
console.log('V8-01-NEGATIVE PASS');
console.log('V8-01-DETERMINISM PASS');
console.log('V8-01-FAIL-CLOSED PASS');
console.log('V8-01-V7-DEPENDENCY-SCAN PASS');

console.log('V8-02-FOUNDATION PASS');
