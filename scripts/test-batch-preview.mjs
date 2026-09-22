#!/usr/bin/env node
// scripts/test-batch-preview.mjs
// Automated verification for batch preview cell click and rendering consistency.
// Verifies:
// 1. By default (index.html):
//    - "bow" option is removed from #type-select
//    - "any" mode never picks "bow" across batch preview cells
//    - Fallback behavior for disabled "bow" resolves to "potion"
//    - Batch preview cell click produces identical canvas pixel data for all base types
// 2. In flag-enabled mode (index.html?bow=1):
//    - "bow" option is present in #type-select
//    - Explicit selection and rendering for all 6 types (including bow) are pixel-identical
//    - Determinism check passes between resolved type and explicit selection

import puppeteer from 'puppeteer';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = pathToFileURL(path.join(root, 'index.html')).href;

console.log('Running batch preview rendering consistency test...');

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[page ${msg.type()}]`, msg.text());
    }
  });
  page.on('pageerror', (err) => console.error('[page error]', err.message));

  // =============================================================
  // Part 1: Default mode (Flag Disabled - index.html)
  // =============================================================
  console.log('\n--- Testing Default Mode (Bow Flag Disabled) ---');
  await page.goto(target, { waitUntil: 'networkidle0' });

  await page.waitForFunction(
    () => document.querySelectorAll('#grid-container .grid-cell').length === 24,
    { timeout: 10000 }
  );

  const defaultModeResult = await page.evaluate(async () => {
    const sizeSelect = document.getElementById('size-select');
    const typeSelect = document.getElementById('type-select');
    const seedInput = document.getElementById('seed-input');

    // 1. Verify "bow" option is NOT present in #type-select
    const bowOption = typeSelect.querySelector('option[value="bow"]');
    if (bowOption !== null) {
      return { pass: false, error: 'Expected <option value="bow"> to be removed in default mode, but found it.' };
    }

    // 2. Verify fallback of resolveItemType('bow')
    const fallbackType = window.resolveItemType('bow', 'test-seed-123');
    if (fallbackType !== 'potion') {
      return { pass: false, error: `Expected resolveItemType('bow') to fallback to 'potion', got '${fallbackType}'` };
    }

    // 3. Verify 'any' mode never resolves to 'bow' across 50 seeds
    for (let i = 0; i < 50; i++) {
      const picked = window.resolveItemType('any', `sample-seed-${i}`);
      if (picked === 'bow') {
        return { pass: false, error: `resolveItemType('any') picked 'bow' in default disabled mode at index ${i}` };
      }
    }

    function compareImageData(data1, data2) {
      if (data1.length !== data2.length) return false;
      for (let i = 0; i < data1.length; i++) {
        if (data1[i] !== data2[i]) return false;
      }
      return true;
    }

    async function testGrid(currentSize, currentType, cellIndicesToTest) {
      sizeSelect.value = String(currentSize);
      sizeSelect.dispatchEvent(new Event('change'));
      typeSelect.value = currentType;
      typeSelect.dispatchEvent(new Event('change'));

      const cells = document.querySelectorAll('#grid-container .grid-cell');
      if (cells.length !== 24) {
        throw new Error(`Expected 24 grid cells, found ${cells.length}`);
      }

      for (const idx of cellIndicesToTest) {
        const cell = cells[idx];
        const thumbCanvas = cell.querySelector('canvas');
        const thumbCtx = thumbCanvas.getContext('2d');
        const thumbData = thumbCtx.getImageData(0, 0, currentSize, currentSize).data;
        const expectedSeed = thumbCanvas.title;

        // 點擊縮圖格子
        cell.click();

        // 驗證 UI 控制項已更新為該格子的 seed 與 type
        const updatedSeed = seedInput.value;
        const updatedType = typeSelect.value;
        if (updatedSeed !== expectedSeed) {
          return {
            pass: false,
            error: `Seed mismatch at cell index ${idx}: expected "${expectedSeed}", got "${updatedSeed}"`,
          };
        }

        // 驗證 offscreenCanvas 與縮圖畫布像素 100% 一致 (pixel-identical)
        const offscreenCtx = window.offscreenCanvas.getContext('2d');
        const offscreenData = offscreenCtx.getImageData(0, 0, currentSize, currentSize).data;
        let diffCount = 0;
        let firstDiff = null;
        for (let i = 0; i < thumbData.length; i++) {
          if (thumbData[i] !== offscreenData[i]) {
            diffCount++;
            if (!firstDiff) {
              const pixelIdx = Math.floor(i / 4);
              const x = pixelIdx % currentSize;
              const y = Math.floor(pixelIdx / currentSize);
              firstDiff = { x, y, channel: i % 4, thumbVal: thumbData[i], offVal: offscreenData[i] };
            }
          }
        }
        if (diffCount > 0) {
          return {
            pass: false,
            error: `Pixel mismatch between thumbnail and offscreenCanvas for cell ${idx} (seed: "${expectedSeed}", type: "${updatedType}", size: ${currentSize}). Total diff bytes: ${diffCount}. First diff at (${firstDiff.x}, ${firstDiff.y}) ch${firstDiff.channel}: thumb=${firstDiff.thumbVal}, off=${firstDiff.offVal}`,
          };
        }

        // 確保非空白畫布
        let hasVisiblePixels = false;
        for (let i = 3; i < offscreenData.length; i += 4) {
          if (offscreenData[i] > 0) {
            hasVisiblePixels = true;
            break;
          }
        }
        if (!hasVisiblePixels) {
          return {
            pass: false,
            error: `Rendered canvas is blank for cell ${idx} (seed: "${expectedSeed}")`,
          };
        }
      }

      return { pass: true, testedCount: cellIndicesToTest.length };
    }

    // 測試 size=32, type='any' 下的所有 24 格
    const test1 = await testGrid(32, 'any', Array.from({ length: 24 }, (_, i) => i));
    if (!test1.pass) return test1;

    // 測試 size=16, type='any' 下的格子
    const test2 = await testGrid(16, 'any', [0, 1, 2, 5, 8, 11, 15, 19, 23]);
    if (!test2.pass) return test2;

    // 測試 size=32, explicit base types (sword, potion, spear, shield, staff)
    for (const type of ['sword', 'potion', 'spear', 'shield', 'staff']) {
      const t = await testGrid(32, type, [0, 4, 12, 23]);
      if (!t.pass) return t;
    }

    // 驗證 resolveItemType 的決定性 (Determinism)
    for (let s = 0; s < 5; s++) {
      const testSeed = `determinism-check-${s}`;
      const resolvedType = window.resolveItemType('any', testSeed);

      seedInput.value = testSeed;
      typeSelect.value = 'any';
      window.generate();
      const dataFromAny = window.offscreenCanvas.getContext('2d').getImageData(0, 0, 32, 32).data.slice();

      typeSelect.value = resolvedType;
      window.generate();
      const dataFromExplicit = window.offscreenCanvas.getContext('2d').getImageData(0, 0, 32, 32).data.slice();

      if (!compareImageData(dataFromAny, dataFromExplicit)) {
        return {
          pass: false,
          error: `Determinism mismatch for seed "${testSeed}": any resolved to "${resolvedType}", but explicit selection produced different pixels.`,
        };
      }
    }

    return { pass: true };
  });

  if (!defaultModeResult.pass) {
    console.error(`✗ Default mode test failed: ${defaultModeResult.error}`);
    process.exit(1);
  }
  console.log('  ✓ Bow option cleanly removed from #type-select');
  console.log('  ✓ "any" mode strictly excludes bow');
  console.log('  ✓ resolveItemType("bow") gracefully falls back to "potion"');
  console.log('  ✓ Batch preview cell clicks in "any" mode pixel-identical (32×32 and 16×16)');
  console.log('  ✓ Explicit base types (sword, potion, spear, shield, staff) pixel-identical');

  // =============================================================
  // Part 2: Flag-Enabled Mode (?bow=1)
  // =============================================================
  console.log('\n--- Testing Flag-Enabled Mode (?bow=1) ---');
  await page.goto(`${target}?bow=1`, { waitUntil: 'networkidle0' });

  await page.waitForFunction(
    () => document.querySelectorAll('#grid-container .grid-cell').length === 24,
    { timeout: 10000 }
  );

  const flagEnabledResult = await page.evaluate(async () => {
    const sizeSelect = document.getElementById('size-select');
    const typeSelect = document.getElementById('type-select');
    const seedInput = document.getElementById('seed-input');

    // 1. Verify "bow" option IS present in #type-select
    const bowOption = typeSelect.querySelector('option[value="bow"]');
    if (!bowOption) {
      return { pass: false, error: 'Expected <option value="bow"> to be present in flag-enabled mode, but not found.' };
    }

    // 2. Verify resolveItemType('bow') resolves to 'bow'
    const resolvedBow = window.resolveItemType('bow', 'test-seed-123');
    if (resolvedBow !== 'bow') {
      return { pass: false, error: `Expected resolveItemType('bow') to resolve to 'bow', got '${resolvedBow}'` };
    }

    function compareImageData(data1, data2) {
      if (data1.length !== data2.length) return false;
      for (let i = 0; i < data1.length; i++) {
        if (data1[i] !== data2[i]) return false;
      }
      return true;
    }

    async function testGrid(currentSize, currentType, cellIndicesToTest) {
      sizeSelect.value = String(currentSize);
      sizeSelect.dispatchEvent(new Event('change'));
      typeSelect.value = currentType;
      typeSelect.dispatchEvent(new Event('change'));

      const cells = document.querySelectorAll('#grid-container .grid-cell');
      if (cells.length !== 24) {
        throw new Error(`Expected 24 grid cells, found ${cells.length}`);
      }

      for (const idx of cellIndicesToTest) {
        const cell = cells[idx];
        const thumbCanvas = cell.querySelector('canvas');
        const thumbCtx = thumbCanvas.getContext('2d');
        const thumbData = thumbCtx.getImageData(0, 0, currentSize, currentSize).data;
        const expectedSeed = thumbCanvas.title;

        cell.click();

        const updatedSeed = seedInput.value;
        const updatedType = typeSelect.value;
        if (updatedSeed !== expectedSeed) {
          return {
            pass: false,
            error: `Seed mismatch at cell index ${idx}: expected "${expectedSeed}", got "${updatedSeed}"`,
          };
        }

        const offscreenCtx = window.offscreenCanvas.getContext('2d');
        const offscreenData = offscreenCtx.getImageData(0, 0, currentSize, currentSize).data;
        let diffCount = 0;
        let firstDiff = null;
        for (let i = 0; i < thumbData.length; i++) {
          if (thumbData[i] !== offscreenData[i]) {
            diffCount++;
            if (!firstDiff) {
              const pixelIdx = Math.floor(i / 4);
              const x = pixelIdx % currentSize;
              const y = Math.floor(pixelIdx / currentSize);
              firstDiff = { x, y, channel: i % 4, thumbVal: thumbData[i], offVal: offscreenData[i] };
            }
          }
        }
        if (diffCount > 0) {
          return {
            pass: false,
            error: `Pixel mismatch between thumbnail and offscreenCanvas for cell ${idx} (seed: "${expectedSeed}", type: "${updatedType}", size: ${currentSize}). Total diff bytes: ${diffCount}. First diff at (${firstDiff.x}, ${firstDiff.y}) ch${firstDiff.channel}: thumb=${firstDiff.thumbVal}, off=${firstDiff.offVal}`,
          };
        }

        let hasVisiblePixels = false;
        for (let i = 3; i < offscreenData.length; i += 4) {
          if (offscreenData[i] > 0) {
            hasVisiblePixels = true;
            break;
          }
        }
        if (!hasVisiblePixels) {
          return {
            pass: false,
            error: `Rendered canvas is blank for cell ${idx} (seed: "${expectedSeed}")`,
          };
        }
      }

      return { pass: true, testedCount: cellIndicesToTest.length };
    }

    // 3. Test all 6 types (including bow) at size=32
    for (const type of ['sword', 'potion', 'spear', 'shield', 'staff', 'bow']) {
      const t = await testGrid(32, type, [0, 4, 12, 23]);
      if (!t.pass) return t;
    }

    // 4. Test bow at size=16
    const tBow16 = await testGrid(16, 'bow', [0, 4, 12, 23]);
    if (!tBow16.pass) return tBow16;

    // 5. Verify resolveItemType determinism with all 6 types
    for (let s = 0; s < 5; s++) {
      const testSeed = `determinism-bow-check-${s}`;
      const resolvedType = window.resolveItemType('any', testSeed);

      seedInput.value = testSeed;
      typeSelect.value = 'any';
      window.generate();
      const dataFromAny = window.offscreenCanvas.getContext('2d').getImageData(0, 0, 32, 32).data.slice();

      typeSelect.value = resolvedType;
      window.generate();
      const dataFromExplicit = window.offscreenCanvas.getContext('2d').getImageData(0, 0, 32, 32).data.slice();

      if (!compareImageData(dataFromAny, dataFromExplicit)) {
        return {
          pass: false,
          error: `Determinism mismatch for seed "${testSeed}": any resolved to "${resolvedType}", but explicit selection produced different pixels.`,
        };
      }
    }

    return { pass: true };
  });

  if (!flagEnabledResult.pass) {
    console.error(`✗ Flag-enabled mode test failed: ${flagEnabledResult.error}`);
    process.exit(1);
  }
  console.log('  ✓ Bow option present in #type-select in flag-enabled mode');
  console.log('  ✓ resolveItemType("bow") resolves to "bow"');
  console.log('  ✓ Explicit types across all 6 items (including bow) verified pixel-identical (32×32)');
  console.log('  ✓ Bow verified pixel-identical at 16×16');
  console.log('  ✓ Determinism check between resolved type and explicit type: 100% matched');

  console.log('\nAll batch preview consistency checks PASSED!');
} finally {
  await browser.close();
}
