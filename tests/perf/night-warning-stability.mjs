// Exercise the actual night-warning block without its weather/verdict dependencies.
// A weather-pill decorator may replace the SVG but preserves the warning's text.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { test } from 'node:test';

const site = process.env.SITE_DIR || path.resolve('site');
const source = fs.readFileSync(path.join(site, 'wst/wq.js'), 'utf8');
const start = source.indexOf('(function(){const list=', source.indexOf('/* MT: the night-rating warning'));
const end = source.indexOf('/* Settings segmented controls:', start);
assert.ok(start >= 0 && end > start, 'find the actual night-warning block');
const block = source.slice(start, end);
const NOW = Date.parse('2026-11-12T18:00:00Z');
const AFTER_SUNSET = 'After sunset · Night not enabled';
const LAND_AFTER_DARK = "You'll land after dark · Night not enabled";

function harness() {
  const events = {}, state = { writes: 0, removals: 0, creations: 0, night: true, times: [] };
  const phase = { mode: 'depart', arrive: { off: 0, at: null } };
  const profile = { rules: 'vfr', night: false, licence: 'ppl' };
  const why = { after: element => { card.warning = element; state.creations++; } };
  function warning(text, decorated = false) {
    let html = (decorated ? '<svg class="wm-flight-icon"><path></path></svg>' : '<svg><path></path></svg>') + text;
    const classes = new Set(['wq-nn']);
    return {
      get textContent() { return html.replace(/<[^>]*>/g, ''); },
      get innerHTML() { return html; },
      set innerHTML(value) { state.writes++; html = value.replaceAll('/>', '></path>'); },
      get className() { return [...classes].join(' '); },
      set className(value) { classes.clear(); value.split(/\s+/).filter(Boolean).forEach(value => classes.add(value)); },
      classList: { toggle(name, force) { force ? classes.add(name) : classes.delete(name); }, contains: name => classes.has(name) },
      decorate() { html = '<svg class="wm-flight-icon"><path></path></svg>' + this.textContent; },
      remove() { card.warning = null; state.removals++; },
    };
  }
  const card = {
    __wm: { heliport: false }, warning: warning(AFTER_SUNSET, true),
    querySelector(selector) {
      return selector === '.why' ? why : selector === '.wq-nn' ? this.warning
        : selector === '.cp[data-p=model]' ? { dataset: { la: '-26.1', lo: '28.1' } }
        : selector === '.icao' ? { textContent: 'FAOR' } : null;
    },
  };
  const list = { querySelectorAll: () => [card] };
  const document = {
    hidden: false,
    getElementById: id => id === 'list' ? list : null,
    createElement: () => warning(''),
    addEventListener: (name, handler) => { events[name] = handler; },
  };
  const WMB = { prof: () => profile };
  const WST = { sunInfo: (la, lo, when) => { state.times.push(when); return { isNight: state.night }; } };
  const window = { WMB, WST, WMPHASE: phase };
  vm.runInNewContext(block, {
    window, document, WMB, WST, WMPHASE: phase, Date: { now: () => NOW },
    requestAnimationFrame: callback => callback(), setInterval() {}, MutationObserver: class { observe() {} },
  });
  return { state, card, profile, phase, run: () => events['wm:pass'](), phaseChanged: () => events['wm:phase']() };
}

test('an unchanged decorated night warning keeps its SVG and performs no HTML writes', () => {
  const h = harness(), original = h.card.warning.innerHTML;
  assert.equal(h.state.writes, 0);
  for (let i = 0; i < 5; i++) h.run();
  assert.equal(h.state.writes, 0);
  assert.equal(h.card.warning.innerHTML, original);
  assert.equal(h.state.removals, 0);
});

test('LAND and arrival-time changes update the same text and caution class once', () => {
  const h = harness();
  h.state.writes = 0;
  h.phase.mode = 'land'; h.phase.arrive.off = 1;
  h.phaseChanged();
  assert.equal(h.card.warning.textContent, LAND_AFTER_DARK);
  assert.equal(h.card.warning.classList.contains('wq-nn-cau'), true);
  assert.equal(h.state.times.at(-1), NOW + 3600e3);
  assert.equal(h.state.writes, 1);
  h.card.warning.decorate();
  h.phase.arrive.at = NOW + 2 * 3600e3;
  h.phaseChanged();
  assert.equal(h.state.times.at(-1), NOW + 2 * 3600e3);
  assert.equal(h.state.writes, 1);
  h.phase.mode = 'depart'; h.phaseChanged();
  assert.equal(h.card.warning.textContent, AFTER_SUNSET);
  assert.equal(h.card.warning.classList.contains('wq-nn-cau'), false);
  assert.equal(h.state.times.at(-1), NOW);
  assert.equal(h.state.writes, 2);
});

test('night qualification, daylight and heliport conditions still remove or restore the warning', () => {
  const h = harness();
  h.profile.night = true; h.run();
  assert.equal(h.card.warning, null);
  assert.equal(h.state.removals, 1);
  h.profile.night = false; h.run();
  assert.equal(h.card.warning.textContent, AFTER_SUNSET);
  assert.equal(h.state.creations, 1);
  h.state.night = false; h.run();
  assert.equal(h.card.warning, null);
  h.state.night = true; h.run();
  assert.equal(h.card.warning.textContent, AFTER_SUNSET);
  h.card.__wm.heliport = true; h.run();
  assert.equal(h.card.warning, null);
});

test('IFR rules and IR qualifications retain the existing warning exclusion', () => {
  for (const [key, value] of [['rules', 'ifr'], ['licence', 'ir']]) {
    const h = harness(); h.profile[key] = value; h.run();
    assert.equal(h.card.warning, null);
  }
});
