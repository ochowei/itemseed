# Icon Machine — 專案 Context（給「從頭重寫」的 Claude Code）

> 本文件目標：讓一個從未看過此 repo 的 agent，讀完後能直接重新實作出**結構等價、視覺等價**的版本。Spec / Plan / Implementation Notes 都還在 `docs/superpowers/`，但很長；這份是「精煉版」+「踩過的坑清單」。
>
> **真相順序：code > implementation-notes > spec / plan**。Spec 與 Plan 仍代表 brainstorm 當下的意圖，但實作後若 spec 與 code 衝突，**code 為準**。

---

## 1. 專案是什麼

**Icon Machine** — 程序化像素圖示產生器。瀏覽器內單頁 app，使用者輸入 seed → 產出 32×32 或 16×16 的 RPG 道具像素圖示（透明背景 PNG）。

- 靈感：Brian MacIntosh 的 Icon Machine（itch.io）。
- 已實作物品：`potion`（藥水）、`sword`（劍）、`spear`（長矛）。
- 介面：`index.html`（主 app）、`regression.html`（視覺迴歸頁）。

### 硬約束（rewrite 時不能違反）

1. **整數像素對齊** — 所有座標 / 寬 / 高皆為整數，禁用 sub-pixel。
2. **Limited palette** — 每張圖示主視覺色 ≤ 5～6 色。
3. **連續 outline** — 暗色描邊全身一致、不中斷，**以演算法保證**（非靠人手小心）。
4. **同 seed → 同輸出** — seeded PRNG，render 階段是純函式。
5. **對外契約** — `drawPotion(ctx, rng, size)` / `drawSword(...)` / `drawSpear(...)` 簽名固定。

### 技術棧

- Vanilla JS（ES2020 即可）+ HTML5 Canvas 2D。
- **無 build tool**、**無 npm**、**無 test framework**、**無模組系統**（用 `<script>` tag 順序載入，全部丟到 `window`）。
- 不用任何外部 CDN code（只有 Google Fonts CSS）。

---

## 2. 整體架構：Spec → Render 兩階段

每個 item type（potion / sword / spear）都遵循同一個 pattern：

```
drawXxx(ctx, rng, size)
  │
  ├─ sampleXxxSpec(rng)
  │     ↑ Phase 1: RNG **集中於此**，輸出純資料 spec object
  │       含色族抽選、archetype 抽選、條件 feature 的 y 座標等
  │
  └─ size === 32 ? renderXxxSpec32(ctx, spec)
                 : renderXxxSpec16(ctx, spec)
        ↑ Phase 2: **純函式**，不再使用 RNG；同 spec → 同 pixel
```

### 為什麼這樣切

- **Debug 黃金特性**：固定 seed 出問題時 `console.log(spec)` 直接看到語意（"flask + cork + 火紅 + 95% 滿"），不需逆推像素。
- **視覺迴歸 × spec dump**：可同時 dump `regression-baseline.png` + `regression-specs.json`。下次規則改動後若 PNG 變了，diff `specs.json` 立刻分辨「sampler 變了」還是「renderer 變了」。
- **render 是純函式**：可獨立測試。任何「次要隨機數」（bubble 位置、wrap 列、binding 列）都在 sample 階段就決定好寫進 spec，render 不再 RNG。

### Render Pipeline 通用順序（32×32）

```
1. buildXxxMask32(spec)              → enum mask（每 cell 是元件名 or null）
2. paintMaskByEnum(...)              → 平鋪主色
3. always-on 裝飾（shine 等）         → 1px 縱線高光
4. 條件裝飾（fuller / wrap / binding）→ 由 spec 內已決定的位置畫
5. paintInternalSeams                → 鄰居標籤不同處畫 outline 色
6. applyInsideOutlinePass            → 外圈描邊（4-鄰居檢測）
```

順序很重要：shine 必須畫在 **interior column**（經 outline pass 後仍可見），否則會被 step 6 覆蓋。

