# [TASK-022] Set Default Interface Theme to Light

## 1. Overview & Objective
Update the studio and regression test interfaces so that the default theme setting is explicitly `light` rather than `dark` or `auto`. When a user visits ItemSeed for the first time (with no `theme` URL query parameter and no prior `localStorage` preference), the interface will default directly to the Light theme.

## 2. Problem Statement
Currently:
1. `theme.js` sets `DEFAULT_SETTING = 'auto'` and falls back to `dark` when `matchMedia` is unsupported.
2. `index.html` and `regression.html` have hardcoded `<body data-theme="dark">`, causing an initial dark rendering pass.
3. The product vision prefers a bright, paper-like clean canvas appearance by default for new users, while preserving the user's freedom to select `Auto` or `Dark` via the theme dropdown.

## 3. Scope & Detailed Requirements

### 3.1 Runtime Configuration (`theme.js`)
1. Change `DEFAULT_SETTING`:
   ```javascript
   const DEFAULT_SETTING = 'light';
   ```
2. In `resolveEffective(setting)`:
   Update safe fallback when `matchMedia` is unsupported to `'light'`.

### 3.2 HTML Initial Attributes
1. In `index.html`:
   Change `<body data-theme="dark">` to `<body data-theme="light">`.
2. In `regression.html`:
   Change `<body data-theme="dark">` to `<body data-theme="light">`.

### 3.3 Test Suite (`scripts/test-theme.mjs`)
Update `scripts/test-theme.mjs` test cases:
1. Verify default resolution with no URL and no storage produces `setting='light'` and `effective='light'`.
2. Ensure explicit `stored='auto'` or `stored='dark'` continues to behave correctly with OS matching and live mediaQuery change events.
3. Ensure all 11+ test assertions pass.

## 4. Acceptance Criteria
1. First-time visitors (empty localStorage, no URL param) see the Light theme with `#theme-select` displaying `Light`.
2. Reloading the page without prior manual selection preserves the Light theme.
3. Users can still manually switch to `Dark` or `Auto` via the dropdown, and that preference persists in `localStorage` (`itemseed.theme`).
4. Passing `?theme=dark` or `?theme=auto` in the URL continues to override the default properly.
5. All automated test suites (`npm test`) pass completely without regression.
