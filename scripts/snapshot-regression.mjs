import puppeteer from 'puppeteer';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Force light theme so canvas bg resolves to --bg-cell #e8e0d0
// (matches the historical hardcoded snapshot baseline). Independent of host OS.
const target = pathToFileURL(path.join(root, 'regression.html')).href + '?theme=light';

const promote = process.argv.includes('--promote');
const mode = promote ? 'baseline' : 'current';
const outDir = path.join(root, 'snapshots', mode);
fs.mkdirSync(outDir, { recursive: true });

console.log(`mode: ${mode} → ${path.relative(root, outDir)}/`);

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 2400, deviceScaleFactor: 2 });

page.on('console', msg => {
  if (msg.type() === 'error' || msg.type() === 'warning') {
    console.log(`[page ${msg.type()}]`, msg.text());
  }
});
page.on('pageerror', err => console.error('[page error]', err.message));

await page.goto(target, { waitUntil: 'networkidle0' });

await page.waitForFunction(
  () => {
    const spear = document.querySelectorAll('#grid-spear tr').length;
    const sword = document.querySelectorAll('#grid-sword tr').length;
    const potion = document.querySelectorAll('#grid-potion tr').length;
    const shield = document.querySelectorAll('#grid-shield tr').length;
    const staff = document.querySelectorAll('#grid-staff tr').length;
    const bow = document.querySelectorAll('#grid-bow tr').length;
    return spear > 5 && sword > 5 && potion > 5 && shield > 5 && staff > 5 && bow > 5;
  },
  { timeout: 15000 }
);

const targets = [
  { sel: '#grid-shield', file: 'shield-grid.png' },
  { sel: '#grid-spear', file: 'spear-grid.png' },
  { sel: '#grid-sword', file: 'sword-grid.png' },
  { sel: '#grid-potion', file: 'potion-grid.png' },
  { sel: '#grid-staff', file: 'staff-grid.png' },
  { sel: '#grid-bow', file: 'bow-grid.png' },
];

for (const { sel, file } of targets) {
  const el = await page.$(sel);
  if (!el) {
    console.warn('selector not found:', sel);
    continue;
  }
  const out = path.join(outDir, file);
  await el.screenshot({ path: out });
  const { size } = fs.statSync(out);
  console.log(`wrote ${file} (${(size / 1024).toFixed(1)} KB)`);
}

