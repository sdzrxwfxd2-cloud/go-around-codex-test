#!/usr/bin/env python3
"""Fetch REAL worldwide METAR/TAF reports for the Go Around engine test.

Never invents weather. Tags the source of every report.
Polite with public archive rate limits.
Streams each station to a gzip file and deletes temporary downloads.
"""
from __future__ import annotations

import csv
import gzip
import io
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path("/workspace/global-weather-16nov")
RAW_METAR = ROOT / "raw" / "metar"
RAW_TAF = ROOT / "raw" / "taf"
SOURCES = ROOT / "sources"
SCRATCH = ROOT / "scratch"

UA = "GoAround-research/1.0 (global weather engine test dataset; https://github.com/sdzrxwfxd2-cloud/Go-Around-Cloudflare)"
IEM = "https://mesonet.agron.iastate.edu"
AVWX = "https://aviationweather.gov"
OGIMET = "https://www.ogimet.com"

# 12 months ending 16 Nov 2026. IEM end date is exclusive.
START = datetime(2025, 11, 16, tzinfo=timezone.utc)
END = datetime(2026, 11, 16, tzinfo=timezone.utc)
NOW = datetime.now(timezone.utc)

SLEEP_IEM = 0.7
SLEEP_AFOS = 0.7
SLEEP_ADDS = 0.8
SLEEP_OGIMET = 1.5

