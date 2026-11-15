import json,csv,random,math,re,sys
db=json.load(open('site/data/ad-runways-elev.locked.v2.json'))
R='tools/rwdb/raw-v2/'
ap={r['ident']:r for r in csv.DictReader(open(R+'airports.csv'))}
rws={}
for r in csv.DictReader(open(R+'runways.csv')): rws.setdefault(r['airport_ident'],[]).append(r)
g=json.load(open(R+'osm-geof/geofabrik-runways.json'))['elements']
ways={str(e.get('id')):e for e in g}
ome=json.load(open(R+'om-elev.json'))
pdf=json.load(open(R+'aip-elev-pdf.json'))
def brg(a,b):
    la1,lo1,la2,lo2=map(math.radians,(a[0],a[1],b[0],b[1]))
    y=math.sin(lo2-lo1)*math.cos(la2); x=math.cos(la1)*math.sin(la2)-math.sin(la1)*math.cos(la2)*math.cos(lo2-lo1)
    return (math.degrees(math.atan2(y,x))+360)%360
dd=lambda a,b: abs(((b-a)%360+540)%360-180)
random.seed(1511)
cands=[a for a in db['aerodromes'] if a.get('elevation_ft') and a['elevation_ft'].get('v') is not None and any(e.get('true_hdg') and e['true_hdg'].get('v') is not None for r in a.get('runways',[]) for e in r.get('ends',[]))]
S=random.sample(cands,30)
print("# Hand check: 30 random aerodromes, heading + elevation recomputed from the raw sources (15 Nov 2026)\n")
print("Seed 1511. Heading = first runway end with a heading, recomputed independently from its raw source: OSM way geometry (first node to last node, geofabrik-runways.json), OurAirports runways.csv, or for AIP the other sources listed for that end. 'designator' = |magnetic heading (true - WMM2025 declination) - designator x 10|. Elevation = v2 value vs OurAirports airports.csv, Copernicus terrain at the card (Open-Meteo) and the AIP PDF (AD 2.2 item 3).\n")
print("| # | ID | end | v2 true hdg | heading source | recomputed | Δ° | designator Δ° | v2 elev ft | elev source | OurAirports ft | terrain ft | AIP PDF ft | result |")
print("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|")
okc=0
for i,a in enumerate(S,1):
    e=[e for r in a['runways'] for e in r['ends'] if e.get('true_hdg') and e['true_hdg'].get('v') is not None][0]
    h=float(e['true_hdg']['v']); src=e['true_hdg']['src']; rec=None; how=''
    oid=((a.get('match') or {}).get('ourairports') or {}).get('ident') or a['id']
    m=re.search(r'way (\d+)',src)
    if m and m.group(1) in ways:
        geo=ways[m.group(1)].get('geometry') or []
        if len(geo)>=2:
            b=brg((geo[0]['lat'],geo[0]['lon']),(geo[-1]['lat'],geo[-1]['lon'])); rec=b if dd(b,h)<90 else (b+180)%360; how='OSM way '+m.group(1)
    elif 'OurAirports' in src:
        for r in rws.get(oid,[]):
            for p in ('le','he'):
                if r.get(p+'_ident','').lstrip('0')==str(e['id']).lstrip('0') and r.get(p+'_heading_degT'): rec=float(r[p+'_heading_degT']); how='OurAirports runways.csv'
    elif 'AIP' in src:
        vs=[v for v in ((a.get('verification') or {}).get('heading') or []) if isinstance(v,dict) and v.get('end')==e['id']]
        if vs:
            o={k:v for k,v in vs[0].get('sources',{}).items() if k!='AIP published'}
            if o: k=sorted(o)[0]; rec=o[k]; how='AIP (vs '+k+')'
    decl=(a.get('mag_declination_deg') or {}).get('v') or 0
    mag=(h-decl)%360; md=re.match(r'0?(\d{1,2})',str(e['id'])); des=int(md.group(1))*10 if md else None
    dchk=round(dd(mag,des),1) if des is not None else '—'
    el=a['elevation_ft']['v']; es=a['elevation_ft']['src']
    oa=ap.get(oid,{}).get('elevation_ft') or '—'
    ter=ome.get(a['id']); ter=round(ter*3.28084) if isinstance(ter,(int,float)) else '—'
    p=pdf.get(a['id']); p=p['elev_ft'] if isinstance(p,dict) else '—'
    tol=3.0 if how.startswith('AIP') else 1.0
    hok = rec is not None and dd(rec,h)<=tol
    esn='AIP PDF' if 'SACAA' in es else 'OurAirports' if 'OurAirports' in es else 'terrain' if 'terrain' in es else es[:20]
    eok = (esn=='OurAirports' and oa!='—' and abs(float(oa)-el)<=1) or (esn=='AIP PDF' and p!='—' and abs(p-el)<=1) or (esn=='terrain' and ter!='—' and abs(ter-el)<=150)
    res='ok' if hok and eok else ('elevation CHECK' if hok else 'heading CHECK')
    okc+= hok and eok
    print(f"| {i} | {a['id']} | {e['id']} | {h:.1f} | {how or src[:30]} | {'—' if rec is None else round(rec,1)} | {'—' if rec is None else round(dd(rec,h),1)} | {dchk} | {el} | {esn} | {oa} | {ter} | {p} | {res} |")
print(f"\n**{okc}/30** match their raw sources (heading within 1° of the recomputed OSM/OurAirports value, AIP within 3° of the other sources; elevation equal to the chosen source, terrain within 150 ft of the card-point terrain because v2 samples terrain at the runway).")
