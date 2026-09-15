#!/usr/bin/env node
// scripts/test-theme.mjs
// Smoke test for theme.js. Loads theme.js into a sandboxed vm with mocked
// window/document/localStorage/matchMedia, then asserts THEME behaviors.
// Run via:  node scripts/test-theme.mjs

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const ROOT       = resolve(__dirname, '..');

function makeSandbox({ search = '', stored = null, prefersDark = false, hasMatchMedia = true }) {
  const storage = new Map();
  if (stored !== null) storage.set('itemseed.theme', stored);

  const listeners = [];
  const mediaQuery = hasMatchMedia ? {
    matches: prefersDark,
    addEventListener: (_evt, cb) => listeners.push(cb),
  } : null;

  const body = { _attrs: {}, setAttribute(k, v) { this._attrs[k] = v; } };

  const sandbox = {
    window: {
      location: { search },
      matchMedia: hasMatchMedia ? () => mediaQuery : undefined,
    },
    document: { body },
    localStorage: {
      getItem: (k) => storage.has(k) ? storage.get(k) : null,
      setItem: (k, v) => storage.set(k, String(v)),
    },
    URLSearchParams,
  };
  // Capture outputs for assertions
  sandbox._meta = { storage, body, mediaQuery, listeners };
  return sandbox;
}

async function loadTheme(sandbox) {
  const src = await readFile(resolve(ROOT, 'theme.js'), 'utf8');
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.window.THEME;
}

function assertEq(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`FAIL ${msg}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const cases = [
  {
    name: 'no URL, no storage, OS=dark → effective=dark, setting=auto',
    setup: { prefersDark: true },
    run: (THEME, meta) => {
      THEME.init();
      assertEq(THEME.getSetting(), 'auto', 'setting');
      assertEq(THEME.getEffective(), 'dark', 'effective');
      assertEq(meta.body._attrs['data-theme'], 'dark', 'body data-theme');
    },
  },
  {
    name: 'no URL, no storage, OS=light → effective=light, setting=auto',
    setup: { prefersDark: false },
    run: (THEME, meta) => {
      THEME.init();
      assertEq(THEME.getSetting(), 'auto', 'setting');
      assertEq(THEME.getEffective(), 'light', 'effective');
      assertEq(meta.body._attrs['data-theme'], 'light', 'body data-theme');
    },
  },
  {
    name: 'storage=dark, OS=light → effective=dark (stored wins over OS)',
    setup: { stored: 'dark', prefersDark: false },
    run: (THEME, meta) => {
      THEME.init();
      assertEq(THEME.getSetting(), 'dark', 'setting');
      assertEq(THEME.getEffective(), 'dark', 'effective');
      assertEq(meta.body._attrs['data-theme'], 'dark', 'body data-theme');
    },
  },
  {
    name: 'URL=light overrides storage=dark + persists to storage',
    setup: { search: '?theme=light', stored: 'dark', prefersDark: true },
    run: (THEME, meta) => {
      THEME.init();
      assertEq(THEME.getSetting(), 'light', 'setting');
      assertEq(THEME.getEffective(), 'light', 'effective');
      assertEq(meta.storage.get('itemseed.theme'), 'light', 'storage updated');
    },
  },
  {
    name: 'invalid URL value falls back to storage',
    setup: { search: '?theme=banana', stored: 'dark' },
    run: (THEME, _meta) => {
      THEME.init();
      assertEq(THEME.getSetting(), 'dark', 'setting');
    },
  },
  {
    name: 'fallback to legacy iconmachine.theme when itemseed.theme is absent',
    setup: {},
    run: (THEME, meta) => {
      meta.storage.set('iconmachine.theme', 'light');
      THEME.init();
      assertEq(THEME.getSetting(), 'light', 'fallback setting');
      assertEq(THEME.getEffective(), 'light', 'fallback effective');
    },
  },
  {
    name: 'setTheme updates storage + body attribute',
    setup: { prefersDark: false },
    run: (THEME, meta) => {
      THEME.init();
      THEME.setTheme('dark');
      assertEq(THEME.getSetting(), 'dark', 'setting');
      assertEq(meta.body._attrs['data-theme'], 'dark', 'body data-theme');
      assertEq(meta.storage.get('itemseed.theme'), 'dark', 'storage');
    },
  },
  {
    name: 'invalid setTheme value is ignored',
    setup: { stored: 'light' },
    run: (THEME, meta) => {
      THEME.init();
      THEME.setTheme('mauve');
      assertEq(THEME.getSetting(), 'light', 'setting unchanged');
    },
  },
  {
    name: 'matchMedia change while setting=auto re-applies',
    setup: { prefersDark: false },
    run: (THEME, meta) => {
      THEME.init();
      assertEq(meta.body._attrs['data-theme'], 'light', 'initial light');
      meta.mediaQuery.matches = true;
      meta.listeners.forEach((cb) => cb());
      assertEq(meta.body._attrs['data-theme'], 'dark', 'flipped to dark');
    },
  },
  {
    name: 'matchMedia change while setting=light does NOT re-apply',
    setup: { stored: 'light', prefersDark: false },
    run: (THEME, meta) => {
      THEME.init();
      meta.mediaQuery.matches = true;
      meta.listeners.forEach((cb) => cb());
      assertEq(meta.body._attrs['data-theme'], 'light', 'still light');
    },
  },
  {
    name: 'matchMedia unsupported → effective fallback dark',
    setup: { hasMatchMedia: false },
    run: (THEME, meta) => {
      THEME.init();
      assertEq(THEME.getEffective(), 'dark', 'fallback');
    },
  },
];

let pass = 0;
let fail = 0;
for (const c of cases) {
  try {
    const sandbox = makeSandbox(c.setup);
    const THEME = await loadTheme(sandbox);
    c.run(THEME, sandbox._meta);
    console.log(`  ✓ ${c.name}`);
    pass++;
  } catch (e) {
    console.log(`  ✗ ${c.name}`);
    console.log(`      ${e.message}`);
    fail++;
  }
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