# Curated real airports: varied climates, plenty of bad weather, no South African FA**
# (those were already tested). Format: (icao, region, country, climate note)
STATIONS: list[tuple[str, str, str, str]] = [
    # Europe
    ("EGLL", "Europe", "GB", "Atlantic maritime, fog and winter rain"),
    ("EGKK", "Europe", "GB", "Atlantic maritime"),
    ("EGSS", "Europe", "GB", "Atlantic maritime, low cloud"),
    ("EGCC", "Europe", "GB", "Atlantic maritime"),
    ("EGPH", "Europe", "GB", "windy, winter"),
    ("EGPF", "Europe", "GB", "windy, rain"),
    ("EGBB", "Europe", "GB", "midland fog"),
    ("EGAA", "Europe", "GB", "Atlantic, rain"),
    ("EHAM", "Europe", "NL", "North Sea, low cloud and wind"),
    ("EHRD", "Europe", "NL", "North Sea"),
    ("EBBR", "Europe", "BE", "low countries, fog"),
    ("EDDF", "Europe", "DE", "continental, winter and thunderstorms"),
    ("EDDM", "Europe", "DE", "alpine-adjacent, winter"),
    ("EDDL", "Europe", "DE", "lowland, fog"),
    ("EDDH", "Europe", "DE", "North Sea, wind"),
    ("EDDB", "Europe", "DE", "continental, winter"),
    ("EDDK", "Europe", "DE", "lowland"),
    ("EDDS", "Europe", "DE", "southwest Germany"),
    ("LFPG", "Europe", "FR", "fog, winter low cloud"),
    ("LFPO", "Europe", "FR", "fog, winter"),
    ("LFML", "Europe", "FR", "Mediterranean, Mistral wind"),
    ("LFBO", "Europe", "FR", "southwest, thunderstorms"),
    ("LEMD", "Europe", "ES", "hot/high plateau, summer storm"),
    ("LEBL", "Europe", "ES", "Mediterranean"),
    ("LEPA", "Europe", "ES", "Mediterranean, summer heat"),
    ("LEVC", "Europe", "ES", "Mediterranean inland"),
    ("LIRF", "Europe", "IT", "Mediterranean"),
    ("LIMC", "Europe", "IT", "Po valley fog, alpine foehn"),
    ("LIPZ", "Europe", "IT", "Adriatic, bora wind"),
    ("LIRN", "Europe", "IT", "Mediterranean"),
    ("EIDW", "Europe", "IE", "Atlantic, rain and low cloud"),
    ("EINN", "Europe", "IE", "Atlantic"),
    ("EKCH", "Europe", "DK", "Baltic, winter wind"),
    ("ENGM", "Europe", "NO", "winter, snow"),
    ("ENBR", "Europe", "NO", "very wet, wind"),
    ("ENTC", "Europe", "NO", "Arctic, winter dark and icing"),
    ("ENZV", "Europe", "NO", "west coast rain"),
    ("ESSA", "Europe", "SE", "winter snow, short days"),
    ("ESGG", "Europe", "SE", "winter"),
    ("EFHK", "Europe", "FI", "winter snow, icing"),
    ("EPWA", "Europe", "PL", "continental winter"),
    ("LKPR", "Europe", "CZ", "continental winter"),
    ("LOWW", "Europe", "AT", "continental, winter fog"),
    ("LSZH", "Europe", "CH", "fog, winter inversions, alpine"),
    ("LSGG", "Europe", "CH", "fog, alpine"),
    ("LPPT", "Europe", "PT", "Atlantic"),
    ("LPPR", "Europe", "PT", "Atlantic, winter rain"),
    ("LGAV", "Europe", "GR", "Mediterranean, summer heat"),
    ("BIKF", "Europe", "IS", "North Atlantic wind, icing"),
    ("BIAR", "Europe", "IS", "North Atlantic, icing"),
    ("LROP", "Europe", "RO", "continental"),
    ("LHBP", "Europe", "HU", "continental, summer storm"),
    ("EVRA", "Europe", "LV", "Baltic winter"),
    # United States (plus Alaska and Hawaii)
    ("KJFK", "US", "US", "nor'easters, winter, summer storm"),
    ("KLGA", "US", "US", "northeast winter and wind"),
    ("KEWR", "US", "US", "northeast winter"),
    ("KBOS", "US", "US", "nor'easters, snow, coastal fog"),
    ("KPHL", "US", "US", "northeast"),
    ("KDCA", "US", "US", "east coast, summer storm"),
    ("KIAD", "US", "US", "east coast"),
    ("KATL", "US", "US", "southeast thunderstorms, summer heat"),
    ("KMIA", "US", "US", "tropical, hurricane season"),
    ("KMCO", "US", "US", "tropical, thunderstorms"),
    ("KTPA", "US", "US", "tropical, thunderstorms"),
    ("KMSY", "US", "US", "Gulf, hurricane, fog"),
    ("KIAH", "US", "US", "Gulf, heat, thunderstorms"),
    ("KDFW", "US", "US", "plains thunderstorms, ice storms"),
    ("KORD", "US", "US", "midwest winter, lake wind, storms"),
    ("KMDW", "US", "US", "midwest"),
    ("KDTW", "US", "US", "Great Lakes, winter snow"),
    ("KCLE", "US", "US", "lake-effect snow"),
    ("KBUF", "US", "US", "heavy lake-effect snow"),
    ("KMSP", "US", "US", "harsh winter"),
    ("KDEN", "US", "US", "high plains, winter, wind"),
    ("KPHX", "US", "US", "desert heat, dust, monsoon"),
    ("KLAS", "US", "US", "desert heat"),
    ("KLAX", "US", "US", "marine layer fog"),
    ("KSFO", "US", "US", "persistent fog and low cloud"),
    ("KOAK", "US", "US", "marine layer"),
    ("KSAN", "US", "US", "marine layer, coastal"),
    ("KSEA", "US", "US", "Pacific rain, low cloud"),
    ("KPDX", "US", "US", "Pacific rain"),
    ("KSLC", "US", "US", "mountain winter, inversion"),
    ("KBNA", "US", "US", "southeast storms"),
    ("KMEM", "US", "US", "Mississippi valley storms"),
    ("KOKC", "US", "US", "plains severe storms"),
    ("KOMA", "US", "US", "plains winter and storms"),
    ("KMCI", "US", "US", "plains storms"),
    ("KSTL", "US", "US", "midwest storms, winter"),
    ("KCLT", "US", "US", "southeast"),
    ("KRDU", "US", "US", "southeast"),
    ("PANC", "US", "US", "Alaska, winter, icing"),
    ("PAFA", "US", "US", "Alaska interior, deep winter"),
    ("PAJN", "US", "US", "southeast Alaska, rain and mountain"),
    ("PHNL", "US", "US", "tropical Pacific, trade winds"),
    ("PHOG", "US", "US", "tropical, trade-wind showers"),
    # Canada
    ("CYYZ", "Canada", "CA", "Great Lakes winter"),
    ("CYVR", "Canada", "CA", "Pacific rain, low cloud"),
    ("CYYC", "Canada", "CA", "prairie winter, chinook wind"),
    ("CYUL", "Canada", "CA", "harsh winter, freezing rain"),
    ("CYHZ", "Canada", "CA", "Atlantic, fog, winter"),
    ("CYWG", "Canada", "CA", "prairie winter"),
    ("CYFB", "Canada", "CA", "Arctic"),
    ("CYOW", "Canada", "CA", "winter"),
    # Caribbean / Mexico / Central America
    ("TJSJ", "Caribbean", "PR", "tropical, hurricane"),
    ("TIST", "Caribbean", "VI", "tropical"),
    ("MKJP", "Caribbean", "JM", "tropical"),
    ("MDSD", "Caribbean", "DO", "tropical"),
    ("TNCM", "Caribbean", "SX", "tropical, hurricane"),
    ("MMMX", "North America", "MX", "high-elevation basin"),
    ("MMUN", "North America", "MX", "tropical Caribbean"),
    ("MMGL", "North America", "MX", "highland"),
    # Australia / New Zealand
    ("YSSY", "Australia", "AU", "east coast, east-coast lows"),
    ("YMML", "Australia", "AU", "cool-season fog and low cloud"),
    ("YBBN", "Australia", "AU", "subtropical, thunderstorms"),
    ("YPPH", "Australia", "AU", "dry summer, winter fronts"),
    ("YPAD", "Australia", "AU", "southern fronts"),
    ("YBCS", "Australia", "AU", "tropical, monsoon, cyclone"),
    ("YBTL", "Australia", "AU", "tropical, monsoon"),
    ("YWLM", "Australia", "AU", "east coast wind"),
    ("YPDN", "Australia", "AU", "tropical monsoon"),
    ("NZAA", "New Zealand", "NZ", "maritime, wind"),
    ("NZWN", "New Zealand", "NZ", "very windy"),
    ("NZCH", "New Zealand", "NZ", "southern fronts, wind"),
    ("NZQN", "New Zealand", "NZ", "mountain, wind"),
    # Asia / Middle East
    ("RJTT", "Asia", "JP", "winter wind, summer rain, typhoon"),
    ("RJAA", "Asia", "JP", "typhoon, winter"),
    ("RJBB", "Asia", "JP", "typhoon, rain"),
    ("RJCC", "Asia", "JP", "Hokkaido winter snow"),
    ("RJFF", "Asia", "JP", "typhoon"),
    ("VHHH", "Asia", "HK", "typhoon, summer rain"),
    ("VMMC", "Asia", "MO", "typhoon"),
    ("WSSS", "Asia", "SG", "equatorial thunderstorms"),
    ("WMKK", "Asia", "MY", "equatorial, monsoon"),
    ("VTBS", "Asia", "TH", "monsoon, thunderstorms"),
    ("VTSP", "Asia", "TH", "monsoon"),
    ("VIDP", "Asia", "IN", "fog in winter, monsoon, heat"),
    ("VABB", "Asia", "IN", "monsoon, heavy rain"),
    ("VOMM", "Asia", "IN", "monsoon, cyclone"),
    ("VOBL", "Asia", "IN", "monsoon"),
    ("RPLL", "Asia", "PH", "typhoon, tropical"),
    ("RCTP", "Asia", "TW", "typhoon"),
    ("RKSI", "Asia", "KR", "winter, summer rain"),
    ("RKSS", "Asia", "KR", "winter"),
    ("RKPC", "Asia", "KR", "island, wind"),
    ("ZBAA", "Asia", "CN", "winter, haze, summer storm"),
    ("ZSPD", "Asia", "CN", "east China, summer rain"),
    ("ZGGG", "Asia", "CN", "subtropical rain"),
    ("ZUUU", "Asia", "CN", "basin fog"),
    ("OMDB", "Asia", "AE", "desert heat, dust, winter shamal"),
    ("OMAA", "Asia", "AE", "desert, dust"),
    ("OTBD", "Asia", "QA", "desert, dust"),
    ("OKBK", "Asia", "KW", "desert, dust, heat"),
    ("OERK", "Asia", "SA", "desert heat, dust"),
    ("OTHH", "Asia", "QA", "desert"),
    ("OPKC", "Asia", "PK", "monsoon, heat, dust"),
    ("VGHS", "Asia", "BD", "monsoon, cyclone"),
    ("VYYY", "Asia", "MM", "monsoon"),
    ("WIII", "Asia", "ID", "equatorial thunderstorms"),
    ("WADD", "Asia", "ID", "equatorial, wet"),
    ("VCBI", "Asia", "LK", "monsoon"),
    ("VRMM", "Asia", "MV", "equatorial, monsoon"),
    ("OBBI", "Asia", "BH", "desert, dust"),
    ("OMSJ", "Asia", "AE", "desert"),
    # Africa (not South Africa FA**)
    ("HECA", "Africa", "EG", "desert, dust, heat, winter fog"),
    ("HELX", "Africa", "EG", "desert, dust"),
    ("DNMM", "Africa", "NG", "West Africa, wet season, harmattan dust"),
    ("DNAA", "Africa", "NG", "harmattan, wet season"),
    ("HKJK", "Africa", "KE", "highland, equatorial"),
    ("HTDA", "Africa", "TZ", "coastal tropical"),
    ("HUEN", "Africa", "UG", "equatorial highland"),
    ("HSSS", "Africa", "SD", "dust, heat"),
    ("HAAB", "Africa", "ET", "highland"),
    ("GMMN", "Africa", "MA", "Atlantic, winter, Atlas wind"),
    ("GMAD", "Africa", "MA", "desert-adjacent"),
    ("GMFO", "Africa", "MA", "Atlas"),
    ("DTTA", "Africa", "TN", "Mediterranean, winter"),
    ("DTTJ", "Africa", "TN", "Mediterranean"),
    ("FIMP", "Africa", "MU", "tropical, cyclone"),
    ("FQMA", "Africa", "MZ", "tropical, cyclone"),
    ("FYWH", "Africa", "NA", "dry, wind, highland"),
    ("FBSK", "Africa", "BW", "dry, summer storm"),
    ("DGAA", "Africa", "GH", "West Africa wet season"),
    ("DFFD", "Africa", "BF", "Sahel, dust, wet season"),
    ("FZAA", "Africa", "CD", "equatorial, wet"),
    ("GOBD", "Africa", "SN", "Sahel, harmattan, wet season"),
    ("HLLT", "Africa", "LY", "desert, dust"),
    ("DXXX", "Africa", "TG", "West Africa wet season"),
    ("DBBB", "Africa", "BJ", "West Africa"),
    # South America
    ("SBGR", "South America", "BR", "subtropical, thunderstorms, fog"),
    ("SBGL", "South America", "BR", "coastal, rain, fog"),
    ("SBBR", "South America", "BR", "highland, dry/wet seasons"),
    ("SBRF", "South America", "BR", "tropical coast"),
    ("SBCT", "South America", "BR", "south, fog and rain"),
    ("SBPA", "South America", "BR", "south, fronts"),
    ("SBEG", "South America", "BR", "Amazon, heavy rain"),
    ("SBKP", "South America", "BR", "thunderstorms, fog"),
    ("SAEZ", "South America", "AR", "pampero wind, winter, fog"),
    ("SABE", "South America", "AR", "pampero, fog"),
    ("SCEL", "South America", "CL", "Andean, winter, wind, fog"),
    ("SCFA", "South America", "CL", "desert coast, high"),
    ("SKBO", "South America", "CO", "high-elevation, rain"),
    ("SKCG", "South America", "CO", "Caribbean coast"),
    ("SPJC", "South America", "PE", "coastal fog (garúa)"),
    ("SPZO", "South America", "PE", "very high elevation (Cuzco)"),
    ("SVMI", "South America", "VE", "tropical"),
    ("SGAS", "South America", "PY", "subtropical storms"),
    ("SUMU", "South America", "UY", "south, fronts, fog"),
    ("SLVR", "South America", "BO", "highland"),
    ("SLLP", "South America", "BO", "very high elevation (La Paz / El Alto)"),
    ("SEQU", "South America", "EC", "highland, equatorial"),
    ("SBFI", "South America", "BR", "south, storms"),
]

