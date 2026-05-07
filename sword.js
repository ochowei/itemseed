// sword.js
// 兩階段架構:sampleSwordSpec(rng) → spec → renderSwordSpec32/16(ctx, spec)。
// 此檔最後 export 對外 drawSword(ctx, rng, size) 給 main.js 用。
// 沿用 potion 同模式,palette 由 sampleSwordPalette 提供。

// =====================================================================
// Sampler — 把所有 RNG 集中於此,輸出純資料 spec
// =====================================================================

const ARCHETYPES = ['straight', 'curved', 'broad'];
const ARCHETYPE_WEIGHTS = [3, 2, 1.5];
const GUARD_STYLES = ['bar', 'swept', 'disc'];
const POMMEL_STYLES = ['round', 'disk', 'gem'];

// hasGripWrap 為 true 時,2 條 wrap 的有效 y pair(避開 grip 上下 seam 列、且間隔 ≥ 2)。
// grip y=21..26 → 有效 wrap y 範圍 [22..25]
const WRAP_PAIRS = [[22, 24], [22, 25], [23, 25]];

function sampleSwordSpec(rng) {
  const { family, palette } = sampleSwordPalette(rng);
  const archetype = rng.pickWeighted(ARCHETYPES, ARCHETYPE_WEIGHTS);
  const guardStyle = rng.pick(GUARD_STYLES);
  const pommelStyle = rng.pick(POMMEL_STYLES);
  const hasGripWrap = rng.chance(0.5);
  // curved 中軸隨 row 漂移,fuller 線會 zig-zag,強制關閉
  const hasFuller = (archetype !== 'curved') && rng.chance(0.4);

  // sample 階段就決定 wrap 帶位置,確保 render 是純函式
  const gripWrapYs = [];
  if (hasGripWrap) {
    if (rng.chance(0.5)) {
      // 1 條 wrap
      gripWrapYs.push(rng.randomInt(22, 25));
    } else {
      // 2 條 wrap,從合法 pair 三選一
      const pair = rng.pick(WRAP_PAIRS);
      gripWrapYs.push(pair[0], pair[1]);
    }
  }

  return {
    family,
    palette,
    archetype,
    guardStyle,
    pommelStyle,
    hasGripWrap,
    hasFuller,
    gripWrapYs,
  };
}

// (archAxis helpers 移除 — production 三種 archetype 都 vertical hilt,
//  curved 的 diagonal 只在 blade silhouette 內,guard/grip/pommel 全部對齊 cx。)

// =====================================================================
// Shape silhouette functions (32×32)
//
// 每個 archetype 是一個 () → { rows: Array<{leftX, rightX, kind:'blade'} | null> }
// 描繪 blade 外輪廓。整數座標。
// 注意:silhouette 是「未咬掉外圍 outline 之前」的形狀;outline pass 會吃掉外圈 1px。
//
// 整體垂直配置:
//   y=0..1   padding
//   y=2..18  blade  (17 rows)
//   y=19..20 guard
//   y=21..26 grip
//   y=27..29 pommel
//   y=30..31 padding
//
// straight / broad 中軸對齊 cx=16;curved 沿 archAxis32('curved', y) 斜軸。
// =====================================================================

function shapeStraight32() {
  // 雙刃直劍:width 3,tip 1px
  const rows = new Array(32).fill(null);
  const cx = 16;
  rows[2] = { leftX: cx,     rightX: cx,     kind: 'blade' };  // tip 1px
  rows[3] = { leftX: cx - 1, rightX: cx + 1, kind: 'blade' };  // taper
  for (let y = 4; y <= 18; y++) {
    rows[y] = { leftX: cx - 1, rightX: cx + 1, kind: 'blade' };
  }
  return { rows };
}