---

## 3. 檔案結構（共 9 個檔，root 平鋪）

```
random.js       ~90 行  PRNG (mulberry32 + cyrb53-ish hash) + generateRandomSeed
palette.js      ~140 行 色族表（FAMILIES / METAL_FAMILIES）+ 三個 sampler
                        + hslToRgbHex + CORK / LEATHER / WOOD palette 常數
pixel-utils.js  ~110 行 fillRect / enum mask helpers / applyInsideOutlinePass
                        / paintInternalSeams
potion.js       ~610 行 samplePotionSpec + renderPotionSpec32/16 + shape 函式
                        + paint helpers（含 dormant：label / glassShine / surface seam）
sword.js        ~520 行 sampleSwordSpec + renderSwordSpec32/16 + 三 archetype
                        （含 curved 整把斜軸）+ guard / grip / pommel / fuller / wrap / gem
spear.js        ~430 行 sampleSpearSpec + renderSpearSpec32/16 + 三 archetype
                        （含 trident 三叉、hooked V2 鉤）+ shaft / butt / binding
main.js         ~155 行 UI 綁定、ITEM_TYPES 註冊表、generate / batch grid / download
index.html      ~420 行 主 app UI（暗色像素風 CSS + form controls + canvas）
regression.html ~225 行 三 grid（potion / sword / spear），下載拼接 PNG + specs.json
```

`<script>` 載入順序（**重要！全 script 共用同一個 lexical environment**）：

```
random.js → palette.js → pixel-utils.js → potion.js → sword.js → spear.js → main.js
```

`.gitignore` 忽略 `regression-baseline.png` / `regression-specs.json` / `icon_*.png`（regression page 與下載輸出）。

---

## 4. 各檔細節摘要

### 4.1 `random.js`

- `stringToSeed(str)` — cyrb53 簡化版 hash，把字串轉成 32-bit。
- `class SeededRandom { random(), randomInt(min, max), randomFloat(min, max), pick(arr), pickWeighted(arr, weights), chance(p) }` — Mulberry32 PRNG。
- `generateRandomSeed()` — `'rusty-blade-42'` 風格的隨機字串（用 `Math.random` 不需要重現）。
- 全部掛 `window.SeededRandom` / `window.generateRandomSeed`。

### 4.2 `palette.js`

- `FAMILIES`（藥水用）：`fire / frost / mana / poison / golden / shadow`，各 hue/sat/lightCenter/weight。
- `METAL_FAMILIES`（武器用）：`steel / iron / bronze / gold / obsidian`，weight `[3, 2, 1.5, 1, 1]`。
- `CORK_PALETTE`、`LEATHER_PALETTE`、`WOOD_PALETTE` — 三組 family-independent 常數（main / shadow / highlight）。
- `hslToRgbHex(h, s, l)` — 標準 HSL → '#RRGGBB' 字串。
- `samplePalette(rng)` → 給 potion 用（`outline / glassBody / glassShine / liquidMain / liquidShadow / highlight`）。
- `sampleSwordPalette(rng)` → 給 sword 用（`outline / bladeMain / bladeShadow / bladeShine`）。
- `sampleSpearPalette(rng)` → **wrap `sampleSwordPalette`**，把 `bladeXxx` 重命名為 `headXxx`。同 seed 在 sword/spear 上拿到完全相同 hex 色，這是**設計意圖**（金屬武器並排 cohesive）。

**Outline 公式三 sampler 共用**：`hslToRgbHex(h, 50, 12)`。低彩度 family 經此公式仍帶極輕微 hue 暗示，並排視覺 cohesive。

### 4.3 `pixel-utils.js`

