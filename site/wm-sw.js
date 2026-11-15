/* wm-sw.js - registers /sw.js (perf/service-worker). Top window only, https or localhost only.
   localStorage 'wm-sw-off'='1' turns it off on this browser (and removes an installed one). */
(function () {
  try {
    if (!('serviceWorker' in navigator) || window.top !== window) return;
    if (location.protocol !== 'https:' && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return;
    if (localStorage.getItem('wm-sw-off') === '1') {
      navigator.serviceWorker.getRegistrations().then(function (r) {
        var scope = new URL('/', location.href).href, script = new URL('/sw.js', location.href).href;
        r.forEach(function (x) {
          if (x.scope === scope && [x.active, x.waiting, x.installing].some(function (w) { return w && w.scriptURL === script; })) x.unregister();
        });
      }).catch(function () {});
      return;
    }
    var list = function () { var out = [], add = function (w) { try { w.performance.getEntriesByType('resource').forEach(function (r) { if (/\.(js|css)\?v=[0-9a-f]{10}$/.test(r.name)) out.push(r.name); }); } catch (e) {} };
      add(window); for (var i = 0; i < frames.length; i++) add(frames[i]); return out; };
    var go = function () { navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then(function () { return navigator.serviceWorker.ready; })
      .then(function (r) { if (r.active) r.active.postMessage({ warm: list() }); }).catch(function () {}); };
    if (document.readyState === 'complete') setTimeout(go, 2000); else addEventListener('load', function () { setTimeout(go, 2000); });
  } catch (e) {}
})();
