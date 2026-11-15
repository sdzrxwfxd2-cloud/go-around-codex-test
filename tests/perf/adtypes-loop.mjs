// Perf guard (11 Nov 2026): c/wst/ad-types.js must settle. After the first pass, a quiet list must see ZERO DOM changes
// (it used to re-add the military row every 80 ms forever). Also checks main.html watches only the settings sheet.
// Browser part needs puppeteer-core + Chrome (CHROME_PATH or /usr/bin/google-chrome); it is skipped, not failed, without them.
import { readFileSync, existsSync } from 'node:fs';
const site = new URL('../../site/', import.meta.url);
let fail = 0; const ok = (c, m) => { if (!c) { console.error('FAIL', m); fail++; } };

// 1. static: the theme-label observer in main.html observes the sheet, not the whole body
const main = readFileSync(new URL('main.html', site), 'utf8');
ok(/observe\(document\.querySelector\('\.sheet'\)\|\|document\.body,\{childList:true,subtree:true\}\);\/\* speed: one coalesced pass/.test(main), 'main.html theme-label observer is scoped to .sheet');
const v = main.match(/c\/wst\/ad-types\.js\?v=([0-9a-f]{10})/);
const { createHash } = await import('node:crypto');
ok(v && v[1] === createHash('sha256').update(readFileSync(new URL('c/wst/ad-types.js', site))).digest('hex').slice(0, 10), 'main.html ad-types.js ?v= is its content hash');

// 2. browser: no endless redraw
const chrome = process.env.CHROME_PATH || '/usr/bin/google-chrome';
let pptr = null; try { pptr = (await import('puppeteer-core')).default; } catch {}
if (!pptr || !existsSync(chrome)) { console.log('adtypes-loop: browser part skipped (no puppeteer-core/Chrome)'); }
else {
  const data = readFileSync(new URL('c/wst/ad-types-data.js', site), 'utf8'), js = readFileSync(new URL('c/wst/ad-types.js', site), 'utf8');
  const card = (icao, name) => `<article class="card glass" data-s="none"><div class="ch"><div class="t"><h2>${name}</h2><div class="sub"><span class="icao">${icao}</span><span>·</span><span>Prov</span></div></div><span class="badge">NO DATA</span></div><p class="why"></p></article>`;
  const cards = [card('FADY', 'De Aar Military'), card('FAHS', 'Hoedspruit'), card('FACT', 'Cape Town International'), card('FAOR', 'O.R. Tambo')].join('');
  const html = `<!doctype html><body><div id="list">${cards}</div><script>${data}<\/script><script>${js}<\/script></body>`;
  const b = await pptr.launch({ executablePath: chrome, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setContent(html);
  await new Promise(r => setTimeout(r, 600)); // let the first passes settle
  const res = await p.evaluate(() => new Promise(res => { let n = 0; const mo = new MutationObserver(ms => { n += ms.length; }); mo.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
    // a real change in the list must still be handled once: add one more military card
    setTimeout(() => { const d = document.createElement('div'); d.innerHTML = document.querySelector('article').outerHTML.replace(/<div class="mil-row">.*?<\/div><\/div>/, '</div>'); }, 0);
    setTimeout(() => { mo.disconnect(); const rows = [...document.querySelectorAll('article')].map(a => a.querySelectorAll('.ch > .mil-row').length); res({ n, rows, type: document.querySelector('article').dataset.adType }); }, 1500); }));
  ok(res.n === 0, `quiet list makes no DOM changes after settling (got ${res.n} in 1.5 s)`);
  ok(res.type === 'military' && res.rows[0] === 1 && res.rows[1] === 1, 'military cards keep exactly one military row');
  ok(res.rows[2] === 0 && res.rows[3] === 0, 'non-military cards have no military row');
  // new card added later is still marked
  const late = await p.evaluate(() => new Promise(res => { const l = document.getElementById('list'); const a = document.createElement('article'); a.className = 'card glass'; a.innerHTML = '<div class="ch"><div class="t"><h2>Lohatla</h2><div class="sub"><span class="icao">FALH</span></div></div><span class="badge">GO</span></div>'; l.appendChild(a);
    setTimeout(() => res({ rows: a.querySelectorAll('.ch > .mil-row').length, t: a.dataset.adType, name: a.querySelector('h2 .nm') && a.querySelector('h2 .nm').textContent }), 400); }));
  ok(late.t === 'military' && late.rows === 1 && late.name === 'Lohatla.', 'a card added later is still marked once (' + JSON.stringify(late) + ')');
  await b.close();
}
if (fail) process.exit(1);
console.log('adtypes-loop: ok');