- `fillRect(ctx, x, y, w, h, color)` — 集中工具。
- `allocateMask(size)` / `maskGet(mask, size, x, y)` / `maskSet(mask, size, x, y, v)` — 扁平 array (length `size*size`, index = `y*size+x`)，初始全 null。
- `paintMaskByEnum(ctx, mask, size, colorByEnum)` — 把 mask 每個 non-null cell 用對應顏色畫到 canvas。
- `applyInsideOutlinePass(ctx, mask, size, outlineColor)` — 4-鄰居檢測；non-null 且至少一個鄰居 null 的 cell 改成 outline 色。**不改 mask**，只改 canvas。
- `paintInternalSeams(ctx, mask, size, outlineColor)` — non-null 且至少一個鄰居有不同非 null 標籤的 cell，改 outline 色。

兩個 pass 都是「讀 mask 寫 canvas」，所以順序對結果不影響（idempotent）。我們選 seam 在 outline 之前純為語意清楚。

### 4.4 `potion.js` 摘要

- `samplePotionSpec(rng)` 輸出：`{ family, palette, shape, capType, liquidLevel, hasBubbles, hasSediment, hasLabel, bubbles, labelDots }`。
- `shape ∈ {flask, round, vial}`、`capType ∈ {cork, wax_seal, cloth_tied}`。
- 每個 shape 32/16 各一函式，回傳 `{ rows: Array<{leftX, rightX, kind: 'body'|'neck'} | null> }`。
- `buildSilhouetteMask32/16(spec)` 把 shape rows 轉成 enum mask（`'glass' | 'liquid' | 'cap'`）；液體填到 `floor(bodyHeight * liquidLevel)`。
- `paintPotionSeams` — potion 特化的 seam pass，**永遠 skip glass↔liquid 邊界**（液面用色差表現比黑線乾淨）。
- **Dormant features**（code 還在但已註解掉）：
  - `paintLabel32`（標籤）— 視覺上看起來像污漬。
  - `paintHighlight32`（玻璃 shine）— 跟 bubble 視覺混淆。
  - 復活方式：reverse 註解一行（render fn 內）即可。

### 4.5 `sword.js` 摘要

- `sampleSwordSpec(rng)` 輸出：`{ family, palette, archetype, guardStyle, pommelStyle, hasGripWrap, hasFuller, gripWrapYs }`。
- `archetype ∈ {straight, curved, broad}`、`guardStyle ∈ {bar, swept, disc}`、`pommelStyle ∈ {round, disk, gem}`。
- **垂直配置 32**：`y=0..1 padding / 2..18 blade / 19..20 guard / 21..26 grip / 27..29 pommel / 30..31 padding`。
- **垂直配置 16**：`y=0 / 1 tip / 2..9 blade / 10 guard / 11..13 grip / 14 pommel / 15`。
- **Curved 是「整把斜」**（不是只有 blade 斜）：`archAxis32(archetype, y)` 對 curved 回傳 `tipX(=cx+6) - floor((y-2)/2)`，blade / guard / grip / pommel 全沿這條斜軸排。1:2 slope，pommel 在左下。
- **Always-on `paintBladeShine`**：blade 內側 column 1px 縱線（straight cx / broad cx-1 / curved 動態 xCenter）。
- **條件裝飾**：
  - `hasFuller`（curved 強制 false）— 中軸 1px shadow 縱線，y=4..16，**故意比 blade 短 ~2px**。
  - `hasGripWrap` — 1 或 2 條 leather shadow 橫帶，y 範圍 [22..25]，pair pool `WRAP_PAIRS = [[22,24], [22,25], [23,25]]`。
  - `pommelStyle === 'gem'` — pommel 中央 (cx, 28) 1px bladeShine。
- **16 collapse 規則**（在 `buildSwordMask16` / `renderSwordSpec16` 內，不污染 spec）：
  - `swept` → 走 `bar` 同寬。
  - `gem` → 走 `round` 同形（無 highlight）。
  - 16 不畫 fuller / gripWrap。

### 4.6 `spear.js` 摘要

