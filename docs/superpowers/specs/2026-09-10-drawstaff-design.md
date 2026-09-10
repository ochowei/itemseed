# Staff / Wand Generator — Design Specification

**Status:** Approved via Brainstorming, Ready for Implementation Planning  
**Date:** 2026-09-10  
**Tracking:** `[TASK-007]` in `FRONTEND_KANBAN.md`  
**Scope:** Implement `staff.js` with `drawStaff`, `sampleStaffSpec`, `renderStaffSpec32`, and `renderStaffSpec16`. Expand `palette.js` with `ELEMENT_FAMILIES`, wire into `main.js`, `index.html`, `regression.html`, and `i18n/`.

---

## 1. Goals & Non-Goals

### Goals
- Introduce a procedural magic staff generator (`drawStaff`) following the project's seeded, deterministic pixel-art icon conventions.
- Support **3 distinct head archetypes**:
  - `crescent`: Curved metallic bracket/horns framing a floating elemental crystal.
  - `orb`: Geometric cut crystal gem mounted directly atop a pronged collar.
  - `crozier`: Spiraling wooden crook with an embedded elemental core.
- Support **4 elemental magic palettes**:
  - `arcane`: Bright cyan-blue crystal glow.
  - `fire`: Rich red-orange flame radiance.
  - `nature`: Vibrant emerald green essence.
  - `shadow`: Deep amethyst-purple void luminescence.
- Maintain a **dual-palette system**:
  - Shaft: Classic wood tones (`WOOD_PALETTE` from `palette.js`).
  - Metal accents (collar, grip rings, ferrule): Metallic palette (`METAL_FAMILIES`).
  - Gem core: Elemental palette (`ELEMENT_FAMILIES`).
- Strict pixel-art constraints:
  - **Integer coordinates only** — no sub-pixel anti-aliasing.
  - **Continuous dark outline** — solid silhouette without 1-cell gaps or orphaned noise pixels.
  - **Dual native resolutions** — handcrafted 32×32 and compressed 16×16 layouts (no automatic downscaling).
- Full regression and static validation suite integration (`check-i18n`, `check-theme`, `snapshot-regression`).

### Non-Goals
- Detached glowing particles / aura sparkles around the crystal (these cause disconnected pixel noise and outline breakage at 16×16).
- Diagonal 45-degree wands in this milestone (vertical orientation chosen to maximize vertical resolution and complement `spear.js`).
- Animation or dynamic canvas lighting effects (stays strictly static 2D icons).

---

## 2. Architecture & Data Flow

Following the established two-phase pattern from `potion.js`, `sword.js`, `spear.js`, and `shield.js`:

```
drawStaff(ctx, rng, size)
  │
  ├─ Phase 1: sampleStaffSpec(rng)
  │     ↑ Centralized deterministic RNG sampling. Returns pure data spec object.
  │
  └─ Phase 2: size === 32 ? renderStaffSpec32(ctx, spec)
                          : renderStaffSpec16(ctx, spec)
        ↑ Pure rendering functions. Zero RNG calls. Identical spec produces identical canvas pixels.
```

### Spec Data Structure

```js
{
  archetype: 'crescent' | 'orb' | 'crozier',
  element: 'arcane' | 'fire' | 'nature' | 'shadow',
  metalFamily: 'gold' | 'steel' | 'bronze',
  gemPalette: {
    outline: string,   // Dark bounding outline for the crystal
    main: string,      // Midtone elemental body
    shadow: string,    // Shaded side
    shine: string,     // Specular highlight / internal glare
  },
  metalPalette: {
    outline: string,   // Metal outline
    main: string,      // Metal base
    shadow: string,    // Metal shadow
    shine: string,     // Metal highlight
  },
  hasGripRings: boolean,
  ringYs: number[],    // Explicit Y coordinates sampled in Phase 1 (e.g., [16, 22])
  buttStyle: 'spike' | 'rounded',
}
```

---

## 3. Palettes & Color System

### 3.1 `ELEMENT_FAMILIES` (New in `palette.js`)

Each element family provides a 4-color ramp:

| Family | Base Hue | Description |
|--------|----------|-------------|
| `arcane` | 195° | Cyan-blue magical glow |
| `fire` | 15° | Fiery amber-red flame |
| `nature` | 140° | Vibrant emerald green |
| `shadow` | 275° | Deep violet/amethyst void |

