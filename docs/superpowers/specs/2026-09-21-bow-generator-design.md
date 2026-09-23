# Bow Generator — Design Specification

**Status:** Approved via Brainstorming, Ready for Implementation Planning  
**Date:** 2026-09-21  
**Tracking:** `[TASK-025]` in `FRONTEND_KANBAN.md`  
**Scope:** Implement `bow.js` providing `drawBow`, `sampleBowSpec`, `renderBowSpec32`, and `renderBowSpec16`. Expand `palette.js` with `BOW_WOOD_FAMILIES` and `FLETCHING_COLORS`. Wire into `main.js`, `index.html`, `regression.html`, `i18n/` (`zh-Hant.js`, `en.js`, `ja.js`), and `scripts/package-itch.mjs`.

---

## 1. Goals & Non-Goals

### Goals
- Introduce a procedural bow generator (`drawBow`) adhering strictly to ItemSeed's seeded, deterministic pixel-art design standards.
- **Diagonal 45° Orientation**: Utilize the diagonal hypotenuse for maximum stave arc length and tension, with the arrowhead pointing top-right.
- **Nocked Arrow Composition**: Depict an arrow resting across the central grip with its nock engaged on the drawn bowstring.
- **3 Distinct Stave Archetypes**:
  - `longbow`: Smooth, large-radius parabolic arc emphasizing traditional tall English war bows, with protective metal nock caps.
  - `recurve`: Dynamic S-curve limbs bending outward at the tips to depict high-velocity composite recurve bows.
  - `shortbow`: Deep, compact U-arch with high curvature and a pronounced grip block.
- **Multi-Material Palette System**:
  - Bow stave: Dedicated wood families (`BOW_WOOD_FAMILIES` covering oak, yew, ash, and ebony).
  - Arrowhead and nock caps: Metallic families (`METAL_FAMILIES` covering steel, iron, bronze, gold, and obsidian).
  - Fletching: Vibrant feather pigments (crimson, emerald, azure, pure white).
  - Grip: Leather binding (`LEATHER_PALETTE`).
  - Bowstring: High-contrast single-pixel string line.
- **Strict Pixel Art Rules**:
  - Integer coordinates only — zero anti-aliasing or sub-pixel blurring.
  - Continuous 1px dark perimeter outline without orphan pixels or 1-cell gaps.
  - Dual native resolutions — dedicated 32×32 layout and compressed 16×16 layout.
- **Full Test Suite Integration**: Seamless verification through `npm run check-i18n`, `npm run check-batch`, `npm run check-theme`, and `npm run snapshot`.

### Non-Goals
- Quiver or extra loose arrows (would clutter canvas space and break silhouette legibility at 16×16).
- Animation or dynamic trajectory effects (ItemSeed exclusively produces static equipment icons).
- Multi-angle rotation (strict 45° diagonal ensures clean, crisp integer grid rasterization).

---

## 2. Architecture & Data Flow

Following the established two-phase pipeline pattern from `potion.js`, `sword.js`, `spear.js`, `shield.js`, and `staff.js`:

```
drawBow(ctx, rng, size)
  │
  ├─ Phase 1: sampleBowSpec(rng)
  │     ↑ Centralized deterministic RNG sampling. Returns a pure data spec object.
  │
  └─ Phase 2: size === 32 ? renderBowSpec32(ctx, spec)
                          : renderBowSpec16(ctx, spec)
        ↑ Pure rendering functions. Zero RNG consumption. Identical spec yields pixel-identical canvas output.
```

### Spec Data Structure

```js
{
  archetype: 'longbow' | 'recurve' | 'shortbow',
  woodFamily: 'oak' | 'yew' | 'ash' | 'ebony',
  woodPalette: {
    outline: string,
    main: string,
    shadow: string,
    shine: string,
  },
  metalFamily: 'steel' | 'iron' | 'bronze' | 'gold' | 'obsidian',
  metalPalette: {
    outline: string,
    main: string,
    shadow: string,
    shine: string,
  },
  fletchingColor: 'crimson' | 'emerald' | 'azure' | 'white',
  hasGripWrap: boolean,
  hasNockReinforcement: boolean,
}
```

