/* AD_CLASS: rotary-only sites (52), from heliport_research 29 Oct 2026. Default = aerodrome. */
window.AD_CLASS={"ZA-0236":"heliport","ZA-0319":"helistop","ZA-0215":"heliport","ZA-0119":"heliport","ZA-0206":"helistop","ZA-0212":"heliport","ZA-0312":"helistop","ZA-0292":"helistop","ZA-0251":"heliport","ZA-0202":"helistop","ZA-0356":"helistop","ZA-0318":"helistop","ZA-0302":"heliport","ZA-0173":"helistop","ZA-0168":"heliport","ZA-0242":"heliport","ZA-0170":"helistop","ZA-0174":"helistop","ZA-0313":"heliport","ZA-0140":"helistop","ZA-0295":"heliport","ZA-0172":"helistop","ZA-0213":"helistop","ZA-0171":"helistop","ZA-0311":"helistop","ZA-0200":"heliport","ZA-0250":"heliport","ZA-0357":"helistop","ZA-0214":"helistop","ZA-0203":"helistop","ZA-0210":"heliport","ZA-0208":"helistop","ZA-0246":"heliport","ZA-0247":"heliport","ZA-0167":"helistop","ZA-0243":"heliport","ZA-0211":"helistop","ZA-0304":"heliport","ZA-0244":"heliport","ZA-0021":"heliport","ZA-0117":"heliport","ZA-0193":"heliport","ZA-0205":"heliport","ZA-0241":"heliport","ZA-0237":"heliport","ZA-0209":"helistop","ZA-0245":"heliport","ZA-0291":"helistop","ZA-0201":"heliport","ZA-0207":"helistop","ZA-0175":"helistop","ZA-0290":"helistop"};
/* Heliport cards (MT 30 Oct 2026, on top of the 29 Oct heliport flag):
   - label HELIPORT or HELIPAD (AD_CLASS heliport vs helistop), steady grey pill instead of GO / CAUTION / NO-GO (no flashing), no engine verdict, not counted in GO / CAUTION / NO-GO
   - inline SVG helipad sign (full-circle pad + touchdown circle + H, fills the 76 px ring) instead of the empty runway diagram, coloured by the theme variables
   - model weather from Open-Meteo, labelled "Model weather, not an official report. For emergency reference only."
   - the existing "Hide heliports" filter still works; heliports are now shown by default (localStorage wm-heli-hide=1 hides them). */
