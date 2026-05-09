import puppeteer from 'puppeteer';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = pathToFileURL(path.join(root, 'regression.html')).href;

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
    return spear > 5 && sword > 5 && potion > 5;
  },
  { timeout: 15000 }
);

const targets = [
  { sel: '#grid-spear', file: 'spear-grid.png' },
  { sel: '#grid-sword', file: 'sword-grid.png' },
  { sel: '#grid-potion', file: 'potion-grid.png' },
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

await browser.close();
console.log('done');
