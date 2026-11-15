/* Official SACAA AIP GEN 2.3 / ICAO Annex 4 Civil Land sign in the empty
   76px runway slot. Same pad, stroke, colours and theme tokens as the
   heliport (H) diagram, so it inverts between day and night the same way
   (--tx fill, --bg stroke). Applies only to fields with no runway data.
   Heliport cards and fields with runway lines are left alone.
   Military aerodromes with no runway get the matching Military Land sign
   (two concentric circles) in the same pad, size, frame, colours and layout;
   only the symbol changes. */
(function(){
'use strict';
var ST=document.createElement('style');
ST.id='no-rwy-civil-land-10nov';
ST.textContent=
'.card .rwd.cad{flex:none}'+
'svg.cad .cad-d{fill:var(--tx);fill-opacity:.82;stroke:none}'+
'svg.cad .cad-e{fill:none;stroke:var(--bg);stroke-opacity:.9;stroke-width:.8;stroke-dasharray:2.6 2.2}'+
'svg.cad .cad-c{fill:none;stroke:var(--bg);stroke-width:2.4;stroke-linecap:butt}'+
'svg.cad .cad-tick-box{fill:var(--bg);stroke:none}'+
'svg.cad .mad-c,svg.cad .mad-i{fill:none;stroke:var(--bg);stroke-width:2.4;stroke-linecap:butt}';
document.head.appendChild(ST);

var R=17, SW=2.4, TL=6.2, TW=2.4, OUTER=R+SW/2, HW=TW/2;
var TICKS=
  '<rect class="cad-tick-box" x="'+(-HW)+'" y="'+(-(OUTER+TL))+'" width="'+TW+'" height="'+TL+'"/>'+
  '<rect class="cad-tick-box" x="'+OUTER+'" y="'+(-HW)+'" width="'+TL+'" height="'+TW+'"/>'+
  '<rect class="cad-tick-box" x="'+(-HW)+'" y="'+OUTER+'" width="'+TW+'" height="'+TL+'"/>'+
  '<rect class="cad-tick-box" x="'+(-(OUTER+TL))+'" y="'+(-HW)+'" width="'+TL+'" height="'+TW+'"/>';
var INNER='<circle class="cad-d" r="35"/><circle class="cad-e" r="31.5"/><circle class="cad-c" r="17"/>'+TICKS;
/* ICAO Annex 4 / GEN 2.3 Military Land: two concentric circles, same pad and
   same outer circle as Civil Land (r=17). Inner circle 3/5 of that radius. No ticks. */
var MIL='<circle class="cad-d" r="35"/><circle class="cad-e" r="31.5"/><circle class="mad-c" r="17"/><circle class="mad-i" r="10.2"/>';
function svg(mil){
  if(mil) return '<svg class="rwd cad mad" viewBox="-40 -40 80 80" role="img" aria-label="Military land aerodrome symbol"><circle r="38"/><g class="cad-g">'+MIL+'</g></svg>';
  return '<svg class="rwd cad" viewBox="-40 -40 80 80" role="img" aria-label="Civil land aerodrome symbol"><circle r="38"/><g class="cad-g">'+INNER+'</g></svg>';
}
function isHeli(c){
  if(!c)return true;
  if(c.dataset.heli==='1'||c.dataset.s==='heli'||c.dataset.cat==='heliport')return true;
  var i=c.querySelector('.icao');
  var id=i&&i.textContent.trim();
  return !!(id&&window.AD_CLASS&&AD_CLASS[id]);
}
function isMil(c){
  if(!c)return false;
  if(c.dataset.adType==='military')return true;
  var i=c.querySelector('.icao');
  var id=i&&i.textContent.trim();
  var D=window.WM_AD_TYPES||{};
  return !!(id&&D[id]&&D[id].t==='military');
}
function isEmpty(r,c){
  if(!r||r.classList.contains('hpad'))return false;
  if(r.classList.contains('cad'))return false;
  if(r.querySelector('line.r'))return false;
  if(isHeli(c||r.closest('.card')))return false;
  return true;
}
function needsMil(r,c){
  if(!r||!c||!isMil(c)||isHeli(c))return false;
  if(r.querySelector('line.r')||r.classList.contains('hpad'))return false;
  if(r.classList.contains('mad'))return false;
  return r.classList.contains('cad')||isEmpty(r,c);
}
var TPL={};
function make(mil){var k=mil?'m':'c';if(!TPL[k]){var t=document.createElement('template');t.innerHTML=svg(mil);TPL[k]=t.content.firstElementChild}return TPL[k].cloneNode(true)}
function one(r){
    var c=r.closest('.card');
    if(!c)return;
    if(needsMil(r,c)){ r.replaceWith(make(true)); return; }
    if(!isEmpty(r,c))return;
    r.replaceWith(make(false));
}
/* perf 11 Nov 2026: after the first full paint, a list change only repaints the runway symbols inside or around the
   added nodes (a symbol only changes when its own card's nodes change), not all 640 cards on every change. */
function scoped(ms){var seen=new Set();ms.forEach(function(m){m.addedNodes.forEach(function(n){var e=n.nodeType===1?n:n.parentElement;if(!e||!e.isConnected)return;
  var up=e.closest('.card .rwd');if(up&&!seen.has(up)){seen.add(up);one(up)}
  if(n.nodeType===1){if(n.matches('.card .rwd')&&!seen.has(n)){seen.add(n);one(n)}n.querySelectorAll('.card .rwd').forEach(function(r){if(!seen.has(r)){seen.add(r);one(r)}})}})})}
/* 13 Nov 2026 (MT t2851u): stamp every card (WM_ALL_CARDS) as soon as this runs, no load wait. */
function cards(){
  var A=window.WM_ALL_CARDS, out=A&&A.length?A.slice():[], seen=new Set(out);
  Element.prototype.querySelectorAll.call(document.documentElement,'.card').forEach(function(c){if(!seen.has(c)){seen.add(c);out.push(c)}});
  return out;
}
function paint(){
  cards().forEach(function(c){
    var r=Element.prototype.querySelector.call(c,'.rwd');
    if(r)one(r);
  });
}
function watch(){
  var L=document.getElementById('list')||document.getElementById('wsp-cards');
  if(L&&!L.__cadObs){L.__cadObs=1;new MutationObserver(scoped).observe(L,{childList:true,subtree:true})}
}
window.WM_NRWY_PAINT=paint;
paint();watch();
/* no-op safety passes */
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){paint();watch()});
if(document.readyState!=='complete')addEventListener('load',function(){paint();watch()});
})();
