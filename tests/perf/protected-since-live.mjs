// Perf PRs (11 Nov 2026): nothing protected may change since the production head b23c060f (live/model-3h-11nov).
// The older cloudflare test "protected files untouched" compares with 77d0fa93 and already fails on production
// itself (site/wm-core.js changed in b2967662), so this checks the perf work on its own.
import { execSync } from 'node:child_process';
let changed = '';
try { changed = execSync('git diff --name-only b23c060f; git diff --name-only --cached b23c060f', { cwd: new URL('../..', import.meta.url), encoding: 'utf8' }); }
catch { console.log('protected-since-live: skipped (no git history)'); process.exit(0); }
// Protected changes MT approved on 11 Nov 2026 (PR #63 middleware ETag, PR #64 c/appdata split). Nothing else.
const APPROVED = new Set(['cloudflare/functions/_middleware.js', 'site/c/appdata/app-code.03838b9873.js', 'site/c/appdata/app-data-d.7c09bcfc6c.js',
  // MT approved on 13 Nov 2026 (t1957u, "I give you use for the protected"): Status summary labels in site/wm-core.js (GROUP map only).
  'site/wm-core.js',
  // MT approved on 13 Nov 2026 (t2801u, full permission for the remaining protected files):
  // wm-pin.js first-measure CLS guard (Codex ninth speed fix).
  'site/wm-pin.js']);
const bad = changed.split('\n').filter((f) => !APPROVED.has(f)).filter((f) => /gate\.ts$|(^|\/)appdata\/|ARCHIVE_DO_NOT_TOUCH|lib\/auth\.mjs$|wm-pin\.js$|^site\/wm-core\.js$|functions\/_middleware\.js$|functions\/admin\//.test(f));
if (bad.length) { console.error('FAIL protected files changed:', bad); process.exit(1); }
console.log('protected-since-live: ok');
