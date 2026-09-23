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

| Type    | 32×32 | 16×16 | Source     | Status |
|---------|-------|-------|------------|--------|
| Potion  | ✓     | ✓     | `potion.js` | Stable |
| Sword   | ✓     | ✓     | `sword.js`  | Stable |
| Spear   | ✓     | ✓     | `spear.js`  | Stable |
| Shield  | ✓     | ✓     | `shield.js` | Stable |
| Staff   | ✓     | ✓     | `staff.js`  | Stable |
| Bow 🚩  | ✓     | ✓     | `bow.js`    | Preview (Feature Flag) |

> 🚩 **Note**: Features marked with a flag are preview items disabled by default in `index.html`. They can be enabled on-demand via URL parameters or browser `localStorage`. In `regression.html`, all item types are always rendered for testing.

## Feature flags

ItemSeed includes experimental and preview features guarded by lightweight feature flags. By default, preview features are disabled in the production studio (`index.html`) to ensure a stable baseline experience, while remaining fully visible in `regression.html` for continuous visual testing.

### Available flags

| Flag | Item / Capability | Default State | Description |
|------|-------------------|---------------|-------------|
| `bow` | Bow Asset Generator | `false` (Disabled) | Procedural bow generator supporting longbow, recurve, and shortbow archetypes with feathered arrows. |

When a flag like `bow` is disabled:
- The item type does not appear in the `#type-select` dropdown in `index.html`.
- The `any` (random) type mode will never pick this item type.

### How to enable feature flags

Flags can be enabled either for a single browser session via URL parameters, or persistently across browser reloads via `localStorage`.

#### 1. Via URL parameter (single session / query string)

Append `?<flag>=1` or `?features=<flag>` to the studio URL:

```bash
# Enable bow via dedicated parameter
open "index.html?bow=1"

# Enable bow via comma-separated features parameter
open "index.html?features=bow"
```

To explicitly force-disable a flag regardless of storage:
```bash
open "index.html?bow=0"
```

#### 2. Via Developer Console / LocalStorage (persistent across reloads)

Open browser Developer Tools (<kbd>F12</kbd> or <kbd>Cmd</kbd> + <kbd>Option</kbd> + <kbd>I</kbd>) on `index.html` and use the built-in runtime API:

```javascript
// Enable bow feature (persists in localStorage)
window.FEATURES.setFeature('bow', true);
location.reload();

// Disable bow feature
window.FEATURES.setFeature('bow', false);
location.reload();

// Check current status
window.FEATURES.isEnabled('bow'); // returns true or false
```

Alternatively, set the `localStorage` key directly:

```javascript
localStorage.setItem('itemseed.feature.bow', 'true');
location.reload();
```

#### Resolution precedence

The feature flag runtime evaluates settings in the following strict order:
1. **URL parameter** (`?bow=1` or `?bow=0` or `?features=bow`)
2. **Local storage** (`itemseed.feature.bow` in `localStorage`)
3. **Default value** (`false`)

## Project structure

```
index.html                single-icon studio + 24-cell batch preview
regression.html           16+ deterministic seeds per type, 32 / 16 side by side
main.js                   UI wiring + ITEM_TYPES registry + feature flags runtime
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
bow.js                    drawBow    + sample / render pair (32 & 16) [preview]
scripts/
  snapshot-regression.mjs headless Chromium screenshots regression.html
  find-seed.mjs           brute-force seed search for rare combos
  test-theme.mjs          unit tests for theme runtime state transitions
  check-i18n.mjs          static integrity checker for locale keys vs index.html
  test-feature-flags.mjs  unit tests for feature flag URL/storage precedence
  test-batch-preview.mjs  unit tests for 24-cell batch preview determinism
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

### Automated test suites

Fast Node-based checks verify theme logic, translations, feature flags, and batch generation:

```bash
npm run check-theme               # verifies theme state transitions and storage
npm run check-i18n                # verifies zh-Hant and en parity + index.html keys
npm run check-flags               # verifies feature flag URL/storage precedence and filtering
npm run check-batch               # verifies 24-cell batch preview deterministic generation
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
- Node 18+ and `npm install` to run tests and snapshot regressions (`npm test`, `npm run check-theme`, `npm run check-i18n`, `npm run check-flags`, `npm run check-batch`, `npm run snapshot`)

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
