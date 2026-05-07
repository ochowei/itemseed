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

## 2. Curved blade silhouette — formula 推翻並重設計(原 spec §4.2 兩者皆 not used)

### 2.1 spec §4.2 的原始內部矛盾

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

### 2.2 第一輪實作:採 formula(scimitar belly)

第一輪選 formula 詮釋,理由:formula 給連續、無特例的設計;prose 在 y=4 特例化會在 y=5 產生「shoulder 凸出後又凹回」缺陷。

但 formula 在 y=4..7(offset=2)讓 blade rightX = `cx+3` = 19,**比 tip(`cx+2` = 18)更右 1 px**。預期是 scimitar / saber 的「belly」(刀身腹部比 tip 寬),但視覺驗證後 user 回報「32 curved 都歪歪的」— belly 凸出 tip 看起來不像滑順曲線,像「刀身翹出 tip 之外」。

### 2.3 第二輪實作(現況):max offset 從 2 降到 1,1 個 stairstep

```
新版 shapeCurved32(production):
  y= 2:               cx+2..cx+2     tip
  y= 3:               cx+1..cx+2     taper
  y= 4..11:           cx..cx+2       width 3 offset 1(8 rows)
  y=12..18:           cx-1..cx+1     width 3 offset 0(7 rows)
```

只剩 1 個 stairstep(y=11→12),tip 永遠是 blade 最右點(rightX 從不超過 cx+2)。整體刀身平滑左下傾斜回 guard 中軸,讀起來是穩定 saber。

### 2.4 16 curved 的同步修正

舊版 `shapeCurved16` 只 tip(y=1)與 taper(y=2)偏移,y=3..9 全對齊中軸 → spec §10 risk #6 已預測「16 curved 看不出彎度」,user 確認看不出。

新版加入 spec §10 risk #6 的 fallback 設計:

```
新版 shapeCurved16(production):
  y= 1:               cx+1..cx+1     tip 偏右 1
  y= 2:               cx..cx+1       taper width 2
  y= 3..5:            cx..cx+2       width 3 offset 1(上半 3 rows)
  y= 6..9:            cx-1..cx+1     width 3 offset 0(下半 4 rows)
```

從 5 列偏移(tip + taper + 上半身 3 列),16 上看得出彎度。

### 2.5 第三輪實作(現況):整把劍沿 ~30° 斜軸排(FULL-DIAG)

§2.3 / §2.4 的「修 stairstep」與「加 mid-blade offset」做完後,user 視覺驗證仍不滿意 — 直立 + 略斜 blade 在 32 / 16 上都讀不出 saber 的動感。

第三輪改採「整把劍沿斜軸排」:不只 blade 斜,**guard、grip、pommel 全部沿同一條 1:2 斜軸**(每 2 列往左 1 col)。tip 在 cx+6=22(32)/ cx+3=11(16),pommel 在左下角(col 9 / col 5)。

```
新版 production curved 32(整把斜):
  tip               (22, 2)
  blade body        width 3,沿 archAxis32('curved', y) 排,y=2..18
  guard             y=19..20,horizontal bar 中央在 axis(19.5) ≈ col 13
  grip              y=21..26,width 3 沿 axis 走(每 2 列左移 1)
  pommel            y=27..29,沿 axis 走

新版 production curved 16(整把斜):
  tip               (11, 1)
  blade body        width 3,沿 archAxis16('curved', y) 排,y=1..9
  guard             y=10,horizontal bar 中央 col 7
  grip              y=11..13,width 3 沿 axis 走
  pommel            y=14,沿 axis 走
```

### 2.6 統一 axis 抽象:`archAxis32(archetype, y)` / `archAxis16(...)`

實作上加了一對 helper,讓 vertical 與 diagonal 走同一份 mask builder + paint helper code:

```js
function archAxis32(archetype, y) {
  if (archetype !== 'curved') return 16;       // straight / broad: vertical 中軸
  // curved: 1:2 slope,tip cx+6 → pommel cx-7 over y=2..29
  ...
}
```

`buildSwordMask32` 的 guard / grip / pommel 全改用 `archAxis32(spec.archetype, y)` 取中央 x。Vertical archetype 永遠回 cx,行為跟之前完全一樣;curved 沿斜軸。`paintGripWrap32` / `paintGem32` 同理 — 用 axis 取座標,wrap 跟 gem 在 diagonal grip / pommel 上自動對齊。

### 2.7 Spec 應澄清

Spec §4 的 curved 描述全部過時。Production 用的是 §2.5 的整把斜版本。日後 spec 重整時,把 §4.2 的 curved 區段改寫成現況,並補一節說明 archetype 可能改變整把劍 layout(curved → diagonal)。

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
