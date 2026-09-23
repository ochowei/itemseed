# [TASK-026] Refine Bow Arrowhead, Fletching, and Nocking Alignment

## 1. Overview & Objective
Refine the visual rendering of the Bow Generator (`bow.js`) in both 32×32 and 16×16 resolutions to eliminate visual ambiguity regarding firing orientation. The arrow must unmistakably read as aiming and shooting towards the **top-right** quadrant.

Specific user feedback identified:
1. The fletching (arrow feather) at the bottom-left was overly wide and triangular, resembling a barbed/broadhead arrowhead.
2. The true arrowhead at the top-right was too rounded and compact, resembling a metallic sphere or orb rather than a sharp piercing projectile.
3. Excessive arrow shaft extended behind the bowstring, making the arrow appear to be sliding backwards toward the bottom-left rather than fully drawn against the nocking point.

## 2. Requirements & Scope

### 2.1 32×32 Rasterizer Refinement (`renderBowSpec32` in `bow.js`)
1. **Sharpened Arrowhead (Top-Right)**:
   - Extend the arrowhead forward to create an unmistakably sharp, elongated piercing point pointing towards top-right (e.g. tip extending towards `(28, 3)`).
   - Give the arrowhead tapered facets with clean metallic shading (`shine`, `main`, `shadow`, `outline`) that read as an edged blade.
2. **Nocking Alignment & Shaft Positioning**:
   - Align the rear of the arrow so the nock rests directly at the string's nocking point `(10, 21)` (or extends at most 1–2px behind it).
   - Eliminate the 6px of excess arrow shaft trailing behind the string.
3. **Streamlined Feather Fletching**:
   - Redesign the fletching into sleek, elongated feather vanes running along the shaft just ahead of/at the nocking point (around `(8, 23)` to `(12, 19)`).
   - Avoid wide outward flaring that creates a "barbed head" silhouette.

### 2.2 16×16 Rasterizer Refinement (`renderBowSpec16` in `bow.js`)
1. **Sharpened Arrowhead**:
   - Ensure the 16×16 arrowhead tip is prominently acute and clearly pointing towards top-right `(13, 2)`–`(14, 1)`.
2. **Nocking Alignment**:
   - Terminate the arrow shaft near the nocking point `(5, 10)` rather than protruding to `(3, 12)`.
3. **Fletching Proportions**:
   - Keep 16×16 fletching streamlined along the shaft.

### 2.3 Visual Regression & Baseline Update
1. Update `regression.html` and verify rendering across all 16 `BOW_SEEDS`.
2. Run `npm run snapshot -- --promote` to capture and commit the refreshed golden baselines in `snapshots/baseline/`.
3. Run `npm test` to verify full regression test suite passes.
