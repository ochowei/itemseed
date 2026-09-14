# ItemSeed

Seeded, deterministic pixel-art icon generator for game assets. Vanilla JS + HTML
canvas, zero build step.

The same seed always produces the same icon, so artwork lives as a tiny string
in source control instead of as a binary blob. Render at 32×32 and 16×16
natively (no downscaling).

## Quick start

```bash
git clone https://github.com/ochowei/itemseed.git
cd itemseed
open index.html        # or just double-click in Finder
```

In the studio interface (`index.html`):
- Pick a type, pick a size (16 or 32), enter a seed (or click reroll `⟳`), and click **Generate** (`▸ generate`).
- Click **⇩ png** to download the active icon as a crisp, transparent PNG.
- Click any cell in the 24-cell batch preview grid to focus and inspect that seed.
- Switch theme (Auto / Light / Dark) and language (繁體中文 / English) via the header dropdowns.

To browse the deterministic regression set side-by-side:

```bash
open regression.html
```

`regression.html` displays fixed seeds for all item types, supports downloading the composite PNG, downloading generated specs JSON, and testing under different visual themes.

## Asset types

| Type   | 32×32 | 16×16 | Source     |
|--------|-------|-------|------------|
| Potion | ✓     | ✓     | `potion.js` |
| Sword  | ✓     | ✓     | `sword.js`  |
| Spear  | ✓     | ✓     | `spear.js`  |
| Shield | ✓     | ✓     | `shield.js` |
| Staff  | ✓     | ✓     | `staff.js`  |

## Project structure

```
index.html                single-icon studio + 24-cell batch preview
regression.html           16+ deterministic seeds per type, 32 / 16 side by side
main.js                   UI wiring + ITEM_TYPES registry
random.js                 SeededRandom (string seed -> deterministic stream)
palette.js                color families + palette samplers
pixel-utils.js            integer-aligned canvas helpers
theme.js                  theme runtime (URL param > localStorage > OS preference)
theme.css                 CSS variables for dark and light palettes
i18n.js                   runtime translation loader and DOM binding
i18n/
  zh-Hant.js              Traditional Chinese translations
  en.js                   English translations
potion.js                 drawPotion + sample / render pair (32 & 16)
sword.js                  drawSword  + sample / render pair (32 & 16)
spear.js                  drawSpear  + sample / render pair (32 & 16)
shield.js                 drawShield + sample / render pair (32 & 16)
staff.js                  drawStaff  + sample / render pair (32 & 16)
scripts/
  snapshot-regression.mjs headless Chromium screenshots regression.html
  find-seed.mjs           brute-force seed search for rare combos
  test-theme.mjs          unit tests for theme runtime state transitions
  check-i18n.mjs          static integrity checker for locale keys vs index.html
snapshots/
  baseline/               tracked golden references
  current/                scratch output (gitignored)
docs/                     design specs, implementation notes, and task plans
AGENTS.md                 agent workflow rules and role definitions
ASSET-LICENSE.md          generated assets public domain dedication (CC0 1.0)
LICENSE                   open-source engine license (MIT)
FRONTEND_KANBAN.md        frontend task tracking board with role permissions
CLAUDE.md                 internal developer guidelines and pixel art rules
```

## Verification and regression workflow

### Theme and i18n checks

Fast Node-based checks verify theme logic and translation completeness:

```bash
npm run check-theme               # verifies theme state transitions and storage
npm run check-i18n                # verifies zh-Hant and en parity + index.html keys
```

### Visual regression snapshots

`regression.html` renders a fixed seed list per asset type. A puppeteer
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
3. Add the `<script src="<asset>.js"></script>` tag to `index.html` and `regression.html`
4. Add an `<option>` to `#type-select` in `index.html` with `data-i18n-key="type.option.<asset>"`
5. Add the corresponding translation key to `i18n/zh-Hant.js` and `i18n/en.js`
6. In `regression.html`, add a `<asset>_SEEDS` array and a render block that populates `#grid-<asset>`
7. Run `npm run check-i18n` to ensure all translation keys are present
8. Run `npm run snapshot -- --promote` to capture the initial visual baseline

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
- Node 18+ and `npm install` to run tests and snapshot regressions (`npm run check-theme`, `npm run check-i18n`, `npm run snapshot`)

## License and Provenance

ItemSeed operates under a dual-licensing structure that clearly distinguishes the generator software from the procedural artwork it produces, providing maximum legal certainty for creators and developers:

| Component | License | Terms & Permissions |
| :--- | :--- | :--- |
| **Source Code & Engine** | **[MIT License](LICENSE)** | Open source. Free to run, copy, modify, merge, publish, distribute, sublicense, and sell copies of the software. |
| **Generated Assets** | **[Creative Commons CC0 1.0 Universal](ASSET-LICENSE.md)** | Public Domain Dedication. Generated PNG icons, JSON specs, and spritesheets are 100% free for commercial and personal games with zero royalties and no attribution required. |

### Source Code License

The ItemSeed generator codebase, tools, and test suites are licensed under the **[MIT License](LICENSE)**:

- Free for commercial and non-commercial development, bundling, integration, and modification.
- Requires retaining the original copyright notice and permission notice in distributions.
- See the full legal text in **[LICENSE](LICENSE)**.

### Generated Assets License

All procedural artwork and specifications generated by ItemSeed—including exported 16×16 and 32×32 PNG icons, JSON item definitions, and composite spritesheets—are dedicated to the public domain under the **[Creative Commons CC0 1.0 Universal](ASSET-LICENSE.md)** dedication:

- **Personal & Commercial Use**: Unrestricted. Free to use in personal projects, prototypes, game jams, and commercial games distributed on Steam, itch.io, consoles, or mobile with zero royalties or licensing fees.
- **Modification**: Free to edit, recolor, upscale, crop, animate, or remix however you choose.
- **Attribution**: Optional. Crediting ItemSeed is appreciated, but never legally required.
- **No Conflicting Terms**: Explicitly free of non-commercial restrictions, anti-resale clauses, or seat limitations.
- See the full legal text in **[ASSET-LICENSE.md](ASSET-LICENSE.md)**.

### Provenance & Credits

- **Inspirational Attribution**: ItemSeed is conceptually inspired by Brian MacIntosh's notable web tool, [Icon Machine](https://bmaczero.itch.io/icon-machine).
- **Codebase Provenance**: Following a comprehensive forensic audit ([TASK-013](docs/pm/requirements/TASK-013-code-provenance-audit.md)), ItemSeed was verified with a **GREEN** rating as a completely clean-room, independent implementation with zero GPL code contamination.
- For complete audit details, architectural distinctions, and algorithmic baselines, see **[docs/PROVENANCE.md](docs/PROVENANCE.md)**.
