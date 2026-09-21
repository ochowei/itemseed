# [TASK-025] Implement Bow Generator (32×32 and 16×16)

## 1. Overview & Objective
Introduce a procedural bow and arrow generator (`bow.js`), expanding ItemSeed's equipment repertoire to 6 item archetypes. The bow features a diagonal 45° orientation with a nocked arrow, supporting 3 stave archetypes, multi-species wood and metal palettes, dynamic fletching variations, and full dual-resolution support (32×32 and 16×16).

See full architecture design specification in [docs/superpowers/specs/2026-09-21-bow-generator-design.md](../superpowers/specs/2026-09-21-bow-generator-design.md).

## 2. Scope & Technical Deliverables

### 2.1 Core Procedural Engine (`bow.js`)
- Expose `sampleBowSpec(rng)` returning a deterministic spec object.
- Expose `renderBowSpec32(ctx, spec)` and `renderBowSpec16(ctx, spec)` as pure rendering functions.
- Expose `drawBow(ctx, rng, size)` as the unified entry point.
- Implement 3 stave archetypes:
  - `longbow`: Smooth, large-radius parabolic curve with reinforced nock tips.
  - `recurve`: Outward counter-flexing tips forming an S-curve profile.
  - `shortbow`: Compact, deep-draw arch with an enlarged central grip.
- Implement nocked arrow with metallic arrowhead, wood shaft, and colored fletching.

### 2.2 Palette System Expansion (`palette.js`)
- Define `BOW_WOOD_FAMILIES` (`oak`, `yew`, `ash`, `ebony`) with 4-color ramps (`outline`, `main`, `shadow`, `shine`).
- Define `FLETCHING_COLORS` (`crimson`, `emerald`, `azure`, `white`).
- Expose `sampleBowPalette(rng)` integrating wood, metal (`sampleSwordPalette`), and fletching selections.

### 2.3 Studio & Application Integration (`index.html`, `main.js`)
- Register `bow: drawBow` in `ITEM_TYPES` in `main.js`.
- Add `<script src="bow.js"></script>` to `index.html`.
- Add `<option value="bow" data-i18n-key="type.option.bow">` in `#type-select`.

### 2.4 Multi-Language Support (`i18n/`)
- Add `'type.option.bow': '弓 (bow)'` to `i18n/zh-Hant.js`.
- Add `'type.option.bow': 'Bow'` to `i18n/en.js`.
- Add `'type.option.bow': '弓 (bow)'` to `i18n/ja.js`.

### 2.5 Regression Grid & Testing (`regression.html`, `scripts/`)
- Add `#grid-bow` in `regression.html` with `BOW_SEEDS` (16 fixed deterministic seeds).
- Include `bow.js` in `scripts/package-itch.mjs`.
- Verify `npm run check-i18n`, `npm run check-batch`, and capture baseline snapshots with `npm run snapshot -- --promote`.
