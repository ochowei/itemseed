// potion.js
// 兩階段架構:samplePotionSpec(rng) → spec → renderPotionSpec32/16(ctx, spec)。
// 此檔最後 export 一個對外 drawPotion(ctx, rng, size) 給 main.js 用。

// =====================================================================
// Sampler — 把所有 RNG 集中於此,輸出純資料 spec
// =====================================================================

const SHAPE_NAMES = ['flask', 'round', 'vial'];
const SHAPE_WEIGHTS = [3, 2, 1.5];
const CAP_TYPES = ['cork', 'wax_seal', 'cloth_tied'];

function samplePotionSpec(rng) {
  const { family, palette } = samplePalette(rng);
  const shape = rng.pickWeighted(SHAPE_NAMES, SHAPE_WEIGHTS);
  const capType = rng.pick(CAP_TYPES);
  const liquidLevel = rng.randomFloat(0.4, 0.95);
  const hasBubbles = rng.chance(0.35);
  const hasSediment = rng.chance(0.25);
  // vial 太細放不下標籤
  const hasLabel = (shape !== 'vial') && rng.chance(0.30);

  // 在 sample 階段就決定 bubble 與 label 點位,確保 render 是純函式。
  // 這裡用「邏輯座標 in [0,1] × [0,1]」,render 階段再 map 到實際 pixel。
  const bubbles = [];
  if (hasBubbles) {
    const n = rng.randomInt(2, 4);
    for (let i = 0; i < n; i++) {
      bubbles.push([rng.randomFloat(0.2, 0.8), rng.randomFloat(0.2, 0.8)]);
    }
  }

  const labelDots = [];
  if (hasLabel) {
    const n = rng.randomInt(2, 3);
    for (let i = 0; i < n; i++) {
      labelDots.push([rng.randomFloat(0.15, 0.85), rng.randomFloat(0, 1)]);
    }
  }

  return {
    family,
    palette,
    shape,
    capType,
    liquidLevel,
    hasBubbles,
    hasSediment,
    hasLabel,
    bubbles,
    labelDots,
  };
}

// =====================================================================
// Shape silhouette functions (32×32)
//
// 每個 shape 是一個 (size: 32) → { rows: Array<{leftX, rightX, kind} | null> }
// rows[y] 描述第 y 列被瓶子覆蓋的範圍。kind 分 'body' | 'neck' | null。
// 整張圖示置中。
// 注意:這裡定義的是「未咬掉外圍 outline 之前」的 silhouette;
//        outline pass 會吃掉外圈 1px。
// =====================================================================

function shapeFlask32() {
  // 瓶身:y=8..29(身高 22),底寬 16 → 頂部頸接處寬約 6
  // 頸:  y=4..7  (頸高 4),寬 5
  const rows = new Array(32).fill(null);
  const cx = 16;
  // 頸
  for (let y = 4; y <= 7; y++) {
    rows[y] = { leftX: cx - 2, rightX: cx + 2, kind: 'neck' };
  }
  // 瓶身:從 y=8 (寬 6) 線性增寬到 y=29 (寬 16)
  for (let y = 8; y <= 29; y++) {
    const t = (y - 8) / (29 - 8);   // 0..1
    const halfW = Math.round(3 + t * 5);  // 3 → 8
    rows[y] = { leftX: cx - halfW, rightX: cx + halfW, kind: 'body' };
  }
  return { rows };
}

function shapeRound32() {
  // 圓 ⌀17(對稱寬度),圓心 (16, 21);頸延伸到 y=13 與圓無縫銜接。
  const rows = new Array(32).fill(null);
  const cx = 16, cy = 21, r = 8;
  // 頸:y=4..13(末端 y=13 確保與圓的第一可見列銜接,無縫)
  for (let y = 4; y <= 13; y++) {
    rows[y] = { leftX: cx - 2, rightX: cx + 2, kind: 'neck' };
  }
  // 圓:y=14..28(略過 pole rows where dx=0;對稱寬度公式)
  for (let y = 14; y <= 28; y++) {
    const dy = y - cy;
    const dx = Math.floor(Math.sqrt(r * r - dy * dy));
    if (dx < 1) continue;  // skip degenerate pole rows
    rows[y] = { leftX: cx - dx, rightX: cx + dx, kind: 'body' };
  }
  return { rows };
}

