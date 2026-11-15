/* Rollout loader (Designer, 12 Nov 2026, v5). Minified from docs/rollout/ga-rollout.src.js. Loaded by index.html after the first paint, never parser-blocking. No cover: the runway sits in an empty header gap and only animates transform/opacity. */
(function(){var h="cubic-bezier(.32,.72,0,1)",U={go:1,cau:1,nogo:1},v={pearl:1,midnight:1,amethyst:1,champagne:1},x=Object.keys(v).map(function(a){return"gar--"+a}),g=window.matchMedia?matchMedia("(prefers-reduced-motion: reduce)"):{matches:!1};function E(a,n){for(var c='<span class="gar-th '+n+'" aria-hidden="true">',L=0;L<a;L++)c+="<i></i>";return c+"</span>"}function C(){var a=new Date;return String(a.getUTCHours()).padStart(2,"0")+":"+String(a.getUTCMinutes()).padStart(2,"0")+"Z"}function z(a){return String(a).replace(/[&<>"]/g,function(n){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[n]})}function H(a,n){x.forEach(function(c){a.classList.remove(c)}),n&&v[n]&&a.classList.add("gar--"+n)}function N(a,n){n=n||{};var c=n.size==="icon",L=c?3:6,i=!1,y=0,I=["gar","gar--icon","gar--nolabel","is-loading","is-done","is-ready"].concat(x);a.classList.add("gar"),c&&a.classList.add("gar--icon"),n.labels===!1&&a.classList.add("gar--nolabel"),H(a,n.theme),a.setAttribute("role","status"),a.setAttribute("aria-live","polite"),a.innerHTML='<span class="gar-rw">'+E(L,"gar-th--ink")+'<span class="gar-st" aria-hidden="true">'+E(L,"gar-th--go")+'<span class="gar-aim"><i></i><i></i></span><span class="gar-x"><i></i><i></i></span></span><span class="gar-cl"><span class="gar-strip"></span></span></span><span class="gar-lb"><span class="gar-lb1"></span><span class="gar-lb2"></span></span>';var S=a.querySelector(".gar-st"),P=a.querySelector(".gar-th--ink"),G=a.querySelector(".gar-x"),w=a.querySelector(".gar-strip"),T=a.querySelector(".gar-lb1"),O=a.querySelector(".gar-lb2"),J=a.querySelector(".gar-aim"),m=[],b=[];function q(){m.forEach(function(t){try{t.cancel()}catch(e){}}),m=[]}function W(){q(),ta()}function r(){w.getAnimations&&w.getAnimations().forEach(function(t){try{t.cancel()}catch(e){}})}function d(){[S,P,T,O,G].forEach(function(t){t.style.opacity=""}),G.style.transform=""}function p(t,e,u,o){var l=e[e.length-1].v;if(t.style.opacity=l,!g.matches){var f=e.map(function(A){return{opacity:A.v,offset:A.at,easing:h}});m.push(t.animate(f,{duration:u,delay:o||0,fill:"both"}))}}var s=n.cover||null,B=n.dock||null,k=!1,F=null;function Y(t,e){return Promise.all(t.map(function(u){return u.finished.catch(function(){})})).then(function(){return e})}function _(t){if(i)return{p:Promise.resolve(null),ms:0};t=t||{};var e=U[t.status]?t.status:"go",u=y;a.style.setProperty("--gar-c","var(--gar-"+e+")"),a.setAttribute("data-gar-s",e);var o=0,l=w.getAnimations?w.getAnimations()[0]:null;if(l&&!g.matches&&a.classList.contains("is-loading")){var f=l.effect.getTiming().duration,A=l.currentTime||0,X=Math.max(1,Math.ceil((A+1)/f));o=X*f-A,l.effect.updateTiming({iterations:X,fill:"none"}),l.finished.then(function(){y===u&&a.classList.remove("is-loading")},function(){})}else a.classList.remove("is-loading");q();var V=t.label?z(t.label):e==="nogo"?"No update \xB7 tap to retry":e==="cau"?"Cached \xB7 <b>"+C()+"</b>":"Updated <b>"+C()+"</b>";O.innerHTML=V;var D=o+340;if(!c)p(S,[{v:0,at:0},{v:1,at:1}],320,o),p(P,[{v:1,at:0},{v:0,at:1}],320,o),p(T,[{v:1,at:0},{v:0,at:1}],180,o),p(O,[{v:0,at:0},{v:1,at:1}],260,o+80);else{var R=1800,$=320/R,j=1200/R;D=o+R,p(S,[{v:0,at:0},{v:1,at:$},{v:1,at:j},{v:0,at:1}],R,o),p(P,[{v:1,at:0},{v:0,at:$},{v:0,at:j},{v:1,at:1}],R,o)}return c&&g.matches&&(S.style.opacity=1,P.style.opacity=0),e==="nogo"&&!g.matches&&(m.push(G.animate([{transform:"scale(.86)"},{transform:"none"}],{duration:420,delay:o,easing:h,fill:"both"})),D=Math.max(D,o+420)),e==="go"&&!g.matches&&m.push(J.animate([{transform:"scaleX(.4)"},{transform:"none"}],{duration:380,delay:o,easing:h,fill:"both"})),a.classList.add("is-done"),a.setAttribute("aria-busy","false"),g.matches&&(D=0),{p:Y(m.slice(),{status:e}).then(function(Q){return y===u?Q:{status:e,interrupted:!0}}),ms:D}}var Z=120,K=0;function aa(t){if(i)return Promise.resolve(null);if(k)return F||Promise.resolve(!0);k=!0,a.classList.add("is-ready");var e=[],u=++K,o=t||0;if(s&&(s.setAttribute("aria-hidden","true"),s.style.pointerEvents="none",s.style.opacity=0,g.matches||e.push(s.animate([{opacity:1},{opacity:0}],{duration:280,delay:o+Z,easing:h,fill:"both"}))),B){var l=a.getBoundingClientRect(),f=B.getBoundingClientRect(),A=f.width/l.width,X=f.left+f.width/2-(l.left+l.width/2),V=f.top+f.height/2-(l.top+l.height/2),D="translate("+X+"px,"+V+"px) scale("+A+")",R="translate("+X+"px,"+V+"px) scale("+A*.86+")";if(a.style.transform=D,!g.matches){var $=460,j=Z/$;e.push(a.animate([{transform:"none",opacity:1,offset:0,easing:h},{transform:"scale(.94)",opacity:0,offset:j,easing:"step-end"},{transform:R,opacity:0,offset:j+.001,easing:h},{transform:D,opacity:1,offset:1}],{duration:$,delay:o,easing:"linear",fill:"both"}))}}else s&&(a.style.opacity=0,g.matches||e.push(a.animate([{opacity:1},{opacity:0}],{duration:Z,delay:o,easing:h,fill:"both"})));return b=e,F=Y(e,!0).then(function(Q){return u===K&&k&&!i?Q:{interrupted:!0}}),F}function ta(){K++,b.forEach(function(t){try{t.cancel()}catch(e){}}),b=[],k=!1,F=null,a.classList.remove("is-ready"),a.style.transform="",a.style.opacity="",s&&(s.style.opacity="",s.style.pointerEvents="",s.removeAttribute("aria-hidden"))}var M={el:a,setTheme:function(t){return i||H(a,t),M},start:function(t){return i||(y++,W(),r(),d(),a.removeAttribute("data-gar-s"),a.classList.remove("is-loading","is-done"),T.textContent=t||n.label||"Refreshing",a.offsetWidth,a.classList.add("is-loading"),a.setAttribute("aria-busy","true")),M},ready:function(){return aa(0)},verdict:function(t){return _(t).p},done:function(t){var e=_(t);return!s||k||i?e.p:Promise.all([e.p,aa(e.ms)]).then(function(u){return u[0]})},reset:function(){return i||(y++,W(),r(),d(),a.removeAttribute("data-gar-s"),a.classList.remove("is-loading","is-done"),a.setAttribute("aria-busy","false")),M},unmount:function(){i||(M.reset(),i=!0,a.innerHTML="",I.forEach(function(t){a.classList.remove(t)}),["role","aria-live","aria-busy","data-gar-s"].forEach(function(t){a.removeAttribute(t)}),a.style.removeProperty("--gar-c"))}};return T.textContent=n.label||"Refreshing",M}window.GAReload={mount:N,themes:Object.keys(v)}})(),(function(){function h(){var U=document.createElement("style");U.id="ga-rollout-css",U.textContent=`/* Go Around reload: "Rollout"
   Designer, 12 Nov 2026.
   A small runway: threshold bars on the left, centreline dashes rolling past.
   When the data lands, the dashes stop on a whole stripe and the threshold
   bars turn GO green (CAUTION orange for cached data, NO-GO red for a failure).
   Animates transform and opacity only. Reduced motion: nothing moves, the
   label and the bar colour still change. No logo, no spinner.

   Four live site themes, tokens from DESIGN.md \xA76.1 (Theme 1\u20134):
   midnight, amethyst, pearl (day white), champagne (day beige). */

.gar{
  --gar-ease:cubic-bezier(.32,.72,0,1);
  --gar-step:640ms;              /* one stripe per step */
  --gar-pitch:32px;              /* dash 18 + gap 14 */
  /* Theme 3 Pearl (default). Day themes use deeper status tints so the
     threshold marking clears 3:1 on the runway surface (WCAG 1.4.11). */
  --gar-ink:#111114;
  --gar-ink2:rgba(17,17,20,.62);
  --gar-surface:rgba(17,17,20,.035);
  --gar-line:rgba(0,0,0,.07);
  --gar-hl:rgba(255,255,255,.95);
  --gar-go:#15803D;--gar-cau:#B45309;--gar-nogo:#D10D33;
  display:inline-flex;flex-direction:column;align-items:center;gap:14px;
  color:var(--gar-ink);
}
/* Live site theme system (site/index.html): html[data-theme=night|day][data-pal=black|purple|white|beige].
   :where() keeps these at the same weight as the explicit .gar--<theme> classes below, which win when set.
   html[data-theme=<name>] (midnight|amethyst|pearl|champagne) stays as a fallback for demos. */
:where(html[data-theme=night]) .gar,:where(html[data-theme=night][data-pal=black]) .gar,:where([data-theme=midnight]) .gar{
  --gar-ink:#F5F5F7;--gar-ink2:rgba(245,245,247,.62);--gar-surface:rgba(255,255,255,.04);--gar-line:rgba(255,255,255,.10);--gar-hl:rgba(255,255,255,.16);
  --gar-go:#22C55E;--gar-cau:#FF8A00;--gar-nogo:#F80F3B}
:where(html[data-theme=night][data-pal=purple]) .gar,:where([data-theme=amethyst]) .gar{
  --gar-ink:#F7F4FF;--gar-ink2:rgba(236,228,255,.64);--gar-surface:rgba(200,170,255,.07);--gar-line:rgba(210,190,255,.13);--gar-hl:rgba(230,215,255,.20);
  --gar-go:#22C55E;--gar-cau:#FF8A00;--gar-nogo:#F80F3B}
:where(html[data-theme=day]) .gar,:where(html[data-theme=day][data-pal=white]) .gar,:where([data-theme=pearl]) .gar{
  --gar-ink:#111114;--gar-ink2:rgba(17,17,20,.62);--gar-surface:rgba(17,17,20,.035);--gar-line:rgba(0,0,0,.07);--gar-hl:rgba(255,255,255,.95);
  --gar-go:#15803D;--gar-cau:#B45309;--gar-nogo:#D10D33}
:where(html[data-theme=day][data-pal=beige]) .gar,:where([data-theme=champagne]) .gar{
  --gar-ink:#1C1814;--gar-ink2:rgba(28,24,20,.62);--gar-surface:rgba(60,40,10,.05);--gar-line:rgba(60,40,10,.08);--gar-hl:rgba(255,253,248,.95);
  --gar-go:#15803D;--gar-cau:#B45309;--gar-nogo:#D10D33}
/* Explicit theme classes (mount option / setTheme) */
.gar.gar--midnight{--gar-ink:#F5F5F7;--gar-ink2:rgba(245,245,247,.62);--gar-surface:rgba(255,255,255,.04);--gar-line:rgba(255,255,255,.10);--gar-hl:rgba(255,255,255,.16);
  --gar-go:#22C55E;--gar-cau:#FF8A00;--gar-nogo:#F80F3B}
.gar.gar--amethyst{--gar-ink:#F7F4FF;--gar-ink2:rgba(236,228,255,.64);--gar-surface:rgba(200,170,255,.07);--gar-line:rgba(210,190,255,.13);--gar-hl:rgba(230,215,255,.20);
  --gar-go:#22C55E;--gar-cau:#FF8A00;--gar-nogo:#F80F3B}
.gar.gar--pearl{--gar-ink:#111114;--gar-ink2:rgba(17,17,20,.62);--gar-surface:rgba(17,17,20,.035);--gar-line:rgba(0,0,0,.07);--gar-hl:rgba(255,255,255,.95);
  --gar-go:#15803D;--gar-cau:#B45309;--gar-nogo:#D10D33}
.gar.gar--champagne{--gar-ink:#1C1814;--gar-ink2:rgba(28,24,20,.62);--gar-surface:rgba(60,40,10,.05);--gar-line:rgba(60,40,10,.08);--gar-hl:rgba(255,253,248,.95);
  --gar-go:#15803D;--gar-cau:#B45309;--gar-nogo:#D10D33}

/* runway */
.gar-rw{
  position:relative;width:240px;height:52px;border-radius:14px;overflow:hidden;
  background:var(--gar-surface);
  box-shadow:inset 0 0 0 1px var(--gar-line),inset 0 1px 0 var(--gar-hl);
  contain:paint;
}
/* runway end: a short bar so the runway has a visible end */
.gar-rw::after{content:"";position:absolute;right:14px;top:14px;bottom:14px;width:2px;border-radius:1px;background:var(--gar-ink);opacity:.32}
.gar--icon .gar-rw::after{display:none}
/* threshold bars ("piano keys"); two stacked copies, colour layer fades over */
.gar-th{position:absolute;left:14px;top:12px;bottom:12px;display:flex;gap:3px}
.gar-th i{display:block;width:3px;border-radius:1.5px;background:var(--gar-ink);opacity:.78}
.gar-st{position:absolute;inset:0;opacity:0}
.gar-st .gar-th i{background:var(--gar-c,var(--gar-go));opacity:1}
/* verdict by shape as well as colour (colour-blind safe, no text) */
.gar[data-gar-s=cau] .gar-st .gar-th i:nth-child(even){opacity:.2}   /* CAUTION: only every second bar lit */
.gar[data-gar-s=nogo] .gar-st .gar-th{display:none}                             /* NO-GO: threshold closed ... */
.gar-aim{display:none}                                                         /* GO: aiming-point (touchdown) markings, never shown while loading */
.gar[data-gar-s=go] .gar-aim{display:block;position:absolute;left:84px;top:13px;bottom:13px;width:30px;transform-origin:0 50%}
.gar-aim i{position:absolute;left:0;right:0;height:5px;border-radius:1.5px;background:var(--gar-c,var(--gar-go))}
.gar-aim i:first-child{top:0}
.gar-aim i:last-child{bottom:0}
.gar-x{position:absolute;left:14px;top:12px;width:33px;height:28px;display:none}
.gar[data-gar-s=nogo] .gar-x{display:block}                                      /* ... crossed (X) closed-runway marking */
.gar-x i{position:absolute;left:50%;top:50%;width:3px;height:36px;margin:-18px 0 0 -1.5px;border-radius:1.5px;background:var(--gar-c,var(--gar-nogo))}
.gar-x i:first-child{transform:rotate(40deg)}
.gar-x i:last-child{transform:rotate(-40deg)}
/* centreline */
.gar-cl{
  position:absolute;left:52px;right:22px;top:50%;height:3px;margin-top:-1.5px;overflow:hidden;
  -webkit-mask-image:linear-gradient(90deg,transparent 0,#000 18px,#000 calc(100% - 52px),transparent);
          mask-image:linear-gradient(90deg,transparent 0,#000 18px,#000 calc(100% - 52px),transparent);
}
.gar-strip{
  position:absolute;left:0;top:0;height:3px;width:calc(100% + var(--gar-pitch) * 2);
  background:repeating-linear-gradient(90deg,var(--gar-ink) 0 18px,transparent 18px var(--gar-pitch));
  opacity:.55;border-radius:1.5px;
}
.gar.is-loading .gar-strip{animation:gar-roll var(--gar-step) var(--gar-ease) infinite;will-change:transform}
@keyframes gar-roll{from{transform:translateX(0)}to{transform:translateX(calc(var(--gar-pitch) * -1))}}

/* label: two layers cross-fade so the text never slides */
.gar-lb{position:relative;height:14px;min-width:200px;text-align:center;
  font:500 11px/14px "JetBrains Mono",ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;
  font-variant-numeric:tabular-nums;color:var(--gar-ink2)}
.gar-lb span{position:absolute;inset:0;white-space:nowrap}
.gar-lb .gar-lb2{opacity:0}
.gar-lb .gar-lb2 b{font-weight:500;color:var(--gar-c,var(--gar-go))}
.gar--nolabel{gap:0}
.gar--nolabel .gar-lb{display:none}

/* icon size: the refresh button glyph is the same runway, 22x14 */
.gar--icon{gap:0}
.gar--icon .gar-rw{width:24px;height:14px;border-radius:4px;box-shadow:inset 0 0 0 1.25px var(--gar-ink);background:none;opacity:.9}
.gar--icon .gar-th{left:3.5px;top:3.5px;bottom:3.5px;gap:1.5px}
.gar--icon .gar-th i{width:1.5px;border-radius:.75px;opacity:1}
.gar[data-gar-s=go].gar--icon .gar-aim{left:13px;top:2.6px;bottom:2.6px;width:6px}
.gar--icon .gar-aim i{height:1.5px;border-radius:.5px}
.gar--icon .gar-x{left:3px;top:3px;width:7.5px;height:8px}
.gar--icon .gar-x i{width:1.5px;height:9px;margin:-4.5px 0 0 -.75px;border-radius:.75px}
.gar--icon .gar-cl{left:12.5px;right:2.5px;height:1.5px;margin-top:-.75px;
  -webkit-mask-image:linear-gradient(90deg,transparent,#000 2px,#000 calc(100% - 4px),transparent);mask-image:linear-gradient(90deg,transparent,#000 2px,#000 calc(100% - 4px),transparent)}
.gar--icon{--gar-pitch:7px}
.gar--icon .gar-strip{height:1.5px;opacity:1;
  background:repeating-linear-gradient(90deg,var(--gar-ink) 0 4px,transparent 4px var(--gar-pitch))}
.gar--icon .gar-lb{display:none}

@media (prefers-reduced-motion:reduce){
  .gar.is-loading .gar-strip{animation:none}
}
/* Rollout in the header (Designer, 12 Nov 2026, v2): no cover, nothing over the page. The runway lives in an empty header gap
   from the header's first paint, rolls while the page loads, shows the verdict, then fades. Transform + opacity only. */
#ga-ro{position:absolute;left:0;top:0;width:240px;transform-origin:0 0;pointer-events:none;z-index:1}
@media (max-width:699px){
  #ga-ro,.gar{display:none!important}
}`,document.head.appendChild(U),(function(){var v=document,x=v.querySelector("header.topbar"),g=x&&x.querySelector(".logo");if(!x||!g||!window.GAReload)return;var E=location.pathname,C=location.hash.replace(/^#/,"").split("?")[0],z=new URLSearchParams(location.search).get("tab"),H=/^\/(c\/)?ad\//.test(E)||/^ad\b/.test(C)||/^\/fact(\.html)?$/.test(E),N=!H&&(E==="/"||/^\/(index|main)(\.html)?$/.test(E))&&(!C||C==="aero"||C==="status")&&(!z||z==="aero"||z==="status"),a=innerWidth>=700;if(!a||!(N||H))return;var n=a?56:40,c=n/240,L=a?"calc(50% - "+n/2+"px)":g.offsetLeft+g.offsetWidth+12+"px",i=v.createElement("span"),y=v.createElement("span");i.id="ga-ro",i.setAttribute("aria-hidden","true"),i.style.cssText="left:"+L+";top:"+(x.clientHeight-52*c)/2+"px;transform:scale("+c+")",i.appendChild(y),x.appendChild(i);var I=GAReload.mount(y,{labels:!1});I.start();var S=function(){var r=location.pathname;return N?r==="/"||/^\/(index|main)(\.html)?$/.test(r)||/^\/(aero|status)?$/.test(r):/^\/(c\/)?ad\/|^\/fact/.test(r)},P=Date.now(),G=!1,w=!1,T=null,O=0,J=null,m;function b(){if(!G){G=!0,clearInterval(m),clearTimeout(J);var r=function(){try{I.unmount()}catch(p){}i.parentNode&&i.parentNode.removeChild(i)},d=!1;try{d=matchMedia("(prefers-reduced-motion: reduce)").matches}catch(p){}if(d||!i.animate)return r();i.animate([{opacity:1},{opacity:0}],{duration:280,easing:"cubic-bezier(.32,.72,0,1)",fill:"forwards"}).finished.then(r,r)}}function q(r){w||(w=!0,Promise.resolve(I.verdict({status:r})).then(function(){J=setTimeout(b,1600)}))}function W(r){try{var d=v.getElementById(r);return d&&d.contentDocument}catch(p){return null}}m=setInterval(function(){var r=Date.now()-P;if(r>3e4||!S())return b();if(!w){if(N){var d=W("wmF-aero"),p=d?((d.querySelector(".wupd")||{}).textContent||"").trim():"";/^Updated\b/i.test(p)?q("go"):/Snapshot|Cached|unavailable/i.test(p)&&q("cau")}else{var s=W("wmF-ad"),B=s&&s.querySelector(".verd[data-s]");if(B&&/Updated \d|Snapshot/.test(B.textContent)){var k=B.getAttribute("data-s"),F=k==="go"?"go":k==="nogo"?"nogo":"cau";F!==T?(T=F,O=r):r-O>=600&&q(F)}}r>2e4&&q("nogo")}},200),addEventListener("pageshow",function(r){r.persisted&&b()}),addEventListener("hashchange",function(){var r=location.hash.replace(/^#/,"").split("?")[0];N&&r&&r!=="aero"&&r!=="status"&&b()}),addEventListener("popstate",function(){S()||b()})})()}window.requestAnimationFrame?requestAnimationFrame(function(){setTimeout(h,0)}):setTimeout(h,0)})();
