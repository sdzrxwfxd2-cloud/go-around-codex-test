#!/usr/bin/env python3
"""Fix the aerodrome elevation field in site/rwy/rwy-data.js (and its copy site/c/rwy/rwy-data.js), 15 Nov 2026 (MT 14:25 SAST).
The old extract read the word 'Remarks' (from a later AD 2 table) as 'elev' for 45 of 65 aerodromes. This replaces only those
'elev' values (and their src.elev page reference) with AD 2.2 item 3 read from the AD 2 PDF (tools/rwdb/aip_elev_pdf.py output).
No PDF on the box (FACO, FAHS): elev = null ('not published/not verifiable', as the file's meta says). Every other byte stays.
usage: fix_rwy_elev.py <site dir> <aip-elev-pdf.json>"""
import json, re, sys, os
SITE, PJ = sys.argv[1], sys.argv[2]
P = json.load(open(PJ))
for rel in ('rwy/rwy-data.js', 'c/rwy/rwy-data.js'):
    f = os.path.join(SITE, rel); s = open(f, encoding='utf-8').read(); n = 0; nul = []
    for m in list(re.finditer(r'"icao":"([A-Z]{4})","name":"[^"]*","lat":[-\d.]+,"lon":[-\d.]+,"elev":(?:"Remarks"|null)', s)):
        ic = m.group(1); p = P.get(ic)
        val = p['line'].split(' | ')[-1] if p and p.get('elev_ft') is not None else None
        if not val and m.group(0).endswith('null'): continue   # already null and no PDF value: leave
        head = m.group(0)[:m.group(0).rindex('"elev":') + len('"elev":')]
        s = s.replace(m.group(0), head + (json.dumps(val, ensure_ascii=False) if val else 'null'), 1)
        # src.elev of the same record: the first "src":{"elev":... after the record start
        i = s.index('"icao":"%s"' % ic)
        mm = re.compile(r'"src":\{"elev":(null|"(?:[^"\\]|\\.)*")').search(s, i)
        new = json.dumps('SACAA AIP %s, %s (AD 2.2 item 3)' % (p['page'], p['page_date']) if val else None)
        s = s[:mm.start()] + '"src":{"elev":' + new + s[mm.end():]
        n += 1
        if not val: nul.append(ic)
    open(f, 'w', encoding='utf-8').write(s); print(rel, n, 'fixed; null (no PDF):', nul, '; "Remarks" left:', s.count('"elev":"Remarks"'), '; null left:', len(re.findall(r'"lon":[-\d.]+,"elev":null', s)))
