# Theme Switcher — Design

**Date**: 2026-05-10
**Scope**: Add dark/light theme switching to `index.html` + `regression.html`. Auto mode follows OS `prefers-color-scheme`. Icon palette unchanged (page CSS layer only).

---

## 1. Goal

Let users switch UI between **dark** (current `index.html` aesthetic — `#0e0d14` 黑底 + `#ffb347` 燈泡橘) and **light** (current `regression.html` aesthetic — `#f0ece4` paper + `#c46a00` 深橘) on both pages. Default to **Auto** (matches OS).

Settings persist via `localStorage` and are shared across both pages. Switch UI mirrors the existing `i18n` dropdown pattern.

## 2. Premise correction

The original brief used the phrase "目前橘 #c46a00" for the current state. After inspection:

- `index.html` is already **dark** (`--bg-deep: #0e0d14`, `--accent: #ffb347` 燈泡橘). It does not use `#c46a00`.
- `regression.html` is **light** (`#f0ece4` paper body, `#c46a00` 橘 for `h2`).

So this work is not "convert dark page to support light"; it is "**unify both pages under one switchable theme system**" — index gains a light variant, regression gains a dark variant, both pages share a settings runtime.

## 3. Decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Scope | Both pages support dark + light, with switch UI on both. Shared `localStorage` key. |
| 2 | Default theme | **Auto** — `window.matchMedia('(prefers-color-scheme: dark)')`. Falls back to dark if matchMedia unsupported. |
| 3 | Switch UI (index) | Independent `<select>` next to existing `lang-select`. Three options: Auto / Light / Dark. |
| 4 | Switch UI (regression) | Add a `<select>` near the existing download buttons. Hardcoded English strings (regression has no i18n). |
| 5 | Canvas frame bg (light) | Reuse `regression.html` paper colors: body `#f0ece4`, panel `#ffffff`, frame checker `#f0ece4`/`#e8e0d0`, grid cell `#e8e0d0`. |
| 6 | Accent (light) | Darker variants — `--accent: #c46a00` (matches regression), `--accent-2: #2a8a85` 深茶綠, `--danger: #c2185b`. WCAG AA passes on white. |
| 7 | Code layout | New `theme.css` (CSS variables + `body[data-theme="light"]` overrides) + `theme.js` (runtime, mirrors `i18n.js` pattern). Both shared by index + regression. |
| 8 | Out of scope | `palette.js` / `potion.js` / `sword.js` / `spear.js` are untouched. Icon pixel content does not change with theme. |

## 4. Architecture

### 4.1 `theme.js` (new)

Pattern modeled after `i18n.js`. Key differences:

- Three **settings** (`'auto' | 'light' | 'dark'`) but only two **effective** themes (`'light' | 'dark'`).
- `'auto'` resolves via `matchMedia`.
- A `change` listener on the matchMedia query updates DOM live when setting is `'auto'` and the OS theme flips.

