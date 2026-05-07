# drawSword 程序化規則 — 設計文件

**狀態:** 已通過 brainstorm,待寫實作計畫
**日期:** 2026-05-07
**範圍:** 只重寫 `drawSword`。`drawSpear` 不在這輪。

---

## 1. 目標 & 非目標

### 目標
- 把 `drawSword` 從占位升級為「真正的程序化規則」。
- 每張產出視覺上明顯不同(劍型、護手、握把、劍首、金屬色族與 fuller / 纏繩等可選元件均隨 seed 變化)。
- 看起來像 RPG 道具圖示,跟同 batch 中的 potion 並排不撞風格。
- 滿足專案三條硬約束:
  - **整數像素對齊**:所有座標、寬高皆為整數,不使用 sub-pixel。
  - **limited palette**:每張圖示最多 5~6 色(outline + bladeMain + bladeShine + leather main + 至多 1~2 個輔助色)。
  - **連續 outline**:暗色描邊全身一致、不中斷,以演算法保證(沿用 potion 的 `applyInsideOutlinePass`)。
- 同 seed 永遠重現相同輸出。
- 同時支援 32×32(主)與 16×16(子集)兩種尺寸。
- 對外介面契約 `drawSword(ctx, rng, size)` 不變,呼叫端零感知。

### 非目標(留待後續迭代)
- 劍刃魔法光暈 / 粒子 / 外圈 glow
- 雙手劍 / 短劍 / dagger 等獨立 archetype(未來新 item type)
- 稀有度 tier 的視覺差異(留 hook,本輪不做)
- 動畫 / 任何時間相關效果
- 「魔法附魔劍」(火焰刃 / 冰霜刃)— 只用金屬色族,等同 potion 排除 tier 的決定
- `drawSpear` 的程序化規則

### 設計姿態
直接沿用 potion 已建立的 spec→render 兩階段架構與 `palette.js` / `pixel-utils.js` 的可重用基礎設施,**不重新發明結構**,只設計新物品的 spec 結構與 shape 幾何。

---

## 2. 整體架構 — 兩階段:Spec → Render(沿用 potion pattern)

```
drawSword(ctx, rng, size)
  │
  ├─ sampleSwordSpec(rng)
  │     ↑ Phase 1:RNG 集中於此,輸出純資料 spec object
  │
  └─ size === 32 ? renderSwordSpec32(ctx, spec)
                 : renderSwordSpec16(ctx, spec)
        ↑ Phase 2:純函式,不再使用 RNG;同 spec → 同 pixel
```

### Spec 物件結構

```js
{
  family: 'steel',                         // for debug / regression
  palette: {
    outline,        // HSL(h, 50, 12)              ← 同 potion 公式
    bladeMain,      // HSL(h, s, lightCenter)
    bladeShadow,    // HSL(h, s+10, lightCenter-15) ← fuller 用
    bladeShine,     // HSL(h+5, s-15, 85)           ← always-on 高光、gem 高光共用
  },
  // 注意:
  //   - grip 顏色不在 spec.palette 裡,使用 palette.js hardcoded 的 LEATHER_PALETTE 常數
  //     (family-independent,類比 potion 的 CORK_PALETTE)。
  //   - guard 與 pommel 顏色 = bladeMain(同金屬塊)。
  archetype: 'straight' | 'curved' | 'broad',
  guardStyle: 'bar' | 'swept' | 'disc',
  pommelStyle: 'round' | 'disk' | 'gem',
  hasGripWrap: bool,                       // 50%
  hasFuller: bool,                         // 40%;archetype === 'curved' 強制 false
  gripWrapYs: [y, y, ...],                 // sample 階段就決定的 wrap 帶位置(原始 y 座標,32 版本)
}
```

`gripWrapYs` 在 sample 階段就決定,確保 render 是純函式,跟 potion 把 `bubbles` / `labelDots` 寫進 spec 同邏輯。

