#!/usr/bin/env python3
"""Write docs/RWDB-V2-VERIFICATION-15nov.md from verify-v2.json + the v2 file. usage: report_v2.py <repo> <verify-v2.json> <out.md>"""
import json, sys, csv, collections, os
REPO, VJ, OUT = sys.argv[1:4]
r = json.load(open(VJ)); v = json.load(open(os.path.join(REPO, 'site/data/ad-runways-elev.locked.v2.json')))
v1 = {a['id']: a for a in json.load(open(os.path.join(REPO, 'site/data/ad-runways-elev.locked.v1.json')))['aerodromes']}
A = {a['id']: a for a in v['aerodromes']}; ads = [a for a in v['aerodromes'] if a['category'] not in ('heliport', 'balloonport')]
OA = {x['id']: x for x in csv.DictReader(open(os.path.join(REPO, 'tools/rwdb/raw-v2/airports.csv')))}
S = r['stats']; L = []
w = L.append
ends = [h for a in ads for h in a['verification']['heading']]
single = [h for h in ends if h.get('n_sources', 0) == 1]
single_ok = [h for h in single if h.get('designator_check_deg') is not None and h['designator_check_deg'] <= 10 and not A_ID_FROM(h) ] if False else None
def from_heading(aid, end): return any(e.get('id_from_heading') for rw in A[aid]['runways'] for e in rw['ends'] if e['id'] == end)
s_ok = s_bad = s_nolabel = 0
for a in ads:
    for h in a['verification']['heading']:
        if h.get('n_sources') != 1: continue
        if h['end'] is None or from_heading(a['id'], h['end']): s_nolabel += 1
        elif h.get('designator_check_deg') is not None and h['designator_check_deg'] <= 10: s_ok += 1
        else: s_bad += 1
multi = [h for h in ends if h.get('n_sources', 0) >= 2]
w('# Runway / elevation database v2: verification report (15 Nov 2026)\n')
w('Built by `tools/rwdb/verify_v2.py` (inputs `tools/rwdb/raw-v2/`), report by `tools/rwdb/report_v2.py`. v1 is unchanged; the result is `site/data/ad-runways-elev.locked.v2.json`. Times SAST. Sources stay in the data file for the admin dashboard; the public cards never show them.\n')
w('## Summary\n')
w('| Check | Result |\n|---|---|')
w('| Aerodromes checked | %d (plus %d heliports/balloonport: elevation and position only) |' % (len(ads), len(v['aerodromes']) - len(ads)))
w('| Aerodromes with a runway heading | v1 %d → **v2 %d** |' % (sum(x['has_heading'] for x in v1.values() if x['category'] not in ('heliport', 'balloonport')), sum(a['has_heading'] for a in ads)))
w('| Runway ends checked | %d |' % len(ends))
w('| Ends with 2 or more independent sources | %d; all agree within 5° except %d (listed) |' % (len(multi), S.get('ends_disagree', 0)))
w('| Ends with one measured source | %d: %d pass the designator check (±10°), %d fail it (listed), %d have no designator (OSM way without ref: kept with a label from the measured heading when the field has no labelled runway, otherwise not used; see changes) |' % (len(single), s_ok, s_bad, s_nolabel))
w('| Elevations checked | %d; %d with sources more than 100 ft apart (listed) |' % (S['elev_checked'], S['elev_flag_100']))
w('| Changes v1 → v2 | %d (every one listed below) |' % len(r['changes']))
w('| Card positions corrected | %d (clear evidence) |' % sum(1 for c in r['changes'] if c[1] == 'card position'))
w('')
w('Resolution rules: heading AIP published true bearing > AIP threshold coordinates > OSM measured geometry > OurAirports; elevation AIP AD 2.2 (read from the AD 2 PDF) > terrain at the measured OSM runway (when OurAirports is more than 100 ft off it) > OurAirports (when consistent with the ground at its own position) > terrain at the card. AIP-extract values marked `APPROX` (designator × 10) are not treated as published.\n')
w('## Every change v1 → v2\n')
w('| # | Card | What | Change |\n|---|---|---|---|')
for i, (aid, what, ch) in enumerate(r['changes'], 1): w('| %d | %s | %s | %s |' % (i, aid, what, ch.replace('|', '/')))
w('\n## Heading disagreements, failed designator checks and non-reciprocal ends\n')
w('| Card | Name | End | v1 | Sources (true °) | Designator check | Outcome |\n|---|---|---|---|---|---|---|')
for aid, nm, row, dis in r['heading']:
    if 'reciprocal' in row:
        w('| %s | %s | %s | %s | | | ends not reciprocal; %s |' % (aid, nm, row['end'], row['reciprocal'], row.get('resolved', 'flagged'))); continue
    out = row.get('resolved') or ('flag: ' + row['designator_flag'] if row.get('designator_flag') else 'kept')
    if row.get('designator_flag') and not row.get('resolved'): out = 'kept (measured geometry; the label may be old or the OSM ref wrong): ' + row['designator_flag']
    w('| %s | %s | %s | %s | %s | %s | %s |' % (aid, nm, row['end'], row.get('v1'), ', '.join('%s %s' % kv for kv in row.get('sources', {}).items()), row.get('designator_check_deg'), out))
