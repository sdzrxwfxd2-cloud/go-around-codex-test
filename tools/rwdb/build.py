#!/usr/bin/env python3
"""Build site/data/ad-runways-elev.locked.v1.json (15 Nov 2026).
Inputs (raw downloads kept under tools/rwdb/raw/ or the box work dir, see README):
  ourairports airports.csv + runways.csv, OSM Overpass aeroway=runway tiles, Open-Meteo elevation (Copernicus DEM),
  SACAA AIP AD 2 extracts already in the repo (site/rwy/rwy-data.js, site/wst/wst-data.js), card list site/wst/wst-cards-data.js.
Rules: no value is guessed. Headings only from published bearings or measured geometry, never from designators.
"""
import csv, json, math, glob, re, sys, os, collections, datetime as dt
RAW = sys.argv[1]; REPO = sys.argv[2]; OUT = sys.argv[3]
_R = json.load(open(os.path.join(RAW, 'retrieved.json'))); RET = _R['short']; RET_FULL = _R['full']   # {source: retrieved}
cards = json.load(open(os.path.join(RAW, 'cards.json')))
aip = json.load(open(os.path.join(RAW, 'aip-rwy.json')))['ad']
wm = json.load(open(os.path.join(RAW, 'wmst.json')))
wmst = {a['ic']: a for a in wm['ads']}
omel = json.load(open(os.path.join(RAW, 'om-elev.json')))
BEFORE = json.load(open(os.path.join(RAW, 'before.json')))
decl = json.load(open(os.path.join(RAW, 'decl.json')))     # id -> WMM2025 declination deg (E+), epoch 2026-11-15
OA_URL = 'https://davidmegginson.github.io/ourairports-data/'
OSM_URL = 'https://www.openstreetmap.org/way/'
OM_URL = 'https://api.open-meteo.com/v1/elevation?latitude={la}&longitude={lo}'
AIP_SRC = 'SACAA AIP South Africa AD 2, 15 JUL 2026 (AIRAC AMDT 3/26 compilation), as extracted to site/rwy/rwy-data.js'
COUNTRIES = ('ZA', 'LS', 'SZ', 'NA', 'BW', 'MZ', 'ZW')

def dist(a, b, c, d):
    p = math.radians; x = p(c - a); y = p(d - b)
    h = math.sin(x / 2) ** 2 + math.cos(p(a)) * math.cos(p(c)) * math.sin(y / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(h))
def brg(a, b, c, d):
    p = math.radians; y = math.sin(p(d - b)) * math.cos(p(c))
    x = math.cos(p(a)) * math.sin(p(c)) - math.sin(p(a)) * math.cos(p(c)) * math.cos(p(d - b))
    return (math.degrees(math.atan2(y, x)) + 360) % 360
def V(v, src, url, ret, **kw):
    o = {'v': v, 'src': src, 'url': url, 'retrieved': ret}; o.update({k: x for k, x in kw.items() if x is not None}); return o
def norm_d(s):
    s = (s or '').strip().upper().replace(' ', '')
    m = re.fullmatch(r'0?(\d{1,2})([LRC]?)', s)
    return (m.group(1).zfill(2) + m.group(2)) if m else None
def toks(s):
    s = re.sub(r'[^a-z0-9 ]', ' ', (s or '').lower())
    stop = {'airport', 'airfield', 'aerodrome', 'airstrip', 'strip', 'intl', 'international', 'field', 'farm', 'lodge', 'game', 'private', 'the', 'af', 'ad', 'landing'}
    return {t for t in s.split() if t not in stop and len(t) > 2}

# ---------- OurAirports ----------
OA = [r for r in csv.DictReader(open(os.path.join(RAW, 'airports.csv'))) if r['iso_country'] in COUNTRIES]
for r in OA: r['la'] = float(r['latitude_deg']); r['lo'] = float(r['longitude_deg'])
oa_by = collections.defaultdict(list)
for r in OA:
    for k in ('ident', 'gps_code', 'icao_code', 'local_code'):
        if r[k]: oa_by[r[k]].append(r)
