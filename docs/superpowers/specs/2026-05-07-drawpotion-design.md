# drawPotion 程序化規則 — 設計文件

**狀態:** 已通過 brainstorm,待寫實作計畫
**日期:** 2026-05-07
**範圍:** 只重寫 `drawPotion`。`drawSword` / `drawSpear` 不在這輪。

---

## 1. 目標 & 非目標

### 目標
- 把 `drawPotion` 從占位升級為「真正的程序化規則」。
- 每張產出視覺上明顯不同(瓶型、瓶塞、液體色、液面、可選元件均隨 seed 變化)。
- 看起來像 RPG 道具圖示(有 cohesive 視覺語言,不是隨機色塊)。
- 滿足專案三條硬約束:
  - **整數像素對齊**:所有座標、寬高皆為整數,不使用 sub-pixel。
  - **limited palette**:每張圖示最多 4~5 色(outline + liquid main + liquid shadow + highlight + 可選 cap 色)。
  - **連續 outline**:暗色描邊全身一致、不中斷,以演算法保證(非靠人工小心)。
- 同 seed 永遠重現相同輸出。
- 同時支援 32×32(主)與 16×16(子集)兩種尺寸。
- 對外介面契約 `drawPotion(ctx, rng, size)` 不變,呼叫端零感知。

### 非目標(留待後續迭代)
- 發光 / 粒子 / 外圈光暈
- 雙瓶 / 葫蘆 / 三聯瓶等複合瓶身
- 稀有度 tier 的視覺差異
- 動畫 / 任何時間相關效果
- `drawSword` / `drawSpear` 的程序化規則

---

## 2. 整體架構 — 兩階段:Spec → Render

把「決定要畫什麼」與「怎麼畫」徹底分開。

```
drawPotion(ctx, rng, size)
  │
  ├─ samplePotionSpec(rng)
  │     ↑ Phase 1:RNG 集中於此,輸出純資料 spec object
  │
  └─ size === 32 ? renderPotionSpec32(ctx, spec)
                 : renderPotionSpec16(ctx, spec)
        ↑ Phase 2:純函式,不再使用 RNG;同 spec → 同 pixel
```

### 採用此架構的理由
1. **Debug 黃金特性**:固定 seed 出問題時,`console.log(spec)` 直接看到「flask + wax cap + 火紅 + 95% 滿 + 有標籤」,不需要瞪著 32×32 像素逆推。
2. **視覺迴歸 × spec dump**:除了存 PNG,還可同時 dump `specs.json`。下次規則改動後若 PNG 變了,diff `specs.json` 立刻分辨「是 sampler 邏輯變了」還是「renderer 邏輯變了」— 區分這兩個是 procgen debug 最頭痛的事。
3. **render 是純函式**:同 spec → 同 pixel,可獨立測試 renderer。
4. **未來延伸**:同 pattern 直接套用 `sampleSwordSpec` / `renderSwordSpec`;`applyInsideOutlinePass` 等基礎設施直接共用。

### Spec 物件結構
```js
{
  family: 'fire',                          // for debug / regression
  palette: {
    outline,        // HSL(h, 50, 12)
    glassBody,      // HSL(h, s-30, lightCenter+10) — 玻璃露出區
    liquidMain,     // HSL(h, s, lightCenter)
    liquidShadow,   // HSL(h, s+10, lightCenter-15)
    highlight,      // HSL(h+10, s-15, 80) — 玻璃高光、布塞、bubbles 共用
  },
  // 注意:cap 顏色不在 spec.palette 裡。
  //   - cork  使用 palette.js 內 hardcoded 的 CORK_PALETTE 常數(family-independent)。
  //   - wax_seal 渲染時由 liquidMain 推導(lightness +5%)。
  //   - cloth_tied 直接重用 palette.outline(繩)+ palette.highlight(布)。
  shape: 'flask' | 'round' | 'vial',
  capType: 'cork' | 'wax_seal' | 'cloth_tied',
  liquidLevel: 0.4..0.95,                  // 連續
  hasBubbles: bool,                        // 35%(vial 仍可有,只是位置受瓶寬限制)
  hasSediment: bool,                       // 25%
  hasLabel: bool,                          // 30%;vial 強制 false(瓶身太細)
  bubbles: [[x, y], ...],                  // sample 階段就決定好,確保 render 是純函式
  labelDots: [[x, y], ...],                // 標籤上的「字」高光點,同上
}
```

