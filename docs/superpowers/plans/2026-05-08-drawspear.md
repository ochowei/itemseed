# drawSpear Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `drawSpear` 從 main.js 裡的占位 stub 升級為 spec→render 兩階段的程序化規則,產出隨 seed 變化、像 RPG 道具的 32×32(主)/ 16×16(子集)矛圖示;沿用 sword 已建立的架構,palette / pixel-utils 直接共用,新增 wood 色族與 spear 專屬 shape。

**Architecture:** 兩階段,沿用 sword pattern:`sampleSpearSpec(rng)` 把所有 RNG 集中於 sample 階段,輸出純資料 spec;`renderSpearSpec32` / `renderSpearSpec16` 是純函式,把 spec 渲染為像素。內部用 single enum mask(`'head' | 'shaft' | 'butt' | null`)記錄形狀,所有 outline 透過共用的 `applyInsideOutlinePass` + `paintInternalSeams` 演算法保證連續。

**Tech Stack:** vanilla JS、HTML5 Canvas 2D、無 build tool、無 npm、無 test framework。

**Spec:** [`docs/superpowers/specs/2026-05-08-drawspear-design.md`](../specs/2026-05-08-drawspear-design.md)

---

## Project-Specific Notes

**Git repo:** 此專案是 git 倉。每個 task 結尾以 `git commit` 收束,訊息風格沿用既有(`feat(spear): ...` / `feat(palette): ...` / `docs: ...`)。

**No test framework:** 不引入任何 test 框架。驗證方式分兩類:
1. **Console-based**(資料 / 純函式):在瀏覽器打開 `index.html`(或 task 10 後切到 `regression.html`),F12 開 devtools,在 Console 貼指定表達式,比對輸出。
2. **Visual**(渲染結果):打開 `index.html`,選 type = spear,輸入指定 seed,點 Generate,用眼睛比對是否符合描述。Task 10 後可改用 `regression.html` 的 grid 一次看 ~16 張。

每個 task 的 verify 步驟會明確說是哪一種、要看什麼。

**File loading order:** `index.html` 與 `regression.html` 用一連串 `<script src=...>` 依序載入。新檔案 `spear.js` 須加進兩個 HTML,順序在 `palette.js` / `pixel-utils.js` / `potion.js` / `sword.js` 之後、`main.js` 之前。

**Hard constraints(任何 task 都不能違反):**
- 所有座標 / 寬 / 高為整數
- 每張圖示主視覺色 ≤ 6(outline + headMain + headShine + WOOD.main + 至多 WOOD.shadow)
- 暗色描邊全身連續(由 `applyInsideOutlinePass` 演算法保證)
- 同 seed 永遠重現相同輸出(所有 RNG 集中於 `sampleSpearSpec`)

**Naming convention during build:** Task 2 在 spear.js 內部把對外函式命名為 `drawSpearV2` 並 export 為 `window.drawSpearV2`,**避免**跟 main.js 既有的 `drawSpear` stub 撞名(JS 全域 function declaration 會互相覆蓋,`drawSpearV2` 比 `drawSpearImpl` 更直覺)。Task 9 才會把 stub 從 main.js 移除、把 spear.js 的 export 改名為 `window.drawSpear`,讓 `ITEM_TYPES.spear` 指向新實作。同 pattern potion / sword 用過。

**Critical naming rule(per spec §9):** spear.js 內所有 file-internal const / function 若**可能**跟 sword.js 或 potion.js 同名,一律加 `SPEAR_` 前綴或 `Spear` 中綴。以下是已知撞名清單:

| spear 識別字 | 撞 |
|---|---|
| `shapeStraight32`, `shapeStraight16` | sword.js 已用 |
| `ARCHETYPES`, `ARCHETYPE_WEIGHTS` | sword.js 已用(未加前綴) |
| `tryPaintBladeCell32/16` | sword.js 用 — spear 用 `tryPaintHeadCell32/16` 不撞 |

**規則:** spear 的 shape 函式統一加 `Spear` 中綴(`shapeSpearStraight32` / `shapeSpearTrident32` / `shapeSpearHooked32`,16 同),所有 const 統一加 `SPEAR_` 前綴(`SPEAR_ARCHETYPES`、`SPEAR_BUTT_STYLES`、`SPEAR_BINDING_SINGLES`、`SPEAR_BINDING_PAIRS`、`SPEAR_SHAPE_FNS_32/16`),mask builder 用 `buildSpearMask32/16`。Function declaration 撞名 silent override 比 const 撞名 SyntaxError 更隱晦 — sword 有踩過,**寧可前綴過頭**。

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `random.js` | unchanged | seeded PRNG |
| `palette.js` | **MODIFY** | 既有全部不動;新增 `WOOD_PALETTE` + `sampleSpearPalette` wrapper |
| `pixel-utils.js` | unchanged | `paintInternalSeams` + `applyInsideOutlinePass` 直接共用 |
| `potion.js` | unchanged | 不動 |
| `sword.js` | unchanged | 不動 |
| `spear.js` | **NEW** | `sampleSpearSpec`、`renderSpearSpec32`、`renderSpearSpec16`、shape silhouette 函式、所有 paint helpers、對外 `drawSpear` |
| `main.js` | **MODIFY**(Task 9) | 移除 `drawSpear` 占位 stub。`ITEM_TYPES.spear` 指向 spear.js 的新實作 |
| `index.html` | **MODIFY** | 加 `<script src="spear.js">`(Task 2 加,但放對位置) |
| `regression.html` | **MODIFY**(Task 10) | 在現有 sword grid 之下新增 spear grid,擴充下載按鈕一次涵蓋三種物品 |

---

## Task 1: 擴充 `palette.js` — 加 WOOD_PALETTE + sampleSpearPalette wrapper

**Files:**
- Modify: `palette.js`

此 task 不改動 potion / sword 既有功能(`FAMILIES` / `samplePalette` / `CORK_PALETTE` / `METAL_FAMILIES` / `sampleSwordPalette` / `LEATHER_PALETTE` 完整保留)。

- [ ] **Step 1: 定義驗證目標**

預期能在 console 跑出:

```js
// WOOD_PALETTE 直接讀
console.log(WOOD_PALETTE);
// 期望:{ main: '#a87c4e', shadow: '#6a4020', highlight: '#c8a070' }

// sampleSpearPalette 結構
const r = new SeededRandom('test-spear-1');
const p = sampleSpearPalette(r);
console.log(p);
// 期望:{ family: <metal-name>, palette: { outline, headMain, headShadow, headShine } }
// 全部 4 色都是 7-char #RRGGBB
console.log(typeof p.palette.headMain, p.palette.headMain.length);
// 期望:string 7

// 5 個金屬族都應該抽得到(內部呼叫 sampleSwordPalette 共用 weights)
const seen = new Set();
for (let i = 0; i < 80; i++) {
  seen.add(sampleSpearPalette(new SeededRandom('spear-palette-' + i)).family);
}
console.log('metal families seen:', [...seen]);
// 期望:['steel', 'iron', 'bronze', 'gold', 'obsidian'] 全到

// 重現性
const a = sampleSpearPalette(new SeededRandom('repro-spear'));
const b = sampleSpearPalette(new SeededRandom('repro-spear'));
console.log('reproducible:', JSON.stringify(a) === JSON.stringify(b));
// 期望:true

// sampleSwordPalette 跟 sampleSpearPalette 在同 seed 下,family / outline 必須相同
// (因 sampleSpearPalette 內部呼叫 sampleSwordPalette,只重命名欄位)
const s = sampleSwordPalette(new SeededRandom('cross'));
const sp = sampleSpearPalette(new SeededRandom('cross'));
console.log('cross-consistency:',
  s.family === sp.family,
  s.palette.outline === sp.palette.outline,
  s.palette.bladeMain === sp.palette.headMain,
  s.palette.bladeShadow === sp.palette.headShadow,
  s.palette.bladeShine === sp.palette.headShine
);
// 期望:全 true
```

- [ ] **Step 2: 在 `palette.js` 既有 `LEATHER_PALETTE` 後面插入 `WOOD_PALETTE`**

找到:
```js
const LEATHER_PALETTE = {
  main:      '#6a4828',
  shadow:    '#3a2818',
  highlight: '#8a6840',
};
```

在它**後面**插入:

```js
const WOOD_PALETTE = {
  main:      '#a87c4e',   // 中等橡木色,shaft 主色
  shadow:    '#6a4020',   // 深棕,shaft binding 用
  highlight: '#c8a070',   // 淺褐,本輪不用,留給未來 shaft shine
};
```

- [ ] **Step 3: 在 `sampleSwordPalette` 後面插入 `sampleSpearPalette` wrapper**

找到:
```js
function sampleSwordPalette(rng) {
  ...
  return {
    family: familyName,
    palette: {
      outline:     hslToRgbHex(h, 50, 12),
      bladeMain:   hslToRgbHex(h, s, L),
      bladeShadow: hslToRgbHex(h, Math.min(100, s + 10), Math.max(0, L - 15)),
      bladeShine:  hslToRgbHex(h + 5, Math.max(0, s - 15), 85),
    },
  };
}
```

在它**後面**插入:

