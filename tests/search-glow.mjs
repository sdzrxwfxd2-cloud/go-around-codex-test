// Search glow contract.
// MT t2602 (11 Nov 2026) used to be: the glow only spins while the box is pressed, focused, pulsing or armed.
// MT 12 Nov 2026 overrides it: the glow runs ALWAYS (at rest, not focused, tab inactive). It rests only while the search overlay
// is hidden (.fs-spot without .on), and reduced motion is respected. It turns as one composited layer (transform only), so it
// never animates --fs-ang (a main-thread repaint every frame). The module sits at the end of every fs.js that pages load.
import fs from 'fs';
const read = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const fail = [];
const JS = ['site/fs/fs.js', 'site/c/fs/fs.js'];
const want = {
  'rotating layer keyframes (transform only)': '@keyframes fsg-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}',
  'own composited layer': 'will-change:transform;animation:fsg-spin',
  'reduced motion stands still': '@media (prefers-reduced-motion:reduce){fs-glow-ring>i{animation:none}}',
  'fs.css conic spin switched off on the pseudo': 'animation:none!important',
  'hidden overlay rests the ring': '.fs-spot:not(.on) fs-glow-ring>i{animation-play-state:paused}',
  'same ring mask as fs.css': 'mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0)',
  'covers the field and the pull-down copy': ".fs-field,.fs-pull span"
};
for (const f of JS) {
  const s = read(f), a = s.indexOf('/* ---------- Search glow, always on');
  if (a < 0) { fail.push('glow module missing: ' + f); continue; }
  const g = s.slice(a);
  for (const [k, v] of Object.entries(want)) if (!g.includes(v)) fail.push(f + ': ' + k);
  // must not pause on focus/active: no focus-gated rule and no play-state pause other than the hidden overlay
  if (/focus-within|:active/.test(g)) fail.push(f + ': glow must not depend on focus/active');
  if ((g.match(/animation-play-state:paused/g) || []).length !== 1) fail.push(f + ': only the hidden overlay may rest the glow');
  if (/@property|--fs-ang/.test(g.replace(/\/\*[\s\S]*?\*\//g, ''))) fail.push(f + ': glow must not animate --fs-ang');
  if (/ga-title-sweep|wmLzP/.test(g)) fail.push(f + ': must not touch ga-title-sweep / wmLzP');
}
// fs.css keeps its own glow as the fallback if the module does not run (paused at rest; reduced motion still)
for (const f of ['site/fs/fs.css', 'site/c/fs/fs.css']) {
  const s = read(f);
  if (!/@media\s*\(prefers-reduced-motion:reduce\)\{\.fs-field::before,\.fs-field::after\{animation:none!important/.test(s)) fail.push(f + ': reduced-motion rule missing');
}
if (fail.length) { console.log('search-glow: FAIL', fail); process.exit(1); }
console.log('search-glow: ok (always on, composited, rests only while the overlay is hidden, reduced motion respected)');
