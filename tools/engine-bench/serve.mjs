// tools/engine-bench/serve.mjs — local copy of the live site for measuring: files from live-served/, optional overlay folders
// first (so new engine files replace the live ones), and the weather API answered from fixtures.mjs. Nothing leaves the machine.
// Use: import { start } from "./serve.mjs"; const s = await start({ port, overlays: [dir, ...], now });
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { build, REF } from "./fixtures.mjs";
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".ico": "image/x-icon" };
export async function start({ port = 8790, overlays = [], now = Date.now(), apiDelayMs = 0 } = {}) {
  const fx = build(now), roots = [...overlays, join(REF, "site")], hits = {};
  const api = { "/api/wx-now": fx.wxNow, "/api/metar": fx.metar, "/api/taf": fx.taf, "/api/model-weather": fx.modelWeather, "/api/weather-snapshot": fx.snapshot };
  const server = http.createServer(async (req, res) => {
    const p = decodeURIComponent(req.url.split("?")[0]);
    if (p.startsWith("/api/")) {
      hits[p] = (hits[p] || 0) + 1;
      if (apiDelayMs) await new Promise((r) => setTimeout(r, apiDelayMs));
      if (api[p]) { res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=60, must-revalidate" }); return res.end(api[p]); }
      res.writeHead(204); return res.end();
    }
    let rel = normalize(p).replace(/^(\.\.[/\\])+/, ""); if (rel.endsWith("/")) rel += "index.html";
    for (const root of roots) for (const cand of [rel, rel + ".html"]) {
      const f = join(root, cand);
      try { if ((await stat(f)).isFile()) { res.writeHead(200, { "content-type": TYPES[extname(f)] || "application/octet-stream", "cache-control": "no-cache" }); return res.end(await readFile(f)); } } catch {}
    }
    res.writeHead(404); res.end("not found");
  });
  await new Promise((r) => server.listen(port, "127.0.0.1", r));
  return { url: `http://127.0.0.1:${port}`, fx, hits, close: () => new Promise((r) => server.close(r)) };
}
if (process.argv[1] && process.argv[1].endsWith("serve.mjs")) { const s = await start({ port: +(process.argv[2] || 8790), overlays: process.argv.slice(3) }); console.log("serving on", s.url); }
