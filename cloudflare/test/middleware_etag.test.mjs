// Middleware weak ETag + 304, the section-page bounce, and the aerodrome shell rewrite.
// HTMLRewriter is stubbed (Workers-only). Production HTMLRewriter strips ETag on 200 (the edge
// streams the rewritten body); this branch no longer uses it for HTML, but the stub still
// simulates a stripping rewriter so a regression would fail.
import { test } from "node:test";
import assert from "node:assert/strict";
globalThis.HTMLRewriter ??= class {
  on() { return this; }
  transform(r) {
    const h = new Headers(r.headers);
    h.delete("ETag");
    return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });
  }
};
const { onRequest } = await import("../functions/_middleware.js");
const page = (etag, status = 200, ct = "text/html; charset=utf-8") => new Response(status === 200 ? "<html><body>x</body></html>" : null, { status, headers: { "Content-Type": ct, ...(etag ? { ETag: etag } : {}), "Cache-Control": "no-cache, max-age=0, must-revalidate" } });
const ctx = (path, headers = {}, res = page('"abc123"'), env = {}) => ({ request: new Request("https://x.dev" + path, { headers }), env, next: async () => res });
const BEACON = '<script src="/wm-beacon.js" defer></script>';
const hasBeacon = async (r) => (await r.text()).includes(BEACON);

test("HTML gets a weak ETag from the asset ETag; a matching If-None-Match gets 304 with no body", async () => {
  const r = await onRequest(ctx("/"));
  assert.equal(r.status, 200); assert.equal(r.headers.get("ETag"), 'W/"abc123-b1"'); assert.ok(r.headers.get("Accept-CH"));
  assert.equal(r.headers.get("Content-Length"), String("<html><body>x</body></html>".length + BEACON.length));
  assert.match(r.headers.get("Cache-Control") || "", /\bno-transform\b/);
  assert.equal(await r.clone().text(), "<html><body>x" + BEACON + "</body></html>");
  const r2 = await onRequest(ctx("/", { "If-None-Match": 'W/"abc123-b1"' }));
  assert.equal(r2.status, 304); assert.equal(await r2.text(), ""); assert.equal(r2.headers.get("ETag"), 'W/"abc123-b1"');
  assert.match(r2.headers.get("Cache-Control") || "", /\bno-transform\b/);
  const r3 = await onRequest(ctx("/", { "If-None-Match": '"abc123"' }));
  assert.equal(r3.status, 200, "the old asset tag no longer matches (the page bytes differ)");
  assert.equal(r3.headers.get("ETag"), 'W/"abc123-b1"');
});

test("when the asset has no ETag (production HTML), the page bytes are hashed and a matching If-None-Match gets 304", async () => {
  const body = "<html><body>x</body></html>";
  const raw = new Response(body, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache, max-age=0, must-revalidate" } });
  const r = await onRequest(ctx("/", {}, raw));
  assert.equal(r.status, 200);
  const tag = r.headers.get("ETag");
  assert.match(tag, /^W\/"h[0-9a-f]{20}-b1"$/);
  assert.ok(r.headers.get("Content-Length"));
  assert.match(r.headers.get("Cache-Control") || "", /\bno-transform\b/);
  assert.equal(await r.clone().text(), "<html><body>x" + BEACON + "</body></html>");
  const r2 = await onRequest(ctx("/", { "If-None-Match": tag }, new Response(body, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } })));
  assert.equal(r2.status, 304); assert.equal(await r2.text(), ""); assert.equal(r2.headers.get("ETag"), tag);
  const r3 = await onRequest(ctx("/", { "If-None-Match": tag }, new Response("<html><body>changed</body></html>", { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } })));
  assert.equal(r3.status, 200, "a different body must not 304");
  assert.ok(r3.headers.get("ETag"));
});

test("a 200 HTML response keeps its ETag even if HTMLRewriter would have stripped it", async () => {
  const r = await onRequest(ctx("/ad/FAOR", { "Sec-Fetch-Dest": "document" }, page('"abc123"'), {
    ASSETS: { fetch: async () => page('"shell1"') }
  }));
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("ETag"), 'W/"shell1-b1"');
  assert.ok(await hasBeacon(r));
});

test("admin pages and non-HTML are untouched", async () => {
  const a = await onRequest(ctx("/admin-status.html", {}, page('"adm"')));
  assert.equal(a.headers.get("ETag"), '"adm"');
  assert.doesNotMatch(a.headers.get("Cache-Control") || "", /\bno-transform\b/);
  assert.equal(await a.text(), "<html><body>x</body></html>");
  const j = await onRequest(ctx("/wst/phase.js", { "If-None-Match": 'W/"x-b1"' }, page('"js1"', 200, "application/javascript")));
  assert.equal(j.status, 200); assert.equal(j.headers.get("ETag"), '"js1"');
});