OAR = collections.defaultdict(list)
for r in csv.DictReader(open(os.path.join(RAW, 'runways.csv'))): OAR[r['airport_ident']].append(r)

# ---------- OSM runways ----------
osm = {}
for f in glob.glob(os.path.join(RAW, 'osm-geof', '*.json')):
    try: d = json.load(open(f))
    except Exception: continue
    for e in d.get('elements', []):
        if e.get('type') == 'way' and e.get('geometry'): osm[e['id']] = e
osm_list = []
for e in osm.values():
    g = e['geometry']; t = e.get('tags', {})
    closed = len(g) > 3 and abs(g[0]['lat'] - g[-1]['lat']) < 1e-7 and abs(g[0]['lon'] - g[-1]['lon']) < 1e-7
    if closed:   # area runway: longest edge
        best = None
        for a, b in zip(g, g[1:]):
            L = dist(a['lat'], a['lon'], b['lat'], b['lon'])
            if not best or L > best[0]: best = (L, a, b)
        L, a, b = best; method = 'OSM area runway, bearing of longest edge'
    else:
        a, b = g[0], g[-1]; L = dist(a['lat'], a['lon'], b['lat'], b['lon']); method = 'OSM runway centreline, bearing first node -> last node'
    if L < 150: continue
    mla = (a['lat'] + b['lat']) / 2; mlo = (a['lon'] + b['lon']) / 2
    osm_list.append(dict(id=e['id'], tags=t, a=(a['lat'], a['lon']), b=(b['lat'], b['lon']), len_m=L, mid=(mla, mlo), method=method,
                         bearing=brg(a['lat'], a['lon'], b['lat'], b['lon'])))

# ---------- match cards -> OurAirports ----------
def match_oa(c):
    cands = []
    for k in (c['id'],):
        for r in oa_by.get(k, []): cands.append((r, 'ident/gps/icao/local code = ' + k))
    ct = toks(c['nm'])
    for r in OA:
        dd = dist(c['la'], c['lo'], r['la'], r['lo'])
        if dd <= 2000 and toks(r['name']) & ct: cands.append((r, 'name tokens + coordinates'))
    acc = []; rej = []
    seen = set()
    for r, how in cands:
        if r['id'] in seen: continue
        seen.add(r['id'])
        dd = dist(c['la'], c['lo'], r['la'], r['lo'])
        nameok = bool(toks(r['name']) & ct) or not ct
        info = {'oa_id': int(r['id']), 'ident': r['ident'], 'name': r['name'], 'type': r['type'], 'dist_m': round(dd), 'how': how, 'name_overlap': bool(toks(r['name']) & ct)}
        if dd <= 2000: acc.append(info | {'r': r})
        else: rej.append(info | {'why': 'more than 2 km from card coordinates'})
    acc.sort(key=lambda x: (not x['how'].startswith('ident'), x['dist_m']))
    if not acc:   # coordinate-only: nearest OA aerodrome within 1 km (same type family)
        near = sorted(((dist(c['la'], c['lo'], r['la'], r['lo']), r) for r in OA if r['type'] not in ('closed',)), key=lambda x: x[0])[:1]
        if near and near[0][0] <= 1000 and (near[0][1]['type'] == 'heliport') == (c['cat'] == 'heliport'):
            r = near[0][1]; acc = [{'oa_id': int(r['id']), 'ident': r['ident'], 'name': r['name'], 'type': r['type'], 'dist_m': round(near[0][0]), 'how': 'coordinates only (<=1 km, nearest)', 'name_overlap': False, 'r': r}]
    return (acc[0] if acc else None), rej

def osm_for(c, oa_id):
    out = []
    for o in osm_list:
        dd = dist(c['la'], c['lo'], o['mid'][0], o['mid'][1])
        if dd > 3000: continue
        # nearest card wins (avoid neighbour fields)
        if NEAREST.get(o['id']) != c['id']: continue
        # the nearest OurAirports aerodrome (any, including ones not on our cards) must be this card's match
        n_oa = NEAR_OA.get(o['id'])
        if oa_id is not None and n_oa is not None and n_oa[0] != oa_id: SKIPPED.append((c['id'], o['id'], n_oa)); continue
        if oa_id is None and dd > 1500: continue
        out.append(o | {'dist_m': round(dd)})
    return out
