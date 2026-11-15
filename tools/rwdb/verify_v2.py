#!/usr/bin/env python3
"""Verify every record of ad-runways-elev.locked.v1.json and write ad-runways-elev.locked.v2.json (15 Nov 2026, MT 14:23/14:25 SAST).
v1 is never edited. usage: verify_v2.py <repo dir> <report-dir>
Checks per aerodrome (588; heliports/balloonport: elevation + position only):
  heading  : each runway end vs every independent source (AIP published true bearing, AIP threshold coordinates, OpenStreetMap way
             geometry, OurAirports threshold coordinates, OurAirports heading_degT) and the designator (magnetic = true - WMM2025
             declination must be within +-10 deg of designator x 10), and the two ends must be reciprocal (180 +-3 deg).
             Disagreement = a source more than 5 deg away. Resolution: AIP > OSM measured > OurAirports.
  elevation: AIP AD 2.2 (read from the AD 2 PDF, tools/rwdb/aip_elev_pdf.py) vs OurAirports vs terrain (Copernicus DEM GLO-90 at the
             card, at the OurAirports position and at the measured OSM runway). Flag > 100 ft. Resolution: AIP > terrain at the
             measured runway > OurAirports (if consistent with the ground at its own position) > terrain.
  position : card vs OurAirports match, AIP ARP and the OSM runway; flag > 2 km.
"""
import csv, json, math, os, re, sys, copy, collections
REPO, REP = sys.argv[1], sys.argv[2]
RAW = os.path.join(REPO, 'tools/rwdb/raw-v2'); RAW2 = os.path.join(REPO, 'tools/rwdb/raw-v2')
V1_FILE = json.load(open(os.path.join(REPO, 'site/data/ad-runways-elev.locked.v1.json')))
# Base = build.py run on raw-v2/ (= raw/ of v1 with the 11 card positions corrected, raw-v2/card-position-fixes.json), so moved
# cards are matched to OurAirports / OSM at their real position. For every other card the base is identical to v1.
import subprocess, tempfile
_tmp = os.path.join(tempfile.mkdtemp(), 'base-v2.json')
subprocess.run([sys.executable, os.path.join(REPO, 'tools/rwdb/build.py'), RAW2, REPO, _tmp], check=True, capture_output=True)
V1 = json.load(open(_tmp))
POSFIX = json.load(open(os.path.join(RAW2, 'card-position-fixes.json')))
aip = json.load(open(os.path.join(RAW, 'aip-rwy.json')))['ad']
aipel = json.load(open(os.path.join(RAW2, 'aip-elev-pdf.json')))
omx = json.load(open(os.path.join(RAW2, 'om-elev-extra.json'))); OMX = omx['points']
omel = json.load(open(os.path.join(RAW, 'om-elev.json')))
decl = json.load(open(os.path.join(RAW, 'decl.json')))
OA = {r['id']: r for r in csv.DictReader(open(os.path.join(RAW, 'airports.csv')))}
OAR = collections.defaultdict(list)
for r in csv.DictReader(open(os.path.join(RAW, 'runways.csv'))): OAR[r['airport_ident']].append(r)
OSM = {e['id']: e for e in json.load(open(os.path.join(RAW, 'osm-geof/geofabrik-runways.json')))['elements']}
FT = 3.28084
TODAY = '2026-11-15'
def dist(a, b, c, d):
    p = math.radians; x = p(c - a); y = p(d - b)
    h = math.sin(x / 2) ** 2 + math.cos(p(a)) * math.cos(p(c)) * math.sin(y / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(h))
def brg(a, b, c, d):
    p = math.radians; y = math.sin(p(d - b)) * math.cos(p(c))
    x = math.cos(p(a)) * math.sin(p(c)) - math.sin(p(a)) * math.cos(p(c)) * math.cos(p(d - b))
    return (math.degrees(math.atan2(y, x)) + 360) % 360
