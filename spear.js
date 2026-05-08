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
// 對外:drawSpear(ctx, rng, size)
// 注意:暫時 export 為 drawSpearV2,避免跟 main.js 既有 drawSpear stub
// 撞名(function declaration silent override)。Task 9 改為 drawSpear。
// =====================================================================

function drawSpearV2Impl(ctx, rng, size) {
  const spec = sampleSpearSpec(rng);
  // TODO Task 4-8: render → renderSpearSpec32 / renderSpearSpec16
  console.log('[drawSpearV2 stub] spec=', spec, 'size=', size);
}

window.sampleSpearSpec = sampleSpearSpec;
window.drawSpearV2 = drawSpearV2Impl;
window.SPEAR_SHAPE_FNS_32 = SPEAR_SHAPE_FNS_32;
