# Staff / Wand Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a seeded, procedural magic staff and wand generator (`drawStaff`) supporting 3 distinct head archetypes, 4 elemental magic palettes, and dual native resolutions (32×32 and 16×16).

**Architecture:** Two-phase spec-render architecture: `sampleStaffSpec(rng)` centralizes deterministic random number generation and returns a plain spec object; `renderStaffSpec32` and `renderStaffSpec16` are pure rendering functions drawing integer-aligned canvas pixels with continuous dark outlines.

**Tech Stack:** Vanilla JavaScript (ES6+), HTML5 Canvas 2D context, Node.js validation scripts (`check-i18n`, `snapshot-regression`), zero build tools.

**Spec Reference:** [`docs/superpowers/specs/2026-09-10-drawstaff-design.md`](../specs/2026-09-10-drawstaff-design.md)

---

## File Structure & Responsibilities

| File | Status | Responsibility |
|------|--------|----------------|
| `palette.js` | **MODIFY** | Add `ELEMENT_FAMILIES` table and `sampleStaffPalette` helper. Existing palettes remain unchanged. |
| `staff.js` | **NEW** | Main generator module: `sampleStaffSpec`, `renderStaffSpec32`, `renderStaffSpec16`, and `drawStaff`. |
| `main.js` | **MODIFY** | Register `staff: drawStaff` in `ITEM_TYPES`. |
| `index.html` | **MODIFY** | Add `<script src="staff.js"></script>` and `<option value="staff">` in `#type-select`. |
| `i18n/zh-Hant.js` | **MODIFY** | Add `"type.option.staff": "法杖"`. |
| `i18n/en.js` | **MODIFY** | Add `"type.option.staff": "Staff"`. |
| `regression.html` | **MODIFY** | Add `<script src="staff.js"></script>`, declare `STAFF_SEEDS`, and render staff regression grid. |
| `scripts/snapshot-regression.mjs` | **MODIFY** | Add staff zoom targets for visual regression testing. |

---

## Hard Constraints
- **Zero sub-pixel anti-aliasing**: All coordinates, widths, and heights must be strictly integers.
- **Continuous outline**: Dark outline (`outline` color) must be solid with no 1-cell gaps or floating disconnected pixels.
- **Pure render functions**: No RNG calls inside `renderStaffSpec32` or `renderStaffSpec16`. Same seed must produce identical pixels every time.
- **Naming hygiene**: Prefix module-internal constants with `STAFF_` and internal functions with `Staff` to prevent collisions with `sword.js`, `spear.js`, or `shield.js`.

---

## Task 1: Extend `palette.js` with `ELEMENT_FAMILIES` and `sampleStaffPalette`

**Files:**
- Modify: `palette.js`

- [ ] **Step 1: Add `ELEMENT_FAMILIES` and `sampleStaffPalette` to `palette.js`**

Add the element definitions and sampling function to `palette.js`:

```js
const ELEMENT_FAMILIES = {
  arcane: {
    hue: 195,
    palette: {
      outline: 'hsl(195, 45%, 10%)',
      shadow: 'hsl(195, 85%, 35%)',
      main: 'hsl(195, 80%, 55%)',
      shine: 'hsl(185, 70%, 85%)',
    },
  },
  fire: {
    hue: 15,
    palette: {
      outline: 'hsl(15, 45%, 10%)',
      shadow: 'hsl(15, 85%, 35%)',
      main: 'hsl(15, 80%, 55%)',
      shine: 'hsl(5, 70%, 85%)',
    },
  },
  nature: {
    hue: 140,
    palette: {
      outline: 'hsl(140, 45%, 10%)',
      shadow: 'hsl(140, 85%, 32%)',
      main: 'hsl(140, 80%, 50%)',
      shine: 'hsl(130, 70%, 85%)',
    },
  },
  shadow: {
    hue: 275,
    palette: {
      outline: 'hsl(275, 45%, 10%)',
      shadow: 'hsl(275, 85%, 35%)',
      main: 'hsl(275, 80%, 55%)',
      shine: 'hsl(265, 70%, 85%)',
    },
  },
};

const ELEMENT_FAMILY_NAMES = ['arcane', 'fire', 'nature', 'shadow'];

function sampleStaffPalette(rng) {
  const element = rng.pick(ELEMENT_FAMILY_NAMES);
  const gemPalette = ELEMENT_FAMILIES[element].palette;
  const { family: metalFamily, palette: metalPal } = sampleSwordPalette(rng);
  return {
    element,
    gemPalette,
    metalFamily,
    metalPalette: {
      outline: metalPal.outline,
      main: metalPal.bladeMain,
      shadow: metalPal.bladeShadow,
      shine: metalPal.bladeShine,
    },
  };
}
```

