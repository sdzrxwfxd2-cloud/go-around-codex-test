/* Sitewide first-load inline loading bars. First load only: once a field is
   revealed it stays revealed. Manual refresh (wst-refresh / Refresh FX) is not hooked. */
(function(){
  if(window.WMLoad) return;
  var ready = typeof WeakSet === 'function' ? new WeakSet() : null;
  var groups = {obs:false, model:false, flights:false, ops:false};
  var timers = {};
  var started = false;

  function isReady(el){
    return !!(el && (el.classList.contains('mk-ready') || (ready && ready.has(el))));
  }
  function markReady(el){
    if(!el) return;
    el.classList.add('mk-ready');
    if(ready) ready.add(el);
  }
  function ph(el, on, opts){
    if(!el || !el.classList) return;
    opts = opts || {};
    if(on){
      if(isReady(el)) return;
      el.classList.add('mk-ph');
      el.classList.remove('mk-in');
      return;
    }
    if(el.classList.contains('mk-ph')){
      el.classList.remove('mk-ph');
      if(!opts.silent){
        void el.offsetWidth;
        el.classList.add('mk-in');
      }
    }
    markReady(el);
  }
  function each(root, sel, fn){
    if(!root) return;
    var list;
    try{ list = root.querySelectorAll(sel); }catch(e){ return; }
    for(var i=0;i<list.length;i++) fn(list[i]);
  }
  function phAll(root, sel, on, opts){
    each(root || document, sel, function(el){ ph(el, on, opts); });
  }

  function icaoOf(c){
    var i = c && c.querySelector && c.querySelector('.icao');
    return (i && i.textContent || '').trim();
  }
  function isHeli(c){
    if(!c) return false;
    if(c.dataset.s === 'heli' || c.dataset.heli === '1' || c.dataset.cat === 'heliport') return true;
    var ic = icaoOf(c);
    if(ic && window.AD_CLASS && AD_CLASS[ic]) return true;
    var b = c.querySelector && c.querySelector('.badge');
    var t = (b && b.textContent || '').replace(/\s+/g,' ').trim().toUpperCase();
    return t === 'HELIPAD' || t === 'HELIPORT';
  }

  var CARD_OBS = '.temp, .wxd b, .wxd .wmtag, .fcb2 .fbadge, .cp .mono, .meta .age, .meta .nxt, .why';
  var CARD_SUN = '.wsun2, .wfzl2';
  var DETAIL_OBS = '#vs, #vw, #verd .wupd, #verd .vsuit .kv>div>span:last-child, .boxhd .age, .fcb .fbadge, .wxg b, .dec li, #wm-prio, .rawtop .rawb';
  var DETAIL_MODEL = '#mhr, #mhr .mht b, #mhr .mht small, #mhr .mx span, #omk>div>span:last-child, #s-wx .wfzl2, #s-wx .wda2, #s-wx .wsun2';
  var FLIGHTS = '#fbk>div>span:last-child, #fbl .fn b, #fbl .fn small, #fbl .ff';
  var OPS = '#app .sum .n, #cT, #cO, #cW, #cE';

  function waitCard(c, on){
    if(!c || !c.classList || !c.classList.contains('card')) return;
    if(on){
      if(c.dataset.mkLoad === '1') return;
      c.dataset.mkLoad = '1';
      phAll(c, CARD_OBS, true);
      phAll(c, CARD_SUN, true);
      if(!isHeli(c)){
        var b = c.querySelector('.badge');
        if(b) ph(b, true);
        if(!c.dataset.mkS) c.dataset.mkS = c.dataset.s || 'none';
        c.dataset.s = 'none';
        c.classList.add('mk-wait');
      } else {
        releaseHeliBadge(c);
      }
    } else {
      revealCard(c, 'all');
    }
  }

  function releaseHeliBadge(c){
    if(!isHeli(c)) return;
    var b = c.querySelector('.badge');
    if(b){
      b.classList.remove('mk-ph');
      b.classList.remove('mk-in');
      markReady(b);
    }
    c.classList.remove('mk-wait');
    /* Keep the static HELIPAD / HELIPORT pill; do not force data-s=none. */
  }

  function revealCard(c, group){
    if(!c) return;
    if(group === 'obs' || group === 'all'){
      phAll(c, CARD_OBS, false);
      var b = c.querySelector('.badge');
      if(b && !isHeli(c)) ph(b, false);
      else releaseHeliBadge(c);
      c.classList.remove('mk-wait');
    }
    if(group === 'model' || group === 'all'){
      phAll(c, CARD_SUN, false);
    }
  }

  function reveal(group){
    if(groups[group]) return;
    groups[group] = true;
    if(group === 'obs'){
      var cards = window.WM_ALL_CARDS || document.querySelectorAll('.card');
      for(var i=0;i<cards.length;i++) revealCard(cards[i], 'obs');
      phAll(document, DETAIL_OBS, false);
    } else if(group === 'model'){
      var cards2 = window.WM_ALL_CARDS || document.querySelectorAll('.card');
      for(var j=0;j<cards2.length;j++) revealCard(cards2[j], 'model');
      phAll(document, DETAIL_MODEL, false);
    } else if(group === 'flights'){
      phAll(document, FLIGHTS, false);
      var r = document.getElementById('fbr');
      if(r){ r.classList.remove('mk-radar-wait'); markReady(r); }
      var fbl = document.getElementById('fbl');
      if(fbl) markReady(fbl);
    } else if(group === 'ops'){
      phAll(document, OPS, false);
    }
  }

  function schedule(group, ms){
    if(groups[group]) return;
    if(timers[group]) clearTimeout(timers[group]);
    timers[group] = setTimeout(function(){
      timers[group] = 0;
      requestAnimationFrame(function(){ requestAnimationFrame(function(){ reveal(group); }); });
    }, ms == null ? 0 : ms);
  }


  function phaseLabels(){
    var tiles=document.getElementById('tiles');
    if(!tiles) return;
    var mode='depart';
    try{ if(localStorage.getItem('wm.phaseMode')==='land') mode='land'; }catch(e){}
    var words={go:{depart:'DEPART',land:'LAND'},caution:{depart:'CAUTION',land:'CAUTION'},nogo:{depart:'NO DEPART',land:'NO LAND'}};
    each(tiles, '.tile', function(t){
      var k=t.querySelector('.k'); if(!k) return;
      var w=words[t.dataset.s]; if(!w) return;
      var label=w[mode];
      var d=k.querySelector('.d');
      var cur=k.textContent.replace(/\s+/g,' ').trim();
      if(cur===label) return;
      k.textContent='';
      if(d) k.appendChild(d);
      k.appendChild(document.createTextNode(label));
    });
  }

  function waitPage(){
    /* Status bar (#tiles / .stfoot) stays live — no first-load bars. */
    phAll(document, DETAIL_OBS, true);
    phAll(document, DETAIL_MODEL, true);
    phAll(document, FLIGHTS, true);
    var r = document.getElementById('fbr');
    if(r && !isReady(r)) r.classList.add('mk-radar-wait');
    var cards = window.WM_ALL_CARDS || document.querySelectorAll('#list .card, .card');
    for(var i=0;i<cards.length;i++) waitCard(cards[i], true);
  }

  function kindOf(url){
    if(!url) return '';
    var u = String(url);
    if(/\/api\/wx-now(?:\?|$)/.test(u) || /\/api\/metar(?:\?|$)/.test(u) || /\/api\/taf(?:\?|$)/.test(u)) return 'obs';
    if(/\/api\/flights(?:\?|$)/.test(u)) return 'flights';
    if(/open-meteo\.com/.test(u) || /\/api\/model-weather(?:\?|$)/.test(u) || /model-weather/.test(u)) return 'model';
    if(/\/api\/ops(?:\?|$)/.test(u)) return 'ops';
    return '';
  }

  function hookFetch(){
    if(!window.fetch || window.fetch.__wmLoad) return;
    var orig = window.fetch;
    function wrapped(input, init){
      var url = '';
      try{ url = typeof input === 'string' ? input : (input && input.url) || ''; }catch(e){}
      var kind = kindOf(url);
      var p = orig.apply(this, arguments);
      if(kind && p && typeof p.then === 'function'){
        var done = function(){ schedule(kind, 40); if(kind === 'obs') schedule('model', 80); };
        p.then(done, done);
      }
      return p;
    }
    wrapped.__wmLoad = 1;
    try{ Object.defineProperty(wrapped, 'name', {value:'fetch'}); }catch(e){}
    window.fetch = wrapped;
  }

  function onData(){
    /* Store updated — still first-load only; schedule after writers finish. */
    if(!groups.obs) schedule('obs', 40);
    if(!groups.model) schedule('model', 80);
  }

  function watchHeli(){
    var L = document.getElementById('list') || document.getElementById('verd') || document.getElementById('s-wx');
    if(!L || !window.MutationObserver) return;
    new MutationObserver(function(ms){
      for(var i=0;i<ms.length;i++){
        var t = ms[i].target;
        if(ms[i].type === 'attributes' && t && t.classList && t.classList.contains('card') && isHeli(t)){
          releaseHeliBadge(t);
        }
        if(ms[i].addedNodes){
          ms[i].addedNodes.forEach(function(n){
            if(n.nodeType === 1 && n.classList && n.classList.contains('card')) waitCard(n, true);
            if(n.nodeType === 1 && n.querySelectorAll){
              n.querySelectorAll('.card').forEach(function(c){ waitCard(c, true); });
              if(n.classList && n.classList.contains('wupd') && !n.closest('#tiles, .stfoot')) ph(n, true);
              n.querySelectorAll && n.querySelectorAll('.wupd').forEach(function(el){ if(!el.closest('#tiles, .stfoot')) ph(el, true); });
              n.querySelectorAll && n.querySelectorAll('.wsun2,.wfzl2').forEach(function(el){
                var card = el.closest && el.closest('.card');
                if(card && !groups.model) ph(el, true);
              });
            }
          });
        }
      }
    }).observe(L, {subtree:true, childList:true, attributes:true, attributeFilter:['data-s','data-heli']});
  }

  function start(){
    if(started) return;
    started = true;
    hookFetch();
    phaseLabels();
    waitPage();
    watchHeli();
    document.addEventListener('wst:data', onData);
    /* Do not reveal on wm:pass — applyS can run from baked snapshot before /api/metar returns. */
    /* Safety: never leave bars spinning if a feed is silent. */
    setTimeout(function(){ if(!groups.obs) reveal('obs'); }, 12000);
    setTimeout(function(){ if(!groups.model) reveal('model'); }, 16000);
    setTimeout(function(){ if(!groups.flights && document.getElementById('fbk')) reveal('flights'); }, 12000);
  }

  window.WMLoad = {
    ph: ph,
    phAll: phAll,
    waitCard: waitCard,
    revealCard: revealCard,
    reveal: reveal,
    schedule: schedule,
    isReady: isReady,
    isHeli: isHeli,
    start: start,
    groups: groups
  };

  hookFetch();
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