w('\n## Elevation: sources more than 100 ft apart, or changed\n')
w('| Card | Name | v1 ft | v2 ft | Chosen | Candidates (ft) | Why |\n|---|---|---|---|---|---|---|')
for aid, nm, e in r['elevation']:
    w('| %s | %s | %s | %s | %s | %s | %s |' % (aid, nm, e['v1'], e.get('v2'), e['chosen'], ', '.join('%s %s' % kv for kv in e['candidates'].items()), e['why']))
# ---- identity / position list (the 25 of v1 + anything new)
w('\n## Code / position mismatches (the 25 from v1, plus new position flags)\n')
w('| Card | Name | Evidence | Action |\n|---|---|---|---|')
PF = json.load(open(os.path.join(REPO, 'tools/rwdb/raw-v2/card-position-fixes.json')))
OTHER = {'FAKG': 'Card is Komati Power Station (OurAirports FAKG at the card). The SACAA AIP AD 2-FAKG pages are **KWANDWE** (33°08\'S 26°35\'E, 830 km away) and OurAirports has Kwande ZA-0240 there. Before v2 the engine gave this card Kwandwe\'s runway 11/29 (from wst-data.js).',
         'FABV': 'Card matches OurAirports FABV Brandviei at 0 m; ZA-0376 Butterworth (756 km) only shares the code in another column.',
         'FAEG': 'Card matches OurAirports FAEG Egnep at 0 m; ZA-0375 Elgin (1 525 km) only shares the code.',
         'FAER': 'Card matches OurAirports FAER Ellisras Matimba at 0 m, OSM 15/33 at 77 m; ZA-0374 Ekland Ranch (243 km) only shares the code.',
         'FAHD': 'Card matches OurAirports FAHD Humansdorp at 0 m; ZA-0038 Hippo Pools (1 240 km) only shares the code.',
         'FAIW': 'Card matches OurAirports FAIW Indwe at 253 m; ZA-0350 Ingwelala (906 km) only shares the code.',
         'FAMF': 'Card matches OurAirports FAMF Malabar at 0 m; FAMQ Maclear (492 km) only shares the code.',
         'FAMY': 'Card matches OurAirports FAMY Malmesbury at 0 m, OSM 16/34 at 26 m; FAZP Mazeppa Bay (934 km) only shares the code.',
         'FAGA': 'Card matches OurAirports FAGA The Grange at 0 m; FAHV Big Water (427 km) only shares the code.',
         'FANV': 'OurAirports FANV Nieuwoudtville (3.1 km NE) has OSM runway 08/26; the card position also has an unlabelled OSM runway way (31 m). Two strips, not clear which one the card means.',
         'FADG': 'OurAirports FADG Dordrecht (closed) 2.2 km away; no OSM runway at either position.',
         'FAJV': 'OurAirports FAJV Jansenville 2.7 km away; no OSM runway at either position.',
         'FAKW': 'OurAirports FAKW Kareedouw (closed) 2.1 km away; no OSM runway at either position.',
         'ZA-0033': 'OurAirports ZA-0033 Mooivlei 3.7 km away; no OSM runway at either position.'}