function shapeVial32() {
  // 整身寬 7(cx-3..cx+3),頸寬 5;直筒
  // 頸:y=4..7,身:y=8..29
  const rows = new Array(32).fill(null);
  const cx = 16;
  for (let y = 4; y <= 7; y++) {
    rows[y] = { leftX: cx - 2, rightX: cx + 2, kind: 'neck' };
  }
  for (let y = 8; y <= 29; y++) {
    rows[y] = { leftX: cx - 3, rightX: cx + 3, kind: 'body' };
  }
  return { rows };
}

const SHAPE_FNS_32 = {
  flask: shapeFlask32,
  round: shapeRound32,
  vial:  shapeVial32,
};

// =====================================================================
// Shape silhouette functions (16×16) — 子集,專為 16 解析度重新設計
// =====================================================================

function shapeFlask16() {
  // 窄頸 + 1 列肩過渡 + 寬均勻身。
  // 為了讓低液面時瓶子不會「液面比下面身體窄」而看起來怪,
  // body 主體採用固定寬度 7,只在 y=4 留一列寬度 5 當作肩線。
  const rows = new Array(16).fill(null);
  const cx = 8;
  // 頸:y=2..3 width 3
  for (let y = 2; y <= 3; y++) {
    rows[y] = { leftX: cx - 1, rightX: cx + 1, kind: 'neck' };
  }
  // 肩:y=4 width 5(1 列過渡)
  rows[4] = { leftX: cx - 2, rightX: cx + 2, kind: 'body' };
  // 身:y=5..14 width 7
  for (let y = 5; y <= 14; y++) {
    rows[y] = { leftX: cx - 3, rightX: cx + 3, kind: 'body' };
  }
  return { rows };
}

function shapeRound16() {
  // ⌀8 圓 + 2px 頸
  const rows = new Array(16).fill(null);
  const cx = 8, cy = 11, r = 4;
  for (let y = 2; y <= 7; y++) {
    rows[y] = { leftX: cx - 1, rightX: cx + 1, kind: 'neck' };
  }
  for (let y = cy - r; y <= cy + r; y++) {
    if (y < 7) continue;
    const dy = y - cy;
    const dx = Math.floor(Math.sqrt(r * r - dy * dy));
    if (dx < 1) continue;
    rows[y] = { leftX: cx - dx, rightX: cx + dx, kind: 'body' };
  }
  return { rows };
}

function shapeVial16() {
  // 寬 4,頸寬 2,直筒
  const rows = new Array(16).fill(null);
  const cx = 8;
  for (let y = 2; y <= 3; y++) {
    rows[y] = { leftX: cx - 1, rightX: cx + 1, kind: 'neck' };
  }
  for (let y = 4; y <= 14; y++) {
    rows[y] = { leftX: cx - 2, rightX: cx + 2, kind: 'body' };
  }
  return { rows };
}

const SHAPE_FNS_16 = {
  flask: shapeFlask16,
  round: shapeRound16,
  vial:  shapeVial16,
};

/**
 * 把 spec 的 shape 轉成 32x32 enum mask。
 * 此版本只標 'glass'(瓶身玻璃)— Task 6 會再覆蓋 'liquid'、'cap' 等。
 */