---

## 3. Render Pipeline(32×32)

```
1. buildSilhouetteMask32(spec)            → enum mask(下節定義)
2. paintMaskByEnum(ctx, mask, palette)    → 平鋪主色:
                                              blade  → bladeMain
                                              guard  → bladeMain   (同金屬色)
                                              pommel → bladeMain   (同金屬色)
                                              grip   → LEATHER_PALETTE.main
3. spec.hasGripWrap   && paintGripWrap32  → 1-2 條 LEATHER_PALETTE.shadow 橫帶
4. paintBladeShine32                       → always-on 1px 縱線高光(沿 archetype 的 blade 軸)
5. spec.hasFuller     && paintFuller32     → blade 中軸 1px bladeShadow 縱線(curved 強制不畫)
6. spec.pommelStyle === 'gem' && paintGem32 → pommel 中央 1px bladeShine
7. paintInternalSeams(ctx, mask, outline)  → 所有 4-鄰居標籤不同處畫 outline 色
8. applyInsideOutlinePass(ctx, mask, outline) → 外圈描邊,保證閉合
```

**比 potion 簡化的兩處:**
- 沒有 `paintSwordSeams` 特例 — 內部 seam 全部要畫,直接用 `pixel-utils.js` 的 generic `paintInternalSeams`。
- 沒有 dormant feature(blade shine always-on,沒有「先做了再停用」的東西)。

### Mask 表示法

單一 enum mask(同 potion):每個 pixel 標
`'blade' | 'guard' | 'grip' | 'pommel' | null`(null = 透明 / 圖示外部)。

- 每個 pixel 只屬於一個元件。
- inside-edge outline pass 規則:**該 pixel 為非 null 且至少一個 4-鄰居是 null** → 改為 outline 色。沿用 `applyInsideOutlinePass`,完全不改。
- internal seam pass 規則:**該 pixel 為非 null,且至少一個 4-鄰居有不同非 null 標籤** → 改為 outline 色。沿用 `paintInternalSeams`,完全不改。
- 此 mask 只是繪圖中介,不對外暴露。

---

## 4. 32×32 幾何規格

### 4.1 整體垂直配置(所有 archetype 共用)

```
y= 0..1    padding(2 rows top)
y= 2..18   blade(17 rows = 1 tip row + 16 body rows)
y= 19..20  guard(2 rows)
y= 21..26  grip(6 rows)
y= 27..29  pommel(3 rows)
y= 30..31  padding(2 rows bottom)
```

合計 32 列。中軸 `cx = 16`。

> **為什麼 pommel 要 3 列高?** 用 4-鄰居 outline + seam pass 推算:`pommel` 2 列高的所有 cell 都會觸邊(上鄰 grip 或左右 null,下鄰 padding null)→ 全部被 seam/outline 改寫成 outline 色,`bladeMain` 完全不可見,pommel 看起來只是黑 blob 不像金屬。3 列高才能讓中間列(y=28)的內部 cell 存活下來顯示 `bladeMain`。
>
> grip 從 7 → 6 列以騰出 1 列給 pommel,grip 仍有 4 列 interior 可顯示 leather 主色,並足以容納 1-2 條 wrap 帶。

### 4.2 Blade(`archetype`)

每個 archetype 是「給 row y 回傳 `{ leftX, rightX, kind: 'blade' } | null`」的純函式,描繪 blade 外輪廓。整數座標。

weighted pick:`straight: 3, curved: 2, broad: 1.5`(同 potion shape 順序)。

#### `straight` — 雙刃直劍
```
y= 2     1 px (cx)            ← tip
y= 3     3 px (cx-1..cx+1)    ← taper
y= 4..18 3 px (cx-1..cx+1)    ← body 寬度恆定
```
Body 與 guard 中央對齊(都以 cx 為中心)。