```js
/**
 * 從 RNG 抽一個金屬色族並推導 4 色 spear palette。
 * 內部呼叫 sampleSwordPalette,把 bladeMain/bladeShadow/bladeShine 重命名為
 * headMain/headShadow/headShine,語意更符合 spear 矛頭。
 * @returns {{ family: string, palette: { outline, headMain, headShadow, headShine } }}
 */
function sampleSpearPalette(rng) {
  const { family, palette } = sampleSwordPalette(rng);
  return {
    family,
    palette: {
      outline:    palette.outline,
      headMain:   palette.bladeMain,
      headShadow: palette.bladeShadow,
      headShine:  palette.bladeShine,
    },
  };
}
```

- [ ] **Step 4: 在檔尾既有 window.* exports 之後加上新 exports**

找到 `palette.js` 檔尾:
```js
window.METAL_FAMILIES = METAL_FAMILIES;
window.LEATHER_PALETTE = LEATHER_PALETTE;
window.sampleSwordPalette = sampleSwordPalette;
```

在它**後面**插入:

```js
window.WOOD_PALETTE = WOOD_PALETTE;
window.sampleSpearPalette = sampleSpearPalette;
```

- [ ] **Step 5: Verify in browser console**

打開 `index.html` 在瀏覽器(可用 `python3 -m http.server` 開 local server,或直接拖檔)。F12 開 console。把 Step 1 的所有驗證表達式逐段貼進去執行,逐一對比期望輸出。

特別注意 cross-consistency 檢查 — 5 個 boolean 都要是 true,否則 `sampleSpearPalette` 沒有正確 wrap 到 `sampleSwordPalette`。

如果有任何一條不通過,先別 commit,debug 完再進下一步。

- [ ] **Step 6: Commit**

```bash
git add palette.js
git commit -m "feat(palette): add WOOD_PALETTE + sampleSpearPalette wrapper

Wraps sampleSwordPalette and renames bladeMain/bladeShadow/bladeShine
to headMain/headShadow/headShine for spear's semantic clarity.
WOOD_PALETTE is family-independent like LEATHER_PALETTE/CORK_PALETTE.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: 建立 `spear.js` 骨架 + `sampleSpearSpec` + 加進 index.html

**Files:**
- Create: `spear.js`
- Modify: `index.html`(加 script tag)

此 task 完成後 `sampleSpearSpec` 可以從 console 呼叫,但還沒有 render(`drawSpearV2` 是個 stub 只 console.log spec)。`drawSpear` 對外名仍是 main.js 的舊 stub,Task 9 才換掉。

- [ ] **Step 1: 定義驗證目標**

```js
// spec 結構
const r = new SeededRandom('spec-test-1');
const spec = sampleSpearSpec(r);
console.log(spec);
// 期望:
//   family: 'steel' | 'iron' | 'bronze' | 'gold' | 'obsidian'
//   palette: { outline, headMain, headShadow, headShine } 都是 #RRGGBB
//   archetype: 'straight' | 'trident' | 'hooked'
//   buttStyle: 'disc' | 'sphere' | 'spike'
//   hasShaftBinding: bool
//   shaftBindingYs: array — 0 / 1 / 2 個 y 值

// 重現性
const a = sampleSpearSpec(new SeededRandom('repro-spec'));
const b = sampleSpearSpec(new SeededRandom('repro-spec'));
console.log('spec reproducible:', JSON.stringify(a) === JSON.stringify(b));
// 期望:true

// archetype 分布(8 種 sample)
const archCounts = { straight: 0, trident: 0, hooked: 0 };
for (let i = 0; i < 200; i++) {
  archCounts[sampleSpearSpec(new SeededRandom('arch-' + i)).archetype]++;
}
console.log('archetype counts:', archCounts);
// 期望:straight ≈ 200 * 3/6.5 ≈ 92,trident ≈ 62,hooked ≈ 46(weighted [3,2,1.5])
// 容忍 ±20% 範圍即可

// buttStyle 分布
const buttCounts = { disc: 0, sphere: 0, spike: 0 };
for (let i = 0; i < 300; i++) {
  buttCounts[sampleSpearSpec(new SeededRandom('butt-' + i)).buttStyle]++;
}
console.log('butt counts:', buttCounts);
// 期望:三者各 ≈ 100,容忍 ±20%

// hasShaftBinding 50% / shaftBindingYs 結構
let withBinding = 0, single = 0, double = 0;
for (let i = 0; i < 200; i++) {
  const s = sampleSpearSpec(new SeededRandom('bind-' + i));
  if (s.hasShaftBinding) {
    withBinding++;
    if (s.shaftBindingYs.length === 1) single++;
    if (s.shaftBindingYs.length === 2) double++;
  } else {
    if (s.shaftBindingYs.length !== 0) console.error('expected empty when no binding');
  }
}
console.log('binding counts:', { withBinding, single, double });
// 期望:withBinding ≈ 100,single ≈ 50,double ≈ 50

// shaftBindingYs y range 範圍 [10..23]
for (let i = 0; i < 100; i++) {
  const s = sampleSpearSpec(new SeededRandom('range-' + i));
  for (const y of s.shaftBindingYs) {
    if (y < 10 || y > 23) console.error('binding y out of range:', y);
  }
}
console.log('all binding y in [10..23]');
// 期望:沒 console.error

// drawSpearV2 stub 暫且 console.log
const ctx = document.createElement('canvas').getContext('2d');
drawSpearV2(ctx, new SeededRandom('stub-test'), 32);
// 期望:console 印出 spec object(暫時的 stub 行為)
```

- [ ] **Step 2: 建立 `spear.js` 檔案,加上頂部 const 與 `sampleSpearSpec`**

新檔案 `spear.js` 完整內容(此 step 不寫 render — Task 4 起逐步加):

```js
// spear.js
// 兩階段架構:sampleSpearSpec(rng) → spec → renderSpearSpec32/16(ctx, spec)。
// 此檔最後 export 對外 drawSpear(ctx, rng, size) 給 main.js 用。
// 沿用 sword 同模式,palette 由 sampleSpearPalette 提供。

// =====================================================================
// Sampler — 把所有 RNG 集中於此,輸出純資料 spec
// =====================================================================

// 注意:以下 const 必加 SPEAR_ 前綴,因 sword.js 已用未加前綴的 ARCHETYPES /
// ARCHETYPE_WEIGHTS 等同名 const,若不前綴會撞 → SyntaxError。
const SPEAR_ARCHETYPES = ['straight', 'trident', 'hooked'];
const SPEAR_ARCHETYPE_WEIGHTS = [3, 2, 1.5];
const SPEAR_BUTT_STYLES = ['disc', 'sphere', 'spike'];

// hasShaftBinding 為 true 時的 y pool。1 條走 SINGLES,2 條走 PAIRS。
// 兩 pool 都在 spec §4.6 hardcode,涵蓋 shaft 上 / 中 / 下不同位置與不同間距。
// shaft y=8..25,binding 避開 y=8..9 與 y=24..25 兩端 seam 區,故 y range [10..23]。
const SPEAR_BINDING_SINGLES = [10, 12, 14, 17, 20, 22];
const SPEAR_BINDING_PAIRS = [[10, 14], [11, 16], [13, 18], [15, 20], [18, 23], [11, 21]];

function sampleSpearSpec(rng) {
  const { family, palette } = sampleSpearPalette(rng);
  const archetype = rng.pickWeighted(SPEAR_ARCHETYPES, SPEAR_ARCHETYPE_WEIGHTS);
  const buttStyle = rng.pick(SPEAR_BUTT_STYLES);
  const hasShaftBinding = rng.chance(0.5);

  // sample 階段就決定 binding 帶位置,確保 render 是純函式
  const shaftBindingYs = [];
  if (hasShaftBinding) {
    if (rng.chance(0.5)) {
      // 1 條 binding
      shaftBindingYs.push(rng.pick(SPEAR_BINDING_SINGLES));
    } else {
      // 2 條 binding,從合法 pair 六選一
      const pair = rng.pick(SPEAR_BINDING_PAIRS);
      shaftBindingYs.push(pair[0], pair[1]);
    }
  }

  return {
    family,
    palette,
    archetype,
    buttStyle,
    hasShaftBinding,
    shaftBindingYs,
  };
}

// =====================================================================
// 對外:drawSpear(ctx, rng, size)
// 注意:暫時 export 為 drawSpearV2,避免跟 main.js 既有 drawSpear stub
// 撞名(function declaration silent override)。Task 9 改為 drawSpear。
// =====================================================================

function drawSpearV2Impl(ctx, rng, size) {
  const spec = sampleSpearSpec(rng);
  // TODO Task 4-8: render → renderSpearSpec32 / renderSpearSpec16
  console.log('[drawSpearV2 stub] spec=', spec, 'size=', size);
}