function buildSilhouetteMask32(spec) {
  const size = 32;
  const mask = allocateMask(size);
  const shape = SHAPE_FNS_32[spec.shape]();

  // 計算 body 的 y 範圍(只有 body 內裝液體,neck 不裝)
  let bodyTop = -1, bodyBottom = -1;
  for (let y = 0; y < size; y++) {
    const r = shape.rows[y];
    if (r && r.kind === 'body') {
      if (bodyTop === -1) bodyTop = y;
      bodyBottom = y;
    }
  }
  // 液面 y(從 bodyBottom 往上算 liquidLevel 比例)
  const bodyHeight = bodyBottom - bodyTop + 1;
  const liquidPx = Math.floor(bodyHeight * spec.liquidLevel);
  const liquidTopY = bodyBottom - liquidPx + 1;

  for (let y = 0; y < size; y++) {
    const r = shape.rows[y];
    if (!r) continue;
    for (let x = r.leftX; x <= r.rightX; x++) {
      // body 區內、且在液面以下 → liquid;否則 → glass
      if (r.kind === 'body' && y >= liquidTopY) {
        maskSet(mask, size, x, y, 'liquid');
      } else {
        maskSet(mask, size, x, y, 'glass');
      }
    }
  }

  // 瓶塞:覆蓋 neck 最上面 2~3 列、寬度 = neck 寬 + 1(蓋住瓶口)
  let neckTop = -1;
  for (let y = 0; y < size; y++) {
    if (shape.rows[y] && shape.rows[y].kind === 'neck') { neckTop = y; break; }
  }
  if (neckTop >= 0) {
    const neckRow = shape.rows[neckTop];
    const capH = (spec.capType === 'cork') ? 3 : 2;
    const extraW = 1;  // 蓋住瓶口外 1px
    const capLeft  = neckRow.leftX  - extraW;
    const capRight = neckRow.rightX + extraW;
    // cap 從 neckTop - capH + 1 .. neckTop(蓋進瓶頸頂端)
    for (let y = neckTop - capH + 1; y <= neckTop; y++) {
      for (let x = capLeft; x <= capRight; x++) {
        if (y < 0 || y >= size || x < 0 || x >= size) continue;
        maskSet(mask, size, x, y, 'cap');
      }
    }
    // wax_seal 額外加 1px 蠟滴(瓶頸兩側往下 1~2px)
    if (spec.capType === 'wax_seal') {
      const dripLen = 1 + ((spec.shape.length + spec.family.length) % 2);
      for (let dy = 1; dy <= dripLen; dy++) {
        const y = neckTop + dy;
        if (y >= size) break;
        maskSet(mask, size, neckRow.leftX  - 1, y, 'cap');
        maskSet(mask, size, neckRow.rightX + 1, y, 'cap');
      }
    }
    // cloth_tied 額外 1px 繩結:在 neckTop + 1 列、繞瓶頸一圈
    if (spec.capType === 'cloth_tied') {
      const ropeY = neckTop + 1;
      if (ropeY < size) {
        for (let x = neckRow.leftX; x <= neckRow.rightX; x++) {
          maskSet(mask, size, x, ropeY, 'cap');
        }
      }
    }
  }

  return mask;
}

function buildSilhouetteMask16(spec) {
  const size = 16;
  const mask = allocateMask(size);
  const shape = SHAPE_FNS_16[spec.shape]();

  let bodyTop = -1, bodyBottom = -1;
  for (let y = 0; y < size; y++) {
    const r = shape.rows[y];
    if (r && r.kind === 'body') {
      if (bodyTop === -1) bodyTop = y;
      bodyBottom = y;
    }
  }
  const bodyHeight = bodyBottom - bodyTop + 1;
  const liquidPx = Math.floor(bodyHeight * spec.liquidLevel);
  const liquidTopY = bodyBottom - liquidPx + 1;

  for (let y = 0; y < size; y++) {
    const r = shape.rows[y];
    if (!r) continue;
    for (let x = r.leftX; x <= r.rightX; x++) {
      if (r.kind === 'body' && y >= liquidTopY) {
        maskSet(mask, size, x, y, 'liquid');
      } else {
        maskSet(mask, size, x, y, 'glass');
      }
    }
  }

  // cap:1px 高,extraW=1
  let neckTop = -1;
  for (let y = 0; y < size; y++) {
    if (shape.rows[y] && shape.rows[y].kind === 'neck') { neckTop = y; break; }
  }
  if (neckTop >= 0) {
    const neckRow = shape.rows[neckTop];
    const capLeft  = neckRow.leftX  - 1;
    const capRight = neckRow.rightX + 1;
    const capY = neckTop - 1;
    if (capY >= 0) {
      for (let x = capLeft; x <= capRight; x++) {
        if (x < 0 || x >= size) continue;
        maskSet(mask, size, x, capY, 'cap');
      }
    }
    // cloth_tied:額外 1px 繩結(neckTop 列)
    if (spec.capType === 'cloth_tied') {
      for (let x = neckRow.leftX; x <= neckRow.rightX; x++) {
        maskSet(mask, size, x, neckTop, 'cap');
      }
    }
  }

  return mask;
}

