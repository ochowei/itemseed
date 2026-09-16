#!/usr/bin/env node
// scripts/check-i18n.mjs
// Static integrity check for i18n. Diffs zh-Hant vs en vs ja key sets and
// greps index.html for data-i18n-key / data-i18n-attr-* references. Run via:
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
  const ja = await loadTable('i18n/ja.js',      'I18N_JA');

  const tables = {
    'zh-Hant': zh,
    'en':      en,
    'ja':      ja,
  };

  const allKeys = new Set([
    ...Object.keys(zh),
    ...Object.keys(en),
    ...Object.keys(ja),
  ]);

  const missingByLang = {};
  for (const [lang, tbl] of Object.entries(tables)) {
    const missing = [...allKeys].filter((k) => !(k in tbl)).sort();
    if (missing.length > 0) {
      missingByLang[lang] = missing;
    }
  }

  console.log(`  ${!missingByLang['zh-Hant'] ? '✓' : '✗'} zh-Hant: ${Object.keys(zh).length} keys`);
  console.log(`  ${!missingByLang['en'] ? '✓' : '✗'} en:      ${Object.keys(en).length} keys`);
  console.log(`  ${!missingByLang['ja'] ? '✓' : '✗'} ja:      ${Object.keys(ja).length} keys`);

  if (Object.keys(missingByLang).length === 0) {
    console.log('  ✓ Tables match');
  } else {
    console.log('  ✗ Tables mismatch');
    for (const [lang, missing] of Object.entries(missingByLang)) {
      console.log(`      Missing in ${lang}: [${missing.join(', ')}]`);
    }
    fail = true;
  }

  const htmlKeys = await extractHtmlKeys(resolve(ROOT, 'index.html'));
  const tableKeys = allKeys;

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