window.sampleSpearSpec = sampleSpearSpec;
window.drawSpearV2 = drawSpearV2Impl;
```

- [ ] **Step 3: 在 `index.html` 既有 sword.js script tag 後加上 spear.js**

找到 `index.html` 的 script load order:

```html
<script src="random.js"></script>
<script src="palette.js"></script>
<script src="pixel-utils.js"></script>
<script src="potion.js"></script>
<script src="sword.js"></script>
<script src="main.js"></script>
```

在 `sword.js` 跟 `main.js` 之間插入 `spear.js`:

```html
<script src="random.js"></script>
<script src="palette.js"></script>
<script src="pixel-utils.js"></script>
<script src="potion.js"></script>
<script src="sword.js"></script>
<script src="spear.js"></script>
<script src="main.js"></script>
```

- [ ] **Step 4: Verify in browser console**

打開(或重整)`index.html`,F12 開 console。應該不會有 SyntaxError(若有,大概是某個 const 撞 sword.js 的同名 const,檢查 SPEAR_ 前綴是否漏掉)。

逐段貼 Step 1 的驗證表達式,對比期望輸出。容差 ±20% 是因為 200 sample 在統計上仍會有散布。

注意「重現性」 必須**完全**一致(JSON.stringify 比對),不接受任何容差 — 同 seed 必同 spec 是這個專案的核心契約。

- [ ] **Step 5: Commit**

```bash
git add spear.js index.html
git commit -m "feat(spear): scaffold spear.js with sampleSpearSpec

Adds SPEAR_ prefixed constants (ARCHETYPES, BUTT_STYLES, BINDING pools)
and the sampler that produces deterministic spec from RNG. Renderer is
not implemented yet — drawSpearV2 is a stub that console.logs the spec.
The V2 suffix avoids colliding with main.js's existing drawSpear stub
until Task 9.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: 32×32 archetype shape silhouette 函式

**Files:**
- Modify: `spear.js`(append)

定義 head 形狀的純資料函式。每個 archetype 是 `() → { cells: Array<{ x, y }> }`,描繪該 archetype 的 head silhouette(不包含 shaft / butt — 那兩個由 mask builder 加)。使用 cells-based 表示(不像 sword 用 row-spans)是因為 trident archetype 在某些 row 有 3 個不連續 1px prong,row-spans 表示不出。

- [ ] **Step 1: 定義驗證目標**

```js
// 三個 archetype 的 cell list 都不為空
const sShape = SPEAR_SHAPE_FNS_32.straight();
const tShape = SPEAR_SHAPE_FNS_32.trident();
const hShape = SPEAR_SHAPE_FNS_32.hooked();
console.log('cells lengths:', sShape.cells.length, tShape.cells.length, hShape.cells.length);
// 期望:三者 > 0,精確值:straight 22(1+3+5+5+5+3),trident 26(3+3+7+5+5+3),hooked 25(1+3+5+6+7+3)

// 所有 cell 在 32×32 內
const allInBounds = (shape) => shape.cells.every(({ x, y }) =>
  x >= 0 && x < 32 && y >= 0 && y < 32);
console.log('all in bounds:', allInBounds(sShape), allInBounds(tShape), allInBounds(hShape));
// 期望:三者 true

// straight 中軸 cx=16,所有 cell x 應落在 [cx-2..cx+2]
const sX = sShape.cells.map(c => c.x);
console.log('straight x range:', Math.min(...sX), Math.max(...sX));
// 期望:14..18

// trident y=2 應有 3 個 prong cells 在 cols 13, 16, 19
const tridentY2 = tShape.cells.filter(c => c.y === 2).map(c => c.x).sort((a, b) => a - b);
console.log('trident y=2 prongs:', tridentY2);
// 期望:[13, 16, 19]

// hooked y=6 應到 col 20(hook peak)
const hookedY6 = hShape.cells.filter(c => c.y === 6).map(c => c.x).sort((a, b) => a - b);
console.log('hooked y=6 cells:', hookedY6);
// 期望:[14, 15, 16, 17, 18, 19, 20]

// 所有 archetype 的 head 都應該在 y=2..7 範圍內(per spec §4.1)
const yIn = (shape) => shape.cells.every(c => c.y >= 2 && c.y <= 7);
console.log('all y in [2..7]:', yIn(sShape), yIn(tShape), yIn(hShape));
// 期望:三者 true
```

- [ ] **Step 2: 在 `spear.js` `sampleSpearSpec` 後面、`drawSpearV2Impl` 之前插入 shape 函式**

```js
// =====================================================================
// Shape silhouette functions (32×32)
//
// 每個 archetype 是一個 () → { cells: Array<{ x, y }> }
// 描繪 head 外輪廓(僅 head,不含 shaft/butt)。整數座標。
//
// 用 cells-based 而非 row-spans:trident y=2..3 有 3 個不連續 1px prong,
// row-spans 表示不出來;cells 統一處理 sparse / dense 兩種 row。
//
// 整體垂直配置(per spec §4.1):
//   y=0..1   padding
//   y=2..7   head  (6 rows)
//   y=8..25  shaft (18 rows)
//   y=26..28 butt  (3 rows)
//   y=29..31 padding
//
// 中軸 cx=16,所有 archetype 都 vertical aligned。
// =====================================================================

// helper: 在 cells 加進「row y 的 cols [x0..x1]」這段
function spearAddRange(cells, y, x0, x1) {
  for (let x = x0; x <= x1; x++) cells.push({ x, y });
}

function shapeSpearStraight32() {
  // 對稱長葉狀:tip 1 + taper 3 + body 5 三列 + shoulder 3
  const cells = [];
  const cx = 16;
  cells.push({ x: cx, y: 2 });             // tip
  spearAddRange(cells, 3, cx - 1, cx + 1); // taper w3
  spearAddRange(cells, 4, cx - 2, cx + 2); // body w5
  spearAddRange(cells, 5, cx - 2, cx + 2);
  spearAddRange(cells, 6, cx - 2, cx + 2);
  spearAddRange(cells, 7, cx - 1, cx + 1); // shoulder w3
  return { cells };
}

function shapeSpearTrident32() {
  // 三叉:3 prongs at cols cx-3, cx, cx+3 (cols 13, 16, 19),間距 3
  // y=2..3 prongs(各 1 px)→ y=4 bridge w7 → y=5..6 body w5 → y=7 shoulder
  const cells = [];
  const cx = 16;
  for (let y = 2; y <= 3; y++) {
    cells.push({ x: cx - 3, y });
    cells.push({ x: cx,     y });
    cells.push({ x: cx + 3, y });
  }
  spearAddRange(cells, 4, cx - 3, cx + 3); // bridge w7
  spearAddRange(cells, 5, cx - 2, cx + 2); // body w5
  spearAddRange(cells, 6, cx - 2, cx + 2);
  spearAddRange(cells, 7, cx - 1, cx + 1); // shoulder w3
  return { cells };
}

function shapeSpearHooked32() {
  // 鉤矛:右側不對稱,hook 從 y=5 起到 y=6 達峰 col 20
  const cells = [];
  const cx = 16;
  cells.push({ x: cx, y: 2 });             // tip
  spearAddRange(cells, 3, cx - 1, cx + 1); // taper w3
  spearAddRange(cells, 4, cx - 2, cx + 2); // body w5
  spearAddRange(cells, 5, cx - 2, cx + 3); // body + hook 開始 w6
  spearAddRange(cells, 6, cx - 2, cx + 4); // 鉤峰 w7
  spearAddRange(cells, 7, cx - 1, cx + 1); // shoulder w3
  return { cells };
}

const SPEAR_SHAPE_FNS_32 = {
  straight: shapeSpearStraight32,
  trident:  shapeSpearTrident32,
  hooked:   shapeSpearHooked32,
};
```

- [ ] **Step 3: 在 `spear.js` 檔尾 `window.drawSpearV2 = drawSpearV2Impl` 後增加 export(僅 debug 需要)**

```js
window.SPEAR_SHAPE_FNS_32 = SPEAR_SHAPE_FNS_32;
```

- [ ] **Step 4: Verify in browser console**

重整 `index.html`,逐段貼 Step 1 的驗證表達式。重點確認:
- straight x range = 14..18(w5)
- trident y=2 prongs 確實在 cols [13, 16, 19](三點不連續)
- hooked y=6 = [14..20](w7,hook peak)

如果 trident prongs 排序後不是 [13, 16, 19],檢查 push 順序與 cx 計算。

- [ ] **Step 5: Commit**

```bash
git add spear.js
git commit -m "feat(spear): add 32x32 archetype shape silhouettes

shapeSpearStraight32 / shapeSpearTrident32 / shapeSpearHooked32 emit
cells-based head outlines covering y=2..7. Spear/ prefix avoids
collision with sword.js shapeStraight32.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: 32×32 `buildSpearMask32` + 第一輪可見 render

**Files:**
- Modify: `spear.js`

實作 mask builder 與第一個版本的 `renderSpearSpec32`。本 task 結束後 spec → 像素的基本 pipeline 已通,head + shaft + butt 主色都會畫出來,但**沒有 shine、沒有 binding**(那兩個是 Task 5、6)。

- [ ] **Step 1: 定義驗證目標**

```js
// buildSpearMask32 結構
const r1 = new SeededRandom('mask-test-straight');
const spec1 = sampleSpearSpec(r1);
spec1.archetype = 'straight';   // 強制 straight 看 mask
spec1.buttStyle  = 'disc';
const m = buildSpearMask32(spec1);
console.log('mask length:', m.length);
// 期望:1024(32×32)