// =====================================================================
// Renderer — 純函式,不再使用 RNG;Task 4+ 補完
// =====================================================================

/**
 * Potion-specific seam pass: like paintInternalSeams from pixel-utils,
 * but ALWAYS skips the glass/liquid boundary (the liquid surface line).
 * Reason: 2026-05-07 user 決定不要 surface seam,液面用色差區分即可。
 * Cap/glass and other internal boundaries still get the seam.
 */
function paintPotionSeams(ctx, mask, size, spec) {
  ctx.fillStyle = spec.palette.outline;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const self = mask[y * size + x];
      if (self == null) continue;
      const neighbors = [
        maskGet(mask, size, x,     y - 1),
        maskGet(mask, size, x,     y + 1),
        maskGet(mask, size, x - 1, y),
        maskGet(mask, size, x + 1, y),
      ];
      let shouldPaint = false;
      for (const n of neighbors) {
        if (n == null || n === self) continue;
        // 永遠 skip 液面分隔線(glass↔liquid)
        if ((self === 'glass' && n === 'liquid') || (self === 'liquid' && n === 'glass')) {
          continue;
        }
        shouldPaint = true;
        break;
      }
      if (shouldPaint) ctx.fillRect(x, y, 1, 1);
    }
  }
}

function renderPotionSpec32(ctx, spec) {
  const size = 32;
  ctx.clearRect(0, 0, size, size);

  const mask = buildSilhouetteMask32(spec);

  const capColor = capColorFor(spec);
  paintMaskByEnum(ctx, mask, size, {
    glass: spec.palette.glassBody,
    liquid: spec.palette.liquidMain,
    cap: capColor,
  });

  if (spec.capType === 'cloth_tied') {
    repaintRopeRow(ctx, mask, size, spec);
  }

  if (spec.hasSediment) {
    paintSediment32(ctx, mask, size, spec);
  }

  // 玻璃 shine 渲染已停用(2026-05-07 user 決定不要)。重新啟用:把下面這行的註解移除。
  // paintHighlight32(ctx, mask, size, spec);

  if (spec.hasBubbles) {
    paintBubbles32(ctx, mask, size, spec);
  }

  // 標籤渲染已停用(2026-05-07 user 決定不要)。重新啟用:把下面三行的註解移除。
  // if (spec.hasLabel) {
  //   paintLabel32(ctx, mask, size, spec);
  // }

  // 先畫 internal seams,再畫外圈 outline
  paintPotionSeams(ctx, mask, size, spec);
  applyInsideOutlinePass(ctx, mask, size, spec.palette.outline);
}

/** 依 capType 決定 cap 主色 */
function capColorFor(spec) {
  if (spec.capType === 'cork')       return CORK_PALETTE.main;
  if (spec.capType === 'wax_seal')   return spec.palette.liquidMain;
  if (spec.capType === 'cloth_tied') return spec.palette.highlight;
  return spec.palette.outline;
}