def ad(a, b): return abs((a - b + 180) % 360 - 180)
def norm_d(s):
    s = (s or '').strip().upper().replace(' ', '')
    m = re.fullmatch(r'0?(\d{1,2})([LRC]?)', s)
    return (m.group(1).zfill(2) + m.group(2)) if m else None
def osm_bearing(e):
    g = e['geometry']
    closed = len(g) > 3 and abs(g[0]['lat'] - g[-1]['lat']) < 1e-7 and abs(g[0]['lon'] - g[-1]['lon']) < 1e-7
    if closed:
        best = max(zip(g, g[1:]), key=lambda ab: dist(ab[0]['lat'], ab[0]['lon'], ab[1]['lat'], ab[1]['lon']))
        a, b = best
    else: a, b = g[0], g[-1]
    return brg(a['lat'], a['lon'], b['lat'], b['lon'])
def V(v, src, url, ret, **kw):
    o = {'v': v, 'src': src, 'url': url, 'retrieved': ret}; o.update({k: x for k, x in kw.items() if x is not None}); return o
def magv(t, d): return None if t is None or d is None else V(round((t - d) % 360, 1), 'derived: true heading minus WMM2025 declination %.1f° (epoch 2026-11-15)' % d, 'https://www.ncei.noaa.gov/products/world-magnetic-model', '2026-11-15', derived_from='v2 verified true heading')