#### `curved` — 單刃彎刀(scimitar / saber)
Tip 偏右、刃身左下傾斜。中心線 `xCenter(y)` 從 `cx + 2` 線性過渡到 `cx`(在 blade 底端與 guard 對齊)。
寬度 3(taper 段例外)。
```
y= 2     1 px (cx+2)                              ← tip 偏右
y= 3     2 px (cx+1..cx+2)                        ← taper
y= 4     3 px (cx+0..cx+2)                        ← 寬度足、最右偏移
y= 5..18 3 px,xCenter 線性遞減從 cx+2 到 cx
         具體公式:offset(y) = round(2 * (18 - y) / (18 - 4))
                  範圍 y=4..18,offset 從 2 漸減到 0
         實際 row range:cx + offset(y) - 1 .. cx + offset(y) + 1
```
Curve 是「平滑離散階梯」— 在 32×32 上每 6~7 列才偏移 1px,符合像素藝術慣例。**curved 強制 `hasFuller = false`**(中軸隨 row 而變,fuller 線會 zig-zag 不好看)。

#### `broad` — 寬刃厚劍(falchion / cleaver)
寬度 5,tip 比例略寬。
```
y= 2     1 px (cx)            ← tip
y= 3     3 px (cx-1..cx+1)    ← taper 1
y= 4     5 px (cx-2..cx+2)    ← taper 2
y= 5..18 5 px (cx-2..cx+2)    ← body 寬度恆定
```

### 4.3 Guard(`guardStyle`)

uniform pick(機率均等)。所有 guard 中央對齊 cx,顏色 = `bladeMain`(painted by mask)。

| guardStyle | y=19 | y=20 | 視覺 |
|---|---|---|---|
| `bar` | width 7 (cx-3..cx+3) | width 7 (cx-3..cx+3) | 標準直條十字護手 |
| `swept` | width 5 (cx-2..cx+2) | width 7 (cx-3..cx+3) | 上窄下寬,像兩端「往下垂掛」的彎護手 |
| `disc` | width 7 (cx-3..cx+3) | width 9 (cx-4..cx+4) | 中下層往外凸,像圓盤式護手 |

> Guard 兩列同色,但 `paintInternalSeams` 不會在 guard 內部畫線(同 enum 'guard'),所以 guard 看起來是一個整塊。Blade↔Guard 邊界由 seam pass 自動描邊。

### 4.4 Grip

固定:寬度 3(cx-1..cx+1),高 6 列(y=21..26),整塊 enum = `'grip'`。
顏色 = `LEATHER_PALETTE.main`。

經 outline + seam pass 後實際可見 leather 主色:`(cx, y=22..25)` 的 4 個 cell(其餘外圈與上下接縫被改為 outline 色)。寬度 3 是為了讓中央列存在於 4-鄰居 interior 中,1 px 寬度的 leather 條足以區分 grip 跟金屬部位。

### 4.5 Pommel(`pommelStyle`)

uniform pick。pommel 區塊 enum = `'pommel'`,顏色 = `bladeMain`,佔 y=27..29 共 3 列。

| pommelStyle | y=27 | y=28 | y=29 | 視覺 |
|---|---|---|---|---|
| `round` | width 3 (cx-1..cx+1) | width 3 (cx-1..cx+1) | width 3 (cx-1..cx+1) | 方形 3×3,經 outline pass 後形似圓珠;中央 (cx, 28) 顯示 bladeMain |
| `disk` | width 5 (cx-2..cx+2) | width 5 (cx-2..cx+2) | width 5 (cx-2..cx+2) | 寬盤狀,中間列 (cx-1..cx+1, 28) 三 cell 顯示 bladeMain |
| `gem` | 同 `round`(width 3) | 同 `round` | 同 `round` | 跟 round 同形,額外在 (cx, 28) 中央列中央 cell 畫 1px `bladeShine` 模擬寶石高光 |

> `gem` 是 `round` 的「+ 1px highlight」變體,不引入新色、不改 mask 結構。

