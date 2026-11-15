/* Aerodrome card v3 (MT locked 13 Nov 2026), main.html only (<html data-ad-card="v3">). Styles: wst/ad-card.css.
   This file draws the parts of the card that are built from what other writers already put on it:
   - the flight-condition chip "VFR · VMC": no dot, each word its own colour token. Display only, not a button (MT t277u).
     The .fcb2 badges stay as the hidden source of truth (METAR / model writers keep updating them).
   - the note behind the chip's i button (same centred frosted-glass .ipop box as every other i on the site, opened by
     main.html's iNotes() + wm-info-modal.js). This file only writes the button's data-t / data-n: Now (name, ICAO,
     primary source), a live Sources grid (each field's value and actual source), VFR minimum (CAR 91.06.21 Table 1 / 2),
     Night minimum, then the flight categories and VMC / IMC. No runway lighting, and no source labels on the card surface.
   - the red night pill follows wq.js's engine-driven .wq-nn marker (wst-card.js draws it; this re-draws it when the marker changes)
   - the name fits two lines (20 px, then 18 / 16 px), never an ellipsis.
   Every write is skipped when the DOM already shows it, so the #list observer settles after one pass. */
(function(){
'use strict';
if(document.documentElement.getAttribute('data-ad-card')!=='v3')return;
var L=document.getElementById('list');if(!L)return;
var MIN={t1:['5 km · 1 500 ft','CAR 91.06.21 Table 1 · inside a CTR or ATZ'],t2:['5 km · clear of cloud','CAR 91.06.21 Table 2 · outside a CTR or ATZ'],night:['8 km · 2 500 ft','App default, not a legal minimum']};
var CATS=[['VFR','Above 3 000 ft and 5 SM'],['MVFR','1 000–3 000 ft or 3–5 SM'],['IFR','500–999 ft or 1–3 SM'],['LIFR','Below 500 ft or 1 SM'],['LOW CLOUD','Visibility known, cloud base not reported, so no category is assumed. Check the cloud base yourself.']];
var FCW={VFR:1,MVFR:1,IFR:1,LIFR:1,VMC:1,IMC:1};
var TZF=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Johannesburg',hour:'2-digit',minute:'2-digit'});
function q(c,s){return c.querySelector(s)}
function txt(e){return e?(e.lastChild&&e.lastChild.nodeType===3?e.lastChild.nodeValue:e.textContent).replace(/\s+/g,' ').trim():''}
function esc(x){return String(x).replace(/[<>&"]/g,function(ch){return {'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[ch]})}
function setH(e,h){if(e.__acH!==h){e.innerHTML=h;e.__acH=h}}
function icao(c){var e=q(c,'.icao');return e?e.textContent.trim():''}
function words(c){var b=c.querySelectorAll('.fcb2 .fbadge'),a=[];for(var i=0;i<b.length&&a.length<2;i++){var w=txt(b[i]).toUpperCase();if(w==='LOW CLOUD')return['LOW CLOUD'];if(FCW[w])a.push(w)}return a.length===2?a:null}
function fcHTML(w){return w&&w.length===1?'<b class="wfc-w" data-k="LOW CLOUD">'+w[0]+'</b>':w?'<b class="wfc-w" data-k="'+w[0]+'">'+w[0]+'</b><span class="wfc-s">·</span><b class="wfc-w" data-k="'+w[1]+'">'+w[1]+'</b>'
 :'<b class="wfc-w" data-k="none">—</b><span class="wfc-s">·</span><b class="wfc-w" data-k="none">—</b>'}
function fcFlat(w){return w&&w.length===1?'<span class="wfc-w" data-k="LOW CLOUD">'+w[0]+'</span>':w?'<span class="wfc-w" data-k="'+w[0]+'">'+w[0]+'</span><span class="wfc-s">·</span><span class="wfc-w" data-k="'+w[1]+'">'+w[1]+'</span>':'<span class="wfc-w" data-k="none">—</span>'}
function srcOf(c){var heli=c.dataset.s==='heli'||!!(window.AD_CLASS&&window.AD_CLASS[icao(c)]);
 var s=heli?'Model':(c.dataset.src||(c.dataset.model==='1'?'Model':'')),at=heli?'':(c.dataset.srcAt||'');
 if(!at){var m=q(c,'.cp[data-p=model]'),vt=m&&m.dataset.vt;if(vt){var t=Date.parse(/Z$|[+-]\d\d:?\d\d$/.test(vt)?vt:vt+'Z');if(isFinite(t))at=TZF.format(new Date(t))}}
 return [String(s||'Weather').toUpperCase(),at||'—']}
function fit(c){var nm=q(c,'.ch h2 .nm');if(!nm||!c.isConnected||!nm.offsetWidth)return;var key=nm.textContent+'|'+nm.offsetWidth;if(c.__acFit===key)return;
 var S=[[20,23],[18,21],[16,19]];for(var i=0;i<S.length;i++){c.style.setProperty('--ad-nm',S[i][0]+'px');c.style.setProperty('--ad-lh',S[i][1]+'px');if(nm.getBoundingClientRect().height<=S[i][1]*2+1)break}
 c.__acFit=nm.textContent+'|'+nm.offsetWidth}
function zTime(raw,re){var x=raw&&re.exec(raw);if(!x)return '';var d=new Date();d=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),+x[1],+x[2],+x[3]));if(d-Date.now()>864e5)d.setUTCMonth(d.getUTCMonth()-1);return TZF.format(d)}
function metarTime(c){var m=q(c,'.cp[data-p=metar] .mono');return zTime(m&&m.textContent,/^\s*(?:METAR|SPECI)\s+[A-Z0-9]{4}\s+(\d\d)(\d\d)(\d\d)Z/)}
function tafTime(c){var m=q(c,'.cp[data-p=taf] .mono');return zTime(m&&m.textContent,/^\s*TAF\s+(?:AMD\s+)?[A-Z0-9]{4}\s+(\d\d)(\d\d)(\d\d)Z/)||((srcOf(c)[0]==='TAF'&&srcOf(c)[1]!=='—')?srcOf(c)[1]:'')}
function modelTimes(c){var m=q(c,'.cp[data-p=model]'),vt=m&&m.dataset.vt;var t=vt?Date.parse(/Z$|[+-]\d\d:?\d\d$/.test(vt)?vt:vt+'Z'):NaN;return isFinite(t)?[TZF.format(new Date(t)),TZF.format(new Date(t+36e5))]:null}
function srcKey(s){s=String(s||'').toLowerCase();if(s==='metar'||s==='speci')return 'metar';if(s==='taf')return 'taf';if(s==='model'||s==='open-meteo'||s==='om')return 'model';return ''}
function usedOf(c){return (c.__wm&&(c.__wm.weatherUsed||(c.__wm.v2&&c.__wm.v2.weatherUsed)))||null}
function fieldKey(c){var u=usedOf(c),k=srcKey((u&&u.src)||c.dataset.src);if(!k&&c.dataset.model==='1')k='model';return k||srcKey(srcOf(c)[0])}
function windKey(c){var u=usedOf(c),k=srcKey((c.__wm&&c.__wm.windSource)||(u&&u.windSrc)||(u&&u.src)||c.dataset.src);if(!k&&c.dataset.model==='1')k='model';return k||fieldKey(c)}
function stripTag(t){return String(t||'').replace(/\s+/g,' ').trim().replace(/\s+(METAR|TAF|Model)$/,'')}
function afterLab(t,lab){t=stripTag(t);return t.replace(new RegExp('^'+lab+'\\s*','i'),'').trim()||'—'}
function visVal(t){t=afterLab(t,'Vis');return t.replace(/\s*·\s*Sky\s+/,' · ').replace(/\s*·\s*Cloud\s+/,' · ')||'—'}
function visLab(t,model){t=stripTag(t);return (/Cloud\b/i.test(t)||(model&&!/\b(Sky|CAVOK|FEW|SCT|BKN|OVC|VV|NSC|NCD|SKC|CLR)\b/i.test(t)))?'Vis & Cloud':'Vis & Sky'}
/* 13 Nov 2026 (MT t2879u): M = METAR, T = TAF, F = forecast model. */
var SRCL={metar:['M','METAR (NOAA AWC), official observation'],taf:['T','TAF (NOAA AWC), official forecast'],model:['F','Forecast model (Open-Meteo), not an official observation']};
function srcBadge(k,c,used,withTime){var L=SRCL[k],tm='';if(withTime)tm=k==='metar'?metarTime(c):k==='taf'?tafTime(c):'';
 if(!L){var o=srcOf(c)[0]||'Weather';used['W']='W = '+esc(o);L=['W']}else used[L[0]]=L[0]+' = '+L[1];
 return '<span class="s"><b class="ad-sb" aria-label="'+esc(L[1]||srcOf(c)[0]||'Weather')+'">'+L[0]+'</b>'+(tm?' '+esc(tm):'')+'</span>'}
function srcCell(val,b){return esc(val||'—')+' · '+b}
function whenOf(k,c,u){if(k==='model'){var w=modelTimes(c);return 'Forecast'+(w?' '+w[0]+'\u2013'+w[1]+' SAST':'')}var tm=k==='taf'?tafTime(c):metarTime(c),t=+(u&&u.time||0),m;if(t&&t<1e12)t*=1e3;m=t?Math.round((Date.now()-t)/6e4):-1;return (k==='taf'?'TAF':'METAR')+(tm?' '+tm+' SAST':'')+(m>=0?' ('+(m<120?m+' min':Math.round(m/60)+' h')+' ago)':'')}
function skyOf(u,line){var o=((u&&(u.raw||u.wx))||'').match(/AUTO|(?:NCD|NSC|SKC|CLR|CAVOK|(?:FEW|SCT|BKN|OVC|VV)(?:\d{3}|\/\/\/))/g);if(o){o=o.join(' ');return o==='AUTO'?'AUTO, no cloud group':o}var m=String(line||'').match(/·\s*((?:Sky|Cloud|Ceil)\s+.+)$/i);return m?m[1].replace(/\s+/g,' ').trim():u&&u.low!=null?Math.round(+u.low)+'% low cloud':u&&u.cc!=null?Math.round(+u.cc)+'% cloud':'no cloud group'}
/* the i note: what the card says now, each weather field's live value and source, then the minimums and category key. */
function note(c,b,w){
 var cat=c.dataset.cat,t=(cat==='international'||cat==='controlled')?MIN.t1:MIN.t2;
 var fK=fieldKey(c),wK=windKey(c),model=c.dataset.model==='1'||fK==='model'||wK==='model'||/model/i.test(c.dataset.src||'');
 var r=function(k,v,sm){return '<span class="ad-in-r"><span class="k">'+k+'</span><span class="v">'+v+(sm?'<small>'+sm+'</small>':'')+'</span></span>'};
 var win=modelTimes(c),srcNote='';
 var wr=q(c,':scope > .wxrow'),sp=wr?wr.querySelectorAll('.wxd span'):[],tp=wr&&q(wr,'.temp');
 var wind=afterLab(sp[0]&&sp[0].textContent,'Wind'),temp=afterLab(tp&&tp.textContent,''),vis=visVal(sp[1]&&sp[1].textContent),qnh=afterLab(sp[2]&&sp[2].textContent,'QNH');
 if(!temp||temp==='—')temp='—';
 var u=usedOf(c),tK=srcKey((u&&(u.tempSrc||u.src))||fK)||fK,vK=srcKey((u&&(u.visSrc||u.ceilSrc||u.src))||fK)||fK,qK=srcKey((u&&(u.qnhSrc||u.src))||fK)||fK;
 var used={},grid='<span class="ad-in-src">'+
  '<span class="k">Wind</span><span class="v">'+srcCell(wind,srcBadge(wK,c,used,true))+'</span>'+
  '<span class="k">Temp</span><span class="v">'+srcCell(temp,srcBadge(tK,c,used,true))+'</span>'+
  '<span class="k">'+esc(visLab(sp[1]&&sp[1].textContent,vK==='model'))+'</span><span class="v">'+srcCell(vis,srcBadge(vK,c,used,false))+'</span>'+
  '<span class="k">QNH</span><span class="v">'+srcCell(qnh,srcBadge(qK,c,used,false))+'</span></span>'+
  '<span class="ad-sl">'+Object.keys(used).map(function(k){return '<span>'+used[k].replace(/^(\w) = /,'<b class="ad-sb">$1</b> ')+'</span>'}).join('')+'</span>';
 if(fK==='model'&&wK==='model')srcNote='No METAR at this field · Open-Meteo model'+(win?', valid '+win[0]+'\u2013'+win[1]+' SAST':'');
 else if(wK==='model'&&fK!=='model')srcNote='No wind in the METAR · Open-Meteo model'+(win?', valid '+win[0]+'\u2013'+win[1]+' SAST':'');
 else if(wK==='taf'&&fK==='metar')srcNote='Wind from the TAF · other fields from the METAR'+(metarTime(c)?' '+metarTime(c)+' SAST':'');
 else if(fK==='model')srcNote='Open-Meteo model'+(win?', valid '+win[0]+'\u2013'+win[1]+' SAST':'');
 var line=sp[1]&&sp[1].textContent,vTxt=(afterLab(line,'Vis').split(/\s*·\s*/)[0]||'—').trim(),sky=skyOf(u,line),when=whenOf(vK||fK,c,u);
 var nowX=(!w&&(!vTxt||vTxt==='—'))?'No visibility or cloud reported':'Vis '+vTxt+' · '+(w&&w[0]==='LOW CLOUD'?(sky?sky+', base unknown':'base unknown'):(sky||'Sky —'))+' · '+when;
 var h='<span class="ad-in">'+r('Now','<span class="wfc wfc-flat">'+fcFlat(w)+'</span>',nowX)+r('Sources',grid,srcNote)+r('VFR minimum',t[0],t[1])+r('Night minimum',MIN.night[0],MIN.night[1])+'</span>'+
  '<span class="ad-in-x"><span class="ad-in-h">Flight category · set by the worse of ceiling or visibility</span>'+
  CATS.map(function(x){return '<span class="ad-in-c"><span class="wfc wfc-flat"><span class="wfc-w" data-k="'+x[0]+'">'+x[0]+'</span></span><span>'+x[1]+'</span></span>'}).join('')+
  '<span class="ad-in-p">VFR and MVFR are VMC; IFR and LIFR are IMC. '+(model?'Open-Meteo model is not an official observation.':'Indicative only.')+' The pilot in command decides.</span></span>';
 if(b.dataset.t!=='Flight conditions')b.dataset.t='Flight conditions';if(b.dataset.n!==h)b.dataset.n=h;
 if(b.getAttribute('aria-label')!=='Flight conditions and minimums')b.setAttribute('aria-label','Flight conditions and minimums')}
function card(c){
 var wr=q(c,':scope > .wxrow');
 if(wr){var e=q(c,':scope > .ad-src');if(e)e.remove();
  var tags=wr.querySelectorAll('.wmtag,.wwtag');for(var i=0;i<tags.length;i++)tags[i].remove()}
 var cr=q(c,'.crow'),fc=cr&&q(cr,'.fcb2');
 if(fc){var ch=q(cr,':scope > .wfc');if(!ch){ch=document.createElement('span');ch.className='wfc'}if(ch.nextElementSibling!==fc)cr.insertBefore(ch,fc);
  var w=words(c);setH(ch,fcHTML(w));var lab=w?(w.length===1?'Flight conditions: '+w[0]:'Flight conditions: '+w[0]+', '+w[1]):'Flight conditions: no data';if(ch.getAttribute('aria-label')!==lab){ch.setAttribute('aria-label',lab);ch.setAttribute('role','img')}
  var i=q(fc,'.inote');if(!i){i=document.createElement('button');i.className='inote';i.textContent='i';fc.appendChild(i)}note(c,i,w)}
 /* red night pill: redraw when wq.js adds / removes / switches its marker */
 var nn=q(c,'.wq-nn'),sp=q(c,'.wsun2'),want=nn?(nn.classList.contains('wq-nn-cau')?'land':'dep'):'';
 if(sp&&typeof window.WMCARD_SUN==='function'&&(sp.__acN!==want||sp.classList.contains('wp-night')!==!!nn)){sp.__acN=want;window.WMCARD_SUN(c)}
 fit(c)}
var busy=0;
function pass(){busy=0;var cs=(window.WM_ALL_CARDS&&WM_ALL_CARDS.length)?WM_ALL_CARDS:L.children;for(var i=0;i<cs.length;i++)if(cs[i].classList&&cs[i].classList.contains('card'))card(cs[i]);mo.takeRecords()}
function queue(){if(!busy){busy=1;requestAnimationFrame(pass)}}
var mo=new MutationObserver(queue);mo.observe(L,{childList:true,subtree:true});
['wm:pass','wst:data','wm:phase','wm:page'].forEach(function(n){document.addEventListener(n,queue)});addEventListener('resize',queue);
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(queue);

window.WMADCARD={pass:pass};
queue();
})();
