# drawSpear 程序化規則 — 設計文件

**狀態:** 已通過 brainstorm,待寫實作計畫
**日期:** 2026-05-08
**範圍:** 只重寫 `drawSpear`(目前是 `main.js` 內的占位 stub)。其他 item type 不在這輪。

---

## 1. 目標 & 非目標

### 目標
- 把 `drawSpear` 從占位升級為「真正的程序化規則」。
- 每張產出視覺上明顯不同(矛頭形狀、矛末端、金屬色族、shaft binding 隨 seed 變化)。
- 看起來像 RPG 道具圖示,跟同 batch 中的 potion / sword 並排不撞風格。
- 滿足專案三條硬約束:
  - **整數像素對齊**:所有座標、寬高皆為整數,不使用 sub-pixel。
  - **limited palette**:每張圖示最多 5~6 色(outline + headMain + headShine + WOOD.main + 至多 1~2 個輔助色)。
  - **連續 outline**:暗色描邊全身一致、不中斷,以演算法保證(沿用 `applyInsideOutlinePass`)。
- 同 seed 永遠重現相同輸出。
- 同時支援 32×32(主)與 16×16(子集)兩種尺寸。
- 對外介面契約 `drawSpear(ctx, rng, size)` 不變,呼叫端零感知。

### 非目標(留待後續迭代)
- 矛頭魔法光暈 / 粒子 / 外圈 glow
- partisan / winged spear(帶獨立 cross-piece 部位)— brainstorm 已決定走 **3-part** layout(head + shaft + butt),變異全部走 head archetype,因此本輪不做 cross-piece。
- 其他 polearm 變體(halberd / glaive / poleaxe)— 做為新 item type
- 稀有度 tier 的視覺差異(留 hook,本輪不做)
- 動畫 / 任何時間相關效果
- 「魔法附魔矛」(火焰矛 / 冰霜矛)— 跟 sword 同決定,本輪只用金屬色族
- `drawDagger` / `drawAxe` 等其他武器

### 設計姿態
直接沿用 potion / sword 已建立的 spec→render 兩階段架構與 `palette.js` / `pixel-utils.js` 的可重用基礎設施,**不重新發明結構**,只設計新物品的 spec 結構與 shape 幾何。

### 整體方向決定
**Vertical(直立)** — head 在 y=2..7、shaft 在 y=8..25(主體)、butt 在 y=26..28、cx=16 中軸對齊。
- 為什麼不走對角線:sword curved 走 1:2 對角是因為 reference 在 64×64 的「vertical hilt + 中段彎」blade 在 32 上中段 stairstep 讀不出曲線,改整把斜避開。Spear **沒有曲度要表達**,vertical 反而最大化 32 行可用高度,並跟 sword 視覺區隔。
- 為什麼不走 slight slant:1:4 等 subtle slant 在 shaft 上會出現多次 1px shoulder stairstep — 跟 sword v4 失敗的原因同類,32 上讀起來像「shaft 斷接」。

---

## 2. 整體架構 — 兩階段:Spec → Render(沿用 sword pattern)

```
drawSpear(ctx, rng, size)
  │
  ├─ sampleSpearSpec(rng)
  │     ↑ Phase 1:RNG 集中於此,輸出純資料 spec object
  │
  └─ size === 32 ? renderSpearSpec32(ctx, spec)
                 : renderSpearSpec16(ctx, spec)
        ↑ Phase 2:純函式,不再使用 RNG;同 spec → 同 pixel
```

### Spec 物件結構

```js
{
  family: 'steel',                         // for debug / regression
  palette: {
    outline,        // HSL(h, 50, 12)              ← 同 sword / potion 公式
    headMain,       // HSL(h, s, lightCenter)
    headShadow,     // HSL(h, s+10, lightCenter-15) ← shaft binding 不用,留給未來 head ridge
    headShine,      // HSL(h+5, s-15, 85)           ← always-on 高光
  },
  // 注意:
  //   - shaft 顏色不在 spec.palette 裡,使用 palette.js hardcoded 的 WOOD_PALETTE 常數
  //     (family-independent,類比 sword 的 LEATHER_PALETTE / potion 的 CORK_PALETTE)。
  //   - butt 顏色 = headMain(同金屬塊)。
  archetype: 'straight' | 'trident' | 'hooked',
  buttStyle: 'disc' | 'sphere' | 'spike',
  hasShaftBinding: bool,                   // 50%
  shaftBindingYs: [y, y, ...],             // sample 階段就決定的 binding 帶位置(原始 y 座標,32 版本)
}
```

`shaftBindingYs` 在 sample 階段就決定,確保 render 是純函式,跟 sword 把 `gripWrapYs` 寫進 spec 同邏輯。

