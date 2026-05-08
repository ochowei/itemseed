// spear.js
// 兩階段架構:sampleSpearSpec(rng) → spec → renderSpearSpec32/16(ctx, spec)。
// 此檔最後 export 對外 drawSpear(ctx, rng, size) 給 main.js 用。
// 沿用 sword 同模式,palette 由 sampleSpearPalette 提供。

// =====================================================================
// Sampler — 把所有 RNG 集中於此,輸出純資料 spec
// =====================================================================

// 注意:以下 const 必加 SPEAR_ 前綴,因 sword.js 已用未加前綴的 ARCHETYPES /
// ARCHETYPE_WEIGHTS 等同名 const,若不前綴會撞 → SyntaxError。
const SPEAR_ARCHETYPES = ['straight', 'trident', 'hooked'];
const SPEAR_ARCHETYPE_WEIGHTS = [3, 2, 1.5];
const SPEAR_BUTT_STYLES = ['disc', 'sphere', 'spike'];

// hasShaftBinding 為 true 時的 y pool。1 條走 SINGLES,2 條走 PAIRS。
// 兩 pool 都在 spec §4.6 hardcode,涵蓋 shaft 上 / 中 / 下不同位置與不同間距。
// shaft y=8..25,binding 避開 y=8..9 與 y=24..25 兩端 seam 區,故 y range [10..23]。
const SPEAR_BINDING_SINGLES = [10, 12, 14, 17, 20, 22];
const SPEAR_BINDING_PAIRS = [[10, 14], [11, 16], [13, 18], [15, 20], [18, 23], [11, 21]];

function sampleSpearSpec(rng) {
  const { family, palette } = sampleSpearPalette(rng);
  const archetype = rng.pickWeighted(SPEAR_ARCHETYPES, SPEAR_ARCHETYPE_WEIGHTS);
  const buttStyle = rng.pick(SPEAR_BUTT_STYLES);
  const hasShaftBinding = rng.chance(0.5);

  // sample 階段就決定 binding 帶位置,確保 render 是純函式
  const shaftBindingYs = [];
  if (hasShaftBinding) {
    if (rng.chance(0.5)) {
      // 1 條 binding
      shaftBindingYs.push(rng.pick(SPEAR_BINDING_SINGLES));
    } else {
      // 2 條 binding,從合法 pair 六選一
      const pair = rng.pick(SPEAR_BINDING_PAIRS);
      shaftBindingYs.push(pair[0], pair[1]);
    }
  }

  return {
    family,
    palette,
    archetype,
    buttStyle,
    hasShaftBinding,
    shaftBindingYs,
  };
}

// =====================================================================
// Shape silhouette functions (32×32)
//
// 每個 archetype 是一個 () → { cells: Array<{ x, y }> }
// 描繪 head 外輪廓(僅 head,不含 shaft/butt)。整數座標。
//
// 用 cells-based 而非 row-spans:trident y=2..3 有 3 個不連續 1px prong,
// row-spans 表示不出來;cells 統一處理 sparse / dense 兩種 row。
//
// 整體垂直配置(per spec §4.1):
//   y=0..1   padding
//   y=2..7   head  (6 rows)
//   y=8..25  shaft (18 rows)
//   y=26..28 butt  (3 rows)
//   y=29..31 padding
//
// 中軸 cx=16,所有 archetype 都 vertical aligned。
// =====================================================================

// helper: 在 cells 加進「row y 的 cols [x0..x1]」這段
function spearAddRange(cells, y, x0, x1) {
  for (let x = x0; x <= x1; x++) cells.push({ x, y });
}

function shapeSpearStraight32() {
  // 對稱長葉狀:tip 1 + taper 3 + body 5 三列 + shoulder 3
  const cells = [];
  const cx = 16;
  cells.push({ x: cx, y: 2 });             // tip
  spearAddRange(cells, 3, cx - 1, cx + 1); // taper w3
  spearAddRange(cells, 4, cx - 2, cx + 2); // body w5
  spearAddRange(cells, 5, cx - 2, cx + 2);
  spearAddRange(cells, 6, cx - 2, cx + 2);
  spearAddRange(cells, 7, cx - 1, cx + 1); // shoulder w3
  return { cells };
}