ST_BY_ICAO = {s[0]: s for s in STATIONS}


def log(msg: str) -> None:
    line = f"{datetime.now(timezone.utc).strftime('%H:%M:%S')}Z {msg}"
    print(line, flush=True)
    SOURCES.mkdir(parents=True, exist_ok=True)
    with open(SOURCES / "fetch-log.txt", "a", encoding="utf-8") as f:
        f.write(line + "\n")


def ensure_dirs() -> None:
    for p in (RAW_METAR, RAW_TAF, SOURCES, SCRATCH):
        p.mkdir(parents=True, exist_ok=True)


def http_get(url: str, timeout: int = 180, retries: int = 4, extra_headers: dict | None = None) -> bytes:
    headers = {"User-Agent": UA, "Accept": "*/*"}
    if extra_headers:
        headers.update(extra_headers)
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read()
        except urllib.error.HTTPError as e:
            last_err = e
            # 4xx (except 408/429) will not succeed on retry
            if 400 <= e.code < 500 and e.code not in (408, 429):
                body = b""
                try:
                    body = e.read()[:300]
                except Exception:
                    pass
                raise RuntimeError(f"HTTP {e.code} for {url}: {body.decode('utf-8','replace')}") from e
            wait = min(2 ** attempt, 16)
            log(f"  retry {attempt+1}/{retries} after HTTP {e.code}: {e} (sleep {wait}s) url={url[:160]}")
            time.sleep(wait)
        except Exception as e:
            last_err = e
            wait = min(2 ** attempt, 16)
            log(f"  retry {attempt+1}/{retries} after {type(e).__name__}: {e} (sleep {wait}s) url={url[:160]}")
            time.sleep(wait)
    raise RuntimeError(f"GET failed: {url}") from last_err


