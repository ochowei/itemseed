# drawSword Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `drawSword` 從占位升級為 spec→render 兩階段的程序化規則,產出隨 seed 變化、像 RPG 道具的 32×32(主)/ 16×16(子集)劍圖示;沿用 potion 已建立的架構,palette / pixel-utils 直接共用,新增金屬色族與 sword 專屬 shape。

**Architecture:** 兩階段,沿用 potion pattern:`sampleSwordSpec(rng)` 把所有 RNG 集中於 sample 階段,輸出純資料 spec;`renderSwordSpec32` / `renderSwordSpec16` 是純函式,把 spec 渲染為像素。內部用 single enum mask(`'blade' | 'guard' | 'grip' | 'pommel' | null`)記錄形狀,所有 outline 透過共用的 `applyInsideOutlinePass` + `paintInternalSeams` 演算法保證連續。

**Tech Stack:** vanilla JS、HTML5 Canvas 2D、無 build tool、無 npm、無 test framework。

**Spec:** [`docs/superpowers/specs/2026-05-07-drawsword-design.md`](../specs/2026-05-07-drawsword-design.md)

---

## Project-Specific Notes

**Git repo:** 此專案是 git 倉。每個 task 結尾以 `git commit` 收束,訊息風格沿用既有(`feat(sword): ...` / `feat(palette): ...` / `docs: ...`)。

**No test framework:** 不引入任何 test 框架。驗證方式分兩類:
1. **Console-based**(資料 / 純函式):在瀏覽器打開 `index.html`(或 task 9 後切到 `regression.html`),F12 開 devtools,在 Console 貼指定表達式,比對輸出。
2. **Visual**(渲染結果):打開 `index.html`,選 type = sword,輸入指定 seed,點 Generate,用眼睛比對是否符合描述。Task 10 後可改用 `regression.html` 的 grid 一次看 ~16 張。

每個 task 的 verify 步驟會明確說是哪一種、要看什麼。

**File loading order:** `index.html` 與 `regression.html` 用一連串 `<script src=...>` 依序載入。新檔案 `sword.js` 須加進兩個 HTML,且順序在 `palette.js` / `pixel-utils.js` / `potion.js` 之後、`main.js` 之前。

**Hard constraints(任何 task 都不能違反):**
- 所有座標 / 寬 / 高為整數
- 每張圖示主視覺色 ≤ 6(outline + bladeMain + bladeShine + leather main + 至多 bladeShadow / leather shadow)
- 暗色描邊全身連續(由 `applyInsideOutlinePass` 演算法保證)
- 同 seed 永遠重現相同輸出(所有 RNG 集中於 `sampleSwordSpec`)

**Naming convention during build:** Task 2 在 sword.js 內部把對外函式命名為 `drawSwordV2` 並 export 為 `window.drawSwordV2`,**避免**跟 main.js 既有的 `drawSword` stub 撞名(JS 全域 function declaration 會互相覆蓋)。Task 9 才會把 stub 從 main.js 移除、把 sword.js 的 export 改名為 `window.drawSword`,讓 `ITEM_TYPES.sword` 指向新實作。同 pattern potion 用過。

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `random.js` | unchanged | seeded PRNG |
| `palette.js` | **MODIFY** | 既有 FAMILIES / samplePalette / CORK_PALETTE 不動;新增 `METAL_FAMILIES` / `sampleSwordPalette` / `LEATHER_PALETTE` |
| `pixel-utils.js` | unchanged | `paintInternalSeams` + `applyInsideOutlinePass` 直接共用 |
| `potion.js` | unchanged | 不動 |
| `sword.js` | **NEW** | `sampleSwordSpec`、`renderSwordSpec32`、`renderSwordSpec16`、shape silhouette 函式、所有 paint helpers、對外 `drawSword` |
| `main.js` | **MODIFY**(Task 9) | 移除 `drawSword` 占位 stub。`ITEM_TYPES.sword` 指向 sword.js 的新實作。`drawSpear` stub 維持不動 |
| `index.html` | **MODIFY** | 加 `<script src="sword.js">`(Task 2 加,但放對位置) |
| `regression.html` | **MODIFY**(Task 10) | 在現有 potion grid 之下新增 sword grid,擴充下載按鈕一次涵蓋兩種物品 |

---

## Task 1: 擴充 `palette.js` — 加金屬色族 + sword sampler + leather 常數

**Files:**
- Modify: `palette.js`

此 task 不改動 potion 既有功能(`FAMILIES` / `samplePalette` / `CORK_PALETTE` 完整保留)。

- [ ] **Step 1: 定義驗證目標**

預期能在 console 跑出:

```js
const r = new SeededRandom('test-metal-1');
const p = sampleSwordPalette(r);
console.log(p);
// 期望:{ family: <metal-name>, palette: { outline, bladeMain, bladeShadow, bladeShine } }
// 全部 4 色都是 7-char #RRGGBB

// 5 個金屬族都應該抽得到
const seen = new Set();
for (let i = 0; i < 80; i++) {
  seen.add(sampleSwordPalette(new SeededRandom('metal-' + i)).family);
}
console.log('metal families seen:', [...seen]);
// 期望:['steel', 'iron', 'bronze', 'gold', 'obsidian'] 全到

// LEATHER_PALETTE 直接讀
console.log(LEATHER_PALETTE);
// 期望:{ main: '#6a4828', shadow: '#3a2818', highlight: '#8a6840' }

// 重現性
const a = sampleSwordPalette(new SeededRandom('repro'));
const b = sampleSwordPalette(new SeededRandom('repro'));
console.log('reproducible:', JSON.stringify(a) === JSON.stringify(b));
```

- [ ] **Step 2: 在 `palette.js` 既有 `FAMILIES` 後面插入 `METAL_FAMILIES`**

找到:
```js
const FAMILIES = {
  ...
  shadow: { hue: [280, 320], sat: [40, 60], lightCenter: 35, weight: 1 },
};
```

在它**後面**插入(緊接著、`CORK_PALETTE` 之前):

```js
const METAL_FAMILIES = {
  steel:    { hue: [200, 220], sat: [10, 20], lightCenter: 65, weight: 3 },   // 中性灰藍,最常見
  iron:     { hue: [210, 230], sat: [5, 15],  lightCenter: 50, weight: 2 },   // 較暗
  bronze:   { hue: [30, 40],   sat: [40, 55], lightCenter: 55, weight: 1.5 }, // 暖黃褐
  gold:     { hue: [45, 55],   sat: [70, 85], lightCenter: 65, weight: 1 },   // 亮黃,稀有感
  obsidian: { hue: [270, 290], sat: [20, 30], lightCenter: 30, weight: 1 },   // 暗紫黑
};
```

- [ ] **Step 3: 在既有 `CORK_PALETTE` 後面插入 `LEATHER_PALETTE`**

找到:
```js
const CORK_PALETTE = {
  main:      '#8a5a2e',
  shadow:    '#5a3a1e',
  highlight: '#b88560',
};
```

在它後面插入:

```js
const LEATHER_PALETTE = {
  main:      '#6a4828',
  shadow:    '#3a2818',
  highlight: '#8a6840',
};
```

- [ ] **Step 4: 在既有 `samplePalette` 函式後面插入 `sampleSwordPalette`**

找到 `function samplePalette(rng) { ... }` 整個函式區塊,在它後面插入:

```js
/**
 * 從 RNG 抽一個金屬色族並推導 4 色 sword palette。
 * @returns {{ family: string, palette: { outline, bladeMain, bladeShadow, bladeShine } }}
 */
function sampleSwordPalette(rng) {
  const names = Object.keys(METAL_FAMILIES);
  const weights = names.map((n) => METAL_FAMILIES[n].weight);
  const familyName = rng.pickWeighted(names, weights);
  const fam = METAL_FAMILIES[familyName];

  const h = rng.randomFloat(fam.hue[0], fam.hue[1]);
  const s = rng.randomFloat(fam.sat[0], fam.sat[1]);
  const L = fam.lightCenter;

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

- [ ] **Step 5: 在檔案最末端的 `window.*` 區塊加 export**

找到:
```js
window.FAMILIES = FAMILIES;
window.CORK_PALETTE = CORK_PALETTE;
window.samplePalette = samplePalette;
window.hslToRgbHex = hslToRgbHex;
```

在後面加:

```js
window.METAL_FAMILIES = METAL_FAMILIES;
window.LEATHER_PALETTE = LEATHER_PALETTE;
window.sampleSwordPalette = sampleSwordPalette;
```

- [ ] **Step 6: 驗證**

打開 `index.html`,F12 console 貼 Step 1 的腳本。

期望:
- `p` 的 `palette` 含 4 鍵 `outline / bladeMain / bladeShadow / bladeShine`,每個都是 `#RRGGBB`
- `metal families seen` 包含全部 5 個族名
- `LEATHER_PALETTE` 印出 `{ main: '#6a4828', shadow: '#3a2818', highlight: '#8a6840' }`
- `reproducible: true`

