// main.js
// 主程式:綁定 UI、管理畫布、呼叫對應的繪圖函式。

// =============================================================
// 取得 DOM 元素
// =============================================================
const seedInput = document.getElementById('seed-input');
const typeSelect = document.getElementById('type-select');
const sizeSelect = document.getElementById('size-select');
const generateBtn = document.getElementById('generate-btn');
const downloadBtn = document.getElementById('download-btn');
const rerollSeedBtn = document.getElementById('reroll-seed-btn');
const previewCanvas = document.getElementById('preview-canvas');
const gridContainer = document.getElementById('grid-container');

// 兩個 canvas:
// - offscreenCanvas:實際大小(16 或 32),用來真正畫圖示與輸出 PNG
// - previewCanvas:放大顯示給使用者看的(像素感保持)
let offscreenCanvas = document.createElement('canvas');
let offscreenCtx = offscreenCanvas.getContext('2d');

const previewCtx = previewCanvas.getContext('2d');
previewCtx.imageSmoothingEnabled = false;

// =============================================================
// 物品類型登記表
// 之後新增物品(盾、戒指、書...)在這裡多加一行就好
// =============================================================
const ITEM_TYPES = {
  potion: drawPotion,
  sword: drawSword,
  spear: drawSpear,
};

// =============================================================
// 主流程
// =============================================================
function generate() {
  // 1. 取得設定
  let seed = seedInput.value.trim();
  if (!seed) {
    seed = generateRandomSeed();
    seedInput.value = seed;
  }
  const size = parseInt(sizeSelect.value, 10);
  let type = typeSelect.value;

  // 2. 建立 PRNG
  const rng = new SeededRandom(seed);

  // 3. 如果選 any,再隨機選一個類型
  if (type === 'any') {
    const types = Object.keys(ITEM_TYPES);
    type = rng.pick(types);
  }

  // 4. 設定離屏 canvas 大小並清空(透明背景)
  offscreenCanvas.width = size;
  offscreenCanvas.height = size;
  offscreenCtx.clearRect(0, 0, size, size);

  // 5. 呼叫對應的繪圖函式
  const drawFn = ITEM_TYPES[type];
  drawFn(offscreenCtx, rng, size);

  // 6. 放大顯示在 preview canvas 上
  renderPreview();
}

function renderPreview() {
  const targetSize = previewCanvas.width; // 例如 384
  previewCtx.imageSmoothingEnabled = false;
  previewCtx.clearRect(0, 0, targetSize, targetSize);
  previewCtx.drawImage(offscreenCanvas, 0, 0, targetSize, targetSize);
}

function downloadPNG() {
  const seed = seedInput.value.trim() || 'icon';
  const safeSeed = seed.replace(/[^a-z0-9_-]+/gi, '_');
  const link = document.createElement('a');
  link.download = `icon_${safeSeed}.png`;
  link.href = offscreenCanvas.toDataURL('image/png');
  link.click();
}

// =============================================================
// 批次預覽:一次產 24 張不同種子的圖示
// =============================================================
function renderBatchGrid() {
  gridContainer.innerHTML = '';
  const size = parseInt(sizeSelect.value, 10);
  const baseSeed = seedInput.value.trim() || generateRandomSeed();
  let type = typeSelect.value;

  for (let i = 0; i < 24; i++) {
    const cellSeed = `${baseSeed}-${i}`;
    const rng = new SeededRandom(cellSeed);

    let cellType = type;
    if (cellType === 'any') {
      cellType = rng.pick(Object.keys(ITEM_TYPES));
    }

    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    c.title = cellSeed;
    const cx = c.getContext('2d');
    ITEM_TYPES[cellType](cx, rng, size);

    // 包一層方便顯示
    const wrap = document.createElement('div');
    wrap.className = 'grid-cell';
    wrap.appendChild(c);
    wrap.addEventListener('click', () => {
      seedInput.value = cellSeed;
      typeSelect.value = cellType;
      generate();
    });
    gridContainer.appendChild(wrap);
  }
}

// =============================================================
// 繪圖函式 stub —— 第二步再來填充細節
// 目前先畫個簡單的色塊讓整個流程能跑起來
// =============================================================

function drawSpear(ctx, rng, size) {
  // 暫時的占位:中央畫一支長矛
  const headColors = ['#d8d8e8', '#c8b070', '#a8a0c8'];
  const head = rng.pick(headColors);
  const cx = Math.floor(size / 2);

  // 矛頭(三角形)
  fillRect(ctx, cx, 1, 1, 1, '#1a1a2e');
  fillRect(ctx, cx - 1, 2, 3, 1, head);
  fillRect(ctx, cx - 1, 3, 3, 1, head);
  fillRect(ctx, cx - 2, 4, 5, 1, head);
  fillRect(ctx, cx - 2, 5, 5, 1, head);
  fillRect(ctx, cx - 1, 6, 3, 1, head);
  // 矛頭描邊
  fillRect(ctx, cx - 2, 2, 1, 3, '#1a1a2e');
  fillRect(ctx, cx + 2, 2, 1, 3, '#1a1a2e');
  fillRect(ctx, cx - 3, 4, 1, 2, '#1a1a2e');
  fillRect(ctx, cx + 3, 4, 1, 2, '#1a1a2e');

  // 桿身
  fillRect(ctx, cx, 7, 1, size - 9, '#7a4a2e');
  fillRect(ctx, cx - 1, 7, 1, size - 9, '#4a2a1e');

  // 末端
  fillRect(ctx, cx - 1, size - 2, 2, 1, '#3a2a1e');
}

// =============================================================
// 事件綁定
// =============================================================
generateBtn.addEventListener('click', () => {
  generate();
  renderBatchGrid();
});

downloadBtn.addEventListener('click', downloadPNG);

rerollSeedBtn.addEventListener('click', () => {
  seedInput.value = generateRandomSeed();
  generate();
  renderBatchGrid();
});

seedInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') generate();
});

[typeSelect, sizeSelect].forEach((el) => {
  el.addEventListener('change', () => {
    generate();
    renderBatchGrid();
  });
});

// =============================================================
// 啟動
// =============================================================
seedInput.value = generateRandomSeed();
generate();
renderBatchGrid();