const counts = { head: 0, shaft: 0, butt: 0, null: 0 };
for (const v of m) counts[v ?? 'null']++;
console.log(counts);
// 期望(straight + disc):
//   head = 22(1+3+5+5+5+3)
//   shaft = 18 rows × 3 cols = 54
//   butt(disc) = 3 rows × 5 cols = 15
//   null = 1024 - (22+54+15) = 933

// 可見 render(visual)
// 在 index.html UI:type = spear,size = 32,seed = "spear-vis-1"
// 點 Generate 後預期看到:
//   - 中央有對稱長葉狀 head(白灰金屬色 ≈ steel)
//   - 下方接細長 shaft(中性褐色 wood)
//   - 末端有金屬 butt 蓋(disc / sphere / spike 隨 spec)
//   - 全身有黑色 outline 連續閉合
//   - 暫時沒有 shine / binding(下一 task 加)
```

- [ ] **Step 2: 在 `spear.js` `SPEAR_SHAPE_FNS_32` 後面插入 `buildSpearMask32`**

```js
// =====================================================================
// Mask builder (32×32) — 把 spec 轉成 enum mask
//
// mask cell ∈ { 'head' | 'shaft' | 'butt' | null }
// 三個 archetype 都 vertical(cx=16 中軸對齊),不需 axisFn 抽象。
// =====================================================================

function buildSpearMask32(spec) {
  const size = 32;
  const mask = allocateMask(size);

  // ── Head ── 從 archetype 對應的 shape 函式取 cells
  const { cells } = SPEAR_SHAPE_FNS_32[spec.archetype]();
  for (const { x, y } of cells) {
    maskSet(mask, size, x, y, 'head');
  }

  // ── Shaft (y=8..25, width 3, cols 15..17) ──
  for (let y = 8; y <= 25; y++) {
    for (let x = 15; x <= 17; x++) {
      maskSet(mask, size, x, y, 'shaft');
    }
  }

  // ── Butt (y=26..28, varies by buttStyle) ──
  // 每列 [leftX, rightX] 寬度,對應 spec §4.4 的表格
  const buttRanges = {
    disc:   [[14, 18], [14, 18], [14, 18]],   // 平蓋 w5×3 列
    sphere: [[15, 17], [14, 18], [15, 17]],   // 上下窄中間寬,圓珠
    spike:  [[14, 18], [15, 17], [16, 16]],   // 從上往下收成 1 px 點
  };
  const ranges = buttRanges[spec.buttStyle];
  for (let i = 0; i < 3; i++) {
    const y = 26 + i;
    const [lx, rx] = ranges[i];
    for (let x = lx; x <= rx; x++) {
      maskSet(mask, size, x, y, 'butt');
    }
  }

  return mask;
}
```

- [ ] **Step 3: 在 `buildSpearMask32` 後面插入第一版 `renderSpearSpec32`**

```js
// =====================================================================
// Renderer (32×32) — 純函式,不再使用 RNG
//
// 此 task 是第一版:只 mask + paint by enum + seam + outline,
// 還沒 shine / shaft binding(Task 5、6 加)。
// =====================================================================

function renderSpearSpec32(ctx, spec) {
  const size = 32;
  ctx.clearRect(0, 0, size, size);

  const mask = buildSpearMask32(spec);

  // step 2: 平鋪主色
  paintMaskByEnum(ctx, mask, size, {
    head:  spec.palette.headMain,
    shaft: WOOD_PALETTE.main,
    butt:  spec.palette.headMain,    // 同金屬色
  });

  // TODO Task 5: paintHeadShine32
  // TODO Task 6: paintShaftBinding32

  // step 5: internal seam
  paintInternalSeams(ctx, mask, size, spec.palette.outline);

  // step 6: 外圈 outline
  applyInsideOutlinePass(ctx, mask, size, spec.palette.outline);
}
```

- [ ] **Step 4: 把 `drawSpearV2Impl` 從 console.log stub 改為呼叫 `renderSpearSpec32`**

找到既有(Task 2 寫的)stub:

```js
function drawSpearV2Impl(ctx, rng, size) {
  const spec = sampleSpearSpec(rng);
  // TODO Task 4-8: render → renderSpearSpec32 / renderSpearSpec16
  console.log('[drawSpearV2 stub] spec=', spec, 'size=', size);
}
```

改成:

```js
function drawSpearV2Impl(ctx, rng, size) {
  const spec = sampleSpearSpec(rng);
  if (size === 32) renderSpearSpec32(ctx, spec);
  // TODO Task 8: 16×16
  // 暫時 size=16 fallback 到原本 main.js stub(透過 ITEM_TYPES 機制 — 此處 silent no-op)
}
```

- [ ] **Step 5: 加上 debug exports(在檔尾)**

```js
window.buildSpearMask32 = buildSpearMask32;
window.renderSpearSpec32 = renderSpearSpec32;
```

- [ ] **Step 6: 修改 main.js 暫時讓 spear 走 drawSpearV2(預覽用)**

⚠️ 此步是**暫時的**,Task 9 會清掉。原因:`ITEM_TYPES.spear` 目前指向 main.js 的 `drawSpear` stub;為了在 UI 上看到我們的新 render,需要暫時切到 `drawSpearV2`。

找到 `main.js` 的 `ITEM_TYPES`:

```js
const ITEM_TYPES = {
  potion: drawPotion,
  sword: drawSword,
  spear: drawSpear,
};
```

**暫時**改為:

```js
const ITEM_TYPES = {
  potion: drawPotion,
  sword: drawSword,
  spear: drawSpearV2,    // TEMPORARY: Task 9 will swap back to drawSpear
};
```

- [ ] **Step 7: Verify in browser**

重整 `index.html`。Console verify Step 1 的 mask 結構部分(逐段貼,確認 counts 大致對)。

然後 visual:
1. 選 type = spear,size = 32
2. seed = `spear-vis-1`,點 Generate
3. 看大圖預覽,應該有對稱 leaf head + 細 shaft + butt 蓋 + 黑色 outline

試 4 種 seed:`spear-vis-1` / `spear-vis-2` / `spear-vis-3` / `spear-vis-4`,應該每張都不同 archetype/buttStyle 組合。

關鍵檢查:
- ✓ outline 全身連續(沒中斷)
- ✓ head 顯示 metal 色(不全黑)
- ✓ shaft 顯示 wood 色(中央 1 px 褐色直線)
- ✓ butt 顯示 metal 色(中央 cell 不全黑)
- ✗ 暫時沒 shine(下一 task 加)
- ✗ 暫時沒 shaft binding(下下 task 加)

如果 head 看起來全黑,代表沒 interior cell 顯示主色 — 檢查 archetype shape 函式是否漏了內部 row(本應 3 列 body w5 才有 interior)。

- [ ] **Step 8: Commit**

```bash
git add spear.js main.js
git commit -m "feat(spear): 32x32 mask builder + first-pass render

buildSpearMask32 produces head/shaft/butt enum mask with buttStyle-
specific 3-row geometries (disc flat, sphere rounded, spike tapered).
renderSpearSpec32 paints main colors + applies seam/outline passes.
ITEM_TYPES.spear temporarily routed to drawSpearV2 for UI preview;
Task 9 will collapse this back to drawSpear.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: 32×32 always-on `paintHeadShine32`

**Files:**
- Modify: `spear.js`

加入 always-on 1px 縱線高光,光源從左上來(同 sword)。Shine 在 head body 的 interior column `cx-1 = 15`,y range 隨 archetype 不同(見 spec §4.5)。

- [ ] **Step 1: 定義驗證目標**

```js
// paintHeadShine32 應該只在 mask cell 為 'head' 時畫
// 視覺驗證:同 seed 加 shine 後,head 上應該多出 1 px 淺色高光在左側中間
//
// 在 index.html UI:type = spear,size = 32,seed = "shine-test-1"
// 對比 Task 4 結束時的版本與本 task 結束時的版本,head 內部應該多 1-3 px shine
```

- [ ] **Step 2: 在 `spear.js` `renderSpearSpec32` 之前(在 `buildSpearMask32` 之後)插入 paint helpers**

```js
// =====================================================================
// Paint helpers (32×32) — 純像素操作,讀 spec + mask 產生裝飾
// =====================================================================

/** 只在指定 cell 為 'head' 時才畫;避免畫到 shaft / butt / 外面 */
function tryPaintHeadCell32(ctx, mask, size, x, y) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  if (mask[y * size + x] !== 'head') return;
  ctx.fillRect(x, y, 1, 1);
}

/**
 * Always-on head shine。1px 縱線在 head body 的 interior column。
 * - straight:cx-1 = 15,y=4..6(3 列,body w5 的內側最左 column)
 * - trident:cx-1 = 15,y=5..6(2 列,跳過 y=4 因 bridge w7 在 col 15 處 up=null 變 outline)
 * - hooked:cx-1 = 15,y=4..6(3 列,body 至少 w5 從 y=4 起)
 *
 * gate:tryPaintHeadCell32 只在 mask 為 'head' 時畫,避免 shine 落到 shaft / 外面。
 */
function paintHeadShine32(ctx, mask, size, spec) {
  ctx.fillStyle = spec.palette.headShine;
  const cx = 16;

  if (spec.archetype === 'straight') {
    for (let y = 4; y <= 6; y++) {
      tryPaintHeadCell32(ctx, mask, size, cx - 1, y);
    }
    return;
  }

  if (spec.archetype === 'trident') {
    for (let y = 5; y <= 6; y++) {
      tryPaintHeadCell32(ctx, mask, size, cx - 1, y);
    }
    return;
  }

  if (spec.archetype === 'hooked') {
    for (let y = 4; y <= 6; y++) {
      tryPaintHeadCell32(ctx, mask, size, cx - 1, y);
    }
    return;
  }
}
```