- `sampleSpearSpec(rng)` 輸出：`{ family, palette, archetype, buttStyle, hasShaftBinding, shaftBindingYs }`。
- `archetype ∈ {straight, trident, hooked}`、`buttStyle ∈ {disc, sphere, spike}`。
- **垂直配置 32**：`y=0..1 padding / 2..7 head / 8..25 shaft / 26..28 butt / 29..31 padding`。
- **垂直配置 16**：`y=0 / 1..4 head / 5..12 shaft / 13..14 butt / 15`。
- **三 archetype 都 vertical**（cx=16 中軸對齊，不像 sword curved）。
- **Shape 用 cells-based 而非 row-spans**：trident y=2..3 有 3 個不連續 1px prong（cols 13/16/19），row-spans 表示不出 sparse rows。
- **Hooked 32 是 V2 版本**（V1 promoted 後）：
  ```
  y=2 tip 1px / y=3 taper w3 / y=4 body w5 /
  y=5 body+hook w6 (cx-2..cx+3) / y=6 hook peak w7 / y=7 shoulder+tail w5
  ```
  共 27 cells（V1 是 25 cells，hook 太細）。
- **Always-on `paintHeadShine`**：cx-1 縱線；trident 跳過 y=4（bridge w7 在 cx-1 處 up=null 變 outline）。
- **條件裝飾 `paintShaftBinding32`**：
  - `SPEAR_BINDING_SINGLES = [10, 12, 14, 17, 20, 22]`（1 條時 pick 一個 y）。
  - `SPEAR_BINDING_PAIRS = [[10,14], [11,16], [13,18], [15,20], [18,23], [11,21]]`（2 條時 pick 一對）。
- **16 collapse**：buttStyle 全 collapse 成 disc w3 × 2 行；不畫 hasShaftBinding。

### 4.7 `main.js` 摘要

- 取 DOM 元素（seed input / type select / size select / generate btn / download btn / reroll btn / preview canvas / grid container）。
- **兩個 canvas**：offscreen（實際 16/32）+ preview（顯示用 384×384，`imageSmoothingEnabled = false`，CSS `image-rendering: pixelated`）。
- `ITEM_TYPES = { potion: drawPotion, sword: drawSword, spear: drawSpear }`（**新增 type 在這裡多一行**）。
- `generate()`：取設定 → 建 PRNG → 若 `type === 'any'` 用 RNG 再 pick → clear offscreen → 呼叫對應 `drawFn(ctx, rng, size)` → 放大畫到 preview。
- `renderBatchGrid()`：產 24 張 `${baseSeed}-${i}` 種子的圖示，hover 加邊框，click 載入該 seed。
- `downloadPNG()`：用 `offscreenCanvas.toDataURL('image/png')`，檔名 `icon_${safeSeed}.png`。
- `seedInput` 為空時 `generateRandomSeed()` 自動填入並觸發 generate。

### 4.8 `regression.html` 摘要

- 不影響主程式的獨立頁。
- 三段 hardcoded seed pool：`POTION_SEEDS`（16）、`SWORD_SEEDS`（16）、`SPEAR_SEEDS`（16）。
- 三 table（grid-potion / grid-sword / grid-spear），每列：seed / family / archetype / 條件 tag / 32×32 / 16×16。
- 兩按鈕：
  - **「下載拼接 PNG」**：把全部 (32+16) 圖示拼成單張 PNG（`regression-baseline.png`）。
  - **「下載 specs.json」**：dump `[{kind, seed, spec}]`（`regression-specs.json`）。
- **工作流**：改 code 前下載 baseline → 改完下載 new → macOS Preview 切換比對 PNG；若 PNG 變了，diff JSON 區分「sampler 變了」還是「renderer 變了」。

---

## 5. 命名慣例（**踩過坑後形成的規則**）

### Vanilla JS `<script>` 共用 lex env 的撞名問題

> 這是最容易誤判的坑。**Top-level `const` 跨 script 重複宣告 → `SyntaxError: Identifier 'X' has already been declared`**，整個 script 載入失敗。**`function` declaration 不會 throw 但會 silent override**（後載入的 win），會把先前 item type 的渲染搞壞。

