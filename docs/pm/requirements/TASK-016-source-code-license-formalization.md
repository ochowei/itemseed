# [TASK-016] Source Code License Formalization & Repository Dual-License Alignment

## 1. Overview & Objective
Formally select and implement the official open-source license for the ItemSeed engine and source code upon the conclusion of the Code Provenance Audit ([TASK-013]). Add the official root `LICENSE` file, update `package.json`, and synthesize a complete "License & Provenance" dual-licensing section in `README.md` that distinguishes the engine code license from the CC0 asset license.

## 2. Problem Statement
Currently, ItemSeed only specifies `"license": "ISC"` as a one-line field inside `package.json` without an accompanying root `LICENSE` text file. More importantly, as established in the itch.io Release Checklist, the source code license cannot be treated as finalized until the provenance audit confirms that no GPL-derived code exists in the repository. Once verified, the source code must be granted an explicit legal license so external developers can contribute, fork, or build tools around ItemSeed with legal certainty.

## 3. Scope & Requirements

### 3.1 Audit Outcome Evaluation & License Selection
- Evaluate findings from [TASK-013]:
  - **If Green (Independent Implementation)**: Formally adopt the **MIT License** (recommended for maximum permissive developer adoption) or maintain **ISC License**, establishing clear copyright terms for the codebase.
  - **If Red (GPL Derivation Confirmed)**: Either license the repository under **GPL-3.0-or-later** or mandate clean-room isolation/rewriting before permissive release.

### 3.2 Add Root `LICENSE` File
- Add standard, full text for the chosen open-source license (`LICENSE`) in the repository root.
- State copyright ownership cleanly (e.g. `Copyright (c) 2026 ItemSeed Contributors`).

### 3.3 Package Metadata Synchronization
- Ensure `package.json` `"license"` identifier exactly matches the root `LICENSE` SPDX identifier (e.g. `"MIT"` or `"ISC"`).

### 3.4 Dual-Licensing Alignment in `README.md`
- Add a prominent, structured "License & Provenance" section in `README.md` presenting:
  1. **Source Code**: Engine codebase under the selected license (linking to `LICENSE`).
  2. **Generated Assets**: Exported sprites and JSON specs under CC0 1.0 (linking to `ASSET-LICENSE.md`).
  3. **Provenance & Attribution**: Transparency note crediting Brian MacIntosh's Icon Machine and linking to `docs/PROVENANCE.md`.

## 4. Acceptance Criteria
- [x] Source code license decision formally justified and recorded based on [TASK-013] audit findings.
- [x] Root `LICENSE` file exists containing the complete legal text.
- [x] `package.json` `"license"` field accurately reflects the selected SPDX identifier.
- [x] `README.md` provides side-by-side clarification of Source Code License vs. Generated Assets License.
- [x] Link to `docs/PROVENANCE.md` is clearly referenced in `README.md`.

## 5. Implementation Notes (for Project Manager)
- This task must remain blocked or pending until [TASK-013] (audit) and [TASK-014] (asset license) have reached conclusion.
- This task affects repository governance files (`LICENSE`, `package.json`, `README.md`), which fall under Project Manager authority.