### Palette sampler

新增 `sampleSpearPalette(rng)` 在 `palette.js`,內部呼叫既有 `sampleSwordPalette` 並把 `bladeMain/bladeShadow/bladeShine` 重命名為 `headMain/headShadow/headShine`。理由:同樣 metal family 邏輯但 spec 欄位語意要符合 spear(劍刃 vs 矛頭),且這樣 spear.js / sword.js 各自的 spec 結構保持獨立、互不耦合。

```js
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

未來若新增 dagger / axe 等 metal-using item,可以重構成 `sampleMetalPalette` 共用,但本輪 YAGNI 不做。

---

## 3. Render Pipeline(32×32)

```
1. buildSpearMask32(spec)                  → enum mask(下節定義)
2. paintMaskByEnum(ctx, mask, palette)     → 平鋪主色:
                                              head  → headMain
                                              shaft → WOOD_PALETTE.main
                                              butt  → headMain     (同金屬色)
3. paintHeadShine32                         → always-on 1px 縱線高光(沿 archetype 的 head body)
4. spec.hasShaftBinding && paintShaftBinding32 → 1-2 條 WOOD_PALETTE.shadow 橫帶
5. paintInternalSeams(ctx, mask, outline)  → 所有 4-鄰居標籤不同處畫 outline 色
6. applyInsideOutlinePass(ctx, mask, outline) → 外圈描邊,保證閉合
```

**比 sword 簡化:**
- 沒有 fuller(本輪不做 head ridge)。
- 沒有 gem(buttStyle 不需要額外 paint pass)。
- 只有 1 個 optional paint pass(`paintShaftBinding32`)。

### Mask 表示法

單一 enum mask(同 sword / potion):每個 pixel 標
`'head' | 'shaft' | 'butt' | null`(null = 透明 / 圖示外部)。

- 每個 pixel 只屬於一個元件。
- inside-edge outline pass 規則跟 sword 完全一樣(沿用 `applyInsideOutlinePass`,不改)。
- internal seam pass 規則跟 sword 完全一樣(沿用 `paintInternalSeams`,不改)。

---

## 4. 32×32 幾何規格

### 4.1 整體垂直配置(所有 archetype 共用)

```
y= 0..1    padding(2 rows top)
y= 2       head tip(1 row, width 1px)
y= 3       head taper(1 row, width 3)
y= 4..6    head body(3 rows, archetype-specific 寬度)
y= 7       head shoulder(1 row, width 3,以接 shaft)
y= 8..25   shaft(18 rows,width 3,cx-1..cx+1)
y= 26..28  butt(3 rows,buttStyle-specific 寬度)
y= 29..31  padding(3 rows bottom)
```

合計 32 列。中軸 `cx = 16`。

> **為什麼 butt 要 3 列高?** 跟 sword pommel 同邏輯。4-鄰居 outline + seam pass 下 2 列高的 butt 所有 cell 都會被改成 outline 色(上鄰 shaft 不同 enum、下鄰 padding null、左右兩端 col 觸 null),`headMain` 完全不可見,butt 看起來只是黑 blob。3 列高才能讓中間列(y=27)的 interior cell 存活下來顯示 `headMain`。
>
> **為什麼 head 要 6 列高?** tip(1)+ taper(1)+ body(3)+ shoulder(1)= 6。Body 至少要 2 列(否則 archetype 之間在小尺寸看不出差別)、最好 3 列(讓 interior cell 數夠多)。6 列加上 shaft 18 列、butt 3 列、padding 5 列正好填滿 32。

### 4.2 Head Body(`archetype`)

每個 archetype 是「給 row y 回傳 `{ leftX, rightX, kind: 'head' } | null`」的純函式,描繪 head 外輪廓。整數座標。

weighted pick:`straight: 3, trident: 2, hooked: 1.5`(跟 sword `[3, 2, 1.5]` 比例一致)。

#### `straight` — 對稱長葉狀矛頭(leaf spear)
```
y= 2     1 px (cx)              ← tip
y= 3     3 px (cx-1..cx+1)      ← taper
y= 4..6  5 px (cx-2..cx+2)      ← body 寬度恆定 3 列
y= 7     3 px (cx-1..cx+1)      ← shoulder(同 shaft 寬,實際被 seam pass 染為 outline)
```
Body 與 shaft 中央對齊(都以 cx 為中心)。經 outline + seam pass 後 head 可見 interior cells:
- y=3 col 16(taper 中央):1 cell
- y=4..6 cols 15..17(body 中央三列三 cells 寬):9 cells

合計 ~10 cells `headMain`。

#### `trident` — 三叉矛頭
3 prongs at cols 13, 16, 19(cx-3, cx, cx+3),間距 3 col。
```
y= 2     3 prongs 各 1 px (cols 13, 16, 19)        ← prong tips
y= 3     3 prongs 各 1 px (cols 13, 16, 19)        ← prong bodies
y= 4     7 px (cx-3..cx+3 = cols 13..19)           ← bridge(連接三叉)
y= 5..6  5 px (cx-2..cx+2 = cols 14..18)           ← body 寬度收回 5
y= 7     3 px (cx-1..cx+1)                         ← shoulder
```

Prong 之間的 1-col 縫隙(cols 14, 15, 17, 18 在 y=2..3)留 null。經 outline pass:
- y=2..3 cols 13, 16, 19 全部變 outline 色(各 1px×2 黑色直條)→ 視覺上 3 個 prong 清楚可讀
- y=4 bridge w7:cols 13, 19 邊緣 outline、cols 14, 15, 17, 18 上鄰 null 也 outline、僅 col 16 interior(因 col 16 上下都是 head)
- y=5..6 body w5:cols 14..18 中央三 cell interior(cols 15..17)

合計 ~7 cells `headMain` interior + 6 cells outline-color prongs。Trident silhouette 明顯。

> **Trident 強制 `hasShaftBinding` 不限制** — binding 在 shaft 上跟 head 結構獨立,所以 trident 仍可有 binding(不像 sword `hasFuller` 跟 curved 衝突)。

#### `hooked` — 不對稱鉤矛 / 帶倒刺
鉤子在右側,從 y=5 起逐列向右擴張、y=6 達峰、y=7 收回 shoulder。
```
y= 2     1 px (cx)              ← tip
y= 3     3 px (cx-1..cx+1)      ← taper
y= 4     5 px (cx-2..cx+2)      ← body 對稱 w5
y= 5     6 px (cx-2..cx+3)      ← body 開始長鉤(右邊多 1 col)
y= 6     7 px (cx-2..cx+4)      ← 鉤峰(右邊再多 1 col,到 col 20)
y= 7     3 px (cx-1..cx+1)      ← shoulder(收回對稱)
```

Hook 部分(y=5 col 19, y=6 cols 19..20)經 outline pass 後上鄰或右鄰 null → 全部變 outline 色,視覺上是 head 右側突出的 2-3 cell 黑色鉤子,讀為「barbed/hooked」。

合計 ~12 cells `headMain` interior + ~3 cells outline hook。Hooked head 比 straight / trident 視覺上更「肥」。

### 4.3 Shaft

固定:寬度 3(cx-1..cx+1),高 18 列(y=8..25),整塊 enum = `'shaft'`。
顏色 = `WOOD_PALETTE.main`。

經 outline + seam pass 後實際可見 wood 主色:`(cx, y=9..24)` 共 16 cells(y=8 上鄰 head shoulder 不同 enum 被 seam 染、y=25 下鄰 butt 不同 enum 被 seam 染、cols 15 / 17 全部 outline)。1 px 寬度的 wood 條足以區分 shaft 跟 metal 部位。

> **為什麼是 width 3?** 跟 sword grip 同邏輯。Width 1 完全沒 interior(整條變 outline 色)、width 2 也沒 interior(每個 cell 都觸邊)。Width 3 才有中央 1 column 顯示主色。

### 4.4 Butt(`buttStyle`)

uniform pick(機率均等)。butt 區塊 enum = `'butt'`,顏色 = `headMain`,佔 y=26..28 共 3 列。

| buttStyle | y=26 | y=27 | y=28 | 視覺 |
|---|---|---|---|---|
| `disc` | width 5 (cx-2..cx+2) | width 5 (cx-2..cx+2) | width 5 (cx-2..cx+2) | 平蓋金屬盤,外圈被 outline 染、中央 cols 15-17 顯示 headMain(3 cells) |
| `sphere` | width 3 (cx-1..cx+1) | width 5 (cx-2..cx+2) | width 3 (cx-1..cx+1) | 上下窄中間寬,讀為金屬球;y=27 中央 cols 15-17 顯示 headMain(3 cells) |
| `spike` | width 5 (cx-2..cx+2) | width 3 (cx-1..cx+1) | width 1 (cx) | 從上往下收成 1 px 點,讀為著地用尖端;y=27 col 16 顯示 headMain(1 cell) |

> Butt 三列同色 / 同 enum,seam pass 不會在 butt 內部畫線(同 enum)。Shaft↔Butt 邊界由 seam pass 自動描邊。

### 4.5 Always-on 裝飾:`paintHeadShine32`

光源同 sword / potion(從左上來)。在 head body 的 interior column(經 outline pass 後仍可見的內部 column)畫 1px 縱線,顏色 = `palette.headShine`。

| archetype | shine x | shine y range | 說明 |
|---|---|---|---|
| `straight` | `cx-1 = 15` | y=4..6(3 列) | body w5 的內側最左 column |
| `trident` | `cx-1 = 15` | y=5..6(2 列) | body w5 的內側最左 column;y=4 bridge w7 在 cx-1 處 up=null 是 outline,跳過 |
| `hooked` | `cx-1 = 15` | y=4..6(3 列) | body 至少 w5 的內側最左 column |

實作 helper(類比 sword `tryPaintBladeCell`):**只在 `mask[y*size+x] === 'head'` 時畫**,避免畫到 shaft / 外面。

> **與 outline pass 的順序關係:** shine 在 step 3、outline pass 在 step 6(後畫)。shine 必須選 interior column,否則被 outline pass 改寫掉。`cx-1 = 15` 在三個 archetype 的對應 y range 裡都是 interior。

### 4.6 條件裝飾:`paintShaftBinding32`

trigger:`spec.hasShaftBinding`。

`spec.shaftBindingYs` 在 sample 階段決定:
- 50% 機率 1 條,50% 機率 2 條
- y 範圍 [10..23](shaft y=8..25,避開 y=8..9 與 y=24..25,這四列上下兩端會被 seam pass 染為 outline,binding 畫在那會被覆蓋)
- 2 條時兩 y 至少間隔 3 列

兩個 hardcoded pool(`spear.js` file-internal const):
- `SPEAR_BINDING_SINGLES = [10, 12, 14, 17, 20, 22]`(6 個位置,涵蓋 shaft 上 / 中 / 下)— 1 條時 `pick` 一個 y。
- `SPEAR_BINDING_PAIRS = [[10, 14], [11, 16], [13, 18], [15, 20], [18, 23], [11, 21]]`(6 對,間距全 ≥ 4,涵蓋 shaft 上 / 中 / 下不同位置與不同間距)— 2 條時 `pick` 一對。

兩 pool 大小先各 6,實作後若視覺迴歸顯示重複感過強,risk §11.7 已記錄擴充。

每條 binding = 1 列水平直線,寬度 = shaft 寬(cols 15..17),顏色 = `WOOD_PALETTE.shadow`。
gate:只在 `mask[...] === 'shaft'` 時畫(避免畫到 head / butt / 外面)。

> 經 outline pass 後,binding 在該列實際可見的只有 `(cx=16, y)` 1 cell(左右兩 cell 是 outline ring,被 outline pass 改寫)。視覺效果是「在 16 列高的 wood 主色條上,點綴 1-2 個 shadow 色 1×1 像素」,讀為纏繩/金屬綁帶痕跡。跟 sword `paintGripWrap32` 完全同 idiom。

---

## 5. Palette 系統

### 5.1 金屬色族表(沿用既有,不動)

`palette.js` 既有的 `METAL_FAMILIES`(steel / iron / bronze / gold / obsidian)直接共用。

### 5.2 `sampleSpearPalette(rng)` 流程

新增於 `palette.js`,內部呼叫 `sampleSwordPalette(rng)` 並重命名 `bladeMain → headMain`、`bladeShadow → headShadow`、`bladeShine → headShine`。其餘(family / outline 公式)完全相同。

### 5.3 Wood 常數(family-independent,新增於 `palette.js`)

```js
const WOOD_PALETTE = {
  main:      '#a87c4e',   // 中等橡木色
  shadow:    '#6a4020',   // 深棕(用於 shaft binding)
  highlight: '#c8a070',   // 淺褐(本輪不用,留給未來 shaft shine)
};
```

- 給 shaft(主色)與 hasShaftBinding(shadow)使用。
- **不重用 `CORK_PALETTE`** — cork main `#8a5a2e` 偏橘紅、語意是「軟木塞」;wood `#a87c4e` 較淺較中性,語意是「木桿」。並排時 cork 出現在 potion 瓶口、wood 出現在 spear shaft,語意各自清楚。
- **不重用 `LEATHER_PALETTE`** — leather main `#6a4828` 太深(spear shaft 看起來會像染黑紅木棒,不像木桿)。
- `WOOD_PALETTE.highlight` 本輪不用,留給未來 shaft shine 等迭代。

