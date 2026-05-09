# CLAUDE.md

> Vanilla JS pixel-art icon generator(canvas)。32×32 + 16×16,seeded deterministic。
> 已 ship: potion / sword / spear。零 build step、無 framework。

公開 README 在 `README.md`,這份是 Claude session 內部備忘。

---

## Pixel art 鐵則

- **整數座標、整數寬高**:不用 0.5 偏移、不用 antialiasing。所有 ctx 一定 `imageSmoothingEnabled = false`。
- **Limited palette**:每個 asset family ≤ 4 色 (outline + main + shadow + shine)。新增色之前先看 `palette.js` 既有 family 能不能用。
- **Outline 連續**:輪廓不能有 1-cell 缺口。新形狀 ship 前用 4-鄰居/8-鄰居 mask 連通性驗。
- **32 為主、16 為副**:design 先想 32,再想 16 怎麼壓縮。
- **Resolution-dependent design**:32 上 layout 不能直接抄 64+ reference,16 上 layout 不能直接抄 32。每個 size 重新設計。

## File 責任

| File              | 責任                                              |
|-------------------|---------------------------------------------------|
| `main.js`         | UI 綁定 + `ITEM_TYPES` registry                   |
| `random.js`       | `SeededRandom` (string seed,`pick`/`int`/`bool`/`float`) |
| `palette.js`      | `FAMILIES` / `METAL_FAMILIES` / `WOOD_PALETTE` 等 + sample 函式 |
| `pixel-utils.js`  | 整數對齊的 rect / line / outline / mask helpers   |
| `<asset>.js`      | `sample<Asset>Spec(rng) → spec`、`render<Asset>Spec32`、`render<Asset>Spec16`、`draw<Asset>(ctx, rng, size)` |
| `index.html`      | 單 icon studio + 24 cell batch grid               |
| `regression.html` | 16+ seed × 每 type,32 / 16 並排,baseline 用     |

## sample / render 拆分原則

- `sample<Asset>Spec(rng)` 只回 plain object,**不碰 ctx**。所有 random 在這一步用完。
- `render<Asset>Spec32/16(ctx, spec)` 純函數,**不碰 rng**。給同樣 spec 一定畫一樣的圖。
- `draw<Asset>(ctx, rng, size)` 只是 convenience: `render(ctx, sample(rng))`。

這個分離是關鍵 — 它讓 regression.html 能 cache spec、debug 時能手動構造 spec、未來能把 spec 存進外部檔。**新 asset 要遵守同樣 pattern**。

## 新增 asset type 流程

1. `<asset>.js` 實作 sample + render32 + render16 + draw,window export 全部
2. `main.js` 加進 `ITEM_TYPES`
3. `index.html` + `regression.html` 都加 `<script src>`
4. `regression.html` 加 `<asset>_SEEDS` array + render block 餵到 `#grid-<asset>`
5. 寫 spec(in commit message 或 `docs/`),列 §11 risk 清單(視覺需確認的點)
6. `npm run snapshot -- --promote` 建初始 baseline

## Snapshot 工作流

```bash
npm run snapshot              # 寫 snapshots/current/ (gitignored)
npm run snapshot -- --promote # 寫 snapshots/baseline/ (tracked)
```

**何時 --promote**:確認 current/ 沒視覺 regression,才升 baseline。
**Per-cell zoom**:在 `scripts/snapshot-regression.mjs` 的 `ZOOMS` 加 entry,8× upscale,適合對 risk 做 pixel 級驗收。

我可以用 `Read` tool 直接「看」`snapshots/baseline/*.png` 跟 `snapshots/current/*.png`(支援圖片),看完可寫 risk 報告。但我看到的 inline 圖比實際小,**像素級判斷靠 zoom PNG 才準**,不要拿縮圖斷案。

## Risk 驗證流程

shipped asset 應該有 §11 risk 清單。每次改 renderer:

1. `npm run snapshot` → 看 `snapshots/current/<type>-grid.png` + 相關 zoom
2. 對 risk 清單逐項 cross-check
3. 全 PASS → `npm run snapshot -- --promote` → commit baseline 變動
4. 任一 FAIL → 修 renderer / palette,回 1

> ⚠️ baseline 若 sample 機率覆蓋不到目標 family/archetype(例 obsidian ~12%),用 `node scripts/find-seed.mjs <family> <archetype> <prefix> <count>` 暴力找 seed,hardcode 進 `<asset>_SEEDS`。

## 重要禁忌

- ❌ 不要 commit `snapshots/current/`(已 gitignore)
- ❌ 不要 commit `node_modules/`(已 gitignore)
- ❌ 不要 import 任何 frontend framework — 維持 0 build step、純 `<script src>`
- ❌ 不要在 `sample<Asset>Spec` 之外的地方碰 rng — 破壞 deterministic
- ❌ 不要在 `render<Asset>Spec*` 裡開 `imageSmoothingEnabled = true` — 破壞 pixel-art

## 我看不到瀏覽器(important)

這個 session 沒有 browser MCP 工具。我能:
- 跑 node script、puppeteer 截圖
- 用 Read 讀 PNG(我「看」得到 image,但縮圖)
- grep / read 任何 .js / .html

我不能:
- 真的開瀏覽器互動 `index.html`
- 看到 console.log 在 browser 跑(除非透過 puppeteer event 截下來)
- 鼠標互動 / 拖曳 / 連點

→ 任何「動手玩玩看」的需求,要請 user 自己開 `index.html`。