### 4.6 Always-on 裝飾:`paintBladeShine32`

光源同 potion(從左上來)。在 blade 的 interior column(經 outline pass 後仍可見的內部 column)畫 1px 縱線,顏色 = `palette.bladeShine`。

| archetype | shine x | shine y range | 說明 |
|---|---|---|---|
| `straight` | `cx` | y=4..15(12 列) | width 3 blade 唯一 interior column,即中軸 |
| `broad` | `cx-1` | y=4..16(13 列) | width 5 blade 有 3 個 interior column(cx-1, cx, cx+1),shine 取最左以表「光源從左上」 |
| `curved` | `xCenter(y)` | y=4..15(12 列) | width 3 blade 唯一 interior column,但中軸隨 row 偏移,需動態從 `shape.rows[y]` 取 `(leftX + rightX) / 2` |

實作 helper(類比 potion 的 `tryPaintHighlightCell`):**只在 `mask[y*size+x] === 'blade'` 時畫**,避免畫到 guard / 外面。

> **與 outline pass 的順序關係:** shine 在 step 4、outline pass 在 step 8(後畫)。如果 shine 寫在 outline ring(x = leftEdge 或 rightEdge),會被 outline pass 改寫掉。所以 shine 必須選 interior column(`cx` for straight、`cx-1` for broad、`xCenter` for curved),這樣 outline pass 不會覆蓋。

### 4.7 條件裝飾:`paintFuller32`

trigger:`spec.hasFuller && spec.archetype !== 'curved'`(curved 強制 false 在 sample 階段就決定)。

中軸 1px 縱線,顏色 = `palette.bladeShadow`。
- `straight`:y=4..16,x = cx
- `broad`:y=4..16,x = cx

**範圍故意比 blade 全長短 ~2px**(top 從 y=4 而非 y=2,bottom 到 y=16 而非 y=18):tip 與 hilt 端不畫 fuller,看起來像一條真實刀身溝槽中段,而非從頭貫到底的死板黑線。

gate:只在 `mask[...] === 'blade'` 時畫。

> **與 shine 的互動:**
> - `straight`:shine 與 fuller 都落在 `x = cx`(width 3 blade 唯一 interior column)。step 順序使 fuller(step 5)覆蓋 shine(step 4),結果為「shadow 取代 shine」的較暗刀身。**此為刻意設計**,提供一個「磨損 / 樸素」的視覺變體;不是 bug。
> - `broad`:width 5 blade 有 3 個 interior column。shine 在 `cx-1`、fuller 在 `cx`,兩者佔不同 column,共存,看起來是「左側高光 + 中央溝槽」,跟真實刀身視覺一致。
> - `curved`:強制 `hasFuller = false`,沒有衝突。

### 4.8 條件裝飾:`paintGripWrap32`

trigger:`spec.hasGripWrap`。

`spec.gripWrapYs` 在 sample 階段決定:
- 50% 機率 1 條,50% 機率 2 條
- y 範圍 [22..25](grip y=21..26,避開 y=21 與 y=26 兩端;這兩列會被 seam pass 染為 outline,wrap 畫在那會被覆蓋)
- 2 條時兩 y 至少間隔 2 列;有效 pair 為 `[22,24] / [22,25] / [23,25]`(sample 階段 `pickWeighted` 或 `pick` 三選一)

每條 wrap = 1 列水平直線,寬度 = grip 寬(cx-1..cx+1),顏色 = `LEATHER_PALETTE.shadow`。
gate:只在 `mask[...] === 'grip'` 時畫(避免畫到 guard 或外面)。

> 經 outline pass 後,wrap 在該列實際可見的只有 `(cx, y)` 1 cell(左右兩 cell 是 outline ring,被 outline pass 改寫)。視覺效果是「在 4 列高的 leather 主色條上,點綴 1-2 個 shadow 色 1×1 像素」,讀為 wrap 的繩痕。

