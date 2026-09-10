// shield.js
// 兩階段架構: sampleShieldSpec(rng) → spec → renderShieldSpec32/16(ctx, spec)。
// 此檔最後 export 對外 drawShield(ctx, rng, size) 給 main.js 用。
// 沿用 sword / spear 同模式, palette 由 sampleShieldPalette 提供。

// =====================================================================
// Sampler — 把所有 RNG 集中於此, 輸出純資料 spec
// =====================================================================

const SHIELD_ARCHETYPES = ['heater', 'round', 'tower'];
const SHIELD_ARCHETYPE_WEIGHTS = [3, 2, 1.5];
const SHIELD_BOSS_STYLES = ['round', 'diamond', 'cross'];
const SHIELD_BOSS_WEIGHTS = [2, 1.5, 1.5];

function sampleShieldSpec(rng) {
  const { family, palette } = sampleShieldPalette(rng);
  const archetype = rng.pickWeighted(SHIELD_ARCHETYPES, SHIELD_ARCHETYPE_WEIGHTS);
  const bossStyle = rng.pickWeighted(SHIELD_BOSS_STYLES, SHIELD_BOSS_WEIGHTS);
  const hasRim = rng.chance(0.7);
  const hasRivets = rng.chance(0.5);
  // 中脊線 (spine) 僅在非圓盾且非十字徽飾時出現, 避免與十字重疊
  const hasSpine = (archetype !== 'round' && bossStyle !== 'cross') && rng.chance(0.45);

  return {
    family,
    palette,
    archetype,
    bossStyle,
    hasRim,
    hasRivets,
    hasSpine,
  };
}

// =====================================================================
// Shape silhouette functions (32×32)
//
// 每個 archetype 回傳 { rows: Array<{ leftX, rightX, kind: 'body' } | null> }
// cx = 16
// =====================================================================

function shapeShieldHeater32() {
  const rows = new Array(32).fill(null);
  // y=4: 頂部微縮
  rows[4] = { leftX: 8, rightX: 24, kind: 'body' };
  // y=5..13: 平行側翼 (寬 19)
  for (let y = 5; y <= 13; y++) {
    rows[y] = { leftX: 7, rightX: 25, kind: 'body' };
  }
  // y=14..27: 向下漸縮為尖底
  rows[14] = { leftX: 8,  rightX: 24, kind: 'body' };
  rows[15] = { leftX: 8,  rightX: 24, kind: 'body' };
  rows[16] = { leftX: 8,  rightX: 24, kind: 'body' };
  rows[17] = { leftX: 9,  rightX: 23, kind: 'body' };
  rows[18] = { leftX: 9,  rightX: 23, kind: 'body' };
  rows[19] = { leftX: 9,  rightX: 23, kind: 'body' };
  rows[20] = { leftX: 10, rightX: 22, kind: 'body' };
  rows[21] = { leftX: 10, rightX: 22, kind: 'body' };
  rows[22] = { leftX: 11, rightX: 21, kind: 'body' };
  rows[23] = { leftX: 12, rightX: 20, kind: 'body' };
  rows[24] = { leftX: 13, rightX: 19, kind: 'body' };
  rows[25] = { leftX: 14, rightX: 18, kind: 'body' };
  rows[26] = { leftX: 15, rightX: 17, kind: 'body' };
  rows[27] = { leftX: 16, rightX: 16, kind: 'body' }; // 尖底 1px
  return { rows };
}

function shapeShieldRound32() {
  const rows = new Array(32).fill(null);
  // 圓心 (16, 16), 上下左右對稱
  rows[6]  = { leftX: 12, rightX: 20, kind: 'body' }; // w 9
  rows[7]  = { leftX: 10, rightX: 22, kind: 'body' }; // w 13
  rows[8]  = { leftX: 9,  rightX: 23, kind: 'body' }; // w 15
  rows[9]  = { leftX: 8,  rightX: 24, kind: 'body' }; // w 17
  rows[10] = { leftX: 7,  rightX: 25, kind: 'body' }; // w 19
  for (let y = 11; y <= 21; y++) {
    rows[y] = { leftX: 6, rightX: 26, kind: 'body' }; // w 21 (最大寬度)
  }
  rows[22] = { leftX: 7,  rightX: 25, kind: 'body' }; // w 19
  rows[23] = { leftX: 8,  rightX: 24, kind: 'body' }; // w 17
  rows[24] = { leftX: 9,  rightX: 23, kind: 'body' }; // w 15
  rows[25] = { leftX: 10, rightX: 22, kind: 'body' }; // w 13
  rows[26] = { leftX: 12, rightX: 20, kind: 'body' }; // w 9
  return { rows };
}

