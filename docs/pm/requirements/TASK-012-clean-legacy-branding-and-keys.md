# [TASK-012] Clean Up Legacy Icon Machine References in Production Code and Storage Keys

## 1. Overview & Objective
Complete the remaining legacy naming cleanups identified in Section 1.3 and Section 7 of the itch.io Release Checklist (`docs/pm/ItemSeed_itch_release_adjustment_checklist.docx`). This includes migrating localStorage keys to the `itemseed.*` namespace, updating test harnesses, replacing development-era footer text with production footer text, and aligning the heading order in `regression.html`.

## 2. Problem Statement
Although major public-facing titles were updated to ItemSeed in TASK-011, several legacy artifacts remain in production code:
1. **Internal Storage Keys**: `theme.js` and `i18n.js` still read/write `'iconmachine.theme'` and `'iconmachine.lang'`, causing inconsistent namespace semantics in browser storage.
2. **Footer Text**: The footer in `index.html` and translation tables still display development-phase placeholders ("Icon Machine — 第一版骨架" / "first skeleton" and "繪圖規則待擴充" / "More drawing rules to come").
3. **Regression Page Heading**: `regression.html` has `<h1>Visual Regression — ItemSeed</h1>`, inverted from the `<title>` and the checklist specification (`ItemSeed — Visual Regression`).

## 3. Scope & Requirements

### 3.1 localStorage Migration
- **i18n Runtime (`i18n.js`)**:
  - Change primary storage key from `'iconmachine.lang'` to `'itemseed.lang'`.
  - Provide backwards-compatibility fallback: if `'itemseed.lang'` is not present, check `'iconmachine.lang'`.
- **Theme Runtime (`theme.js`)**:
  - Change primary storage key from `'iconmachine.theme'` to `'itemseed.theme'`.
  - Provide backwards-compatibility fallback: if `'itemseed.theme'` is not present, check `'iconmachine.theme'`.
- **Theme Test Harness (`scripts/test-theme.mjs`)**:
  - Update mock storage key references from `'iconmachine.theme'` to `'itemseed.theme'`.

### 3.2 Production Footer Overhaul
- Update `index.html` footer and i18n tables according to Checklist items 1.3 and 7:
  - Remove skeleton/draft phrases ("第一版骨架", "繪圖規則待擴充").
  - Update structure to: `ItemSeed · Inspired by Brian MacIntosh's Icon Machine · Source on GitHub`.
  - Ensure links point correctly:
    - Brian MacIntosh: `https://bmaczero.itch.io/icon-machine`
    - Source on GitHub: `https://github.com/ochowei/itemseed`
  - Update `i18n/zh-Hant.js` and `i18n/en.js` keys to match the new footer layout without orphaned keys.

### 3.3 Visual Regression Heading Alignment
- In `regression.html`:
  - Update `<h1>` from `Visual Regression — ItemSeed` to `ItemSeed — Visual Regression`.

## 4. Acceptance Criteria
- [ ] `theme.js` uses `'itemseed.theme'` as primary key (with fallback to `'iconmachine.theme'`).
- [ ] `i18n.js` uses `'itemseed.lang'` as primary key (with fallback to `'iconmachine.lang'`).
- [ ] `scripts/test-theme.mjs` passes with 0 failures: `npm run check-theme`.
- [ ] Footer in `index.html` displays clean production text with GitHub source link.
- [ ] `npm run check-i18n` passes with zh-Hant and en key parity and 0 missing HTML keys.
- [ ] `regression.html` H1 reads `ItemSeed — Visual Regression`.
- [ ] `npm run check-batch` passes without regression.
- [ ] `npm run snapshot` passes without regression.

## 5. Implementation Notes (for Frontend Developer)
- Retain proper semantic HTML and styling classes in the footer.
- Keep `footer a:hover` and accent styles functional.
- Do not modify historical planning specs in `docs/superpowers/`.
