#!/usr/bin/env node
// scripts/generate-itch-assets.mjs
// Automated generator for itch.io visual presentation assets:
// 1. cover.png (1260x1000 retina / 630x500 standard)
// 2. screenshot_01_studio.png (1280x800)
// 3. screenshot_02_batch.png (1280x800)
// 4. screenshot_03_dual_resolution.png (1280x800)

import puppeteer from 'puppeteer';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'docs', 'pm', 'assets');
fs.mkdirSync(outDir, { recursive: true });

console.log(`Generating itch.io visual assets into: ${path.relative(root, outDir)}/`);

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});

try {
  const page = await browser.newPage();

  // -------------------------------------------------------------
  // 1. Generate cover.png (1260x1000, 2x Retina for 630x500)
  // -------------------------------------------------------------
  console.log('Generating cover.png (1260x1000)...');
  await page.setViewport({ width: 1260, height: 1000, deviceScaleFactor: 1 });

  // Core generator scripts to inline (bypasses Chromium local resource restrictions on about:blank)
  const scriptFiles = [
    'random.js',
    'palette.js',
    'pixel-utils.js',
    'potion.js',
    'sword.js',
    'spear.js',
    'shield.js',
    'staff.js'
  ];
  const inlinedScripts = scriptFiles
    .map(file => `<script>\n${fs.readFileSync(path.join(root, file), 'utf8')}\n</script>`)
    .join('\n');

  const coverHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8" />
    <style>
      @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        width: 1260px;
        height: 1000px;
        background-color: #12131a;
        background-image:
          radial-gradient(ellipse at 50% 30%, rgba(229, 192, 123, 0.08) 0%, transparent 70%),
          linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
        background-size: 100% 100%, 32px 32px, 32px 32px;
        font-family: 'JetBrains Mono', monospace;
        color: #e6edf3;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: center;
        padding: 60px 50px 50px 50px;
        overflow: hidden;
      }
      .header {
        text-align: center;
      }
      .brand-title {
        font-size: 64px;
        font-weight: 800;
        letter-spacing: -1px;
        line-height: 1;
        margin-bottom: 14px;
      }
      .brand-title .accent {
        color: #e5c07b;
      }
      .tagline {
        font-size: 22px;
        color: #8b949e;
        letter-spacing: 0.5px;
      }
      .badge-row {
        margin-top: 14px;
        display: flex;
        gap: 12px;
        justify-content: center;
      }
      .badge {
        padding: 5px 14px;
        background: rgba(229, 192, 123, 0.12);
        border: 1px solid rgba(229, 192, 123, 0.35);
        border-radius: 4px;
        color: #e5c07b;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.5px;
      }
      .badge.green {
        background: rgba(152, 195, 121, 0.12);
        border-color: rgba(152, 195, 121, 0.35);
        color: #98c379;
      }
      .badge.cyan {
        background: rgba(86, 182, 194, 0.12);
        border-color: rgba(86, 182, 194, 0.35);
        color: #56b6c2;
      }

      .items-container {
        display: flex;
        gap: 28px;
        justify-content: center;
        align-items: center;
        width: 100%;
        margin: 20px 0;
      }
      .item-card {
        background: #181a24;
        border: 2px solid #282c3e;
        border-radius: 12px;
        padding: 16px 14px;
        display: flex;
        flex-direction: column;
        align-items: center;
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.5);
      }
      .item-card.featured {
        border-color: rgba(229, 192, 123, 0.5);
        transform: scale(1.05);
        box-shadow: 0 16px 40px rgba(229, 192, 123, 0.15);
      }
      .canvas-box {
        width: 176px;
        height: 176px;
        background: #0d0e14;
        border: 1px solid #212638;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      }
      canvas {
        image-rendering: pixelated;
        image-rendering: crisp-edges;
        width: 160px;
        height: 160px;
      }
      .item-name {
        margin-top: 14px;
        font-size: 15px;
        font-weight: 700;
        color: #e6edf3;
        text-transform: capitalize;
      }
      .item-seed {
        margin-top: 4px;
        font-size: 11px;
        color: #6e7681;
      }

      .footer {
        width: 100%;
        background: #181a24;
        border: 1px solid #282c3e;
        border-radius: 10px;
        padding: 18px 24px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 14px;
        color: #8b949e;
      }
      .footer-item {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .footer-item .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #98c379;
      }
      .footer-highlight {
        color: #e6edf3;
        font-weight: 700;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="brand-title">Item<span class="accent">Seed</span></div>
      <div class="tagline">Deterministic Pixel Art RPG Item Generator</div>
      <div class="badge-row">
        <span class="badge">NATIVE 16×16 & 32×32</span>
        <span class="badge green">CC0 1.0 PUBLIC DOMAIN · 100% FREE FOR COMMERCIAL GAMES</span>
        <span class="badge cyan">BROWSER PLAYABLE · ZERO BUILD</span>
      </div>
    </div>

    <div class="items-container">
      <div class="item-card">
        <div class="canvas-box"><canvas id="c-potion" width="32" height="32"></canvas></div>
        <div class="item-name">Potion</div>
        <div class="item-seed">sacred-flask-7</div>
      </div>
      <div class="item-card featured">
        <div class="canvas-box"><canvas id="c-sword" width="32" height="32"></canvas></div>
        <div class="item-name">Sword</div>
        <div class="item-seed">dragon-blade-42</div>
      </div>
      <div class="item-card">
        <div class="canvas-box"><canvas id="c-spear" width="32" height="32"></canvas></div>
        <div class="item-name">Spear</div>
        <div class="item-seed">obsidian-trident-9</div>
      </div>
      <div class="item-card">
        <div class="canvas-box"><canvas id="c-shield" width="32" height="32"></canvas></div>
        <div class="item-name">Shield</div>
        <div class="item-seed">aegis-tower-16</div>
      </div>
      <div class="item-card">
        <div class="canvas-box"><canvas id="c-staff" width="32" height="32"></canvas></div>
        <div class="item-name">Staff</div>
        <div class="item-seed">arcane-crescent-88</div>
      </div>
    </div>

    <div class="footer">
      <div class="footer-item"><span class="dot"></span> <span>Engine: <span class="footer-highlight">MIT License</span></span></div>
      <div class="footer-item"><span class="dot"></span> <span>Generated Assets: <span class="footer-highlight">CC0 1.0 Universal</span></span></div>
      <div class="footer-item"><span class="dot"></span> <span>Same Seed = <span class="footer-highlight">Same Item</span></span></div>
      <div class="footer-item"><span class="dot"></span> <span>Inspired by <span class="footer-highlight">Brian MacIntosh's Icon Machine</span></span></div>
    </div>

    ${inlinedScripts}
    <script>
      function renderAll() {
        const render = (id, fn, seed) => {
          const c = document.getElementById(id);
          if (!c) return;
          const ctx = c.getContext('2d', { willReadFrequently: true });
          const rng = new SeededRandom(seed);
          fn(ctx, rng, 32);
        };
        render('c-potion', drawPotion, 'sacred-flask-7');
        render('c-sword', drawSword, 'dragon-blade-42');
        render('c-spear', drawSpear, 'obsidian-trident-9');
        render('c-shield', drawShield, 'aegis-tower-16');
        render('c-staff', drawStaff, 'arcane-crescent-88');
      }
      renderAll();
    </script>
  </body>
  </html>
  `;

  page.on('console', msg => {
    if (msg.type() === 'error') console.error('[Page Console Error]:', msg.text());
  });
  page.on('pageerror', err => {
    console.error('[Page Error]:', err);
  });

  await page.setContent(coverHtml, { waitUntil: 'load' });
  await page.waitForSelector('#c-staff');

  // Ensure fonts and rendering are fully settled
  await page.evaluate(async () => {
    if (document.fonts) {
      await document.fonts.ready;
    }
    renderAll();
  });
  await new Promise(r => setTimeout(r, 400));

  // Verify all 5 showcase canvases have pixel art rendered
  const renderVerification = await page.evaluate(() => {
    const ids = ['c-potion', 'c-sword', 'c-spear', 'c-shield', 'c-staff'];
    return ids.map(id => {
      const c = document.getElementById(id);
      if (!c) return { id, count: 0, error: 'element not found' };
      const ctx = c.getContext('2d');
      const imgData = ctx.getImageData(0, 0, 32, 32).data;
      let nonZero = 0;
      for (let i = 3; i < imgData.length; i += 4) {
        if (imgData[i] > 0) nonZero++;
      }
      return { id, count: nonZero };
    });
  });

  for (const item of renderVerification) {
    if (item.count === 0) {
      throw new Error(`Item canvas ${item.id} has 0 rendered pixels!`);
    }
  }
  console.log(`✓ All 5 item canvases verified rendered: ${renderVerification.map(v => `${v.id}=${v.count}px`).join(', ')}`);

  const coverPath = path.join(outDir, 'cover.png');
  await page.screenshot({ path: coverPath, type: 'png' });
  console.log(`✓ cover.png saved (${path.relative(root, coverPath)})`);

  // -------------------------------------------------------------
  // 2. Screenshot 1: Studio Interface (1280x800)
  // -------------------------------------------------------------
  console.log('Generating screenshot_01_studio.png (1280x800)...');
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  const indexUrl = pathToFileURL(path.join(root, 'index.html')).href + '?theme=dark&lang=en';
  await page.goto(indexUrl, { waitUntil: 'networkidle0' });

  // Set nice custom seed
  await page.evaluate(() => {
    const seedInput = document.getElementById('seed-input');
    const typeSelect = document.getElementById('type-select');
    seedInput.value = 'dragon-blade-42';
    typeSelect.value = 'sword';
    document.getElementById('generate-btn').click();
  });
  await new Promise(r => setTimeout(r, 400));

  const studioPath = path.join(outDir, 'screenshot_01_studio.png');
  await page.screenshot({ path: studioPath, type: 'png' });
  console.log(`✓ screenshot_01_studio.png saved (${path.relative(root, studioPath)})`);

  // -------------------------------------------------------------
  // 3. Screenshot 2: Batch Preview Exploration (1280x800)
  // -------------------------------------------------------------
  console.log('Generating screenshot_02_batch.png (1280x800)...');
  await page.evaluate(() => {
    const typeSelect = document.getElementById('type-select');
    typeSelect.value = 'any';
    document.getElementById('generate-btn').click();
    document.querySelector('.grid-section').scrollIntoView({ behavior: 'instant' });
  });
  await new Promise(r => setTimeout(r, 400));

  const batchPath = path.join(outDir, 'screenshot_02_batch.png');
  await page.screenshot({ path: batchPath, type: 'png' });
  console.log(`✓ screenshot_02_batch.png saved (${path.relative(root, batchPath)})`);

  // -------------------------------------------------------------
  // 4. Screenshot 3: Dual Resolution Comparison (1280x800)
  // -------------------------------------------------------------
  console.log('Generating screenshot_03_dual_resolution.png (1280x800)...');
  const regUrl = pathToFileURL(path.join(root, 'regression.html')).href + '?theme=dark';
  await page.goto(regUrl, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 500));

  const dualPath = path.join(outDir, 'screenshot_03_dual_resolution.png');
  await page.screenshot({ path: dualPath, type: 'png' });
  console.log(`✓ screenshot_03_dual_resolution.png saved (${path.relative(root, dualPath)})`);

  console.log('\nAll itch.io visual assets generated successfully!');
} finally {
  await browser.close();
}