```js
window.THEME = (function () {
  const SUPPORTED = ['auto', 'light', 'dark'];
  const DEFAULT_SETTING = 'auto';
  const STORAGE_KEY = 'iconmachine.theme';

  let currentSetting = DEFAULT_SETTING; // 'auto' | 'light' | 'dark'
  let mediaQuery = null;                // matchMedia handle for prefers-color-scheme

  // These three mirror i18n.js exactly (s/lang/theme/, s/SUPPORTED langs/SUPPORTED themes/).
  // No navigator-language equivalent — Auto is its own setting that resolves dynamically.
  function readSettingFromURL() { /* URLSearchParams 'theme' ∈ SUPPORTED */ }
  function readSettingFromStorage() { /* localStorage[STORAGE_KEY] ∈ SUPPORTED */ }
  function resolveInitialSetting() {
    // 1. URL hit → also write to localStorage → return.
    // 2. Else localStorage → return.
    // 3. Else DEFAULT_SETTING ('auto').
  }

  function resolveEffective(setting) {
    if (setting === 'light' || setting === 'dark') return setting;
    // 'auto'
    if (mediaQuery && mediaQuery.matches) return 'dark';
    if (mediaQuery) return 'light';
    return 'dark'; // matchMedia unsupported → dark fallback
  }

  function applyTheme() {
    const eff = resolveEffective(currentSetting);
    document.body.setAttribute('data-theme', eff);
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

### 4.2 `theme.css` (new)

Single source of truth for both pages. `:root` is **dark** (matches current `index.html`'s baseline so an unstyled load looks dark). `body[data-theme="light"]` overrides.

```css
:root {
  /* Backgrounds */
  --bg-deep:     #0e0d14;
  --bg-panel:    #15131e;
  --bg-panel-2:  #1d1a2a;
  --bg-frame-a:  #20202c;   /* checker high */
  --bg-frame-b:  #1a1a26;   /* checker low / grid cell */
  --bg-cell:     #1a1a26;

  /* Inks */
  --ink:         #e8e4d8;
  --ink-dim:     #8a8499;

  /* Accents */
  --accent:      #ffb347;   /* 燈泡橘 */
  --accent-2:    #6dd3ce;   /* 古銅綠 */
  --danger:      #ff6b8a;

  /* Lines */
  --line:        #2a2638;
}

body[data-theme="light"] {
  --bg-deep:     #f0ece4;   /* paper, reuse regression */
  --bg-panel:    #ffffff;
  --bg-panel-2:  #f7f3ea;
  --bg-frame-a:  #f0ece4;
  --bg-frame-b:  #e8e0d0;
  --bg-cell:     #e8e0d0;

  --ink:         #2a2638;   /* deep purple-black, reuse regression */
  --ink-dim:     #6a6458;

  --accent:      #c46a00;   /* matches regression h2 */
  --accent-2:    #2a8a85;   /* darker teal, WCAG AA on white */
  --danger:      #c2185b;

  --line:        #c8c2b4;   /* matches regression table border */
}
```

### 4.3 DOM contract

- `<body>` always has a `data-theme` attribute (`"light"` or `"dark"`).
- The attribute is set by `THEME.init()` before any first paint of theme-sensitive UI. Specifically `THEME.init()` is called **first** in `main.js` (before `I18N.init()` order doesn't matter, but theme should land before grid renders to avoid flicker).
- `index.html` and `regression.html` should set a default attribute (`data-theme="dark"`) on `<body>` in HTML to avoid a one-frame unstyled flash before JS runs. `THEME.init()` overwrites if needed. Trade-off: a user with `setting=auto` and OS=light will see a single dark frame before flip; acceptable given the alternative (FOUC) is worse. Picking `dark` as default matches the pre-existing index baseline.

### 4.4 i18n keys (added to `i18n/zh-Hant.js` + `i18n/en.js`)

| key | zh-Hant | en |
|---|---|---|
| `theme.label` | `主題` | `Theme` |
| `theme.option.auto` | `自動` | `Auto` |
| `theme.option.light` | `亮色` | `Light` |
| `theme.option.dark` | `暗色` | `Dark` |

The aria-label for `theme-select` uses `theme.label` via `data-i18n-attr-aria-label`.

## 5. UI changes

### 5.1 `index.html`

**Header right** (currently lang-select + tagline):

```html
<div class="header-right">
  <div class="settings-row">
    <select id="lang-select" aria-label="Language">…</select>
    <select id="theme-select" data-i18n-attr-aria-label="theme.label">
      <option value="auto"  data-i18n-key="theme.option.auto">自動</option>
      <option value="light" data-i18n-key="theme.option.light">亮色</option>
      <option value="dark"  data-i18n-key="theme.option.dark">暗色</option>
    </select>
  </div>
  <div class="tagline">…</div>
