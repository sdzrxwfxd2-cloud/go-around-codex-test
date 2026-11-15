// A failed optional library-data request must be retried on the next search intent.
// No browser or network required: exercise the real search engine with controlled script events.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
const site = process.env.SITE_DIR || fileURLToPath(new URL('../../site/', import.meta.url));
const source = fs.readFileSync(path.join(site, 'fs/fs-core.js'), 'utf8');
const data = { items: [{ t: 'Pilot manual', src: 'Official source', shelf: 'manuals', u: 'https://example.test/manual' }] };

function engine(preloaded) {
  const scripts = [], removed = [];
  const window = {
    FS_D: { a: [], t: [], f: [] },
    WMFSK: { BASE: '', LS: { g: () => null }, I: { s: '' }, esc: s => String(s), touch: false, rerender: () => {} },
  };
  if (preloaded) window.WLR = preloaded;
  vm.runInNewContext(source, {
    window, URL,
    document: {
      currentScript: { src: 'https://example.test/fs/fs-core.js' },
      createElement: () => { const script = { remove: () => removed.push(script) }; return script; },
      head: { appendChild: script => scripts.push(script) },
    },
  });
  return { api: window.WMFSCore, window, scripts, removed };
}

test('a failed library request retries once on the next intent without duplicate concurrent loads', () => {
  const e = engine();
  e.api.lib(); e.api.lib(); e.api.results('manual', 'all');
  assert.equal(e.scripts.length, 1, 'share the first in-flight request');
  e.scripts[0].onerror();
  e.api.lib(); e.api.lib(); e.api.results('manual', 'all');
  assert.equal(e.scripts.length, 2, 'share one new request after failure');
});

test('library results recover after a failed request and successful retry', () => {
  const e = engine(); let rendered = 0;
  e.api.lib(() => rendered++);
  e.scripts[0].onerror();
  e.api.lib(() => rendered++);
  assert.equal(e.scripts.length, 2, 'a new request exists to complete');
  e.window.WLR = data;
  e.scripts[1].onload();
  assert.equal(rendered, 1, 'only the successful request invokes its callback');
  assert.match(e.api.results('manual', 'all'), /Pilot manual/);
  assert.match(e.api.results('manual', 'all'), /https:\/\/example\.test\/manual/);
});

test('successful library data remains cached without duplicate requests or callbacks', () => {
  const e = engine(); let rendered = 0;
  e.api.lib(() => rendered++);
  e.window.WLR = data; e.scripts[0].onload();
  e.api.lib(() => rendered++); e.api.results('manual', 'all');
  assert.equal(e.scripts.length, 1);
  assert.equal(rendered, 1);
  assert.match(e.api.results('manual', 'all'), /Pilot manual/);
});

test('preexisting library data is used immediately without fetching a script', () => {
  const e = engine(data); let rendered = 0;
  e.api.lib(() => rendered++);
  assert.equal(e.scripts.length, 0);
  assert.equal(rendered, 1);
  assert.match(e.api.results('manual', 'all'), /Pilot manual/);
});
