# itch.io Visual Presentation & Asset Showcase Plan

## 1. Overview & Objective
Establish the visual presentation plan for ItemSeed's itch.io release, addressing Section 6.2 and Phase 5 of `ItemSeed_itch_release_adjustment_checklist.docx`. The plan provides concrete specifications for the official store cover image, screenshots, feature callout banners, and automated asset generation workflows.

## 2. Design Principles & Value Proposition
1. **Pixel-Perfect Integrity**: All art must be rendered using nearest-neighbor scaling (integer multiples only) to preserve sharp, crisp pixel art without bilinear blur.
2. **Item-First Showcase**: The main cover must showcase the procedural items themselves—not empty UI or text-heavy cards—instantly signaling high-quality fantasy RPG assets to indie game developers.
3. **Core Selling Points Highlighted**:
   - Native 16×16 & 32×32 handcrafted procedural pixel art (no naive downscaling).
   - Deterministic reproducible generation (`Same seed = same item`).
   - CC0 1.0 Universal Public Domain Dedication (100% free for commercial & indie games).
   - Zero-install, runs directly in browser.

## 3. Required itch.io Visual Assets

### 3.1 Asset 1: itch.io Cover Image (`cover.png`)
- **Dimensions**: 630×500 px (standard) and 1260×1000 px (@2x Retina recommendation).
- **Background**: Deep terminal charcoal (`#16161d`) with subtle pixel-grid accent lines.
- **Header**:
  - Main Title: `ItemSeed` with golden accent.
  - Subtitle: `Pixel Art RPG Item Generator`
- **Center Showcase**:
  - A symmetrical hero row featuring all 5 item archetypes rendered natively at 32×32 and integer-upscaled 8× (256×256 bounding boxes):
    1. **Potion**: Volumetric bubbling flask with glowing liquid.
    2. **Sword**: Slanted broadsword with gleaming blade edge.
    3. **Spear**: Symmetrical trident with wrapped shaft.
    4. **Shield**: Studded tower shield with ornate boss.
    5. **Staff**: Crescent-head arcane staff embedded with elemental crystal.
- **Footer Callouts**:
  - `Native 16×16 & 32×32` · `100% Procedural` · `CC0 Free for Commercial Games`

### 3.2 Asset 2: Studio UI In Action (`screenshot_01_studio.png`)
- **Dimensions**: 1280×800 px.
- **Subject**: Full desktop studio interface in Dark Theme.
- **Focus**:
  - 12× scaled active preview of an iconic item.
  - Control panel with seed input, type selector, size switch, and action buttons.
  - Visible `Generated assets: CC0 1.0` badge and tooltip.

### 3.3 Asset 3: 24-Cell Batch Exploration (`screenshot_02_batch_preview.png`)
- **Dimensions**: 1280×800 px.
- **Subject**: The 24-cell batch preview grid in "Any" item type mode.
- **Focus**:
  - Highlights variety across colors, archetypes, and materials across 24 seeds simultaneously.
  - Callout text: `Explore 24 variations at once · Click any cell to inspect and download`.

### 3.4 Asset 4: Dual-Resolution Handcrafted Comparison (`screenshot_03_dual_resolution.png`)
- **Dimensions**: 1280×800 px.
- **Subject**: Side-by-side comparison of 32×32 and 16×16 pixel art.
- **Focus**:
  - Proves that 16×16 icons are independently authored with deliberate feature compression (e.g. outline adaptation, simplified highlights) rather than generic downscaling.

## 4. Automated Asset Generation Script
To ensure repeatable visual asset generation matching the latest palette and rendering changes, an automated generator script `scripts/generate-itch-assets.mjs` will be used to render canvas items and composite the official 1260×1000 cover and screenshots directly into `docs/pm/assets/`.
