#!/usr/bin/env node
// scripts/test-feature-flags.mjs
// Unit tests for Feature Flags mechanism in ItemSeed (e.g. Bow item type).
// Tests URL parameter precedence, localStorage resolution, DOM option filtering,
// active item type registration, and resolveItemType fallback behavior.
// Run via: node scripts/test-feature-flags.mjs

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

function createSandbox({ search = '', stored = {}, initialTypeValue = 'any' } = {}) {
  const storage = new Map(Object.entries(stored));

  const options = [
    { value: 'any', text: '任意 (any)' },
    { value: 'potion', text: '藥水 (potion)' },
    { value: 'sword', text: '劍 (sword)' },
    { value: 'spear', text: '長矛 (spear)' },
    { value: 'shield', text: '盾牌 (shield)' },
    { value: 'staff', text: '法杖 (staff)' },
    { value: 'bow', text: '弓 (bow)' },
  ];

  options.forEach((opt) => {
    opt.remove = function () {
      const idx = options.findIndex((o) => o.value === opt.value);
      if (idx !== -1) options.splice(idx, 1);
    };
  });

  const typeSelect = {
    value: initialTypeValue,
    options,
    querySelector(sel) {
      const m = sel.match(/option\[value="([^"]+)"\]/);
      if (m) {
        const val = m[1];
        return options.find((o) => o.value === val) || null;
      }
      return null;
    },
    addEventListener() {},
    dispatchEvent() {},
  };

  const seedInput = {
    value: '',
    addEventListener() {},
    trim() { return this.value.trim(); },
  };

  const sizeSelect = {
    value: '32',
    addEventListener() {},
    dispatchEvent() {},
  };

  const dummyBtn = { addEventListener() {}, click() {} };

  const dummyCanvas = {
    width: 32,
    height: 32,
    getContext: () => ({
      imageSmoothingEnabled: false,
      clearRect() {},
      drawImage() {},
      fillRect() {},
      getImageData: () => ({ data: new Uint8ClampedArray(32 * 32 * 4) }),
    }),
    toDataURL: () => 'data:image/png;base64,mock',
  };

  const gridContainer = {
    innerHTML: '',
    appendChild() {},
  };

  const langSelect = { value: 'zh-Hant', addEventListener() {} };
  const themeSelect = { value: 'light', addEventListener() {} };

  const documentElements = {
    'seed-input': seedInput,
    'type-select': typeSelect,
    'size-select': sizeSelect,
    'generate-btn': dummyBtn,
    'download-btn': dummyBtn,
    'reroll-seed-btn': dummyBtn,
    'preview-canvas': dummyCanvas,
    'grid-container': gridContainer,
    'lang-select': langSelect,
    'theme-select': themeSelect,
  };

  const document = {
    getElementById(id) {
      return documentElements[id] || null;
    },
    createElement(tag) {
      if (tag === 'canvas') {
        return {
          width: 32,
          height: 32,
          getContext: () => ({
            imageSmoothingEnabled: false,
            clearRect() {},
            drawImage() {},
            fillRect() {},
            getImageData: () => ({ data: new Uint8ClampedArray(32 * 32 * 4) }),
          }),
          toDataURL: () => 'data:image/png;base64,mock',
        };
      }
      if (tag === 'div') {
        return {
          className: '',
          appendChild() {},
          addEventListener() {},
        };
      }
      if (tag === 'a') {
        return {
          download: '',
          href: '',
          click() {},
        };
      }
      return {};
    },
  };

  const localStorage = {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
  };

  const sandbox = {
    window: {
      location: { search },
    },
    document,
    localStorage,
    URLSearchParams,
    Uint8ClampedArray,
    Math,
    parseInt,
    // Mock draw functions
    drawPotion: () => {},
    drawSword: () => {},
    drawSpear: () => {},
    drawShield: () => {},
    drawStaff: () => {},
    drawBow: () => {},
    // Mock runtimes
    THEME: { init() {}, getSetting: () => 'light', setTheme() {} },
    I18N: { init() {}, getLang: () => 'en', setLang() {} },
  };

  sandbox.window.document = document;
  sandbox.window.localStorage = localStorage;

  return { sandbox, meta: { storage, typeSelect, options } };
}

