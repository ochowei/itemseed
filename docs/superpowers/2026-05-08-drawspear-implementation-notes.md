# drawSpear 實作筆記 — 2026-05-08

> 補充記錄 `specs/2026-05-08-drawspear-design.md` 與 `plans/2026-05-08-drawspear.md` 在實作後的偏移。原 spec/plan 仍代表 brainstorm/planning 當下的意圖,**code 是現況的唯一真相**。日後若要再改設計或實作 drawDagger / drawAxe / drawHalberd,先讀這份再讀 spec。

---

## 1. 命名規則 — 比 sword 更積極套用 SPEAR_ / Spear 前綴

### 1.1 背景

Sword 實作筆記 §1 已記錄:vanilla JS 的 `<script>` tags 共用同一個 Script lexical environment,跨 script 重複宣告 `const` → `SyntaxError`,重複 `function` declaration → silent override(後載入的 win)。Sword 因此把跟 potion 撞名的 const 加 `SWORD_` 前綴(`SWORD_SHAPE_FNS_32` 等),但**沒撞 potion 的 const 維持簡潔**(`ARCHETYPES` / `ARCHETYPE_WEIGHTS` / `GUARD_STYLES` / `POMMEL_STYLES` / `WRAP_PAIRS` 都沒前綴)。

到 spear 出現時,這些「沒撞 potion」的 sword const 變成跟 spear 撞了。

### 1.2 解法 — spear 內所有 file-internal const / function 一律加前綴

| 識別字 | 撞 sword 還是 potion | 處理 |
|---|---|---|
| `SPEAR_ARCHETYPES` | 撞 sword.js `ARCHETYPES` | 加 SPEAR_ 前綴 |
| `SPEAR_ARCHETYPE_WEIGHTS` | 撞 sword.js | 加前綴 |
| `SPEAR_BUTT_STYLES` | 沒撞 | 仍加前綴(一致風格) |
| `SPEAR_BINDING_SINGLES` / `SPEAR_BINDING_PAIRS` | 沒撞 | 仍加前綴 |
| `SPEAR_SHAPE_FNS_32 / 16` | 沒撞(sword 已是 `SWORD_*`)| 仍加前綴 |
| `buildSpearMask32 / 16` | 沒撞(sword 已是 `buildSwordMask*`)| 仍加 Spear 中綴 |
| `shapeSpearStraight32 / 16` | **撞 sword.js `shapeStraight32 / 16`** | 必加 Spear 中綴(否則 silent override 會搞壞 sword 渲染) |
| `shapeSpearTrident*` / `shapeSpearHooked*` | 沒撞(spear 自有名)| 仍加 Spear 中綴(一致) |
| `tryPaintHeadCell32 / 16` | 沒撞(sword 是 `tryPaintBladeCell*`)| 不加 SPEAR(語意不同) |
| `paintHeadShine32 / 16` | 沒撞 | 不加(語意不同) |
| `paintShaftBinding32` | 沒撞(sword 是 `paintGripWrap32`)| 不加 |
| `spearAddRange` | 沒撞 | 加 spear 前綴(防止未來 dagger / axe 加 addRange 撞) |

**一般規則:**
- file-internal `const` 大寫名 → **一律 `SPEAR_` 前綴**(不論有無撞名 — sword 漏這條才會跟 spear 撞)
- file-internal `function` 名 → **撞名一律加 Spear 中綴**;沒撞且語意夠特殊(`tryPaintHeadCell` / `paintShaftBinding`)可不加
- helper 私有 function(`spearAddRange`)→ 加 spear 前綴

### 1.3 連帶設計慣例(下一輪 drawDagger / drawAxe / drawHalberd 等請套用)

**新 item type 的 file-internal const 一律加 item-type 前綴;function 若名稱可能跟其他 item type 撞名,加 item-type 中綴。** 寧可前綴過頭也不要 silent override。

或者:把這些 file-internal const 改成 IIFE local scope 包起來,徹底消除全 script 共用 lex env 的撞名風險。本輪沒做這個重構(成本超出 task 範圍)。當第三個武器 type(dagger / axe)出現時建議重新評估。

---

## 2. Hooked 16 shoulder geometry — spec § 6.2 與 code 不同(code 為準)

### 2.1 spec §6.2 寫的

```
y= 4     6 px (cx-2..cx+3)      ← shoulder + 鉤(右邊多 1 col,被 seam 染)
```

也就是 cols 6-11(w6),總 cell count = 1+3+5+6 = **15**。

### 2.2 code 實際的

`spear.js` `shapeSpearHooked16`:

