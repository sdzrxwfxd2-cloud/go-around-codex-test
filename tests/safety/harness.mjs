// Shared fake page for the pilot-safety unit tests (13 Nov 2026): loads site scripts into a vm context with a settable clock.
import { readFileSync } from "node:fs";
import vm from "node:vm";
export const ROOT = new URL("../../", import.meta.url);
export const src = (p) => readFileSync(new URL("site/" + p, ROOT), "utf8");

/** A window with a fixed clock (win.setNow(ms)), localStorage, and just enough DOM for wst-*, wm-model and the wire. */
export function page({ now = Date.now(), store = {}, fetch = null } = {}) {
  let T = now;
  class FDate extends Date { constructor(...a) { if (!a.length) super(T); else super(...a); } static now() { return T; } }
  const listeners = [];
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const attrs = {};
  const el = () => ({ style: {}, dataset: {}, setAttribute() {}, appendChild() {}, remove() {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, querySelector: () => null, querySelectorAll: () => [] });
  const document = { querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, createElement: el, head: el(), body: el(),
    addEventListener: (t, f, c) => listeners.push({ on: "document", t, f, c }), removeEventListener() {}, dispatchEvent(e) { listeners.filter((l) => l.t === e.type).forEach((l) => l.f(e)); return true; },
    documentElement: { classList: { add() {}, remove() {}, contains: () => false }, setAttribute: (k, v) => { attrs[k] = v; }, getAttribute: (k) => attrs[k] ?? null, dataset: {} },
    readyState: "complete", hidden: false, title: "" };
  const warns = [];
  const con = { log() {}, info() {}, error() {}, warn: (...a) => warns.push(a.join(" ")) };
  const win = { document, localStorage: ls, console: con, Date: FDate, Math, JSON, Promise, setTimeout: () => 0, clearTimeout() {}, queueMicrotask, performance: { now: () => 0, mark() {}, measure() {} },
    addEventListener: (t, f, c) => listeners.push({ on: "window", t, f, c }), removeEventListener() {}, dispatchEvent() {}, Event: function (t) { this.type = t; },
    CustomEvent: function (t, d) { this.type = t; this.detail = d && d.detail; }, Response, URL, URLSearchParams, AbortSignal, Intl };
  win.window = win; win.self = win; win.top = win; win.globalThis = win; win.location = { search: "", pathname: "/main.html", href: "http://x/main.html", protocol: "file:" };
  win.fetch = fetch || (() => new Promise(() => {})); win.setInterval = () => 0; win.clearInterval = () => {};
  win.MutationObserver = function () { this.observe = () => {}; this.disconnect = () => {}; };
  vm.createContext(win);
  win.load = (p) => vm.runInContext(src(p), win, { filename: p });
  win.setNow = (t) => { T = t; };
  win.listeners = listeners; win.warns = warns; win.attrs = attrs;
  return win;
}