### 5.4 每張 icon 可見色數

- 必畫:outline + headMain + headShine + WOOD.main = **4 色**
- 加 WOOD.shadow(if `hasShaftBinding`)= 5 色

符合 limited palette 約束(最多 5-6 色)。

### 5.5 與 potion / sword palette 的關係

- `palette.js` 同時 export `samplePalette`(potion 用)、`sampleSwordPalette`(sword 用)、`sampleSpearPalette`(spear 用)。**互不共用 sampler**。
- 三個 sampler 的 `outline` 公式相同(`HSL(h, 50, 12)`),**並排時 outline 風格 cohesive**。
- 全套圖示放一起:potion 高彩度魔法液體、sword 低彩度金屬武器、spear 金屬頭 + 木桿(色彩差異更大,有 wood 中性褐色)。三者語言互補。

---

## 6. 16×16 子集

### 6.1 整體垂直配置

```
y= 0       padding(1 row)
y= 1       head tip(1 row,1 px)
y= 2       head taper / 第二列(1 row,archetype-specific)
y= 3       head body(1 row,archetype-specific)
y= 4       head shoulder(1 row,跟 shaft 同寬,被 seam 染)
y= 5..12   shaft(8 rows,width 3)
y= 13..14  butt(2 rows,collapse 後恆為 disc w3)
y= 15      padding(1 row)
```

