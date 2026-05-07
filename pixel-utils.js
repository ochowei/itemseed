// pixel-utils.js
// 像素級工具:fillRect、enum mask helpers、inside-edge outline pass、internal seam pass。

/** 整數 fillRect(從 main.js 搬來,集中工具) */
function fillRect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/**
 * 建立 size×size 的 enum mask(扁平陣列,長度 size*size,index = y*size + x)。
 * 初始全為 null(代表透明/圖示外部)。
 */
function allocateMask(size) {
  const m = new Array(size * size);
  for (let i = 0; i < m.length; i++) m[i] = null;
  return m;
}

function maskGet(mask, size, x, y) {
  if (x < 0 || y < 0 || x >= size || y >= size) return null;
  return mask[y * size + x];
}

function maskSet(mask, size, x, y, v) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  mask[y * size + x] = v;
}

/**
 * 依照 mask 把每個非 null cell 用對應顏色填到 ctx 上。
 * @param colorByEnum  {[enumValue]: '#RRGGBB'} — 沒出現的 enum 不畫。
 */
function paintMaskByEnum(ctx, mask, size, colorByEnum) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = mask[y * size + x];
      if (v == null) continue;
      const color = colorByEnum[v];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

/**
 * Inside-edge outline pass:
 * 找出所有「自己非 null,且至少一個 4-鄰居是 null」的 mask cell,
 * 在 canvas 上把它塗成 outlineColor。
 * 不修改 mask(避免影響後續 seam pass)。
 *
 * @returns 修改的 cell 數(debug 用)
 */
function applyInsideOutlinePass(ctx, mask, size, outlineColor) {
  let count = 0;
  ctx.fillStyle = outlineColor;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (mask[y * size + x] == null) continue;
      const up    = maskGet(mask, size, x,     y - 1);
      const down  = maskGet(mask, size, x,     y + 1);
      const left  = maskGet(mask, size, x - 1, y);
      const right = maskGet(mask, size, x + 1, y);
      if (up == null || down == null || left == null || right == null) {
        ctx.fillRect(x, y, 1, 1);
        count++;
      }
    }
  }
  return count;
}

/**
 * Internal seam pass:
 * 找出所有「自己非 null,且至少一個 4-鄰居有不同的非 null 標籤」的 cell,
 * 塗成 outlineColor。讓元件之間的接縫也有描邊(例如瓶塞/瓶頸交界)。
 *
 * 注意:呼叫順序應在 inside-edge pass 之前(否則被 outline 改寫的 cell 會干擾判斷)。
 * 但因為兩個 pass 都讀 mask、寫 canvas,mask 本身不變,所以順序其實不影響結果 —
 * 我們選擇「seam pass 在 outline pass 之前」純為語意清楚。
 */
function paintInternalSeams(ctx, mask, size, outlineColor) {
  ctx.fillStyle = outlineColor;
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
      for (const n of neighbors) {
        if (n != null && n !== self) {
          ctx.fillRect(x, y, 1, 1);
          break;
        }
      }
    }
  }
}

window.fillRect = fillRect;
window.allocateMask = allocateMask;
window.maskGet = maskGet;
window.maskSet = maskSet;
window.paintMaskByEnum = paintMaskByEnum;
window.applyInsideOutlinePass = applyInsideOutlinePass;
window.paintInternalSeams = paintInternalSeams;
