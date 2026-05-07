# drawPotion 實作筆記 — 2026-05-07

> 補充記錄 `specs/2026-05-07-drawpotion-design.md` 與 `plans/2026-05-07-drawpotion.md` 在實作後的偏移。原 spec/plan 仍代表 brainstorm/planning 當下的意圖,**code 是現況的唯一真相**。日後若要再改設計,先讀這份再讀 spec。

---

## 1. 視覺驗證後停用的 feature(註解保留,反註解一行可復活)

### 1.1 Label(標籤帶)
- **Spec §4.5** 描述 30% 機率產生 1~2px 高色帶 + 高光點綴
- **實作後決定停用**:在 32×32 上「2px 黑帶 + 點綴」看起來像污漬不像標籤
- **Code 狀態**:
  - `samplePotionSpec` 仍計算 `hasLabel` 與 `labelDots`(spec 形狀不變,維持向後相容)
  - `paintLabel32` 函式定義保留(dormant)
  - `renderPotionSpec32` 內 `if (spec.hasLabel) { paintLabel32(...) }` 整段註解掉
- **復活方式**:把 `renderPotionSpec32` 內三行註解反註解

### 1.2 Glass shine(玻璃高光)
- **Spec §4.4** 描述固定光帶(flask 沿斜邊 4~5px、round 弧線 3~4px、vial 直線 5~6px)
- **實作中追加**:在 `palette.js` 加了 `glassShine` 色(`HSL(h, s-40, 92)`,近白略帶族色)以區別於 bubble 用的 `highlight` 色
- **實作後決定停用**:即使換成更白的 glassShine,跟 bubble 仍有視覺混淆;且整體美感更傾向「乾淨色塊」
- **Code 狀態**:
  - `palette.js` 仍 export `glassShine`(palette 多 1 色)
  - `paintHighlight32` 函式定義保留(dormant)
  - `renderPotionSpec32` 與 `renderPotionSpec16` 內 highlight 呼叫整段註解
- **復活方式**:`renderPotionSpec32` 反註解 1 行,`renderPotionSpec16` 反註解 inline 那段

### 1.3 Surface seam(液面分隔線)
- **Spec §3 Render Pipeline Step 8** 描述 `paintInternalSeams` 在 glass/liquid 邊界畫 outline 色,做出「液面張力」效果
- **實作後決定停用**:用色差(glassBody 對 liquidMain)區分液面比黑線更乾淨
- **Code 狀態**:
  - `pixel-utils.js` 的 `paintInternalSeams` 不變(generic 工具)
  - `potion.js` 多了 `paintPotionSeams` 函式,**演算法層級永遠 skip glass↔liquid 這一對**
  - `renderPotionSpec32` 與 `renderPotionSpec16` 改呼叫 `paintPotionSeams`
  - 其他內部邊界(尤其 cap/glass)仍會畫 seam
- **復活方式**:把 `paintPotionSeams` 裡 skip glass/liquid 那段拿掉,或改回呼叫 `paintInternalSeams`

---

## 2. Shape 幾何 — 與 spec/plan 不一致的最終狀態

### 2.1 32×32(Task 4 fix 後)
| Shape | spec/plan 寫 | 實際 code |
|---|---|---|
| flask 32 body | `rightX = cx + halfW - 1`(偶寬,不對稱) | `rightX = cx + halfW`(奇寬,對稱) |
| round 32 body | `rightX = cx + dx - 1`,neck y=4..12,circle y=13..29 | `rightX = cx + dx`,**neck y=4..13**(延長 1 列),**circle y=14..28**(略過 pole rows) |
| round 32 union 邏輯 | spec 內 neck/circle 重疊處取聯集 | 已移除(neck 與 circle 不重疊) |

**Why fix:** 原公式 body 中心在 `cx+0.5`,neck 中心在 `cx`,半像素偏移。Round 額外有 pole rows `dx=0` 造成 silhouette 內出現 null gaps。

### 2.2 16×16(Task 10 fix + flask 16 重塑後)
| Shape | spec/plan 寫 | 實際 code |
|---|---|---|
| flask 16 | 漸寬式 body(width 5→9 跨 11 列) | **「窄頸 + 1 列肩 + 寬均勻身 7」**:neck y=2..3 width 3、shoulder y=4 width 5、body y=5..14 width 7 |
| flask 16 width formula | `Math.round(1.5 + t*2.5)` 跨 y=4..14 | 上方公式已移除 |
| round 16 | neck y=2..6, ⌀8 圓 | neck y=2..**7**, circle 仍 y=8..14(對稱 fix 後 `cx + dx`) |
| vial 16 neck | `cx-1..cx`(width 2,不對稱) | `cx-1..cx+1`(**width 3**,對稱) |
| vial 16 body | `cx-2..cx+1`(width 4) | `cx-2..cx+**2**`(**width 5**,對稱) |