function shapeShieldTower32() {
  const rows = new Array(32).fill(null);
  // y=3..4: 圓拱頂部
  rows[3] = { leftX: 10, rightX: 22, kind: 'body' };
  rows[4] = { leftX: 8,  rightX: 24, kind: 'body' };
  // y=5..24: 直立身軀 (寬 19)
  for (let y = 5; y <= 24; y++) {
    rows[y] = { leftX: 7, rightX: 25, kind: 'body' };
  }
  // y=25..28: 圓角弧形底部
  rows[25] = { leftX: 8,  rightX: 24, kind: 'body' };
  rows[26] = { leftX: 9,  rightX: 23, kind: 'body' };
  rows[27] = { leftX: 11, rightX: 21, kind: 'body' };
  rows[28] = { leftX: 13, rightX: 19, kind: 'body' };
  return { rows };
}

const SHIELD_SHAPE_FNS_32 = {
  heater: shapeShieldHeater32,
  round:  shapeShieldRound32,
  tower:  shapeShieldTower32,
};

// =====================================================================
// Shape silhouette functions (16×16)
// cx = 8
// =====================================================================

function shapeShieldHeater16() {
  const rows = new Array(16).fill(null);
  for (let y = 2; y <= 6; y++) {
    rows[y] = { leftX: 3, rightX: 13, kind: 'body' }; // w 11
  }
  rows[7]  = { leftX: 4, rightX: 12, kind: 'body' }; // w 9
  rows[8]  = { leftX: 4, rightX: 12, kind: 'body' };
  rows[9]  = { leftX: 5, rightX: 11, kind: 'body' }; // w 7
  rows[10] = { leftX: 5, rightX: 11, kind: 'body' };
  rows[11] = { leftX: 6, rightX: 10, kind: 'body' }; // w 5
  rows[12] = { leftX: 7, rightX: 9,  kind: 'body' }; // w 3
  rows[13] = { leftX: 8, rightX: 8,  kind: 'body' }; // w 1 (尖底)
  return { rows };
}

function shapeShieldRound16() {
  const rows = new Array(16).fill(null);
  rows[3] = { leftX: 6, rightX: 10, kind: 'body' }; // w 5
  rows[4] = { leftX: 5, rightX: 11, kind: 'body' }; // w 7
  rows[5] = { leftX: 4, rightX: 12, kind: 'body' }; // w 9
  for (let y = 6; y <= 10; y++) {
    rows[y] = { leftX: 3, rightX: 13, kind: 'body' }; // w 11
  }
  rows[11] = { leftX: 4, rightX: 12, kind: 'body' }; // w 9
  rows[12] = { leftX: 5, rightX: 11, kind: 'body' }; // w 7
  rows[13] = { leftX: 6, rightX: 10, kind: 'body' }; // w 5
  return { rows };
}

function shapeShieldTower16() {
  const rows = new Array(16).fill(null);
  rows[2] = { leftX: 5, rightX: 11, kind: 'body' }; // w 7
  rows[3] = { leftX: 4, rightX: 12, kind: 'body' }; // w 9
  for (let y = 4; y <= 11; y++) {
    rows[y] = { leftX: 3, rightX: 13, kind: 'body' }; // w 11
  }
  rows[12] = { leftX: 4, rightX: 12, kind: 'body' }; // w 9
  rows[13] = { leftX: 5, rightX: 11, kind: 'body' }; // w 7
  return { rows };
}