function repaintRopeRow(ctx, mask, size, spec) {
  // 找 neck top
  const shape = SHAPE_FNS_32[spec.shape]();
  let neckTop = -1;
  for (let y = 0; y < size; y++) {
    if (shape.rows[y] && shape.rows[y].kind === 'neck') { neckTop = y; break; }
  }
  if (neckTop < 0) return;
  const ropeY = neckTop + 1;
  if (ropeY >= size) return;
  ctx.fillStyle = spec.palette.outline;
  const r = shape.rows[neckTop];
  for (let x = r.leftX; x <= r.rightX; x++) {
    if (mask[ropeY * size + x] === 'cap') {
      ctx.fillRect(x, ropeY, 1, 1);
    }
  }
}

/**
 * 玻璃左側固定光帶。長度依 shape 不同:
 *   flask 沿斜邊 4~5px、round 沿弧線左上 3~4px、vial 中段 5~6px。
 * 高光只畫在 'glass' 區。
 */
function paintHighlight32(ctx, mask, size, spec) {
  ctx.fillStyle = spec.palette.glassShine;

  if (spec.shape === 'vial') {
    for (let y = 16; y <= 20; y++) {
      tryPaintHighlightCell(ctx, mask, size, 14, y);
    }
    return;
  }

  if (spec.shape === 'round') {
    tryPaintHighlightCell(ctx, mask, size, 11, 15);
    tryPaintHighlightCell(ctx, mask, size, 10, 16);
    tryPaintHighlightCell(ctx, mask, size, 10, 17);
    tryPaintHighlightCell(ctx, mask, size, 11, 18);
    return;
  }

  // flask:斜邊上 4~5 個 cell;從 (12, 11) 沿斜邊往左下,每 2 列往左 1 px
  let x = 12;
  for (let y = 11; y <= 15; y++) {
    tryPaintHighlightCell(ctx, mask, size, x, y);
    if ((y - 11) % 2 === 1) x -= 1;
  }
}

/** 只在該 cell 為 'glass' 時才塗(避免蓋到 liquid / cap) */
function tryPaintHighlightCell(ctx, mask, size, x, y) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  if (mask[y * size + x] !== 'glass') return;
  ctx.fillRect(x, y, 1, 1);
}