const ZOOMS = [
  { grid: 'grid-spear', seed: 'sp-metal-steel-1',       size: 32, label: 'spear-trident-32' },
  { grid: 'grid-spear', seed: 'sp-metal-steel-1',       size: 16, label: 'spear-trident-16' },
  { grid: 'grid-spear', seed: 'sp-butt-sphere-1',       size: 32, label: 'spear-hooked-32' },
  { grid: 'grid-spear', seed: 'sp-butt-sphere-1',       size: 16, label: 'spear-hooked-16' },
  { grid: 'grid-spear', seed: 'sp-edge-binding-2lines', size: 32, label: 'spear-binding-32' },
  // risk #1 — obsidian (dark) head against WOOD shaft contrast, all 3 archetypes
  { grid: 'grid-spear', seed: 'sp-obs-97',              size: 32, label: 'spear-obsidian-trident-32' },
  { grid: 'grid-spear', seed: 'sp-obs-32',              size: 32, label: 'spear-obsidian-hooked-32' },
  { grid: 'grid-spear', seed: 'sp-obs-51',              size: 32, label: 'spear-obsidian-straight-32' },
  // shield zooms
  { grid: 'grid-shield', seed: 'sh-arch-heater-3',       size: 32, label: 'shield-heater-32' },
  { grid: 'grid-shield', seed: 'sh-arch-heater-3',       size: 16, label: 'shield-heater-16' },
  { grid: 'grid-shield', seed: 'sh-arch-round-5',        size: 32, label: 'shield-round-32' },
  { grid: 'grid-shield', seed: 'sh-arch-round-5',        size: 16, label: 'shield-round-16' },
  { grid: 'grid-shield', seed: 'sh-arch-tower-2',        size: 32, label: 'shield-tower-32' },
  { grid: 'grid-shield', seed: 'sh-arch-tower-2',        size: 16, label: 'shield-tower-16' },
  { grid: 'grid-shield', seed: 'sh-obs-heater-33',       size: 32, label: 'shield-obsidian-32' },
  // staff zooms
  { grid: 'grid-staff', seed: 'staff-crescent-arcane-1', size: 32, label: 'staff-crescent-32' },
  { grid: 'grid-staff', seed: 'staff-crescent-arcane-1', size: 16, label: 'staff-crescent-16' },
  { grid: 'grid-staff', seed: 'staff-orb-fire-6',        size: 32, label: 'staff-orb-32' },
  { grid: 'grid-staff', seed: 'staff-orb-fire-6',        size: 16, label: 'staff-orb-16' },
  { grid: 'grid-staff', seed: 'staff-crozier-nature-11', size: 32, label: 'staff-crozier-32' },
  { grid: 'grid-staff', seed: 'staff-crozier-nature-11', size: 16, label: 'staff-crozier-16' },
  { grid: 'grid-staff', seed: 'staff-crescent-shadow-4', size: 32, label: 'staff-shadow-32' },
  // bow zooms
  { grid: 'grid-bow',   seed: 'bow-longbow-oak-6',      size: 32, label: 'bow-longbow-32' },
  { grid: 'grid-bow',   seed: 'bow-longbow-oak-6',      size: 16, label: 'bow-longbow-16' },
  { grid: 'grid-bow',   seed: 'bow-recurve-oak-17',     size: 32, label: 'bow-recurve-32' },
  { grid: 'grid-bow',   seed: 'bow-recurve-oak-17',     size: 16, label: 'bow-recurve-16' },
  { grid: 'grid-bow',   seed: 'bow-shortbow-oak-14',    size: 32, label: 'bow-shortbow-32' },
  { grid: 'grid-bow',   seed: 'bow-shortbow-oak-14',    size: 16, label: 'bow-shortbow-16' },
  { grid: 'grid-bow',   seed: 'bow-recurve-ebony-329',  size: 32, label: 'bow-ebony-32' },
];

const zoomResults = await page.evaluate((zooms) => {
  const SCALE = 8;
  const BG = '#2a2a3a';
  const out = [];
  for (const z of zooms) {
    const grid = document.getElementById(z.grid);
    if (!grid) { out.push({ ...z, ok: false, err: 'grid not found' }); continue; }
    let row = null;
    for (const tr of grid.querySelectorAll('tr')) {
      const firstTd = tr.querySelector('td');
      if (firstTd && firstTd.textContent.trim() === z.seed) { row = tr; break; }
    }
    if (!row) { out.push({ ...z, ok: false, err: 'seed not found' }); continue; }
    const canvases = row.querySelectorAll('canvas');
    const src = z.size === 32 ? canvases[0] : canvases[1];
    if (!src) { out.push({ ...z, ok: false, err: 'canvas not found' }); continue; }

    const id = 'zoom-' + z.label;
    const zc = document.createElement('canvas');
    zc.id = id;
    zc.width = src.width * SCALE;
    zc.height = src.height * SCALE;
    zc.style.imageRendering = 'pixelated';
    zc.style.display = 'block';
    zc.style.margin = '8px';
    const cx = zc.getContext('2d');
    cx.fillStyle = BG;
    cx.fillRect(0, 0, zc.width, zc.height);
    cx.imageSmoothingEnabled = false;
    cx.drawImage(src, 0, 0, zc.width, zc.height);
    document.body.appendChild(zc);
    out.push({ ...z, ok: true, id });
  }
  return out;
}, ZOOMS);

for (const z of zoomResults) {
  if (!z.ok) { console.warn(`skip ${z.label}: ${z.err}`); continue; }
  const el = await page.$('#' + z.id);
  const out = path.join(outDir, z.label + '.png');
  await el.screenshot({ path: out });
  const { size } = fs.statSync(out);
  console.log(`wrote ${z.label}.png (${(size / 1024).toFixed(1)} KB)`);
}

await browser.close();
console.log('done');