也要確認 potion 沒壞:
```js
// potion sampler 仍應正常
const ps = samplePotionSpec(new SeededRandom('potion-still-works'));
console.log('potion family:', ps.family, 'shape:', ps.shape);
```

期望:看到一個合理的 potion family + shape(`fire/frost/...` × `flask/round/vial`)。

- [ ] **Step 7: Commit**

```bash
git add palette.js
git commit -m "feat(palette): metal families + sword palette sampler + leather constants"
```

---

## Task 2: 建立 `sword.js` 骨架 + `sampleSwordSpec`

**Files:**
- Create: `sword.js`
- Modify: `index.html`(加 script tag)

此 task 不修改 `main.js`,**對外不取代** `drawSword` 名稱(暫名 `drawSwordV2`,Task 9 才整合)。

- [ ] **Step 1: 定義驗證目標**

預期能在 console 跑出:

```js
const r = new SeededRandom('test-spec-1');
const spec = sampleSwordSpec(r);
console.log(spec);
// 期望:含 family, palette, archetype, guardStyle, pommelStyle,
//        hasGripWrap, hasFuller, gripWrapYs

// 限制檢查
const required = ['family','palette','archetype','guardStyle','pommelStyle',
                  'hasGripWrap','hasFuller','gripWrapYs'];
console.log('all keys present:', required.every(k => k in spec));

// curved 強制 hasFuller = false
console.log('curved-no-fuller invariant:',
  Array.from({length: 200}, (_, i) => sampleSwordSpec(new SeededRandom('cf-' + i)))
    .filter(s => s.archetype === 'curved')
    .every(s => s.hasFuller === false)
);

// gripWrapYs 結構合法
console.log('gripWrapYs valid:',
  Array.from({length: 200}, (_, i) => sampleSwordSpec(new SeededRandom('gw-' + i)))
    .every(s => {
      if (!s.hasGripWrap) return s.gripWrapYs.length === 0;
      if (s.gripWrapYs.length === 1) {
        const y = s.gripWrapYs[0];
        return y >= 22 && y <= 25;
      }
      if (s.gripWrapYs.length === 2) {
        const [a, b] = s.gripWrapYs;
        return a >= 22 && a <= 25 && b >= 22 && b <= 25 && Math.abs(a - b) >= 2;
      }
      return false;
    })
);

// 重現性
const a = sampleSwordSpec(new SeededRandom('repro'));
const b = sampleSwordSpec(new SeededRandom('repro'));
console.log('reproducible:', JSON.stringify(a) === JSON.stringify(b));
```

- [ ] **Step 2: 建立 `sword.js`**

完整檔案內容(把整個檔貼進去):

```js
// sword.js
// 兩階段架構:sampleSwordSpec(rng) → spec → renderSwordSpec32/16(ctx, spec)。
// 此檔最後 export 對外 drawSword(ctx, rng, size) 給 main.js 用。
// 沿用 potion 同模式,palette 由 sampleSwordPalette 提供。

// =====================================================================
// Sampler — 把所有 RNG 集中於此,輸出純資料 spec
// =====================================================================

const ARCHETYPES = ['straight', 'curved', 'broad'];
const ARCHETYPE_WEIGHTS = [3, 2, 1.5];
const GUARD_STYLES = ['bar', 'swept', 'disc'];
const POMMEL_STYLES = ['round', 'disk', 'gem'];

// hasGripWrap 為 true 時,2 條 wrap 的有效 y pair(避開 grip 上下 seam 列、且間隔 ≥ 2)。
// grip y=21..26 → 有效 wrap y 範圍 [22..25]
const WRAP_PAIRS = [[22, 24], [22, 25], [23, 25]];

function sampleSwordSpec(rng) {
  const { family, palette } = sampleSwordPalette(rng);
  const archetype = rng.pickWeighted(ARCHETYPES, ARCHETYPE_WEIGHTS);
  const guardStyle = rng.pick(GUARD_STYLES);
  const pommelStyle = rng.pick(POMMEL_STYLES);
  const hasGripWrap = rng.chance(0.5);
  // curved 中軸隨 row 漂移,fuller 線會 zig-zag,強制關閉
  const hasFuller = (archetype !== 'curved') && rng.chance(0.4);

  // sample 階段就決定 wrap 帶位置,確保 render 是純函式
  const gripWrapYs = [];
  if (hasGripWrap) {
    if (rng.chance(0.5)) {
      // 1 條 wrap
      gripWrapYs.push(rng.randomInt(22, 25));
    } else {
      // 2 條 wrap,從合法 pair 三選一
      const pair = rng.pick(WRAP_PAIRS);
      gripWrapYs.push(pair[0], pair[1]);
    }
  }

  return {
    family,
    palette,
    archetype,
    guardStyle,
    pommelStyle,
    hasGripWrap,
    hasFuller,
    gripWrapYs,
  };
}

// =====================================================================
// Renderer — 純函式,不再使用 RNG;Task 4+ 補完
// =====================================================================

function renderSwordSpec32(ctx, spec) {
  // TODO Task 4: 實作
}

function renderSwordSpec16(ctx, spec) {
  // TODO Task 8: 實作
}

// =====================================================================
// 對外:drawSword(ctx, rng, size)
// 暫名 drawSwordV2 避免跟 main.js 既有 stub 撞名;Task 9 才取代。
// =====================================================================

function drawSwordImpl(ctx, rng, size) {
  const spec = sampleSwordSpec(rng);
  if (size === 32) renderSwordSpec32(ctx, spec);
  else if (size === 16) renderSwordSpec16(ctx, spec);
}

window.sampleSwordSpec = sampleSwordSpec;
window.renderSwordSpec32 = renderSwordSpec32;
window.renderSwordSpec16 = renderSwordSpec16;
window.drawSwordV2 = drawSwordImpl;  // Task 9 改成 window.drawSword
```

- [ ] **Step 3: 在 `index.html` 加 script tag**

找到 script 區塊:
```html
<script src="random.js"></script>
<script src="palette.js"></script>
<script src="pixel-utils.js"></script>
<script src="potion.js"></script>
<script src="main.js"></script>
```

改成(在 potion.js 後、main.js 前插入 sword.js):
```html
<script src="random.js"></script>
<script src="palette.js"></script>
<script src="pixel-utils.js"></script>
<script src="potion.js"></script>
<script src="sword.js"></script>
<script src="main.js"></script>
```

- [ ] **Step 4: 驗證**

打開 `index.html`,F12 console 貼 Step 1 的腳本。

期望:
- `spec` 印出含 8 個 key
- `all keys present: true`
- `curved-no-fuller invariant: true`
- `gripWrapYs valid: true`
- `reproducible: true`

確認 main.js stub 沒被影響(目前選 sword 仍會走 main.js stub,畫粗糙劍):
- 在 UI 選 type = sword,size = 32,seed 任意,點 Generate
- 預期:看到 main.js 既有的 stub 劍(細刀身 + 棕護手 + 棕握把),不是空白也不是新的 sword 圖示

- [ ] **Step 5: Commit**

```bash
git add sword.js index.html
git commit -m "feat(sword): skeleton + sampleSwordSpec sampler"
```

---

## Task 3: 32×32 archetype shape silhouette 函式

**Files:**
- Modify: `sword.js`(在 sampler 後、renderer 前插入 shape 函式區)

此 task 結束後,3 個 archetype 的 shape 函式可被 console 呼叫並回傳 row 結構;但 render 還沒整合,UI 看不到差異。

- [ ] **Step 1: 定義驗證目標**

預期能在 console 跑出:

```js
const sStraight = SHAPE_FNS_32.straight();
const sCurved   = SHAPE_FNS_32.curved();
const sBroad    = SHAPE_FNS_32.broad();

// straight 結構檢查
console.log('straight tip y=2:', sStraight.rows[2]);   // 期望 { leftX:16, rightX:16, kind:'blade' }
console.log('straight body y=10:', sStraight.rows[10]); // 期望 { leftX:15, rightX:17, kind:'blade' }
console.log('straight outside y=20:', sStraight.rows[20]); // 期望 null(blade 不到 y=20)

// broad 結構檢查
console.log('broad body y=10:', sBroad.rows[10]);  // 期望 { leftX:14, rightX:18, kind:'blade' }(寬 5)

// curved 結構檢查 — tip 偏右
console.log('curved tip y=2:', sCurved.rows[2]);   // 期望 { leftX:18, rightX:18, kind:'blade' }
console.log('curved y=18:',   sCurved.rows[18]);   // 期望 { leftX:15, rightX:17, kind:'blade' }(底端對齊 cx)
console.log('curved y=10:',   sCurved.rows[10]);   // 期望 { leftX:16, rightX:18, kind:'blade' }(中段 offset=1)

// 整數檢查
console.log('all integers:',
  [sStraight, sCurved, sBroad].every(s =>
    s.rows.every(r => r === null ||
      (Number.isInteger(r.leftX) && Number.isInteger(r.rightX)))
  )
);
```

- [ ] **Step 2: 在 `sword.js` 插入 shape 函式區**

在 `function sampleSwordSpec(...)` 之後、`function renderSwordSpec32(...)` 之前,插入:

```js
// =====================================================================
// Shape silhouette functions (32×32)
//
// 每個 archetype 是一個 () → { rows: Array<{leftX, rightX, kind:'blade'} | null> }
// 描繪 blade 外輪廓。整數座標,中心對齊 cx=16。
// 注意:silhouette 是「未咬掉外圍 outline 之前」的形狀;outline pass 會吃掉外圈 1px。
//
// 整體垂直配置(此 task 只做 blade,後續 task 加 guard/grip/pommel):
//   y=0..1   padding
//   y=2..18  blade  (17 rows)
//   y=19..20 guard
//   y=21..26 grip
//   y=27..29 pommel
//   y=30..31 padding
// =====================================================================

function shapeStraight32() {
  // 雙刃直劍:width 3,tip 1px
  const rows = new Array(32).fill(null);
  const cx = 16;
  rows[2] = { leftX: cx,     rightX: cx,     kind: 'blade' };  // tip 1px
  rows[3] = { leftX: cx - 1, rightX: cx + 1, kind: 'blade' };  // taper
  for (let y = 4; y <= 18; y++) {
    rows[y] = { leftX: cx - 1, rightX: cx + 1, kind: 'blade' };
  }
  return { rows };
}

function shapeBroad32() {
  // 寬刃厚劍:width 5,tip 1px,2 列 taper
  const rows = new Array(32).fill(null);
  const cx = 16;
  rows[2] = { leftX: cx,     rightX: cx,     kind: 'blade' };  // tip 1px
  rows[3] = { leftX: cx - 1, rightX: cx + 1, kind: 'blade' };  // taper 1
  rows[4] = { leftX: cx - 2, rightX: cx + 2, kind: 'blade' };  // taper 2
  for (let y = 5; y <= 18; y++) {
    rows[y] = { leftX: cx - 2, rightX: cx + 2, kind: 'blade' };
  }
  return { rows };
}

function shapeCurved32() {
  // 單刃彎刀:width 3,tip 偏右 cx+2,中心線線性過渡到 cx
  // offset(y) = round(2 * (18 - y) / (18 - 4)),範圍 y=4..18,offset 從 2 到 0
  const rows = new Array(32).fill(null);
  const cx = 16;
  rows[2] = { leftX: cx + 2, rightX: cx + 2, kind: 'blade' };  // tip 1px,偏右 2
  rows[3] = { leftX: cx + 1, rightX: cx + 2, kind: 'blade' };  // taper
  for (let y = 4; y <= 18; y++) {
    const offset = Math.round(2 * (18 - y) / (18 - 4));
    rows[y] = {
      leftX:  cx + offset - 1,
      rightX: cx + offset + 1,
      kind: 'blade',
    };
  }
  return { rows };
}

const SHAPE_FNS_32 = {
  straight: shapeStraight32,
  curved:   shapeCurved32,
  broad:    shapeBroad32,
};
```

- [ ] **Step 3: 驗證**

重新整理 `index.html`(F5),console 貼 Step 1 的腳本。

期望輸出:
- `straight tip y=2: { leftX: 16, rightX: 16, kind: 'blade' }`
- `straight body y=10: { leftX: 15, rightX: 17, kind: 'blade' }`
- `straight outside y=20: null`
- `broad body y=10: { leftX: 14, rightX: 18, kind: 'blade' }`
- `curved tip y=2: { leftX: 18, rightX: 18, kind: 'blade' }`
- `curved y=18: { leftX: 15, rightX: 17, kind: 'blade' }`
- `curved y=10: { leftX: 16, rightX: 18, kind: 'blade' }`(offset=1,範圍 cx+0..cx+2)
- `all integers: true`

- [ ] **Step 4: Commit**

```bash
git add sword.js
git commit -m "feat(sword): 32x32 archetype shape silhouettes (straight/curved/broad)"
```

---

## Task 4: 32×32 `buildSilhouetteMask32` + 第一輪可見 render

**Files:**
- Modify: `sword.js`(加 mask builder、實作 renderSwordSpec32 基本 pipeline)

此 task 結束時,`renderSwordSpec32` 會產出**只有 silhouette 主色 + outline + seam** 的劍(沒有 shine、沒有 fuller、沒有 wrap、沒有 gem)。但 4 部位(blade / guard / grip / pommel)都看得到、形狀可辨識為 straight / curved / broad。

- [ ] **Step 1: 定義驗證目標**

console 跑(畫到臨時 canvas,看 dataURL):

```js
function preview32(seed) {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const cx = c.getContext('2d');
  drawSwordV2(cx, new SeededRandom(seed), 32);
  return c.toDataURL();
}
console.log('straight?', preview32('s-straight-1'));
console.log('curved?',   preview32('s-curved-1'));
console.log('broad?',    preview32('s-broad-1'));
// 開新分頁放大(瀏覽器原生放大 5x+ 即可),期望:
//   - 看到劍的 silhouette:上面是 blade,中間 guard 橫條,下面 grip + pommel
//   - 整把劍有黑色外圈描邊
//   - blade↔guard、guard↔grip、grip↔pommel 之間有黑色 seam 分隔
//   - blade 主體是金屬色(灰/銅/金/暗等)、grip 是棕色
//   - 沒有高光、沒有溝槽、沒有寶石(這些 Task 5/6 才加)
// 注意:seed 抽到的 archetype 不一定跟名字對得上;若印出來不是想看的 archetype,多試幾個 seed
```

可以額外 console 看 spec:
```js
const r = new SeededRandom('s-straight-1');
const spec = sampleSwordSpec(r);
console.log('expected archetype:', spec.archetype, 'guardStyle:', spec.guardStyle, 'pommelStyle:', spec.pommelStyle);
```

- [ ] **Step 2: 在 `sword.js` 插入 `buildSilhouetteMask32`**

在 `SHAPE_FNS_32` 常數**後面**、`function renderSwordSpec32(...)` 前面,插入:

```js
// =====================================================================
// Mask builder (32×32) — 把 spec 轉成 enum mask
//
// mask cell ∈ { 'blade' | 'guard' | 'grip' | 'pommel' | null }
// 整體配置在 spec 設計文件 §4.1。
// =====================================================================

function buildSilhouetteMask32(spec) {
  const size = 32;
  const mask = allocateMask(size);
  const cx = 16;

  // ── Blade ──
  const shape = SHAPE_FNS_32[spec.archetype]();
  for (let y = 0; y < size; y++) {
    const r = shape.rows[y];
    if (!r) continue;
    for (let x = r.leftX; x <= r.rightX; x++) {
      maskSet(mask, size, x, y, 'blade');
    }
  }

  // ── Guard (y=19..20, 2 列) ── 寬度與形狀依 guardStyle
  // 每個 guardStyle 提供 [y19_left, y19_right, y20_left, y20_right](inclusive)。
  const guardRanges = {
    bar:   [cx - 3, cx + 3, cx - 3, cx + 3],  // 2 列同寬 7
    swept: [cx - 2, cx + 2, cx - 3, cx + 3],  // y=19 寬 5,y=20 寬 7(下層展開)
    disc:  [cx - 3, cx + 3, cx - 4, cx + 4],  // y=19 寬 7,y=20 寬 9(中下凸)
  };
  const [g19l, g19r, g20l, g20r] = guardRanges[spec.guardStyle];
  for (let x = g19l; x <= g19r; x++) maskSet(mask, size, x, 19, 'guard');
  for (let x = g20l; x <= g20r; x++) maskSet(mask, size, x, 20, 'guard');

  // ── Grip (y=21..26, 6 列, width 3) ──
  for (let y = 21; y <= 26; y++) {
    for (let x = cx - 1; x <= cx + 1; x++) {
      maskSet(mask, size, x, y, 'grip');
    }
  }

  // ── Pommel (y=27..29, 3 列) ── 寬度依 pommelStyle
  // round / gem 都用 width 3(cx-1..cx+1);disk 用 width 5(cx-2..cx+2)
  const pommelHalfW = (spec.pommelStyle === 'disk') ? 2 : 1;
  for (let y = 27; y <= 29; y++) {
    for (let x = cx - pommelHalfW; x <= cx + pommelHalfW; x++) {
      maskSet(mask, size, x, y, 'pommel');
    }
  }

  return mask;
}
```

