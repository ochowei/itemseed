// bow.js — Seeded procedural bow and arrow generator (32×32 and 16×16)
// Two-phase architecture: sampleBowSpec(rng) -> pure renderBowSpec32/16(ctx, spec)

(function () {
  const BOW_ARCHETYPES = ['longbow', 'recurve', 'shortbow'];
  const BOW_ARCHETYPE_WEIGHTS = [3, 2, 1.5];

  // Resolve helpers from global scope / window / globalThis
  const _allocateMask = typeof allocateMask !== 'undefined' ? allocateMask : (typeof window !== 'undefined' ? window.allocateMask : (typeof globalThis !== 'undefined' ? globalThis.allocateMask : null));
  const _maskGet = typeof maskGet !== 'undefined' ? maskGet : (typeof window !== 'undefined' ? window.maskGet : (typeof globalThis !== 'undefined' ? globalThis.maskGet : null));
  const _maskSet = typeof maskSet !== 'undefined' ? maskSet : (typeof window !== 'undefined' ? window.maskSet : (typeof globalThis !== 'undefined' ? globalThis.maskSet : null));
  const _paintMaskByEnum = typeof paintMaskByEnum !== 'undefined' ? paintMaskByEnum : (typeof window !== 'undefined' ? window.paintMaskByEnum : (typeof globalThis !== 'undefined' ? globalThis.paintMaskByEnum : null));
  const _applyInsideOutlinePass = typeof applyInsideOutlinePass !== 'undefined' ? applyInsideOutlinePass : (typeof window !== 'undefined' ? window.applyInsideOutlinePass : (typeof globalThis !== 'undefined' ? globalThis.applyInsideOutlinePass : null));
  const _paintInternalSeams = typeof paintInternalSeams !== 'undefined' ? paintInternalSeams : (typeof window !== 'undefined' ? window.paintInternalSeams : (typeof globalThis !== 'undefined' ? globalThis.paintInternalSeams : null));
  const _WOOD_PALETTE = typeof WOOD_PALETTE !== 'undefined' ? WOOD_PALETTE : (typeof window !== 'undefined' ? window.WOOD_PALETTE : (typeof globalThis !== 'undefined' ? globalThis.WOOD_PALETTE : null));
  const _LEATHER_PALETTE = typeof LEATHER_PALETTE !== 'undefined' ? LEATHER_PALETTE : (typeof window !== 'undefined' ? window.LEATHER_PALETTE : (typeof globalThis !== 'undefined' ? globalThis.LEATHER_PALETTE : null));
  const _sampleBowPalette = typeof sampleBowPalette !== 'undefined' ? sampleBowPalette : (typeof window !== 'undefined' ? window.sampleBowPalette : (typeof globalThis !== 'undefined' ? globalThis.sampleBowPalette : null));

  // Integer Bresenham line algorithm
  function bresenhamLine(x0, y0, x1, y1) {
    const pts = [];
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let x = Math.floor(x0);
    let y = Math.floor(y0);
    const targetX = Math.floor(x1);
    const targetY = Math.floor(y1);

    while (true) {
      pts.push({ x, y });
      if (x === targetX && y === targetY) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
    return pts;
  }

  // =====================================================================
  // Phase 1: Sampler — Pure data specification sampling
  // =====================================================================

  function sampleBowSpec(rng) {
    const chance = (p) => {
      if (rng && typeof rng.chance === 'function') return rng.chance(p);
      if (rng && typeof rng.bool === 'function') return rng.bool(p);
      return rng.random() < p;
    };

    const archetype = rng.pickWeighted(BOW_ARCHETYPES, BOW_ARCHETYPE_WEIGHTS);
    const pal = _sampleBowPalette ? _sampleBowPalette(rng) : null;
    const hasGripWrap = chance(0.6);
    const hasNockReinforcement = archetype === 'longbow' ? true : chance(0.5);

    const woodPalette = pal ? pal.woodPalette : {
      outline: '#26170d',
      main: '#8a5a2e',
      shadow: '#5a3a1e',
      shine: '#b88560',
    };
    const metalPalette = pal ? pal.metalPalette : {
      outline: '#1e293b',
      main: '#94a3b8',
      shadow: '#475569',
      shine: '#f1f5f9',
    };
    const fletchingPalette = pal ? pal.fletchingPalette : {
      main: '#dc2626',
      shadow: '#991b1b',
    };
    const woodFamily = pal ? pal.woodFamily : 'oak';
    const metalFamily = pal ? pal.metalFamily : 'steel';
    const fletchingColor = pal ? (pal.fletchingColor || pal.fletchingName) : 'crimson';
    const arrowShaftPalette = _WOOD_PALETTE || {
      main: '#a87c4e',
      shadow: '#6a4020',
      highlight: '#c8a070',
    };

    return {
      archetype,
      woodFamily,
      woodPalette,
      metalFamily,
      metalPalette,
      fletchingColor,
      fletchingName: fletchingColor,
      fletchingPalette,
      hasGripWrap,
      hasNockReinforcement,
      arrowShaftPalette,
      palette: pal,
    };
  }

  // =====================================================================
  // Phase 2: 32×32 Native Rasterizer
  // =====================================================================

  function getArchetypeUpperCurve32(archetype) {
    if (archetype === 'recurve') {
      // Dynamic S-curve, counter-flexing at tip (7, 6)
      return [
        { x: 7, y: 6 },
        { x: 8, y: 6 },
        { x: 9, y: 7 },
        { x: 10, y: 8 },
        { x: 11, y: 9 },
        { x: 12, y: 10 },
        { x: 13, y: 11 },
        { x: 14, y: 12 },
        { x: 14, y: 13 },
        { x: 15, y: 14 },
        { x: 15, y: 15 },
        { x: 16, y: 16 },
      ];
    }
    if (archetype === 'shortbow') {
      // Compact deeper arch with high curvature
      return [
        { x: 9, y: 7 },
        { x: 10, y: 8 },
        { x: 11, y: 8 },
        { x: 12, y: 9 },
        { x: 13, y: 10 },
        { x: 14, y: 11 },
        { x: 14, y: 12 },
        { x: 15, y: 13 },
        { x: 15, y: 14 },
        { x: 16, y: 15 },
        { x: 16, y: 16 },
      ];
    }
    // longbow: Smooth, large-radius parabolic arc
    return [
      { x: 8, y: 5 },
      { x: 9, y: 6 },
      { x: 10, y: 7 },
      { x: 11, y: 8 },
      { x: 12, y: 9 },
      { x: 13, y: 10 },
      { x: 13, y: 11 },
      { x: 14, y: 12 },
      { x: 14, y: 13 },
      { x: 15, y: 14 },
      { x: 15, y: 15 },
      { x: 16, y: 16 },
    ];
  }

  function buildBowMask32(spec, upperCurve) {
    const size = 32;
    const mask = _allocateMask(size);

    // Upper limb
    for (let i = 0; i < upperCurve.length; i++) {
      const p = upperCurve[i];
      const isGrip = (p.x >= 14 && p.x <= 17 && p.y >= 14 && p.y <= 17);
      const isNock = (i <= 1 && spec.hasNockReinforcement);
      const label = isGrip ? 'grip' : (isNock ? 'nock' : 'stave');

      _maskSet(mask, size, p.x, p.y, label);
      if (i === 1) {
        _maskSet(mask, size, p.x + 1, p.y, label);
        _maskSet(mask, size, p.x, p.y + 1, label);
      } else if (i >= 2) {
        _maskSet(mask, size, p.x + 1, p.y, label);
        _maskSet(mask, size, p.x, p.y + 1, label);
        _maskSet(mask, size, p.x - 1, p.y, label);
        _maskSet(mask, size, p.x, p.y - 1, label);
      }
    }

    // Lower limb (reflected across diagonal x + y = 31)
    for (let i = 0; i < upperCurve.length; i++) {
      const p = upperCurve[i];
      const lx = 31 - p.y;
      const ly = 31 - p.x;
      const isGrip = (lx >= 14 && lx <= 17 && ly >= 14 && ly <= 17);
      const isNock = (i <= 1 && spec.hasNockReinforcement);
      const label = isGrip ? 'grip' : (isNock ? 'nock' : 'stave');

      _maskSet(mask, size, lx, ly, label);
      if (i === 1) {
        _maskSet(mask, size, lx - 1, ly, label);
        _maskSet(mask, size, lx, ly - 1, label);
      } else if (i >= 2) {
        _maskSet(mask, size, lx + 1, ly, label);
        _maskSet(mask, size, lx, ly + 1, label);
        _maskSet(mask, size, lx - 1, ly, label);
        _maskSet(mask, size, lx, ly - 1, label);
      }
    }

    // Pronounced grip block for shortbow
    if (spec.archetype === 'shortbow') {
      _maskSet(mask, size, 14, 15, 'grip');
      _maskSet(mask, size, 17, 16, 'grip');
      _maskSet(mask, size, 15, 17, 'grip');
      _maskSet(mask, size, 16, 14, 'grip');
    }

    return mask;
  }

  function renderBowSpec32(ctx, spec) {
    const size = 32;
    ctx.clearRect(0, 0, size, size);

    const upperCurve = getArchetypeUpperCurve32(spec.archetype);
    const upperTip = upperCurve[0];
    const lowerTip = { x: 31 - upperTip.y, y: 31 - upperTip.x };
    const nockingPoint = { x: 10, y: 21 };

    // -----------------------------------------------------------------
    // Layer 1: Bowstring
    // -----------------------------------------------------------------
    const upString = bresenhamLine(upperTip.x, upperTip.y, nockingPoint.x, nockingPoint.y);
    const lowString = bresenhamLine(lowerTip.x, lowerTip.y, nockingPoint.x, nockingPoint.y);

    // Symmetrically aligned string shadow (#475569) offset by 1px towards inner area
    ctx.fillStyle = '#475569';
    for (const p of upString) {
      ctx.fillRect(p.x + 1, p.y, 1, 1);
    }
    for (const p of lowString) {
      ctx.fillRect(p.x, p.y - 1, 1, 1);
    }

    // Main string line (#e2e8f0)
    ctx.fillStyle = '#e2e8f0';
    for (const p of upString) {
      ctx.fillRect(p.x, p.y, 1, 1);
    }
    for (const p of lowString) {
      ctx.fillRect(p.x, p.y, 1, 1);
    }

    // -----------------------------------------------------------------
    // Layer 2: Bow Stave (Upper & Lower Limbs, Grip, Nocks)
    // -----------------------------------------------------------------
    const mask = buildBowMask32(spec, upperCurve);
    const leatherPal = _LEATHER_PALETTE || {
      main: '#6a4828',
      shadow: '#3a2818',
      highlight: '#8a6840',
    };

    // 1. Base colors by enum (predominantly woodPalette.main)
    _paintMaskByEnum(ctx, mask, size, {
      stave: spec.woodPalette.main,
      grip: leatherPal.main,
      nock: spec.metalPalette.main,
    });

    // 2. Upper face highlight (shine): accent at crest of upper limb
    // Only 2 accent pixels at the crest where light catches, preserving woodPalette.main
    ctx.fillStyle = spec.woodPalette.shine;
    const upperShineIndices = [2, 3];
    for (const idx of upperShineIndices) {
      if (idx < upperCurve.length) {
        const p = upperCurve[idx];
        if (_maskGet(mask, size, p.x, p.y) === 'stave') {
          ctx.fillRect(p.x, p.y, 1, 1);
        }
      }
    }

    // 3. Inner face shadow: accent at lower limb bend
    // Only 2 accent pixels at lower bend, preserving woodPalette.main
    ctx.fillStyle = spec.woodPalette.shadow;
    const lowerShadowIndices = [2, 3];
    for (const idx of lowerShadowIndices) {
      if (idx < upperCurve.length) {
        const p = upperCurve[idx];
        const lx = 31 - p.y;
        const ly = 31 - p.x;
        if (_maskGet(mask, size, lx, ly) === 'stave') {
          ctx.fillRect(lx, ly, 1, 1);
        }
      }
    }

    // 4. Metal nock interior highlight (BEFORE outline pass to preserve outer outline)
    if (spec.hasNockReinforcement) {
      const un = upperCurve[1];
      ctx.fillStyle = spec.metalPalette.shine;
      ctx.fillRect(un.x, un.y, 1, 1);

      const lnX = 31 - un.y;
      const lnY = 31 - un.x;
      ctx.fillStyle = spec.metalPalette.shadow;
      ctx.fillRect(lnX, lnY, 1, 1);
    }

    // 5. Grip wrap centered around (16, 16)
    if (spec.hasGripWrap) {
      ctx.fillStyle = leatherPal.shadow;
      ctx.fillRect(15, 14, 2, 1);
      ctx.fillRect(16, 17, 2, 1);
      ctx.fillStyle = leatherPal.highlight;
      ctx.fillRect(15, 16, 2, 1);
      ctx.fillRect(16, 15, 2, 1);
    }

    // 6. Internal seams between stave, grip, and nock caps
    _paintInternalSeams(ctx, mask, size, spec.woodPalette.outline);

    // 7. Solid perimeter outline (encloses stave & nocks completely)
    _applyInsideOutlinePass(ctx, mask, size, spec.woodPalette.outline);

    // -----------------------------------------------------------------
    // Layer 3: Arrow
    // -----------------------------------------------------------------
    const shaftPal = spec.arrowShaftPalette || _WOOD_PALETTE || {
      main: '#a87c4e',
      shadow: '#6a4020',
    };

    // Shaft: 1px integer diagonal line from (9, 22) to (24, 7) aligned to nock (10, 21)
    const shaftPts = bresenhamLine(9, 22, 24, 7);
    ctx.fillStyle = shaftPal.main;
    for (const p of shaftPts) {
      ctx.fillRect(p.x, p.y, 1, 1);
    }

    // Fletching: streamlined feather vanes hugging the shaft completely enclosed by dark outline
    ctx.fillStyle = spec.woodPalette.outline;
    const fletchOutline = [
      // upper vane outline
      [8, 21], [9, 20], [10, 19], [11, 18], [12, 18],
      // rear nock outline cap
      [8, 22], [8, 23], [9, 23],
      // lower vane outline
      [10, 23], [11, 22], [12, 21], [13, 20], [13, 19]
    ];
    for (const [ox, oy] of fletchOutline) {
      ctx.fillRect(ox, oy, 1, 1);
    }

    // Upper vane feather interior:
    ctx.fillStyle = spec.fletchingPalette.main;
    ctx.fillRect(9, 21, 1, 1);
    ctx.fillRect(10, 20, 1, 1);
    ctx.fillRect(11, 19, 1, 1);

    // Lower vane feather interior:
    ctx.fillStyle = spec.fletchingPalette.shadow;
    ctx.fillRect(10, 22, 1, 1);
    ctx.fillRect(11, 21, 1, 1);
    ctx.fillRect(12, 20, 1, 1);

    // Arrowhead: sharp acute piercing spearhead pointing top-right towards (28, 3)
    ctx.fillStyle = spec.metalPalette.outline;
    const headOutline = [
      [28, 3],          // razor tip outline
      [27, 3],          // top edge
      [26, 4], [25, 4], // upper-left edges
      [24, 5],          // upper barb
      [24, 6],          // left socket
      [25, 7],          // bottom socket
      [26, 7],          // lower barb
      [27, 6], [27, 5], // lower-right edges
      [28, 4],          // right edge
    ];
    for (const [hx, hy] of headOutline) {
      ctx.fillRect(hx, hy, 1, 1);
    }

    // Interior metallic facets:
    ctx.fillStyle = spec.metalPalette.shine;
    ctx.fillRect(27, 4, 1, 1); // tip facet
    ctx.fillRect(25, 5, 1, 1); // upper facet

    ctx.fillStyle = spec.metalPalette.main;
    ctx.fillRect(26, 5, 1, 1); // central ridge
    ctx.fillRect(25, 6, 1, 1); // lower ridge / socket

    ctx.fillStyle = spec.metalPalette.shadow;
    ctx.fillRect(26, 6, 1, 1); // lower facet
  }

  // =====================================================================
  // Phase 3: 16×16 Native Rasterizer
  // =====================================================================

  function getArchetypeUpperCurve16(archetype) {
    if (archetype === 'recurve') {
      return [
        { x: 3, y: 3 },
        { x: 4, y: 3 },
        { x: 5, y: 4 },
        { x: 6, y: 5 },
        { x: 7, y: 6 },
        { x: 7, y: 7 },
        { x: 8, y: 8 },
      ];
    }
    if (archetype === 'shortbow') {
      return [
        { x: 4, y: 3 },
        { x: 5, y: 4 },
        { x: 6, y: 5 },
        { x: 6, y: 6 },
        { x: 7, y: 7 },
        { x: 8, y: 8 },
      ];
    }
    // longbow: Smooth parabolic arc
    return [
      { x: 4, y: 3 },
      { x: 5, y: 4 },
      { x: 6, y: 5 },
      { x: 7, y: 6 },
      { x: 7, y: 7 },
      { x: 8, y: 8 },
    ];
  }

  function buildBowMask16(spec, upperCurve) {
    const size = 16;
    const mask = _allocateMask(size);

    function addCell(x, y, label) {
      _maskSet(mask, size, x, y, label);
      _maskSet(mask, size, 16 - y, 16 - x, label);
    }

    for (let i = 0; i < upperCurve.length; i++) {
      const p = upperCurve[i];
      const isGrip = (p.x === 8 && p.y === 8);
      const isNock = (i === 0 && spec.hasNockReinforcement);
      const label = isGrip ? 'grip' : (isNock ? 'nock' : 'stave');

      addCell(p.x, p.y, label);
      addCell(p.x + 1, p.y, label);
      addCell(p.x, p.y - 1, label);
      if (i >= 2) {
        addCell(p.x - 1, p.y, label);
        addCell(p.x, p.y + 1, label);
      }
    }

    // Pronounced grip block for shortbow
    if (spec.archetype === 'shortbow') {
      addCell(7, 8, 'grip');
      addCell(8, 7, 'grip');
    }

    return mask;
  }

  function renderBowSpec16(ctx, spec) {
    const size = 16;
    ctx.clearRect(0, 0, size, size);

    const upperCurve = getArchetypeUpperCurve16(spec.archetype);
    const upperTip = upperCurve[0];
    const lowerTip = { x: 16 - upperTip.y, y: 16 - upperTip.x };
    const nockingPoint = { x: 5, y: 10 };

    // -----------------------------------------------------------------
    // Layer 1: Bowstring
    // -----------------------------------------------------------------
    const upString = bresenhamLine(upperTip.x, upperTip.y, nockingPoint.x, nockingPoint.y);
    const lowString = bresenhamLine(lowerTip.x, lowerTip.y, nockingPoint.x, nockingPoint.y);

    ctx.fillStyle = '#cbd5e1';
    for (const p of upString) {
      ctx.fillRect(p.x, p.y, 1, 1);
    }
    for (const p of lowString) {
      ctx.fillRect(p.x, p.y, 1, 1);
    }

    // -----------------------------------------------------------------
    // Layer 2: Bow Stave
    // -----------------------------------------------------------------
    const mask = buildBowMask16(spec, upperCurve);
    const leatherPal = _LEATHER_PALETTE || {
      main: '#6a4828',
      shadow: '#3a2818',
      highlight: '#8a6840',
    };

    // 1. Base colors by enum
    _paintMaskByEnum(ctx, mask, size, {
      stave: spec.woodPalette.main,
      grip: leatherPal.main,
      nock: spec.metalPalette.main,
    });

    // 2. Derive stave body fills and accents from upperCurve
    const shineIdx = 2;

    for (let i = 0; i < upperCurve.length; i++) {
      const p = upperCurve[i];
      const lx = 16 - p.y;
      const ly = 16 - p.x;
      const isGrip = (p.x === 8 && p.y === 8);

      if (isGrip) {
        ctx.fillStyle = spec.hasGripWrap ? leatherPal.main : spec.woodPalette.main;
        ctx.fillRect(p.x, p.y, 1, 1);
      } else if (i === 1 && spec.hasNockReinforcement) {
        // Metal nock interior accent on upperCurve[1]
        ctx.fillStyle = spec.metalPalette.shine;
        ctx.fillRect(p.x, p.y, 1, 1);
        ctx.fillStyle = spec.metalPalette.shadow;
        ctx.fillRect(lx, ly, 1, 1);
      } else if (i === shineIdx) {
        // Upper limb shine highlight / lower limb shadow
        ctx.fillStyle = spec.woodPalette.shine;
        ctx.fillRect(p.x, p.y, 1, 1);
        ctx.fillStyle = spec.woodPalette.shadow;
        ctx.fillRect(lx, ly, 1, 1);
      } else if (i > 1) {
        // Stave body main along curve
        ctx.fillStyle = spec.woodPalette.main;
        ctx.fillRect(p.x, p.y, 1, 1);
        ctx.fillRect(lx, ly, 1, 1);
      }
    }

    // 3. Internal seams between stave, grip, and nock caps
    _paintInternalSeams(ctx, mask, size, spec.woodPalette.outline);

    // 4. Solid perimeter outline (AFTER all stave body colors and accents)
    _applyInsideOutlinePass(ctx, mask, size, spec.woodPalette.outline);

    // -----------------------------------------------------------------
    // Layer 3: Arrow
    // -----------------------------------------------------------------
    const shaftPal = spec.arrowShaftPalette || _WOOD_PALETTE || {
      main: '#a87c4e',
      shadow: '#6a4020',
    };

    // Shaft: 1px continuous diagonal line from (4, 11) to (11, 4) aligned to nock (5, 10)
    const shaftPts = bresenhamLine(4, 11, 11, 4);
    ctx.fillStyle = shaftPal.main;
    for (const p of shaftPts) {
      ctx.fillRect(p.x, p.y, 1, 1);
    }

    // Fletching: streamlined feather vanes hugging shaft near nocking point (5, 10)
    ctx.fillStyle = spec.woodPalette.outline;
    const fletch16Outline = [
      [4, 9], [5, 9],
      [3, 10], [6, 10],
      [3, 11], [6, 11],
      [3, 12], [4, 12], [5, 12]
    ];
    for (const [ox, oy] of fletch16Outline) {
      ctx.fillRect(ox, oy, 1, 1);
    }

    ctx.fillStyle = spec.fletchingPalette.main;
    ctx.fillRect(4, 10, 1, 1);

    ctx.fillStyle = spec.fletchingPalette.shadow;
    ctx.fillRect(5, 11, 1, 1);

    // Arrowhead: acute razor tip pointing top-right towards (14, 1)
    ctx.fillStyle = spec.metalPalette.outline;
    const head16Outline = [
      [14, 1],
      [13, 1], [14, 2],
      [12, 2], [13, 3],
      [11, 3], [12, 4]
    ];
    for (const [hx, hy] of head16Outline) {
      ctx.fillRect(hx, hy, 1, 1);
    }

    ctx.fillStyle = spec.metalPalette.shine;
    ctx.fillRect(13, 2, 1, 1);

    ctx.fillStyle = spec.metalPalette.main;
    ctx.fillRect(12, 3, 1, 1);
  }

  // =====================================================================
  // Convenience Entry
  // =====================================================================

  function drawBow(ctx, rng, size) {
    const spec = sampleBowSpec(rng);
    if (size === 16) {
      renderBowSpec16(ctx, spec);
    } else {
      renderBowSpec32(ctx, spec);
    }
    return spec;
  }

  // Expose to window and globalThis
  if (typeof window !== 'undefined') {
    window.BOW_ARCHETYPES = BOW_ARCHETYPES;
    window.BOW_ARCHETYPE_WEIGHTS = BOW_ARCHETYPE_WEIGHTS;
    window.sampleBowSpec = sampleBowSpec;
    window.renderBowSpec32 = renderBowSpec32;
    window.renderBowSpec16 = renderBowSpec16;
    window.drawBow = drawBow;
  }

  if (typeof globalThis !== 'undefined') {
    globalThis.BOW_ARCHETYPES = BOW_ARCHETYPES;
    globalThis.BOW_ARCHETYPE_WEIGHTS = BOW_ARCHETYPE_WEIGHTS;
    globalThis.sampleBowSpec = sampleBowSpec;
    globalThis.renderBowSpec32 = renderBowSpec32;
    globalThis.renderBowSpec16 = renderBowSpec16;
    globalThis.drawBow = drawBow;
  }
})();
