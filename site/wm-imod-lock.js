/* wm-imod-lock.js, 13 Nov 2026 (MT t2880u). Aerodromes page only (main.html). While an "i" box (.ipop.on, centred by
   wm-info-modal.js) is open: the bottom nav (#wmC) hides and the page behind cannot move, iPad Safari included.
   Lock = body position:fixed at -scrollY on whichever window really scrolls (the index.html shell, or main.html on its own);
   the exact scroll position comes back on close, with no jump. The backdrop swallows touchmove; the box scrolls on its own. */
(function(){if(window.__wmImodLock)return;window.__wmImodLock=1;
var IPHONE=/iPhone|iPod/.test(navigator.userAgent);
var NAV='#wmC.wcdock{transition:opacity .25s ease,transform .3s cubic-bezier(.2,.8,.2,1)}html.wm-imod-open #wmC.wcdock{opacity:0!important;transform:translateY(24px)!important;pointer-events:none!important}'+
 '.ipop.wm-imod{overscroll-behavior:contain}';
function css(d){try{if(d.getElementById('wm-imod-lock-css'))return;var t=d.createElement('style');t.id='wm-imod-lock-css';t.textContent=NAV;d.head.appendChild(t)}catch(e){}}
function lock(w,on){try{var d=w.document,b=d.body,H=d.documentElement;if(!b)return;
 if(on){if(b.dataset.wmLockY!=null)return;if(H.scrollHeight<=w.innerHeight+1&&!(w.scrollY>0))return;/* this window does not scroll (full-height frame) */
  var y=w.scrollY||H.scrollTop||0;b.dataset.wmLockY=String(y);b.style.position='fixed';b.style.top=(-y)+'px';b.style.left='0';b.style.right='0';b.style.width='100%';H.style.overflow='hidden'}
 else{if(b.dataset.wmLockY==null)return;var y0=+b.dataset.wmLockY;delete b.dataset.wmLockY;b.style.position='';b.style.top='';b.style.left='';b.style.right='';b.style.width='';H.style.overflow='';
  var sb=H.style.scrollBehavior;H.style.scrollBehavior='auto';w.scrollTo(0,y0);H.style.scrollBehavior=sb}}catch(e){}}
function P(){try{return window.parent!==window&&window.parent.document?window.parent:null}catch(e){return null}}
var was=false;
function sync(){var open=!!document.querySelector('.ipop.on');if(open===was)return;was=open;var p=P();
 document.documentElement.classList.toggle('wm-imod-open',open);if(p)try{p.document.documentElement.classList.toggle('wm-imod-open',open)}catch(e){}
 if(!IPHONE){lock(window,open);if(p)lock(p,open)}}
function init(){var pops=document.querySelectorAll('.ipop');if(!pops.length)return;css(document);var p=P();if(p)css(p.document);
 pops.forEach(function(x){new MutationObserver(sync).observe(x,{attributes:true,attributeFilter:['class']})});
 document.addEventListener('touchmove',function(e){if(was&&e.target&&e.target.closest&&e.target.closest('.wm-ibk'))e.preventDefault()},{passive:false});
 addEventListener('pagehide',function(){if(was){was=false;lock(window,false);var q=P();if(q)lock(q,false)}});sync()}
if(document.readyState==='complete')setTimeout(init,0);else addEventListener('load',function(){setTimeout(init,0)})})();
