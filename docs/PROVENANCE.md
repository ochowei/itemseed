# ItemSeed Code Provenance & Licensing Audit

**Document Status:** Final / Approved  
**Audit Date:** 2026-09-14  
**Audit Classification:** **GREEN** (Independent Implementation)  
**Lead Auditor:** Project Management & Architecture Governance  

---

## 1. Executive Summary

ItemSeed is a deterministic, procedural pixel-art RPG item icon generator built entirely in vanilla JavaScript and HTML5 Canvas. The project was conceptually inspired by Brian MacIntosh's notable web tool, *Icon Machine*, which is licensed under the GNU General Public License (GPL).

Because the GPL is a "copyleft" license, any software directly derived from, copied from, or containing translated GPL source code must also be licensed under the GPL. If any GPL-licensed code had entered the ItemSeed repository, downstream game developers who generate assets or integrate the procedural code into their commercial games could face legal uncertainty regarding licensing obligations.

This audit was conducted under **[TASK-013]** to trace the origins of every file, algorithm, and commit in the ItemSeed repository from root commit (`f9b8f4e`) to `HEAD`. 

### Key Findings
1. **Zero GPL Source Contamination:** ItemSeed was built from scratch as an independent repository. No files, functions, tables, or algorithms were copied, decompiled, or translated from Brian MacIntosh's *Icon Machine*.
2. **Standard Public Domain Math:** Algorithms used for hashing and pseudorandom number generation (`Mulberry32` and simplified `cyrb53`) are well-established public domain / CC0 algorithms authored by third-party researchers, completely unrelated to *Icon Machine*.
3. **Novel Two-Phase Architecture:** ItemSeed's internal architecture (`seed -> spec -> render`) and 2D enum mask outline/seam shaders are bespoke designs engineered specifically for ItemSeed.
4. **Audit Classification: GREEN:** The codebase is certified as an independent implementation. It is fully eligible for a permissive open-source license (such as **MIT** or **ISC**) for its source code, and **CC0 1.0 Universal** for its generated assets, providing total commercial freedom to game developers.

---

## 2. Inspirational Attribution

ItemSeed proudly and transparently acknowledges its conceptual inspiration:

