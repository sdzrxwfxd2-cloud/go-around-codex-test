// Extract the repo inputs for build.py into a raw dir: cards.json, aip-rwy.json, wmst.json.  usage: node prep.mjs <site dir> <raw dir>
import fs from 'fs'; import vm from 'vm'; import path from 'path';
const [SITE, RAW] = process.argv.slice(2);
const load = (f) => { const c = { window: {} }; vm.createContext(c); vm.runInContext(fs.readFileSync(path.join(SITE, f), 'utf8'), c); return c.window; };
const H = load('wst/wst-cards-data.js').WM_CARD_HTML;
const cards = H.map(h => ({ id: (h.match(/class="icao">([^<]+)</) || [])[1], nm: (h.match(/<h2>([^<]*)<\/h2>/) || [])[1], cat: (h.match(/data-cat="([^"]*)"/) || [])[1],
  la: +(h.match(/data-la="([^"]+)"/) || [])[1], lo: +(h.match(/data-lo="([^"]+)"/) || [])[1], prov: (h.match(/<span>·<\/span><span>([^<]*)</) || [])[1] }));
fs.writeFileSync(path.join(RAW, 'cards.json'), JSON.stringify(cards));
fs.writeFileSync(path.join(RAW, 'aip-rwy.json'), JSON.stringify(load('rwy/rwy-data.js').WMRWY_DATA));
const w = load('wst/wst-data.js'), e = load('wst/ad-elev.js');
fs.writeFileSync(path.join(RAW, 'wmst.json'), JSON.stringify({ ads: w.WMST.ads, adElev: e.WM_AD_ELEV }));
console.log(cards.length, 'cards');
