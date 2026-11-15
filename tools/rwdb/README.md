# tools/rwdb — builds site/data/ad-runways-elev.locked.vN.json

Never rebuild into an existing locked file. A new build = new raw inputs + a new output file name (v2, v3 ...).

v1 (15 Nov 2026), reproduce byte for byte:
    python3 tools/rwdb/build.py tools/rwdb/raw . /tmp/check.json && cmp /tmp/check.json site/data/ad-runways-elev.locked.v1.json

raw/ (inputs of v1):
- airports.csv, runways.csv: OurAirports (https://davidmegginson.github.io/ourairports-data/), downloaded 2026-11-15 11:26 UTC, cut to ZA, LS, SZ, NA, BW, MZ, ZW.
- osm-geof/geofabrik-runways.json: every aeroway=runway way with geometry from Geofabrik africa/south-africa-261114.osm.pbf, via osm_extract.py (pyosmium). ODbL.
- om-elev.json: Open-Meteo elevation API (Copernicus DEM GLO-90, metres) at each card position, 2026-11-15 11:40 UTC.
- decl.json: WMM2025 declination at each card (pygeomag, epoch 2026-11-15).
- cards.json, aip-rwy.json, wmst.json: from the repo via `node tools/rwdb/prep.mjs site tools/rwdb/raw`.
- before.json: coverage on live b0496a909 (diag 15 Nov).
- retrieved.json: retrieval stamps.