- [ ] **Step 3: 實作 `renderSwordSpec32`(基本 pipeline,沒有裝飾)**

把 sword.js 內既有的:
```js
function renderSwordSpec32(ctx, spec) {
  // TODO Task 4: 實作
}
```

替換為:

```js
function renderSwordSpec32(ctx, spec) {
  const size = 32;
  ctx.clearRect(0, 0, size, size);

  const mask = buildSilhouetteMask32(spec);

  // step 2: 平鋪主色
  paintMaskByEnum(ctx, mask, size, {
    blade:  spec.palette.bladeMain,
    guard:  spec.palette.bladeMain,    // 同金屬色
    pommel: spec.palette.bladeMain,    // 同金屬色
    grip:   LEATHER_PALETTE.main,
  });

  // step 3-6 裝飾(Task 5、6 補)
  // (none yet)

  // step 7: internal seam
  paintInternalSeams(ctx, mask, size, spec.palette.outline);

  // step 8: 外圈 outline
  applyInsideOutlinePass(ctx, mask, size, spec.palette.outline);
}
```

- [ ] **Step 4: 驗證**

重新整理 `index.html`,console 貼 Step 1 的腳本。

期望:把 3 個 dataURL 開新分頁放大檢視:
- 每張都看得到一把劍的形狀
- blade 在上、guard 中間橫條、grip 下面細條、pommel 最底
- 整把劍有完整黑色外圈
- blade 內部一條金屬色;guard 內部一條金屬色(可能跟 blade 同色,因為都用 bladeMain),被 seam 線跟 blade 分開;grip 中間是棕色 1 px 條
- 不同 seed 得到的 guard 寬度應該不同(swept / bar / disc 對應不同寬)

也可以直接在 UI 試(注意:此時 main.js 仍指向 stub):用 console 直接畫:
```js
const cv = document.getElementById('preview-canvas');
const tmp = document.createElement('canvas');
tmp.width = 32; tmp.height = 32;
drawSwordV2(tmp.getContext('2d'), new SeededRandom('demo'), 32);
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;
ctx.clearRect(0, 0, cv.width, cv.height);
ctx.drawImage(tmp, 0, 0, cv.width, cv.height);
```
看 main 預覽框會出現新的 sword silhouette(覆蓋 main.js stub)。

- [ ] **Step 5: Commit**

```bash
git add sword.js
git commit -m "feat(sword): 32x32 mask builder + base render pipeline (silhouette + outline + seam)"
```

---

## Task 5: 32×32 always-on `paintBladeShine32`

**Files:**
- Modify: `sword.js`(加 paint helper、wire 進 pipeline)

此 task 結束時,所有 sword 都會有「金屬光澤」高光線。

- [ ] **Step 1: 定義驗證目標**

console 貼:
```js
function preview32(seed) {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const cx = c.getContext('2d');
  drawSwordV2(cx, new SeededRandom(seed), 32);
  return c.toDataURL();
}
// 找到 archetype 各為 straight / broad / curved 的 seed
// (用 sampleSwordSpec 篩選)
function findSeedFor(archetype, prefix) {
  for (let i = 0; i < 200; i++) {
    const s = sampleSwordSpec(new SeededRandom(prefix + i));
    if (s.archetype === archetype) return prefix + i;
  }
  return null;
}
const sStr = findSeedFor('straight', 'shine-s-');
const sBro = findSeedFor('broad',    'shine-b-');
const sCur = findSeedFor('curved',   'shine-c-');
console.log('straight:', sStr, preview32(sStr));
console.log('broad:',    sBro, preview32(sBro));
console.log('curved:',   sCur, preview32(sCur));
// 期望:每張刀身上有一條淺色高光縱線
//   - straight:中軸 cx 一條,跨 12 列
//   - broad:cx-1 一條,跨 13 列(blade 主色仍能在 cx, cx+1 看到)
//   - curved:沿刀身中軸,線會跟著刀身彎曲位移
```

- [ ] **Step 2: 在 `sword.js` 加入 paint helper(`renderSwordSpec32` 上方)**

在 `function renderSwordSpec32(...)` 上方插入:

```js
// =====================================================================
// Paint helpers (32×32) — 純像素操作,讀 spec + mask 產生裝飾
// =====================================================================

/** 只在指定 cell 為 'blade' 時才畫;避免畫到 guard / 外面 */
function tryPaintBladeCell32(ctx, mask, size, x, y) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  if (mask[y * size + x] !== 'blade') return;
  ctx.fillRect(x, y, 1, 1);
}

/**
 * Always-on blade shine。1px 縱線。
 * - straight:cx,y=4..15
 * - broad:cx-1(blade 內側最左 column),y=4..16
 * - curved:每列從 shape.rows[y] 算 xCenter,y=4..15
 */
function paintBladeShine32(ctx, mask, size, spec) {
  ctx.fillStyle = spec.palette.bladeShine;
  const cx = 16;

  if (spec.archetype === 'straight') {
    for (let y = 4; y <= 15; y++) {
      tryPaintBladeCell32(ctx, mask, size, cx, y);
    }
    return;
  }

  if (spec.archetype === 'broad') {
    for (let y = 4; y <= 16; y++) {
      tryPaintBladeCell32(ctx, mask, size, cx - 1, y);
    }
    return;
  }

  if (spec.archetype === 'curved') {
    const shape = SHAPE_FNS_32.curved();
    for (let y = 4; y <= 15; y++) {
      const r = shape.rows[y];
      if (!r) continue;
      const xCenter = Math.round((r.leftX + r.rightX) / 2);
      tryPaintBladeCell32(ctx, mask, size, xCenter, y);
    }
    return;
  }
}
```

- [ ] **Step 3: 把 `paintBladeShine32` wire 進 `renderSwordSpec32`**

找到 Task 4 寫進去的 `renderSwordSpec32`:
```js
  // step 3-6 裝飾(Task 5、6 補)
  // (none yet)

  // step 7: internal seam
  paintInternalSeams(ctx, mask, size, spec.palette.outline);
```

替換為:
```js
  // step 3 裝飾(Task 6 補 grip wrap)
  // step 4: blade shine(always-on)
  paintBladeShine32(ctx, mask, size, spec);
  // step 5-6 裝飾(Task 6 補 fuller / gem)

  // step 7: internal seam
  paintInternalSeams(ctx, mask, size, spec.palette.outline);
```

- [ ] **Step 4: 驗證**

重新整理 `index.html`,console 貼 Step 1 腳本。

期望:把 3 個 dataURL 開新分頁放大:
- straight:看到 blade 中央有一條淺色(bladeShine)直線,跨度約 12 列
- broad:看到 blade **左側** 1 px 處(不是中央)有一條淺色直線
- curved:看到 blade 主軸上有淺色線,但會跟著刀身的曲線「歪」過去(上半偏右、下半向 cx 收)

如果 shine 不見:常見原因是 shine 寫在 outline ring 上而被 step 8 蓋掉。檢查 paintBladeShine32 內 x 是否確實是 interior column(straight=cx 而非 cx-1;broad=cx-1 而非 cx-2)。

- [ ] **Step 5: Commit**

```bash
git add sword.js
git commit -m "feat(sword): always-on blade shine (32x32)"
```

---

## Task 6: 32×32 條件裝飾 — fuller + gripWrap + gem