function shapeBroad32() {
  // 寬刃厚劍:width 5,tip 1px,2 列 taper
  const rows = new Array(32).fill(null);
  const cx = 16;
  rows[2] = { leftX: cx,     rightX: cx,     kind: 'blade' };  // tip 1px
  rows[3] = { leftX: cx - 1, rightX: cx + 1, kind: 'blade' };  // taper 1
  rows[4] = { leftX: cx - 2, rightX: cx + 2, kind: 'blade' };  // taper 2
  for (let y = 5; y <= 18; y++) {
    rows[y] = { leftX: cx - 2, rightX: cx + 2, kind: 'blade' };
  }
  return { rows };
}

function shapeCurved32() {
  // 單刃彎刀(vertical hilt + curved blade):
  // 上半 4 列「斜柱」段(tip 偏右、刀身 tilt 但不彎)→ 中段 6 列 stairstep 急彎
  // → 下半 5 列回到 cx-1..cx+1 跟 vertical guard 對齊。
  // 結合 reference 圖的 saber pattern:hilt 直立,只 blade 帶曲度。
  const rows = new Array(32).fill(null);
  const cx = 16;
  rows[2]  = { leftX: cx + 5, rightX: cx + 5, kind: 'blade' };  // tip 1px
  rows[3]  = { leftX: cx + 4, rightX: cx + 5, kind: 'blade' };  // taper width 2
  // upper segment(4 rows constant 斜柱)
  for (let y = 4; y <= 7; y++) {
    rows[y] = { leftX: cx + 3, rightX: cx + 5, kind: 'blade' };
  }
  // belly stairstep 急彎(每 2 列左移 1)
  for (let y = 8;  y <= 9;  y++) rows[y] = { leftX: cx + 2, rightX: cx + 4, kind: 'blade' };
  for (let y = 10; y <= 11; y++) rows[y] = { leftX: cx + 1, rightX: cx + 3, kind: 'blade' };
  for (let y = 12; y <= 13; y++) rows[y] = { leftX: cx,     rightX: cx + 2, kind: 'blade' };
  // base aligned with vertical hilt(5 rows)
  for (let y = 14; y <= 18; y++) {
    rows[y] = { leftX: cx - 1, rightX: cx + 1, kind: 'blade' };
  }
  return { rows };
}

const SWORD_SHAPE_FNS_32 = {
  straight: shapeStraight32,
  curved:   shapeCurved32,
  broad:    shapeBroad32,
};

// =====================================================================
// Shape silhouette functions (16×16) — 子集,專為 16 解析度重新設計(非縮放)
//
// 整體垂直配置:
//   y=0      padding
//   y=1      blade tip
//   y=2..9   blade body (8 rows)
//   y=10     guard
//   y=11..13 grip
//   y=14     pommel
//   y=15     padding
// =====================================================================

function shapeStraight16() {
  // 直劍 16:width 3
  const rows = new Array(16).fill(null);
  const cx = 8;
  rows[1] = { leftX: cx, rightX: cx, kind: 'blade' };  // tip
  for (let y = 2; y <= 9; y++) {
    rows[y] = { leftX: cx - 1, rightX: cx + 1, kind: 'blade' };
  }
  return { rows };
}

function shapeBroad16() {
  // 寬刃 16:width 5
  const rows = new Array(16).fill(null);
  const cx = 8;
  rows[1] = { leftX: cx,     rightX: cx,     kind: 'blade' };  // tip
  rows[2] = { leftX: cx - 1, rightX: cx + 1, kind: 'blade' };  // taper
  for (let y = 3; y <= 9; y++) {
    rows[y] = { leftX: cx - 2, rightX: cx + 2, kind: 'blade' };
  }
  return { rows };
}