### 4.9 條件裝飾:`paintGem32`

trigger:`spec.pommelStyle === 'gem'`。
畫 1px,座標 (cx, 28)— 即 pommel **中間列**(y=28 = pommel 3 列高的中間,經 outline + seam pass 不會被覆蓋的 interior cell)。顏色 = `palette.bladeShine`。
gate:只在 `mask[28*32+cx] === 'pommel'` 時畫(防止 gem 寫到外面)。

---

## 5. Palette 系統

### 5.1 金屬色族表(寫死於 `palette.js`,平行於既有 `FAMILIES`)

```js
const METAL_FAMILIES = {
  steel:    { hue: [200, 220], sat: [10, 20], lightCenter: 65, weight: 3 },   // 中性灰藍,最常見
  iron:     { hue: [210, 230], sat: [5, 15],  lightCenter: 50, weight: 2 },   // 較暗
  bronze:   { hue: [30, 40],   sat: [40, 55], lightCenter: 55, weight: 1.5 }, // 暖黃褐
  gold:     { hue: [45, 55],   sat: [70, 85], lightCenter: 65, weight: 1 },   // 亮黃,稀有感
  obsidian: { hue: [270, 290], sat: [20, 30], lightCenter: 30, weight: 1 },   // 暗紫黑
};
```

### 5.2 `sampleSwordPalette(rng)` 流程

跟 `samplePalette(rng)` 同結構:
1. `pickWeighted` 一個 metal family。
2. 在 family 的 `hue` / `sat` 範圍內 RNG 取值,得到 `(h, s)`。
3. 推導:
   - `bladeMain   = HSL(h, s, lightCenter)`
   - `bladeShadow = HSL(h, min(100, s+10), max(0, lightCenter-15))`
   - `bladeShine  = HSL(h+5, max(0, s-15), 85)`
   - `outline    = HSL(h, 50, 12)` ← 跟 potion 同公式;低 s 的 metal family 經此公式仍會有極輕微 hue 暗示,outline 接近黑但帶族色,跟 potion 風格 cohesive

> outline 公式裡 `s=50` 是常數,不依賴 family 的 sat。potion 的 `outline` 也是同一公式,兩者並排 outline 風格一致。

### 5.3 Leather 常數(family-independent,平行於既有 `CORK_PALETTE`)

```js
const LEATHER_PALETTE = {
  main:      '#6a4828',
  shadow:    '#3a2818',
  highlight: '#8a6840',
};
```

- 給 grip(主色)與 hasGripWrap(shadow)使用。
- **不重用 `CORK_PALETTE`** — cork 偏亮(`#8a5a2e`,沒有保護的軟木塞語意),sword grip 應該稍暗以表「皮繩纏緊」。差異雖小但 leather/cork 各自語意清楚對未來 item type(盾、書、皮甲)更有用。
- `LEATHER_PALETTE.highlight` 本輪不用,留給未來 grip shine 等迭代。

### 5.4 每張 icon 可見色數

- 必畫:outline + bladeMain + bladeShine + LEATHER_PALETTE.main = **4 色**
- 加 LEATHER_PALETTE.shadow(if `hasGripWrap`)= 5 色
- 加 bladeShadow(if `hasFuller`)= 5~6 色

符合 limited palette 約束(最多 5-6 色)。

### 5.5 與 potion palette 的關係

- `palette.js` 同時 export `samplePalette`(potion 用)與 `sampleSwordPalette`(sword 用)。**互不共用 sampler**。
- 兩個 sampler 的 `outline` 公式相同,**兩者並排 outline 風格 cohesive**(都是 HSL(h, 50, 12))。
- 全套圖示放一起時:potion 是高彩度魔法液體、sword 是低彩度金屬,色彩語言上互補不衝突。

---

## 6. 16×16 子集

### 6.1 整體垂直配置

