#!/usr/bin/env python3
"""v2 (15 Nov 2026): read the aerodrome reference elevation (AD 2.2 item 3) straight from the SACAA AIP AD 2 PDFs in
site/aip/<icao>/ad2-<icao>.pdf (needs poppler pdftotext). Fixes the rwy-data.js 'elev': 'Remarks' misread.
usage: aip_elev_pdf.py <site dir> <out.json>"""
import subprocess, re, json, os, sys
SITE, OUT = sys.argv[1], sys.argv[2]
out = {}
for k in sorted(os.listdir(os.path.join(SITE, 'aip'))):
    f = os.path.join(SITE, 'aip', k, 'ad2-%s.pdf' % k)
    if not os.path.exists(f): continue
    t = subprocess.run(['pdftotext', '-layout', '-f', '1', '-l', '2', f, '-'], capture_output=True, text=True).stdout.splitlines()
    page = next((re.search(r'AD 2-[A-Z]{4}-1', l).group(0) for l in t[:4] if re.search(r'AD 2-[A-Z]{4}-1', l)), None)
    date = next((re.search(r'\d{1,2} [A-Z]{3} \d{2}', l).group(0) for l in t[:5] if re.search(r'\d{1,2} [A-Z]{3} \d{2}\b', l)), None)
    hit = None
    for i, l in enumerate(t[:120]):
        if re.match(r'\s*3\s+.*(elevation|ELEV)', l, re.I) and not re.search(r'ACL|altimeter|THR', l, re.I):
            m = re.search(r'(?:elevation|ELEV)\S*\s.*?(\d[\d ,]*(?:\.\d+)?)\s*FT', l, re.I)
            if m: hit = (round(float(re.sub(r'[ ,]', '', m.group(1)))), re.sub(r'\s{2,}', ' | ', l.strip()))
            break
    out[k.upper()] = {'elev_ft': hit[0] if hit else None, 'line': hit[1] if hit else None, 'page': page, 'page_date': date,
                      'file': 'site/aip/%s/ad2-%s.pdf' % (k, k)}
json.dump(out, open(OUT, 'w'), indent=1)
print(len(out), 'PDFs,', sum(v['elev_ft'] is None for v in out.values()), 'without a value:', [k for k, v in out.items() if v['elev_ft'] is None])
