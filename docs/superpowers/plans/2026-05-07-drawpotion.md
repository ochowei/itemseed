# drawPotion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `drawPotion` 從占位升級為 spec→render 兩階段的程序化規則,產出隨 seed 變化、像 RPG 道具的 32×32(主)/ 16×16(子集)藥水圖示。

**Architecture:** 兩階段:`samplePotionSpec(rng)` 把所有 RNG 集中在 sample 階段輸出純資料 spec;`renderPotionSpec32` / `renderPotionSpec16` 是純函式,把 spec 渲染為像素。內部用 single enum mask 做形狀記錄,所有 outline 透過 inside-edge pass 演算法保證連續。

**Tech Stack:** vanilla JS、HTML5 Canvas 2D、無 build tool、無 npm、無 test framework。

**Spec:** [`docs/superpowers/specs/2026-05-07-drawpotion-design.md`](../specs/2026-05-07-drawpotion-design.md)

---

## Project-Specific Notes

**No git repo:** 此專案目前不是 git repository。所有任務最後一步原本應該是 `git commit`,改為「**Pause for review**」(把當下狀態交給 user 看一眼)。如未來 `git init`,把每個 pause 點換成 commit 即可。

**No test framework:** 不引入任何 test 框架。驗證方式分兩類:
1. **Console-based**(資料/純函式):打開 `index.html`,F12 開 devtools,在 Console 貼指定表達式,比對輸出。
2. **Visual**(渲染結果):在 `index.html` 介面輸入指定 seed → 點 Generate → 用眼睛比對是否符合描述。

每個任務的 verify 步驟會明確說是哪一種、要看什麼。

**File loading order:** `index.html` 會用一連串 `<script src=...>` 依序載入。任何新檔案必須加進 `index.html`,且順序要在它的依賴後面。後面 Task 會明確列出順序。

**Hard constraints(任何 task 都不能違反):**
- 所有座標 / 寬 / 高為整數
- 每張圖示主視覺色 ≤ 5(outline + liquidMain + liquidShadow + highlight + cap-main)
- 暗色描邊全身連續(由 `applyInsideOutlinePass` 演算法保證)

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `random.js` | unchanged | seeded PRNG (mulberry32 + cyrb53-ish hash) |
| `palette.js` | **NEW** | `FAMILIES` 表、`samplePalette`、`hslToRgbHex`、`CORK_PALETTE` 常數 |
| `pixel-utils.js` | **NEW** | `fillRect`、enum mask helpers、`applyInsideOutlinePass`、`paintInternalSeams` |
| `potion.js` | **NEW** | `samplePotionSpec`、`renderPotionSpec32`、`renderPotionSpec16`、所有 paint helpers、shape silhouette 函式、對外 `drawPotion` |
| `main.js` | **MODIFY** | 移除 `drawPotion` stub;移除 `fillRect`(改由 pixel-utils 提供);`ITEM_TYPES` 改指向 potion.js 的 `drawPotion`。其餘流程不動 |
| `index.html` | **MODIFY** | `<script>` 載入順序改為 `random.js → palette.js → pixel-utils.js → potion.js → main.js` |
| `regression.html` | **NEW** | 視覺迴歸頁:hardcode ~16 個 seed,渲染 32+16 grid,提供 PNG 拼接下載 + specs.json 下載 |

`drawSword` 與 `drawSpear` 在 `main.js` 維持不動。

---

## Task 1: 建立 `palette.js`(色族 + sampler + HSL→Hex + CORK)

**Files:**
- Create: `palette.js`
- Modify: `index.html`(加 script tag)

- [ ] **Step 1: 定義驗證目標**

預期能在 console 跑出:
```js
const r = new SeededRandom('test-1');
samplePalette(r)
// → 回傳 { family: 'fire', palette: { outline:'#...', glassBody:'#...', liquidMain:'#...', liquidShadow:'#...', highlight:'#...' } }
// 全部 6 色都是 7-char #RRGGBB 字串

const r2 = new SeededRandom('test-1');
const a = samplePalette(r2);
const r3 = new SeededRandom('test-1');
const b = samplePalette(r3);
JSON.stringify(a) === JSON.stringify(b)  // → true(同 seed 重現)
```

- [ ] **Step 2: 建立 `palette.js`**

完整檔案內容:

```js
// palette.js
// 色族表 + palette sampler + HSL→Hex + cork 常數。
// 所有顏色都是 7-char #RRGGBB 字串(canvas fillStyle 友善)。

const FAMILIES = {
  fire:   { hue: [0, 20],    sat: [70, 90], lightCenter: 50, weight: 1 },
  frost:  { hue: [185, 215], sat: [55, 75], lightCenter: 55, weight: 1 },
  mana:   { hue: [240, 270], sat: [60, 80], lightCenter: 50, weight: 1 },
  poison: { hue: [80, 110],  sat: [60, 85], lightCenter: 45, weight: 1 },
  golden: { hue: [40, 55],   sat: [75, 90], lightCenter: 55, weight: 1 },
  shadow: { hue: [280, 320], sat: [40, 60], lightCenter: 35, weight: 1 },
};

const CORK_PALETTE = {
  main:      '#8a5a2e',
  shadow:    '#5a3a1e',
  highlight: '#b88560',
};

/** HSL (h:0-360, s:0-100, l:0-100) → '#RRGGBB' */
function hslToRgbHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0, g1 = 0, b1 = 0;
  if (hp < 1)      { r1 = c; g1 = x; b1 = 0; }
  else if (hp < 2) { r1 = x; g1 = c; b1 = 0; }
  else if (hp < 3) { r1 = 0; g1 = c; b1 = x; }
  else if (hp < 4) { r1 = 0; g1 = x; b1 = c; }
  else if (hp < 5) { r1 = x; g1 = 0; b1 = c; }
  else             { r1 = c; g1 = 0; b1 = x; }
  const m = l - c / 2;
  const r = Math.round((r1 + m) * 255);
  const g = Math.round((g1 + m) * 255);
  const b = Math.round((b1 + m) * 255);
  const toHex = (n) => n.toString(16).padStart(2, '0');
  return '#' + toHex(r) + toHex(g) + toHex(b);
}

/**
 * 從 RNG 抽一個色族並推導 5 色 palette。
 * @returns {{ family: string, palette: { outline, glassBody, liquidMain, liquidShadow, highlight } }}
 */
function samplePalette(rng) {
  const names = Object.keys(FAMILIES);
  const weights = names.map((n) => FAMILIES[n].weight);
  const familyName = rng.pickWeighted(names, weights);
  const fam = FAMILIES[familyName];

  const h = rng.randomFloat(fam.hue[0], fam.hue[1]);
  const s = rng.randomFloat(fam.sat[0], fam.sat[1]);
  const L = fam.lightCenter;

  return {
    family: familyName,
    palette: {
      outline:      hslToRgbHex(h, 50, 12),
      glassBody:    hslToRgbHex(h, Math.max(0, s - 30), L + 10),
      liquidMain:   hslToRgbHex(h, s, L),
      liquidShadow: hslToRgbHex(h, Math.min(100, s + 10), Math.max(0, L - 15)),
      highlight:    hslToRgbHex(h + 10, Math.max(0, s - 15), 80),
    },
  };
}

window.FAMILIES = FAMILIES;
window.CORK_PALETTE = CORK_PALETTE;
window.samplePalette = samplePalette;
window.hslToRgbHex = hslToRgbHex;
```

- [ ] **Step 3: 在 `index.html` 加 script tag**

找到檔案末端的:
```html
<script src="random.js"></script>
<script src="main.js"></script>
```

改成:
```html
<script src="random.js"></script>
<script src="palette.js"></script>
<script src="main.js"></script>
```

- [ ] **Step 4: 驗證**

在瀏覽器打開 `index.html`,F12 開 console 貼:

```js
const r1 = new SeededRandom('test-1');
const a = samplePalette(r1);
console.log(a);

const r2 = new SeededRandom('test-1');
const b = samplePalette(r2);
console.log('reproducible:', JSON.stringify(a) === JSON.stringify(b));

// 驗證 6 個色族都至少抽得到
const seen = new Set();
for (let i = 0; i < 50; i++) {
  seen.add(samplePalette(new SeededRandom('seed-' + i)).family);
}
console.log('families seen:', [...seen]);  // 期望:6 個都出現
```