#### 規則（rewrite 時直接套用，不要等踩坑）

1. **每個 item-type 的 file-internal `const` 一律加 ITEM-TYPE 前綴**（不論有無撞名）。
   - ✅ `SPEAR_ARCHETYPES`、`SPEAR_SHAPE_FNS_32`、`SWORD_SHAPE_FNS_32`
   - ❌ `ARCHETYPES`、`SHAPE_FNS_32`（會撞）
2. **撞名的 `function` 一律加 item-type 中綴**。
   - ✅ `shapeSpearStraight32`（避撞 `shapeStraight32` from sword）
   - ✅ `buildSpearMask32`、`buildSwordMask32`
   - ❌ 兩個 file 都叫 `buildSilhouetteMask32`（後載入 silent override）
3. **沒撞名的 helper**（如 `tryPaintHeadCell32` vs `tryPaintBladeCell32`）可不加前綴；但**一致性勝於微優化**，新 item type 寧可全加。
4. **下次重寫時可考慮用 IIFE 包裝**：`(function() { ... window.drawXxx = ...; })();` 把 file-internal const 收進 local scope，徹底消除撞名風險。本輪沒做（成本超出 task 範圍），但第三/四個 item type 出現時建議重構。

### 已存在的命名

```
file        撞名的 const                       撞名的 function
potion.js   SHAPE_NAMES, SHAPE_WEIGHTS,        shapeFlask32/16, shapeRound32/16,
            CAP_TYPES, SHAPE_FNS_32/16          shapeVial32/16, buildSilhouetteMask32/16,
                                                paintHighlight32, paintBubbles32, ...
sword.js    ARCHETYPES, ARCHETYPE_WEIGHTS,     buildSwordMask32/16, shapeStraight32/16,
            GUARD_STYLES, POMMEL_STYLES,        shapeBroad32/16, shapeCurved32/16,
            WRAP_PAIRS, SWORD_SHAPE_FNS_32/16   paintBladeShine32/16, paintFuller32, ...
spear.js    SPEAR_ARCHETYPES,                  buildSpearMask32/16, shapeSpearStraight32/16,
            SPEAR_ARCHETYPE_WEIGHTS,            shapeSpearTrident32/16, shapeSpearHooked32/16,
            SPEAR_BUTT_STYLES,                  paintHeadShine32/16, paintShaftBinding32,
            SPEAR_BINDING_SINGLES, ...PAIRS,    spearAddRange, ...
            SPEAR_SHAPE_FNS_32/16
```

⚠️ `potion.js` 與 `sword.js` 各自有 `SHAPE_FNS_32/16`，但它們**確實會撞**（兩個都 top-level const）— 這是 sword 沿用 plan 範例 code 時踩到的坑。`sword.js` 後來改成 `SWORD_SHAPE_FNS_32/16`（`potion.js` 仍是 `SHAPE_FNS_32/16` 沒改）。**重寫時 potion 也應該改成 `POTION_SHAPE_FNS_32/16`**，根除這個 historical artifact。

---

## 6. 踩過的坑 / 設計教訓

### 6.1 半像素中軸對稱（potion 早期）

- `Math.round(3 + t * 5)` 配 `cx + halfW - 1` 會讓 body 中心在 `cx + 0.5`，跟 neck 中心 `cx` 差半 px。視覺上「瓶子歪」。
- **Fix**：`rightX = cx + halfW`（奇寬，對稱）。`Round` shape 公式同樣處理（用 `cx + dx`）。
- **教訓**：所有形狀公式先驗證對稱性（中軸 == cx）再 commit。

### 6.2 漸寬 body + 低液面 → 視覺怪（potion 16）

