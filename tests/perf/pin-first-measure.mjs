// Pin initialization regression: actual attach/setVisible/measure functions with
// deterministic geometry and a controlled pending frame animation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { test } from 'node:test';

const site = process.env.SITE_DIR || path.resolve('site');
const source = fs.readFileSync(path.join(site, 'wm-pin.js'), 'utf8');
const boot = "  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();";
assert.equal(source.split(boot).length, 2, 'locate the module boot without changing production code');

class Style {
  values = {};
  get cssText() { return Object.entries(this.values).map(([key, value]) => `${key}:${value}`).join(';'); }
  set cssText(value) {
    this.values = {};
    for (const rule of value.split(';')) {
      const split = rule.indexOf(':');
      if (split >= 0) this.values[rule.slice(0, split).trim()] = rule.slice(split + 1).trim();
    }
  }
  get visibility() { return this.values.visibility || ''; }
  set visibility(value) { this.values.visibility = value; }
  get display() { return this.values.display || ''; }
  set display(value) { this.values.display = value; }
  get position() { return this.values.position || ''; }
  set position(value) { this.values.position = value; }
  get top() { return this.values.top || ''; }
  set top(value) { this.values.top = value; }
  get left() { return this.values.left || ''; }
  set left(value) { this.values.left = value; }
}

function classNode() {
  const names = new Set();
  return {
    get className() { return [...names].join(' '); },
    getAttribute: () => '', attributes: [],
    classList: {
      contains: name => names.has(name), remove: name => names.delete(name),
      toggle: (name, force) => force ? names.add(name) : names.delete(name),
    },
  };
}

function harness() {
  let pendingAnimation = true;
  const timers = [], hosts = [];
  const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
  const fixture = {};
  function makeDocument() {
    const root = classNode(), bar = classNode();
    bar.getBoundingClientRect = () => rect(20, 261.390625, 350, 158);
    bar.parentElement = { getBoundingClientRect: () => rect(20, 0, 350, 6280) };
    return {
      documentElement: root, body: {}, head: {},
      defaultView: { getComputedStyle: () => ({ marginLeft: '0', marginRight: '0' }) },
      getElementById: id => id === 'tiles' ? bar : null,
    };
  }
  const frame = {
    style: new Style(), offsetHeight: 6280, contentDocument: makeDocument(),
    getBoundingClientRect: () => rect(0, 59, 390, 6280),
    getAnimations: () => pendingAnimation ? [{}] : [],
    parentNode: { insertBefore: host => hosts.push(host) },
  };
  function createHost() {
    const track = { style: new Style() };
    const stick = { style: new Style(), addEventListener() {}, getBoundingClientRect: () => rect(20, 59 + (parseFloat(track.style.top) || 0), 350, 158) };
    const big = { getBoundingClientRect: () => rect(20, 59 + (parseFloat(track.style.top) || 0), 350, 158) };
    fixture.big = big;
    const nodes = { style: { textContent: '' }, '.wmp-track': track, '.wmp-stick': stick, '.wmp-sent': {} };
    const shadow = { querySelector: selector => nodes[selector], innerHTML: '' };
    return { style: new Style(), attachShadow: () => shadow, remove() {}, shadowRoot: shadow };
  }
  const document = {
    createElement: () => createHost(),
    querySelector: selector => selector === 'header.topbar' ? { getBoundingClientRect: () => rect(0, 0, 390, 59) } : null,
  };
  const window = { __fixture: fixture };
  // Orthogonal styling/docking/click helpers are left out of this geometry test.
  // The production attach, moving, measure and setVisible functions run unmodified.
  const expose = `
    frameCss=function(){return ''};syncTheme=function(){};endDock=function(){};
    rebuild=function(){big=window.__fixture.big};buildLauncher=function(){};
    watchScrim=function(){};watchPin=function(){};placeLauncher=function(){};joinHeader=function(){};
    window.__pinTest={attachFrame:function(f){frame=f;attach()},measure:measure,setVisible:setVisible,
      state:function(){return {track:track,fdoc:fdoc}}};
  `;
  vm.runInNewContext(source.replace(boot, expose), {
    window, document, location: { search: '' }, URLSearchParams,
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    MutationObserver: class { observe() {} },
    setTimeout: callback => { timers.push(callback); return timers.length; }, clearTimeout() {},
  });
  const api = window.__pinTest;
  return {
    frame, api, hosts,
    setPending: value => { pendingAnimation = value; },
    replaceDocument: () => { frame.contentDocument = makeDocument(); },
    hiddenReal: () => frame.contentDocument.documentElement.classList.contains('wm-pinhost'),
  };
}

test('a pending initial frame animation keeps the real bar visible and its unmeasured mirror hidden', () => {
  const h = harness(); h.api.attachFrame(h.frame);
  assert.equal(h.hiddenReal(), false);
  assert.equal(h.api.state().track.style.visibility, 'hidden');
  h.api.measure();
  assert.equal(h.hiddenReal(), false);
  assert.equal(h.api.state().track.style.visibility, 'hidden');
});

test('the first successful measure positions the mirror before handing off the same bar', () => {
  const h = harness(); h.api.attachFrame(h.frame); h.setPending(false); h.api.measure();
  const track = h.api.state().track;
  assert.equal(track.style.top, '261.390625px');
  assert.match(track.style.cssText, /width:350px/);
  assert.equal(track.style.visibility, '');
  assert.equal(h.hiddenReal(), true);
});

test('subsequent visibility and transition behavior retains the existing measured mirror', () => {
  const h = harness(); h.api.attachFrame(h.frame); h.setPending(false); h.api.measure();
  h.setPending(true); h.api.setVisible();
  assert.equal(h.api.state().track.style.visibility, '');
  assert.equal(h.hiddenReal(), true);
  h.frame.style.display = 'none'; h.api.setVisible();
  assert.equal(h.api.state().track.style.display, 'none');
  assert.equal(h.hiddenReal(), false);
  h.frame.style.display = ''; h.setPending(false); h.api.setVisible();
  assert.equal(h.api.state().track.style.display, '');
  assert.equal(h.hiddenReal(), true);
});

test('a replacement frame document starts unmeasured rather than inheriting the previous mirror position', () => {
  const h = harness(); h.api.attachFrame(h.frame); h.setPending(false); h.api.measure();
  h.replaceDocument(); h.setPending(true); h.api.attachFrame(h.frame);
  assert.equal(h.hosts.length, 2);
  assert.equal(h.api.state().track.style.visibility, 'hidden');
  assert.equal(h.hiddenReal(), false);
});