期望輸出:
- `a` 物件含 `family` + `palette`(5 色 #RRGGBB)
- `reproducible: true`
- `families seen` 包含全部 6 個族名(`fire / frost / mana / poison / golden / shadow`)

- [ ] **Step 5: Pause for review**

跟 user 說:「Task 1 完成,palette.js 跑起來了。請打開 index.html 在 console 跑上面的驗證腳本,確認看到 6 個色族都出現、reproducible: true。」

---

## Task 2: 建立 `pixel-utils.js`(mask + outline pass + seam pass + fillRect)

**Files:**
- Create: `pixel-utils.js`
- Modify: `index.html`(加 script tag)

- [ ] **Step 1: 定義驗證目標**

預期能在 console 跑出(以下用一個臨時 canvas):

```js
// 1. allocateMask 能建立 size*size 的 enum 陣列
const m = allocateMask(8);
m.length === 64 && m.every((v) => v === null)  // → true

// 2. paintMaskByEnum 把 mask 中所有 'glass' cell 塗成藍色
const c = document.createElement('canvas');
c.width = 8; c.height = 8;
const cx = c.getContext('2d');
m[0] = 'glass'; m[1] = 'glass'; m[8] = 'glass';
paintMaskByEnum(cx, m, 8, { glass: '#3399ff' });
// 視覺驗證:左上 L 形變成藍色

// 3. applyInsideOutlinePass 在實心方塊外圍咬掉一圈變描邊
// (在純藍 4x4 方塊上跑後,最外圈藍 → 黑,內層 2x2 仍藍)
```

- [ ] **Step 2: 建立 `pixel-utils.js`**

完整檔案內容:

```js
// pixel-utils.js
// 像素級工具:fillRect、enum mask helpers、inside-edge outline pass、internal seam pass。

/** 整數 fillRect(從 main.js 搬來,集中工具) */
function fillRect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/**
 * 建立 size×size 的 enum mask(扁平陣列,長度 size*size,index = y*size + x)。
 * 初始全為 null(代表透明/圖示外部)。
 */
function allocateMask(size) {
  const m = new Array(size * size);
  for (let i = 0; i < m.length; i++) m[i] = null;
  return m;
}

function maskGet(mask, size, x, y) {
  if (x < 0 || y < 0 || x >= size || y >= size) return null;
  return mask[y * size + x];
}

function maskSet(mask, size, x, y, v) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  mask[y * size + x] = v;
}

/**
 * 依照 mask 把每個非 null cell 用對應顏色填到 ctx 上。
 * @param colorByEnum  {[enumValue]: '#RRGGBB'} — 沒出現的 enum 不畫。
 */
function paintMaskByEnum(ctx, mask, size, colorByEnum) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = mask[y * size + x];
      if (v == null) continue;
      const color = colorByEnum[v];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

/**
 * Inside-edge outline pass:
 * 找出所有「自己非 null,且至少一個 4-鄰居是 null」的 mask cell,
 * 在 canvas 上把它塗成 outlineColor。
 * 不修改 mask(避免影響後續 seam pass)。
 *
 * @returns 修改的 cell 數(debug 用)
 */
function applyInsideOutlinePass(ctx, mask, size, outlineColor) {
  let count = 0;
  ctx.fillStyle = outlineColor;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (mask[y * size + x] == null) continue;
      const up    = maskGet(mask, size, x,     y - 1);
      const down  = maskGet(mask, size, x,     y + 1);
      const left  = maskGet(mask, size, x - 1, y);
      const right = maskGet(mask, size, x + 1, y);
      if (up == null || down == null || left == null || right == null) {
        ctx.fillRect(x, y, 1, 1);
        count++;
      }
    }
  }
  return count;
}

/**
 * Internal seam pass:
 * 找出所有「自己非 null,且至少一個 4-鄰居有不同的非 null 標籤」的 cell,
 * 塗成 outlineColor。讓元件之間的接縫也有描邊(例如瓶塞/瓶頸交界)。
 *
 * 注意:呼叫順序應在 inside-edge pass 之前(否則被 outline 改寫的 cell 會干擾判斷)。
 * 但因為兩個 pass 都讀 mask、寫 canvas,mask 本身不變,所以順序其實不影響結果 —
 * 我們選擇「seam pass 在 outline pass 之前」純為語意清楚。
 */
function paintInternalSeams(ctx, mask, size, outlineColor) {
  ctx.fillStyle = outlineColor;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const self = mask[y * size + x];
      if (self == null) continue;
      const neighbors = [
        maskGet(mask, size, x,     y - 1),
        maskGet(mask, size, x,     y + 1),
        maskGet(mask, size, x - 1, y),
        maskGet(mask, size, x + 1, y),
      ];
      for (const n of neighbors) {
        if (n != null && n !== self) {
          ctx.fillRect(x, y, 1, 1);
          break;
        }
      }
    }
  }
}

window.fillRect = fillRect;
window.allocateMask = allocateMask;
window.maskGet = maskGet;
window.maskSet = maskSet;
window.paintMaskByEnum = paintMaskByEnum;
window.applyInsideOutlinePass = applyInsideOutlinePass;
window.paintInternalSeams = paintInternalSeams;
```

- [ ] **Step 3: 在 `index.html` 加 script tag**

把 script 區改成(palette 之後、main 之前):
```html
<script src="random.js"></script>
<script src="palette.js"></script>
<script src="pixel-utils.js"></script>
<script src="main.js"></script>
```

- [ ] **Step 4: 驗證 — outline pass 對實心方塊的行為**

打開 `index.html` console 貼:

```js
// 建立一個 8x8 mask,中間 4x4 全是 'glass'
const size = 8;
const mask = allocateMask(size);
for (let y = 2; y < 6; y++)
  for (let x = 2; x < 6; x++)
    maskSet(mask, size, x, y, 'glass');

// 畫到一個臨時 canvas,放大顯示
const c = document.createElement('canvas');
c.width = size; c.height = size;
const cx = c.getContext('2d');

paintMaskByEnum(cx, mask, size, { glass: '#3399ff' });
applyInsideOutlinePass(cx, mask, size, '#000000');

// 把結果用 dataURL 印出來看
console.log('outline test:', c.toDataURL());

// 把 dataURL 貼進新分頁,用瀏覽器放大檢視:
// 期望:4x4 區域,最外圈 12 個 cell 是黑色,中間 2x2 仍是藍色
```

期望:dataURL 開出來放大後,看到一個外黑內藍的方塊輪廓。

- [ ] **Step 5: 驗證 — seam pass 對兩種標籤交界的行為**

console 接著貼:

```js
const size2 = 8;
const mask2 = allocateMask(size2);
// 上半 4x4 是 'glass',下半 4x4 是 'liquid'
for (let y = 2; y < 4; y++)
  for (let x = 2; x < 6; x++)
    maskSet(mask2, size2, x, y, 'glass');
for (let y = 4; y < 6; y++)
  for (let x = 2; x < 6; x++)
    maskSet(mask2, size2, x, y, 'liquid');

const c2 = document.createElement('canvas');
c2.width = size2; c2.height = size2;
const cx2 = c2.getContext('2d');

paintMaskByEnum(cx2, mask2, size2, { glass: '#3399ff', liquid: '#ff3399' });
paintInternalSeams(cx2, mask2, size2, '#000000');

console.log('seam test:', c2.toDataURL());
// 期望:y=3 整列(藍/glass 那側)被塗黑,y=4 整列(粉/liquid 那側)被塗黑 →
//        中間出現 2px 寬的黑色橫條,因為兩側都偵測到對面是不同標籤
```

期望:dataURL 開出來看到上下方塊交界處有黑色橫條(因為兩側標籤不同,seam 被偵測)。

- [ ] **Step 6: Pause for review**

跟 user 說:「Task 2 完成。請跑兩段驗證腳本,把 dataURL 開新分頁放大檢視:第一張應該是外黑內藍的方塊框;第二張上下色塊間應該有黑色橫條。」

---

## Task 3: 建立 `potion.js` 骨架 + `samplePotionSpec`

**Files:**
- Create: `potion.js`
- Modify: `index.html`(加 script tag)

**注意:此 task 不修改 `main.js`**(`drawPotion` 仍指向 main.js 內的 stub)。`potion.js` 內定義一個暫時的 `drawPotion` 但**不**對外覆蓋,留待 Task 5 整合。

- [ ] **Step 1: 定義驗證目標**

預期能在 console 跑出:

```js
const r = new SeededRandom('test-spec-1');
const spec = samplePotionSpec(r);
console.log(spec);
// 期望:含 family, palette, shape, capType, liquidLevel,
//        hasBubbles, hasSediment, hasLabel, bubbles, labelDots
// 限制:vial 強制 hasLabel = false
// 限制:bubbles 是陣列,每個元素 [x, y]
// 限制:liquidLevel 在 [0.4, 0.95] 之間

const r2 = new SeededRandom('test-spec-1');
const s2 = samplePotionSpec(r2);
JSON.stringify(spec) === JSON.stringify(s2);  // → true
```

- [ ] **Step 2: 建立 `potion.js`**

完整檔案內容:

```js
// potion.js
// 兩階段架構:samplePotionSpec(rng) → spec → renderPotionSpec32/16(ctx, spec)。
// 此檔最後 export 一個對外 drawPotion(ctx, rng, size) 給 main.js 用。

// =====================================================================
// Sampler — 把所有 RNG 集中於此,輸出純資料 spec
// =====================================================================

const SHAPE_NAMES = ['flask', 'round', 'vial'];
const SHAPE_WEIGHTS = [3, 2, 1.5];
const CAP_TYPES = ['cork', 'wax_seal', 'cloth_tied'];

function samplePotionSpec(rng) {
  const { family, palette } = samplePalette(rng);
  const shape = rng.pickWeighted(SHAPE_NAMES, SHAPE_WEIGHTS);
  const capType = rng.pick(CAP_TYPES);
  const liquidLevel = rng.randomFloat(0.4, 0.95);
  const hasBubbles = rng.chance(0.35);
  const hasSediment = rng.chance(0.25);
  // vial 太細放不下標籤
  const hasLabel = (shape !== 'vial') && rng.chance(0.30);

  // 在 sample 階段就決定 bubble 與 label 點位,確保 render 是純函式。
  // 這裡用「邏輯座標 in [0,1] × [0,1]」,render 階段再 map 到實際 pixel。
  const bubbles = [];
  if (hasBubbles) {
    const n = rng.randomInt(2, 4);
    for (let i = 0; i < n; i++) {
      bubbles.push([rng.randomFloat(0.2, 0.8), rng.randomFloat(0.2, 0.8)]);
    }
  }

  const labelDots = [];
  if (hasLabel) {
    const n = rng.randomInt(2, 3);
    for (let i = 0; i < n; i++) {
      labelDots.push([rng.randomFloat(0.15, 0.85), rng.randomFloat(0, 1)]);
    }
  }

  return {
    family,
    palette,
    shape,
    capType,
    liquidLevel,
    hasBubbles,
    hasSediment,
    hasLabel,
    bubbles,
    labelDots,
  };
}

// =====================================================================
// Renderer — 純函式,不再使用 RNG;Task 4+ 補完
// =====================================================================

function renderPotionSpec32(ctx, spec) {
  // TODO Task 4: 實作
}

function renderPotionSpec16(ctx, spec) {
  // TODO Task 9: 實作
}

// =====================================================================
// 對外:drawPotion(ctx, rng, size) — Task 5 才整合到 main.js
// =====================================================================

function drawPotionV2(ctx, rng, size) {
  const spec = samplePotionSpec(rng);
  if (size === 32) renderPotionSpec32(ctx, spec);
  else if (size === 16) renderPotionSpec16(ctx, spec);
}

window.samplePotionSpec = samplePotionSpec;
window.renderPotionSpec32 = renderPotionSpec32;
window.renderPotionSpec16 = renderPotionSpec16;
window.drawPotionV2 = drawPotionV2;  // 暫名,Task 5 改名並整合
```

- [ ] **Step 3: 在 `index.html` 加 script tag**

```html
<script src="random.js"></script>
<script src="palette.js"></script>
<script src="pixel-utils.js"></script>
<script src="potion.js"></script>
<script src="main.js"></script>
```

- [ ] **Step 4: 驗證**

打開 `index.html` console 貼:

```js
const r = new SeededRandom('test-spec-1');
const spec = samplePotionSpec(r);
console.log(spec);

// 結構檢查
const required = ['family','palette','shape','capType','liquidLevel',
                  'hasBubbles','hasSediment','hasLabel','bubbles','labelDots'];
console.log('all keys present:', required.every(k => k in spec));
console.log('liquidLevel in range:', spec.liquidLevel >= 0.4 && spec.liquidLevel <= 0.95);
console.log('vial-no-label invariant:',
  Array.from({length: 200}, (_, i) => samplePotionSpec(new SeededRandom('vt-' + i)))
    .filter(s => s.shape === 'vial')
    .every(s => s.hasLabel === false)
);

// 重現性
const a = samplePotionSpec(new SeededRandom('repro-1'));
const b = samplePotionSpec(new SeededRandom('repro-1'));
console.log('reproducible:', JSON.stringify(a) === JSON.stringify(b));
```

期望:`all keys present: true`、`liquidLevel in range: true`、`vial-no-label invariant: true`、`reproducible: true`。

- [ ] **Step 5: Pause for review**

跟 user 說:「Task 3 完成。請跑驗證腳本,期望全部 4 個 console.log 都是 true。spec 物件可以印出來看內容感受一下。」

---

## Task 4: 32×32 形狀 silhouette + buildSilhouetteMask32 + 第一輪可見 render

**Files:**
- Modify: `potion.js`(加 shape 函式、buildSilhouetteMask32、實作 renderPotionSpec32)

此 task 結束時,`renderPotionSpec32` 會產出**只有 silhouette 主色 + outline** 的瓶子(沒有液體、沒有瓶塞、沒有高光、沒有特效)。但形狀可辨識為 flask / round / vial。

- [ ] **Step 1: 定義驗證目標**

console 跑:

```js
// 直接用 potion.js 的 drawPotionV2 在臨時 canvas 上畫
function preview(seed) {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const cx = c.getContext('2d');
  drawPotionV2(cx, new SeededRandom(seed), 32);
  return c.toDataURL();
}
console.log('flask?', preview('test-flask'));
console.log('round?', preview('test-round'));
console.log('vial?',  preview('test-vial'));
// 開新分頁放大,期望:看到 3 個玻璃色填充 + 黑色描邊的瓶子輪廓(無瓶塞、無液體)
```

- [ ] **Step 2: 在 `potion.js` 加入 shape 定義**

在 sampler 區塊與 renderer 區塊之間插入:

```js
// =====================================================================
// Shape silhouette functions (32×32)
//
// 每個 shape 是一個 (size: 32) → { rows: Array<{leftX, rightX, kind} | null> }
// rows[y] 描述第 y 列被瓶子覆蓋的範圍。kind 分 'body' | 'neck' | null。
// 整張圖示置中。
// 注意:這裡定義的是「未咬掉外圍 outline 之前」的 silhouette;
//        outline pass 會吃掉外圈 1px。
// =====================================================================

function shapeFlask32() {
  // 瓶身:y=8..29(身高 22),底寬 16 → 頂部頸接處寬約 6
  // 頸:  y=4..7  (頸高 4),寬 5
  const rows = new Array(32).fill(null);
  const cx = 16;
  // 頸
  for (let y = 4; y <= 7; y++) {
    rows[y] = { leftX: cx - 2, rightX: cx + 2, kind: 'neck' };
  }
  // 瓶身:從 y=8 (寬 6) 線性增寬到 y=29 (寬 16)
  for (let y = 8; y <= 29; y++) {
    const t = (y - 8) / (29 - 8);   // 0..1
    const halfW = Math.round(3 + t * 5);  // 3 → 8
    rows[y] = { leftX: cx - halfW, rightX: cx + halfW - 1, kind: 'body' };
  }
  return { rows };
}

function shapeRound32() {
  // 圓 ⌀16,圓心 (16, 21);頸:y=4..12,寬 5
  const rows = new Array(32).fill(null);
  const cx = 16, cy = 21, r = 8;
  // 頸
  for (let y = 4; y <= 12; y++) {
    rows[y] = { leftX: cx - 2, rightX: cx + 2, kind: 'neck' };
  }
  // 圓:用整數 midpoint。但簡單版用 sqrt 也夠(32×32 不在意效能)
  for (let y = cy - r; y <= cy + r; y++) {
    if (y < 13 || y > 29) continue;  // 圓上方接到頸,不重複畫
    const dy = y - cy;
    const dx = Math.floor(Math.sqrt(r * r - dy * dy));
    const left = cx - dx;
    const right = cx + dx - 1;
    if (rows[y]) {
      // 與頸區重疊處取聯集
      rows[y] = { leftX: Math.min(rows[y].leftX, left), rightX: Math.max(rows[y].rightX, right), kind: 'body' };
    } else {
      rows[y] = { leftX: left, rightX: right, kind: 'body' };
    }
  }
  return { rows };
}

function shapeVial32() {
  // 整身寬 7(cx-3..cx+3),頸寬 5;直筒
  // 頸:y=4..7,身:y=8..29
  const rows = new Array(32).fill(null);
  const cx = 16;
  for (let y = 4; y <= 7; y++) {
    rows[y] = { leftX: cx - 2, rightX: cx + 2, kind: 'neck' };
  }
  for (let y = 8; y <= 29; y++) {
    rows[y] = { leftX: cx - 3, rightX: cx + 3, kind: 'body' };
  }
  return { rows };
}

const SHAPE_FNS_32 = {
  flask: shapeFlask32,
  round: shapeRound32,
  vial:  shapeVial32,
};
```

- [ ] **Step 3: 在 `potion.js` 加入 `buildSilhouetteMask32`**

接著加:

```js
/**
 * 把 spec 的 shape 轉成 32x32 enum mask。
 * 此版本只標 'glass'(瓶身玻璃)— Task 6 會再覆蓋 'liquid'、'cap' 等。
 */
function buildSilhouetteMask32(spec) {
  const size = 32;
  const mask = allocateMask(size);
  const shape = SHAPE_FNS_32[spec.shape]();
  for (let y = 0; y < size; y++) {
    const r = shape.rows[y];
    if (!r) continue;
    for (let x = r.leftX; x <= r.rightX; x++) {
      maskSet(mask, size, x, y, 'glass');
    }
  }
  return mask;
}
```

- [ ] **Step 4: 實作 `renderPotionSpec32` 第一版(只 silhouette + outline)**

把原本 stub 的 `renderPotionSpec32` 改為:

```js
function renderPotionSpec32(ctx, spec) {
  const size = 32;
  ctx.clearRect(0, 0, size, size);

  const mask = buildSilhouetteMask32(spec);

  // Step 2:依 enum 上色(現在只有 glass)
  paintMaskByEnum(ctx, mask, size, {
    glass: spec.palette.glassBody,
  });

  // Step 7:inside-edge outline(咬掉外圈 1px)
  applyInsideOutlinePass(ctx, mask, size, spec.palette.outline);
}
```

- [ ] **Step 5: 驗證**

打開 `index.html` console:

```js
function preview(seed) {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const cx = c.getContext('2d');
  drawPotionV2(cx, new SeededRandom(seed), 32);
  return c.toDataURL();
}
// 多試幾個 seed,挑出 3 個 shape 各一張
for (let i = 0; i < 12; i++) {
  const r = new SeededRandom('s-' + i);
  const spec = samplePotionSpec(r);
  console.log(spec.shape, 's-' + i);
}
// 從 log 挑各 shape 一個 seed,產出 dataURL,新分頁放大檢視
```

期望:每個 dataURL 開出來都是「玻璃色填充 + 黑色描邊」的瓶子輪廓,3 個 shape 視覺上明顯不同:
- flask = 燒瓶(底寬上窄)
- round = 圓底+短頸
- vial = 細長直筒
- 描邊全身連續、無斷點

- [ ] **Step 6: 已知 risk 處理 — flask 斜邊 outline 連續性檢查**

特別檢查 flask:斜邊處應該每一列描邊都接得上。如果你看到斜邊上某幾列沒有 outline、或外觀像「梯田」凹凸,代表 4-鄰居偵測不夠。
**修法(若需要):** 在 `pixel-utils.js` 的 `applyInsideOutlinePass` 內,把 4-鄰居改 8-鄰居:加入 `up-left, up-right, down-left, down-right` 四個對角檢查。

如果 flask 看起來 OK 不需要改,跳過此步。

- [ ] **Step 7: Pause for review**

跟 user 說:「Task 4 完成。已能產出有形狀、有描邊的瓶子(尚無液體、瓶塞、高光)。請挑 3 個 shape 各看一張 dataURL,確認(a)三種形狀視覺可分辨、(b)描邊連續無斷點。特別請看 flask 的斜邊。」

---

## Task 5: 整合 — `drawPotion` 對外 + `main.js` 改用 + 移除 stub

**Files:**
- Modify: `potion.js`(把 `drawPotionV2` 改名 `drawPotion`,移除 window 別名)
- Modify: `main.js`(刪掉 `drawPotion` stub、刪掉 `fillRect`、`ITEM_TYPES` 自動拿到全域 `drawPotion`)

此 task 後,主介面(index.html 的 generate 按鈕)會直接顯示新版 potion;sword/spear 仍走 main.js 內 stub。

- [ ] **Step 1: 在 `potion.js` 改名**

把:
```js
function drawPotionV2(ctx, rng, size) { /* ... */ }
window.drawPotionV2 = drawPotionV2;
```

改成:
```js
function drawPotion(ctx, rng, size) {
  const spec = samplePotionSpec(rng);
  if (size === 32) renderPotionSpec32(ctx, spec);
  else if (size === 16) renderPotionSpec16(ctx, spec);
}
window.drawPotion = drawPotion;
```

- [ ] **Step 2: 在 `main.js` 刪除 stub `drawPotion` 與 `fillRect`**

找到:
```js
function drawPotion(ctx, rng, size) {
  // 暫時的占位:中央畫一個瓶子形狀
  const colors = ['#5fc7ff', ...];
  ...
}
```
**整段刪掉**(連同前面註解區塊到 `drawPotion` 結束 `}` 的那段)。

`drawSword` 與 `drawSpear` **保留**(它們是這輪的非目標)。

接著找到:
```js
function fillRect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}
```
**整段刪掉**(`pixel-utils.js` 已提供同名全域)。

- [ ] **Step 3: 確認 `ITEM_TYPES` 仍然 work**

`main.js` 內這段:
```js
const ITEM_TYPES = {
  potion: drawPotion,
  sword: drawSword,
  spear: drawSpear,
};
```

由於 `palette.js / pixel-utils.js / potion.js` 都在 main.js **之前**載入(見 index.html 的 script 順序),`drawPotion` 是全域函式,這裡直接拿到。**不需修改此段**。

- [ ] **Step 4: 驗證 — 主介面**

重新整理 `index.html`:
1. 上方 type 選 `potion`、size 選 `32`,點「generate」幾次。期望:看到 Task 4 等級的瓶子(silhouette + outline,還沒液體 / 瓶塞 / 高光)。
2. type 選 `sword` / `spear`,點 generate。期望:仍是原本 stub 的劍 / 長矛(未動)。
3. 下方 batch_preview 24 格,potion 的格子應該都是新版,sword/spear 仍是舊 stub。

- [ ] **Step 5: 驗證 — 重現性**

在 seed 欄位輸入 `repro-1`,點 generate 兩次,兩次圖示應**完全相同**。

- [ ] **Step 6: Pause for review**

跟 user 說:「Task 5 完成。主介面已經跑新版 potion(目前只有形狀 + 描邊,沒液體沒瓶塞)。請操作 generate / batch_preview / 重複輸入同 seed,確認(a)不會崩、(b)同 seed 重現一致、(c)sword/spear 仍是原本占位。」

---

## Task 6: 加液體 + 沉澱

**Files:**
- Modify: `potion.js`(`buildSilhouetteMask32` 加 'liquid' 區塊;`renderPotionSpec32` 加 sediment paint)

- [ ] **Step 1: 改 `buildSilhouetteMask32` — 把液面以下標 'liquid'**

把現有:
```js
function buildSilhouetteMask32(spec) {
  const size = 32;
  const mask = allocateMask(size);
  const shape = SHAPE_FNS_32[spec.shape]();
  for (let y = 0; y < size; y++) {
    const r = shape.rows[y];
    if (!r) continue;
    for (let x = r.leftX; x <= r.rightX; x++) {
      maskSet(mask, size, x, y, 'glass');
    }
  }
  return mask;
}
```

改成:
```js
function buildSilhouetteMask32(spec) {
  const size = 32;
  const mask = allocateMask(size);
  const shape = SHAPE_FNS_32[spec.shape]();

  // 計算瓶身 body 的 y 範圍(只有 body 內裝液體,neck 不裝)
  let bodyTop = -1, bodyBottom = -1;
  for (let y = 0; y < size; y++) {
    const r = shape.rows[y];
    if (r && r.kind === 'body') {
      if (bodyTop === -1) bodyTop = y;
      bodyBottom = y;
    }
  }
  // 液面 y(從 bodyBottom 往上算 liquidLevel 比例)
  const bodyHeight = bodyBottom - bodyTop + 1;
  const liquidPx = Math.floor(bodyHeight * spec.liquidLevel);
  const liquidTopY = bodyBottom - liquidPx + 1;

  for (let y = 0; y < size; y++) {
    const r = shape.rows[y];
    if (!r) continue;
    for (let x = r.leftX; x <= r.rightX; x++) {
      // body 區內、且在液面以下 → liquid;否則 → glass
      if (r.kind === 'body' && y >= liquidTopY) {
        maskSet(mask, size, x, y, 'liquid');
      } else {
        maskSet(mask, size, x, y, 'glass');
      }
    }
  }
  return mask;
}
```

- [ ] **Step 2: 改 `renderPotionSpec32` — 上 liquid 主色 + sediment**

把現有:
```js
function renderPotionSpec32(ctx, spec) {
  const size = 32;
  ctx.clearRect(0, 0, size, size);
  const mask = buildSilhouetteMask32(spec);
  paintMaskByEnum(ctx, mask, size, {
    glass: spec.palette.glassBody,
  });
  applyInsideOutlinePass(ctx, mask, size, spec.palette.outline);
}
```

改成:
```js
function renderPotionSpec32(ctx, spec) {
  const size = 32;
  ctx.clearRect(0, 0, size, size);

  const mask = buildSilhouetteMask32(spec);

  // 主色填充
  paintMaskByEnum(ctx, mask, size, {
    glass: spec.palette.glassBody,
    liquid: spec.palette.liquidMain,
  });

  // sediment:在 liquid 區的最下面 2~3 列改用 liquidShadow
  if (spec.hasSediment) {
    paintSediment32(ctx, mask, size, spec);
  }

  applyInsideOutlinePass(ctx, mask, size, spec.palette.outline);
}

function paintSediment32(ctx, mask, size, spec) {
  // 找到所有 'liquid' cell 的 maxY
  let maxY = -1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (mask[y * size + x] === 'liquid' && y > maxY) maxY = y;
    }
  }
  if (maxY < 0) return;
  // 沉澱 2~3 列(用 spec 內 deterministic 來源 — 用 family + shape 雜湊出固定厚度)
  const thickness = 2 + ((spec.bubbles.length + spec.shape.length) % 2);
  ctx.fillStyle = spec.palette.liquidShadow;
  for (let y = maxY - thickness + 1; y <= maxY; y++) {
    for (let x = 0; x < size; x++) {
      if (mask[y * size + x] === 'liquid') {
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}
```

- [ ] **Step 3: 驗證**

主介面 type=potion size=32,generate 多次。期望:
- 多數瓶子下半是「液體色」、上半是「玻璃色」,中間有水平直線分界
- 液面高度看 seed 不同會變化
- 部分瓶子(約 25%)液體底部多 2~3px 的更深色 = sediment
- outline 仍全身連續

特別 seed 測試:在 seed 欄輸入 `liquid-low` / `liquid-high` 各看一張感覺液面變化。

- [ ] **Step 4: Pause for review**

跟 user 說:「Task 6 完成。瓶子裡有液體了,部分有沉澱。請看 batch_preview 確認(a)液面有高低變化、(b)有些瓶子底部更深、(c)glass 與 liquid 之間沒有 outline 描邊(因為它們在 mask 裡都是非 null,inside-edge pass 不會在內部畫線 — 那條線會由 Task 8 的 seam pass 處理)。」

---

## Task 7: 加瓶塞(三種 capType)

**Files:**
- Modify: `potion.js`(`buildSilhouetteMask32` 加 'cap' 區;cap 顏色處理;`renderPotionSpec32` 加 cap 細節)

每種 capType 都會在 mask 內標 'cap'(統一),但 paint 階段依 capType 給不同色與額外細節(蠟滴、繩結)。

- [ ] **Step 1: 改 `buildSilhouetteMask32` — 在瓶頸頂端加 'cap' 區**

在 `buildSilhouetteMask32` 內,silhouette 主迴圈之後、return 之前,插入:

```js
  // 瓶塞:覆蓋 neck 最上面 2~3 列、寬度 = neck 寬 + 1(蓋住瓶口)
  // 找 neck top y
  let neckTop = -1;
  for (let y = 0; y < size; y++) {
    if (shape.rows[y] && shape.rows[y].kind === 'neck') { neckTop = y; break; }
  }
  if (neckTop >= 0) {
    const neckRow = shape.rows[neckTop];
    const capH = (spec.capType === 'cork') ? 3 : 2;
    const extraW = 1;  // 蓋住瓶口外 1px
    const capLeft  = neckRow.leftX  - extraW;
    const capRight = neckRow.rightX + extraW;
    // cap 從 neckTop - capH + 1 .. neckTop(蓋進瓶頸頂端)
    for (let y = neckTop - capH + 1; y <= neckTop; y++) {
      for (let x = capLeft; x <= capRight; x++) {
        // 不超出畫布
        if (y < 0 || y >= size || x < 0 || x >= size) continue;
        maskSet(mask, size, x, y, 'cap');
      }
    }
    // wax_seal 額外加 1px 蠟滴(瓶頸兩側往下 1~2px)
    if (spec.capType === 'wax_seal') {
      const dripLen = 1 + ((spec.shape.length + spec.family.length) % 2);  // 1 或 2
      for (let dy = 1; dy <= dripLen; dy++) {
        const y = neckTop + dy;
        if (y >= size) break;
        // 蠟滴沿瓶頸外側
        maskSet(mask, size, neckRow.leftX  - 1, y, 'cap');
        maskSet(mask, size, neckRow.rightX + 1, y, 'cap');
      }
    }
    // cloth_tied 額外 1px 繩結:在 neckTop + 1 列、繞瓶頸一圈
    if (spec.capType === 'cloth_tied') {
      const ropeY = neckTop + 1;
      if (ropeY < size) {
        for (let x = neckRow.leftX; x <= neckRow.rightX; x++) {
          maskSet(mask, size, x, ropeY, 'cap');
        }
      }
    }
  }
```

- [ ] **Step 2: 改 `renderPotionSpec32` — 依 capType 上色**

把 `paintMaskByEnum` 那段改為:

```js
  const capColor = capColorFor(spec);
  paintMaskByEnum(ctx, mask, size, {
    glass: spec.palette.glassBody,
    liquid: spec.palette.liquidMain,
    cap: capColor,
  });
```

並在檔案內加 helper:

```js
/** 依 capType 決定 cap 主色 */
function capColorFor(spec) {
  if (spec.capType === 'cork')      return CORK_PALETTE.main;
  if (spec.capType === 'wax_seal')  return spec.palette.liquidMain;  // 同色族稍亮在 sample 階段不做,直接用 liquidMain 即可
  if (spec.capType === 'cloth_tied') return spec.palette.highlight;  // 布
  return spec.palette.outline;
}
```

注意:cloth_tied 的繩結雖然也是 'cap' 標籤、被塗成 highlight(布色)。**繩結看起來該是深色** — 這部分留給 Task 8 的 seam pass:繩結那一列恰好是 cap 與 cap 自接,不會自動變深。所以這裡需要手動處理:

把 `paintMaskByEnum` 之後加一步:

```js
  // cloth_tied 繩結:把 neckTop+1 那列的 cap cell 改寫成 outline
  if (spec.capType === 'cloth_tied') {
    repaintRopeRow(ctx, mask, size, spec);
  }
```

並加 helper:

```js
function repaintRopeRow(ctx, mask, size, spec) {
  // 找 neck top
  const shape = SHAPE_FNS_32[spec.shape]();
  let neckTop = -1;
  for (let y = 0; y < size; y++) {
    if (shape.rows[y] && shape.rows[y].kind === 'neck') { neckTop = y; break; }
  }
  if (neckTop < 0) return;
  const ropeY = neckTop + 1;
  if (ropeY >= size) return;
  ctx.fillStyle = spec.palette.outline;
  const r = shape.rows[neckTop];
  for (let x = r.leftX; x <= r.rightX; x++) {
    if (mask[ropeY * size + x] === 'cap') {
      ctx.fillRect(x, ropeY, 1, 1);
    }
  }
}
```

- [ ] **Step 3: 驗證**

主介面 batch_preview 看 24 格 potion。期望:
- 約 1/3 是 cork(棕色軟木)
- 約 1/3 是 wax_seal(液體色封蠟,部分有 1~2px 蠟滴從瓶口往下)
- 約 1/3 是 cloth_tied(布塞 = highlight 色 + 一條繩結 = 黑線繞瓶頸)
- outline 全身仍連續

- [ ] **Step 4: Pause for review**

跟 user 說:「Task 7 完成。三種瓶塞都進來了。請看 batch_preview 確認三種視覺可辨識,並告訴我有沒有哪一種看起來不對(尤其 wax_seal 的蠟滴位置、cloth_tied 的繩結是否清楚)。」

---

## Task 8: 加 internal seam pass(讓元件交界出現描邊)

**Files:**
- Modify: `potion.js`(`renderPotionSpec32` 在 outline pass **前** call seam pass)

- [ ] **Step 1: 改 `renderPotionSpec32` 加入 seam pass**

把:
```js
  applyInsideOutlinePass(ctx, mask, size, spec.palette.outline);
}
```

改成:
```js
  // 先畫 internal seams(液面、瓶頸/瓶塞分界),再畫外圈 outline。
  paintInternalSeams(ctx, mask, size, spec.palette.outline);
  applyInsideOutlinePass(ctx, mask, size, spec.palette.outline);
}
```

- [ ] **Step 2: 驗證**

主介面看幾張瓶子。期望新增的視覺差異:
- 液面位置出現一條 1~2px 黑色橫線(glass / liquid 交界)
- 瓶塞與瓶頸交界出現 1px 黑線(cap / glass 交界)
- 瓶頸與瓶身交界**不會**出現黑線(它們 mask 標籤都是 glass,seam pass 不偵測同標籤)

- [ ] **Step 3: 已知 risk 處理 — sediment 與 liquid 之間**

Sediment 是「畫在 mask 上的 liquid cell」,只是換了色填充(在 paintSediment32 內 ctx.fillRect),mask 仍然標 'liquid'。所以 seam pass **不會**在 sediment 與 liquid 交界畫線(這是預期行為:同色族深淺漸變比黑線好看)。

如果你看了之後反而覺得 sediment 該有黑線分隔,告訴 user 後再開新任務改;這輪預設不分隔。

- [ ] **Step 4: Pause for review**

跟 user 說:「Task 8 完成,加了 internal seam pass。現在液面、瓶塞下緣應該都有 1~2px 黑線分界。請確認(a)交界線出現在該出現的地方、(b)沒出現在不該出現的地方(例如瓶頸-瓶身那條 = 同 glass、不該有線)、(c)整體 outline 仍連續。」

---

## Task 9: 加高光 + bubbles + label

**Files:**
- Modify: `potion.js`(三個新 paint 函式 + 在 renderPotionSpec32 串起)

注意調用順序:**這三個都要在 outline pass 之前**畫,否則高光會被外圈 outline 蓋掉一部分(可接受),但 bubbles / labelDots 若被 outline 蓋反而醜。實際順序 = 主色 → sediment → highlight → bubbles → label → seam pass → outline pass。

- [ ] **Step 1: 改 `renderPotionSpec32` 串入新步驟**

把整個函式改為:

```js
function renderPotionSpec32(ctx, spec) {
  const size = 32;
  ctx.clearRect(0, 0, size, size);

  const mask = buildSilhouetteMask32(spec);

  const capColor = capColorFor(spec);
  paintMaskByEnum(ctx, mask, size, {
    glass: spec.palette.glassBody,
    liquid: spec.palette.liquidMain,
    cap: capColor,
  });

  if (spec.capType === 'cloth_tied') {
    repaintRopeRow(ctx, mask, size, spec);
  }

  if (spec.hasSediment) {
    paintSediment32(ctx, mask, size, spec);
  }

  paintHighlight32(ctx, mask, size, spec);

  if (spec.hasBubbles) {
    paintBubbles32(ctx, mask, size, spec);
  }

  if (spec.hasLabel) {
    paintLabel32(ctx, mask, size, spec);
  }

  paintInternalSeams(ctx, mask, size, spec.palette.outline);
  applyInsideOutlinePass(ctx, mask, size, spec.palette.outline);
}
```

- [ ] **Step 2: 加 `paintHighlight32`**

```js
/**
 * 玻璃左側固定光帶。長度依 shape 不同:
 *   flask 沿斜邊 4~5px、round 沿弧線左上 3~4px、vial 中段 5~6px。
 * 「左側」= 瓶身內、最左欄 + 1(咬掉外圈 outline 後的最左可見列)。
 * 高光只畫在 'glass' 區。
 */
function paintHighlight32(ctx, mask, size, spec) {
  ctx.fillStyle = spec.palette.highlight;

  if (spec.shape === 'vial') {
    // 中段直線:y = 16..20
    for (let y = 16; y <= 20; y++) {
      tryPaintHighlightCell(ctx, mask, size, 14, y);
    }
    return;
  }

  if (spec.shape === 'round') {
    // 圓的左上沿弧線 3~4 px;手算位置:y=16..18 在 x=10..11
    tryPaintHighlightCell(ctx, mask, size, 11, 15);
    tryPaintHighlightCell(ctx, mask, size, 10, 16);
    tryPaintHighlightCell(ctx, mask, size, 10, 17);
    tryPaintHighlightCell(ctx, mask, size, 11, 18);
    return;
  }

  // flask:斜邊上 4~5 個 cell;從 (12, 11) 沿斜邊往左下
  // 因為瓶身上窄下寬,左邊界每往下 1 列大約往左 1/4..1/5 px,
  // 取近似:每 2 列往左 1 px。從 y=11 開始,5 列。
  let x = 12;
  for (let y = 11; y <= 15; y++) {
    tryPaintHighlightCell(ctx, mask, size, x, y);
    if ((y - 11) % 2 === 1) x -= 1;
  }
}

/** 只在該 cell 為 'glass' 時才塗(避免蓋到 liquid / cap) */
function tryPaintHighlightCell(ctx, mask, size, x, y) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  if (mask[y * size + x] !== 'glass') return;
  ctx.fillRect(x, y, 1, 1);
}
```

- [ ] **Step 3: 加 `paintBubbles32`**

```js
function paintBubbles32(ctx, mask, size, spec) {
  ctx.fillStyle = spec.palette.highlight;
  // 找 liquid bounding box
  let minX = size, minY = size, maxX = -1, maxY = -1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (mask[y * size + x] === 'liquid') {
        if (x < minX) minX = x; if (y < minY) minY = y;
        if (x > maxX) maxX = x; if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return;
  const w = maxX - minX + 1, h = maxY - minY + 1;
  for (const [u, v] of spec.bubbles) {
    const x = minX + Math.floor(u * w);
    const y = minY + Math.floor(v * h);
    // 只在 liquid cell 上畫,避免畫到 sediment(會看不出來)/ glass / 外面
    if (mask[y * size + x] === 'liquid') {
      ctx.fillRect(x, y, 1, 1);
    }
  }
}
```

- [ ] **Step 4: 加 `paintLabel32`**

```js
function paintLabel32(ctx, mask, size, spec) {
  // 在 body 中段橫向貼一條 1~2px 高色帶。color = outline,點綴 = highlight。
  // 找 body 的 y 範圍
  let bodyTop = -1, bodyBottom = -1;
  for (let y = 0; y < size; y++) {
    const v = mask[y * size + 16];  // 中軸樣本
    if (v === 'glass' || v === 'liquid') {
      if (bodyTop === -1) bodyTop = y;
      bodyBottom = y;
    }
  }
  if (bodyTop < 0) return;
  const labelY = Math.floor((bodyTop + bodyBottom) / 2);
  const labelH = 2;

  // 找該列所在 row 的瓶身範圍(用 mask 找最左最右的非 null)
  function rowRange(y) {
    let l = -1, r = -1;
    for (let x = 0; x < size; x++) {
      if (mask[y * size + x] != null && mask[y * size + x] !== 'cap') {
        if (l === -1) l = x;
        r = x;
      }
    }
    return [l, r];
  }

  ctx.fillStyle = spec.palette.outline;
  for (let y = labelY; y < labelY + labelH; y++) {
    const [l, r] = rowRange(y);
    if (l < 0) continue;
    // 標籤往內縮 1px,別貼到外圈 outline
    for (let x = l + 1; x < r; x++) {
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // 點綴(模擬字),用 highlight 色,在 labelY (上半 row)
  ctx.fillStyle = spec.palette.highlight;
  const [l, r] = rowRange(labelY);
  if (l < 0) return;
  const w = r - l - 1;  // 內縮後的寬度
  for (const [u] of spec.labelDots) {
    const x = l + 1 + Math.floor(u * w);
    if (mask[labelY * size + x] != null && mask[labelY * size + x] !== 'cap') {
      ctx.fillRect(x, labelY, 1, 1);
    }
  }
}
```

- [ ] **Step 5: 驗證**

主介面 batch_preview 24 格。期望:
- 每張瓶子左側多了一條淺色高光(大約瓶身高度 1/4)
- 約 35% 的瓶子液體裡有 2~4 顆亮點 = bubbles
- 約 30% 的非 vial 瓶子瓶身中間有一條深色橫帶 + 1~2 個亮點 = label
- vial **不會**有 label(規則保證)
- outline 仍連續

特別 seed:`label-1` / `label-2` 看標籤;若你的 batch 沒看到 vial,在 seed 欄輸入幾個 vial seed(可從 console 找)專門看「沒有 label」。

- [ ] **Step 6: Pause for review**

跟 user 說:「Task 9 完成。高光 / 泡泡 / 標籤都進來了。請仔細看 batch_preview,(a)高光位置在每個 shape 上是否合理(光源從左上感)、(b)泡泡是否真的在液體內、(c)標籤是否只在 flask/round 出現、不在 vial 出現。」

---

## Task 10: 16×16 子集 — shape + render

**Files:**
- Modify: `potion.js`(加 16 版 shape 函式、buildSilhouetteMask16、實作 renderPotionSpec16)

16 版只支援:shape、capType、liquidLevel、palette、高光(縮成 1~2px)。捨棄:bubbles、sediment、label、wax 蠟滴。

- [ ] **Step 1: 加 16 版 shape 函式**

在 `SHAPE_FNS_32` 區塊**下方**加:

```js
function shapeFlask16() {
  // 底寬 8,頸寬 3,身高 11,頸高 2;畫布 16×16
  // 整張置中,瓶子佔 y=2..14
  const rows = new Array(16).fill(null);
  const cx = 8;
  // 頸:y=2..3
  for (let y = 2; y <= 3; y++) {
    rows[y] = { leftX: cx - 1, rightX: cx + 1, kind: 'neck' };
  }
  // 身:y=4..14,線性增寬從 3 → 8
  for (let y = 4; y <= 14; y++) {
    const t = (y - 4) / (14 - 4);
    const halfW = Math.round(1.5 + t * 2.5);  // 約 1.5 → 4
    rows[y] = { leftX: cx - halfW, rightX: cx + halfW - 1, kind: 'body' };
  }
  return { rows };
}

function shapeRound16() {
  // ⌀8 圓 + 2px 頸
  const rows = new Array(16).fill(null);
  const cx = 8, cy = 11, r = 4;
  for (let y = 2; y <= 6; y++) {
    rows[y] = { leftX: cx - 1, rightX: cx + 1, kind: 'neck' };
  }
  for (let y = cy - r; y <= cy + r; y++) {
    if (y < 7) continue;
    const dy = y - cy;
    const dx = Math.floor(Math.sqrt(r * r - dy * dy));
    const left = cx - dx;
    const right = cx + dx - 1;
    rows[y] = { leftX: left, rightX: right, kind: 'body' };
  }
  return { rows };
}

function shapeVial16() {
  // 寬 4,頸寬 2,直筒
  const rows = new Array(16).fill(null);
  const cx = 8;
  for (let y = 2; y <= 3; y++) {
    rows[y] = { leftX: cx - 1, rightX: cx, kind: 'neck' };
  }
  for (let y = 4; y <= 14; y++) {
    rows[y] = { leftX: cx - 2, rightX: cx + 1, kind: 'body' };
  }
  return { rows };
}

const SHAPE_FNS_16 = {
  flask: shapeFlask16,
  round: shapeRound16,
  vial:  shapeVial16,
};
```

- [ ] **Step 2: 加 `buildSilhouetteMask16`(同 32 版邏輯,但簡化:不做 sediment/bubbles/label,所以只標 glass / liquid / cap)**

```js
function buildSilhouetteMask16(spec) {
  const size = 16;
  const mask = allocateMask(size);
  const shape = SHAPE_FNS_16[spec.shape]();

  let bodyTop = -1, bodyBottom = -1;
  for (let y = 0; y < size; y++) {
    const r = shape.rows[y];
    if (r && r.kind === 'body') {
      if (bodyTop === -1) bodyTop = y;
      bodyBottom = y;
    }
  }
  const bodyHeight = bodyBottom - bodyTop + 1;
  const liquidPx = Math.floor(bodyHeight * spec.liquidLevel);
  const liquidTopY = bodyBottom - liquidPx + 1;

  for (let y = 0; y < size; y++) {
    const r = shape.rows[y];
    if (!r) continue;
    for (let x = r.leftX; x <= r.rightX; x++) {
      if (r.kind === 'body' && y >= liquidTopY) {
        maskSet(mask, size, x, y, 'liquid');
      } else {
        maskSet(mask, size, x, y, 'glass');
      }
    }
  }

  // cap:1px 高(cork/wax_seal/cloth_tied 都簡化成 1px)
  let neckTop = -1;
  for (let y = 0; y < size; y++) {
    if (shape.rows[y] && shape.rows[y].kind === 'neck') { neckTop = y; break; }
  }
  if (neckTop >= 0) {
    const neckRow = shape.rows[neckTop];
    const capLeft  = neckRow.leftX  - 1;
    const capRight = neckRow.rightX + 1;
    const capY = neckTop - 1;
    if (capY >= 0) {
      for (let x = capLeft; x <= capRight; x++) {
        if (x < 0 || x >= size) continue;
        maskSet(mask, size, x, capY, 'cap');
      }
    }
    // cloth_tied:再加 1px 繩結(neckTop 列)
    if (spec.capType === 'cloth_tied') {
      for (let x = neckRow.leftX; x <= neckRow.rightX; x++) {
        maskSet(mask, size, x, neckTop, 'cap');
      }
    }
  }

  return mask;
}
```

- [ ] **Step 3: 實作 `renderPotionSpec16`**

把原 stub 改為:

```js
function renderPotionSpec16(ctx, spec) {
  const size = 16;
  ctx.clearRect(0, 0, size, size);

  const mask = buildSilhouetteMask16(spec);

  const capColor = capColorFor(spec);
  paintMaskByEnum(ctx, mask, size, {
    glass: spec.palette.glassBody,
    liquid: spec.palette.liquidMain,
    cap: capColor,
  });

  if (spec.capType === 'cloth_tied') {
    // 繩結:把 neckTop 那列改寫 outline
    const shape = SHAPE_FNS_16[spec.shape]();
    let neckTop = -1;
    for (let y = 0; y < size; y++) {
      if (shape.rows[y] && shape.rows[y].kind === 'neck') { neckTop = y; break; }
    }
    if (neckTop >= 0) {
      ctx.fillStyle = spec.palette.outline;
      const r = shape.rows[neckTop];
      for (let x = r.leftX; x <= r.rightX; x++) {
        if (mask[neckTop * size + x] === 'cap') {
          ctx.fillRect(x, neckTop, 1, 1);
        }
      }
    }
  }

  // 高光:每個 shape 1~2px
  ctx.fillStyle = spec.palette.highlight;
  if (spec.shape === 'vial') {
    if (mask[8 * size + 6] === 'glass') ctx.fillRect(6, 8, 1, 1);
    if (mask[9 * size + 6] === 'glass') ctx.fillRect(6, 9, 1, 1);
  } else if (spec.shape === 'round') {
    if (mask[9 * size + 6] === 'glass') ctx.fillRect(6, 9, 1, 1);
  } else {
    // flask
    if (mask[6 * size + 7] === 'glass') ctx.fillRect(7, 6, 1, 1);
    if (mask[7 * size + 6] === 'glass') ctx.fillRect(6, 7, 1, 1);
  }

  paintInternalSeams(ctx, mask, size, spec.palette.outline);
  applyInsideOutlinePass(ctx, mask, size, spec.palette.outline);
}
```

- [ ] **Step 4: 已知 risk 處理 — 16 版 cloth_tied 是否可辨識**

如果 16 版 cloth_tied 看起來跟 cork 沒差(只是顏色不同、看不出布綁),`samplePotionSpec` 不必改(spec 跟 32 共用),但可以在 `renderPotionSpec16` 開頭加一個 fallback:

```js
function renderPotionSpec16(ctx, spec) {
  const size = 16;
  ctx.clearRect(0, 0, size, size);

  // 16 版 fallback:若 cloth_tied 認不出,改用 cork 視覺
  const effectiveCapType = (spec.capType === 'cloth_tied') ? 'cork' : spec.capType;
  // ...(其餘函式內 spec.capType 都改用 effectiveCapType)
```

**先不要加這個 fallback** — 先看實測效果,如果你或 user 看了覺得認不出再加。

- [ ] **Step 5: 驗證**

主介面切 size 為 16,batch_preview 看 24 格。期望:
- 認得出 flask / round / vial 三種(就算很小)
- 液體有顏色、有液面分界
- 瓶塞可見
- outline 連續、無 sub-pixel 模糊

切回 32,確認沒有 regression(32 仍然正常)。

- [ ] **Step 6: Pause for review**

跟 user 說:「Task 10 完成,16×16 也能跑了。請切到 size=16 看 batch_preview,確認(a)三種瓶型仍可分辨、(b)瓶塞看得出、(c)整體不糊。也回到 32 確認沒壞。」

---

## Task 11: 建立 `regression.html`

**Files:**
- Create: `regression.html`

獨立頁,不影響主程式。Hardcode ~16 個 seed,渲染 32+16 grid,提供「下載拼接 PNG」與「下載 specs.json」兩個按鈕。

- [ ] **Step 1: 建立 `regression.html`**

完整內容:

```html
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <title>Icon Machine — Visual Regression</title>
  <style>
    body {
      font-family: ui-monospace, Menlo, monospace;
      background: #15131e;
      color: #e8e4d8;
      margin: 24px;
    }
    h1 { font-size: 18px; margin: 0 0 16px; }
    .controls { margin-bottom: 16px; display: flex; gap: 8px; }
    button {
      background: #1d1a2a; color: #e8e4d8;
      border: 1px solid #2a2638; padding: 8px 14px;
      cursor: pointer; font-family: inherit;
    }
    button:hover { border-color: #ffb347; color: #ffb347; }
    table { border-collapse: collapse; }
    th, td { border: 1px solid #2a2638; padding: 6px; text-align: center; }
    th { background: #1d1a2a; color: #ffb347; font-weight: normal; font-size: 11px; }
    canvas { image-rendering: pixelated; image-rendering: crisp-edges; background: #1a1a26; }
    .seed-label { font-size: 10px; color: #8a8499; margin-top: 4px; }
  </style>
</head>
<body>
  <h1>Visual Regression — drawPotion</h1>
  <div class="controls">
    <button id="dl-png">下載拼接 PNG</button>
    <button id="dl-json">下載 specs.json</button>
  </div>
  <table id="grid"></table>

  <script src="random.js"></script>
  <script src="palette.js"></script>
  <script src="pixel-utils.js"></script>
  <script src="potion.js"></script>
  <script>
    // Hardcoded baseline seeds:涵蓋色族 / 瓶型 / edge cases
    const SEEDS = [
      // 6 個色族各一(用 family 名命名,實際抽到的 family 取決於 PRNG,但 seed 固定)
      'fam-fire', 'fam-frost', 'fam-mana', 'fam-poison', 'fam-golden', 'fam-shadow',
      // 形狀代表
      'shape-flask-1', 'shape-round-1', 'shape-vial-1',
      // edge cases
      'edge-low-liquid', 'edge-high-liquid',
      'edge-all-options', 'edge-zero-options',
      // 三個 generic seeds 增加涵蓋
      'rusty-flask-42', 'gilded-tear-7', 'cursed-relic-13',
    ];

    const grid = document.getElementById('grid');
    const collected = [];

    // 表頭
    {
      const tr = document.createElement('tr');
      tr.innerHTML = '<th>seed</th><th>family</th><th>shape</th><th>cap</th><th>32×32</th><th>16×16</th>';
      grid.appendChild(tr);
    }

    for (const seed of SEEDS) {
      // 32 與 16 用「同一個 spec」,所以 sample 一次,render 兩次
      const rng = new SeededRandom(seed);
      const spec = samplePotionSpec(rng);

      const c32 = document.createElement('canvas');
      c32.width = 32; c32.height = 32; c32.style.width = '64px'; c32.style.height = '64px';
      renderPotionSpec32(c32.getContext('2d'), spec);

      const c16 = document.createElement('canvas');
      c16.width = 16; c16.height = 16; c16.style.width = '64px'; c16.style.height = '64px';
      renderPotionSpec16(c16.getContext('2d'), spec);

      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${seed}</td><td>${spec.family}</td><td>${spec.shape}</td><td>${spec.capType}</td>`;
      const td32 = document.createElement('td'); td32.appendChild(c32); tr.appendChild(td32);
      const td16 = document.createElement('td'); td16.appendChild(c16); tr.appendChild(td16);
      grid.appendChild(tr);

      collected.push({ seed, spec, c32, c16 });
    }

    // 下載拼接 PNG:每行 [32, 16] 並排,所有 seed 縱向疊
    document.getElementById('dl-png').addEventListener('click', () => {
      const cellW = 32, cellH = 32;
      const composite = document.createElement('canvas');
      composite.width = cellW * 2 + 4;             // 32 + 4(gap) + 16 不夠,改 32 兩邊
      composite.width = cellW + 4 + cellW;         // 32 | gap | 32(其實 16 但我們把 16 再 nearest 放大到 32 顯示一致)
      composite.height = (cellH + 4) * collected.length;
      const cx = composite.getContext('2d');
      cx.imageSmoothingEnabled = false;
      cx.fillStyle = '#1a1a26';
      cx.fillRect(0, 0, composite.width, composite.height);
      for (let i = 0; i < collected.length; i++) {
        const { c32, c16 } = collected[i];
        const y = i * (cellH + 4);
        cx.drawImage(c32, 0, y);
        // 16 放大到 32 並排顯示,方便比對
        cx.drawImage(c16, cellW + 4, y, cellH, cellH);
      }
      const a = document.createElement('a');
      a.download = 'regression-baseline.png';
      a.href = composite.toDataURL('image/png');
      a.click();
    });

    // 下載 specs.json
    document.getElementById('dl-json').addEventListener('click', () => {
      const dump = collected.map(({ seed, spec }) => ({ seed, spec }));
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.download = 'regression-specs.json';
      a.href = URL.createObjectURL(blob);
      a.click();
    });
  </script>