const SHIELD_SHAPE_FNS_16 = {
  heater: shapeShieldHeater16,
  round:  shapeShieldRound16,
  tower:  shapeShieldTower16,
};

// =====================================================================
// Mask builders
// =====================================================================

function buildShieldMask32(spec) {
  const size = 32;
  const mask = allocateMask(size);
  const shape = SHIELD_SHAPE_FNS_32[spec.archetype]();
  for (let y = 0; y < size; y++) {
    const r = shape.rows[y];
    if (!r) continue;
    for (let x = r.leftX; x <= r.rightX; x++) {
      maskSet(mask, size, x, y, 'body');
    }
  }
  return mask;
}

function buildShieldMask16(spec) {
  const size = 16;
  const mask = allocateMask(size);
  const shape = SHIELD_SHAPE_FNS_16[spec.archetype]();
  for (let y = 0; y < size; y++) {
    const r = shape.rows[y];
    if (!r) continue;
    for (let x = r.leftX; x <= r.rightX; x++) {
      maskSet(mask, size, x, y, 'body');
    }
  }
  return mask;
}

// =====================================================================
// Paint helpers (32×32)
// =====================================================================

function isShieldInterior32(mask, size, x, y) {
  if (maskGet(mask, size, x, y) !== 'body') return false;
  // 檢查是否為最外圈 (若任一 4-鄰居為 null, 則為外圈 outline, 非內部)
  if (maskGet(mask, size, x - 1, y) == null) return false;
  if (maskGet(mask, size, x + 1, y) == null) return false;
  if (maskGet(mask, size, x, y - 1) == null) return false;
  if (maskGet(mask, size, x, y + 1) == null) return false;
  return true;
}

