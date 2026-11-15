// tests/perf/perf-budget.mjs: the speed budget passes on this tree, and the checker really catches growth.
import { execFileSync } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'); const tool = path.join(root, 'tools', 'perf-budget.mjs');
execFileSync(process.execPath, [tool], { stdio: ['ignore', 'ignore', 'inherit'] });
// negative check: a budget one byte under today's Home HTML must fail
const B = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'perf-budget.json'), 'utf8'));
const rep = execFileSync(process.execPath, [tool, '--report'], { encoding: 'utf8' }); const cur = +rep.match(/page:index\.html:html_br\s+(\d+)/)[1];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-')); fs.mkdirSync(path.join(tmp, 'tools')); fs.symlinkSync(path.join(root, 'site'), path.join(tmp, 'site'));
fs.copyFileSync(tool, path.join(tmp, 'tools', 'perf-budget.mjs')); fs.writeFileSync(path.join(tmp, 'tools', 'perf-budget.json'), JSON.stringify({ ...B, 'page:index.html:html_br': cur - 1 }));
let failed = false; try { execFileSync(process.execPath, [path.join(tmp, 'tools', 'perf-budget.mjs')], { stdio: 'ignore' }); } catch { failed = true; }
fs.rmSync(tmp, { recursive: true, force: true });
if (!failed) { console.error('FAIL budget checker did not catch a page over budget'); process.exit(1); }
console.log('perf-budget: ok');