`bubbles` 與 `labelDots` 在 sample 階段就決定座標寫進 spec,而非 render 階段再 RNG。這是為了維持 render 的純函式性。

---

## 3. Render Pipeline(32×32)

```
1. buildSilhouetteMask(spec)           → enum mask:每 pixel 是 'glass'|'liquid'|'cap'|'label'|null
2. paintMask(ctx, mask, palette)       → 把 mask 平鋪上色(主色,還沒 outline)
3. paintHighlight(ctx, mask, spec)     → 玻璃左側固定光帶
4. spec.hasSediment && paintSediment   → 瓶底 2~3px 改 liquidShadow
5. spec.hasBubbles  && paintBubbles    → 用 spec.bubbles 座標,1×1 highlight 色
6. spec.hasLabel    && paintLabel      → 中段橫色帶 + spec.labelDots
7. applyInsideOutlinePass(ctx, mask, palette.outline)
                                        → 內側咬一圈描邊,保證閉合
8. paintInternalSeams(ctx, mask, palette.outline)
                                        → 鄰居標籤不同處畫 1px(瓶頸/瓶塞接縫等)
```

### Mask 表示法
單一 enum mask:每個 pixel 標 `'glass' | 'liquid' | 'cap' | 'label' | null`(null = 透明 / 圖示外部)。

- 每個 pixel 只屬於一個元件(label 在玻璃上時,該 pixel 標 `'label'`,不重複歸屬於 `'glass'`)。
- inside-edge outline pass 規則:**該 pixel 為非 null 且至少一個 4-鄰居是 null** → 改為 outline 色。
- internal seam pass 規則:**該 pixel 為非 null,且至少一個 4-鄰居有不同非 null 標籤** → 改為 outline 色。
- 此 mask 只是繪圖中介,不對外暴露。

---

## 4. 組件規格

### 4.1 瓶身形狀(`shape`)

每個 shape 是一個「給 row y 回傳 `{ leftX, rightX } | null`」的純函式,描繪瓶身外輪廓。整數座標。
weighted pick:`flask: 3, round: 2, vial: 1.5`。

| shape  | 32×32 規格 |
|---|---|
| `flask` | 底寬 16,線性收窄到頸寬 5;瓶身高 ~22px,頸高 ~4px |
| `round` | 下半圓 ⌀16(midpoint circle 演算法,整數),接 4px 直頸 |
| `vial`  | 整身寬 7,頸寬 5,直筒 |

所有 shape 在 silhouette 內部會被 inside-edge outline pass 「咬掉一圈」變描邊;規劃尺寸時要記得**主色可視區域 = silhouette − 外圈 1px**。

### 4.2 瓶塞(`capType`)

uniform pick(機率均等)。

- `cork` — 軟木:2~3px 高,瓶口寬 + 1。**獨立棕色 mini-palette**(`#8a5a2e` 主 / `#5a3a1e` 暗 / `#b88560` 亮),不跟液體共族。
- `wax_seal` — 蠟封:在瓶口外多包一層蠟,色用 `palette.liquidMain` lightness +5%;瓶口下方加 1~2px 蠟滴(在瓶頸兩側)。
- `cloth_tied` — 布綁:布蓋瓶口(`palette.highlight`),繩結 1px 寬繞瓶頸(`palette.outline`)。

### 4.3 液體

- `liquidLevel`:連續 `[0.4, 0.95]`。液面填到 `floor(bodyHeight * liquidLevel)`。液面平直,不做晃動 / 弧度。
- `paintSediment`(機率 25%):底部 2~3px 改用 `liquidShadow`。
- `paintBubbles`(機率 35%):液面下 2~4 顆 1×1 `highlight` 色。**位置在 sample 階段決定,寫進 `spec.bubbles`**。