def norm_raw(raw: str) -> str:
    s = (raw or "").strip()
    s = s.replace("\r", " ").replace("\n", " ")
    s = re.sub(r"\s+", " ", s).strip()
    if s.endswith("="):
        s = s[:-1].strip()
    return s


def ensure_metar_prefix(raw: str) -> str:
    s = norm_raw(raw)
    if not s:
        return s
    if re.match(r"^(METAR|SPECI)\b", s, re.I):
        return re.sub(r"^(METAR|SPECI)\b", lambda m: m.group(1).upper(), s, count=1, flags=re.I)
    return "METAR " + s


def ensure_taf_prefix(raw: str) -> str:
    s = norm_raw(raw)
    if not s:
        return s
    if re.match(r"^TAF\b", s, re.I):
        return re.sub(r"^TAF\b", "TAF", s, count=1, flags=re.I)
    return "TAF " + s


def icao_of(raw: str, fallback: str = "") -> str:
    m = re.search(r"\b(METAR|SPECI|TAF(?:\s+(?:AMD|COR))?)\s+([A-Z]{4})\b", raw)
    if m:
        return m.group(2)
    m = re.match(r"^(?:METAR\s+)?(?:COR\s+)?([A-Z]{4})\s+\d{6}Z\b", raw)
    if m:
        return m.group(1)
    m = re.search(r"\b([A-Z]{4})\s+\d{6}Z\b", raw)
    if m:
        return m.group(1)
    return fallback


