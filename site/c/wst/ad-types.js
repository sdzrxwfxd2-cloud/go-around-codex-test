/* Backlog 5 / MT #352 v14
   - Name area: fixed 2-line height; 1-line names vertically centred; trailing '.'
   - ICAO·province flush left (no centre)
   - Military: glowing red plain word + permission on same line (no pill)
   - Steady status glow kept; hazard-stripe ICAO; no red corner glow */
(function(){
  if(/[?&]adtypes=0(?:&|$)/.test(location.search)) return;
  var D=window.WM_AD_TYPES||{};
  /* Aerodrome card v3 (MT locked 13 Nov 2026): pages whose <html> carries data-ad-card="v3" (main.html) show warnings only under the
     ICAO, in ONE row instead of the separate military row: "Military · Permission required before landing", or "Near prohibited area".
     MT t290u: no airfield-type label (International / Regional / Airfield / Controlled / Uncontrolled / Heliport); a card with no
     warning has no row. Other pages unchanged. */
  var V3=document.documentElement.getAttribute('data-ad-card')==='v3';
  function typeRow(info){
    if(info.t==='military') return '<span class="w-mil">Military</span><span class="d">Permission required before landing</span>';
    if(info.t==='nearpro') return '<span class="d">Near prohibited area</span>';
    return '';
  }
  function ic(card){
    var el=card.querySelector('.icao');
    return el?(el.textContent||'').trim():'';
  }
  function wrapName(h2){
    if(!h2) return;
    var nm=h2.querySelector('.nm');
    if(!nm){
      nm=document.createElement('span');
      nm.className='nm';
      while(h2.firstChild) nm.appendChild(h2.firstChild);
      h2.appendChild(nm);
    }
    /* Trailing full stop on the displayed name (don't double) */
    var raw=(nm.textContent||'').replace(/\s+$/,'');
    if(raw && !/\.$/.test(raw)) nm.textContent=raw+'.';
  }
  /* perf 11 Nov 2026: mark() used to delete and re-add the military row on every pass; the list observer below saw
     that change and ran mark() again 80 ms later, forever (~12 passes a second, 30-40% CPU at idle). done() says a
     card already looks exactly as mark() would leave it, so a pass changes nothing and the loop stops. */
  function done(card,id,info){
    if(card.dataset.adType!==info.t) return false;
    if(info.p && card.dataset.adNearPro!=='1') return false;
    if(card.classList.contains('ad-mil-pro')!==(info.t==='military')) return false;
    var ch=card.querySelector('.ch'), t=card.querySelector('.ch .t');
    if(ch && ch.querySelector('.ad-type,.ad-corner.mil,.mil-tr,.mil-stack')) return false;
    if(t){
      if(t.querySelector('.mil-row,.mil-pill,.mil-under,.mil-perm')) return false;
      var h2=t.querySelector('h2'), nm=h2&&h2.querySelector('.nm');
      if(h2 && (!nm || !/\.$/.test((nm.textContent||'').replace(/\s+$/,'')) && (nm.textContent||'').trim())) return false;
    }
    var rows=ch?ch.querySelectorAll(':scope > .mil-row').length:0;
    if(V3){var tr=ch?ch.querySelectorAll(':scope > .ad-tr'):[],h=ch&&t?typeRow(info):'';return rows===0&&tr.length===(h?1:0)&&(!tr.length||tr[0].__wmH===h)}
    return rows===((info.t==='military'&&t&&ch)?1:0);
  }
  function mark(card){
    var id=ic(card); if(!id) return;
    var info=D[id]; if(!info) return;
    if(done(card,id,info)) return;
    if(card.dataset.adType!==info.t) card.dataset.adType=info.t;
    if(info.p && card.dataset.adNearPro!=='1') card.dataset.adNearPro='1';
    var ch=card.querySelector('.ch');
    if(ch) ch.querySelectorAll('.ad-type').forEach(function(el){el.remove()});
    if(ch) ch.querySelectorAll('.ad-corner.mil,.mil-tr').forEach(function(e){e.remove()});

    var stack=card.querySelector('.ch .mil-stack');
    if(stack){
      var badge=stack.querySelector('.badge');
      if(badge && ch){ stack.replaceWith(badge); }
    }

    var t=card.querySelector('.ch .t');
    if(t){
      wrapName(t.querySelector('h2'));
      t.querySelectorAll('.mil-row,.mil-pill,.mil-under,.mil-perm').forEach(function(e){e.remove()});
      if(ch) ch.querySelectorAll(':scope > .mil-row').forEach(function(e){e.remove()});
    }

    var isMil=info.t==='military';
    card.classList.toggle('ad-mil-pro', !!isMil);

    if(V3 && t && ch){
      var h=typeRow(info),tr=ch.querySelector(':scope > .ad-tr');
      ch.querySelectorAll(':scope > .ad-tr').forEach(function(e){if(e!==tr||!h)e.remove()});
      if(h){if(!tr){tr=document.createElement('div');tr.className='ad-tr';t.after(tr)}
        if(tr.__wmH!==h){tr.innerHTML=h;tr.__wmH=h}}
    }
    else if(isMil && t && ch){
      var row=document.createElement('div');
      row.className='mil-row';
      var word=document.createElement('span');
      word.className='mil-word';
      word.title='Military aerodrome';
      word.textContent='Military';
      var perm=document.createElement('span');
      perm.className='mil-perm';
      perm.textContent='Permission required before landing';
      row.appendChild(word);
      row.appendChild(perm);
      ch.appendChild(row);
    }
  }
  function run(root){
    (root||document).querySelectorAll('article.card').forEach(mark);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){run()});
  else run();
  var list=document.getElementById('list');
  if(list&&window.MutationObserver){
    var t=0;
    var mo=new MutationObserver(function(){
      clearTimeout(t); t=setTimeout(function(){run(list);mo.takeRecords()},80);
    });
    mo.observe(list,{childList:true,subtree:true});
  }
  window.WM_AD_TYPE_OF=function(cardOrIcao){
    if(typeof cardOrIcao==='string') return D[cardOrIcao]||null;
    return D[ic(cardOrIcao)]||null;
  };
})();
