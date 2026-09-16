# [TASK-023] Bump Version to v1.0.1 across package.json, index.html, and Release Artifacts

## 1. Overview & Objective
Bump ItemSeed application release version from `v1.0.0` to `v1.0.1` following the integration of Japanese (`ja`) internationalization support and light theme default preference.

## 2. Requirements & Scope
1. **Package Versioning (`package.json` & `package-lock.json`)**:
   - Update `"version": "1.0.1"`.
2. **UI Version Display (`index.html`)**:
   - Update header version badge text to `<span class="version-badge">v1.0.1</span>`.
3. **Distribution Archive (`scripts/package-itch.mjs`)**:
   - Re-run `npm run package:itch` to dynamically verify generation of `itemseed-v1.0.1.zip`.
4. **Documentation Alignment (`docs/pm/ITCH_RELEASE_PACK.md`)**:
   - Update references to `itemseed-v1.0.1.zip` and version tag `v1.0.1`.

## 3. Acceptance Criteria
- [ ] `package.json` and `package-lock.json` reflect version `1.0.1`.
- [ ] `index.html` displays `v1.0.1` in the header badge.
- [ ] `npm test` passes 100% across all suites.
- [ ] `npm run package:itch` creates `itemseed-v1.0.1.zip`.
