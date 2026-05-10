# Theme Switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add dark/light theme switching to `index.html` and `regression.html`, with Auto mode following OS `prefers-color-scheme`. Shared settings via localStorage. Icon palette unchanged.

**Architecture:** New `theme.css` (CSS variables: `:root` = dark, `body[data-theme="light"]` overrides) + new `theme.js` (`window.THEME` runtime, mirrors `i18n.js` pattern). Both files shared by `index.html` and `regression.html`. UI is a `<select>` with Auto/Light/Dark on each page, side-by-side with the existing lang select on index. Snapshot script gets a URL param to lock theme deterministically.

**Tech Stack:** Vanilla JS, plain CSS custom properties, no framework, no build step. `<script src>` and `<link rel="stylesheet">` only. Verification via Node + `vm` sandbox (mirrors `scripts/check-i18n.mjs`) plus puppeteer for snapshot regression.

**Reference:** `docs/superpowers/specs/2026-05-10-theme-switcher-design.md`

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `theme.css` | NEW | CSS custom properties for dark (`:root`) and light (`body[data-theme="light"]`). Single source of truth for theme colors. |
| `theme.js` | NEW | `window.THEME` runtime: setting persistence, `prefers-color-scheme` resolution, applying `data-theme` attribute, dropdown wiring helper. |
| `i18n/zh-Hant.js` | MODIFY | +4 keys: `theme.label`, `theme.option.auto/light/dark`. |
| `i18n/en.js` | MODIFY | Same +4 keys. |
| `index.html` | MODIFY | `<link>` + `<script>` for theme. Remove inline `:root { ... }`. Replace hardcoded `#1a1a26`/`#20202c` with vars. Add `<body data-theme="dark">` default. Add theme-select inside new `.settings-row`. |
| `main.js` | MODIFY | Call `THEME.init()`. Wire `theme-select` change listener. |
| `regression.html` | MODIFY | `<link>` + `<script>`. Convert all hardcoded colors to vars. Add `<body data-theme="dark">` default. Add theme-select to `.controls`. Wire `THEME.init()` in inline `<script>`. |
| `scripts/snapshot-regression.mjs` | MODIFY | Append `?theme=light` to navigation URL so snapshot baseline is deterministic regardless of OS theme. |
| `scripts/test-theme.mjs` | NEW | Standalone Node smoke test for `theme.js` logic (mirrors `check-i18n.mjs` pattern: load via `vm`, assert behavior). |
| `package.json` | MODIFY | Add `"check-theme"` npm script. |

---

## Task 1: Create `theme.css`

**Files:**
- Create: `theme.css`

- [ ] **Step 1: Write `theme.css`**

```css
/* theme.css
 * CSS custom properties for dark (default :root) and light (body[data-theme="light"]).
 * Single source of truth for both index.html and regression.html.
 *
 * Adding a new color slot? Define it in BOTH :root and body[data-theme="light"].
 */

:root {
  /* Backgrounds */
  --bg-deep:     #0e0d14;
  --bg-panel:    #15131e;
  --bg-panel-2:  #1d1a2a;
  --bg-frame-a:  #20202c;   /* checker high (preview frame) */
  --bg-frame-b:  #1a1a26;   /* checker low (preview frame) */
  --bg-cell:     #1a1a26;   /* grid cell + regression canvas bg */

  /* Inks */
  --ink:         #e8e4d8;
  --ink-dim:     #8a8499;

  /* Accents */
  --accent:      #ffb347;   /* 燈泡橘 */
  --accent-2:    #6dd3ce;   /* 古銅綠 */
  --danger:      #ff6b8a;

  /* Lines / borders */
  --line:        #2a2638;
}

body[data-theme="light"] {
  --bg-deep:     #f0ece4;   /* paper, reuse regression body */
  --bg-panel:    #ffffff;
  --bg-panel-2:  #f7f3ea;
  --bg-frame-a:  #f0ece4;   /* light checker high */
  --bg-frame-b:  #e8e0d0;   /* light checker low */
  --bg-cell:     #e8e0d0;   /* matches regression's previous canvas bg */

  --ink:         #2a2638;   /* deep purple-black, reuse regression ink */
  --ink-dim:     #6a6458;

  --accent:      #c46a00;   /* matches regression h2 */
  --accent-2:    #2a8a85;   /* darker teal, WCAG AA on white */
  --danger:      #c2185b;

  --line:        #c8c2b4;   /* matches regression table border */
}
```

- [ ] **Step 2: Verify file content**

Run: `grep -c "^  --" theme.css`
Expected: `26` (13 vars × 2 blocks)

Run: `grep -E "^\s*(--bg-deep|--ink|--accent|--line):" theme.css | wc -l`
Expected: `8` (4 key vars × 2 blocks — sanity check both blocks define the core slots)

- [ ] **Step 3: Commit**

```bash
git add theme.css
git commit -m "$(cat <<'EOF'
feat(theme): add theme.css with dark (:root) + light overrides

13 CSS custom properties covering bg, ink, accent, line. Dark stays in :root
to preserve current index.html baseline. Light overrides via
body[data-theme="light"], using regression.html's paper palette.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Create `theme.js`

**Files:**
- Create: `theme.js`

- [ ] **Step 1: Write `theme.js`**

```javascript
// theme.js
// Runtime for switching dark/light/auto. Mirrors i18n.js structure
// (URL > localStorage > default). Auto resolves via matchMedia and
// reacts live to OS theme changes.

