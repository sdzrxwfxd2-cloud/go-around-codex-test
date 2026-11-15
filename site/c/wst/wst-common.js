/* shared: read saved pills, compute status for the 65, write search-dot cache */
(function(){const W=window.WST,S=window.WMST;if(!W||!S)return;
const g=(k,d)=>{try{return localStorage.getItem(k)??d}catch(e){return d}};
const AD={};S.ads.forEach(a=>AD[a.ic]=a);
/* pilot-safety P0-2 (13 Nov 2026): merges only ever ADDED stations, so old weather (and the 21 Oct / 14 Oct baked copies)
   showed as current. purge() at load, after each live merge, before every 'wst:data' listener and on each pass drops a
   METAR > 3 h, a TAF not valid now (GA_TAF, ga-core-v2-wire.js) and a model "current" > 180 min. scrub() clears each baked
   card once: stale METAR/TAF text, the values they fed, the baked verdict. */
const H=3600e3,MET_MAX=3*H,OM_MAX=180*60e3,tafOk=(r,n)=>!!(window.GA_TAF&&GA_TAF.valid(r,n)),
 tms=v=>v==null?NaN:typeof v==='number'?(v<1e11?v*1e3:v):Date.parse(String(v).replace(/Z?$/,'Z'));
let warned=0;function stale(why,e){try{if(warned++<20)console.warn('[wx] '+why,e||'')}catch(x){}try{document.documentElement.setAttribute('data-wx-stale',String(why).slice(0,80))}catch(x){}}
function purge(now){now=typeof now==='number'?now:Date.now();const gone=[];
 for(const k in S.metar||{}){const t=tms(S.metar[k]&&S.metar[k].obsTime);if(!(t>0)||now-t>MET_MAX){delete S.metar[k];gone.push(k+' METAR')}}
 for(const k in S.taf||{}){const t=S.taf[k];if(!tafOk(typeof t==='string'?t:t&&(t.rawTAF||t.raw),now)){delete S.taf[k];gone.push(k+' TAF')}}
 for(const k in S.om||{}){const o=S.om[k],t=o&&o.current&&tms(o.current.time);if(!(t>0)||now-t>OM_MAX){delete S.om[k];gone.push(k+' model')}}
 if(gone.length)stale('removed stale weather: '+gone.slice(0,8).join(', '));return gone}
S.metar=S.metar||{};S.taf=S.taf||{};S.om=S.om||{};purge();
addEventListener('wst:data',()=>purge(),true);
function rawT(raw,now){const m=/(\d{2})(\d{2})(\d{2})Z/.exec(raw),n=new Date(now);if(m)for(let k=0;k>=-2;k--){const t=Date.UTC(n.getUTCFullYear(),n.getUTCMonth()+k,+m[1],+m[2],+m[3]);if(new Date(t).getUTCDate()===+m[1]&&t<=now+2*H)return t}return NaN}
function scrub(c,now){if(!c||c.__wxScrub)return;c.__wxScrub=1;now=now||Date.now();const q=x=>c.querySelector(x),D='—';
 const mt=q('.cp[data-p=metar] .mono'),raw=mt&&mt.textContent.trim();
 if(raw&&/^(METAR|SPECI)\b/.test(raw)&&!(now-rawT(raw,now)<=MET_MAX)){mt.textContent='No METAR in the last 3 hours';
  const tp=q('.temp'),sp=c.querySelectorAll('.wxd span');if(tp)tp.innerHTML=D;if(sp[0])sp[0].innerHTML='Wind <b class="num">'+D+'</b>';if(sp[1])sp[1].innerHTML='Vis <b>'+D+'</b> · Sky <b>'+D+'</b>';if(sp[2])sp[2].innerHTML='QNH <b class="num">'+D+'</b>';
  c.querySelectorAll('[data-obs]').forEach(e=>{e.dataset.obs='0'});const fc=q('.fcb2');if(fc)fc.innerHTML='';delete c.dataset.wx}
 const tf=q('.cp[data-p=taf] .mono'),tr=tf&&((window.GA_TAF_RAW&&GA_TAF_RAW(tf))||tf.textContent.trim());if(tr&&/^TAF\b/.test(tr)){if(!(window.GA_PAINT_TAF&&GA_PAINT_TAF(tf,tr,now))&&!tafOk(tr,now)){if(tf.dataset)delete tf.dataset.tafRaw;tf.textContent='No current TAF'}}
 if(c.dataset.s){c.dataset.s='incomplete';const b=q('.badge');if(b)b.textContent=D}}
try{const now=Date.now();(window.WM_ALL_CARDS&&WM_ALL_CARDS.length?WM_ALL_CARDS:[].slice.call(document.querySelectorAll('.card'))).forEach(c=>scrub(c,now))}catch(e){stale('card scrub failed',e)}
addEventListener('wst:data',()=>purge(),true);
function sel(){let l=g('wm-lvl','ppl');if(l==='ppln'){l='ppl';try{localStorage.setItem('wm-lvl','ppl');localStorage.setItem('wm-night','1')}catch(e){}}if(!W.PRE[l])l='ppl';
 return{ac:g('wm-ac','C172'),rules:g('wm-rules','vfr')==='ifr'?'ifr':'vfr',lvl:l,night:g('wm-night','0')==='1'}}
function prof(s){return Object.assign({},W.PRE[s.lvl],{night:s.night?1:0})}
function all(){purge();const s=sel(),P=prof(s),now=Date.now(),o={};S.ads.forEach(a=>{o[a.ic]=W.status(a,W.obsOf(a,S),s.ac,s.rules,P,now)});return o}
function dots(o){const m={go:'g',caution:'c',nogo:'n',noiap:'n'};let c={};try{c=JSON.parse(g('wm-fs-wx','null'))||{}}catch(e){}const s=Object.assign({},c.s||{});for(const k in o)s[k]=m[o[k].s]||'';try{localStorage.setItem('wm-fs-wx',JSON.stringify({t:Date.now(),s}))}catch(e){}}
window.WSTC={AD,sel,prof,all,dots,purge,stale,scrub};})();
/* when served: refresh the snapshot from the cached /api function (official) + one Open-Meteo batch (model), every 15 min */
(function(){const S=window.WMST,C=window.WSTC;if(!S||!C||!/^https?:/.test(location.protocol))return;
async function live(){try{const [M,T]=await Promise.all([fetch('/api/metar').then(r=>r.json()),fetch('/api/taf').then(r=>r.json()).catch(()=>[])]);
 M.sort((a,b)=>a.obsTime-b.obsTime).forEach(m=>{if(C.AD[m.icaoId])S.metar[m.icaoId]=m});(T||[]).forEach(t=>{if(C.AD[t.icaoId])S.taf[t.icaoId]=t.rawTAF});
 const mo=S.ads.filter(a=>!S.metar[a.ic]);if(mo.length&&!window.WMCARD){const j=await fetch('https://api.open-meteo.com/v1/forecast?latitude='+mo.map(a=>a.la).join(',')+'&longitude='+mo.map(a=>a.lo).join(',')+'&current=temperature_2m,dew_point_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,pressure_msl,cloud_cover_low,cloud_cover,cloud_base&wind_speed_unit=kn&timezone=UTC').then(r=>r.json());[].concat(j).forEach((o,i)=>S.om[mo[i].ic]=o)}
 C.purge&&C.purge();document.dispatchEvent(new Event('wst:data'))}catch(e){C.stale&&C.stale('live weather refresh failed',e)}}
live();setInterval(live,15*60e3)})();