(function(){
var H=document.documentElement,NOTE='Model weather, not an official report. For emergency reference only.';
window.WM_HELI_NOTE=NOTE;
window.WM_HELIPAD=function(){return '<svg class="rwd hpad" viewBox="-40 -40 80 80" role="img" aria-label="Helipad diagram"><circle r="38"/><g class="hp"><circle class="hp-d" r="35"/><circle class="hp-e" r="31.5"/><circle class="hp-t" r="20.5"/><path class="hp-h" d="M-7.5 -12V12M7.5 -12V12M-7.5 0H7.5"/><text class="hp-n" y="-23.6">N</text></g></svg>'};
window.WM_HX=function(c){return H.dataset.heliHide==='1'&&c.dataset.cat==='heliport'};
function isH(c){var i=c.querySelector('.icao');return !!(i&&AD_CLASS[i.textContent.trim()])}
function heliLab(c){var a=c.dataset.adc||(window.AD_CLASS||{})[((c.querySelector('.icao')||{}).textContent||'').trim()];return a==='helistop'?'HELIPAD':'HELIPORT'}
function fix(c){if(c.dataset.s!=='heli')c.dataset.s='heli';var b=c.querySelector('.badge'),lab=heliLab(c);if(b&&b.textContent!==lab)b.textContent=lab;
 c.querySelectorAll('.hnote,.mnote,.hsrc').forEach(function(e){e.remove()});var mp=c.querySelector('.cp[data-p=model]');if(mp&&HM.has(c)&&mp.innerHTML!==HM.get(c)){mp.dataset.done=1;mp.innerHTML=HM.get(c)}}
var HM=new Map();
function tag(){document.querySelectorAll('.card').forEach(function(c){if(!isH(c))return;c.dataset.cat='heliport';c.dataset.heli='1';
 var i=c.querySelector('.icao');c.dataset.adc=AD_CLASS[i.textContent.trim()];
/* MT #352 v6: restore pre-#352 runway/helipad diagram in the wxrow slot (identical 76px design). */
 ch=c.querySelector('.ch');
 if(ch){ch.querySelectorAll('.ad-corner,.hpad-tr').forEach(function(e){e.remove()})}
 var r=c.querySelector('.rwd');if(r&&!c.querySelector('.hpad')){r.insertAdjacentHTML('afterend',WM_HELIPAD());r.remove()}
 c.querySelectorAll('.csw button[data-v=metar],.csw button[data-v=taf],.cp[data-p=metar],.cp[data-p=taf],.meta').forEach(function(e){e.remove()});var sw=c.querySelector('.csw');if(sw)sw.dataset.init='model';var mp=c.querySelector('.cp[data-p=model]');if(mp)mp.classList.add('on');
 if(!c.__hAt)blank(c);fix(c)})}
var busy=0;function guard(){if(busy)return;busy=1;document.querySelectorAll('.card[data-heli="1"]').forEach(fix);setTimeout(function(){busy=0},0)}
/* model weather: one Open-Meteo call for all heliport cards */
/* pilot-safety P2-3: missing = "—" (was "00—", "—%"); nothing current for 180 min = dashes */
function k(v){return v==null||v===''||!isFinite(+v)?'\u2014':Math.round(v)}
function N(v){return v==null||v===''||!isFinite(+v)?null:+v}
var HMAX=180*60e3;
function wdir(v){v=N(v);return v==null?'\u2014':String(Math.round(v)%360).padStart(3,'0')+'\u00b0'}
function wind(x){var s=N(x.wind_speed_10m),g=N(x.wind_gusts_10m);if(s==null)return '\u2014';return wdir(x.wind_direction_10m)+' '+Math.round(s)+' kt'+(g!=null&&g>s+5?' G'+Math.round(g):'')}
function vis(x){var v=N(x.visibility);return v==null?'\u2014':(v>=10000?'10+ km':(v/1000).toFixed(1)+' km')}
function pct(v){v=N(v);return v==null?'\u2014':Math.round(v)+'%'}
function blank(c){var tp=c.querySelector('.wxrow .temp');if(tp){tp.textContent='\u2014';tp.style.color=''}
 var d=c.querySelector('.wxd');if(d)d.innerHTML='<span>Wind <b class="num">\u2014</b></span><span>Vis <b>\u2014</b> \u00b7 Cloud <b>\u2014</b></span><span>QNH <b class="num">\u2014</b></span>';
 HM.set(c,'<div class="mg2"><div class="mt2"><span>Model</span><b>No current model weather</b></div></div>');c.__hAt=0}
function warnH(why,e){try{if(window.WSTC&&WSTC.stale)WSTC.stale(why,e);else console.warn('[wx] '+why,e||'')}catch(x){}}
function expire(cs){var n=Date.now();cs.forEach(function(c){if(c.__hAt!==0&&(!c.__hAt||n-c.__hAt>HMAX))blank(c);fix(c)})}
function model(){var cs=[].slice.call(document.querySelectorAll('.card[data-heli="1"]')).filter(function(c){return c.querySelector('[data-la]')});if(!cs.length)return;
 var la=cs.map(function(c){return c.querySelector('[data-la]').dataset.la}).join(','),lo=cs.map(function(c){return c.querySelector('[data-la]').dataset.lo}).join(',');
 fetch('https://api.open-meteo.com/v1/forecast?latitude='+la+'&longitude='+lo+'&current=temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,cloud_cover,pressure_msl&wind_speed_unit=kn&hourly=freezing_level_height&forecast_hours=4&timezone=UTC').then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}).then(function(j){if(!Array.isArray(j))j=[j];
  cs.forEach(function(c,ix){var x=j[ix]&&j[ix].current;if(!x)return;var vt=Date.parse(String(x.time||'').replace(/Z?$/,'Z'));if(!(vt>0)||Date.now()-vt>HMAX)return;
   var tp=c.querySelector('.wxrow .temp');if(tp){tp.textContent=k(x.temperature_2m)+(N(x.temperature_2m)==null?'':'\u00b0');tp.style.color=''}
   var d=c.querySelector('.wxd');if(d)d.innerHTML='<span>Wind <b class="num">'+wind(x)+'</b></span><span>Vis <b>'+vis(x)+'</b> \u00b7 Cloud <b>'+pct(x.cloud_cover)+'</b></span><span>QNH <b class="num">'+k(x.pressure_msl)+'</b></span>';
   var T=function(q,v){return '<div class="mt2"><span>'+q+'</span><b>'+v+'</b></div>'},ws=N(x.wind_speed_10m);HM.set(c,'<div class="mg2">'+T('Wind',ws==null?'\u2014':wdir(x.wind_direction_10m)+' '+Math.round(ws)+' kt')+T('Gust',N(x.wind_gusts_10m)==null?'\u2014':k(x.wind_gusts_10m)+' kt')+T('Vis',vis(x))+T('Cloud',pct(x.cloud_cover))+T('Temp',N(x.temperature_2m)==null?'\u2014':k(x.temperature_2m)+'\u00b0C')+T('QNH',k(x.pressure_msl))+'</div>');c.__hAt=vt;fix(c)});expire(cs)}).catch(function(e){warnH('heliport model weather failed',e);expire(cs)})}