test("top-level section pretty URLs and .html pages get the shell; frames and ?solo=1 keep the inner page", async () => {
  const shell = "<html><body>shell</body></html>";
  const stand = "<html><body>standalone-section</body></html>";
  const env = { ASSETS: { fetch: async (req) => {
    const u = new URL(req.url);
    assert.equal(u.pathname, "/", "shell asset must be fetched from / (same as /ad/*)");
    return new Response(shell, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", ETag: '"shell1"', "Cache-Control": "no-cache, max-age=0, must-revalidate" } });
  } } };
  const paths = [
    "/pilot", "/pilot.html", "/library", "/library.html", "/logbook", "/logbook.html",
    "/brief", "/brief.html", "/calculator", "/calculator.html", "/app", "/app.html",
    "/app?tab=map", "/main", "/main.html", "/status", "/status.html", "/status_demo", "/status_demo.html"
  ];
  for (const p of paths) {
    const r = await onRequest(ctx(p, { "Sec-Fetch-Dest": "document" }, page('"sec"'), env));
    assert.equal(r.status, 200, p + " document should be the shell");
    assert.equal(await r.text(), "<html><body>shell" + BEACON + "</body></html>");
    assert.equal(r.headers.get("ETag"), 'W/"shell1-b1"');
    assert.match(r.headers.get("Cache-Control") || "", /no-cache/);
    assert.match(r.headers.get("Cache-Control") || "", /\bno-transform\b/);
  }
  // cleaner iframe / solo / no-dest checks on canonical paths (query variants included)
  for (const p of ["/pilot", "/library.html", "/calculator", "/app?tab=map", "/main.html", "/status_demo.html"]) {
    const iframe = await onRequest(ctx(p, { "Sec-Fetch-Dest": "iframe" }, new Response(stand, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", ETag: '"sec1"' } }), env));
    assert.equal(iframe.status, 200, p + " iframe must stay standalone");
    assert.equal(await iframe.text(), "<html><body>standalone-section" + BEACON + "</body></html>");
    const soloUrl = p.includes("?") ? p.replace("?", "?solo=1&") : p + "?solo=1";
    const solo = await onRequest(ctx(soloUrl, { "Sec-Fetch-Dest": "document" }, new Response(stand, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", ETag: '"sec1"' } }), env));
    assert.equal(await solo.text(), "<html><body>standalone-section" + BEACON + "</body></html>", soloUrl + " must stay standalone");
    const old = await onRequest(ctx(p, {}, new Response(stand, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", ETag: '"sec1"' } }), env));
    assert.equal(await old.text(), "<html><body>standalone-section" + BEACON + "</body></html>", p + " without Sec-Fetch-Dest must not rewrite");
  }
  // /c/app.html and /c/main.html are iframe sources — never rewrite to the shell
  for (const p of ["/c/app.html", "/c/main.html", "/index.html"]) {
    const r = await onRequest(ctx(p, { "Sec-Fetch-Dest": "document" }, new Response(stand, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", ETag: '"sec1"' } }), env));
    assert.equal(await r.text(), "<html><body>standalone-section" + BEACON + "</body></html>", p + " must not be rewritten");
  }
  // Without ASSETS, keep a 302 fallback so tests/old environments do not download the standalone page
  const r302 = await onRequest(ctx("/pilot.html", { "Sec-Fetch-Dest": "document" }));
  assert.equal(r302.status, 302); assert.equal(r302.headers.get("Location"), "/index.html#pilot");
  const rApp = await onRequest(ctx("/app?tab=map", { "Sec-Fetch-Dest": "document" }));
  assert.equal(rApp.status, 302); assert.equal(rApp.headers.get("Location"), "/index.html#map");
});

test("top-level /ad/* and /c/ad/* document visits get the shell; frames and ?solo=1 keep the standalone page", async () => {
  const shell = "<html><body>shell</body></html>";
  const stand = "<html><body>standalone-FAOR</body></html>";
  const env = { ASSETS: { fetch: async () => new Response(shell, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", ETag: '"shell1"', "Cache-Control": "no-cache, max-age=0, must-revalidate" } }) } };
  for (const p of ["/ad/FAOR", "/ad/FAOR.html", "/ad/FACT", "/c/ad/FAOR", "/c/ad/FAOR.html"]) {
    const r = await onRequest(ctx(p, { "Sec-Fetch-Dest": "document" }, page('"ad"'), env));
    assert.equal(r.status, 200, p + " document should be the shell");
    assert.equal(await r.text(), "<html><body>shell" + BEACON + "</body></html>");
    assert.equal(r.headers.get("ETag"), 'W/"shell1-b1"');
    assert.match(r.headers.get("Cache-Control") || "", /no-cache/);
    assert.match(r.headers.get("Cache-Control") || "", /\bno-transform\b/);
    const iframe = await onRequest(ctx(p, { "Sec-Fetch-Dest": "iframe" }, new Response(stand, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", ETag: '"ad1"' } }), env));
    assert.equal(await iframe.text(), "<html><body>standalone-FAOR" + BEACON + "</body></html>", p + " iframe must stay standalone");
    const solo = await onRequest(ctx(p + "?solo=1", { "Sec-Fetch-Dest": "document" }, new Response(stand, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", ETag: '"ad1"' } }), env));
    assert.equal(await solo.text(), "<html><body>standalone-FAOR" + BEACON + "</body></html>", p + "?solo=1 must stay standalone");
    const old = await onRequest(ctx(p, {}, new Response(stand, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", ETag: '"ad1"' } }), env));
    assert.equal(await old.text(), "<html><body>standalone-FAOR" + BEACON + "</body></html>", p + " without Sec-Fetch-Dest must not rewrite (iframes on old browsers)");
  }
});