def parse_iso(s: str) -> str | None:
    if not s:
        return None
    s = str(s).strip().replace(" ", "T")
    if re.match(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$", s):
        s += ":00"
    try:
        if s.endswith("Z"):
            dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        elif "+" in s[10:] or s.endswith("00.000"):
            dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        else:
            dt = datetime.fromisoformat(s).replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    except Exception:
        if re.match(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}", s):
            return s if s.endswith("Z") else s + "Z"
        return None


def kind_of_metar(raw: str) -> str:
    return "speci" if raw.startswith("SPECI ") else "metar"


def ddhhmm_to_iso(ddhhmm: str, around: datetime) -> str | None:
    if not re.match(r"^\d{6}$", ddhhmm or ""):
        return None
    day, hh, mm = int(ddhhmm[0:2]), int(ddhhmm[2:4]), int(ddhhmm[4:6])
    if not (1 <= day <= 31 and 0 <= hh <= 23 and 0 <= mm <= 59):
        return None
    d = around.replace(day=min(day, 28), hour=hh, minute=mm, second=0, microsecond=0)
    # set day properly, with month wrap
    try:
        d = around.replace(day=day, hour=hh, minute=mm, second=0, microsecond=0)
    except ValueError:
        # day not in this month — step back a month and try
        y, m = (around.year, around.month - 1) if around.month > 1 else (around.year - 1, 12)
        try:
            d = around.replace(year=y, month=m, day=day, hour=hh, minute=mm, second=0, microsecond=0)
        except ValueError:
            return None
    if d.day != day:
        return None
    if d - around > timedelta(days=20):
        y, m = (d.year, d.month - 1) if d.month > 1 else (d.year - 1, 12)
        try:
            d = d.replace(year=y, month=m)
        except ValueError:
            pass
    if around - d > timedelta(days=20):
        y, m = (d.year, d.month + 1) if d.month < 12 else (d.year + 1, 1)
        try:
            d = d.replace(year=y, month=m)
        except ValueError:
            pass
    return d.strftime("%Y-%m-%dT%H:%M:%SZ")


# ---------- per-station store (disk) ----------

def load_station_file(kind: str, icao: str) -> dict[str, dict]:
    path = (RAW_METAR if kind != "taf" else RAW_TAF) / f"{icao}.txt.gz"
    out: dict[str, dict] = {}
    if not path.exists():
        return out
    with gzip.open(path, "rt", encoding="utf-8") as f:
        for line in f:
            if not line.strip() or line.startswith("#"):
                continue
            parts = line.rstrip("\n").split("\t")
            if len(parts) < 3:
                continue
            time_iso, k, raw = parts[0], parts[1], parts[2]
            sources = parts[3].split(",") if len(parts) > 3 and parts[3] else []
            key = raw
            prev = out.get(key)
            if prev:
                for s in sources:
                    if s and s not in prev["sources"]:
                        prev["sources"].append(s)
                if time_iso and (not prev["time"] or time_iso < prev["time"]):
                    prev["time"] = time_iso
            else:
                out[key] = {"time": time_iso or None, "kind": k, "raw": raw, "sources": [s for s in sources if s]}
    return out


def write_station_file(kind: str, icao: str, recs: dict[str, dict]) -> int:
    path = (RAW_METAR if kind != "taf" else RAW_TAF) / f"{icao}.txt.gz"
    items = list(recs.values())
    items.sort(key=lambda r: (r.get("time") or "9999", r.get("raw") or ""))
    tmp = path.with_suffix(path.suffix + ".tmp")
    with gzip.open(tmp, "wt", encoding="utf-8") as f:
        for r in items:
            f.write(f"{r.get('time') or ''}\t{r['kind']}\t{r['raw']}\t{','.join(r.get('sources') or [])}\n")
    tmp.replace(path)
    return len(items)


def add_to(store: dict[str, dict], kind: str, raw: str, time_iso: str | None, source: str) -> bool:
    if kind == "taf":
        raw = ensure_taf_prefix(raw)
    else:
        raw = ensure_metar_prefix(raw)
        kind = kind_of_metar(raw)
    if not raw or raw in ("METAR", "SPECI", "TAF", "TAF AMD", "TAF COR"):
        return False
    rec = store.get(raw)
    if rec:
        if source not in rec["sources"]:
            rec["sources"].append(source)
        if time_iso and (not rec["time"] or time_iso < rec["time"]):
            rec["time"] = time_iso
        return False
    store[raw] = {"time": time_iso, "kind": kind if kind != "metar" else kind_of_metar(raw), "raw": raw, "sources": [source]}
    return True


# ---------- metadata ----------

def fetch_stationinfo() -> dict:
    fetched_at = NOW.strftime("%Y-%m-%dT%H:%M:%SZ")
    icaos = [s[0] for s in STATIONS]
    info = {"fetched_at": fetched_at, "url": f"{AVWX}/api/data/stationinfo", "stations": {}}
    for i in range(0, len(icaos), 20):
        batch = icaos[i:i + 20]
        url = f"{AVWX}/api/data/stationinfo?" + urllib.parse.urlencode({"ids": ",".join(batch), "format": "json"})
        log(f"stationinfo {batch[0]}..{batch[-1]} ({len(batch)})")
        try:
            data = http_get(url, timeout=60)
            rows = json.loads(data.decode("utf-8", "replace"))
            if isinstance(rows, dict):
                rows = rows.get("data") or rows.get("stations") or [rows]
            for row in rows or []:
                if not isinstance(row, dict):
                    continue
                icao = (row.get("icaoId") or row.get("id") or "").upper()
                if not icao:
                    continue
                info["stations"][icao] = {
                    "icao": icao,
                    "name": row.get("site") or row.get("name"),
                    "lat": row.get("lat"),
                    "lon": row.get("lon"),
                    "elev_m": row.get("elev"),
                    "elev_ft": (round(float(row["elev"]) * 3.28084) if row.get("elev") is not None else None),
                    "country": row.get("country"),
                    "state": row.get("state"),
                    "iata": row.get("iataId"),
                    "wmo": row.get("wmoId"),
                    "siteType": row.get("siteType"),
                    "source": "aviationweather.gov/stationinfo",
                }
        except Exception as e:
            log(f"  stationinfo fail: {e}")
        time.sleep(0.4)
    (SOURCES / "station-lists.json").write_text(json.dumps(info, indent=2) + "\n", encoding="utf-8")
    log(f"  metadata for {len(info['stations'])} stations")
    return info


# ---------- IEM METARs ----------

def fetch_iem_metars(already_ok: set[str] | None = None) -> dict:
    already_ok = already_ok or set()
    fetched_at = NOW.strftime("%Y-%m-%dT%H:%M:%SZ")
    info: dict = {"fetched_at": fetched_at, "stations": [], "new": 0, "rows": 0, "failed": []}
    for icao, region, country, note in STATIONS:
        dest = RAW_METAR / f"{icao}.txt.gz"
        if icao in already_ok and dest.exists() and dest.stat().st_size > 50:
            # still count existing
            n = sum(1 for _ in gzip.open(dest, "rt", encoding="utf-8"))
            info["stations"].append({"icao": icao, "skipped": "already fetched", "existing": n})
            log(f"IEM METAR {icao} skip (already have {n})")
            continue
        params = {
            "station": icao,
            "data": "metar",
            "year1": str(START.year),
            "month1": str(START.month),
            "day1": str(START.day),
            "year2": str(END.year),
            "month2": str(END.month),
            "day2": str(END.day),
            "tz": "UTC",
            "format": "onlycomma",
            "latlon": "no",
            "elev": "no",
            "missing": "empty",
            "trace": "empty",
            "direct": "no",
            "report_type": "3",
        }
        qs = urllib.parse.urlencode(params)
        url = f"{IEM}/cgi-bin/request/asos.py?{qs}&report_type=4"
        log(f"IEM METAR {icao} {region}/{country}")
        store = load_station_file("metar", icao)
        before = len(store)
        rows = 0
        new = 0
        try:
            data = http_get(url, timeout=180)
        except Exception as e:
            log(f"  FAIL {icao}: {e}")
            info["failed"].append({"icao": icao, "error": str(e)})
            time.sleep(SLEEP_IEM)
            continue
        text = data.decode("utf-8", "replace")
        # Don't keep the CSV on disk.
        if "station,valid,metar" not in text.splitlines()[0] if text.strip() else True:
            head = text[:200].replace("\n", " ")
            if "ERROR" in text[:400] or "does not exist" in text.lower() or len(text) < 40:
                log(f"  no data or error for {icao}: {head!r}")
                info["failed"].append({"icao": icao, "error": head, "bytes": len(data)})
                time.sleep(SLEEP_IEM)
                continue
        rdr = csv.DictReader(io.StringIO(text))
        if not rdr.fieldnames or "metar" not in (rdr.fieldnames or []):
            log(f"  unexpected header for {icao}: {text[:200]!r}")
            info["failed"].append({"icao": icao, "error": "bad header", "bytes": len(data)})
            time.sleep(SLEEP_IEM)
            continue
        for row in rdr:
            raw = (row.get("metar") or "").strip()
            if not raw:
                continue
            t = parse_iso(row.get("valid") or "")
            sid = icao_of(ensure_metar_prefix(raw), icao)
            if sid != icao:
                # Keep it under the requested station file only if it's the same airport
                # (US IEM uses ORD in the station column but KORD in the raw text).
                if sid != icao and sid.lstrip("K") != icao.lstrip("K"):
                    # unexpected other station in this dump — still keep if icao matches request
                    pass
            rows += 1
            if add_to(store, "metar", raw, t, f"iem-asos:{icao}"):
                new += 1
        write_station_file("metar", icao, store)
        info["stations"].append({
            "icao": icao, "bytes": len(data), "rows": rows, "new": new,
            "total": len(store), "region": region, "country": country,
        })
        info["new"] += new
        info["rows"] += rows
        log(f"  rows={rows} new={new} total={len(store)} (had {before})")
        time.sleep(SLEEP_IEM)
    return info


# ---------- IEM AFOS US TAFs (full raw text, 12 months) ----------

def parse_afos_tafs(blob: bytes, around_end: datetime) -> list[tuple[str, str, str]]:
    """Return list of (icao, time_iso, raw_taf) from an AFOS text dump (newest first)."""
    text = blob.decode("utf-8", "replace")
    chunks = re.split(r"\x01", text)
    out = []
    cursor = around_end
    for chunk in chunks:
        chunk = chunk.strip("\n\r \x03")
        if not chunk:
            continue
        # Find TAF / TAF AMD / TAF COR start
        m = re.search(r"(?m)^(TAF(?:\s+AMD|\s+COR)?)\s*$", chunk)
        if not m:
            # sometimes TAF and station are on one line
            m2 = re.search(r"(?m)^(TAF(?:\s+AMD|\s+COR)?)\s+([A-Z]{4}\s+\d{6}Z\b.*)", chunk, re.S)
            if not m2:
                continue
            body = (m2.group(1) + " " + m2.group(2)).strip()
        else:
            body = chunk[m.start():].strip()
        body = ensure_taf_prefix(body)
        icao = icao_of(body, "")
        if not re.match(r"^[A-Z]{4}$", icao or ""):
            continue
        tm = re.search(r"\b" + icao + r"\s+(\d{6})Z\b", body)
        iso = None
        if tm:
            iso = ddhhmm_to_iso(tm.group(1), cursor)
            if iso:
                cursor = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        out.append((icao, iso or "", body))
    return out


def us_pil(icao: str) -> str | None:
    # NWS AFOS PILs are 3-6 chars; TAF products are TAF + 3-letter id.
    if icao.startswith("K") and len(icao) == 4:
        return "TAF" + icao[1:]
    if icao.startswith(("P", "T", "PH", "PA")) and len(icao) == 4:
        return "TAF" + icao[1:]
    return None


def fetch_afos_us_tafs() -> dict:
    fetched_at = NOW.strftime("%Y-%m-%dT%H:%M:%SZ")
    info: dict = {"fetched_at": fetched_at, "stations": [], "new": 0, "failed": []}
    us_icaos = [s[0] for s in STATIONS if s[0].startswith(("K", "PA", "PH", "TJ", "TI"))]
    for icao in us_icaos:
        pil = us_pil(icao)
        if not pil or len(pil) > 6:
            # PAJN -> TAFJN (6), PHNL -> TAFHNL is 7 — invalid. Try last 3.
            pil = "TAF" + icao[-3:]
        if len(pil) != 6:
            info["failed"].append({"icao": icao, "error": f"cannot form 6-char PIL from {icao}"})
            continue
        url = (
            f"{IEM}/cgi-bin/afos/retrieve.py?"
            + urllib.parse.urlencode({
                "pil": pil,
                "sdate": START.strftime("%Y-%m-%dT00:00Z"),
                "edate": END.strftime("%Y-%m-%dT00:00Z"),
                "fmt": "text",
                "limit": "9999",
            })
        )
        log(f"AFOS TAF {icao} pil={pil}")
        try:
            data = http_get(url, timeout=180)
        except Exception as e:
            log(f"  FAIL {icao}: {e}")
            info["failed"].append({"icao": icao, "error": str(e)})
            time.sleep(SLEEP_AFOS)
            continue
        text_head = data[:200].decode("utf-8", "replace")
        if data.startswith(b"ERROR") or b"Could not Find" in data[:200] or b"Invalid PIL" in data[:300]:
            log(f"  no AFOS product {pil}: {text_head!r}")
            info["failed"].append({"icao": icao, "pil": pil, "error": text_head.strip()})
            time.sleep(SLEEP_AFOS)
            continue
        recs = parse_afos_tafs(data, END)
        store = load_station_file("taf", icao)
        new = 0
        for sid, iso, raw in recs:
            if sid != icao and sid != icao:
                # Keep if it's this airport (should be)
                if sid != icao:
                    continue
            if add_to(store, "taf", raw, iso or None, f"iem-afos:{pil}"):
                new += 1
        write_station_file("taf", icao, store)
        info["stations"].append({"icao": icao, "pil": pil, "parsed": len(recs), "new": new, "total": len(store), "bytes": len(data)})
        info["new"] += new
        log(f"  parsed={len(recs)} new={new} total={len(store)}")
        time.sleep(SLEEP_AFOS)
    return info


# ---------- aviationweather.gov dataserver (METARs + TAFs, ~30 days) ----------

def fetch_adds(kind: str) -> dict:
    """kind is 'metars' or 'tafs'."""
    fetched_at = NOW.strftime("%Y-%m-%dT%H:%M:%SZ")
    icaos = [s[0] for s in STATIONS]
    info: dict = {"fetched_at": fetched_at, "kind": kind, "batches": [], "new": 0, "rows": 0, "failed": []}
    elem = "METAR" if kind == "metars" else "TAF"
    t0 = END - timedelta(days=30)
    # Split METARs into 8-day windows to stay under row caps; TAFs one 30-day window.
    if kind == "metars":
        windows = []
        w = t0
        step = timedelta(days=8)
        while w < END:
            windows.append((w, min(w + step, END)))
            w += step
    else:
        windows = [(t0, END)]
    batches = [icaos[i:i + 8] for i in range(0, len(icaos), 8)]
    for batch in batches:
        for a, b in windows:
            params = {
                "dataSource": kind,
                "requestType": "retrieve",
                "format": "xml",
                "stationString": ",".join(batch),
                "startTime": a.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "endTime": b.strftime("%Y-%m-%dT%H:%M:%SZ"),
            }
            url = f"{AVWX}/api/data/dataserver?" + urllib.parse.urlencode(params)
            label = f"{kind} {batch[0]}..{batch[-1]} {a.date()}_{b.date()}"
            log(f"ADDS {label}")
            try:
                data = http_get(url, timeout=120)
            except Exception as e:
                log(f"  fail: {e}")
                info["failed"].append({"batch": batch, "error": str(e), "window": [str(a.date()), str(b.date())]})
                time.sleep(SLEEP_ADDS)
                continue
            try:
                root = ET.fromstring(data)
            except Exception as e:
                log(f"  xml parse fail ({e}): {data[:180]!r}")
                info["failed"].append({"batch": batch, "error": f"xml: {e}"})
                time.sleep(SLEEP_ADDS)
                continue
            by: dict[str, dict[str, dict]] = defaultdict(dict)
            rows = 0
            new = 0
            for node in root.iter(elem):
                raw = (node.findtext("raw_text") or "").strip()
                if not raw:
                    continue
                sid = (node.findtext("station_id") or icao_of(raw, "")).upper()
                if kind == "metars":
                    t = parse_iso(node.findtext("observation_time") or "")
                    k = "metar"
                else:
                    t = parse_iso(node.findtext("issue_time") or node.findtext("bulletin_time") or "")
                    k = "taf"
                if not re.match(r"^[A-Z]{4}$", sid or ""):
                    continue
                if sid not in by:
                    by[sid] = load_station_file(k, sid)
                rows += 1
                if add_to(by[sid], k, raw, t, "aviationweather.gov/dataserver"):
                    new += 1
            for sid, store in by.items():
                write_station_file("taf" if kind == "tafs" else "metar", sid, store)
            info["batches"].append({"batch": batch, "start": str(a.date()), "end": str(b.date()), "rows": rows, "new": new, "bytes": len(data)})
            info["new"] += new
            info["rows"] += rows
            log(f"  rows={rows} new={new}")
            time.sleep(SLEEP_ADDS)
    return info


# ---------- aviationweather.gov cache (current worldwide snapshot) ----------

def fetch_cache(kind: str, only_selected: bool = False) -> dict:
    """kind is 'metars' or 'tafs'. Optionally keep only the curated stations."""
    fetched_at = NOW.strftime("%Y-%m-%dT%H:%M:%SZ")
    filename = "metars.cache.xml.gz" if kind == "metars" else "tafs.cache.xml.gz"
    url = f"{AVWX}/data/cache/{filename}"
    log(f"CACHE {url}")
    info: dict = {"fetched_at": fetched_at, "url": url, "new": 0, "rows": 0, "stations": 0}
    try:
        data = http_get(url, timeout=120)
    except Exception as e:
        log(f"  cache fail: {e}")
        info["error"] = str(e)
        return info
    try:
        raw_xml = gzip.decompress(data) if data[:2] == b"\x1f\x8b" else data
        root = ET.fromstring(raw_xml)
    except Exception as e:
        log(f"  cache parse fail: {e}")
        info["error"] = str(e)
        return info
    elem = "METAR" if kind == "metars" else "TAF"
    selected = {s[0] for s in STATIONS}
    by: dict[str, dict[str, dict]] = {}
    for node in root.iter(elem):
        raw = (node.findtext("raw_text") or "").strip()
        if not raw:
            continue
        sid = (node.findtext("station_id") or icao_of(raw, "")).upper()
        if not re.match(r"^[A-Z]{4}$", sid or ""):
            continue
        if only_selected and sid not in selected:
            continue
        # For cache, keep worldwide TAFs/METARs only for selected stations to stay on budget.
        # (A full worldwide cache is one snapshot — useful but not a year of history.)
        if sid not in selected:
            continue
        if kind == "metars":
            t = parse_iso(node.findtext("observation_time") or "")
            k = "metar"
        else:
            t = parse_iso(node.findtext("issue_time") or node.findtext("bulletin_time") or "")
            k = "taf"
        if sid not in by:
            by[sid] = load_station_file(k, sid)
        info["rows"] += 1
        if add_to(by[sid], k, raw, t, "aviationweather.gov/cache"):
            info["new"] += 1
    for sid, store in by.items():
        write_station_file("taf" if kind == "tafs" else "metar", sid, store)
    info["stations"] = len(by)
    info["bytes"] = len(data)
    log(f"  cache {kind}: rows={info['rows']} new={info['new']} stations={info['stations']}")
    return info


# ---------- Ogimet (recent complement only; older windows often empty) ----------

def fetch_ogimet_recent() -> dict:
    fetched_at = NOW.strftime("%Y-%m-%dT%H:%M:%SZ")
    info: dict = {"fetched_at": fetched_at, "stations": [], "new_metar": 0, "new_taf": 0, "note": "Ogimet often only returns ~36 hours; older windows may be empty."}
    # A sample of stations across regions, last 36 hours, fmt=txt
    sample = [
        "EGLL", "EHAM", "EDDF", "LFPG", "KJFK", "KORD", "KSFO", "PANC",
        "YSSY", "NZAA", "RJTT", "VHHH", "WSSS", "VIDP", "OMDB",
        "HECA", "HKJK", "DNMM", "SBGR", "SCEL", "SPZO", "CYYZ",
    ]
    end = NOW
    start = NOW - timedelta(hours=36)
    for icao in sample:
        params = {
            "lugar": icao,
            "tipo": "ALL",
            "ord": "DIR",
            "nil": "SI",
            "fmt": "txt",
            "ano": str(start.year),
            "mes": str(start.month),
            "day": str(start.day),
            "hora": str(start.hour).zfill(2),
            "anof": str(end.year),
            "mesf": str(end.month),
            "dayf": str(end.day),
            "horaf": str(end.hour).zfill(2),
        }
        url = f"{OGIMET}/display_metars2.php?" + urllib.parse.urlencode(params)
        log(f"Ogimet {icao} last ~36h")
        try:
            data = http_get(url, timeout=60)
        except Exception as e:
            log(f"  fail: {e}")
            info["stations"].append({"icao": icao, "error": str(e)})
            time.sleep(SLEEP_OGIMET)
            continue
        text = data.decode("utf-8", "replace")
        # Ogimet txt: lines like "202611151720 METAR EGLL 151720Z ..." or "TAF EGLL ..."
        m_store = load_station_file("metar", icao)
        t_store = load_station_file("taf", icao)
        new_m = new_t = 0
        for line in text.splitlines():
            line = line.strip()
            if not line or line.startswith("#") or line.startswith("<") or line.startswith("Ogimet"):
                continue
            # leading timestamp?
            tm = re.match(r"^(\d{12})\s+(.*)$", line)
            rest = line
            iso = None
            if tm:
                ys = tm.group(1)
                try:
                    iso = datetime.strptime(ys, "%Y%m%d%H%M").replace(tzinfo=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
                except Exception:
                    iso = None
                rest = tm.group(2).strip()
            if re.search(r"\bTAF\b", rest[:12]) or rest.startswith("TAF"):
                if add_to(t_store, "taf", rest, iso, "ogimet:display_metars2"):
                    new_t += 1
            elif re.search(r"\b(METAR|SPECI)\b", rest[:14]) or re.match(r"^[A-Z]{4}\s+\d{6}Z\b", rest):
                if add_to(m_store, "metar", rest, iso, "ogimet:display_metars2"):
                    new_m += 1
        write_station_file("metar", icao, m_store)
        write_station_file("taf", icao, t_store)
        info["stations"].append({"icao": icao, "new_metar": new_m, "new_taf": new_t, "bytes": len(data)})
        info["new_metar"] += new_m
        info["new_taf"] += new_t
        log(f"  new METAR={new_m} TAF={new_t}")
        time.sleep(SLEEP_OGIMET)
    return info


# ---------- manifest ----------

def build_manifest(fetch_info: dict) -> dict:
    metar_files = sorted(RAW_METAR.glob("*.txt.gz"))
    taf_files = sorted(RAW_TAF.glob("*.txt.gz"))
    stations = {}
    meta = {}
    sp = SOURCES / "station-lists.json"
    if sp.exists():
        try:
            meta = json.loads(sp.read_text())["stations"]
        except Exception:
            meta = {}

    def scan(path: Path, kind: str) -> dict:
        n = 0
        sources: set[str] = set()
        tmin = tmax = None
        with gzip.open(path, "rt", encoding="utf-8") as f:
            for line in f:
                if not line.strip() or line.startswith("#"):
                    continue
                parts = line.rstrip("\n").split("\t")
                if len(parts) < 3:
                    continue
                n += 1
                t, src = parts[0], (parts[3] if len(parts) > 3 else "")
                for s in src.split(","):
                    if s:
                        sources.add(s)
                if t:
                    if tmin is None or t < tmin:
                        tmin = t
                    if tmax is None or t > tmax:
                        tmax = t
        return {"count": n, "tmin": tmin, "tmax": tmax, "sources": sorted(sources), "bytes": path.stat().st_size}

    total_m = total_t = 0
    countries = set()
    regions = set()
    for icao, region, country, note in STATIONS:
        rec = {
            "icao": icao,
            "region": region,
            "country": country,
            "climate": note,
            "meta": meta.get(icao),
            "metar": None,
            "taf": None,
        }
        mp = RAW_METAR / f"{icao}.txt.gz"
        tp = RAW_TAF / f"{icao}.txt.gz"
        if mp.exists():
            rec["metar"] = scan(mp, "metar")
            total_m += rec["metar"]["count"]
        if tp.exists():
            rec["taf"] = scan(tp, "taf")
            total_t += rec["taf"]["count"]
        countries.add(country)
        regions.add(region)
        stations[icao] = rec

    # any extra files not in the curated list
    extras = []
    for p in metar_files:
        icao = p.name.replace(".txt.gz", "")
        if icao not in stations:
            extras.append({"icao": icao, "kind": "metar", **scan(p, "metar")})
            total_m += extras[-1]["count"]
    for p in taf_files:
        icao = p.name.replace(".txt.gz", "")
        if icao not in stations:
            extras.append({"icao": icao, "kind": "taf", **scan(p, "taf")})
            total_t += extras[-1]["count"]

    manifest = {
        "title": "Global real-weather test dataset (16 Nov 2026)",
        "built_at": NOW.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "engine_tested": {
            "branch": "fix/engine-parser-fm-16nov",
            "commit": "5a5e60b212e417385176dff07e6d0b9b3032a89a",
            "worktree": "/workspace/wt-engine-fix-16nov",
            "note": "Runner imports the engine read-only. site/engine/* is not modified.",
        },
        "date_range_requested": {
            "metar_iem": [START.strftime("%Y-%m-%d"), END.strftime("%Y-%m-%d") + " (exclusive)"],
            "taf_international": "aviationweather.gov dataserver ~last 30 days (public archive cap)",
            "taf_us": "IEM AFOS full raw TAF text, same 12-month window as METARs",
        },
        "totals": {
            "curated_stations": len(STATIONS),
            "countries": sorted(countries),
            "n_countries": len(countries),
            "regions": sorted(regions),
            "metars": total_m,
            "tafs": total_t,
        },
        "stations": stations,
        "extra_files": extras,
        "fetch": fetch_info,
        "line_format": "{time UTC}\\t{metar|speci|taf}\\t{raw report}\\t{comma-separated sources}",
        "limitations": [
            "No report was invented or synthesized.",
            "International TAF history from aviationweather.gov is about 30 days, not 12 months.",
            "IEM AFOS TAF text covers US NWS products (K*/PA*/PH*/some Caribbean) for the 12-month window.",
            "Ogimet was used only as a recent complement; older Ogimet windows are often empty.",
            "South African FA** stations are omitted here; they already have their own 12-month set.",
        ],
    }
    (ROOT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    # slim copy of totals for a quick look
    log(f"MANIFEST METARs={total_m} TAFs={total_t} stations={len(stations)} countries={len(countries)}")
    return manifest


def main() -> int:
    ensure_dirs()
    log(f"start global weather fetch, {len(STATIONS)} curated stations, range {START.date()} .. {END.date()}")
    fetch_info: dict = {}
    try:
        fetch_info["stationinfo"] = fetch_stationinfo()
    except Exception as e:
        log(f"stationinfo aborted: {e}")
        fetch_info["stationinfo"] = {"error": str(e)}

    # Resume: skip IEM METAR stations that already have a substantial file
    already = {p.name.replace(".txt.gz", "") for p in RAW_METAR.glob("*.txt.gz") if p.stat().st_size > 200}
    fetch_info["iem_metar"] = fetch_iem_metars(already_ok=already)
    fetch_info["afos_us_taf"] = fetch_afos_us_tafs()
    fetch_info["adds_tafs"] = fetch_adds("tafs")
    fetch_info["adds_metars"] = fetch_adds("metars")
    fetch_info["cache_tafs"] = fetch_cache("tafs", only_selected=True)
    fetch_info["cache_metars"] = fetch_cache("metars", only_selected=True)
    try:
        fetch_info["ogimet"] = fetch_ogimet_recent()
    except Exception as e:
        log(f"ogimet aborted: {e}")
        fetch_info["ogimet"] = {"error": str(e)}

    man = build_manifest(fetch_info)
    # tidy scratch
    for p in SCRATCH.glob("*"):
        try:
            p.unlink()
        except Exception:
            pass
    log("done")
    print(json.dumps({"totals": man["totals"], "log": str(SOURCES / "fetch-log.txt")}, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
