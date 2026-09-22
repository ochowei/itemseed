# Frontend Development Kanban Board

This board tracks frontend development tasks for the `itemseed` project.

### Workflow & Permission Rules (see [AGENTS.md](AGENTS.md))
- **Project Manager**:
  - Publish new tasks to **TODO**.
  - Review completed work and move tasks from **Doing** to **Done**.
  - Move blocked or deferred tasks from **Doing** to **Pending**.
- **Frontend Developer**:
  - Pick up or resume tasks by moving them from **TODO** or **Pending** to **Doing**.
  - *Prohibited from moving tasks directly to Done or Pending.*

---

## 📋 TODO

> Tasks published and prioritized by the Project Manager. Ready for Frontend Developers to pick up.

*(No tasks currently in TODO)*

---

## 🔨 Doing

> Tasks currently under active development by Frontend Developers.

*(No tasks currently in Doing)*

---

## ⏳ Pending

> Tasks paused, blocked by dependencies, or waiting for PM design clarifications.

*(No tasks currently pending)*

---

## ✅ Done

> Completed tasks reviewed and confirmed by the Project Manager.

### [TASK-026] Refine Bow Arrowhead, Fletching, and Nocking Alignment
- **Status**: Done
- **Completed**: 2026-09-22
- **Summary**: Refined 32×32 and 16×16 bow generator rasterization in `bow.js` to eliminate visual ambiguity on firing orientation. Sharpened and elongated the arrowhead pointing top-right with crisp metallic facets, streamlined feather fletching to hug the shaft, aligned arrow nock directly with the drawn string at nocking point `(10, 21)` (32×32) and `(5, 10)` (16×16) eliminating backward shaft protrusion, and updated golden snapshot baselines. Confirmed 100% test pass rate.

### [TASK-025] Implement Bow Generator (32×32 and 16×16)
- **Status**: Done
- **Completed**: 2026-09-21
- **Summary**: Implemented procedural bow and arrow generator in `bow.js` with 3 archetypes (`longbow`, `recurve`, `shortbow`), diagonal 45° nocked arrow composition, wood & fletching palettes in `palette.js`, dual-resolution 32×32 & 16×16 rasterization, studio UI & regression integration, multi-language dictionaries (`zh-Hant`, `en`, `ja`), and baseline visual regression snapshots. Confirmed 100% test pass rate across `check-theme`, `check-i18n`, `check-batch`, and `snapshot`.

### [TASK-024] Update itch.io Cover and Screenshots to Light Theme
- **Status**: Done
- **Completed**: 2026-09-16
- **Summary**: Updated itch.io promotional visual assets generator in `scripts/generate-itch-assets.mjs` and refreshed all assets in `docs/pm/assets/` (`cover.png`, `screenshot_01_studio.png`, `screenshot_02_batch.png`, `screenshot_03_dual_resolution.png`) to align with the default Light theme palette (`#f0ece4` parchment background, white item cards, crisp typography, and light-themed studio/regression viewports). Verified non-zero pixel art rendering across all 5 item archetypes and confirmed all automated tests pass.

### [TASK-023] Bump Version to v1.0.1 across package.json, index.html, and Release Artifacts
- **Status**: Done
- **Completed**: 2026-09-16
- **Summary**: Bumped application version from `1.0.0` to `1.0.1` following the integration of Japanese i18n support and default light theme. Updated `package.json` and `package-lock.json` to version `1.0.1`. Updated header version badge to `v1.0.1` in `index.html`. Re-packaged itch.io release bundle to `itemseed-v1.0.1.zip` via `npm run package:itch`. Synchronized version documentation in `docs/pm/ITCH_RELEASE_PACK.md`. Verified all tests passed.

### [TASK-022] Set Default Interface Theme to Light
- **Status**: Done
- **Completed**: 2026-09-16
- **Summary**: Set default application theme to `light` across ItemSeed studio and regression interfaces. Updated `theme.js` runtime `DEFAULT_SETTING = 'light'` and safe fallback to `'light'`. Updated initial HTML attribute to `<body data-theme="light">` in both `index.html` and `regression.html` to prevent dark flash of unstyled content (FOUC). Expanded `scripts/test-theme.mjs` test suite to 16 comprehensive assertions verifying default light resolution while preserving explicit `auto` and `dark` selection and OS mediaQuery live syncing. All tests passed.

