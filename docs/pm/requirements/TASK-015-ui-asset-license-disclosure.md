# [TASK-015] UI & UX Asset License Disclosure and Export Metadata

## 1. Overview & Objective
Implement in-app user interface disclosures for the CC0 1.0 Generated Assets License in `index.html`, ensuring web and itch.io visitors immediately know their downloaded PNG icons are free for commercial and personal game projects without having to browse external documentation.

## 2. Problem Statement
Web users running ItemSeed on itch.io or within browser embeds do not read GitHub markdown files (`README.md`, `ASSET-LICENSE.md`). When they click the download button (`⇩ png`), there is currently no visual indication of the output's license. This ambiguity creates friction and uncertainty for game developers who need assurance before incorporating generated sprites into their game builds.

## 3. Scope & Requirements

### 3.1 Studio UI License Display
- In `index.html`:
  - Place an unobtrusive, accessible license indicator adjacent to the download controls or in the studio metadata section (e.g. `Generated assets: CC0 1.0 · Free for commercial use`).
  - Style with subtle contrast matching both Dark and Light themes via `theme.css` variables.
  - Ensure the label does not wrap awkwardly or push action controls out of alignment on mobile viewports (700–800px) or itch.io iframe containers.

### 3.2 Internationalization (i18n) Integration
- Update translation dictionaries:
  - `i18n/zh-Hant.js`: e.g. `產生物件授權：CC0 1.0（商業與個人專案皆可免費使用）`
  - `i18n/en.js`: e.g. `Generated assets: CC0 1.0 (Free for commercial & personal projects)`
  - Add corresponding `data-i18n-key` in `index.html`.

### 3.3 Integrity & Regression Verification
- Verify that static integrity scripts and visual tests pass:
  - `npm run check-i18n` (validates zh-Hant and en dictionary parity and DOM bindings).
  - `npm run check-theme` (validates theme transitions and storage compatibility).
  - `npm run check-batch` (confirms batch preview behavior remains deterministic).
  - `npm run snapshot` (confirms no unintended canvas visual regressions).

## 4. Acceptance Criteria
- [x] License disclosure is visibly rendered in `index.html` near export/metadata controls.
- [x] Text renders accurately in both Traditional Chinese (`zh-Hant`) and English (`en`).
- [x] Layout remains visually balanced across desktop, tablet, and mobile viewports (700–800px).
- [x] Theme switching (Dark / Light / Auto) applies cleanly with high-contrast readability.
- [x] `npm run check-i18n` passes with 0 errors.
- [x] `npm run check-theme` passes with 0 failures.
- [x] `npm run check-batch` passes with 0 failures.
- [x] `npm run snapshot` passes with 0 unintended pixel shifts.

## 5. Implementation Notes (for Frontend Developer)
- Do not introduce inline styles; utilize existing CSS variables in `theme.css`.
- Keep the disclosure concise to avoid competing with primary action buttons (`▸ generate`, `⇩ png`).
- Maintain accessibility with appropriate semantic HTML tags and ARIA hints if necessary.