中軸 `cx = 8`。

### 6.2 Head — 16 版重新設計(非縮放)

#### `straight` 16
```
y= 1     1 px (cx)              ← tip
y= 2     3 px (cx-1..cx+1)      ← taper
y= 3     5 px (cx-2..cx+2)      ← body w5(只有 1 列)
y= 4     3 px (cx-1..cx+1)      ← shoulder(被 seam 染)
```
經 outline + seam pass 後 head 可見 interior cells:y=2 col 8(1)+ y=3 cols 7..9(3)= 4 cells `headMain`。

#### `trident` 16
3 prongs 在 cols 6, 8, 10(間距 2,比 32 版 cols 13, 16, 19 間距 3 收窄)。
```
y= 1     3 prongs 各 1 px (cols 6, 8, 10)   ← prong tips
y= 2     5 px (cx-2..cx+2)                  ← bridge w5(同時是 prong base)
y= 3     5 px (cx-2..cx+2)                  ← body w5
y= 4     3 px (cx-1..cx+1)                  ← shoulder
```

經 outline + seam pass:
- y=1 cols 6, 8, 10 全部變 outline 色(3 個 1×1 黑點)
- y=2 cols 6, 10 邊緣 outline、cols 7, 9 上鄰 null(prong gap)→ outline、col 8 interior(1 cell)
- y=3 cols 7..9 interior(3 cells,body 中央)