```js
spearAddRange(cells, 4, cx - 1, cx + 3); // shoulder + hook 1 px(右伸到 col 11)
```

也就是 cols 7-11(w5 偏右),總 cell count = 1+3+5+5 = **14**。

### 2.3 為什麼 code 是這樣

Plan Task 7 的 reference implementation 寫了 `cx - 1, cx + 3`(w5 偏右),verify step 也是 `[7, 8, 9, 10, 11]`。Plan 跟 code 一致,是 spec 在 brainstorm 結束後 freeze 時的設計選擇。Plan 的 verbal description 是「shoulder 列向右多 1 col 表 hook」— 我寫 plan 時把這理解成「整列 shifted 1 col right」(w5 偏右),而非「在原 w5 body 右邊延一 col」(w6)。

兩者視覺差異:
- **w5 偏右(現況)**:y=3 body cols 6-10,y=4 shoulder cols 7-11。左邊 col 6 在 y=4 消失,整列向右 shift,造成「lean right」姿態。
- **w6(spec)**:y=3 body cols 6-10,y=4 shoulder cols 6-11。左邊對齊不變,只在右邊延 1 col,造成「右側 bulge」。

兩者經 outline pass 後都是 y=4 全列 outline 色(因為都觸 seam 與 edge),差別在 silhouette 左邊 col 6 的有無。w5 偏右在小 size 上更「動感」、w6 較對稱。

### 2.4 spec 應澄清

Spec §6.2 的 hooked 16 區塊應該改成 `cx-1..cx+3` 與 1+3+5+5=14 cells。本輪不改 spec(仍代表 brainstorm 當下意圖),由本筆記指明 code 為準。

---

## 3. 細微的設計慣例 / 沒寫進 spec 但實作中決定的

### 3.1 `sampleSpearPalette` 是 thin wrapper,**不是** refactor

Spec §5.2 寫 `sampleSpearPalette` wrap `sampleSwordPalette` 並重命名 `bladeMain → headMain` 等。Code 完全照辦。**沒有**把 `sampleSwordPalette` 改名成 `sampleMetalPalette`(這是 spec §12 後續鉤子明確 defer 的事)。

當 dagger / axe 等第三個 metal-using item 出現時,可以做:
- `sampleSwordPalette` 改名成 `sampleMetalPalette`,sword.js / spear.js / dagger.js 都呼叫
- 或保留 `sampleSwordPalette` / `sampleSpearPalette` / `sampleDaggerPalette` 各自 wrapper(目前模式延伸)

兩者都 OK。本輪 wrapper 模式至少證明這個介面能 scale。

### 3.2 16 collapse rules 寫在 `buildSpearMask16`,**不污染 spec**

`buildSpearMask16` 對 buttStyle 完全不看 — 不管 spec.buttStyle 是 disc / sphere / spike,butt cells 永遠是 cols 7..9 × y=13..14(w3 × 2 行)的固定形狀。

`renderSpearSpec16` 對 hasShaftBinding 也不調用 paintShaftBinding16(根本沒這個 function),不論 spec.hasShaftBinding 是 true 或 false。

這個 idiom 跟 sword 16 一致(sword.js `buildSwordMask16` 對 `swept` 跟 `gem` 也是內部 collapse 不污染 spec)。**規則:spec 是 sample-truth,16 collapse 在 render path 中內部處理,spec 自己不變。**

### 3.3 16 head 4 行,沒有 trident「跳過 y=4」shine 的問題

32 paintHeadShine32 對 trident 跳過 y=4(因 bridge w7 在 col 15 處 up=null 變 outline)。
16 paintHeadShine16 三個 archetype 都只畫 1 px 在 (col 7=cx-1, y=3),body 列 — 16 head 的 cells 結構讓 y=3 col 7 在三個 archetype 下都是 interior(straight 是 body w5 中央偏左、trident 是 bridge w5 中央偏左、hooked 是 body w5 中央偏左),不需要 archetype dispatch。

這個簡化是 16 layout 「壓縮到 4 行」的 side effect,不是設計目標。

### 3.4 `paintShaftBinding32` 寬 3 但只有 1 px 可見

`paintShaftBinding32` 每條 binding 畫 cols 15..17(w3),但 outline pass 後實際可見只剩 col 16 1 cell(cols 15 / 17 是 outline ring 被改寫)。看似浪費 2 個 fillRect call,但這個寫法跟 sword `paintGripWrap32` 完全一致 — 寫 cols 15..17 比寫 col 16 更語意化(「這條 binding 跨 shaft 全寬」),簡單性勝於微優化。Sword 過去用這個寫法沒問題,spear 沿用。

### 3.5 對 unknown size silent no-op