- 原 plan：flask 16 用 `Math.round(1.5 + t * 2.5)` 漸寬。
- 問題：低液面時，液面落在 body 上方窄處，下方反而更寬 →「液體縮在上面、攤在下面」。
- **Fix**：flask 16 改成「窄頸 + 1 列肩 + 寬均勻身 7」。液面在任何高度都是平整橫線。
- **教訓**：spec 寫漸變公式前，先想 edge case（液面高/低）。

### 6.3 Pommel / butt 2 列高 → 全變黑 blob（sword / spear）

- 4-鄰居 outline + seam pass 下，2 列高的 pommel/butt 所有 cell 都會被改成 outline 色（每個 cell 都觸邊或鄰異 enum）。`bladeMain`/`headMain` 完全不可見。
- **Fix**：pommel / butt 改 3 列高，中間列（y=28 / y=27）有 interior cell 存活顯示金屬色。Grip 從 7 列改 6 列以騰空間。
- **教訓**：規劃尺寸時要記得「主色可視區域 = silhouette − 外圈 1px − 跟異 enum 接縫」。

### 6.4 Curved sword 中段 stairstep 看不出曲線（sword v1/v2/v4）

- v1：spec formula `offset = round(2 * (18-y) / 14)` 讓 y=4..7 寬到 cx+3，**比 tip(cx+2) 更右** → 看起來像「翹出 tip 之外」。
- v2：max offset 從 2 降到 1，1 個 stairstep — 視覺仍 awkward。
- **v4 嘗試**：照 itch.io reference（64×64）的「vertical hilt + curved blade」pattern，中段急彎 + 下半 vertical aligned → 在 32 上 stairstep 看起來像「斷掉」。
- **v3 為現況 production**：「整把劍沿 1:2 斜軸」（blade / guard / grip / pommel 全斜）。在小 size 上連貫、不需要強行收回 vertical 軸。
- **教訓**：reference 圖的解析度決定可行設計。32×32 不適用 64×64 的「hilt vertical + 中段急彎」pattern，因為可用列數差 4 倍。

### 6.5 Hook 視覺太細（spear V1 → V2）

- 原 spec hooked 32 hook 只到 y=6 共 ~3 px footprint。視覺迴歸：「太微妙、讀不出 barbed」。
- **Fix**：V2 把 y=7 從 w3 shoulder 改 w5（保留 hook tail）。footprint 4-5 px。
- 流程：加 V2 平行 scaffold → regression 並排 6 個 forced-hooked seed → user 選 V2 → 清掉 V1 scaffold。
- **教訓**：模糊的視覺 risk 直接 build A/B parallel scaffold，比口頭描述高效。

### 6.6 String-length hash 太脆（potion 早期）

- 用 `(spec.shape.length + spec.family.length) % 2` 算 sediment 厚度 / wax 蠟滴長度。
- 問題：`flask`(5) 跟 `round`(5) 同 length，hash 結果一樣。實際上只有 vial(4) 不同。
- **教訓**：任何「次要隨機數」都在 sample 階段算好寫進 spec（如 `spec.sedimentThickness`），不要從 spec 字串挑屬性當 hash。Potion 沒清掉是 minor debt；sword / spear **沒重複此錯誤**（`gripWrapYs` / `shaftBindingYs` 都在 sample 階段決定）。

### 6.7 Surface seam（液面分隔線）視覺髒

- 原 spec：`paintInternalSeams` 在 glass↔liquid 邊界畫黑線做「液面張力」。
- 視覺結果：黑線把液面切死，不夠乾淨。色差（glassBody vs liquidMain）已足夠。
- **Fix**：寫了 potion 特化的 `paintPotionSeams`，**演算法層級永遠 skip glass/liquid pair**。其他內部邊界（cap/glass 等）仍畫 seam。
- **教訓**：generic helper 通用是好的，但 item-specific 例外用「item-specific wrapper」實作而非 patch generic helper。

### 6.8 Glass shine 跟 bubble 視覺混淆