</body>
</html>
```

- [ ] **Step 2: 驗證 — 頁面正確載入**

打開 `regression.html`(直接點 / 或 `file://` / 或 local server)。期望:
- 看到 16 列、6 欄(seed / family / shape / cap / 32×32 / 16×16)
- 每列有兩個圖示(32 與 16)
- 標題列顯示 seed 對應到的實際 family / shape / capType

- [ ] **Step 3: 驗證 — 下載按鈕**

點「下載拼接 PNG」:應下載一張 `regression-baseline.png`,打開後是 16 列、每列 2 張瓶子的拼接圖。
點「下載 specs.json」:應下載 `regression-specs.json`,JSON 結構為 `[{seed, spec}, ...]`。

- [ ] **Step 4: 建立第一份 baseline**

把這次下載的兩個檔存到一個 `baselines/` 子資料夾(手動 mkdir):
```
baselines/2026-05-07-baseline.png
baselines/2026-05-07-baseline.json
```

之後改規則前先存 new、跟 baseline 切換比對。

- [ ] **Step 5: Pause for review**

跟 user 說:「Task 11 完成,regression.html 跑起來了。請打開檢查 16 個 seed 的視覺,並下載 PNG / JSON 各一份建立 baseline。確認(a)頁面 layout 沒崩、(b)兩個下載按鈕都正常產出檔案、(c)整體 16 張圖示讓你滿意作為基準(若有任何一張看起來該改,告訴我,加新 task)。」

