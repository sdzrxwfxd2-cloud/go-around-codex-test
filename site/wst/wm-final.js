/* wm-final.js — single authoritative WMCore pass over every card (main + Status). Guidance only — the pilot in command decides. */
(function(){var K=window.WMCore,B=window.WMB;if(!K||!B)return;
/* #21 perf marks (instrumentation only, no behaviour change). User Timing entries, read with
   performance.getEntriesByName('wm:applyS') etc. or tools/perf21_trace.mjs:
   wm:final-pass  one WMCore pass over every card (runs twice per applyS)
   wm:applyS      the whole applyS chain, both passes included
   wm:tap         filter tap -> next frame painted (event time to after the next rAF) */
var PF=window.performance&&performance.mark&&performance.measure?performance:null;
function timed(name,fn,self,args){if(!PF)return fn.apply(self,args);var s=name+':start';PF.mark(s);try{return fn.apply(self,args)}finally{PF.measure(name,s)}}
var TAP='.wflt-b,.fv button,.wfr,#tiles .tile',tapBusy=false;
document.addEventListener('click',function(e){
 // Capture phase, passive: observes the tap and never alters it. One measure per tap, even when a tap is
 // forwarded as a second synthetic click (wm-pin mirror, fv3 proxy buttons).
 if(!PF||tapBusy||!e.target.closest||!e.target.closest(TAP))return;tapBusy=true;var t0=e.timeStamp;
 requestAnimationFrame(function(){setTimeout(function(){tapBusy=false;try{PF.measure('wm:tap',{start:t0,end:performance.now()})}catch(x){}},0)});
},{capture:true,passive:true});
var LB={go:'GO',caution:'CAUTION',nogo:'NO-GO',none:'INCOMPLETE'},SRC={metar:'METAR',taf:'TAF',model:'Model'};
var isI=function(c){return /^[A-Z]{4}$/.test(((c.querySelector('.icao')||{}).textContent||'').trim())};
var mode=function(){return localStorage.getItem('wm-count')==='all'?'all':'icao'};
function phaseWord(s){
  if(window.WMPHASE&&typeof WMPHASE.words==='function'){var w=WMPHASE.words(s);if(w)return w}
  try{var m=localStorage.getItem('wm.phaseMode')==='land'?'land':'depart';
    if(s==='go')return m==='land'?'LAND':'DEPART';
    if(s==='nogo')return m==='land'?'NO LAND':'NO DEPART';
  }catch(e){}
  return LB[s]||s;
}
function srcL(s){return SRC[(s||'').toLowerCase()]||s||''}
function pass(){return timed('wm:final-pass',passRun,this,arguments)}
var pTok=0,pFly=0;
function passRun(){
  var my=++pTok,now=Date.now(),n={go:0,caution:0,nogo:0},res=[],m=mode();
  var all=[].slice.call(document.querySelectorAll('.card')),vis=[],rest=[],i,c,rc,vh=window.innerHeight||800;
  for(i=0;i<all.length;i++){c=all[i];rc=c.getBoundingClientRect();if(rc.bottom>0&&rc.top<vh&&rc.height)vis.push(c);else if(vis.length&&rc.top>=vh){rest=rest.concat(all.slice(i));break}else rest.push(c)}
  function one(c){var r;try{r=B.evalCard(c,now)}catch(e){console.log('wmf',e);return}if(!r)return;
  var s=r.status,sl=srcL(r.source);if(c.dataset.src!==sl)c.dataset.src=sl;c.__wm=r;
  if(r.heliport){var inSh=!!c.closest('#wsp-cards');if(isI(c)&&(inSh||!document.getElementById('wsp-cards')))res.push(r);return}
  var ds=(s==='none')?'incomplete':s;if(c.dataset.s!==ds)c.dataset.s=ds;
  var b=c.querySelector('.badge');if(b){var bl=phaseWord(s);
   if(!(b.__wmSrc===bl&&b.__wmT&&b.__wmT.parentNode===b&&b.childNodes.length<=2)){b.textContent=bl;b.__wmSrc=bl;b.__wmT=b.firstChild}
   c.querySelectorAll('.mtag').forEach(function(t){t.remove()})}
  var w=c.querySelector('.why');if(!w){w=document.createElement('p');w.className='why';var ch=c.querySelector('.ch');if(ch)ch.after(w)}
  var at=r.time?K.util.sast(r.time):'';if((c.dataset.srcAt||'')!==at)c.dataset.srcAt=at;
  var tm=at?'<span class="why-t"> · '+at+'</span>':'';
  var whyTxt=String(r.whyShort||r.why||'').replace(/\s*[·]\s*Model estimate only [\u2014\-]+ not an official weather report\.?/g,'').replace(/\s*[·]\s*older(?: copy, fetched [^·]+)?/gi,'').replace(/\s{2,}/g,' ').replace(/\s+([.;])/g,'$1').trim();
  var wh=s==='none'?'No current weather':whyTxt+tm;
  if(!(w.__wmSrc===wh&&w.__wmF&&w.__wmF===w.firstChild&&w.__wmL===w.lastChild)){w.innerHTML=wh;w.__wmSrc=wh;w.__wmF=w.firstChild;w.__wmL=w.lastChild}
  var inS=!!c.closest('#wsp-cards');if((m==='all'||isI(c))&&n[s]!=null&&(inS||!document.getElementById('wsp-cards')))n[s]++;
  if(isI(c)&&(inS||!document.getElementById('wsp-cards')))res.push(r)}
  function fin(){if(my!==pTok)return;if(window.WM_COUNTS)n=WM_COUNTS();document.querySelectorAll('#tiles .tile').forEach(function(t){var e=t.querySelector('.n');if(e&&n[t.dataset.s]!=null)e.textContent=n[t.dataset.s]});
   window.__n=n;window.__wmSum=K.summarize(res);document.dispatchEvent(new CustomEvent('wm:pass',{detail:n}))}
  if(!vis.length&&all.length){vis=all.slice(0,8);rest=all.slice(8)}if(pFly||!all.length){all.forEach(one);pFly=0;fin();return n}
  pFly=1;vis.forEach(one);try{document.dispatchEvent(new CustomEvent('wm:vis'))}catch(e){}
  var k=0,idle=window.requestIdleCallback?function(f){requestIdleCallback(f,{timeout:200})}:function(f){setTimeout(f,16)};
  function slice(){if(my!==pTok)return;var t0=Date.now();while(k<rest.length&&Date.now()-t0<8)one(rest[k++]);if(k<rest.length)idle(slice);else{pFly=0;fin()}}
  (window.requestAnimationFrame||setTimeout)(function(){if(my===pTok)idle(slice)});
  return n}
window.WMF={pass:pass};
var st=document.createElement('style');st.textContent=".card .why{font-family:Satoshi,-apple-system,BlinkMacSystemFont,sans-serif;font-weight:500}.card .why b{font-weight:700;color:var(--tx2)}.card[data-s=incomplete]{--c:var(--tx3)}.card[data-s=incomplete] .badge{letter-spacing:.04em;color:var(--tx3)}.card[data-s=incomplete] .why{color:var(--tx3)}";document.head.appendChild(st);
var lock=false;function tiles(){if(lock||!window.__n)return;lock=true;document.querySelectorAll('#tiles .tile').forEach(function(t){var e=t.querySelector('.n'),v=(window.WM_COUNTS?WM_COUNTS():window.__n)[t.dataset.s];if(e&&v!=null&&e.textContent!=String(v))e.textContent=v});lock=false}
var T=document.getElementById('tiles');if(T)new MutationObserver(tiles).observe(T,{subtree:true,childList:true,characterData:true});
var A=window.applyS;
/* wmgo-one-pass (default OFF; localStorage wm-1pass=1 turns it on). On main.html the previous applyS is the one-line stub
   "return WMF.pass()", so pass -> stub(pass) -> pass ran the same WMCore pass three times. With the flag on, the stub's pass
   is the only pass. Any other previous applyS keeps the full pass / prev / pass sandwich (wm-final stays the last writer). */
var STUB=!!A&&/^function\s*\(\)\s*\{\s*return window\.WMF\s*\?\s*WMF\.pass\(\)\s*:\s*\{go:0,caution:0,nogo:0\}\s*\}$/.test(String(A));
/* Back to default OFF on 29 Oct per review: this is the GO/NO-GO engine, so it stays opt-in (wm-1pass=1) for a week of dogfooding.
   Without the flag the old 3-pass sandwich runs exactly as before. */
/* perf 11 Nov 2026 (MT ok, DEEP-DIAG fix 1): default ON after two weeks of dogfooding. The stub's pass is the same WMCore pass,
   so the result is identical (640-card DOM snapshot: 0 differences). localStorage wm-1pass=0 brings the 3-pass sandwich back. */
function one(){try{return localStorage.getItem('wm-1pass')!=='0'}catch(e){return true}}
function applyRun(){var r;if(STUB&&one()){try{r=A.apply(this,arguments)}catch(e){console.log('wmf-prev',e);r=pass()}return r}
 pass();try{r=A&&A.apply(this,arguments)}catch(e){console.log('wmf-prev',e)}pass();return r}
window.__wmOnePass={stub:STUB,on:one};
/* perf 11 Nov 2026 (DEEP-DIAG fix 1): coalesce. Up to 6 callers (wst:data, model copy, live official data, pull retries,
   ad-class, timers) used to run the full pass back to back. The first call runs at once, exactly as before; calls within the
   next 250 ms are folded into ONE trailing run, so the last data always wins. A folded call returns the latest counts.
   localStorage wm-coalesce=0 turns it off. */
var CO=(function(){try{return localStorage.getItem('wm-coalesce')!=='0'}catch(e){return true}})(),coT=0,coLast=-1e9;
function nowMs(){return window.performance&&performance.now?performance.now():Date.now()}
window.applyS=function(){if(!CO)return timed('wm:applyS',applyRun,this,arguments);var t=nowMs();
 if(t-coLast<250){if(!coT)coT=setTimeout(function(){coT=0;coLast=nowMs();timed('wm:applyS',applyRun,null,[])},Math.max(0,250-(t-coLast)));return window.__n||{go:0,caution:0,nogo:0}}
 if(coT){clearTimeout(coT);coT=0}coLast=t;return timed('wm:applyS',applyRun,this,arguments)};
if(document.readyState!=='loading')setTimeout(window.applyS,0);else document.addEventListener('DOMContentLoaded',function(){window.applyS()});
})();
