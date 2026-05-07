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

const SHAPE_FNS_32 = {
  straight: shapeStraight32,
  curved:   shapeCurved32,
  broad:    shapeBroad32,
};

// =====================================================================
// Renderer — 純函式,不再使用 RNG;Task 4+ 補完
// =====================================================================

function renderSwordSpec32(ctx, spec) {
  // TODO Task 4: 實作
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
window.SHAPE_FNS_32 = SHAPE_FNS_32;