function paintBubbles32(ctx, mask, size, spec) {
  ctx.fillStyle = spec.palette.highlight;
  // 找 liquid bounding box
  let minX = size, minY = size, maxX = -1, maxY = -1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (mask[y * size + x] === 'liquid') {
        if (x < minX) minX = x; if (y < minY) minY = y;
        if (x > maxX) maxX = x; if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return;
  const w = maxX - minX + 1, h = maxY - minY + 1;
  for (const [u, v] of spec.bubbles) {
    const x = minX + Math.floor(u * w);
    const y = minY + Math.floor(v * h);
    // 安全邊距:遠離液面(避免泡泡跑到 seam 線附近、或跑出液體區)
    if (y - minY < 2) continue;
    // 只在 liquid cell 上畫,避免畫到 sediment(會看不出來)/ glass / 外面
    if (mask[y * size + x] === 'liquid') {
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function paintLabel32(ctx, mask, size, spec) {
  // 在 body 中段橫向貼一條 1~2px 高色帶。color = outline,點綴 = highlight。
  let bodyTop = -1, bodyBottom = -1;
  for (let y = 0; y < size; y++) {
    const v = mask[y * size + 16];  // 中軸樣本
    if (v === 'glass' || v === 'liquid') {
      if (bodyTop === -1) bodyTop = y;
      bodyBottom = y;
    }
  }
  if (bodyTop < 0) return;
  const labelY = Math.floor((bodyTop + bodyBottom) / 2);
  const labelH = 2;

  function rowRange(y) {
    let l = -1, r = -1;
    for (let x = 0; x < size; x++) {
      if (mask[y * size + x] != null && mask[y * size + x] !== 'cap') {
        if (l === -1) l = x;
        r = x;
      }
    }
    return [l, r];
  }

  ctx.fillStyle = spec.palette.outline;
  for (let y = labelY; y < labelY + labelH; y++) {
    const [l, r] = rowRange(y);
    if (l < 0) continue;
    // 標籤往內縮 1px,別貼到外圈 outline
    for (let x = l + 1; x < r; x++) {
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // 點綴(模擬字),用 highlight 色,在 labelY (上半 row)
  ctx.fillStyle = spec.palette.highlight;
  const [l, r] = rowRange(labelY);
  if (l < 0) return;
  const w = r - l - 1;  // 內縮後的寬度
  for (const [u] of spec.labelDots) {
    const x = l + 1 + Math.floor(u * w);
    if (mask[labelY * size + x] != null && mask[labelY * size + x] !== 'cap') {
      ctx.fillRect(x, labelY, 1, 1);
    }
  }
}

function paintSediment32(ctx, mask, size, spec) {
  // 找到所有 'liquid' cell 的 maxY
  let maxY = -1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (mask[y * size + x] === 'liquid' && y > maxY) maxY = y;
    }
  }
  if (maxY < 0) return;
  // 沉澱厚度:用 spec 內 deterministic 來源算出 2 或 3 列
  const thickness = 2 + ((spec.bubbles.length + spec.shape.length) % 2);
  ctx.fillStyle = spec.palette.liquidShadow;
  for (let y = maxY - thickness + 1; y <= maxY; y++) {
    for (let x = 0; x < size; x++) {
      if (mask[y * size + x] === 'liquid') {
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

function renderPotionSpec16(ctx, spec) {
  const size = 16;
  ctx.clearRect(0, 0, size, size);

  const mask = buildSilhouetteMask16(spec);

  const capColor = capColorFor(spec);
  paintMaskByEnum(ctx, mask, size, {
    glass: spec.palette.glassBody,
    liquid: spec.palette.liquidMain,
    cap: capColor,
  });

  // cloth_tied 繩結:把 neckTop 那列改寫 outline
  if (spec.capType === 'cloth_tied') {
    const shape = SHAPE_FNS_16[spec.shape]();
    let neckTop = -1;
    for (let y = 0; y < size; y++) {
      if (shape.rows[y] && shape.rows[y].kind === 'neck') { neckTop = y; break; }
    }
    if (neckTop >= 0) {
      ctx.fillStyle = spec.palette.outline;
      const r = shape.rows[neckTop];
      for (let x = r.leftX; x <= r.rightX; x++) {
        if (mask[neckTop * size + x] === 'cap') {
          ctx.fillRect(x, neckTop, 1, 1);
        }
      }
    }
  }

  // 玻璃 shine 渲染已停用(2026-05-07 user 決定不要)。重新啟用:把下面整段反註解。
  // ctx.fillStyle = spec.palette.glassShine;
  // if (spec.shape === 'vial') {
  //   if (mask[8 * size + 7] === 'glass') ctx.fillRect(7, 8, 1, 1);
  //   if (mask[9 * size + 7] === 'glass') ctx.fillRect(7, 9, 1, 1);
  // } else if (spec.shape === 'round') {
  //   if (mask[9 * size + 6] === 'glass') ctx.fillRect(6, 9, 1, 1);
  // } else {
  //   // flask
  //   if (mask[6 * size + 7] === 'glass') ctx.fillRect(7, 6, 1, 1);
  //   if (mask[7 * size + 7] === 'glass') ctx.fillRect(7, 7, 1, 1);
  // }

  paintPotionSeams(ctx, mask, size, spec);
  applyInsideOutlinePass(ctx, mask, size, spec.palette.outline);
}

// =====================================================================
// 對外:drawPotion(ctx, rng, size) — main.js 透過全域 drawPotion 拿到
// =====================================================================

function drawPotion(ctx, rng, size) {
  const spec = samplePotionSpec(rng);
  if (size === 32) renderPotionSpec32(ctx, spec);
  else if (size === 16) renderPotionSpec16(ctx, spec);
}

window.samplePotionSpec = samplePotionSpec;
window.renderPotionSpec32 = renderPotionSpec32;
window.renderPotionSpec16 = renderPotionSpec16;
window.drawPotion = drawPotion;
