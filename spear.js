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
