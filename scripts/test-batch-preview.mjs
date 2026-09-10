#!/usr/bin/env node
// scripts/test-batch-preview.mjs
// Automated verification for batch preview cell click and rendering consistency.
// Verifies that clicking any batch preview cell (especially in 'any' type mode)
// produces identical canvas pixel data between the cell thumbnail and main preview.

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

  await page.goto(target, { waitUntil: 'networkidle0' });

  // 等待 batch preview grid 渲染完成
  await page.waitForFunction(
    () => document.querySelectorAll('#grid-container .grid-cell').length === 24,
    { timeout: 10000 }
  );

  const testResult = await page.evaluate(async () => {
    const sizeSelect = document.getElementById('size-select');
    const typeSelect = document.getElementById('type-select');
    const seedInput = document.getElementById('seed-input');
    const previewCanvas = document.getElementById('preview-canvas');

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

    // 1. 測試 size=32, type='any' 下的所有 24 格
    const test1 = await testGrid(32, 'any', Array.from({ length: 24 }, (_, i) => i));
    if (!test1.pass) return test1;

    // 2. 測試 size=16, type='any' 下的格子
    const test2 = await testGrid(16, 'any', [0, 1, 2, 5, 8, 11, 15, 19, 23]);
    if (!test2.pass) return test2;

    // 3. 測試 size=32, explicit types
    for (const type of ['sword', 'potion', 'spear', 'shield', 'staff']) {
      const t = await testGrid(32, type, [0, 4, 12, 23]);
      if (!t.pass) return t;
    }

    // 4. 驗證 resolveItemType 的決定性 (Determinism)
    // 當 type === 'any' 時 resolve 出的 type，若手動設為該 type，畫出來的像素必須完全相同
    for (let s = 0; s < 5; s++) {
      const testSeed = `determinism-check-${s}`;
      const resolvedType = window.resolveItemType('any', testSeed);

      // 模擬在 any 模式下繪圖
      seedInput.value = testSeed;
      typeSelect.value = 'any';
      window.generate();
      const dataFromAny = window.offscreenCanvas.getContext('2d').getImageData(0, 0, 32, 32).data.slice();

      // 模擬在明確指定 resolvedType 下繪圖
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

  if (!testResult.pass) {
    console.error(`✗ Test failed: ${testResult.error}`);
    process.exitCode = 1;
  } else {
    console.log('  ✓ Batch preview cell click in "any" mode: 24/24 cells verified pixel-identical (32×32)');
    console.log('  ✓ Batch preview cell click in "any" mode: verified pixel-identical (16×16)');
    console.log('  ✓ Explicit types (sword, potion, spear, shield, staff): verified pixel-identical');
    console.log('  ✓ Determinism check between resolved type and explicit type: 100% matched');
    console.log('\nAll batch preview consistency checks PASSED!');
  }
} finally {
  await browser.close();
}