**Files:**
- Modify: `sword.js`(加 3 個 paint helpers、wire 進 pipeline)

此 task 結束時,`hasFuller` / `hasGripWrap` / `pommelStyle === 'gem'` 三個條件都會在 32×32 上產生對應視覺。

- [ ] **Step 1: 定義驗證目標**

console 貼:
```js
// 找到觸發各裝飾的 seed
function findSeedWith(predicate, prefix) {
  for (let i = 0; i < 500; i++) {
    const s = sampleSwordSpec(new SeededRandom(prefix + i));
    if (predicate(s)) return { seed: prefix + i, spec: s };
  }
  return null;
}
const fullerStraight = findSeedWith(s => s.hasFuller && s.archetype === 'straight', 'fs-');
const fullerBroad    = findSeedWith(s => s.hasFuller && s.archetype === 'broad',    'fb-');
const wrap2          = findSeedWith(s => s.hasGripWrap && s.gripWrapYs.length === 2, 'w2-');
const wrap1          = findSeedWith(s => s.hasGripWrap && s.gripWrapYs.length === 1, 'w1-');
const gemSword       = findSeedWith(s => s.pommelStyle === 'gem', 'gm-');

function preview32(seed) {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  drawSwordV2(c.getContext('2d'), new SeededRandom(seed), 32);
  return c.toDataURL();
}
console.log('straight + fuller:', fullerStraight, preview32(fullerStraight.seed));
// 期望:blade 中央 cx 變成較暗色(bladeShadow);straight 同時 shine 被覆蓋
console.log('broad + fuller:', fullerBroad, preview32(fullerBroad.seed));
// 期望:blade 中央 cx 是較暗色(fuller),cx-1 仍是淺色(shine)— 兩者共存
console.log('wrap 2 條:', wrap2, preview32(wrap2.seed));
// 期望:grip 中段(cx, y=22..25 之中的兩個 y)看到 2 個比 LEATHER 主色更暗的點
console.log('wrap 1 條:', wrap1, preview32(wrap1.seed));
// 期望:grip 中段 1 個暗點
console.log('gem pommel:', gemSword, preview32(gemSword.seed));
// 期望:pommel 中央 (cx, 28) 1 px 為較亮色(bladeShine)
```

- [ ] **Step 2: 在 `sword.js` 既有 `paintBladeShine32` 後加入 3 個 paint helpers**

在 Task 5 加的 `paintBladeShine32` 函式之後,插入:

```js
/**
 * 條件裝飾:fuller(刀身中軸溝槽)。
 * curved 強制 false;straight + broad 在 cx 中軸畫 1px bladeShadow 縱線。
 * 範圍 y=4..16,故意比 blade 全長短 ~2px,讓 tip 與 hilt 端不畫,看起來像真實溝槽中段。
 *
 * 與 shine 互動:
 * - straight 寬 3,fuller 在 cx,shine 也在 cx,fuller 後畫故覆蓋 shine,結果為較暗刀身(刻意)。
 * - broad 寬 5,shine 在 cx-1 / fuller 在 cx,各佔不同 column 共存。
 */
function paintFuller32(ctx, mask, size, spec) {
  if (!spec.hasFuller) return;
  if (spec.archetype === 'curved') return;
  ctx.fillStyle = spec.palette.bladeShadow;
  const cx = 16;
  for (let y = 4; y <= 16; y++) {
    if (mask[y * size + cx] !== 'blade') continue;
    ctx.fillRect(cx, y, 1, 1);
  }
}

/**
 * 條件裝飾:grip wrap。
 * spec.gripWrapYs 由 sample 階段決定(0、1 或 2 條,y 範圍 [22..25])。
 * 每條 wrap 畫 grip 寬整列 LEATHER_PALETTE.shadow,但只有 (cx, y) 不會被
 * 後續 outline pass 覆蓋,實際視覺是 1 px 暗點。
 */
function paintGripWrap32(ctx, mask, size, spec) {
  if (!spec.hasGripWrap) return;
  ctx.fillStyle = LEATHER_PALETTE.shadow;
  const cx = 16;
  for (const y of spec.gripWrapYs) {
    for (let x = cx - 1; x <= cx + 1; x++) {
      if (mask[y * size + x] !== 'grip') continue;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

/**
 * 條件裝飾:pommel gem。
 * spec.pommelStyle === 'gem' 才畫,座標固定 (cx=16, y=28)— 即 pommel 3 列高的中間列、
 * 中央 cell,經 outline + seam pass 不會被覆蓋(interior 條件成立)。
 */
function paintGem32(ctx, mask, size, spec) {
  if (spec.pommelStyle !== 'gem') return;
  const cx = 16, gemY = 28;
  if (mask[gemY * size + cx] !== 'pommel') return;
  ctx.fillStyle = spec.palette.bladeShine;
  ctx.fillRect(cx, gemY, 1, 1);
}
```

- [ ] **Step 3: 把 3 個 helper wire 進 `renderSwordSpec32`(順序對齊 spec §3 pipeline)**

找到 Task 5 改完的 renderSwordSpec32:
```js
  // step 3 裝飾(Task 6 補 grip wrap)
  // step 4: blade shine(always-on)
  paintBladeShine32(ctx, mask, size, spec);
  // step 5-6 裝飾(Task 6 補 fuller / gem)

  // step 7: internal seam
```

替換為:
```js
  // step 3: grip wrap
  paintGripWrap32(ctx, mask, size, spec);
  // step 4: blade shine(always-on)
  paintBladeShine32(ctx, mask, size, spec);
  // step 5: fuller(在 shine 之後,讓 straight + fuller 時 fuller 覆蓋 shine)
  paintFuller32(ctx, mask, size, spec);
  // step 6: gem
  paintGem32(ctx, mask, size, spec);

  // step 7: internal seam
```

- [ ] **Step 4: 驗證**

重新整理 `index.html`,console 貼 Step 1 腳本。

期望:把 5 個 dataURL 各別開新分頁放大檢視:
1. **straight + fuller**:blade 中央 cx 跨 y=4..16 變成較暗色(`bladeShadow`),原 shine 被覆蓋,blade 看起來「樸素 / 較暗」。
2. **broad + fuller**:blade 中央 cx 變暗、左側 cx-1 仍亮,**兩條縱線並列**(暗 fuller + 亮 shine)。
3. **wrap 2 條**:grip 中段(`cx=16` y=22..25 範圍內)有 2 個 1×1 暗點,間隔 ≥ 2 列。
4. **wrap 1 條**:grip 中段 1 個 1×1 暗點。
5. **gem pommel**:pommel 中央 (16, 28) 1 px 是亮色(`bladeShine`),從 round 形變成「中央有寶石的圓珠」。

額外確認:之前 Task 4 / 5 的視覺基礎(silhouette + outline + shine)沒有壞。

- [ ] **Step 5: Commit**

```bash
git add sword.js
git commit -m "feat(sword): 32x32 conditional decorations (fuller / grip wrap / gem)"
```

---

## Task 7: 16×16 archetype shape silhouette 函式

**Files:**
- Modify: `sword.js`(在 32 shape 區之後、`buildSilhouetteMask32` 之前插入 16 shape 區)

此 task 結束後,3 個 archetype 的 16×16 shape 函式可被 console 呼叫並回傳 row 結構;render 16 還沒整合,UI 看不到差異。

- [ ] **Step 1: 定義驗證目標**

console 貼:
```js
const sStraight = SHAPE_FNS_16.straight();
const sBroad    = SHAPE_FNS_16.broad();
const sCurved   = SHAPE_FNS_16.curved();

console.log('straight 16 tip y=1:', sStraight.rows[1]);   // { leftX:8, rightX:8, kind:'blade' }
console.log('straight 16 body y=5:', sStraight.rows[5]);  // { leftX:7, rightX:9, kind:'blade' }(寬 3)

console.log('broad 16 tip y=1:', sBroad.rows[1]);          // { leftX:8, rightX:8 }
console.log('broad 16 taper y=2:', sBroad.rows[2]);        // { leftX:7, rightX:9 }(寬 3)
console.log('broad 16 body y=5:', sBroad.rows[5]);         // { leftX:6, rightX:10 }(寬 5)

console.log('curved 16 tip y=1:', sCurved.rows[1]);        // { leftX:9, rightX:9 }(偏右 1)
console.log('curved 16 y=2:', sCurved.rows[2]);            // { leftX:8, rightX:9 }(寬 2 過渡)
console.log('curved 16 y=3:', sCurved.rows[3]);            // { leftX:7, rightX:9 }(寬 3 對齊)
console.log('curved 16 y=5:', sCurved.rows[5]);            // { leftX:7, rightX:9 }(寬 3 對齊)

console.log('all integers:',
  [sStraight, sBroad, sCurved].every(s =>
    s.rows.every(r => r === null ||
      (Number.isInteger(r.leftX) && Number.isInteger(r.rightX)))
  )
);
```

