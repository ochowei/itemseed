// palette.js
// 色族表 + palette sampler + HSL→Hex + cork 常數。
// 所有顏色都是 7-char #RRGGBB 字串(canvas fillStyle 友善)。

const FAMILIES = {
  fire:   { hue: [0, 20],    sat: [70, 90], lightCenter: 50, weight: 1 },
  frost:  { hue: [185, 215], sat: [55, 75], lightCenter: 55, weight: 1 },
  mana:   { hue: [240, 270], sat: [60, 80], lightCenter: 50, weight: 1 },
  poison: { hue: [80, 110],  sat: [60, 85], lightCenter: 45, weight: 1 },
  golden: { hue: [40, 55],   sat: [75, 90], lightCenter: 55, weight: 1 },
  shadow: { hue: [280, 320], sat: [40, 60], lightCenter: 35, weight: 1 },
};

const CORK_PALETTE = {
  main:      '#8a5a2e',
  shadow:    '#5a3a1e',
  highlight: '#b88560',
};

/** HSL (h:0-360, s:0-100, l:0-100) → '#RRGGBB' */
function hslToRgbHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0, g1 = 0, b1 = 0;
  if (hp < 1)      { r1 = c; g1 = x; b1 = 0; }
  else if (hp < 2) { r1 = x; g1 = c; b1 = 0; }
  else if (hp < 3) { r1 = 0; g1 = c; b1 = x; }
  else if (hp < 4) { r1 = 0; g1 = x; b1 = c; }
  else if (hp < 5) { r1 = x; g1 = 0; b1 = c; }
  else             { r1 = c; g1 = 0; b1 = x; }
  const m = l - c / 2;
  const r = Math.round((r1 + m) * 255);
  const g = Math.round((g1 + m) * 255);
  const b = Math.round((b1 + m) * 255);
  const toHex = (n) => n.toString(16).padStart(2, '0');
  return '#' + toHex(r) + toHex(g) + toHex(b);
}

/**
 * 從 RNG 抽一個色族並推導 6 色 palette。
 * @returns {{ family: string, palette: { outline, glassBody, glassShine, liquidMain, liquidShadow, highlight } }}
 */
function samplePalette(rng) {
  const names = Object.keys(FAMILIES);
  const weights = names.map((n) => FAMILIES[n].weight);
  const familyName = rng.pickWeighted(names, weights);
  const fam = FAMILIES[familyName];

  const h = rng.randomFloat(fam.hue[0], fam.hue[1]);
  const s = rng.randomFloat(fam.sat[0], fam.sat[1]);
  const L = fam.lightCenter;

  return {
    family: familyName,
    palette: {
      outline:      hslToRgbHex(h, 50, 12),
      glassBody:    hslToRgbHex(h, Math.max(0, s - 30), L + 10),
      glassShine:   hslToRgbHex(h, Math.max(0, s - 40), 92),
      liquidMain:   hslToRgbHex(h, s, L),
      liquidShadow: hslToRgbHex(h, Math.min(100, s + 10), Math.max(0, L - 15)),
      highlight:    hslToRgbHex(h + 10, Math.max(0, s - 15), 80),
    },
  };
}

window.FAMILIES = FAMILIES;
window.CORK_PALETTE = CORK_PALETTE;
window.samplePalette = samplePalette;
window.hslToRgbHex = hslToRgbHex;