function sync(){var b=document.querySelector('[data-f="heli"]');H.dataset.heliHide=(b&&b.classList.contains('on'))?'1':'0';if(typeof window.applyS==='function')try{window.applyS()}catch(e){}guard();if(window.WM_HPAINT)WM_HPAINT()}
var inited=0;function init(){if(inited)return;inited=1;tag();
 document.addEventListener('click',function(e){var x=e.target.closest&&e.target.closest('[data-f="heli"]');if(x)setTimeout(function(){localStorage.setItem('wm-heli-hide',x.classList.contains('on')?'1':'0');sync()},0)},true);
 var L=document.getElementById('list');if(L)new MutationObserver(function(){if(!busy)setTimeout(guard,0)}).observe(L,{subtree:true,attributes:true,attributeFilter:['data-s'],childList:true,characterData:true});
 sync();model();setInterval(model,15*60e3)}
function pref(){var b=document.querySelector('[data-f="heli"]');if(b&&!b.classList.contains('on')&&localStorage.getItem('wm-heli-hide')==='1')b.click();sync()}
var st=document.createElement('style');st.textContent=
'.hflag{display:none!important;/* MT #352 */margin-top:6px;padding:1px 7px;border-radius:999px;font-size:9.5px;font-weight:600;line-height:16px;letter-spacing:.06em;text-transform:uppercase;color:var(--tx3,#9aa3b2);border:1px solid currentColor;opacity:.85}.card.wfh{display:none!important}'+
'.card[data-s=heli] .badge{background:color-mix(in srgb,var(--tx3,#8E8E93) 22%,transparent)!important;color:var(--tx2,#8E8E93)!important;box-shadow:inset 0 0 0 .5px var(--ln)!important;animation:none!important}'+
'.card[data-s=heli] .badge::before{display:none!important}'+ /* MT t863u: no dot on the status pill (helipads and heliports) */
'.card[data-s=heli],.card[data-s=heli] *{animation-name:none!important}.card[data-s=heli]::before,.card[data-s=heli]::after{animation:none!important}'+
'.card .rwd.hpad{flex:none}svg .hp circle.hp-d{fill:var(--tx);fill-opacity:.82;stroke:none}svg .hp circle.hp-e{fill:none;stroke:var(--bg);stroke-opacity:.9;stroke-width:.8;stroke-dasharray:2.6 2.2}svg .hp circle.hp-t{fill:none;stroke:var(--bg);stroke-width:2.4}svg .hp .hp-h{fill:none;stroke:var(--bg);stroke-width:4;stroke-linecap:butt;stroke-linejoin:miter}svg .hp text.hp-n{fill:var(--bg);fill-opacity:.85;font:700 6.5px -apple-system,sans-serif;text-anchor:middle;letter-spacing:0}.card[data-heli="1"] .csw i{display:none}'+
'.wmf.wmf-aero .chips .c svg,.wmf.wmf-aero .chips .c .fv-heli-ico{display:none!important}'+
'.card[data-s=heli] .why,.card[data-heli="1"] .why,.card[data-s=heli] .csw,.card[data-heli="1"] .csw{display:none!important}'+
'.card[data-heli="1"] .raw{border-top:0!important}'+
'.hnote{margin:6px 0 0;font:500 11.5px/1.35 -apple-system,sans-serif;color:var(--tx3)}.wxd .hsrc{font:600 9.5px/1 -apple-system,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--tx3)}';
document.head.appendChild(st);
/* 13 Nov 2026 (MT t2851u): H sign on every heliport card (WM_ALL_CARDS) at once; the rest stays in init(). */
function pad(){var A=window.WM_ALL_CARDS&&WM_ALL_CARDS.length?WM_ALL_CARDS:[].slice.call(Element.prototype.querySelectorAll.call(document.documentElement,'.card'));
 A.forEach(function(c){if(!isH(c)||Element.prototype.querySelector.call(c,'.hpad'))return;var r=Element.prototype.querySelector.call(c,'.rwd');if(r){r.insertAdjacentHTML('afterend',WM_HELIPAD());r.remove()}})}
window.WM_HPAD_PAINT=pad;
try{pad()}catch(e){}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){try{pad()}catch(e){}});
/* pilot-safety P2-2: tag heliports at once (they showed the baked GO and were counted until load+300 ms) */
try{tag()}catch(e){warnH('heliport tag failed',e)}
if(document.readyState!=='loading')init();else document.addEventListener('DOMContentLoaded',init);
if(document.readyState==='complete')pref();else addEventListener('load',pref);
})();

