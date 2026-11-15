#!/usr/bin/env python3
"""Fetch REAL South African METAR/TAF reports into tests/sa-weather/.

Never invents weather. Records the source of every report.
Polite with public archive rate limits.
"""
from __future__ import annotations

import csv
import gzip
import io
import json
import os
import re
import shutil
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]  # repo root (worktree)
OUT = Path(__file__).resolve().parents[1]   # tests/sa-weather
RAW_METAR = OUT / "raw" / "metar"
RAW_TAF = OUT / "raw" / "taf"
SOURCES = OUT / "sources"
SCRATCH = Path("/tmp/sa-wx-fetch")

UA = "GoAround-research/1.0 (SA weather test dataset for engine tests; https://github.com/sdzrxwfxd2-cloud/Go-Around-Cloudflare)"
SITE = "https://go-around-aero.pages.dev"
IEM = "https://mesonet.agron.iastate.edu"
AVWX = "https://aviationweather.gov"
OGIMET = "https://www.ogimet.com"

# 12 months ending today (2026-11-15). IEM end date is exclusive.
START = datetime(2025, 11, 16, tzinfo=timezone.utc)
END = datetime(2026, 11, 16, tzinfo=timezone.utc)  # exclusive
NOW = datetime.now(timezone.utc)

SLEEP_IEM = 0.8
SLEEP_ADDS = 0.8
SLEEP_OGIMET = 1.2

# Reports: key = (kind, icao, raw_norm) -> record
# record: {icao, kind, time, raw, sources: [..], fetched_at}
STORE = {}


def log(msg: str) -> None:
    print(msg, flush=True)


def ensure_dirs() -> None:
    for p in (RAW_METAR, RAW_TAF, SOURCES, SCRATCH):
        p.mkdir(parents=True, exist_ok=True)


def http_get(url: str, dest: Path | None = None, timeout: int = 120, retries: int = 4, extra_headers: dict | None = None) -> bytes:
    headers = {"User-Agent": UA, "Accept": "*/*"}
    if extra_headers:
        headers.update(extra_headers)
    last_err = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                data = resp.read()
                if dest:
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    dest.write_bytes(data)
                return data
        except Exception as e:
            last_err = e
            wait = 2 ** attempt
            log(f"  retry {attempt+1}/{retries} after {type(e).__name__}: {e} (sleep {wait}s) url={url[:140]}")
            time.sleep(wait)
    raise RuntimeError(f"GET failed: {url}") from last_err


def month_starts(start: datetime, end: datetime) -> list[tuple[datetime, datetime]]:
    """Inclusive start, exclusive end, calendar months (with a 1-day overlap ok)."""
    out = []
    y, m = start.year, start.month
    cur = datetime(y, m, 1, tzinfo=timezone.utc)
    if start.day != 1:
        cur = start
    while cur < end:
        ny, nm = (cur.year + 1, 1) if cur.month == 12 else (cur.year, cur.month + 1)
        nxt = datetime(ny, nm, 1, tzinfo=timezone.utc)
        if nxt > end:
            nxt = end
        # If cur is mid-month start, first window is start -> next month 1
        out.append((cur, nxt))
        cur = datetime(ny, nm, 1, tzinfo=timezone.utc)
        if cur < start:
            cur = start
    return out


def load_station_lists() -> dict:
    wx_core = json.loads((ROOT / "netlify/lib/wx_core.json").read_text())
    wx_core_ids = [row[0] for row in wx_core]
    wx_core_ll = {row[0]: (row[1], row[2]) for row in wx_core}

    # IEM ZA__ASOS
    csv_bytes = http_get(
        f"{IEM}/sites/networks.php?network=ZA__ASOS&format=csv&nohtml=on",
        dest=SCRATCH / "iem-za-asos-stations.csv",
    )
    iem_rows = []
    rdr = csv.DictReader(io.StringIO(csv_bytes.decode("utf-8", "replace")))
    for row in rdr:
        iem_rows.append(row)

    # site FA** from model points (context only)
    mp = json.loads((ROOT / "netlify/lib/model_points.json").read_text())
    model_fa = sorted({row[0] for row in mp if isinstance(row, list) and str(row[0]).startswith("FA")})

    return {
        "wx_core": wx_core_ids,
        "wx_core_ll": wx_core_ll,
        "iem_rows": iem_rows,
        "iem_ids": [r["stid"] for r in iem_rows if r.get("stid")],
        "model_fa": model_fa,
    }


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
        # title-case the type
        return re.sub(r"^(METAR|SPECI)\b", lambda m: m.group(1).upper(), s, count=1, flags=re.I)
    # IEM often omits the type word
    if re.match(r"^SPECI\b", s, re.I):
        return "SPECI " + s[5:].strip()
    return "METAR " + s


