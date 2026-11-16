/* Go Around core engine v2
 * Part 91 VFR briefing helper for South Africa.
 * Guidance only — the person in command decides. Not a clearance or authorisation.
 *
 * New standalone file on purpose. Does not edit wm-core.js, wst-engine.js,
 * wm-bridge.js, gate.ts, appdata/, auth, or wm-shell.*.
 *
 * Change history (2.1.0 to 2.4.0, and the 16 Nov 2026 parser fix): docs/engine-v2/CHANGELOG.md
 */
(function (G) {
  'use strict';

  var RULES_VERSION = '2.5.0';

  /* Locked decision numbers. Changing any value requires a version bump and
     an update of RULES_LOCK (see tests/engine-v2). Citations live in CITES. */
  var RULES = {
    law: {
      vfrVisKm: 5,
      vfrCeilFt: 1500,
      vfrHighVisKm: 8,
      highAltFt: 10000,
      landWindowH: 1,
      nightOffsetMin: 15
    },
    policy: {
      circuitFloorFt: 1000,
      nearBand: 0.2,
      metarFreshMin: 60,
      metarUsableMin: 90,
      modelFreshMin: 180,
      modelUsableMin: 180,
      trendValidH: 2,
      tafLookaheadH: 2,
      tafEarlyMaxH: 3,
      arriveNearMin: 30,
      vrbGoKt: 6,
      gustSpreadKt: 15,
      gustSigSpreadKt: 10,
      gustXwNearFrac: 0.9,
      gustLimitNearFrac: 0.8,
      gustLimitMaxKt: 35,
      modelGustSlackKt: 5,
      xwGoFrac: 0.8,
      defXwKt: 12,
      twCautionKt: 5,
      twNogoKt: 10,
      daAboveFt: 2500,
      nightSoonMin: 60,
      modelVisClearBelowKm: 1.0,
      modelCeilClearBelowFt: 300,
      modelWindClearAboveKt: 5,
      modelTwClearAboveKt: 3,
      tempoTsNogo: true,
      windFillTafThenModel: true,
      windReplaceStale: true
    },
    ifr: {
      cat1CeilFt: 200,
      cat1VisKm: 0.55
    }
  };

  var CITES = {
    disclaimer: 'CAR 91.02.6, 91.02.7 and 91.02.8 — the person in command is responsible and must be satisfied the weather allows a safe flight.',
    vfrMinima: 'CAR 91.06.21 Tables 1 and 2, as substituted by the Thirty-Third Amendment of the Civil Aviation Regulations, 2026 (Government Gazette No. 55226, 21 August 2026, GN 7844). CTR/ATZ: no take-off, landing, approach to land, or flight in the zone when ground visibility is either less than 5 km or the ceiling is less than 1 500 ft. Distance from cloud in Table 1 raised to 1 500 m horizontally and 1 000 ft vertically. Class F/G at or below 3 000 ft AMSL or 1 000 ft AGL: 5 km, clear of cloud and with the surface in sight.',
    officialPdf: 'https://caasanwebsitestorage.blob.core.windows.net/legal-documents/Promulgated%2033RD%20Amendment%20Regulation%202026%20(Final).pdf',
    govNotice: 'https://www.gov.za/documents/notices/civil-aviation-act-thirty-third-amendment-civil-aviation-regulations-2026-english',
    landWindow: 'CAR 91.07.7(7), same 33rd Amendment: select a destination or alternate only if reports or forecasts, or both, are at or above the applicable planning minima from one hour before to one hour after ETA.',
    nightDef: 'CAR Part 1 definition of night: 15 minutes after sunset to 15 minutes before sunrise.',
    nightFacilities: 'CAR 91.07.3(2): except in an emergency, no take-off or landing by night unless the place has night flying facilities. This engine cannot verify lighting from AIP data.',
    trend: 'SA AIP GEN 3.5 4.2.4 (compilation 15 October 2026): a TREND is used within about one hour’s flying time and is valid for two hours, during which it supersedes the TAF for the same aerodrome. ICAO Annex 3 §6.3: landing forecast in TREND form, valid 2 hours from the report.',
    metarCadence: 'ICAO Annex 3 / WMO aerodrome reports: METAR hourly or half-hourly; SPECI when criteria are met. SA AIP GEN 3.5 Table GEN 3.5-1.',
    circuitFloor: 'App policy, built on CAR 91.06.32 / ICAO Annex 2 4.6 minimum heights: a 1 000 ft AGL circuit cannot be flown clear of a lower ceiling.',
    wxHazards: 'App policy for light aircraft (WMO 4678 tokens). Not a Part 91 table.',
    ifrFloor: 'Generic CAT I reference (DH 200 ft / 550 m). Not the published plate for that aerodrome.',
    modelMargin: 'App policy: numerical weather model values carry uncertainty, so a model-only NO DEPART / NO LAND is raised only when the value is clearly beyond the applicable limit by the locked margins.',
    gustSig: 'App policy, 2.1.0: a gust only matters when it is significant against the user’s own limits. 10 kt spread follows the usual METAR gust-group criterion (peak at least 10 kt over the mean; public excerpt of ICAO Annex 3 / WMO practice, to be checked against the paid text). Crosswind and gust limits are the user’s and the aircraft’s.',
    modelGust: 'App policy, 2.1.0: the Open-Meteo gust is a model diagnostic for the hour, not a 10-minute METAR gust, and reads high against official gusts. The spread rule therefore needs 5 kt more spread for the model than for an official report.'
  };

  var RULES_LOCK = {
    version: '2.5.0',
    checksum: '90d2ba46f3478c597c502d607193a4a3e072962da4eedace4b0d3131a3922cb1'
  };

  var AC = [
    { id: 'C172', n: 'Cessna 172', xw: 15, src: 'C172S POH §5 Fig 5-4' },
    { id: 'PA28', n: 'PA-28 Warrior/Archer', xw: 17, src: 'PA-28-161 AFM §4' },
    { id: 'C152', n: 'Cessna 152', xw: 12, src: 'C152 POH §4' },
    { id: 'SLG2', n: 'Sling 2', xw: 15, src: 'Sling LSA POH Rev 3.3 §2.5' },
    { id: 'PA34', n: 'PA-34 Seneca', xw: 17, src: 'PA-34 POH §2 / §4' },
    { id: 'DA20', n: 'Diamond DA20-C1', xw: 20, src: 'DA20-C1 AFM' },
    { id: 'DA42', n: 'Diamond DA42', xw: 20, src: 'DA42 QRH' },
    { id: 'SLG4', n: 'Sling 4', xw: 15, src: 'Sling 4 POH Rev 2.2 §2.5' },
    { id: 'C182', n: 'Cessna 182', xw: 15, src: 'C182T POH §5' },
    { id: 'DA40', n: 'Diamond DA40 (classic/XLT)', xw: 20, src: 'Diamond spec sheet (not AFM)' },
    { id: 'DA40NG', n: 'Diamond DA40 NG', xw: 25, src: 'DA40 NG AFM' },
    { id: 'P2008', n: 'Tecnam P2008', xw: 15, src: 'P2008 JC AFM §2.18' }
  ];

  var PRE = {
    ppl: { n: 'PPL', xw: 12, gust: 25, ceil: 2500, vis: 8, night: 0, ir: 0 },
    ir: { n: 'Instrument rating', xw: 12, gust: 25, ceil: 2000, vis: 6, night: 1, ir: 1, iceil: 600, ivis: 2 },
    cpl: { n: 'CPL', xw: 15, gust: 25, ceil: 1500, vis: 5, night: 1, ir: 0 }
  };

  var LV = { note: 0, go: 0, caution: 1, nogo: 2 };
  var WXC = {};
  ('MI PR BC DR BL SH TS FZ DZ RA SN SG IC PL GR GS UP BR FG FU VA DU SA HZ PO SQ FC SS DS')
    .split(' ').forEach(function (c) { WXC[c] = true; });

  var PIC_DISCLAIMER = 'Guidance only — the person in command decides.';
  var MODEL_DISCLAIMER = 'Model estimate only — not an official weather report.';

  function stableStringify(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
    return '{' + Object.keys(v).sort().map(function (k) {
      return JSON.stringify(k) + ':' + stableStringify(v[k]);
    }).join(',') + '}';
  }
  function rulesCanonical() { return stableStringify(RULES); }

  function isControlled(field) {
    var c = field && (field.category || field.cat || field.airspace);
    if (c === 'u' || c === 'uncontrolled' || c === 'other') return false;
    return true;
  }
  function elevOf(field) {
    var e = field && (field.elevFt != null ? field.elevFt : field.el != null ? field.el : field.elev);
    return e == null ? null : +e;
  }
  function legalVisKm(field) {
    var el = elevOf(field);
    if (el != null && el >= RULES.law.highAltFt) return RULES.law.vfrHighVisKm;
    return RULES.law.vfrVisKm;
  }
  function runwaysOf(field) {
    return (field && field.runways || field && field.rw || []).map(function (r) {
      return { id: r.id, true: r.true != null ? +r.true : +r.trueHdg };
    }).filter(function (r) { return r.id && isFinite(r.true); });
  }

  function metarBody(raw) {
    return String(raw || '').split(/\s(?:TEMPO|BECMG|NOSIG|RMK)\b/)[0];
  }
  function metarTrend(raw) {
    var r = String(raw || '').replace(/=/g, ' ').split(/\sRMK\b/)[0];
    var i = r.search(/\s(?:TEMPO|BECMG)\s/);
    return i < 0 ? '' : r.slice(i + 1).trim();
  }
  function hasTrendForecast(raw) {
    return /\s(?:TEMPO|BECMG|NOSIG)(?:\s|=|$)/.test(String(raw || '').replace(/=/g, ' '));
  }
  function varGroup(raw) {
    var m = /\s(\d{3})V(\d{3})(?=\s)/.exec(' ' + metarBody(raw) + ' ');
    return m ? { a: +m[1], b: +m[2] } : null;
  }
  function smKm(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return Math.min(10, v * 1.609344);
    /* 2.4.0: AWC "6+" (and P6SM) means 6 SM or more, i.e. 10 km or more. */
    if (/^(?:6\+|P6(?:SM)?)$/.test(String(v).trim())) return 10;
    var t = String(v).trim().replace(/SM$/, '').replace(/^[PM]/, '').replace(/\+$/, '');
    var f = /^(?:(\d+)\s+)?(\d+)\/(\d+)$/.exec(t);
    var sm;
    if (f) sm = (f[1] ? +f[1] : 0) + (+f[2]) / (+f[3]);
    else if (/^\d+(\.\d+)?$/.test(t)) sm = +t;
    else return null;
    return Math.min(10, sm * 1.609344);
  }
  /* 2.4.0: the prevailing visibility group. The wind group before it may be VRB, ///// or missing
     (AUTO with no wind group); before, only a numeric direction was matched, so VRB03KT 9999 or
     /////KT 9999 read as "visibility not in METAR".
     16 Nov: every vis group (0400W, 9999E, NDV) up to the first cloud/temp/QNH group; the lowest wins. */
  var VIS_TOK = /^(\d{4})(NDV|N|NE|E|SE|S|SW|W|NW)?$/;
  var VIS_STOP = /^(?:(?:FEW|SCT|BKN|OVC)(?:\d{3}|\/\/\/)|VV(?:\d{3}|\/\/\/)|NSC|NCD|SKC|CLR|CAVOK|M?\d{2}\/(?:M?\d{2})?|[QA]\d{4})/;
  function visGroup(b) {
    var tk = String(b || '').trim().split(/\s+/), i = 0, low = null;
    for (var k = 0; k < tk.length; k++) if (/^\d{6}Z$/.test(tk[k])) { i = k + 1; break; }
    for (; i < tk.length; i++) {
      var t = tk[i];
      if (VIS_STOP.test(t)) break;
      var m = VIS_TOK.exec(t);
      if (!m) continue;
      if (low == null || +m[1] < +low) low = m[1];
    }
    return low;
  }
  /* 16 Nov: 9999-RA / 9999TSRA -> 9999 -RA (WMO 4678 codes only) */
  function splitGlued(raw) {
    return String(raw || '').split(' ').map(function (t) {
      var m = /^(\d{4})((?:[+-]|VC|RE)?((?:[A-Z]{2})+))$/.exec(t);
      if (!m || !m[3].match(/../g).every(function (c) { return WXC[c]; })) return t;
      return m[1] + ' ' + m[2];
    }).join(' ');
  }
  function visKm(raw, visib) {
    var b = ' ' + metarBody(splitGlued(raw)) + ' ';
    if (/\sCAVOK\s/.test(b)) return 10;
    var g = visGroup(b);
    if (g) return g === '9999' ? 10 : Math.min(10, +g / 1000);
    return smKm(visib);
  }
  /* 9999 and CAVOK are coded as 10 km, but they mean 10 km or more. */
  function visCodedAtLeast(raw) {
    var b = ' ' + metarBody(splitGlued(raw)) + ' ';
    if (/\sCAVOK\s/.test(b)) return true;
    return visGroup(b) === '9999';
  }
  function visIsAtLeast10(ob) {
    return !!(ob && (ob.cavok || ob.visAtLeast));
  }
  function visUnder(vis, limit, atLeast) {
    if (vis == null || limit == null) return false;
    if (atLeast && limit <= 10) return false;
    return vis < limit;
  }
  function visNearLimit(vis, limit, atLeast) {
    if (vis == null || limit == null) return false;
    if (atLeast && limit <= 10) return false;
    return vis < limit * (1 + RULES.policy.nearBand);
  }
  function ceilOf(clouds, raw) {
    var cl = [];
    for (var i = 0; i < (clouds || []).length; i++) {
      var c = clouds[i];
      if (!/BKN|OVC|VV|OVX/.test(c.cover)) continue;
      if (c.base != null) cl.push(c.base);
      else if (/BKN|OVC/.test(c.cover) && !/VV|OVX/.test(c.cover)) cl.push(0);
      else if (/VV|OVX/.test(c.cover)) {
        var vv = /\sVV(\d{3}|\/\/\/)(?=\s)/.exec(' ' + metarBody(raw) + ' ');
        cl.push(vv && vv[1] !== '///' ? +vv[1] * 100 : 0);
      }
    }
    if (!cl.length) {
      var vv2 = /\sVV(\d{3}|\/\/\/)(?=\s)/.exec(' ' + metarBody(raw) + ' ');
      if (vv2) cl.push(vv2[1] === '///' ? 0 : +vv2[1] * 100);
    }
    return cl.length ? Math.min.apply(null, cl) : null;
  }
  function ceilFromRaw(raw) {
    var body = metarBody(raw);
    var cnr = /(?:^|\s)(?:BKN|OVC|VV)\/\/\/(?=\s|$|CB|TCU)/.test(body);
    var ceil = null;
    var re = /(?:^|\s)(BKN|OVC|VV)(\d{3}|\/\/\/)/g, m;
    while ((m = re.exec(' ' + body + ' '))) {
      if (m[2] === '///') continue;
      var ft = +m[2] * 100;
      ceil = ceil == null ? ft : Math.min(ceil, ft);
    }
    if (ceil == null) ceil = ceilOf(null, raw);
    return { ceil: ceil, cnr: cnr };
  }
  function parseWind(text) {
    var m = /(?:^|\s)(\d{3}|VRB|\/\/\/)(\d{2,3}|\/\/)(?:G(\d{2,3}))?(KT|MPS)(?=\s|$)/.exec(text);
    if (!m) return { wd: null, vrb: false, ws: null, g: null };
    var f = m[4] === 'MPS' ? 1.94384 : 1;
    return {
      wd: m[1] === 'VRB' || m[1] === '///' ? null : +m[1],
      vrb: m[1] === 'VRB',
      ws: m[2] === '//' ? null : Math.round(+m[2] * f),
      g: m[3] ? Math.round(+m[3] * f) : null
    };
  }
  function parseVisCeil(text) {
    var t = ' ' + String(text || '').replace(/=/g, ' ') + ' ';
    var o = { vis: null, ceil: null, cavok: false, visAtLeast: false, cnr: /(?:^|\s)(?:BKN|OVC|VV)\/\/\/(?=\s|$|CB|TCU)/.test(t) };
    if (/\sCAVOK\s/.test(t)) { o.vis = 10; o.ceil = null; o.cavok = true; o.visAtLeast = true; return o; }
    var vm = /\s(\d{4})(?:NDV)?\s/.exec(t);
    if (vm && !/^\d{4}\/\d{4}$/.test(vm[1])) {
      o.visAtLeast = vm[1] === '9999';
      o.vis = o.visAtLeast ? 10 : Math.min(10, +vm[1] / 1000);
    }
    var cl = [], re = /(?:^|\s)(BKN|OVC|VV)(\d{3}|\/\/\/)/g, x;
    while ((x = re.exec(t))) { if (x[2] !== '///') cl.push(+x[2] * 100); }
    if (cl.length) o.ceil = Math.min.apply(null, cl);
    else if (/(^|\s)(NSC|NCD|SKC|CLR)(\s|$)/.test(t)) o.ceil = null;
    return o;
  }

  function wxScan(txt) {
    var nogo = [], caut = [];
    String(txt || '').toUpperCase().split(/\s+/).forEach(function (t) {
      if (!t) return;
      if (/^(FEW|SCT|BKN|OVC)(\d{3}|\/\/\/)(CB|TCU)$/.test(t)) { nogo.push(t); return; }
      var m = /^(\+|-|VC|RE)?([A-Z]{2,12})$/.exec(t);
      if (!m || m[2].length % 2) return;
      var p = m[2].match(/../g);
      if (!p.every(function (c) { return WXC[c]; })) return;
      var h = function (c) { return p.indexOf(c) >= 0; };
      if (h('TS') || (h('FZ') && (h('RA') || h('DZ'))) || h('SQ') || h('FC') || h('GR')) {
        (m[1] === 'RE' ? caut : nogo).push(t);
      } else if ((m[1] === '+' && (h('RA') || h('SN'))) || h('GS') || (h('FZ') && h('FG'))) {
        caut.push(t);
      }
    });
    return { nogo: nogo, caut: caut };
  }

  function tafDate(now, dd, hh, mm) {
    var n = new Date(now), b = null;
    for (var k = -1; k <= 1; k++) {
      var t = Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + k, dd, hh, mm || 0);
      if (b == null || Math.abs(t - now) < Math.abs(b - now)) b = t;
    }
    return b;
  }
  function tafSegs(raw, now) {
    var tk = String(raw || '').toUpperCase().replace(/=/g, ' ').trim().split(/\s+/).filter(Boolean);
    var vt = /^(\d{2})(\d{2})\/(\d{2})(\d{2})$/, S = [];
    var cur = null, prob = null, end = null;
    var open = function (ty, f, to, pr) { cur = { ty: ty, f: f, to: to, pr: pr || null, t: [] }; S.push(cur); };
    for (var i = 0; i < tk.length; i++) {
      var t = tk[i], m;
      if ((m = /^PROB(30|40)$/.exec(t))) { prob = +m[1]; continue; }
      if ((t === 'TEMPO' || t === 'BECMG') && (m = vt.exec(tk[i + 1] || ''))) {
        open(t, tafDate(now, +m[1], +m[2]), t === 'BECMG' ? end : tafDate(now, +m[3], +m[4]), prob);
        prob = null; i++; continue;
      }
      if (prob && (m = vt.exec(t))) { open('PROB', tafDate(now, +m[1], +m[2]), tafDate(now, +m[3], +m[4]), prob); prob = null; continue; }
      if ((m = /^FM(\d{2})(\d{2})(\d{2})$/.exec(t))) {
        var f = tafDate(now, +m[1], +m[2], +m[3]);
        S.forEach(function (s) { if ((s.ty === 'FM' || s.ty === 'BASE' || s.ty === 'BECMG') && s.to > f) s.to = f; });
        open('FM', f, end); continue;
      }
      if (end == null && (m = vt.exec(t))) { end = tafDate(now, +m[3], +m[4]); open('BASE', tafDate(now, +m[1], +m[2]), end); continue; }
      if (cur) cur.t.push(t);
    }
    return S;
  }
  function hz(t) {
    var d = new Date(t);
    return ('0' + d.getUTCDate()).slice(-2) + ('0' + d.getUTCHours()).slice(-2) + 'Z';
  }
  function tokenWeather(tokens) {
    var vis = null, ceil = null, visAtLeast = false, cavok = false, wind = parseWind(' ' + tokens.join(' ') + ' ');
    tokens.forEach(function (t) {
      if (/^\d{4}$/.test(t)) {
        visAtLeast = t === '9999';
        vis = visAtLeast ? 10 : +t / 1000;
      }
      if (t === 'CAVOK') { vis = 10; ceil = null; visAtLeast = true; cavok = true; }
      var m = /^(BKN|OVC|VV)(\d{3})/.exec(t);
      if (m) ceil = ceil == null ? +m[2] * 100 : Math.min(ceil, +m[2] * 100);
    });
    return { vis: vis, ceil: ceil, wind: wind, wx: tokens.join(' '), visAtLeast: visAtLeast, cavok: cavok };
  }
  function conditionsAt(raw, when) {
    var segs = tafSegs(raw, when);
    var state = { vis: null, ceil: null, visAtLeast: false, cavok: false, wind: { wd: null, vrb: false, ws: null, g: null }, wx: '' };
    segs.forEach(function (s) {
      if (!(s.ty === 'BASE' || s.ty === 'FM' || s.ty === 'BECMG')) return;
      if (s.f == null || s.f > when) return;
      if (s.to != null && s.to <= when && s.ty !== 'BECMG') return;
      var w = tokenWeather(s.t);
      if (s.ty === 'BECMG' && s.f <= when && (s.to == null || when < (s.to || Infinity))) {
        if (w.vis != null) {
          if (state.vis == null || w.vis < state.vis) {
            state.vis = w.vis;
            state.visAtLeast = !!w.visAtLeast;
          } else if (w.vis === state.vis) {
            state.visAtLeast = !!(state.visAtLeast && w.visAtLeast);
          }
        }
        if (w.ceil != null) state.ceil = state.ceil == null ? w.ceil : Math.min(state.ceil, w.ceil);
        if (w.cavok) { state.cavok = true; if (w.ceil == null) state.ceil = null; }
        if (w.wind.ws != null) state.wind = w.wind;
        if (w.wx) state.wx = (state.wx + ' ' + w.wx).trim();
        return;
      }
      if (w.vis != null) { state.vis = w.vis; state.visAtLeast = !!w.visAtLeast; }
      if (w.cavok) { state.cavok = true; state.ceil = null; }
      if (w.ceil != null) state.ceil = w.ceil;
      if (w.wind.ws != null || w.wind.vrb) state.wind = w.wind;
      if (w.wx) state.wx = w.wx;
    });
    return state;
  }
  /* 2.5.0 early TAF (MT 15 Nov): nothing valid now -> first period if issued and starting within tafEarlyMaxH */
  function tafAtNow(raw, now) {
    var b = tafSegs(raw, now)[0], im = /\s(\d{2})(\d{2})(\d{2})Z\s/.exec(' ' + String(raw || '').toUpperCase() + ' ');
    if (b && b.ty === 'BASE' && im && b.f > now && b.f - now <= RULES.policy.tafEarlyMaxH * 3600e3 &&
        tafDate(now, +im[1], +im[2], +im[3]) <= now) return Object.assign(conditionsAt(raw, b.f), { early: b.f });
    return conditionsAt(raw, now);
  }
  function hhmmZ(t) { var d = new Date(t); return ('0' + d.getUTCHours()).slice(-2) + ('0' + d.getUTCMinutes()).slice(-2) + 'Z'; }
  function tafScan(raw, winFrom, winTo, minVis, minCeil, includeBase, windCtx) {
    var out = [];
    tafSegs(raw, winFrom).forEach(function (s) {
      if (s.f == null) return;
      if (!includeBase && s.ty === 'BASE') return;
      if (!(s.f < winTo && (s.to == null || s.to > winFrom))) return;
      var parsed = tokenWeather(s.t);
      var w = wxScan(s.t.join(' '));
      var below = (parsed.vis != null && parsed.vis < minVis) || (parsed.ceil != null && parsed.ceil < minCeil);
      var perm = s.ty === 'FM' || s.ty === 'BECMG' || s.ty === 'BASE';
      var lv = 'go', why = [];
      var windFlags = null;
      var isTempoProb = s.ty === 'TEMPO' || s.ty === 'PROB';
      if (isTempoProb && windCtx && parsed.wind && parsed.wind.ws != null) {
        windFlags = scoreTafWind(parsed.wind, windCtx);
        if (windFlags.lv !== 'go') {
          if (windFlags.lv === 'nogo') lv = 'nogo';
          else if (lv === 'go') lv = 'caution';
          why.push(windFlags.bits.join(', '));
        }
      }
      if (w.nogo.length) { lv = 'nogo'; why.push(w.nogo.join(' ')); }
      if (below) {
        if (lv !== 'nogo') lv = perm ? 'nogo' : 'caution';
        why.push(parsed.vis != null && parsed.vis < minVis ? 'vis ' + parsed.vis.toFixed(1) + ' km' : 'ceiling ' + parsed.ceil + ' ft');
      }
      if (w.caut.length) { if (lv === 'go') lv = 'caution'; why.push(w.caut.join(' ')); }
      /* PROB vis / weather stays a caution; a TEMPO or PROB wind over the limit is not demoted. */
      if (s.pr && lv === 'nogo' && !(windFlags && windFlags.lv === 'nogo')) lv = 'caution';
      if (lv === 'go') return;
      var tsProb = s.pr && /TS/.test(w.nogo.join(' '));
      var txt = tsProb
        ? 'TAF forecast: thunderstorm possible (PROB' + s.pr + ') from ' + hz(s.f) + ', a ' + s.pr + '% chance in this window, not an expected event and not current weather. Forecast detail: ' + why.join(', ')
        : 'TAF forecast: ' + (s.pr ? 'PROB' + s.pr + ' ' : '') + (s.ty === 'PROB' ? '' : s.ty + ' ') + 'from ' + hz(s.f) + ': ' + why.join(', ');
      var ruleId = w.nogo.length
        ? (s.pr ? 'POL-TAF-PROB' : 'POL-TAF-TS')
        : (s.pr ? 'POL-TAF-PROB' : (perm ? (s.ty === 'BASE' ? 'LAW-91.07.7-LAND-WINDOW' : 'POL-TAF-PERM-BELOW') : 'POL-TAF-TEMPO-BELOW'));
      if (s.pr) ruleId = 'POL-TAF-PROB';
      else if (w.nogo.length) ruleId = s.ty === 'TEMPO' ? 'POL-TEMPO-TS-NOGO' : 'POL-TAF-TS';
      else if (!perm) ruleId = 'POL-TAF-TEMPO-BELOW';
      else if (s.ty === 'BASE') ruleId = includeBase ? 'LAW-91.07.7-LAND-WINDOW' : 'POL-TAF-PERM-BELOW';
      else ruleId = 'POL-TAF-PERM-BELOW';
      if (windFlags && windFlags.lv !== 'go' && (windFlags.lv === 'nogo' || (!w.nogo.length && !below && !w.caut.length))) {
        ruleId = s.pr ? 'POL-TAF-PROB-WIND' : 'POL-TAF-TEMPO-WIND';
      }
      out.push({ lv: lv, k: 'taf', txt: txt, ruleId: ruleId, shelf: perm && !w.nogo.length ? 'law' : 'policy' });
    });
    return out;
  }

  function sun(lat, lon, d, alt) {
    var R = Math.PI / 180;
    var day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    var JD = day / 864e5 + 2440587.5, n = Math.ceil(JD - 2451545 + 0.0008), Js = n - lon / 360;
    var M = (357.5291 + 0.98560028 * Js) % 360;
    var C = 1.9148 * Math.sin(M * R) + 0.02 * Math.sin(2 * M * R) + 0.0003 * Math.sin(3 * M * R);
    var L = (M + C + 180 + 102.9372) % 360;
    var Jt = 2451545 + Js + 0.0053 * Math.sin(M * R) - 0.0069 * Math.sin(2 * L * R);
    var dec = Math.asin(Math.sin(L * R) * Math.sin(23.4397 * R));
    var c = (Math.sin(alt * R) - Math.sin(lat * R) * Math.sin(dec)) / (Math.cos(lat * R) * Math.cos(dec));
    if (c < -1 || c > 1) return null;
    var w = Math.acos(c) / R / 360;
    var ms = function (j) { return (j - 2440587.5) * 864e5; };
    return { rise: ms(Jt - w), set: ms(Jt + w) };
  }
  function sunInfo(lat, lon, now) {
    if (lat == null || lon == null || !isFinite(lat) || !isFinite(lon)) return null;
    var d = new Date(now), s = sun(lat, lon, d, -0.833);
    if (!s) return null;
    var sn = sun(lat, lon, new Date(now + 864e5), -0.833);
    var Q = RULES.law.nightOffsetMin * 6e4;
    var nStart = s.set + Q, nEnd = s.rise - Q;
    return {
      rise: s.rise, set: s.set, nightFrom: nStart, nightTo: nEnd,
      nextRise: now < s.rise ? s.rise : (sn ? sn.rise : s.rise + 864e5),
      isNight: now >= nStart || now < nEnd,
      isDay: now >= s.rise && now < s.set
    };
  }
  /* South Africa has no DST; local briefing times are UTC+2. */
  function fmtSastHm(ms) {
    var t = new Date(+ms + 2 * 3600e3);
    return ('0' + t.getUTCHours()).slice(-2) + ':' + ('0' + t.getUTCMinutes()).slice(-2);
  }
  function nightStartAt(lat, lon, at) {
    var s = sunInfo(lat, lon, at);
    if (!s || !s.isNight) return null;
    if (at < s.nightTo) {
      var prev = sunInfo(lat, lon, at - 864e5);
      if (prev && prev.nightFrom != null) return prev.nightFrom;
    }
    return s.nightFrom;
  }
  function scoreTafWind(w, ctx) {
    var out = { lv: 'go', bits: [] };
    if (!w || w.ws == null || !ctx) return out;
    function bump(lv, txt) {
      if (lv === 'nogo' || (lv === 'caution' && out.lv === 'go')) out.lv = lv;
      if (lv === 'nogo') out.lv = 'nogo';
      out.bits.push(txt);
    }
    var lim = ctx.lim, gust = ctx.gust, rw = ctx.rw || [];
    var peak = Math.max(w.ws, w.g || 0);
    var spread = (w.g != null && w.ws != null) ? w.g - w.ws : 0;
    var dirless = !!w.vrb || w.wd == null || !rw.length;
    if (dirless && (w.ws > 0 || w.g)) {
      var calmFloor = Math.max(RULES.policy.vrbGoKt, RULES.policy.xwGoFrac * lim);
      if (peak > lim) bump('nogo', 'worst-case crosswind above ' + lim + ' kt (' + ctx.who + ')');
      else if (peak > calmFloor) bump('caution', 'worst-case crosswind close to ' + lim + ' kt (' + ctx.who + ')');
      if (w.g && w.g > gust) bump('nogo', 'gust ' + w.g + ' kt above your ' + gust + ' kt limit');
      else if (w.ws > gust) bump('nogo', 'wind ' + w.ws + ' kt above your ' + gust + ' kt limit');
      else if (w.ws >= RULES.policy.gustLimitNearFrac * gust) bump('caution', 'wind ' + w.ws + ' kt within 20% of your ' + gust + ' kt wind limit');
      return out;
    }
    if (!(w.ws > 0) && !w.g) return out;
    var b = best(rw, w.wd, w.ws);
    if (!b) return out;
    var gx = w.g ? Math.abs(w.g * Math.sin(b.a)) : b.xw;
    var X = Math.round(b.xw), GX = Math.round(gx);
    var rwyTxt = ' on RWY ' + b.id;
    var gustSig = spread >= RULES.policy.gustSigSpreadKt;
    if (X > lim) bump('nogo', 'crosswind ' + X + ' kt' + rwyTxt + ' (' + ctx.who + ')');
    else if (GX > lim) bump('nogo', 'gust crosswind ' + GX + ' kt' + rwyTxt + ' (' + ctx.who + ')');
    else if (X > RULES.policy.xwGoFrac * lim || (gustSig && GX > RULES.policy.xwGoFrac * lim) || GX > RULES.policy.gustXwNearFrac * lim) {
      bump('caution', 'crosswind ' + (X > RULES.policy.xwGoFrac * lim ? X : GX) + ' kt' + (X > RULES.policy.xwGoFrac * lim ? '' : ' (gusts)') + rwyTxt + ' (' + ctx.who + ')');
    }
    if (w.g && w.g > gust) bump('nogo', 'gust ' + w.g + ' kt above your ' + gust + ' kt limit');
    else if (w.ws > gust) bump('nogo', 'wind ' + w.ws + ' kt above your ' + gust + ' kt limit');
    else if (w.ws >= RULES.policy.gustLimitNearFrac * gust) bump('caution', 'wind ' + w.ws + ' kt within 20% of your ' + gust + ' kt wind limit');
    if (b.hw < -0.5) {
      var twn = Math.round(-b.hw);
      if (twn >= 1) {
        if (twn > RULES.policy.twNogoKt) bump('nogo', 'tailwind ' + twn + ' kt');
        else if (twn > RULES.policy.twCautionKt) bump('caution', 'tailwind ' + twn + ' kt');
      }
    }
    return out;
  }
  function best(rw, wd, ws) {
    var b = null, R = Math.PI / 180;
    rw.forEach(function (r) {
      var a = (wd - r.true) * R, hw = ws * Math.cos(a), xw = Math.abs(ws * Math.sin(a));
      if (!b || hw > b.hw + 0.01 || (Math.abs(hw - b.hw) < 0.01 && xw < b.xw)) b = { id: r.id, hw: hw, xw: xw, a: a };
    });
    return b;
  }
  function worstIn(rw, a, b, ws) {
    var span = ((b - a) + 360) % 360, w = null, twMin = null;
    for (var d = 0; d <= span; d += 10) {
      var r = best(rw, (a + d) % 360, ws);
      if (!w || r.xw > w.xw) w = Object.assign({}, r, { xwD: (a + d) % 360 });
      if (twMin == null || r.hw < twMin) twMin = r.hw;
    }
    if (w) w.twMin = twMin;
    return w;
  }
  /* Density altitude, the same calculation as the Go Around calculator (calc.js
     C.atmos) and the aerodrome page (wq.js): PA = elevation + (1013.25 - QNH) x 30,
     ISA at that pressure altitude, DA = PA + 120 x (OAT - ISA). MT 29/30 Oct 2026. */
  /* density altitude switch (pilot setting, stored like wm-night): P.da wins, else localStorage 'wm-da-verdict' = '1'; default OFF */
  function daOn(P) {
    if (P && P.da != null) return P.da === true || P.da === 1 || P.da === '1';
    try { return typeof localStorage !== 'undefined' && localStorage.getItem('wm-da-verdict') === '1'; } catch (e) { return false; }
  }
  function clampDaLimit(v){v=+v;return (v>=1500&&v<=6000)?Math.round(v/500)*500:2500}
  function daLimitFt(P){if(P&&P.daLimit!=null)return clampDaLimit(P.daLimit);try{var s=typeof localStorage!=='undefined'&&localStorage.getItem('wm-da-limit');if(s)return clampDaLimit(s)}catch(e){}return 2500}

  function da(el, t, qnh) {
    if (el == null || t == null) return null;
    var pa = el + (1013.25 - (qnh || 1013.25)) * 30, isa = 15 - 2 * pa / 1000;
    return Math.round(pa + 120 * (t - isa));
  }

  function parseOfficial(entry, fallbackTime) {
    if (!entry) return null;
    var raw = entry.raw || entry.rawOb || '';
    if (!raw && !entry.wspd && entry.vis == null && !entry.visib) return null;
    var time = entry.time != null ? +entry.time : (entry.obsTime != null ? +entry.obsTime * (entry.obsTime < 1e12 ? 1000 : 1) : fallbackTime);
    var shown = raw;
    raw = raw ? splitGlued(String(raw).replace(/\s+/g, ' ').trim()) : raw;
    var body = metarBody(raw || '');
    var wind = parseWind(' ' + body + ' ');
    if (entry.wdir != null || entry.wspd != null) {
      wind = {
        wd: entry.wdir === 'VRB' ? null : (entry.wdir == null ? wind.wd : +entry.wdir),
        vrb: entry.wdir === 'VRB' || entry.vrb || wind.vrb,
        ws: entry.wspd == null ? wind.ws : +entry.wspd,
        g: entry.wgst != null ? +entry.wgst : (entry.gust != null ? +entry.gust : wind.g)
      };
    }
    var vis = raw ? visKm(raw, entry.visib) : (entry.vis != null ? +entry.vis : smKm(entry.visib));
    var cc = ceilFromRaw(raw);
    if (entry.clouds) {
      var c2 = ceilOf(entry.clouds, raw);
      if (c2 != null) cc.ceil = c2;
    }
    if (entry.ceil != null) cc.ceil = entry.ceil;
    var temp = entry.temp != null ? entry.temp : entry.t;
    if (temp == null && raw) {
      var tm = / (M?\d{2})\/(M?\d{2})? /.exec(' ' + body + ' ');
      if (tm) temp = +tm[1].replace('M', '-');
    }
    var qnh = entry.altim != null ? entry.altim : entry.qnh;
    if (qnh == null && raw) {
      var qm = / Q(\d{4}) /.exec(' ' + body + ' ');
      if (qm) qnh = +qm[1];
    }
    var kind = /^SPECI\b/i.test(String(raw).trim()) ? 'speci' : 'metar';
    return {
      src: kind,
      /* 16 Nov: a malformed wind/vis/cloud group -> INCOMPLETE, never a guess */
      parseUnknown: (wind.ws == null && /(?:^|\s)[^\s\/]*(?:KT|MPS)(?:\s|$)/.test(body)) ||
        (vis == null && /(?:^|\s)\d{4}[A-Z]+(?:\s|$)/.test(body)) ||
        (cc.ceil == null && !cc.cnr && /(?:^|\s)(?:BKN|OVC|VV)(?!\d{3}|\/\/\/)\S*/.test(body)),
      wd: wind.wd, vrb: wind.vrb, ws: wind.ws, g: wind.g,
      vis: vis, ceil: cc.ceil, cnr: cc.cnr || !!entry.cnr,
      t: temp, qnh: qnh, time: time, raw: shown,
      /* 16 Nov: CAVOK from the report, not its TREND (BECMG CAVOK) */
      cavok: /(?:^|\s)CAVOK(?:\s|$)/.test(body) || !!entry.cavok,
      visAtLeast: visCodedAtLeast(raw) || !!entry.cavok || /^(?:9999|6\+|P6(?:SM)?)$/.test(String(entry.visib || '').trim()),
      wx: body, trend: metarTrend(raw), vg: varGroup(raw),
      hasTrend: hasTrendForecast(raw),
      auto: /\sAUTO\s/.test(' ' + body + ' ')
    };
  }

  function skyUnknown(ob) {
    if (!ob || ob.cavok || ob.cnr) return false;
    if (ob.ceil != null) return false;
    var raw = String(ob.raw || ob.wx || '');
    var body = ' ' + metarBody(raw) + ' ';
    if (/(?:^|\s)(FEW|SCT|BKN|OVC|VV)(\d{3}|\/\/\/)/.test(body)) return false;
    if (/(?:^|\s)(NSC|NCD|SKC|CLR|CAVOK)(?:\s|$)/.test(body)) return false;
    return true;
  }
  function skyClear(ob) {
    if (!ob) return false;
    if (ob.cavok) return true;
    var raw = String(ob.raw || ob.wx || '');
    return /(?:^|\s)(NSC|NCD|SKC|CLR)(?:\s|$)/.test(' ' + metarBody(raw) + ' ');
  }
  function parseModel(model, now) {
    if (!model) return null;
    /* UI / Open-Meteo shape: { current: { visibility, wind_speed_10m, time, ... } } */
    if (model.current && typeof model.current === 'object' &&
        model.visKm == null && model.vis == null && model.ws == null && model.wind_speed_10m == null) {
      var cur = model.current;
      model = Object.assign({}, cur, {
        time: cur.time || model.time,
        fetchedAt: model.fetchedAt != null ? model.fetchedAt : cur.fetchedAt,
        wingman_fetched: model.wingman_fetched || cur.wingman_fetched
      });
    }
    var vis = model.visKm != null ? +model.visKm : (model.vis != null ? +model.vis : (model.visibility != null ? Math.min(10, model.visibility / 1000) : null));
    var ceil = model.ceilFt != null ? +model.ceilFt : (model.ceil != null ? +model.ceil : null);
    if (ceil == null && model.cloud_base != null && model.cloud_cover_low >= 63) {
      ceil = Math.round(model.cloud_base * 3.281 / 100) * 100;
    }
    var time = model.time != null ? (typeof model.time === 'number' ? model.time : Date.parse(String(model.time).replace(/Z?$/, 'Z'))) : now;
    var fetchedRaw = model.fetchedAt != null ? model.fetchedAt : model.wingman_fetched;
    var fetched = fetchedRaw != null ? (typeof fetchedRaw === 'number' ? +fetchedRaw : Date.parse(String(fetchedRaw))) : time;
    if (!isFinite(fetched)) fetched = time;
    var wd = model.wd != null ? +model.wd
      : (model.wdir != null && model.wdir !== 'VRB' ? +model.wdir : (model.wind_direction_10m != null ? +model.wind_direction_10m : null));
    var vrb = !!model.vrb || model.wdir === 'VRB';
    var ws = model.ws != null ? +model.ws
      : (model.wspd != null ? +model.wspd : (model.wind_speed_10m != null ? Math.round(model.wind_speed_10m) : null));
    var g = model.g != null ? +model.g
      : (model.wgst != null ? +model.wgst : (model.gust != null ? +model.gust : (model.wind_gusts_10m != null ? Math.round(model.wind_gusts_10m) : null)));
    var low = model.low != null ? model.low : (model.cloud_cover_low != null ? model.cloud_cover_low : null);
    /* 2.1.0: a model row with no weather values at all (for example an hour past the end of the
       copy, where every column is null) is no model, not an empty one that reads as "missing". */
    if (vis == null && ceil == null && ws == null && low == null) return null;
    return {
      src: 'model',
      forecast: !!model.forecast,
      wd: model.wd != null ? +model.wd : model.wind_direction_10m,
      vrb: !!model.vrb,
      ws: model.ws != null ? +model.ws : (model.wind_speed_10m != null ? Math.round(model.wind_speed_10m) : null),
      g: model.g != null ? +model.g : (model.wind_gusts_10m != null ? Math.round(model.wind_gusts_10m) : null),
      vis: vis, ceil: ceil,
      low: low,
      cc: model.cc != null ? model.cc : model.cloud_cover,
      t: model.t != null ? model.t : model.temperature_2m,
      qnh: model.qnh != null ? model.qnh : model.pressure_msl,
      time: time, fetchedAt: fetched, cnr: false, cavok: false, wx: '', trend: '', hasTrend: false
    };
  }
  function ageMin(time, now) {
    if (time == null || !isFinite(time)) return Infinity;
    return (now - time) / 6e4;
  }
  function usableOfficial(ob, now) {
    if (!ob || ob.time == null) return false;
    var age = ageMin(ob.time, now);
    return age <= RULES.policy.metarUsableMin && age >= -RULES.policy.metarUsableMin;
  }
  function usableModel(ob, now) {
    if (!ob) return false;
    var ageT = ageMin(ob.time, now);
    var ageF = ageMin(ob.fetchedAt != null ? ob.fetchedAt : ob.time, now);
    /* 2.4.0 (E-02): an hour of a model run fetched within the last 180 min is usable when it is valid up to 72 h ahead
       (the arrive picker's limit; phase.js MODEL_H). Before, rows more than 180 min ahead were refused, so +3h (window to
       +4h) could never be judged from the model. A row's age is still capped at 180 min. */
    var aheadMin = ob.forecast ? 72 * 60 : RULES.policy.modelUsableMin;
    return ageT <= RULES.policy.modelUsableMin && ageF <= RULES.policy.modelUsableMin && ageT >= -aheadMin;
  }

  /* 2.4.0 (MT wind rule, 13 Nov 2026): METAR wind unknown -> TAF wind for that time -> model wind.
     The obs object is copied, never changed in place. ob.windFill = 'taf' | 'model' when filled. */
  function pickWeather(weather, clock, phase) {
    var picked = pickWeatherBase(weather, clock, phase);
    if (RULES.policy.windFillTafThenModel) fillWind(picked, clock.now, weather && weather.modelHours);
    /* TAF (and any official leftover holes): temp / QNH / leftover cloud from the model, per field. */
    if (picked && picked.obs) {
      var mdl = parseModel(weather && weather.model, clock.now);
      if (mdl && usableModel(mdl, clock.now)) {
        var o = picked.obs;
        if (o.t == null && mdl.t != null) o.mt = mdl.t;
        if (o.qnh == null && mdl.qnh != null) o.mqnh = mdl.qnh;
        if (o.low == null && mdl.low != null) o.mlow = mdl.low;
        if (o.cc == null && mdl.cc != null) o.mcc = mdl.cc;
        if ((o.src === 'taf' || skyUnknown(o)) && o.ceil == null && !o.cavok && mdl.ceil != null) o.mceil = mdl.ceil;
      }
    }
    return picked;
  }
  /* The model row for the fill: the current row for "now"; for a later ETD or arrival window, the hourly row
     (weather.modelHours) nearest that time and inside the window, else the current row if it lies in it. */
  function modelRowFor(picked, now, hours) {
    var pl = picked.planning, m = picked.model;
    if (!pl || pl.mode === 'now') return m;
    var bestRow = null, bestD = Infinity;
    for (var i = 0; hours && i < hours.length; i++) {
      var h = hours[i]; if (!h) continue;
      var t = typeof h.time === 'number' ? h.time : Date.parse(String(h.time).replace(/Z?$/, 'Z'));
      if (!isFinite(t)) continue;
      var inWin = pl.mode === 'window' ? (t > pl.start - 3600e3 && t <= pl.end) : Math.abs(t - pl.at) <= 3600e3;
      if (!inWin) continue;
      var d = Math.abs(t - pl.at);
      if (d < bestD) { bestD = d; bestRow = parseModel(Object.assign({}, h, { time: t, forecast: true }), now); }
    }
    if (bestRow) return bestRow;
    if (m && pl.mode === 'window' && !modelInWindow(m, pl)) return null;
    return m;
  }
  function fillWind(picked, now, hours) {
    var ob = picked.obs;
    if (!ob || ob.src === 'model') return;
    /* 2.4.0 (MT t1968u): a stale METAR (older than policy.metarFreshMin, the POL-METAR-STALE-60 threshold) that DOES report
       a wind has that wind replaced the same way: TAF for that time, else model. With neither, the METAR wind stays. */
    var staleWind = ob.ws != null && !!picked.stale && !!RULES.policy.windReplaceStale;
    if (ob.ws != null && !staleWind) return;
    var st = staleWind ? { windStale: true, metarWind: { wd: ob.wd, vrb: !!ob.vrb, ws: ob.ws, g: ob.g } } : null;
    var at = picked.planning ? picked.planning.at : now;
    if (picked.tafRaw) {
      var c = at === now ? tafAtNow(picked.tafRaw, at) : conditionsAt(picked.tafRaw, at);
      if (c && c.wind && c.wind.ws != null) {
        picked.obs = Object.assign({}, ob, { wd: c.wind.wd, vrb: !!c.wind.vrb, ws: c.wind.ws, g: c.wind.g, vg: null, windFill: 'taf' }, c.early ? { tEarly: c.early } : null, st);
        picked.windFill = 'taf';
        return;
      }
    }
    var m = modelRowFor(picked, now, hours);
    if (m && m.ws != null && usableModel(m, now)) {
      picked.obs = Object.assign({}, ob, { wd: m.wd != null && isFinite(m.wd) ? +m.wd : null, vrb: !!m.vrb, ws: m.ws, g: m.g, vg: null, windFill: 'model' }, st);
      picked.windFill = 'model';
    }
  }

  function pickWeatherBase(weather, clock, phase) {
    weather = weather || {};
    var now = clock.now;
    var metar = parseOfficial(weather.metar, null);
    var speci = parseOfficial(weather.speci, null);
    var official = null;
    if (metar && speci) official = (!usableOfficial(metar, now) || (usableOfficial(speci, now) && speci.time >= metar.time)) ? speci : metar;
    else official = speci || metar;
    if (official && official.raw && /(?:^|\s)NIL(?:\s|=|$)/.test(metarBody(official.raw))) {
      official = Object.assign({}, official, { nil: true });
    }
    var tafRaw = weather.taf && (weather.taf.raw || (typeof weather.taf === 'string' ? weather.taf : ''));
    if (!tafRaw && typeof weather.tafRaw === 'string') tafRaw = weather.tafRaw;
    var model = parseModel(weather.model, now);
    /* 2.2.0: fill a missing official visibility from the TAF prevailing value at now
       (BASE / FM in force, BECMG already in force — conditionsAt already skips TEMPO / PROB
       and takes the worse vis during a BECMG). If the TAF has no vis, use a usable model. */
    if (official && official.vis == null && !official.cavok) {
      if (tafRaw) {
        var holeTaf = tafAtNow(tafRaw, now);
        if (holeTaf && holeTaf.vis != null) {
          if (holeTaf.early) official.tEarly = holeTaf.early;
          official.tvis = holeTaf.vis;
          official.tvisAtLeast = !!(holeTaf.visAtLeast || holeTaf.cavok);
        }
      }
      if (model && usableModel(model, now) && model.vis != null) official.mvis = model.vis;
    }
    /* 14 Nov 2026: same hole-fill for a METAR whose cloud group is missing or "//////"
       (AUTO sensor not reporting). TAF covering now first, then a usable model. CAVOK / NSC /
       FEW-SCT without a ceiling, and BKN/// (cnr), are left alone. Temp and QNH fall through
       to the model when the official report has none. */
    if (official && official.ceil == null && !official.cavok && !official.cnr && skyUnknown(official)) {
      if (tafRaw) {
        var holeCeil = tafAtNow(tafRaw, now);
        if (holeCeil) {
          var cE = official.tEarly;
          if (holeCeil.early) official.tEarly = holeCeil.early;
          if (holeCeil.cavok) official.tceilCavok = true;
          else if (holeCeil.ceil != null) official.tceil = holeCeil.ceil;
          else if (/(?:^|\s)(?:FEW|SCT)\d{3}|(?:^|\s)(?:NSC|NCD|SKC|CLR)(?:\s|$)/.test(' ' + (holeCeil.wx || '') + ' ')) official.tceilNone = true;
          else official.tEarly = cE;
        }
      }
      if (model && usableModel(model, now)) {
        if (model.ceil != null) official.mceil = model.ceil;
        if (model.low != null) official.mlow = model.low;
        if (model.cc != null) official.mcc = model.cc;
      }
    }
    if (official && model && usableModel(model, now)) {
      if (official.t == null && model.t != null) official.mt = model.t;
      if (official.qnh == null && model.qnh != null) official.mqnh = model.qnh;
      if (official.low == null && model.low != null) official.mlow = official.mlow != null ? official.mlow : model.low;
      if (official.cc == null && model.cc != null) official.mcc = official.mcc != null ? official.mcc : model.cc;
    }


    var te, planning;
    if (phase === 'land') {
      te = clock.eta != null ? clock.eta : now;
      if (Math.abs(te - now) <= RULES.policy.arriveNearMin * 6e4) {
        planning = { mode: 'now', at: now, start: now, end: now };
      } else {
        var wh = RULES.law.landWindowH * 3600e3;
        planning = { mode: 'window', at: te, start: te - wh, end: te + wh };
      }
    } else {
      te = clock.etd != null ? clock.etd : now;
      if (clock.etd != null && clock.etd - now > RULES.policy.arriveNearMin * 6e4) {
        planning = { mode: 'etd', at: te, start: te, end: te };
      } else {
        planning = { mode: 'now', at: now, start: now, end: now };
      }
    }

    var picked = { planning: planning, tafRaw: tafRaw || '', official: official, model: model };
    if (model && !usableModel(model, now)) picked.modelTooOld = true;

    if (planning.mode === 'now') {
      if (official && official.nil) {
        picked.reasonNil = true;
      } else if (official && usableOfficial(official, now)) {
        picked.obs = official;
        picked.source = {
          kind: official.src,
          time: official.time,
          ageMin: Math.round(ageMin(official.time, now)),
          label: (official.src === 'speci' ? 'SPECI' : 'METAR') + ' at ' + new Date(official.time).toISOString()
        };
        picked.stale = ageMin(official.time, now) > RULES.policy.metarFreshMin;
        picked.applyTrend = !!official.hasTrend;
        picked.skipTaf = !!official.hasTrend;
        return picked;
      }
      if (tafRaw) {
        var cov = tafAtNow(tafRaw, planning.at), ce = cov.early;
        if (cov.vis != null || cov.ceil != null || cov.wind.ws != null || /CAVOK/.test(tafRaw)) {
          picked.obs = {
            src: 'taf', wd: cov.wind.wd, vrb: cov.wind.vrb, ws: cov.wind.ws, g: cov.wind.g, tafEarly: ce || null,
            vis: cov.vis, ceil: cov.ceil, t: null, qnh: null, time: ce || planning.at, raw: tafRaw,
            cavok: /CAVOK/.test(cov.wx || tafRaw) || !!cov.cavok,
            visAtLeast: !!(cov.visAtLeast || cov.cavok || /CAVOK/.test(cov.wx || '')),
            wx: cov.wx, cnr: false, trend: '', hasTrend: false
          };
          picked.source = ce ? { kind: 'taf', time: ce, ageMin: null, tafEarly: true, label: 'TAF (next period from ' + hhmmZ(ce) + ')' }
            : { kind: 'taf', time: planning.at, ageMin: null, label: 'TAF covering now' };
          picked.applyTafScan = true;
          picked.includeBase = false;
          return picked;
        }
      }
      if (model && usableModel(model, now)) {
        picked.obs = model;
        picked.source = {
          kind: 'model',
          time: model.time,
          ageMin: Math.round(ageMin(model.time, now)),
          label: 'Weather model estimate'
        };
        return picked;
      }
      return picked;
    }

    /* Future land window or future ETD: forecasts first. A poor METAR now does not win. */
    var trendCovers = official && official.hasTrend && official.time != null &&
      planning.start < official.time + RULES.policy.trendValidH * 3600e3 &&
      planning.end > official.time;
    if (trendCovers && usableOfficial(official, now)) {
      picked.obs = official;
      picked.source = { kind: 'trend', time: official.time, ageMin: Math.round(ageMin(official.time, now)), label: 'METAR TREND (supersedes TAF for 2 h)' };
      picked.applyTrend = true;
      picked.skipTaf = true;
      return picked;
    }
    if (tafRaw) {
      var at = conditionsAt(tafRaw, planning.at);
      if (at.vis != null || at.ceil != null || (at.wind && at.wind.ws != null) || /CAVOK/.test(at.wx || tafRaw)) {
        picked.obs = {
          src: 'taf', wd: at.wind.wd, vrb: at.wind.vrb, ws: at.wind.ws, g: at.wind.g,
          vis: at.vis, ceil: at.ceil, t: null, qnh: null, time: planning.at, raw: tafRaw,
          cavok: /CAVOK/.test(at.wx || tafRaw) || !!at.cavok,
          visAtLeast: !!(at.visAtLeast || at.cavok || /CAVOK/.test(at.wx || '')),
          wx: at.wx, cnr: false, trend: '', hasTrend: false
        };
        picked.source = {
          kind: 'taf',
          time: planning.at,
          ageMin: null,
          label: planning.mode === 'window'
            ? 'TAF for ETA ±1 h'
            : 'TAF covering ETD'
        };
        picked.applyTafScan = true;
        picked.includeBase = planning.mode === 'window';
        picked.tafWinFrom = planning.mode === 'window' ? planning.start : planning.at;
        picked.tafWinTo = planning.mode === 'window' ? planning.end : planning.at + 1;
        return picked;
      }
    }
    /* 2.4.0 (13 Nov 2026, core engine review E-02): DECISIONS.md "Land with an arrive time more than about 30 minutes away
       uses the TAF (or TREND, or model) across ETA ±1 h". A model row is used for a land window only when its hour lies in
       that window (row time > start − 1 h and ≤ end). Before, any row was used, in practice the CURRENT hour, so +2h and
       +3h were judged on the weather of now. evaluate() judges every hour of the window (weather.modelHours) and keeps
       the worst. With no row for the window the answer is "no forecast for that time", never the weather of now. */
    if (model && usableModel(model, now) &&
        (planning.mode !== 'window' || modelInWindow(model, planning))) {
      picked.obs = model;
      picked.source = { kind: 'model', time: model.time, ageMin: Math.round(ageMin(model.time, now)), label: 'Weather model estimate (past the TAF or no TAF)' };
      return picked;
    }
    if (model && planning.mode === 'window' && !modelInWindow(model, planning)) picked.modelOutsideWindow = true;
    return picked;
  }

  function modelInWindow(model, planning) {
    return model && model.time != null && isFinite(model.time) &&
      model.time > planning.start - 3600e3 && model.time <= planning.end;
  }

  function applyModelMargin(src, level, kind, value, limit) {
    if (src !== 'model' || level !== 'nogo') return { level: level, demoted: false };
    var clear = false;
    if (kind === 'vis') clear = value <= limit - RULES.policy.modelVisClearBelowKm;
    else if (kind === 'ceil') clear = value <= limit - RULES.policy.modelCeilClearBelowFt;
    else if (kind === 'wind') clear = value >= limit + RULES.policy.modelWindClearAboveKt;
    else if (kind === 'tw') clear = value >= limit + RULES.policy.modelTwClearAboveKt;
    if (clear) return { level: 'nogo', demoted: false, ruleId: 'POL-MODEL-NOGO-CLEAR' };
    return { level: 'caution', demoted: true, ruleId: 'POL-MODEL-BORDERLINE' };
  }

  function normProfile(p) {
    p = p || {};
    var lic = p.licence && PRE[p.licence];
    return {
      ceil: p.ceilFt != null ? +p.ceilFt : (p.ceil != null ? +p.ceil : (lic ? lic.ceil : RULES.law.vfrCeilFt)),
      vis: p.visKm != null ? +p.visKm : (p.vis != null ? +p.vis : (lic ? lic.vis : RULES.law.vfrVisKm)),
      xw: p.xwKt != null ? +p.xwKt : (p.xw != null ? +p.xw : (lic ? lic.xw : RULES.policy.defXwKt)),
      gust: Math.min(RULES.policy.gustLimitMaxKt, p.gustKt != null ? +p.gustKt : (p.gust != null ? +p.gust : (lic ? lic.gust : 25))),
      night: !!(p.night),
      da: p.da == null ? null : (p.da === true || p.da === 1 || p.da === '1'),
      daLimit: p.daLimit != null ? clampDaLimit(p.daLimit) : null,
      ir: !!(p.ir || (lic && lic.ir)),
      iceil: p.ifrCeilFt != null ? +p.ifrCeilFt : (p.iceil != null ? +p.iceil : (lic && lic.iceil) || RULES.ifr.cat1CeilFt),
      ivis: p.ifrVisKm != null ? +p.ifrVisKm : (p.ivis != null ? +p.ivis : (lic && lic.ivis) || RULES.ifr.cat1VisKm)
    };
  }

  var VERDICT_RANK = { none: 0, incomplete: 0, go: 1, caution: 2, nogo: 3 };
  /* 2.4.0 (E-02): one entry point. For a land window that falls through to the model, every hourly row the caller passes
     in weather.modelHours whose hour lies in ETA ±1 h is judged by the same rules, and the worst verdict wins (DECISIONS.md:
     "takes the worst expected lasting condition"). Equal verdicts: the earliest hour is shown. */
  function evaluate(input) {
    input = input || {};
    var first = evaluateOne(input);
    var w = input.weather, hours = w && w.modelHours;
    if (!hours || !hours.length || !first.planning || first.planning.mode !== 'window') return first;
    var fromModelOrNothing = !first.source || first.source.kind === 'model';
    if (!fromModelOrNothing) return first;
    var pl = first.planning, best = null, judged = [];
    for (var i = 0; i < hours.length; i++) {
      var row = hours[i]; if (!row) continue;
      var t = typeof row.time === 'number' ? row.time : Date.parse(String(row.time).replace(/Z?$/, 'Z'));
      if (!isFinite(t) || !(t > pl.start - 3600e3 && t <= pl.end)) continue;
      var wi = {}; for (var k in w) if (k !== 'modelHours') wi[k] = w[k];
      wi.model = Object.assign({}, row, { time: t, forecast: true });
      var r = evaluateOne(Object.assign({}, input, { weather: wi }));
      if (!r.source || r.source.kind !== 'model') continue;
      judged.push(t);
      if (!best || VERDICT_RANK[r.status] > VERDICT_RANK[best.status]) best = r;
    }
    if (!best) return first;
    best.modelWindow = { hours: judged, worstAt: best.source.time };
    return best;
  }

  function evaluateOne(input) {
    input = input || {};
    var field = input.field || {};
    var now = input.now != null ? +input.now : Date.now();
    var phase = input.phase === 'land' ? 'land' : 'depart';
    var ruleset = input.rules === 'ifr' ? 'ifr' : 'vfr';
    var P = normProfile(input.profile);
    var ac = AC.filter(function (a) { return a.id === input.aircraftId; })[0] || null;
    var F = [];
    function add(lv, txt, k, shelf, ruleId) {
      F.push({ lv: lv, txt: txt, k: k, shelf: shelf || 'policy', ruleId: ruleId || '' });
    }

    var disclaimers = [PIC_DISCLAIMER];
    add('note', PIC_DISCLAIMER, 'disclaimer', 'law', 'POL-DISCLAIMER');

    if (field.heliport || field.heli) {
      return finish({
        status: 'none', code: 'heliport', heliport: true,
        why: 'Heliport — no go / caution / no-go verdict',
        F: F, reasons: F, source: null, weatherUsed: null,
        disclaimers: disclaimers
      }, now, phase, P, ac, null, null);
    }

    var lat = field.lat != null ? field.lat : field.la;
    var lon = field.lon != null ? field.lon : field.lo;
    var si = sunInfo(lat, lon, now);
    var picked = pickWeather(input.weather, { now: now, etd: input.etd, eta: input.eta }, phase);

    function applyNonVisFills(ob) {
      if (!ob) return ob;
      var o = Object.assign({}, ob);
      if (o.ceil == null && !o.cavok && !o.cnr && skyUnknown(o)) {
        if (o.tceilCavok) { o.cavok = true; o.ceilFill = 'taf'; }
        else if (o.tceil != null) { o.ceil = o.tceil; o.ceilFill = 'taf'; }
        else if (o.tceilNone) { o.ceilFill = 'taf'; }
        else if (o.mceil != null) { o.ceil = o.mceil; o.ceilFill = 'model'; }
      }
      if (o.low == null && o.mlow != null) o.low = o.mlow;
      if (o.cc == null && o.mcc != null) o.cc = o.mcc;
      if (o.t == null && o.mt != null) { o.t = o.mt; o.tempFill = 'model'; }
      if (o.qnh == null && o.mqnh != null) { o.qnh = o.mqnh; o.qnhFill = 'model'; }
      return o;
    }
    var ob = applyNonVisFills(picked.obs);
    if (ob && picked.obs) picked.obs = ob;
    /* 2.4.0 (E-08): limit reasons said "(now 1500)" even when the value is the forecast for a later arrival or departure. */
    var whenWord = picked.planning && picked.planning.mode === 'window' ? 'at arrival' : picked.planning && picked.planning.mode === 'etd' ? 'at departure' : 'now';
    var src = ob && ob.src;

    if (picked.reasonNil || (ob && ob.nil)) {
      add('note', 'METAR NIL (no report)', 'nil', 'policy', 'POL-NIL');
      /* Signed-off policy 2.1.0–2.3.1: a NIL METAR is not the last word when a
         TAF or a usable model is available — keep POL-NIL as a note and fall back. */
      if (!ob || ob.nil) {
        return finish({ status: 'incomplete', code: 'nil', why: 'METAR NIL (no report)', F: F, si: si, picked: picked }, now, phase, P, ac, si, picked);
      }
    }
    if (!ob) {
      if (picked.modelTooOld) add('note', 'Model data is older than ' + RULES.policy.modelUsableMin + ' min and was not used', 'model', 'policy', 'POL-MODEL-TOO-OLD');
      if (picked.modelOutsideWindow) {
        add('note', 'No TAF or model forecast loaded for the arrival time', 'nodata', 'policy', 'POL-NO-FORECAST-AT-ETA');
        return finish({ status: 'incomplete', code: 'noforecast', why: 'No forecast loaded for the arrival time', F: F, si: si, picked: picked }, now, phase, P, ac, si, picked);
      }
      add('note', 'No current weather report, forecast or model', 'nodata', 'policy', 'POL-NODATA');
      return finish({ status: 'incomplete', code: 'nodata', why: 'No current weather report, forecast or model', F: F, si: si, picked: picked }, now, phase, P, ac, si, picked);
    }

    if (ob.parseUnknown) {
      add('note', 'Malformed METAR group', 'parse', 'policy', 'POL-PARSE-INCOMPLETE');
      return finish({ status: 'incomplete', code: 'parse', why: 'Malformed required METAR group — weather incomplete', F: F, si: si, picked: picked }, now, phase, P, ac, si, picked);
    }
    if (src === 'model') {
      disclaimers.push(MODEL_DISCLAIMER);
      add('note', MODEL_DISCLAIMER, 'model', 'policy', 'POL-MODEL-DISCLAIMER');
    }
    if (picked.stale) {
      add('caution', 'Weather report is getting stale (' + picked.source.ageMin + ' min old)', 'age', 'policy', 'POL-METAR-STALE-60');
    }
    if (ob.auto) add('note', 'Automated official report (AUTO)', 'auto', 'policy', 'POL-AUTO');
    var tE = ob.tafEarly || ob.tEarly;
    if (tE) add('caution', 'TAF not yet valid — next period from ' + hhmmZ(tE), 'taf', 'policy', 'POL-TAF-EARLY');

    var ctl = isControlled(field);
    var legalVis = legalVisKm(field);
    var legalCeil = RULES.law.vfrCeilFt;
    var userCeil = Math.max(legalCeil, P.ceil);
    var userVis = Math.max(legalVis, P.vis);

    if (ruleset === 'ifr') {
      if (!P.ir) add('nogo', 'IFR needs an instrument rating', 'rating', 'policy', 'POL-IFR-RATING');
      if (field.iap === false) {
        add('nogo', 'No IFR approach published (AIP AD 2.24)', 'iap', 'policy', 'POL-IFR-NO-IAP');
        return finish({ status: 'nogo', code: 'noiap', why: 'No IFR approach published (AIP AD 2.24)', F: F, si: si, picked: picked }, now, phase, P, ac, si, picked);
      }
      if (field.iap == null) add('caution', 'IFR approach unknown — no AIP AD 2.24 on file', 'iap', 'policy', 'POL-IFR-NO-IAP');
      var ic = Math.max(RULES.ifr.cat1CeilFt, P.iceil || RULES.ifr.cat1CeilFt);
      var iv = Math.max(RULES.ifr.cat1VisKm, P.ivis || RULES.ifr.cat1VisKm);
      if (ob.cnr) add('nogo', 'Cloud height not reported (BKN/OVC/VV///) — treat as below minima', 'cnr', 'policy', 'POL-CNR');
      else if (ob.ceil != null && ob.ceil < ic) {
        var md0 = applyModelMargin(src, 'nogo', 'ceil', ob.ceil, ic);
        add(md0.level, (P.iceil && ic > RULES.ifr.cat1CeilFt ? 'Your IFR ceiling ' : 'Ceiling below generic CAT I floor ') + ic + ' ft (' + whenWord + ' ' + ob.ceil + ')' + (md0.demoted ? ' — model value is close to the limit, treated as caution' : ''), 'ceil', 'policy', md0.demoted ? md0.ruleId : 'POL-IFR-CAT1');
      } else if (ob.ceil != null && ob.ceil < ic * (1 + RULES.policy.nearBand)) {
        add('caution', 'Ceiling ' + ob.ceil + ' ft, near ' + ic + ' ft', 'ceil', 'policy', 'POL-NEAR-20');
      }
      var ifrAtLeast = visIsAtLeast10(ob);
      if (visUnder(ob.vis, iv, ifrAtLeast)) {
        var md1 = applyModelMargin(src, 'nogo', 'vis', ob.vis, iv);
        add(md1.level, 'Visibility ' + ob.vis.toFixed(1) + ' km below ' + iv + ' km' + (md1.demoted ? ' — model value is close to the limit, treated as caution' : ''), 'vis', 'policy', md1.demoted ? md1.ruleId : 'POL-IFR-CAT1');
      } else if (visNearLimit(ob.vis, iv, ifrAtLeast)) {
        add('caution', 'Visibility ' + ob.vis.toFixed(1) + ' km, near ' + iv + ' km', 'vis', 'policy', 'POL-NEAR-20');
      }
    } else {
      if (ob.cnr) add('nogo', 'Cloud height not reported (BKN/OVC/VV///) — treat as below minima', 'cnr', 'policy', 'POL-CNR');
      else if (ob.ceil != null && ob.ceil < RULES.policy.circuitFloorFt) {
        var mdF = applyModelMargin(src, 'nogo', 'ceil', ob.ceil, RULES.policy.circuitFloorFt);
        add(mdF.level, 'Ceiling ' + ob.ceil + ' ft — below ' + RULES.policy.circuitFloorFt + ' ft, no VFR circuit clear of cloud' + (mdF.demoted ? ' — model value is close to the limit, treated as caution' : ''), 'ceil', 'policy', mdF.demoted ? mdF.ruleId : 'POL-FLOOR-1000');
      } else if (ctl && ob.ceil != null && ob.ceil < legalCeil) {
        var mdC = applyModelMargin(src, 'nogo', 'ceil', ob.ceil, legalCeil);
        add(mdC.level, 'Ceiling ' + ob.ceil + ' ft below 1500 ft (CTR/ATZ VFR minimum)' + (mdC.demoted ? ' — model value is close to the limit, treated as caution' : ''), 'ceil', 'law', mdC.demoted ? mdC.ruleId : 'LAW-91.06.21-CTR-CEIL');
      } else if (P.ceil > legalCeil && ob.ceil != null && ob.ceil < P.ceil) {
        var mdP = applyModelMargin(src, 'nogo', 'ceil', ob.ceil, P.ceil);
        add(mdP.level, 'Your ceiling limit ' + P.ceil + ' ft (' + whenWord + ' ' + ob.ceil + ')' + (mdP.demoted ? ' — model value is close to the limit, treated as caution' : ''), 'ceil', 'limit', mdP.demoted ? mdP.ruleId : 'POL-PERSONAL-CEIL');
      } else if (!ctl && ob.ceil != null && ob.ceil < legalCeil) {
        add('caution', 'Ceiling ' + ob.ceil + ' ft below 1500 ft — uncontrolled field, stay clear of cloud', 'ceil', 'policy', 'POL-UNC-CEIL-1500');
      } else if (ob.ceil != null && ob.ceil < userCeil * (1 + RULES.policy.nearBand)) {
        add('caution', 'Ceiling ' + ob.ceil + ' ft, within 20% of ' + userCeil + ' ft', 'ceil', 'limit', 'POL-NEAR-20');
      }

      var visAtLeast = visIsAtLeast10(ob);
      if (visUnder(ob.vis, legalVis, visAtLeast)) {
        var mdV = applyModelMargin(src, 'nogo', 'vis', ob.vis, legalVis);
        var visId = (elevOf(field) != null && elevOf(field) >= RULES.law.highAltFt)
          ? 'LAW-91.06.21-HIGH-VIS'
          : (ctl ? 'LAW-91.06.21-CTR-VIS' : 'LAW-91.06.21-UNC-VIS');
        if (mdV.demoted) visId = mdV.ruleId;
        add(mdV.level, 'Visibility ' + ob.vis.toFixed(1) + ' km below VFR ' + legalVis + ' km' + (mdV.demoted ? ' — model value is close to the limit, treated as caution' : ''), 'vis', mdV.demoted ? 'policy' : 'law', visId);
      } else if (visUnder(ob.vis, userVis, visAtLeast)) {
        var mdPV = applyModelMargin(src, 'nogo', 'vis', ob.vis, userVis);
        add(mdPV.level, 'Your visibility limit ' + userVis + ' km (' + whenWord + ' ' + ob.vis.toFixed(1) + ')' + (mdPV.demoted ? ' — model value is close to the limit, treated as caution' : ''), 'vis', 'limit', mdPV.demoted ? mdPV.ruleId : 'POL-PERSONAL-VIS');
      } else if (visNearLimit(ob.vis, userVis, visAtLeast)) {
        add('caution', 'Visibility ' + ob.vis.toFixed(1) + ' km, within 20% of ' + userVis + ' km', 'vis', 'limit', 'POL-NEAR-20');
      }
    }

    var fillWhy = null;
    if ((src === 'metar' || src === 'speci' || src === 'trend') && ob.vis == null && !ob.cavok) {
      /* 2.2.0: TAF prevailing vis first, then the model. Below the legal / user minimum (the
         higher of the two) is NO DEPART / NO LAND. Within 20% is caution. Clearly above is a
         plain GO — the fill is explained in the verdict text, not added as a note.
         TEMPO / PROB are not used as the fill number; the 2 h TAF scan still flags them. */
      var fillVis = ob.tvis != null ? ob.tvis : (ob.mvis != null ? ob.mvis : null);
      if (fillVis == null) {
        add('nogo', 'Visibility not in METAR, no TAF or model value', 'vis', 'policy', 'POL-MISS-VIS');
      } else {
        var fillAtLeast = ob.tvis != null ? !!ob.tvisAtLeast : false;
        var near = userVis * (1 + RULES.policy.nearBand);
        var from = ob.tvis != null
          ? ('TAF shows ' + fillVis.toFixed(1) + ' km')
          : ('model shows ' + fillVis.toFixed(1) + ' km (model estimate)');
        if (visUnder(fillVis, userVis, fillAtLeast)) {
          add('nogo', 'Visibility not in METAR, ' + from + ' — below the ' + userVis + ' km minimum', 'vis', 'policy', 'POL-FILL-HOLE');
        } else if (visNearLimit(fillVis, userVis, fillAtLeast)) {
          add('caution', 'Visibility not in METAR, ' + from + ' — within 20% of ' + userVis + ' km', 'vis', 'policy', 'POL-FILL-HOLE');
        } else {
          var shown = Math.round(fillVis * 10) / 10;
          var shownTxt = Math.abs(shown - Math.round(shown)) < 1e-9 ? String(Math.round(shown)) : shown.toFixed(1);
          fillWhy = 'METAR has no visibility, so it\'s taken from the ' + (ob.tvis != null ? 'TAF' : 'model') + ': ' + shownTxt + ' km';
        }
        if (ob.tvis != null && ob.mvis != null && ob.mvis < ob.tvis && ob.mvis < near) {
          add('caution', 'TAF visibility ' + ob.tvis.toFixed(1) + ' km and model ' + ob.mvis.toFixed(1) + ' km disagree — model is worse', 'vis', 'policy', 'POL-FILL-DISAGREE');
        }
      }
    }
    if (src === 'model' && ob.vis == null && !ob.cavok) {
      add('caution', 'Model visibility missing — cannot confirm the ' + legalVis + ' km minimum', 'vis', 'policy', 'POL-MISS-VIS');
    }
    if (src === 'model' && ob.ceil == null && ob.low >= 75) {
      add('caution', 'Model shows ' + ob.low + '% low cloud', 'low', 'policy', 'POL-MODEL-BORDERLINE');
    }

    if (ob.wx) {
      var tokens = ob.wx.split(/\s+/).filter(function (t) { return !/^(COR|AMD|AUTO|CCA)$/.test(t); });
      var wxTxt;
      /* Always drop the station id and time group so FAGR cannot be read as hail. */
      if (tokens[0] === 'METAR' || tokens[0] === 'SPECI') wxTxt = tokens.slice(2).join(' ');
      else wxTxt = tokens.slice(1).join(' ');
      wxTxt = wxTxt.replace(/^\d{6}Z\s*/, '');
      var w = wxScan(wxTxt);
      if (w.nogo.length) add('nogo', 'Hazardous weather in report: ' + w.nogo.join(' '), 'wx', 'policy', 'POL-WX-NOGO');
      else if (w.caut.length) add('caution', 'Weather: ' + w.caut.join(' '), 'wx', 'policy', 'POL-WX-CAUT');
    }

    if (picked.applyTrend && ob.trend) {
      var twx = wxScan(ob.trend.replace(/^(TEMPO|BECMG)\s*/, ''));
      var ty = /^BECMG/.test(ob.trend) ? 'BECMG' : 'TEMPO';
      var tr = parseVisCeil(ob.trend);
      if (twx.nogo.length) add('nogo', 'METAR trend ' + ty + ': ' + twx.nogo.join(' ') + ' (forecast within 2 h)', 'trend', 'policy', 'POL-TREND-TS');
      else if (twx.caut.length) add('caution', 'METAR trend ' + ty + ': ' + twx.caut.join(' '), 'trend', 'policy', 'POL-TREND-WX');
      if (visUnder(tr.vis, userVis, !!(tr.cavok || tr.visAtLeast))) {
        var tPerm = ty === 'BECMG';
        add(tPerm ? 'nogo' : 'caution', 'METAR trend ' + ty + ': visibility ' + tr.vis.toFixed(1) + ' km', 'trend', 'policy', 'POL-TREND-VISCEIL');
      }
      if (tr.ceil != null && tr.ceil < userCeil) {
        var tPermC = ty === 'BECMG';
        add(tPermC || tr.ceil < RULES.policy.circuitFloorFt || (ctl && tr.ceil < legalCeil) ? 'nogo' : 'caution',
          'METAR trend ' + ty + ': ceiling ' + tr.ceil + ' ft', 'trend', 'policy', 'POL-TREND-VISCEIL');
      }
    } else if (picked.applyTrend && ob.hasTrend && !ob.trend) {
      add('note', 'METAR NOSIG — no significant change expected for 2 h (TREND supersedes the TAF)', 'trend', 'policy', 'POL-NOSIG');
    }

    /* ---- Wind (2.1.0) ----------------------------------------------------------------------
       Every wind trigger is measured against the user's own limits, and one wind is counted once:
       - Crosswind limit  = lower of the aircraft and the user (lim).
       - Wind/gust limit  = the user's gust limit, capped at gustLimitMaxKt (P.gust).
       - Direction unknown (VRB, missing direction, or no runway headings): worst case is that the
         whole peak (mean or gust, whichever is larger) is crosswind. That is compared with lim, so
         a light variable wind with a small gust is not the same as a strong variable wind.
       - Gust crosswind needs a significant gust (spread >= gustSigSpreadKt) to start the 80% caution
         band; a gust crosswind within 10% of the limit counts whatever the spread; a gust crosswind
         above the limit is always NO DEPART / NO LAND (model: margin rules). */
    /* 2.4.0: a filled wind is judged with the rules of its own source (model margins for a model wind). */
    var wSrc = ob.windFill || src;
    var wTag = ob.windFill === 'taf' ? ' — wind from TAF' : ob.windFill === 'model' ? ' — wind from model' : '';
    if (ob.windFill) {
      add('note', (ob.windStale ? 'METAR is stale (' + (picked.source && picked.source.ageMin) + ' min old), its wind ' +
          (ob.metarWind ? (ob.metarWind.vrb ? 'VRB' : (ob.metarWind.wd != null ? String(Math.round(ob.metarWind.wd)).padStart(3, '0') + '°' : '')) + ' ' + ob.metarWind.ws + (ob.metarWind.g ? 'G' + ob.metarWind.g : '') + ' kt ' : '') +
          'replaced from the ' : 'Wind not in the ' + (src === 'taf' ? 'TAF' : 'METAR') + ', taken from the ') + (ob.windFill === 'taf' ? 'TAF' : 'model') + ': ' +
        (ob.vrb ? 'VRB' : (ob.wd != null ? String(Math.round(ob.wd)).padStart(3, '0') + '°' : 'direction unknown')) + ' ' + ob.ws + (ob.g ? 'G' + ob.g : '') + ' kt',
        'windfill', 'policy', 'POL-WIND-FILL');
    }
    var lim = ac ? (ac.xw == null ? P.xw : Math.min(ac.xw, P.xw)) : Math.min(RULES.policy.defXwKt, P.xw);
    var who = !ac ? 'No aircraft selected, default ' + lim : (ac.xw != null && ac.xw <= P.xw ? ac.id + ' limit ' + ac.xw : 'Your crosswind limit ' + P.xw);
    var rw = runwaysOf(field);
    var wind = null;
    var spread = (ob.g != null && ob.ws != null) ? ob.g - ob.ws : 0;
    var dirless = !!ob.vrb || ob.wd == null || !rw.length;

    if (ob.ws == null) add('caution', 'Wind not reported — crosswind and tailwind not checked', 'wind', 'policy', 'POL-WIND-MISSING');
    else if (dirless && (ob.ws > 0 || ob.g)) {
      var peakV = Math.max(ob.ws, ob.g || 0);
      var calmFloor = Math.max(RULES.policy.vrbGoKt, RULES.policy.xwGoFrac * lim);
      var dl = ob.vrb ? 'Variable wind ' : (ob.wd == null ? 'Wind (direction not reported) ' : 'Wind ');
      var dwhy = (ob.vrb || ob.wd == null) ? 'direction unknown' : 'runway headings unavailable';
      var vtxt = dl + ob.ws + (ob.g ? 'G' + ob.g : '') + ' kt — ' + dwhy;
      if (peakV <= calmFloor) {
        if (ob.ws > 0) add('note', vtxt + ', worst-case crosswind within ' + Math.round(calmFloor) + ' kt', 'vrb', 'policy', 'POL-VRB-LIGHT');
      } else if (peakV > lim) {
        var mdVr = applyModelMargin(wSrc, 'nogo', 'wind', peakV, lim);
        add(mdVr.level, vtxt + ', worst-case crosswind above ' + lim + ' kt (' + who + ')' + (mdVr.demoted ? ' — model value is close to the limit, treated as caution' : '') + wTag, 'vrb', 'policy', mdVr.demoted ? mdVr.ruleId : 'POL-VRB-GUST');
      } else {
        add('caution', vtxt + ', worst-case crosswind close to ' + lim + ' kt (' + who + ')' + wTag, 'vrb', 'policy', 'POL-VRB-GUST');
      }
    } else if (!dirless && ob.ws > 0) {
      var b = best(rw, ob.wd, ob.ws);
      if (ob.vg) {
        var wvg = worstIn(rw.filter(function (r) { return r.id === b.id; }), ob.vg.a, ob.vg.b, ob.ws);
        var m0 = b.xw;
        if (wvg) {
          if (wvg.xw > m0) { b.xw = wvg.xw; b.a = (wvg.xwD - rw.filter(function (r) { return r.id === b.id; })[0].true) * Math.PI / 180; }
          b.hw = Math.min(b.hw, wvg.twMin);
        }
      }
      wind = b;
      var gx = ob.g ? Math.abs(ob.g * Math.sin(b.a)) : b.xw;
      b.gx = gx;
      var X = Math.round(b.xw), GX = Math.round(gx);
      var rwyTxt = ' on RWY ' + b.id + (ob.vg ? ' (worst of ' + ob.vg.a + 'V' + ob.vg.b + ')' : '');
      var xwRule = ob.vg ? 'POL-VAR-GROUP' : 'POL-XW-BANDS';
      var gustSig = spread >= RULES.policy.gustSigSpreadKt;
      if (X > lim) {
        var mdX = applyModelMargin(wSrc, 'nogo', 'wind', X, lim);
        add(mdX.level, 'Crosswind ' + X + ' kt' + rwyTxt + ' (' + who + ')' + (mdX.demoted ? ' — model value is close to the limit, treated as caution' : '') + wTag, 'xw', 'aircraft', mdX.demoted ? mdX.ruleId : xwRule);
      } else if (GX > lim) {
        var mdGX = applyModelMargin(wSrc, 'nogo', 'wind', GX, lim);
        add(mdGX.level, 'Gust crosswind ' + GX + ' kt' + rwyTxt + ' (' + who + ')' + (mdGX.demoted ? ' — model value is close to the limit, treated as caution' : '') + wTag, 'xw', 'aircraft', mdGX.demoted ? mdGX.ruleId : xwRule);
      } else if (X > RULES.policy.xwGoFrac * lim || (gustSig && GX > RULES.policy.xwGoFrac * lim) || GX > RULES.policy.gustXwNearFrac * lim) {
        add('caution', 'Crosswind ' + (X > RULES.policy.xwGoFrac * lim ? X : GX) + ' kt' + (X > RULES.policy.xwGoFrac * lim ? '' : ' (gusts)') + rwyTxt + ' (' + who + ')' + wTag, 'xw', 'aircraft', xwRule);
      }
      if (b.hw < -0.5) {
        var twn = Math.round(-b.hw);
        if (twn >= 1) {
          if (twn > RULES.policy.twNogoKt) {
            var mdT = applyModelMargin(wSrc, 'nogo', 'tw', twn, RULES.policy.twNogoKt);
            add(mdT.level, 'Tailwind ' + twn + ' kt' + (mdT.demoted ? ' — model value is close to the limit, treated as caution' : '') + wTag, 'tw', 'policy', mdT.demoted ? mdT.ruleId : 'POL-TW-BANDS');
          } else if (twn > RULES.policy.twCautionKt) {
            add('caution', 'Tailwind ' + twn + ' kt' + wTag, 'tw', 'policy', 'POL-TW-BANDS');
          }
        }
      }
    }
    if (ac && ac.xw == null) add('caution', ac.n + ' POH crosswind not verified — using yours (' + P.xw + ' kt)', 'acx', 'aircraft', 'POL-XW-BANDS');
    if (!ac) add('note', 'No aircraft selected — default crosswind ' + lim + ' kt', 'acx', 'policy', 'POL-XW-DEFAULT');

    /* Wind and gust against the user's gust limit. The advisory cautions (strong mean wind, large
       spread) only count when no crosswind / variable-wind / tailwind finding already flags this
       wind; otherwise they stay as notes so the same wind is not listed twice. */
    var windFlagged = F.some(function (f) { return (f.lv === 'caution' || f.lv === 'nogo') && /^(vrb|xw|tw)$/.test(f.k); });
    var advLv = windFlagged ? 'note' : 'caution';
    var spreadLim = RULES.policy.gustSpreadKt + (wSrc === 'model' ? RULES.policy.modelGustSlackKt : 0);
    if (ob.ws != null && ob.ws > P.gust) {
      var mdW = applyModelMargin(wSrc, 'nogo', 'wind', ob.ws, P.gust);
      add(mdW.level, 'Wind ' + ob.ws + ' kt above your gust limit ' + P.gust + ' kt' + (mdW.demoted ? ' — model value is close to the limit, treated as caution' : '') + wTag, 'ws', 'limit', mdW.demoted ? mdW.ruleId : 'POL-WS-STRONG');
    } else if (ob.g && ob.g > P.gust) {
      var mdG = applyModelMargin(wSrc, 'nogo', 'wind', ob.g, P.gust);
      add(mdG.level, 'Your gust limit ' + P.gust + ' kt (gusting ' + ob.g + ')' + (mdG.demoted ? ' — model value is close to the limit, treated as caution' : '') + wTag, 'g', 'limit', mdG.demoted ? mdG.ruleId : 'POL-WS-STRONG');
    } else if (ob.ws != null && ob.ws >= RULES.policy.gustLimitNearFrac * P.gust) {
      add(advLv, 'Strong wind ' + ob.ws + ' kt (within 20% of your ' + P.gust + ' kt wind limit)', 'ws', 'limit', 'POL-WS-STRONG');
    } else if (ob.g && ob.ws != null && spread > spreadLim) {
      add(advLv, 'Gust spread ' + spread + ' kt (' + ob.ws + 'G' + ob.g + ')' + (wSrc === 'model' ? ' — model gusts read high' : ''), 'g', 'policy', 'POL-GUST-SPREAD');
    }

    if (ruleset !== 'ifr') {
      if (phase === 'land') {
        var landAt = input.eta != null ? +input.eta : now;
        var siLand = sunInfo(lat, lon, landAt);
        if (siLand && siLand.isNight && !P.night) {
          var ns = nightStartAt(lat, lon, landAt);
          add('caution', 'You\'ll land after dark (night from ' + fmtSastHm(ns != null ? ns : siLand.nightFrom) + '). Turn on night rating if you hold one.', 'night', 'policy', 'POL-NIGHT-ARRIVAL');
        }
      } else if (si) {
        if (si.isNight && !P.night) add('nogo', 'Night not selected (after sunset)', 'night', 'policy', 'POL-NIGHT-UNSELECTED');
        else if (!si.isNight && !P.night && si.nightFrom - now < RULES.policy.nightSoonMin * 6e4 && si.nightFrom > now) {
          add('caution', 'Night in ' + Math.round((si.nightFrom - now) / 6e4) + ' min, night not selected', 'night', 'policy', 'POL-NIGHT-SOON');
        }
      }
    }

    var dA = da(elevOf(field), ob.t, ob.qnh);
    var daAbove = daLimitFt(P);
    var daL = elevOf(field) != null ? elevOf(field) + daAbove : null;
    if (dA != null && daL != null && dA > daL) {
      add(daOn(P) ? 'caution' : 'note', 'Density altitude ' + dA.toLocaleString('en-ZA') + ' ft (more than ' + daAbove + ' ft above the field)', 'da', 'policy', 'POL-DA');
    }

    if (ruleset !== 'ifr' && picked.tafRaw && !picked.skipTaf) {
      var winFrom = picked.tafWinFrom != null ? picked.tafWinFrom : now;
      var winTo = picked.tafWinTo != null ? picked.tafWinTo : now + RULES.policy.tafLookaheadH * 3600e3;
      if (picked.applyTafScan || src !== 'taf') {
        /* Depart-now with a METAR and no TREND: still scan the next 2 h of TAF. */
        if (src !== 'taf') { winFrom = now; winTo = now + RULES.policy.tafLookaheadH * 3600e3; }
      }
      var includeBase = !!picked.includeBase;
      if (picked.applyTafScan || (src !== 'taf' && src !== 'model')) {
        tafScan(picked.tafRaw, winFrom, winTo, userVis, userCeil, includeBase, { rw: rw, lim: lim, who: who, gust: P.gust }).forEach(function (f) {
          add(f.lv, f.txt, f.k, f.shelf, f.ruleId);
        });
      } else if (src === 'taf') {
        tafScan(picked.tafRaw, winFrom, winTo, userVis, userCeil, includeBase, { rw: rw, lim: lim, who: who, gust: P.gust }).forEach(function (f) {
          add(f.lv, f.txt, f.k, f.shelf, f.ruleId);
        });
      }
    }

    if (src === 'model' && F.some(function (f) { return f.lv === 'nogo' && /^(vis|ceil|xw|tw|ws|g|vrb)$/.test(f.k); })) {
      add('note', 'Model value is clearly beyond the applicable limit', 'model', 'policy', 'POL-MODEL-NOGO-CLEAR');
    }

    F.sort(function (a, b) { return LV[b.lv] - LV[a.lv]; });
    var top = F.filter(function (f) { return f.lv === 'nogo' || f.lv === 'caution'; })[0];
    var status = top ? top.lv : 'go';
    var why = top ? top.txt : (fillWhy || (wind ? 'Wind on RWY ' + wind.id + ': ' + Math.round(Math.max(0, wind.hw)) + ' kt head, ' + Math.round(wind.xw) + ' kt cross' + wTag : (wTag ? 'Within limits' + wTag : 'Within limits')));
    return finish({
      status: status, code: status, why: why, F: F, wind: wind, da: dA, si: si,
      picked: picked, heliport: false
    }, now, phase, P, ac, si, picked);
  }

  function finish(partial, now, phase, P, ac, si, picked) {
    var F = partial.F || [];
    var src = picked && picked.source;
    var ob = picked && picked.obs;
    return {
      status: partial.status,
      code: partial.code || partial.status,
      heliport: !!partial.heliport,
      why: partial.why,
      reasons: F,
      findings: F,
      weatherUsed: ob ? (function () {
        var usedVis = ob.vis != null ? ob.vis : (ob.tvis != null ? ob.tvis : ob.mvis);
        var visSrc = (ob.vis != null || (ob.cavok && ob.ceilFill !== 'taf')) ? ob.src : (ob.tvis != null ? 'taf' : (ob.mvis != null ? 'model' : null));
        var ceilSrc = ob.ceilFill || ((ob.ceil != null || ob.cavok || skyClear(ob)) ? ob.src : null);
        return {
          vis: usedVis, ceil: ob.ceil, wd: ob.wd, vrb: ob.vrb, ws: ob.ws, g: ob.g,
          temp: ob.t, qnh: ob.qnh, time: ob.time, src: ob.src,
          cavok: !!ob.cavok, cnr: !!ob.cnr, visAtLeast: !!(ob.visAtLeast || ob.cavok || (ob.tvis != null && ob.tvisAtLeast)),
          low: ob.low, cc: ob.cc, raw: ob.raw, wx: ob.wx, skyClear: skyClear(ob),
          visSrc: visSrc, ceilSrc: ceilSrc,
          tempSrc: ob.tempFill || (ob.t != null ? ob.src : null),
          qnhSrc: ob.qnhFill || (ob.qnh != null ? ob.src : null),
          windSrc: ob.ws != null ? (ob.windFill || ob.src) : null,
          visFill: ob.vis == null && !ob.cavok ? (ob.tvis != null ? 'taf' : (ob.mvis != null ? 'model' : null)) : null,
          ceilFill: ob.ceilFill || null,
          tafEarly: ob.tafEarly || ob.tEarly || null
        };
      }()) : null,
      windSource: ob && ob.ws != null ? (ob.windFill || ob.src) : null,
      source: src || null,
      phase: phase,
      planning: picked && picked.planning || null,
      sun: si || partial.si || null,
      da: partial.da != null ? partial.da : null,
      wind: partial.wind || null,
      profile: P,
      aircraft: ac,
      rulePackId: 'ga-core-v2',
      rulePackVersion: RULES_VERSION,
      rulePackChecksum: RULES_LOCK.checksum,
      engineVersion: '2.5.0-taf-early',
      disclaimer: PIC_DISCLAIMER,
      disclaimers: [PIC_DISCLAIMER].concat(ob && ob.src === 'model' ? [MODEL_DISCLAIMER] : []),
      now: now
    };
  }

  var api = {
    RULES_VERSION: RULES_VERSION,
    RULES: RULES,
    RULES_LOCK: RULES_LOCK,
    CITES: CITES,
    AC: AC,
    PRE: PRE,
    PIC_DISCLAIMER: PIC_DISCLAIMER,
    MODEL_DISCLAIMER: MODEL_DISCLAIMER,
    rulesCanonical: rulesCanonical,
    stableStringify: stableStringify,
    evaluate: evaluate,
    pickWeather: pickWeather,
    applyModelMargin: applyModelMargin,
    wxScan: wxScan,
    tafSegs: tafSegs,
    tafScan: tafScan,
    conditionsAt: conditionsAt,
    visKm: visKm,
    ceilOf: ceilOf,
    metarBody: metarBody,
    metarTrend: metarTrend,
    varGroup: varGroup,
    sunInfo: sunInfo,
    sun: sun,
    best: best,
    worstIn: worstIn,
    da: da,
    daLimitFt: daLimitFt,
    clampDaLimit: clampDaLimit,
    parseOfficial: parseOfficial,
    parseModel: parseModel
  };

  G.GACoreV2 = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