NEAREST = {}; NEAR_OA = {}; SKIPPED = []
OA_FIX = [r for r in OA if r['type'] not in ('heliport', 'balloonport') and not r['name'].startswith('[Duplicate]')]
for o in osm_list:
    nb = min(OA_FIX, key=lambda r: dist(r['la'], r['lo'], o['mid'][0], o['mid'][1]))
    NEAR_OA[o['id']] = (int(nb['id']), nb['ident'], nb['name'], round(dist(nb['la'], nb['lo'], o['mid'][0], o['mid'][1])))
    best = min(cards, key=lambda c: dist(c['la'], c['lo'], o['mid'][0], o['mid'][1]))
    NEAREST[o['id']] = best['id']

def mag_of(true, d, ref):
    if true is None or d is None: return None
    return V(round((true - d) % 360, 1), 'derived: true heading minus WMM2025 declination %.1f° (epoch 2026-11-15)' % d,
             'https://www.ncei.noaa.gov/products/world-magnetic-model', RET['wmm'], derived_from=ref)

def assign_ends(bear, ref, d):
    """ref like '01/19' -> (idA, idB) so that heading of end A ~ its designator. Geometry gives the heading; designator only labels the end."""
    h1, h2 = bear, (bear + 180) % 360
    parts = [norm_d(p) for p in re.split(r'[/\-;]', ref or '') if p.strip()]
    if len(parts) != 2 or not all(parts): return [(None, round(h1, 1), None), (None, round(h2, 1), None)]
    def exp(p): return (int(p[:2]) * 10 + (d or 0)) % 360
    def diff(a, b): return abs((a - b + 180) % 360 - 180)
    e0, e1 = exp(parts[0]), exp(parts[1])
    if diff(h1, e0) + diff(h2, e1) <= diff(h2, e0) + diff(h1, e1): pair = [(parts[0], h1), (parts[1], h2)]
    else: pair = [(parts[0], h2), (parts[1], h1)]
    return [(p, round(h, 1), round(diff(h, exp(p)), 1)) for p, h in pair]