合計 ~4 cells `headMain` + 3 outline prong dots。Trident silhouette 在 16 上仍可讀。

#### `hooked` 16
```
y= 1     1 px (cx)              ← tip
y= 2     3 px (cx-1..cx+1)      ← taper
y= 3     5 px (cx-2..cx+2)      ← body w5
y= 4     6 px (cx-2..cx+3)      ← shoulder + 鉤(右邊多 1 col,被 seam 染)
```

`hooked` 16 沒有專屬 hook row(因 head 只有 4 列高度容不下),改用「shoulder 列向右多 1 col」表達 hook。經 outline + seam pass:
- y=2 col 8 interior(1 cell)
- y=3 cols 7..9 interior(3 cells)
- y=4 全部 outline(下鄰 shaft 不同 enum、cols 6 / 11 觸邊 / 觸 null)— 但 col 11 outline 留下 1 px 「鉤刺」

合計 ~4 cells `headMain` + 1 outline hook cell。Hook 在 16 上是 1 px 突起,subtle 但讀得出不對稱。

> **若實作後視覺迴歸覺得 hooked 16 跟 straight 16 太像**(hook 1 px 不夠),fallback 是 hook 移到 y=3:body 改成 `cx-2..cx+3`(w6 不對稱),y=4 維持 shoulder w3。代價是 body interior 從 3 cell 縮成 4 cell 但右邊 1 cell 是 outline(hook 視覺更突出)。本輪暫不採,留為 risk 6。

### 6.3 Shaft 16

固定:寬 3(cx-1..cx+1),高 8 列(y=5..12),整塊 enum = `'shaft'`。
顏色 = `WOOD_PALETTE.main`。

經 outline + seam pass 後可見 wood 主色:`(cx=8, y=6..11)` 共 6 cells(y=5 上鄰 head shoulder 被 seam 染、y=12 下鄰 butt 被 seam 染、cols 7 / 9 全部 outline)。6 px 中央 wood 條足以區分 shaft 跟 metal 部位。

### 6.4 Butt 16(`buttStyle` 簡化)

