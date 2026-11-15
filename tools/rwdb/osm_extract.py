#!/usr/bin/env python3
"""Extract aeroway=runway ways (with node geometry) from a Geofabrik .osm.pbf into Overpass-like JSON.
usage: osm_extract.py south-africa-YYMMDD.osm.pbf out.json   (needs pyosmium)"""
import sys, json, osmium
class H(osmium.SimpleHandler):
    def __init__(s): super().__init__(); s.out = []
    def way(s, w):
        if w.tags.get('aeroway') != 'runway': return
        try: g = [{'lat': n.location.lat, 'lon': n.location.lon} for n in w.nodes]
        except osmium.InvalidLocationError: return
        s.out.append({'type': 'way', 'id': w.id, 'tags': {t.k: t.v for t in w.tags}, 'geometry': g})
h = H(); h.apply_file(sys.argv[1], locations=True)
json.dump({'elements': h.out}, open(sys.argv[2], 'w')); print(len(h.out), 'runway ways')