### [TASK-021] Add Japanese (ja) Internationalization Support
- **Status**: Done
- **Completed**: 2026-09-16
- **Summary**: Added Japanese (`ja`) internationalization support to ItemSeed. Created `i18n/ja.js` with complete 30-key dictionary matching `en` and `zh-Hant`. Registered `ja` in `i18n.js` with browser locale detection (`navigator.language.startsWith('ja')`). Added `<option value="ja">日本語</option>` and script inclusion in `index.html`. Enhanced static validator `scripts/check-i18n.mjs` to enforce three-way key parity. Updated `scripts/package-itch.mjs` deployment files list. All tests passed.

### [TASK-020] Include Dynamic Version in Packaging Output Filename
- **Status**: Done
- **Completed**: 2026-09-16
- **Summary**: Enhanced `scripts/package-itch.mjs` to dynamically read the application version from `package.json` (with fallback to `1.0.0`) and name the output bundle `itemseed-v${version}.zip` (currently `itemseed-v1.0.0.zip`). Added pre-build target cleanup and updated `.gitignore` with `itemseed-*.zip` to prevent accidental archive commits. Synchronized package output naming across `docs/pm/ITCH_RELEASE_PACK.md`. Verified all test suites (`npm test`) and itch.io bundle packaging passed.


### [TASK-019] Add Version Badge in Header Next to Main Title
- **Status**: Done
- **Completed**: 2026-09-16
- **Summary**: Added styled retro terminal version badge (`v1.0.0`) wrapped with `<h1>ItemSeed</h1>` inside `.header-title-wrap` in `index.html`. Utilized theme CSS variables (`--bg-panel-2`, `--line`, `--ink-dim`) for high-contrast presentation in both Light and Dark themes. Enhanced responsiveness with flex-wrapping and mobile alignment breakpoint at `max-width: 540px`, ensuring zero horizontal overflow on mobile viewports (320px–768px). Verified 100% test pass rate across `check-theme`, `check-i18n`, `check-batch`, `snapshot`, and verified clean itch.io HTML5 packaging (`itemseed-itch.zip`).


### [TASK-018] Fix Blank Item Canvases in itch.io Cover Image Generator
- **Status**: Done
- **Completed**: 2026-09-15
- **Summary**: Resolved blank canvas rendering in `scripts/generate-itch-assets.mjs` caused by Chromium's `about:blank` local resource policy blocking `<script src="file://...">`. Inlined core engine scripts (`random.js`, `palette.js`, `pixel-utils.js`, `potion.js`, `sword.js`, `spear.js`, `shield.js`, `staff.js`) directly into HTML, ensured execution after DOM and font readiness, added automated canvas non-zero pixel assertions, and successfully regenerated `docs/pm/assets/cover.png` with crisp 32×32 pixel art across all 5 item types. Added aggregate `npm test` script in `package.json`. Verified all test suites passed.

### [TASK-017] Pre-Release UI Enhancements, Export Filename Standard, and itch.io Packaging
- **Status**: Done
- **Completed**: 2026-09-14
- **Summary**: Standardized download PNG filenames to `itemseed_${effectiveType}_${safeSeed}_${size}x${size}.png` with concrete item type resolution and sanitization in `main.js`. Added localized dual-license footer summary (`Engine: MIT · Assets: CC0 1.0`) in `index.html`, `i18n/zh-Hant.js`, and `i18n/en.js`. Created automated zero-dependency itch.io packager in `scripts/package-itch.mjs` registered as `npm run package:itch`, guaranteeing root-level `index.html`. Verified all tests and packaging passed.


### [TASK-015] Implement UI Asset License Disclosure and Export Metadata
- **Status**: Done
- **Completed**: 2026-09-14
- **Summary**: Added an unobtrusive license badge (`Generated assets: CC0 1.0 · Free for commercial use`) wrapped in `.action-group` near the download button in `index.html`. Added localized strings in `i18n/zh-Hant.js` and `i18n/en.js`. Styled with theme CSS variables (`--bg-panel-2`, `--line`, `--ink-dim`, `--accent-2`) with responsive wrapping for 700-800px and itch.io iframe environments. Verified all checks passed (`check-i18n`, `check-theme`, `check-batch`, `snapshot`).