| buttStyle(spec) | 16 collapse 規則 | y=13 | y=14 |
|---|---|---|---|
| `disc` | 自身 | width 3 (cx-1..cx+1) | width 3 (cx-1..cx+1) |
| `sphere` | **collapse 成 `disc`** | 同 disc | 同 disc |
| `spike` | **collapse 成 `disc`** | 同 disc | 同 disc |

> Butt 16 高度只有 2 列,中間沒 interior 列(2 列高在 outline+seam pass 下所有 cell 都會變 outline 色)。所以 spike vs sphere vs disc 在 16 上殼形差異本來就無法表達(都會變黑色 silhouette)。**collapse 成 disc 統一處理**;spec.buttStyle = 'spike' 在 16 path 走 disc 邏輯,spec dump / regression 仍標 spike。
>
> 跟 sword 16 把 `swept` collapse 成 `bar`、`gem` collapse 成 `round` 同 idiom。

實作上 collapse 規則只在 `renderSpearSpec16` 內判斷,**不污染 spec**。

### 6.5 16 不畫的 feature

- `hasShaftBinding` — drop。Shaft 16 中央 wood 主色只有 6 cell,1 條 binding(1 cell shadow 色)切下去看起來像 seam 把 shaft 切兩段。跟 sword 16 drop `hasGripWrap` 同 idiom。

實作上跟 16 collapse 規則一樣,只在 `renderSpearSpec16` 不執行對應 paint code,**不污染 sample / spec**。

### 6.6 16 保留的 feature

- `headShine` — 保留,壓縮成 1-2 px:
  - `straight` 16:y=3 col 7(1 cell)— body 唯一 interior 偏左 column
  - `trident` 16:y=3 col 7(1 cell)— body 唯一 interior 偏左 column
  - `hooked` 16:y=3 col 7(1 cell)— 同 straight
- `paintInternalSeams` — 保留(直接共用)
- `applyInsideOutlinePass` — 保留(直接共用)

> Shine 在 16 上只有 1 px 是 sword 16 的同等量級(sword straight 16 shine 也是 4 px,broad 16 是 5 px,curved 16 是 4 px)。

### 6.7 16 視覺多樣性試算

`3 archetype × 1 effective buttStyle × 5 metal family × 1 (no binding) = 15` 直接可見組合。

跟 sword 16 同量級(sword 16 估約 60)。對 spear 16 而言 15 已足以避免在 batch grid 上重複感過強。

---

## 7. 檔案組織

```
random.js          (既有,不動)
palette.js         改:新增 sampleSpearPalette、WOOD_PALETTE。
                          既有 FAMILIES / samplePalette / CORK_PALETTE / METAL_FAMILIES /
                          sampleSwordPalette / LEATHER_PALETTE 不動。
pixel-utils.js     (既有,不動 — paintInternalSeams 與 applyInsideOutlinePass 直接共用)
potion.js          (既有,不動)
sword.js           (既有,不動)
spear.js           新增:sampleSpearSpec、renderSpearSpec32、renderSpearSpec16、
                          shape / paint helpers,所有 const 加 SPEAR_ 前綴
                          (見 §9 命名規則),drawSpear 對外 entry。
main.js            改:刪 drawSpear 占位 stub,改用 spear.js 的 drawSpear。
index.html         改:script 載入順序改為:
                          random.js → palette.js → pixel-utils.js → potion.js → sword.js → spear.js → main.js
regression.html    改:在現有 sword regression grid 之下新增 spear section,共用同樣
                          baseline workflow(下載 PNG + specs.json)。
```

---

## 8. 視覺迴歸驗證

複用 `regression.html`,新增 spear section。

### 內容
- 新增 ~16 個 spear seed,涵蓋:
  - 每個金屬 family 至少 1 張(5 張)
  - 每個 archetype 至少 1 張(已被 family 覆蓋多數;補 trident 與 hooked 各 1 張保險)
  - 每個 buttStyle 至少 1 張
  - Edge cases:`hasShaftBinding=2 條`、`hasShaftBinding=1 條`、`spike + obsidian`、`trident + gold`、`hooked + bronze` 等代表性組合
- 載入時 32×32 與 16×16 兩種尺寸並排畫到 grid,每張下方標 seed 與 spec.family + archetype + buttStyle。
- 既有兩個按鈕「下載全部 PNG」「下載 specs.json」直接擴充涵蓋 spear(同檔輸出,spear 部份附加在 sword 之後)。

### 工作流
跟 potion / sword 完全一致:改 code 前下載 baseline → 改完下載 new → Preview 切換比對 → diff specs.json 區分 sampler/renderer 變動。

---

## 9. 命名規則 — 避免跟 sword.js / potion.js 撞名(critical)

### 9.1 背景