function shapeCurved16() {
  // 彎刀 16(vertical hilt):上半 2 列 tilt + 中段 2 列 stairstep + 下半 3 列 base aligned。
  const rows = new Array(16).fill(null);
  const cx = 8;
  rows[1] = { leftX: cx + 3, rightX: cx + 3, kind: 'blade' };  // tip 1px
  rows[2] = { leftX: cx + 2, rightX: cx + 3, kind: 'blade' };  // taper width 2
  // upper(2 rows constant)
  for (let y = 3; y <= 4; y++) rows[y] = { leftX: cx + 1, rightX: cx + 3, kind: 'blade' };
  // belly stairstep
  for (let y = 5; y <= 6; y++) rows[y] = { leftX: cx,     rightX: cx + 2, kind: 'blade' };
  // base aligned with vertical hilt
  for (let y = 7; y <= 9; y++) rows[y] = { leftX: cx - 1, rightX: cx + 1, kind: 'blade' };
  return { rows };
}

// 注意:此 const 命名為 SWORD_SHAPE_FNS_16(不是 SHAPE_FNS_16),
// 避免跟 potion.js 同名 const 在 browser global script env collide → SyntaxError。
const SWORD_SHAPE_FNS_16 = {
  straight: shapeStraight16,
  curved:   shapeCurved16,
  broad:    shapeBroad16,
};

// =====================================================================
// Mask builder (32×32) — 把 spec 轉成 enum mask
//
// mask cell ∈ { 'blade' | 'guard' | 'grip' | 'pommel' | null }
// 以 archAxis32(spec.archetype, y) 取得該 row 的中軸,讓 vertical 與
// curved 的 diagonal layout 共用同一份 code。
// =====================================================================

function buildSwordMask32(spec) {
  const size = 32;
  const mask = allocateMask(size);
  const cx = 16;

  // ── Blade ──
  const shape = SWORD_SHAPE_FNS_32[spec.archetype]();
  for (let y = 0; y < size; y++) {
    const r = shape.rows[y];
    if (!r) continue;
    for (let x = r.leftX; x <= r.rightX; x++) {
      maskSet(mask, size, x, y, 'blade');
    }
  }

  // ── Guard (y=19..20, 2 列) ── 寬度依 guardStyle,中央對齊 cx
  const guardRanges = {
    bar:   [cx - 3, cx + 3, cx - 3, cx + 3],
    swept: [cx - 2, cx + 2, cx - 3, cx + 3],
    disc:  [cx - 3, cx + 3, cx - 4, cx + 4],
  };
  const [g19l, g19r, g20l, g20r] = guardRanges[spec.guardStyle];
  for (let x = g19l; x <= g19r; x++) maskSet(mask, size, x, 19, 'guard');
  for (let x = g20l; x <= g20r; x++) maskSet(mask, size, x, 20, 'guard');

  // ── Grip (y=21..26, 6 列, width 3) ── 對齊 cx
  for (let y = 21; y <= 26; y++) {
    for (let x = cx - 1; x <= cx + 1; x++) {
      maskSet(mask, size, x, y, 'grip');
    }
  }

  // ── Pommel (y=27..29, 3 列) ── round/gem width 3,disk width 5
  const pommelHalfW = (spec.pommelStyle === 'disk') ? 2 : 1;
  for (let y = 27; y <= 29; y++) {
    for (let x = cx - pommelHalfW; x <= cx + pommelHalfW; x++) {
      maskSet(mask, size, x, y, 'pommel');
    }
  }

  return mask;
}

// =====================================================================
// Mask builder (16×16) — 共用 spec,但內部 collapse 16 不支援的 axis
//
// 16 collapse 規則(per spec §6.3 / §6.5):
//   guardStyle 'swept' → 走 'bar' 同寬
//   pommelStyle 'gem'  → 走 'round' 同形(無 highlight)
// 不污染 spec(spec 仍標 swept / gem)。
// =====================================================================

