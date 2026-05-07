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

// =====================================================================
// Shape silhouette functions (32×32)
//
// 每個 archetype 是一個 () → { rows: Array<{leftX, rightX, kind:'blade'} | null> }
// 描繪 blade 外輪廓。整數座標,中心對齊 cx=16。
// 注意:silhouette 是「未咬掉外圍 outline 之前」的形狀;outline pass 會吃掉外圈 1px。
//
// 整體垂直配置(此 task 只做 blade,後續 task 加 guard/grip/pommel):
//   y=0..1   padding
//   y=2..18  blade  (17 rows)
//   y=19..20 guard
//   y=21..26 grip
//   y=27..29 pommel
//   y=30..31 padding
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
  // 單刃彎刀:width 3,tip 偏右 cx+2,中心線線性過渡到 cx
  // offset(y) = round(2 * (18 - y) / (18 - 4)),範圍 y=4..18,offset 從 2 到 0
  const rows = new Array(32).fill(null);
  const cx = 16;
  rows[2] = { leftX: cx + 2, rightX: cx + 2, kind: 'blade' };  // tip 1px,偏右 2
  rows[3] = { leftX: cx + 1, rightX: cx + 2, kind: 'blade' };  // taper
  for (let y = 4; y <= 18; y++) {
    const offset = Math.round(2 * (18 - y) / (18 - 4));
    rows[y] = {
      leftX:  cx + offset - 1,
      rightX: cx + offset + 1,
      kind: 'blade',
    };
  }
  return { rows };
}

const SWORD_SHAPE_FNS_32 = {
  straight: shapeStraight32,
  curved:   shapeCurved32,
  broad:    shapeBroad32,
};

// =====================================================================
// Mask builder (32×32) — 把 spec 轉成 enum mask
//
// mask cell ∈ { 'blade' | 'guard' | 'grip' | 'pommel' | null }
// 整體配置在 spec 設計文件 §4.1。
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

  // ── Guard (y=19..20, 2 列) ── 寬度與形狀依 guardStyle
  // 每個 guardStyle 提供 [y19_left, y19_right, y20_left, y20_right](inclusive)。
  const guardRanges = {
    bar:   [cx - 3, cx + 3, cx - 3, cx + 3],  // 2 列同寬 7
    swept: [cx - 2, cx + 2, cx - 3, cx + 3],  // y=19 寬 5,y=20 寬 7(下層展開)
    disc:  [cx - 3, cx + 3, cx - 4, cx + 4],  // y=19 寬 7,y=20 寬 9(中下凸)
  };
  const [g19l, g19r, g20l, g20r] = guardRanges[spec.guardStyle];
  for (let x = g19l; x <= g19r; x++) maskSet(mask, size, x, 19, 'guard');
  for (let x = g20l; x <= g20r; x++) maskSet(mask, size, x, 20, 'guard');

  // ── Grip (y=21..26, 6 列, width 3) ──
  for (let y = 21; y <= 26; y++) {
    for (let x = cx - 1; x <= cx + 1; x++) {
      maskSet(mask, size, x, y, 'grip');
    }
  }

  // ── Pommel (y=27..29, 3 列) ── 寬度依 pommelStyle
  // round / gem 都用 width 3(cx-1..cx+1);disk 用 width 5(cx-2..cx+2)
  const pommelHalfW = (spec.pommelStyle === 'disk') ? 2 : 1;
  for (let y = 27; y <= 29; y++) {
    for (let x = cx - pommelHalfW; x <= cx + pommelHalfW; x++) {
      maskSet(mask, size, x, y, 'pommel');
    }
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
 * Always-on blade shine。1px 縱線。
 * - straight:cx,y=4..15
 * - broad:cx-1(blade 內側最左 column),y=4..16
 * - curved:每列從 shape.rows[y] 算 xCenter,y=4..15
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
 * 條件裝飾:grip wrap。
 * spec.gripWrapYs 由 sample 階段決定(0、1 或 2 條,y 範圍 [22..25])。
 * 每條 wrap 畫 grip 寬整列 LEATHER_PALETTE.shadow,但只有 (cx, y) 不會被
 * 後續 outline pass 覆蓋,實際視覺是 1 px 暗點。
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
 * 條件裝飾:pommel gem。
 * spec.pommelStyle === 'gem' 才畫,座標固定 (cx=16, y=28)— 即 pommel 3 列高的中間列、
 * 中央 cell,經 outline + seam pass 不會被覆蓋(interior 條件成立)。
 */
function paintGem32(ctx, mask, size, spec) {
  if (spec.pommelStyle !== 'gem') return;
  const cx = 16, gemY = 28;
  if (mask[gemY * size + cx] !== 'pommel') return;
  ctx.fillStyle = spec.palette.bladeShine;
  ctx.fillRect(cx, gemY, 1, 1);
}

// =====================================================================
// Renderer — 純函式,不再使用 RNG;Task 4+ 補完
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
  // TODO Task 8: 實作
}

// =====================================================================
// 對外:drawSword(ctx, rng, size)
// 暫名 drawSwordV2 避免跟 main.js 既有 stub 撞名;Task 9 才取代。
// =====================================================================

function drawSwordImpl(ctx, rng, size) {
  const spec = sampleSwordSpec(rng);
  if (size === 32) renderSwordSpec32(ctx, spec);
  else if (size === 16) renderSwordSpec16(ctx, spec);
}

window.sampleSwordSpec = sampleSwordSpec;
window.renderSwordSpec32 = renderSwordSpec32;
window.renderSwordSpec16 = renderSwordSpec16;
window.drawSwordV2 = drawSwordImpl;  // Task 9 改成 window.drawSword
