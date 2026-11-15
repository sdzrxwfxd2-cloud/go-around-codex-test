import json,glob,collections,statistics as st,datetime as dt
def P(s): return dt.datetime.fromisoformat(s.replace('Z','+00:00'))
cards={r['id']:r for r in json.load(open('tools/rwdb/raw/cards.json'))}
M={}
for f in glob.glob('docs/wx-history-15nov/m-*.json'):
    try: d=json.load(open(f))
    except Exception: continue
    if d: M[d[0]['icaoId']]=d
res={}
for s,d in sorted(M.items()):
    d=sorted(d,key=lambda x:x['reportTime'])
    mins=collections.Counter(); delays=[]; spec=0; auto=0; nil=0
    hrs=set()
    for x in d:
        r=P(x['reportTime']); mins[r.minute]+=1
        if x.get('metarType')=='SPECI' or (x['rawOb'] or '').startswith('SPECI'): spec+=1
        if ' AUTO ' in (x['rawOb'] or ''): auto+=1
        if x.get('receiptTime'): delays.append((P(x['receiptTime'])-r).total_seconds()/60)
        hrs.add((r.date(),r.hour))
    t0=P(d[0]['reportTime']); t1=P(d[-1]['reportTime'])
    span=int((t1-t0).total_seconds()//3600)+1
    # hours of day UTC with reports
    hod=collections.Counter(h for _,h in hrs)
    days=len({a for a,_ in hrs})
    res[s]=dict(n=len(d),mins=mins.most_common(4),spec=spec,auto=auto,dmed=round(st.median(delays),1) if delays else None,
      d90=round(sorted(delays)[int(len(delays)*.9)],1) if delays else None,dmax=round(max(delays),1) if delays else None,
      cover=f"{len(hrs)}/{span}",hod=sorted(h for h,c in hod.items() if c>=max(1,days//2)),first=d[0]['reportTime'][:16],last=d[-1]['reportTime'][:16],oncards=s in cards)
json.dump(res,open('docs/wx-history-15nov/metar-an.json','w'),indent=1)
for s,r in res.items(): print(s,r)