function buildSwordMask16(spec) {
  const size = 16;
  const mask = allocateMask(size);
  const cx = 8;

  // ── Blade ──
  const shape = SWORD_SHAPE_FNS_16[spec.archetype]();
  for (let y = 0; y < size; y++) {
    const r = shape.rows[y];
    if (!r) continue;
    for (let x = r.leftX; x <= r.rightX; x++) {
      maskSet(mask, size, x, y, 'blade');
    }
  }

  // ── Guard (y=10, 1 列) ── bar/swept width 5,disc width 6 (cx-3..cx+2 非對稱)
  let gLeft, gRight;
  if (spec.guardStyle === 'disc') {
    gLeft = cx - 3; gRight = cx + 2;
  } else {
    gLeft = cx - 2; gRight = cx + 2;
  }
  for (let x = gLeft; x <= gRight; x++) {
    maskSet(mask, size, x, 10, 'guard');
  }

  // ── Grip (y=11..13, width 3) ── 對齊 cx
  for (let y = 11; y <= 13; y++) {
    for (let x = cx - 1; x <= cx + 1; x++) {
      maskSet(mask, size, x, y, 'grip');
    }
  }

  // ── Pommel (y=14, 1 列) ── round/gem width 1,disk width 3
  const pommelHalfW = (spec.pommelStyle === 'disk') ? 1 : 0;
  for (let x = cx - pommelHalfW; x <= cx + pommelHalfW; x++) {
    maskSet(mask, size, x, 14, 'pommel');
  }

  return mask;
}

// =====================================================================
// Paint helpers (32×32) — 純像素操作,讀 spec + mask 產生裝飾
// =====================================================================

/** 只在指定 cell 為 'blade' 時才畫;避免畫到 guard / 外面 */
function tryPaintBladeCell32(ctx, mask, size, x, y) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  if (mask[y * size + x] !== 'blade') return;
  ctx.fillRect(x, y, 1, 1);
}

/**
 * Always-on blade shine。1px 縱線(curved 沿 axis 走)。
 * - straight:cx,y=4..15
 * - broad:cx-1(blade 內側最左 column),y=4..16
 * - curved:每列從 shape.rows[y] 算 xCenter,y=4..15(自動跟著 diagonal axis)
 */
function paintBladeShine32(ctx, mask, size, spec) {
  ctx.fillStyle = spec.palette.bladeShine;
  const cx = 16;

  if (spec.archetype === 'straight') {
    for (let y = 4; y <= 15; y++) {
      tryPaintBladeCell32(ctx, mask, size, cx, y);
    }
    return;
  }

  if (spec.archetype === 'broad') {
    for (let y = 4; y <= 16; y++) {
      tryPaintBladeCell32(ctx, mask, size, cx - 1, y);
    }
    return;
  }

  if (spec.archetype === 'curved') {
    const shape = SWORD_SHAPE_FNS_32.curved();
    for (let y = 4; y <= 15; y++) {
      const r = shape.rows[y];
      if (!r) continue;
      const xCenter = Math.round((r.leftX + r.rightX) / 2);
      tryPaintBladeCell32(ctx, mask, size, xCenter, y);
    }
    return;
  }
}

/**
 * 條件裝飾:fuller(刀身中軸溝槽)。
 * curved 強制 false;straight + broad 在 cx 中軸畫 1px bladeShadow 縱線。
 * 範圍 y=4..16,故意比 blade 全長短 ~2px,讓 tip 與 hilt 端不畫,看起來像真實溝槽中段。
 *
 * 與 shine 互動:
 * - straight 寬 3,fuller 在 cx,shine 也在 cx,fuller 後畫故覆蓋 shine,結果為較暗刀身(刻意)。
 * - broad 寬 5,shine 在 cx-1 / fuller 在 cx,各佔不同 column 共存。
 */
function paintFuller32(ctx, mask, size, spec) {
  if (!spec.hasFuller) return;
  if (spec.archetype === 'curved') return;
  ctx.fillStyle = spec.palette.bladeShadow;
  const cx = 16;
  for (let y = 4; y <= 16; y++) {
    if (mask[y * size + cx] !== 'blade') continue;
    ctx.fillRect(cx, y, 1, 1);
  }
}