Formula structure:
- `outline`: `hsl(h, 45%, 10%)`
- `shadow`: `hsl(h, 85%, 35%)`
- `main`: `hsl(h, 80%, 55%)`
- `shine`: `hsl(h - 10, 70%, 85%)`

### 3.2 Shaft & Accents
- **Shaft**: Inherits `WOOD_PALETTE` (`main: #7a4820`, `shadow: #4d2b10`, `highlight: #a86834`, `outline: #261306`).
- **Collars & Rings**: Sampled from `METAL_FAMILIES` (`gold`, `steel`, `bronze`).

---

## 4. Canvas Geometry & Pixel Layout

### 4.1 32×32 Native Layout

Canvas: 32×32 integer grid. Center axis `cx = 16`.

```
Y =  0.. 1 : Margin
Y =  2..11 : Staff Head (Height: 10px, Width: 7..11px, centered at cx=16)
             - Crystal Core: centered at (cx, 6), radius ~3..4px
             - Bracket / Mounting Collar: connects crystal to shaft at y=10..11
Y = 12..26 : Shaft (Height: 15px, Width: 2px at x=15..16)
             - x=15: wood highlight
             - x=16: wood shadow
             - Grip Rings (optional): 1px height across x=14..17 at sampled ringYs
Y = 27..29 : Butt / Ferrule (Height: 3px, Width: 3..4px at x=14..17)
             - spike: tapering to single 1px tip at y=29, x=15..16
             - rounded: 4px wide cap at y=27..28, 2px wide at y=29
Y = 30..31 : Margin
```

### 4.2 16×16 Native Compressed Layout

Canvas: 16×16 integer grid. Center axis `cx = 8`.

```
Y =  0     : Margin
Y =  1.. 5 : Staff Head (Height: 5px, Width: 5px at x=6..10)
             - Simplified solid crystal with 1px highlight and dark collar
Y =  6..13 : Shaft (Height: 8px, Width: 1px at x=8)
             - Single pixel line with solid outline
             - Simplified 1px accent band at mid-shaft
Y = 14..15 : Butt / Ferrule (Height: 2px, Width: 2px at x=7..8)
```

---

## 5. Archetype Render Details

### 5.1 `crescent`
- **Head**: Two upward-curving metallic horns/prongs starting from a collar at `y=11` curving outward to `x=11` and `x=21`, with tips at `y=3`.
- **Core**: Floating diamond/circle elemental crystal nestled inside the horns at `y=4..8`.
- **Theme**: Classic high-mage / sorcerer focus staff.

### 5.2 `orb`
- **Head**: Large multifaceted diamond-cut crystal directly seated in a multi-pronged cup collar.
- **Core**: Prominent top highlight and faceted dark shadow edges.
- **Theme**: Arcane scholar / elemental conjurer staff.

### 5.3 `crozier`
- **Head**: Shaft extends upward, curving smoothly to one side (e.g. curling clockwise) forming a spiral crook.
- **Core**: Small glowing teardrop elemental crystal suspended within the loop of the wooden crook.
- **Theme**: Druidic nature staff / ancient priest relic.

---

## 6. Integration & Verification Plan

1. **Code Organization**:
   - `palette.js`: Add `ELEMENT_FAMILIES` and `sampleStaffPalette(rng)`.
   - `staff.js`: Implement generator functions and expose globally.
   - `main.js`: Register `staff: drawStaff` in `ITEM_TYPES`.
   - `index.html`: Add `<script src="staff.js"></script>` and `<option value="staff">`.
2. **Internationalization (`i18n`)**:
   - `i18n/zh-Hant.js`: `"type.option.staff": "法杖"`
   - `i18n/en.js`: `"type.option.staff": "Staff"`
   - Verify via `npm run check-i18n`.
3. **Regression Suite**:
   - `regression.html`: Add `<script src="staff.js"></script>`, define `STAFF_SEEDS` (16 fixed seeds covering all archetypes and elements), and add grid section `#grid-staff`.
   - Update `scripts/snapshot-regression.mjs` if needed to add targeted zoom targets.
   - Run `npm run snapshot -- --promote` to record golden snapshot baselines.