ACT = {'FAKG': 'Not changed (needs MT). v2 no longer uses the Kwandwe AIP runway/elevation for this card. Proposed: keep the card as Komati Power Station and ask MT whether a Kwandwe (FAKG, AIP) card should exist; the FAKG aerodrome page and AIP links belong to Kwandwe.',
       'FANV': 'Not changed (not clear). Proposed: check imagery / the operator.', 'FADG': 'Not changed (no runway evidence).', 'FAJV': 'Not changed (no runway evidence).',
       'FAKW': 'Not changed (no runway evidence).', 'ZA-0033': 'Not changed (no runway evidence).'}
seen = set()
for aid, nm, pos in r['position']:
    seen.add(aid)
    ev = OTHER.get(aid) or ('; '.join('%s %s %s km' % (x['ident'], x['name'], x['km']) for x in pos.get('same_id_elsewhere', [])) + ('; ' if pos.get('same_id_elsewhere') else '') + ', '.join('%s %s m' % (k, vv) for k, vv in pos.items() if k.endswith('_m')))
    act = ACT.get(aid) or ('None: card correct, the other OurAirports record only shares the code.' if aid in OTHER else 'Listed; not changed.')
    w('| %s | %s | %s | %s |' % (aid, nm, ev, act))
for aid, f in PF.items():
    w('| %s | %s | %s | **Corrected** card position %s → %s%s |' % (aid, A[aid]['name'], f['evidence'], f['old'], f['new'], ' and province %s → %s' % tuple(f['province']) if f.get('province') else ''))
for aid in OTHER:
    if aid not in seen and aid not in PF: w('| %s | %s | %s | %s |' % (aid, A[aid]['name'], OTHER[aid], ACT.get(aid, 'None: card correct.')))
# ---- closed list
w('\n## Cards OurAirports marks CLOSED (none deleted or hidden)\n')
w('| Card | Name | OurAirports record | Runway seen in OSM? | Has heading in v2 | Proposed action |\n|---|---|---|---|---|---|')
n_osm = 0
for a in ads:
    m = a['match'].get('ourairports')
    if not m or m['type'] != 'closed': continue
    o = OA[str(m['oa_id'])]; ws = a['match'].get('osm_ways') or []
    osm = ', '.join('way %s%s (%s m)' % (x['way'], ' ref ' + x['ref'] if x.get('ref') else '', x['len_m']) for x in ws) or 'no'
    if ws: n_osm += 1
    act = ('Keep. OSM still maps a runway here; confirm with the owner / recent imagery before launch.' if ws else
           'Keep (not hidden). No runway in OSM either: propose a "reported closed, check before flying" note on the card once MT agrees, or MT confirms with the owner.')
    w('| %s | %s | %s "%s" (%d m from card) | %s | %s | %s |' % (a['id'], a['name'], m['ident'], o['name'], m['dist_m'], osm, 'yes' if a['has_heading'] else 'no', act))
w('\n%d closed-in-OurAirports cards; %d still have a runway in OSM.\n' % (sum(1 for a in ads if (a['match'].get('ourairports') or {}).get('type') == 'closed'), n_osm))
open(OUT, 'w').write('\n'.join(L) + '\n'); print('wrote', OUT, len(L), 'lines; single-source ends ok/bad/nolabel', s_ok, s_bad, s_nolabel)
