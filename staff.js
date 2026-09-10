// staff.js — Seeded procedural magic staff generator (32x32 and 16x16)

(function () {
  const STAFF_ARCHETYPES = ['crescent', 'orb', 'crozier'];
  const STAFF_BUTT_STYLES = ['spike', 'rounded'];

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
      shaftPalette: WOOD_PALETTE,
      hasGripRings,
      ringYs,
      buttStyle,
    };
  }

  function renderStaffSpec32(ctx, spec) {
    // Stub to be implemented in Task 3
  }

  function renderStaffSpec16(ctx, spec) {
    // Stub to be implemented in Task 4
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
