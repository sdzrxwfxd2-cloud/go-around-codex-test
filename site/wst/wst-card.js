/* Main-page cards (approved 2026-10-21): no Model box, model weather on no-METAR cards (soft Model tag), Model tab default there, Vis/Sky decoded from the shown METAR, live sunrise/sunset pill. Model panels reuse the one batched Open-Meteo call (no per-card requests). */
(function(){const W=window.WST,S=window.WMST,C=window.WSTC;if(!W||!S)return;
const $$=(r,q)=>[...r.querySelectorAll(q)],LB={go:'GO',caution:'CAUTION',nogo:'NO-GO',none:'NO DATA',noiap:'NO IFR APPROACH'};
const FCC={VFR:'#22C55E',MVFR:'#3B82F6',IFR:'#F80F3B',LIFR:'#C026D3'};
/* Aerodrome card v3 (13 Nov 2026, MT locked): the Day/Night, FZL and DA pills, header and flight-condition chip are styled in wst/ad-card.css.
 The Model panel (six tiles, no card-surface disclaimer) stays here; weather source labels live in the i note, not on the card. */
const css=`
html .card .cp[data-p=model]:not(#z):not(#y):not(#x){padding:0!important;background:none!important;box-shadow:none!important;border:0!important;border-radius:0!important;color:var(--tx)!important}
html .card .cp[data-p=model]:not(#z):not(#y):not(#x)>.mono{color:var(--tx3)!important;font:500 12px/1.4 -apple-system,sans-serif}
html .card .cp[data-p=model]:not(#z):not(#y):not(#x)>.mono::before{content:none}
.card .fcb2 .fbadge.wmb{opacity:.82}`;
const st=document.createElement('style');st.id='wmcardprev';st.textContent=css;document.head.appendChild(st);
const z=n=>String(n).padStart(2,'0'),dd=w=>String(Math.round(w)%360).padStart(3,'0')+'°';
/* METAR decode for the Vis / Sky line */
function dec(raw){const R=' '+(raw||'').replace(/=/g,' ')+' ',cav=/ CAVOK /.test(R),vm=R.match(/ (\d{4})(?:NDV)? /),sm=R.match(/ (\d+(?:\/\d)?)SM /);
 let vis=cav||(vm&&vm[1]==='9999')?'10+ km':vm?(+vm[1]>=5000?Math.round(+vm[1]/1000):(+vm[1]/1000).toFixed(1))+' km':sm?sm[1]+' SM':'—';
 const L=[...R.matchAll(/ (FEW|SCT|BKN|OVC|VV)(\d{3}|\/\/\/)/g)].map(m=>m[1]+(m[2]==='///'?'':m[2]));
 const cl=L.find(x=>/^(BKN|OVC|VV)/.test(x)),nsc=R.match(/ (NSC|NCD|SKC|CLR) /);
 return{vis,sky:cav?'CAVOK':cl||L[0]||(nsc?nsc[1]:'—')}}
const isM=c=>/^(METAR|SPECI)\b/.test(((c.querySelector('.cp[data-p=metar] .mono')||{}).textContent||'').trim());
const lat=c=>{const m=c.querySelector('.cp[data-p=model]');return m&&m.dataset.la?[+m.dataset.la,+m.dataset.lo]:null};
const ic=c=>(c.querySelector('.icao')||{}).textContent;
/* runway true headings from the card diagram (for non-AIP strips) */
function rws(c){return $$(c,'.rwd line.r').map((l,i)=>{const dx=l.x2.baseVal.value-l.x1.baseVal.value,dy=l.y2.baseVal.value-l.y1.baseVal.value;const h=(Math.atan2(dx,-dy)*180/Math.PI+360)%360;return[{id:'~',true:h},{id:'~',true:(h+180)%360}]}).flat()}
/* model data for cards without a METAR: seed every card from the already-loaded wx-now / model copy (__wmModelPoints). METAR temperature still wins in daPill / fill(). No Open-Meteo request from pull(). */
const OM={},AT={};let busy=0,pendingPull=null,seedTries=0;
/* pilot-safety P0-4/P1-3: missing = "—" (never 0, 000°, null%); model "current" > 180 min is dropped */
const OM_MAX=180*60e3,N=v=>v==null||v===''||!isFinite(+v)?null:+v,
 tms=v=>v==null?NaN:typeof v==='number'?(v<1e11?v*1e3:v):Date.parse(String(v).replace(/Z?$/,'Z')),
 warnW=(why,e)=>{try{(C&&C.stale)?C.stale(why,e):console.warn('[wx] '+why,e||'')}catch(x){}};
function storeOm(id,o){if(!o)return;const prev=S.om[id]||OM[id];const merged=prev?Object.assign({},prev,o,{current:Object.assign({},(prev.current||{}), (o.current||{})),hourly:Object.assign({},(prev.hourly||{}), (o.hourly||{})),elevation:o.elevation!=null?o.elevation:prev.elevation}):o;if(C&&C.AD[id])S.om[id]=merged;else OM[id]=merged;OM[id]=merged;if(S.om[id]||(C&&C.AD[id]))S.om[id]=merged}
async function seedFromCopy(force){if(typeof window.__wmModelPoints!=='function')return 0;const now=Date.now(),pts=[],ids=[];const seen={};$$(document,'.card').forEach(c=>{const k=ic(c),p=lat(c);if(!k||!p||seen[k])return;if(!force&&AT[k]&&now-AT[k]<15*60e3)return;seen[k]=1;pts.push(p);ids.push(k)});if(!pts.length)return -1;const vars=['temperature_2m','dew_point_2m','wind_speed_10m','wind_direction_10m','wind_gusts_10m','visibility','pressure_msl','cloud_cover','cloud_cover_low','cloud_base','freezing_level_height'];let ans=null;try{ans=await window.__wmModelPoints(pts,vars)}catch(e){return 0}let n=0;(ans||[]).forEach((o,i)=>{if(!o||!(o.current||o.hourly))return;const id=ids[i];AT[id]=now;storeOm(id,o);n++});return n}
async function pull(force){if(!/^https?:/.test(location.protocol))return;if(busy){pendingPull=!!(pendingPull||force);return}if(document.getElementById('list')&&!document.querySelector('.card')){setTimeout(()=>pull(force),250);return}busy=1;if(force){seedTries=0;for(const k in AT)delete AT[k]}
 let n=0;try{n=await seedFromCopy(force);if((n===0||n==null)&&seedTries<8){seedTries++;pendingPull=!!(pendingPull||force)}}
 finally{busy=0;const again=pendingPull;pendingPull=null;run();if(typeof window.applyS==='function')window.applyS();if(again!=null)setTimeout(()=>pull(!!again),nWait(n))}
}
function nWait(n){return (n===0||n==null)?300:0}
window.WMCARD={pull};
function omOf(k){const o=omOf0(k);if(o&&o.current){const t=tms(o.current.time);if(!(t>0)||Date.now()-t>OM_MAX){if(S.om)delete S.om[k];delete OM[k];const h=o.hourly&&o.hourly.time&&o.hourly.time.length?{hourly:o.hourly,elevation:o.elevation}:null;if(h){OM[k]=h}return h}}return o}
function omOf0(k){const a=S.om&&S.om[k],b=OM[k];if(!a)return b;if(!b)return a;const ah=a.hourly&&a.hourly.freezing_level_height,bh=b.hourly&&b.hourly.freezing_level_height;const hourly=(ah&&ah[0]!=null)?a.hourly:(bh||a.hourly);const elevation=a.elevation!=null?a.elevation:b.elevation;const ca=a.current,cb=b.current;const current=(ca&&ca.wind_speed_10m!=null)?ca:(cb&&cb.wind_speed_10m!=null?cb:(ca||cb));return Object.assign({},b,a,{hourly:hourly,elevation:elevation,current:current})}
function obM(k){const o=omOf(k);if(!o||!o.current)return null;return W.obsOf({ic:k},{metar:{},taf:{},om:{[k]:o}})}
function cat(ob){const v=ob.vis,c=ob.ceil;if(v==null)return null;const sm=v/1.609;const r=(c!=null&&c<500)||sm<1?'LIFR':(c!=null&&c<1000)||sm<3?'IFR':(c!=null&&c<=3000)||sm<=5?'MVFR':'VFR';return r}
/* Model panel: six tiles only. Valid time is kept on dataset.vt for the i note (Open-Meteo current.time is UTC without a zone). */
function panel(c,o){const m=c.querySelector('.cp[data-p=model]');if(!m)return;
 if(!o||!o.current){if(m.dataset.vt){m.innerHTML='<span class="mono">Model too old · not shown</span>';delete m.dataset.vt;delete m.dataset.done}return}const x=o.current;
 if(N(x.wind_speed_10m)==null&&N(x.visibility)==null&&N(x.pressure_msl)==null)return;
 if(m.dataset.vt===x.time){const n=m.querySelector('.mnote');if(n)n.remove();return}
 const l=(t,e)=>'<div class="mt2"><span>'+t+'</span><b>'+e+'</b></div>';
 const wd=N(x.wind_direction_10m),ws=N(x.wind_speed_10m),gs=N(x.wind_gusts_10m),vi=N(x.visibility),cc=N(x.cloud_cover),tt=N(x.temperature_2m),td=N(x.dew_point_2m),qn=N(x.pressure_msl),D='—';
 m.innerHTML='<div class="mg2">'+l('Wind',ws==null?D:ws<0.5?'Calm':(wd==null?'—°':dd(wd))+' '+Math.round(ws)+' kt')+l('Gust',gs==null?D:Math.round(gs)+' kt')+l('Vis',vi==null?D:vi>=1e4?'10+ km':(vi/1e3).toFixed(1)+' km')+l('Cloud',cc==null?D:Math.round(cc)+'%')+l('Temp/Dew',(tt==null?D:Math.round(tt)+'°')+'/'+(td==null?D:Math.round(td)+'°'))+l('QNH',qn==null?D:Math.round(qn)+'')+'</div>';
 m.dataset.done=1;m.dataset.vt=x.time}
/* perf 11 Nov 2026 (DEEP-DIAG fix 1): skip a rewrite when the element already shows exactly this html from us (same text and
   the very same child nodes), as sun()/fzl()/daPill() do. Rewriting identical html woke every page observer on each run. */
function setH(e,h){if(e._wmH===h&&e._wmF===e.firstChild&&e._wmL===e.lastChild&&e._wmN===e.childNodes.length)return;e.innerHTML=h;e._wmH=h;e._wmF=e.firstChild;e._wmL=e.lastChild;e._wmN=e.childNodes.length}
function fillModel(c,ob){const q=x=>c.querySelector(x),tp=q('.temp'),sp=c.querySelectorAll('.wxd span');
 if(tp){if(tp.style.color)tp.style.color='';setH(tp,ob.t!=null?Math.round(ob.t)+'<sup>°C</sup>':'—')}
 const g=ob.g&&ob.g-ob.ws>=10?' G'+ob.g:'';
 if(sp[0])setH(sp[0],'Wind <b class="num">'+(ob.ws==null||!isFinite(ob.ws)?'—':ob.ws<1?'Calm':(ob.wd==null||!isFinite(ob.wd)?'—°':dd(ob.wd))+' '+ob.ws+' kt'+g)+'</b>');/* MT wind rule 13 Nov: no model wind is "—", not "Calm"; no direction is "—°", not "000°" */
 if(sp[1])setH(sp[1],'Vis <b>'+(ob.vis==null?'—':ob.vis>=10?'10+ km':ob.vis.toFixed(1)+' km')+'</b> · '+(ob.ceil!=null?'Ceil <b>'+ob.ceil.toLocaleString('en-US')+' ft</b>':'Cloud <b>'+(ob.cc!=null?Math.round(ob.cc)+'%':'—')+'</b>'));
 if(sp[2])setH(sp[2],'QNH <b class="num">'+(ob.qnh!=null?Math.round(ob.qnh):'—')+'</b>');/* no source tag on the weather lines: the source is in the i note */
 const fc=q('.fcb2'),k=cat(ob),lowUnk=ob.ceil==null&&N(ob.low)!=null&&ob.low>=63,eye='<button class="inote">i</button>';
 /* P1-3: no category = chip cleared; low cloud with no base is never VFR/VMC */
 if(fc&&(!k||(lowUnk&&/^(VFR|MVFR)$/.test(k)))){setH(fc,(lowUnk&&k?'<span class="fbadge wmb" style="--c:#F5A524" title="Model low cloud cover '+Math.round(ob.low)+'%, cloud base unknown"><i></i>LOW CLOUD</span>':'')+eye);}
 else if(fc&&k){const vm=/^(VFR|MVFR)$/.test(k)?'VMC':'IMC';
  setH(fc,'<span class="fbadge wmb" style="--c:'+FCC[k]+'" title="From model data, not a METAR"><i></i>'+k+'</span><span class="fbadge wmb" style="--c:'+(vm==='VMC'?'#22C55E':'#F80F3B')+'"><i></i>'+vm+'</span>'+eye)}
 c.dataset.model='1'}
/* P1-3: model gone stale after filling the card: dashes */
function clearModel(c){const q=x=>c.querySelector(x),tp=q('.temp'),sp=c.querySelectorAll('.wxd span');if(tp)setH(tp,'—');
 if(sp[0])setH(sp[0],'Wind <b class="num">—</b>');if(sp[1])setH(sp[1],'Vis <b>—</b> · Cloud <b>—</b>');if(sp[2])setH(sp[2],'QNH <b class="num">—</b>');
 const fc=q('.fcb2');if(fc)setH(fc,'<button class="inote">i</button>');delete c.dataset.model}
/* sunrise / sunset pill */ /* (end-of-fillModel marker kept for tests/perf/pass-cascade.mjs) */
/* Weather pills, aerodrome card v3 (MT locked 13 Nov 2026). Day/Night, FZL and DA sit in ONE .wpills box, in that order,
   on one 4-column spec (icon · label · column 2 · column 3, subgrid in ad-card.css so the columns line up digit for digit).
   Every arrow on the three pills is the same 9px glyph (AR): sunrise/sunset times and the FZL / DA trend to the next model hour.
   Night not enabled (wq.js marks the card with .wq-nn, the engine's decision) turns the Day/Night pill into the red night pill:
   one centred row, icon + text, in both Depart and Land (Land: the arrival time). */
const TZF=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Johannesburg',hour:'2-digit',minute:'2-digit'}),tz=t=>TZF.format(new Date(t)); /* speed: one cached formatter, same output */
const du=m=>{m=Math.max(0,Math.round(m/6e4));const H=Math.floor(m/60);return H?H+'h'+(m%60?' '+m%60+'m':''):m+'m'};
const SUN='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.6" fill="#F5A524"/><g stroke="#F5A524" stroke-width="1.8" stroke-linecap="round"><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.5 1.5M17.2 17.2l1.5 1.5M5.3 18.7l1.5-1.5M17.2 6.8l1.5-1.5"/></g></svg>';
const MOON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="#A9B8E8"/></svg>';
const AR=dir=>'<svg class="wp-ar wp-ar-'+dir+'" viewBox="0 0 10 10" aria-hidden="true"><path d="M5 8.6V1.6M1.9 4.6 5 1.5l3.1 3.1"/></svg>';
const fmt=n=>n.toLocaleString('en-US');
/* signed change to the next model hour, rounded to 10 ft; flat under 50 ft (the old FZL threshold was 15 m) */
const trend=d=>{d=Math.round(d/10)*10;const dir=Math.abs(d)<50?'fl':d>0?'up':'dn';return '<span class="v wp-tr">'+(d>0?'+':d<0?'\u2212':'')+fmt(Math.abs(d))+AR(dir)+'</span>'};
function pillBox(c){let b=c.querySelector('.wpills');if(!b){const w=c.querySelector('.wxrow');if(!w)return null;b=document.createElement('div');b.className='wpills';w.after(b)}return b}
function put(c,el,cls,title,h,order){if(!el){el=document.createElement('div');el.className=cls}
 const b=pillBox(c);if(!b)return null;if(el.parentNode!==b||el.dataset.o!==String(order)){el.dataset.o=order;const nx=[...b.children].find(x=>+x.dataset.o>order);b.insertBefore(el,nx||null)}
 if(el._h!==h){el.innerHTML=h;el._h=h}if(title&&el.title!==title)el.title=title;return el}
const pill=(icon,c1,c2,c3)=>icon+'<span class="cd wp-c1">'+c1+'</span><span class="wp-c2">'+(c2?'<span class="v">'+c2+'</span>':'')+'</span><span class="wp-c3">'+(c3||'')+'</span>';
function arriveAt(now){try{const P=window.WMPHASE;if(!P||P.mode!=='land'||!P.arrive)return null;if(P.arrive.at!=null)return +P.arrive.at;if(P.arrive.off)return now+P.arrive.off*36e5}catch(e){}return null}
function sun(c){const p=lat(c);if(!p)return;
 const n=Date.now(),s=W.sunInfo(p[0],p[1],n);if(!s)return;const day=n>=s.rise&&n<s.set,nextRise=n<s.rise?s.rise:s.nextRise;
 const nn=c.querySelector('.wq-nn'),warn=!!nn,W2=' · <span class="wp-warn">Night not enabled</span>';let h,red=false;
 if(warn){red=true;const eta=nn.classList.contains('wq-nn-cau')?arriveAt(n):null;
  if(eta!=null){const se=W.sunInfo(p[0],p[1],eta)||s,before=eta<se.rise;h=MOON+'<span class="cd"><b>ETA '+tz(eta)+'</b> · '+(before?'before sunrise '+tz(se.rise):'after sunset '+tz(se.set))+W2+'</span>'}
  else h=MOON+'<span class="cd"><b>Night</b> · '+(n<s.rise?'Sunrise in '+du(s.rise-n):'Since sunset '+tz(s.set))+W2+'</span>'}
 else h=pill(day?SUN:MOON,'<b>'+(day?'Day':'Night')+'</b> · '+(day?'Sunset in '+du(s.set-n):'Sunrise in '+du(nextRise-n)),AR('up')+tz(day||n<s.rise?s.rise:s.nextRise),'<span class="v">'+AR('dn')+tz(s.set)+'</span>');
 const el=put(c,c.querySelector('.wsun2'),'wsun2','Sunrise and sunset (SAST)',h,1);if(el)el.classList.toggle('wp-night',red)}
function fzl(c){const o=omOf(ic(c));
 /* P2-7: the hourly row for the hour in force, by time (arr[0] outlived its hour) */
 const arr0=(o&&o.hourly&&o.hourly.freezing_level_height)||[],tt=(o&&o.hourly&&o.hourly.time)||[],nw=Date.now();let hi=-1;
 for(let i=0;i<tt.length;i++){const t=tms(tt[i]);if(t<=nw&&nw-t<3600e3)hi=i}
 let fl=hi>=0?N(arr0[hi]):null, elev=o&&o.elevation;
 let next=hi>=0?N(arr0[hi+1]):null;
 if(fl==null){const p=lat(c),x=p&&window.__wmFzlAt&&window.__wmFzlAt(p[0],p[1]);if(x&&x.fl!=null){fl=x.fl;if(elev==null)elev=x.elev;if(x.next!=null)next=x.next}}
 const el=c.querySelector('.wfzl2:not(.wda2)');
 if(fl==null){if(el)el.remove();return}
 const FT=3.280839895,amsl=Math.round(fl*FT),surface=elev!=null&&fl<=elev,agl=elev!=null?Math.max(0,Math.round((fl-elev)*FT)):null;
 const ICE='<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="#DCE6F5" stroke-width="1.6" stroke-linecap="round"><path d="M12 2v20M4.5 6.5l15 11M19.5 6.5l-15 11"/><path d="M12 6.2l2.2-2.2M12 6.2L9.8 4M12 17.8l2.2 2.2M12 17.8L9.8 20M6.8 9.2L4 8.2M6.8 9.2L5.2 11.8M17.2 9.2L20 8.2M17.2 9.2l1.6 2.6M6.8 14.8L4 15.8M6.8 14.8L5.2 12.2M17.2 14.8L20 15.8M17.2 14.8l1.6-2.6"/></g></svg>';
 const c1='<b>FZL</b> · '+(surface?'<span class="wp-warn fz-warn">Icing from surface</span>':agl!=null?fmt(agl)+' ft AGL':fmt(amsl)+' ft AMSL');
 const c2=surface||agl!=null?fmt(amsl)+' ft AMSL':'';
 put(c,el,'wfzl2','Freezing level (0°C), Open-Meteo model · AGL, AMSL and the change to the next model hour',pill(ICE,c1,c2,next!=null?trend((next-fl)*FT):''),2)}

function daPill(c){const k=ic(c),r10=n=>Math.round(n/10)*10;
 const rec=window.WMB&&WMB.results&&WMB.results[k];
 const cad=C&&C.AD&&C.AD[k],rad=rec&&rec.ad,fin=v=>v!=null&&v!==''&&isFinite(+v);
 /* Field elevation (MT 30 Oct: DA against each field's own elevation): AIP, then the locked runway/elevation DB (15 Nov), then the model ground height */
 let elev=null,eSrc='';
 if(cad&&fin(cad.el)){elev=+cad.el;eSrc=window.WM_RWDB&&WM_RWDB.a[k]?'field elevation':'AIP'}
 else if(rad&&fin(rad.el!=null?rad.el:rad.elev)){elev=+(rad.el!=null?rad.el:rad.elev);eSrc=rad.elevSrc||'AIP'}
 else if(window.WM_RWDB&&WM_RWDB.a[k]&&fin(WM_RWDB.a[k][0])){elev=+WM_RWDB.a[k][0];eSrc='field elevation'}
 if(elev==null){const p=lat(c),x=p&&window.__wmElevAt&&window.__wmElevAt(p[0],p[1]);
  if(x!=null&&isFinite(+x)){elev=Math.round(+x*3.280839895);eSrc='model ground height'}}
 /* P0-2/P0-4: temp+QNH as a pair from current structured data only (engine's weather, METAR <= 90 min, model <= 180 min);
    no text scraping; none: no pill */
 const used=rec&&rec.r&&((rec.r.v2&&rec.r.v2.weatherUsed)||rec.r.weatherUsed);
 let t=null,qnh=null,dA=null;
 const pair=(tt,qq)=>{tt=N(tt);qq=N(qq);if(t==null&&tt!=null&&qq!=null&&qq>800&&qq<1100){t=tt;qnh=qq}};
 if(used)pair(used.temp!=null?used.temp:used.t,used.qnh);
 const mt=S.metar&&S.metar[k];if(mt){const ot=tms(mt.obsTime);if(ot>0&&Date.now()-ot<=90*60e3)pair(mt.temp,mt.altim)}
 const o=omOf(k);if(o&&o.current)pair(o.current.temperature_2m,o.current.pressure_msl);
 const el=c.querySelector('.wda2');
 if(t==null||qnh==null||elev==null||!isFinite(elev)){if(el)el.remove();return}
 /* Same calculation as the calculator (calc.js C.atmos) and the aerodrome page (wq.js):
    PA = elev + (1013.25 - QNH) x 30, ISA at PA, DA = PA + 120 x (OAT - ISA). No QNH: standard 1013.25. */
 {const pa=elev+(1013.25-qnh)*30,isa=15-2*pa/1000;dA=Math.round(pa+120*(t-isa))}
 if(dA==null||!isFinite(dA)){if(el)el.remove();return}
 const above=dA-elev,lim=(window.GACoreV2&&GACoreV2.RULES&&GACoreV2.RULES.policy&&GACoreV2.RULES.policy.daAboveFt)||2500;
 const warn=above>lim,daR=r10(dA),abR=r10(Math.abs(above));
 /* trend: the model's temperature change to the next hour, through the same formula (120 ft per °C, pressure held) */
 const p=lat(c),x=p&&window.__wmTAt&&window.__wmTAt(p[0],p[1]);
 const t0=x&&x.t!=null?+x.t:null,t1=x&&x.tNext!=null?+x.tNext:null;
 const tr=t1!=null&&t0!=null&&isFinite(t1-t0)?trend(120*(t1-t0)):'';
 const MTN='<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="#DCE6F5" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 19L8.5 7.5 12 14.2 15.4 8.5 21 19"/></g></svg>';
 const v=fmt(abR)+' ft '+(above<0?'below':'above')+' field';
 const h=pill(MTN,'<b>DA</b> · '+(warn?'<span class="wp-warn fz-warn">'+v+'</span>':v),fmt(daR)+' ft AMSL',tr);
 const e=put(c,el,'wfzl2 wda2','Density altitude (calculator formula) · elevation: '+eSrc+' · AMSL and the change to the next model hour',h,3);
 if(e)e.classList.toggle('wp-dahi',warn)}
window.WMCARD_SUN=sun;

function usedWx(c){const r=c&&c.__wm;return r&&(r.weatherUsed||(r.v2&&r.v2.weatherUsed))||null}
function run(){const P=C&&C.prof(C.sel()),sl=C&&C.sel(),now=Date.now();
 $$(document,'.card').forEach(c=>{const k=ic(c);
  if(usedWx(c)&&typeof window.GA_PAINT_WX==='function'){try{window.GA_PAINT_WX(c,c.__wm.v2||c.__wm)}catch(e){}panel(c,omOf(k));const mn0=c.querySelector('.cp[data-p=model] .mnote');if(mn0)mn0.remove()}
  else if(isM(c)){const t=c.querySelector('.cp[data-p=metar] .mono').textContent,d=dec(t),sp=c.querySelectorAll('.wxd span');if(sp[1]){const h='Vis <b>'+d.vis+'</b> · Sky <b>'+d.sky+'</b>';if(sp[1].innerHTML!==h)sp[1].innerHTML=h}}
  else{const ob=obM(k);panel(c,omOf(k));const mn=c.querySelector('.cp[data-p=model] .mnote');if(mn)mn.remove();if(!ob&&c.dataset.model==='1')clearModel(c);if(ob){fillModel(c,ob);
    if(C&&!C.AD[k]&&P&&!window.WMF){/* wmgo-reason-writer: wm-final is the single writer of data-s/badge/.why when loaded */const r=W.status({ic:k,la:lat(c)[0],lo:lat(c)[1],el:null,rw:rws(c)},ob,sl.ac,sl.rules,P,now);if(r&&r.s!=='none'){const s=r.s==='noiap'?'nogo':r.s;c.dataset.s=s;const b=c.querySelector('.badge');if(b)b.textContent=LB[r.s];const w=c.querySelector('.why');if(w)w.innerHTML='<b>'+LB[r.s]+'</b> · '+String(r.why).replace(/ on RWY ~/g,'').replace(/[<>&]/g,'')}}}
   const sw=c.querySelector('.csw');if(sw&&!c.dataset.mtab){c.dataset.mtab=1;sw.dataset.init='model';if(sw._set){sw._set('model');c.querySelectorAll('.cp').forEach(e=>e.classList.toggle('on',e.dataset.p==='model'))}}}
  sun(c);fzl(c);daPill(c)});
 if(window.WMLIST){window.WMLIST.tiles();return}const n={go:0,caution:0,nogo:0};$$(document,'.card').forEach(c=>{if(n[c.dataset.s]!=null)n[c.dataset.s]++});
 if(window.WM_COUNTS)Object.assign(n,WM_COUNTS());$$(document,'#tiles .tile').forEach(t=>{const k=t.querySelector('.n');if(k&&n[t.dataset.s]!=null)k.textContent=n[t.dataset.s]})}
/* no-METAR cards: tab strip opens on Model (before the lazy swInit runs) */
$$(document,'.card').forEach(c=>{if(!isM(c)){const sw=c.querySelector('.csw');if(sw)sw.dataset.init='model'}});
const o=window.applyS;window.applyS=function(){try{o&&o()}catch(e){}run()};
document.addEventListener('wst:data',()=>run());document.addEventListener('wm:page',()=>pull());addEventListener('pageshow',run);setInterval(()=>{document.hidden||run()},60e3)/*5B*/;document.addEventListener("visibilitychange",()=>{document.hidden||run()});setInterval(()=>pull(),15*60e3);
run();setTimeout(()=>pull(),0)})();
