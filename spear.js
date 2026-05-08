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

// V2 fallback per spec §11 risk #4:hook 從 y=5..7 都保留,shoulder 也帶鉤,
// 把 hook footprint 從 V1 的 ~3 px 增到 ~5 px。視覺迴歸 A/B 比較用,
// 比較通過後選一版促為 production、另一版刪除(同 sword v3/v4 流程)。
function shapeSpearHookedV2_32() {
  const cells = [];
  const cx = 16;
  cells.push({ x: cx, y: 2 });             // tip
  spearAddRange(cells, 3, cx - 1, cx + 1); // taper w3
  spearAddRange(cells, 4, cx - 2, cx + 2); // body w5
  spearAddRange(cells, 5, cx - 2, cx + 3); // body + hook 開始 w6
  spearAddRange(cells, 6, cx - 2, cx + 4); // 鉤峰 w7
  spearAddRange(cells, 7, cx - 1, cx + 3); // shoulder + hook tail w5(右伸到 col 19)
  return { cells };
}

const SPEAR_SHAPE_FNS_32_V2 = {
  straight: shapeSpearStraight32,
  trident:  shapeSpearTrident32,
  hooked:   shapeSpearHookedV2_32,
};

// =====================================================================
// Shape silhouette functions (16×16) — 子集,專為 16 解析度重新設計(非縮放)
//
// 整體垂直配置(per spec §6.1):
//   y=0      padding
//   y=1..4   head  (4 rows)
//   y=5..12  shaft (8 rows)
//   y=13..14 butt  (2 rows,collapse 成 disc w3)
//   y=15     padding
//
// 中軸 cx=8。
// =====================================================================

function shapeSpearStraight16() {
  // 對稱 leaf:tip 1 + taper 3 + body 5 + shoulder 3
  const cells = [];
  const cx = 8;
  cells.push({ x: cx, y: 1 });             // tip
  spearAddRange(cells, 2, cx - 1, cx + 1); // taper w3
  spearAddRange(cells, 3, cx - 2, cx + 2); // body w5
  spearAddRange(cells, 4, cx - 1, cx + 1); // shoulder w3
  return { cells };
}

function shapeSpearTrident16() {
  // 三叉:prongs 在 cols cx-2, cx, cx+2(間距 2,比 32 版 cols 13,16,19 間距 3 收窄)
  // y=1 prongs → y=2 bridge w5 → y=3 body w5 → y=4 shoulder w3
  const cells = [];
  const cx = 8;
  cells.push({ x: cx - 2, y: 1 });
  cells.push({ x: cx,     y: 1 });
  cells.push({ x: cx + 2, y: 1 });
  spearAddRange(cells, 2, cx - 2, cx + 2); // bridge w5
  spearAddRange(cells, 3, cx - 2, cx + 2); // body w5
  spearAddRange(cells, 4, cx - 1, cx + 1); // shoulder w3
  return { cells };
}

function shapeSpearHooked16() {
  // 鉤矛 16:head 4 行容不下專屬 hook row,改用 shoulder 列向右多 1 col 表 hook
  // tip 1 + taper 3 + body 5 + shoulder + hook (cols 7..11 = w5 偏右)
  const cells = [];
  const cx = 8;
  cells.push({ x: cx, y: 1 });             // tip
  spearAddRange(cells, 2, cx - 1, cx + 1); // taper w3
  spearAddRange(cells, 3, cx - 2, cx + 2); // body w5
  spearAddRange(cells, 4, cx - 1, cx + 3); // shoulder + hook 1 px(右伸到 col 11)
  return { cells };
}

const SPEAR_SHAPE_FNS_16 = {
  straight: shapeSpearStraight16,
  trident:  shapeSpearTrident16,
  hooked:   shapeSpearHooked16,
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
// Mask builder (16×16) — 共用 spec,但 16 collapse 規則內部處理
//
// 16 collapse(per spec §6.4):
//   buttStyle 'sphere' / 'spike' → 全部 collapse 成 'disc' 同形(w3 × 2 行)
// 不污染 spec(spec 仍標 sphere / spike)。
// =====================================================================

function buildSpearMask16(spec) {
  const size = 16;
  const mask = allocateMask(size);

  // ── Head ──
  const { cells } = SPEAR_SHAPE_FNS_16[spec.archetype]();
  for (const { x, y } of cells) {
    maskSet(mask, size, x, y, 'head');
  }

  // ── Shaft (y=5..12, width 3, cols 7..9) ──
  for (let y = 5; y <= 12; y++) {
    for (let x = 7; x <= 9; x++) {
      maskSet(mask, size, x, y, 'shaft');
    }
  }

  // ── Butt (y=13..14, 全 collapse 成 disc w3) ──
  // 16 上 butt 2 行 + outline pass 後沒有 interior cell 顯示金屬色,
  // sphere / spike vs disc 在外形差異不可能讀出,故統一一個形狀。
  for (let y = 13; y <= 14; y++) {
    for (let x = 7; x <= 9; x++) {
      maskSet(mask, size, x, y, 'butt');
    }
  }

  return mask;
}

// =====================================================================
// 16 paint helpers
// =====================================================================

/** 16 版 head cell gate(同 32 版邏輯,不同 size) */
function tryPaintHeadCell16(ctx, mask, size, x, y) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  if (mask[y * size + x] !== 'head') return;
  ctx.fillRect(x, y, 1, 1);
}