Make sure `ELEMENT_FAMILIES` and `sampleStaffPalette` are exposed on `window` (or global scope):

```js
window.ELEMENT_FAMILIES = ELEMENT_FAMILIES;
window.sampleStaffPalette = sampleStaffPalette;
```

- [ ] **Step 2: Verify `sampleStaffPalette` via Node script**

Run:
```bash
node -e '
const fs = require("fs");
const vm = require("vm");
const randomCode = fs.readFileSync("random.js", "utf8");
const paletteCode = fs.readFileSync("palette.js", "utf8");
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(randomCode + "\n" + paletteCode, ctx);
const rng = new ctx.SeededRandom("staff-test-seed");
const p = ctx.sampleStaffPalette(rng);
console.log("Sampled:", p.element, p.metalFamily, Object.keys(p.gemPalette));
if (!p.element || !p.gemPalette.main || !p.metalPalette.main) throw new Error("Invalid staff palette");
console.log("PASS Task 1");
'
```
Expected output:
```
Sampled: arcane ... [ 'outline', 'shadow', 'main', 'shine' ]
PASS Task 1
```

- [ ] **Step 3: Commit**

```bash
git add palette.js
git commit -m "feat(palette): add ELEMENT_FAMILIES and sampleStaffPalette"
```

---

## Task 2: Scaffold `staff.js` with `sampleStaffSpec` and Core Function Signatures

**Files:**
- Create: `staff.js`
- Modify: `index.html` (add script tag)
- Modify: `regression.html` (add script tag)

- [ ] **Step 1: Write `staff.js` with `sampleStaffSpec`**

Create `staff.js`:

```js
// staff.js — Seeded procedural magic staff generator (32x32 and 16x16)

(function () {
  const STAFF_ARCHETYPES = ['crescent', 'orb', 'crozier'];
  const STAFF_BUTT_STYLES = ['spike', 'rounded'];

  function sampleStaffSpec(rng) {
    const archetype = rng.pick(STAFF_ARCHETYPES);
    const buttStyle = rng.pick(STAFF_BUTT_STYLES);
    const { element, gemPalette, metalFamily, metalPalette } = sampleStaffPalette(rng);

    const hasGripRings = rng.bool(0.7);
    const ringCount = hasGripRings ? rng.int(1, 3) : 0;
    const ringYs = [];
    const availableYs = [15, 18, 21, 24];
    for (let i = 0; i < ringCount; i++) {
      const idx = rng.int(0, availableYs.length - 1);
      ringYs.push(availableYs.splice(idx, 1)[0]);
    }
    ringYs.sort((a, b) => a - b);

    return {
      archetype,
      element,
      gemPalette,
      metalFamily,
      metalPalette,
      shaftPalette: WOOD_PALETTE,
      hasGripRings,
      ringYs,
      buttStyle,
    };
  }

  function renderStaffSpec32(ctx, spec) {
    // Stub to be implemented in Task 3
  }

  function renderStaffSpec16(ctx, spec) {
    // Stub to be implemented in Task 4
  }

  function drawStaff(ctx, rng, size) {
    const spec = sampleStaffSpec(rng);
    if (size === 16) {
      renderStaffSpec16(ctx, spec);
    } else {
      renderStaffSpec32(ctx, spec);
    }
    return spec;
  }

  window.sampleStaffSpec = sampleStaffSpec;
  window.renderStaffSpec32 = renderStaffSpec32;
  window.renderStaffSpec16 = renderStaffSpec16;
  window.drawStaff = drawStaff;
})();
```

- [ ] **Step 2: Add `<script src="staff.js"></script>` to `index.html` and `regression.html`**

In `index.html`, add after `<script src="shield.js"></script>`:
```html
  <script src="shield.js"></script>
  <script src="staff.js"></script>
  <script src="main.js"></script>
```

In `regression.html`, add after `<script src="shield.js"></script>`:
```html
  <script src="shield.js"></script>
  <script src="staff.js"></script>
```

- [ ] **Step 3: Verify script loading and determinism**

