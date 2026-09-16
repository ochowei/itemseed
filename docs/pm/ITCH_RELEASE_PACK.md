# ItemSeed — itch.io Complete Release Pack

> **Single Source of Truth** for publishing ItemSeed to itch.io.  
> Contains all dashboard settings, copy-paste descriptions, file paths, upload instructions, and pre-flight checklists.

---

## 1. Quick Asset & Package Checklist

Run these two commands in the repository root to ensure the latest bundle and visual assets are ready before uploading:

```bash
# 1. Generate the itch.io HTML5 ZIP bundle (outputs itemseed-v<version>.zip, e.g. itemseed-v1.0.0.zip):
npm run package:itch

# 2. (Optional) Re-generate official cover and screenshots into docs/pm/assets/:
npm run assets:itch
```

| Asset Name | Local File Location | Purpose on itch.io |
| :--- | :--- | :--- |
| **HTML5 Package** | `itemseed-v1.0.0.zip` (or `itemseed-v<version>.zip`) | Uploaded in **Uploads** section with *"This file will be played in the browser"* checked. |
| **Cover Image** | `docs/pm/assets/cover.png` | Storefront cover (`1260 × 1000 px`, 2x Retina compatible). |
| **Screenshot 1** | `docs/pm/assets/screenshot_01_studio.png` | Desktop studio interface in action (`1280 × 800 px`). |
| **Screenshot 2** | `docs/pm/assets/screenshot_02_batch.png` | 24-cell batch preview exploration (`1280 × 800 px`). |
| **Screenshot 3** | `docs/pm/assets/screenshot_03_dual_resolution.png` | Native 32×32 vs 16×16 pixel art comparison (`1280 × 800 px`). |
| **Store Description (Rich)** | `docs/pm/store-description.html` | Formatted preview helper for copy-pasting directly into itch.io rich text editor. |

---

## 2. itch.io Project Dashboard Settings

Fill in the itch.io metadata form fields exactly as specified below:

| Field Name | Recommended Setting / Text |
| :--- | :--- |
| **Title** | `ItemSeed — Pixel Art RPG Item Generator` |
| **Project URL** | `https://[your-username].itch.io/itemseed` |
| **Short description / Tagline** | `Generate deterministic 16×16 and 32×32 RPG item icons directly in your browser. CC0 Free for commercial games.` |
| **Classification** | `Game Assets` (or `Tools`) |
| **Kind of project** | `HTML` *(You have a ZIP or HTML file that will be played in the browser)* |
| **Release status** | `Released` or `In development` (Beta) |
| **Pricing** | `$0 or donate` (*Name your own price* recommended for initial release) |
| **Suggested donation** | `$2.00` |

### 2.1 Embed / Viewport Settings (for HTML5 in Browser)
Under **Embed options**:
* **Viewport dimensions**:
  * **Width**: `1280` px
  * **Height**: `850` px
* **Check**: `[✓] Embed in page`
* **Check**: `[✓] Manually set size`
* **Check**: `[✓] Enable fullscreen button`
* **Check**: `[✓] Automatically start on page load`
* **Orientation**: `Both` / `Landscape preferred`

---

## 3. Store Description Copy (Ready to Copy-Paste)

itch.io's project description field uses a **Rich Text (WYSIWYG) Editor** by default, rather than raw Markdown. Choose whichever workflow matches your itch.io account configuration:

### Method A (Recommended for Default itch.io Editor): Rich Formatted Copy
1. Open [docs/pm/store-description.html](store-description.html) in your web browser.
2. Select and copy all content inside the white box (`Cmd+A` / `Cmd+C`).
3. Paste (`Cmd+V`) directly into the itch.io description editor.  
   *All headings, bold typography, bullet lists, and links will automatically paste with clean, native formatting.*

---

### Method B (For itch.io Markdown Mode):
> **Note**: To use raw Markdown on itch.io, go to **Account Settings** &rarr; **Content** &rarr; enable **"Prefer Markdown input where available"**. Note that itch.io's Markdown processor does not support Markdown pipe tables (`|...|`), so the licensing section below is pre-formatted as clean nested lists:

