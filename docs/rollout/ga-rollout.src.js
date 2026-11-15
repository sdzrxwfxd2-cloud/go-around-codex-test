/* Readable source of site/ga-rollout.js (Rollout loader, Designer, 12 Nov 2026).
   Build: npx esbuild docs/rollout/ga-rollout.src.js --minify --target=es2017, prepend the one-line header, then node tools/vbump.mjs. */
/* Rollout loader (Designer, 12 Nov 2026). Last thing in the page so it never delays the header, the shell or the cards.
   Component: go-around-design PR #8 (feat/reload-rollout @8fb0f3a) components/reload-rollout/ga-reload.css + ga-reload.js, inlined.
   Deferred to after the first paint (rAF + task), so it can never hold up the header, the shell or the cards. */
/* Go Around reload: "Rollout". Designer, 12 Nov 2026 (audit fixes same day).
   GAReload.mount(el, {size:'page'|'icon', theme:'auto'|'midnight'|'amethyst'|'pearl'|'champagne', label, labels:true|false})
     optional: cover (element to lift when content is ready), dock (element whose box the runway flies into)
     returns { start(label), ready(), verdict({status,label}), done({status,label}), reset(), setTheme(name), unmount(), el }
     ready()   -> lifts the cover at once (content loaded); the runway docks or fades. Promise: lift settled.
     verdict() -> colour + shape verdict, any time before or after ready(). Promise: verdict settled.
     done()    -> old behaviour: verdict, then lift the cover if one was given. Promise: all settled.
   theme 'auto' (default) follows the live site: html[data-theme=night|day][data-pal=black|purple|white|beige].
   done() lets the centreline finish its current stripe (no jump), then the
   threshold marking cross-fades to the verdict. Colour AND shape both carry it:
     go   = all threshold bars + aiming-point (touchdown) markings, which loading never shows
     cau  = only every second bar lit
     nogo = bars give way to a crossed (X) closed-runway marking
   Icon size returns to ink after 1.2s so the button rests.
   start() restarts cleanly from any state (loading, done, mid-settle, reset).
   labels:false hides the status line (the live region still updates for AT).
   Only transform and opacity animate. Reduced motion: instant swaps. No timers, no listeners. */
