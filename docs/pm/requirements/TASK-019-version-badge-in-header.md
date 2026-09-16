# [TASK-019] Add Version Badge to Studio Header Next to Main Title

## 1. Overview & Objective
Add an explicit, styled version badge (e.g., `v1.0.0`) to the studio header adjacent to the main `ItemSeed` title in `index.html`. This ensures users, players, and developers can immediately identify the running version across local, web, and itch.io iframe deployments.

## 2. Problem Statement
While `package.json` formally tracks the application version as `1.0.0`, the browser studio interface (`index.html`) contains no visual representation of the version number. Consequently:
- Users reporting bugs or feedback cannot readily state which version they are using.
- Testing and deployment verification cannot easily distinguish whether a browser session has loaded the latest build or is displaying cached assets.

## 3. Scope & Requirements

### 3.1 Header Layout & Visual Placement
- In `index.html`:
  - Position a version badge next to the main title `ItemSeed` in `<header>`.
  - Recommended structure: either a child or sibling tag to `<h1>Item<span class="accent">Seed</span></h1>`, wrapped cleanly to keep alignment baseline or inline.
  - Design & typography:
    - Complement the retro/mechanical visual language of ItemSeed.
    - Typography should use `'JetBrains Mono', monospace` or `'VT323', monospace`.
    - Distinct but subtle scale (e.g., `12px` to `14px`), ensuring it does not distract from or clash with the primary 64px `VT323` logo.
    - Can be presented as a subtle tag/pill (e.g., subtle border using `var(--line)` and background `var(--bg-panel-2)`) or simple bracketed/monospace text (e.g., `v1.0.0`).
  - Theme compatibility:
    - Utilize CSS variables from `theme.css` (`--ink-dim`, `--line`, `--accent`, `--bg-panel-2`).
    - Guarantee crisp readability in both Dark and Light themes.
  - Responsive layout:
    - Verify that on smaller screen widths (320px–768px), the header flex layout wraps gracefully without horizontal overflow or misaligned control rows.

### 3.2 Version String Synchronization
- Display `v1.0.0` to match the current release version defined in `package.json`.

### 3.3 Test Suite & Packaging Verification
- Ensure all existing automated quality checks pass:
  - `npm run check-theme` (theme switching and variable compatibility)
  - `npm run check-i18n` (i18n key set integrity and HTML bindings)
  - `npm run check-batch` (batch preview determinism)
  - `npm run snapshot` (visual regression golden baselines)
  - `npm run package:itch` (itch.io release bundle packaging integrity)

## 4. Acceptance Criteria
- [x] The version badge `v1.0.0` is clearly visible next to the `ItemSeed` title in the header.
- [x] Typography and styling seamlessly fit the retro UI in both Dark and Light themes.
- [x] Header elements wrap neatly on mobile and narrow viewports without clipping.
- [x] `npm test` passes with 0 errors.
- [x] `npm run package:itch` packages cleanly.

## 5. Implementation Notes (for Frontend Developer)
- Avoid hardcoded color hexes; rely strictly on variables in `theme.css`.
- The version string `v1.0.0` does not require language localization unless additional explanatory text is added. If any localized data attributes are added, make sure `i18n/zh-Hant.js` and `i18n/en.js` are updated in lockstep.
