// Refresh feedback must reflect the page's result, including its saved-data path.
// Run with: node --test tests/perf/refresh-outcome.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const script = readFileSync(new URL('../../site/wst/wst-refresh.js', import.meta.url), 'utf8');
const faor = readFileSync(new URL('../../site/ad/FAOR.html', import.meta.url), 'utf8');
const goStart = faor.indexOf('async function go(){');
const faorGo = faor.slice(goStart, faor.indexOf('\nb.onclick=', goStart));
assert.ok(goStart >= 0 && faorGo.includes("if(!m)throw 0"), 'use the actual FAOR missing-station handler');

function browser({ actualFaor = false, hasLabel = true, handler, rejectApi = false } = {}) {
  let clock = Date.UTC(2026, 10, 12, 20, 0), nextTimer = 1;
  const timers = new Map(), observers = [], requests = [];
  function changed(target) {
    for (const observer of observers) {
      if (!observer.targets.has(target) || observer.queued) continue;
      observer.queued = true;
      queueMicrotask(() => {
        observer.queued = false;
        if (observer.targets.size) observer.callback([]);
      });
    }
  }
  function element() {
    const target = { dataset: {}, title: '' }, classes = new Set();
    let text = '';
    target.classList = {
      add(...names) { for (const name of names) if (!classes.has(name)) { classes.add(name); changed(target); } },
      remove(...names) { for (const name of names) if (classes.delete(name)) changed(target); },
      contains(name) { return classes.has(name); },
    };
    Object.defineProperty(target, 'textContent', {
      get() { return text; },
      set(value) { if (text !== value) { text = value; changed(target); } },
    });
    return target;
  }
  class Observer {
    constructor(callback) { this.callback = callback; this.targets = new Set(); observers.push(this); }
    observe(target) { this.targets.add(target); }
    disconnect() { this.targets.clear(); }
  }
  class Response {
    constructor(body, { status = 200 } = {}) { this.body = body; this.status = status; this.ok = status >= 200 && status < 300; }
    async text() { return this.body; }
    async json() { return JSON.parse(this.body); }
  }
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [clock])); }
    static now() { return clock; }
  }
  const b = element(), lab = element();
  const context = {
    b, lab, Response, Date: Clock, Event, MutationObserver: Observer, navigator: { onLine: true },
    setTimeout(callback, delay) { const id = nextTimer++; timers.set(id, { callback, due: clock + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    setInterval() { return nextTimer++; }, clearInterval() {}, addEventListener() {},
    async fetch(url) { requests.push(url); if (rejectApi) throw new Error('offline'); return new Response('[]'); },
    document: {
      hidden: false, createElement: () => ({}), head: { appendChild() {} },
      querySelector: (selector) => selector === '.wrf' ? b : selector === '.wupd' && hasLabel ? lab : null,
      querySelectorAll: () => [], addEventListener() {}, dispatchEvent() {},
    },
  };
  context.window = context;
  vm.createContext(context);
  b.onclick = () => handler?.(b, lab);
  if (actualFaor) vm.runInContext(faorGo + ';b.onclick=e=>{e.stopPropagation();go()}', context);
  vm.runInContext(script, context);
  async function flush() { for (let i = 0; i < 30; i++) await Promise.resolve(); }
  async function click() {
    clock += 1000;
    const result = b.onclick({ stopPropagation() {} });
    await flush();
    for (let i = 0; timers.size && i < 20; i++) {
      const [id, timer] = [...timers].sort((a, z) => a[1].due - z[1].due)[0];
      timers.delete(id); clock = timer.due; timer.callback(); await flush();
    }
    assert.equal(timers.size, 0, 'refresh settles and cancels its timeout');
    await result;
  }
  return { b, lab, context, requests, click, setHandler(value) { handler = value; }, setReject(value) { rejectApi = value; } };
}

test('actual FAOR handler keeps Snapshot when successful API arrays omit the station', async () => {
  const page = browser({ actualFaor: true }), last = page.context.WQLAST;
  await page.click();
  assert.equal(page.lab.textContent, 'Snapshot');
  assert.equal(page.b.title, 'Showing saved data');
  assert.equal(page.context.WQLAST, last);
  assert.ok(page.b.classList.contains('off') && page.lab.classList.contains('off'));
  assert.equal(page.requests.length, 2, 'page refresh reuses the two API responses');
});

test('retains the exact Snapshot explanation', async () => {
  const page = browser({ handler(b, lab) { lab.textContent = 'Snapshot · live unavailable'; b.classList.remove('ld'); } });
  await page.click();
  assert.equal(page.lab.textContent, 'Snapshot · live unavailable');
  assert.equal(page.b.title, 'Showing saved data');
  page.setHandler((b, lab) => { lab.textContent = 'Updated 22:01'; b.classList.remove('ld'); });
  await page.click();
  assert.match(page.lab.textContent, /^Updated /);
  assert.ok(!page.b.classList.contains('off') && !page.lab.classList.contains('off'));
});

test('successful refresh keeps Updated feedback and advances the refresh time', async () => {
  const page = browser({ handler(b, lab) { lab.textContent = 'Updated 22:00'; b.classList.remove('ld'); } });
  const last = page.context.WQLAST;
  await page.click();
  assert.match(page.lab.textContent, /^Updated \d{2}:\d{2}$/);
  assert.ok(page.context.WQLAST > last);
  assert.ok(!page.b.classList.contains('off') && !page.lab.classList.contains('off'));
});

test('removing the loading class still signals success without a label', async () => {
  const page = browser({ hasLabel: false, handler(b) { b.classList.remove('ld'); } }), last = page.context.WQLAST;
  await page.click();
  assert.match(page.b.title, /^Updated /);
  assert.ok(page.context.WQLAST > last);
});

test('API rejection retains the existing Offline feedback', async () => {
  let invoked = false;
  const page = browser({ rejectApi: true, handler() { invoked = true; } }), last = page.context.WQLAST;
  await page.click();
  assert.equal(invoked, false);
  assert.equal(page.lab.textContent, 'Offline · showing saved data');
  assert.equal(page.b.title, 'Offline · showing saved data');
  assert.equal(page.context.WQLAST, last);
  page.setReject(false);
  page.setHandler((b, lab) => { lab.textContent = 'Updated 22:01'; b.classList.remove('ld'); });
  await page.click();
  assert.match(page.lab.textContent, /^Updated /);
  assert.ok(page.context.WQLAST > last);
  assert.ok(!page.b.classList.contains('off') && !page.lab.classList.contains('off'));
});

for (const [name, handler] of [
  ['synchronous page error', () => { throw new Error('page error'); }],
  ['rejected page handler', () => Promise.reject(new Error('page error'))],
  ['15-second page timeout', () => {}],
]) test(name + ' retains saved-data feedback and allows the next retry to recover', async () => {
  const page = browser({ handler }), last = page.context.WQLAST;
  await page.click();
  assert.equal(page.lab.textContent, 'Snapshot');
  assert.equal(page.b.title, 'Showing saved data');
  assert.equal(page.context.WQLAST, last);
  assert.ok(page.b.classList.contains('off'));
  page.setHandler((b, lab) => { lab.textContent = 'Updated 22:01'; b.classList.remove('ld'); });
  await page.click();
  assert.match(page.lab.textContent, /^Updated /);
  assert.ok(page.context.WQLAST > last);
  assert.ok(!page.b.classList.contains('off') && !page.lab.classList.contains('off'));
});
