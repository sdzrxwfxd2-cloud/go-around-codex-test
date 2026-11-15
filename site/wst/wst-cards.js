/* wst-cards.js (speed 13nov): keep all aerodrome card elements, but only mount the
   current page (~10–30 cards) in #list. Search, filters, favourites, engine and
   status scripts still see the full set via a narrow querySelectorAll patch.
   Visible card HTML, shadows and styling are unchanged.
   Compound selectors (Refresh FX glints on phones: ".card…,.tile,.badge,.tile .d")
   are split: card parts still come from the index, the rest from the native query,
   so verdict pills and status tiles keep their refresh glint. */
(function(){
  var L=document.getElementById('list');
  if(!L||L.dataset.wmCards)return;
  L.dataset.wmCards='1';
  var store=document.createDocumentFragment();
  var ALL=[];

  function take(node){
    if(!node||node.nodeType!==1||!node.classList||!node.classList.contains('card'))return;
    ALL.push(node);
    store.appendChild(node);
    if(window.WMLoad) window.WMLoad.waitCard(node, true);
  }
  if(window.WM_CARD_HTML&&window.WM_CARD_HTML.length){
    var box=document.createElement('div');
    box.innerHTML=window.WM_CARD_HTML.join('');
    while(box.firstChild){
      var n=box.firstChild;
      if(n.nodeType===1&&n.classList&&n.classList.contains('card'))take(n);
      else box.removeChild(n);
    }
  }else{
    [].slice.call(L.querySelectorAll('.card')).forEach(take);
  }

  window.WM_ALL_CARDS=ALL;
  window.WM_CARD_STORE=store;
  var IDX=new Map();ALL.forEach(function(c,i){IDX.set(c,i)});
  var EQSA=Element.prototype.querySelectorAll;
  /* 'All' / large pages: keep only a viewport window in #list (spacers hold the
     scroll height). Paginated 10/20/50 still mount the whole page at once.
     Card HTML, layout and verdicts are unchanged; unmounted cards stay in the store. */
  var VCSS=document.createElement('style');
  VCSS.id='wm-vsp-css';
  VCSS.textContent='#list.list>.wm-vsp{grid-column:1/-1;pointer-events:none;margin:0;padding:0;border:0;height:0}#list.list>.card.wm-vpin{position:absolute;left:0;top:0;width:1px;height:1px;margin:0;padding:0;overflow:hidden;opacity:0;border:0;pointer-events:none}';
  (document.head||document.documentElement).appendChild(VCSS);
  var VTH=50, VOS=1400, VDEF=420, V={on:0,list:null,h:[],idx:null,top:null,bot:null,tick:0,a:-1,b:-1,idle:0};
  /* Keep the card under an active pointer mounted. Unmounting the touch
     target mid-gesture (fast fling, 4x CPU, WebKit) crashes or throws. */
  var PINNED=new Set(), pinRev=0, pinApplied=-1, pinT=0;
  function vPark(c){if(c&&!c.classList.contains('wm-vpin'))c.classList.add('wm-vpin')}
  function vUnpark(c){if(c)c.classList.remove('wm-vpin')}
  function vClearPins(){
    if(pinT){clearTimeout(pinT);pinT=0}
    PINNED.forEach(vUnpark);PINNED.clear();pinRev++;
  }
  function vPinFrom(e){
    if(!V.on||!V.idx)return;
    var t=e.target,c=t&&t.closest?t.closest('.card'):null;
    if(!c||!V.idx.has(c))return;
    if(!PINNED.has(c)){PINNED.add(c);pinRev++}
    if(pinT){clearTimeout(pinT);pinT=0}
  }
  function vUnpinLater(){
    if(!PINNED.size)return;
    if(pinT)clearTimeout(pinT);
    pinT=setTimeout(function(){
      pinT=0;PINNED.forEach(vUnpark);PINNED.clear();pinRev++;
      if(V.on){vMeasure();vSync(true)}
    },450);
  }
  addEventListener('pointerdown',vPinFrom,true);
  addEventListener('touchstart',vPinFrom,{capture:true,passive:true});
  addEventListener('pointerup',vUnpinLater,true);
  addEventListener('pointercancel',vUnpinLater,true);
  addEventListener('touchend',vUnpinLater,true);
  addEventListener('touchcancel',vUnpinLater,true);
  function vCols(){var w=L.clientWidth||innerWidth;return w>=1280?3:w>=744?2:1}
  function vGap(){var n=parseFloat(getComputedStyle(L).rowGap||getComputedStyle(L).gap);return isFinite(n)?n:12}
  function vH(i){return V.h[i]||VDEF}
  function vSpacers(){
    if(V.top)return;
    V.top=document.createElement('div');V.top.className='wm-vsp wm-vsp-top';V.top.setAttribute('aria-hidden','true');
    V.bot=document.createElement('div');V.bot.className='wm-vsp wm-vsp-bot';V.bot.setAttribute('aria-hidden','true');
  }
  function vStop(){
    vClearPins();
    V.on=0;V.list=null;V.idx=null;V.a=V.b=-1;
    if(V.idle){try{cancelIdleCallback(V.idle)}catch(e){clearTimeout(V.idle)}V.idle=0}
    if(V.top&&V.top.parentNode)V.top.parentNode.removeChild(V.top);
    if(V.bot&&V.bot.parentNode)V.bot.parentNode.removeChild(V.bot);
  }
  function vSpace(from,to){
    var cols=vCols(),g=vGap(),h=0,i,j,rh;
    for(i=from;i<to;i+=cols){
      rh=0;for(j=0;j<cols&&i+j<to;j++)if(vH(i+j)>rh)rh=vH(i+j);
      if(i>from)h+=g;h+=rh;
    }
    return h;
  }
  function vMeasure(){
    if(!V.list||!V.idx)return;
    var kids=L.children,i,c,k,h,ch=false;
    for(i=0;i<kids.length;i++){
      c=kids[i];if(!c.classList||!c.classList.contains('card')||c.classList.contains('wm-vpin'))continue;
      k=V.idx.get(c);if(k==null)continue;
      h=c.getBoundingClientRect().height;if(h>0&&V.h[k]!==h){V.h[k]=h;ch=true}
    }
    return ch;
  }
  function vRange(){
    var n=V.list.length,cols=vCols(),g=vGap(),y=L.getBoundingClientRect().top,i,j,rh,rowBot,a=0,b=n,found=0;
    if(!n)return[0,0];
    for(i=0;i<n;i+=cols){
      rh=0;for(j=0;j<cols&&i+j<n;j++)if(vH(i+j)>rh)rh=vH(i+j);
      rowBot=y+rh;
      if(!found&&rowBot>=-VOS){a=i;found=1}
      if(found&&y>innerHeight+VOS){b=i;break}
      y=rowBot+g;
    }
    if(!found){a=0;b=Math.min(n,cols*8)}
    a=Math.floor(a/cols)*cols;
    b=Math.min(n,Math.ceil(b/cols)*cols);
    if(b-a<cols*4)b=Math.min(n,a+cols*8);
    return[a,b];
  }
  function vSync(force){
    if(!V.on||!V.list)return;
    var ab=vRange(),a=ab[0],b=ab[1],i,c,keep,prev,native,k;
    if(!force&&a===V.a&&b===V.b&&pinApplied===pinRev)return;
    V.a=a;V.b=b;pinApplied=pinRev;
    vSpacers();
    keep=new Set(V.list.slice(a,b));
    PINNED.forEach(function(el){if(V.idx.has(el))keep.add(el)});
    native=[].slice.call(EQSA.call(L,':scope > .card'));
    for(i=0;i<native.length;i++)if(!keep.has(native[i])){vUnpark(native[i]);store.appendChild(native[i])}
    V.top.style.height=vSpace(0,a)+'px';
    V.bot.style.height=vSpace(b,V.list.length)+'px';
    if(V.top.parentNode!==L||L.firstChild!==V.top)L.insertBefore(V.top,L.firstChild);
    prev=V.top;
    for(i=a;i<b;i++){
      c=V.list[i];
      vUnpark(c);
      if(c.parentNode!==L||c.previousSibling!==prev)L.insertBefore(c,prev.nextSibling);
      prev=c;
    }
    if(V.bot.parentNode!==L||V.bot.previousSibling!==prev)L.insertBefore(V.bot,prev.nextSibling);
    PINNED.forEach(function(el){
      k=V.idx.get(el);if(k==null||(k>=a&&k<b)){vUnpark(el);return}
      vPark(el);
      if(el.parentNode!==L||el.nextSibling!==V.bot)L.insertBefore(el,V.bot);
    });
  }
  function vIdle(){
    V.idle=0;
    if(!V.on)return;
    vMeasure();
    vSync(true);
  }
  function vTick(){
    V.tick=0;
    if(!V.on)return;
    vMeasure();
    vSync(false);
  }
  function vOnScroll(){if(!V.on||V.tick)return;V.tick=requestAnimationFrame(vTick)}
  addEventListener('scroll',vOnScroll,{passive:true});
  addEventListener('resize',vOnScroll);
  function vMount(list){
    V.list=list.slice();
    V.h=new Array(list.length);
    V.idx=new Map();
    for(var i=0;i<list.length;i++)V.idx.set(list[i],i);
    V.on=1;V.a=V.b=-1;pinApplied=-1;
    vSync(true);
    requestAnimationFrame(function(){
      vMeasure();vSync(true);
      var ric=window.requestIdleCallback||function(fn){return setTimeout(fn,40)};
      if(V.idle){try{cancelIdleCallback(V.idle)}catch(e){clearTimeout(V.idle)}}
      V.idle=ric(vIdle,{timeout:200});
    });
  }
  function mountPlain(nodes){
    var keep=new Set(nodes||[]);
    [].slice.call(EQSA.call(L,':scope > .card')).forEach(function(c){
      if(!keep.has(c))store.appendChild(c);
    });
    (nodes||[]).forEach(function(c){if(c.parentNode!==L)L.appendChild(c)});
  }
  window.WMCards={
    all:function(){return ALL.slice()},
    mount:function(nodes){
      var list=nodes||[];
      if(list.length<=VTH){vStop();mountPlain(list);return}
      vMount(list);
    },
    window:function(){return V.on&&V.list?{a:V.a,b:V.b,n:V.list.length,mounted:Math.max(0,V.b-V.a)}:null}
  };

  /* pilot-safety P2-1 (13 Nov 2026): ".card .icao"-style selectors returned nothing (only card elements were matched).
     Now: native answer UNION the store, in list order. Other ids or unknown ancestors stay native. */
  function splitComma(sel){
    var parts=[],buf='',depth=0,q='',i,ch;
    for(i=0;i<sel.length;i++){
      ch=sel[i];
      if(q){if(ch===q)q='';buf+=ch;continue}
      if(ch==='"'||ch==="'"){q=ch;buf+=ch;continue}
      if(ch==='('||ch==='[')depth++;
      else if(ch===')'||ch===']')depth=Math.max(0,depth-1);
      if(ch===','&&depth===0){parts.push(buf);buf='';}
      else buf+=ch;
    }
    if(buf)parts.push(buf);
    return parts.map(function(s){return s.trim()}).filter(Boolean);
  }
  function compounds(sel){
    var out=[],buf='',depth=0,q='',k='',i,ch,pend='';
    function flush(){if(buf){out.push({c:buf,k:out.length?(pend||' '):''});buf='';pend=''}}
    for(i=0;i<sel.length;i++){
      ch=sel[i];
      if(q){if(ch===q)q='';buf+=ch;continue}
      if(ch==='"'||ch==="'"){q=ch;buf+=ch;continue}
      if(ch==='('||ch==='['){depth++;buf+=ch;continue}
      if(ch===')'||ch===']'){depth=Math.max(0,depth-1);buf+=ch;continue}
      if(depth===0&&/\s/.test(ch)){flush();continue}
      if(depth===0&&(ch==='>'||ch==='+'||ch==='~')){flush();pend=ch;continue}
      buf+=ch;
    }
    flush();
    return out;
  }
  var CARD_RE=/\.card(?![\w-])/, PREFIX_OK=/^(#list|:scope|html|body|main)$/;
  var PLAN={};
  function plan(part){
    if(part in PLAN)return PLAN[part];
    var r=null;
    if(CARD_RE.test(part)&&!/#(?!list(?![\w-]))[\w-]/.test(part)){
      var cs=compounds(part),ci=-1,i;
      for(i=0;i<cs.length;i++)if(CARD_RE.test(cs[i].c)){ci=i;break}
      var ok=ci>=0;
      for(i=0;i<ci&&ok;i++)if(!PREFIX_OK.test(cs[i].c))ok=false;
      if(ok&&ci>0&&cs[ci].k!==' '&&cs[ci].k!=='>')ok=false;
      if(ok){
        var rest=cs.slice(ci).map(function(x,j){return (j?(x.k===' '?' ':' '+x.k+' '):'')+x.c}).join('');
        r=ci===cs.length-1?{fast:rest}:{store:rest};
      }
    }
    PLAN[part]=r;return r;
  }
  function asList(arr){
    var a=arr.slice();
    a.item=function(i){return i>=0&&i<a.length?a[i]:null};
    return a;
  }
  function cardOf(el){
    var c=el.closest?el.closest('.card'):null;
    return c&&IDX.has(c)?c:null;
  }
  function cmp(a,b){
    if(a===b)return 0;
    var ca=cardOf(a),cb=cardOf(b);
    var ga=ca?1:(L.compareDocumentPosition(a)&(2|8)?0:2),gb=cb?1:(L.compareDocumentPosition(b)&(2|8)?0:2);
    if(ga!==gb)return ga-gb;
    if(ga===1&&ca!==cb)return IDX.get(ca)-IDX.get(cb);
    return a.compareDocumentPosition(b)&4?-1:1;
  }
  function matchAll(sel){
    var out=[];
    for(var i=0;i<ALL.length;i++){try{if(ALL[i].matches(sel))out.push(ALL[i])}catch(e){}}
    return out;
  }
  function queryAll(sel,native,ctx){
    if(typeof sel!=='string'||!sel)return native.call(ctx,sel);
    var parts=splitComma(sel),plans=[],any=false,i;
    for(i=0;i<parts.length;i++){plans.push(plan(parts[i]));if(plans[i])any=true}
    if(!any)return native.call(ctx,sel);
    if(parts.length===1&&plans[0].fast){
      var m=matchAll(plans[0].fast),n0;try{n0=native.call(ctx,sel)}catch(e){n0=[]}
      var extra=[];for(i=0;i<n0.length;i++)if(!IDX.has(n0[i]))extra.push(n0[i]);
      if(!extra.length)return asList(m);
      m=m.concat(extra);m.sort(cmp);return asList(m);
    }
    var out=[],seen=new Set(),add=function(el){if(el&&!seen.has(el)){seen.add(el);out.push(el)}};
    var nat;try{nat=native.call(ctx,sel)}catch(e){nat=[]}
    for(i=0;i<nat.length;i++)add(nat[i]);
    for(i=0;i<plans.length;i++){
      var p=plans[i];if(!p)continue;
      var found;
      if(p.fast)found=matchAll(p.fast);
      else{try{found=store.querySelectorAll(p.store)}catch(e){found=[]}}
      for(var k=0;k<found.length;k++)add(found[k]);
    }
    out.sort(cmp);
    return asList(out);
  }
  function queryOne(sel,native,ctx){
    if(typeof sel!=='string'||!sel)return native.call(ctx,sel);
    var parts=splitComma(sel),any=false,i;
    for(i=0;i<parts.length;i++)if(plan(parts[i]))any=true;
    if(!any)return native.call(ctx,sel);
    if(parts.length===1&&plan(parts[0]).fast){
      var f=plan(parts[0]).fast;
      for(i=0;i<ALL.length;i++){try{if(ALL[i].matches(f))return ALL[i]}catch(e){}}
      return null;
    }
    return queryAll(sel,EQSA===native?EQSA:(native===Document.prototype.querySelector?Document.prototype.querySelectorAll:EQSA),ctx)[0]||null;
  }
  function wrapQSA(obj, orig){
    obj.querySelectorAll=function(sel){
      return queryAll(sel,orig,this);
    };
  }
  function wrapQS(obj, orig){
    obj.querySelector=function(sel){
      return queryOne(sel,orig,this);
    };
  }
  wrapQSA(L, Element.prototype.querySelectorAll);
  wrapQS(L, Element.prototype.querySelector);
  var dqsa=Document.prototype.querySelectorAll, dqs=Document.prototype.querySelector;
  /* Only wrap this document's instance methods — do not rewrite the prototype. */
  document.querySelectorAll=function(sel){
    return queryAll(sel,dqsa,this);
  };
  document.querySelector=function(sel){
    return queryOne(sel,dqs,this);
  };
})();
