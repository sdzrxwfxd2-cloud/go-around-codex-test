// DEEP-DIAG fix 1 (11 Nov 2026): wm-final runs one WMCore pass by default (wm-1pass=0 restores 3), coalesces applyS calls
// within 250 ms into one trailing run, and wst-card fillModel skips identical rewrites. Static checks; the 640-card DOM
// snapshot (depart, land, runtime switch) is the behaviour proof (see the PR).
import fs from 'fs';const r=f=>fs.readFileSync(new URL('../../site/'+f,import.meta.url),'utf8');
const f=r('wst/wm-final.js'),c=r('wst/wst-card.js'),h=r('wm-hide.js');const fail=[];
if(!/localStorage\.getItem\('wm-1pass'\)!=='0'/.test(f))fail.push('wm-1pass default on');
if(!/wm-coalesce/.test(f)||!/t-coLast<250/.test(f))fail.push('applyS coalesce');
const fm=c.slice(c.indexOf('function fillModel('),c.indexOf('/* sunrise / sunset pill */'));
if(/(tp|sp\[\d\]|fc)\.innerHTML=/.test(fm))fail.push('fillModel writes innerHTML directly');
if(!/tg\.closest\('\.card'\)/.test(h))fail.push('wm-hide card skip');
if(fail.length){console.log('pass-cascade: FAIL',fail);process.exit(1)}console.log('pass-cascade: ok');