### [TASK-012] Clean Up Legacy Icon Machine References in Production Code and Storage Keys
- **Status**: Done
- **Completed**: 2026-09-14
- **Summary**: Migrated localStorage keys in `i18n.js` and `theme.js` to `itemseed.lang` and `itemseed.theme` with backwards compatibility fallback for `iconmachine.*`. Updated test harness in `scripts/test-theme.mjs`. Replaced skeleton and draft footer text in `index.html`, `i18n/zh-Hant.js`, and `i18n/en.js` with production credits and repository links. Aligned `regression.html` H1 heading to `ItemSeed — Visual Regression`. Verified all tests passed.

### [TASK-011] Update Public Product Branding to ItemSeed
- **Status**: Done
- **Completed**: 2026-09-11
- **Summary**: Transitioned public-facing titles and metadata to the official ItemSeed branding across `index.html`, `i18n/`, and `regression.html`. Updated header H1 to `Item<span class="accent">Seed</span>`, document title, and tagline with dual-language support (`ItemSeed — Pixel Art RPG Item Generator` / `ItemSeed — RPG 像素道具產生器`).


### [TASK-010] Fix Inconsistent Icon Rendering on Batch Preview Cell Click in "any" Type Mode
- **Status**: Done
- **Completed**: 2026-09-10
- **Summary**: Decoupled item type resolution from the drawing PRNG stream using an isolated seed (`${seed}:type`), ensuring drawing functions always receive a pristine initial PRNG state (step 0). Added `{ willReadFrequently: true }` to canvas 2D contexts for consistent rendering. Added automated test suite `scripts/test-batch-preview.mjs` verifying pixel-identical matching on batch preview cell clicks across sizes and types.

### [TASK-009] Fix Staff Option Label Consistency in i18n and index.html
- **Status**: Done
- **Completed**: 2026-09-10
- **Summary**: Updated staff option label in `i18n/zh-Hant.js` and `index.html` to `法杖 (staff)` to match naming format across all item types.

### [TASK-008] Fix Staff Head and Shaft Centering Alignment (32x32)
- **Status**: Done
- **Completed**: 2026-09-10
- **Summary**: Corrected 32×32 staff shaft coordinates to `x=15..17` (width 3, centered on cx=16.0), aligning perfectly with head archetypes. Adjusted grip rings and ferrule base to `x=14..18` (width 5) for symmetrical 1px outer steps and centered spike tips. Updated baseline snapshots.

### [TASK-007] Implement Staff / Wand Generator (32×32 and 16×16)
- **Status**: Done
- **Completed**: 2026-09-10
- **Summary**: Implemented procedural magic staff generator in `staff.js` with crescent, orb, and crozier archetypes, 4 elemental crystal palettes (arcane, fire, nature, shadow), shaft grip rings, and ferrule butt caps at 32×32 and 16×16. Integrated into studio UI, regression grid, and captured golden snapshot baselines.

### [TASK-006] Implement Shield Generator (32×32 and 16×16)
- **Status**: Done
- **Completed**: 2026-09-10
- **Summary**: Implemented procedural shield generator in `shield.js` with heater, round, and tower archetypes, multiple boss styles, rivets, and rim accents at 32×32 and 16×16. Integrated with `index.html`, `regression.html`, `i18n/`, and established golden snapshot baselines.

### [TASK-005] Internationalization (i18n) Support
- **Status**: Done
- **Completed**: 2026-05-10
- **Summary**: Implemented dual-language support (zh-Hant / en) with `i18n.js`, dictionaries in `i18n/`, header language switcher, and `npm run check-i18n` static validator.

### [TASK-004] Theme Switcher Runtime & Persistence
- **Status**: Done
- **Completed**: 2026-05-10
- **Summary**: Implemented theme runtime (`theme.js`, `theme.css`) with support for URL query params, localStorage persistence, OS dark/light detection, and automated tests (`scripts/test-theme.mjs`).

### [TASK-003] Implement Spear Generator
- **Status**: Done
- **Completed**: 2026-05-08
- **Summary**: Implemented procedural spear generator in `spear.js` with trident, hooked, and straight archetypes at 32×32 and 16×16, added visual regression baseline.

### [TASK-002] Implement Sword Generator
- **Status**: Done
- **Completed**: 2026-05-07
- **Summary**: Implemented procedural sword generator in `sword.js` with blade lengths, crossguards, pommels, and deterministic regression suite.

### [TASK-001] Implement Potion Generator
- **Status**: Done
- **Completed**: 2026-05-07
- **Summary**: Implemented baseline procedural potion generator in `potion.js` with liquid fills, corks, bottle shapes, and bubbling effects.
