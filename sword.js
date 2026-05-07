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
