# game-asset-2026-2

Seeded, deterministic pixel-art icon generator for game assets. Vanilla JS + HTML
canvas, zero build step.

The same seed always produces the same icon, so artwork lives as a tiny string
in source control instead of as a binary blob. Render at 32×32 and 16×16
natively (no downscaling).

## Quick start

```bash
git clone <repo>
cd game-asset-2026-2
open index.html        # or just double-click in Finder
```

Pick a type, pick a size (16 or 32), enter a seed (or click reroll), click
Generate. Click any cell in the 24-cell batch grid to focus that seed.

To browse the deterministic regression set side-by-side:

```bash
open regression.html
```

## Asset types

| Type   | 32×32 | 16×16 | Source     |
|--------|-------|-------|------------|
| Potion | ✓     | ✓     | `potion.js` |
| Sword  | ✓     | ✓     | `sword.js`  |
| Spear  | ✓     | ✓     | `spear.js`  |

## Project structure

```
index.html        single-icon studio + 24-cell batch preview
regression.html   16+ deterministic seeds per type, 32 / 16 side by side
main.js           UI wiring + ITEM_TYPES registry
random.js         SeededRandom (string seed -> deterministic stream)
palette.js        color families + palette samplers
pixel-utils.js    integer-aligned canvas helpers
potion.js         drawPotion + sample / render pair (32 & 16)
sword.js          drawSword  + sample / render pair (32 & 16)
spear.js          drawSpear  + sample / render pair (32 & 16)
scripts/
  snapshot-regression.mjs   headless Chromium screenshots regression.html
  find-seed.mjs             brute-force seed search for rare combos
snapshots/
  baseline/                 tracked golden references
  current/                  scratch output (gitignored)
```

## Visual regression workflow

`regression.html` renders a fixed seed list per asset type. A small puppeteer
script captures it to PNG so visual changes appear as a `git diff` on the
baseline images.

```bash
npm install                       # one-time, installs puppeteer (downloads Chromium)
npm run snapshot                  # writes snapshots/current/  (gitignored)
npm run snapshot -- --promote     # writes snapshots/baseline/ (commit these)
```

Per-cell zoomed PNGs (8× nearest-neighbor upscale) are emitted alongside the
grid screenshots for pixel-precise inspection of risk areas. Add new zoom
targets in the `ZOOMS` array of `scripts/snapshot-regression.mjs`.

When the random sampler doesn't naturally cover a rare family / archetype
combination, `scripts/find-seed.mjs` brute-forces seed strings:

```bash
node scripts/find-seed.mjs obsidian trident sp-obs- 5
```

## Adding a new asset type

1. Create `<asset>.js` exposing:
   - `sample<Asset>Spec(rng)` → plain-object spec
   - `render<Asset>Spec32(ctx, spec)` and `render<Asset>Spec16(ctx, spec)`
   - `draw<Asset>(ctx, rng, size)` — convenience entry that samples + renders
2. Register `draw<Asset>` in `ITEM_TYPES` in `main.js`
3. Add the `<script src>` to `index.html` and `regression.html`
4. In `regression.html`, add a `<asset>_SEEDS` array and a render block that
   populates `#grid-<asset>`
5. Run `npm run snapshot -- --promote` to capture the initial baseline

## Conventions

- **Integer coordinates only** — no sub-pixel offsets, `imageSmoothingEnabled = false`
- **Limited palette** — typically ≤ 4 colors per asset family
  (outline + main + shadow + shine)
- **Outline must be continuous** — no 1-cell gaps
- **Design 32 first, then compress to 16** — layouts that work at higher
  resolutions rarely transfer cleanly to 32; layouts at 32 rarely transfer
  cleanly to 16

## Requirements

- Any modern browser for `index.html` / `regression.html`
- Node 18+ and `npm install` only if you want to run snapshot regressions