- Spec：玻璃左側固定光帶（flask 沿斜邊 / round 沿弧線 / vial 中段）。
- 加了 `glassShine` 色（HSL h, s-40, 92）區別於 bubble 用的 `highlight`，仍混淆。
- **決定**：dormant，code 留著但註解掉（reverse 註解可復活）。實作後重評可能在某些 family 仍可用。
- **教訓**：把「視覺驗證後決定停用」的 feature **標 dormant 而非刪除**；spec 仍計算欄位（shape 不變維持向後相容）。

### 6.9 Outline pass 對角線斷縫

- 4-鄰居 outline 對「對角線單點」會漏判（e.g. flask 收窄處的 1px 寬斜邊）。
- 已知 risk 但實作後沒實際出現問題；保留 4-鄰居。
- **Fallback**：改 8-鄰居（代價是某些尖角會略胖一格）。

### 6.10 Obsidian 武器 wash out（潛在）

- `obsidian` 的 bladeMain L=30，跟 outline L=12 對比可能不夠。實作後沒實際出問題；保留現值。
- **Fallback**：把 obsidian 的 lightCenter 拉到 35-40。

---

## 7. Spec 與 Code 的偏移（哪裡別信 spec）

| 物品 | spec 寫的 | code 為準的（差異） |
|---|---|---|
| potion | flask 32 body 漸寬到 width 16，公式對稱 | 公式微改：`rightX = cx + halfW`（奇寬） |
| potion | round 32 neck y=4..12, circle y=13..29 | neck y=4..**13**, circle y=14..28（避開 pole rows） |
| potion | flask 16 漸寬 body | 改成「窄頸 + 1 列肩 + 寬均勻身 7」 |
| potion | label / glassShine / surface seam 在 render | **dormant**（註解掉） |
| sword | curved 公式 `offset = round(2*(18-y)/14)` 或 prose `(cx, cx+2)` | 兩者皆廢；現用「整把斜 1:2 軸」 |
| sword | pommel 2 列、grip 7 列 | pommel 3 列、grip 6 列（spec self-review 階段已對齊） |
| sword | guard / pommel 中央對齊 cx | curved 下用 `archAxis32(spec.archetype, y)` 動態軸（vertical archetype 行為不變） |
| spear | hooked 32 hook 只到 y=6（V1） | 現用 V2：y=7 shoulder 也帶 hook tail w5 |
| spear | hooked 16 shoulder w6 (cx-2..cx+3) | code 是 w5 偏右 (cx-1..cx+3) — plan 跟 code 一致，spec 沒同步 |

**重寫時建議**：先讀 code 跟 implementation notes，把上述偏移直接吸收進新 spec。

---

## 8. UI / CSS 風格（index.html）

- 暗色主題：`--bg-deep: #0e0d14`、`--ink: #e8e4d8`、`--accent: #ffb347`（燈泡橘）、`--accent-2: #6dd3ce`（古銅綠）。
- 字型：`'VT323'`（標題）+ `'JetBrains Mono'`（內文），都從 Google Fonts 載入。
- 主版面：兩欄 grid（左 preview、右 controls），preview canvas 是 384×384 顯示放大、後面 24 格 batch grid。
- Preview 用「西洋棋盤」漸層背景顯示透明區，`image-rendering: pixelated`。
- 按鈕風格：邊框 + hover 時 `translate(-1px, -1px)` + 1px shadow（pixel art 機械感）。
- 標題用 VT323、`h1` 內 `.accent` 點（橘）+ `.tagline` 加閃爍 cursor。

`regression.html` 走相反風格：淺米色背景 + 表格 + 橘色 h2，方便看視覺對比。

---

## 9. Documentation 組織（`docs/`）

