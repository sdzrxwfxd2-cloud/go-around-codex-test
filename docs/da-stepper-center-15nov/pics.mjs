// Status DA stepper centering: 390/320, 4 themes. Before = live tip (unfixed), after = this branch.
import { createRequire } from "node:module";
import http from "node:http";
import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { createWriteStream } from "node:fs";

const { chromium } = createRequire("/workspace/tools/browser-playwright/node_modules/")("playwright");
const OUT = "/workspace/da-stepper-15nov";
await mkdir(OUT, { recursive: true });
const T = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".woff": "font/woff", ".webp": "image/webp", ".jpg": "image/jpeg" };

const PHASE = process.argv[1] && process.argv.includes("after") ? "after" : (process.argv.includes("before") ? "before" : "before");
const ROOT = process.argv.find((a) => a.startsWith("root="))?.slice(5) || "/workspace/wt-da-stepper-15nov/site";
const PORT = Number(process.argv.find((a) => a.startsWith("port="))?.slice(5) || (PHASE === "after" ? 8992 : 8991));

async function start(root, port) {
  const s = http.createServer(async (req, res) => {
    const p = decodeURIComponent(req.url.split("?")[0]);
    if (p.startsWith("/api/")) {
      if (req.method !== "GET") { res.writeHead(204); return res.end(); }
      try {
        const r = await fetch("https://go-around-aero.pages.dev" + req.url);
        res.writeHead(r.status, { "content-type": r.headers.get("content-type") || "application/json" });
        return res.end(Buffer.from(await r.arrayBuffer()));
      } catch { res.writeHead(502); return res.end(); }
    }
    let rel = normalize(p).replace(/^(\.\.[/\\])+/, ""); if (rel.endsWith("/")) rel += "index.html";
    for (const cand of [rel, rel + ".html"]) {
      const f = join(root, cand);
      try { if ((await stat(f)).isFile()) { res.writeHead(200, { "content-type": T[extname(f)] || "application/octet-stream" }); return res.end(await readFile(f)); } } catch {}
    }
    res.writeHead(404); res.end("");
  });
  await new Promise((r) => s.listen(port, "127.0.0.1", r));
  return { url: `http://127.0.0.1:${port}`, close: () => new Promise((r) => s.close(r)) };
}

function zoomPng(srcBuf, scale) {
  // nearest-neighbour upscale so pixel alignment stays visible
  return (async () => {
    const { default: sharp } = await import("/workspace/wt-bg-verdicts-15nov/node_modules/sharp/lib/index.js").catch(() => ({ default: null }));
    if (sharp) return sharp(srcBuf).resize({ width: undefined, height: undefined, kernel: "nearest" });
    return null;
  })();
}

const THEMES = [
  ["night", "purple", "amethyst"],
  ["night", "black", "midnight"],
  ["day", "white", "pearl"],
  ["day", "beige", "champagne"]
];

const srv = await start(ROOT, PORT);
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const metrics = [];