vanilla JS 的 `<script>` tags 共用同一個 Script lexical environment,**top-level `const` 跨 script 重複宣告會產生 `SyntaxError: Identifier 'X' has already been declared`**,sword 已踩過這個坑(見 `docs/superpowers/2026-05-07-drawsword-implementation-notes.md` §1)。

更隱晦的是:`sword.js` 已使用一些**未加前綴**的 file-internal const(`ARCHETYPES` / `ARCHETYPE_WEIGHTS` / `GUARD_STYLES` / `POMMEL_STYLES` / `WRAP_PAIRS`),因為當時只跟 potion 比對沒撞。**Spear 不能再使用同名**,否則會跟 sword 撞。

### 9.2 規則

**Spear 所有 file-internal const / 函式只要可能跟 potion.js 或 sword.js 任一檔同名,一律加 `SPEAR_` 前綴或 `Spear` 中綴。**

| 識別字 | 處理 |
|---|---|
| `SPEAR_ARCHETYPES` | 必加(避撞 sword `ARCHETYPES`) |
| `SPEAR_ARCHETYPE_WEIGHTS` | 必加(避撞 sword `ARCHETYPE_WEIGHTS`) |
| `SPEAR_BUTT_STYLES` | 沒撞但維持一致風格 |
| `SPEAR_BINDING_PAIRS` | 沒撞但維持一致風格 |
| `SPEAR_SHAPE_FNS_32` / `SPEAR_SHAPE_FNS_16` | 必加(避撞 sword `SWORD_SHAPE_FNS_32/16`)(其實 sword 已加前綴所以不撞,但維持一致) |
| `buildSpearMask32` / `buildSpearMask16` | 必加 Spear 中綴(避撞 sword `buildSwordMask32/16`)— 同樣已不撞但維持一致 |
| `sampleSpearSpec` / `renderSpearSpec32/16` / `drawSpear` | 已含 Spear 中綴 |
| `shapeStraight32` / `shapeTrident32` / `shapeHooked32` / 16 版同 | spear 自身的形狀名;`shapeStraight32` 已被 sword 用了 — **必須加 `Spear` 中綴**(`shapeSpearStraight32` 等),避免 silent override |
| `paintHeadShine32/16` | sword 是 `paintBladeShine32/16`,語意不同名也不同,不撞 |
| `paintShaftBinding32` | sword 是 `paintGripWrap32`,不撞 |
| `tryPaintHeadCell32/16` | sword 是 `tryPaintBladeCell32/16`,不撞 |

> ⚠️ **`shapeStraight32` / `shapeStraight16` 撞 sword!** sword 已有同名 function。必須在 spear.js 改名為 `shapeSpearStraight32` / `shapeSpearStraight16` 等。同樣 `shapeBroad32` 是 sword 用的,spear 不會用;但 spear 自己的 `shapeTrident32` / `shapeHooked32` 是新名 sword 沒有,可不加 Spear 中綴。為一致起見,**spear 所有 shapeXxx 函式統一加 `Spear` 中綴**(`shapeSpearStraight32` / `shapeSpearTrident32` / `shapeSpearHooked32`)。

### 9.3 連帶設計慣例(下一輪 drawDagger / drawAxe 等請套用)

新 item type 的 file-internal const / 函式若名稱可能跟其他已存在 item type 撞名,一律加 item-type 前綴或中綴。

---

## 10. 公開介面契約

```js
// 不變
drawSpear(ctx, rng, size)
```

`main.js` 對外只看到 `drawSpear`。`ITEM_TYPES` 表不變、`generate()` 流程不變、preview / batch grid / download / reroll 全部不動。內部實作完全換掉,呼叫端零感知(跟 potion / sword 完成時的契約一樣)。

---

## 11. 已知 risks / 留待實作確認

