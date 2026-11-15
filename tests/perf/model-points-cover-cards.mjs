// Every Aerodromes card's model lookup (data-la/data-lo in wst-cards-data.js) must have a model point in
// netlify/lib/model_points.json within wm-model.js TOL (0.005), else the page shows "Model weather too old" (not in the copy).
import { readFileSync } from "node:fs";
const R = (p) => readFileSync(new URL("../../" + p, import.meta.url), "utf8");
const g = {}; new Function("window", R("site/wst/wst-cards-data.js"))(g);
const P = JSON.parse(R("netlify/lib/model_points.json")), TOL = Number((R("site/wm-model.js").match(/TOL = ([0-9.]+)/) || [])[1]);
if (!(TOL > 0)) { console.error("model-points-cover-cards: TOL not found in wm-model.js"); process.exit(1); }
const miss = [];
for (const h of g.WM_CARD_HTML) { const id = (h.match(/class="icao">([^<]+)</) || [])[1];
  for (const m of h.matchAll(/data-la="([-0-9.]+)" data-lo="([-0-9.]+)"/g)) if (!P.some((p) => Math.abs(p[1] - +m[1]) + Math.abs(p[2] - +m[2]) <= TOL)) miss.push(id); }
if (miss.length) { console.error("model-points-cover-cards: no model point for " + miss.join(" ")); process.exit(1); }
console.log("model-points-cover-cards: ok (" + g.WM_CARD_HTML.length + " cards)");
