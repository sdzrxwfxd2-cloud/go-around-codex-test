/* Claude plan step 8, revised 12 Nov (fix/ipad-scroll-12nov): iPad Safari scroll cost.
   - Card breathing glow, runway bloom and v2glow still pause while the page scrolls, but the
     class now goes on <body>, not <html>: an <html> class change woke the fv3.js cp()/glass()
     MutationObservers (getComputedStyle over the filter panel) on every scroll gesture.
     The search glow is no longer paused on scroll: it must always run (MT rule).
   - Closed overlays (.wm-ibk, .fs-spot) are opacity 0 but carried a full-screen backdrop blur
     (inside the frame: the full page height). They are visibility:hidden while closed, after
     their fade-out, so Safari can drop those layers.
   (Tried and dropped: an IntersectionObserver stopping breathe on off-screen cards. Toggling
   cards in and out while scrolling cost more in WebKit than it saved.)
   Undo: restore the previous version of this file from git. */
(function(){
  if (window.__wmAnimPause) return; window.__wmAnimPause = 1;
  var d = document, h = d.documentElement;
  var s = d.createElement('style'); s.id = 'wm-anim-pause';
  var P = 'html:not(#ap1):not(#ap2):not(#ap3):not(#ap4):not(#ap5):not(#ap6):not(#ap7):not(#ap8):not(#ap9):not(#ap10) body ';
  s.textContent =
    '.wm-apause .v2glow,.wm-apause .card::after,.wm-apause .wmr-bloom' +
    '{animation-play-state:paused!important}' +
    '.wm-ibk:not(.on){visibility:hidden!important;transition:opacity .25s ease,visibility 0s linear .25s!important}' +
    '.wm-ibk.on{visibility:visible!important;transition:opacity .25s ease,visibility 0s!important}' +
    '.fs-spot:not(.on):not(.fs-moving){visibility:hidden!important;transition:opacity .3s var(--ease,ease),visibility 0s linear .3s!important}' +
    '.fs-spot.on{visibility:visible!important;transition:opacity .3s var(--ease,ease),visibility 0s!important}' +
    '@media (prefers-reduced-motion:reduce){.wm-ibk,.wm-ibk.on,.fs-spot,.fs-spot.on{transition:none!important}}' +
    // Closed pop-ups (More sheet, "i" box, clock card) are opacity 0 but kept a blur layer each.
    // .sheet and plain .ipop fade with "transition: all", so visibility already waits for the fade-out.
    '.sheet:not(.on),.ipop:not(.wm-imod):not(.on){visibility:hidden}' +
    P + '.ipop.wm-imod:not(.on):not(#z){visibility:hidden!important;transition:opacity .25s ease,transform .3s cubic-bezier(.2,.8,.2,1),visibility 0s linear .3s!important}' +
    P + '.ipop.wm-imod.on:not(#z){transition:opacity .25s ease,transform .3s cubic-bezier(.2,.8,.2,1),visibility 0s!important}' +
    '.wm-tcard:not(.on){visibility:hidden;transition:opacity .26s cubic-bezier(.2,.8,.2,1),filter .32s cubic-bezier(.2,.8,.2,1),transform .32s cubic-bezier(.2,.8,.2,1),visibility 0s linear .32s}' +
    '.wm-tcard.on{transition:opacity .26s cubic-bezier(.2,.8,.2,1),filter .32s cubic-bezier(.2,.8,.2,1),transform .32s cubic-bezier(.2,.8,.2,1),visibility 0s}' +
    '.wm-tcard:not(.on) .loc-p{animation-play-state:paused}' +
    '@media (prefers-reduced-motion:reduce){' + P + '.ipop.wm-imod:not(#z),' + P + '.ipop.wm-imod.on:not(#z){transition:none!important}' +
    'html .wm-tcard:not(.on){transition:opacity .15s linear,visibility 0s linear .15s}html .wm-tcard.on{transition:opacity .15s linear,visibility 0s}}' +
    // Glass on page content that sits on the plain page background (nothing ever moves behind it):
    // blurring a flat background gives the same pixels, but each blur was redrawn on every scroll frame.
    // The top bar, nav pill and pop-ups keep their real blur.
    P + 'main.wrap .inote,' + P + 'main.wrap .fv5-box,' + P + 'main.wrap .wflt-row>.fv-sb,' + P + 'main.wrap .wflt-row>.icb.wflt-b' +
    '{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}';
  (d.head || h).appendChild(s);
  var t = 0, B = function(){ return d.body || h; };
  function on(){ B().classList.add('wm-apause'); clearTimeout(t); t = setTimeout(off, 160); }
  function off(){ if (!d.hidden) B().classList.remove('wm-apause'); }
  function vis(){ if (d.hidden) { clearTimeout(t); B().classList.add('wm-apause'); } else off(); }
  var o = {passive:true}; // document scroll only; inner scrollers (tickers) must not hold the pause
  window.addEventListener('scroll', on, o);
  try { if (window.parent !== window && window.parent.document) window.parent.addEventListener('scroll', on, o); } catch(e) {}
  d.addEventListener('visibilitychange', vis); vis();

})();
