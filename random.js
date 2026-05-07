// random.js
// Seeded pseudo-random number generator.
// 同樣的 seed 永遠產生同樣的序列,這是程序化生成可重現性的關鍵。

/**
 * 把任意字串轉成 32-bit 整數種子。
 * 使用 cyrb53 hash 的簡化版,確保不同字串能均勻分佈。
 */
function stringToSeed(str) {
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0) ^ (h1 >>> 0);
}

/**
 * Mulberry32 — 一個小巧、快速、品質夠好的 seeded PRNG。
 */
class SeededRandom {
  constructor(seed) {
    if (typeof seed === 'string') {
      this.seedString = seed;
      this.state = stringToSeed(seed);
    } else {
      this.seedString = String(seed);
      this.state = seed >>> 0;
    }
    // 確保不會是 0(會卡住)
    if (this.state === 0) this.state = 1;
  }

  /** 回傳 [0, 1) 的浮點數 */
  random() {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** 回傳 [min, max] 的整數(包含兩端) */
  randomInt(min, max) {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  /** 回傳 [min, max) 的浮點數 */
  randomFloat(min, max) {
    return this.random() * (max - min) + min;
  }

  /** 從陣列中隨機挑一個元素 */
  pick(arr) {
    return arr[Math.floor(this.random() * arr.length)];
  }

  /** 加權挑選:weights 是和 arr 同長度的數字陣列 */
  pickWeighted(arr, weights) {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = this.random() * total;
    for (let i = 0; i < arr.length; i++) {
      r -= weights[i];
      if (r <= 0) return arr[i];
    }
    return arr[arr.length - 1];
  }

  /** 機率為 p 時回傳 true */
  chance(p) {
    return this.random() < p;
  }
}

/** 產生一個隨機種子字串(給沒輸入種子的時候用) */
function generateRandomSeed() {
  const adjectives = ['rusty', 'gilded', 'cursed', 'frozen', 'molten', 'shadow', 'sacred', 'wild', 'bone', 'silver'];
  const nouns = ['blade', 'flask', 'fang', 'tear', 'whisper', 'ember', 'shard', 'oath', 'relic', 'thorn'];
  const a = adjectives[Math.floor(Math.random() * adjectives.length)];
  const n = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 1000);
  return `${a}-${n}-${num}`;
}

// 把全域工具掛到 window,給 main.js 跟未來的繪圖模組用
window.SeededRandom = SeededRandom;
window.generateRandomSeed = generateRandomSeed;