1. **HSL→RGB 邊界色 obsidian + WOOD 對比**:`obsidian` 的 bladeMain 已知偏暗(L=30,實際 `headMain` 也是這值);WOOD.main `#a87c4e` 算 L≈48。head→shaft 邊界 seam pass 會畫 outline,理論上應有對比。但若實作後視覺迴歸覺得 obsidian spear 整體 wash out(metal 跟 outline 太接近),參考 sword spec §10 risk #1 的 fallback,把 obsidian 的 lightCenter 拉到 35-40。
2. **Trident 32 prong 在 col 13 / 19 的 4-鄰居 outline 連續性**:3 prong 之間相隔 2 cell null,outline pass 是 4-鄰居,應該不會漏判(每個 prong cell 都觸 null)。實作時需確認;若 prong 跟 bridge 交界(y=3 → y=4)出現 1px 斷縫,改為 8-鄰居(代價是某些 prong 角會略胖)。
3. **Shaft binding 1 cell 顯示在 wood main 中央會不會被誤讀為「shaft 中段斷掉」**:6 cell wood × 1-2 cell shadow 比 sword 4 cell leather × 1-2 cell shadow 對比強得多(wood 比 leather 亮 → shadow 差更大)。實作後若覺得 binding 看起來像「裂縫」而不是「綁帶」,把 WOOD_PALETTE.shadow 從 `#6a4020` 拉淺到 `#7a5028`(shadow 跟 main 對比稍降)。
4. **Hooked 32 hook 只有 ~3 px 視覺 footprint**:y=5 col 19 + y=6 cols 19-20。在 32 上是 3 px outline 突起。視覺迴歸後若覺得太微妙,fallback 把 hook 從 y=5 起到 y=7 都保留(shoulder 也帶鉤),hook footprint 增到 4-5 px。
5. **Trident 16 prong 間距 2 col(cols 6, 8, 10)實際是 1 cell gap**:prong 間 1 cell null,4-鄰居 outline 仍會把 prong 染為 outline 色;但 1 cell gap 在 16 上看起來會不會接連成一條粗線而看不出 3 prong?實作後若不夠分離,fallback 改成 2 prong fork(cols 6, 10 兩 prong 距離 4)— silhouette 從 trident 退化為 fork,但讀得出。
6. **Hooked 16 1px hook 太微妙**:見 §6.2 已記錄的 fallback(把 hook 提到 y=3 body 列,body 寬度改 w6 cols 6..11 不對稱)。
7. **shaftBindingYs 的 pair pool 大小**:本輪 hardcode 6 對。若實作後視覺多樣性夠,可保持;若不夠,擴成 10-12 對(覆蓋更多 binding 位置組合)。
8. **buttStyle weighted vs uniform**:本輪用 uniform pick(機率均等)。若 disc 看起來最「常見」、spike 看起來最「稀有」,可改 weighted(disc:2, sphere:1, spike:1)— 跟 sword `pommelStyle` 同 idiom。本輪先 uniform 看視覺迴歸再決定。
9. **String-length hash 反例**:potion / sword 實作筆記都指出 `spec.shape.length + spec.family.length` 當 hash 太脆。本 spec **不重複此錯誤** — 任何需要從 spec 算「次要隨機數」的地方,都在 sample 階段就算好寫進 spec(`shaftBindingYs` 即此模式)。

---

## 12. 後續迭代鉤子(本輪不做,僅記錄)

- **稀有度 tier**:在 spec 加 `tier`,render 階段最後一步加 `applyOuterGlowPass`(B-style 外擴 1px,顏色為 `palette.headShine` 提亮)。**架構不需重寫**,跟 potion / sword 共用同一個 hook。
- **附魔矛(magical tinted heads)**:可在 sample 階段加 `enchant: null | 'fire' | 'frost' | ...`,當 `enchant` 不為 null 時改用 potion 的 `samplePalette` 取得 hue,再 blend 到 `headMain` 上。會打開的口子:稀有度 + magical 並用時的色衝突。本輪明確不做。
- **Halberd / glaive / poleaxe 變體**:做為新 item type(`drawHalberd` / `drawGlaive`),不擠進 spear archetype 軸。複用 `palette.js` 的 metal family 與 `WOOD_PALETTE` / `LEATHER_PALETTE`、`pixel-utils.js` 全部。
- **Cross-piece / partisan 撐回頭**:若未來想做 winged spear / partisan,可加 `hasCrossPiece` 為 4-part mask(head + crosspiece + shaft + butt),需要 mask enum 新增 `'crosspiece'`。本輪明確排除以保持 mask 簡單。
- **`hasHeadRidge`**:類比 sword `hasFuller`,在 head body 中軸畫 1px shadow 縱線。本輪因 head body 只有 3 列(32)/ 1 列(16)、ridge 視覺太短未做。
- **`paintShaftShine`**:類比 sword `paintBladeShine` 但用在 shaft 上,WOOD_PALETTE.highlight 在 shaft 中央留 1px 高光。本輪因 shaft 已有 binding 變化、再加 shine 怕擠未做。
- **Sword + spear 共用 `sampleMetalPalette`**:把 `sampleSwordPalette` 改名,sword.js 跟 spear.js 都呼叫 generic 版本。本輪 YAGNI,等第三個 metal-using item 出現再做(dagger / axe / hammer)。
- **重新評估 16 復活 `hasShaftBinding`**:本輪在 16 全 drop;實作後若覺得 16 太單調,可挑簡化版本(例如 binding 16 強制只有 1 條、寬 1 px 在 cx 處)。
