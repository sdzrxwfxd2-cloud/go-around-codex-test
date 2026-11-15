// Site password for the Cloudflare Pages copy: the Cloudflare equivalent of netlify/edge-functions/gate.ts (unchanged).
// Every page and asset needs the site password (SITE_PASSWORD secret), except the same paths gate.ts leaves open
// (/api/*, icons, manifest, /admin*). The Netlify gate's visit counter is NOT ported here as a KV write.
// Visits go through /api/visit-beacon + D1 (preferred) or the dedicated VISITORS_KV namespace.
import { isOpen } from "../lib/auth.mjs";

const ACCEPT_CH = "Sec-CH-UA-Model, Sec-CH-UA-Platform, Sec-CH-UA-Platform-Version, Sec-CH-UA-Mobile, Sec-CH-UA";

// Section pretty-URL / .html reloads (13 Nov 2026, feat/more-loader-and-pretty-rewrite-13nov; was a 302 bounce since
// DEEP-DIAG fix 3, 11 Nov 2026): top-level document visits used to download the standalone page (or 302 to
// /index.html#section) and flash before the shell reopened the section in a frame. They now get the shell at the
// same URL (200, no redirect) so parseStart() can show the section. Frames send Sec-Fetch-Dest: iframe and ?solo=1
// keeps the inner page. Old browsers that do not send Sec-Fetch-Dest are left alone (an iframe must never receive the shell).
const SECTION_PATH = /^\/(pilot|library|logbook|brief|calculator|app|main|status|status_demo)(?:\.html)?$/i;
function isSectionDocument(request, url) {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  if (!SECTION_PATH.test(url.pathname)) return false;
  if (request.headers.get("Sec-Fetch-Dest") !== "document" || /[?&]solo=1/.test(url.search)) return false;
  return true;
}
function sectionName(url) {
  const m = (url.pathname || "").match(SECTION_PATH);
  if (!m) return null;
  const n = m[1].toLowerCase();
  if (n === "main") return "aero";
  if (n === "status" || n === "status_demo") return "status";
  if (n === "app") {
    const q = new URLSearchParams(url.search).get("tab");
    if (q && /^(chart|map|ato|dfe)$/.test(q)) return q;
    return "ato";
  }
  return n;
}

// Aerodrome reload (12 Nov 2026): the shell pushStates the address bar to /ad/FAOR (or /ad/FACT) while the
// aerodrome itself stays in an iframe. A reload then requests that pretty URL as a top-level document.
// For every aerodrome except FACT (which has no site/ad/FACT.html and already fell through to index.html),
// Cloudflare served the standalone page — the old Wingman-branded copy, not the current Go Around shell.
// Top-level document visits to /ad/* and /c/ad/* now get the shell at the same URL so parseStart()/openAd()
// can reopen the field in the iframe. Frames and ?solo=1 still get the standalone page. Old browsers that
// do not send Sec-Fetch-Dest are left alone, same as section pages (an iframe must never receive the shell).
const AD_PATH = /^\/(?:c\/)?ad\/([A-Za-z0-9-]+)(?:\.html)?$/i;
function isAdDocument(request, url) {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  if (!AD_PATH.test(url.pathname)) return false;
  if (request.headers.get("Sec-Fetch-Dest") !== "document" || /[?&]solo=1/.test(url.search)) return false;
  return true;
}
async function serveShell(context, path) {
  const url = new URL(context.request.url);
  const inm = context.request.headers.get("If-None-Match") || "";
  const ah = new Headers(context.request.headers);
  ah.delete("If-None-Match"); ah.delete("If-Modified-Since");
  const asset = await context.env.ASSETS.fetch(new Request(new URL("/" + url.search, url.origin), { method: context.request.method, headers: ah }));
  const headers = new Headers(asset.headers);
  headers.set("Cache-Control", "no-cache, max-age=0, must-revalidate");
  const res = new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
  return await withVisitHints(res, path, inm);
}

export async function onRequest(context) {
  const url = new URL(context.request.url), path = url.pathname;
  if (isSectionDocument(context.request, url)) {
    if (context.env && context.env.ASSETS) return await serveShell(context, path);
    const name = sectionName(url) || "aero";
    return new Response(null, { status: 302, headers: { Location: "/index.html#" + name, "Cache-Control": "no-cache, max-age=0, must-revalidate" } });
  }
  if (isAdDocument(context.request, url) && context.env.ASSETS) return await serveShell(context, path);
  if (isOpen(path)) return keepHtml(context, path);
  // MT 8 Nov 2026 23:23 SAST: site password removed for public pages. /dashboard-data keeps its own password check.
  return keepHtml(context, path);
}