```markdown
# ItemSeed — Pixel Art RPG Item Generator

**ItemSeed** is a seeded, deterministic procedural pixel-art RPG item generator that runs directly in your browser.

Generate infinite weapons, gear, and magical artifacts without external dependencies or heavy engines. Every generated asset can be downloaded as a clean, transparent PNG and is licensed under **CC0 1.0 Universal** — **100% free for commercial and indie games with no strings attached**.

---

### ✨ Key Features

- **Native 16×16 & 32×32 Pixel Art**: Built from the ground up for retro resolutions. 16×16 icons are uniquely hand-compressed with feature-folding logic, never crudely downscaled.
- **Same Seed = Same Item**: Fully deterministic procedural generation. A 20-character string reproduces the exact same sprite every time, allowing artwork to live in source code rather than binary blobs.
- **24-Cell Batch Exploration**: Explore 24 procedural variations simultaneously. Click any cell to immediately inspect, fine-tune, or download.
- **Transparent PNG Export**: Single-click download (`⇩ png`) with standardized filenames containing item type, seed string, and resolution.
- **Multi-Theme & Multi-Language**: Seamless dark/light theme switching and full dual-language support (English & 繁體中文).
- **Runs Everywhere**: Zero build step, vanilla HTML5 Canvas + JavaScript. No ads, no logins, no paywalls.

---

### 🛡️ Supported Item Families

1. **Potion**: Volumetric flasks, round bottles, test tubes with fluid levels, bubbling effects, and cork/wax/cloth seal stoppers.
2. **Sword**: Slanted broadswords, rapiers, and curved sabers with blade reflections, crossguards, grips, and pommels.
3. **Spear**: Symmetrical tridents, harpoons, and straight lances with bound shafts and butt caps.
4. **Shield**: Heater shields, studded tower shields, and round bucklers with ornate bosses and rim rivets.
5. **Staff**: Crescent-head, arcane-orb, and shepherd-crozier staves with embedded 4-element crystal matrices.

---

### 📜 Clear, Developer-Friendly Licensing

- **Generated Assets (PNG & JSON) — CC0 1.0 Universal (Public Domain)**  
  **Free for commercial games**, personal projects, game jams, and modifications. No royalties, no attribution required.
- **Generator Engine (Source Code) — MIT License**  
  Fully open source. Free to inspect, study, fork, or build tools around.

---

### ❓ Frequently Asked Questions (FAQ)

**Q: Can I use the generated icons in commercial games sold on Steam, itch.io, or consoles?**  
**A:** Yes, absolutely. All exported PNG files and JSON specifications are dedicated to the public domain under CC0 1.0. You may use them in any commercial product without paying royalties or asking for permission.

**Q: Do I need to credit ItemSeed in my game?**  
**A:** No attribution is legally required. A shoutout in your credits is always appreciated, but entirely optional.

**Q: Can I edit, recolor, or upscale the downloaded icons?**  
**A:** Yes. Feel free to open the transparent PNGs in Aseprite, Photoshop, or your favorite pixel editor to adjust palettes or add animations.

---

### 💡 Credits & Attribution

- **Inspiration**: ItemSeed is inspired by Brian MacIntosh's pioneering [Icon Machine](https://bmaczero.itch.io/icon-machine).
- **Provenance & Verification**: ItemSeed is an independent, clean-room implementation using modern canvas rendering and standard public-domain algorithms (Mulberry32 PRNG and cyrb53 hash). Full audit record is available in our [PROVENANCE.md](https://github.com/ochowei/itemseed/blob/dev/docs/PROVENANCE.md).
- **Source Code**: Explore the source, report issues, or contribute on [GitHub (ochowei/itemseed)](https://github.com/ochowei/itemseed).
```

---

## 4. Metadata & Tags

Copy and paste these tags into the **Tags** field on itch.io:

```
pixel-art, generator, rpg, game-assets, procedural, tools, cc0, html5, fantasy, retro, 2d, icons, indie-game-dev, open-source
```

* **Community**: `Comments` (Enable comments so developers can post feedback and feature requests).
* **Visibility & Access**:
  * Set to `Draft` initially while verifying the upload.
  * Switch to `Public` once the in-browser preview is verified.

---

## 5. Step-by-Step Pre-Flight Release Gate

Follow this step-by-step checklist before flipping the switch to **Public**:

- [ ] **Step 1: Build Package**: Run `npm run package:itch` in terminal to produce `itemseed-v<version>.zip` (e.g. `itemseed-v1.0.0.zip`).
- [ ] **Step 2: Upload Archive**: In itch.io project dashboard, upload `itemseed-v1.0.0.zip` and check *"This file will be played in the browser"* (and set the version tag to `v1.0.0`).
- [ ] **Step 3: Upload Cover**: Upload `docs/pm/assets/cover.png` as the main project cover image.
- [ ] **Step 4: Upload Screenshots**: Upload `screenshot_01_studio.png`, `screenshot_02_batch.png`, and `screenshot_03_dual_resolution.png` from `docs/pm/assets/`.
- [ ] **Step 5: Paste Details**: Paste Title, Tagline, Tags, and the Store Description from Section 3.
- [ ] **Step 6: Save & Preview in Draft**:
  - Click **Save & view page**.
  - Test browser embed: Verify the web canvas boots cleanly.
  - Test seed input and click **⟳** reroll.
  - Click a cell in the 24-cell batch preview.
  - Click **⇩ png** and verify the download initiates with a standardized filename (e.g., `itemseed_sword_..._32x32.png`).
- [ ] **Step 7: Publish**: In dashboard, change **Visibility** to **Public** and save!