</div>
```

`.settings-row` is a new flex container (gap 8px) so the two selects sit side-by-side. The existing rule:

```css
#lang-select { font-size: 12px; padding: 4px 8px; width: auto; }
```

becomes:

```css
#lang-select, #theme-select { font-size: 12px; padding: 4px 8px; width: auto; }
.settings-row { display: flex; gap: 8px; align-items: center; }
```

**Style block changes**:
- Remove the inline `:root { ... }` block (lines 16–27 of current `index.html`). Variables now come from `theme.css`.
- Replace hardcoded `.preview-frame` checker (`#20202c`/`#1a1a26`) → `var(--bg-frame-a)` / `var(--bg-frame-b)`.
- Replace `.preview-frame { background-color: #1a1a26; }` → `var(--bg-frame-b)`.
- Replace `.grid-cell { background: #1a1a26; }` → `var(--bg-cell)`.
- `.preview-card::before` glow `box-shadow: 0 0 8px var(--accent)` is fine on light too — `#c46a00` glow on white reads as a soft orange dot, not garish. Verify visually; if needed add `body[data-theme="light"] .preview-card::before { box-shadow: none; }` as a follow-up tweak.

**`<head>` script + link order**:
```html
<link rel="stylesheet" href="theme.css">
…
<script src="theme.js"></script>          <!-- before main.js -->
<script src="random.js"></script>
…
<script src="main.js"></script>
```

### 5.2 `regression.html`

**`<style>` block**: rewrite all hardcoded colors to use CSS vars from `theme.css`. The existing palette maps to:

| current hardcode | new var |
|---|---|
| `body { background: #f0ece4; color: #2a2638; }` | `var(--bg-deep)` / `var(--ink)` |
| `h2 { color: #c46a00; }` | `var(--accent)` |
| `button { background: #ffffff; … border: 1px solid #c8c2b4; color: #2a2638; }` | `var(--bg-panel)` / `var(--line)` / `var(--ink)` |
| `button:hover { border-color: #c46a00; color: #c46a00; }` | `var(--accent)` |
| `th, td { border: 1px solid #c8c2b4; }` | `var(--line)` |
| `th { background: #e6dfd0; color: #c46a00; }` | `var(--bg-panel-2)` / `var(--accent)` |
| `canvas { background: #e8e0d0; }` | `var(--bg-cell)` |
| `.seed-label { color: #6a6458; }` | `var(--ink-dim)` |

After this rewrite, regression renders identically in light mode and gets a dark variant for free.

**Controls**: existing `.controls` div has the two download buttons. Add a `<select>` in front:

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

`.controls` is already `display: flex; gap: 8px;` so no CSS change needed.

**Script include**: add `<script src="theme.js"></script>` before the inline `<script>` block, and call `THEME.init()` + wire the select inside the inline script (it's standalone, doesn't share `main.js`).

### 5.3 `main.js`

Add at top of bootstrap section:
```js
THEME.init();
```
(Order: before `I18N.init()` is fine. Both must run before `generate()` / `renderBatchGrid()`.)

Add at bottom (next to lang-select wiring):
```js
const themeSelect = document.getElementById('theme-select');
themeSelect.value = THEME.getSetting();
themeSelect.addEventListener('change', (e) => {
  THEME.setTheme(e.target.value);
});
```

## 6. Behavior

### 6.1 First load
1. HTML loads with `<body data-theme="dark">` (avoids unstyled flash).
2. `theme.js` runs `THEME.init()`:
   - Reads URL `?theme=` → if present and valid, write to localStorage, use it.
   - Else read localStorage → if present, use.
   - Else use `'auto'`.
3. Computes effective theme via `matchMedia` (when setting is auto).
4. Sets `<body data-theme="...">` to effective.
5. CSS variables flip; UI re-paints.

### 6.2 Switching via dropdown
- User picks `Auto` / `Light` / `Dark`.
- `setTheme()` writes to localStorage, recomputes effective, updates `<body data-theme>`.

### 6.3 OS theme change while setting=Auto
- matchMedia `change` event fires → `applyTheme()` re-resolves effective → `<body data-theme>` flips live without reload.