/* Linked counts: every tile writer (main.html, fv3, wst-main, wst-list, wst-card, wm-final) reads WM_COUNTS().
   MT t2199: top DEPART/CAUTION/NO DEPART (LAND words) ignore every picked filter (province, city, type, status,
   facilities, search, and the GO/CAUTION/INTL/CTRL tiles). They change ONLY with the ICAO/All switch.
   Heliports stay out of the status totals (as before). The list itself still filters. */
(function(){var H=document.documentElement,busy=0;
function ISO(c){var i=c.querySelector('.icao');return /^[A-Z]{4}$/.test(i?i.textContent.trim():'')}
/* t2199: do not exclude wfl-off / hide / wfq / wfh / chide — those are list filters; top boxes stay fixed */
function base(){var all=localStorage.getItem('wm-count')==='all';return [].slice.call(document.querySelectorAll('#list .card')).filter(function(c){
 if(c.dataset.cat==='heliport')return false;return all||ISO(c)})}
window.WM_COUNTS=function(){var b=base(),n={all:b.length,go:0,caution:0,nogo:0,none:0};b.forEach(function(c){var k=c.dataset.s;k=k==='noiap'?'nogo':k;n[k in n?k:'none']++});return n};
/* 13 Nov 2026 (MT t2871u, fix/aerodrome-count-13nov): the three verdict boxes count aerodromes only (heliports have no
   DEPART verdict), so with Count = All they add up to the aerodrome total, while AIRPORTS and the filter include heliports too. One quiet caption in the
   the verdict boxes' i note (MT t2878u: count inside the eye) says what the boxes count, so the two numbers reconcile: aerodromes + heliports = the public total. Counts only;
   no verdict, card or filter changes. */
function cap(n){var b=document.querySelector('#tiles .stfoot .inote, #tiles .inote');if(!b||!n)return;
 if(b.__wmN0==null)b.__wmN0=String(b.dataset.n||'').replace(/<span class="wcnt-i">[\s\S]*$/,'');
 var all=localStorage.getItem('wm-count')==='all',h=0,tot=0;[].slice.call(document.querySelectorAll('#list .card')).forEach(function(c){if(!all&&!ISO(c))return;tot++;if(c.dataset.cat==='heliport')h++});
 var t='<b>Counted:</b> '+n.all+(all?'':' ICAO')+(n.all===1?' aerodrome':' aerodromes');if(n.none)t+=' · '+n.none+' with no weather';
 if(h)t+=' · '+h+(h===1?' heliport/helipad':' heliports/helipads')+' get no verdict';t+=' · '+tot+' total'+(all?'':' (Count: ICAO only)');
 var v=b.__wmN0+'<span class="wcnt-i">'+t+'</span>';if(b.dataset.n!==v){b.dataset.n=v;
  var pp=document.querySelector('.ipop.on');if(pp&&pp.querySelector('.wcnt-i')){var o=pp.querySelector('.wcnt-i');o.innerHTML=t}}}
function paint(){if(busy||typeof window.WM_COUNTS!=='function')return;busy=1;var n=WM_COUNTS();
 document.querySelectorAll('.tiles .tile[data-s] .n').forEach(function(e){var t=e.closest('.tile').dataset.s;if(n[t]!=null&&e.textContent!=String(n[t]))e.textContent=n[t]});
 try{cap(n)}catch(x){}
 setTimeout(function(){busy=0},0)}
var cs=document.createElement('style');cs.textContent='.wcnt-i{display:block;margin-top:8px;padding-top:8px;border-top:.5px solid var(--ln);font-variant-numeric:tabular-nums}.wcnt-i b{font-weight:600}';document.head.appendChild(cs);
window.WM_HPAINT=function(){[0,120,400,900].forEach(function(d){setTimeout(function(){busy=0;paint()},d)})};
function go(){paint();new MutationObserver(function(){paint()}).observe(document.getElementById('list')||document.body,{attributes:true,subtree:true,attributeFilter:['class','data-s','data-cat']});
 document.querySelectorAll('.tiles').forEach(function(t){new MutationObserver(function(){setTimeout(paint,30)}).observe(t,{childList:true,subtree:true,characterData:true})})}
if(document.readyState!=='loading')go();else document.addEventListener('DOMContentLoaded',go);
document.addEventListener('wm:pass',function(){setTimeout(function(){busy=0;paint()},0)});addEventListener('storage',function(e){if(!e.key||e.key==='wm-count')setTimeout(function(){busy=0;paint()},0)});})();



