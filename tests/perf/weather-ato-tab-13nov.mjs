// Weather -> ATO race: shared FR.c iframe must honour the latest shell tab, not stale ?tab=map.
// Pill look, motion, and normal click behaviour stay unchanged; only boot/ens sync is constrained.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const site = process.env.SITE_DIR || path.resolve('site');
const read = (p) => fs.readFileSync(path.join(site, p), 'utf8');

test('index.html tracks FR.c._want, prefers live cur, and ignores stale show() waiters', () => {
  const t = read('index.html');
  assert.match(t, /function applyCWant/);
  assert.match(t, /FR\.c\)FR\.c\._want\s*=\s*k/);
  assert.match(t, /show\._cWant\s*=\s*k/);
  assert.match(t, /if\(K==='c'\)applyCWant\(f\)/);
  assert.match(t, /addEventListener\('load',function\(\)\{flushC\(\);if\(K==='c'\)applyCWant\(f\)\}/);
  assert.match(t, /try\{hook\(f\)\}catch/);
  assert.match(t, /flushC=/);
  assert.match(t, /catch\(e\)\{\}},50\)/);

  // Latest requested tab (targetCur) wins over lagging cur / stale FR.c._want / ?tab=.
  assert.match(t, /now=targetCur\|\|cur/);
  assert.match(t, /want=\(now&&SEC\[now\]&&SEC\[now\]\.c\)\?now:\(f\._want\|\|show\._cWant\)/);
  assert.match(t, /targetCur=k;if\(SEC\[k\]\.c\)/);
  assert.match(t, /else\{show\._cWant=null;if\(FR\.c\)FR\.c\._want=null\}/);
  assert.match(t, /k!==\(targetCur\|\|cur\)/);
  assert.match(t, /get target\(\)\{return targetCur\|\|cur\}/);
  // Stale go()/WMTB callbacks must not run after a newer show().
  assert.match(t, /var go=function\(\)\{if\(seq!==show\.n\)return;/);
  assert.match(t, /if\(seq!==show\.n\)return;var K=key\(k\)/);
  assert.doesNotMatch(t, /c\/appdata\//);
});

test('c/app.html ens() and ?tab= boot follow parent.WMMERGE.cur when embedded, and never override a non-c-tab cur', () => {
  const t = read('c/app.html');
  assert.match(t, /window\.WMShellTab/);
  assert.match(t, /parent\.WMMERGE/);
  assert.match(t, /f\._want/);
  assert.match(t, /WMShellSyncTab/);
  assert.match(t, /DOMContentLoaded/);
  // When embedded, ens uses parent.WMMERGE.cur only if it is chart|map|ato|dfe;
  // otherwise it returns without clicking (user already left for another page).
  assert.match(t, /inShell=true;parentCur=window\.parent\.WMMERGE\.target\|\|window\.parent\.WMMERGE\.cur/);
  assert.match(t, /if\(\/\^\(chart\|map\|ato\|dfe\)\$\/\.test\(parentCur\|\|''\)\)want=parentCur;else return/);
  assert.match(t, /if\(!\/\^\(chart\|map\|ato\|dfe\)\$\/\.test\(k\|\|''\)\) return null;/);
  // Pill click / look / motion path is still the original go()/sel().
  assert.match(t, /function go\(i\)\{var t=T\[i\];if\(t\[2\]\)\{var b=document\.querySelector\('nav button\[data-t="'\+t\[2\]\+'"\]'\);if\(b\)\{b\.click\(\);history\.replaceState/);
  assert.match(t, /function sel\(i,now\)\{cur=i;A\.forEach\(function\(a,j\)\{a\.classList\.toggle\('on',j==i\)\}\)/);
});