async function measureAndShot({ width, theme, pal, name, tag, zoom }) {
  const dsf = zoom ? 3 : 2;
  const ctx = await b.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: dsf, serviceWorkers: "block" });
  await ctx.addInitScript(({ theme, pal }) => {
    const d = {
      "wm-theme": theme, "wm-pal": pal, "wm-count": "all", "wm-ac": "C172",
      "wm-lvl": "cpl", "wm-night": "1", "wm-rules": "vfr", "wm.phaseMode": "depart",
      "wm-da-verdict": "1", "wm-da-limit": "2500"
    };
    for (const k in d) localStorage.setItem(k, d[k]);
  }, { theme, pal });
  const p = await ctx.newPage();
  await p.goto(srv.url + "/status_demo.html?solo=1", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForSelector(".v4 .da-lim", { timeout: 30000 });
  await p.waitForTimeout(1800);
  // ensure theme stuck
  await p.evaluate(([theme, pal]) => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("data-pal", pal);
  }, [theme, pal]);
  await p.waitForTimeout(200);

  const info = await p.evaluate(() => {
    function bars(el) {
      const cs = getComputedStyle(el);
      const before = getComputedStyle(el, "::before");
      const after = getComputedStyle(el, "::after");
      const r = el.getBoundingClientRect();
      let text = null;
      if ((el.textContent || "").trim()) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const tr = range.getBoundingClientRect();
        text = {
          w: +tr.width.toFixed(2), h: +tr.height.toFixed(2),
          cx: +(tr.left + tr.width / 2 - r.left).toFixed(2),
          cy: +(tr.top + tr.height / 2 - r.top).toFixed(2),
          dx: +(tr.left + tr.width / 2 - (r.left + r.width / 2)).toFixed(2),
          dy: +(tr.top + tr.height / 2 - (r.top + r.height / 2)).toFixed(2)
        };
      }
      return {
        dir: el.dataset.dir,
        w: +r.width.toFixed(2), h: +r.height.toFixed(2),
        radius: cs.borderRadius,
        isCircle: Math.abs(r.width - r.height) < 0.5 && (cs.borderRadius === "50%" || parseFloat(cs.borderRadius) >= r.width / 2 - 0.5),
        font: cs.font,
        text: (el.textContent || "").trim(),
        glyph: text,
        before: { content: before.content, w: before.width, h: before.height, left: before.left, top: before.top, transform: before.transform },
        after: { content: after.content, w: after.width, h: after.height, left: after.left, top: after.top, transform: after.transform }
      };
    }
    const steps = [...document.querySelectorAll(".v4 .da-step")].map(bars);
    const lim = document.querySelector(".v4 .da-lim");
    const lr = lim.getBoundingClientRect();
    return {
      theme: document.documentElement.getAttribute("data-theme"),
      pal: document.documentElement.getAttribute("data-pal"),
      val: (document.querySelector(".da-val") || {}).textContent?.replace(/\s+/g, " ").trim(),
      stepper: { w: +lr.width.toFixed(2), h: +lr.height.toFixed(2) },
      steps
    };
  });
  metrics.push({ phase: PHASE, tag, width, theme, pal, name, dsf, info });

  const sec = await p.$(".v4 .pl.da");
  const sectionHandle = await p.evaluateHandle(() => {
    const bt = document.querySelector(".v4 .pl.da");
    return bt ? (bt.closest("section, .sec") || bt.parentElement) : null;
  });
  const section = sectionHandle.asElement();
  const stepper = await p.$(".v4 .da-lim");
  const minus = await p.$('.v4 .da-step[data-dir="-1"]');
  const plus = await p.$('.v4 .da-step[data-dir="1"]');

  const base = `${OUT}/${PHASE}-${tag}`;
  if (section) {
    await section.scrollIntoViewIfNeeded();
    await p.waitForTimeout(150);
    if (!zoom) await section.screenshot({ path: `${base}-section.png` });
  }
  if (stepper) await stepper.screenshot({ path: `${base}-stepper.png` });
  if (minus) await minus.screenshot({ path: `${base}-minus.png` });
  if (plus) await plus.screenshot({ path: `${base}-plus.png` });
  if (!zoom) await p.screenshot({ path: `${base}-page.png`, fullPage: false });

  // zoomed composite of the stepper (3x nearest) for Amethyst 390
  if (zoom && stepper) {
    const buf = await stepper.screenshot();
    const zoomPath = `${base}-stepper-zoom.png`;
    // Prefer sharp if present; else write raw and upscale with PIL after
    await writeFile(`${base}-stepper.png`, buf);
    await writeFile(`${OUT}/_zoom_src_${PHASE}.png`, buf);
  }

  await ctx.close();
  return info;
}

// Primary: 390 Amethyst, also a 3x zoom pass
await measureAndShot({ width: 390, theme: "night", pal: "purple", name: "Amethyst", tag: "amethyst-390", zoom: false });
await measureAndShot({ width: 390, theme: "night", pal: "purple", name: "Amethyst", tag: "amethyst-390-zoom", zoom: true });

// 4 themes at 390 and 320
for (const [theme, pal, name] of THEMES) {
  if (!(theme === "night" && pal === "purple")) {
    await measureAndShot({ width: 390, theme, pal, name, tag: `${name}-390`, zoom: false });
  }
  await measureAndShot({ width: 320, theme, pal, name, tag: `${name}-320`, zoom: false });
}

await writeFile(`${OUT}/metrics-${PHASE}.json`, JSON.stringify(metrics, null, 2) + "\n");
console.log("PHASE", PHASE, "shots done", metrics.length);
for (const m of metrics) {
  const s = (m.info.steps || []).map((x) => `${x.dir}: ${x.w}x${x.h} r=${x.radius} circle=${x.isCircle} text=${JSON.stringify(x.text)} glyph=${JSON.stringify(x.glyph)}`).join(" | ");
  console.log(m.tag, s);
}

await b.close();
await srv.close();
