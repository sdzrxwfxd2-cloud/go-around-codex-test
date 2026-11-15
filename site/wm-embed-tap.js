/* wm-embed-tap.js (speed 13nov): Windy, ADS-B Exchange and OSM maps load only when
   the pilot taps. The shell sizes aerodrome iframes to the full page height, which
   defeats loading="lazy" and starts the third-party embeds immediately. */
(function(){
  var css='.emb-tap{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;width:100%;border:0;border-radius:16px;background:var(--gl2);box-shadow:inset 0 1px 0 var(--hl),inset 0 0 0 .5px var(--ln);color:var(--tx2);cursor:pointer;text-align:center;padding:16px;box-sizing:border-box;-webkit-tap-highlight-color:transparent}'+
    '.emb-tap .emb-tap-btn{border:0;border-radius:18px;padding:10px 16px;font:600 14px/1 -apple-system,Helvetica,Arial,sans-serif;color:var(--tx);background:var(--gl);box-shadow:inset 0 1px 0 var(--hl),inset 0 0 0 .5px var(--ln),var(--sh);cursor:pointer}'+
    '.emb-tap .emb-tap-note{font:500 12px/1.3 -apple-system,Helvetica,Arial,sans-serif;color:var(--tx3)}';
  if(!document.getElementById('wm-embed-tap')){
    var st=document.createElement('style');st.id='wm-embed-tap';st.textContent=css;(document.head||document.documentElement).appendChild(st);
  }
  function go(el){
    if(!el||el.dataset.embOn)return;
    var src=el.getAttribute('data-emb-src'),title=el.getAttribute('data-emb-title')||'Map';
    if(!src)return;
    el.dataset.embOn='1';
    var f=document.createElement('iframe');
    f.className='emb';f.title=title;f.setAttribute('loading','eager');
    if(el.getAttribute('style'))f.setAttribute('style',el.getAttribute('style'));
    f.src=src;
    el.replaceWith(f);
  }
  function mount(el){
    if(!el||el.dataset.embReady)return;
    el.dataset.embReady='1';
    el.addEventListener('click',function(){go(el)});
    el.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();go(el)}});
  }
  function scan(root){(root||document).querySelectorAll('.emb-tap[data-emb-src]').forEach(mount)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){scan()});
  else scan();
  window.WM_EMBED_TAP={scan:scan};
})();
