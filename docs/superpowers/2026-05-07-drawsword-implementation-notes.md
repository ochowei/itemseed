# drawSword 實作筆記 — 2026-05-07

> 補充記錄 `specs/2026-05-07-drawsword-design.md` 與 `plans/2026-05-07-drawsword.md` 在實作後的偏移。原 spec/plan 仍代表 brainstorm/planning 當下的意圖,**code 是現況的唯一真相**。日後若要再改設計或實作 drawSpear / drawDagger,先讀這份再讀 spec。

---

## 1. Const / 函式命名修正 — 避免跟 potion.js 撞名(critical fix)

### 1.1 問題

Plan 原本指定的 const / 函式名直接沿用 potion.js 的 pattern:`SHAPE_FNS_32` / `SHAPE_FNS_16` / `buildSilhouetteMask32` / `buildSilhouetteMask16`。

但 vanilla JS 的 `<script>` tags 共用同一個 Script lexical environment,**top-level `const` 跨 script 重複宣告會產生 `SyntaxError: Identifier 'SHAPE_FNS_32' has already been declared`**,導致 sword.js 整個 parse 失敗、什麼都載不進來(只有 console 看得到錯誤,UI 表面上仍跑 main.js 的 `drawSword` stub,容易誤判「沒做」)。

`function` declaration 雖然不會 throw,但會 silently 互相覆蓋(後載入的 win),也會把 potion.js 的 `buildSilhouetteMask32` 換成 sword 的版本,呼叫 potion 的 render 時會炸。

Implementer 在 Task 3 的 Node 驗證用獨立 `eval()` 沒抓到這個問題;Task 4 的 code reviewer 提醒 "name shadows potion.js" 後,用「concatenated eval 模擬 browser script load 順序」才確認真的 fail。

### 1.2 解法 — 改名 + 同 file pass 一致更新

**Sword.js 內所有跟 potion 撞名的識別字加 `SWORD_` 前綴或改用 `Sword` 中綴:**

| 原 plan 寫的 | 實際 code | 影響檔 |
|---|---|---|
| `const SHAPE_FNS_32` | `const SWORD_SHAPE_FNS_32` | sword.js |
| `const SHAPE_FNS_16` | `const SWORD_SHAPE_FNS_16` | sword.js |
| `function buildSilhouetteMask32` | `function buildSwordMask32` | sword.js |
| `function buildSilhouetteMask16` | `function buildSwordMask16` | sword.js |

未撞名的識別字 **不加前綴**(維持簡潔,符合 potion.js 各自獨立命名的風格):
- `sampleSwordSpec`, `renderSwordSpec32/16`, `drawSword` — 已含 Sword 中綴
- `shapeStraight32` / `shapeBroad32` / `shapeCurved32` / 16 版同 — sword 自身的形狀名 potion 沒有,不撞
- `paintBladeShine32/16`, `paintFuller32`, `paintGripWrap32`, `paintGem32`, `tryPaintBladeCell32/16` — sword 自有,不撞

### 1.3 Plan / spec 應更新

兩份文件的範例 code 仍用未加前綴的舊名(plan Task 3 / 4 / 7 / 8 內的 code block)。**未來若有人讀 plan 直接 copy-paste,會撞名失敗。** 可選:

A. 開新 PR / commit 把 plan 內的範例 code 字串 sed-replace 成正確識別字(乾淨,但會改動已 commit 的歷史文件)。
B. 不改 plan / spec,只在這份 implementation-notes 做為前置必讀。本輪採方案 B(降低噪音)。

### 1.4 連帶設計慣例(下一輪 drawDagger / drawSpear / drawShield 等請套用)

**新 item type 的 file-internal const / 函式若名稱可能跟其他 item type 撞名,一律加 item-type 前綴或中綴。** 例:
- `SPEAR_SHAPE_FNS_32` / `buildSpearMask32`
- `DAGGER_SHAPE_FNS_32` / `buildDaggerMask32`

或者:把這些 file-internal const 改成 IIFE local scope 包起來,不漏到 global。本輪沒做這個重構(成本超出 task 範圍)。

---

## 2. Curved blade silhouette — formula 勝 prose,產生「scimitar belly」

### 2.1 spec §4.2 的內部矛盾