**Why flask 16 重塑:** 漸寬 body 在低液面時,液面落在窄處而下方更寬,液體會「縮在上面、攤在下面」看起來怪。改成均勻寬度後液面在任何高度都是平整橫線。

**Why 16 全系列對稱 fix:** 同 32 版的對稱性問題。實作後 user 觀察到「16 round 瓶頸偏右」、「flask cork 上半偏右」,追加修正。

### 2.3 16×16 cap 寬度
- Plan 規劃 cap 高度 1px、`extraW=1`(cap 寬 = neck 寬 + 2)
- vial 16 因 neck 從 width 2 改成 width 3,連帶 cap 從 width 4 變 **width 5**

---

## 3. 演算法微調(spec/plan 沒寫,實作中加上的)

### 3.1 paintBubbles32 安全邊距
- **Plan 寫**:bubble x/y 從 spec 的 `[u, v]` map 到液體 bbox,gate `mask[...] === 'liquid'` 後畫
- **實作加**:`if (y - minY < 2) continue;` — 任何會落在液面下 2 列以內的 bubble 跳過
- **Why:** 低液面 + 低 v 值會把 bubble 算到液面正上 / 正下方,跟 surface seam 視覺上太近(後來 surface seam 拔了,但 margin 留著當作物理感:bubble 不會直接貼在液面)

### 3.2 sediment 厚度公式
- **Spec/Plan 沒明確寫**:plan code 用 `2 + ((spec.bubbles.length + spec.shape.length) % 2)`
- **已知瑕疵**:用 `string.length` 當 hash 來源很 fragile;flask(5)、round(5) 兩個 shape 結果一樣(只有 vial(4) 不同)
- **沒修**:Task 6 code review 時 flag 為 minor,功能正確,以後重構時再清

### 3.3 wax_seal 蠟滴長度
- 同樣用 `1 + ((shape.length + family.length) % 2)`
- 同樣的 string.length 問題
- 同樣未修

---

## 4. Palette 演化

### 4.1 spec.palette 欄位
| 階段 | 欄位 |
|---|---|
| Spec §2 原版 | `outline / glassBody / liquidMain / liquidShadow / highlight`(5) |
| 實作中追加 glassShine | `outline / glassBody / glassShine / liquidMain / liquidShadow / highlight`(6) |
| 視覺驗證後 | 6 個欄位都還在;`glassShine` 與 `highlight` 在不同 dormant feature 各自被引用 |

實際每張 icon **可見**色:
- 4 色:outline + glassBody + liquidMain + cap-color(cork main / 或 liquidMain / 或 highlight)
- 加 1 色 if hasSediment:liquidShadow
- 加 1 色 if hasBubbles:highlight(bubble 用)
- = 最多 5~6 色,符合 limited palette 約束

---

## 5. 檔案組織 — 跟 plan 一致

| 檔案 | plan 規劃 | 實際 |
|---|---|---|
| `palette.js` | ✓ | ✓ |
| `pixel-utils.js` | ✓ | ✓ |
| `potion.js` | ✓ | ✓(610 行,主要重量在 shape 函式 + paint helpers) |
| `regression.html` | ✓ | ✓(後改成淺色主題) |
| `index.html` script 順序 | ✓ | ✓ |
| `main.js` 移除 stub | ✓ | ✓ |

`drawSword` / `drawSpear` 維持原本 main.js 的占位 stub,未動。

---

## 6. 下一輪迭代候選

從這次過程觀察到值得做的事:
1. **`drawSword` / `drawSpear`** — 套同一個 spec→render pattern,palette.js / pixel-utils.js / paintPotionSeams 直接共用(後者可考慮提取成 generic seam-with-skip helper)
2. **Sediment / wax-drip 厚度公式重構** — 把 `string.length` hash 改成 sample 階段算好寫進 spec(`spec.sedimentThickness`、`spec.dripLen`)
3. **稀有度 tier** — spec 加 `tier` 欄位,render 後加 outer-glow pass,不需要動現有 pipeline
4. **重新評估 label / shine** — 過幾天再看一次 dormant 的這兩個,可能會發現它們在某些 family 上其實還行
