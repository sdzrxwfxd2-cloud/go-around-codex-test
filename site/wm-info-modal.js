/* Info popups centred (MT t1854): every "i" / eye info box (.ipop, opened by any .inote) shows in the middle
   of the screen over a blurred, dimmed backdrop. Tap the backdrop, the X or press Esc to close.
   Content and theme colours of each box are untouched; only its position and the backdrop change. */
(function(){if(window.__wmInfoModal)return;window.__wmInfoModal=1;
var IPHONE=/iPhone|iPod/.test(navigator.userAgent);
if(IPHONE)try{document.documentElement.classList.add('wm-iphone')}catch(e){}
var S='html:not(#e1):not(#e2):not(#e3):not(#e4):not(#e5):not(#e6):not(#e7) body ';
var SI='html.wm-iphone'+S.slice(4);
var css=
S+'.ipop.wm-imod:not(#z){position:fixed!important;left:50%!important;top:50%!important;right:auto!important;bottom:auto!important;'+
'width:min(420px,calc(100vw - 24px))!important;max-height:calc(100dvh - 24px)!important;height:auto!important;overflow:auto!important;-webkit-overflow-scrolling:touch;'+
'box-sizing:border-box;padding:16px 44px 16px 18px!important;z-index:2147483001!important;margin:0!important;'+
'transform:translate(-50%,-50%) scale(.94)!important;opacity:0;pointer-events:none;transition:opacity .25s ease,transform .3s cubic-bezier(.2,.8,.2,1)!important}'+
S+'.ipop.wm-imod.on:not(#z){transform:translate(-50%,-50%) scale(1)!important;opacity:1!important;pointer-events:auto!important}'+
S+'.wm-ibk{position:fixed;inset:0;height:100dvh;z-index:2147483000;background:rgba(0,0,0,.32);opacity:0;pointer-events:none;transition:opacity .25s ease;'+
'-webkit-backdrop-filter:blur(10px) saturate(1.2)!important;backdrop-filter:blur(10px) saturate(1.2)!important}'+
S+'.wm-ibk.on{opacity:1;pointer-events:auto}'+
S+'.ipop .wm-ix{position:absolute;top:8px;right:8px;width:28px;height:28px;border:0;padding:0;border-radius:14px;display:grid;place-items:center;'+
'background:var(--gl2,rgba(127,127,127,.18));color:var(--tx2,inherit);font:500 18px/1 -apple-system,sans-serif;cursor:pointer}'+
'@media (prefers-reduced-motion:reduce){'+S+'.ipop.wm-imod,'+S+'.wm-ibk{transition:none!important}}'+
SI+'.ipop.wm-imod:not(#z){height:65dvh!important;max-height:65dvh!important;overflow:hidden!important;display:flex!important;flex-flow:column!important;padding:12px 16px 16px!important}'+
SI+'.ipop .wm-ibody{flex:1;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch;padding-right:36px}'+
SI+'.ipop .wm-ix{width:36px;height:36px;border-radius:18px;font-size:22px;z-index:2}'+
SI+'.ipop .wm-ix:after{content:"";position:absolute;inset:-4px}';
function init(){var pops=document.querySelectorAll('.ipop');if(!pops.length)return;
 var st=document.createElement('style');st.id='wm-info-modal-css';st.textContent=css;document.head.appendChild(st);
 var bk=document.createElement('div');bk.className='wm-ibk';bk.setAttribute('aria-hidden','true');document.body.appendChild(bk);
 var cur=null;
 function close(){pops.forEach(function(p){p.classList.remove('on');clearTimeout(p._t)})}
 function wrap(o){if(!IPHONE||o.querySelector('.wm-ibody'))return;var b=document.createElement('div');b.className='wm-ibody';while(o.firstChild)b.appendChild(o.firstChild);o.appendChild(b)}
 function sync(){var open=null;pops.forEach(function(p){if(p.classList.contains('on'))open=p});bk.classList.toggle('on',!!open);
  if(open){clearTimeout(open._t);open._t=0;wrap(open);
   if(!open.querySelector(':scope > .wm-ix')){var x=document.createElement('button');x.type='button';x.className='wm-ix';x.setAttribute('aria-label','Close');x.textContent='\u00d7';open.appendChild(x)}
   if(open!==cur){cur=open;setTimeout(function(){var x=open.querySelector('.wm-ix');x&&x.focus({preventScroll:true})},60)}}
  else cur=null;place();
  /* eye-fix: the pinned GO/CAUTION/NO-GO bar (#wmPin) lives in the top page, above this frame's backdrop, so it covered the box. Fade it out while a box is open. */
  try{if(window.parent!==window){var pd=parent.document;if(!pd.getElementById('wm-imod-top')){var t=pd.createElement('style');t.id='wm-imod-top';
   t.textContent='#wmPin{transition:opacity .25s ease}html.wm-imod-open #wmPin{opacity:0!important;pointer-events:none!important}';pd.head.appendChild(t)}
   pd.documentElement.classList.toggle('wm-imod-open',!!open)}}catch(e){}}
 pops.forEach(function(p){p.classList.add('wm-imod');p.setAttribute('role','dialog');p.setAttribute('aria-modal','true');
  if(p.parentNode!==document.body)document.body.appendChild(p);
  new MutationObserver(sync).observe(p,{attributes:true,attributeFilter:['class'],childList:true});
  p.addEventListener('click',function(e){if(e.target.closest('.wm-ix')){e.stopPropagation();close()}else e.stopPropagation()})});
 bk.addEventListener('click',function(e){e.stopPropagation();close()});
 addEventListener('keydown',function(e){if(e.key==='Escape'&&bk.classList.contains('on'))close()});
 /* the page's own timer hides the box after 6 s; a centred box stays until closed */
 /* eye-fix: inside the full-height iframe (index.html shell) 50% of the frame is thousands of px below the screen,
    so the box sat off-screen and only the dimmed backdrop showed. Centre it on the visible part of the frame instead. */
 function place(){if(!cur)return;var y=null;try{if(window.parent!==window&&window.frameElement){var r=frameElement.getBoundingClientRect(),
   ph=parent.innerHeight,a=Math.max(0,-r.top),z=Math.min(innerHeight,ph-r.top);if(z>a)y=Math.round((a+z)/2)}}catch(e){}
  if(y==null)cur.style.removeProperty('top');else cur.style.setProperty('top',y+'px','important');
  if(IPHONE){var h=Math.round((parent.innerHeight||innerHeight)*.65);cur.style.setProperty('height',h+'px','important');cur.style.setProperty('max-height',h+'px','important')}
  else if(y!=null){var mh=Math.max(160,Math.round((parent.innerHeight||innerHeight)-24));cur.style.setProperty('max-height',mh+'px','important')}}
 try{if(window.parent!==window){parent.addEventListener('scroll',place,{passive:true});parent.addEventListener('resize',place)}}catch(e){}
 document.addEventListener('click',function(){setTimeout(sync,0)});
 sync()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init()})();