```
y= 0       padding
y= 1       blade tip
y= 2..9    blade body(8 rows)
y= 10      guard(1 row)
y= 11..13  grip(3 rows)
y= 14      pommel(1 row)
y= 15      padding
```

中軸 `cx = 8`。

### 6.2 Blade — 16 版重新設計(非縮放)

#### `straight` 16
```
y= 1     1 px (cx)               ← tip
y= 2..9  3 px (cx-1..cx+1)       ← body 對稱寬 3
```
> 寬 3 是為了讓 blade 經 outline pass 後仍保留中央 1 column 顯示 bladeMain / shine,結構上與 32 版同邏輯。Fallback:若實作後覺得寬 3 跟 broad 16(寬 5)在小尺寸區分不夠,straight 16 可降為寬 2 偏左(cx-1..cx),但會犧牲 shine 在 interior column 的位置。

#### `broad` 16
```
y= 1     1 px (cx)
y= 2     3 px (cx-1..cx+1)       ← taper
y= 3..9  5 px (cx-2..cx+2)       ← body 寬 5
```

#### `curved` 16
寬 3,tip 偏右 1 px(在 16 上對 2 px 都太多會出格)。
```
y= 1     1 px (cx+1)             ← tip 偏右 1
y= 2     2 px (cx, cx+1)
y= 3     3 px (cx-1..cx+1)       ← 已對齊 cx,後續無 offset
y= 4..9  3 px (cx-1..cx+1)
```
> 16 上 curve 偏移只有 1px(vs 32 的 2px),仍可讀為「斜的」。

### 6.3 Guard 16(`guardStyle` 簡化)

| guardStyle(spec) | 16 collapse 規則 | y=10 |
|---|---|---|
| `bar` | 自身 | width 5 (cx-2..cx+2) |
| `swept` | **collapse 成 `bar`** | 同 bar |
| `disc` | 自身 | width 6 (cx-3..cx+2) — 中下凸 1px |

> `swept` 在 16 上的 1px drop 過於微妙,直接 collapse。`disc` 採「左 3 + 右 2」非對稱寬 6(cx 偶數無對稱寬 6),這是 16 上唯一可行的「中段增寬」方式;視覺上仍能讀出比 bar 略寬。

實作上 collapse 規則只在 `renderSwordSpec16` 內判斷,**不污染 spec**(spec 的 `guardStyle = 'swept'` 在 16 path 走 bar 邏輯,sample / spec dump 仍標 swept)。

### 6.4 Grip 16

固定:寬 3(cx-1..cx+1),高 3 列(y=11..13)。

> 經 outline + seam pass 後,grip 16 唯一可見 leather main 的 cell 是 `(cx, 12)` — 9 cell 中的中央 1 cell(其餘 8 個都觸邊或鄰異 enum)。這 1 px leather 雖少,但已足以讓眼睛從色差讀出「中段是非金屬」。寬 3 比寬 1 / 寬 2 都好,因為後兩者連 1 px leather 都留不下,grip 整段會變黑色窄條,跟 guard / pommel 之間沒有色差,讀起來像「金屬 → 黑線 → 金屬」而不是「金屬 → 皮繩 → 金屬」。

### 6.5 Pommel 16(`pommelStyle` 簡化)

| pommelStyle(spec) | 16 collapse 規則 | y=14 |
|---|---|---|
| `round` | 自身 | width 1 (cx) |
| `disk` | 自身 | width 3 (cx-1..cx+1) |
| `gem` | **collapse 成 `round`** | width 1 (cx) |

> 16 pommel 1 列高、寬度區間只剩 1/3。`gem` 的 1px highlight 沒處放(round 變 1×1 後,outline pass 會把該 cell 改寫成 outline 色,放 gem 等於覆蓋 outline)。

### 6.6 16 不畫的 feature

- `hasFuller` — drop(blade 寬 2-3,中央 1px 跟 inside-outline 衝突)
- `hasGripWrap` — drop(grip 3 列高,1 條 wrap 看起來像 seam 把 grip 切兩段)