- [ ] **Step 2: 在 `sword.js` 既有 `SHAPE_FNS_32` 常數**之後**(`buildSilhouetteMask32` 之前)插入 16 shape 區**

```js
// =====================================================================
// Shape silhouette functions (16×16) — 子集,專為 16 解析度重新設計(非縮放)
//
// 整體垂直配置:
//   y=0      padding
//   y=1      blade tip
//   y=2..9   blade body (8 rows)
//   y=10     guard
//   y=11..13 grip
//   y=14     pommel
//   y=15     padding
// =====================================================================

function shapeStraight16() {
  // 直劍 16:width 3
  const rows = new Array(16).fill(null);
  const cx = 8;
  rows[1] = { leftX: cx, rightX: cx, kind: 'blade' };  // tip
  for (let y = 2; y <= 9; y++) {
    rows[y] = { leftX: cx - 1, rightX: cx + 1, kind: 'blade' };
  }
  return { rows };
}

function shapeBroad16() {
  // 寬刃 16:width 5
  const rows = new Array(16).fill(null);
  const cx = 8;
  rows[1] = { leftX: cx,     rightX: cx,     kind: 'blade' };  // tip
  rows[2] = { leftX: cx - 1, rightX: cx + 1, kind: 'blade' };  // taper
  for (let y = 3; y <= 9; y++) {
    rows[y] = { leftX: cx - 2, rightX: cx + 2, kind: 'blade' };
  }
  return { rows };
}

function shapeCurved16() {
  // 彎刀 16:tip 偏右 1px,3 列轉到中軸
  const rows = new Array(16).fill(null);
  const cx = 8;
  rows[1] = { leftX: cx + 1, rightX: cx + 1, kind: 'blade' };  // tip 偏右 1
  rows[2] = { leftX: cx,     rightX: cx + 1, kind: 'blade' };  // 寬 2 過渡
  rows[3] = { leftX: cx - 1, rightX: cx + 1, kind: 'blade' };  // 寬 3 對齊
  for (let y = 4; y <= 9; y++) {
    rows[y] = { leftX: cx - 1, rightX: cx + 1, kind: 'blade' };
  }
  return { rows };
}

const SHAPE_FNS_16 = {
  straight: shapeStraight16,
  curved:   shapeCurved16,
  broad:    shapeBroad16,
};
```

- [ ] **Step 3: 驗證**

重新整理 `index.html`,console 貼 Step 1 腳本。

期望:全部結構 console.log 跟註解符合,`all integers: true`。

- [ ] **Step 4: Commit**

```bash
git add sword.js
git commit -m "feat(sword): 16x16 archetype shape silhouettes"
```

---

## Task 8: 16×16 `buildSilhouetteMask16` + `renderSwordSpec16` + 16 shine

**Files:**
- Modify: `sword.js`(加 16 mask builder、16 shine helper、實作 renderSwordSpec16)

此 task 結束時,16×16 的劍能完整渲染:silhouette + shine + outline + seam,16 collapse 規則(swept→bar、gem→round)生效,16 不畫 fuller / wrap。

- [ ] **Step 1: 定義驗證目標**

console 貼:
```js
function preview16(seed) {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 16;
  drawSwordV2(c.getContext('2d'), new SeededRandom(seed), 16);
  return c.toDataURL();
}
function findSeedFor(archetype, prefix) {
  for (let i = 0; i < 200; i++) {
    const s = sampleSwordSpec(new SeededRandom(prefix + i));
    if (s.archetype === archetype) return prefix + i;
  }
  return null;
}
console.log('16 straight:', preview16(findSeedFor('straight', '16s-')));
console.log('16 broad:',    preview16(findSeedFor('broad',    '16b-')));
console.log('16 curved:',   preview16(findSeedFor('curved',   '16c-')));

// 也比對同 seed 的 32 跟 16(palette 共用,看起來該是「同色族但小張」)
const seed = '16-vs-32';
const c32 = document.createElement('canvas'); c32.width = 32; c32.height = 32;
drawSwordV2(c32.getContext('2d'), new SeededRandom(seed), 32);
const c16 = document.createElement('canvas'); c16.width = 16; c16.height = 16;
drawSwordV2(c16.getContext('2d'), new SeededRandom(seed), 16);
console.log('32:', c32.toDataURL());
console.log('16:', c16.toDataURL());
```

期望(放大檢視 dataURL):
- 3 個 archetype 在 16 上仍能讀為「劍」:blade 上、guard 中橫條、grip 細條、pommel 末端
- 16 也有 blade shine(較短的高光線)
- 同 seed 32 / 16 兩張用同金屬色族(整體色調相同)
- 16 沒有 fuller(中央暗線)、沒有 grip wrap(暗點)、gem 也不會在 pommel 看到亮點(`gem` 16 collapse 成 round)

- [ ] **Step 2: 在 `sword.js` 既有 `buildSilhouetteMask32` 後插入 `buildSilhouetteMask16`**

```js
// =====================================================================
// Mask builder (16×16) — 共用 spec,但內部 collapse 16 不支援的 axis
//
// 16 collapse 規則(per spec §6.3 / §6.5):
//   guardStyle 'swept' → 走 'bar' 同寬
//   pommelStyle 'gem'  → 走 'round' 同形(無 highlight)
// 不污染 spec(spec 仍標 swept / gem)。
// =====================================================================

function buildSilhouetteMask16(spec) {
  const size = 16;
  const mask = allocateMask(size);
  const cx = 8;

  // ── Blade ──
  const shape = SHAPE_FNS_16[spec.archetype]();
  for (let y = 0; y < size; y++) {
    const r = shape.rows[y];
    if (!r) continue;
    for (let x = r.leftX; x <= r.rightX; x++) {
      maskSet(mask, size, x, y, 'blade');
    }
  }

  // ── Guard (y=10, 1 列) ──
  // bar / swept 都走 width 5;disc 走 width 6 (cx-3..cx+2,非對稱)
  let gLeft, gRight;
  if (spec.guardStyle === 'disc') {
    gLeft = cx - 3; gRight = cx + 2;
  } else {
    // bar 與 swept(collapse)
    gLeft = cx - 2; gRight = cx + 2;
  }
  for (let x = gLeft; x <= gRight; x++) {
    maskSet(mask, size, x, 10, 'guard');
  }

  // ── Grip (y=11..13, width 3) ──
  for (let y = 11; y <= 13; y++) {
    for (let x = cx - 1; x <= cx + 1; x++) {
      maskSet(mask, size, x, y, 'grip');
    }
  }

  // ── Pommel (y=14, 1 列) ──
  // round / gem 走 width 1;disk 走 width 3
  const pommelHalfW = (spec.pommelStyle === 'disk') ? 1 : 0;
  for (let x = cx - pommelHalfW; x <= cx + pommelHalfW; x++) {
    maskSet(mask, size, x, 14, 'pommel');
  }

  return mask;
}
```

- [ ] **Step 3: 加入 16 版 shine helper**

在 32 shine 函式 `paintBladeShine32` 之後插入:

```js
/** 只在指定 cell 為 'blade' 時才畫(16 版,共用 32 版邏輯) */
function tryPaintBladeCell16(ctx, mask, size, x, y) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  if (mask[y * size + x] !== 'blade') return;
  ctx.fillRect(x, y, 1, 1);
}

/**
 * 16 blade shine — 壓縮成 3-4 px。
 * - straight:cx, y=4..7
 * - broad:cx-1, y=4..8
 * - curved:每列從 shape.rows[y] 算 xCenter, y=4..7
 */
function paintBladeShine16(ctx, mask, size, spec) {
  ctx.fillStyle = spec.palette.bladeShine;
  const cx = 8;

  if (spec.archetype === 'straight') {
    for (let y = 4; y <= 7; y++) {
      tryPaintBladeCell16(ctx, mask, size, cx, y);
    }
    return;
  }

  if (spec.archetype === 'broad') {
    for (let y = 4; y <= 8; y++) {
      tryPaintBladeCell16(ctx, mask, size, cx - 1, y);
    }
    return;
  }

  if (spec.archetype === 'curved') {
    const shape = SHAPE_FNS_16.curved();
    for (let y = 4; y <= 7; y++) {
      const r = shape.rows[y];
      if (!r) continue;
      const xCenter = Math.round((r.leftX + r.rightX) / 2);
      tryPaintBladeCell16(ctx, mask, size, xCenter, y);
    }
    return;
  }
}
```

