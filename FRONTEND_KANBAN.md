# Frontend Development Kanban Board

This board tracks frontend development tasks for the `game-asset-2026-2` project.

### Workflow & Permission Rules (see [AGENTS.md](AGENTS.md))
- **Project Manager**:
  - Publish new tasks to **TODO**.
  - Review completed work and move tasks from **Doing** to **Done**.
  - Move blocked or deferred tasks from **Doing** to **Pending**.
- **Frontend Developer**:
  - Pick up or resume tasks by moving them from **TODO** or **Pending** to **Doing**.
  - *Prohibited from moving tasks directly to Done or Pending.*

---

## 📋 TODO

> Tasks published and prioritized by the Project Manager. Ready for Frontend Developers to pick up.

*(No tasks currently in TODO)*

---

## 🔨 Doing

> Tasks currently under active development by Frontend Developers.

*(No tasks currently in Doing)*

---

## ⏳ Pending

> Tasks paused, blocked by dependencies, or waiting for PM design clarifications.

*(No tasks currently pending)*

---

## ✅ Done

> Completed tasks reviewed and confirmed by the Project Manager.

### [TASK-009] Fix Staff Option Label Consistency in i18n and index.html
- **Status**: Done
- **Completed**: 2026-09-10
- **Summary**: Updated staff option label in `i18n/zh-Hant.js` and `index.html` to `法杖 (staff)` to match naming format across all item types.

### [TASK-008] Fix Staff Head and Shaft Centering Alignment (32x32)
- **Status**: Done
- **Completed**: 2026-09-10
- **Summary**: Corrected 32×32 staff shaft coordinates to `x=15..17` (width 3, centered on cx=16.0), aligning perfectly with head archetypes. Adjusted grip rings and ferrule base to `x=14..18` (width 5) for symmetrical 1px outer steps and centered spike tips. Updated baseline snapshots.

### [TASK-007] Implement Staff / Wand Generator (32×32 and 16×16)
- **Status**: Done
- **Completed**: 2026-09-10
- **Summary**: Implemented procedural magic staff generator in `staff.js` with crescent, orb, and crozier archetypes, 4 elemental crystal palettes (arcane, fire, nature, shadow), shaft grip rings, and ferrule butt caps at 32×32 and 16×16. Integrated into studio UI, regression grid, and captured golden snapshot baselines.

### [TASK-006] Implement Shield Generator (32×32 and 16×16)
- **Status**: Done
- **Completed**: 2026-09-10
- **Summary**: Implemented procedural shield generator in `shield.js` with heater, round, and tower archetypes, multiple boss styles, rivets, and rim accents at 32×32 and 16×16. Integrated with `index.html`, `regression.html`, `i18n/`, and established golden snapshot baselines.

### [TASK-005] Internationalization (i18n) Support
- **Status**: Done
- **Completed**: 2026-05-10
- **Summary**: Implemented dual-language support (zh-Hant / en) with `i18n.js`, dictionaries in `i18n/`, header language switcher, and `npm run check-i18n` static validator.

### [TASK-004] Theme Switcher Runtime & Persistence
- **Status**: Done
- **Completed**: 2026-05-10
- **Summary**: Implemented theme runtime (`theme.js`, `theme.css`) with support for URL query params, localStorage persistence, OS dark/light detection, and automated tests (`scripts/test-theme.mjs`).

### [TASK-003] Implement Spear Generator
- **Status**: Done
- **Completed**: 2026-05-08
- **Summary**: Implemented procedural spear generator in `spear.js` with trident, hooked, and straight archetypes at 32×32 and 16×16, added visual regression baseline.

### [TASK-002] Implement Sword Generator
- **Status**: Done
- **Completed**: 2026-05-07
- **Summary**: Implemented procedural sword generator in `sword.js` with blade lengths, crossguards, pommels, and deterministic regression suite.

### [TASK-001] Implement Potion Generator
- **Status**: Done
- **Completed**: 2026-05-07
- **Summary**: Implemented baseline procedural potion generator in `potion.js` with liquid fills, corks, bottle shapes, and bubbling effects.
