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
let offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });

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
  shield: drawShield,
  staff: drawStaff,
};

// =============================================================
// 解析物品類型
// 如果選擇 'any'，使用獨立的 PRNG (以 seed + ':type' 為種子) 抽取種類，
// 避免消耗繪圖 PRNG 序列，確保繪圖函式永遠取得步數為 0 的初始 PRNG。
// =============================================================
function resolveItemType(type, seed) {
  if (type !== 'any') return type;
  const typeRng = new SeededRandom(`${seed}:type`);
  return typeRng.pick(Object.keys(ITEM_TYPES));
}

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
  const type = resolveItemType(typeSelect.value, seed);

  // 2. 建立繪圖 PRNG (保持在未被消耗的初始狀態)
  const rng = new SeededRandom(seed);

  // 3. 設定離屏 canvas 大小並清空(透明背景)
  offscreenCanvas.width = size;
  offscreenCanvas.height = size;
  offscreenCtx.clearRect(0, 0, size, size);

  // 4. 呼叫對應的繪圖函式
  const drawFn = ITEM_TYPES[type];
  drawFn(offscreenCtx, rng, size);

  // 5. 放大顯示在 preview canvas 上
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
  const selectedType = typeSelect.value;

  for (let i = 0; i < 24; i++) {
    const cellSeed = `${baseSeed}-${i}`;
    const cellType = resolveItemType(selectedType, cellSeed);
    const rng = new SeededRandom(cellSeed);

    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    c.title = cellSeed;
    const cx = c.getContext('2d', { willReadFrequently: true });
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
THEME.init();
I18N.init();
seedInput.value = generateRandomSeed();
generate();
renderBatchGrid();

// =============================================================
// i18n dropdown
// =============================================================
const langSelect = document.getElementById('lang-select');
langSelect.value = I18N.getLang();
langSelect.addEventListener('change', (e) => {
  I18N.setLang(e.target.value);
});

// =============================================================
// theme dropdown
// =============================================================
const themeSelect = document.getElementById('theme-select');
themeSelect.value = THEME.getSetting();
themeSelect.addEventListener('change', (e) => {
  THEME.setTheme(e.target.value);
});

// =============================================================
// 暴露給測試或除錯使用
// =============================================================
window.ITEM_TYPES = ITEM_TYPES;
window.resolveItemType = resolveItemType;
window.offscreenCanvas = offscreenCanvas;