> **"ItemSeed is inspired by Brian MacIntosh's Icon Machine."**  
> Original Project: [Brian MacIntosh's Icon Machine on itch.io](https://bmaczero.itch.io/icon-machine)

### Visual Inspiration vs. Code Reference
* **Visual & Functional Inspiration (Acknowledged):** The concept of generating 16×16 and 32×32 pixel-art fantasy RPG item icons (potions, swords, spears, shields, staves) using a text seed and procedural pixel grids was popularized by Brian MacIntosh. ItemSeed honors this creative legacy by citing this attribution in its user interface footer, README, and project documentation.
* **Code Provenance (Zero Direct Derivation):** No source code, data tables, sprite sheets, or logic flows from *Icon Machine* were used to develop ItemSeed. All logic in ItemSeed was authored independently from procedural specifications.

---

## 3. Public Domain & Standard Algorithms Referenced

ItemSeed relies on two standard mathematical algorithms for deterministic pseudo-random number generation (PRNG). Neither algorithm originates from Brian MacIntosh or *Icon Machine*:

### 3.1 Mulberry32 PRNG (`random.js`)
* **Author:** Tommy Ettinger (2017).
* **License / Legal Status:** Public Domain / CC0.
* **Role in ItemSeed:** Serves as the core 32-bit PRNG generator. Given an identical 32-bit state, Mulberry32 deterministically outputs identical pseudo-random floating-point numbers in $[0, 1)$.
* **Algorithmic Baseline:** Standard 32-bit bit-mixing arithmetic (`t += 0x6d2b79f5; Math.imul(...)`).

### 3.2 cyrb53 Hash (`random.js`)
* **Author:** bryc (2018).
* **License / Legal Status:** Public Domain / CC0.
* **Role in ItemSeed:** Converts arbitrary user-supplied string seeds (e.g. `"rusty-blade-42"`, `"dragon-slayer"`) into a uniform 32-bit integer to seed the `Mulberry32` generator.
* **Algorithmic Baseline:** Standard double-accumulator 53-bit hash reduced to a 32-bit integer seed via bitwise XOR.

### 3.3 Standard HSL to RGB Color Space Mathematics (`palette.js`)
* **Role in ItemSeed:** Converts procedural Hue, Saturation, and Lightness coordinates into standard 7-character hexadecimal RGB strings (`#RRGGBB`).
* **Algorithmic Baseline:** Standard cylindrical color space projection formula widely published in computer graphics literature.

---

## 4. Independent Architectural Model: Two-Phase `seed -> spec -> render`

Unlike traditional procedural generators that interleave random decisions directly with canvas drawing calls, ItemSeed enforces a strict **two-phase architectural separation**:

```
                  ┌───────────────────────────────┐
                  │          Input Seed           │
                  │   ("rusty-blade-42" / any)   │
                  └──────────────┬────────────────┘
                                 │
                 Phase 1: Sampling (PRNG Active)
                                 ▼
                  ┌───────────────────────────────┐
                  │    sample<Item>Spec(rng)      │
                  │  - Picks shape archetype      │
                  │  - Samples color palette      │
                  │  - Selects features & coords  │
                  └──────────────┬────────────────┘
                                 │
                    Pure Data: spec Object (JSON)
                                 ▼
                 Phase 2: Rendering (PRNG Prohibited)
                   ┌─────────────┴─────────────┐
                   ▼                           ▼
      ┌─────────────────────────┐ ┌─────────────────────────┐
      │  render<Item>Spec32()   │ │  render<Item>Spec16()   │
      │  - 32x32 Silhouette     │ │  - 16x16 Silhouette     │
      │  - 2D Enum Mask         │ │  - Feature Collapse     │
      │  - Inside Outline Pass  │ │  - Inside Outline Pass  │
      │  - Internal Seam Pass   │ │  - Internal Seam Pass   │
      └────────────┬────────────┘ └────────────┬────────────┘
                   │                           │
                   └─────────────┬─────────────┘
                                 ▼
                  ┌───────────────────────────────┐
                  │     Deterministic Canvas      │
                  │    (Pixel-Exact Output)       │
                  └───────────────────────────────┘
```

### Architectural Distinctions
1. **Phase 1: Sampler (`sample<Item>Spec(rng)`):**
   * Consumes the PRNG stream deterministically.
   * Emits a pure, declarative, JSON-serializable `spec` object describing all visual attributes (family, palette, shape archetype, attachments, coordinates).
2. **Phase 2: Renderer (`render<Item>Spec32` / `render<Item>Spec16`):**
   * **Pure Functions:** Zero PRNG calls occur during rendering. Given identical `spec` objects, the renderers produce 100% bit-for-bit identical canvas pixels.
   * **2D Enum Mask Rasterization:** Allocates a flat 1D array representing a 2D enum grid (`allocateMask(size)`). Shapes fill the grid with semantic tokens (`'blade'`, `'guard'`, `'grip'`, `'gem'`).
   * **Inside-Edge Outline Shader (`applyInsideOutlinePass`):** Evaluates 4-neighbors (North, South, East, West). If a pixel is occupied and at least one 4-neighbor is null (empty), it is painted with the dark outline color. This algorithmically guarantees unbroken closed outlines without manual pixel tracing.
   * **Internal Seam Shader (`paintInternalSeams`):** Evaluates 4-neighbors; if an adjacent cell has a different non-null component tag, a 1px boundary seam is shaded.
3. **Bespoke 16×16 Downscaling (Not Downsampling):**
   * 16×16 sprites are not downsampled or filtered from 32×32 assets. Each item type features a hand-crafted 16×16 silhouette function with explicit feature-collapse rules (e.g. omitting micro-bubbles in potions or complex fuller grooves in blades) to maintain crisp legibility on 16×16 pixel grids.

---

## 5. Git History & Repository Provenance Audit

A complete, commit-by-commit forensic analysis was performed on the git repository:

* **Repository Root Commit:**
  * **Commit Hash:** `f9b8f4e37676d9e48237b53e338d378453154f2e`
  * **Date:** Thu May 7 12:52:08 2026 +0800
  * **Author:** William (`ochowei@gmail.com`)
  * **Initial Commit Files:** `.gitignore`, `index.html`, `main.js`, `random.js`.
  * **Root Inspection Result:** Initialized as a clean, scratch-built vanilla JS skeleton. There are zero parent commits (`git rev-list --max-parents=0 HEAD` returns only `f9b8f4e`). The repository was never cloned, branched, or forked from *Icon Machine*.
* **Commit Progression:**
  * Every major feature and generator module (`potion.js`, `sword.js`, `spear.js`, `shield.js`, `staff.js`, `palette.js`, `pixel-utils.js`, `i18n.js`, `theme.js`) was preceded by a design specification document (`docs/superpowers/specs/`) and an implementation plan (`docs/superpowers/plans/`).
  * Full git commit logs document step-by-step development of every silhouette formula, color palette table, and DOM interaction.
* **GPL Code & Header Search:**
  * Full-text search across git history for GPL license headers, copyright notices by Brian MacIntosh, or third-party code snippets returned zero matches.
* **AI Coding Methodology:**
  * All code generation prompts were based on procedural concepts, design constraints, and mathematical models created during development. At no point were proprietary or GPL-licensed source files uploaded, pasted into prompts, or translated.

---

## 6. Comprehensive Component Audit Matrix

The following ledger details the provenance audit for every production file in the repository:

| Module / File | Primary Purpose | Origin & Implementation Details | Audit Date | Status |
| :--- | :--- | :--- | :---: | :---: |
| **`random.js`** | Deterministic PRNG & seed hashing | Built from public domain algorithms: Tommy Ettinger's `Mulberry32` (CC0) and bryc's simplified `cyrb53` hash (CC0). Helper methods (`randomInt`, `pick`, `pickWeighted`, `chance`) are standard mathematical utilities. | 2026-09-14 | **GREEN** |
| **`pixel-utils.js`** | Pixel grid utilities & boundary shaders | Custom-built flat-array 2D enum mask representation (`allocateMask`, `maskGet`, `maskSet`), 4-neighbor boundary outline pass (`applyInsideOutlinePass`), and cross-component seam pass (`paintInternalSeams`). | 2026-09-14 | **GREEN** |
| **`palette.js`** | Color families & HSL color math | Contains custom HSL parameters for fantasy elements (fire, frost, mana, poison, golden, shadow) and metals (steel, iron, bronze, gold, obsidian). Standard HSL-to-RGB conversion math. | 2026-09-14 | **GREEN** |
| **`potion.js`** | Procedural potion generator | Bespoke two-phase generator with 3 bottle silhouettes (flask, round, vial), 3 stopper styles (cork, wax seal, cloth), and dynamic liquid levels with deterministic bubbles/sediment at 32×32 and 16×16. | 2026-09-14 | **GREEN** |
| **`sword.js`** | Procedural sword generator | Bespoke two-phase generator with 3 blade archetypes (straight, curved, broad), guard styles, pommels, grip wraps, and fullers at 32×32 and 16×16. | 2026-09-14 | **GREEN** |
| **`spear.js`** | Procedural spear generator | Bespoke two-phase generator with 3 head archetypes (straight, trident, hooked), shaft bindings, and ferrule butt caps at 32×32 and 16×16. | 2026-09-14 | **GREEN** |
| **`shield.js`** | Procedural shield generator | Bespoke two-phase generator with 3 body archetypes (heater, round, tower), decorative bosses (diamond, cross, round), rim trim, and rivets at 32×32 and 16×16. | 2026-09-14 | **GREEN** |
| **`staff.js`** | Procedural magic staff generator | Bespoke two-phase generator with 3 head archetypes (crescent, orb, crozier), elemental crystal palettes, grip rings, and ferrule spikes at 32×32 and 16×16. | 2026-09-14 | **GREEN** |
| **`main.js`** | Studio controller & UI integration | Custom application entry point: handles DOM controls, offscreen canvas rendering, PNG export, 24-cell batch preview grid, and decoupled PRNG seed resolution (`${seed}:type`). | 2026-09-14 | **GREEN** |
| **`i18n.js`**<br>`i18n/en.js`<br>`i18n/zh-Hant.js` | Internationalization runtime | Custom-built lightweight i18n engine supporting `zh-Hant` and `en` with URL query, localStorage (`itemseed.lang`), and navigator fallback. | 2026-09-14 | **GREEN** |
| **`theme.js`**<br>`theme.css` | Dark/Light theme runtime | Custom CSS variables and JavaScript state machine with OS `prefers-color-scheme` listener and localStorage (`itemseed.theme`) persistence. | 2026-09-14 | **GREEN** |

---

## 7. Audit Conclusion & Licensing Recommendations

### 7.1 Formal Audit Conclusion: GREEN
The provenance audit definitively concludes with a **GREEN** rating across all 11 production modules. 

* **No Copyleft Taint:** ItemSeed does not contain any code subject to the GNU General Public License (GPL) or any other copyleft license.
* **Independent Copyright Ownership:** All copyright in the ItemSeed codebase is legitimately held by the project contributors.

### 7.2 Licensing Recommendations
Based on these findings, the project may safely implement its intended dual-licensing strategy:

1. **Engine Source Code:**
   * **Recommendation:** Adopt the **MIT License** (or continue with the **ISC License**). The MIT license provides clear legal certainty, permits commercial and non-commercial redistribution, and ensures widespread adoption by independent game developers.
   * **Action Required:** Under **[TASK-016]**, create the root `LICENSE` file containing the standard MIT/ISC license text and synchronize `package.json` metadata.
2. **Generated Assets (Sprites, PNGs, Spec JSON):**
   * **Recommendation:** Explicitly dedicate all output generated by ItemSeed to the public domain using the **Creative Commons Zero 1.0 Universal (CC0 1.0)** waiver.
   * **Action Required:** Under **[TASK-014]** and **[TASK-015]**, document `ASSET-LICENSE.md` and display clear UI disclosures in the studio interface so game developers know their generated icons are 100% free for commercial game production.
3. **Attribution Preservation:**
   * Maintain the transparent attribution note acknowledging Brian MacIntosh's *Icon Machine* in `docs/PROVENANCE.md`, `README.md`, and the application footer.
