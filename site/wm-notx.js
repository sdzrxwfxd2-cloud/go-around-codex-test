/* wm-notx.js (speed 13nov): instant theme switch.
   When <html> data-theme / data-pal changes, add body.no-tx until this document
   and every same-origin iframe have painted, so colour / background / shadow
   transitions do not run mid-flip. body itself is included (the full-screen
   gradient). The settings sheet (.sheet) keeps its transitions so the switch
   knob still glides. Kill switch: localStorage wm-notx=0. */
(function(){
  try{if(localStorage.getItem('wm-notx')==='0')return}catch(e){}
  var H=document.documentElement;
  var css='body.no-tx,body.no-tx *:not(.sheet):not(.sheet *),body.no-tx *:not(.sheet):not(.sheet *)::before,body.no-tx *:not(.sheet):not(.sheet *)::after{transition:none!important}';
  /* The class lives on <body>, not <html>: wm-pin re-serialises the whole frame stylesheet on ANY <html> attribute change,
     so toggling a class there made every theme flip run that restyle twice more (Claude v3 G). */
  var st=document.createElement('style');st.id='wm-notx';st.textContent=css;(document.head||H).appendChild(st);
  var tok=0,queued=0;
  function painted(win,cb){
    try{win.requestAnimationFrame(function(){win.requestAnimationFrame(function(){cb()})})}catch(e){cb()}
  }
  function kids(win){
    var out=[];
    try{var fr=win.frames;for(var i=0;i<fr.length;i++){try{if(fr[i]&&fr[i].document)out.push(fr[i])}catch(e){}}}catch(e){}
    return out;
  }
  function hold(done){
    painted(window,function(){
      var list=kids(window),n=list.length;
      if(!n){painted(window,done);return}
      list.forEach(function(w){painted(w,function(){if(--n<=0)painted(window,done)})});
    });
  }
  function lock(){
    var B=document.body;if(!B)return;
    var my=++tok;B.classList.add('no-tx');
    hold(function(){if(my===tok)B.classList.remove('no-tx')});
  }
  new MutationObserver(function(){
    if(queued)return;
    queued=1;
    queueMicrotask(function(){queued=0;lock()});
  }).observe(H,{attributes:true,attributeFilter:['data-theme','data-pal']});
})();
/* Hide the Netlify site badge on pages that do not load wm-shell.css (c/app.html, main.html). MT, 30 Oct 2026. */
(function(){try{var s=document.createElement('style');s.id='wm-nl-badge';s.textContent='#nl-badge-frame{display:none!important}';(document.head||document.documentElement).appendChild(s)}catch(e){}})();
