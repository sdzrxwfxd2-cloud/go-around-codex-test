// Perf guard (11 Nov 2026): the first-load patch scripts must give the SAME words while doing less work.
// phase.js: one-pass tree walk (no ancestor climb) + verdict icons only around changed nodes; wm-final.js: no rewrite of an
// unchanged card; no-runway-symbol.js: list changes repaint only the changed cards. Browser part skips without puppeteer-core/Chrome.
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
const site = new URL('../../site/', import.meta.url);
let fail = 0; const ok = (c, m) => { if (!c) { console.error('FAIL', m); fail++; } };
const rd = (f) => readFileSync(new URL(f, site), 'utf8'), hash = (f) => createHash('sha256').update(readFileSync(new URL(f, site))).digest('hex').slice(0, 10);
const phase = rd('wst/phase.js'), fin = rd('wst/wm-final.js'), nr = rd('wst/no-runway-symbol.js');
ok(!/for\(var e=n\.parentNode;e&&e!==root\.parentNode/.test(phase) && /createTreeWalker\(root,5,/.test(phase), 'phase.js walks the tree once (no per-text-node ancestor climb)');
ok(/verdictIcons\(t\)/.test(phase), 'phase.js checks verdict icons only around changed nodes');
ok(/if\(c\.dataset\.s!==ds\)c\.dataset\.s=ds/.test(fin) && /b\.__wmSrc===bl/.test(fin) && /w\.__wmSrc===wh/.test(fin), 'wm-final.js skips writes that would not change the card');
ok(/new MutationObserver\(scoped\)/.test(nr), 'no-runway-symbol.js repaints only changed cards');
for (const page of ['index.html', 'main.html']) { const s = rd(page); for (const [f, re] of [['wst/phase.js', /wst\/phase\.js\?v=([^"']+)/g], ['wst/wm-final.js', /wst\/wm-final\.js\?v=([^"']+)/g], ['wst/no-runway-symbol.js', /wst\/no-runway-symbol\.js\?v=([^"']+)/g]]) for (const m of s.matchAll(re)) ok(m[1] === hash(f), `${page}: ${f} ?v= is its content hash`); }

const chrome = process.env.CHROME_PATH || '/usr/bin/google-chrome';
let pptr = null; try { pptr = (await import('puppeteer-core')).default; } catch {}
if (!pptr || !existsSync(chrome)) console.log('first-load: browser part skipped (no puppeteer-core/Chrome)');
else {
  const b = await pptr.launch({ executablePath: chrome, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  const html = `<!doctype html><body><div id="list">
   <article class="card"><div class="ch"><span class="badge">GO</span></div><p class="why"><b>GO</b> · Within limits</p></article>
   <article class="card"><div class="ch"><span class="badge">NO-GO</span></div><p class="why"><b>NO-GO</b> · Wind</p></article>
   <code><b>GO</b> stays</code><div contenteditable="true"><span>GO</span> stays</div><p id="plain">Ready to GO now</p></div>
   <script>localStorage.setItem('wm.phaseMode','depart')<\/script><script>${phase}<\/script></body>`;
  await p.setContent(html); await new Promise(r => setTimeout(r, 200));
  const r1 = await p.evaluate(() => ({ b: [...document.querySelectorAll('.badge')].map(x => x.textContent + '|' + x.dataset.verdictIcon), w: [...document.querySelectorAll('.why')].map(x => x.textContent), code: document.querySelector('code').textContent, ed: document.querySelector('[contenteditable]').textContent, plain: document.getElementById('plain').textContent }));
  ok(JSON.stringify(r1.b) === JSON.stringify(['DEPART|go', 'NO DEPART|nogo']), 'badges read DEPART / NO DEPART with icons: ' + JSON.stringify(r1.b));
  ok(r1.w[0].startsWith('DEPART') && r1.w[1].startsWith('NO DEPART'), 'why lines switched');
  ok(r1.code === 'GO stays' && r1.ed === 'GO stays', 'CODE and editable text are never touched (nested too)');
  ok(r1.plain === 'Ready to DEPART now', 'plain text switched');
  // a weather rewrite of one badge: still switched in the same task (no ghost), icon follows
  const r2 = await p.evaluate(() => new Promise(res => { const bd = document.querySelectorAll('.badge')[1]; bd.textContent = 'CAUTION'; Promise.resolve().then(() => res({ t: bd.textContent, i: bd.dataset.verdictIcon })); }));
  ok(r2.t === 'CAUTION' && r2.i === 'caution', 'changed badge gets its new icon in the same microtask: ' + JSON.stringify(r2));
  const r3 = await p.evaluate(() => new Promise(res => { const bd = document.querySelectorAll('.badge')[0]; bd.textContent = 'NO-GO'; Promise.resolve().then(() => res(bd.textContent + '|' + bd.dataset.verdictIcon)); }));
  ok(r3 === 'NO DEPART|nogo', 'GO -> NO-GO rewrite reads NO DEPART at once: ' + r3);
  await b.close();
}
if (fail) process.exit(1);
console.log('first-load: ok');