// Cloudflare Pages "pretty URLs" 308-redirect /app.html -> /app and /index.html -> /. The site scripts test
// location.pathname (e.g. /app\.html$/ for the new ATO/DFE page, scripts and theme), so on Cloudflare the address must keep
// its .html exactly as on Netlify. When an .html request gets that redirect, serve the same asset bytes in place (200, URL unchanged).
async function keepHtml(context, path) {
  const inm = context.request.headers.get("If-None-Match") || "";
  const res = await context.next();
  let out = res;
  if (path.endsWith(".html") && res.status >= 300 && res.status < 400 && context.env.ASSETS) {
    const loc = res.headers.get("location");
    if (loc) {
      const url = new URL(context.request.url), to = new URL(loc, url);
      const pretty = path.replace(/(^|\/)index\.html$/, "$1").replace(/\.html$/, "");
      if (to.origin === url.origin && to.pathname === pretty) {
        // Fetch the pretty path without the browser's If-None-Match / If-Modified-Since, so a revalidation can't come back as a 3xx
        // (a 304 here used to fall back to the 308 and send /main.html to /main). The page's own 304 is answered below.
        const ah = new Headers(context.request.headers); ah.delete("If-None-Match"); ah.delete("If-Modified-Since");
        const asset = await context.env.ASSETS.fetch(new Request(new URL(pretty + url.search, url), { method: context.request.method, headers: ah }));
        out = asset.status >= 300 && asset.status < 400 ? res : asset;
      }
    }
  }
  return await withVisitHints(out, path, inm);
}

// HTML ETag + 304 (DEEP-DIAG fix 3, PR #63; body-hash fallback live since fix/reload-stale-12nov;
// no-transform added 13 Nov 2026 so 200 HTML actually keeps the ETag at the pages.dev edge).
// The visit-beacon script is appended to <body>. That used to be done with HTMLRewriter, but a 200
// response that goes through HTMLRewriter is streamed (Transfer-Encoding: chunked) and Cloudflare's
// edge drops the ETag, so the browser never stores a tag and every reload re-downloads. This Function
// already injects the beacon into a buffered body and returns that buffer with Content-Length + a weak
// ETag (asset ETag or SHA-1 of the pre-beacon bytes, plus "-b1"). A matching If-None-Match gets 304
// with the tag (checked on live 12–13 Nov 2026). But 200 HTML still left the edge as chunked with no
// ETag or Content-Length: pages.dev HTML features (Email Obfuscation, Automatic HTTPS Rewrites, etc.)
// re-stream the body and strip those headers even when this Function set them. Cache-Control:
// no-transform disables those transforms (Cloudflare documents that Email Obfuscation does not apply
// when no-transform is present, and weak ETags require those features off or the header is removed).
// Admin pages are left exactly as before.
const BEACON_TAG = '<script src="/wm-beacon.js" defer></script>', BEACON_V = "b1";
function pageTag(res) {
  const e = (res.headers.get("ETag") || "").replace(/^W\//, "").replace(/"/g, "");
  return e ? 'W/"' + e + "-" + BEACON_V + '"' : null;
}
async function bodyTag(buf) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-1", buf));
  let h = ""; for (let i = 0; i < 10; i++) h += d[i].toString(16).padStart(2, "0");
  return 'W/"h' + h + "-" + BEACON_V + '"';
}
function matches(inm, tag) {
  return !!inm && !!tag && inm.split(",").some((t) => t.trim() === tag || t.trim() === "*");
}
function injectBeacon(buf) {
  const html = new TextDecoder("utf-8").decode(buf);
  if (html.includes("/wm-beacon.js")) return buf;
  const i = html.toLowerCase().lastIndexOf("</body>");
  const out = i >= 0 ? html.slice(0, i) + BEACON_TAG + html.slice(i) : html + BEACON_TAG;
  return new TextEncoder().encode(out);
}

async function withVisitHints(res, path, inm) {
  if (!res) return res;
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  const html = ct.includes("text/html");
  if (!html && !path.endsWith(".html") && path !== "/") return res;
  const headers = new Headers(res.headers);
  headers.set("Accept-CH", ACCEPT_CH);
  const admin = path.startsWith("/admin");
  let buf = null;
  if (html && !admin && res.status === 200 && res.body) {
    buf = await res.arrayBuffer();
    res = new Response(buf, { status: res.status, statusText: res.statusText, headers: res.headers });
  }
  let tag = html && !admin && res.status === 200 ? pageTag(res) : null;
  if (!tag && buf) tag = await bodyTag(buf);
  if (tag) {
    headers.set("ETag", tag);
    // Stop the pages.dev HTML pipeline from re-chunking the body and dropping ETag + Content-Length.
    const cc = headers.get("Cache-Control") || "no-cache, max-age=0, must-revalidate";
    if (!/\bno-transform\b/i.test(cc)) headers.set("Cache-Control", cc + ", no-transform");
    if (matches(inm, tag)) {
      if (res.body) res.body.cancel().catch(() => {});
      for (const h of ["Content-Length", "Content-Encoding", "Content-Type"]) headers.delete(h);
      return new Response(null, { status: 304, headers });
    }
  } else if (html && !admin) headers.delete("ETag");
  if (html && !admin && buf) {
    const injected = injectBeacon(buf);
    // arrayBuffer() is already decoded; a leftover Content-Encoding: gzip would corrupt the body.
    headers.delete("Content-Encoding");
    headers.set("Content-Length", String(injected.byteLength));
    return new Response(injected, { status: res.status, statusText: res.statusText, headers });
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