SURF = {'ASP': 'asphalt', 'ASPH': 'asphalt', 'CON': 'concrete', 'GRS': 'grass', 'GRE': 'gravel', 'GRV': 'gravel', 'GVL': 'gravel', 'TURF': 'grass', 'DIRT': 'dirt', 'GRAVEL': 'gravel'}
db = []; unmatched = []; review = []; CLOSED = []; XCHK = []; DESIG_FIX = []; DESIG_LOW = set()
for c in cards:
    ID = c['id']; d = decl.get(ID)
    rec = {'id': ID, 'name': c['nm'], 'category': c['cat'], 'province': c['prov'],
           'lat': V(c['la'], 'Go Around card list (site/wst/wst-cards-data.js)', 'site/wst/wst-cards-data.js', RET['repo']),
           'lon': V(c['lo'], 'Go Around card list (site/wst/wst-cards-data.js)', 'site/wst/wst-cards-data.js', RET['repo']),
           'mag_declination_deg': V(round(d, 2), 'WMM2025 (NOAA/BGS) computed at card coordinates, epoch 2026-11-15, east positive', 'https://www.ncei.noaa.gov/products/world-magnetic-model', RET['wmm']) if d is not None else None,
           'match': {}, 'elevation_ft': None, 'elevation_candidates': [], 'runways': [], 'flags': []}
    oa, rej = match_oa(c)
    if oa:
        rec['match']['ourairports'] = {k: v for k, v in oa.items() if k != 'r'}
        if oa['type'] == 'closed': rec['flags'].append('OurAirports lists this aerodrome as CLOSED (type=closed); check if it still operates'); CLOSED.append(ID)
    if rej: rec['match']['ourairports_rejected'] = rej; review.append({'id': ID, 'issue': 'OurAirports candidate rejected', 'candidates': rej})
    # ---- elevation candidates
    W = wmst.get(ID)
    if W and W.get('el') is not None and 'AIP' in (W.get('elsrc') or '') and 'DEM' not in W.get('elsrc', ''):
        rec['elevation_candidates'].append(V(W['el'], 'SACAA AIP AD 2.2 aerodrome reference elevation (' + AIP_SRC + ')', 'site/wst/wst-data.js', RET['aip'], rank=1))
    if oa and oa['r']['elevation_ft']:
        rec['elevation_candidates'].append(V(int(oa['r']['elevation_ft']), 'OurAirports airports.csv elevation_ft (ident %s)' % oa['ident'], OA_URL + 'airports.csv', RET['ourairports'], rank=2))
    if omel.get(ID) is not None:
        rec['elevation_candidates'].append(V(round(omel[ID] * 3.28084), 'terrain-derived: Open-Meteo elevation API (Copernicus DEM GLO-90) at card coordinates, %s m' % omel[ID],
                                             OM_URL.format(la=c['la'], lo=c['lo']), RET['openmeteo'], rank=3, terrain_derived=True))
    ex = wm['adElev'].get(ID)
    if ex is not None: rec['existing_site_elevation_ft'] = {'v': ex, 'src': 'site/wst/ad-elev.js (current engine input, for comparison only)', 'url': 'site/wst/ad-elev.js', 'retrieved': RET['repo']}
    if rec['elevation_candidates']:
        best = sorted(rec['elevation_candidates'], key=lambda x: x['rank'])[0]; rec['elevation_ft'] = best
        vals = [x['v'] for x in rec['elevation_candidates']]
        if max(vals) - min(vals) > 150: rec['flags'].append('elevation sources disagree by %d ft' % (max(vals) - min(vals)))
    # ---- runways: AIP published bearings
    rws = []
    A = aip.get(ID)
    if A:
        for r in A.get('runways') or []:
            ends = []
            for e in r.get('ends') or []:
                t = e.get('true_brg'); s = (e.get('src') or {}).get('true_brg')
                th = V(t, 'SACAA AIP ' + (s or 'AD 2.12'), 'site/rwy/rwy-data.js', RET['aip'], method='published true bearing') if t is not None else None
                mp = e.get('mag_brg_published')
                mh = V(mp, 'SACAA AIP published magnetic bearing', 'site/rwy/rwy-data.js', RET['aip']) if mp is not None else mag_of(t, d, 'AIP true bearing')
                ends.append({'id': norm_d(e.get('id')) or e.get('id'), 'true_hdg': th, 'mag_hdg': mh})
            src_l = (r.get('src') or {})
            rws.append({'designators': [x['id'] for x in ends], 'source_primary': 'SACAA AIP',
                        'length_ft': V(round(r['len'] * 3.28084), 'SACAA AIP ' + (src_l.get('len') or 'AD 2.12') + ' (%s m)' % r['len'], 'site/rwy/rwy-data.js', RET['aip']) if r.get('len') else None,
                        'width_ft': V(round(r['wid'] * 3.28084), 'SACAA AIP ' + (src_l.get('wid') or 'AD 2.12') + ' (%s m)' % r['wid'], 'site/rwy/rwy-data.js', RET['aip']) if r.get('wid') else None,
                        'surface': V(r.get('surface'), 'SACAA AIP ' + (src_l.get('surface') or 'AD 2.12') + ' raw: ' + str(r.get('surface_raw')), 'site/rwy/rwy-data.js', RET['aip']) if r.get('surface') else None,
                        'ends': ends})
    # ---- OurAirports runways
    def key(ds): return '/'.join(sorted(x for x in ds if x))
    have = {key(r['designators']) for r in rws}
    if oa:
        for r in OAR.get(oa['ident'], []):
            if r['closed'] == '1': rec['flags'].append('OurAirports runway %s/%s marked closed (not used)' % (r['le_ident'], r['he_ident'])); continue
            ds = [norm_d(r['le_ident']) or r['le_ident'] or None, norm_d(r['he_ident']) or r['he_ident'] or None]
            ends = []
            geo = None
            try: geo = (float(r['le_latitude_deg']), float(r['le_longitude_deg']), float(r['he_latitude_deg']), float(r['he_longitude_deg']))
            except ValueError: pass
            for i, (eid, hk) in enumerate(((ds[0], 'le_heading_degT'), (ds[1], 'he_heading_degT'))):
                th = None
                if r[hk]:
                    th = V(float(r[hk]), 'OurAirports runways.csv %s (runway id %s)' % (hk, r['id']), OA_URL + 'runways.csv', RET['ourairports'], method='OurAirports true heading')
                elif geo and dist(*geo) > 150:
                    b = brg(*geo) if i == 0 else brg(geo[2], geo[3], geo[0], geo[1])
                    th = V(round(b, 1), 'OurAirports runways.csv threshold coordinates (runway id %s)' % r['id'], OA_URL + 'runways.csv', RET['ourairports'], method='bearing between published threshold coordinates')
                ends.append({'id': eid, 'true_hdg': th, 'mag_hdg': mag_of(th['v'] if th else None, d, 'OurAirports')})
            entry = {'designators': ds, 'source_primary': 'OurAirports',
                     'length_ft': V(int(r['length_ft']), 'OurAirports runways.csv length_ft', OA_URL + 'runways.csv', RET['ourairports']) if r['length_ft'] else None,
                     'width_ft': V(int(r['width_ft']), 'OurAirports runways.csv width_ft', OA_URL + 'runways.csv', RET['ourairports']) if r['width_ft'] else None,
                     'surface': V(SURF.get(r['surface'].upper(), r['surface'].lower()) , 'OurAirports runways.csv surface (raw %s)' % r['surface'], OA_URL + 'runways.csv', RET['ourairports']) if r['surface'] else None,
                     'ends': ends}
            k = key(ds)
            if k in have:   # AIP already has it: fill only what AIP lacks
                tgt = next(x for x in rws if key(x['designators']) == k)
                for f in ('length_ft', 'width_ft', 'surface'):
                    if not tgt.get(f) and entry.get(f): tgt[f] = entry[f]
                for e in tgt['ends']:
                    if not e['true_hdg']:
                        o = next((x for x in ends if x['id'] == e['id'] and x['true_hdg']), None)
                        if o: e['true_hdg'] = o['true_hdg']; e['mag_hdg'] = o['mag_hdg']
            else: rws.append(entry); have.add(k)
    # ---- OSM runways
    mine = osm_for(c, oa['oa_id'] if oa else None)
    if mine: rec['match']['osm_ways'] = [{'way': o['id'], 'ref': o['tags'].get('ref'), 'dist_m': o['dist_m'], 'len_m': round(o['len_m'])} for o in mine]
    for o in mine:
        ref = o['tags'].get('ref')
        ends = assign_ends(o['bearing'], ref, d)
        ds = [e[0] for e in ends]
        mk = lambda h, eid, dev: {'id': eid, 'true_hdg': V(h, 'OSM-derived: way %d (%s)' % (o['id'], 'ref ' + ref if ref else 'no ref tag'), OSM_URL + str(o['id']), RET['osm'], method=o['method'], designator_check_deg=dev), 'mag_hdg': mag_of(h, d, 'OSM geometry')}
        oends = [mk(h, eid, dev) for eid, h, dev in ends]
        if any(e[2] is not None and e[2] > 30 for e in ends): rec['flags'].append('OSM way %d: geometry differs >30° from its ref %s, check' % (o['id'], ref))
        k = key(ds) if all(ds) else None
        tgt = next((x for x in rws if k and key(x['designators']) == k), None)
        if tgt is None and not all(ds):
            # unlabelled OSM way: attach to an existing runway without headings only if it is the only candidate both sides
            noh = [x for x in rws if not any(e['true_hdg'] for e in x['ends'])]
            if len(noh) == 1 and len(mine) == 1:
                tgt = noh[0]; rec['flags'].append('OSM way %d has no ref; paired with the only runway %s by elimination, ends labelled by heading' % (o['id'], '/'.join(str(x) for x in tgt['designators'])))
                lab = assign_ends(o['bearing'], '/'.join(str(x) for x in tgt['designators']), d)
                if all(x[0] for x in lab): oends = [mk(h, eid, dev) for eid, h, dev in lab]
        if tgt is not None:
            for e in tgt['ends']:
                m = next((x for x in oends if x['id'] == e['id']), None)
                if not m: continue
                if not e['true_hdg']: e['true_hdg'] = m['true_hdg']; e['mag_hdg'] = m['mag_hdg']
                elif m['true_hdg']['src'] != e['true_hdg']['src']:
                    dv = abs((m['true_hdg']['v'] - e['true_hdg']['v'] + 180) % 360 - 180)
                    e['cross_check'] = {'osm_way': o['id'], 'osm_true_hdg': m['true_hdg']['v'], 'diff_deg': round(dv, 1), '_osm': m}
                    XCHK.append((ID, e['id'], e['true_hdg']['src'].split(' ')[0], round(dv, 1)))
            if not tgt.get('length_ft'): tgt['length_ft'] = V(round(o['len_m'] * 3.28084), 'OSM-derived: way %d geometry length' % o['id'], OSM_URL + str(o['id']), RET['osm'])
            if not tgt.get('surface') and o['tags'].get('surface'): tgt['surface'] = V(o['tags']['surface'], 'OSM way %d tag surface' % o['id'], OSM_URL + str(o['id']), RET['osm'])
        else:
            rws.append({'designators': ds, 'source_primary': 'OSM',
                        'length_ft': V(round(o['len_m'] * 3.28084), 'OSM-derived: way %d geometry length' % o['id'], OSM_URL + str(o['id']), RET['osm']),
                        'width_ft': V(round(float(o['tags']['width']) * 3.28084), 'OSM way %d tag width (m)' % o['id'], OSM_URL + str(o['id']), RET['osm']) if re.fullmatch(r'\d+(\.\d+)?', o['tags'].get('width', '')) else None,
                        'surface': V(o['tags']['surface'], 'OSM way %d tag surface' % o['id'], OSM_URL + str(o['id']), RET['osm']) if o['tags'].get('surface') else None,
                        'ends': oends})
    # OurAirports heading_degT values that equal the designator x 10 (or the bare designator number) are not true headings:
    # in South Africa true = magnetic - 20..28°, so such a value is designator-derived. Replace with measured geometry if we
    # have it, otherwise drop it (never a heading from a name). Also prefer geometry when OurAirports and OSM disagree > 15°.
    for rw in rws:
        for e in rw['ends']:
            th = e['true_hdg']; cc = e.get('cross_check'); nd = norm_d(e['id'] or '')
            if th and th['src'].startswith('OurAirports runways.csv') and 'heading_degT' in th['src']:
                dl = bool(nd) and (abs((th['v'] - int(nd[:2]) * 10 + 180) % 360 - 180) <= 3 or abs(th['v'] - int(nd[:2])) < 0.6)
                if dl or (cc and cc['diff_deg'] > 15):
                    why = ('OurAirports value %.1f equals the designator, so it is designator-derived, not a true heading' % th['v']) if dl else ('OurAirports and OSM geometry disagree by %.1f°; measured geometry kept' % cc['diff_deg'])
                    e['rejected'] = {'old': th, 'why': why}
                    if cc: e['true_hdg'] = cc['_osm']['true_hdg']; e['mag_hdg'] = cc['_osm']['mag_hdg']; DESIG_FIX.append((ID, e['id']))
                    else: e['true_hdg'] = None; e['mag_hdg'] = None; DESIG_LOW.add(ID)
            elif cc and cc['diff_deg'] > 15:
                rec['flags'].append('runway end %s: sources disagree by %.0f° (%s vs OSM way %d), check' % (e['id'], cc['diff_deg'], th['src'].split(' ')[0], cc['osm_way']))
            if cc: cc.pop('_osm', None)
    rec['runways'] = rws
    rec['has_heading'] = any(e['true_hdg'] for r in rws for e in r['ends'])
    if not oa: unmatched.append({'id': ID, 'name': c['nm'], 'what': 'no OurAirports match'})
    if not rec['has_heading'] and c['cat'] not in ('heliport', 'balloonport'): unmatched.append({'id': ID, 'name': c['nm'], 'what': 'no runway heading from any source'})
    if rec['elevation_ft'] is None: unmatched.append({'id': ID, 'name': c['nm'], 'what': 'no elevation'})
    elif rec['elevation_ft'].get('terrain_derived'): rec['flags'].append('elevation is terrain-derived only (no published value)')
    db.append(rec)

