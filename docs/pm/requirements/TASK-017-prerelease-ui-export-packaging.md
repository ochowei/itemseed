# [TASK-017] Pre-Release UI Enhancements, Export Filename Standard, and itch.io Packaging

## 1. Overview & Objective
Address the remaining technical release-gate requirements specified in Sections 7 and 8 of `docs/pm/ItemSeed_itch_release_adjustment_checklist.docx`. This includes standardizing the exported PNG filename with asset type and resolution metadata, enhancing UI footer licensing transparency, and providing an automated packaging script to produce itch.io-compliant HTML5 zip bundles.

## 2. Problem Statement
1. **Ambiguous Download Filenames**: Currently, `main.js` exports icons as `icon_${safeSeed}.png`. If a developer downloads icons across multiple categories (e.g. sword vs potion) or resolutions (16×16 vs 32×32), files will overwrite each other or be impossible to differentiate without opening them.
2. **Missing In-App Dual-License Summary**: While the CC0 asset badge is present near the download button, the web interface footer lacks explicit mention of the engine's MIT open-source license, leaving external developers unsure about the codebase license.
3. **Risk of Broken itch.io HTML5 Uploads**: itch.io requires the root of the uploaded ZIP archive to contain `index.html` directly without an intermediate enclosing directory. Manual zip creation is prone to folder-nesting errors, which leads to a black screen / 404 error on itch.io.

## 3. Scope & Requirements

### 3.1 Standardized Download Filenames (`main.js`)
- In `downloadPNG()`:
  - Resolve the effective item type (using `resolveItemType(typeSelect.value, seed)`), ensuring `"any"` resolves to the concrete generated type (`potion`, `sword`, `spear`, `shield`, or `staff`).
  - Retrieve the target resolution (`16` or `32`) from `sizeSelect.value`.
  - Format the filename as: `itemseed_${effectiveType}_${safeSeed}_${size}x${size}.png`.
  - Example: `itemseed_sword_rusty-blade-42_32x32.png` or `itemseed_potion_mystic-flask-7_16x16.png`.

### 3.2 Dual-Licensing Footer Disclosure (`index.html` & `i18n/`)
- In `index.html` footer:
  - Add a concise licensing summary line:
    `Engine: MIT · Assets: CC0 1.0`
  - Wrap text with `data-i18n-key` for dual-language localization:
    - `i18n/zh-Hant.js`: e.g. `程式碼：MIT · 生成素材：CC0 1.0`
    - `i18n/en.js`: e.g. `Code: MIT · Assets: CC0 1.0`
  - Ensure links or badges match existing footer styling without vertical misalignment or line wrapping issues at 700–800px breakpoints.

### 3.3 Automated itch.io Packaging Script (`scripts/package-itch.mjs` & `package.json`)
- Implement `scripts/package-itch.mjs`:
  - Collects only runtime deployment files:
    - `index.html`
    - `main.js`
    - `random.js`
    - `palette.js`
    - `pixel-utils.js`
    - `potion.js`
    - `sword.js`
    - `spear.js`
    - `shield.js`
    - `staff.js`
    - `theme.js`
    - `theme.css`
    - `i18n.js`
    - `i18n/zh-Hant.js`
    - `i18n/en.js`
    - `LICENSE`
    - `ASSET-LICENSE.md`
  - Bundles them into `itemseed-itch.zip` directly at the archive root.
  - Automatically verifies that `index.html` is at the zip root level.
  - Excludes `.git/`, `docs/`, `scripts/`, `snapshots/`, `node_modules/`, `package.json`, etc.
- In `package.json`:
  - Add script entry: `"package:itch": "node scripts/package-itch.mjs"`.

### 3.4 Verification & Quality Assurance
- Automated checks:
  - `npm run check-i18n` passes (zero missing or orphaned keys).
  - `npm run check-theme` passes (11/11 tests pass).
  - `npm run check-batch` passes (batch preview consistency verified).
  - `npm run package:itch` runs and produces valid zip archive.

## 4. Acceptance Criteria
- [x] Exported PNG filename follows `itemseed_${effectiveType}_${safeSeed}_${size}x${size}.png`.
- [x] Resolving `"any"` type correctly writes the concrete asset type into the download filename.
- [x] Footer displays localized dual-license summary (`Engine: MIT · Assets: CC0 1.0`).
- [x] `i18n/zh-Hant.js` and `i18n/en.js` have matching keys with 100% parity.
- [x] `scripts/package-itch.mjs` creates a valid zip archive with `index.html` at the root.
- [x] `npm run package:itch` command is registered in `package.json`.
- [x] All automated test suites (`check-i18n`, `check-theme`, `check-batch`) pass with 0 errors.

## 5. Implementation Notes (for Frontend Developer)
- Use standard Node.js built-in modules (`fs`, `path`, `zlib`, or child process `zip` / archiver if available) in `scripts/package-itch.mjs` to avoid introducing heavy external dependencies.
- Ensure `downloadPNG()` handles special characters in seeds gracefully by sanitizing.
- Retain existing footer styling classes in `index.html`.