V1_FILE_BY = {x['id']: x for x in V1_FILE['aerodromes']}
v2 = copy.deepcopy(V1)
REC = []           # report rows
APPROX = set()     # rwy-data.js ends whose 'true_brg' is an APPROX designator x 10 value, not published
HD = []; EL = []; POS = []; CH = []
stats = collections.Counter()
for a in v2['aerodromes']:
    ID = a['id']; heli = a['category'] in ('heliport', 'balloonport'); la, lo = a['lat']['v'], a['lon']['v']; d = decl.get(ID)
    m = a['match'].get('ourairports'); oar = OA.get(str(m['oa_id'])) if m else None
    ver = {'checked': TODAY, 'heading': [], 'elevation': None, 'position': None}
    if ID in POSFIX:
        f = POSFIX[ID]; ver['card_position_fix'] = f
        a['flags'].append('v2: card position corrected from %s to %s (%s)' % (f['old'], f['new'], f['evidence']))
        CH.append((ID, 'card position', '%s -> %s; %s' % (f['old'], f['new'], f['evidence'])))
        a['v1_record_summary'] = {k: V1_FILE_BY[ID].get(k) for k in ('lat', 'lon', 'elevation_ft', 'has_heading')}
    # ---------------- position ----------------
    pos = {'card': [la, lo]}
    if oar: pos['ourairports_m'] = round(dist(la, lo, float(oar['latitude_deg']), float(oar['longitude_deg'])))
    A = aip.get(ID); aip_bad = False
    if A:
        arp = A.get('arp') or [A['lat'], A['lon']]
        pos['aip_arp_m'] = round(dist(la, lo, arp[0], arp[1]))
        if pos['aip_arp_m'] > 5000:
            aip_bad = True
            a['flags'].append('v2: the AIP record %s is %s (ARP %.1f km from this card); its runways and elevation are not used for this card' % (ID, A['name'], pos['aip_arp_m'] / 1000))
    ws = a['match'].get('osm_ways') or []
    if ws: pos['osm_runway_m'] = min(w['dist_m'] for w in ws)
    rj = a['match'].get('ourairports_rejected') or []
    if rj: pos['same_id_elsewhere'] = [{'ident': r['ident'], 'name': r['name'], 'type': r['type'], 'km': round(r['dist_m'] / 1000, 1)} for r in rj]
    worst = max([v for k, v in pos.items() if k.endswith('_m')] or [0])
    pos['status'] = 'ok' if worst <= 2000 and not rj else 'flag'
    ver['position'] = pos
    if pos['status'] == 'flag': POS.append((ID, a['name'], pos))
    # ---------------- runways / headings ----------------
    if aip_bad:
        keep = [r for r in a['runways'] if r.get('source_primary') != 'SACAA AIP']
        if len(keep) != len(a['runways']): CH.append((ID, 'runways', 'removed AIP runway(s) %s that belong to %s' % (','.join('/'.join(r['designators']) for r in a['runways'] if r.get('source_primary') == 'SACAA AIP'), A['name'])))
        a['runways'] = keep
    for rw in ([] if heli else a['runways']):
        ends = rw['ends']
        # AIP per end
        aend = {}; athr = {}
        if A and not aip_bad:
            for r in A.get('runways') or []:
                es = r.get('ends') or []
                for e in es:
                    nd = norm_d(e.get('id')) or e.get('id')
                    if e.get('true_brg') is not None and not str((e.get('src') or {}).get('true_brg', '')).startswith('APPROX'): aend[nd] = float(e['true_brg'])
                    elif e.get('true_brg') is not None: APPROX.add((ID, nd))
                if len(es) == 2 and all(e.get('thr') for e in es):
                    b = brg(es[0]['thr'][0], es[0]['thr'][1], es[1]['thr'][0], es[1]['thr'][1])
                    if dist(es[0]['thr'][0], es[0]['thr'][1], es[1]['thr'][0], es[1]['thr'][1]) > 200:
                        athr[norm_d(es[0]['id']) or es[0]['id']] = b; athr[norm_d(es[1]['id']) or es[1]['id']] = (b + 180) % 360
        # OurAirports per end
        ohd = {}; othr = {}
        if m:
            for r in OAR.get(m['ident'], []):
                if r['closed'] == '1': continue
                for eid, hk in ((r['le_ident'], 'le_heading_degT'), (r['he_ident'], 'he_heading_degT')):
                    nd = norm_d(eid) or eid
                    if r[hk]:
                        v = float(r[hk]); dl = bool(norm_d(nd or '')) and (ad(v, int(nd[:2]) * 10) <= 3 or abs(v - int(nd[:2])) < 0.6)
                        ohd[nd] = (v, dl)
                try:
                    g = (float(r['le_latitude_deg']), float(r['le_longitude_deg']), float(r['he_latitude_deg']), float(r['he_longitude_deg']))
                    if dist(*g) > 150:
                        b = brg(*g); othr[norm_d(r['le_ident']) or r['le_ident']] = b; othr[norm_d(r['he_ident']) or r['he_ident']] = (b + 180) % 360
                except ValueError: pass
        for e in ends:
            th = e.get('true_hdg'); eid = e['id']; nd = norm_d(eid or '')
            if not th: continue
            cur = th['v']; srcs = {}
            if eid in aend: srcs['AIP published'] = aend[eid]
            if eid in athr: srcs['AIP thresholds'] = athr[eid]
            cc = e.get('cross_check')
            if cc: srcs['OSM geometry'] = cc['osm_true_hdg']
            if th['src'].startswith('OSM'): srcs['OSM geometry'] = cur
            approx = 'APPROX' in th['src']
            if eid in othr: srcs['OurAirports thresholds'] = othr[eid]
            if eid in ohd and not ohd[eid][1]: srcs['OurAirports heading'] = ohd[eid][0]
            if th['src'].startswith('OurAirports') and 'thresholds' not in ''.join(srcs) and 'OurAirports heading' not in srcs: srcs['OurAirports'] = cur
            if approx: cur_approx = cur
            # OSM bearing for ends with no cross_check but with a matched way (pick the way/direction closest to cur)
            if 'OSM geometry' not in srcs and ws:
                best = None
                for w in ws:
                    b = osm_bearing(OSM[w['way']])
                    for h in (b, (b + 180) % 360):
                        if ad(h, cur) <= 20 and (best is None or ad(h, cur) < ad(best, cur)): best = h
                if best is not None: srcs['OSM geometry'] = round(best, 1)
            # designator check
            dchk = None
            if nd and d is not None: dchk = round(ad((cur - d) % 360, int(nd[:2]) * 10), 1)
            # preferred value
            pref = None
            for k in ('AIP published', 'AIP thresholds', 'OSM geometry', 'OurAirports thresholds', 'OurAirports heading', 'OurAirports'):
                if k in srcs: pref = (k, srcs[k]); break
            dis = {k: round(ad(v, cur), 1) for k, v in srcs.items() if ad(v, cur) > 5}
            agree = sum(1 for v in srcs.values() if ad(v, cur) <= 5)
            row = {'end': eid, 'v1': cur, 'sources': {k: round(v, 1) for k, v in srcs.items()}, 'agree_within_5': agree, 'designator_check_deg': dchk}
            new = cur
            if approx and not pref:
                e['v1_true_hdg'] = th; e['true_hdg'] = None; e['mag_hdg'] = None
                row['resolved'] = 'dropped: v1 value %s is an AIP-extract APPROX (designator x 10), no published or measured source' % cur
                CH.append((ID, 'heading ' + str(eid), '%s -> none (APPROX designator x 10 in rwy-data.js, no other source)' % cur))
                ver['heading'].append(row); HD.append((ID, a['name'], row, {})); stats['ends_dropped_approx'] += 1
                continue
            if approx: row['note'] = 'v1 value was an AIP-extract APPROX (designator x 10)'
            if pref and (ad(pref[1], cur) > 2 or approx):
                new = round(pref[1], 1); row['resolved'] = 'changed to %s (%s first)' % (new, pref[0])
                kind = {'AIP published': 'SACAA AIP published true bearing', 'AIP thresholds': 'SACAA AIP threshold coordinates (bearing)', 'OSM geometry': 'OSM-derived: measured way geometry',
                        'OurAirports thresholds': 'OurAirports threshold coordinates (bearing)', 'OurAirports heading': 'OurAirports runways.csv heading_degT'}[pref[0]]
                e['v1_true_hdg'] = th
                e['true_hdg'] = V(new, kind + ' (v2 verification)', th.get('url'), TODAY, method='v2 resolution: AIP > OSM measured > OurAirports')
                e['mag_hdg'] = magv(new, d)
                CH.append((ID, 'heading ' + str(eid), '%s -> %s (%s; sources %s)' % (cur, new, pref[0], row['sources'])))
            elif dis: row['resolved'] = 'kept %s (%s is the preferred source; others listed)' % (cur, pref[0] if pref else 'only source')
            if nd and d is not None:
                dchk2 = round(ad((new - d) % 360, int(nd[:2]) * 10), 1); row['designator_check_deg'] = dchk2
                if dchk2 > 10: row['designator_flag'] = 'magnetic %.0f is %.0f° from designator %s x 10' % ((new - d) % 360, dchk2, nd)
            row['n_sources'] = len(srcs)
            stats['ends'] += 1; stats['ends_2plus_sources'] += len(srcs) >= 2; stats['ends_1_source'] += len(srcs) == 1
            if dis: stats['ends_disagree'] += 1
            if 'designator_flag' in row: stats['ends_designator_flag'] += 1
            ver['heading'].append(row)
            if dis or 'resolved' in row or 'designator_flag' in row: HD.append((ID, a['name'], row, dis))
        # reciprocal
        hs = [e['true_hdg']['v'] for e in ends if e.get('true_hdg')]
        if len(hs) == 2 and ad(hs[0], (hs[1] + 180) % 360) > 3 and all(e['id'] in athr for e in ends):
            for e in ends:
                old = e['true_hdg']; nv = round(athr[e['id']], 1)
                e['v1_true_hdg'] = old; e['true_hdg'] = V(nv, 'SACAA AIP threshold coordinates (bearing; the published bearings are not reciprocal) (v2 verification)', old.get('url'), TODAY, method='bearing between AIP threshold coordinates')
                e['mag_hdg'] = magv(nv, d)
                CH.append((ID, 'heading ' + str(e['id']), '%s -> %s (AIP published bearings %s not reciprocal; AIP threshold coordinates used)' % (old['v'], nv, hs)))
            HD.append((ID, a['name'], {'end': '/'.join(map(str, rw['designators'])), 'reciprocal': hs, 'resolved': 'AIP threshold bearing used for both ends'}, {}))
            hs = [e['true_hdg']['v'] for e in ends if e.get('true_hdg')]
        if len(hs) == 2 and ad(hs[0], (hs[1] + 180) % 360) > 3:
            a['flags'].append('v2: runway %s ends are not reciprocal (%.0f vs %.0f)' % ('/'.join(map(str, rw['designators'])), hs[0], hs[1]))
            HD.append((ID, a['name'], {'end': '/'.join(map(str, rw['designators'])), 'reciprocal': hs}, {}))
    # duplicates: two runway entries whose ends all match within 3 deg are the same strip under another source/name
    # (parallel L/R/C runways are kept). Keep the labelled one, then AIP > OurAirports > OSM.
    RK = {'SACAA AIP': 0, 'OurAirports': 1, 'OSM': 2}
    def hs_(rw): return [e['true_hdg']['v'] for e in rw['ends'] if e.get('true_hdg')]
    def lab(rw): return all(rw['designators']) and len(rw['designators']) == 2
    def par(x, y): return lab(x) and lab(y) and any(re.search(r'[LRC]$', str(z)) for z in x['designators'] + y['designators']) and set(x['designators']) != set(y['designators'])
    order = sorted(a['runways'], key=lambda r: (not lab(r), RK.get(r.get('source_primary'), 3)))
    keep = []
    for rw in order:
        h = hs_(rw)
        dup = next((k for k in keep if h and hs_(k) and not par(rw, k) and all(any(ad(x, y) <= 3 for y in hs_(k)) for x in h)), None)
        if dup is not None:
            CH.append((ID, 'runways', 'removed duplicate %s runway %s (same headings as %s %s)' % (rw.get('source_primary'), '/'.join(map(str, rw['designators'])), dup.get('source_primary'), '/'.join(map(str, dup['designators'])))))
            a.setdefault('v1_duplicate_runways', []).append(rw); continue
        keep.append(rw)
    a['runways'] = [r for r in a['runways'] if any(r is k for k in keep)]
    # unlabelled OSM runway ways (no ref tag): when the field has a labelled runway (AIP / OurAirports / OSM with ref), an extra
    # unlabelled way is usually a disused strip or a mis-tagged taxiway, so it is not used for the crosswind. When the field has
    # only unlabelled ways, they are kept and each end gets a label worked out from its measured magnetic heading
    # (id_from_heading: true) so the card can say which runway; the heading itself is measured, never from a designator.
    live = [r for r in a['runways'] if any(e.get('true_hdg') for e in r['ends'])]
    if any(lab(r) for r in live):
        drop = [r for r in live if not lab(r)]
        for r in drop:
            CH.append((ID, 'runways', 'unlabelled OSM way (%s) not used: the field has labelled runways %s' % (', '.join('%.0f' % h for h in hs_(r)), ', '.join('/'.join(map(str, x['designators'])) for x in live if lab(x)))))
            a.setdefault('v2_unlabelled_osm_not_used', []).append(r)
        a['runways'] = [r for r in a['runways'] if not any(r is x for x in drop)]
    elif not heli:
        for r in live:
            for e in r['ends']:
                if e.get('true_hdg') and d is not None:
                    n = int(round(((e['true_hdg']['v'] - d) % 360) / 10.0)) or 36
                    e['id'] = '%02d' % n; e['id_from_heading'] = True
            r['designators'] = [e['id'] for e in r['ends']]
            stats['runways_labelled_from_heading'] += 1
    a['has_heading'] = any(e.get('true_hdg') for r in a['runways'] for e in r['ends'])
    # ---------------- elevation ----------------
    cands = {}
    if A and not aip_bad and ID in aipel and aipel[ID]['elev_ft'] is not None: cands['AIP'] = aipel[ID]['elev_ft']
    if oar and oar['elevation_ft']: cands['OurAirports'] = int(oar['elevation_ft'])
    if omel.get(ID) is not None: cands['terrain_card'] = round(omel[ID] * FT)
    if m and ('oa:%s' % m['oa_id']) in OMX and pos.get('ourairports_m', 0) > 150: cands['terrain_ourairports_pos'] = round(OMX['oa:%s' % m['oa_id']]['m'] * FT)
    ow = [OMX['osm:%s' % w['way']]['m'] for w in ws if ('osm:%s' % w['way']) in OMX]
    if ow and not heli: cands['terrain_osm_runway'] = round(sum(ow) / len(ow) * FT)
    cur = a['elevation_ft']['v'] if a['elevation_ft'] else None
    spread = (max(cands.values()) - min(cands.values())) if len(cands) > 1 else 0
    pick = None; why = ''
    if 'AIP' in cands: pick, why = ('AIP', 'SACAA AIP AD 2.2 (read from the AD 2 PDF)')
    elif 'OurAirports' in cands:
        o = cands['OurAirports']; tr = cands.get('terrain_osm_runway')
        tg = cands.get('terrain_ourairports_pos', cands.get('terrain_card'))
        if tr is not None and abs(o - tr) > 100: pick, why = ('terrain_osm_runway', 'OurAirports %d ft is %d ft off the ground at the measured runway' % (o, abs(o - tr)))
        elif tr is None and tg is not None and abs(o - tg) > 300 and 'terrain_card' in cands and abs(cands['terrain_card'] - tg) <= 100:
            pick, why = ('terrain_ourairports_pos' if 'terrain_ourairports_pos' in cands else 'terrain_card', 'OurAirports %d ft is %d ft off the ground at its own position and at the card' % (o, abs(o - tg)))
        else: pick, why = ('OurAirports', 'published (OurAirports)' + ('' if tg is None or abs(o - tg) <= 100 else '; %d ft from terrain, kept (no measured runway, 100-300 ft or positions differ)' % abs(o - tg)))
    elif 'terrain_osm_runway' in cands: pick, why = ('terrain_osm_runway', 'no published value; terrain at the measured runway')
    elif 'terrain_card' in cands: pick, why = ('terrain_card', 'no published value; terrain at the card')
    erow = {'v1': cur, 'candidates': cands, 'spread_ft': spread, 'chosen': pick, 'why': why}
    if pick:
        nv = cands[pick]; erow['v2'] = nv
        relabel = pick == 'AIP' and not (a['elevation_ft'] or {}).get('src', '').startswith('SACAA AIP')
        if cur != nv or relabel:
            SRC = {'AIP': V(nv, 'SACAA AIP AD 2.2 reference elevation, %s (%s), read from %s' % (aipel.get(ID, {}).get('page'), aipel.get(ID, {}).get('page_date'), aipel.get(ID, {}).get('file')), aipel.get(ID, {}).get('file'), TODAY),
                   'OurAirports': V(nv, 'OurAirports airports.csv elevation_ft (ident %s)' % (m['ident'] if m else ''), 'https://davidmegginson.github.io/ourairports-data/airports.csv', '2026-11-15T11:26Z'),
                   'terrain_osm_runway': V(nv, 'terrain-derived: Copernicus DEM GLO-90 (Open-Meteo) at the measured OSM runway midpoint', 'https://api.open-meteo.com/v1/elevation', omx['retrieved'], terrain_derived=True),
                   'terrain_ourairports_pos': V(nv, 'terrain-derived: Copernicus DEM GLO-90 (Open-Meteo) at the OurAirports position', 'https://api.open-meteo.com/v1/elevation', omx['retrieved'], terrain_derived=True),
                   'terrain_card': V(nv, 'terrain-derived: Copernicus DEM GLO-90 (Open-Meteo) at card coordinates', 'https://api.open-meteo.com/v1/elevation', '2026-11-15T11:40Z', terrain_derived=True)}
            a['v1_elevation_ft'] = a['elevation_ft']; a['elevation_ft'] = SRC[pick]
            CH.append((ID, 'elevation', ('%s -> %s ft (%s)' % (cur, nv, why)) if cur != nv else ('%s ft unchanged, source now the AIP AD 2 PDF' % nv)))
        for k in cands:
            if k not in ('AIP', 'OurAirports', 'terrain_card'):
                a['elevation_candidates'].append({'v': cands[k], 'src': {'terrain_osm_runway': 'terrain-derived at the measured OSM runway (v2)', 'terrain_ourairports_pos': 'terrain-derived at the OurAirports position (v2)'}[k], 'url': 'https://api.open-meteo.com/v1/elevation', 'retrieved': omx['retrieved'], 'terrain_derived': True})
        if 'AIP' in cands and not any(c['src'].startswith('SACAA AIP AD 2.2 reference elevation, AD 2') for c in a['elevation_candidates']):
            a['elevation_candidates'].insert(0, {'v': cands['AIP'], 'src': 'SACAA AIP AD 2.2 reference elevation (AD 2 PDF, v2)', 'url': aipel[ID]['file'], 'retrieved': TODAY, 'rank': 1})
    ver['elevation'] = erow
    if spread > 100 or (cur is not None and pick and cur != cands[pick]): EL.append((ID, a['name'], erow))
    stats['elev_checked'] += 1; stats['elev_flag_100'] += spread > 100
    a['verification'] = ver