/**
 * 16 head shine — 壓縮成 1 px。
 * 三個 archetype 都在 y=3 col cx-1=7 畫 1 px,因 16 head 4 行裡只有 y=3 body 列
 * 在 col 7 是 interior;y=2 col 7 上鄰是 null/edge 會被 outline 蓋掉。
 */
function paintHeadShine16(ctx, mask, size, spec) {
  ctx.fillStyle = spec.palette.headShine;
  const cx = 8;
  tryPaintHeadCell16(ctx, mask, size, cx - 1, 3);
}

// =====================================================================
// Renderer (16×16)
//
// 16 不畫 hasShaftBinding(per spec §6.5)。
// =====================================================================

function renderSpearSpec16(ctx, spec) {
  const size = 16;
  ctx.clearRect(0, 0, size, size);

  const mask = buildSpearMask16(spec);

  // step 2: 平鋪主色
  paintMaskByEnum(ctx, mask, size, {
    head:  spec.palette.headMain,
    shaft: WOOD_PALETTE.main,
    butt:  spec.palette.headMain,
  });

  // step 3: head shine
  paintHeadShine16(ctx, mask, size, spec);

  // 16 不畫 paintShaftBinding(per spec §6.5)

  // step 5: internal seam
  paintInternalSeams(ctx, mask, size, spec.palette.outline);
  // step 6: 外圈 outline
  applyInsideOutlinePass(ctx, mask, size, spec.palette.outline);
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

// V2 比較用 — 同 renderSpearSpec32 但用 SPEAR_SHAPE_FNS_32_V2(hooked 走 V2)。
// 視覺迴歸選定一版後刪除 — production 不會路由到這裡。
function buildSpearMask32V2(spec) {
  const size = 32;
  const mask = allocateMask(size);
  const { cells } = SPEAR_SHAPE_FNS_32_V2[spec.archetype]();
  for (const { x, y } of cells) maskSet(mask, size, x, y, 'head');
  for (let y = 8; y <= 25; y++) {
    for (let x = 15; x <= 17; x++) maskSet(mask, size, x, y, 'shaft');
  }
  const buttRanges = {
    disc:   [[14, 18], [14, 18], [14, 18]],
    sphere: [[15, 17], [14, 18], [15, 17]],
    spike:  [[14, 18], [15, 17], [16, 16]],
  };
  const ranges = buttRanges[spec.buttStyle];
  for (let i = 0; i < 3; i++) {
    const y = 26 + i;
    const [lx, rx] = ranges[i];
    for (let x = lx; x <= rx; x++) maskSet(mask, size, x, y, 'butt');
  }
  return mask;
}

function renderSpearSpec32V2(ctx, spec) {
  const size = 32;
  ctx.clearRect(0, 0, size, size);
  const mask = buildSpearMask32V2(spec);
  paintMaskByEnum(ctx, mask, size, {
    head:  spec.palette.headMain,
    shaft: WOOD_PALETTE.main,
    butt:  spec.palette.headMain,
  });
  paintHeadShine32(ctx, mask, size, spec);
  paintShaftBinding32(ctx, mask, size, spec);
  paintInternalSeams(ctx, mask, size, spec.palette.outline);
  applyInsideOutlinePass(ctx, mask, size, spec.palette.outline);
}

// =====================================================================
// 對外:drawSpear(ctx, rng, size)
// =====================================================================

function drawSpearImpl(ctx, rng, size) {
  const spec = sampleSpearSpec(rng);
  if (size === 32) renderSpearSpec32(ctx, spec);
  else if (size === 16) renderSpearSpec16(ctx, spec);
}

window.sampleSpearSpec = sampleSpearSpec;
window.drawSpear = drawSpearImpl;
window.SPEAR_SHAPE_FNS_32 = SPEAR_SHAPE_FNS_32;
window.SPEAR_SHAPE_FNS_16 = SPEAR_SHAPE_FNS_16;
window.buildSpearMask32 = buildSpearMask32;
window.renderSpearSpec32 = renderSpearSpec32;
window.buildSpearMask16 = buildSpearMask16;
window.renderSpearSpec16 = renderSpearSpec16;
window.SPEAR_SHAPE_FNS_32_V2 = SPEAR_SHAPE_FNS_32_V2;
window.renderSpearSpec32V2 = renderSpearSpec32V2;