async function runInSandbox(setup = {}) {
  const { sandbox, meta } = createSandbox(setup);
  const randomSrc = await readFile(resolve(ROOT, 'random.js'), 'utf8');
  const mainSrc = await readFile(resolve(ROOT, 'main.js'), 'utf8');

  vm.createContext(sandbox);
  vm.runInContext(randomSrc, sandbox);
  vm.runInContext(mainSrc, sandbox);

  return {
    window: sandbox.window,
    meta,
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

function assertEq(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`FAIL ${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

console.log('Running feature flag unit test suite...');

let pass = 0;
let fail = 0;

const cases = [
  {
    name: '1. Default resolution: flag disabled by default',
    test: async () => {
      const { window, meta } = await runInSandbox();
      assertEq(window.FEATURES.isEnabled('bow'), false, 'bow disabled by default');
      assertEq(window.isFeatureEnabled('bow'), false, 'isFeatureEnabled alias matches');
      assert(!('bow' in window.getActiveItemTypes()), 'bow excluded from getActiveItemTypes()');
      assertEq(meta.options.some((o) => o.value === 'bow'), false, 'bow option removed from DOM');
    },
  },
  {
    name: '2. URL parameter ?bow=1 enables bow',
    test: async () => {
      const { window, meta } = await runInSandbox({ search: '?bow=1' });
      assertEq(window.FEATURES.isEnabled('bow'), true, 'bow enabled via ?bow=1');
      assert('bow' in window.getActiveItemTypes(), 'bow present in getActiveItemTypes()');
      assertEq(meta.options.some((o) => o.value === 'bow'), true, 'bow option preserved in DOM');
    },
  },
  {
    name: '3. URL parameter ?bow=true enables bow',
    test: async () => {
      const { window } = await runInSandbox({ search: '?bow=true' });
      assertEq(window.FEATURES.isEnabled('bow'), true, 'bow enabled via ?bow=true');
    },
  },
  {
    name: '4. URL parameter ?features=bow enables bow',
    test: async () => {
      const { window } = await runInSandbox({ search: '?features=bow' });
      assertEq(window.FEATURES.isEnabled('bow'), true, 'bow enabled via ?features=bow');
    },
  },
  {
    name: '5. URL parameter ?features=sword,bow,shield enables bow with comma list',
    test: async () => {
      const { window } = await runInSandbox({ search: '?features=sword,bow,shield' });
      assertEq(window.FEATURES.isEnabled('bow'), true, 'bow enabled via list');
      assertEq(window.FEATURES.isEnabled('staff'), false, 'staff not in list is disabled');
    },
  },
  {
    name: '6. URL parameter ?bow=0 explicitly disables bow',
    test: async () => {
      const { window } = await runInSandbox({ search: '?bow=0', stored: { 'itemseed.feature.bow': 'true' } });
      assertEq(window.FEATURES.isEnabled('bow'), false, 'URL ?bow=0 overrides localStorage');
    },
  },
  {
    name: '7. LocalStorage itemseed.feature.bow="true" enables bow',
    test: async () => {
      const { window, meta } = await runInSandbox({ stored: { 'itemseed.feature.bow': 'true' } });
      assertEq(window.FEATURES.isEnabled('bow'), true, 'bow enabled via storage "true"');
      assertEq(meta.options.some((o) => o.value === 'bow'), true, 'bow option present in DOM');
    },
  },
  {
    name: '8. LocalStorage itemseed.feature.bow="1" enables bow',
    test: async () => {
      const { window } = await runInSandbox({ stored: { 'itemseed.feature.bow': '1' } });
      assertEq(window.FEATURES.isEnabled('bow'), true, 'bow enabled via storage "1"');
    },
  },
  {
    name: '9. LocalStorage itemseed.feature.bow="false" keeps bow disabled',
    test: async () => {
      const { window } = await runInSandbox({ stored: { 'itemseed.feature.bow': 'false' } });
      assertEq(window.FEATURES.isEnabled('bow'), false, 'bow disabled via storage "false"');
    },
  },
  {
    name: '10. URL parameter ?bow=1 overrides localStorage "false"',
    test: async () => {
      const { window } = await runInSandbox({ search: '?bow=1', stored: { 'itemseed.feature.bow': 'false' } });
      assertEq(window.FEATURES.isEnabled('bow'), true, 'URL takes precedence over storage');
    },
  },
  {
    name: '11. FEATURES.setFeature persists to localStorage',
    test: async () => {
      const { window, meta } = await runInSandbox();
      window.FEATURES.setFeature('bow', true);
      assertEq(meta.storage.get('itemseed.feature.bow'), 'true', 'storage updated to true');
      window.FEATURES.setFeature('bow', false);
      assertEq(meta.storage.get('itemseed.feature.bow'), 'false', 'storage updated to false');
    },
  },
  {
    name: '12. resolveItemType fallbacks gracefully to potion when bow requested with flag disabled',
    test: async () => {
      const { window } = await runInSandbox();
      assertEq(window.resolveItemType('bow', 'test-seed'), 'potion', 'falls back to potion');
      assertEq(window.resolveItemType('sword', 'test-seed'), 'sword', 'valid type resolved as-is');
      assertEq(window.resolveItemType('nonexistent', 'test-seed'), 'potion', 'invalid type falls back to potion');
    },
  },
  {
    name: '13. resolveItemType resolves bow when flag is enabled',
    test: async () => {
      const { window } = await runInSandbox({ search: '?bow=1' });
      assertEq(window.resolveItemType('bow', 'test-seed'), 'bow', 'resolves to bow when flag is on');
    },
  },
  {
    name: '14. resolveItemType("any", seed) NEVER picks bow when flag is disabled (100 seeds)',
    test: async () => {
      const { window } = await runInSandbox();
      const baseTypes = new Set(['potion', 'sword', 'spear', 'shield', 'staff']);
      for (let i = 0; i < 100; i++) {
        const seed = `any-test-${i}`;
        const picked = window.resolveItemType('any', seed);
        assert(baseTypes.has(picked), `Picked type "${picked}" must be one of the 5 base types`);
        assert(picked !== 'bow', `resolveItemType("any") picked "bow" with flag off at seed "${seed}"`);
      }
    },
  },
  {
    name: '15. resolveItemType("any", seed) includes bow when flag is enabled',
    test: async () => {
      const { window } = await runInSandbox({ search: '?bow=1' });
      const pickedTypes = new Set();
      for (let i = 0; i < 100; i++) {
        const seed = `any-test-${i}`;
        pickedTypes.add(window.resolveItemType('any', seed));
      }
      assert(pickedTypes.has('bow'), 'resolveItemType("any") must include "bow" when flag is on');
      assert(pickedTypes.has('sword'), 'resolveItemType("any") must include base types');
      assert(pickedTypes.has('potion'), 'resolveItemType("any") must include base types');
    },
  },
  {
    name: '16. UI initialization: typeSelect.value reset to any if initially set to bow when flag is off',
    test: async () => {
      const { meta } = await runInSandbox({ initialTypeValue: 'bow' });
      assertEq(meta.typeSelect.value, 'any', 'typeSelect value reset to "any"');
    },
  },
  {
    name: '17. UI initialization: typeSelect.value preserved if set to bow when flag is on',
    test: async () => {
      const { meta } = await runInSandbox({ search: '?bow=1', initialTypeValue: 'bow' });
      assertEq(meta.typeSelect.value, 'bow', 'typeSelect value preserved as "bow" when enabled');
    },
  },
  {
    name: '18. ITEM_TYPES export contains all 6 types so existing code/tests do not break',
    test: async () => {
      const { window } = await runInSandbox();
      assert('potion' in window.ITEM_TYPES, 'potion in ITEM_TYPES');
      assert('sword' in window.ITEM_TYPES, 'sword in ITEM_TYPES');
      assert('spear' in window.ITEM_TYPES, 'spear in ITEM_TYPES');
      assert('shield' in window.ITEM_TYPES, 'shield in ITEM_TYPES');
      assert('staff' in window.ITEM_TYPES, 'staff in ITEM_TYPES');
      assert('bow' in window.ITEM_TYPES, 'bow in ITEM_TYPES');
    },
  },
];

for (const c of cases) {
  try {
    await c.test();
    console.log(`  ✓ ${c.name}`);
    pass++;
  } catch (err) {
    console.error(`  ✗ ${c.name}`);
    console.error(`      ${err.message}`);
    fail++;
  }
}

console.log(`\n${pass} pass, ${fail} fail`);
if (fail > 0) {
  process.exit(1);
} else {
  console.log('All feature flag tests PASSED!');
}