def ensure_taf_prefix(raw: str) -> str:
    s = norm_raw(raw)
    if not s:
        return s
    if re.match(r"^TAF\b", s, re.I):
        return re.sub(r"^TAF\b", "TAF", s, count=1, flags=re.I)
    return "TAF " + s


def icao_of(raw: str, fallback: str = "") -> str:
    m = re.search(r"\b(METAR|SPECI|TAF(?:\s+AMD)?)\s+([A-Z]{4})\b", raw)
    if m:
        return m.group(2)
    m = re.match(r"^([A-Z]{4})\s+\d{6}Z\b", raw)
    if m:
        return m.group(1)
    return fallback


def parse_iso(s: str) -> str | None:
    if not s:
        return None
    s = str(s).strip()
    # IEM: "2026-11-14 00:00"
    s = s.replace(" ", "T")
    if re.match(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$", s):
        s += ":00"
    if s.endswith("Z"):
        return s if "T" in s else None
    if re.match(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}", s):
        # already iso, maybe with ms or offset
        try:
            if s.endswith("Z") or "+" in s[10:] or s.endswith("00.000"):
                dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
            else:
                dt = datetime.fromisoformat(s).replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        except Exception:
            if not s.endswith("Z"):
                return s + "Z"
            return s
    return None


def add_report(kind: str, icao: str, raw: str, time_iso: str | None, source: str, fetched_at: str) -> bool:
    kind = kind.lower()
    icao = (icao or "").upper().strip()
    if kind == "taf":
        raw = ensure_taf_prefix(raw)
    else:
        raw = ensure_metar_prefix(raw)
        # distinguish SPECI
        if raw.startswith("SPECI "):
            kind = "speci"
    icao = icao_of(raw, icao)
    if not re.match(r"^[A-Z]{4}$", icao or ""):
        return False
    if not raw or raw in ("METAR", "SPECI", "TAF", "TAF AMD"):
        return False
    key = (kind if kind != "speci" else "metar", icao, raw)
    # store SPECI in the METAR file, kind recorded on the line
    rec = STORE.get(key)
    if rec:
        if source not in rec["sources"]:
            rec["sources"].append(source)
        if time_iso and (not rec["time"] or time_iso < rec["time"]):
            rec["time"] = time_iso
        return False
    STORE[key] = {
        "icao": icao,
        "kind": "speci" if raw.startswith("SPECI ") else kind,
        "time": time_iso,
        "raw": raw,
        "sources": [source],
        "fetched_at": fetched_at,
    }
    return True


# ---------- local / site sources ----------

def save_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2) if not isinstance(obj, (bytes, str)) else (obj if isinstance(obj, str) else obj.decode()), encoding="utf-8")