- [ ] **Step 4: 實作 `renderSwordSpec16`**

把 sword.js 內既有的:
```js
function renderSwordSpec16(ctx, spec) {
  // TODO Task 8: 實作
}
```

替換為:

```js
function renderSwordSpec16(ctx, spec) {
  const size = 16;
  ctx.clearRect(0, 0, size, size);

  const mask = buildSilhouetteMask16(spec);

  // step 2: 平鋪主色
  paintMaskByEnum(ctx, mask, size, {
    blade:  spec.palette.bladeMain,
    guard:  spec.palette.bladeMain,
    pommel: spec.palette.bladeMain,
    grip:   LEATHER_PALETTE.main,
  });

  // 16 不畫 fuller / gripWrap / gem(per spec §6.6)
  // step 4: blade shine(always-on)
  paintBladeShine16(ctx, mask, size, spec);

  // step 7: internal seam
  paintInternalSeams(ctx, mask, size, spec.palette.outline);
  // step 8: 外圈 outline
  applyInsideOutlinePass(ctx, mask, size, spec.palette.outline);
}
```

- [ ] **Step 5: 驗證**

重新整理 `index.html`,console 貼 Step 1 腳本。

期望(把 dataURL 開新分頁放大檢視):
- 3 個 archetype 在 16 上都認得出是劍
- 每張 blade 上有一條較淺的 shine 縱線(壓縮版)
- 同 seed 的 32 vs 16 顏色族相同
- gem seed 的 pommel 16 沒有亮點(collapse 成 round)
- 任何 hasFuller seed 的 blade 16 沒有暗中軸線(16 不畫 fuller)
- 任何 hasGripWrap seed 的 grip 16 沒有暗點(16 不畫 wrap)

- [ ] **Step 6: Commit**

```bash
git add sword.js
git commit -m "feat(sword): 16x16 mask + render + shine (with collapse rules)"
```

---

## Task 9: 接上 main.js — 移除 stub、整合 sword.js 對外名稱

**Files:**
- Modify: `main.js`(移除 drawSword stub)
- Modify: `sword.js`(把 `window.drawSwordV2` 改名為 `window.drawSword`)

此 task 結束時,UI 流程(選 sword、Generate、Reroll、batch grid、download)全部走新的 sword.js 實作,看不到舊 stub。

- [ ] **Step 1: 把 sword.js 的 export 改名**

找到 sword.js 末端:
```js
window.drawSwordV2 = drawSwordImpl;  // Task 9 改成 window.drawSword
```

改成:
```js
window.drawSword = drawSwordImpl;
```

- [ ] **Step 2: 把 main.js 的 drawSword stub 整段刪除**

打開 `main.js`,找到此整段(目前約在第 129..152 行,確切位置以檔案實況為準):
```js
function drawSword(ctx, rng, size) {
  // 暫時的占位:中央畫一把劍
  const bladeColors = ['#d8d8e8', '#c8b070', '#a8a0c8', '#90c8a0'];
  const blade = rng.pick(bladeColors);
  const cx = Math.floor(size / 2);
  const tipY = 2;
  const guardY = size - 9;

  // 刀刃
  fillRect(ctx, cx - 1, tipY, 2, guardY - tipY, blade);
  fillRect(ctx, cx - 2, tipY + 1, 1, guardY - tipY - 1, '#1a1a2e');
  fillRect(ctx, cx + 1, tipY + 1, 1, guardY - tipY - 1, '#1a1a2e');
  fillRect(ctx, cx, tipY, 1, 1, '#1a1a2e'); // 劍尖

  // 護手
  fillRect(ctx, cx - 4, guardY, 8, 2, '#7a5a3a');
  fillRect(ctx, cx - 5, guardY, 1, 2, '#1a1a2e');
  fillRect(ctx, cx + 4, guardY, 1, 2, '#1a1a2e');

  // 握把
  fillRect(ctx, cx - 1, guardY + 2, 2, 4, '#4a3020');
  // 圓首
  fillRect(ctx, cx - 1, guardY + 6, 2, 1, '#c8a050');
}
```

整段(連同上面的 `// =============` 註解 banner 上面那塊不必動,只刪 `drawSword` 函式本身)刪除。`drawSpear` stub **保留不動**(下輪迭代再做)。

刪除後 main.js 應該只剩:
- DOM 取得區
- ITEM_TYPES 表(`sword: drawSword` 仍在,但現在指向 sword.js 的全域)
- generate / renderPreview / downloadPNG / renderBatchGrid
- `drawSpear` stub
- 事件綁定 + 啟動

- [ ] **Step 3: 驗證**

重新整理 `index.html`。

UI 操作流程:
1. **type 選 sword**,seed 留空,點 reroll(⟳),點 Generate
   - 期望:預覽框出現新 sword 圖示(有外圈 outline、blade shine、可能有 fuller / wrap / gem)
   - **不該看到** stub 的「細刀身 + 棕護手 + 棕握把 + 黃圓首」舊樣
2. **改 size = 16**,點 Generate
   - 期望:預覽框換成 16 版小劍
3. **type = any**,連點 reroll + generate 幾次
   - 期望:有時是 potion 有時是 sword(因為 type=any 隨機選),sword 出來時是新樣
4. **Batch grid**:看下方 grid 內若有 sword 格(任何 type=any 或 type=sword 都會出現)
   - 期望:多種 archetype / family / 變體都能看到
5. **Download PNG**(type=sword):輸出檔可以打開,是 32×32(或 16×16)的新 sword 樣

額外:console 貼:
```js
// 確認沒有 drawSwordV2 殘留
console.log('drawSwordV2 should be undefined:', typeof window.drawSwordV2);
console.log('drawSword should be a function:', typeof window.drawSword);
```
期望:`undefined`、`function`。

- [ ] **Step 4: Commit**

```bash
git add sword.js main.js
git commit -m "feat(sword): replace main.js stub with sword.js drawSword"
```

---

## Task 10: 擴充 `regression.html` — 加 sword section + 整合下載

**Files:**
- Modify: `regression.html`

此 task 結束時,`regression.html` 同時顯示 potion 與 sword 的 baseline grid;下載 PNG 與 specs.json 涵蓋兩種物品。

- [ ] **Step 1: 定義驗證目標**

打開 `regression.html`,期望:
- 頁面上方仍有 potion grid(既有的 ~16 張,2 種尺寸並排)
- 頁面下方多一個 sword grid(新的 ~16 張,2 種尺寸並排)
- 兩個下載按鈕一次涵蓋兩種物品(PNG 拼接圖含全部、specs.json 含全部)
- 重新整理頁面,所有圖示完全相同(可重現)
- sword grid 涵蓋設計分歧點:5 個金屬族、3 個 archetype、3 個 guardStyle、3 個 pommelStyle、hasFuller 開關、hasGripWrap 開關

- [ ] **Step 2: 修改 `regression.html`**

把整個檔案內容換成:

```html
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <title>Icon Machine — Visual Regression</title>
  <style>
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
  </style>
</head>
<body>
  <h1>Visual Regression — Icon Machine</h1>
  <div class="controls">
    <button id="dl-png">下載拼接 PNG</button>
    <button id="dl-json">下載 specs.json</button>
  </div>

  <h2>// drawPotion</h2>
  <table id="grid-potion"></table>

  <h2>// drawSword</h2>
  <table id="grid-sword"></table>

  <script src="random.js"></script>
  <script src="palette.js"></script>
  <script src="pixel-utils.js"></script>
  <script src="potion.js"></script>
  <script src="sword.js"></script>
  <script>
    // ============================================================
    // Hardcoded baseline seeds
    // ============================================================
    const POTION_SEEDS = [
      'fam-fire', 'fam-frost', 'fam-mana', 'fam-poison', 'fam-golden', 'fam-shadow',
      'shape-flask-1', 'shape-round-1', 'shape-vial-1',
      'edge-low-liquid', 'edge-high-liquid',
      'edge-all-options', 'edge-zero-options',
      'rusty-flask-42', 'gilded-tear-7', 'cursed-relic-13',
    ];

    // sword baseline:涵蓋 5 個金屬族 + 3 archetype + 3 guardStyle + 3 pommelStyle
    // + hasFuller / hasGripWrap edge cases
    const SWORD_SEEDS = [
      'metal-steel-1', 'metal-iron-1', 'metal-bronze-1', 'metal-gold-1', 'metal-obsidian-1',
      'arch-straight-1', 'arch-curved-1', 'arch-broad-1',
      'guard-bar-1', 'guard-swept-1', 'guard-disc-1',
      'pommel-round-1', 'pommel-disk-1', 'pommel-gem-1',
      'edge-fuller-broad', 'edge-wrap-2lines',
    ];

    const collectedPotion = [];
    const collectedSword = [];

    // ============================================================
    // Render potion grid(既有,改 grid-potion table id)
    // ============================================================
    {
      const grid = document.getElementById('grid-potion');
      const headerRow = document.createElement('tr');
      headerRow.innerHTML = '<th>seed</th><th>family</th><th>shape</th><th>cap</th><th>32×32</th><th>16×16</th>';
      grid.appendChild(headerRow);

      for (const seed of POTION_SEEDS) {
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

        collectedPotion.push({ kind: 'potion', seed, spec, c32, c16 });
      }
    }

    // ============================================================
    // Render sword grid(新)
    // ============================================================
    {
      const grid = document.getElementById('grid-sword');
      const headerRow = document.createElement('tr');
      headerRow.innerHTML = '<th>seed</th><th>family</th><th>archetype</th><th>guard</th><th>pommel</th><th>fuller/wrap</th><th>32×32</th><th>16×16</th>';
      grid.appendChild(headerRow);

      for (const seed of SWORD_SEEDS) {
        const rng = new SeededRandom(seed);
        const spec = sampleSwordSpec(rng);

        const c32 = document.createElement('canvas');
        c32.width = 32; c32.height = 32; c32.style.width = '64px'; c32.style.height = '64px';
        renderSwordSpec32(c32.getContext('2d'), spec);

        const c16 = document.createElement('canvas');
        c16.width = 16; c16.height = 16; c16.style.width = '64px'; c16.style.height = '64px';
        renderSwordSpec16(c16.getContext('2d'), spec);

        const fwTag =
          (spec.hasFuller ? 'F' : '-') +
          (spec.hasGripWrap ? 'W' + spec.gripWrapYs.length : '--');

        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${seed}</td><td>${spec.family}</td><td>${spec.archetype}</td><td>${spec.guardStyle}</td><td>${spec.pommelStyle}</td><td>${fwTag}</td>`;
        const td32 = document.createElement('td'); td32.appendChild(c32); tr.appendChild(td32);
        const td16 = document.createElement('td'); td16.appendChild(c16); tr.appendChild(td16);
        grid.appendChild(tr);

        collectedSword.push({ kind: 'sword', seed, spec, c32, c16 });
      }
    }

    // ============================================================
    // 下載按鈕(整合 potion + sword)
    // ============================================================
    document.getElementById('dl-png').addEventListener('click', () => {
      const all = [...collectedPotion, ...collectedSword];
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

    document.getElementById('dl-json').addEventListener('click', () => {
      const dump = [
        ...collectedPotion.map(({ kind, seed, spec }) => ({ kind, seed, spec })),
        ...collectedSword.map(({ kind, seed, spec }) => ({ kind, seed, spec })),
      ];
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

- [ ] **Step 3: 驗證**

打開 `regression.html`(直接 open file 或從 IDE 啟動 live server)。

期望:
- 頁面上方有 `// drawPotion` 標題 + 16 列 potion grid(每列含 32 / 16 兩個 canvas)
- 頁面下方有 `// drawSword` 標題 + 16 列 sword grid(每列含 32 / 16 兩個 canvas + spec metadata 欄)
- 5 個 metal family seed(`metal-steel-1` 等)抽出來的 family 對應(steel/iron/bronze/gold/obsidian)
  - 注意:seed 是 hardcoded,如果某 seed 抽出的 family 不對,可改 seed 字串(目的是 baseline 涵蓋 5 族,任意更動只要重新存 baseline)
- 點 **下載拼接 PNG**:得到一張長條 PNG,上半 potion 區、下半 sword 區並排顯示
- 點 **下載 specs.json**:得到一個 JSON,陣列項含 `{ kind: 'potion'|'sword', seed, spec }`
- 重新整理頁面 → 所有圖示完全相同(reproducible)

如果某個 seed 的 spec 不符合預期(例如 `metal-bronze-1` 抽到 steel),console 印出 spec 比對:
```js
// 檢查 sword 16 個 seed 的 spec 分布
const dist = {};
for (const s of ['metal-steel-1', 'metal-iron-1', 'metal-bronze-1', 'metal-gold-1', 'metal-obsidian-1', 'arch-straight-1', 'arch-curved-1', 'arch-broad-1', 'guard-bar-1', 'guard-swept-1', 'guard-disc-1', 'pommel-round-1', 'pommel-disk-1', 'pommel-gem-1', 'edge-fuller-broad', 'edge-wrap-2lines']) {
  const sp = sampleSwordSpec(new SeededRandom(s));
  dist[s] = { family: sp.family, archetype: sp.archetype, guard: sp.guardStyle, pommel: sp.pommelStyle, hasFuller: sp.hasFuller, hasWrap: sp.hasGripWrap };
}
console.table(dist);
```

如果發現有家族 / archetype / style 在 16 個 seed 中沒被覆蓋,可以替換對應 seed 字串(例如把 `metal-bronze-1` 改成 `metal-bronze-99`),重整頁面看新 seed 抽到什麼。重複直到 baseline 涵蓋所有設計分歧點。

- [ ] **Step 4: Commit**

```bash
git add regression.html
git commit -m "feat(regression): add sword section + integrate downloads"
```

---

## Final Verification(全部 task 完成後)

打開 `regression.html`,人眼比對下半 sword 區:

**Coverage 檢查表(所有都應該至少出現一次):**
- [ ] 5 個金屬 family:steel / iron / bronze / gold / obsidian
- [ ] 3 個 archetype:straight / curved / broad(silhouette 明顯不同)
- [ ] 3 個 guardStyle:bar(直條)/ swept(下層展)/ disc(中下凸)— 32 上明顯
- [ ] 3 個 pommelStyle:round(3×3 圓珠)/ disk(5×3 寬盤)/ gem(中央亮點)
- [ ] hasFuller × straight:blade 中央較暗縱線(shine 被覆蓋)
- [ ] hasFuller × broad:blade 同時有 shine(左)+ fuller(中)兩條縱線
- [ ] hasGripWrap = 1 條:grip 中段 1 個暗點
- [ ] hasGripWrap = 2 條:grip 中段 2 個間隔暗點
- [ ] 所有劍都有外圈 outline 連續(放大不能有斷縫)
- [ ] 所有 16 版都認得出是劍(blade / guard / grip / pommel 4 段都看得到)
- [ ] 所有 16 版的 fuller / gripWrap 都不畫(per spec §6.6)
- [ ] 所有 16 版的 gem 都 collapse 成 round(per spec §6.5)

**比對 baseline(以後改 code 用):**
1. 點兩個下載按鈕,把 PNG 與 JSON 存成 `baseline-2026-05-07.png` / `.json`
2. 之後改 code 後,再下載一份 new,Preview 切換比對 PNG;若變了,diff JSON 區分 sampler vs renderer 變動

**潛在 follow-up(spec §10 risks 中應驗的事):**
- obsidian 在 outline 對比下是否顯得太暗(blade 中央色被吃光)→ 若是,微調 obsidian.lightCenter 從 30 → 35-40
- curved 16 是否仍能讀為「彎」→ 若視覺判斷像 straight,套 spec §10 risk #6 的 fallback 設計
- broad 16 是否像 cleaver → 若視覺不符,套 spec §10 risk #4 的寬度降級

---

## Out of Scope

- `drawSpear` 維持 main.js 占位 stub(下一輪迭代)
- 稀有度 tier(spec §11 後續鉤子)
- 附魔劍 / magical tinted blade(spec §11 後續鉤子)
- Dagger / two-hander 變體(獨立 item type,後續迭代)
- 16 版 fuller / gripWrap 復活評估(視覺驗證後若覺得 16 太單調再考慮)
