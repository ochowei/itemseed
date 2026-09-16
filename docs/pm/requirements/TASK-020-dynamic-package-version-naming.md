# [TASK-020] Include Dynamic Version in Packaging Output Filename

## 1. Overview & Objective
Enhance the distribution packager in `scripts/package-itch.mjs` to dynamically read the current application version from `package.json` and generate the output bundle filename with the version tag (e.g., `itemseed-v1.0.0.zip`). Update `.gitignore` to match all versioned distribution archives (`itemseed-*.zip`).

## 2. Problem Statement
Previously, `npm run package:itch` produced a static bundle named `itemseed-itch.zip`. When building multiple releases or archiving packages locally:
- Developers and players cannot identify the release version from the archive filename.
- Successive packaging overwrites previous builds without version history.
- Local release archives risk confusion with older builds.

## 3. Scope & Requirements

### 3.1 Dynamic Version Reading & Naming
- In `scripts/package-itch.mjs`:
  - Dynamically read `version` from `package.json` (fallback to `1.0.0` if unavailable).
  - Format output archive name as `itemseed-v${version}.zip` (e.g., `itemseed-v1.0.0.zip`).
  - Update console logs to display the versioned filename.
  - Maintain all existing packaging integrity assertions:
    - Root-level `index.html` validation.
    - Presence of all 17 required distribution files.
    - Zero leakage of development, documentation, or git files.

### 3.2 Git Ignore Alignment
- In `.gitignore`:
  - Update the `# Distribution archives` pattern from `itemseed-itch.zip` to `itemseed-*.zip` (and `itemseed-itch.zip` for backwards compatibility) so that generated archives for any version are ignored by git.

### 3.3 Test & Verification
- Execute `npm test` to ensure all tests pass.
- Execute `npm run package:itch` and verify that:
  - `itemseed-v1.0.0.zip` is successfully generated.
  - Archive contains `index.html` at the root.
  - Verification assertions pass with exit code 0.

## 4. Acceptance Criteria
- [x] `scripts/package-itch.mjs` dynamically reads version from `package.json`.
- [x] Output zip is named `itemseed-v<version>.zip` (e.g., `itemseed-v1.0.0.zip`).
- [x] `.gitignore` ignores `itemseed-*.zip`.
- [x] `npm test` passes with 0 errors.
- [x] `npm run package:itch` builds `itemseed-v1.0.0.zip` with 17 verified files and 0 leaks.

## 5. Implementation Notes (for Frontend Developer)
- Use standard Node.js `fs` / `path` modules to read `package.json`.
- Ensure removal of any existing bundle with the same target filename prior to invoking `zip`.
