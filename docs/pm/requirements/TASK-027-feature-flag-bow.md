# [TASK-027] Add Feature Flag for Bow Item Type (Default Off)

## 1. Overview & Objective
Implement a runtime feature flag mechanism for the newly added Bow (`bow`) item category, defaulting to disabled (`false`). This enables the bow generator code and regression suite to remain intact in the codebase while keeping the bow option hidden from the general studio interface and excluded from the "any" random item generation pool unless explicitly activated.

## 2. Requirements & Scope

### 2.1 Feature Flag Resolution Logic
The feature flag state for `bow` must resolve using the established precedence hierarchy:
$$\text{URL Query Parameter} > \text{localStorage} > \text{Default (false)}$$

1. **URL Parameter Activation**:
   - Query string containing `?bow=1`, `?bow=true`, or `?features=bow` enables the feature flag.
2. **Storage Persistence**:
   - `localStorage.getItem('itemseed.feature.bow') === 'true'` (or `'1'`) enables the feature flag.
   - Setting flag via URL can optionally persist to localStorage.
3. **Default**:
   - `false` (disabled).

### 2.2 Studio UI & Random Generation Behavior (`index.html`, `main.js`)
1. **When Flag is OFF (Default)**:
   - The `<option value="bow">` in `#type-select` must be removed/hidden from the DOM.
   - The random sampling pool in `resolveItemType(type, seed)` for `'any'` mode must strictly contain only the 5 base item types: `['potion', 'sword', 'spear', 'shield', 'staff']`.
   - If an invalid or disabled type (e.g. `'bow'` when flag is off) is requested, `resolveItemType` must gracefully fallback to a safe active type (`'potion'`).
2. **When Flag is ON**:
   - The `<option value="bow">` is present and selectable in `#type-select`.
   - `resolveItemType('any', seed)` includes `bow` in its random sampling pool.

### 2.3 Automated Testing & Verification
1. **Feature Flag Test Suite**:
   - Add a test script (e.g. `scripts/test-feature-flags.mjs` or incorporated into test suite) verifying:
     - Default resolution is `false`.
     - URL parameter overrides to `true`.
     - LocalStorage overrides to `true`.
     - Studio type-select options and random selection pool reflect flag state.
2. **Batch & Regression Tests**:
   - Update `scripts/test-batch-preview.mjs` to test with `?bow=1` to ensure full batch rendering consistency for all 6 items when enabled, plus verify bow is excluded when disabled.
   - Verify `scripts/check-i18n.mjs` passes without regression.
   - Verify `npm test` passes 100%.