ads = [a for a in v2['aerodromes'] if a['category'] not in ('heliport', 'balloonport')]
v2['version'] = 2; v2['built'] = TODAY
v2['lock_note'] = 'LOCKED. Never edit this file in place. v2 = v1 after the full verification (tools/rwdb/verify_v2.py); a new version is a new file (v3).'
v2['rules'] = V1['rules'] + ['v2: every record carries verification{heading[], elevation, position}. Heading resolution AIP > OSM measured > OurAirports; elevation AIP (AD 2 PDF) > terrain at the measured runway > OurAirports (when consistent with the ground) > terrain at the card.',
                             'v2: AIP records whose ARP is more than 5 km from the card are not used for that card (FAKG).',
                             'Sources stay in this file for the admin dashboard only; the public cards never show source names or dates.']
v2['sources'] = dict(V1['sources'], aip_elevation_v2='SACAA AIP AD 2 PDFs in site/aip/<icao>/ad2-<icao>.pdf, AD 2.2 item 3, read 2026-11-15', terrain_v2=omx['src'] + ', ' + omx['retrieved'])
cov = v2['coverage']
cov['with_true_heading'] = sum(a['has_heading'] for a in ads)
cov['v2_verification'] = dict(stats, changes=len(CH), heading_rows_listed=len(HD), elevation_rows_listed=len(EL), position_flags=len(POS))
os.makedirs(REP, exist_ok=True)
OUT = os.path.join(REPO, 'site/data/ad-runways-elev.locked.v2.json')
with open(OUT, 'w') as fh:
    head = {k: v for k, v in v2.items() if k != 'aerodromes'}
    fh.write(json.dumps(head, indent=1, ensure_ascii=False)[:-2] + ',\n "aerodromes": [\n')
    fh.write(',\n'.join('  ' + json.dumps(x, ensure_ascii=False, separators=(',', ':')) for x in v2['aerodromes']))
    fh.write('\n ]\n}\n')
json.load(open(OUT))
json.dump({'stats': stats, 'changes': CH, 'heading': HD, 'elevation': EL, 'position': POS}, open(os.path.join(REP, 'verify-v2.json'), 'w'), indent=1, ensure_ascii=False)
print(json.dumps(stats), 'changes', len(CH), 'HD', len(HD), 'EL', len(EL), 'POS', len(POS))