Spec 對 `curved` archetype 同時給了 prose example 與 formula:

```
y= 4     3 px (cx+0..cx+2)                        ← prose(說明)
...
y= 5..18 3 px,xCenter 線性遞減從 cx+2 到 cx
         具體公式:offset(y) = round(2 * (18 - y) / (18 - 4))
                  範圍 y=4..18,offset 從 2 漸減到 0
         實際 row range:cx + offset(y) - 1 .. cx + offset(y) + 1
```

兩者在 y=4 給不同結果:
- **Prose:** `(cx+0..cx+2)` = leftX 16, rightX 18
- **Formula:** offset = round(2*14/14) = 2 → `(cx+1..cx+3)` = leftX 17, rightX 19

### 2.2 實作選 formula,理由

如果套 prose(y=4 特例化),y=4 與 y=5 的 right edge 從 18 跳到 19,blade 會在 y=5 產生一個「shoulder 凸出後又凹回」的視覺缺陷。

如果套 formula(整個 y=4..18 都跑同公式),blade 上半段 y=4..7 的 right edge 在 19 = `cx+3`,**比 tip(y=2 在 cx+2)更右 1 px**。乍看像 bug(「blade 凸出 tip 之外」),但實際對應 scimitar / saber 的「belly」現實外觀:刀身腹部比 tip 寬,曲線優雅。

兩種詮釋都試過,formula 勝:

```
formula 詮釋(實際採用):
  y= 2:           ........X......     tip
  y= 3:           .......XX......
  y= 4..7:        .......XXX.....     belly,rightX=19 略凸出 tip
  y= 8..14:       ......XXX......     轉折,rightX 收回 18
  y=15..18:       .....XXX.......     近 hilt,rightX=17 對齊 guard
```

讀起來是清楚的「右上偏的 saber」。

### 2.3 Spec 應澄清

如果未來重看 spec §4.2 的 prose `y= 4 (cx+0..cx+2)`,**那一行是錯的**。formula 才是設計意圖。

---

## 3. 細微的設計慣例 / 沒寫進 spec 但實作中決定的

### 3.1 Curved 的 hasFuller — sample 階段強制 false,paint 階段也 double-gate

`sampleSwordSpec` 已用 `(archetype !== 'curved') && rng.chance(0.4)` 過濾;但 `paintFuller32` 仍有獨立的 `if (spec.archetype === 'curved') return;` 防呆。

防呆是預期之內(spec §4.7 的「curved 強制 false」描述未指定在哪一階段),雙閘門讓未來如果 manually 改 spec 或從外部丟進 fake spec,fuller 仍不會在 curved 上畫出 zig-zag 線。

### 3.2 Pommel 高度從 2 列改 3 列、grip 從 7 列改 6 列

Spec self-review 階段(brainstorm 結束後)發現 pommel 2 列高在 4-鄰居 outline + seam pass 下所有 cell 都會被改成 outline 色,bladeMain 看不見。改 3 列後中間列(y=28)有 interior cell 存活。為了騰空間給 pommel,grip 從 y=21..27(7 列)改成 y=21..26(6 列)。

這個改動 spec §4.1 / §4.4 / §4.5 / §4.9 都已對齊。Plan Task 4 的 mask builder 直接用了正確的數值。

### 3.3 Gem 座標 (cx=16, y=28)

Pommel 中央列固定 y=28 是「3 列 pommel y=27..29 的中間列」。如果未來把 pommel 拉成 4 列(例如挑高 disk 變得更壯),gem 座標需要重新檢視。

### 3.4 Wrap 的有效 y pair

`WRAP_PAIRS = [[22, 24], [22, 25], [23, 25]]` 是「grip y=22..25 範圍內、間距 ≥ 2」的全部組合。如果 grip 改回 7 列(y=22..26 範圍可用),pair 會增加。

### 3.5 16×16 paint 函式跟 32 版有刻意的 duplication

`tryPaintBladeCell32` / `tryPaintBladeCell16` body 完全一樣(只差名字),`paintBladeShine32` / `paintBladeShine16` 差在 y range 與 `cx` 常數。

