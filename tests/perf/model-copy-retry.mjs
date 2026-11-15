// Weather transport regression: a failed initial model read follows the existing
// 60-second failed-copy retry delay. Weather values and freshness rules stay unchanged.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { test } from 'node:test';

const site = process.env.SITE_DIR || path.resolve('site');
const source = fs.readFileSync(path.join(site, 'wm-model.js'), 'utf8');
const START = Date.parse('2026-11-12T12:15:00Z');
const query = 'https://api.open-meteo.com/v1/forecast?latitude=-26.1&longitude=28.1&current=temperature_2m&wind_speed_unit=kn';
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

function copy({ fetched = '2026-11-12T12:00:00Z' } = {}) {
  return {
    updatedAt: fetched, vars: ['temperature_2m'], units: { temperature_2m: '°C' },
    pts: [['TEST', -26.1, 28.1]], time: ['2026-11-12T12:00'],
    v: { temperature_2m: [[20]] }, ft: [fetched], el: [1000],
  };
}

function harness(model = async () => new Response('{}', { status: 503 })) {
  let epoch = START;
  const store = new Map(), hits = [];
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [epoch])); }
    static now() { return epoch; }
  }
  const storage = {
    getItem: key => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
    removeItem: key => store.delete(key),
    get length() { return store.size; },
    key: index => [...store.keys()][index],
  };
  const document = { body: null, addEventListener() {} };
  const top = { document };
  const load = () => {
    const window = {
      document, frameElement: null, top,
      fetch: async url => {
        hits.push(url);
        return url === '/api/model-weather' ? model() : new Response('{}', { status: 503 });
      },
    };
    vm.runInNewContext(source, {
      window, document, localStorage: storage, location: { origin: 'https://example.test' },
      Date: Clock, Intl, URL, Response, Promise, setTimeout, clearTimeout,
    });
    return window;
  };
  return {
    load, hits, store, top,
    advance: ms => { epoch += ms; },
    modelReads: () => hits.filter(url => url === '/api/model-weather').length,
  };
}

test('five sequential cold failures read the model once and retry at the 60-second boundary', async () => {
  const h = harness(), page = h.load();
  for (let i = 0; i < 5; i++) {
    assert.equal((await page.fetch(query)).status, 429);
    await tick();
  }
  assert.equal(h.modelReads(), 1);
  h.advance(59999);
  assert.equal((await page.fetch(query)).status, 429);
  await tick();
  assert.equal(h.modelReads(), 1);
  h.advance(1);
  assert.equal((await page.fetch(query)).status, 429);
  await tick();
  assert.equal(h.modelReads(), 2);
});

test('concurrent requests and same-origin frames share one initial failed network read', async () => {
  const h = harness(), first = h.load(), second = h.load();
  const replies = await Promise.all([first.fetch(query), first.fetch(query), second.fetch(query)]);
  assert.deepEqual(replies.map(response => response.status), [429, 429, 429]);
  await tick();
  assert.equal(h.modelReads(), 1);
  assert.equal((await second.fetch(query)).status, 429);
  await tick();
  assert.equal(h.modelReads(), 1);
});

test('a successful retry returns the unchanged weather values and normal shared copy cache', async () => {
  let attempts = 0;
  const h = harness(async () => ++attempts === 1
    ? new Response('{}', { status: 503 })
    : new Response(JSON.stringify(copy()), { status: 200 }));
  const page = h.load();
  assert.equal((await page.fetch(query)).status, 429);
  await tick();
  h.advance(60000);
  const result = await page.fetch(query);
  assert.equal(result.status, 200);
  const weather = await result.json();
  assert.deepEqual(weather.current, { time: '2026-11-12T12:00', interval: 3600, temperature_2m: 20 });
  assert.equal(weather.wingman_fetched, '2026-11-12T12:00:00.000Z');
  assert.equal(weather.wingman_copy, '2026-11-12T12:00:00Z');
  assert.equal(weather.elevation, 1000);
  await tick();
  const second = h.load();
  assert.deepEqual((await (await second.fetch(query)).json()).current, weather.current);
  assert.equal(h.modelReads(), 2);
});

test('successful initial reads retain normal copy reuse without a failure delay', async () => {
  const h = harness(async () => new Response(JSON.stringify(copy()), { status: 200 }));
  const page = h.load();
  for (let i = 0; i < 3; i++) {
    const result = await page.fetch(query);
    assert.equal(result.status, 200);
    assert.equal((await result.json()).current.temperature_2m, 20);
    await tick();
  }
  assert.equal(h.modelReads(), 1);
});

test('the retry delay never makes stale saved weather current', async () => {
  const h = harness(), old = copy({ fetched: '2026-11-12T08:00:00Z' });
  old.got = START - 11 * 60e3;
  h.store.set('wm.mw.v2', JSON.stringify(old));
  const page = h.load();
  const result = await page.fetch(query);
  assert.equal(result.status, 200);
  assert.equal((await result.json()).current, undefined);
  await tick();
  assert.equal((await (await page.fetch(query)).json()).current, undefined);
  assert.equal(h.modelReads(), 1);
});