/** 盾面立體感陰影與高光 */
function paintShieldShading32(ctx, mask, size, spec) {
  // 左上光照模型:
  // 右半部及下半部漸暗 (shieldShadow)
  // 左上內緣微光 (shieldShine)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!isShieldInterior32(mask, size, x, y)) continue;

      // 右半部陰影 (x > 18)
      if (x > 18) {
        ctx.fillStyle = spec.palette.shieldShadow;
        ctx.fillRect(x, y, 1, 1);
      }
      // 右下弧度陰影 (x > 16 且 y > 18)
      else if (x > 16 && y > 18) {
        ctx.fillStyle = spec.palette.shieldShadow;
        ctx.fillRect(x, y, 1, 1);
      }
      // 底端尖角/底緣陰影 (y >= 25)
      else if (y >= 25) {
        ctx.fillStyle = spec.palette.shieldShadow;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

/** 盾緣包邊 (Rim) */
function paintShieldRim32(ctx, mask, size, spec) {
  if (!spec.hasRim) return;

  // Rim 定義在緊鄰 outer outline 的內側第一圈
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!isShieldInterior32(mask, size, x, y)) continue;

      // 檢查此 interior cell 是否有任一 8-鄰居為 null (即緊鄰 outline)
      const isRimCell = (
        maskGet(mask, size, x - 1, y - 1) == null ||
        maskGet(mask, size, x,     y - 1) == null ||
        maskGet(mask, size, x + 1, y - 1) == null ||
        maskGet(mask, size, x - 1, y)     == null ||
        maskGet(mask, size, x + 1, y)     == null ||
        maskGet(mask, size, x - 1, y + 1) == null ||
        maskGet(mask, size, x,     y + 1) == null ||
        maskGet(mask, size, x + 1, y + 1) == null
      );

      if (isRimCell) {
        // 左上邊緣為高光, 右下邊緣為陰影
        if (x <= 16 && y <= 16) {
          ctx.fillStyle = spec.palette.shieldShine;
        } else {
          ctx.fillStyle = spec.palette.shieldShadow;
        }
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

/** 中脊線 (Spine) */
function paintShieldSpine32(ctx, mask, size, spec) {
  if (!spec.hasSpine) return;

  const cx = 16;
  // 中脊線從頂部內緣延伸到底部內緣
  for (let y = 0; y < size; y++) {
    if (!isShieldInterior32(mask, size, cx, y)) continue;
    // 左側 1 列高光, 右側 1 列陰影形成立體稜線
    if (isShieldInterior32(mask, size, cx - 1, y)) {
      ctx.fillStyle = spec.palette.shieldShine;
      ctx.fillRect(cx - 1, y, 1, 1);
    }
    ctx.fillStyle = spec.palette.shieldShadow;
    ctx.fillRect(cx, y, 1, 1);
  }
}

/** 中央盾心 (Boss / Emblem) */
function paintShieldBoss32(ctx, mask, size, spec) {
  const cx = 16;
  let cy = 16;
  if (spec.archetype === 'heater') cy = 13;
  else if (spec.archetype === 'tower') cy = 14;

  if (spec.bossStyle === 'round') {
    // 5×5 圓形盾臍 (Umbo)
    const bossCoords = [
      [cx - 1, cy - 2], [cx, cy - 2], [cx + 1, cy - 2],
      [cx - 2, cy - 1], [cx - 1, cy - 1], [cx, cy - 1], [cx + 1, cy - 1], [cx + 2, cy - 1],
      [cx - 2, cy],     [cx - 1, cy],     [cx, cy],     [cx + 1, cy],     [cx + 2, cy],
      [cx - 2, cy + 1], [cx - 1, cy + 1], [cx, cy + 1], [cx + 1, cy + 1], [cx + 2, cy + 1],
      [cx - 1, cy + 2], [cx, cy + 2], [cx + 1, cy + 2],
    ];

    // 底色: 陰影
    ctx.fillStyle = spec.palette.shieldShadow;
    for (const [x, y] of bossCoords) {
      if (isShieldInterior32(mask, size, x, y)) ctx.fillRect(x, y, 1, 1);
    }

    // 左上高光
    ctx.fillStyle = spec.palette.shieldShine;
    const shineCoords = [
      [cx - 1, cy - 2], [cx, cy - 2],
      [cx - 2, cy - 1], [cx - 1, cy - 1], [cx, cy - 1],
      [cx - 2, cy], [cx - 1, cy],
    ];
    for (const [x, y] of shineCoords) {
      if (isShieldInterior32(mask, size, x, y)) ctx.fillRect(x, y, 1, 1);
    }

    // 中心點主色
    if (isShieldInterior32(mask, size, cx, cy)) {
      ctx.fillStyle = spec.palette.shieldMain;
      ctx.fillRect(cx, cy, 1, 1);
    }
  } else if (spec.bossStyle === 'diamond') {
    // 菱形盾心
    const diamondRows = [
      { y: cy - 3, leftX: cx,     rightX: cx },
      { y: cy - 2, leftX: cx - 1, rightX: cx + 1 },
      { y: cy - 1, leftX: cx - 2, rightX: cx + 2 },
      { y: cy,     leftX: cx - 3, rightX: cx + 3 },
      { y: cy + 1, leftX: cx - 2, rightX: cx + 2 },
      { y: cy + 2, leftX: cx - 1, rightX: cx + 1 },
      { y: cy + 3, leftX: cx,     rightX: cx },
    ];

    // 底色
    ctx.fillStyle = spec.palette.shieldShadow;
    for (const r of diamondRows) {
      for (let x = r.leftX; x <= r.rightX; x++) {
        if (isShieldInterior32(mask, size, x, r.y)) ctx.fillRect(x, r.y, 1, 1);
      }
    }

    // 左上半面高光
    ctx.fillStyle = spec.palette.shieldShine;
    for (const r of diamondRows) {
      if (r.y <= cy) {
        for (let x = r.leftX; x <= cx; x++) {
          if (isShieldInterior32(mask, size, x, r.y)) ctx.fillRect(x, r.y, 1, 1);
        }
      }
    }
  } else if (spec.bossStyle === 'cross') {
    // 十字徽飾: 垂直臂 (寬 3) + 水平臂 (寬 3)
    // 垂直臂: cx-1..cx+1
    for (let y = 0; y < size; y++) {
      if (!isShieldInterior32(mask, size, cx, y)) continue;
      // 垂直臂底色
      ctx.fillStyle = spec.palette.shieldMain;
      for (let x = cx - 1; x <= cx + 1; x++) {
        if (isShieldInterior32(mask, size, x, y)) ctx.fillRect(x, y, 1, 1);
      }
      // 垂直臂左緣高光
      if (isShieldInterior32(mask, size, cx - 1, y)) {
        ctx.fillStyle = spec.palette.shieldShine;
        ctx.fillRect(cx - 1, y, 1, 1);
      }
      // 垂直臂右緣陰影
      if (isShieldInterior32(mask, size, cx + 1, y)) {
        ctx.fillStyle = spec.palette.shieldShadow;
        ctx.fillRect(cx + 1, y, 1, 1);
      }
    }

    // 水平臂: cy-1..cy+1
    for (let y = cy - 1; y <= cy + 1; y++) {
      for (let x = 0; x < size; x++) {
        if (!isShieldInterior32(mask, size, x, y)) continue;
        if (y === cy - 1) {
          ctx.fillStyle = spec.palette.shieldShine;
        } else if (y === cy + 1) {
          ctx.fillStyle = spec.palette.shieldShadow;
        } else {
          ctx.fillStyle = spec.palette.shieldMain;
        }
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

/** 鉚釘點綴 (Rivets) */
function paintShieldRivets32(ctx, mask, size, spec) {
  if (!spec.hasRivets) return;

  // 依 archetype 配置 4~6 個對稱鉚釘點
  let rivetCoords = [];
  if (spec.archetype === 'heater') {
    rivetCoords = [
      [9, 6],   [23, 6],   // 上緣雙角
      [9, 13],  [23, 13],  // 側翼轉折點
      [16, 25],            // 尖端上方
    ];
  } else if (spec.archetype === 'round') {
    rivetCoords = [
      [16, 8],  [16, 24],  // 上下
      [8, 16],  [24, 16],  // 左右
    ];
  } else if (spec.archetype === 'tower') {
    rivetCoords = [
      [9, 6],   [23, 6],   // 上部
      [9, 15],  [23, 15],  // 中部
      [9, 24],  [23, 24],  // 下部
    ];
  }

  for (const [x, y] of rivetCoords) {
    if (!isShieldInterior32(mask, size, x, y)) continue;
    // 鉚釘: 1px 高光 + 1px 陰影
    ctx.fillStyle = spec.palette.shieldShine;
    ctx.fillRect(x, y, 1, 1);
    if (isShieldInterior32(mask, size, x, y + 1)) {
      ctx.fillStyle = spec.palette.outline;
      ctx.fillRect(x, y + 1, 1, 1);
    }
  }
}

// =====================================================================
// Paint helpers (16×16)
// =====================================================================

function isShieldInterior16(mask, size, x, y) {
  if (maskGet(mask, size, x, y) !== 'body') return false;
  if (maskGet(mask, size, x - 1, y) == null) return false;
  if (maskGet(mask, size, x + 1, y) == null) return false;
  if (maskGet(mask, size, x, y - 1) == null) return false;
  if (maskGet(mask, size, x, y + 1) == null) return false;
  return true;
}

function paintShield16(ctx, mask, size, spec) {
  const cx = 8;
  let cy = 8;
  if (spec.archetype === 'heater') cy = 6;
  else if (spec.archetype === 'tower') cy = 7;

  // 1. 簡化立體陰影 (右側)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!isShieldInterior16(mask, size, x, y)) continue;
      if (x >= cx + 2 || (x > cx && y >= 9)) {
        ctx.fillStyle = spec.palette.shieldShadow;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  // 2. 簡化 Rim: 左上 1px 高光線
  if (spec.hasRim) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x <= cx; x++) {
        if (!isShieldInterior16(mask, size, x, y)) continue;
        if (maskGet(mask, size, x - 1, y - 1) == null || maskGet(mask, size, x, y - 1) == null) {
          ctx.fillStyle = spec.palette.shieldShine;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }

  // 3. 簡化 Boss
  if (spec.bossStyle === 'round') {
    // 3×3 菱字十字 boss
    const coords = [
      [cx, cy - 1],
      [cx - 1, cy], [cx, cy], [cx + 1, cy],
      [cx, cy + 1],
    ];
    ctx.fillStyle = spec.palette.shieldShadow;
    for (const [x, y] of coords) {
      if (isShieldInterior16(mask, size, x, y)) ctx.fillRect(x, y, 1, 1);
    }
    // 左上點為高光
    if (isShieldInterior16(mask, size, cx, cy)) {
      ctx.fillStyle = spec.palette.shieldShine;
      ctx.fillRect(cx, cy, 1, 1);
    }
  } else if (spec.bossStyle === 'diamond') {
    // 菱形
    const coords = [
      [cx, cy - 1],
      [cx - 1, cy], [cx, cy], [cx + 1, cy],
      [cx, cy + 1],
    ];
    ctx.fillStyle = spec.palette.shieldShadow;
    for (const [x, y] of coords) {
      if (isShieldInterior16(mask, size, x, y)) ctx.fillRect(x, y, 1, 1);
    }
    if (isShieldInterior16(mask, size, cx - 1, cy)) {
      ctx.fillStyle = spec.palette.shieldShine;
      ctx.fillRect(cx - 1, cy, 1, 1);
    }
  } else if (spec.bossStyle === 'cross') {
    // 十字紋
    for (let y = 0; y < size; y++) {
      if (isShieldInterior16(mask, size, cx, y)) {
        ctx.fillStyle = spec.palette.shieldShine;
        ctx.fillRect(cx, y, 1, 1);
      }
    }
    for (let x = 0; x < size; x++) {
      if (isShieldInterior16(mask, size, x, cy)) {
        ctx.fillStyle = spec.palette.shieldShadow;
        ctx.fillRect(x, cy, 1, 1);
      }
    }
  }
}

// =====================================================================
// Renderers — 純函式, 不含 RNG
// =====================================================================

function renderShieldSpec32(ctx, spec) {
  const size = 32;
  ctx.clearRect(0, 0, size, size);

  const mask = buildShieldMask32(spec);

  // Step 1: 塗平盾面主色
  paintMaskByEnum(ctx, mask, size, {
    body: spec.palette.shieldMain,
  });

  // Step 2: 盾面陰影層次
  paintShieldShading32(ctx, mask, size, spec);

  // Step 3: 盾緣包邊 (Rim)
  paintShieldRim32(ctx, mask, size, spec);

  // Step 4: 中脊線 (Spine)
  paintShieldSpine32(ctx, mask, size, spec);

  // Step 5: 中央盾心 (Boss / Emblem)
  paintShieldBoss32(ctx, mask, size, spec);

  // Step 6: 鉚釘 (Rivets)
  paintShieldRivets32(ctx, mask, size, spec);

  // Step 7: 外圍連續 Outline
  applyInsideOutlinePass(ctx, mask, size, spec.palette.outline);
}

function renderShieldSpec16(ctx, spec) {
  const size = 16;
  ctx.clearRect(0, 0, size, size);

  const mask = buildShieldMask16(spec);

  // Step 1: 塗平主色
  paintMaskByEnum(ctx, mask, size, {
    body: spec.palette.shieldMain,
  });

  // Step 2: 16×16 簡化裝飾層次
  paintShield16(ctx, mask, size, spec);

  // Step 3: 外圍連續 Outline
  applyInsideOutlinePass(ctx, mask, size, spec.palette.outline);
}

// =====================================================================
// 對外: drawShield(ctx, rng, size)
// =====================================================================

function drawShield(ctx, rng, size) {
  const spec = sampleShieldSpec(rng);
  if (size === 32) {
    renderShieldSpec32(ctx, spec);
  } else if (size === 16) {
    renderShieldSpec16(ctx, spec);
  }
}

window.sampleShieldSpec = sampleShieldSpec;
window.renderShieldSpec32 = renderShieldSpec32;
window.renderShieldSpec16 = renderShieldSpec16;
window.drawShield = drawShield;
