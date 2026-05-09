import puppeteer from 'puppeteer';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = pathToFileURL(path.join(root, 'regression.html')).href;

const want = {
  family: process.argv[2] || 'obsidian',
  archetype: process.argv[3] || null,
  prefix: process.argv[4] || 'sp-find-',
  count: Number(process.argv[5] || 5),
};

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('[page error]', e.message));
await page.goto(target, { waitUntil: 'networkidle0' });

const hits = await page.evaluate(({ family, archetype, prefix, count }) => {
  const out = [];
  for (let i = 1; i < 100000 && out.length < count; i++) {
    const seed = prefix + i;
    const rng = new SeededRandom(seed);
    const spec = sampleSpearSpec(rng);
    if (spec.family !== family) continue;
    if (archetype && spec.archetype !== archetype) continue;
    out.push({ seed, family: spec.family, archetype: spec.archetype, buttStyle: spec.buttStyle, hasShaftBinding: spec.hasShaftBinding });
  }
  return out;
}, want);

console.log(JSON.stringify(hits, null, 2));
await browser.close();
