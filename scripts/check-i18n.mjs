#!/usr/bin/env node
// scripts/check-i18n.mjs
// Static integrity check for i18n. Diffs zh-Hant vs en key sets and grep
// index.html for data-i18n-key / data-i18n-attr-* references. Run via:
//   node scripts/check-i18n.mjs

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const ROOT       = resolve(__dirname, '..');

async function loadTable(relativePath, globalName) {
  const src = await readFile(resolve(ROOT, relativePath), 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  const table = sandbox.window[globalName];
  if (!table || typeof table !== 'object') {
    throw new Error(`failed to load ${globalName} from ${relativePath}`);
  }
  return table;
}

function diffKeys(a, b) {
  const aKeys = new Set(Object.keys(a));
  const bKeys = new Set(Object.keys(b));
  const missingInB = [...aKeys].filter((k) => !bKeys.has(k)).sort();
  const missingInA = [...bKeys].filter((k) => !aKeys.has(k)).sort();
  return { missingInA, missingInB };
}

async function extractHtmlKeys(htmlPath) {
  const src = await readFile(htmlPath, 'utf8');
  const used = new Set();
  // data-i18n-key="..."
  for (const m of src.matchAll(/data-i18n-key="([^"]+)"/g)) used.add(m[1]);
  // data-i18n-attr-<name>="..."  (name 可含 dash,例如 aria-label)
  for (const m of src.matchAll(/data-i18n-attr-[a-z-]+="([^"]+)"/g)) used.add(m[1]);
  return used;
}

async function main() {
  console.log('Checking i18n consistency...');
  let fail = false;

  const zh = await loadTable('i18n/zh-Hant.js', 'I18N_ZH_HANT');
  const en = await loadTable('i18n/en.js',      'I18N_EN');

  const zhCount = Object.keys(zh).length;
  const enCount = Object.keys(en).length;

  const { missingInA: missingInZh, missingInB: missingInEn } = diffKeys(zh, en);

  const mismatch = missingInEn.length > 0 || missingInZh.length > 0;
  console.log(`  ${mismatch ? '✗' : '✓'} zh-Hant: ${zhCount} keys`);
  console.log(`  ${mismatch ? '✗' : '✓'} en:      ${enCount} keys`);

  if (missingInEn.length === 0 && missingInZh.length === 0) {
    console.log('  ✓ Tables match');
  } else {
    console.log('  ✗ Tables mismatch');
    if (missingInEn.length) console.log(`      Missing in en:      [${missingInEn.join(', ')}]`);
    if (missingInZh.length) console.log(`      Missing in zh-Hant: [${missingInZh.join(', ')}]`);
    fail = true;
  }

  const htmlKeys = await extractHtmlKeys(resolve(ROOT, 'index.html'));
  const tableKeys = new Set([...Object.keys(zh), ...Object.keys(en)]);

  const usedNotInTable = [...htmlKeys].filter((k) => !tableKeys.has(k)).sort();
  const definedNotUsed = [...tableKeys].filter((k) => !htmlKeys.has(k)).sort();

  if (usedNotInTable.length === 0) {
    console.log(`  ✓ HTML uses ${htmlKeys.size} keys, all present in tables`);
  } else {
    console.log(`  ✗ HTML uses keys not in tables: [${usedNotInTable.join(', ')}]`);
    fail = true;
  }

  if (definedNotUsed.length > 0) {
    console.log(`  ⚠ Defined but unused: [${definedNotUsed.join(', ')}]`);
    // warning, not failure
  }

  if (fail) {
    console.log('FAIL');
    process.exit(1);
  } else {
    console.log('PASS');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
