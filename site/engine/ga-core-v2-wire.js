/* Wire Go Around engine v2 into the live page.
 *
 * ONE FLAG: window.GA_USE_ENGINE_V2
 *   - default true (this file is loaded)
 *   - set to false in this file, or open with ?engine=v1, to use the previous
 *     stacked engine (wm-core + wst-engine overlay) without removing script tags
 *
 * Loaded after wst-engine.js, and after wm-bridge.js when that file is present,
 * so it replaces WST.status and WMB.evalCard. Does not edit wm-core.js,
 * wst-engine.js, wm-bridge.js, gate.ts, appdata/, auth, or wm-shell.css.
 *
 * On-screen words stay with phase.js (DEPART / LAND / CAUTION / NO DEPART /
 * NO LAND). Internal keys stay go / caution / nogo / none.
 */
(function () {
  'use strict';

  /* pilot-safety P0-2/P0-3: a TAF counts only if issued <= 30 h ago and its window (anchored to the issue) has not ended */
  var TAF_MAX_ISSUE_AGE_MS = 30 * 3600e3;
  function utcDay(y, mo, dd, hh, mi) {
    var t = Date.UTC(y, mo, dd, 0, 0);
    if (new Date(t).getUTCDate() !== dd) return NaN;
    return t + (hh || 0) * 3600e3 + (mi || 0) * 60e3;
  }
  function tafWindow(raw, now) {
    now = now != null ? +now : Date.now();
    var s = ' ' + String(raw || '').toUpperCase().replace(/=/g, ' ').replace(/\s+/g, ' ') + ' ';
    var im = /\s(\d{2})(\d{2})(\d{2})Z\s/.exec(s);
    if (!im) return null;
    var vm = /\s(\d{2})(\d{2})\/(\d{2})(\d{2})\s/.exec(s.slice(im.index + im[0].length - 1));
    if (!vm) return null;
    var n = new Date(now), issue = NaN, k, t;
    for (k = 0; k >= -2; k--) {
      t = utcDay(n.getUTCFullYear(), n.getUTCMonth() + k, +im[1], +im[2], +im[3]);
      if (isFinite(t) && t <= now + 72e5) { issue = t; break; }
    }
    if (!isFinite(issue)) return null;
    function after(base, dd, hh) {
      var b = new Date(base), j, x;
      for (j = -1; j <= 1; j++) { x = utcDay(b.getUTCFullYear(), b.getUTCMonth() + j, dd, hh, 0); if (isFinite(x) && x >= base - 12 * 3600e3) return x; }
      return NaN;
    }
    var from = after(issue, +vm[1], +vm[2]);
    var to = isFinite(from) ? after(from + 12 * 3600e3, +vm[3], +vm[4]) : NaN;
    if (!isFinite(from) || !isFinite(to) || to <= from || to - from > 36 * 3600e3) return null;
    return { issue: issue, from: from, to: to };
  }
  function tafValid(raw, now) {
    now = now != null ? +now : Date.now();
    var w = tafWindow(raw, now);
    return !!(w && now - w.issue <= TAF_MAX_ISSUE_AGE_MS && now < w.to);
  }
  window.GA_TAF = { window: tafWindow, valid: tafValid };

  try {
    if (/[?&]engine=v1(?:&|$)/.test(location.search || '')) {
      window.GA_USE_ENGINE_V2 = false;
    }
  } catch (e) {}

  if (window.GA_USE_ENGINE_V2 === false) return;

  var V2 = window.GACoreV2;
  var W = window.WST;
  if (!V2 || !V2.evaluate || !W || !W.status) return;

  window.GA_USE_ENGINE_V2 = true;

  var OLD_STATUS = W.status;
  window.GA_ENGINE_PREV_STATUS = OLD_STATUS;

  /* Shared live official feed for cards and pages, including stations that
     are not in the 65-field wst-data catalog (e.g. FAVV). */
  var LIVE = { metar: {}, taf: {}, pending: false, at: 0 };

  function mapStatus(s, code) {
    if (s === 'incomplete' || s === 'none') return 'none';
    if (s === 'noiap' || code === 'noiap') return 'nogo';
    if (s === 'go' || s === 'caution' || s === 'nogo') return s;
    return s || 'none';
  }

  function icOf(a) {
    return (a && (a.ic || a.icao)) || '';
  }

  function fieldOf(a) {
    if (!a) return {};
    var ic = icOf(a);
    var heli = !!(a.heliport || a.heli || (typeof window !== 'undefined' && window.AD_CLASS && window.AD_CLASS[ic]));
    var rw = a.rw || a.runways || [];
    return {
      icao: ic,
      name: a.nm || a.name,
      lat: a.la != null ? a.la : a.lat,
      lon: a.lo != null ? a.lo : a.lon,
      elevFt: a.el != null ? a.el : (a.elev != null ? a.elev : a.elevFt),
      category: a.cat || a.category || a.airspace,
      iap: a.iap,
      heliport: heli,
      heli: heli,
      runways: rw,
      rw: rw
    };
  }

  function ls(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function profileOf(P, acId, rules) {
    var out = P ? {
      licence: P.licence,
      ceil: P.ceil,
      vis: P.vis,
      xw: P.xw,
      gust: P.gust,
      night: P.night,
      ir: P.ir,
      iceil: P.iceil,
      ivis: P.ivis
    } : {};
    var lvl = ls('wm-lvl');
    if (lvl === 'ppln') lvl = 'ppl';
    if (!out.licence && lvl) out.licence = lvl;
    if (!out.licence && (out.ceil == null && out.vis == null)) out.licence = 'cpl';
    var n = ls('wm-night');
    if (n != null) out.night = n === '1';
    else if (out.night == null && (out.licence === 'cpl' || out.licence === 'ir' || !out.licence)) out.night = true;
    out.da = ls('wm-da-verdict') === '1';
    if (ls('wm-da-limit')) out.daLimit = ls('wm-da-limit');
    return {
      profile: out,
      aircraftId: acId || ls('wm-ac') || 'C172',
      rules: rules || (ls('wm-rules') === 'ifr' ? 'ifr' : 'vfr')
    };
  }

  function modelFromOm(om) {
    if (!om) return null;
    if (om.current) {
      var c = om.current;
      var copy = {};
      for (var k in c) copy[k] = c[k];
      if (om.fetchedAt != null) copy.fetchedAt = om.fetchedAt;
      else if (om.wingman_fetched) copy.fetchedAt = om.wingman_fetched;
      return copy;
    }
    return om;
  }

  /* Shared model copies: the live worker "now" file (wm.now.v1, used by
     cards) and the full /api/model-weather copy (wm.mw.v2, used by the
     13-hour strip). S.om is only filled for fields without a METAR. */
  var COPY_MEMO = {};
  function memoCopy(key, build) {
    var t = Date.now(), m = COPY_MEMO[key], raw = null;
    /* First visit (MT 11 Nov): only a parsed copy is kept for 5 s. A miss is never
       kept, so the cards that run right after wm-model.js stores the copy read it,
       instead of falling back to the wind-without-direction card snapshot. */
    if (m && m.val && t - m.at < 5000) return m.val;
    try { raw = localStorage.getItem(key); } catch (e) {}
    if (m && m.raw === raw) { m.at = t; return m.val; }
    var val = null;
    if (raw) { try { val = build(raw); } catch (e) { val = null; wxStale('copy ' + key + ' unreadable', e); } }
    COPY_MEMO[key] = { at: t, raw: raw, val: val };
    return val;
  }

  function readMwCopy() {
    return memoCopy('wm.mw.v2', function (raw) {
      var d = JSON.parse(raw);
      return (d && d.pts && d.v && d.time) ? d : null;
    });
  }

  function readNowCopy() {
    return memoCopy('wm.now.v1', function (raw) {
      var n = JSON.parse(raw);
      if (!n || n.v !== 1 || !Array.isArray(n.pts) || !n.t0 || !n.vars || !n.c) return null;
      var t0 = Date.parse(String(n.t0) + 'Z');
      if (!isFinite(t0)) return null;
      var HH = n.fzlHours || 5, NH = n.hours || 2, time = [], v = {}, h;
      for (h = 0; h < HH; h++) time.push(new Date(t0 + h * 3600e3).toISOString().slice(0, 16));
      n.vars.forEach(function (key, j) {
        v[key] = n.c.map(function (row) {
          var a = [];
          for (var h2 = 0; h2 < HH; h2++) a.push(h2 < NH ? row[j * NH + h2] : null);
          return a;
        });
      });
      if (n.fzl) v.freezing_level_height = n.fzl;
      return { pts: n.pts, time: time, v: v, vars: n.vars.concat(n.fzl ? ['freezing_level_height'] : []), ft: n.ft, composedAt: n.composedAt, nh: NH };
    });
  }

  /* notes: 6 (docs/ga-core-v2-wire-notes.md) */
  function copyIndex(d) {
    if (d.__gaIx) return d.__gaIx;
    var byIc = {}, i, p;
    for (i = 0; i < d.pts.length; i++) { p = d.pts[i]; if (p && p[0] != null && !(p[0] in byIc)) byIc[p[0]] = i; }
    var tms = [];
    for (i = 0; i < d.time.length; i++) tms.push(Date.parse(String(d.time[i]) + 'Z'));
    var ix = { byIc: byIc, tms: tms, byLl: {} };
    try { Object.defineProperty(d, '__gaIx', { value: ix, enumerable: false }); } catch (e) { d.__gaIx = ix; }
    return ix;
  }
  function copyPointIndex(d, a) {
    var ix = copyIndex(d), ic = icOf(a);
    if (ic != null && ic in ix.byIc) return ix.byIc[ic];
    if (!a) return -1;
    var la = a.la != null ? a.la : a.lat, lo = a.lo != null ? a.lo : a.lon;
    if (la == null || lo == null) return -1;
    var k = la + ',' + lo;
    if (k in ix.byLl) return ix.byLl[k];
    var best = 0.01, idx = -1;
    for (var i = 0; i < d.pts.length; i++) {
      var dd = Math.abs(d.pts[i][1] - la) + Math.abs(d.pts[i][2] - lo);
      if (dd < best) { best = dd; idx = i; }
    }
    ix.byLl[k] = idx;
    return idx;
  }

  function modelFromCopy(d, a) {
    if (!d || !d.pts || !d.v || !d.time) return null;
    var idx = copyPointIndex(d, a), i;
    if (idx < 0) return null;
    var tms = copyIndex(d).tms, nowMs = Date.now(), h = -1;
    for (i = 0; i < tms.length; i++) {
      if (tms[i] <= nowMs) h = i;
    }
    if (h < 0) return null;
    if (d.nh != null && h > d.nh - 1) h = d.nh - 1;
    var cur = { time: d.time[h] };
    var vars = d.vars || [];
    for (i = 0; i < vars.length; i++) {
      var key = vars[i], col = d.v[key];
      if (col && col[idx]) cur[key] = col[idx][h];
    }
    if (d.ft && d.ft[idx]) {
      var fetched = Date.parse(d.ft[idx]);
      if (isFinite(fetched)) cur.fetchedAt = fetched;
    } else if (d.composedAt) {
      var composed = Date.parse(d.composedAt);
      if (isFinite(composed)) cur.fetchedAt = composed;
    }
    var any = false, q;
    for (q in cur) if (q !== 'time' && q !== 'fetchedAt' && cur[q] != null) any = true;
    if (!any) return null;
    return cur;
  }

  /* E-02 (13 Nov 2026): every hourly row of a copy for one aerodrome, for a land arrival window (+1h, +2h, +3h or a
     picked time). The engine keeps only the rows whose hour lies in ETA ±1 h and judges the worst. */
  function modelRowsFromCopy(d, a) {
    if (!d || !d.pts || !d.v || !d.time) return null;
    var idx0 = copyPointIndex(d, a), ix0 = copyIndex(d);
    if (idx0 >= 0 && ix0.rows && (idx0 in ix0.rows)) return ix0.rows[idx0];      // same rows object for the copy's lifetime
    var out = modelRowsFromCopyBuild(d, a);
    if (idx0 >= 0) { ix0.rows = ix0.rows || {}; ix0.rows[idx0] = out; }
    return out;
  }
  function modelRowsFromCopyBuild(d, a) {
    var first = modelFromCopy(d, a);              // same aerodrome match and the same fetch time as the single row
    if (!first) return null;
    var idx = copyPointIndex(d, a), i, h, tms = copyIndex(d).tms;
    if (idx < 0) return null;
    var vars = d.vars || [], last = d.nh != null ? Math.min(d.time.length, d.nh) : d.time.length, rows = [];
    for (h = 0; h < last; h++) {
      var r = { time: tms[h], fetchedAt: first.fetchedAt }, any = false;
      for (i = 0; i < vars.length; i++) {
        var col = d.v[vars[i]];
        if (col && col[idx]) { r[vars[i]] = col[idx][h]; if (vars[i] !== 'freezing_level_height' && col[idx][h] != null) any = true; }
      }
      if (any && isFinite(r.time)) rows.push(r);
    }
    return rows.length ? rows : null;
  }

  /* The rows of the newest copy that covers the most of [from, to]; and whether any copy reaches `to`. */
  function modelHoursFor(a, to) {
    var cands = [modelRowsFromCopy(readNowCopy(), a), modelRowsFromCopy(readMwCopy(), a)].filter(Boolean);
    if (!cands.length) return { rows: null, covers: false };
    cands.sort(function (x, y) {
      var cx = x[x.length - 1].time >= to ? 1 : 0, cy = y[y.length - 1].time >= to ? 1 : 0;
      if (cx !== cy) return cy - cx;
      return (y[0].fetchedAt || 0) - (x[0].fetchedAt || 0);
    });
    return { rows: cands[0], covers: cands[0][cands[0].length - 1].time >= to - 3600e3 };
  }

  /* The list and Status pages get only the 2-hour wx-now file. A later arrival needs the full model copy
     (/api/model-weather, the same file wm-model.js stores as wm.mw.v2). Fetched once, on demand, then the cards re-run. */
  var fullCopyAsked = 0;
  function needsHoursNow() {
    try {
      var ph = phaseOf();
      if (ph !== 'land') return false;
      var eta = etaOf(ph);
      return eta != null && Math.abs(eta - Date.now()) > 30 * 60e3;
    } catch (e) { return true; }
  }
  function ensureFullCopy() {
    var t = Date.now();
    if (fullCopyAsked && t - fullCopyAsked < 5 * 60e3) return;
    fullCopyAsked = t;
    try {
      var top_ = window.top && window.top !== window ? window.top : window;
      var p = top_.__wmModelP || fetch('/api/model-weather', { credentials: 'same-origin' })
        .then(function (r) { if (!r.ok) throw r.status; return r.json(); })
        .then(function (d) { d.got = Date.now(); try { localStorage.setItem('wm.mw.v2', JSON.stringify(d)); } catch (e) {} return d; });
      /* notes: 5 (docs/ga-core-v2-wire-notes.md) */
      p.then(function () { delete COPY_MEMO['wm.mw.v2']; if (needsHoursNow()) rerunCards(); }, function (e) { wxStale('full model copy failed', e); });
    } catch (e) {}
  }

  /* pilot-safety P2-4: nearest valid hour to now first, then fetch time (a clamped old hour no longer wins) */
  function modelValidMs(m) {
    if (!m) return NaN;
    var t = m.time != null ? m.time : (m.current && m.current.time);
    if (t == null) return NaN;
    return typeof t === 'number' ? (t < 1e11 ? t * 1000 : t) : Date.parse(String(t).replace(/Z?$/, 'Z'));
  }
  function betterModel(x, y, now) {
    if (!x) return y; if (!y) return x;
    now = now || Date.now();
    var tx = modelValidMs(x), ty = modelValidMs(y);
    var dx = isFinite(tx) ? Math.floor(Math.abs(now - tx) / 60e3 / 30) : 1e9, dy = isFinite(ty) ? Math.floor(Math.abs(now - ty) / 60e3 / 30) : 1e9;
    if (dx !== dy) return dx < dy ? x : y;
    return modelTimeMs(x) >= modelTimeMs(y) ? x : y;
  }
  function modelFromMwCopy(a) {
    return betterModel(modelFromCopy(readNowCopy(), a), modelFromCopy(readMwCopy(), a));
  }


  function looksLikeMetar(raw) {
    raw = String(raw || '').trim();
    return /^(METAR|SPECI)\b/.test(raw) || /^[A-Z]{4}\s+\d{6}Z\b/.test(raw);
  }

  function looksLikeTaf(raw) {
    return /^TAF\b/.test(String(raw || '').trim());
  }

  function rawObsMs(raw, now) {
    now = now || Date.now();
    var m = /(\d{2})(\d{2})(\d{2})Z/.exec(String(raw || ''));
    if (!m) return 0;
    var day = +m[1], hour = +m[2], min = +m[3];
    var base = new Date(now);
    var y = base.getUTCFullYear(), mo = base.getUTCMonth();
    var best = 0, bestAge = Infinity, dmo, t, dt, age;
    /* Day-of-month has no year/month. Prefer the interpretation that is
       nearest to now and not more than 12 hours in the future — otherwise
       a leftover "142100Z" on 10 Nov is read as 14 Nov and beats today's
       live METAR. */
    for (dmo = -1; dmo <= 1; dmo++) {
      t = Date.UTC(y, mo + dmo, day, hour, min);
      dt = new Date(t);
      if (dt.getUTCDate() !== day || dt.getUTCHours() !== hour) continue;
      if (t > now + 12 * 3600 * 1000) continue;
      age = now - t;
      if (age < bestAge) { bestAge = age; best = t; }
    }
    return best;
  }

  function metarTimeMs(met, now) {
    if (!met) return 0;
    if (met.obsTime != null && isFinite(+met.obsTime)) {
      var o = +met.obsTime;
      return o < 1e12 ? o * 1000 : o;
    }
    if (met.time != null && isFinite(+met.time) && +met.time > 1e11) return +met.time;
    return rawObsMs(met.raw || met.rawOb, now);
  }

  function metarCandidate(met) {
    if (!met) return null;
    if (met.raw || met.rawOb || met.wspd != null || met.wdir != null ||
        met.ws != null || met.vis != null || met.visib != null || met.ceil != null || met.cavok) {
      return met;
    }
    return null;
  }

  function pickFreshestMetar(cands, now) {
    now = now || Date.now();
    var usable = [], any = [], i, c, t, age, pool, best, bestT;
    for (i = 0; i < cands.length; i++) {
      c = metarCandidate(cands[i]);
      if (!c) continue;
      t = metarTimeMs(c, now);
      if (t > now + 12 * 3600 * 1000) t = rawObsMs(c.raw || c.rawOb, now);
      any.push({ c: c, t: t || 0 });
      age = t ? now - t : Infinity;
      /* Same 90-minute official window as the engine: a usable live METAR
         always beats a weeks-old baked raw, even if the baked day-of-month
         parsed onto a later calendar day. */
      if (t && age >= -12 * 3600 * 1000 && age <= 90 * 60 * 1000) usable.push({ c: c, t: t });
    }
    pool = usable.length ? usable : any;
    best = null; bestT = -1;
    for (i = 0; i < pool.length; i++) {
      if (!best || pool[i].t > bestT) { best = pool[i].c; bestT = pool[i].t; }
    }
    return best;
  }

  function stampMetar(met, now) {
    if (!met) return null;
    var t = metarTimeMs(met, now);
    if (!t) return met;
    var out = {}, k;
    for (k in met) out[k] = met[k];
    if (out.time == null || !isFinite(+out.time) || +out.time < 1e11) out.time = t;
    if (out.obsTime == null) out.obsTime = t / 1000;
    if (!out.raw && out.rawOb) out.raw = out.rawOb;
    if (!out.rawOb && out.raw) out.rawOb = out.raw;
    return out;
  }

  function modelTimeMs(model) {
    if (!model) return 0;
    var raw = model.fetchedAt != null ? model.fetchedAt
      : (model.time != null ? model.time
      : (model.current && model.current.time));
    if (raw == null) return 0;
    var t = typeof raw === 'number' ? +raw : Date.parse(String(raw).replace(/Z?$/, 'Z'));
    return isFinite(t) ? t : 0;
  }

  /* Prefer the live /api/model-weather copy (wm.mw.v2) over the baked
     wst-data.js snapshot, which can be weeks old and would otherwise
     hide the live model and force NO DATA on model-only fields. */
  function pickFreshestModel(a, om) {
    var fromOm = modelFromOm(om);
    var fromMw = modelFromMwCopy(a);
    return betterModel(fromMw, fromOm);
  }

  function weatherFrom(a, ob) {
    var ic = icOf(a);
    var S = (typeof window !== 'undefined' && window.WMST) || {};
    var weather = {};
    var now = Date.now();
    var store = (S.metar && ic && S.metar[ic]) || null;
    var fromOb = null;
    if (ob && (ob.src === 'off' || ob.src === 'metar' || ob.src === 'speci' || ob.raw || ob.rawOb)) {
      fromOb = {
        raw: ob.raw || ob.rawOb,
        rawOb: ob.raw || ob.rawOb,
        time: ob.time,
        obsTime: ob.time && ob.time > 1e12 ? ob.time / 1000 : ob.obsTime,
        wdir: ob.vrb ? 'VRB' : (ob.wd != null ? ob.wd : ob.wdir),
        wspd: ob.ws != null ? ob.ws : ob.wspd,
        wgst: ob.g != null ? ob.g : ob.wgst,
        vis: ob.vis,
        visib: ob.visib,
        ceil: ob.ceil,
        temp: ob.t != null ? ob.t : ob.temp,
        altim: ob.qnh != null ? ob.qnh : ob.altim,
        cavok: ob.cavok,
        cnr: ob.cnr,
        clouds: ob.clouds
      };
    }
    var met = stampMetar(pickFreshestMetar([store, fromOb], now), now);
    if (met) weather.metar = met;

    var taf = (S.taf && ic && S.taf[ic]) || (ob && ob.taf) || null;
    if (taf) weather.taf = typeof taf === 'string' ? taf : (taf.rawTAF || taf.raw || taf);

    var model = pickFreshestModel(a, S.om && ic && S.om[ic]);
    if (!model && ob && ob.src === 'model') {
      model = {
        vis: ob.vis, ceil: ob.ceil, wd: ob.wd, ws: ob.ws, g: ob.g,
        t: ob.t, qnh: ob.qnh, time: ob.time, vrb: ob.vrb, low: ob.low, cc: ob.cc,
        visibility: ob.visibility, wind_speed_10m: ob.wind_speed_10m,
        wind_direction_10m: ob.wind_direction_10m, wind_gusts_10m: ob.wind_gusts_10m
      };
    }
    if (model) weather.model = model;
    return weather;
  }

  function txt(c, q) {
    var e = c && c.querySelector && c.querySelector(q);
    return e ? (e.textContent || '').trim() : '';
  }

  function weatherFromCard(c, a, ob) {
    var w = weatherFrom(a, ob);
    var icL = icOf(a);
    if (icL && LIVE.metar[icL]) {
      var pl = stampMetar(pickFreshestMetar([w.metar, LIVE.metar[icL]], Date.now()), Date.now());
      if (pl) w.metar = pl;
    }
    if (icL && LIVE.taf[icL]) {
      var curT = w.taf ? String(w.taf).trim() : '';
      if (!curT || rawObsMs(LIVE.taf[icL]) >= rawObsMs(curT)) w.taf = LIVE.taf[icL];
    }
    if (!w.metar) {
      var m = txt(c, '.cp[data-p=metar] .mono');
      if (/^(METAR|SPECI)\b/.test(m)) w.metar = { raw: m };
    }
    if (!w.taf) {
      var t = txt(c, '.cp[data-p=taf] .mono');
      if (/^TAF\b/.test(t)) w.taf = t;
    }
    if (!w.model) {
      try {
        if (c && c.dataset && c.dataset.wxm) {
          var d = JSON.parse(c.dataset.wxm);
          /* The card snapshot carries the model wind direction (d.d). Keep it, so a
             model wind is never turned into "variable, direction unknown". */
          var dd = d.d != null && isFinite(+d.d) ? +d.d : null;
          var num = function (x) { return x == null || x === '' || !isFinite(+x) ? null : +x; };
          w.model = { vis: num(d.v), ceil: num(d.c), ws: num(d.w), g: num(d.g), wd: dd, time: +d.t, vrb: dd == null && num(d.w) != null };
        }
      } catch (e) { wxStale('card model snapshot unreadable', e); }
    }
    return w;
  }

  /* notes: 2 (docs/ga-core-v2-wire-notes.md) */
  var phaseTurn = null;
  function phaseSlow() {
    if (phaseTurn) return phaseTurn.v;
    var v = 'depart';
    try {
      var stored = ls('wm.phaseMode') || ls('wm-phase');
      if (stored === 'land' || stored === 'depart') v = stored;
      /* Port 13 Nov 2026: the DOM fallback goes through live's domPhase() (fix/ipad-safari, 1 s memo), so both guards
         apply: once per turn here, and at most one document walk per second across turns. */
      else v = domPhase();
    } catch (e) {}
    phaseTurn = { v: v };
    try { Promise.resolve().then(function () { phaseTurn = null; }); } catch (e) { phaseTurn = null; }
    return v;
  }

  var FORCE = null;   // E-10 precompute: { phase, eta } for the duration of one synchronous slice, never left set
  function phaseOf() {
    if (FORCE) return FORCE.phase;
    try {
      if (window.WMPHASE && (WMPHASE.mode === 'land' || WMPHASE.mode === 'depart')) return WMPHASE.mode;
      if (window.GA_PHASE === 'land' || window.GA_PHASE === 'depart') return window.GA_PHASE;
    } catch (e) {}
    return phaseSlow();
  }

  /* notes: 4 (docs/ga-core-v2-wire-notes.md) */
  var domPhaseV = 'depart', domPhaseT = -1e9;
  function domPhase() {
    var t = Date.now();
    if (t - domPhaseT < 1000) return domPhaseV;
    domPhaseT = t;
    domPhaseV = 'depart';
    var on = document.querySelector('[data-phase].on, [data-phase][aria-pressed="true"], .wphase [aria-pressed="true"], button[data-v="land"].on');
    if (on) {
      var v = (on.getAttribute('data-phase') || on.getAttribute('data-v') || on.textContent || '').toLowerCase();
      if (v.indexOf('land') >= 0 && v.indexOf('depart') < 0) domPhaseV = 'land';
    }
    return domPhaseV;
  }

  function etaOf(phase) {
    if (FORCE) return FORCE.eta;
    if (phase !== 'land') return undefined;
    try {
      var P = window.WMPHASE;
      if (!P || !P.arrive) return undefined;
      if (P.arrive.at != null) return +P.arrive.at;
      if (P.arrive.off) return Date.now() + P.arrive.off * 36e5;
    } catch (e) {}
    return undefined;
  }

  function sourceKind(result) {
    var kind = result && result.source && result.source.kind;
    if (kind === 'speci' || kind === 'trend') return 'metar';
    if (kind === 'metar' || kind === 'taf' || kind === 'model') return kind;
    var src = result && result.weatherUsed && result.weatherUsed.src;
    if (src === 'speci' || src === 'trend' || src === 'off') return 'metar';
    if (src === 'metar' || src === 'taf' || src === 'model') return src;
    return null;
  }

  function incompleteLabel(result) {
    if (result && result.status === 'incomplete') return 'No weather';
    return (result && (result.label || result.why)) ||
      (V2 && V2.NO_WEATHER_LABEL) ||
      'No weather';
  }

  function withModelDisclaimer(why, result) {
    if (result && result.status === 'incomplete') {
      return incompleteLabel(result);
    }
    var text = why || '';
    if (sourceKind(result) === 'model') {
      var note = V2.MODEL_DISCLAIMER || 'Model estimate only — not an official weather report.';
      if (text.indexOf(note) < 0) text = text ? (text + ' · ' + note) : note;
    }
    return text;
  }

  function toLegacy(result, ob) {
    var s = mapStatus(result.status, result.code);
    var F = (result.findings || result.reasons || []).map(function (f) {
      return { lv: f.lv === 'incomplete' ? 'none' : f.lv, txt: f.txt, k: f.k, ruleId: f.ruleId };
    });
    var wd = result.wind;
    return {
      s: s,
      why: withModelDisclaimer(result.why, result),
      label: result.status === 'incomplete' ? incompleteLabel(result) : (result.label || null),
      F: F,
      wind: wd ? { id: wd.id, hw: wd.hw, xw: wd.xw, gx: wd.gxw != null ? wd.gxw : wd.gx, a: wd.a } : null,
      da: result.da,
      si: result.sun || result.si,
      ob: ob,
      heliport: !!result.heliport,
      core: result,
      v2: result
    };
  }

  function toCard(result, a) {
    var s = mapStatus(result.status, result.code);
    var why = withModelDisclaimer(result.why, result);
    var kind = sourceKind(result);
    var used = result.weatherUsed;
    return {
      status: s,
      code: result.code,
      heliport: !!result.heliport,
      why: why,
      whyShort: why,
      label: result.status === 'incomplete' ? incompleteLabel(result) : (result.label || null),
      reasons: (result.findings || []).map(function (f) {
        var sev = f.lv === 'note' ? 'go' : mapStatus(f.lv, '');
        return { check: f.k || 'engine', value: null, limit: null, severity: sev, text: f.txt };
      }),
      source: kind,
      time: used && used.time,
      weatherUsed: used,
      windSource: result.windSource,
      da: result.da,
      wind: result.wind,
      sun: result.sun,
      phase: result.phase,
      icao: icOf(a),
      disclaimers: result.disclaimers,
      rulePackVersion: result.rulePackVersion,
      v2: result
    };
  }

  function storeResult(a, card, now, result) {
    if (!window.WMB || !window.WMB.results || !a) return;
    var ic = icOf(a);
    if (!ic) return;
    window.WMB.results[ic] = { r: card, t: now, w: result && result.source, ad: a };
  }

  function runV2(a, ob, acId, rules, P, now, extraWeather) {
    now = now || Date.now();
    var pr = profileOf(P, acId, rules);
    var weather = extraWeather || weatherFrom(a, ob);
    var phase = phaseOf();
    var eta = etaOf(phase);
    if (eta != null && Math.abs(eta - now) > 30 * 60e3 && weather && !weather.modelHours) {
      var mh = modelHoursFor(a, eta + 3600e3);
      if (mh.rows) weather = Object.assign({}, weather, { modelHours: mh.rows });
      if (!mh.covers) ensureFullCopy();
    }
    var input = {
      field: fieldOf(a),
      weather: weather,
      profile: pr.profile,
      aircraftId: pr.aircraftId,
      rules: pr.rules,
      phase: phase,
      eta: eta,
      now: now
    };
    return evalCached(input);
  }

  /* notes: 1 (docs/ga-core-v2-wire-notes.md) */
  var EVAL_CACHE = {}, evalMin = -1, evalN = 0, rowIds = 0;

  function tafRawOf(t) { return t == null ? '' : (typeof t === 'string' ? t : (t.raw || t.rawTAF || '')); }
  function wxStale(why, e) {
    try { wxStale.n = (wxStale.n || 0) + 1; if (wxStale.n <= 20) console.warn('[wx] ' + why, e || ''); } catch (x) {}
    try { document.documentElement.setAttribute('data-wx-stale', String(why).slice(0, 80)); } catch (x) {}
  }
  function withTaf(input, taf) {
    var w = {}, k, src = input.weather || {};
    for (k in src) w[k] = src[k];
    if (taf) w.taf = taf; else { delete w.taf; delete w.tafRaw; }
    var o = {}; for (k in input) o[k] = input[k];
    o.weather = w;
    return o;
  }
  /* invalid TAF dropped; TAF answer outside its window re-run without it; CAVOK not in force re-run as 9999 NSC */
  function metarBlind(m) {
    var raw = String((m && (m.rawOb || m.raw)) || '').split(/\s(?:RMK|TEMPO|BECMG|NOSIG)\b/)[0];
    if (/\bCAVOK\b/.test(raw)) return false;   // missing visibility alone: the engine fills it from the TAF / model (POL-FILL-HOLE)
    return /\s\/{6}(?:CB|TCU|\/{3})?(?=\s|$)/.test(raw) && !/\s(?:FEW|SCT|BKN|OVC)\d{3}|\sVV\d{3}|\s(?:NSC|NCD|SKC|CLR)\b/.test(raw);   // cloud "//////" only
  }
  function evaluateSafe(input) {
    var now = input.now != null ? +input.now : Date.now();
    var w = input.weather || {}, raw = tafRawOf(w.taf) || (typeof w.tafRaw === 'string' ? w.tafRaw : '');
    if (raw && !tafValid(raw, now)) { input = withTaf(input, null); raw = ''; }
    var r = V2.evaluate(input);
    var src = r && r.source, used = (r && r.weatherUsed) || {};
    // A GO from a METAR whose cloud group is "//////" (AUTO sensor not reporting), with no cloud filled from TAF / model:
    // judge on the TAF / model instead; a CAUTION or NO-GO the METAR does show is kept (13 Nov 2026, FAWB / FAWK).
    // 14 Nov: cloud filled from TAF / model (ceilSrc) keeps the METAR base (FAHS).
    if (src && /^(metar|speci|trend)$/.test(src.kind) && r.status === 'go' && w.metar && metarBlind(w.metar) && used.ceil == null && !used.cavok && !used.skyClear && !used.ceilSrc) {
      var wm = {}, km; for (km in input.weather) if (km !== 'metar') wm[km] = input.weather[km];
      var om = {}; for (km in input) om[km] = input[km]; om.weather = wm;
      return evaluateSafe(om);
    }
    if (!raw || !src || src.kind !== 'taf') return r;
    var win = tafWindow(raw, now), at = src.time != null ? +src.time : now;
    if (!win || !(at >= win.from && at < win.to)) return V2.evaluate(withTaf(input, null));   // TAF not in force
    if (used.vis == null && r.status === 'go') return V2.evaluate(withTaf(input, null));     // GO with no visibility in force
    if (/CAVOK/.test(raw) && V2.conditionsAt) {
      var cov = null;
      try { cov = V2.conditionsAt(raw, at); } catch (e) { cov = null; }
      if (!cov || !(cov.cavok || /CAVOK/.test(cov.wx || ''))) {
        var fixed = raw.replace(/\bCAVOK\b/g, '9999 NSC');
        var r2 = V2.evaluate(withTaf(input, fixed));
        return r2 && r2.source && r2.source.kind === 'taf' ? r2 : V2.evaluate(withTaf(input, null));
      }
    }
    return r;
  }
  window.GA_TAF.evaluateSafe = evaluateSafe;
  function rowsKey(rows) {
    if (!rows) return '';
    if (!rows.__gaId) { try { Object.defineProperty(rows, '__gaId', { value: ++rowIds, enumerable: false }); } catch (e) { return JSON.stringify(rows); } }
    return 'r' + rows.__gaId;
  }
  function evalCached(input) {
    var min = Math.floor(input.now / 60e3);
    if (min !== evalMin || evalN > 20000) { EVAL_CACHE = {}; evalMin = min; evalN = 0; }
    var w = input.weather || {}, wk = {}, k2;
    for (k2 in w) if (k2 !== 'modelHours') wk[k2] = w[k2];
    var key;
    try {
      key = JSON.stringify([input.field, wk, rowsKey(w.modelHours), input.profile, input.aircraftId, input.rules, input.phase,
        input.eta == null ? null : Math.floor(input.eta / 60e3)]);
    } catch (e) { return evaluateSafe(input); }
    var hit = EVAL_CACHE[key];
    if (hit) return hit;
    var r = evaluateSafe(input);
    EVAL_CACHE[key] = r; evalN++;
    return r;
  }
  window.GA_ENGINE_CACHE = { size: function () { return evalN; }, clear: function () { EVAL_CACHE = {}; evalN = 0; } };

  W.status = function (a, ob, acId, rules, P, now) {
    try {
      var result = runV2(a, ob, acId, rules, P, now);
      var legacy = toLegacy(result, ob);
      storeResult(a, toCard(result, a), now || Date.now(), result);
      return legacy;
    } catch (err) {
      try { console.log('ga-core-v2-wire status', err); } catch (x) {}
      return OLD_STATUS.apply(this, arguments);
    }
  };

  function runwaysFromCard(c) {
    if (!c || !c.querySelectorAll) return [];
    var lines = c.querySelectorAll('.rwd line.r');
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      try {
        var dx = l.x2.baseVal.value - l.x1.baseVal.value;
        var dy = l.y2.baseVal.value - l.y1.baseVal.value;
        var h = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
        var idA = String(Math.round(h / 10) || 36).padStart(2, '0');
        var idB = String(Math.round(((h + 180) % 360) / 10) || 36).padStart(2, '0');
        out.push({ id: idA, true: h, hdg: h });
        out.push({ id: idB, true: (h + 180) % 360, hdg: (h + 180) % 360 });
      } catch (e) {}
    }
    return out;
  }

  /* 13 Nov 2026 (speed): every card on every pass searched the whole FS_D list and every aerodrome (for the magnetic
     variation). Same answer, worked out once per aerodrome while those lists are the same objects. */
  var RW_MEMO = { fs: null, ads: null, m: {} }, AD_IDX = { ads: null, m: null };
  function adIndex(ads) {
    if (AD_IDX.ads !== ads) {
      var m = {};
      for (var i = 0; i < ads.length; i++) if (ads[i] && m[ads[i].ic] === undefined) m[ads[i].ic] = ads[i];
      AD_IDX = { ads: ads, m: m };
    }
    return AD_IDX.m;
  }
  function runwaysFromFs(ic, a) {
    var fsA = window.WM_RWDB, adsA = window.WMST && window.WMST.ads;
    if (RW_MEMO.fs !== fsA || RW_MEMO.ads !== adsA) RW_MEMO = { fs: fsA, ads: adsA, m: {} };
    var mk = ic;
    if (RW_MEMO.m[mk]) return RW_MEMO.m[mk];
    return (RW_MEMO.m[mk] = runwaysFromFsSlow(ic, a));
  }
  /* 15 Nov 2026 (MT 14:23 SAST): runway headings come only from the locked runway/elevation DB (wst/ad-rwy-db.<hash>.json,
     window.WM_RWDB: published or measured true headings). A runway number is never turned into a heading any more; a field
     the DB has no heading for keeps rw [] and gets the engine's 'Runway headings unavailable' CAUTION. */
  function runwaysFromFsSlow(ic) {
    var D = window.WM_RWDB, x = D && D.a && D.a[ic];
    if (!x || !x[1] || !D.ends) return [];
    return D.ends(x[1]).map(function (e) { return { id: String(e.id), true: e.true, hdg: e.true }; });
  }
  function dbElev(ic) {
    var D = window.WM_RWDB, x = D && D.a && D.a[ic];
    return x && x[0] != null && isFinite(+x[0]) ? +x[0] : null;
  }

  function ensureRunwayHeadings(a, c) {
    if (!a) return a;
    var rw = a.rw || a.runways || [];
    var has = rw.some(function (r) { return r && isFinite(+(r.true != null ? r.true : r.trueHdg)); });
    if (has) return a;
    /* Honest: only DB headings (published or measured). Never invent a heading from the
       decorative card SVG or from a runway number (ZA-0069 Riverside has no published runways). */
    var fs = runwaysFromFs(icOf(a), a);
    if (fs.length) {
      var b2 = {}; for (var k in a) b2[k] = a[k];
      b2.rw = fs; b2.runways = fs;
      return b2;
    }
    return a;
  }

  function adFromCard(c, ic) {
    var C = window.WSTC, S = window.WMST;
    if (C && C.AD && C.AD[ic]) return ensureRunwayHeadings(C.AD[ic], c);
    if (S && S.ads) {
      var hitAd = adIndex(S.ads)[ic];
      if (hitAd) return ensureRunwayHeadings(hitAd, c);
    }
    var la = c.querySelector && c.querySelector('[data-la]');
    var cat = c.dataset && c.dataset.cat;
    var el = c.querySelector && (c.querySelector('[data-el]') || c.querySelector('[data-elev]'));
    var elev = el ? +(el.dataset.el || el.dataset.elev) : null, elevSrc = el ? 'card' : null;
    /* Field elevation from the locked runway/elevation DB (wst/ad-rwy-db.<hash>.json; replaced wst/ad-elev.js on 15 Nov 2026), so
       density altitude is measured against the field's own elevation on every card, not only the AIP 65. */
    if (!(elev != null && isFinite(elev)) && dbElev(ic) != null) {
      elev = dbElev(ic); elevSrc = 'field elevation';
    }
    return ensureRunwayHeadings({
      ic: ic,
      icao: ic,
      la: la ? +la.dataset.la : null,
      lo: la ? +la.dataset.lo : null,
      el: elev != null && isFinite(elev) ? elev : null,
      elevSrc: elevSrc,
      cat: cat === 'controlled' || cat === 'international' ? 'c' : cat === 'uncontrolled' ? 'u' : undefined,
      rw: [],
      iap: null
    }, c);
  }

  /* notes: 9 (docs/ga-core-v2-wire-notes.md) */
  function windText(u) {
    if (!u || u.ws == null || !isFinite(+u.ws)) return '—';
    var ws = Math.round(+u.ws);
    var g = u.g != null && isFinite(+u.g) && +u.g > ws ? ' G' + Math.round(+u.g) : '';
    if (ws === 0 && !g) return 'Calm';
    var d = u.vrb ? 'VRB' : (u.wd != null && isFinite(+u.wd) ? String(Math.round(+u.wd) % 360).padStart(3, '0') + '°' : '—°');
    return d + ' ' + ws + ' kt' + g;
  }
  function setHtml(el, h) {
    if (!el) return;
    if (el.__gaH === h && el.innerHTML === h) return;
    el.innerHTML = h;
    el.__gaH = h;
  }
  function visText(u) {
    if (!u || u.vis == null || !isFinite(+u.vis)) return '—';
    return +u.vis >= 10 ? '10+ km' : (Math.round(+u.vis * 10) / 10).toFixed(1).replace(/\.0$/, '') + ' km';
  }
  function skyText(u) {
    if (!u) return '—';
    if (u.cavok) return 'CAVOK';
    var raw = String(u.raw || u.wx || '');
    var body = ' ' + raw.replace(/=/g, ' ') + ' ';
    if (u.ceilSrc === 'metar' || u.ceilSrc === 'speci' || u.ceilSrc === 'trend' || u.src === 'metar' || u.src === 'speci') {
      var L = [], m, re = / (FEW|SCT|BKN|OVC|VV)(\d{3}|\/\/\/)/g;
      while ((m = re.exec(body))) L.push(m[1] + (m[2] === '///' ? '' : m[2]));
      var cl = L.filter(function (x) { return /^(BKN|OVC|VV)/.test(x); })[0] || L[0];
      var nsc = body.match(/ (NSC|NCD|SKC|CLR) /);
      if (cl) return cl;
      if (nsc) return nsc[1];
    }
    if (u.skyClear) return 'NSC';
    if (u.ceil != null && isFinite(+u.ceil)) return null; /* caller paints Ceil N ft */
    if (u.cc != null && isFinite(+u.cc)) return 'CC';
    return '—';
  }
  function catOf(u) {
    if (!u || u.vis == null) return null;
    var sm = u.vis / 1.609, c = u.ceil;
    if ((c != null && c < 500) || sm < 1) return 'LIFR';
    if ((c != null && c < 1000) || sm < 3) return 'IFR';
    if ((c != null && c <= 3000) || sm <= 5) return 'MVFR';
    return 'VFR';
  }
  function ceilKnown(u) {
    if (!u) return false;
    if (u.ceil != null || u.cavok || u.skyClear || u.ceilSrc) return true;
    return u.src !== 'model' && /(?:^|\s)(?:FEW|SCT)\d{3}(?:CB|TCU)?(?:\s|$)/.test(' ' + String(u.raw || u.wx || '') + ' ');
  }
  function paintRules(c, u) {
    var fc = c.querySelector && c.querySelector('.fcb2');
    if (!fc) return;
    var k = catOf(u), html, eye = '<button class="inote">i</button>';
    /* LOW CLOUD: base unknown and low cover >= 63 % only */
    var unknown = u && u.vis != null && !ceilKnown(u) && u.low != null && +u.low >= 63 && /^(VFR|MVFR)$/.test(k);
    if (unknown) {
      html = '<span class="fbadge wmb" style="--c:#F5A524" title="Cloud base unknown — category not assumed"><i></i>LOW CLOUD</span>' + eye;
    } else if (k) {
      var vm = /^(VFR|MVFR)$/.test(k) ? 'VMC' : 'IMC';
      var col = { VFR: '#22C55E', MVFR: '#3B82F6', IFR: '#F80F3B', LIFR: '#C026D3' }[k] || '#8E8E93';
      html = '<span class="fbadge wmb" style="--c:' + col + '"><i></i>' + k + '</span><span class="fbadge wmb" style="--c:' + (vm === 'VMC' ? '#22C55E' : '#F80F3B') + '"><i></i>' + vm + '</span>' + eye;
    } else html = eye;
    setHtml(fc, html);
  }
  function showUsedTab(c, src) {
    var tab = (src === 'speci' || src === 'metar' || src === 'trend') ? 'metar' : (src === 'taf' ? 'taf' : 'model');
    var sw = c.querySelector && c.querySelector('.csw');
    if (sw) sw.dataset.init = tab;
    if (sw && typeof sw._set === 'function') {
      try { sw._set(tab); } catch (e) {}
    }
    var cps = c.querySelectorAll && c.querySelectorAll('.cp');
    if (cps && cps.length) {
      for (var i = 0; i < cps.length; i++) cps[i].classList.toggle('on', cps[i].dataset.p === tab);
    }
    var btns = sw && sw.querySelectorAll('button, [data-v]');
    if (btns) {
      for (var j = 0; j < btns.length; j++) {
        var v = btns[j].dataset && btns[j].dataset.v;
        if (v) btns[j].classList.toggle('on', v === tab);
      }
    }
  }
  function paintWind(c, result) {
    paintCardWeather(c, result);
  }
  function paintCardWeather(c, result) {
    if (!c || !c.querySelectorAll || !result || result.heliport) return;
    var u = result.weatherUsed;
    if (!u) return;
    var wr = c.querySelector(':scope > .wxrow') || c.querySelector('.wxrow');
    var sp = wr ? wr.querySelectorAll('.wxd span') : c.querySelectorAll('.wxd span');
    var h0 = 'Wind <b class="num">' + windText(u) + '</b>';
    if (sp[0] && /^\s*Wind\b/.test(sp[0].textContent || '')) {
      setHtml(sp[0], h0);
      sp[0].__gaWindH = h0;
      if (sp[0].hasAttribute && sp[0].hasAttribute('data-ad-empty') && u.ws != null) sp[0].removeAttribute('data-ad-empty');
    }
    var sky = skyText(u);
    var mid;
    if (sky === 'CAVOK') mid = 'Vis <b>' + visText(u) + '</b> · Sky <b>CAVOK</b>';
    else if (sky && sky !== '—' && sky !== 'CC' && u.ceil == null) mid = 'Vis <b>' + visText(u) + '</b> · Sky <b>' + sky + '</b>';
    else if (sky && sky !== '—' && sky !== 'CC') mid = 'Vis <b>' + visText(u) + '</b> · Sky <b>' + sky + '</b>';
    else if (u.ceil != null && isFinite(+u.ceil)) mid = 'Vis <b>' + visText(u) + '</b> · Ceil <b>' + Number(u.ceil).toLocaleString('en-US') + ' ft</b>';
    else if (u.cc != null && isFinite(+u.cc)) mid = 'Vis <b>' + visText(u) + '</b> · Cloud <b>' + Math.round(+u.cc) + '%</b>';
    else mid = 'Vis <b>' + visText(u) + '</b> · Sky <b>—</b>';
    if (sp[1]) setHtml(sp[1], mid);
    if (sp[2] && /^\s*QNH\b/.test(sp[2].textContent || '')) {
      setHtml(sp[2], 'QNH <b class="num">' + (u.qnh != null && isFinite(+u.qnh) ? String(Math.round(+u.qnh)) : '—') + '</b>');
    }
    var tp = wr && wr.querySelector('.temp');
    if (tp) {
      if (tp.style && tp.style.color) tp.style.color = '';
      setHtml(tp, u.temp != null && isFinite(+u.temp) ? Math.round(+u.temp) + '<sup>°C</sup>' : '—');
    }
    paintRules(c, u);
    var src = (result.source && result.source.kind) || u.src;
    showUsedTab(c, src);
    if (c.dataset) {
      if (src === 'model' || src === 'open-meteo') c.dataset.model = '1';
      else if (c.dataset.model === '1' && src && src !== 'model') delete c.dataset.model;
    }
  }
  if (typeof window !== 'undefined') { window.GA_WIND_TEXT = windText; window.GA_PAINT_WIND = paintWind; window.GA_PAINT_WX = paintCardWeather; }
  /* 13 Nov 2026: the night pill (wq.js) asks for the same profile the engine uses, so the two can never disagree. */
  if (typeof window !== 'undefined') window.GA_ENGINE_PROFILE = function () { return profileOf(null, null, null); };

  function patchEvalCard() {
    if (!window.WMB || !window.WMB.evalCard || window.WMB.evalCard.__gaV2) return;
    var OLD_EVAL = window.WMB.evalCard;
    window.GA_ENGINE_PREV_EVALCARD = OLD_EVAL;
    var wrapped = function (c, now) {
      now = now || Date.now();
      try {
        var ic = txt(c, '.icao');
        if (ic && rwdbState === 'loading' && !(window.AD_CLASS && window.AD_CLASS[ic])) {
          /* runway / elevation DB still on its way: no verdict yet (the cards re-run when it arrives); heliports need no runway */
          return { status: 'none', code: 'PENDING', pending: true, heliport: false, why: 'Loading runway data…', whyShort: 'Loading runway data…',
            label: null, reasons: [], source: null, icao: ic };
        }
        if (ic) {
          var a = adFromCard(c, ic);
          var S = window.WMST;
          var ob = (S && W.obsOf) ? W.obsOf(a, S) : null;
          var result = runV2(a, ob, null, null, null, now, weatherFromCard(c, a, ob));
          var card = toCard(result, a);
          storeResult(a, card, now, result);
          try { paintWind(c, result); } catch (e2) {}
          return card;
        }
      } catch (err) {
        try { console.log('ga-core-v2-wire evalCard', err); } catch (x) {}
      }
      return OLD_EVAL.apply(this, arguments);
    };
    wrapped.__gaV2 = true;
    window.WMB.evalCard = wrapped;
  }

  patchEvalCard();
  if (!window.WMB || !window.WMB.evalCard || !window.WMB.evalCard.__gaV2) {
    if (typeof document !== 'undefined') {
      document.addEventListener('DOMContentLoaded', patchEvalCard);
    }
    setTimeout(patchEvalCard, 0);
    setTimeout(patchEvalCard, 50);
  }

  function pageIcao() {
    try {
      var title = document.title || '';
      var tm = title.match(/Go Around\s*[·•]\s*([A-Z]{4}|ZA-\d{4})\b/i);
      if (tm) return tm[1].toUpperCase();
    } catch (e) {}
    try {
      if (window.WSTAD && (WSTAD.ic || WSTAD.icao)) return String(WSTAD.ic || WSTAD.icao).toUpperCase();
    } catch (e) {}
    var path = '';
    try { path = location.pathname || ''; } catch (e) { path = ''; }
    var m = path.match(/\/([A-Z0-9-]+)(?:\.html)?$/i);
    return m ? m[1].toUpperCase() : '';
  }

  function adFromPage() {
    var ic = pageIcao();
    var C = window.WSTC, S = window.WMST, A = window.WSTAD || {};
    if (C && C.AD && C.AD[ic]) return ensureRunwayHeadings(C.AD[ic], null);
    if (S && S.ads) {
      for (var i = 0; i < S.ads.length; i++) if (S.ads[i].ic === ic) return ensureRunwayHeadings(S.ads[i], null);
    }
    var f = window.FS_D && FS_D.a && FS_D.a.filter(function (x) { return x[0] === ic; })[0];
    var dec = -22;
    if (S && S.ads && S.ads.length) {
      var best = 1e9, j;
      for (j = 0; j < S.ads.length; j++) {
        var d = (S.ads[j].la - A.la) * (S.ads[j].la - A.la) + (S.ads[j].lo - A.lo) * (S.ads[j].lo - A.lo);
        if (d < best) { best = d; dec = S.ads[j].dec; }
      }
    }
    var rw = runwaysFromFsSlow(ic); /* DB headings only (15 Nov 2026), never designator x 10 */
    return ensureRunwayHeadings({
      ic: ic,
      icao: ic,
      nm: f ? f[1] : ic,
      la: A.la,
      lo: A.lo,
      el: dbElev(ic),
      cat: f && (f[4] === 'i' || f[4] === 'c') ? 'c' : 'u',
      iap: null,
      rw: rw,
      heli: !rw.length && /heli(?:port|pad|stop)?\b|hospital|\bHP\b/i.test(f ? f[1] : document.title)
    }, null);
  }

  /* Aerodrome pages and cards: read the same live /api/metar + /api/taf feed,
     including stations outside the 65-field wst-data catalog (e.g. FAVV). */
  /* 15 Nov 2026 (MT 14:23 SAST): re-check /api/wx-now (ETag) on the minutes the weather Worker fetches: every minute at
     :04-:20 and :30-:34 SAST and for 45 min after the TAF issue times 05, 06, 08, 11, 12, 18, 00 SAST; every 5 min otherwise */
  function liveDue(t) {
    var d = new Date(t + 2 * 3600e3), h = d.getUTCHours(), m = d.getUTCMinutes();
    return (m >= 4 && m <= 20) || (m >= 30 && m <= 34) || m % 5 === 0 || ([0, 5, 6, 8, 11, 12, 18].indexOf(h) >= 0 && m < 45);
  }
  window.WM_LIVE_DUE = liveDue;
  function fetchLiveOfficial(done, quiet) {
    if (typeof fetch !== 'function') return;
    if (!quiet) LIVE.loud = 1;
    /* Keep the latest callback so a second call while a fetch is in flight
       is not dropped (the old early-return left LIVE.pending true and lost `done`). */
    if (done) LIVE.nextDone = done;
    if (LIVE.pending) return;
    LIVE.pending = true;
    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      if (LIVE.hangTimer) { clearTimeout(LIVE.hangTimer); LIVE.hangTimer = 0; }
      LIVE.pending = false;
      var cb = LIVE.nextDone, t = Date.now();
      LIVE.nextDone = null;
      var skip = LIVE.same && !LIVE.loud && t - (LIVE.ran || 0) < 3e5;
      LIVE.loud = 0;
      if (skip) return;
      LIVE.ran = t;
      if (cb) cb();
    }
    /* If /api/metar or /api/taf hang, do not leave pending stuck forever. */
    LIVE.hangTimer = setTimeout(finish, 20000);
    var ac = typeof AbortController === 'function' ? new AbortController() : null;
    if (ac) setTimeout(function () { try { ac.abort(); } catch (e) {} }, 15000);
    function legacy() {
      var p1 = fetch('/api/metar', { cache: 'no-store', signal: ac && ac.signal }).then(function (r) { if (!r.ok) wxStale('/api/metar HTTP ' + r.status); return r.ok ? r.json() : []; }).catch(function (e) { wxStale('/api/metar failed', e); return []; });
      var p2 = fetch('/api/taf', { cache: 'no-store', signal: ac && ac.signal }).then(function (r) { if (!r.ok) wxStale('/api/taf HTTP ' + r.status); return r.ok ? r.json() : []; }).catch(function (e) { wxStale('/api/taf failed', e); return []; });
      return Promise.all([p1, p2]);
    }
    /* 15 Nov (MT): /api/wx-now + If-None-Match every 60 s (304 = no change), else /api/metar + /api/taf */
    fetch('/api/wx-now', { cache: 'no-store', headers: LIVE.etag ? { 'If-None-Match': LIVE.etag } : {}, signal: ac && ac.signal })
      .then(function (r) { if (r.status === 304) return 304; if (!r.ok) return null; var e = r.headers.get('ETag'); return r.json().then(function (j) { if (j && Array.isArray(j.metar) && Array.isArray(j.taf)) { LIVE.etag = e; return [j.metar, j.taf]; } return null; }); })
      .catch(function () { return null; })
      .then(function (j) { return j === 304 ? (LIVE.same = 1, [[], []]) : (LIVE.same = 0, j || legacy()); })
      .then(function (res) {
      var M = Array.isArray(res[0]) ? res[0] : [];
      var T = Array.isArray(res[1]) ? res[1] : [];
      var i, m, prev;
      var Sstore = (typeof window !== 'undefined' && window.WMST) || null;
      if (Sstore && !Sstore.metar) Sstore.metar = {};
      if (Sstore && !Sstore.taf) Sstore.taf = {};
      for (i = 0; i < M.length; i++) {
        m = M[i];
        if (!m || !m.icaoId) continue;
        prev = LIVE.metar[m.icaoId];
        if (!prev || (+m.obsTime || 0) >= (+prev.obsTime || 0)) LIVE.metar[m.icaoId] = m;
        if (Sstore) Sstore.metar[m.icaoId] = LIVE.metar[m.icaoId];
      }
      for (i = 0; i < T.length; i++) {
        if (T[i] && T[i].icaoId && T[i].rawTAF) {
          LIVE.taf[T[i].icaoId] = T[i].rawTAF;
          if (Sstore) Sstore.taf[T[i].icaoId] = T[i].rawTAF;
        }
      }
      /* pilot-safety P0-2: drop stale entries (the cache only ever added) */
      var nowL = Date.now(), kk;
      for (kk in LIVE.metar) { var mo = LIVE.metar[kk], ot = mo && +mo.obsTime; if (!(ot > 0) || nowL - (ot < 1e12 ? ot * 1000 : ot) > 3 * 3600e3) delete LIVE.metar[kk]; }
      for (kk in LIVE.taf) if (!tafValid(LIVE.taf[kk], nowL)) delete LIVE.taf[kk];
      LIVE.at = nowL;
    }).then(finish, function (e) { wxStale('live official refresh failed', e); finish(); });
  }

  function weatherFromPage(a) {
    var w = weatherFrom(a, null);
    var icL = icOf(a);
    if (icL && LIVE.metar[icL]) {
      var pl = stampMetar(pickFreshestMetar([w.metar, LIVE.metar[icL]], Date.now()), Date.now());
      if (pl) w.metar = pl;
    }
    if (icL && LIVE.taf[icL]) {
      var cur = w.taf ? String(w.taf).trim() : '';
      if (!cur || rawObsMs(LIVE.taf[icL]) >= rawObsMs(cur)) w.taf = LIVE.taf[icL];
    }
    var rm = document.querySelector('#s-wx .rawb[data-r=metar]');
    var rt = document.querySelector('#s-wx .rawb[data-r=taf]');
    var raw = rm ? (rm.textContent || '').trim() : '';
    var tf = rt ? (rt.textContent || '').trim() : '';
    /* The page fetch writes the live raw into the DOM. wst-data.js may still
       hold a weeks-old METAR/TAF for the same ICAO — pick the newer report. */
    if (looksLikeMetar(raw)) {
      var picked = stampMetar(pickFreshestMetar([w.metar, { raw: raw, rawOb: raw }], Date.now()), Date.now());
      if (picked) w.metar = picked;
    }
    if (looksLikeTaf(tf)) {
      var storeTaf = w.taf ? String(w.taf).trim() : '';
      if (!storeTaf || storeTaf !== tf) {
        if (!storeTaf || rawObsMs(tf) >= rawObsMs(storeTaf)) w.taf = tf;
      }
    }
    if (!w.model) {
      var S = (typeof window !== 'undefined' && window.WMST) || {};
      w.model = pickFreshestModel(a, S.om && a && S.om[icOf(a)]);
    }
    return w;
  }

  function pageHasOfficial() {
    var rm = document.querySelector('#s-wx .rawb[data-r=metar]');
    var rt = document.querySelector('#s-wx .rawb[data-r=taf]');
    var raw = rm ? (rm.textContent || '').trim() : '';
    var tf = rt ? (rt.textContent || '').trim() : '';
    if (looksLikeMetar(raw) || looksLikeTaf(tf)) return true;
    try {
      var a0 = adFromPage();
      var ic0 = a0 && icOf(a0);
      if (ic0 && (LIVE.metar[ic0] || LIVE.taf[ic0])) return true;
    } catch (e) {}
    return false;
  }

  function modelCopyReady() {
    try { return !!(localStorage.getItem('wm.now.v1') || localStorage.getItem('wm.mw.v2')); } catch (e) { return false; }
  }

  function paintPage(legacy) {
    var v = document.getElementById('verd');
    var vs = document.getElementById('vs');
    var vw = document.getElementById('vw');
    if (!v || !vs || v.getAttribute('data-s') === 'heli' || (legacy && legacy.heliport)) return;
    try { window.GA_V2_PAGE = legacy; } catch (e) {}
    var land = phaseOf() === 'land';
    var LB = {
      go: land ? 'LAND' : 'DEPART',
      caution: 'CAUTION',
      nogo: land ? 'NO LAND' : 'NO DEPART',
      none: 'No weather'
    };
    /* Model-only fields: keep the pill blank until the model copy was tried.
       METAR/TAF fields keep their existing first paint. */
    if (legacy && legacy.s === 'none' && !pageHasOfficial() && !modelCopyReady()) {
      v.dataset.s = '';
      vs.textContent = '';
      if (vw) vw.textContent = '';
      return;
    }
    var noneLab = legacy.s === 'none' ? (legacy.label || legacy.why || 'No weather') : '';
    v.dataset.s = legacy.s;
    vs.textContent = (legacy.s === 'none' && noneLab) ? noneLab : (LB[legacy.s] || legacy.s);
    if (vw) {
      var why = String(legacy.why || noneLab || '').replace(/ · METAR.*$/, '');
      if (legacy.s === 'go') vw.textContent = 'Within your limits: ' + why + '.';
      else if (legacy.s === 'none') vw.textContent = why || noneLab;
      else {
        var bits = (legacy.F || []).filter(function (f) { return f.lv === legacy.s; }).map(function (f) { return f.txt; });
        vw.textContent = 'Because ' + (bits.join('; ') || why) + '.';
      }
    }
    var row = null;
    try {
      row = [].slice.call(v.querySelectorAll('.vsuit .kv>div')).filter(function (d) {
        return d.firstChild && /^Status/.test(d.firstChild.textContent || '');
      })[0];
    } catch (e) { row = null; }
    if (row && row.lastChild) {
      row.lastChild.textContent = vs.textContent;
      row.lastChild.style.color = 'var(--' + (legacy.s === 'nogo' ? 'nogo' : legacy.s === 'caution' ? 'cau' : legacy.s === 'none' ? 'tx3' : 'go') + ')';
    }
  }

  function paintHeli(ic) {
    var v = document.getElementById('verd');
    var vs = document.getElementById('vs');
    var vw = document.getElementById('vw');
    if (!v || !vs) return;
    var cls = window.AD_CLASS && window.AD_CLASS[ic];
    var lab = cls === 'helistop' ? 'HELIPAD' : 'HELIPORT';
    v.dataset.s = 'heli';
    vs.textContent = lab;
    if (vw) { vw.textContent = ''; vw.style.display = 'none'; }
    try {
      var row = [].slice.call(v.querySelectorAll('.vsuit .kv>div')).filter(function (d) {
        return d.firstChild && /^Status/.test(d.firstChild.textContent || '');
      })[0];
      if (row && row.lastChild) {
        row.lastChild.textContent = lab;
        row.lastChild.style.color = 'var(--tx3)';
      }
    } catch (e) {}
    window.GA_V2_PAGE = { s: 'heli', label: lab, heliport: true, why: '', F: [], findings: [] };
  }

  var paintingPage = false;
  function runAdPage() {
    if (!document.getElementById('verd')) return;
    if (rwdbState === 'loading') return;                                          // runs again when the runway DB arrives
    if (paintingPage) return;
    paintingPage = true;
    try {
      var a = adFromPage();
      if (!a || !icOf(a)) return;
      var ic = icOf(a);
      if (a.heliport || a.heli || (window.AD_CLASS && window.AD_CLASS[ic])) {
        paintHeli(ic);
        return;
      }
      try {
        var result = runV2(a, null, null, null, null, Date.now(), weatherFromPage(a));
        paintPage(toLegacy(result, null));
      } catch (err) {
        try { console.log('ga-core-v2-wire ad-page', err); } catch (x) {}
      }
    } finally {
      paintingPage = false;
    }
  }

  function watchAdPage() {
    if (!document.getElementById('verd')) return;
    try {
      var vs0 = document.getElementById('vs');
      var vw0 = document.getElementById('vw');
      var baked = /^(—|-|GO|NO-GO|NO DATA|INCOMPLETE|No weather)$/i;
      if (vs0 && baked.test((vs0.textContent || '').trim())) vs0.textContent = '';
      if (vw0 && /No current METAR|status unavailable|vis not reported \(assumed OK\)/i.test(vw0.textContent || '')) vw0.textContent = '';
      var v0 = document.getElementById('verd');
      if (v0) {
        var row0 = [].slice.call(v0.querySelectorAll('.vsuit .kv>div')).filter(function (d) {
          return d.firstChild && /^Status/.test(d.firstChild.textContent || '');
        })[0];
        if (row0 && row0.lastChild && baked.test((row0.lastChild.textContent || '').trim())) {
          row0.lastChild.textContent = '';
        }
      }
    } catch (e) {}
    runAdPage();
    var box = document.getElementById('s-wx');
    if (box && !box.__gaV2Watch) {
      box.__gaV2Watch = 1;
      /* notes: 10 (docs/ga-core-v2-wire-notes.md) */
      var scheduled = false;
      new MutationObserver(function (muts) {
        var relevant = false, i, n;
        for (i = 0; i < muts.length; i++) {
          n = muts[i].target;
          if (!n) continue;
          if (n.id === 'verd' || (n.closest && n.closest('#verd'))) continue;
          relevant = true;
          break;
        }
        if (!relevant || scheduled) return;
        scheduled = true;
        setTimeout(function () { scheduled = false; runAdPage(); }, 50);
      }).observe(box, {
        subtree: true, childList: true, characterData: true
      });
    }
    document.addEventListener('wm:phase', runAdPage);
    fetchLiveOfficial(runAdPage);
    setInterval(function () { if (!document.hidden && liveDue(Date.now())) fetchLiveOfficial(runAdPage, 1); }, 60e3);
    document.addEventListener('wst:data', function () { fetchLiveOfficial(runAdPage); });
    function wxFetchPending() {
      if (LIVE.pending || !LIVE.at) return true;
      try {
        if (document.querySelector('#s-wx .ld, #s-wx.ld, .box.ld')) return true;
        var s = document.getElementById('s-wx');
        if (s && /Updating/.test(s.textContent || '')) return true;
      } catch (e) {}
      return false;
    }
    var tries = 0, lastLen = -1;
    var timer = setInterval(function () {
      tries += 1;
      var len = 0, hasModel = false;
      try {
        var raw = localStorage.getItem('wm.now.v1') || localStorage.getItem('wm.mw.v2') || '';
        len = raw.length; hasModel = !!len;
      } catch (e) {}
      if (len !== lastLen || (hasModel && !wxFetchPending())) {
        lastLen = len;
        runAdPage();
      }
      if ((hasModel && !wxFetchPending()) || tries > 6) clearInterval(timer);
    }, 500);
  }

  function rerunCards() {
    try {
      if (typeof window.applyS === 'function') window.applyS();
    } catch (e) { wxStale('re-run of the cards failed', e); }
  }

  function watchListPages() {
    if (document.getElementById('verd')) return;
    /* 15 Nov: Status builds its cards after DOMContentLoaded; wait for them (FAVV had no METAR on Status) */
    if (!document.querySelector('#list .card, #wsp-cards .card, .card .icao')) { if ((watchListPages.n = (watchListPages.n || 0) + 1) < 60) setTimeout(watchListPages, 250); return; }
    /* notes: 8 (docs/ga-core-v2-wire-notes.md) */
    var queued = false;
    function requestRerun() {
      if (queued) return;
      queued = true;
      setTimeout(function () { queued = false; rerunCards(); }, 50);
    }
    fetchLiveOfficial(requestRerun);
    document.addEventListener('wst:data', function () { fetchLiveOfficial(requestRerun); });

    setInterval(function () { if (!document.hidden && liveDue(Date.now())) fetchLiveOfficial(requestRerun, 1); }, 60e3);
    var tries = 0, lastLen = -1;
    var timer = setInterval(function () {
      tries += 1;
      var len = 0;
      try {
        var raw = localStorage.getItem('wm.now.v1') || localStorage.getItem('wm.mw.v2') || '';
        len = raw.length;
      } catch (e) {}
      if (len && len !== lastLen) {
        lastLen = len;
        requestRerun();
      }
      if ((len && tries > 2) || tries > 6) clearInterval(timer);
    }, 500);
  }

  /* notes: 3 (docs/ga-core-v2-wire-notes.md) */
  var phaseQueued = false;
  function frameOffScreen() {
    try {
      if (document.visibilityState === 'hidden') return true;
      var fe = window.frameElement;
      return !!(fe && fe.getClientRects && fe.getClientRects().length === 0);
    } catch (e) { return false; }
  }
  function phaseRerun() {
    if (phaseQueued) return;
    if (document.getElementById && document.getElementById('verd')) return;      // aerodrome page: runAdPage handles it
    phaseQueued = true;
    warmToken++;                                                                    // a tap stops any precompute in flight
    /* 13 Nov 2026 (speed): a frame that is not on screen (the aerodrome list while Status is open) re-runs when the main
       thread is idle, not in the very next frame, so it does not hold up the cards the pilot is looking at. */
    var later = frameOffScreen() && window.requestIdleCallback
      ? function (f) { window.requestIdleCallback(f, { timeout: 1500 }); }
      : function (f) { f(); };
    later(function () { phaseQueued = false; rerunCards(); warmSoon(); });
  }

  /* notes: 7 (docs/ga-core-v2-wire-notes.md) */
  var warmToken = 0;
  function warmSoon() {
    var my = ++warmToken, mode = phaseOf(), P = window.WMPHASE, cur = P && P.arrive && P.arrive.at == null ? (P.arrive.off || 0) : null;
    var plan = [];
    if (mode === 'land') { for (var o = 0; o <= 3; o++) if (o !== cur) plan.push(o); plan.push('depart'); }
    else {for(var o=0;o<=3;o++)plan.push(o)}
    var cards=[].slice.call(document.querySelectorAll('.card')),vh=window.innerHeight||800,vis=[],rst=[],i,c,rc;for(i=0;i<cards.length;i++){c=cards[i];rc=c.getBoundingClientRect();if(rc.bottom>0&&rc.top<vh&&rc.height)vis.push(c);else if(vis.length&&rc.top>=vh){rst=rst.concat(cards.slice(i));break}else rst.push(c)}cards=vis.concat(rst);i=0;var j=0;
    var idle = window.requestIdleCallback ? function (f) { window.requestIdleCallback(f, { timeout: 400 }); } : function (f) { setTimeout(f, 16); };
    function slice() {
      if (my !== warmToken) return;
      var t0 = Date.now(), now = Date.now();
      while (j < plan.length && Date.now() - t0 < 8) {
        var c = cards[i];
        if (c && c.isConnected !== false) {
          var off = plan[j];
          var fph = off === 'depart' ? 'depart' : 'land', feta = off && off !== 'depart' ? now + off * 36e5 : undefined;
          FORCE = { phase: fph, eta: feta };
          try { warmCard(c, now); } catch (e) {} finally { FORCE = null; }
        }
        if (++i >= cards.length) { i = 0; j++; }
      }
      if (j < plan.length) idle(slice);
    }
    idle(slice);
  }
  function warmCard(c, now) {
    var ic = txt(c, '.icao');
    if (!ic) return;
    var a = adFromCard(c, ic), S = window.WMST;
    var ob = (S && W.obsOf) ? W.obsOf(a, S) : null;
    runV2(a, ob, null, null, null, now, weatherFromCard(c, a, ob));
  }
  var warmPassT = 0;
  function warmAfterPass() {
    if (document.getElementById && document.getElementById('verd')) return;      // aerodrome page: not here
    clearTimeout(warmPassT);
    warmPassT = setTimeout(warmSoon, 0);
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('wm:pass', warmAfterPass);
    document.addEventListener('wm:vis', warmSoon);
    document.addEventListener('wm:phase', phaseRerun);
    window.addEventListener('storage', function (e) { if (e && (e.key === 'wm.phaseMode' || e.key === 'wm.arriveAt')) phaseRerun(); });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', watchAdPage);
      document.addEventListener('DOMContentLoaded', watchListPages);
    } else {
      watchAdPage();
      watchListPages();
    }
  }

  /* 15 Nov 2026 (MT 14:23 / 14:55 SAST): runway headings and field elevation come from the locked DB, a separate cached JSON
     (wst/ad-rwy-db.<hash>.json, written by tools/rwdb/emit.mjs) that is NOT part of the page's first load. Until it has
     arrived every card is "pending" (no verdict), so the verdicts are the same whether it loads before or after the first
     render; then the cards re-run. If it cannot be fetched the cards are judged without runway headings (as for a field
     with no published heading: crosswind unknown), never with a heading guessed from the runway number. */
  var RWDB_URL = '/wst/ad-rwy-db.d1aeb2149a.json', rwdbState = window.WM_RWDB ? 'ready' : 'idle';
  function rwdbInstall(j) {
    var D = {}, S = String((j && j.s) || '').split(';');
    for (var i = 0; i < S.length; i++) {
      var p = S[i].split('='); if (!p[1] && p[1] !== '') continue;
      var q = p[1].split('|'), r = [];
      if (q[1]) q[1].split(',').forEach(function (x) { var y = x.split(':'), h = +y[1], k = y[0].split('/'); r.push([k[0], h]); if (k[1]) r.push([k[1], (h + 180) % 360]); });
      D[p[0]] = [q[0] === '' ? null : +q[0]].concat(r.length ? [r] : []);
    }
    window.WM_RWDB = { v: j && j.v, a: D, ends: function (L) { return (L || []).map(function (e) { return { id: e[0], true: e[1] }; }); } };
    /* the AIP 65 records (WMST.ads, shared by WSTC.AD) get the verified elevation and headings in place, so every engine reads
       the same numbers; designator-derived runway ends there are dropped */
    var W = window.WMST;
    if (W && W.ads) W.ads.forEach(function (a) {
      var x = D[a.ic]; if (!x) return;
      if (x[0] != null) a.el = x[0];
      var dec = a.dec != null ? +a.dec : 0;
      if (x[1]) a.rw = x[1].map(function (e) { return { id: e[0], true: e[1], mag: Math.round(((e[1] - dec) % 360 + 360) % 360), src: 'db' }; });
      else if (a.rw && a.rw.some(function (r) { return /designator/i.test(r.src || ''); })) a.rw = [];
    });
    RW_MEMO = { fs: null, ads: null, m: {} };
    rwdbState = 'ready';
    return window.WM_RWDB;
  }
  window.WM_RWDB_INSTALL = rwdbInstall;
  window.WM_RWDB_PENDING = function () { return rwdbState === 'loading'; };
  if (rwdbState === 'idle' && typeof fetch === 'function' && typeof document !== 'undefined' && document.createElement) {
    rwdbState = 'loading';
    fetch(RWDB_URL).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(rwdbInstall)
      .catch(function (e) { if (rwdbState === 'loading') rwdbState = 'failed'; try { console.warn('[rwdb] runway data could not be loaded', e); } catch (x) {} })
      .then(function () { rerunCards(); try { if (document.getElementById('verd')) runAdPage(); } catch (e) {} });
  }

  window.GA_ENGINE_V2_WIRED = true;
})();
