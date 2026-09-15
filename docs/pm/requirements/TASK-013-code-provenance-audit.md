# [TASK-013] GPL / Code Provenance Audit & Provenance Documentation

## 1. Overview & Objective
Establish a formal, documented Code Provenance Audit for ItemSeed to verify whether the codebase is an independent implementation or contains GPL-derived code from Brian MacIntosh's "Icon Machine". The deliverable is a comprehensive audit record and `docs/PROVENANCE.md` that clarifies origins, credits inspirational sources, and establishes whether ItemSeed can safely adopt a permissive open-source license (such as MIT).

## 2. Problem Statement
ItemSeed was conceptually inspired by Brian MacIntosh's "Icon Machine", which is licensed under the GNU General Public License (GPL). Under open-source licensing rules, if any code was directly copied, translated, or refactored from GPL source code (including via AI assistants prompted with original source files), the entire project could become subject to GPL copyleft requirements. Releasing the project without verifying its provenance creates legal uncertainty for both the maintainers and downstream users (game developers).

## 3. Scope & Requirements

### 3.1 Codebase Audit Execution
1. **Git History Inspection**:
   - Audit git history from initial commit (`f9b8f4e`) to verify repo was initialized as an independent skeleton rather than cloned or forked from Icon Machine.
   - Verify that early commits did not introduce Brian's original source files, license headers, or proprietary structures.
2. **Component-by-Component Source Comparison**:
   - **`random.js`**: Verify PRNG implementation (Mulberry32 + simplified cyrb53 hash) against public algorithms vs Brian's `random.js`.
   - **`pixel-utils.js` & `palette.js`**: Verify mask representations, flood fill, edge detection, and HSL palettes are independent implementations.
   - **Generator Modules (`potion.js`, `sword.js`, `spear.js`, `shield.js`, `staff.js`)**: Compare item archetypes, drawing routines, pixel coordinate tables, and branch structures against Icon Machine to ensure they follow ItemSeed's clean two-phase (`spec` -> `render`) pattern.
3. **AI Prompting & Reference Process Verification**:
   - Confirm whether source files were pasted into AI prompts for refactoring or whether implementations were generated from behavioral concepts and visual reference.
   - Separate visual inspiration (looking at pixel art style) from code reference (looking at or copying source logic).

### 3.2 Audit Classification
- Classify the outcome according to checklist section 3.2:
  - **Green**: Independent implementation; concept/UI/visual reference only. Safe for MIT / ISC with provenance credit.
  - **Yellow**: Ambiguous origin or highly similar blocks. Requires module isolation and deeper diff review.
  - **Red**: Direct derivation from GPL source. Requires either full GPL adoption or clean-room rewrite.

### 3.3 Documentation (`docs/PROVENANCE.md`)
Create `docs/PROVENANCE.md` containing:
- Explicit attribution: "ItemSeed is inspired by Brian MacIntosh's Icon Machine."
- List of referenced public resources, algorithms, and links (e.g. Mulberry32 PRNG, cyrb53 hash, HSL color space).
- Architecture explanation highlighting ItemSeed's two-phase `seed -> spec -> render` pipeline.
- Audit ledger listing each audited file, audit date, classification status, and rationale.

## 4. Acceptance Criteria
- [ ] Complete inspection of Git commit history from initial commit to HEAD.
- [ ] Line-by-line provenance check of `random.js`, `pixel-utils.js`, `palette.js`, and all generator modules.
- [ ] Audit classification (Green, Yellow, or Red) officially concluded and recorded.
- [ ] `docs/PROVENANCE.md` published with clear attribution, public algorithm references, and module audit status.
- [ ] No unverified or unresolved GPL dependencies remain in production files.

## 5. Implementation Notes (for Project Manager / Auditor)
- This is a compliance and documentation task conducted by the Project Manager.
- Source code in `*.js` should not be modified during this audit unless required to remove identified legacy artifacts.
- If clean-room reimplementation is ever required (Red classification), document old behavior specs before proceeding.