function shapeSpearTrident32() {
  // 三叉:3 prongs at cols cx-3, cx, cx+3 (cols 13, 16, 19),間距 3
  // y=2..3 prongs(各 1 px)→ y=4 bridge w7 → y=5..6 body w5 → y=7 shoulder
  const cells = [];
  const cx = 16;
  for (let y = 2; y <= 3; y++) {
    cells.push({ x: cx - 3, y });
    cells.push({ x: cx,     y });
    cells.push({ x: cx + 3, y });
  }
  spearAddRange(cells, 4, cx - 3, cx + 3); // bridge w7
  spearAddRange(cells, 5, cx - 2, cx + 2); // body w5
  spearAddRange(cells, 6, cx - 2, cx + 2);
  spearAddRange(cells, 7, cx - 1, cx + 1); // shoulder w3
  return { cells };
}

function shapeSpearHooked32() {
  // 鉤矛:右側不對稱,hook 從 y=5 起到 y=6 達峰 col 20
  const cells = [];
  const cx = 16;
  cells.push({ x: cx, y: 2 });             // tip
  spearAddRange(cells, 3, cx - 1, cx + 1); // taper w3
  spearAddRange(cells, 4, cx - 2, cx + 2); // body w5
  spearAddRange(cells, 5, cx - 2, cx + 3); // body + hook 開始 w6
  spearAddRange(cells, 6, cx - 2, cx + 4); // 鉤峰 w7
  spearAddRange(cells, 7, cx - 1, cx + 1); // shoulder w3
  return { cells };
}

const SPEAR_SHAPE_FNS_32 = {
  straight: shapeSpearStraight32,
  trident:  shapeSpearTrident32,
  hooked:   shapeSpearHooked32,
};

// =====================================================================
// Mask builder (32×32) — 把 spec 轉成 enum mask
//
// mask cell ∈ { 'head' | 'shaft' | 'butt' | null }
// 三個 archetype 都 vertical(cx=16 中軸對齊),不需 axisFn 抽象。
// =====================================================================

function buildSpearMask32(spec) {
  const size = 32;
  const mask = allocateMask(size);

  // ── Head ── 從 archetype 對應的 shape 函式取 cells
  const { cells } = SPEAR_SHAPE_FNS_32[spec.archetype]();
  for (const { x, y } of cells) {
    maskSet(mask, size, x, y, 'head');
  }

  // ── Shaft (y=8..25, width 3, cols 15..17) ──
  for (let y = 8; y <= 25; y++) {
    for (let x = 15; x <= 17; x++) {
      maskSet(mask, size, x, y, 'shaft');
    }
  }

  // ── Butt (y=26..28, varies by buttStyle) ──
  // 每列 [leftX, rightX] 寬度,對應 spec §4.4 的表格
  const buttRanges = {
    disc:   [[14, 18], [14, 18], [14, 18]],   // 平蓋 w5×3 列
    sphere: [[15, 17], [14, 18], [15, 17]],   // 上下窄中間寬,圓珠
    spike:  [[14, 18], [15, 17], [16, 16]],   // 從上往下收成 1 px 點
  };
  const ranges = buttRanges[spec.buttStyle];
  for (let i = 0; i < 3; i++) {
    const y = 26 + i;
    const [lx, rx] = ranges[i];
    for (let x = lx; x <= rx; x++) {
      maskSet(mask, size, x, y, 'butt');
    }
  }

  return mask;
}

// =====================================================================
// Paint helpers (32×32) — 純像素操作,讀 spec + mask 產生裝飾
// =====================================================================

/** 只在指定 cell 為 'head' 時才畫;避免畫到 shaft / butt / 外面 */
function tryPaintHeadCell32(ctx, mask, size, x, y) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  if (mask[y * size + x] !== 'head') return;
  ctx.fillRect(x, y, 1, 1);
}