實作上跟 16 collapse 規則一樣,只在 `renderSwordSpec16` 不執行對應 paint code,**不污染 sample / spec**。

### 6.7 16 保留的 feature

- `bladeShine` — 保留,壓縮成 3-4 px:
  - `straight` 16:y=4..7,x = `cx`(width 3 blade 唯一 interior column)
  - `broad` 16:y=4..8,x = `cx-1`(width 5 blade 的內側最左 column)
  - `curved` 16:y=4..7,x = `xCenter(y) = (rows[y].leftX + rows[y].rightX) / 2`(blade 中軸 / 唯一 interior column)
- `paintInternalSeams` — 保留(直接共用)
- `applyInsideOutlinePass` — 保留(直接共用)

### 6.8 16 視覺多樣性試算

`3 archetype × 2 effective guardStyle × 2 effective pommelStyle × 5 metal family = 60` 直接可見組合。

跟 potion 16 同量級(potion 16 估約 3 shape × 3 cap × 6 family = 54 + level 連續)。

---

## 7. 檔案組織

```
random.js          (既有,不動)
palette.js         改:新增 METAL_FAMILIES、sampleSwordPalette、LEATHER_PALETTE。
                          既有 FAMILIES / samplePalette / CORK_PALETTE 不動。
pixel-utils.js     (既有,不動 — paintInternalSeams 與 applyInsideOutlinePass 直接共用)
potion.js          (既有,不動)
sword.js           新增:sampleSwordSpec、renderSwordSpec32、renderSwordSpec16、
                          shape / paint helpers,所有 const(SWORD_ARCHETYPES、
                          SWORD_GUARD_STYLES、SWORD_POMMEL_STYLES 等)、
                          drawSword 對外 entry。
main.js            改:刪 drawSword 占位 stub,改用 sword.js 的 drawSword。
                          drawSpear 占位 stub 維持不動(下輪迭代再處理)。
index.html         改:script 載入順序改為:
                          random.js → palette.js → pixel-utils.js → potion.js → sword.js → main.js
regression.html    改:在現有 potion regression grid 之下新增 sword section,共用同樣
                          baseline workflow(下載 PNG + specs.json)。
```

---

## 8. 視覺迴歸驗證

複用 `regression.html`,新增 sword section。

### 內容
- 新增 ~16 個 sword seed,涵蓋:
  - 每個金屬 family 至少 1 張(5 張)
  - 每個 archetype 至少 1 張(已被 family 覆蓋多數;補 broad 與 curved 各 1 張保險)
  - 每個 guardStyle 至少 1 張
  - 每個 pommelStyle 至少 1 張(含 gem)
  - Edge cases:`hasFuller && straight`、`hasFuller && broad`、`hasGripWrap=2 條`、`hasGripWrap=1 條`、`gem + disc guard`、`obsidian + curved` 等代表性組合
- 載入時 32×32 與 16×16 兩種尺寸並排畫到 grid,每張下方標 seed 與 spec.family + archetype。
- 既有兩個按鈕「下載全部 PNG」「下載 specs.json」直接擴充涵蓋 sword(同檔輸出,sword 部份附加在 potion 之後)。

### 工作流
跟 potion 完全一致:改 code 前下載 baseline → 改完下載 new → Preview 切換比對 → diff specs.json 區分 sampler/renderer 變動。

---

## 9. 公開介面契約

```js
// 不變
drawSword(ctx, rng, size)
```

`main.js` 對外只看到 `drawSword`。`ITEM_TYPES` 表不變、`generate()` 流程不變、preview / batch grid / download / reroll 全部不動。內部實作完全換掉,呼叫端零感知(跟 potion 完成時的契約一樣)。

---

## 10. 已知 risks / 留待實作確認