未做 DRY 抽象的原因:
- potion.js 也是維持 32 / 16 各自命名(`paintHighlight32` 沒有對應的 `paintHighlight16` shared helper)
- y range 跟 cx 在 32/16 上完全不同 hardcode,共用 helper 反而需要 4 個參數,可讀性下降

留給未來如果 sword + spear + dagger 都需要 always-on shine 時,再抽成 generic helper。

### 3.6 `drawSwordImpl` 對 unknown size 是 silent no-op

`drawSword(ctx, rng, size)` 只支援 32 / 16。其他 size(8、64 等)會什麼都不畫、不 throw。同 potion 的契約。

---

## 4. Palette 演化

### 4.1 spec.palette 欄位

| 階段 | 欄位 |
|---|---|
| Spec §2 原版 | `outline / bladeMain / bladeShadow / bladeShine`(4) |
| 實作後 | 4 個欄位都還在,完全沒改 |

每張 sword icon **可見**色:
- 必畫:outline + bladeMain + bladeShine + LEATHER_PALETTE.main = 4 色
- 加 LEATHER_PALETTE.shadow(if `hasGripWrap`)= 5 色
- 加 bladeShadow(if `hasFuller`)= 5~6 色

符合 limited palette 約束(spec §5.4 規劃的 5~6 色上限)。

### 4.2 Outline 公式跟 potion 一致

`hslToRgbHex(h, 50, 12)` — sat 寫死 50,L 寫死 12。低彩 metal family(steel/iron `s ∈ [5..20]`)經此公式仍會帶極輕微 hue 暗示,outline 接近黑但不死板,跟 potion 並排視覺 cohesive(跟 spec §5.5 描述一致)。

### 4.3 LEATHER_PALETTE 三色 = main/shadow/highlight,但本輪只用 main/shadow

`highlight: '#8a6840'` 進 spec 但本輪沒用到,留給未來 grip 高光等迭代(spec §5.3 已預告)。

---

## 5. 檔案組織 — 跟 plan 一致

| 檔案 | plan 規劃 | 實際 |
|---|---|---|
| `palette.js` | 加 METAL_FAMILIES、sampleSwordPalette、LEATHER_PALETTE | ✓ |
| `pixel-utils.js` | 不動 | ✓ |
| `potion.js` | 不動 | ✓ |
| `sword.js` | 新增,結構同 potion.js | ✓(~500 行,主要重量在 shape 函式 + paint helpers + mask builder) |
| `main.js` | 移除 drawSword stub,drawSpear stub 保留 | ✓ |
| `index.html` | 加 sword.js script tag | ✓ |
| `regression.html` | 加 sword section,合併下載 | ✓(改成 grid-potion / grid-sword 兩 table,h2 分段;合併 dl-png 與 dl-json 兩個 button 的 collected list) |

---

## 6. 沒做的事(spec / plan 列為非目標,本輪明確 defer)

- 稀有度 tier(spec §11)— 未動
- 附魔劍 / magical tinted blades(spec §11)— 未動
- Dagger / two-hander 變體 — 未動,留給新 item type
- `drawSpear` 程序化規則 — main.js stub 維持不動(下一輪)
- 16 版 fuller / gripWrap 復活評估(spec §11 後續鉤子)— 視覺驗證後再考慮

---

## 7. 下一輪迭代候選

從這次過程觀察到值得做的事:
1. **`drawSpear` / `drawDagger`** — 套同一個 spec→render pattern,palette.js / pixel-utils.js / `LEATHER_PALETTE` / `METAL_FAMILIES` 直接共用。新 item type 的 file-internal const 一律加前綴(例 `SPEAR_SHAPE_FNS_*`)避免撞名。
2. **抽 generic shine helper** — 如果 spear / dagger 也需要 always-on shine,把 `paintBladeShine32/16` 抽成 `paintShineLine(ctx, mask, size, color, getXAtY, yRange)` 的 function。本輪因為只有一個 weapon type 不值得。
3. **重構 file-internal const 用 IIFE** — sword.js / potion.js 的 `SHAPE_FNS_*`、`buildXxxMask*` 等若包進 IIFE,完全消除全 script 共用 lex env 的撞名風險。對未來新 item type 是好事;對現況是 nice-to-have。
4. **稀有度 tier** — 同 potion 的 hook,加 `applyOuterGlowPass` 等。架構不需重寫。