- [ ] **Step 3: 在 `renderSpearSpec32` 把 shine 接上(在 paintMaskByEnum 之後、seam 之前)**

找到既有:

```js
function renderSpearSpec32(ctx, spec) {
  const size = 32;
  ctx.clearRect(0, 0, size, size);

  const mask = buildSpearMask32(spec);

  // step 2: 平鋪主色
  paintMaskByEnum(ctx, mask, size, {
    head:  spec.palette.headMain,
    shaft: WOOD_PALETTE.main,
    butt:  spec.palette.headMain,
  });

  // TODO Task 5: paintHeadShine32
  // TODO Task 6: paintShaftBinding32

  // step 5: internal seam
  paintInternalSeams(ctx, mask, size, spec.palette.outline);
  // step 6: 外圈 outline
  applyInsideOutlinePass(ctx, mask, size, spec.palette.outline);
}
```

改為:

```js
function renderSpearSpec32(ctx, spec) {
  const size = 32;
  ctx.clearRect(0, 0, size, size);

  const mask = buildSpearMask32(spec);

  // step 2: 平鋪主色
  paintMaskByEnum(ctx, mask, size, {
    head:  spec.palette.headMain,
    shaft: WOOD_PALETTE.main,
    butt:  spec.palette.headMain,
  });

  // step 3: head shine(always-on)
  paintHeadShine32(ctx, mask, size, spec);

  // TODO Task 6: paintShaftBinding32

  // step 5: internal seam
  paintInternalSeams(ctx, mask, size, spec.palette.outline);
  // step 6: 外圈 outline
  applyInsideOutlinePass(ctx, mask, size, spec.palette.outline);
}
```

- [ ] **Step 4: Verify in browser (visual)**

重整 `index.html`,選 type = spear, size = 32。試以下 seeds 各看一張並對比 Task 4 結束時(shine 無)與此 task(shine 有):

- `shine-straight-1`
- `shine-trident-1`
- `shine-hooked-1`

每張 head 內部應該多了 1-3 px 淺色高光在左側中間。具體位置:
- straight:col 15 的 y=4, 5, 6 三 cells(若 mask 都是 'head')
- trident:col 15 的 y=5, 6 兩 cells
- hooked:col 15 的 y=4, 5, 6 三 cells

⚠️ 若 shine 覆蓋了全身或畫到 shaft 上,代表 `tryPaintHeadCell32` 的 `mask[...] !== 'head'` 檢查沒生效,debug 後再進下一 task。

- [ ] **Step 5: Commit**

```bash
git add spear.js
git commit -m "feat(spear): always-on head shine 32x32

paintHeadShine32 puts 1px headShine column at cx-1 across head body
interior rows. Per-archetype y range avoids cells that would be
overwritten by the outline pass (trident skips y=4 bridge w7).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: 32×32 條件裝飾 — `paintShaftBinding32`

**Files:**
- Modify: `spear.js`

加入唯一一個 optional 裝飾:shaft binding。1-2 條 1px 水平 shadow 帶橫跨 shaft,sample 階段已決定 y 位置(`spec.shaftBindingYs`)。

- [ ] **Step 1: 定義驗證目標**

```js
// 純資料測試:hasShaftBinding=true 時 shaftBindingYs 應該有 1 或 2 個值,
// 且 paintShaftBinding32 不應該畫到 shaft 之外。
//
// 視覺驗證:用以下 seed 各看一張,觀察 shaft 中央是否有 shadow 色 1 px 條紋:
//   binding-1lines-A:預期 shaft 中央 1 條 shadow
//   binding-2lines-A:預期 shaft 中央 2 條 shadow
//   binding-none-A:預期 shaft 完全乾淨無 binding
//
// (這些 seed 不一定剛好對應 binding 結構,但你可以連看 8-10 張平均會有 ~50% 含 binding,
//  其中 ~50% 是 1 條、~50% 是 2 條)
```

- [ ] **Step 2: 在 `spear.js` `paintHeadShine32` 之後插入 `paintShaftBinding32`**

```js
/**
 * 條件裝飾:shaft binding(纏繩 / 金屬綁帶)。
 * spec.shaftBindingYs 由 sample 階段決定(0、1 或 2 條,y 範圍 [10..23])。
 * 每條 binding 是 1 列 width 3(cols 15..17),shadow 色,gate 為 mask=='shaft'。
 *
 * 經 outline pass 後,binding 在該列實際可見的只有 (cx=16, y) 1 cell
 * (cols 15 / 17 是 outline ring,被 outline pass 改寫)。視覺效果是
 * 「16 列 wood 主色條上點綴 1-2 個 shadow 1×1 像素」,讀為纏繩痕跡。
 */
