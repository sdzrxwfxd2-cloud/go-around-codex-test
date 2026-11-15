import { createRequire } from "node:module";
import http from "node:http"; import { readFile, stat } from "node:fs/promises"; import { join, extname, normalize } from "node:path";
const { chromium } = createRequire("/workspace/tools/browser-playwright/node_modules/")("playwright");
const T = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };
const root="/workspace/wt-engine-gaps-15nov/site", port=8963;
const mw = await import("/workspace/wt-engine-gaps-15nov/cloudflare/functions/_middleware.js");
const file = async (pathname) => { let rel = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, ""); if (rel.endsWith("/")) rel += "index.html";
  for (const cand of [rel, rel + ".html"]) { const f = join(root, cand); try { if ((await stat(f)).isFile()) return new Response(await readFile(f), { status: 200, headers: { "content-type": T[extname(f)] || "application/octet-stream" } }); } catch {} }
  return new Response("", { status: 404 }); };
http.createServer(async (req, res) => { const p=req.url.split("?")[0];
  if (p.startsWith("/api/")) { res.writeHead(404); return res.end(""); }
  const request = new Request("http://127.0.0.1:"+port+req.url, { headers: Object.fromEntries(Object.entries(req.headers).filter(([k, v]) => typeof v === "string")) });
  const r = await mw.onRequest({ request, env: { ASSETS: { fetch: (q) => file(new URL(q.url).pathname) } }, next: () => file(p) });
  const h = {}; r.headers.forEach((v, k) => (h[k] = v)); res.writeHead(r.status, h); res.end(Buffer.from(await r.arrayBuffer())); }).listen(port);
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const p = await b.newPage(); p.on("response", r => { if (r.status() >= 400) console.log(r.status(), r.url()); });
await p.goto(`http://127.0.0.1:${port}/ad/FAHS`); await p.waitForTimeout(8000); await b.close(); process.exit(0);
