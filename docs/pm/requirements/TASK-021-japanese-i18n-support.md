# [TASK-021] Add Japanese (ja) Internationalization Support

## 1. Overview & Objective
Expand ItemSeed's internationalization (i18n) framework to support Japanese (`ja`), joining the existing Traditional Chinese (`zh-Hant`) and English (`en`) dictionaries. Japanese is a premier market for indie retro RPG developers, pixel artists, and game jam participants.

## 2. Requirements & Scope

### 2.1 Dictionary Definition (`i18n/ja.js`)
Create a new translation table `window.I18N_JA` with the complete 30-key dictionary matching `i18n/en.js` and `i18n/zh-Hant.js`:

```javascript
window.I18N_JA = {
  'app.title': 'ItemSeed — ドット絵RPGアイテムジェネレーター',
  'app.tagline': 'ドット絵RPGアイテムジェネレーター',

  'preview.label': '// preview',
  'preview.scale': 'scale: 12x',
  'preview.format': 'format: png · transparent',

  'seed.label': '// seed',
  'seed.placeholder': 'シード値を入力（空欄でランダム）',
  'seed.reroll.title': '新しいランダムシード',

  'type.label': '// type',
  'type.option.any': 'すべて (any)',
  'type.option.potion': 'ポーション (potion)',
  'type.option.sword': '剣 (sword)',
  'type.option.spear': '槍 (spear)',
  'type.option.shield': '盾 (shield)',
  'type.option.staff': '杖 (staff)',

  'size.label': '// size',

  'theme.label': 'テーマ',
  'theme.option.auto': '自動',
  'theme.option.light': 'ライト',
  'theme.option.dark': 'ダーク',

  'generate.button': '▸ generate',
  'download.button': '⇩ png',
  'studio.asset_license': '生成アセット：CC0 1.0（商用・個人プロジェクト問わず無料利用可能）',

  'tip.text': 'ヒント: 同じシード値からは常に同じアイコンが生成されます。一括プレビュー内のセルをクリックして読み込めます。',

  'batch.heading.before': 'batch',
  'batch.heading.after': 'preview',
  'batch.hint': 'セルをクリックしてシード値を読み込む',

  'footer.inspired': 'Inspired by',
  'footer.source': 'GitHubでソースを見る',
  'footer.license': 'コード：MIT · 生成アセット：CC0 1.0',
};
```

### 2.2 Runtime Integration (`i18n.js`)
1. Add `'ja'` to `SUPPORTED = ['zh-Hant', 'en', 'ja']`.
2. Register `window.I18N_JA` in `TABLES`.
3. Support browser locale detection in `readLangFromNavigator()`:
   ```javascript
   if (nav.startsWith('ja')) return 'ja';
   ```

### 2.3 UI Markup (`index.html`)
1. Add `<option value="ja">日本語</option>` to `#lang-select` in the header.
2. Include `<script src="i18n/ja.js"></script>` in the scripts section prior to `i18n.js`.

### 2.4 Integrity Testing (`scripts/check-i18n.mjs`)
Update `scripts/check-i18n.mjs` to validate all three tables (`zh-Hant`, `en`, `ja`) for:
- 100% mutual key presence (all 30 keys).
- HTML dataset key references coverage.
- Zero missing keys across dictionaries.

## 3. Acceptance Criteria
1. `i18n/ja.js` is created with all 30 translation keys.
2. Users can select `日本語` from the header dropdown, immediately translating the UI to Japanese.
3. Language preference persists across page reloads in `localStorage` under `itemseed.lang`.
4. URL parameter `?lang=ja` properly sets the language to Japanese on load.
5. Automated test `npm test` (including `check-i18n`) passes with 100% parity across `zh-Hant`, `en`, and `ja`.