function paintShaftBinding32(ctx, mask, size, spec) {
  if (!spec.hasShaftBinding) return;
  ctx.fillStyle = WOOD_PALETTE.shadow;
  for (const y of spec.shaftBindingYs) {
    for (let x = 15; x <= 17; x++) {
      if (mask[y * size + x] !== 'shaft') continue;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}
```

- [ ] **Step 3: 在 `renderSpearSpec32` 把 binding 接上(在 shine 之後、seam 之前)**

找到既有:

```js
  // step 3: head shine(always-on)
  paintHeadShine32(ctx, mask, size, spec);

  // TODO Task 6: paintShaftBinding32

  // step 5: internal seam
  paintInternalSeams(ctx, mask, size, spec.palette.outline);
```

改為:

```js
  // step 3: head shine(always-on)
  paintHeadShine32(ctx, mask, size, spec);

  // step 4: shaft binding(條件裝飾)
  paintShaftBinding32(ctx, mask, size, spec);

  // step 5: internal seam
  paintInternalSeams(ctx, mask, size, spec.palette.outline);
```

- [ ] **Step 4: Verify in browser (visual)**

重整 `index.html`,選 type = spear, size = 32。試 8-10 張不同 seed,觀察 batch grid 是否有約半數 spear 在 shaft 中央顯示 1 或 2 個深褐色 1×1 像素點。

可手動測試特定 cases:
1. seed = `bind-test-1`,進 console 跑 `sampleSpearSpec(new SeededRandom('bind-test-1'))`,看是否有 hasShaftBinding=true、shaftBindingYs。如果有,然後在 UI generate 看是否在那個 y 處顯示 shadow 點。

⚠️ 若 binding 跑到 head 或 butt 上,檢查 `mask[...] !== 'shaft'` 檢查邏輯。

⚠️ 若 binding 點看起來「太突出」像「shaft 被切兩段」,可能要參考 spec §11 risk 3 把 WOOD_PALETTE.shadow 從 `#6a4020` 拉淺到 `#7a5028`(這個是 follow-up,本 task 不動)。本輪先用 spec 寫的 `#6a4020`。

- [ ] **Step 5: Commit**

```bash
git add spear.js
git commit -m "feat(spear): shaft binding (32x32 conditional decoration)

paintShaftBinding32 paints 1-2 width-3 shadow rows on shaft per
spec.shaftBindingYs. Mirrors sword's gripWrap idiom — only col 16
survives the outline pass, reading as 1-2px decorative dots on the
wood-colored shaft midline.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: 16×16 archetype shape silhouette 函式

**Files:**
- Modify: `spear.js`(append)

定義 16×16 的 head shape 函式。跟 32×32 一樣是 cells-based。16 layout 高度只有 14 可用列,head 4 行、shaft 8 行、butt 2 行(per spec §6.1)。三個 archetype 在 16 上有適度簡化。

- [ ] **Step 1: 定義驗證目標**

```js
const sShape16 = SPEAR_SHAPE_FNS_16.straight();
const tShape16 = SPEAR_SHAPE_FNS_16.trident();
const hShape16 = SPEAR_SHAPE_FNS_16.hooked();
console.log('16 cells lengths:',
  sShape16.cells.length, tShape16.cells.length, hShape16.cells.length);
// 期望:三者 > 0

// 全部 in bounds 16×16
const allInBounds16 = (shape) => shape.cells.every(({ x, y }) =>
  x >= 0 && x < 16 && y >= 0 && y < 16);
console.log('all in bounds 16:',
  allInBounds16(sShape16), allInBounds16(tShape16), allInBounds16(hShape16));

// straight 16 中軸 cx=8,所有 cell x 應落在 [cx-2..cx+2]=[6..10]
const sX16 = sShape16.cells.map(c => c.x);
console.log('straight 16 x range:', Math.min(...sX16), Math.max(...sX16));
// 期望:6..10

// trident 16 y=1 應有 3 個 prongs 在 cols 6, 8, 10
const tridentY1 = tShape16.cells.filter(c => c.y === 1).map(c => c.x).sort((a,b)=>a-b);
console.log('trident 16 y=1 prongs:', tridentY1);
// 期望:[6, 8, 10]

// hooked 16 y=4 shoulder + hook 應到 col 11(右側 1 px hook)
const hookedY4 = hShape16.cells.filter(c => c.y === 4).map(c => c.x).sort((a,b)=>a-b);
console.log('hooked 16 y=4 cells:', hookedY4);
// 期望:[7, 8, 9, 10, 11]

// 所有 head 都應該在 y=1..4 範圍內(per spec §6.1)
const yIn16 = (shape) => shape.cells.every(c => c.y >= 1 && c.y <= 4);
console.log('all 16 y in [1..4]:', yIn16(sShape16), yIn16(tShape16), yIn16(hShape16));
```

- [ ] **Step 2: 在 `spear.js` `SPEAR_SHAPE_FNS_32` 後面、`buildSpearMask32` 之前插入 16 版 shape 函式**

```js
// =====================================================================
// Shape silhouette functions (16×16) — 子集,專為 16 解析度重新設計(非縮放)
//
// 整體垂直配置(per spec §6.1):
//   y=0      padding
//   y=1..4   head  (4 rows)
//   y=5..12  shaft (8 rows)
//   y=13..14 butt  (2 rows,collapse 成 disc w3)
//   y=15     padding
//
// 中軸 cx=8。
// =====================================================================

function shapeSpearStraight16() {
  // 對稱 leaf:tip 1 + taper 3 + body 5 + shoulder 3
  const cells = [];
  const cx = 8;
  cells.push({ x: cx, y: 1 });             // tip
  spearAddRange(cells, 2, cx - 1, cx + 1); // taper w3
  spearAddRange(cells, 3, cx - 2, cx + 2); // body w5
  spearAddRange(cells, 4, cx - 1, cx + 1); // shoulder w3
  return { cells };
}

function shapeSpearTrident16() {
  // 三叉:prongs 在 cols cx-2, cx, cx+2(間距 2,比 32 版 cols 13,16,19 間距 3 收窄)
  // y=1 prongs → y=2 bridge w5 → y=3 body w5 → y=4 shoulder w3
  const cells = [];
  const cx = 8;
  cells.push({ x: cx - 2, y: 1 });
  cells.push({ x: cx,     y: 1 });
  cells.push({ x: cx + 2, y: 1 });
  spearAddRange(cells, 2, cx - 2, cx + 2); // bridge w5
  spearAddRange(cells, 3, cx - 2, cx + 2); // body w5
  spearAddRange(cells, 4, cx - 1, cx + 1); // shoulder w3
  return { cells };
}

function shapeSpearHooked16() {
  // 鉤矛 16:head 4 行容不下專屬 hook row,改用 shoulder 列向右多 1 col 表 hook
  // tip 1 + taper 3 + body 5 + shoulder + hook (cols 7..11 = w5 偏右)
  const cells = [];
  const cx = 8;
  cells.push({ x: cx, y: 1 });             // tip
  spearAddRange(cells, 2, cx - 1, cx + 1); // taper w3
  spearAddRange(cells, 3, cx - 2, cx + 2); // body w5
  spearAddRange(cells, 4, cx - 1, cx + 3); // shoulder + hook 1 px(右伸到 col 11)
  return { cells };
}

const SPEAR_SHAPE_FNS_16 = {
  straight: shapeSpearStraight16,
  trident:  shapeSpearTrident16,
  hooked:   shapeSpearHooked16,
};
```

- [ ] **Step 3: 加 export**

在檔尾既有 exports 之後加:

```js
window.SPEAR_SHAPE_FNS_16 = SPEAR_SHAPE_FNS_16;
```

- [ ] **Step 4: Verify in browser console**

重整 `index.html`,逐段貼 Step 1 的驗證表達式。注意:
- straight 16 x range 應為 6..10(w5 至 body 那行)
- trident 16 y=1 應為 [6, 8, 10](三點不連續)
- hooked 16 y=4 應為 [7, 8, 9, 10, 11](shoulder 偏右 1 col 表 hook)

- [ ] **Step 5: Commit**

```bash
git add spear.js
git commit -m "feat(spear): add 16x16 archetype shape silhouettes

shapeSpearStraight16 / Trident16 / Hooked16 emit 4-row head outlines.
Trident 16 narrows prong spacing from 3 to 2 cols (cols 6/8/10).
Hooked 16 has no dedicated hook row, expresses asymmetry via shoulder
extending 1 col right (col 11).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: 16×16 `buildSpearMask16` + `renderSpearSpec16` + 16 shine

**Files:**
- Modify: `spear.js`

實作 16 版 mask builder 與 renderer,包含 16 collapse 規則(buttStyle 全 collapse 為 disc、`hasShaftBinding` 不畫)。Shine 16 也一併加。

- [ ] **Step 1: 定義驗證目標**

```js
// buildSpearMask16 結構
const r1 = new SeededRandom('mask16-test');
const spec1 = sampleSpearSpec(r1);
spec1.archetype = 'straight';
const m16 = buildSpearMask16(spec1);
console.log('mask16 length:', m16.length);
// 期望:256

const counts16 = { head: 0, shaft: 0, butt: 0, null: 0 };
for (const v of m16) counts16[v ?? 'null']++;
console.log(counts16);
// 期望(straight):
//   head ≈ 12(straight head cells:1+3+5+3=12)
//   shaft = 8 rows × 3 cols = 24
//   butt = 2 rows × 3 cols = 6(disc collapse)
//   null = 256 - (12+24+6) = 214

// 16 collapse:不論 spec.buttStyle 是 disc/sphere/spike,mask16 的 butt 都應該是 w3 × 2
const specsphere = { ...spec1, buttStyle: 'sphere' };
const specspike  = { ...spec1, buttStyle: 'spike' };
const buttCells = (mask) => {
  let n = 0;
  for (let y = 13; y <= 14; y++)
    for (let x = 7; x <= 9; x++)
      if (mask[y * 16 + x] === 'butt') n++;
  return n;
};
console.log('butt cells (collapse check):',
  buttCells(buildSpearMask16(spec1)),
  buttCells(buildSpearMask16(specsphere)),
  buttCells(buildSpearMask16(specspike)));
// 期望:三者都 6(2 rows × 3 cols)

// 視覺驗證
// 在 index.html UI:type = spear,size = 16,seed = "spear16-vis-1"
// 預期看到一支縮小版 spear:細的 head + 6 px wood 中央線 + 黑色 butt 蓋,
// 全身 outline 連續。換不同 seed,head archetype 應該會變化(三叉 / 鉤 / 直)。
// 不會有 shaft binding(per spec §6.5)。
```

- [ ] **Step 2: 在 `spear.js` `paintShaftBinding32` 之後插入 `buildSpearMask16` + `renderSpearSpec16` + `paintHeadShine16` + `tryPaintHeadCell16`**

```js
// =====================================================================
// Mask builder (16×16) — 共用 spec,但 16 collapse 規則內部處理
//
// 16 collapse(per spec §6.4):
//   buttStyle 'sphere' / 'spike' → 全部 collapse 成 'disc' 同形(w3 × 2 行)
// 不污染 spec(spec 仍標 sphere / spike)。
// =====================================================================

function buildSpearMask16(spec) {
  const size = 16;
  const mask = allocateMask(size);

  // ── Head ──
  const { cells } = SPEAR_SHAPE_FNS_16[spec.archetype]();
  for (const { x, y } of cells) {
    maskSet(mask, size, x, y, 'head');
  }

  // ── Shaft (y=5..12, width 3, cols 7..9) ──
  for (let y = 5; y <= 12; y++) {
    for (let x = 7; x <= 9; x++) {
      maskSet(mask, size, x, y, 'shaft');
    }
  }

  // ── Butt (y=13..14, 全 collapse 成 disc w3) ──
  // 16 上 butt 2 行 + outline pass 後沒有 interior cell 顯示金屬色,
  // sphere / spike vs disc 在外形差異不可能讀出,故統一一個形狀。
  for (let y = 13; y <= 14; y++) {
    for (let x = 7; x <= 9; x++) {
      maskSet(mask, size, x, y, 'butt');
    }
  }

  return mask;
}

// =====================================================================
// 16 paint helpers
// =====================================================================

/** 16 版 head cell gate(同 32 版邏輯,不同 size) */
function tryPaintHeadCell16(ctx, mask, size, x, y) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  if (mask[y * size + x] !== 'head') return;
  ctx.fillRect(x, y, 1, 1);
}

/**
 * 16 head shine — 壓縮成 1 px。
 * 三個 archetype 都在 y=3 col cx-1=7 畫 1 px,因 16 head 4 行裡只有 y=3 body 列
 * 在 col 7 是 interior;y=2 col 7 上鄰是 null/edge 會被 outline 蓋掉。
 */
function paintHeadShine16(ctx, mask, size, spec) {
  ctx.fillStyle = spec.palette.headShine;
  const cx = 8;
  tryPaintHeadCell16(ctx, mask, size, cx - 1, 3);
}

// =====================================================================
// Renderer (16×16)
//
// 16 不畫 hasShaftBinding(per spec §6.5)。
// =====================================================================

function renderSpearSpec16(ctx, spec) {
  const size = 16;
  ctx.clearRect(0, 0, size, size);

  const mask = buildSpearMask16(spec);

  // step 2: 平鋪主色
  paintMaskByEnum(ctx, mask, size, {
    head:  spec.palette.headMain,
    shaft: WOOD_PALETTE.main,
    butt:  spec.palette.headMain,
  });

  // step 3: head shine
  paintHeadShine16(ctx, mask, size, spec);

  // 16 不畫 paintShaftBinding(per spec §6.5)

  // step 5: internal seam
  paintInternalSeams(ctx, mask, size, spec.palette.outline);
  // step 6: 外圈 outline
  applyInsideOutlinePass(ctx, mask, size, spec.palette.outline);
}
```

- [ ] **Step 3: 把 `drawSpearV2Impl` 的 `size===16` 分支接到 `renderSpearSpec16`**

找到既有(Task 4 寫的):

```js
function drawSpearV2Impl(ctx, rng, size) {
  const spec = sampleSpearSpec(rng);
  if (size === 32) renderSpearSpec32(ctx, spec);
  // TODO Task 8: 16×16
}
```

改成:

```js
function drawSpearV2Impl(ctx, rng, size) {
  const spec = sampleSpearSpec(rng);
  if (size === 32) renderSpearSpec32(ctx, spec);
  else if (size === 16) renderSpearSpec16(ctx, spec);
}
```

- [ ] **Step 4: 加 export**

在檔尾既有 exports 之後加:

```js
window.buildSpearMask16 = buildSpearMask16;
window.renderSpearSpec16 = renderSpearSpec16;
```

- [ ] **Step 5: Verify in browser**

重整 `index.html`,console 跑 Step 1 的 mask + collapse 驗證。

然後 visual:
1. 選 type = spear,size = 16
2. seed = `spear16-vis-1`,點 Generate
3. 應該看到放大顯示的 16×16 spear:細 head + 約 1 px wood 中央線 + 2 行黑色 butt + outline 連續

換 4-5 種 seed,觀察:
- ✓ 三個 archetype 都能讀(straight 對稱、trident 三叉、hooked 右側 1 px hook)
- ✓ shaft 中央 wood 主色顯示為 1 px 直線
- ✓ butt 是黑色 silhouette(無 interior cell — collapse 預期)
- ✗ 不應該有 shaft binding

特別檢查 hooked 16:右側 col 11 的 1 px hook 是否清楚可讀(若不清楚,參考 spec §11 risk 6 的 fallback 在後續迭代調整,本輪保持 spec 設計)。

- [ ] **Step 6: Commit**

```bash
git add spear.js
git commit -m "feat(spear): 16x16 mask + render + shine (with collapse rules)

buildSpearMask16 produces head/shaft/butt mask. ButtStyle is collapsed
to disc (w3 × 2 rows) for all three styles since 2-row butts have no
interior cells visible at 16x16. paintHeadShine16 paints a single
1px highlight at (cx-1, y=3). hasShaftBinding is dropped at 16
matching sword/gripWrap precedent.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: 接上 main.js — 移除 stub、整合 spear.js 對外名稱

**Files:**
- Modify: `main.js`(刪 drawSpear stub、改 ITEM_TYPES.spear)
- Modify: `spear.js`(把 `window.drawSpearV2` 改成 `window.drawSpear`)

把 build-time 的 `drawSpearV2` 別名清掉,讓 spear.js 以 `drawSpear` 對外。同時把 main.js 裡的占位 stub 整段刪除。

- [ ] **Step 1: 定義驗證目標**

```js
// 應該存在 window.drawSpear,且不再存在 drawSpearV2
console.log(typeof window.drawSpear, typeof window.drawSpearV2);
// 期望:'function' 'undefined'

// 對外契約:drawSpear(ctx, rng, size) 回傳 undefined,把 spec render 到 ctx
const c = document.createElement('canvas');
c.width = c.height = 32;
const cx = c.getContext('2d');
const result = drawSpear(cx, new SeededRandom('contract-test'), 32);
console.log('drawSpear returns:', result);
// 期望:undefined

// ITEM_TYPES.spear 直接走新版
console.log(ITEM_TYPES.spear === drawSpear);
// 期望:true

// 視覺:UI 上選 spear 應該還能 render(無 regression)
// 連看 8-10 張 random seed,應該每張都跟 Task 6 結束時看到的一模一樣
// (因 sampler / renderer 沒改,只是改了名字)
```

- [ ] **Step 2: 在 `spear.js` 把 `drawSpearV2` 別名清掉**

找到既有:

```js
function drawSpearV2Impl(ctx, rng, size) {
  const spec = sampleSpearSpec(rng);
  if (size === 32) renderSpearSpec32(ctx, spec);
  else if (size === 16) renderSpearSpec16(ctx, spec);
}

window.sampleSpearSpec = sampleSpearSpec;
window.drawSpearV2 = drawSpearV2Impl;
```

改成:

```js
function drawSpearImpl(ctx, rng, size) {
  const spec = sampleSpearSpec(rng);
  if (size === 32) renderSpearSpec32(ctx, spec);
  else if (size === 16) renderSpearSpec16(ctx, spec);
}

window.sampleSpearSpec = sampleSpearSpec;
window.drawSpear = drawSpearImpl;
```

注意:檔尾還有其他 debug exports(`SPEAR_SHAPE_FNS_32` 等),那些保留不動。

- [ ] **Step 3: 在 `main.js` 移除 `drawSpear` 占位 stub**

找到 `main.js` 裡的:

```js
// =============================================================
// 繪圖函式 stub —— 第二步再來填充細節
// 目前先畫個簡單的色塊讓整個流程能跑起來
// =============================================================

function drawSpear(ctx, rng, size) {
  // 暫時的占位:中央畫一支長矛
  const headColors = ['#d8d8e8', '#c8b070', '#a8a0c8'];
  const head = rng.pick(headColors);
  const cx = Math.floor(size / 2);

  // 矛頭(三角形)
  fillRect(ctx, cx, 1, 1, 1, '#1a1a2e');
  fillRect(ctx, cx - 1, 2, 3, 1, head);
  ...
}
```

整段(包含上面註解區塊)刪除。

- [ ] **Step 4: 在 `main.js` 把 ITEM_TYPES.spear 從 drawSpearV2 改回 drawSpear**

找到 Task 4 留下的暫時改動:

```js
const ITEM_TYPES = {
  potion: drawPotion,
  sword: drawSword,
  spear: drawSpearV2,    // TEMPORARY: Task 9 will swap back to drawSpear
};
```

改回:

```js
const ITEM_TYPES = {
  potion: drawPotion,
  sword: drawSword,
  spear: drawSpear,
};
```

- [ ] **Step 5: Verify in browser**

重整 `index.html`,F12 console。逐段驗證 Step 1 的契約。

特別注意:`typeof window.drawSpearV2` 必須是 `'undefined'`,否則代表別名沒清乾淨,日後重新命名會踩坑。

Visual:UI 上選 spear,連看 8 張 random seed batch,每張應該跟 Task 6 / 8 結束時看到的一模一樣(底層 sampler/renderer 完全沒改)。

- [ ] **Step 6: Commit**

```bash
git add spear.js main.js
git commit -m "feat(spear): replace main.js stub with spear.js drawSpear

Drops the temporary drawSpearV2 alias and routes ITEM_TYPES.spear
to spear.js's drawSpearImpl. Removes the 25-line drawSpear stub
in main.js. Public contract drawSpear(ctx, rng, size) unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: 擴充 `regression.html` — 加 spear section + 整合下載

**Files:**
- Modify: `regression.html`

把 visual regression grid 從 potion + sword 兩 section 擴成三 section(potion + sword + spear)。下載按鈕的 collected list 一次涵蓋三種物品。

- [ ] **Step 1: 定義驗證目標**

```html
<!-- 預期 regression.html 載入後看到三個 grid:potion / sword / spear -->
<!-- spear grid 至少 16 行(seed),每行有:seed / family / archetype / butt / binding tag / 32×32 / 16×16 -->
<!-- 點「下載拼接 PNG」應該得到一個高度 ≈ (16+16+16)*36 = 1728 的 png(三種物品堆疊) -->
<!-- 點「下載 specs.json」應該包含 kind: 'potion' / 'sword' / 'spear' 三種 entry -->
```

- [ ] **Step 2: 在 `regression.html` 加 `<script src="spear.js">`**

找到:

```html
<script src="random.js"></script>
<script src="palette.js"></script>
<script src="pixel-utils.js"></script>
<script src="potion.js"></script>
<script src="sword.js"></script>
```

在 sword.js 之後加:

```html
<script src="random.js"></script>
<script src="palette.js"></script>
<script src="pixel-utils.js"></script>
<script src="potion.js"></script>
<script src="sword.js"></script>
<script src="spear.js"></script>
```

- [ ] **Step 3: 在 `regression.html` body 加 spear h2 + table**

找到:

```html
  <h2>// drawPotion</h2>
  <table id="grid-potion"></table>

  <h2>// drawSword</h2>
  <table id="grid-sword"></table>

  <script src="random.js"></script>
```

在 sword table 後加 spear:

```html
  <h2>// drawPotion</h2>
  <table id="grid-potion"></table>

  <h2>// drawSword</h2>
  <table id="grid-sword"></table>

  <h2>// drawSpear</h2>
  <table id="grid-spear"></table>

  <script src="random.js"></script>
```

- [ ] **Step 4: 在 inline `<script>` 裡加 `SPEAR_SEEDS` const(在既有 `SWORD_SEEDS` 後面)**

找到:

```js
const SWORD_SEEDS = [
  'metal-steel-1', 'metal-iron-1', 'metal-bronze-1', 'metal-gold-1', 'metal-obsidian-1',
  'arch-straight-1', 'arch-curved-1', 'arch-broad-1',
  'guard-bar-1', 'guard-swept-1', 'guard-disc-1',
  'pommel-round-1', 'pommel-disk-1', 'pommel-gem-1',
  'edge-fuller-broad', 'edge-wrap-2lines',
];

const collectedPotion = [];
const collectedSword = [];
```

在 SWORD_SEEDS 後加 SPEAR_SEEDS,並在 `collectedSword` 後加 `collectedSpear`:

```js
const SWORD_SEEDS = [
  'metal-steel-1', 'metal-iron-1', 'metal-bronze-1', 'metal-gold-1', 'metal-obsidian-1',
  'arch-straight-1', 'arch-curved-1', 'arch-broad-1',
  'guard-bar-1', 'guard-swept-1', 'guard-disc-1',
  'pommel-round-1', 'pommel-disk-1', 'pommel-gem-1',
  'edge-fuller-broad', 'edge-wrap-2lines',
];

// spear baseline:涵蓋 5 個金屬族 + 3 archetype + 3 buttStyle + hasShaftBinding edge cases
const SPEAR_SEEDS = [
  'sp-metal-steel-1', 'sp-metal-iron-1', 'sp-metal-bronze-1', 'sp-metal-gold-1', 'sp-metal-obsidian-1',
  'sp-arch-straight-1', 'sp-arch-trident-1', 'sp-arch-hooked-1',
  'sp-butt-disc-1', 'sp-butt-sphere-1', 'sp-butt-spike-1',
  'sp-edge-binding-2lines', 'sp-edge-binding-1line', 'sp-edge-no-binding',
  'sp-edge-trident-gold', 'sp-edge-hooked-bronze',
];

const collectedPotion = [];
const collectedSword = [];
const collectedSpear = [];
```

- [ ] **Step 5: 在 sword grid render block 之後加 spear grid render block**

找到:

```js
    // ============================================================
    // Render sword grid
    // ============================================================
    {
      const grid = document.getElementById('grid-sword');
      ...
      collectedSword.push({ kind: 'sword', seed, spec, c32, c16 });
    }
}
```

在它後面(跟 download buttons 之間)插入:

```js
    // ============================================================
    // Render spear grid
    // ============================================================
    {
      const grid = document.getElementById('grid-spear');
      const headerRow = document.createElement('tr');
      headerRow.innerHTML = '<th>seed</th><th>family</th><th>archetype</th><th>butt</th><th>binding</th><th>32×32</th><th>16×16</th>';
      grid.appendChild(headerRow);

      for (const seed of SPEAR_SEEDS) {
        const rng = new SeededRandom(seed);
        const spec = sampleSpearSpec(rng);

        const c32 = document.createElement('canvas');
        c32.width = 32; c32.height = 32; c32.style.width = '64px'; c32.style.height = '64px';
        renderSpearSpec32(c32.getContext('2d'), spec);

        const c16 = document.createElement('canvas');
        c16.width = 16; c16.height = 16; c16.style.width = '64px'; c16.style.height = '64px';
        renderSpearSpec16(c16.getContext('2d'), spec);

        const bindingTag = spec.hasShaftBinding ? 'B' + spec.shaftBindingYs.length : '--';

        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${seed}</td><td>${spec.family}</td><td>${spec.archetype}</td><td>${spec.buttStyle}</td><td>${bindingTag}</td>`;
        const td32 = document.createElement('td'); td32.appendChild(c32); tr.appendChild(td32);
        const td16 = document.createElement('td'); td16.appendChild(c16); tr.appendChild(td16);
        grid.appendChild(tr);

        collectedSpear.push({ kind: 'spear', seed, spec, c32, c16 });
      }
    }