def ingest_metar_rows(rows, source: str, fetched_at: str) -> int:
    n = 0
    for row in rows or []:
        if not isinstance(row, dict):
            continue
        raw = row.get("rawOb") or row.get("raw") or row.get("raw_text") or ""
        icao = row.get("icaoId") or row.get("station_id") or row.get("icao") or icao_of(raw, "")
        t = None
        if row.get("obsTime") is not None:
            try:
                ot = float(row["obsTime"])
                if ot < 1e12:
                    ot *= 1000
                t = datetime.fromtimestamp(ot / 1000, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            except Exception:
                t = None
        if not t:
            t = parse_iso(row.get("observation_time") or row.get("reportTime") or row.get("obsTimeIso") or "")
        if add_report("metar", icao, raw, t, source, fetched_at):
            n += 1
    return n


def ingest_taf_rows(rows, source: str, fetched_at: str) -> int:
    n = 0
    for row in rows or []:
        if not isinstance(row, dict):
            continue
        raw = row.get("rawTAF") or row.get("raw") or row.get("raw_text") or ""
        icao = row.get("icaoId") or row.get("station_id") or row.get("icao") or icao_of(raw, "")
        t = parse_iso(row.get("issueTime") or row.get("issue_time") or row.get("bulletinTime") or row.get("bulletin_time") or "")
        if not t and row.get("validTimeFrom") is not None:
            try:
                vt = float(row["validTimeFrom"])
                if vt < 1e12:
                    vt *= 1000
                t = datetime.fromtimestamp(vt / 1000, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            except Exception:
                t = None
        if add_report("taf", icao, raw, t, source, fetched_at):
            n += 1
    return n


def fetch_live_site() -> dict:
    fetched_at = NOW.strftime("%Y-%m-%dT%H:%M:%SZ")
    out = {"fetched_at": fetched_at, "endpoints": {}}
    dest_dir = SOURCES / "go-around-live"
    dest_dir.mkdir(parents=True, exist_ok=True)
    for name, path in [
        ("wx-now", "/api/wx-now"),
        ("metar", "/api/metar"),
        ("taf", "/api/taf"),
        ("weather-snapshot", "/api/weather-snapshot"),
    ]:
        url = SITE + path
        log(f"GET {url}")
        data = http_get(url, dest=dest_dir / f"{name}.json")
        out["endpoints"][name] = {"url": url, "bytes": len(data), "http": 200}
        try:
            obj = json.loads(data)
        except Exception as e:
            log(f"  parse fail {name}: {e}")
            continue
        if name in ("metar", "wx-now"):
            rows = obj if isinstance(obj, list) else obj.get("metar") or []
            n = ingest_metar_rows(rows, f"go-around-live:{path}", fetched_at)
            log(f"  ingested {n} new METARs from {name}")
        if name in ("taf", "wx-now"):
            rows = obj if isinstance(obj, list) else obj.get("taf") or []
            n = ingest_taf_rows(rows, f"go-around-live:{path}", fetched_at)
            log(f"  ingested {n} new TAFs from {name}")
        if name == "weather-snapshot" and isinstance(obj, dict):
            n1 = ingest_metar_rows(obj.get("metar") or [], "go-around-live:/api/weather-snapshot", fetched_at)
            n2 = ingest_taf_rows(obj.get("taf") or [], "go-around-live:/api/weather-snapshot", fetched_at)
            log(f"  ingested {n1} new METARs, {n2} new TAFs from snapshot")
    return out


def copy_box_snapshots() -> dict:
    fetched_at = NOW.strftime("%Y-%m-%dT%H:%M:%SZ")
    dest = SOURCES / "go-around-box-snapshots"
    dest.mkdir(parents=True, exist_ok=True)
    info = {"copied": [], "note": "Read-only copies of snapshots already on the box. Not modified."}
    pairs = [
        ("/workspace/main-snapshot-public-metar.json", "main-snapshot-public-metar.json", "metar"),
        ("/workspace/main-snapshot-public-taf.json", "main-snapshot-public-taf.json", "taf"),
        ("/workspace/main-snapshot-public-weather.json", "main-snapshot-public-weather.json", "weather"),
        ("/workspace/main-snapshot-weather-provenance.md", "main-snapshot-weather-provenance.md", "note"),
    ]
    # also copy api snapshots if present
    for src, name, kind in pairs:
        p = Path(src)
        if not p.exists():
            continue
        shutil.copy2(p, dest / name)
        info["copied"].append(name)
        if kind in ("metar", "taf", "weather"):
            try:
                obj = json.loads(p.read_text())
            except Exception:
                continue
            if kind == "metar":
                n = ingest_metar_rows(obj if isinstance(obj, list) else obj.get("metar") or [], "go-around-box-snapshot:main-snapshot-public-metar", fetched_at)
                log(f"  box metar: {n} new")
            elif kind == "taf":
                n = ingest_taf_rows(obj if isinstance(obj, list) else obj.get("taf") or [], "go-around-box-snapshot:main-snapshot-public-taf", fetched_at)
                log(f"  box taf: {n} new")
            else:
                # weather may be snapshot shape
                if isinstance(obj, dict):
                    n1 = ingest_metar_rows(obj.get("metar") or [], "go-around-box-snapshot:main-snapshot-public-weather", fetched_at)
                    n2 = ingest_taf_rows(obj.get("taf") or [], "go-around-box-snapshot:main-snapshot-public-weather", fetched_at)
                    log(f"  box weather: {n1} new METAR, {n2} new TAF")
                elif isinstance(obj, list):
                    ingest_metar_rows(obj, "go-around-box-snapshot:main-snapshot-public-weather", fetched_at)
    # weather-snapshot dir
    snap_api = Path("/workspace/main-snapshot/api")
    if snap_api.exists():
        for fn in ("metar", "taf", "weather-snapshot"):
            p = snap_api / fn
            if p.exists() and p.is_file():
                shutil.copy2(p, dest / f"api-{fn}.json")
                info["copied"].append(f"api-{fn}.json")
                try:
                    obj = json.loads(p.read_text())
                except Exception:
                    continue
                if fn == "metar":
                    ingest_metar_rows(obj if isinstance(obj, list) else obj.get("metar") or [], "go-around-box-snapshot:api/metar", fetched_at)
                elif fn == "taf":
                    ingest_taf_rows(obj if isinstance(obj, list) else obj.get("taf") or [], "go-around-box-snapshot:api/taf", fetched_at)
                else:
                    if isinstance(obj, dict):
                        ingest_metar_rows(obj.get("metar") or [], "go-around-box-snapshot:api/weather-snapshot", fetched_at)
                        ingest_taf_rows(obj.get("taf") or [], "go-around-box-snapshot:api/weather-snapshot", fetched_at)
    return info


def ingest_wx_history() -> dict:
    """Ingest docs/wx-history-15nov already in this (or sibling) tree. Raw reports only."""
    fetched_at = NOW.strftime("%Y-%m-%dT%H:%M:%SZ")
    candidates = [
        ROOT / "docs" / "wx-history-15nov",
        Path("/workspace/wt-e6b-free-15nov/docs/wx-history-15nov"),
        Path("/workspace/wt-investigator-live-15nov/docs/wx-history-15nov"),
    ]
    hist = next((p for p in candidates if p.exists()), None)
    info = {"path": str(hist) if hist else None, "files": []}
    if not hist:
        return info
    dest = SOURCES / "wx-history-15nov"
    dest.mkdir(parents=True, exist_ok=True)
    # only copy the raw-report files, not the analysis summaries if we want size
    for p in sorted(hist.iterdir()):
        if p.suffix != ".json":
            continue
        name = p.name
        try:
            obj = json.loads(p.read_text())
        except Exception:
            continue
        n1 = n2 = 0
        if name.startswith("m-") and isinstance(obj, list):
            n1 = ingest_metar_rows(obj, f"go-around-wx-history-15nov:{name}", fetched_at)
            # don't copy bulky duplicates into sources; provenance only
            info["files"].append({"file": name, "new_metar": n1})
        elif name == "taf-hist.json" and isinstance(obj, list):
            n2 = ingest_taf_rows(obj, "go-around-wx-history-15nov:taf-hist.json", fetched_at)
            info["files"].append({"file": name, "new_taf": n2})
        elif name in ("metar-an.json", "taf-an.json"):
            # analysis only — skip ingest, mention in provenance
            info["files"].append({"file": name, "skipped": "analysis summary, not raw reports"})
        log(f"  wx-history {name}: +{n1} METAR +{n2} TAF")
    (dest / "INGESTED.md").write_text(
        "Raw reports were ingested from docs/wx-history-15nov (aviationweather.gov-shaped rows already saved on 15 Nov 2026).\n"
        "Those files are not copied here to avoid doubling repo size; every report is in raw/{metar,taf}/ with this source tag.\n",
        encoding="utf-8",
    )
    return info


# ---------- IEM METARs ----------

def fetch_iem_metars() -> dict:
    fetched_at = NOW.strftime("%Y-%m-%dT%H:%M:%SZ")
    dest = SCRATCH / "iem"
    dest.mkdir(parents=True, exist_ok=True)
    windows = month_starts(START, END)
    info = {"windows": [], "new": 0, "rows": 0}
    for a, b in windows:
        params = {
            "network": "ZA__ASOS",
            "data": "metar",
            "year1": str(a.year),
            "month1": str(a.month),
            "day1": str(a.day),
            "year2": str(b.year),
            "month2": str(b.month),
            "day2": str(b.day),
            "tz": "UTC",
            "format": "onlycomma",
            "latlon": "no",
            "elev": "no",
            "missing": "empty",
            "trace": "empty",
            "direct": "no",
            "report_type": "3",
        }
        # report_type 3 and 4: need both keys. urllib will keep one; add manually.
        qs = urllib.parse.urlencode(params)
        url = f"{IEM}/cgi-bin/request/asos.py?{qs}&report_type=4"
        label = f"{a.date()}_{b.date()}"
        fpath = dest / f"za-asos-{label}.csv"
        log(f"IEM METAR {label} {url}")
        data = http_get(url, dest=fpath, timeout=180)
        text = data.decode("utf-8", "replace")
        rows = 0
        new = 0
        rdr = csv.DictReader(io.StringIO(text))
        if not rdr.fieldnames or "metar" not in (rdr.fieldnames or []):
            log(f"  unexpected header: {text[:200]!r}")
            info["windows"].append({"start": a.isoformat(), "end": b.isoformat(), "error": "bad header", "bytes": len(data)})
            time.sleep(SLEEP_IEM)
            continue
        for row in rdr:
            raw = (row.get("metar") or "").strip()
            if not raw:
                continue
            st = (row.get("station") or icao_of(raw, "")).upper()
            t = parse_iso(row.get("valid") or "")
            rows += 1
            if add_report("metar", st, raw, t, "iem-asos:ZA__ASOS", fetched_at):
                new += 1
        info["windows"].append({"start": str(a.date()), "end": str(b.date()), "bytes": len(data), "rows": rows, "new": new})
        info["new"] += new
        info["rows"] += rows
        log(f"  rows={rows} new={new}")
        time.sleep(SLEEP_IEM)
    # IEM monthly CSVs are scratch only (large). Provenance recorded in manifest.
    return info


# ---------- aviationweather.gov ADDS ----------

def iter_adds(kind: str, stations: list[str], hours: int = 720) -> int:
    """kind is 'metars' or 'tafs'. Returns new count."""
    fetched_at = NOW.strftime("%Y-%m-%dT%H:%M:%SZ")
    tag = "aviationweather.gov/dataserver"
    new = 0
    # batch stations, and if METAR hits the 400-row cap, split time windows
    batches = [stations[i:i + 8] for i in range(0, len(stations), 8)]
    dest = SCRATCH / "adds"
    dest.mkdir(parents=True, exist_ok=True)
    data_source = kind
    elem = "METAR" if kind == "metars" else "TAF"
    for bi, batch in enumerate(batches):
        # For METARs, walk 10-day windows to stay under the 400-row cap.
        if kind == "metars":
            windows = []
            cur = END - timedelta(days=30)
            if cur < START:
                cur = START
            # last 30 days only (ADDS cap)
            anchor = END
            t0 = anchor - timedelta(days=30)
            step = timedelta(days=8)
            w = t0
            while w < anchor:
                windows.append((w, min(w + step, anchor)))
                w += step
        else:
            windows = [(END - timedelta(days=30), END)]
        for a, b in windows:
            # hoursBeforeNow from end of window, plus startTime/endTime if supported
            params = {
                "dataSource": data_source,
                "requestType": "retrieve",
                "format": "xml",
                "stationString": ",".join(batch),
                "startTime": a.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "endTime": b.strftime("%Y-%m-%dT%H:%M:%SZ"),
            }
            url = f"{AVWX}/api/data/dataserver?" + urllib.parse.urlencode(params)
            label = f"{kind}-{'-'.join(batch)}-{a.date()}_{b.date()}"
            log(f"ADDS {label}")
            try:
                data = http_get(url, dest=dest / f"{label}.xml", timeout=120)
            except Exception as e:
                log(f"  fail: {e}")
                time.sleep(SLEEP_ADDS)
                continue
            try:
                root = ET.fromstring(data)
            except Exception as e:
                # maybe JSON error
                log(f"  xml parse fail ({e}): {data[:200]!r}")
                time.sleep(SLEEP_ADDS)
                continue
            errs = root.find("errors")
            if errs is not None and list(errs):
                log(f"  errors: {ET.tostring(errs, encoding='unicode')[:300]}")
            n_here = 0
            for node in root.iter(elem):
                raw = node.findtext("raw_text") or ""
                sid = (node.findtext("station_id") or icao_of(raw, "")).upper()
                if kind == "metars":
                    t = parse_iso(node.findtext("observation_time") or "")
                    if add_report("metar", sid, raw, t, tag, fetched_at):
                        new += 1
                        n_here += 1
                else:
                    t = parse_iso(node.findtext("issue_time") or node.findtext("bulletin_time") or "")
                    if add_report("taf", sid, raw, t, tag, fetched_at):
                        new += 1
                        n_here += 1
            data_el = root.find("data")
            cap = data_el.attrib.get("num_results") if data_el is not None else "?"
            log(f"  new={n_here} num_results={cap}")
            time.sleep(SLEEP_ADDS)
    return new


# ---------- Ogimet (recent only; older windows came back empty from this host) ----------

def parse_ogimet_txt(text: str) -> list[tuple[str, str, str, str]]:
    """Return list of (kind, icao, time_iso, raw). Joins continuation lines until '='."""
    # strip HTML chrome if present
    # Keep lines that look like reports or continuations
    body = text
    if "<" in body[:200]:
        # extract the pre-like text: lines starting with #, digits, TAF, METAR, SPECI, or indent
        # drop tags
        body = re.sub(r"<script[\s\S]*?</script>", "\n", body, flags=re.I)
        body = re.sub(r"<style[\s\S]*?</style>", "\n", body, flags=re.I)
        body = re.sub(r"<br\s*/?>", "\n", body, flags=re.I)
        body = re.sub(r"</p>", "\n", body, flags=re.I)
        body = re.sub(r"<[^>]+>", " ", body)
        body = re.sub(r"&nbsp;", " ", body)
        body = re.sub(r"&amp;", "&", body)
        body = re.sub(r"&lt;", "<", body)
        body = re.sub(r"&gt;", ">", body)

    rows = []
    cur = None  # {kind, icao, time, raw_parts}
    header_re = re.compile(
        r"^(?:(\d{12})\s+)?((?:METAR|SPECI|TAF(?:\s+AMD)?))\s+([A-Z]{4})\s+(.+)$"
    )

    def flush():
        nonlocal cur
        if not cur:
            return
        raw = " ".join(cur["raw_parts"])
        # Ogimet sometimes glues the next report after '=' on the same line.
        parts = re.split(r"=\s*(?:(\d{12})\s+)?(?=(?:METAR|SPECI|TAF)\b)", raw)
        # parts: [first, stamp?, rest, stamp?, rest...]
        first = norm_raw(parts[0])
        if first:
            rows.append((cur["kind"], cur["icao"], cur["time"], first))
        i = 1
        while i < len(parts):
            stamp = parts[i] if i < len(parts) else None
            body = parts[i + 1] if i + 1 < len(parts) else ""
            i += 2
            body = norm_raw(body)
            if not body:
                continue
            m = re.match(r"((?:METAR|SPECI|TAF(?:\s+AMD)?))\s+([A-Z]{4})\s+(.+)$", body)
            if not m:
                continue
            typ, icao, rest = m.group(1), m.group(2), m.group(3)
            kind = "taf" if typ.startswith("TAF") else "metar"
            tiso = cur["time"]
            if stamp:
                try:
                    tiso = datetime.strptime(stamp, "%Y%m%d%H%M").replace(tzinfo=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
                except Exception:
                    pass
            typ_u = "TAF AMD" if "AMD" in typ.upper() else typ.split()[0]
            rows.append((kind, icao, tiso, typ_u + " " + icao + " " + rest))
        cur = None

    for line in body.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or line.startswith("<!--"):
            continue
        m = header_re.match(line)
        if m:
            flush()
            stamp, typ, icao, rest = m.group(1), m.group(2), m.group(3), m.group(4)
            kind = "taf" if typ.startswith("TAF") else "metar"
            t = None
            if stamp:
                try:
                    t = datetime.strptime(stamp, "%Y%m%d%H%M").replace(tzinfo=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
                except Exception:
                    t = None
            typ_u = "TAF AMD" if "AMD" in typ.upper() else typ.split()[0]
            cur = {"kind": kind, "icao": icao, "time": t, "raw_parts": [f"{typ_u} {icao} {rest}"]}
            continue
        if cur and not re.match(r"^(Query|Time interval|Latitude|ERROR)\b", line):
            # continuation
            cur["raw_parts"].append(line)
    flush()
    return rows


def fetch_ogimet_recent(stations: list[str]) -> dict:
    fetched_at = NOW.strftime("%Y-%m-%dT%H:%M:%SZ")
    # last ~36 hours, which this host successfully returns
    end = NOW
    start = NOW - timedelta(hours=36)
    info = {"start": start.isoformat(), "end": end.isoformat(), "stations": {}, "new": 0}
    dest = SCRATCH / "ogimet"
    dest.mkdir(parents=True, exist_ok=True)
    for st in stations:
        url = (
            f"{OGIMET}/display_metars2.php?lang=en&lugar={st}&tipo=ALL&ord=DIR&nil=SI&fmt=txt"
            f"&ano={start.year}&mes={start.month}&day={start.day}&hora={start.hour:02d}"
            f"&anof={end.year}&mesf={end.month}&dayf={end.day}&horaf={end.hour:02d}"
        )
        log(f"Ogimet {st} {start.date()} .. {end}")
        try:
            data = http_get(
                url,
                dest=dest / f"{st}.txt",
                timeout=40,
                extra_headers={"Referer": "https://www.ogimet.com/metars.phtml.en"},
            )
        except Exception as e:
            info["stations"][st] = {"error": str(e)}
            time.sleep(SLEEP_OGIMET)
            continue
        text = data.decode("latin-1", "replace")
        rows = parse_ogimet_txt(text)
        new = 0
        for kind, icao, t, raw in rows:
            if add_report(kind, icao or st, raw, t, "ogimet", fetched_at):
                new += 1
        info["stations"][st] = {"bytes": len(data), "parsed": len(rows), "new": new, "has_query": "# Query" in text or "Time interval" in text}
        info["new"] += new
        log(f"  parsed={len(rows)} new={new}")
        time.sleep(SLEEP_OGIMET)
    return info


# ---------- write outputs ----------

def is_sa_fa(icao: str) -> bool:
    return bool(re.match(r"^FA[A-Z]{2}$", icao or ""))


def write_raw_and_manifest(meta: dict) -> dict:
    # group
    by = defaultdict(lambda: {"metar": [], "taf": []})
    for rec in STORE.values():
        bucket = "taf" if rec["kind"] == "taf" else "metar"
        by[rec["icao"]][bucket].append(rec)

    stations_out = []
    total_metar = total_taf = 0
    fa_metar = fa_taf = 0

    def sort_key(r):
        return (r["time"] or "", r["raw"])

    for icao in sorted(by):
        recs_m = sorted(by[icao]["metar"], key=sort_key)
        recs_t = sorted(by[icao]["taf"], key=sort_key)
        paths = {}
        if recs_m:
            p = RAW_METAR / f"{icao}.txt.gz"
            write_gz_reports(p, recs_m)
            paths["metar"] = str(p.relative_to(OUT))
            total_metar += len(recs_m)
            if is_sa_fa(icao):
                fa_metar += len(recs_m)
        if recs_t:
            p = RAW_TAF / f"{icao}.txt.gz"
            write_gz_reports(p, recs_t)
            paths["taf"] = str(p.relative_to(OUT))
            total_taf += len(recs_t)
            if is_sa_fa(icao):
                fa_taf += len(recs_t)
        times_m = [r["time"] for r in recs_m if r["time"]]
        times_t = [r["time"] for r in recs_t if r["time"]]
        sources = sorted({s for r in recs_m + recs_t for s in r["sources"]})
        stations_out.append({
            "station": icao,
            "south_africa_fa": is_sa_fa(icao),
            "metar_count": len(recs_m),
            "taf_count": len(recs_t),
            "speci_count": sum(1 for r in recs_m if r["kind"] == "speci"),
            "metar_first": times_m[0] if times_m else None,
            "metar_last": times_m[-1] if times_m else None,
            "taf_first": times_t[0] if times_t else None,
            "taf_last": times_t[-1] if times_t else None,
            "sources": sources,
            "files": paths,
        })

    manifest = {
        "name": "South African real METAR/TAF test dataset",
        "created": NOW.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "timezone_note": "All report times are UTC. The operator lives in Africa/Johannesburg (UTC+2).",
        "engine_locked": "site/engine/* was not modified. This dataset is tests/sa-weather/ only.",
        "synthetic": False,
        "aim_range": {"start": START.strftime("%Y-%m-%dT%H:%M:%SZ"), "end_exclusive": END.strftime("%Y-%m-%dT%H:%M:%SZ")},
        "counts": {
            "stations_total": len(stations_out),
            "stations_fa": sum(1 for s in stations_out if s["south_africa_fa"]),
            "stations_fa_with_metar": sum(1 for s in stations_out if s["south_africa_fa"] and s["metar_count"]),
            "stations_fa_with_taf": sum(1 for s in stations_out if s["south_africa_fa"] and s["taf_count"]),
            "metar_and_speci_total": total_metar,
            "metar_and_speci_fa": fa_metar,
            "taf_total": total_taf,
            "taf_fa": fa_taf,
        },
        "sources_used": meta,
        "limitations": [
            "METAR history is from the Iowa Environmental Mesonet ZA__ASOS archive and aims at 12 months (2025-11-16 to 2026-11-15).",
            "aviationweather.gov's dataserver returns at most about 30 days of TAFs and recent METARs (confirmed: hoursBeforeNow=2160 still started 2026-10-15).",
            "Ogimet's text interface, from this host, only returned the last ~36 hours; older windows came back as an empty page, so Ogimet is a recent complement only.",
            "No production Worker/KV or go-around-db weather dump was available on the box beyond saved public API snapshots and docs/wx-history-15nov (read-only search).",
            "Neighbouring ICAO stations that appear in the live Go Around feed (for example FYWH, FBSK, FQMA) are kept in raw files and tagged south_africa_fa=false.",
        ],
        "stations": stations_out,
        "line_format": "time_iso<TAB>kind<TAB>raw<TAB>comma-separated sources",
        "files": "raw/metar/{ICAO}.txt.gz and raw/taf/{ICAO}.txt.gz",
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


def write_gz_reports(path: Path, recs: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = []
    for r in recs:
        t = r["time"] or ""
        kind = r["kind"]
        src = ",".join(r["sources"])
        lines.append(f"{t}\t{kind}\t{r['raw']}\t{src}\n")
    data = "".join(lines).encode("utf-8")
    with gzip.open(path, "wb", compresslevel=9) as f:
        f.write(data)


def main() -> int:
    ensure_dirs()
    log(f"OUT={OUT}")
    lists = load_station_lists()
    log(f"wx_core={len(lists['wx_core'])} iem={len(lists['iem_ids'])} model_fa={len(lists['model_fa'])}")
    (SOURCES / "station-lists.json").write_text(json.dumps({
        "wx_core": lists["wx_core"],
        "iem_za_asos": lists["iem_rows"],
        "fetched_at": NOW.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "iem_url": f"{IEM}/sites/networks.php?network=ZA__ASOS&format=csv&nohtml=on",
    }, indent=2) + "\n", encoding="utf-8")

    meta = {}
    log("=== live Go Around site ===")
    meta["go_around_live"] = fetch_live_site()
    log("=== box snapshots ===")
    meta["go_around_box_snapshots"] = copy_box_snapshots()
    log("=== wx-history-15nov ===")
    meta["wx_history_15nov"] = ingest_wx_history()
    log("=== IEM ASOS METARs (12 months) ===")
    meta["iem_asos"] = fetch_iem_metars()

    # stations to ask of ADDS / Ogimet: IEM + wx_core + any already seen FA
    seen = {r["icao"] for r in STORE.values()}
    ask = sorted({*lists["iem_ids"], *lists["wx_core"], *{s for s in seen if is_sa_fa(s)}})
    # also include live neighbouring stations already seen, for TAF completeness of the site feed
    neighbours = sorted(s for s in seen if not is_sa_fa(s))
    adds_stations = ask + neighbours
    log(f"=== aviationweather.gov ADDS ({len(adds_stations)} stations, ~30 days) ===")
    meta["aviationweather_tafs"] = {"new": iter_adds("tafs", adds_stations, 720)}
    meta["aviationweather_metars"] = {"new": iter_adds("metars", adds_stations, 720)}

    # Ogimet recent for stations that typically have TAF, plus IEM current
    ogimet_stations = sorted(set(
        [s for s in ask if s in {
            "FABL","FACT","FAEL","FAGG","FAHS","FAKM","FAKN","FALA","FALE","FALM",
            "FALW","FAMM","FAOR","FAPE","FAPM","FAPN","FAPP","FARB","FAUP","FAUT",
            "FAWB","FAWK","FAVV","FAGC","FAEO","FABM","FACV","FADY","FAJB","FASB",
        }]
        or ask[:30]
    ))
    log(f"=== Ogimet recent ~36h ({len(ogimet_stations)} stations) ===")
    meta["ogimet_recent"] = fetch_ogimet_recent(ogimet_stations)

    log("=== write raw files + manifest ===")
    manifest = write_raw_and_manifest(meta)
    log(json.dumps(manifest["counts"], indent=2))
    (SCRATCH / "fetch-meta.json").write_text(json.dumps(meta, indent=2, default=str) + "\n", encoding="utf-8")
    log("done")
    return 0


if __name__ == "__main__":
    sys.exit(main())