`drawSpear(ctx, rng, size)` 只支援 32 / 16。其他 size(8、64 等)會什麼都不畫、不 throw。同 potion / sword 的契約。

### 3.6 `tryPaintHeadCell32` 與 `tryPaintHeadCell16` body 完全一樣

只差名字。沒有 DRY 抽象,跟 sword `tryPaintBladeCell32` / `tryPaintBladeCell16` 一致(sword 實作筆記 §3.5 已記錄這個 duplication 的合理性)。留給未來如果 sword + spear + dagger 都需要 always-on shine 時,再抽成 generic helper。

---

## 4. Palette 演化

### 4.1 spec.palette 欄位

| 階段 | 欄位 |
|---|---|
| Spec §2 原版 | `outline / headMain / headShadow / headShine`(4) |
| 實作後 | 4 個欄位都還在,完全沒改 |

每張 spear icon **可見**色:
- 必畫:outline + headMain + headShine + WOOD_PALETTE.main = 4 色
- 加 WOOD_PALETTE.shadow(if `hasShaftBinding`)= 5 色
- (本輪沒做 hasHeadRidge,所以沒 headShadow 出現的場景)

符合 limited palette 約束(spec §5.4 規劃的 5 色上限)。

### 4.2 Outline 公式跟 potion / sword 一致

`hslToRgbHex(h, 50, 12)` — sat 寫死 50,L 寫死 12。三個 sampler 都用同一個公式,並排視覺 cohesive。

### 4.3 WOOD_PALETTE 三色 = main/shadow/highlight,但本輪只用 main/shadow

`highlight: '#c8a070'` 進 spec 但本輪沒用到,留給未來 shaft shine 等迭代(spec §5.3 已預告)。

### 4.4 跟 sword `sampleSwordPalette` 的耦合

`sampleSpearPalette` 內部呼叫 `sampleSwordPalette` 並重命名欄位。這意味:
- 同 seed 在 sword / spear 上會抽到相同 metal family + 相同 hex 色(只是 spec 裡欄位名不同)
- 未來 sword 改變 metal family 表(例如加新 family 或調 weight),spear 自動跟著變
- 這個耦合是**設計意圖**(palette.js §5.5 描述)— 兩種金屬武器並排視覺一致

副作用:回歸驗證時,sword + spear 的金屬色 baseline 會同步漂移(改 sword palette 也要重跑 spear regression)。本輪沒問題,但加 dagger 時會放大這個耦合。

---

## 5. 檔案組織 — 跟 plan 一致

| 檔案 | plan 規劃 | 實際 |
|---|---|---|
| `palette.js` | 加 WOOD_PALETTE、sampleSpearPalette wrapper | ✓ |
| `pixel-utils.js` | 不動 | ✓ |
| `potion.js` | 不動 | ✓ |
| `sword.js` | 不動 | ✓ |
| `spear.js` | 新增,結構同 sword.js | ✓(~430 行,主要重量在 shape 函式 + paint helpers + mask builder)|
| `main.js` | 移除 drawSpear stub,ITEM_TYPES.spear 指向新 drawSpear | ✓ |
| `index.html` | 加 spear.js script tag | ✓ |
| `regression.html` | 加 spear section,合併下載 | ✓(grid-potion / grid-sword / grid-spear 三 table,h2 分段;下載按鈕 spread 三個 collected list)|

---

## 6. 沒做的事(spec §1 + §12 列為非目標 / 後續鉤子,本輪明確 defer)

- 稀有度 tier(spec §12)— 未動
- 附魔矛 / magical tinted heads(spec §12)— 未動
- Halberd / glaive / poleaxe 變體 — 未動,留給新 item type
- partisan / winged spear(cross-piece)— mask 維持 3-part(brainstorm 階段已決定)
- `hasHeadRidge`(類比 sword `hasFuller`)— 未動,head body 太短(32 只 3 列、16 只 1 列)
- `paintShaftShine`(類比 sword `paintBladeShine` 但給 shaft)— 未動
- `sampleMetalPalette` refactor — 未動,等第三個 metal item 再做
- 16 復活 `hasShaftBinding`(spec §12 後續鉤子)— 未動,視覺迴歸後再考慮
- spear.js 的 IIFE 包裝(消除全 script 共用 lex env 風險)— 未動,等第三個 item type 出現再評估

---

## 7. Hooked 32 archetype 的 V1 → V2 promotion(Task 10 後 follow-up)

### 7.1 背景

Spec §11 risk #4 預測:
> Hooked 32 hook 只有 ~3 px 視覺 footprint(y=5 col 19 + y=6 cols 19-20)。視覺迴歸後若覺得太微妙,fallback 把 hook 從 y=5 起到 y=7 都保留(shoulder 也帶鉤),hook footprint 增到 4-5 px。

