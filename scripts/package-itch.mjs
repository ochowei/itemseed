#!/usr/bin/env node
// scripts/package-itch.mjs
// Packages the ItemSeed web application for itch.io HTML5 distribution.
// Ensures all required runtime files are placed directly at the archive root
// with index.html at root level (avoiding folder nesting which breaks itch.io).

import { execFileSync } from 'node:child_process';
import { existsSync, unlinkSync, statSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const ROOT       = resolve(__dirname, '..');

// Dynamically read version from package.json with fallback to 1.0.0
let version = '1.0.0';
try {
  const pkgPath = resolve(ROOT, 'package.json');
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    if (pkg && typeof pkg.version === 'string' && pkg.version.trim()) {
      version = pkg.version.trim();
    }
  }
} catch (err) {
  console.warn(`Warning: Could not read version from package.json: ${err.message}. Defaulting to ${version}`);
}

const ZIP_NAME = `itemseed-v${version}.zip`;
const ZIP_PATH = resolve(ROOT, ZIP_NAME);

// Strictly the runtime deployment files required to run ItemSeed
const DEPLOY_FILES = [
  'index.html',
  'main.js',
  'random.js',
  'palette.js',
  'pixel-utils.js',
  'potion.js',
  'sword.js',
  'spear.js',
  'shield.js',
  'staff.js',
  'theme.js',
  'theme.css',
  'i18n.js',
  'i18n/zh-Hant.js',
  'i18n/en.js',
  'i18n/ja.js',
  'LICENSE',
  'ASSET-LICENSE.md',
];

const FORBIDDEN_PATTERNS = [
  /\.git\b/,
  /node_modules/,
  /package\.json/,
  /package-lock\.json/,
  /\.DS_Store/,
  /^docs\//,
  /^scripts\//,
  /^snapshots\//,
  /^baselines\//,
  /\.png$/,
  /\.zip$/,
];

function main() {
  console.log(`Packaging itch.io release bundle: ${ZIP_NAME}...`);

  // 1. Verify all required deployment files exist on disk
  for (const file of DEPLOY_FILES) {
    const fullPath = resolve(ROOT, file);
    if (!existsSync(fullPath)) {
      console.error(`✗ Error: required deployment file not found: ${file}`);
      process.exit(1);
    }
  }

  // 2. Remove existing archive if present to ensure a clean build
  if (existsSync(ZIP_PATH)) {
    unlinkSync(ZIP_PATH);
  }

  // 3. Create zip archive using system zip binary
  try {
    execFileSync('zip', ['-9', '-q', '-r', ZIP_PATH, ...DEPLOY_FILES], {
      cwd: ROOT,
      stdio: ['ignore', 'inherit', 'inherit'],
    });
  } catch (err) {
    console.error(`✗ Failed to execute zip: ${err.message}`);
    process.exit(1);
  }

  // 4. Verify archive creation and inspect contents
  if (!existsSync(ZIP_PATH)) {
    console.error(`✗ Error: archive was not created at ${ZIP_PATH}`);
    process.exit(1);
  }

  let entries = [];
  try {
    const listOutput = execFileSync('unzip', ['-Z1', ZIP_PATH], { encoding: 'utf8' });
    entries = listOutput.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  } catch (err) {
    console.error(`✗ Failed to inspect zip archive with unzip: ${err.message}`);
    process.exit(1);
  }

  // 5. Assert index.html is at root level
  if (!entries.includes('index.html')) {
    console.error('✗ Validation error: index.html is NOT at the root level of the archive!');
    process.exit(1);
  }

  // 6. Assert all required files are present
  const missingFiles = DEPLOY_FILES.filter((f) => !entries.includes(f));
  if (missingFiles.length > 0) {
    console.error(`✗ Validation error: missing files in archive: ${missingFiles.join(', ')}`);
    process.exit(1);
  }

  // 7. Assert no forbidden dev/source files leaked into archive
  const forbiddenLeaked = entries.filter((entry) =>
    FORBIDDEN_PATTERNS.some((pattern) => pattern.test(entry))
  );
  if (forbiddenLeaked.length > 0) {
    console.error(`✗ Validation error: forbidden files found in archive: ${forbiddenLeaked.join(', ')}`);
    process.exit(1);
  }

  const stats = statSync(ZIP_PATH);
  const sizeKb = (stats.size / 1024).toFixed(1);

  console.log(`  ✓ Package created: ${ZIP_NAME} (${sizeKb} KB)`);
  console.log(`  ✓ itch.io requirement verified: index.html is at root level`);
  console.log(`  ✓ Included files (${DEPLOY_FILES.length} items):`);
  for (const f of DEPLOY_FILES) {
    console.log(`      - ${f}`);
  }
  console.log(`  ✓ Zero dev or repo-only artifacts leaked`);
  console.log('itch.io packaging SUCCESS.');
}

main();
