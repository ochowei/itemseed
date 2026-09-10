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

### [TASK-007] Implement Staff / Wand Generator (32×32 and 16×16)
- **Status**: TODO
- **Priority**: High
- **Description**: Add procedural magic staff and wand generator following the project's pixel-art conventions.
- **Scope**:
  - Create `staff.js` implementing `sampleStaffSpec`, `renderStaffSpec32`, `renderStaffSpec16`, and `drawStaff`.
  - Support shaft archetypes (wood, polished metal, dark bone) and head styles (crystal orb, crescent finial, spiraling gem).
  - Register `staff` in `ITEM_TYPES` in `main.js`.
  - Add `<script src="staff.js"></script>` and `<option>` to `index.html` and register i18n keys in `i18n/zh-Hant.js` and `i18n/en.js`.
  - Add deterministic seeds to `regression.html` and verify with `npm run check-i18n` and `npm run snapshot`.

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