window.THEME = (function () {
  const SUPPORTED = ['auto', 'light', 'dark'];
  const DEFAULT_SETTING = 'auto';
  const STORAGE_KEY = 'iconmachine.theme';

  let currentSetting = DEFAULT_SETTING;
  let mediaQuery = null;

  function readSettingFromURL() {
    try {
      const params = new URLSearchParams(window.location.search);
      const v = params.get('theme');
      if (v && SUPPORTED.includes(v)) return v;
    } catch (_) {}
    return null;
  }

  function readSettingFromStorage() {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v && SUPPORTED.includes(v)) return v;
    } catch (_) {}
    return null;
  }

  function resolveInitialSetting() {
    const urlSetting = readSettingFromURL();
    if (urlSetting) {
      try { localStorage.setItem(STORAGE_KEY, urlSetting); } catch (_) {}
      return urlSetting;
    }
    return readSettingFromStorage() || DEFAULT_SETTING;
  }

  function resolveEffective(setting) {
    if (setting === 'light' || setting === 'dark') return setting;
    if (mediaQuery && mediaQuery.matches) return 'dark';
    if (mediaQuery) return 'light';
    return 'dark'; // matchMedia unsupported → safe fallback
  }

  function applyTheme() {
    const eff = resolveEffective(currentSetting);
    if (document.body) document.body.setAttribute('data-theme', eff);
  }

  function setTheme(setting) {
    if (!SUPPORTED.includes(setting)) return;
    if (setting === currentSetting) return;
    currentSetting = setting;
    try { localStorage.setItem(STORAGE_KEY, setting); } catch (_) {}
    applyTheme();
  }

  function init() {
    try { mediaQuery = window.matchMedia('(prefers-color-scheme: dark)'); } catch (_) {}
    if (mediaQuery && mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', () => {
        if (currentSetting === 'auto') applyTheme();
      });
    }
    currentSetting = resolveInitialSetting();
    applyTheme();
  }

  return {
    SUPPORTED,
    getSetting: () => currentSetting,
    getEffective: () => resolveEffective(currentSetting),
    setTheme,
    init,
  };
})();
```

- [ ] **Step 2: Verify file content**

Run: `grep -E "^(\s*const SUPPORTED|\s*const STORAGE_KEY|\s*function (read|resolve|apply|setTheme|init))" theme.js | wc -l`
Expected: `8` (SUPPORTED + STORAGE_KEY + 2 read*, resolveInitial, resolveEffective, applyTheme, setTheme, init)

Run: `grep -c "window.THEME" theme.js`
Expected: `1`

- [ ] **Step 3: Commit**

```bash
git add theme.js
git commit -m "$(cat <<'EOF'
feat(theme): add THEME runtime (URL > localStorage > auto)

Mirrors i18n.js shape. SUPPORTED = auto/light/dark. Auto resolves via
matchMedia('(prefers-color-scheme: dark)') and reacts live when OS theme
changes. setTheme writes to localStorage iconmachine.theme and updates
<body data-theme>. matchMedia-unsupported browsers fall back to dark.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add `theme.js` smoke test

**Files:**
- Create: `scripts/test-theme.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write `scripts/test-theme.mjs`**

```javascript
#!/usr/bin/env node
// scripts/test-theme.mjs
// Smoke test for theme.js. Loads theme.js into a sandboxed vm with mocked
// window/document/localStorage/matchMedia, then asserts THEME behaviors.
// Run via:  node scripts/test-theme.mjs

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const ROOT       = resolve(__dirname, '..');

function makeSandbox({ search = '', stored = null, prefersDark = false, hasMatchMedia = true }) {
  const storage = new Map();
  if (stored !== null) storage.set('iconmachine.theme', stored);

  const listeners = [];
  const mediaQuery = hasMatchMedia ? {
    matches: prefersDark,
    addEventListener: (_evt, cb) => listeners.push(cb),
  } : null;

  const body = { _attrs: {}, setAttribute(k, v) { this._attrs[k] = v; } };

  const sandbox = {
    window: {
      location: { search },
      matchMedia: hasMatchMedia ? () => mediaQuery : undefined,
    },
    document: { body },
    localStorage: {
      getItem: (k) => storage.has(k) ? storage.get(k) : null,
      setItem: (k, v) => storage.set(k, String(v)),
    },
    URLSearchParams,
  };
  // Capture outputs for assertions
  sandbox._meta = { storage, body, mediaQuery, listeners };
  return sandbox;
}

async function loadTheme(sandbox) {
  const src = await readFile(resolve(ROOT, 'theme.js'), 'utf8');
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.window.THEME;
}