/**
 * 條件裝飾:grip wrap。grip 對齊 cx,wrap 在 (cx, gripWrapYs[i]) 1 px 暗點。
 * spec.gripWrapYs 由 sample 階段決定(0、1 或 2 條,y 範圍 [22..25])。
 */
function paintGripWrap32(ctx, mask, size, spec) {
  if (!spec.hasGripWrap) return;
  ctx.fillStyle = LEATHER_PALETTE.shadow;
  const cx = 16;
  for (const y of spec.gripWrapYs) {
    for (let x = cx - 1; x <= cx + 1; x++) {
      if (mask[y * size + x] !== 'grip') continue;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

/**
 * 條件裝飾:pommel gem。座標固定 (cx=16, y=28) — pommel 中間列中央 cell。
 */
function paintGem32(ctx, mask, size, spec) {
  if (spec.pommelStyle !== 'gem') return;
  const cx = 16, gemY = 28;
  if (mask[gemY * size + cx] !== 'pommel') return;
  ctx.fillStyle = spec.palette.bladeShine;
  ctx.fillRect(cx, gemY, 1, 1);
}

/** 只在指定 cell 為 'blade' 時才畫(16 版,共用 32 版邏輯) */
function tryPaintBladeCell16(ctx, mask, size, x, y) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  if (mask[y * size + x] !== 'blade') return;
  ctx.fillRect(x, y, 1, 1);
}

/**
 * 16 blade shine — 壓縮成 3-4 px。
 * - straight:cx, y=4..7
 * - broad:cx-1, y=4..8
 * - curved:每列從 shape.rows[y] 算 xCenter, y=4..7(自動跟著 diagonal axis)
 */
function paintBladeShine16(ctx, mask, size, spec) {
  ctx.fillStyle = spec.palette.bladeShine;
  const cx = 8;

  if (spec.archetype === 'straight') {
    for (let y = 4; y <= 7; y++) {
      tryPaintBladeCell16(ctx, mask, size, cx, y);
    }
    return;
  }

  if (spec.archetype === 'broad') {
    for (let y = 4; y <= 8; y++) {
      tryPaintBladeCell16(ctx, mask, size, cx - 1, y);
    }
    return;
  }

  if (spec.archetype === 'curved') {
    const shape = SWORD_SHAPE_FNS_16.curved();
    for (let y = 4; y <= 7; y++) {
      const r = shape.rows[y];
      if (!r) continue;
      const xCenter = Math.round((r.leftX + r.rightX) / 2);
      tryPaintBladeCell16(ctx, mask, size, xCenter, y);
    }
    return;
  }
}

// =====================================================================
// Renderer — 純函式,不再使用 RNG
// =====================================================================

function renderSwordSpec32(ctx, spec) {
  const size = 32;
  ctx.clearRect(0, 0, size, size);

  const mask = buildSwordMask32(spec);

  // step 2: 平鋪主色
  paintMaskByEnum(ctx, mask, size, {
    blade:  spec.palette.bladeMain,
    guard:  spec.palette.bladeMain,    // 同金屬色
    pommel: spec.palette.bladeMain,    // 同金屬色
    grip:   LEATHER_PALETTE.main,
  });

  // step 3: grip wrap
  paintGripWrap32(ctx, mask, size, spec);
  // step 4: blade shine(always-on)
  paintBladeShine32(ctx, mask, size, spec);
  // step 5: fuller(在 shine 之後,讓 straight + fuller 時 fuller 覆蓋 shine)
  paintFuller32(ctx, mask, size, spec);
  // step 6: gem
  paintGem32(ctx, mask, size, spec);

  // step 7: internal seam
  paintInternalSeams(ctx, mask, size, spec.palette.outline);

  // step 8: 外圈 outline
  applyInsideOutlinePass(ctx, mask, size, spec.palette.outline);
}

function renderSwordSpec16(ctx, spec) {
  const size = 16;
  ctx.clearRect(0, 0, size, size);

  const mask = buildSwordMask16(spec);

  // step 2: 平鋪主色
  paintMaskByEnum(ctx, mask, size, {
    blade:  spec.palette.bladeMain,
    guard:  spec.palette.bladeMain,
    pommel: spec.palette.bladeMain,
    grip:   LEATHER_PALETTE.main,
  });

  // 16 不畫 fuller / gripWrap / gem(per spec §6.6)
  // step 4: blade shine(always-on)
  paintBladeShine16(ctx, mask, size, spec);

  // step 7: internal seam
  paintInternalSeams(ctx, mask, size, spec.palette.outline);
  // step 8: 外圈 outline
  applyInsideOutlinePass(ctx, mask, size, spec.palette.outline);
}

// =====================================================================
// 對外:drawSword(ctx, rng, size)
// =====================================================================

function drawSwordImpl(ctx, rng, size) {
  const spec = sampleSwordSpec(rng);
  if (size === 32) renderSwordSpec32(ctx, spec);
  else if (size === 16) renderSwordSpec16(ctx, spec);
}

// =====================================================================
// Regression-only API: v3「整把劍對角線」候選版本(已被 production 的
// vertical-hilt + curved-blade 取代,但保留給 regression.html 比對用)。
// 非 curved spec 直接 fall through 到 production renderer。
// =====================================================================

function axisV3_32(y) {
  const tipX = 22;  // cx + 6
  if (y < 2)  return tipX;
  if (y > 29) return tipX - 13;
  return tipX - Math.floor((y - 2) / 2);
}

function axisV3_16(y) {
  const tipX = 11;  // cx + 3
  if (y < 1)  return tipX;
  if (y > 14) return tipX - 6;
  return tipX - Math.floor((y - 1) / 2);
}

function buildMaskV3_32(spec) {
  const size = 32;
  const mask = allocateMask(size);
  // Blade(width 3 沿斜軸)
  maskSet(mask, size, axisV3_32(2), 2, 'blade');
  maskSet(mask, size, axisV3_32(3) - 1, 3, 'blade');
  maskSet(mask, size, axisV3_32(3),     3, 'blade');
  for (let y = 4; y <= 18; y++) {
    const ax = axisV3_32(y);
    for (let x = ax - 1; x <= ax + 1; x++) maskSet(mask, size, x, y, 'blade');
  }
  // Guard 沿 axis(19.5)
  const gCenter = Math.floor((axisV3_32(19) + axisV3_32(20)) / 2);
  const guardRanges = {
    bar:   [gCenter - 3, gCenter + 3, gCenter - 3, gCenter + 3],
    swept: [gCenter - 2, gCenter + 2, gCenter - 3, gCenter + 3],
    disc:  [gCenter - 3, gCenter + 3, gCenter - 4, gCenter + 4],
  };
  const [g19l, g19r, g20l, g20r] = guardRanges[spec.guardStyle];
  for (let x = g19l; x <= g19r; x++) maskSet(mask, size, x, 19, 'guard');
  for (let x = g20l; x <= g20r; x++) maskSet(mask, size, x, 20, 'guard');
  // Grip 沿 axis
  for (let y = 21; y <= 26; y++) {
    const ax = axisV3_32(y);
    for (let x = ax - 1; x <= ax + 1; x++) maskSet(mask, size, x, y, 'grip');
  }
  // Pommel 沿 axis
  const pommelHalfW = (spec.pommelStyle === 'disk') ? 2 : 1;
  for (let y = 27; y <= 29; y++) {
    const ax = axisV3_32(y);
    for (let x = ax - pommelHalfW; x <= ax + pommelHalfW; x++) maskSet(mask, size, x, y, 'pommel');
  }
  return mask;
}

function buildMaskV3_16(spec) {
  const size = 16;
  const mask = allocateMask(size);
  maskSet(mask, size, axisV3_16(1), 1, 'blade');
  maskSet(mask, size, axisV3_16(2) - 1, 2, 'blade');
  maskSet(mask, size, axisV3_16(2),     2, 'blade');
  for (let y = 3; y <= 9; y++) {
    const ax = axisV3_16(y);
    for (let x = ax - 1; x <= ax + 1; x++) maskSet(mask, size, x, y, 'blade');
  }
  const gCenter = axisV3_16(10);
  let gLeft, gRight;
  if (spec.guardStyle === 'disc') { gLeft = gCenter - 3; gRight = gCenter + 2; }
  else                            { gLeft = gCenter - 2; gRight = gCenter + 2; }
  for (let x = gLeft; x <= gRight; x++) maskSet(mask, size, x, 10, 'guard');
  for (let y = 11; y <= 13; y++) {
    const ax = axisV3_16(y);
    for (let x = ax - 1; x <= ax + 1; x++) maskSet(mask, size, x, y, 'grip');
  }
  const ax14 = axisV3_16(14);
  const pommelHalfW = (spec.pommelStyle === 'disk') ? 1 : 0;
  for (let x = ax14 - pommelHalfW; x <= ax14 + pommelHalfW; x++) maskSet(mask, size, x, 14, 'pommel');
  return mask;
}

function paintShineV3_32(ctx, mask, size, spec) {
  ctx.fillStyle = spec.palette.bladeShine;
  for (let y = 4; y <= 15; y++) {
    const ax = axisV3_32(y);
    tryPaintBladeCell32(ctx, mask, size, ax, y);
  }
}

function paintShineV3_16(ctx, mask, size, spec) {
  ctx.fillStyle = spec.palette.bladeShine;
  for (let y = 4; y <= 7; y++) {
    const ax = axisV3_16(y);
    tryPaintBladeCell16(ctx, mask, size, ax, y);
  }
}

function paintGemV3_32(ctx, mask, size, spec) {
  if (spec.pommelStyle !== 'gem') return;
  const gemX = axisV3_32(28), gemY = 28;
  if (mask[gemY * size + gemX] !== 'pommel') return;
  ctx.fillStyle = spec.palette.bladeShine;
  ctx.fillRect(gemX, gemY, 1, 1);
}

function renderSwordSpec32_v3(ctx, spec) {
  if (spec.archetype !== 'curved') return renderSwordSpec32(ctx, spec);
  const size = 32;
  ctx.clearRect(0, 0, size, size);
  const mask = buildMaskV3_32(spec);
  paintMaskByEnum(ctx, mask, size, {
    blade: spec.palette.bladeMain,
    guard: spec.palette.bladeMain,
    pommel: spec.palette.bladeMain,
    grip: LEATHER_PALETTE.main,
  });
  paintShineV3_32(ctx, mask, size, spec);
  paintGemV3_32(ctx, mask, size, spec);
  paintInternalSeams(ctx, mask, size, spec.palette.outline);
  applyInsideOutlinePass(ctx, mask, size, spec.palette.outline);
}

function renderSwordSpec16_v3(ctx, spec) {
  if (spec.archetype !== 'curved') return renderSwordSpec16(ctx, spec);
  const size = 16;
  ctx.clearRect(0, 0, size, size);
  const mask = buildMaskV3_16(spec);
  paintMaskByEnum(ctx, mask, size, {
    blade: spec.palette.bladeMain,
    guard: spec.palette.bladeMain,
    pommel: spec.palette.bladeMain,
    grip: LEATHER_PALETTE.main,
  });
  paintShineV3_16(ctx, mask, size, spec);
  paintInternalSeams(ctx, mask, size, spec.palette.outline);
  applyInsideOutlinePass(ctx, mask, size, spec.palette.outline);
}

window.sampleSwordSpec = sampleSwordSpec;
window.renderSwordSpec32 = renderSwordSpec32;
window.renderSwordSpec16 = renderSwordSpec16;
window.renderSwordSpec32_v3 = renderSwordSpec32_v3;
window.renderSwordSpec16_v3 = renderSwordSpec16_v3;
window.drawSword = drawSwordImpl;