---

## Task 12: 收尾 — 最終視覺迴歸 + 介面 sanity check

**Files:** 不修改

純驗證任務。

- [ ] **Step 1: 主介面 smoke test**

打開 `index.html`:
1. type=any、size=32,點 generate ~10 次。確認每次都是合理的瓶子(或 sword/spear stub)。
2. type=potion、size=32,reroll seed 10 次。每次圖示明顯不同(色族 / 形狀 / 瓶塞 / 液面 / 高光位置 / 是否有 bubbles 或 label 都會變)。
3. type=potion、size=16,reroll seed 10 次。確認 16 版也跑得起來。
4. 在 seed 欄輸入「rusty-flask-42」,點 generate 兩次,圖示完全相同。
5. 點 batch_preview 內任一格,確認 seed 載入後主預覽顯示同樣圖示。
6. 點 PNG 下載,確認下載的是透明背景 32×32 PNG。

- [ ] **Step 2: regression.html sanity test**

打開 `regression.html`:
1. 16 個圖示載入正常。
2. 下載 PNG / JSON 都成功。
3. 16 個圖示中,每個色族至少出現一次(看 family 欄)。

- [ ] **Step 3: 硬約束複查**

在主介面試 ~5 個不同 seed,**用瀏覽器內建放大**(Ctrl/Cmd + +)放大 preview canvas,目視檢查:
- ✅ 每個瓶子的描邊全身連續、無斷點
- ✅ 像素是「方塊」而非「模糊邊」(整數對齊)
- ✅ 每張圖示主視覺色 ≤ 5(數一下)

- [ ] **Step 4: Pause for final review**

跟 user 說:「全部 12 個任務完成。請按 Step 1-3 的清單做最後 sanity check。如果有任何想調整的細節(色族取捨、瓶塞細節、高光位置等),可以直接告訴我開新迭代。」

---

## End of Plan

**已知後續迭代候選(本次不做):**
- 16 版 cloth_tied 視覺 fallback(若實測認不出 → 改 render 為 cork 樣式)
- 稀有度 tier:在 spec 加 `tier`,render 後再跑 outer-glow pass
- 新瓶型:葫蘆 / 雙瓶 / 三聯瓶
- `drawSword` / `drawSpear` 套同一個 spec→render pattern