```

- [ ] **Step 6: 改下載按鈕,把 spear 也涵蓋進去**

找到既有 download PNG handler:

```js
    document.getElementById('dl-png').addEventListener('click', () => {
      const all = [...collectedPotion, ...collectedSword];
      ...
    });
```

把 `collectedSpear` 加入:

```js
    document.getElementById('dl-png').addEventListener('click', () => {
      const all = [...collectedPotion, ...collectedSword, ...collectedSpear];
      const cellW = 32, cellH = 32;
      const composite = document.createElement('canvas');
      composite.width = cellW + 4 + cellW;
      composite.height = (cellH + 4) * all.length;
      const cx = composite.getContext('2d');
      cx.imageSmoothingEnabled = false;
      cx.fillStyle = '#1a1a26';
      cx.fillRect(0, 0, composite.width, composite.height);
      for (let i = 0; i < all.length; i++) {
        const { c32, c16 } = all[i];
        const y = i * (cellH + 4);
        cx.drawImage(c32, 0, y);
        cx.drawImage(c16, cellW + 4, y, cellH, cellH);
      }
      const a = document.createElement('a');
      a.download = 'regression-baseline.png';
      a.href = composite.toDataURL('image/png');
      a.click();
    });
```

同樣改 JSON handler:

```js
    document.getElementById('dl-json').addEventListener('click', () => {
      const dump = [
        ...collectedPotion.map(({ kind, seed, spec }) => ({ kind, seed, spec })),
        ...collectedSword.map(({ kind, seed, spec }) => ({ kind, seed, spec })),
        ...collectedSpear.map(({ kind, seed, spec }) => ({ kind, seed, spec })),
      ];
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.download = 'regression-specs.json';
      a.href = URL.createObjectURL(blob);
      a.click();
    });
