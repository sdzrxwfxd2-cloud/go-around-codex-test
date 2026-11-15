// Regression checks for cache failures and ownership. Run with optional SITE_DIR.
// All network and CacheStorage dependencies are controlled: no live writes or weather requests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { test } from 'node:test';

const site = process.env.SITE_DIR || path.resolve('site');
const sw = fs.readFileSync(path.join(site, 'sw.js'), 'utf8');
const launcher = fs.readFileSync(path.join(site, 'wm-sw.js'), 'utf8');
const origin = 'https://example.test';

function worker({ caches = {}, network = async () => ({ ok: true, type: 'basic', clone: () => ({ arrayBuffer: async () => new ArrayBuffer(0) }) }), kill = false } = {}) {
  const handlers = {}, state = { claimed: 0, unregistered: 0, fetched: 0 };
  vm.runInNewContext(kill ? sw.replace('const KILL = false;', 'const KILL = true;') : sw, {
    self: {
      addEventListener: (type, handler) => handlers[type] = handler,
      location: { origin, href: origin + '/sw.js' },
      clients: { claim: async () => { state.claimed++; } },
      registration: { unregister: async () => { state.unregistered++; } },
    },
    caches, URL, Response, Request, crypto,
    fetch: async req => { state.fetched++; return network(req); },
  });
  return { handlers, state };
}

async function activate(w) {
  let work;
  w.handlers.activate({ waitUntil: p => work = p });
  await work;
}

function event(overrides = {}) {
  const waits = [];
  const e = {
    request: { method: 'GET', url: origin + '/app.js?v=1234567890', headers: { has: () => false }, ...overrides },
    response: null,
    respondWith(p) { this.response = p; },
    waitUntil(p) { waits.push(p); },
    waits,
  };
  return e;
}

for (const failure of ['open', 'match']) {
  test(`network still serves hashed code when cache ${failure} rejects`, async () => {
    const expected = { ok: true, type: 'opaque' };
    const w = worker({
      caches: { open: async () => {
        if (failure === 'open') throw Error('CacheStorage unavailable');
        return { match: async () => { throw Error('cache read failed'); } };
      } },
      network: async () => expected,
    });
    const e = event(); w.handlers.fetch(e);
    assert.equal(await e.response, expected);
    await Promise.all(e.waits);
    assert.equal(w.state.fetched, 1);
  });
}

test('healthy cache hits still avoid the network', async () => {
  const expected = { cached: true };
  const w = worker({ caches: { open: async () => ({ match: async () => expected }) } });
  const e = event(); w.handlers.fetch(e);
  assert.equal(await e.response, expected);
  assert.equal(w.state.fetched, 0);
});

test('healthy cache misses return the network response and tolerate cache-write failure', async () => {
  const body = new TextEncoder().encode('hash-checked code');
  const hash = Buffer.from(await crypto.subtle.digest('SHA-256', body)).toString('hex').slice(0, 10);
  let writes = 0;
  const response = { ok: true, type: 'basic', headers: {}, clone: () => ({ arrayBuffer: async () => body.buffer }) };
  const w = worker({ caches: { open: async () => ({
    match: async () => null,
    put: async () => { writes++; throw Error('quota exceeded'); },
  }) }, network: async () => response });
  const e = event({ url: origin + '/app.js?v=' + hash }); w.handlers.fetch(e);
  assert.equal(await e.response, response);
  await Promise.all(e.waits);
  assert.equal(w.state.fetched, 1);
  assert.equal(writes, 1);
});

for (const kill of [false, true]) {
  test(`activation preserves other apps' caches (kill=${kill})`, async () => {
    const deleted = [];
    const w = worker({ kill, caches: {
      keys: async () => ['ga-sw-0', 'ga-sw-1', 'other-app-cache', 'weather-snapshot'],
      delete: async name => deleted.push(name),
    } });
    await activate(w);
    assert.deepEqual(deleted, kill ? ['ga-sw-0', 'ga-sw-1'] : ['ga-sw-0']);
    assert.equal(w.state.claimed, kill ? 0 : 1);
    assert.equal(w.state.unregistered, kill ? 1 : 0);
  });
}

for (const kill of [false, true]) {
  test(`activation tolerates unavailable cache storage (kill=${kill})`, async () => {
    const w = worker({ kill, caches: { keys: async () => { throw Error('storage unavailable'); } } });
    await activate(w);
    assert.equal(w.state.claimed, kill ? 0 : 1);
    assert.equal(w.state.unregistered, kill ? 1 : 0);
  });
}

test('pages, APIs, external resources, unversioned code, POST and Range retain browser defaults', () => {
  const w = worker();
  for (const overrides of [
    { url: origin + '/main.html' },
    { url: origin + '/api/data.js?v=1234567890' },
    { url: origin + '/admin/app.js?v=1234567890' },
    { url: 'https://other.test/app.js?v=1234567890' },
    { url: origin + '/app.js' },
    { method: 'POST' },
    { headers: { has: name => name === 'range' } },
  ]) {
    const e = event(overrides); w.handlers.fetch(e);
    assert.equal(e.response, null, JSON.stringify(overrides));
  }
});

test('opt-out unregisters only the root Go Around worker', async () => {
  const removed = [];
  const registration = (name, scope, active, waiting = null, installing = null) => ({
    scope, active: active && { scriptURL: active }, waiting: waiting && { scriptURL: waiting }, installing: installing && { scriptURL: installing },
    unregister: async () => { removed.push(name); },
  });
  const window = {}; window.top = window;
  vm.runInNewContext(launcher, {
    window, URL,
    navigator: { serviceWorker: { getRegistrations: async () => [
      registration('ours', origin + '/', origin + '/sw.js'),
      registration('unrelated-root-script', origin + '/', origin + '/other-sw.js'),
      registration('unrelated-scope', origin + '/other/', origin + '/sw.js'),
      registration('installing-ours', origin + '/', null, null, origin + '/sw.js'),
      registration('unrelated-waiting', origin + '/', null, origin + '/other-sw.js'),
    ] } },
    localStorage: { getItem: () => '1' },
    location: { protocol: 'https:', hostname: 'example.test', href: origin + '/main.html' },
  });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(removed, ['ours', 'installing-ours']);
});