1. **HSL→RGB 邊界色**:`obsidian` 的 hue 270-290 + sat 20-30 + L 30,推出來的 bladeMain 可能太接近 outline,讓 inside-outline pass 後 blade 內部「看不見」。實作時若發現,在 sample 階段對該 family 的 sat / lightCenter 微調(把 lightCenter 拉到 35~40 確保跟 outline 12 有足夠對比)。
2. **Curved blade 的 outline 連續性**:斜階梯 silhouette 在 4-鄰居檢測下「對角線單點」可能漏判,沿邊產生 1px 斷縫。實作時需確認;不夠則改 8-鄰居(代價是某些尖角會略胖一格,跟 potion `flask` 的同類風險一樣)。
3. **16×16 grip 中央 leather 太細**:寬 3 grip 經 outline + seam pass 後只剩 `(cx, 12)` 1 px 顯示 leather 主色。若視覺迴歸覺得這 1 px 不足以讀出「皮繩」語意(例如某些金屬 family 跟 LEATHER_PALETTE.main 對比不夠),把 LEATHER_PALETTE.main 微調更暗(例如 `#5a3818`),強化 grip 跟金屬的色差。
4. **16×16 broad blade**:寬 5 + 短身可能讓 broad 像 cleaver 不像 sword。實作後若視覺判定不符,把 broad 16 寬度從 5 降到 4(cx-2..cx+1 偏左不對稱),或進一步只在 32 保留 broad,16 collapse 成 straight。
5. **`disc` guardStyle 的 16 表現**:寬 6 的 disc(cx-3..cx+2)非對稱、且整列被 outline pass 染為 outline 色,跟 bar 的視覺差只剩 1 px 寬度。若視覺迴歸覺得辨識度太低,fallback collapse 成 bar(16 上只剩 `bar` 一種有效 guardStyle,可接受)。
6. **`curved` 16 曲度太微妙**:寬 3 blade 在 8 列高度上只能做 1 px tip offset(spec §6.2),曲線可能讀不出來。實作後若視覺看像 straight,把 curve 改在 mid-blade 也偏移 1 px(blade 上半 cx..cx+2、下半 cx-1..cx+1),代價是 curve 總幅度仍只有 1 px 但分布在更多列。
7. **String-length hash 反例**:potion 實作筆記指出 `spec.shape.length + spec.family.length` 當 hash 太脆。本 spec **不重複此錯誤** — 任何需要從 spec 算「次要隨機數」的地方,都在 sample 階段就算好寫進 spec(`gripWrapYs` 即此模式)。

---

## 11. 後續迭代鉤子(本輪不做,僅記錄)

- **稀有度 tier**:在 spec 加 `tier`,render 階段最後一步加 `applyOuterGlowPass`(B-style 外擴 1px,顏色為 `palette.bladeShine` 提亮)。**架構不需重寫**,跟 potion 共用同一個 hook。
- **附魔劍(magical tinted blades)**:可在 sample 階段加 `enchant: null | 'fire' | 'frost' | ...`,當 `enchant` 不為 null 時改用 potion 的 `samplePalette` 取得 hue,再 blend 到 `bladeMain` 上。會打開的口子:稀有度 + magical 並用時的色衝突。本輪明確不做。
- **Dagger / two-hander 變體**:做為新 item type(`drawDagger` / `drawGreatsword`),不擠進 sword archetype 軸。複用 `palette.js` 的 metal family 與 `LEATHER_PALETTE`、`pixel-utils.js` 全部。
- **`drawSpear`**:採同樣 spec → render 兩階段 pattern;palette / pixel-utils 直接共用;主要設計工作在 spear-specific 的 head/shaft/butt 三段切割與 archetype(直矛 / 三叉 / 鉤矛)。
- **重新評估 `fuller` / `gripWrap` 在 16 復活**:本輪在 16 全 drop;實作後若覺得 16 太單調,可挑 1 個 feature 做 16 簡化版本(例如 fuller 16 強制只在 broad 啟用、寬 5 的中央 1 列)。