---

## 3. Palettes & Color System

### 3.1 `BOW_WOOD_FAMILIES` (in `palette.js`)

Each wood family produces a 4-color ramp (`outline`, `main`, `shadow`, `shine`):

| Family | Base Tone | Description |
|---|---|---|
| `oak` | Golden-brown | Warm, reliable standard oak stave |
| `yew` | Reddish-brown | Traditional war bow wood with rich heartwood hues |
| `ash` | Pale amber | Light-colored, springy, flexible timber |
| `ebony` | Charcoal violet-black | Rare, exotic dense darkwood |

### 3.2 Arrowhead & Accents (`METAL_FAMILIES`)
Reuses the existing `sampleSwordPalette(rng)` to ensure visual harmony with `sword.js` and `spear.js`.

### 3.3 `FLETCHING_COLORS`
Crisp feather dyes:
- `crimson`: `#b91c1c` / `#ef4444`
- `emerald`: `#15803d` / `#22c55e`
- `azure`: `#1d4ed8` / `#3b82f6`
- `white`: `#cbd5e1` / `#f8fafc`

---

## 4. Silhouette & Geometry Layout

### 4.1 32×32 Native Layout
- **Arrow Axis**: Diagonal line starting at fletching `(6, 25)` and ending at arrowhead tip `(26, 5)`.
  - Arrowhead: 3×3 faceted diamond point centered around `(25, 6)`.
  - Fletching: 2 angled feather vanes flanking `(6, 25)` to `(8, 27)`.
- **Bow Stave**: Arches perpendicular to the arrow path:
  - Upper limb: Emerges from grip center `(16, 16)`, arching outward to tip `(8, 5)`.
  - Lower limb: Emerges from grip center `(16, 16)`, arching outward to tip `(26, 23)`.
  - `longbow`: Continuous parabolic arc spanning limbs smoothly.
  - `recurve`: Outward counter-flexing tips at `(7, 6)` and `(25, 24)`.
  - `shortbow`: Tight, circular arc with shorter radius and compact limbs.
- **Bowstring**: Tight dual-line tension from upper nock to nocking point `(10, 21)` and from lower nock to `(10, 21)`.

### 4.2 16×16 Native Layout
- **Arrow Axis**: Diagonal line starting at `(3, 12)` and ending at tip `(13, 2)`.
  - Arrowhead: 2×2 diamond point at `(12, 3)` .. `(13, 2)`.
  - Fletching: 2px offset feather barb at `(3, 12)`.
- **Bow Stave**: Continuous 1px outline arc passing through center `(8, 8)`.
- **Bowstring**: 1px crisp diagonal string line.

---

## 5. System Integration & Workflow

### 5.1 Application Registration
1. `bow.js` registered in `main.js` `ITEM_TYPES.bow = drawBow`.
2. Loaded in `index.html` and `regression.html` via `<script src="bow.js"></script>`.
3. Dropdown option added to `#type-select` in `index.html`.
4. Multi-language entries added:
   - `i18n/zh-Hant.js`: `'type.option.bow': '弓 (bow)'`
   - `i18n/en.js`: `'type.option.bow': 'Bow'`
   - `i18n/ja.js`: `'type.option.bow': '弓 (bow)'`
5. Deployment package updated in `scripts/package-itch.mjs`.

### 5.2 Visual Regression Grid (`regression.html`)
- Add `#grid-bow` section.
- Add `BOW_SEEDS` array with at least 16 deterministic seeds verifying archetype and material coverage across both 32×32 and 16×16.

### 5.3 Automated Validation Suite
- `npm run check-i18n` — 100% dictionary key parity.
- `npm run check-batch` — Batch click seed consistency.
- `npm run snapshot -- --promote` — Generate and verify visual regression snapshots.
- `npm test` — Full automated regression pass.
