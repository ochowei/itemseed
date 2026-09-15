# [TASK-011] Update Public Product Branding to ItemSeed

## 1. Overview & Objective
Transition all public-facing titles, subtitles, and metadata from the legacy development name "Icon Machine" to the official product brand "ItemSeed" (Pixel Art RPG Item Generator). This satisfies Section 1.1 of the itch.io Release Checklist (`docs/pm/ItemSeed_itch_release_adjustment_checklist.docx`) and establishes the external brand identity.

## 2. Problem Statement
The application currently displays "Icon Machine" in the HTML `<title>`, header H1 (`icon.machine`), subtitle/tagline, and i18n dictionaries. Before launching on itch.io as "ItemSeed", all public branding must be updated consistently in both English and Traditional Chinese so that users immediately recognize the product name.

## 3. Scope & Requirements
- **Web App Header**: Update H1 in `index.html` from `icon.machine` to `ItemSeed` (or `item.seed`).
- **Tagline / Subtitle**: Update subtitle to "Pixel Art RPG Item Generator" (English) and "RPG 像素道具產生器" (Traditional Chinese).
- **HTML Document Title**:
  - `index.html`: Update `<title>` to "ItemSeed — Pixel Art RPG Item Generator" (defaulting to "ItemSeed — RPG 像素道具產生器" for zh-Hant).
- **i18n Dictionaries**:
  - `i18n/en.js`:
    - `app.title`: `'ItemSeed — Pixel Art RPG Item Generator'`
    - `app.tagline`: `'Pixel Art RPG Item Generator'`
  - `i18n/zh-Hant.js`:
    - `app.title`: `'ItemSeed — RPG 像素道具產生器'`
    - `app.tagline`: `'RPG 像素道具產生器'`
- **Regression Page**:
  - `regression.html`: Update `<title>` to "ItemSeed — Visual Regression" and H1 to "Visual Regression — ItemSeed".

## 4. Acceptance Criteria
- [ ] `index.html` renders "ItemSeed" in the header and the updated tagline.
- [ ] Switching between zh-Hant and en dynamically updates document title and tagline to the new localized ItemSeed branding.
- [ ] Static i18n check passes: `npm run check-i18n`.
- [ ] Theme check passes: `npm run check-theme`.
- [ ] Batch preview test passes: `npm run check-batch`.
- [ ] Snapshot regression tests pass: `npm run snapshot`.

## 5. Implementation Notes (for Frontend Developer)
- Maintain `.accent` styling in H1 if desired for visual consistency (e.g. `item<span class="accent">.</span>seed` or `Item<span class="accent">Seed</span>`).
- Ensure no broken keys in `index.html` or missing translation entries between `i18n/en.js` and `i18n/zh-Hant.js`.
