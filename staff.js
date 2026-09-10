// staff.js — Seeded procedural magic staff generator (32x32 and 16x16)

(function () {
  const STAFF_ARCHETYPES = ['crescent', 'orb', 'crozier'];
  const STAFF_BUTT_STYLES = ['spike', 'rounded'];

  // Resolve helpers from global scope / window
  const _allocateMask = typeof allocateMask !== 'undefined' ? allocateMask : (typeof window !== 'undefined' ? window.allocateMask : null);
  const _maskGet = typeof maskGet !== 'undefined' ? maskGet : (typeof window !== 'undefined' ? window.maskGet : null);
  const _maskSet = typeof maskSet !== 'undefined' ? maskSet : (typeof window !== 'undefined' ? window.maskSet : null);
  const _paintMaskByEnum = typeof paintMaskByEnum !== 'undefined' ? paintMaskByEnum : (typeof window !== 'undefined' ? window.paintMaskByEnum : null);
  const _applyInsideOutlinePass = typeof applyInsideOutlinePass !== 'undefined' ? applyInsideOutlinePass : (typeof window !== 'undefined' ? window.applyInsideOutlinePass : null);
  const _paintInternalSeams = typeof paintInternalSeams !== 'undefined' ? paintInternalSeams : (typeof window !== 'undefined' ? window.paintInternalSeams : null);
  const _WOOD_PALETTE = typeof WOOD_PALETTE !== 'undefined' ? WOOD_PALETTE : (typeof window !== 'undefined' ? window.WOOD_PALETTE : null);

  // Ensure rng supports both .bool/.int and .chance/.randomInt methods
  const SR = typeof SeededRandom !== 'undefined' ? SeededRandom : (typeof window !== 'undefined' ? window.SeededRandom : null);
  if (SR && SR.prototype) {
    if (!SR.prototype.bool) SR.prototype.bool = function (p) { return this.chance(p); };
    if (!SR.prototype.int) SR.prototype.int = function (min, max) { return this.randomInt(min, max); };
  }

  function sampleStaffSpec(rng) {
    if (rng && !rng.bool) rng.bool = function (p) { return this.chance(p); };
    if (rng && !rng.int) rng.int = function (min, max) { return this.randomInt(min, max); };

    const archetype = rng.pick(STAFF_ARCHETYPES);
    const buttStyle = rng.pick(STAFF_BUTT_STYLES);
    const { element, gemPalette, metalFamily, metalPalette } = sampleStaffPalette(rng);

    const hasGripRings = rng.bool(0.7);
    const ringCount = hasGripRings ? rng.int(1, 3) : 0;
    const ringYs = [];
    const availableYs = [15, 18, 21, 24];
    for (let i = 0; i < ringCount; i++) {
      const idx = rng.int(0, availableYs.length - 1);
      ringYs.push(availableYs.splice(idx, 1)[0]);
    }
    ringYs.sort((a, b) => a - b);

    return {
      archetype,
      element,
      gemPalette,
      metalFamily,
      metalPalette,
      shaftPalette: _WOOD_PALETTE,
      hasGripRings,
      ringYs,
      buttStyle,
    };
  }

  // =====================================================================
  // 32×32 Mask Building & Rendering Helpers
  // =====================================================================

  function staffAddRange(mask, size, y, x0, x1, label) {
    for (let x = x0; x <= x1; x++) {
      _maskSet(mask, size, x, y, label);
    }
  }

  function buildStaffMask32(spec) {
    const size = 32;
    const mask = _allocateMask(size);

    // ── Shaft (y = 12..26, width 4 across x = 14..17) ──
    for (let y = 12; y <= 26; y++) {
      staffAddRange(mask, size, y, 14, 17, 'shaft');
    }

    // ── Grip Rings (if present, overwrite shaft with 'metal') ──
    if (spec.hasGripRings) {
      for (const y of spec.ringYs) {
        staffAddRange(mask, size, y, 14, 17, 'metal');
      }
    }

    // ── Butt / Ferrule (y = 27..30) ──
    if (spec.buttStyle === 'spike') {
      staffAddRange(mask, size, 27, 14, 17, 'metal');
      staffAddRange(mask, size, 28, 14, 17, 'metal');
      staffAddRange(mask, size, 29, 15, 16, 'metal');
      _maskSet(mask, size, 16, 30, 'metal');
    } else {
      // rounded
      staffAddRange(mask, size, 27, 14, 17, 'metal');
      staffAddRange(mask, size, 28, 14, 17, 'metal');
      staffAddRange(mask, size, 29, 15, 16, 'metal');
    }

    // ── Head Archetype & Collar ──
    if (spec.archetype === 'crescent') {
      // Collar bracket at y = 10..11
      staffAddRange(mask, size, 11, 14, 18, 'metal');
      staffAddRange(mask, size, 10, 13, 19, 'metal');

      // Curved metal horns rising along x = 11..13 (left) and x = 19..21 (right) up to y = 3..5
      staffAddRange(mask, size, 9, 12, 14, 'metal');
      staffAddRange(mask, size, 9, 18, 20, 'metal');

      staffAddRange(mask, size, 8, 11, 13, 'metal');
      staffAddRange(mask, size, 8, 19, 21, 'metal');

      staffAddRange(mask, size, 7, 11, 13, 'metal');
      staffAddRange(mask, size, 7, 19, 21, 'metal');

      staffAddRange(mask, size, 6, 11, 13, 'metal');
      staffAddRange(mask, size, 6, 19, 21, 'metal');

      staffAddRange(mask, size, 5, 11, 13, 'metal');
      staffAddRange(mask, size, 5, 19, 21, 'metal');

      staffAddRange(mask, size, 4, 11, 12, 'metal');
      staffAddRange(mask, size, 4, 20, 21, 'metal');

      _maskSet(mask, size, 12, 3, 'metal');
      _maskSet(mask, size, 20, 3, 'metal');

      // Floating crystal diamond at cx = 16, y = 6
      _maskSet(mask, size, 16, 4, 'gem');
      staffAddRange(mask, size, 5, 15, 17, 'gem');
      staffAddRange(mask, size, 6, 14, 18, 'gem');
      staffAddRange(mask, size, 7, 15, 17, 'gem');
      _maskSet(mask, size, 16, 8, 'gem');

    } else if (spec.archetype === 'orb') {
      // Mounting cup collar at y = 10..11
      staffAddRange(mask, size, 11, 14, 18, 'metal');
      staffAddRange(mask, size, 10, 13, 19, 'metal');

      // Prongs clasping the gem at y = 8..9
      _maskSet(mask, size, 13, 9, 'metal');
      _maskSet(mask, size, 19, 9, 'metal');
      _maskSet(mask, size, 13, 8, 'metal');
      _maskSet(mask, size, 19, 8, 'metal');

      // Large faceted cut crystal diamond/gem at y = 3..9, width 7px (x = 13..19)
      staffAddRange(mask, size, 3, 15, 17, 'gem');
      staffAddRange(mask, size, 4, 14, 18, 'gem');
      staffAddRange(mask, size, 5, 13, 19, 'gem');
      staffAddRange(mask, size, 6, 13, 19, 'gem');
      staffAddRange(mask, size, 7, 14, 18, 'gem');
      staffAddRange(mask, size, 8, 14, 18, 'gem');
      staffAddRange(mask, size, 9, 15, 17, 'gem');

    } else if (spec.archetype === 'crozier') {
      // Metal collar band at junction y = 10..11
      staffAddRange(mask, size, 11, 14, 17, 'metal');
      staffAddRange(mask, size, 10, 14, 17, 'metal');

      // Wooden crook curving clockwise around (16, 6)
      staffAddRange(mask, size, 9, 13, 16, 'shaft');
      staffAddRange(mask, size, 8, 12, 14, 'shaft');
      staffAddRange(mask, size, 7, 11, 13, 'shaft');
      staffAddRange(mask, size, 6, 11, 13, 'shaft');
      staffAddRange(mask, size, 5, 11, 13, 'shaft');
      staffAddRange(mask, size, 4, 12, 15, 'shaft');
      staffAddRange(mask, size, 3, 14, 18, 'shaft'); // top arch
      staffAddRange(mask, size, 4, 18, 21, 'shaft');
      staffAddRange(mask, size, 5, 19, 21, 'shaft');
      staffAddRange(mask, size, 6, 19, 21, 'shaft');
      staffAddRange(mask, size, 7, 18, 20, 'shaft');
      staffAddRange(mask, size, 8, 16, 19, 'shaft'); // curl inward

      // Floating teardrop elemental gem embedded within loop at x = 15..17, y = 5..7
      _maskSet(mask, size, 16, 5, 'gem');
      staffAddRange(mask, size, 6, 15, 17, 'gem');
      staffAddRange(mask, size, 7, 15, 16, 'gem');
    }

    return mask;
  }

  function paintStaffDetails32(ctx, mask, spec) {
    const size = 32;
    const woodPal = spec.shaftPalette || _WOOD_PALETTE;

    // 1. Shaft shading (x = 15 wood highlight, x = 16 wood shadow)
    for (let y = 12; y <= 26; y++) {
      if (_maskGet(mask, size, 15, y) === 'shaft') {
        ctx.fillStyle = woodPal.highlight;
        ctx.fillRect(15, y, 1, 1);
      }
      if (_maskGet(mask, size, 16, y) === 'shaft') {
        ctx.fillStyle = woodPal.shadow;
        ctx.fillRect(16, y, 1, 1);
      }
    }

    // 2. Grip Rings
    if (spec.hasGripRings) {
      for (const y of spec.ringYs) {
        if (_maskGet(mask, size, 15, y) === 'metal') {
          ctx.fillStyle = spec.metalPalette.shine;
          ctx.fillRect(15, y, 1, 1);
        }
        if (_maskGet(mask, size, 16, y) === 'metal') {
          ctx.fillStyle = spec.metalPalette.shadow;
          ctx.fillRect(16, y, 1, 1);
        }
      }
    }

    // 3. Butt / Ferrule
    for (let y = 27; y <= 28; y++) {
      if (_maskGet(mask, size, 15, y) === 'metal') {
        ctx.fillStyle = spec.metalPalette.shine;
        ctx.fillRect(15, y, 1, 1);
      }
      if (_maskGet(mask, size, 16, y) === 'metal') {
        ctx.fillStyle = spec.metalPalette.shadow;
        ctx.fillRect(16, y, 1, 1);
      }
    }
    if (spec.buttStyle === 'spike') {
      ctx.fillStyle = spec.metalPalette.shine;
      ctx.fillRect(15, 29, 1, 1);
      ctx.fillStyle = spec.metalPalette.shadow;
      ctx.fillRect(16, 29, 1, 1);
    }

    // 4. Archetype-specific details
    if (spec.archetype === 'crescent') {
      // Collar bracket shading
      for (let y = 10; y <= 11; y++) {
        ctx.fillStyle = spec.metalPalette.shine;
        ctx.fillRect(15, y, 1, 1);
        ctx.fillStyle = spec.metalPalette.shadow;
        ctx.fillRect(16, y, 1, 1);
        if (_maskGet(mask, size, 17, y) === 'metal') {
          ctx.fillRect(17, y, 1, 1);
        }
      }

      // Horn interior spines
      for (let y = 5; y <= 8; y++) {
        ctx.fillStyle = spec.metalPalette.shine;
        ctx.fillRect(12, y, 1, 1);
        ctx.fillStyle = spec.metalPalette.shadow;
        ctx.fillRect(20, y, 1, 1);
      }

      // Floating crystal details
      ctx.fillStyle = spec.gemPalette.shine;
      ctx.fillRect(15, 5, 1, 1);
      ctx.fillRect(16, 5, 1, 1);
      ctx.fillStyle = spec.gemPalette.main;
      ctx.fillRect(15, 6, 1, 1);
      ctx.fillStyle = spec.gemPalette.shadow;
      ctx.fillRect(16, 6, 1, 1);
      ctx.fillRect(17, 6, 1, 1);
      ctx.fillRect(16, 7, 1, 1);

    } else if (spec.archetype === 'orb') {
      // Collar cup shading
      for (let y = 10; y <= 11; y++) {
        ctx.fillStyle = spec.metalPalette.shine;
        ctx.fillRect(14, y, 1, 1);
        ctx.fillRect(15, y, 1, 1);
        ctx.fillStyle = spec.metalPalette.shadow;
        ctx.fillRect(16, y, 1, 1);
        ctx.fillRect(17, y, 1, 1);
      }
      ctx.fillStyle = spec.metalPalette.shine;
      ctx.fillRect(13, 8, 1, 2);
      ctx.fillStyle = spec.metalPalette.shadow;
      ctx.fillRect(19, 8, 1, 2);

      // Gem specular shine
      ctx.fillStyle = spec.gemPalette.shine;
      ctx.fillRect(15, 4, 1, 1);
      ctx.fillRect(16, 4, 1, 1);
      ctx.fillRect(14, 5, 1, 1);
      ctx.fillRect(15, 5, 1, 1);

      // Gem main midtones
      ctx.fillStyle = spec.gemPalette.main;
      ctx.fillRect(16, 5, 1, 1);
      ctx.fillRect(14, 6, 1, 1);
      ctx.fillRect(15, 6, 1, 1);
      ctx.fillRect(16, 6, 1, 1);
      ctx.fillRect(15, 7, 1, 1);
      ctx.fillRect(15, 8, 1, 1);

      // Gem facet shadows
      ctx.fillStyle = spec.gemPalette.shadow;
      ctx.fillRect(17, 4, 1, 1);
      ctx.fillRect(17, 5, 1, 1);
      ctx.fillRect(18, 5, 1, 1);
      ctx.fillRect(17, 6, 1, 1);
      ctx.fillRect(18, 6, 1, 1);
      ctx.fillRect(16, 7, 1, 1);
      ctx.fillRect(17, 7, 1, 1);
      ctx.fillRect(16, 8, 1, 1);
      ctx.fillRect(17, 8, 1, 1);
      ctx.fillRect(16, 9, 1, 1);

    } else if (spec.archetype === 'crozier') {
      // Collar band
      for (let y = 10; y <= 11; y++) {
        ctx.fillStyle = spec.metalPalette.shine;
        ctx.fillRect(14, y, 1, 1);
        ctx.fillRect(15, y, 1, 1);
        ctx.fillStyle = spec.metalPalette.shadow;
        ctx.fillRect(16, y, 1, 1);
        ctx.fillRect(17, y, 1, 1);
      }

      // Wooden crook highlights & shadows
      ctx.fillStyle = woodPal.highlight;
      ctx.fillRect(12, 5, 1, 3);
      ctx.fillRect(15, 3, 3, 1);
      ctx.fillStyle = woodPal.shadow;
      ctx.fillRect(20, 5, 1, 3);
      ctx.fillRect(17, 8, 2, 1);

      // Teardrop gem
      ctx.fillStyle = spec.gemPalette.shine;
      ctx.fillRect(16, 5, 1, 1);
      ctx.fillRect(15, 6, 1, 1);
      ctx.fillStyle = spec.gemPalette.main;
      ctx.fillRect(16, 6, 1, 1);
      ctx.fillStyle = spec.gemPalette.shadow;
      ctx.fillRect(17, 6, 1, 1);
      ctx.fillRect(15, 7, 1, 1);
      ctx.fillRect(16, 7, 1, 1);
    }
  }

  function renderStaffSpec32(ctx, spec) {
    const size = 32;
    ctx.clearRect(0, 0, size, size);

    const mask = buildStaffMask32(spec);
    const woodPal = spec.shaftPalette || _WOOD_PALETTE;

    // 1. Paint base colors by enum
    _paintMaskByEnum(ctx, mask, size, {
      shaft: woodPal.main,
      metal: spec.metalPalette.main,
      gem: spec.gemPalette.main,
    });

    // 2. Paint detailed shading, highlights, and facets
    paintStaffDetails32(ctx, mask, spec);

    // 3. Internal seams between components
    _paintInternalSeams(ctx, mask, size, spec.metalPalette.outline);

    // 4. Outside edge outline pass
    _applyInsideOutlinePass(ctx, mask, size, spec.metalPalette.outline);

    // 5. Gem outline pass
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (_maskGet(mask, size, x, y) === 'gem') {
          const up = _maskGet(mask, size, x, y - 1);
          const down = _maskGet(mask, size, x, y + 1);
          const left = _maskGet(mask, size, x - 1, y);
          const right = _maskGet(mask, size, x + 1, y);
          if (up !== 'gem' || down !== 'gem' || left !== 'gem' || right !== 'gem') {
            ctx.fillStyle = spec.gemPalette.outline;
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    }
  }

  // =====================================================================
  // 16×16 Native Compressed Rendering Helpers
  // =====================================================================

  function buildStaffMask16(spec) {
    const size = 16;
    const mask = _allocateMask(size);

    // Shaft (y = 6..13, width 3 across x = 7..9)
    for (let y = 6; y <= 13; y++) {
      staffAddRange(mask, size, y, 7, 9, 'shaft');
    }

    // Butt / Ferrule (y = 14..15)
    staffAddRange(mask, size, 14, 7, 9, 'metal');
    if (spec.buttStyle === 'spike') {
      _maskSet(mask, size, 8, 15, 'metal');
    } else {
      staffAddRange(mask, size, 15, 7, 9, 'metal');
    }

    // Head Archetype & Collar
    if (spec.archetype === 'crescent') {
      staffAddRange(mask, size, 5, 7, 9, 'metal');
      for (let y = 2; y <= 4; y++) {
        _maskSet(mask, size, 6, y, 'metal');
        _maskSet(mask, size, 10, y, 'metal');
      }
      _maskSet(mask, size, 8, 1, 'gem');
      for (let y = 2; y <= 4; y++) {
        staffAddRange(mask, size, y, 7, 9, 'gem');
      }

    } else if (spec.archetype === 'orb') {
      staffAddRange(mask, size, 5, 7, 9, 'metal');
      _maskSet(mask, size, 8, 1, 'gem');
      staffAddRange(mask, size, 2, 7, 9, 'gem');
      staffAddRange(mask, size, 3, 6, 10, 'gem');
      staffAddRange(mask, size, 4, 7, 9, 'gem');

    } else if (spec.archetype === 'crozier') {
      staffAddRange(mask, size, 5, 7, 9, 'metal');
      _maskSet(mask, size, 6, 4, 'shaft');
      _maskSet(mask, size, 6, 3, 'shaft');
      _maskSet(mask, size, 6, 2, 'shaft');
      staffAddRange(mask, size, 1, 7, 8, 'shaft');
      _maskSet(mask, size, 7, 2, 'shaft');
      _maskSet(mask, size, 8, 2, 'shaft');
      _maskSet(mask, size, 9, 2, 'shaft');
      _maskSet(mask, size, 9, 3, 'shaft');
      _maskSet(mask, size, 9, 4, 'shaft');
      staffAddRange(mask, size, 3, 7, 8, 'gem');
      staffAddRange(mask, size, 4, 7, 8, 'gem');
    }

    return mask;
  }

  function renderStaffSpec16(ctx, spec) {
    const size = 16;
    ctx.clearRect(0, 0, size, size);

    const mask = buildStaffMask16(spec);
    const woodPal = spec.shaftPalette || _WOOD_PALETTE;

    // 1. Paint base
    _paintMaskByEnum(ctx, mask, size, {
      shaft: woodPal.main,
      metal: spec.metalPalette.main,
      gem: spec.gemPalette.main,
    });

    // 2. Seams & Outlines
    _paintInternalSeams(ctx, mask, size, spec.metalPalette.outline);
    _applyInsideOutlinePass(ctx, mask, size, spec.metalPalette.outline);

    // 3. Interior highlights and colors (only on non-boundary interior pixels)
    // Shaft interior at x = 8
    for (let y = 6; y <= 13; y++) {
      ctx.fillStyle = woodPal.main;
      ctx.fillRect(8, y, 1, 1);
    }
    // 1px metal accent if hasGripRings
    if (spec.hasGripRings) {
      ctx.fillStyle = spec.metalPalette.shine;
      ctx.fillRect(8, 10, 1, 1);
    }

    // Butt interior
    ctx.fillStyle = spec.metalPalette.main;
    ctx.fillRect(8, 14, 1, 1);

    // Collar interior
    ctx.fillStyle = spec.metalPalette.main;
    ctx.fillRect(8, 5, 1, 1);

    if (spec.archetype === 'crescent') {
      // Crystal interior facets
      ctx.fillStyle = spec.gemPalette.shine;
      ctx.fillRect(8, 2, 1, 1);
      ctx.fillRect(7, 3, 1, 1);
      ctx.fillStyle = spec.gemPalette.main;
      ctx.fillRect(8, 3, 1, 1);
      ctx.fillStyle = spec.gemPalette.shadow;
      ctx.fillRect(9, 3, 1, 1);
      ctx.fillRect(8, 4, 1, 1);

    } else if (spec.archetype === 'orb') {
      ctx.fillStyle = spec.gemPalette.shine;
      ctx.fillRect(8, 2, 1, 1);
      ctx.fillRect(7, 3, 1, 1);
      ctx.fillStyle = spec.gemPalette.main;
      ctx.fillRect(8, 3, 1, 1);
      ctx.fillStyle = spec.gemPalette.shadow;
      ctx.fillRect(9, 3, 1, 1);
      ctx.fillRect(8, 4, 1, 1);

    } else if (spec.archetype === 'crozier') {
      // 2x2 gem interior
      ctx.fillStyle = spec.gemPalette.shine;
      ctx.fillRect(7, 3, 1, 1);
      ctx.fillStyle = spec.gemPalette.main;
      ctx.fillRect(8, 3, 1, 1);
      ctx.fillRect(7, 4, 1, 1);
      ctx.fillStyle = spec.gemPalette.shadow;
      ctx.fillRect(8, 4, 1, 1);
    }
  }

  function drawStaff(ctx, rng, size) {
    const spec = sampleStaffSpec(rng);
    if (size === 16) {
      renderStaffSpec16(ctx, spec);
    } else {
      renderStaffSpec32(ctx, spec);
    }
    return spec;
  }

  window.sampleStaffSpec = sampleStaffSpec;
  window.renderStaffSpec32 = renderStaffSpec32;
  window.renderStaffSpec16 = renderStaffSpec16;
  window.drawStaff = drawStaff;

  if (typeof globalThis !== 'undefined') {
    globalThis.sampleStaffSpec = sampleStaffSpec;
    globalThis.renderStaffSpec32 = renderStaffSpec32;
    globalThis.renderStaffSpec16 = renderStaffSpec16;
    globalThis.drawStaff = drawStaff;
  }
})();