```

- [ ] **Step 7: Verify in browser**

打開 `regression.html`,應該看到三個 section(potion / sword / spear),每個 section 一個 table。Spear section 應該有 16 行(SPEAR_SEEDS 16 個)。

每張 spear 的:
- 32×32 應顯示完整圖示(head + shaft + butt + outline + shine + 可能 binding)
- 16×16 應顯示縮小版(head + shaft + butt 黑 + outline + shine,無 binding)

點「下載拼接 PNG」,應該下載到 `regression-baseline.png` ,看 PNG 應該包含 16 + 16 + 16 = 48 行(potion + sword + spear stacked)。

點「下載 specs.json」,應該下載到 `regression-specs.json`。打開檢查:
- 應該是 array,長度 48
- entry 0..15 是 `kind: 'potion'`
- entry 16..31 是 `kind: 'sword'`
- entry 32..47 是 `kind: 'spear'`,且 spec 裡有 archetype / buttStyle / hasShaftBinding 等欄位

- [ ] **Step 8: Commit**

```bash
git add regression.html
git commit -m "feat(regression): add spear section + integrate downloads

Adds a 16-seed spear grid covering 5 metal families × 3 archetypes ×
3 butt styles + hasShaftBinding edge cases. Download PNG and JSON
buttons now span all three item types.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Final Verification(全部 task 完成後)

打開 `regression.html`,確認:

- [ ] 三個 section 都顯示完整(potion 16 + sword 16 + spear 16,各 16 行)
- [ ] 每張 spear 32×32:head + shaft + butt + outline 都閉合,head 上有 shine,可能有 1-2 px shaft binding
- [ ] 每張 spear 16×16:head + shaft 中央 wood 線 + 黑 butt + 1 px shine,無 binding
- [ ] 點「下載拼接 PNG」可下載 `regression-baseline.png`,長度 48 行
- [ ] 點「下載 specs.json」可下載 `regression-specs.json`,有三種 kind

打開 `index.html`,確認:

- [ ] type = spear,size = 32 / 16 都能 render 完整 spear
- [ ] type = any 時 spear 也會輪到出現
- [ ] 同 seed 永遠重現同 spec(連續按 reroll → 輸入舊 seed → 結果一致)

Console 確認:

- [ ] `typeof window.drawSpearV2 === 'undefined'`(別名清乾淨)
- [ ] `typeof window.drawSpear === 'function'`
- [ ] `ITEM_TYPES.spear === drawSpear`(對外契約)

如果發現任何 regression(sword 或 potion render 變調),代表 spear.js 的某個 const / function 撞了既有 file,檢查 SPEAR_ 前綴 / Spear 中綴規則(spec §9 / 本 plan project notes)。

---

## Out of Scope(per spec §1 非目標 + §12 後續鉤子,本 plan 明確不做)

- 矛頭魔法光暈 / 粒子 / 外圈 glow
- partisan / winged spear 的 cross-piece(需要 4-part mask)
- 其他 polearm 變體(halberd / glaive / poleaxe)
- 稀有度 tier
- 附魔矛 / magical tinted heads
- `hasHeadRidge`(類比 sword `hasFuller`)
- `paintShaftShine`
- Sword + spear 共用 `sampleMetalPalette` 的 refactor
- 16 復活 `hasShaftBinding`
- 視覺迴歸後對 `WOOD_PALETTE.shadow` / `obsidian` lightCenter 的微調(per spec §11 risks 1, 3 — 本 plan 先按 spec 寫死,實作後若視覺迴歸發現問題再開 follow-up commit)