```
docs/
├── PROJECT_CONTEXT.md                              ← 本檔（精煉版）
└── superpowers/
    ├── 2026-05-07-implementation-notes.md           ← potion 實作後筆記（127 行）
    ├── 2026-05-07-drawsword-implementation-notes.md  ← sword 實作後筆記（265 行，含 v1→v4 過程）
    ├── 2026-05-08-drawspear-implementation-notes.md  ← spear 實作後筆記（245 行，含 V1→V2 過程）
    ├── plans/
    │   ├── 2026-05-07-drawpotion.md     ← potion 實作計畫（1761 行，含 task-by-task code）
    │   ├── 2026-05-07-drawsword.md      ← sword（1652 行）
    │   └── 2026-05-08-drawspear.md      ← spear（1788 行）
    └── specs/
        ├── 2026-05-07-drawpotion-design.md  ← potion 設計（290 行）
        ├── 2026-05-07-drawsword-design.md   ← sword 設計（471 行）
        └── 2026-05-08-drawspear-design.md   ← spear 設計（518 行）
```

### 寫作慣例

- **Spec**：「為什麼這樣設計」+ 視覺幾何規格（座標表、archetype 配置）+ palette + 已知 risks。代表 brainstorm 結束時意圖。
- **Plan**：可被 agent 自動執行的 task-by-task checklist，每個 task 含 verify code（console / visual）。多到 1700+ 行。
- **Implementation notes**：spec/plan 完成後的「實作偏移筆記」。`code 為現況的唯一真相`。日後改設計**先讀這份再讀 spec**。
- 每個 item type 都按「spec → plan → code → implementation notes」的 4 階段循環。

---

## 10. 重寫時的建議順序

如果要從零開始：

1. **`random.js`**（PRNG）— 先做這個並驗證同 seed 重現。
2. **`palette.js`**（FAMILIES + samplePalette + hslToRgbHex + CORK_PALETTE）— Console 驗證 `samplePalette` 重現。
3. **`pixel-utils.js`** — 寫完 `paintMaskByEnum` 後，用一個 hardcoded mask 視覺驗證 outline pass 是「外圈一圈閉合的描邊」。
4. **`potion.js`**（最簡單的 silhouette + 條件裝飾組合）— 從 32×32 開始，再做 16×16。
5. **`index.html` + `main.js`** — 把骨架弄出來，可以在瀏覽器看到。
6. **`regression.html`** — 在做 sword 前，**先建好回歸頁**，後續每改一條規則都能立刻看視覺 diff。
7. **`sword.js`**（架構同 potion，但**注意命名**：所有 const 加 `SWORD_` 前綴避免撞名）。
8. **`spear.js`**（同樣 `SPEAR_` 前綴；參考 sword 的 archetype 切割但 vertical layout）。

### 關鍵時間消耗點（預先警告）

- **Curved blade 形狀** 一定會迭代 2-3 次。直接走「整把斜 1:2 軸」省時間。
- **Hooked spear** V1 的 3px hook 會被嫌太細，直接做 V2（hook footprint 4-5 px）。
- **撞名問題** 在第二個 item type 才會浮現。寧可所有 const 都加前綴，不要等踩坑。
- **Outline 連續性**：4-鄰居檢測對絕大多數 silhouette 夠用，先不要追加 8-鄰居。
- **Dormant features**：label、glassShine、surface seam 視覺驗證時會被砍。註解掉留 code，spec shape 不變。

### 可考慮的架構改進（若時間夠）

1. **IIFE 包裝**每個 item-type 檔案，徹底消除全 script 共用 lex env 的撞名風險。
2. **`sampleMetalPalette`** 取代 `sampleSwordPalette` + `sampleSpearPalette` wrapper；現在是 wrapper pattern。
3. **抽 generic shine helper**：`paintShineLine(ctx, mask, size, color, getXAtY, yRange, gateEnum)` 取代各 item type 的 32/16 shine。
4. **Sample 階段算所有「次要隨機數」**（potion 的 `sedimentThickness` / `dripLen` 還是用 string.length hash，是已知 minor debt）。
5. **稀有度 tier**：在 spec 加 `tier`，render 階段最後加 `applyOuterGlowPass`（B-style 外擴 1px）。架構不需重寫。