function assertEq(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`FAIL ${msg}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const cases = [
  {
    name: 'no URL, no storage, OS=dark → effective=dark, setting=auto',
    setup: { prefersDark: true },
    run: (THEME, meta) => {
      THEME.init();
      assertEq(THEME.getSetting(), 'auto', 'setting');
      assertEq(THEME.getEffective(), 'dark', 'effective');
      assertEq(meta.body._attrs['data-theme'], 'dark', 'body data-theme');
    },
  },
  {
    name: 'no URL, no storage, OS=light → effective=light, setting=auto',
    setup: { prefersDark: false },
    run: (THEME, meta) => {
      THEME.init();
      assertEq(THEME.getSetting(), 'auto', 'setting');
      assertEq(THEME.getEffective(), 'light', 'effective');
      assertEq(meta.body._attrs['data-theme'], 'light', 'body data-theme');
    },
  },
  {
    name: 'storage=dark, OS=light → effective=dark (stored wins over OS)',
    setup: { stored: 'dark', prefersDark: false },
    run: (THEME, meta) => {
      THEME.init();
      assertEq(THEME.getSetting(), 'dark', 'setting');
      assertEq(THEME.getEffective(), 'dark', 'effective');
      assertEq(meta.body._attrs['data-theme'], 'dark', 'body data-theme');
    },
  },
  {
    name: 'URL=light overrides storage=dark + persists to storage',
    setup: { search: '?theme=light', stored: 'dark', prefersDark: true },
    run: (THEME, meta) => {
      THEME.init();
      assertEq(THEME.getSetting(), 'light', 'setting');
      assertEq(THEME.getEffective(), 'light', 'effective');
      assertEq(meta.storage.get('iconmachine.theme'), 'light', 'storage updated');
    },
  },
  {
    name: 'invalid URL value falls back to storage',
    setup: { search: '?theme=banana', stored: 'dark' },
    run: (THEME, _meta) => {
      THEME.init();
      assertEq(THEME.getSetting(), 'dark', 'setting');
    },
  },
  {
    name: 'setTheme updates storage + body attribute',
    setup: { prefersDark: false },
    run: (THEME, meta) => {
      THEME.init();
      THEME.setTheme('dark');
      assertEq(THEME.getSetting(), 'dark', 'setting');
      assertEq(meta.body._attrs['data-theme'], 'dark', 'body data-theme');
      assertEq(meta.storage.get('iconmachine.theme'), 'dark', 'storage');
    },
  },
  {
    name: 'invalid setTheme value is ignored',
    setup: { stored: 'light' },
    run: (THEME, meta) => {
      THEME.init();
      THEME.setTheme('mauve');
      assertEq(THEME.getSetting(), 'light', 'setting unchanged');
    },
  },
  {
    name: 'matchMedia change while setting=auto re-applies',
    setup: { prefersDark: false },
    run: (THEME, meta) => {
      THEME.init();
      assertEq(meta.body._attrs['data-theme'], 'light', 'initial light');
      meta.mediaQuery.matches = true;
      meta.listeners.forEach((cb) => cb());
      assertEq(meta.body._attrs['data-theme'], 'dark', 'flipped to dark');
    },
  },
  {
    name: 'matchMedia change while setting=light does NOT re-apply',
    setup: { stored: 'light', prefersDark: false },
    run: (THEME, meta) => {
      THEME.init();
      meta.mediaQuery.matches = true;
      meta.listeners.forEach((cb) => cb());
      assertEq(meta.body._attrs['data-theme'], 'light', 'still light');
    },
  },
  {
    name: 'matchMedia unsupported → effective fallback dark',
    setup: { hasMatchMedia: false },
    run: (THEME, meta) => {
      THEME.init();
      assertEq(THEME.getEffective(), 'dark', 'fallback');
    },
  },
];

let pass = 0;
let fail = 0;
for (const c of cases) {
  try {
    const sandbox = makeSandbox(c.setup);
    const THEME = await loadTheme(sandbox);
    c.run(THEME, sandbox._meta);
    console.log(`  ✓ ${c.name}`);
    pass++;
  } catch (e) {
    console.log(`  ✗ ${c.name}`);
    console.log(`      ${e.message}`);
    fail++;
  }
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
```

- [ ] **Step 2: Run the test**

Run: `node scripts/test-theme.mjs`
Expected:
```
  ✓ no URL, no storage, OS=dark → effective=dark, setting=auto
  ✓ no URL, no storage, OS=light → effective=light, setting=auto
  ✓ storage=dark, OS=light → effective=dark (stored wins over OS)
  ✓ URL=light overrides storage=dark + persists to storage
  ✓ invalid URL value falls back to storage
  ✓ setTheme updates storage + body attribute
  ✓ invalid setTheme value is ignored
  ✓ matchMedia change while setting=auto re-applies
  ✓ matchMedia change while setting=light does NOT re-apply
  ✓ matchMedia unsupported → effective fallback dark

10 pass, 0 fail
```

If any case fails, fix `theme.js` to satisfy the test (test reflects spec — do not weaken the test).

- [ ] **Step 3: Add npm script**

Edit `package.json`. The current `scripts` block is:
```json
"scripts": {
  "snapshot": "node scripts/snapshot-regression.mjs"
},
```
Change to:
```json
"scripts": {
  "snapshot": "node scripts/snapshot-regression.mjs",
  "check-theme": "node scripts/test-theme.mjs",
  "check-i18n": "node scripts/check-i18n.mjs"
},
```
(Also wires the existing `check-i18n.mjs` for parity since it didn't have an npm shortcut before.)

- [ ] **Step 4: Verify npm scripts**

Run: `npm run check-theme`
Expected: same `10 pass, 0 fail` output as Step 2.

Run: `npm run check-i18n`
Expected: existing i18n check passes (currently `PASS`).

- [ ] **Step 5: Commit**

```bash
git add scripts/test-theme.mjs package.json
git commit -m "$(cat <<'EOF'
test(theme): add scripts/test-theme.mjs smoke test for THEME runtime

10 cases covering setting precedence (URL > storage > default), effective
resolution, setTheme persistence, matchMedia live-flip, and unsupported
matchMedia fallback. Wires npm run check-theme + npm run check-i18n.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Add 4 i18n keys for theme

**Files:**
- Modify: `i18n/zh-Hant.js`
- Modify: `i18n/en.js`

- [ ] **Step 1: Add keys to `i18n/zh-Hant.js`**

Insert these 4 lines after the `'size.label'` block (around current line 22), keeping a blank line of separation:

```javascript
  'size.label': '// size',

  'theme.label': '主題',
  'theme.option.auto': '自動',
  'theme.option.light': '亮色',
  'theme.option.dark': '暗色',

  'generate.button': '▸ generate',
```

- [ ] **Step 2: Add same keys to `i18n/en.js`**

Insert in the matching position (after `'size.label'`):

```javascript
  'size.label': '// size',

  'theme.label': 'Theme',
  'theme.option.auto': 'Auto',
  'theme.option.light': 'Light',
  'theme.option.dark': 'Dark',

  'generate.button': '▸ generate',
```

- [ ] **Step 3: Verify both tables have all 4 keys**

Run: `grep -c "'theme\." i18n/zh-Hant.js`
Expected: `4`

Run: `grep -c "'theme\." i18n/en.js`
Expected: `4`

- [ ] **Step 4: Run i18n consistency check**

Run: `npm run check-i18n`
Expected output (in particular):
```
  ✓ Tables match
  …
PASS
```

Note: the script will currently report `Defined but unused: [theme.label, theme.option.auto, theme.option.dark, theme.option.light]` because index.html doesn't reference them yet. That's a warning, not failure — Task 6 adds the references.

- [ ] **Step 5: Commit**

```bash
git add i18n/zh-Hant.js i18n/en.js
git commit -m "$(cat <<'EOF'
feat(i18n): add theme.* keys for theme switcher UI

theme.label + theme.option.{auto,light,dark} in both zh-Hant and en.
HTML references arrive in a later commit; check-i18n will warn until then.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Refactor `index.html` style + structure (no UI yet)

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add `<link rel="stylesheet" href="theme.css">` and `<script src="theme.js">`**

Inside `<head>`, add the CSS link **before** the inline `<style>` block (so inline rules can override theme.css if ever needed). The current head ends with a `<style>` block — insert this line just before `<style>`:

```html
  <link rel="stylesheet" href="theme.css" />

  <style>
```

At the bottom of `<body>`, add `<script src="theme.js">` **before** `<script src="random.js">` (no dependency, but loads early so subsequent inline use is safe). The current script block is:

```html
  <script src="random.js"></script>
  <script src="palette.js"></script>
  <script src="pixel-utils.js"></script>
  <script src="potion.js"></script>
  <script src="sword.js"></script>
  <script src="spear.js"></script>
  <script src="i18n/zh-Hant.js"></script>
  <script src="i18n/en.js"></script>
  <script src="i18n.js"></script>
  <script src="main.js"></script>
```

Change the first line and add `theme.js` before the existing first line:

```html
  <script src="theme.js"></script>
  <script src="random.js"></script>
```

- [ ] **Step 2: Set default `<body data-theme="dark">`**

Change:
```html
<body>
```
to:
```html
<body data-theme="dark">
```

This avoids one frame of unstyled flash before `THEME.init()` fires.

- [ ] **Step 3: Remove inline `:root { ... }` block**

Delete lines 16–27 (the `:root { ... --pixel-gap: 1px; }` block). After deletion, the `<style>` block should start with the universal selector:

```html
  <style>
    * { box-sizing: border-box; }
```

Note: `--pixel-gap: 1px;` is currently in `:root` but is not used anywhere else (verify with `grep "var(--pixel-gap)" index.html` → no matches). Safe to drop entirely.

- [ ] **Step 4: Replace hardcoded canvas frame colors with vars**

In `.preview-frame` (currently around lines 139–154):

Find:
```css
    .preview-frame {
      background:
        linear-gradient(135deg, #20202c 25%, transparent 25%),
        linear-gradient(225deg, #20202c 25%, transparent 25%),
        linear-gradient(45deg, #20202c 25%, transparent 25%),
        linear-gradient(315deg, #20202c 25%, #1a1a26 25%);
      background-position: 8px 0, 8px 0, 0 0, 0 0;
      background-size: 16px 16px;
      background-color: #1a1a26;
      border: 1px solid var(--line);
```

Replace with:
```css
    .preview-frame {
      background:
        linear-gradient(135deg, var(--bg-frame-a) 25%, transparent 25%),
        linear-gradient(225deg, var(--bg-frame-a) 25%, transparent 25%),
        linear-gradient(45deg, var(--bg-frame-a) 25%, transparent 25%),
        linear-gradient(315deg, var(--bg-frame-a) 25%, var(--bg-frame-b) 25%);
      background-position: 8px 0, 8px 0, 0 0, 0 0;
      background-size: 16px 16px;
      background-color: var(--bg-frame-b);
      border: 1px solid var(--line);
```

In `.grid-cell` (currently around line 302):

Find:
```css
    .grid-cell {
      aspect-ratio: 1 / 1;
      background: #1a1a26;
```

Replace with:
```css
    .grid-cell {
      aspect-ratio: 1 / 1;
      background: var(--bg-cell);
```

- [ ] **Step 5: Verify no hardcoded theme colors remain**

Run: `grep -nE "#(0e0d14|15131e|1d1a2a|20202c|1a1a26|2a2638|e8e4d8|8a8499|ffb347|6dd3ce|ff6b8a)" index.html`
Expected: NO output (all theme colors have moved to theme.css).

Run: `grep -c "var(--bg-frame" index.html`
Expected: `≥4` (used in the four linear-gradients).

Run: `grep -c "var(--bg-cell)" index.html`
Expected: `1`

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
refactor(index): wire theme.css/theme.js + replace hardcoded colors

Moves :root variables into theme.css so light theme can override them
via body[data-theme]. .preview-frame checker and .grid-cell bg now
read --bg-frame-a/b and --bg-cell. Default <body data-theme="dark">
prevents FOUC before theme.js init. UI dropdown arrives in next commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Add theme-select UI to `index.html`

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Update header CSS (settings row + select width)**

The current rule (around line 69) is:
```css
    #lang-select {
      font-size: 12px;
      padding: 4px 8px;
      width: auto;
    }
```

Replace with:
```css
    #lang-select, #theme-select {
      font-size: 12px;
      padding: 4px 8px;
      width: auto;
    }
    .settings-row {
      display: flex;
      gap: 8px;
      align-items: center;
    }
```

- [ ] **Step 2: Wrap lang-select + add theme-select in `.settings-row`**

The current `.header-right` block is:
```html
      <div class="header-right">
        <select id="lang-select" aria-label="Language">
          <option value="zh-Hant">繁體中文</option>
          <option value="en">English</option>
        </select>
        <div class="tagline">
          <span data-i18n-key="app.tagline">程序化像素圖示產生器</span> <span class="blink"></span>
        </div>
      </div>
```

Replace with:
```html
      <div class="header-right">
        <div class="settings-row">
          <select id="lang-select" aria-label="Language">
            <option value="zh-Hant">繁體中文</option>
            <option value="en">English</option>
          </select>
          <select id="theme-select" data-i18n-attr-aria-label="theme.label" aria-label="Theme">
            <option value="auto"  data-i18n-key="theme.option.auto">自動</option>
            <option value="light" data-i18n-key="theme.option.light">亮色</option>
            <option value="dark"  data-i18n-key="theme.option.dark">暗色</option>
          </select>
        </div>
        <div class="tagline">
          <span data-i18n-key="app.tagline">程序化像素圖示產生器</span> <span class="blink"></span>
        </div>
      </div>
```

- [ ] **Step 3: Verify HTML structure**

Run: `grep -c 'id="theme-select"' index.html`
Expected: `1`

Run: `grep -c 'data-i18n-key="theme.option' index.html`
Expected: `3`

Run: `grep -c 'class="settings-row"' index.html`
Expected: `1`

- [ ] **Step 4: Re-run i18n check**

Run: `npm run check-i18n`
Expected: `PASS` and the previously warned `theme.*` keys should no longer appear in `Defined but unused` (HTML now references all 4 — including aria-label via `data-i18n-attr-aria-label`).

If `theme.label` still shows as unused, verify the `data-i18n-attr-aria-label="theme.label"` attribute is present and correctly spelled.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
feat(theme): add theme-select dropdown to index.html header

New <select id="theme-select"> with Auto/Light/Dark options sits next
to lang-select inside .settings-row (flex). aria-label uses theme.label
via data-i18n-attr-aria-label. Wiring lands in main.js next.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Wire `THEME.init()` + theme-select listener in `main.js`

**Files:**
- Modify: `main.js`

- [ ] **Step 1: Call `THEME.init()` before `I18N.init()`**

The current bootstrap section (around lines 151–157) is:
```javascript
// =============================================================
// 啟動
// =============================================================
I18N.init();
seedInput.value = generateRandomSeed();
generate();
renderBatchGrid();
```

Change to:
```javascript
// =============================================================
// 啟動
// =============================================================
THEME.init();
I18N.init();
seedInput.value = generateRandomSeed();
generate();
renderBatchGrid();
```

- [ ] **Step 2: Wire theme-select dropdown**

The current i18n dropdown wiring at the bottom (around lines 159–166) is:
```javascript
// =============================================================
// i18n dropdown
// =============================================================
const langSelect = document.getElementById('lang-select');
langSelect.value = I18N.getLang();
langSelect.addEventListener('change', (e) => {
  I18N.setLang(e.target.value);
});
```

Append after it:
```javascript

// =============================================================
// theme dropdown
// =============================================================
const themeSelect = document.getElementById('theme-select');
themeSelect.value = THEME.getSetting();
themeSelect.addEventListener('change', (e) => {
  THEME.setTheme(e.target.value);
});
```

- [ ] **Step 3: Verify wiring**

Run: `grep -c "THEME\." main.js`
Expected: `3` (THEME.init, THEME.getSetting, THEME.setTheme)

Run: `grep -c "themeSelect" main.js`
Expected: `3`

- [ ] **Step 4: Smoke-load index.html headlessly**

Run:
```bash
node -e "
import('puppeteer').then(async ({ default: puppeteer }) => {
  const url = 'file://' + process.cwd() + '/index.html';
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
  await page.goto(url, { waitUntil: 'networkidle0' });
  const dataTheme = await page.evaluate(() => document.body.getAttribute('data-theme'));
  const setting = await page.evaluate(() => window.THEME.getSetting());
  const themeSelectValue = await page.evaluate(() => document.getElementById('theme-select').value);
  await browser.close();
  console.log('data-theme:', dataTheme);
  console.log('THEME.getSetting():', setting);
  console.log('theme-select.value:', themeSelectValue);
  console.log('errors:', errors.length ? errors : 'none');
  if (errors.length || !dataTheme || setting !== themeSelectValue) process.exit(1);
});
"
```
Expected:
- `data-theme:` is `light` or `dark` (depends on host OS prefers-color-scheme — both are fine)
- `THEME.getSetting():` is `auto` (no localStorage seeded)
- `theme-select.value:` is `auto` (matches getSetting)
- `errors: none`
- Exit code 0

- [ ] **Step 5: Commit**

```bash
git add main.js
git commit -m "$(cat <<'EOF'
feat(theme): wire THEME.init() + theme-select handler in main.js

THEME.init() runs first in bootstrap (before I18N.init). Dropdown
syncs initial value from THEME.getSetting() and routes change events
to THEME.setTheme().

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Refactor `regression.html` (CSS to vars + body default)

**Files:**
- Modify: `regression.html`

- [ ] **Step 1: Add `<link>` and `<script>` to `<head>`**

The current `<head>` is:
```html
<head>
  <meta charset="UTF-8" />
  <title>Icon Machine — Visual Regression</title>
  <style>
```

Insert the link before the `<style>` block:
```html
<head>
  <meta charset="UTF-8" />
  <title>Icon Machine — Visual Regression</title>
  <link rel="stylesheet" href="theme.css" />
  <style>
```

- [ ] **Step 2: Replace all hardcoded colors in `<style>` with vars**

The full current `<style>` content (lines 6–27) is:
```css
    body {
      font-family: ui-monospace, Menlo, monospace;
      background: #f0ece4;
      color: #2a2638;
      margin: 24px;
    }
    h1 { font-size: 18px; margin: 0 0 16px; }
    h2 { font-size: 14px; margin: 32px 0 12px; color: #c46a00; letter-spacing: 1px; }
    .controls { margin-bottom: 16px; display: flex; gap: 8px; }
    button {
      background: #ffffff; color: #2a2638;
      border: 1px solid #c8c2b4; padding: 8px 14px;
      cursor: pointer; font-family: inherit;
    }
    button:hover { border-color: #c46a00; color: #c46a00; }
    table { border-collapse: collapse; margin-bottom: 16px; }
    th, td { border: 1px solid #c8c2b4; padding: 6px; text-align: center; }
    th { background: #e6dfd0; color: #c46a00; font-weight: normal; font-size: 11px; }
    canvas { image-rendering: pixelated; image-rendering: crisp-edges; background: #e8e0d0; }
    .seed-label { font-size: 10px; color: #6a6458; margin-top: 4px; }
```

Replace with:
```css
    body {
      font-family: ui-monospace, Menlo, monospace;
      background: var(--bg-deep);
      color: var(--ink);
      margin: 24px;
    }
    h1 { font-size: 18px; margin: 0 0 16px; }
    h2 { font-size: 14px; margin: 32px 0 12px; color: var(--accent); letter-spacing: 1px; }
    .controls { margin-bottom: 16px; display: flex; gap: 8px; align-items: center; }
    button {
      background: var(--bg-panel); color: var(--ink);
      border: 1px solid var(--line); padding: 8px 14px;
      cursor: pointer; font-family: inherit;
    }
    button:hover { border-color: var(--accent); color: var(--accent); }
    select {
      background: var(--bg-panel); color: var(--ink);
      border: 1px solid var(--line); padding: 8px 14px;
      font-family: inherit; cursor: pointer;
    }
    table { border-collapse: collapse; margin-bottom: 16px; }
    th, td { border: 1px solid var(--line); padding: 6px; text-align: center; }
    th { background: var(--bg-panel-2); color: var(--accent); font-weight: normal; font-size: 11px; }
    canvas { image-rendering: pixelated; image-rendering: crisp-edges; background: var(--bg-cell); }
    .seed-label { font-size: 10px; color: var(--ink-dim); margin-top: 4px; }
```

(The `select` rule is added now so the dropdown coming in Task 9 inherits the same visual treatment as buttons.)

- [ ] **Step 3: Set default `<body data-theme="dark">`**

Change:
```html
<body>
```
to:
```html
<body data-theme="dark">
```

- [ ] **Step 4: Verify no hardcoded theme colors remain**

Run: `grep -nE "#(f0ece4|2a2638|c46a00|c8c2b4|e6dfd0|e8e0d0|6a6458|ffffff)" regression.html`
Expected: NO output (all moved to vars).

Run: `grep -c "var(--" regression.html`
Expected: `≥14` (every previously hardcoded color now references a var).

- [ ] **Step 5: Commit**

```bash
git add regression.html
git commit -m "$(cat <<'EOF'
refactor(regression): wire theme.css + replace hardcoded paper palette

All inline colors (#f0ece4 / #c46a00 / #e8e0d0 / etc) become CSS vars.
With <body data-theme="dark"> default, regression now renders in dark
when no setting saved. Theme select and runtime wiring arrive next.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Add theme-select + wiring to `regression.html`

**Files:**
- Modify: `regression.html`

- [ ] **Step 1: Add theme-select to `.controls`**

The current controls block is:
```html
  <div class="controls">
    <button id="dl-png">下載拼接 PNG</button>
    <button id="dl-json">下載 specs.json</button>
  </div>
```

Replace with:
```html
  <div class="controls">
    <select id="theme-select" aria-label="Theme">
      <option value="auto">Auto</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
    <button id="dl-png">下載拼接 PNG</button>
    <button id="dl-json">下載 specs.json</button>
  </div>
```

- [ ] **Step 2: Add `<script src="theme.js">` and wire init/listener**

The current script block (around lines 45–51) is:
```html
  <script src="random.js"></script>
  <script src="palette.js"></script>
  <script src="pixel-utils.js"></script>
  <script src="potion.js"></script>
  <script src="sword.js"></script>
  <script src="spear.js"></script>
  <script>
```

Insert `<script src="theme.js">` at the top:
```html
  <script src="theme.js"></script>
  <script src="random.js"></script>
  <script src="palette.js"></script>
  <script src="pixel-utils.js"></script>
  <script src="potion.js"></script>
  <script src="sword.js"></script>
  <script src="spear.js"></script>
  <script>
```

At the very top of the inline `<script>` block (right after `<script>`, before the `// ===== Hardcoded baseline seeds =====` block), add:

```javascript
    // ============================================================
    // Theme bootstrap
    // ============================================================
    THEME.init();
    {
      const themeSelect = document.getElementById('theme-select');
      themeSelect.value = THEME.getSetting();
      themeSelect.addEventListener('change', (e) => THEME.setTheme(e.target.value));
    }
```

(The `{ ... }` block scopes `themeSelect` so it doesn't leak as a top-level binding alongside the existing `const POTION_SEEDS` etc.)

- [ ] **Step 3: Verify structure**

Run: `grep -c 'id="theme-select"' regression.html`
Expected: `1`

Run: `grep -c "THEME\." regression.html`
Expected: `3` (THEME.init, THEME.getSetting, THEME.setTheme)

Run: `grep -c '<script src="theme.js"' regression.html`
Expected: `1`

- [ ] **Step 4: Smoke-load regression.html headlessly**

Run:
```bash
node -e "
import('puppeteer').then(async ({ default: puppeteer }) => {
  const url = 'file://' + process.cwd() + '/regression.html';
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.querySelectorAll('#grid-spear tr').length > 5, { timeout: 15000 });
  const dataTheme = await page.evaluate(() => document.body.getAttribute('data-theme'));
  const setting = await page.evaluate(() => window.THEME.getSetting());
  const canvasBg = await page.evaluate(() => {
    const c = document.querySelector('#grid-potion canvas');
    return c ? getComputedStyle(c).backgroundColor : null;
  });
  await browser.close();
  console.log('data-theme:', dataTheme);
  console.log('THEME.getSetting():', setting);
  console.log('canvas computed bg:', canvasBg);
  console.log('errors:', errors.length ? errors : 'none');
  if (errors.length) process.exit(1);
});
"
```
Expected:
- `data-theme:` is `light` or `dark` (depends on OS)
- `THEME.getSetting():` is `auto`
- `canvas computed bg:` is a non-null color string (whatever `--bg-cell` resolves to)
- `errors: none`

- [ ] **Step 5: Commit**

```bash
git add regression.html
git commit -m "$(cat <<'EOF'
feat(theme): add theme-select + THEME wiring to regression.html

New <select id="theme-select"> in .controls row. Inline script bootstraps
THEME.init() before grid render and wires the dropdown via setTheme.
Hardcoded English labels (regression has no i18n).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Lock snapshot baseline to light theme

**Files:**
- Modify: `scripts/snapshot-regression.mjs`

The snapshot script previously navigated to `regression.html` where canvas bg was hardcoded `#e8e0d0`. Now it's `var(--bg-cell)` which depends on `data-theme`. To keep baseline deterministic — independent of the host OS — force `?theme=light` so canvas bg resolves to `#e8e0d0` (matching the historical baseline).

- [ ] **Step 1: Append `?theme=light` to the navigation URL**

The current line (line 7) is:
```javascript
const target = pathToFileURL(path.join(root, 'regression.html')).href;
```

Change to:
```javascript
// Force light theme so canvas bg resolves to --bg-cell #e8e0d0
// (matches the historical hardcoded snapshot baseline). Independent of host OS.
const target = pathToFileURL(path.join(root, 'regression.html')).href + '?theme=light';
```

Also the current zoom-canvas hardcoded BG is:
```javascript
    const SCALE = 8;
    const BG = '#2a2a3a';
```
Leave this as-is — the zoom canvas is its own composited canvas and its bg is unrelated to the page theme. (Calling out so reviewers don't conflate it.)

- [ ] **Step 2: Run snapshot**

Run: `npm run snapshot`
Expected: Console shows `wrote spear-grid.png`, `wrote sword-grid.png`, `wrote potion-grid.png`, plus zoom files. `done` at the end.

- [ ] **Step 3: Compare current vs baseline**

Run: `ls -la snapshots/baseline/ snapshots/current/`
Expected: same set of `.png` files in both directories.

Run (per-file size diff sanity check):
```bash
for f in snapshots/baseline/*.png; do
  name=$(basename "$f")
  cur="snapshots/current/$name"
  if [ -f "$cur" ]; then
    sb=$(stat -f%z "$f" 2>/dev/null || stat -c%s "$f")
    sc=$(stat -f%z "$cur" 2>/dev/null || stat -c%s "$cur")
    delta=$((sc - sb))
    echo "$name baseline=$sb current=$sc delta=$delta"
  fi
done
```
Expected: `delta` is 0 or within a few hundred bytes per file (PNG re-encoding noise). If any delta is large (>5KB) or the baseline file is missing, investigate by reading a current+baseline PNG pair with the Read tool and visually comparing.

- [ ] **Step 4: Visual spot-check via Read**

Use the Read tool on these pairs and visually verify they are essentially identical (you can see PNG content directly):
- `snapshots/baseline/potion-grid.png` vs `snapshots/current/potion-grid.png`
- `snapshots/baseline/sword-grid.png` vs `snapshots/current/sword-grid.png`
- `snapshots/baseline/spear-grid.png` vs `snapshots/current/spear-grid.png`

Expected: identical aesthetic — same paper bg, same icon pixels. If the canvas backgrounds in current are clearly darker/different, the `?theme=light` URL param did not take effect — debug by re-running the smoke-load command from Task 9 Step 4 with the URL param appended.

- [ ] **Step 5: Commit (snapshot files only changed if PNG re-encoding produced byte differences)**

```bash
git add scripts/snapshot-regression.mjs
git commit -m "$(cat <<'EOF'
chore(snapshot): pin regression to ?theme=light for deterministic baseline

After theme switcher work, canvas bg follows --bg-cell which depends on
<body data-theme>. Force ?theme=light in the snapshot URL so baseline
PNGs are independent of host OS prefers-color-scheme.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

If `git status` after the commit shows snapshot files in `snapshots/current/` (gitignored — don't add) or `snapshots/baseline/` differ from main, do NOT promote a new baseline as part of this change. Hand off to user in Task 11 if delta is > byte-level noise.

---

## Task 11: User visual verification handoff

This task cannot be automated (no browser MCP). It produces no commits. The implementing engineer's job is to write the user-facing checklist below into the PR description / handoff message and stop.

- [ ] **Step 1: Print the verification checklist**

Output exactly this block to the user (or include it in the PR description if creating one):

```
Visual verification — please open index.html and regression.html in a browser
and confirm each item.

INDEX.HTML
  [ ] First load with no localStorage and OS=dark → page is dark.
  [ ] First load with no localStorage and OS=light → page is light.
  [ ] Switch theme select to Light → page flips, persists across reload.
  [ ] Switch theme select to Dark → page flips, persists.
  [ ] Switch to Auto + flip OS theme → page flips live without reload.
  [ ] ?theme=light in URL → page light, persists in localStorage.

  Aesthetic spot-check (Light):
  [ ] Header h1 "icon.machine" readable; .accent dot is dark orange.
  [ ] preview-card screw glow not garish (R3 of spec).
  [ ] preview-frame checker is faint paper grid, not jarring.
  [ ] grid-cells background light, icons readable on each.
  [ ] Body grid pattern (faint lines) acceptable on paper bg (R6 of spec).

  Aesthetic spot-check (Dark): unchanged from current.

REGRESSION.HTML
  [ ] Theme select present at top of .controls row.
  [ ] Light mode: identical to current regression.html appearance.
  [ ] Dark mode: canvas bg dark (#1a1a26), borders visible, h2 accent visible.

CROSS-PAGE
  [ ] Switch theme on index.html → open regression.html in new tab → same theme.

ICON PALETTE READABILITY (canvas content unchanged but bg flips)
  [ ] All 6 magical families (potion) readable on both light and dark frame.
  [ ] All 5 metal families (sword/spear) readable on both.
  [ ] obsidian sword/spear on light bg: outline pops; bladeMain visible.
  [ ] glassShine highlights on light bg slightly washed but acceptable
      (per spec R1 — accepted trade-off, palette is theme-independent by design).

If any check fails, file a follow-up task. Do not promote new snapshot baseline
unless the snapshot diff in Task 10 was already accepted.
```

- [ ] **Step 2: If user reports issues, address per-issue with new tasks**

Common likely follow-ups (already documented in spec risks):
- R3 (`.preview-card::before` glow garish on white): add `body[data-theme="light"] .preview-card::before { box-shadow: 0 0 4px var(--accent); }` to `index.html` style block.
- R6 (body grid pattern intrusive in light): add `body[data-theme="light"] { background-image: none; }` to `index.html` style block.

These are the only anticipated tweaks. Anything else is out of plan scope; brainstorm a follow-up.

---

## Verification of Plan Completeness (run before merge)

After all 11 tasks above, run:

```bash
npm run check-i18n   # PASS, no theme.* in unused warnings
npm run check-theme  # 10 pass, 0 fail
npm run snapshot     # all PNGs written, deltas within byte noise
```

And verify no theme hex literals leaked back in:

```bash
grep -nE "#(0e0d14|15131e|1d1a2a|20202c|1a1a26|2a2638|c46a00|f0ece4|e8e0d0|c8c2b4|6a6458|ffffff|e6dfd0)" index.html regression.html main.js
```
Expected: empty (only `theme.css` should contain raw theme hex literals).