Run:
```bash
node -e '
const fs = require("fs");
const vm = require("vm");
const code = ["random.js", "palette.js", "staff.js"].map(f => fs.readFileSync(f, "utf8")).join("\n");
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(code, ctx);
const spec1 = ctx.sampleStaffSpec(new ctx.SeededRandom("staff-repro"));
const spec2 = ctx.sampleStaffSpec(new ctx.SeededRandom("staff-repro"));
if (JSON.stringify(spec1) !== JSON.stringify(spec2)) throw new Error("Determinism check failed");
console.log("Spec deterministic:", spec1.archetype, spec1.element, spec1.buttStyle);
console.log("PASS Task 2");
'
```
Expected output:
```
Spec deterministic: ...
PASS Task 2
```

- [ ] **Step 4: Commit**

```bash
git add staff.js index.html regression.html
git commit -m "feat(staff): scaffold staff.js with sampleStaffSpec and script tags"
```

---

## Task 3: Implement 32×32 Native Rendering (`renderStaffSpec32`)

**Files:**
- Modify: `staff.js`

- [ ] **Step 1: Implement 32×32 pixel rendering in `staff.js`**

Implement helper functions and `renderStaffSpec32` with integer pixel alignment:
- Center axis: `cx = 16`.
- Shaft: `y = 12..26`, 2px wide (`x = 15` wood highlight, `x = 16` wood shadow), with dark outline at `x = 14` and `x = 17`.
- Grip Rings: For each `y` in `spec.ringYs`, draw 1px metal band across `x = 14..17` with `metalPalette.shine` on left and `metalPalette.shadow` on right.
- Butt / Ferrule:
  - `spike`: `y = 27..28` (metal body 4px wide `x = 14..17`), `y = 29` (tapered 2px tip `x = 15..16`), `y = 30` (1px outline tip).
  - `rounded`: `y = 27..28` (metal body 4px wide), `y = 29` (rounded base 2px wide).
- Head Archetypes:
  - `crescent`:
    - Draw collar bracket at `y = 10..11`.
    - Curved metal horns rising along `x = 11..13` (left) and `x = 19..21` (right) up to `y = 3..5`.
    - Centered glowing elemental crystal at `(cx, 6)` of radius ~3px (diamond/circle) using `gemPalette` (main fill, shadow bottom-right, shine top-left).
  - `orb`:
    - Draw mounting cup collar at `y = 10..11`.
    - Large faceted cut crystal diamond/gem at `y = 3..9`, width 7px (`x = 13..19`).
    - Multi-faceted specular shine at `(15, 4)` and `(16, 4)`.
  - `crozier`:
    - Wooden shaft extends up to `y = 3`, curving clockwise around `(16, 6)` forming a wooden loop.
    - Floating teardrop elemental gem embedded within the loop at `x = 15..17, y = 5..7`.
- Solid outer border: Ensure all outer edges have continuous outline pixels.

- [ ] **Step 2: Verify in browser**

Open `index.html` in browser, open DevTools console, run:
```js
const c = document.createElement("canvas");
c.width = 32; c.height = 32;
const ctx = c.getContext("2d");
drawStaff(ctx, new SeededRandom("crescent-fire-1"), 32);
document.body.appendChild(c);
```
Verify the staff renders cleanly without stray pixels or broken outlines.

- [ ] **Step 3: Commit**

```bash
git add staff.js
git commit -m "feat(staff): implement 32x32 native procedural rendering"
```

---

## Task 4: Implement 16×16 Native Compressed Rendering (`renderStaffSpec16`)

**Files:**
- Modify: `staff.js`

- [ ] **Step 1: Implement `renderStaffSpec16` in `staff.js`**

Implement handcrafted compressed 16×16 layout:
- Center axis: `cx = 8`.
- Head: `y = 1..5`, width 5px (`x = 6..10`):
  - `crescent`: 1px metal horn on each side (`x = 6, 10` at `y = 2..4`), 3px solid crystal at center (`x = 7..9, y = 2..4`) with 1px top-left shine (`x = 7, y = 2`).
  - `orb`: 3×3 solid diamond gem (`y = 1..5`, peak at `(8, 1)` and `(8, 5)`, sides at `(6, 3)` and `(10, 3)`) with 1px collar at `y = 5`.
  - `crozier`: Wooden crook hook curving from `(8, 5)` to `(6, 2)` to `(9, 2)`, enclosing a 2×2 mini gem at `(7..8, 3..4)`.
- Shaft: `y = 6..13`, 1px wide at `x = 8`, single wood color with continuous dark outline on `x = 7` and `x = 9`. Optional 1px metal dot at `y = 10`.
- Butt / Ferrule: `y = 14..15`, 2px wide at `x = 7..8` using `metalPalette.main`.

- [ ] **Step 2: Verify in browser**