Task 10 完成後實際視覺迴歸,user 確認 V1 hook(只到 y=6)在 32 上看起來太細,難以讀為「barb / 鉤」。

### 7.2 V1 vs V2 比較流程

加 `shapeSpearHookedV2_32` + `SPEAR_SHAPE_FNS_32_V2` + `buildSpearMask32V2` + `renderSpearSpec32V2` 作為平行 scaffold,production 路徑不動。在 `regression.html` 加「hooked V1 vs V2」section,6 個 forced-hooked seed(5 metal family + 1 帶 binding)並排顯示 96×96 兩版圖示。

User 視覺判斷後選 V2。

### 7.3 V2 promote 後的清理

- `shapeSpearHooked32` 函式體換成 V2 內容(y=7 從 w3 cols 15-17 變 w5 cols 15-19)。其他 row 不變。
- 刪掉 `shapeSpearHookedV2_32`、`SPEAR_SHAPE_FNS_32_V2`、`buildSpearMask32V2`、`renderSpearSpec32V2` 與兩個對應 window export
- 刪掉 `regression.html` 的 `// drawSpear hooked — V1 vs V2` section + render block
- `shapeSpearHooked32` 的函式內 comment 加註「原 spec §4.2 hooked y=7 是 w3,A/B 後改 w5,見 implementation notes §8」

### 7.4 V2 production 幾何(現況)

```
y=2: tip 1px   (cx=16)
y=3: taper w3  (cx-1..cx+1)
y=4: body w5   (cx-2..cx+2)
y=5: body+hook w6  (cx-2..cx+3)
y=6: hook peak w7  (cx-2..cx+4)
y=7: shoulder + hook tail w5  (cx-1..cx+3)  ← 新增 cols 18-19
```

Total cells: 1+3+5+6+7+5 = **27**(原 V1 是 25)

經 outline + seam pass 後,V2 vs V1 的視覺差異:
- y=6 cols 18-19 從 outline → metal interior(因為 y=7 shoulder 延伸,down 不再 null)
- y=7 cols 18-19 從 null → outline(新增 hook tail 的 outline)
- 整體 head body 在右側更飽滿,hook 縱向延伸到底

### 7.5 Spec §4.2 沒同步更新

跟 sword §4 curved 描述過時不更新 spec 同 idiom — spec 仍代表 brainstorm 當下意圖。Code 為準,本筆記 §8.4 為 production 幾何 reference。

### 7.6 16 版沒做 V2

User 只要求 32 比較。Hooked 16 的 1px hook(spec §11 risk #6 已記錄 fallback)未做 V2 比較,維持現況。若日後 16 視覺迴歸覺得不夠,參考 §11 risk #6 的 fallback 設計。

---

## 8. 下一輪迭代候選

從這次過程觀察到值得做的事:

1. **`drawDagger` / `drawAxe` / `drawHalberd`** — 套同一個 spec→render pattern,palette.js / pixel-utils.js / `WOOD_PALETTE` / `LEATHER_PALETTE` / `METAL_FAMILIES` 直接共用。新 item type 的 file-internal const 一律加前綴,function 撞名一律加中綴(本筆記 §1.3 規則)。
2. **`sampleMetalPalette` refactor** — 當第三個 metal-using item 出現時,把 `sampleSwordPalette` / `sampleSpearPalette` 兩個 wrapper 統一回一個 `sampleMetalPalette`,各自呼叫 generic 並做欄位 rename。減少 palette.js 樣板代碼。
3. **抽 generic shine helper** — 如果 spear / dagger / axe 都需要 always-on shine,把 `paintBladeShine32/16` + `paintHeadShine32/16` 抽成 `paintShineLine(ctx, mask, size, color, getXAtY, yRange, gateEnum)` 的 function。本輪因為只有兩個 weapon type(sword + spear)還不值得。
4. **重構 file-internal const 用 IIFE** — sword.js / potion.js / spear.js 的 `*_SHAPE_FNS_*`、`buildXxxMask*` 等若包進 IIFE,完全消除全 script 共用 lex env 的撞名風險。對未來新 item type 是好事;對現況是 nice-to-have。
5. **稀有度 tier** — 同 sword / potion 的 hook,加 `applyOuterGlowPass` 等。架構不需重寫。
6. **重新評估 16 復活 `hasShaftBinding`** — 視覺迴歸後若覺得 16 太單調,可挑簡化版本(例如 binding 16 強制只有 1 條、寬 1 px 在 cx 處)。