/**
 * Always-on head shine。1px 縱線在 head body 的 interior column。
 * - straight:cx-1 = 15,y=4..6(3 列,body w5 的內側最左 column)
 * - trident:cx-1 = 15,y=5..6(2 列,跳過 y=4 因 bridge w7 在 col 15 處 up=null 變 outline)
 * - hooked:cx-1 = 15,y=4..6(3 列,body 至少 w5 從 y=4 起)
 *
 * gate:tryPaintHeadCell32 只在 mask 為 'head' 時畫,避免 shine 落到 shaft / 外面。
 */
function paintHeadShine32(ctx, mask, size, spec) {
  ctx.fillStyle = spec.palette.headShine;
  const cx = 16;

  if (spec.archetype === 'straight') {
    for (let y = 4; y <= 6; y++) {
      tryPaintHeadCell32(ctx, mask, size, cx - 1, y);
    }
    return;
  }

  if (spec.archetype === 'trident') {
    for (let y = 5; y <= 6; y++) {
      tryPaintHeadCell32(ctx, mask, size, cx - 1, y);
    }
    return;
  }

  if (spec.archetype === 'hooked') {
    for (let y = 4; y <= 6; y++) {
      tryPaintHeadCell32(ctx, mask, size, cx - 1, y);
    }
    return;
  }
}

/**
 * 條件裝飾:shaft binding(纏繩 / 金屬綁帶)。
 * spec.shaftBindingYs 由 sample 階段決定(0、1 或 2 條,y 範圍 [10..23])。
 * 每條 binding 是 1 列 width 3(cols 15..17),shadow 色,gate 為 mask=='shaft'。
 *
 * 經 outline pass 後,binding 在該列實際可見的只有 (cx=16, y) 1 cell
 * (cols 15 / 17 是 outline ring,被 outline pass 改寫)。視覺效果是
 * 「16 列 wood 主色條上點綴 1-2 個 shadow 1×1 像素」,讀為纏繩痕跡。
 */
function paintShaftBinding32(ctx, mask, size, spec) {
  if (!spec.hasShaftBinding) return;
  ctx.fillStyle = WOOD_PALETTE.shadow;
  for (const y of spec.shaftBindingYs) {
    for (let x = 15; x <= 17; x++) {
      if (mask[y * size + x] !== 'shaft') continue;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

// =====================================================================
// Renderer (32×32) — 純函式,不再使用 RNG
//
// 完整 pipeline(per spec §3):mask → paint by enum → head shine →
// 條件 shaft binding → internal seam → 外圈 outline。
// =====================================================================

function renderSpearSpec32(ctx, spec) {
  const size = 32;
  ctx.clearRect(0, 0, size, size);

  const mask = buildSpearMask32(spec);

  // step 2: 平鋪主色
  paintMaskByEnum(ctx, mask, size, {
    head:  spec.palette.headMain,
    shaft: WOOD_PALETTE.main,
    butt:  spec.palette.headMain,    // 同金屬色
  });

  // step 3: head shine(always-on)
  paintHeadShine32(ctx, mask, size, spec);

  // step 4: shaft binding(條件裝飾)
  paintShaftBinding32(ctx, mask, size, spec);

  // step 5: internal seam
  paintInternalSeams(ctx, mask, size, spec.palette.outline);

  // step 6: 外圈 outline
  applyInsideOutlinePass(ctx, mask, size, spec.palette.outline);
}

// =====================================================================
// 對外:drawSpear(ctx, rng, size)
// 注意:暫時 export 為 drawSpearV2,避免跟 main.js 既有 drawSpear stub
// 撞名(function declaration silent override)。Task 9 改為 drawSpear。
// =====================================================================

function drawSpearV2Impl(ctx, rng, size) {
  const spec = sampleSpearSpec(rng);
  if (size === 32) renderSpearSpec32(ctx, spec);
  // TODO Task 8: 16×16
  // 暫時 size=16 fallback 到 silent no-op(透過 ITEM_TYPES 機制)
}

window.sampleSpearSpec = sampleSpearSpec;
window.drawSpearV2 = drawSpearV2Impl;
window.SPEAR_SHAPE_FNS_32 = SPEAR_SHAPE_FNS_32;
window.buildSpearMask32 = buildSpearMask32;
window.renderSpearSpec32 = renderSpearSpec32;