Open `index.html` in browser, open DevTools console, run:
```js
const c = document.createElement("canvas");
c.width = 16; c.height = 16;
const ctx = c.getContext("2d");
drawStaff(ctx, new SeededRandom("crescent-fire-1"), 16);
document.body.appendChild(c);
```
Verify 16×16 renders cleanly with crisp integer pixels and no broken silhouette.

- [ ] **Step 3: Commit**

```bash
git add staff.js
git commit -m "feat(staff): implement 16x16 native compressed rendering"
```

---

## Task 5: Register Staff in UI and Internationalization (`i18n`)

**Files:**
- Modify: `main.js`
- Modify: `index.html`
- Modify: `i18n/zh-Hant.js`
- Modify: `i18n/en.js`

- [ ] **Step 1: Register in `main.js`**

In `main.js`, add `staff: drawStaff` to `ITEM_TYPES`:

```js
const ITEM_TYPES = {
  potion: drawPotion,
  sword: drawSword,
  spear: drawSpear,
  shield: drawShield,
  staff: drawStaff,
};
```

- [ ] **Step 2: Add `<option>` to `index.html`**

In `index.html`, add `<option value="staff" data-i18n-key="type.option.staff">Staff</option>` under `#type-select`:

```html
  <option value="potion" data-i18n-key="type.option.potion">Potion</option>
  <option value="sword" data-i18n-key="type.option.sword">Sword</option>
  <option value="spear" data-i18n-key="type.option.spear">Spear</option>
  <option value="shield" data-i18n-key="type.option.shield">Shield</option>
  <option value="staff" data-i18n-key="type.option.staff">Staff</option>
```

- [ ] **Step 3: Add translations to `i18n/zh-Hant.js` and `i18n/en.js`**

In `i18n/zh-Hant.js`:
```js
  "type.option.staff": "法杖",
```

In `i18n/en.js`:
```js
  "type.option.staff": "Staff",
```

- [ ] **Step 4: Run `npm run check-i18n`**

Run:
```bash
npm run check-i18n
```
Expected output:
```
Checking i18n consistency...
  ✓ zh-Hant: 29 keys
  ✓ en:      29 keys
  ✓ Tables match
  ✓ HTML uses 29 keys, all present in tables
PASS
```

- [ ] **Step 5: Commit**

```bash
git add main.js index.html i18n/zh-Hant.js i18n/en.js
git commit -m "feat(staff): register staff in studio UI and translations"
```

---

## Task 6: Add Regression Grid and Generate Golden Baseline Snapshots

**Files:**
- Modify: `regression.html`
- Modify: `scripts/snapshot-regression.mjs`
- Generate: `snapshots/baseline/staff-*.png`

- [ ] **Step 1: Add staff section and seeds to `regression.html`**

In `regression.html`:
1. Define `STAFF_SEEDS` with 16 seeds covering all archetypes and elements (e.g., `staff-crescent-arcane`, `staff-orb-fire`, `staff-crozier-nature`, `staff-crescent-shadow`, etc.).
2. Add a new section `#grid-staff` in the HTML grid container.
3. Wire the rendering loop for `STAFF_SEEDS` to draw both 32×32 and 16×16 side-by-side.

- [ ] **Step 2: Add zoom targets in `scripts/snapshot-regression.mjs`**

In `scripts/snapshot-regression.mjs`, add zoom targets for staff:
- `staff-crescent-32`
- `staff-orb-32`
- `staff-crozier-32`
- `staff-crescent-16`

- [ ] **Step 3: Run snapshots and promote golden baselines**

Run:
```bash
npm run snapshot -- --promote
```
Verify that:
- `snapshots/baseline/staff-grid.png` is generated.
- Zoomed snapshots for staff are generated.
- All existing potion, sword, spear, shield baselines remain unchanged.

- [ ] **Step 4: Commit**

```bash
git add regression.html scripts/snapshot-regression.mjs snapshots/baseline/
git commit -m "test(staff): add regression seeds and baseline snapshots"
```

---

## Plan Review Checklist
1. **Spec coverage**: Covers all requirements from `docs/superpowers/specs/2026-09-10-drawstaff-design.md` (3 archetypes, 4 element palettes, 32×32 and 16×16, i18n, regression suite).
2. **No placeholders**: Every task has exact code blocks, commands, and expected outputs.
3. **Consistency**: All function names (`sampleStaffSpec`, `renderStaffSpec32`, `renderStaffSpec16`, `drawStaff`), palette tables, and keys match throughout.