ads = [r for r in db if r['category'] not in ('heliport', 'balloonport')]
cov = {'aerodromes': len(ads), 'with_true_heading': sum(r['has_heading'] for r in ads),
       'heading_by_primary_source': dict(collections.Counter(next((e['true_hdg']['src'].split(' ')[0] for rw in r['runways'] for e in rw['ends'] if e['true_hdg']), 'none') for r in ads)),
       'with_elevation': sum(r['elevation_ft'] is not None for r in ads),
       'elevation_published': sum(1 for r in ads if r['elevation_ft'] and not r['elevation_ft'].get('terrain_derived')),
       'elevation_terrain_only': sum(1 for r in ads if r['elevation_ft'] and r['elevation_ft'].get('terrain_derived')),
       'closed_in_ourairports': len([i for i in CLOSED if i in {a['id'] for a in ads}]), 'heliports_and_balloonports_also_stored': len(db) - len(ads)}
xd = sorted(x[3] for x in XCHK)
cov['ourairports_ends_replaced_by_osm_geometry'] = len(DESIG_FIX); cov['aerodromes_with_ourairports_heading_dropped'] = len(DESIG_LOW)
cov['osm_cross_check'] = {'ends_compared': len(xd), 'median_diff_deg': xd[len(xd) // 2] if xd else None, 'p90_diff_deg': xd[int(len(xd) * .9)] if xd else None, 'max_diff_deg': xd[-1] if xd else None, 'over_5_deg': [x for x in XCHK if x[3] > 5]}
ex_d = [(r['id'], r['existing_site_elevation_ft']['v'], r['elevation_ft']['v']) for r in ads if r.get('existing_site_elevation_ft') and r['elevation_ft']]
cov['existing_site_elevation_compared'] = len(ex_d); cov['existing_site_elevation_differs_over_100ft'] = [x for x in ex_d if abs(x[1] - x[2]) > 100]
cov['before'] = BEFORE
out = {'name': 'Go Around aerodrome runways + elevation database', 'version': 1, 'locked': True,
       'lock_note': 'LOCKED. Never edit this file in place. A new version is a new file (ad-runways-elev.locked.v2.json) with its own README entry.',
       'built': RET['built'], 'sources': RET_FULL, 'coverage': cov,
       'rules': ['No value is guessed. Runway headings come only from a published true bearing (SACAA AIP, OurAirports) or from measured geometry (OurAirports threshold coordinates, OpenStreetMap ways). Designators are used only to label which end is which, never as a heading.',
                 'Magnetic headings are derived as true minus WMM2025 declination unless the AIP publishes one.',
                 'Elevation priority: SACAA AIP > OurAirports > terrain model (tagged terrain_derived).',
                 'Every value carries src, url and retrieved.'],
       'unmatched': unmatched, 'review': review, 'aerodromes': db}
with open(OUT, 'w') as fh:   # one aerodrome per line: readable, and diffs between versions stay per aerodrome
    head = {k: v for k, v in out.items() if k != 'aerodromes'}
    fh.write(json.dumps(head, indent=1, ensure_ascii=False)[:-2] + ',\n "aerodromes": [\n')
    fh.write(',\n'.join('  ' + json.dumps(a, ensure_ascii=False, separators=(',', ':')) for a in db))
    fh.write('\n ]\n}\n')
json.load(open(OUT))
print(json.dumps(cov, indent=1)); print('osm ways skipped (nearer to another OurAirports field):', len(SKIPPED), SKIPPED[:8]); print('unmatched', collections.Counter(u['what'] for u in unmatched))
