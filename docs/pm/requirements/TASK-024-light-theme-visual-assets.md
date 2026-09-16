# [TASK-024] Update itch.io Cover and Screenshots to Light Theme

## 1. Overview & Objective
Align all official itch.io visual assets (`cover.png` and screenshots 1, 2, 3 in `docs/pm/assets/`) with the newly established Light theme default from `TASK-022`. This ensures that potential players and developers see a consistent, bright retro parchment aesthetic on the itch.io storefront that matches the first-run browser experience.

## 2. Requirements & Scope

### 2.1 Cover Image (`cover.png`)
Update the HTML/CSS composition template in `scripts/generate-itch-assets.mjs`:
- **Background**: Soft parchment retro texture (`#f0ece4` background color with subtle grid pattern matching Light theme).
- **Typography & Brand**: Dark purple-black ink (`#2a2638`), with warm amber/gold brand accents (`#c46a00`).
- **Badges**: Light-tinted badges with dark text and borders matching `--accent` and `--accent-2`.
- **Item Showcase Cards**: Clean white/cream card backgrounds (`#ffffff`), subtle borders (`#c8c2b4`), gentle soft shadows (`rgba(0, 0, 0, 0.08)`).
- **Canvas Framing**: Light-neutral canvas boxes (`#e8e0d0` or `#f7f3ea`) so transparent pixel art sprites stand out sharply with nearest-neighbor crispness.
- **Footer Bar**: White/cream background (`#ffffff`), subtle border (`#c8c2b4`), dimmed ink text (`#6a6458`).

### 2.2 Studio Screenshots
In `scripts/generate-itch-assets.mjs`:
- **Screenshot 1 (`screenshot_01_studio.png`)**:
  - Update query string to `?theme=light&lang=en`.
- **Screenshot 2 (`screenshot_02_batch.png`)**:
  - Captured from the Light theme studio session.
- **Screenshot 3 (`screenshot_03_dual_resolution.png`)**:
  - Update URL to `regression.html?theme=light`.

### 2.3 Asset Re-generation & Verification
- Run `node scripts/generate-itch-assets.mjs` to regenerate all 4 visual assets in `docs/pm/assets/`.
- Ensure all 5 items in `cover.png` render valid non-zero pixels.
- Ensure all tests pass (`npm test`).

## 3. Acceptance Criteria
- [x] `cover.png` displays clean Light theme colors (parchment background, white cards, crisp pixel art).
- [x] `screenshot_01_studio.png`, `screenshot_02_batch.png`, and `screenshot_03_dual_resolution.png` display the Light theme interface.
- [x] All 4 image files in `docs/pm/assets/` are successfully regenerated.
- [x] `npm test` passes without regression.