### 4.4 高光(固定不隨機)

玻璃左側 1px 寬光帶,長度依 shape 不同:
- `flask`:沿斜邊 4~5px
- `round`:沿弧線左上 3~4px
- `vial`:中段 5~6px

固定的理由:這是「光源方向」的視覺一致性,讓全套圖示像同個世界出來的。

### 4.5 標籤(`hasLabel`,僅 flask & round)

- 機率 30%。`vial` 強制 false。
- 瓶身中段橫向 1~2px 高色帶,主色 `palette.outline`,2~3 個 1px `highlight` 像素點綴(模擬寫了字)。
- 點綴位置在 sample 階段決定,寫進 `spec.labelDots`。

---

## 5. Palette 系統

### 5.1 色族表(寫死於 `palette.js`)

```js
const FAMILIES = {
  fire:   { hue: [0, 20],    sat: [70, 90], lightCenter: 50, weight: 1 },
  frost:  { hue: [185, 215], sat: [55, 75], lightCenter: 55, weight: 1 },
  mana:   { hue: [240, 270], sat: [60, 80], lightCenter: 50, weight: 1 },
  poison: { hue: [80, 110],  sat: [60, 85], lightCenter: 45, weight: 1 },
  golden: { hue: [40, 55],   sat: [75, 90], lightCenter: 55, weight: 1 },
  shadow: { hue: [280, 320], sat: [40, 60], lightCenter: 35, weight: 1 },
};
```

### 5.2 `samplePalette(rng)` 流程

1. `pickWeighted` 一個 family。
2. 在 family 的 `hue` / `sat` 範圍內 RNG 取值,得到 `(h, s)`。
3. 推導其餘色(L 值由 family.lightCenter 決定):
   - `liquidMain   = HSL(h,    s,    lightCenter)`
   - `liquidShadow = HSL(h,    s+10, lightCenter-15)`
   - `highlight    = HSL(h+10, s-15, 80)` — 玻璃高光、bubbles、cloth_tied 布塊共用
   - `outline      = HSL(h,    50,   12)` — 描邊帶一點點族色避免純黑死板
   - `glassBody    = HSL(h,    s-30, lightCenter+10)` — 玻璃露出區

### 5.3 Cap 獨立常數(family-independent)

`palette.js` 另外 export hardcoded 常數:
```js
const CORK_PALETTE = {
  main:     '#8a5a2e',
  shadow:   '#5a3a1e',  // 也可在 cork 內部當描邊,但全圖外輪廓仍由 palette.outline 統一
  highlight:'#b88560',
};
```
僅 `cork` capType 使用。`wax_seal` / `cloth_tied` 用 spec.palette 既有色,不需新色槽。

每張 spec 視覺主色 = 4 色(outline / liquidMain / highlight / cap-main),滿足 limited palette 約束。
全套圖示 outline 風格一致(都是低飽和深色,只帶 hue 暗示族色),整套放一起時 cohesive。

---

## 6. 16×16 子集

### 保留
- `shape`(三種**重新設計成 16 版**,非縮放)
- `capType`(全部支援,但細節簡化)
- `liquidLevel`、`palette`(共用 sampler)
- 高光(縮成 1~2px)

### 捨棄(物理上塞不下)
- `paintBubbles`、`paintSediment`、`paintLabel`、wax 蠟滴

### 16 版 shape 規格
- `flask` 16:底寬 8,頸寬 3,身高 11,頸高 2
- `round` 16:⌀8 圓 + 2px 頸
- `vial` 16:寬 4,直筒高 12,頸 2

### 16 版 cap 規格
- `cork`:1px 高
- `wax_seal`:1px,不流蠟
- `cloth_tied`:簡化成 2×1 布塊 + 1px 繩線

### 共用
`samplePotionSpec`、`samplePalette`、`applyInsideOutlinePass`、enum mask 概念 — 兩條 render path 共用。

---