(function(){
  var EASE='cubic-bezier(.32,.72,0,1)';
  var STATUS={go:1,cau:1,nogo:1};
  var THEMES={pearl:1,midnight:1,amethyst:1,champagne:1};
  var TCLS=Object.keys(THEMES).map(function(t){return 'gar--'+t});
  var RM=window.matchMedia?matchMedia('(prefers-reduced-motion: reduce)'):{matches:false};
  function bars(n,cls){var s='<span class="gar-th '+cls+'" aria-hidden="true">';for(var i=0;i<n;i++)s+='<i></i>';return s+'</span>'}
  function zulu(){var d=new Date();return String(d.getUTCHours()).padStart(2,'0')+':'+String(d.getUTCMinutes()).padStart(2,'0')+'Z'}
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function applyTheme(el,name){
    TCLS.forEach(function(c){el.classList.remove(c)});
    if(name&&THEMES[name])el.classList.add('gar--'+name);      /* 'auto' or empty: follow html[data-theme][data-pal] */
  }

  function mount(el,o){
    o=o||{};var icon=o.size==='icon',n=icon?3:6,dead=false,run=0;
    var ADDED=['gar','gar--icon','gar--nolabel','is-loading','is-done','is-ready'].concat(TCLS);
    el.classList.add('gar');if(icon)el.classList.add('gar--icon');
    if(o.labels===false)el.classList.add('gar--nolabel');
    applyTheme(el,o.theme);
    el.setAttribute('role','status');el.setAttribute('aria-live','polite');
    el.innerHTML='<span class="gar-rw">'+bars(n,'gar-th--ink')+
      '<span class="gar-st" aria-hidden="true">'+bars(n,'gar-th--go')+'<span class="gar-aim"><i></i><i></i></span><span class="gar-x"><i></i><i></i></span></span>'+
      '<span class="gar-cl"><span class="gar-strip"></span></span></span>'+
      '<span class="gar-lb"><span class="gar-lb1"></span><span class="gar-lb2"></span></span>';
    var st=el.querySelector('.gar-st'),ink=el.querySelector('.gar-th--ink'),x=el.querySelector('.gar-x'),strip=el.querySelector('.gar-strip'),
        l1=el.querySelector('.gar-lb1'),l2=el.querySelector('.gar-lb2'),aim=el.querySelector('.gar-aim'),vlive=[],llive=[];
    function clearVerdict(){vlive.forEach(function(a){try{a.cancel()}catch(e){}});vlive=[]}
    function clear(){clearVerdict();unlift()}
    function stopRoll(){strip.getAnimations&&strip.getAnimations().forEach(function(a){try{a.cancel()}catch(e){}})}
    function rest(){[st,ink,l1,l2,x].forEach(function(nd){nd.style.opacity=''});x.style.transform=''}
    /* one animation per node per phase: keyframes [{v,at}] over dur, so no later fade can override an earlier one */
    function tween(node,frames,dur,delay){
      var end=frames[frames.length-1].v;node.style.opacity=end;
      if(RM.matches)return;
      var kf=frames.map(function(f){return{opacity:f.v,offset:f.at,easing:EASE}});
      vlive.push(node.animate(kf,{duration:dur,delay:delay||0,fill:'both'}));
    }
    var cover=o.cover||null,dock=o.dock||null,lifted=false,flight=null;
    function settled(anims,val){                     /* Promise that resolves (never rejects) when anims finish or are cancelled */
      return Promise.all(anims.map(function(a){return a.finished.catch(function(){})})).then(function(){return val})}
    function settle(r){
      if(dead)return{p:Promise.resolve(null),ms:0};
      r=r||{};var s=STATUS[r.status]?r.status:'go',me=run;
      el.style.setProperty('--gar-c','var(--gar-'+s+')');el.setAttribute('data-gar-s',s);
      var wait=0,roll=strip.getAnimations?strip.getAnimations()[0]:null;
      if(roll&&!RM.matches&&el.classList.contains('is-loading')){
        var step=roll.effect.getTiming().duration,ct=roll.currentTime||0;
        var k=Math.max(1,Math.ceil((ct+1)/step));wait=k*step-ct;              /* finish this stripe */
        roll.effect.updateTiming({iterations:k,fill:'none'});
        roll.finished.then(function(){if(run===me)el.classList.remove('is-loading')},function(){});
      }else el.classList.remove('is-loading');
      clearVerdict();
      var label=r.label?esc(r.label):(s==='nogo'?'No update · tap to retry':(s==='cau'?'Cached · <b>'+zulu()+'</b>':'Updated <b>'+zulu()+'</b>'));
      l2.innerHTML=label;var ms=wait+340;
      if(!icon){
        tween(st,[{v:0,at:0},{v:1,at:1}],320,wait);tween(ink,[{v:1,at:0},{v:0,at:1}],320,wait);
        tween(l1,[{v:1,at:0},{v:0,at:1}],180,wait);tween(l2,[{v:0,at:0},{v:1,at:1}],260,wait+80);
      }else{                                            /* in 320ms, hold, back to ink over 600ms: one animation each */
        var T=1800,a=320/T,b=1200/T;ms=wait+T;
        tween(st,[{v:0,at:0},{v:1,at:a},{v:1,at:b},{v:0,at:1}],T,wait);
        tween(ink,[{v:1,at:0},{v:0,at:a},{v:0,at:b},{v:1,at:1}],T,wait);
      }
      if(icon&&RM.matches){st.style.opacity=1;ink.style.opacity=0}   /* no timers: verdict stays until the next start()/reset() */
      if(s==='nogo'&&!RM.matches){vlive.push(x.animate([{transform:'scale(.86)'},{transform:'none'}],{duration:420,delay:wait,easing:EASE,fill:'both'}));ms=Math.max(ms,wait+420)}
      if(s==='go'&&!RM.matches)vlive.push(aim.animate([{transform:'scaleX(.4)'},{transform:'none'}],{duration:380,delay:wait,easing:EASE,fill:'both'}));
      el.classList.add('is-done');el.setAttribute('aria-busy','false');
      if(RM.matches)ms=0;
      return{p:settled(vlive.slice(),{status:s}).then(function(v){return run===me?v:{status:s,interrupted:true}}),ms:ms};
    }
    /* Lift. Never lets the big runway sit over the page content (audit v3):
       - the runway first fades out where it is (FADE ms) while the cover is still fully opaque,
       - only then the cover fades (280ms), so content is never under a visible runway,
       - with a dock, the runway re-appears already in the dock (it jumps there while invisible,
         so there is no flight path across the content), then fades in there.
       Interrupted by start()/reset()/unmount(): the Promise resolves {interrupted:true}. */
    var FADE=120,lid=0;
    function lift(delay){
      if(dead)return Promise.resolve(null);
      if(lifted)return flight||Promise.resolve(true);
      lifted=true;el.classList.add('is-ready');var anims=[],me=++lid,d0=delay||0;
      if(cover){cover.setAttribute('aria-hidden','true');cover.style.pointerEvents='none';cover.style.opacity=0;
        if(!RM.matches)anims.push(cover.animate([{opacity:1},{opacity:0}],{duration:280,delay:d0+FADE,easing:EASE,fill:'both'}))}
      if(dock){
        var A=el.getBoundingClientRect(),B=dock.getBoundingClientRect(),k=B.width/A.width,
            tx=(B.left+B.width/2)-(A.left+A.width/2),ty=(B.top+B.height/2)-(A.top+A.height/2),
            to='translate('+tx+'px,'+ty+'px) scale('+k+')',near='translate('+tx+'px,'+ty+'px) scale('+(k*.86)+')';
        el.style.transform=to;
        if(!RM.matches){var T=460,a=FADE/T;
          anims.push(el.animate([{transform:'none',opacity:1,offset:0,easing:EASE},{transform:'scale(.94)',opacity:0,offset:a,easing:'step-end'},
            {transform:near,opacity:0,offset:a+.001,easing:EASE},{transform:to,opacity:1,offset:1}],{duration:T,delay:d0,easing:'linear',fill:'both'}))}
      }else if(cover){el.style.opacity=0;
        if(!RM.matches)anims.push(el.animate([{opacity:1},{opacity:0}],{duration:FADE,delay:d0,easing:EASE,fill:'both'}))}
      llive=anims;flight=settled(anims,true).then(function(v){return(me===lid&&lifted&&!dead)?v:{interrupted:true}});return flight;
    }
    function unlift(){lid++;llive.forEach(function(a){try{a.cancel()}catch(e){}});llive=[];lifted=false;flight=null;
      el.classList.remove('is-ready');el.style.transform='';el.style.opacity='';
      if(cover){cover.style.opacity='';cover.style.pointerEvents='';cover.removeAttribute('aria-hidden')}}
    var api={el:el,
      setTheme:function(name){if(!dead)applyTheme(el,name);return api},
      start:function(label){
        if(dead)return api;run++;
        clear();stopRoll();rest();el.removeAttribute('data-gar-s');
        el.classList.remove('is-loading','is-done');
        l1.textContent=label||o.label||'Refreshing';
        void el.offsetWidth;                             /* restart the CSS roll from stripe 0 */
        el.classList.add('is-loading');el.setAttribute('aria-busy','true');return api},
      /* Content is on screen: lift the cover now, never wait for the verdict.
         With o.dock the runway flies (transform only) into that spot and keeps rolling there;
         without a dock it fades out with the cover. Resolves when the lift has settled. */
      ready:function(){return lift(0)},
      /* The colour/shape verdict, independent of ready(). Resolves when it has settled. */
      verdict:function(r){return settle(r).p},
      /* Backward compatible: verdict first, then (only if a cover was given and ready() wasn't
         called) lift the cover once the verdict has settled. Resolves when everything has settled. */
      done:function(r){
        var v=settle(r);
        if(!cover||lifted||dead)return v.p;
        return Promise.all([v.p,lift(v.ms)]).then(function(x){return x[0]})},
      reset:function(){if(dead)return api;run++;clear();stopRoll();rest();el.removeAttribute('data-gar-s');
        el.classList.remove('is-loading','is-done');el.setAttribute('aria-busy','false');return api},
      unmount:function(){if(dead)return;api.reset();dead=true;el.innerHTML='';
        ADDED.forEach(function(c){el.classList.remove(c)});
        ['role','aria-live','aria-busy','data-gar-s'].forEach(function(a){el.removeAttribute(a)});
        el.style.removeProperty('--gar-c')}};
    l1.textContent=o.label||'Refreshing';
    return api;
  }
  window.GAReload={mount:mount,themes:Object.keys(THEMES)};
})();
(function(){function go(){var st=document.createElement("style");st.id="ga-rollout-css";st.textContent="/* Go Around reload: \"Rollout\"\n   Designer, 12 Nov 2026.\n   A small runway: threshold bars on the left, centreline dashes rolling past.\n   When the data lands, the dashes stop on a whole stripe and the threshold\n   bars turn GO green (CAUTION orange for cached data, NO-GO red for a failure).\n   Animates transform and opacity only. Reduced motion: nothing moves, the\n   label and the bar colour still change. No logo, no spinner.\n\n   Four live site themes, tokens from DESIGN.md \u00a76.1 (Theme 1\u20134):\n   midnight, amethyst, pearl (day white), champagne (day beige). */\n\n.gar{\n  --gar-ease:cubic-bezier(.32,.72,0,1);\n  --gar-step:640ms;              /* one stripe per step */\n  --gar-pitch:32px;              /* dash 18 + gap 14 */\n  /* Theme 3 Pearl (default). Day themes use deeper status tints so the\n     threshold marking clears 3:1 on the runway surface (WCAG 1.4.11). */\n  --gar-ink:#111114;\n  --gar-ink2:rgba(17,17,20,.62);\n  --gar-surface:rgba(17,17,20,.035);\n  --gar-line:rgba(0,0,0,.07);\n  --gar-hl:rgba(255,255,255,.95);\n  --gar-go:#15803D;--gar-cau:#B45309;--gar-nogo:#D10D33;\n  display:inline-flex;flex-direction:column;align-items:center;gap:14px;\n  color:var(--gar-ink);\n}\n/* Live site theme system (site/index.html): html[data-theme=night|day][data-pal=black|purple|white|beige].\n   :where() keeps these at the same weight as the explicit .gar--<theme> classes below, which win when set.\n   html[data-theme=<name>] (midnight|amethyst|pearl|champagne) stays as a fallback for demos. */\n:where(html[data-theme=night]) .gar,:where(html[data-theme=night][data-pal=black]) .gar,:where([data-theme=midnight]) .gar{\n  --gar-ink:#F5F5F7;--gar-ink2:rgba(245,245,247,.62);--gar-surface:rgba(255,255,255,.04);--gar-line:rgba(255,255,255,.10);--gar-hl:rgba(255,255,255,.16);\n  --gar-go:#22C55E;--gar-cau:#FF8A00;--gar-nogo:#F80F3B}\n:where(html[data-theme=night][data-pal=purple]) .gar,:where([data-theme=amethyst]) .gar{\n  --gar-ink:#F7F4FF;--gar-ink2:rgba(236,228,255,.64);--gar-surface:rgba(200,170,255,.07);--gar-line:rgba(210,190,255,.13);--gar-hl:rgba(230,215,255,.20);\n  --gar-go:#22C55E;--gar-cau:#FF8A00;--gar-nogo:#F80F3B}\n:where(html[data-theme=day]) .gar,:where(html[data-theme=day][data-pal=white]) .gar,:where([data-theme=pearl]) .gar{\n  --gar-ink:#111114;--gar-ink2:rgba(17,17,20,.62);--gar-surface:rgba(17,17,20,.035);--gar-line:rgba(0,0,0,.07);--gar-hl:rgba(255,255,255,.95);\n  --gar-go:#15803D;--gar-cau:#B45309;--gar-nogo:#D10D33}\n:where(html[data-theme=day][data-pal=beige]) .gar,:where([data-theme=champagne]) .gar{\n  --gar-ink:#1C1814;--gar-ink2:rgba(28,24,20,.62);--gar-surface:rgba(60,40,10,.05);--gar-line:rgba(60,40,10,.08);--gar-hl:rgba(255,253,248,.95);\n  --gar-go:#15803D;--gar-cau:#B45309;--gar-nogo:#D10D33}\n/* Explicit theme classes (mount option / setTheme) */\n.gar.gar--midnight{--gar-ink:#F5F5F7;--gar-ink2:rgba(245,245,247,.62);--gar-surface:rgba(255,255,255,.04);--gar-line:rgba(255,255,255,.10);--gar-hl:rgba(255,255,255,.16);\n  --gar-go:#22C55E;--gar-cau:#FF8A00;--gar-nogo:#F80F3B}\n.gar.gar--amethyst{--gar-ink:#F7F4FF;--gar-ink2:rgba(236,228,255,.64);--gar-surface:rgba(200,170,255,.07);--gar-line:rgba(210,190,255,.13);--gar-hl:rgba(230,215,255,.20);\n  --gar-go:#22C55E;--gar-cau:#FF8A00;--gar-nogo:#F80F3B}\n.gar.gar--pearl{--gar-ink:#111114;--gar-ink2:rgba(17,17,20,.62);--gar-surface:rgba(17,17,20,.035);--gar-line:rgba(0,0,0,.07);--gar-hl:rgba(255,255,255,.95);\n  --gar-go:#15803D;--gar-cau:#B45309;--gar-nogo:#D10D33}\n.gar.gar--champagne{--gar-ink:#1C1814;--gar-ink2:rgba(28,24,20,.62);--gar-surface:rgba(60,40,10,.05);--gar-line:rgba(60,40,10,.08);--gar-hl:rgba(255,253,248,.95);\n  --gar-go:#15803D;--gar-cau:#B45309;--gar-nogo:#D10D33}\n\n/* runway */\n.gar-rw{\n  position:relative;width:240px;height:52px;border-radius:14px;overflow:hidden;\n  background:var(--gar-surface);\n  box-shadow:inset 0 0 0 1px var(--gar-line),inset 0 1px 0 var(--gar-hl);\n  contain:paint;\n}\n/* runway end: a short bar so the runway has a visible end */\n.gar-rw::after{content:\"\";position:absolute;right:14px;top:14px;bottom:14px;width:2px;border-radius:1px;background:var(--gar-ink);opacity:.32}\n.gar--icon .gar-rw::after{display:none}\n/* threshold bars (\"piano keys\"); two stacked copies, colour layer fades over */\n.gar-th{position:absolute;left:14px;top:12px;bottom:12px;display:flex;gap:3px}\n.gar-th i{display:block;width:3px;border-radius:1.5px;background:var(--gar-ink);opacity:.78}\n.gar-st{position:absolute;inset:0;opacity:0}\n.gar-st .gar-th i{background:var(--gar-c,var(--gar-go));opacity:1}\n/* verdict by shape as well as colour (colour-blind safe, no text) */\n.gar[data-gar-s=cau] .gar-st .gar-th i:nth-child(even){opacity:.2}   /* CAUTION: only every second bar lit */\n.gar[data-gar-s=nogo] .gar-st .gar-th{display:none}                             /* NO-GO: threshold closed ... */\n.gar-aim{display:none}                                                         /* GO: aiming-point (touchdown) markings, never shown while loading */\n.gar[data-gar-s=go] .gar-aim{display:block;position:absolute;left:84px;top:13px;bottom:13px;width:30px;transform-origin:0 50%}\n.gar-aim i{position:absolute;left:0;right:0;height:5px;border-radius:1.5px;background:var(--gar-c,var(--gar-go))}\n.gar-aim i:first-child{top:0}\n.gar-aim i:last-child{bottom:0}\n.gar-x{position:absolute;left:14px;top:12px;width:33px;height:28px;display:none}\n.gar[data-gar-s=nogo] .gar-x{display:block}                                      /* ... crossed (X) closed-runway marking */\n.gar-x i{position:absolute;left:50%;top:50%;width:3px;height:36px;margin:-18px 0 0 -1.5px;border-radius:1.5px;background:var(--gar-c,var(--gar-nogo))}\n.gar-x i:first-child{transform:rotate(40deg)}\n.gar-x i:last-child{transform:rotate(-40deg)}\n/* centreline */\n.gar-cl{\n  position:absolute;left:52px;right:22px;top:50%;height:3px;margin-top:-1.5px;overflow:hidden;\n  -webkit-mask-image:linear-gradient(90deg,transparent 0,#000 18px,#000 calc(100% - 52px),transparent);\n          mask-image:linear-gradient(90deg,transparent 0,#000 18px,#000 calc(100% - 52px),transparent);\n}\n.gar-strip{\n  position:absolute;left:0;top:0;height:3px;width:calc(100% + var(--gar-pitch) * 2);\n  background:repeating-linear-gradient(90deg,var(--gar-ink) 0 18px,transparent 18px var(--gar-pitch));\n  opacity:.55;border-radius:1.5px;\n}\n.gar.is-loading .gar-strip{animation:gar-roll var(--gar-step) var(--gar-ease) infinite;will-change:transform}\n@keyframes gar-roll{from{transform:translateX(0)}to{transform:translateX(calc(var(--gar-pitch) * -1))}}\n\n/* label: two layers cross-fade so the text never slides */\n.gar-lb{position:relative;height:14px;min-width:200px;text-align:center;\n  font:500 11px/14px \"JetBrains Mono\",ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;\n  font-variant-numeric:tabular-nums;color:var(--gar-ink2)}\n.gar-lb span{position:absolute;inset:0;white-space:nowrap}\n.gar-lb .gar-lb2{opacity:0}\n.gar-lb .gar-lb2 b{font-weight:500;color:var(--gar-c,var(--gar-go))}\n.gar--nolabel{gap:0}\n.gar--nolabel .gar-lb{display:none}\n\n/* icon size: the refresh button glyph is the same runway, 22x14 */\n.gar--icon{gap:0}\n.gar--icon .gar-rw{width:24px;height:14px;border-radius:4px;box-shadow:inset 0 0 0 1.25px var(--gar-ink);background:none;opacity:.9}\n.gar--icon .gar-th{left:3.5px;top:3.5px;bottom:3.5px;gap:1.5px}\n.gar--icon .gar-th i{width:1.5px;border-radius:.75px;opacity:1}\n.gar[data-gar-s=go].gar--icon .gar-aim{left:13px;top:2.6px;bottom:2.6px;width:6px}\n.gar--icon .gar-aim i{height:1.5px;border-radius:.5px}\n.gar--icon .gar-x{left:3px;top:3px;width:7.5px;height:8px}\n.gar--icon .gar-x i{width:1.5px;height:9px;margin:-4.5px 0 0 -.75px;border-radius:.75px}\n.gar--icon .gar-cl{left:12.5px;right:2.5px;height:1.5px;margin-top:-.75px;\n  -webkit-mask-image:linear-gradient(90deg,transparent,#000 2px,#000 calc(100% - 4px),transparent);mask-image:linear-gradient(90deg,transparent,#000 2px,#000 calc(100% - 4px),transparent)}\n.gar--icon{--gar-pitch:7px}\n.gar--icon .gar-strip{height:1.5px;opacity:1;\n  background:repeating-linear-gradient(90deg,var(--gar-ink) 0 4px,transparent 4px var(--gar-pitch))}\n.gar--icon .gar-lb{display:none}\n\n@media (prefers-reduced-motion:reduce){\n  .gar.is-loading .gar-strip{animation:none}\n}\n/* Rollout in the header (Designer, 12 Nov 2026, v2): no cover, nothing over the page. The runway lives in an empty header gap\n   from the header's first paint, rolls while the page loads, shows the verdict, then fades. Transform + opacity only. */\n#ga-ro{position:absolute;left:0;top:0;width:240px;transform-origin:0 0;pointer-events:none;z-index:1}\n@media (max-width:699px){\n  #ga-ro,.gar{display:none!important}\n}";document.head.appendChild(st);
/* Rollout boot v2 (Designer, 12 Nov 2026; phone-hide 13 Nov). Runs once, just after the first paint; never on nav-bar tab switches.
   Never delays or covers anything: there is no cover. The runway sits in an empty part of the header:
     iPad / desktop (>=700px): the middle of the header (Home and aerodrome pages).
     Phones (<700px): hidden on Home and aerodrome pages (JS skip + CSS @media (max-width:699px) backup).
   verdict() Home: weather data status from .wupd ("Updated" GO, Snapshot/cached CAUTION, nothing in 20 s NO-GO).
             Aerodrome: that aerodrome's .verd[data-s] once "Updated"/"Snapshot" is in and it has held 600 ms.
   Reads the page frames' DOM only. Theme: auto from html[data-theme][data-pal]. */
(function(){
  var D=document,hd=D.querySelector('header.topbar'),lg=hd&&hd.querySelector('.logo');
  if(!hd||!lg||!window.GAReload)return;
  var p=location.pathname,h=location.hash.replace(/^#/,'').split('?')[0],q=new URLSearchParams(location.search).get('tab');
  var adPath=/^\/(c\/)?ad\//.test(p)||/^ad\b/.test(h)||/^\/fact(\.html)?$/.test(p);
  var home=!adPath&&(p==='/'||/^\/(index|main)(\.html)?$/.test(p))&&(!h||h==='aero'||h==='status')&&(!q||q==='aero'||q==='status');
  var wide=innerWidth>=700;
  if(!wide||!(home||adPath))return;                        /* phones <700px, and other pages: nothing */
  var w=wide?56:40,k=w/240,l=wide?'calc(50% - '+w/2+'px)':(lg.offsetLeft+lg.offsetWidth+12)+'px';
  var el=D.createElement('span'),rw=D.createElement('span');el.id='ga-ro';el.setAttribute('aria-hidden','true');   /* el = scaled slot, rw = component */
  el.style.cssText='left:'+l+';top:'+(hd.clientHeight-52*k)/2+'px;transform:scale('+k+')';
  el.appendChild(rw);hd.appendChild(el);
  var ld=GAReload.mount(rw,{labels:false});ld.start();
  var mine=function(){var x=location.pathname;return home?(x==='/'||/^\/(index|main)(\.html)?$/.test(x)||/^\/(aero|status)?$/.test(x)):/^\/(c\/)?ad\/|^\/fact/.test(x)},t0=Date.now(),gone=false,done=false,cand=null,candT=0,hold=null,iv;
  function finish(){
    if(gone)return;gone=true;clearInterval(iv);clearTimeout(hold);
    var rm=function(){try{ld.unmount()}catch(x){}el.parentNode&&el.parentNode.removeChild(el)};
    var RM=false;try{RM=matchMedia('(prefers-reduced-motion: reduce)').matches}catch(x){}
    if(RM||!el.animate)return rm();
    el.animate([{opacity:1},{opacity:0}],{duration:280,easing:'cubic-bezier(.32,.72,0,1)',fill:'forwards'}).finished.then(rm,rm);
  }
  function verdict(s){if(done)return;done=true;Promise.resolve(ld.verdict({status:s})).then(function(){hold=setTimeout(finish,1600)})}
  function doc(id){try{var f=D.getElementById(id);return f&&f.contentDocument}catch(x){return null}}
  iv=setInterval(function(){
    var e=Date.now()-t0;
    if(e>30000||!mine())return finish();   /* left the page via the nav bar (pushState) */
    if(done)return;
    if(home){
      var d=doc('wmF-aero'),u=d?((d.querySelector('.wupd')||{}).textContent||'').trim():'';
      if(/^Updated\b/i.test(u))verdict('go');else if(/Snapshot|Cached|unavailable/i.test(u))verdict('cau');
    }else{
      var a=doc('wmF-ad'),v=a&&a.querySelector('.verd[data-s]');
      if(v&&/Updated \d|Snapshot/.test(v.textContent)){var s=v.getAttribute('data-s'),c=s==='go'?'go':(s==='nogo'?'nogo':'cau');
        if(c!==cand){cand=c;candT=e}else if(e-candT>=600)verdict(c)}
    }
    if(e>20000)verdict('nogo');
  },200);   /* 5 cheap reads a second; never touches layout */
  addEventListener('pageshow',function(ev){if(ev.persisted)finish()});
  addEventListener('hashchange',function(){var x=location.hash.replace(/^#/,'').split('?')[0];if(home&&x&&x!=='aero'&&x!=='status')finish()});
  addEventListener('popstate',function(){if(!mine())finish()});
})();
}if(window.requestAnimationFrame)requestAnimationFrame(function(){setTimeout(go,0)});else setTimeout(go,0)})();