### 6.4 Cross-page persistence
- Both pages read the same `localStorage` key (`iconmachine.theme`).
- Switching on `index.html`, then opening `regression.html` in a new tab → regression picks up the same setting.

### 6.5 URL sharing
- `?theme=light` works on both pages, mirrors `?lang=` behavior.

## 7. Risks

### R1 — Icon palette readability on light bg (out of scope, but verify)
- Outline `HSL(h, 50, 12)` on `#f0ece4` → contrast ≈ 9:1 → **PASS**, outline pops cleanly.
- glassShine `HSL(h, s, 92)` on `#f0ece4` → contrast ≈ 1.05:1 → **wash out**. Acceptable trade-off because:
  - User has explicitly stated palette doesn't change with theme.
  - Shine is small surface area (a few pixels), bordered by outline.
  - Equivalent issue exists in dark mode (obsidian bladeMain L=30 on `#1a1a26` → wash out). Symmetric.
- Verification: open `index.html`, batch-render 24 icons of each type in light mode, eyeball.

### R2 — `prefers-color-scheme` unsupported
- Old browsers without matchMedia → fallback to `dark` (current behavior). Acceptable since modern browsers all support it (Safari 12.1+, Chrome 76+, Firefox 67+).

### R3 — `.preview-card::before` accent glow on light
- `box-shadow: 0 0 8px #c46a00` on white may read as a brown smudge.
- Mitigation: render and visually check. If ugly, add `body[data-theme="light"] .preview-card::before { box-shadow: 0 0 4px var(--accent); }` (smaller glow) as a tweak.

### R4 — `regression.html canvas { background: #e8e0d0 }` was always meant for paper bg
- Now switchable to `var(--bg-cell)`. In dark mode this becomes `#1a1a26` (matches index `.grid-cell`). The icon will sit on dark bg in regression dark mode — same readability story as index.

### R5 — Snapshot regression script
- `scripts/snapshot-regression.mjs` runs headless and probably renders to a fixed bg. Confirm during implementation that it's not affected; if it is, force theme to a fixed value when scripted.

### R6 — Body grid pattern (`linear-gradient(var(--line) 1px, ...)`) on light
- In dark mode this is `#2a2638` lines on `#0e0d14` bg → faint grid.
- In light mode this becomes `#c8c2b4` lines on `#f0ece4` bg → similar faintness, same idiom. Verify visually; fallback is to disable in light: `body[data-theme="light"] { background-image: none; }`.

## 8. Validation checklist

- [ ] `index.html` loads with no theme set + OS=dark → page is dark.
- [ ] `index.html` loads with no theme set + OS=light → page is light.
- [ ] Switch theme select to Light → page flips, persists across reload.
- [ ] Switch theme select to Dark → page flips, persists.
- [ ] Switch to Auto + flip OS theme → page flips live without reload.
- [ ] Open `regression.html` in another tab → picks up same theme.
- [ ] `?theme=light` URL → page light, persists in localStorage.
- [ ] All 6 magical families (potion) readable in both themes.
- [ ] All 5 metal families (sword/spear) readable in both themes — especially obsidian + golden + steel which are the contrast-edge cases.
- [ ] regression.html dark mode renders correctly (canvas bg dark, table borders visible, h2 accent visible).
- [ ] No flicker on first paint (HTML default `data-theme="dark"` covers).
- [ ] `npm run snapshot` still produces matching baselines (snapshots only capture canvas content, theme should not affect — confirm).

## 9. Out of scope

- `settings.js` refactor (combining `i18n.js` + `theme.js`). Defer until a 3rd setting appears.
- Theme-specific icon palettes (e.g. brighten outline in dark mode). User has explicitly carved this out.
- CSS transition on theme change (instant flip is fine).
- Theme-specific Easter eggs (e.g. inverted blink color).
- Persisting theme **per page** (one global setting is the agreed model).