## 7. 檔案組織

```
random.js          (既有,不動)
palette.js         新增:FAMILIES + samplePalette + hslToRgbHex
pixel-utils.js     新增:fillRect, applyInsideOutlinePass, paintInternalSeams,
                          enum mask helper(allocate / paintByEnum)
potion.js          新增:samplePotionSpec, renderPotionSpec32, renderPotionSpec16,
                          shape / cap / liquid / highlight / label / sediment / bubbles
                          所有 paint 函式,bubble 與 label 點位的 sampling 子函式
main.js            改:刪 drawPotion stub,改成呼叫 potion.js 的 drawPotion;
                          fillRect 移走
index.html         改:script 載入順序
                          random.js → palette.js → pixel-utils.js → potion.js → main.js
```

`drawSword` 與 `drawSpear` 在 main.js 維持 stub 不動(之後迭代再處理)。

---

## 8. 視覺迴歸驗證

新增 `regression.html`(獨立頁,不影響主程式)。

### 內容
- Hardcode 一組 ~16 個 seed,涵蓋:
  - 每個色族至少 1 張(6 張)
  - 每個瓶型至少 1 張
  - Edge cases:液面 0.4 一張、0.95 一張、所有可選元件全開一張、零可選元件一張
- 載入時把 32×32 與 16×16 兩種尺寸並排畫到 grid,每張下方標 seed 與 spec.family。
- 兩個按鈕:
  - **「下載全部 PNG」**:把所有圖示拼接成單一 PNG,方便人眼一次看全。
  - **「下載 specs.json」**:dump `[{ seed, spec }]` 全部 spec object,JSON 格式。

### 工作流
1. 改 code 前:打開 `regression.html`,下載 baseline PNG + baseline specs.json,存成 `baseline-YYYYMMDD.png` / `.json`。
2. 改完 code:再次下載,得到 new PNG / new JSON。
3. 用 macOS Preview 切換比對 PNG;若 PNG 變了:
   - `diff baseline.json new.json` → 若 spec 變了 ⇒ sampler 邏輯改變
   - 若 spec 一樣但 PNG 變了 ⇒ renderer 邏輯改變
4. 確認變動是預期的,將 new 標為新 baseline。

---

## 9. 公開介面契約

```js
// 不變
drawPotion(ctx, rng, size)
```

`main.js` 對外只看到 `drawPotion`。`ITEM_TYPES` 表不變、`generate()` 流程不變、preview / batch grid / download / reroll 全部不動。內部實作完全換掉,呼叫端零感知。

---

## 10. 已知 risks / 留待實作確認

1. **HSL→RGB 邊界色**:某些 hue 邊界(例如 poison 110°)可能在公式下推出髒色。實作時若發現,在 spec 階段對該 family 的 sat / lightCenter 做窄幅例外調整。屬於微調而非結構問題。
2. **`flask` 收窄處的 outline 連續性**:inside-edge pass 對「斜邊」可能在 1px 寬處發生鄰接漏判。實作時需確認 4-鄰居檢測夠用;不夠則改 8-鄰居(代價是某些尖角會略胖一格)。
3. **16×16 `cloth_tied`**:4×3 的布塊 + 1px 繩結是否仍能讀出「布綁」語意未定。若實作時發現認不出,直接從 16 版的 capType 候選中移除 `cloth_tied`(在 sample 階段的 16-only 路徑就排除它),只留 cork / wax_seal。

---

## 11. 後續迭代鉤子(本輪不做,僅記錄)

- 若未來要做稀有度 tier:在 spec 加 `tier` 欄位,render 階段最後一步加 `applyOuterGlowPass`(B-style 外擴 1px,顏色為 `palette.highlight` lightness 提高)。架構不需重寫。
- 若未來要做新瓶型(葫蘆 / 雙瓶):新增 shape 函式 + 在 weighted pick 加一行;mask / outline pass 不動。
- `drawSword` / `drawSpear` 採同樣 spec → render 兩階段 pattern;`palette.js` / `pixel-utils.js` 直接共用。
