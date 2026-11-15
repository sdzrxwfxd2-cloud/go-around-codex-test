import json,collections,datetime as dt,statistics as st
def P(s): return dt.datetime.fromisoformat(s.replace('Z','+00:00'))
T=json.load(open('docs/wx-history-15nov/taf-hist.json'))
by=collections.defaultdict(list)
for x in T: by[x['icaoId']].append(x)
res={}
for s,L in sorted(by.items()):
    L=sorted(L,key=lambda x:x['issueTime'])
    iss=collections.Counter(); vstart=collections.Counter(); dl=[]; lens=collections.Counter(); amd=0; lead=[]
    for x in L:
        i=P(x['issueTime']); iss[f"{i.hour:02d}{i.minute:02d}"]+=1
        vf=dt.datetime.fromtimestamp(x['validTimeFrom'],dt.timezone.utc); vt=dt.datetime.fromtimestamp(x['validTimeTo'],dt.timezone.utc)
        vstart[f"{vf.hour:02d}"]+=1; lens[int((vt-vf).total_seconds()//3600)]+=1
        lead.append((vf-i).total_seconds()/60)
        if ' AMD ' in x['rawTAF'] or x['rawTAF'].startswith('TAF AMD'): amd+=1
        if x.get('dbPopTime'): dl.append((P(x['dbPopTime'])-i).total_seconds()/60)
    res[s]=dict(n=len(L),issue=iss.most_common(6),vstart=vstart.most_common(5),len=lens.most_common(2),amd=amd,
      dmed=round(st.median(dl),1) if dl else None,dmax=round(max(dl),1) if dl else None,leadmed=round(st.median(lead)) if lead else None,first=L[0]['issueTime'][:16])
json.dump(res,open('docs/wx-history-15nov/taf-an.json','w'),indent=1)
for s,r in res.items(): print(s,r)
